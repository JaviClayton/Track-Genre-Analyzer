import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const PORT = Number(process.env.PORT) || 3000;

const app = express();

// Body parser
app.use(express.json({ limit: "10mb" }));

// Initialize Gemini API client on the server securely
const apiKey = process.env.GEMINI_API_KEY;

// Fail-fast lazy initialization helper as recommended in guidelines
function getGeminiClient(): GoogleGenAI {
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is missing from environment secrets.");
  }
  return new GoogleGenAI({
    apiKey: apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
}

// Helper to check if error is related to rate limits or resource exhaustion
const isRateLimitError = (error: any): boolean => {
  const errStr = String(error).toLowerCase();
  const errMessage = error?.message ? String(error.message).toLowerCase() : "";
  const errStatus = error?.status || error?.statusCode || error?.code;
  return (
    errStatus === 429 ||
    errStr.includes("429") ||
    errStr.includes("resource_exhausted") ||
    errStr.includes("quota") ||
    errMessage.includes("429") ||
    errMessage.includes("resource_exhausted") ||
    errMessage.includes("quota")
  );
};

// Helper to check for transient errors like rate limits or 503 high demand / service unavailable
const isTransientError = (error: any): boolean => {
  if (!error) return false;
  const errStr = String(error).toLowerCase();
  const errMessage = error?.message ? String(error.message).toLowerCase() : "";
  const errStatus = Number(error?.status || error?.statusCode || error?.code);
  
  return (
    errStatus === 429 ||
    errStatus === 503 ||
    errStatus === 504 ||
    errStatus === 502 ||
    errStr.includes("429") ||
    errStr.includes("503") ||
    errStr.includes("high demand") ||
    errStr.includes("temporary") ||
    errStr.includes("resource_exhausted") ||
    errStr.includes("quota") ||
    errStr.includes("busy") ||
    errStr.includes("unavailable") ||
    errStr.includes("overloaded") ||
    errMessage.includes("429") ||
    errMessage.includes("503") ||
    errMessage.includes("high demand") ||
    errMessage.includes("temporary") ||
    errMessage.includes("resource_exhausted") ||
    errMessage.includes("quota") ||
    errMessage.includes("busy") ||
    errMessage.includes("unavailable") ||
    errMessage.includes("overloaded")
  );
};

// Robust generator call wrapping with exponential retry backoff & fallback behaviors
function parseRetryDelay(error: any): number | null {
  try {
    const errStr = typeof error === "object" ? JSON.stringify(error) : String(error);
    
    // 1. Regex to check for sentences like "Please retry in 34.39s" or "34s"
    const match = errStr.match(/Please\s+retry\s+in\s+([\d\.]+)\s*s/i);
    if (match && match[1]) {
      const sec = parseFloat(match[1]);
      if (!isNaN(sec)) {
        return Math.ceil(sec * 1000);
      }
    }

    // 2. Parse structured details if available
    if (error && typeof error === "object") {
      if (typeof error.message === "string" && error.message.trim().startsWith("{")) {
        try {
          const parsed = JSON.parse(error.message);
          const details = parsed?.error?.details || parsed?.details;
          if (Array.isArray(details)) {
            for (const detail of details) {
              if (detail.retryDelay && typeof detail.retryDelay === "string") {
                const sMatch = detail.retryDelay.match(/^([\d\.]+)\s*s$/);
                if (sMatch && sMatch[1]) {
                  const sVal = parseFloat(sMatch[1]);
                  if (!isNaN(sVal)) return Math.ceil(sVal * 1000);
                }
              }
            }
          }
        } catch (_) {}
      }
      
      const details = error.details || error.error?.details;
      if (Array.isArray(details)) {
        for (const detail of details) {
          if (detail.retryDelay && typeof detail.retryDelay === "string") {
            const sMatch = detail.retryDelay.match(/^([\d\.]+)\s*s$/);
            if (sMatch && sMatch[1]) {
              const sVal = parseFloat(sMatch[1]);
              if (!isNaN(sVal)) return Math.ceil(sVal * 1000);
            }
          }
        }
      }
    }
  } catch (e) {
    console.error("Error parsing retry delay:", e);
  }
  return null;
}

async function generateContentWithRetry(ai: GoogleGenAI, params: any, maxRetries = 4) {
  let attempt = 0;
  while (true) {
    try {
      return await ai.models.generateContent(params);
    } catch (error: any) {
      attempt++;
      if (isTransientError(error) && attempt <= maxRetries) {
        // Look for exact delay instructed by Google API
        const parsedDelay = parseRetryDelay(error);
        const isRateLimit = isRateLimitError(error);
        const errCode = error?.status || error?.statusCode || error?.code || "503/UNAVAILABLE";

        // Fallback: strip Google Search tool if we hit repeated limits
        if (attempt >= 1 && params.config && params.config.tools) {
          console.warn("[Gemini Fallback Optimizer] Disabling Google Search tools to lower quota/load consumption during retry attempt...");
          const cleanConfig = { ...params.config };
          delete cleanConfig.tools;
          delete cleanConfig.toolConfig;
          params = { ...params, config: cleanConfig };
        }

        // SWAP MODEL TO ALTERNATIVES immediately if we hit persistent limitations or demand spikes (503/504)
        const originalModel = params.model;
        let nextModel = originalModel;
        
        if (originalModel === "gemini-3.8-flash") {
          nextModel = "gemini-flash-latest";
        } else if (originalModel === "gemini-flash-latest") {
          nextModel = "gemini-3.7-flash";
        } else if (originalModel === "gemini-3.7-flash") {
          nextModel = "gemini-3.1-flash-lite";
        } else if (originalModel === "gemini-3.1-pro-preview") {
          nextModel = "gemini-3.8-flash";
        } else if (originalModel === "gemini-3.1-flash-lite") {
          nextModel = "gemini-3.8-flash";
        } else {
          nextModel = "gemini-flash-latest";
        }
        
        const isModelSwitched = nextModel !== originalModel;
        if (isModelSwitched) {
          console.warn(`[Gemini Fallback Optimizer] Model overload/demand on '${originalModel}'. Routing to '${nextModel}'...`);
          params = { ...params, model: nextModel };
        }

        // If switching models, we can retry much faster (~1.5s) without waiting out the previous model's cooldown
        const delay = parsedDelay 
          ? parsedDelay + 1000 
          : isModelSwitched 
            ? 1200 + Math.random() * 800
            : (isRateLimit ? Math.pow(2, attempt) * 2000 : 2000 + attempt * 1500) + Math.random() * 1000;
          
        console.warn(`[Gemini API Transient Handler] Attempt ${attempt} / ${maxRetries} encountered ${errCode}. Retrying on model '${params.model}' in ${Math.round(delay)}ms...`);
        await new Promise((resolve) => setTimeout(resolve, delay));

        continue;
      }
      // Attach the parsed delay to the raw error so that callers can access it
      const parsedDelay = parseRetryDelay(error);
      if (parsedDelay && error) {
        error.retryDelayMs = parsedDelay;
      }
      throw error;
    }
  }
}

// REST api route to analyze/verify list of music tracks
app.post("/api/analyze-tracks", async (req, res) => {
  try {
    const ai = getGeminiClient();
    const { 
      tracks, 
      curateGenre = true, 
      verifyBpmKey = false, 
      verifyYear = false, 
      useSearch = false, 
      model = "gemini-3.8-flash" 
    } = req.body;

    if (!Array.isArray(tracks) || tracks.length === 0) {
      return res.status(400).json({ error: "Missing or invalid 'tracks' parameter." });
    }

    // Limit batch size to protect against token limits and speed up responses
    const limitedTracks = tracks.slice(0, 30);

    const genreInstruction = curateGenre
      ? `1. GENRE CURATION (ENABLED):
Analyze the track and determine the correct, reliable music genre(s) (e.g., 'Afro House', 'Deep House', 'Melodic Techno', 'Hip-Hop', 'Trip-Hop', 'Progressive House', 'Downtempo').
Reference music databases like Beatport, Discogs, Traxsource, Spotify, or Resident Advisor.
- If originalGenre is blank, '(MISSING)', or inaccurate, research and recommend the full, accurate genre string in 'recommendedGenre'.
- Set 'isCorrect' to true if originalGenre is already accurate, or false if it was missing/incorrect/incomplete.`
      : `1. GENRE CURATION (DISABLED):
Genre curation is disabled for this request. Return the track's originalGenre in 'recommendedGenre' without altering it, and set 'isCorrect' to true.`;

    const verifyBpmKeyInstruction = verifyBpmKey
      ? `2. BPM & KEY VERIFICATION (ENABLED):
Verify the tempo (BPM) and harmonic Key signature representing each track. 
Analyze professional music databases. If the original BPM is inaccurate or missing, identify the correct BPM (e.g., '124' or '128').
If the original harmonic Key is inaccurate or missing, identify the correct Key (prefer Camelot harmonic key formats like '8A', '11B', '4A', etc. if you can determine it, otherwise use traditional musical keys like 'C minor', 'F# major').
Return the corrected or verified values in 'recommendedBpm' and 'recommendedKey'.`
      : `2. BPM & KEY VERIFICATION (DISABLED):
Since BPM and Key verification is NOT enabled for this request, return the track's originalBpm inside 'recommendedBpm' and the track's originalKey inside 'recommendedKey' without alteration.`;

    const verifyYearInstruction = verifyYear
      ? `3. RELEASE YEAR IDENTIFICATION (ENABLED):
Research and identify the original commercial release year of the track (4-digit year format, e.g., '2024', '1998', '2016'). 
This corresponds to the standard audio metadata 'Year' tag (Windows metadata / ID3 tag / DJ library release year). Reference Discogs, Beatport, MusicBrainz, Spotify, or label release records.
Return the 4-digit release year string in 'recommendedYear'.`
      : `3. RELEASE YEAR IDENTIFICATION (DISABLED):
Since Release Year identification is NOT enabled for this request, return the track's originalYear inside 'recommendedYear' without alteration.`;

    const prompt = `You are an expert music archivist, discographer, and DJ database specialist. 
Analyze the following tracks based strictly on the requested curation modes.
Reference music databases like Beatport, Discogs, Traxsource, Spotify, Wikipedia, MusicBrainz, or Resident Advisor for highly accurate assignments.

${genreInstruction}

${verifyBpmKeyInstruction}

${verifyYearInstruction}

4. EXPLANATION & SOURCES:
- Provide the names of the reliable music reference databases or sources you cited (e.g., ["Beatport", "Discogs"]).
- Provide a compact 1-2 sentence explanation of your findings in 'explanation'.

Here is the track metadata list:
${JSON.stringify(
  limitedTracks.map((t) => ({
    trackId: t.id,
    title: t.title,
    artist: t.artist,
    album: t.album,
    originalGenre: t.genre || "(MISSING)",
    originalBpm: t.bpm || "(MISSING)",
    originalKey: t.key || "(MISSING)",
    originalYear: t.year || "(MISSING)",
    comments: t.comments,
    myTag: t.myTag,
    mixName: t.mixName,
  })),
  null,
  2
)}
`;

    // Establish schema & configs
    const config: any = {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          results: {
            type: Type.ARRAY,
            description: "List of curation results corresponding to the tracks analyzed",
            items: {
              type: Type.OBJECT,
              properties: {
                trackId: { type: Type.STRING },
                recommendedGenre: { 
                  type: Type.STRING, 
                  description: "Highly accurate resolved music genre(s), keeping standard capitalization, e.g., 'Afro House' or 'Trip-Hop / Downtempo'." 
                },
                isCorrect: { 
                  type: Type.BOOLEAN, 
                  description: "True if the originalGenre was accurate and complete. False if missing, incomplete, or incorrect." 
                },
                explanation: { 
                  type: Type.STRING, 
                  description: "A solid, specific 1-2 sentence annotation citing style traits, release year, or label catalogs." 
                },
                sources: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                  description: "Reliable platforms analyzed for this track, e.g., ['Beatport', 'Discogs', 'Wikipedia']"
                },
                recommendedBpm: {
                  type: Type.STRING,
                  description: "The verified/corrected BPM (e.g., '124' or '126.5') or original value if correct/verification is disabled."
                },
                recommendedKey: {
                  type: Type.STRING,
                  description: "The verified/corrected harmonic Key representation (e.g., '8A', '11B') or original value if correct/verification is disabled."
                },
                recommendedYear: {
                  type: Type.STRING,
                  description: "The verified/identified 4-digit commercial release year (e.g., '2024', '1998') or original value if verification is disabled."
                }
              },
              required: ["trackId", "recommendedGenre", "isCorrect", "explanation", "sources", "recommendedBpm", "recommendedKey", "recommendedYear"]
            }
          }
        },
        required: ["results"]
      }
    };

    // Google Search Grounding is highly accurate but rate-restrictive.
    // Making it optional allows massive batch speedups under standard quotas.
    if (useSearch) {
      config.tools = [{ googleSearch: {} }];
      config.toolConfig = { includeServerSideToolInvocations: true };
    }

    // Modern Gemini 3.5 Flash Schema constraint definition (using generateContentWithRetry)
    const response = await generateContentWithRetry(ai, {
      model: model,
      contents: prompt,
      config: config
    });

    const parsedResponse = JSON.parse(response.text || "{}");
    res.json(parsedResponse);
  } catch (error: any) {
    console.error("Gemini Curation Pipeline Error:", error);
    const errStatus = Number(error?.status || error?.statusCode || error?.code);
    const is503 = errStatus === 503 || String(error).toLowerCase().includes("503") || String(error?.message).toLowerCase().includes("503");
    
    if (isRateLimitError(error) || is503) {
      const isQuotaType = isRateLimitError(error);
      const code = isQuotaType ? 429 : 503;
      const title = isQuotaType ? "Rate limit / Quota exceeded." : "Model demand surge / temporary overloaded.";
      const msg = isQuotaType 
        ? "Your Gemini API limit has been reached. Please wait a moment before trying again."
        : "The AI service is currently overloaded. We are backing off and waiting to retry your batch.";
      
      return res.status(code).json({
        error: title,
        message: msg,
        retryDelayMs: error.retryDelayMs || (isQuotaType ? 15000 : 10000)
      });
    }
    res.status(500).json({ 
      error: "Failed to curate genres.", 
      message: error instanceof Error ? error.message : String(error) 
    });
  }
});

// Serve health status
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", apiKeyConfigured: !!apiKey });
});

// Configure development or production asset serving
async function setupServer() {
  if (process.env.NODE_ENV !== "production") {
    console.log("Starting server in DEVELOPMENT mode with lazy Vite middleware...");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    console.log("Starting server in PRODUCTION mode, serving static files...");
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

setupServer().catch((err) => {
  console.error("Failed to bootstrap server:", err);
});
