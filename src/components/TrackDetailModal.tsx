import React, { useState, useEffect } from "react";
import { Track, CurationStatus } from "../types.js";
import { 
  X, 
  Music, 
  Globe, 
  HelpCircle, 
  FileText, 
  Compass, 
  Check, 
  MapPin,
  Clock,
  ChevronRight
} from "lucide-react";

interface TrackDetailModalProps {
  track: Track | null;
  onClose: () => void;
  onSaveGenre: (trackId: string, newGenre: string) => void;
}

export default function TrackDetailModal({
  track,
  onClose,
  onSaveGenre
}: TrackDetailModalProps) {
  const [curatedValue, setCuratedValue] = useState("");
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    if (track) {
      setCuratedValue(track.curatedGenre || track.genre || "");
      setIsEditing(false);
    }
  }, [track]);

  if (!track) return null;

  const handleSave = () => {
    onSaveGenre(track.id, curatedValue);
    setIsEditing(false);
  };

  const hasCuration = track.curationStatus === CurationStatus.SUCCESS;

  return (
    <div id="detail-modal-overlay" className="fixed inset-0 bg-[#1a1c1e]/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
      <div 
        id="detail-modal-body" 
        className="bg-white border border-[#d1d5db] rounded-lg w-full max-w-xl overflow-hidden shadow-xl flex flex-col max-h-[85vh] animate-fadeIn"
      >
        {/* Header */}
        <div className="p-4 border-b border-[#d1d5db] flex items-center justify-between bg-slate-50/60 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600">
              <Music className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-[#1a1c1e] text-sm uppercase tracking-tight">Audit Database Record</h3>
              <p className="text-[10px] text-slate-550 font-mono">Row Index: {track.originalRowIndex}</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1 rounded text-slate-400 hover:text-[#1a1c1e] hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-4 overflow-y-auto space-y-4 flex-1">
          
          {/* Metadata Grid */}
          <div className="grid grid-cols-2 gap-3.5">
            <div className="p-2.5 bg-[#f8fafc] border border-[#e5e7eb] rounded">
              <span className="text-[9px] font-bold text-[#9ca3af] uppercase tracking-wider block mb-0.5">Track Title (Column B)</span>
              <p className="text-xs font-semibold text-[#1a1c1e] truncate" title={track.title}>{track.title || "n/a"}</p>
            </div>
            <div className="p-2.5 bg-[#f8fafc] border border-[#e5e7eb] rounded">
              <span className="text-[9px] font-bold text-[#9ca3af] uppercase tracking-wider block mb-0.5">Artist (Column C)</span>
              <p className="text-xs font-semibold text-[#1a1c1e] truncate" title={track.artist}>{track.artist || "n/a"}</p>
            </div>
            <div className="p-2.5 bg-[#f8fafc] border border-[#e5e7eb] rounded">
              <span className="text-[9px] font-bold text-[#9ca3af] uppercase tracking-wider block mb-0.5">Album (Column D)</span>
              <p className="text-xs text-[#4b5563] truncate" title={track.album}>{track.album || "(Empty)"}</p>
            </div>
            <div className="p-2.5 bg-[#f8fafc] border border-[#e5e7eb] rounded">
              <span className="text-[9px] font-bold text-[#9ca3af] uppercase tracking-wider block mb-0.5">Record Label (Column J)</span>
              <p className="text-xs text-[#4b5563] truncate" title={track.label}>{track.label || "(Empty)"}</p>
            </div>
          </div>

          {/* Curation & Genre Analysis Panel */}
          <div className="border border-[#d1d5db] rounded overflow-hidden">
            <div className="px-3.5 py-2.5 border-b border-[#d1d5db] bg-slate-50 flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Compass className="w-3.5 h-3.5 text-blue-600" />
                <h4 className="text-[11px] font-bold text-[#1a1c1e] uppercase tracking-wider">Curation Alignment</h4>
              </div>
              <span className="text-[9px] font-mono bg-blue-50 border border-blue-150 px-1.5 py-0.5 rounded text-blue-700 font-bold">
                COLUMN F
              </span>
            </div>

            <div className="p-3.5 space-y-3.5">
              <div className="flex items-stretch gap-3 bg-[#f8fafc] p-2.5 rounded border border-[#e5e7eb]">
                <div className="flex-1 min-w-0">
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Imported Genre</span>
                  {track.genre ? (
                    <span className="inline-block bg-[#f4f5f7] border border-[#d1d5db] text-[#4b5563] px-2 py-1 rounded text-xs font-semibold break-words leading-snug">
                      {track.genre}
                    </span>
                  ) : (
                    <span className="text-xs text-rose-600 font-mono italic">[EMPTY]</span>
                  )}
                </div>
                <div className="flex items-center justify-center text-slate-350 px-1 shrink-0">
                  <ChevronRight className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0 pl-3 border-l border-[#e5e7eb]">
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Curated / Verified Genre</span>
                  {isEditing ? (
                    <div className="flex items-center gap-1 mt-0.5">
                      <input 
                        type="text"
                        className="bg-white border border-[#0052cc] text-xs text-[#1a1c1e] rounded px-1.5 py-0.5 focus:outline-none w-full"
                        value={curatedValue}
                        onChange={(e) => setCuratedValue(e.target.value)}
                        autoFocus
                      />
                      <button 
                        onClick={handleSave}
                        className="bg-[#0052cc] text-white p-1 rounded hover:bg-[#0747a6]"
                      >
                        <Check className="w-3 h-3" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between mt-0.5 gap-2">
                      <span className={`inline-block px-2 py-1 rounded text-xs font-bold leading-snug break-words ${
                        track.curatedGenre 
                          ? 'bg-blue-50 text-blue-800 border border-blue-200' 
                          : 'text-slate-400 font-mono'
                      }`}>
                        {track.curatedGenre || "— (Unanalyzed)"}
                      </span>
                      <button 
                        onClick={() => setIsEditing(true)}
                        className="text-[10px] text-[#0052cc] hover:underline font-bold cursor-pointer"
                      >
                        EDIT
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Gemini Curation logs */}
              {hasCuration ? (
                <div className="space-y-3.5">
                  <div className="space-y-1">
                    <div className="flex items-center gap-1 text-slate-500">
                      <FileText className="w-3.5 h-3.5 text-blue-500" />
                      <span className="text-[9px] font-bold uppercase tracking-wider">Curation Verification Report</span>
                    </div>
                    <p className="text-xs text-[#4b5563] bg-white p-3 rounded border border-[#e5e7eb] leading-relaxed font-sans">
                      {track.curationNotes}
                    </p>
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center gap-1 text-slate-500">
                      <Globe className="w-3.5 h-3.5 text-blue-500" />
                      <span className="text-[9px] font-bold uppercase tracking-wider">Verification Reference Citations</span>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {track.verificationSource.split(",").map((src, idx) => {
                        const trimmed = src.trim();
                        if (!trimmed) return null;
                        return (
                          <span 
                            key={`src-${idx}`}
                            className="inline-flex items-center bg-[#f4f5f7] border border-[#d1d5db] px-2 py-0.5 rounded text-[10px] font-semibold text-[#4b5563]"
                          >
                            {trimmed}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-[#f8fafc] p-4 rounded border border-[#e5e7eb] flex items-center justify-center text-center text-xs text-[#6b7280]">
                  <div>
                    <HelpCircle className="w-6 h-6 mx-auto text-slate-350 mb-1.5" />
                    <p className="text-[11px]">No active audit log found. Hit "Verify" in the table row to run dynamic real-time web querying.</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Technical Audio details */}
          <div className="grid grid-cols-3 gap-3.5 bg-[#f8fafc]/50 p-2.5 rounded border border-[#d1d5db] border-dashed text-xs">
            <div>
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">Length</span>
              <span className="font-semibold text-[#4b5563] font-mono flex items-center gap-1">
                <Clock className="w-3 h-3 text-slate-400" />
                {track.time || "-"}
              </span>
            </div>
            <div>
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">BPM</span>
              {track.curatedBpm && track.curatedBpm !== track.bpm ? (
                <div className="flex flex-col gap-0.5">
                  <span className="text-[10px] line-through text-slate-400">Orig: {track.bpm ? `${parseFloat(track.bpm).toFixed(0)}` : "-"}</span>
                  <span className="font-bold text-emerald-700 bg-emerald-50 px-1 py-0.5 rounded text-[11px] font-mono">
                    {parseFloat(track.curatedBpm).toFixed(0)} BPM
                  </span>
                </div>
              ) : (
                <span className="font-semibold text-[#4b5563] font-mono">
                  {track.bpm ? `${parseFloat(track.bpm).toFixed(0)} BPM` : "-"}
                </span>
              )}
            </div>
            <div>
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">Harmonic Key</span>
              {track.curatedKey && track.curatedKey !== track.key ? (
                <div className="flex flex-col gap-0.5">
                  <span className="text-[10px] line-through text-slate-400">Orig: {track.key || "-"}</span>
                  <span className="font-bold text-blue-700 bg-blue-50 px-1 py-0.5 rounded text-[11px] font-mono">
                    {track.curatedKey}
                  </span>
                </div>
              ) : (
                <span className="font-bold text-blue-600 font-mono">
                  {track.key || "-"}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Footer actions */}
        <div className="p-3 border-t border-[#d1d5db] bg-slate-50/60 flex items-center justify-end shrink-0">
          <button 
            onClick={onClose}
            className="px-4 py-1.5 bg-white hover:bg-slate-50 border border-[#d1d5db] text-xs font-bold text-[#4b5563] hover:text-[#1a1c1e] rounded transition-colors cursor-pointer"
          >
            CONFIRM & CLOSE
          </button>
        </div>
      </div>
    </div>
  );
}
