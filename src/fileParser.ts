import { Track, CurationStatus } from "./types.js";

/**
 * Parses an imported file (TSV/CSV/TXT), detects encoding and delimiters,
 * and extracts standard music library tracks.
 */
export function parseTrackFile(arrayBuffer: ArrayBuffer, fileName: string): {
  tracks: Track[];
  headers: string[];
  delimiter: string;
  encoding: string;
} {
  const bytes = new Uint8Array(arrayBuffer);
  let encoding = "utf-8";
  
  // Detect BOM
  if (bytes[0] === 0xff && bytes[1] === 0xfe) {
    encoding = "utf-16le";
  } else if (bytes[0] === 0xfe && bytes[1] === 0xff) {
    encoding = "utf-16be";
  } else if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    encoding = "utf-8"; // UTF-8 with BOM
  }

  const decoder = new TextDecoder(encoding);
  const rawText = decoder.decode(arrayBuffer);
  
  // Split into lines and filter empty ones
  const lines = rawText.split(/\r?\n/).map(line => line.trim()).filter(line => line.length > 0);
  if (lines.length === 0) {
    throw new Error("The file is empty.");
  }

  // Detect delimiter based on the header line
  const firstLine = lines[0];
  let delimiter = "\t";
  if (firstLine.includes("\t")) {
    delimiter = "\t";
  } else if (firstLine.includes(";")) {
    delimiter = ";";
  } else if (firstLine.includes(",")) {
    delimiter = ",";
  }

  // Advanced row parser handling optional quoted fields
  const parseRowFields = (text: string, delim: string): string[] => {
    const fields: string[] = [];
    let insideQuotes = false;
    let currentField = "";
    
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      if (char === '"') {
        insideQuotes = !insideQuotes;
      } else if (char === delim && !insideQuotes) {
        fields.push(currentField.trim());
        currentField = "";
      } else {
        currentField += char;
      }
    }
    fields.push(currentField.trim());
    return fields;
  };

  const rawHeaders = parseRowFields(lines[0], delimiter);
  
  // Clean headers (remove any leading # or BOM residues if any)
  const cleanHeaders = rawHeaders.map(h => h.replace(/^\ufeff/, "").replace(/^#\s*/, "").toLowerCase().trim());

  // Detect which headers are actually present to avoid row fallbacks
  const findHeaderIndex = (names: string[]): number => {
    for (const name of names) {
      const idx = cleanHeaders.findIndex(h => h === name.toLowerCase().trim());
      if (idx !== -1) return idx;
    }
    return -1;
  };

  const titleIdx = findHeaderIndex(["track title", "title", "name"]);
  const artistIdx = findHeaderIndex(["artist", "artistes", "creator"]);
  const albumIdx = findHeaderIndex(["album", "album title"]);
  const genreIdx = findHeaderIndex(["genre", "column f"]);
  const ratingIdx = findHeaderIndex(["rating"]);
  const timeIdx = findHeaderIndex(["time"]);
  const bpmIdx = findHeaderIndex(["bpm"]);
  const keyIdx = findHeaderIndex(["key"]);
  const labelIdx = findHeaderIndex(["label"]);
  const colorIdx = findHeaderIndex(["color"]);
  const commentsIdx = findHeaderIndex(["comments"]);
  const myTagIdx = findHeaderIndex(["my tag", "tag"]);
  const mixNameIdx = findHeaderIndex(["mix name", "mix"]);
  const dateAddedIdx = findHeaderIndex(["date added"]);
  const dateCreatedIdx = findHeaderIndex(["date created"]);
  const locationIdx = findHeaderIndex(["location", "file path"]);
  const artworkIdx = findHeaderIndex(["artwork"]);

  const hasMatchedHeaders = (titleIdx !== -1 || artistIdx !== -1 || albumIdx !== -1 || genreIdx !== -1);

  const tracks: Track[] = [];

  for (let i = 1; i < lines.length; i++) {
    const fields = parseRowFields(lines[i], delimiter);
    if (fields.length <= 1) continue; // Skip incomplete lines

    const getRowValue = (idx: number, fallbackIdx: number): string => {
      // If we matched headers in the file, use the matched index even if empty
      if (hasMatchedHeaders) {
        if (idx !== -1 && idx < fields.length) {
          return fields[idx];
        }
        return "";
      }
      // If no headers matched at all, use absolute fallback index
      if (fallbackIdx !== -1 && fallbackIdx < fields.length) {
        return fields[fallbackIdx];
      }
      return "";
    };

    const titleVal = getRowValue(titleIdx, 1);
    const artistVal = getRowValue(artistIdx, 2);
    const albumVal = getRowValue(albumIdx, 3);
    const genreVal = getRowValue(genreIdx, 4);
    const artworkVal = getRowValue(artworkIdx, 0);
    const ratingVal = getRowValue(ratingIdx, 5);
    const timeVal = getRowValue(timeIdx, 6);
    const bpmVal = getRowValue(bpmIdx, 7);
    const keyVal = getRowValue(keyIdx, 8);
    const labelVal = getRowValue(labelIdx, 9);
    const colorVal = getRowValue(colorIdx, 10);
    const commentsVal = getRowValue(commentsIdx, 11);
    const myTagVal = getRowValue(myTagIdx, 12);
    const mixNameVal = getRowValue(mixNameIdx, 13);
    const dateAddedVal = getRowValue(dateAddedIdx, 14);
    const dateCreatedVal = getRowValue(dateCreatedIdx, 15);
    const locationVal = getRowValue(locationIdx, 16);

    // Construct the fully mapped Track
    tracks.push({
      id: String(i),
      originalRowIndex: i,
      artwork: artworkVal,
      title: titleVal,
      artist: artistVal,
      album: albumVal,
      genre: genreVal,
      rating: ratingVal,
      time: timeVal,
      bpm: bpmVal,
      key: keyVal,
      label: labelVal,
      color: colorVal,
      comments: commentsVal,
      myTag: myTagVal,
      mixName: mixNameVal,
      dateAdded: dateAddedVal,
      dateCreated: dateCreatedVal,
      location: locationVal,
      
      curatedGenre: "",
      curatedBpm: "",
      curatedKey: "",
      curationStatus: CurationStatus.IDLE,
      curationNotes: "",
      verificationSource: "",
      isModified: false,
      isSelected: false
    });
  }

  return {
    tracks,
    headers: rawHeaders,
    delimiter,
    encoding
  };
}

/**
 * Re-serializes a lists of tracks back to their original file format
 */
export function exportTracks(
  tracks: Track[], 
  originalHeaders: string[], 
  delimiter: string, 
  encoding: string
): ArrayBuffer {
  // Reconstruct headers exactly as they were imported (e.g. keeping BOM / # intact)
  const headerLine = originalHeaders.join(delimiter);
  
  // Re-serialize rows
  const rows = tracks.map(track => {
    // Generate exactly mapped details matching headers
    return originalHeaders.map(header => {
      const cleanHeader = header.replace(/^\ufeff/, "").replace(/^#\s*/, "").toLowerCase().trim();
      switch (cleanHeader) {
        case "artwork": return track.artwork;
        case "track title":
        case "title":
        case "name": return track.title;
        case "artist":
        case "artistes":
        case "creator": return track.artist;
        case "album":
        case "album title": return track.album;
        case "genre":
        case "column f": return track.curatedGenre || track.genre; // Save curated genre, fallback to original if unanalyzed
        case "rating": return track.rating;
        case "time": return track.time;
        case "bpm": return track.curatedBpm || track.bpm;
        case "key": return track.curatedKey || track.key;
        case "label": return track.label;
        case "color": return track.color;
        case "comments": return track.comments;
        case "my tag":
        case "tag": return track.myTag;
        case "mix name":
        case "mix": return track.mixName;
        case "date added": return track.dateAdded;
        case "date created": return track.dateCreated;
        case "location":
        case "file path": return track.location;
        default: {
          // If we had row numbering like # style
          if (header.startsWith("#") || header === "") {
            return String(track.originalRowIndex);
          }
          return "";
        }
      }
    }).join(delimiter);
  });

  const fullText = [headerLine, ...rows].join("\r\n");
  
  // If original file was UTF-16LE, convert our string
  if (encoding === "utf-16le") {
    const buffer = new ArrayBuffer(fullText.length * 2 + 2);
    const view = new DataView(buffer);
    
    // Write BOM for UTF-16 LE
    view.setUint8(0, 0xff);
    view.setUint8(1, 0xfe);
    
    for (let i = 0; i < fullText.length; i++) {
      view.setUint16(i * 2 + 2, fullText.charCodeAt(i), true); // true for little endian
    }
    return buffer;
  } else {
    // UTF-8
    const encoder = new TextEncoder();
    return encoder.encode(fullText).buffer;
  }
}
