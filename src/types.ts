export enum CurationStatus {
  IDLE = "idle",
  PENDING = "pending",
  ANALYZING = "analyzing",
  SUCCESS = "success",
  FAILED = "failed"
}

export interface Track {
  id: string; // Typically the row number in the file
  originalRowIndex: number;
  artwork: string;
  title: string;
  artist: string;
  album: string;
  genre: string; // Column F
  rating: string;
  time: string;
  bpm: string;
  key: string;
  label: string;
  color: string;
  comments: string;
  myTag: string;
  mixName: string;
  dateAdded: string;
  dateCreated: string;
  location: string;
  
  // App-specific curation properties
  curatedGenre: string; // Updated genre or original + updated
  curatedBpm?: string; // Verified/Curated tempo
  curatedKey?: string; // Verified/Curated harmonic key signature
  curationStatus: CurationStatus;
  curationNotes: string;
  verificationSource: string;
  isModified: boolean; // True if manually edited or curated
  isSelected: boolean;
}

export interface CurationResult {
  id: string;
  originalGenre?: string;
  recommendedGenre: string;
  isCorrect: boolean;
  needsAppend: boolean;
  appendedGenre: string;
  explanation: string;
  sources: string[];
}

export interface ParseResult {
  tracks: Track[];
  headers: string[];
  delimiter: string;
  encoding: string;
}
