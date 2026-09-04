import React, { useState, useEffect, useRef } from "react";
import { Track, CurationStatus, CurationResult } from "./types.js";
import { getSampleTracks } from "./sampleTracks.js";
import { parseTrackFile, exportTracks } from "./fileParser.js";
import { normalizeGenreTags, mergeGenreTags } from "./genreUtils.js";
import TrackTable from "./components/TrackTable.js";
import TrackDetailModal from "./components/TrackDetailModal.js";
import { 
  Sparkles, 
  Upload, 
  Download, 
  RefreshCw, 
  Database, 
  AlertTriangle,
  FileSpreadsheet,
  Music,
  Maximize2,
  CheckCircle,
  HelpCircle,
  Clock,
  Settings,
  Flame,
  Info,
  Sliders,
  Calendar,
  FileText
} from "lucide-react";

export default function App() {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [originalHeaders, setOriginalHeaders] = useState<string[]>([]);
  const [delimiter, setDelimiter] = useState("\t");
  const [encoding, setEncoding] = useState("utf-16le");
  const [fileName, setFileName] = useState("");
  const [selectedTrack, setSelectedTrack] = useState<Track | null>(null);
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressText, setProgressText] = useState("");
  const [systemError, setSystemError] = useState<string | null>(null);
  const [isSampleLoaded, setIsSampleLoaded] = useState(false);
  const [apiOnline, setApiOnline] = useState<boolean | null>(null);

  // Curation Scope Modes
  const [curateGenre, setCurateGenre] = useState(true);
  const [verifyBpmKey, setVerifyBpmKey] = useState(false);
  const [verifyYear, setVerifyYear] = useState(false);

  // Options Section
  const [useSearch, setUseSearch] = useState(false);
  const [batchSize, setBatchSize] = useState(15);
  const [selectedModel, setSelectedModel] = useState("gemini-3.8-flash");
  const [showRekordboxHelp, setShowRekordboxHelp] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cancelCurationRef = useRef(false);

  // Validate backend API health on render
  useEffect(() => {
    fetch("/api/health")
      .then(res => res.json())
      .then(data => {
        if (data.status === "ok") {
          setApiOnline(true);
        } else {
          setApiOnline(false);
        }
      })
      .catch(() => {
        setApiOnline(false);
      });
  }, []);

  // Handle uploaded DJ libraries (typically UTF-16LE TSVs exported from Pioneer Rekordbox or Serato)
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setSystemError(null);
    setIsSampleLoaded(false);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const buffer = event.target?.result as ArrayBuffer;
        const result = parseTrackFile(buffer, file.name);
        
        setTracks(result.tracks);
        setOriginalHeaders(result.headers);
        setDelimiter(result.delimiter);
        setEncoding(result.encoding);
      } catch (err) {
        console.error(err);
        setSystemError(err instanceof Error ? err.message : "Error parsing file format.");
      }
    };
    reader.readAsArrayBuffer(file);
  };

  // Immediate loading of the user sample track dump
  const handleLoadSample = () => {
    try {
      const sampleList = getSampleTracks();
      setTracks(sampleList);
      setOriginalHeaders([
        "Artwork", "Track Title", "Artist", "Album", "Genre", 
        "Rating", "Time", "BPM", "Key", "Label", "Color", 
        "Comments", "My Tag", "Mix Name", "Date Added", "Date Created", "Location"
      ]);
      setDelimiter("\t");
      setEncoding("utf-16le");
      setFileName("sample_rekordbox_export.txt");
      setIsSampleLoaded(true);
      setSystemError(null);
    } catch (err) {
      setSystemError("Failed to mock sample data.");
    }
  };

  // Set track checkboxes
  const handleSelectTrack = (id: string, isSelected: boolean) => {
    setTracks(prev => prev.map(t => t.id === id ? { ...t, isSelected } : t));
  };

  const handleSelectAllTracks = (isSelected: boolean) => {
    setTracks(prev => prev.map(t => ({ ...t, isSelected })));
  };

  // Allows inline or detail modal overrides with tag normalization
  const handleManualOverride = (trackId: string, newGenre: string) => {
    const normalized = normalizeGenreTags(newGenre);
    setTracks(prev => prev.map(t => {
      if (t.id === trackId) {
        return {
          ...t,
          curatedGenre: normalized,
          isModified: true,
          curationStatus: CurationStatus.SUCCESS
        };
      }
      return t;
    }));

    // Keep active detail modal updated
    if (selectedTrack && selectedTrack.id === trackId) {
      setSelectedTrack(prev => prev ? { ...prev, curatedGenre: normalized, isModified: true, curationStatus: CurationStatus.SUCCESS } : null);
    }
  };

  // Routine comparing original values with AI suggestions strictly adhering to the digital audio standard:
  // All genre occurrences separated by '; ' with uniform Title Case capitalization and single spacing.
  const resolveCurationGenre = (original: string, recommended: string, isCorrect: boolean): string => {
    const normRec = normalizeGenreTags(recommended);
    if (!original) return normRec;

    const normOrig = normalizeGenreTags(original);
    if (isCorrect) return normOrig; // Retain standardized correct original

    // Merge original tags and recommended additions into deduplicated, '; ' delimited string
    return mergeGenreTags(original, recommended);
  };

  // Standardize existing imported and curated genre tags to use semicolon (;) and uniform Title Case
  const handleStandardizeAllDelimiters = () => {
    setTracks(prev => prev.map(t => {
      const curGen = t.curatedGenre ? normalizeGenreTags(t.curatedGenre) : t.curatedGenre;
      const origGen = t.genre ? normalizeGenreTags(t.genre) : t.genre;
      const hasChanged = (curGen !== t.curatedGenre) || (origGen !== t.genre);
      return {
        ...t,
        genre: origGen,
        curatedGenre: curGen,
        isModified: hasChanged ? true : t.isModified
      };
    }));
    setProgressText("Standardized all track genre tags to use ';' delimiter and uniform Title Case.");
  };

  // Core curation scheduler running batches via the Express server
  const runSmartCuration = async (tracksToCurate: Track[]) => {
    if (tracksToCurate.length === 0) return;

    if (!curateGenre && !verifyBpmKey && !verifyYear) {
      setSystemError("Please enable at least one curation mode (Genre, BPM/Key, or Release Year) in the Curation Scope.");
      return;
    }
    
    setIsProcessing(true);
    setProgress(0);
    setSystemError(null);
    cancelCurationRef.current = false;

    // Initial transition state updates
    const curateIds = new Set(tracksToCurate.map(t => t.id));
    setTracks(prev => prev.map(t => curateIds.has(t.id) ? { ...t, curationStatus: CurationStatus.PENDING } : t));

    const totalCount = tracksToCurate.length;
    let completedCount = 0;

    let i = 0;
    let consecutiveRateLimits = 0;

    while (i < totalCount) {
      if (cancelCurationRef.current) {
        setProgressText("Curation stopped by user.");
        setTracks(prev => prev.map(t => {
          if (t.curationStatus === CurationStatus.PENDING || t.curationStatus === CurationStatus.ANALYZING) {
            return { ...t, curationStatus: t.curatedGenre ? CurationStatus.SUCCESS : CurationStatus.IDLE };
          }
          return t;
        }));
        break;
      }

      const batch = tracksToCurate.slice(i, i + batchSize);
      const batchIds = new Set(batch.map(t => t.id));

      setProgressText(`Processing batch ${Math.floor(i / batchSize) + 1} of ${Math.ceil(totalCount / batchSize)}...`);
      setTracks(prev => prev.map(t => batchIds.has(t.id) ? { ...t, curationStatus: CurationStatus.ANALYZING } : t));

      try {
        const response = await fetch("/api/analyze-tracks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            tracks: batch, 
            curateGenre, 
            verifyBpmKey, 
            verifyYear, 
            useSearch, 
            model: selectedModel 
          })
        });

        if (response.status === 429 || response.status === 503) {
          consecutiveRateLimits++;
          if (consecutiveRateLimits > 6) {
            throw new Error("Gemini API limit or high traffic threshold reached recursively. Batch aborted, try again in a few minutes.");
          }
          
          let cooldownMs = response.status === 503 ? 10000 : 15000;
          try {
            const errData = await response.json();
            if (errData && typeof errData.retryDelayMs === "number") {
              cooldownMs = errData.retryDelayMs;
            }
          } catch (e) {
            console.warn("Could not parse cooldown error details, using dynamic fallback:", e);
          }

          const cooldownSec = Math.ceil(cooldownMs / 1000) + (consecutiveRateLimits * 3);
          let remaining = cooldownSec;
          const label = response.status === 503 ? "Model High Demand" : "Rate limit";
          while (remaining > 0) {
            if (cancelCurationRef.current) {
              break;
            }
            setProgressText(`⚠️ ${label} reached. Server cooldown: Retrying in ${remaining}s...`);
            await new Promise(resolve => setTimeout(resolve, 1000));
            remaining--;
          }
          continue; // retry raw same batch
        }

        if (!response.ok) {
          throw new Error(`Server returned error status: ${response.status}`);
        }

        // Reset rate limiter count on success
        consecutiveRateLimits = 0;

        const data = await response.json();
        const resultsMap: Record<string, any> = {};
        
        if (Array.isArray(data.results)) {
          data.results.forEach((res: any) => {
            resultsMap[res.trackId] = res;
          });
        }

        setTracks(prev => prev.map(t => {
          if (batchIds.has(t.id)) {
            const aiRes = resultsMap[t.id];
            if (aiRes) {
              const resGenre = curateGenre 
                ? resolveCurationGenre(t.genre, aiRes.recommendedGenre, aiRes.isCorrect) 
                : (t.curatedGenre || "");
              const resBpm = verifyBpmKey ? (aiRes.recommendedBpm || t.curatedBpm || t.bpm) : (t.curatedBpm || t.bpm);
              const resKey = verifyBpmKey ? (aiRes.recommendedKey || t.curatedKey || t.key) : (t.curatedKey || t.key);
              const resYear = verifyYear ? (aiRes.recommendedYear || t.curatedYear || t.year || "") : (t.curatedYear || t.year || "");
              return {
                ...t,
                curatedGenre: resGenre,
                curatedBpm: resBpm,
                curatedKey: resKey,
                curatedYear: resYear,
                curationStatus: CurationStatus.SUCCESS,
                curationNotes: aiRes.explanation || "Curation complete.",
                verificationSource: Array.isArray(aiRes.sources) ? aiRes.sources.join(", ") : (aiRes.sources || ""),
                isModified: false
              };
            } else {
              return {
                ...t,
                curationStatus: CurationStatus.FAILED,
                curationNotes: "Curation response is missing for this song record."
              };
            }
          }
          return t;
        }));

        i += batchSize;
        completedCount += batch.length;
        setProgress(Math.round((completedCount / totalCount) * 100));

        // Add a gentle, smart inter-batch spacing delay to protect the API quota
        if (i < totalCount && !cancelCurationRef.current) {
          const delayTime = useSearch ? 2500 : 800;
          setProgressText(`Batch completed. Pausing for ${delayTime}ms to prevent API rate limits...`);
          await new Promise(resolve => setTimeout(resolve, delayTime));
        }

      } catch (err: any) {
        console.error("Batch error:", err);
        setTracks(prev => prev.map(t => batchIds.has(t.id) ? { ...t, curationStatus: CurationStatus.FAILED, curationNotes: err?.message || "Analysis failure during call." } : t));
        i += batchSize;
        completedCount += batch.length;
        setProgress(Math.round((completedCount / totalCount) * 100));
      }
    }

    setIsProcessing(false);
    setProgress(100);
    if (cancelCurationRef.current) {
      setProgressText("Curation sequence stopped by user.");
    } else {
      setProgressText(`Successfully completed curation analysis across ${tracksToCurate.length} tracks.`);
    }
  };

  const handleStopCuration = () => {
    cancelCurationRef.current = true;
    setProgressText("Stopping active curation process...");
  };

  const handleCurateSelected = () => {
    const selected = tracks.filter(t => t.isSelected);
    if (selected.length === 0) {
      setSystemError("Please select at least one track in the table list to run curation.");
      return;
    }
    runSmartCuration(selected);
  };

  // Dynamic count of tracks needing curation based on active Curation Scope options
  const missingTracksForActiveScope = tracks.filter(t => {
    let isMissing = false;
    if (curateGenre && !t.genre?.trim()) isMissing = true;
    if (verifyBpmKey && (!t.bpm?.trim() || !t.key?.trim())) isMissing = true;
    if (verifyYear && !t.year?.trim()) isMissing = true;
    // Fallback if none toggled
    if (!curateGenre && !verifyBpmKey && !verifyYear) isMissing = !t.genre?.trim();
    return isMissing;
  });
  const missingForActiveScopeCount = missingTracksForActiveScope.length;

  const activeScopeLabels = [
    curateGenre ? "Genre" : null,
    verifyBpmKey ? "BPM/Key" : null,
    verifyYear ? "Year" : null
  ].filter(Boolean);
  const scopeDescription = activeScopeLabels.length > 0 ? activeScopeLabels.join(" & ") : "Genre";

  const handleCurateAllMissing = () => {
    if (missingTracksForActiveScope.length === 0) {
      setSystemError(`No tracks found with missing ${scopeDescription} for the selected Curation Scope options.`);
      return;
    }
    runSmartCuration(missingTracksForActiveScope);
  };

  const handleSingleAction = (track: Track) => {
    runSmartCuration([track]);
  };

  const handleExport = () => {
    if (tracks.length === 0) return;
    try {
      const buffer = exportTracks(tracks, originalHeaders, delimiter, encoding);
      const mime = encoding === "utf-16le" ? "text/plain;charset=utf-16le" : "text/csv;charset=utf-8";
      const blob = new Blob([buffer], { type: mime });
      
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = fileName ? `curated_${fileName}` : "curated_tracks.txt";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      setSystemError("Failed to package curated results for export.");
    }
  };

  const handleExportSelected = () => {
    const selected = tracks.filter(t => t.isSelected);
    if (selected.length === 0) {
      setSystemError("Please select at least one track to export.");
      return;
    }
    try {
      const buffer = exportTracks(selected, originalHeaders, delimiter, encoding);
      const mime = encoding === "utf-16le" ? "text/plain;charset=utf-16le" : "text/csv;charset=utf-8";
      const blob = new Blob([buffer], { type: mime });
      
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = fileName ? `curated_selected_${fileName}` : "curated_selected_tracks.txt";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      setSystemError("Failed to package curated selected results for export.");
    }
  };

  // Metrics computing
  const totalCount = tracks.length;
  const missingCount = tracks.filter(t => !t.genre?.trim()).length;
  const missingYearCount = tracks.filter(t => !t.year?.trim()).length;
  const missingBpmKeyCount = tracks.filter(t => !t.bpm?.trim() || !t.key?.trim()).length;
  const verifiedCount = tracks.filter(t => t.curationStatus === CurationStatus.SUCCESS).length;
  const needVerifyCount = tracks.filter(t => !!t.genre?.trim()).length;
  const selectedCount = tracks.filter(t => t.isSelected).length;

  return (
    <div id="app-wrapper" className="min-h-screen bg-[#f4f5f7] text-[#1a1c1e] flex flex-col font-sans overflow-hidden">
      
      {/* Top Header Navigation - High Density */}
      <header id="app-header" className="h-14 bg-white border-b border-[#d1d5db] flex items-center justify-between px-6 shrink-0 z-40">
        <div id="logo-block" className="flex items-center gap-3">
          <div className="w-8 h-8 bg-[#1a1c1e] rounded flex items-center justify-center">
            <div className="w-4 h-4 border-2 border-white rotate-45"></div>
          </div>
          <div>
            <h1 className="text-sm font-bold tracking-tight text-[#1a1c1e] uppercase">
              METADATA PRO<span className="font-normal opacity-50">.STUDIO</span>
            </h1>
          </div>
        </div>

        {/* Global Secrets & API Status indicator */}
        <div id="header-status-indicator" className="flex items-center gap-3">
          {apiOnline === true ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping"></span>
              GEMINI ANALYZER READY
            </span>
          ) : apiOnline === false ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-rose-50 text-rose-700 border border-rose-200 text-xs font-bold">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-600"></span>
              API OFFLINE - CHECK SECRETS
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-100 text-slate-500 border border-slate-200 text-xs font-semibold">
              INITIALIZING ENGINE...
            </span>
          )}

          {fileName && (
            <span className="text-xs bg-slate-100 border border-slate-200 px-2.5 py-1 rounded font-mono text-slate-600 font-bold truncate max-w-[200px]" title={fileName}>
              📄 {fileName}
            </span>
          )}
        </div>
      </header>

      {/* Sub-Header: Stats & Batch Actions - Ultra Dense */}
      <div id="sub-header-panel" className="bg-white border-b border-[#d1d5db] py-3.5 px-6 flex flex-wrap items-center justify-between gap-4 shrink-0 shadow-sm">
        <div id="active-stats" className="flex items-center gap-5 text-[11px] font-bold uppercase tracking-wider text-[#6b7280]">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-slate-500"></span>
            Total Tracks: <span className="text-[#1a1c1e]">{totalCount || 0}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-rose-500"></span>
            Missing Genre (Col F): <span className="text-[#1a1c1e]">{missingCount || 0}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-purple-500"></span>
            Missing Year: <span className="text-[#1a1c1e]">{missingYearCount || 0}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-500"></span>
            Missing BPM / Key: <span className="text-[#1a1c1e]">{missingBpmKeyCount || 0}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-blue-500"></span>
            Original Verification: <span className="text-[#1a1c1e]">{needVerifyCount || 0}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            Curated / Resolved: <span className="text-[#1a1c1e]">{verifiedCount || 0}</span>
          </div>
        </div>
        
        <div className="flex items-center gap-2 text-xs">
          <span className="text-[11px] text-[#9ca3af] font-semibold italic">Reference Data Sources: Discogs API, Beatport Portal, Traxsource metadata catalog</span>
        </div>
      </div>

      {/* Main Screen Layout Splitter - Side Rails */}
      <main id="app-main" className="flex-1 flex overflow-hidden">
        
        {/* Left Hand Rail - File & Columns Inspector */}
        <aside id="left-sidebar" className="w-80 lg:w-84 xl:w-96 border-r border-[#d1d5db] bg-white p-4 shrink-0 flex flex-col justify-between overflow-y-auto overflow-x-hidden">
          <div className="space-y-5">
            <div>
              <h3 className="text-[10px] font-bold text-[#9ca3af] uppercase tracking-widest mb-2.5">System Actions</h3>
              <div className="space-y-2">
                <input 
                  type="file"
                  ref={fileInputRef}
                  accept=".txt,.tsv,.csv"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                
                <button
                  id="sidebar-import-rekordbox-btn"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full flex items-center justify-between text-xs py-2 px-3 bg-[#f4f5f7] hover:bg-[#ebecef] text-[#1a1c1e] font-semibold rounded border border-[#d1d5db] transition-colors cursor-pointer text-left"
                >
                  <span className="truncate">Import Rekordbox File</span>
                  <Upload className="w-3.5 h-3.5 opacity-60 ml-2 shrink-0" />
                </button>

                <button
                  onClick={handleLoadSample}
                  className="w-full flex items-center justify-between text-xs py-2 px-3 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold rounded border border-blue-200 transition-colors text-left"
                >
                  <span>Load Sample Library</span>
                  <Database className="w-3.5 h-3.5 ml-2" />
                </button>
              </div>
            </div>



            {/* Curation Scope Settings */}
            {tracks.length > 0 && (
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-200 pb-1.5 select-none">
                  <h3 className="text-[10px] font-bold text-[#4b5563] uppercase tracking-wider flex items-center gap-1.5 font-sans">
                    <Sliders className="w-3.5 h-3.5 text-blue-600" />
                    Curation Scope
                  </h3>
                  <span className="text-[9px] font-mono text-slate-500 font-bold bg-white px-1.5 py-0.5 rounded border border-slate-200">
                    {[curateGenre && "Genre", verifyBpmKey && "BPM/Key", verifyYear && "Year"].filter(Boolean).join(" + ") || "None"}
                  </span>
                </div>
                
                <div className="space-y-2.5">
                  <label className="flex items-start gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={curateGenre}
                      onChange={(e) => setCurateGenre(e.target.checked)}
                      className="rounded border-[#d1d5db] text-blue-600 focus:ring-blue-500 h-3.5 w-3.5 mt-0.5 cursor-pointer"
                    />
                    <div className="flex flex-col">
                      <span className="text-[11px] font-bold text-slate-700">Genre Analysis</span>
                      <span className="text-[9px] text-slate-500 leading-tight mt-0.5">
                        Detects missing genres, resolves vague tags, and classifies precise sub-genres.
                      </span>
                    </div>
                  </label>

                  <label className="flex items-start gap-2 cursor-pointer select-none border-t border-slate-200/60 pt-2">
                    <input
                      type="checkbox"
                      checked={verifyBpmKey}
                      onChange={(e) => setVerifyBpmKey(e.target.checked)}
                      className="rounded border-[#d1d5db] text-blue-600 focus:ring-blue-500 h-3.5 w-3.5 mt-0.5 cursor-pointer"
                    />
                    <div className="flex flex-col">
                      <span className="text-[11px] font-bold text-slate-700">Verify BPM & Key</span>
                      <span className="text-[9px] text-slate-500 leading-tight mt-0.5">
                        Cross-references online databases to correct inaccurate track tempo and harmonic key signatures.
                      </span>
                    </div>
                  </label>

                  <label className="flex items-start gap-2 cursor-pointer select-none border-t border-slate-200/60 pt-2">
                    <input
                      type="checkbox"
                      checked={verifyYear}
                      onChange={(e) => setVerifyYear(e.target.checked)}
                      className="rounded border-[#d1d5db] text-blue-600 focus:ring-blue-500 h-3.5 w-3.5 mt-0.5 cursor-pointer"
                    />
                    <div className="flex flex-col">
                      <span className="text-[11px] font-bold text-slate-700">Release Year</span>
                      <span className="text-[9px] text-slate-500 leading-tight mt-0.5">
                        Identifies original commercial release year (mapped to Windows audio Year metadata tag).
                      </span>
                    </div>
                  </label>
                </div>
              </div>
            )}

            {/* Options Section */}
            {tracks.length > 0 && (
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-3">
                <h3 className="text-[10px] font-bold text-[#4b5563] uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-200 pb-1.5 select-none font-sans">
                  <Settings className="w-3.5 h-3.5 text-slate-600" />
                  Options
                </h3>

                <div className="space-y-3">
                  <label className="flex items-start gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={useSearch}
                      onChange={(e) => setUseSearch(e.target.checked)}
                      className="rounded border-[#d1d5db] text-blue-600 focus:ring-blue-500 h-3.5 w-3.5 mt-0.5 cursor-pointer"
                    />
                    <div className="flex flex-col">
                      <span className="text-[11px] font-bold text-slate-700">Deep Search Grounding (Slow)</span>
                      <span className="text-[9px] text-slate-500 leading-tight mt-0.5">
                        Enables live Google Search for cutting-edge accuracy. Turn off to avoid rate limits on big batches.
                      </span>
                    </div>
                  </label>

                  <div className="border-t border-slate-200/50 pt-2.5 space-y-1.5">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[11px] font-bold text-slate-700 select-none">Batch Size per Request</label>
                      <select
                        value={batchSize}
                        onChange={(e) => setBatchSize(parseInt(e.target.value))}
                        className="w-full bg-white hover:bg-slate-50 border border-slate-300 hover:border-slate-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded px-2.5 py-1.5 text-xs font-bold font-mono text-slate-700 shadow-sm transition-colors cursor-pointer outline-none"
                      >
                        <option value={5}>5 tracks</option>
                        <option value={10}>10 tracks</option>
                        <option value={15}>15 tracks (Recommended)</option>
                        <option value={20}>20 tracks</option>
                        <option value={30}>30 tracks</option>
                      </select>
                    </div>
                    <p className="text-[9px] text-slate-500 leading-tight">
                      Larger batches process more tracks per query, heavily conserving your daily API limits.
                    </p>
                  </div>

                  <div id="ai-engine-model-section" className="border-t border-slate-200/60 pt-2.5 space-y-2">
                    <div className="flex flex-col gap-1.5">
                      <div className="flex items-center justify-between">
                        <label htmlFor="ai-engine-model-select" className="text-[11px] font-bold text-slate-700 select-none">
                          AI Engine Model
                        </label>
                        <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200/60 font-semibold">
                          {selectedModel === "gemini-3.8-flash" ? "Default" : selectedModel === "gemini-3.1-pro-preview" ? "Pro" : "Flash"}
                        </span>
                      </div>
                      <select
                        id="ai-engine-model-select"
                        value={selectedModel}
                        onChange={(e) => setSelectedModel(e.target.value)}
                        className="w-full bg-white hover:bg-slate-50 border border-slate-300 hover:border-slate-400 focus:border-blue-600 focus:ring-1 focus:ring-blue-600 rounded-md px-2.5 py-1.5 text-xs font-semibold font-mono text-slate-800 shadow-sm transition-colors cursor-pointer outline-none"
                      >
                        <option value="gemini-3.8-flash">Gemini 3.8 Flash (Latest Flagship - Recommended)</option>
                        <option value="gemini-flash-latest">Gemini Flash Latest (Stable Auto-Updating)</option>
                        <option value="gemini-3.7-flash">Gemini 3.7 Flash (High Performance)</option>
                        <option value="gemini-3.1-flash-lite">Gemini 3.1 Flash Lite (Ultra-fast &amp; High Quota)</option>
                        <option value="gemini-3.1-pro-preview">Gemini 3.1 Pro (Deep Complex Reasoning)</option>
                      </select>
                    </div>

                    <div className="bg-slate-50 rounded p-2 border border-slate-200/80 text-[10px] text-slate-600 space-y-1">
                      <div className="font-semibold text-slate-700 flex items-center justify-between">
                        <span>
                          {selectedModel === "gemini-3.8-flash" && "⚡ Gemini 3.8 Flash"}
                          {selectedModel === "gemini-flash-latest" && "🔄 Gemini Flash Latest"}
                          {selectedModel === "gemini-3.7-flash" && "🚀 Gemini 3.7 Flash"}
                          {selectedModel === "gemini-3.1-flash-lite" && "⚡ Gemini 3.1 Flash Lite"}
                          {selectedModel === "gemini-3.1-pro-preview" && "🧠 Gemini 3.1 Pro"}
                        </span>
                      </div>
                      <p className="leading-snug text-slate-500">
                        {selectedModel === "gemini-3.8-flash" && "Flagship speed & accuracy for music classification, release year, and genre analysis."}
                        {selectedModel === "gemini-flash-latest" && "Continuously pointing to Google's latest production-tested Flash release."}
                        {selectedModel === "gemini-3.7-flash" && "High performance alternative model for responsive bulk processing."}
                        {selectedModel === "gemini-3.1-flash-lite" && "Fastest latency and highest throughput per minute for very large playlists."}
                        {selectedModel === "gemini-3.1-pro-preview" && "Deep archival reasoning model for rare white-labels, underground subgenres, and vinyl catalog lookups."}
                      </p>
                    </div>

                    <p className="text-[9px] text-slate-400 leading-tight">
                      Switch engine if encountering temporary 503 high-demand or 429 quota exhaustion.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Campaign Options / Batch Tools */}
            {tracks.length > 0 && (
              <div>
                <h3 className="text-[10px] font-bold text-[#9ca3af] uppercase tracking-widest mb-3">Batch Tools</h3>
                <div className="space-y-1.5 flex flex-col">
                  <button
                    onClick={handleCurateAllMissing}
                    disabled={isProcessing || missingForActiveScopeCount === 0}
                    type="button"
                    className="w-full text-left text-[11px] py-2 px-2.5 rounded bg-rose-50 hover:bg-rose-100/80 hover:text-rose-800 text-rose-700 font-bold border border-rose-200 transition-colors flex items-center justify-between disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
                    title={`Run Gemini analysis on all tracks currently missing ${scopeDescription}`}
                  >
                    <span className="flex items-center gap-1.5 truncate">
                      <Sparkles className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">Curate Missing ({scopeDescription})</span>
                    </span>
                    <span className="font-mono bg-rose-100 text-rose-800 px-1.5 py-0.5 rounded text-[10px] font-bold shrink-0 ml-1">
                      {missingForActiveScopeCount}
                    </span>
                  </button>

                  <button
                    onClick={handleCurateSelected}
                    disabled={isProcessing || selectedCount === 0}
                    type="button"
                    className="w-full text-left text-[11px] py-1.5 px-2.5 rounded bg-blue-50 hover:bg-blue-100 hover:text-[#0b5cda] text-blue-700 font-bold border border-blue-200 transition-colors flex items-center justify-between disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
                    title="Curate only the tracks with active selection checkboxes in the table"
                  >
                    <span className="flex items-center gap-1.5 truncate">
                      <CheckCircle className="w-3.5 h-3.5" />
                      Curate Selected
                    </span>
                    <span className="font-mono bg-blue-100/80 text-blue-800 px-1 py-0.5 rounded text-[9px]">{selectedCount}</span>
                  </button>

                  <button
                    onClick={handleStandardizeAllDelimiters}
                    disabled={isProcessing || totalCount === 0}
                    type="button"
                    className="w-full text-left text-[11px] py-1.5 px-2.5 rounded bg-indigo-50/70 hover:bg-indigo-100 hover:text-indigo-800 text-indigo-700 font-bold border border-indigo-200/80 transition-colors flex items-center justify-between disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
                    title="Convert all existing slashes, commas, and irregular spacing to standard semicolon (;) tags with Title Case"
                  >
                    <span className="flex items-center gap-1.5 truncate">
                      <Sliders className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">Standardize Delimiters (;)</span>
                    </span>
                    <span className="font-mono bg-indigo-100 text-indigo-800 px-1.5 py-0.5 rounded text-[9px] font-bold">;</span>
                  </button>

                  <button
                    onClick={handleExportSelected}
                    disabled={isProcessing || selectedCount === 0}
                    type="button"
                    className="w-full text-left text-[11px] py-1.5 px-2.5 rounded bg-emerald-50 hover:bg-emerald-100 hover:text-emerald-800 text-emerald-700 font-bold border border-emerald-200 transition-colors flex items-center justify-between disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
                    title="Export only the selected tracks back into Rekordbox format"
                  >
                    <span className="flex items-center gap-1.5 truncate">
                      <Download className="w-3.5 h-3.5" />
                      Export Selected
                    </span>
                    <span className="font-mono bg-emerald-100/80 text-emerald-800 px-1 py-0.5 rounded text-[9px]">{selectedCount}</span>
                  </button>

                  <button
                    onClick={handleExport}
                    disabled={isProcessing || totalCount === 0}
                    type="button"
                    className="w-full text-left text-[11px] py-1.5 px-2.5 rounded bg-slate-50 hover:bg-slate-100 hover:text-slate-800 text-slate-700 font-bold border border-slate-200 transition-colors flex items-center justify-between disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
                    title="Export the entire tracks library back into Rekordbox format"
                  >
                    <span className="flex items-center gap-1.5 truncate">
                      <FileSpreadsheet className="w-3.5 h-3.5" />
                      Export Full File
                    </span>
                    <span className="font-mono bg-slate-200 text-slate-700 px-1 py-0.5 rounded text-[9px]">{totalCount}</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="pt-4 border-t border-[#ebecef] space-y-2">
            <h4 className="text-[9px] font-bold text-[#9ca3af] uppercase tracking-wider">Audio Metadata Standard</h4>
            <p className="text-[10px] text-slate-500 leading-normal">
              Multi-value genres are formatted with the digital audio standard: separated strictly by <code className="font-mono font-bold text-slate-700 bg-slate-100 px-1 py-0.5 rounded">; </code> with uniform Title Case capitalization.
            </p>
          </div>
        </aside>

        {/* Right side content and registry database table */}
        <section id="table-viewfield" className="flex-1 overflow-hidden flex flex-col bg-white">
          
          {/* Main Error state */}
          {systemError && (
            <div className="m-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-xs flex items-center justify-between font-medium">
              <span className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-500" />
                Error: {systemError}
              </span>
              <button onClick={() => setSystemError(null)} className="text-red-500 underline font-bold hover:text-red-900">Dismiss</button>
            </div>
          )}

          {/* Active processing state loader banner */}
          {isProcessing && (
            <div className={`mx-6 mt-4 p-3 rounded-lg flex items-center justify-between text-xs font-semibold border ${
              progressText.includes("⚠️") 
                ? "bg-amber-50 border-amber-200 text-amber-900" 
                : "bg-[#f0f7ff] border-blue-200 text-blue-800"
            }`}>
              <span className="flex items-center gap-2">
                <RefreshCw className={`w-3.5 h-3.5 ${progressText.includes("⚠️") ? "text-amber-600 animate-pulse" : "text-blue-600 animate-spin"}`} />
                {progressText}
              </span>
              <div className="flex items-center gap-2">
                <span className={`font-mono px-2 py-0.5 rounded text-[10px] font-bold ${
                  progressText.includes("⚠️") 
                    ? "bg-amber-100 text-amber-800" 
                    : "bg-blue-100 text-blue-700"
                }`}>{progress}% DONE</span>
                <button
                  type="button"
                  onClick={handleStopCuration}
                  className="bg-red-50 hover:bg-red-100 text-red-700 hover:text-red-900 border border-red-200 px-2 py-0.5 rounded text-[10px] font-bold transition-colors cursor-pointer"
                >
                  STOP
                </button>
              </div>
            </div>
          )}

          {/* Table Container block */}
          {tracks.length > 0 ? (
            <div className="flex-1 overflow-hidden flex flex-col p-6">
              <div className="mb-3.5 flex items-center justify-between">
                <div>
                  <h2 className="text-base font-bold text-[#1a1c1e] uppercase tracking-tight">Track Database Record Registry</h2>
                  <p className="text-xs text-[#6b7280] mt-0.5">Filter, search, or trigger batch curation details. Select the checkbox to batch edit.</p>
                </div>
                {fileName && (
                  <span className="text-xs font-mono bg-slate-100 border border-slate-200 text-[#4b5563] px-2.5 py-1 rounded">
                    FILE: {fileName}
                  </span>
                )}
              </div>
              <div className="flex-1 overflow-hidden flex flex-col">
                <TrackTable 
                  tracks={tracks}
                  onSelectTrack={handleSelectTrack}
                  onSelectAllTracks={handleSelectAllTracks}
                  onViewDetails={(t) => setSelectedTrack(t)}
                  onManualOverride={handleManualOverride}
                  onSingleAction={handleSingleAction}
                  isProcessing={isProcessing}
                />
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center p-8 bg-[#f4f5f7]/30">
              <div className="text-center max-w-md w-full p-8 bg-white border border-[#d1d5db] rounded-xl shadow-sm">
                <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Music className="w-6 h-6" />
                </div>
                <h3 className="font-bold text-[#1a1c1e] text-sm uppercase tracking-tight">NO DATASET LOADED</h3>
                <p className="text-xs text-[#6b7280] mt-1.5 mb-5 leading-relaxed">
                  Start by loading the sample library track dump or upload your export file from DJ software directly.
                </p>
                <div className="flex flex-col gap-2.5">
                  {/* Primary highlighted action */}
                  <div className="relative">
                    <button
                      id="home-import-rekordbox-btn"
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full bg-[#0052cc] hover:bg-[#0747a6] text-white py-2.5 px-4 rounded text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <Upload className="w-4 h-4" />
                      <span>Import Rekordbox File</span>
                    </button>
                  </div>

                  {/* Secondary action */}
                  <button
                    id="home-load-sample-btn"
                    onClick={handleLoadSample}
                    className="w-full bg-white hover:bg-slate-50 border border-[#d1d5db] text-[#1a1c1e] py-2 px-4 rounded text-xs font-semibold transition-colors flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Database className="w-3.5 h-3.5 text-slate-500" />
                    <span>Quick-Load Sample Tracks</span>
                  </button>
                </div>

                {/* Visible Rekordbox Export Guide Box */}
                <div className="mt-6 pt-4 border-t border-slate-100 text-left bg-slate-50 rounded-lg p-3.5 border border-slate-200">
                  <div className="flex items-center justify-between text-blue-900 font-bold text-xs mb-2">
                    <span className="flex items-center gap-1.5">
                      <Info className="w-3.5 h-3.5 text-[#0052cc]" />
                      How to export from Rekordbox:
                    </span>
                    <span className="text-[10px] text-blue-600 font-mono bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100">
                      *.txt export
                    </span>
                  </div>
                  <ol className="space-y-1.5 text-xs text-slate-600 pl-0.5 leading-relaxed">
                    <li className="flex items-start gap-2">
                      <span className="w-4 h-4 rounded-full bg-blue-100 text-blue-700 font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">1</span>
                      <span>Select any <strong>Playlist</strong> in Rekordbox</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="w-4 h-4 rounded-full bg-blue-100 text-blue-700 font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">2</span>
                      <span>Right-click &gt; choose <strong className="text-slate-800">"Export playlist to a file"</strong></span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="w-4 h-4 rounded-full bg-blue-100 text-blue-700 font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">3</span>
                      <span>Select <strong className="text-slate-800">"Export to a file format for other music player (*.txt)"</strong></span>
                    </li>
                  </ol>
                  <div className="mt-3 pt-2 border-t border-slate-200/60 flex items-center gap-1.5 text-[11px] text-slate-500">
                    <FileText className="w-3 h-3 text-slate-400 shrink-0" />
                    <span>Also compatible with standard <code>.csv</code> and <code>.tsv</code> spreadsheets.</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </section>
      </main>

      {/* High Density Status Footer */}
      <footer id="app-footer" className="h-8 bg-[#1a1c1e] text-white flex items-center justify-between px-6 text-[10px] uppercase tracking-widest shrink-0 font-medium">
        <div className="flex items-center gap-4">
          <span className="text-blue-400 font-bold uppercase tracking-wider">Curation Engine</span>
          <span className="opacity-30">|</span>
          <span>ENCODING: {encoding.toUpperCase()}</span>
          <span className="opacity-30">|</span>
          <span>DELIMITER: {delimiter === "\t" ? "TSV (TAB)" : "CSV"}</span>
          <span className="opacity-30">|</span>
          {fileName && <span>SOURCE: {fileName}</span>}
        </div>
        <div className="flex items-center gap-2 text-slate-300">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse"></span>
          Synced with Verified Music Catalog Sources
        </div>
      </footer>

      {/* Side Audit detail logs Modal popup */}
      {selectedTrack && (
        <TrackDetailModal 
          track={selectedTrack}
          onClose={() => setSelectedTrack(null)}
          onSaveGenre={handleManualOverride}
        />
      )}
    </div>
  );
}
