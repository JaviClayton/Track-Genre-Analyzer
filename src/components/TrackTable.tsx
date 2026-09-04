import React, { useState, useMemo } from "react";
import { Track, CurationStatus } from "../types.js";
import { 
  Search, 
  Filter, 
  Sparkles, 
  Eye, 
  RefreshCw, 
  Check, 
  X, 
  CheckCircle2, 
  AlertCircle,
  HelpCircle,
  FolderMinus,
  Edit2,
  ArrowUpDown,
  ChevronUp,
  ChevronDown,
  Star
} from "lucide-react";

interface TrackTableProps {
  tracks: Track[];
  onSelectTrack: (id: string, isSelected: boolean) => void;
  onSelectAllTracks: (isSelected: boolean) => void;
  onViewDetails: (track: Track) => void;
  onManualOverride: (trackId: string, newGenre: string) => void;
  onSingleAction: (track: Track) => void;
  isProcessing: boolean;
}

export default function TrackTable({
  tracks,
  onSelectTrack,
  onSelectAllTracks,
  onViewDetails,
  onManualOverride,
  onSingleAction,
  isProcessing
}: TrackTableProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [genrePresenceFilter, setGenrePresenceFilter] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);
  const [editingTrackId, setEditingTrackId] = useState<string | null>(null);
  const [overrideValue, setOverrideValue] = useState("");
  const [sortField, setSortField] = useState<string>("originalRowIndex");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  // Filters setup
  const filteredTracks = useMemo(() => {
    return tracks.filter(track => {
      const matchesSearch = 
        track.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        track.artist.toLowerCase().includes(searchTerm.toLowerCase()) ||
        track.album.toLowerCase().includes(searchTerm.toLowerCase()) ||
        track.genre.toLowerCase().includes(searchTerm.toLowerCase()) ||
        track.curatedGenre.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (track.year && track.year.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (track.curatedYear && track.curatedYear.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchesStatus = 
        statusFilter === "all" || 
        (statusFilter === "success" && track.curationStatus === CurationStatus.SUCCESS) ||
        (statusFilter === "pending" && (track.curationStatus === CurationStatus.IDLE || track.curationStatus === CurationStatus.PENDING)) ||
        (statusFilter === "analyzing" && track.curationStatus === CurationStatus.ANALYZING) ||
        (statusFilter === "failed" && track.curationStatus === CurationStatus.FAILED);

      const matchesGenrePresence = 
        genrePresenceFilter === "all" ||
        (genrePresenceFilter === "missing" && !track.genre) ||
        (genrePresenceFilter === "existing" && !!track.genre) ||
        (genrePresenceFilter === "missing-year" && !track.year) ||
        (genrePresenceFilter === "missing-bpm-key" && (!track.bpm || !track.key));

      return matchesSearch && matchesStatus && matchesGenrePresence;
    });
  }, [tracks, searchTerm, statusFilter, genrePresenceFilter]);

  // Sorting setup
  const sortedTracks = useMemo(() => {
    const list = [...filteredTracks];
    if (sortField === "originalRowIndex") {
      return sortDirection === "asc"
        ? list.sort((a, b) => a.originalRowIndex - b.originalRowIndex)
        : list.sort((a, b) => b.originalRowIndex - a.originalRowIndex);
    }

    list.sort((a, b) => {
      let valA: any = "";
      let valB: any = "";

      if (sortField === "title") {
        valA = a.title?.toLowerCase() || "";
        valB = b.title?.toLowerCase() || "";
      } else if (sortField === "artist") {
        valA = a.artist?.toLowerCase() || "";
        valB = b.artist?.toLowerCase() || "";
      } else if (sortField === "genre") {
        valA = a.genre?.toLowerCase() || "";
        valB = b.genre?.toLowerCase() || "";
      } else if (sortField === "curatedGenre") {
        valA = a.curatedGenre?.toLowerCase() || "";
        valB = b.curatedGenre?.toLowerCase() || "";
      } else if (sortField === "rating") {
        const getRatingScore = (track: Track) => {
          const r = track.rating || "";
          const asterisks = (r.match(/\*/g) || []).length;
          if (asterisks > 0) return asterisks;
          const parsed = parseInt(r, 10);
          return isNaN(parsed) ? 0 : parsed;
        };
        valA = getRatingScore(a);
        valB = getRatingScore(b);
      } else if (sortField === "bpm") {
        const bpmA = parseFloat(a.bpm) || 0;
        const bpmB = parseFloat(b.bpm) || 0;
        valA = bpmA;
        valB = bpmB;
      } else if (sortField === "key") {
        valA = a.key?.toLowerCase() || "";
        valB = b.key?.toLowerCase() || "";
      } else if (sortField === "year") {
        valA = a.curatedYear || a.year || "";
        valB = b.curatedYear || b.year || "";
      }

      if (valA < valB) return sortDirection === "asc" ? -1 : 1;
      if (valA > valB) return sortDirection === "asc" ? 1 : -1;
      return a.originalRowIndex - b.originalRowIndex;
    });

    return list;
  }, [filteredTracks, sortField, sortDirection]);

  // Pagination setup
  const totalPages = Math.ceil(filteredTracks.length / pageSize) || 1;
  const paginatedTracks = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return sortedTracks.slice(startIndex, startIndex + pageSize);
  }, [sortedTracks, currentPage, pageSize]);

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(prev => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
    setCurrentPage(1);
  };

  // Adjust pagination constraints on search or filter updates
  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  const selectedCount = useMemo(() => {
    return tracks.filter(t => t.isSelected).length;
  }, [tracks]);

  const isAllSelected = useMemo(() => {
    const pageIds = paginatedTracks.map(t => t.id);
    if (pageIds.length === 0) return false;
    return pageIds.every(id => {
      const match = tracks.find(t => t.id === id);
      return match ? match.isSelected : false;
    });
  }, [paginatedTracks, tracks]);

  const handleSelectPageToggle = () => {
    const targetState = !isAllSelected;
    paginatedTracks.forEach(t => {
      onSelectTrack(t.id, targetState);
    });
  };

  const handleEditClick = (track: Track) => {
    setEditingTrackId(track.id);
    setOverrideValue(track.curatedGenre || track.genre || "");
  };

  const handleSaveOverride = (trackId: string) => {
    onManualOverride(trackId, overrideValue);
    setEditingTrackId(null);
  };

  // Render proper status indicators on tracks
  const getStatusBadge = (status: CurationStatus) => {
    switch (status) {
      case CurationStatus.SUCCESS:
        return (
          <span id="badge-success" className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-bold">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Curated
          </span>
        );
      case CurationStatus.ANALYZING:
        return (
          <span id="badge-analyzing" className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 text-[11px] font-bold animate-pulse">
            <RefreshCw className="w-2.5 h-2.5 animate-spin" /> Curating
          </span>
        );
      case CurationStatus.PENDING:
        return (
          <span id="badge-pending" className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200 text-[11px] font-medium">
            Queued
          </span>
        );
      case CurationStatus.FAILED:
        return (
          <span id="badge-failed" className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200 text-[11px] font-bold">
            <AlertCircle className="w-2.5 h-2.5" /> Error
          </span>
        );
      default:
        return (
          <span id="badge-idle" className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-50 text-slate-400 border border-slate-200 text-[11px] font-medium">
            Idle
          </span>
        );
    }
  };

  const renderRating = (ratingStr: string) => {
    if (!ratingStr) return <span className="text-slate-350 font-mono text-[10px]">-</span>;
    const count = (ratingStr.match(/\*/g) || []).length;
    if (count > 0) {
      return (
        <span 
          className="inline-flex gap-0.5 text-amber-500 text-[10px] py-0.5" 
          title={ratingStr}
        >
          {Array.from({ length: 5 }).map((_, idx) => (
            <Star 
              key={idx} 
              className={`w-2.5 h-2.5 ${idx < count ? "text-amber-500 fill-amber-500" : "text-slate-200 fill-slate-200"}`} 
            />
          ))}
        </span>
      );
    }
    const num = parseInt(ratingStr, 10);
    if (!isNaN(num) && num >= 1 && num <= 5) {
      return (
        <span 
          className="inline-flex gap-0.5 text-amber-500 text-[10px] py-0.5" 
          title={`${num} Stars`}
        >
          {Array.from({ length: 5 }).map((_, idx) => (
            <Star 
              key={idx} 
              className={`w-2.5 h-2.5 ${idx < num ? "text-amber-500 fill-amber-500" : "text-slate-200 fill-slate-200"}`} 
            />
          ))}
        </span>
      );
    }
    return <span className="text-[#4b5563] font-mono text-[11px]">{ratingStr}</span>;
  };

  return (
    <div id="track-table-root" className="bg-white border border-[#d1d5db] rounded-lg overflow-hidden flex flex-col flex-1 shadow-sm">
      {/* Filters Toolbar */}
      <div id="filters-toolbar" className="p-3 border-b border-[#d1d5db] bg-[#f9fafb] flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div id="search-input-wrapper" className="relative w-full sm:w-72">
          <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-slate-400" />
          <input 
            type="text"
            placeholder="Filter database..."
            className="w-full bg-white border border-[#d1d5db] rounded px-3 py-1 pl-8 text-xs text-[#1a1c1e] placeholder-slate-400 focus:outline-none focus:border-[#0052cc] focus:ring-1 focus:ring-[#0052cc] transition-colors"
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
          />
        </div>

        <div id="active-filters-group" className="flex flex-wrap gap-2 items-center w-full sm:w-auto justify-end">
          <div className="flex items-center gap-1">
            <Filter className="w-3.5 h-3.5 text-[#4b5563]" />
            <select
              className="bg-white border border-[#d1d5db] rounded px-2 py-1 text-xs text-[#4b5563] focus:outline-none focus:border-[#0052cc]"
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setCurrentPage(1);
              }}
            >
              <option value="all">All Statuses</option>
              <option value="pending">Idle / Queued</option>
              <option value="analyzing">Curating</option>
              <option value="success">Success</option>
              <option value="failed">Error</option>
            </select>
          </div>

          <select
            className="bg-white border border-[#d1d5db] rounded px-2 py-1 text-xs text-[#4b5563] focus:outline-none focus:border-[#0052cc]"
            value={genrePresenceFilter}
            onChange={(e) => {
              setGenrePresenceFilter(e.target.value);
              setCurrentPage(1);
            }}
          >
            <option value="all">All Metadata</option>
            <option value="missing">Missing Genre (Column F)</option>
            <option value="missing-year">Missing Year</option>
            <option value="missing-bpm-key">Missing BPM / Key</option>
            <option value="existing">Existing Genre (Verify)</option>
          </select>

          <div className="flex items-center gap-1">
            <select
              className="bg-white border border-[#d1d5db] rounded px-2 py-1 text-xs text-[#4b5563] focus:outline-none focus:border-[#0052cc]"
              value={`${sortField}-${sortDirection}`}
              onChange={(e) => {
                const parts = e.target.value.split("-");
                const field = parts[0];
                const direction = parts[1] as "asc" | "desc";
                setSortField(field);
                setSortDirection(direction);
                setCurrentPage(1);
              }}
            >
              <option value="originalRowIndex-asc">Sort: Default (Row #)</option>
              <option value="title-asc">Sort: Title (A-Z)</option>
              <option value="title-desc">Sort: Title (Z-A)</option>
              <option value="artist-asc">Sort: Artist (A-Z)</option>
              <option value="artist-desc">Sort: Artist (Z-A)</option>
              <option value="genre-asc">Sort: Orig Genre (A-Z)</option>
              <option value="genre-desc">Sort: Orig Genre (Z-A)</option>
              <option value="curatedGenre-asc">Sort: Curated (A-Z)</option>
              <option value="curatedGenre-desc">Sort: Curated (Z-A)</option>
              <option value="year-desc">Sort: Year (New to Old)</option>
              <option value="year-asc">Sort: Year (Old to New)</option>
              <option value="rating-desc">Sort: Rating (High to Low)</option>
              <option value="rating-asc">Sort: Rating (Low to High)</option>
              <option value="bpm-desc">Sort: BPM (Fast to Slow)</option>
              <option value="bpm-asc">Sort: BPM (Slow to Fast)</option>
              <option value="key-asc">Sort: Key (A-Z)</option>
              <option value="key-desc">Sort: Key (Z-A)</option>
            </select>
          </div>

          <select
            className="bg-white hover:bg-slate-50 border border-[#d1d5db] hover:border-slate-400 focus:border-[#0052cc] focus:ring-1 focus:ring-[#0052cc] rounded px-2.5 py-1 text-xs font-semibold text-[#4b5563] transition-colors cursor-pointer outline-none shadow-sm"
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setCurrentPage(1);
            }}
          >
            <option value={15}>15 rows</option>
            <option value={30}>30 rows</option>
            <option value={50}>50 rows</option>
            <option value={100}>100 rows</option>
            <option value={1000000}>All rows</option>
          </select>
        </div>
      </div>

      {/* Grid Table */}
      <div id="table-scroll-wrapper" className="overflow-y-auto flex-1">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-[#d1d5db] bg-[#f9fafb] text-[10px] font-bold text-[#4b5563] uppercase tracking-wider sticky top-0 z-10 selection:bg-transparent">
              <th className="p-2.5 w-10 text-center border-r border-[#e5e7eb]">
                <input 
                  type="checkbox"
                  className="rounded border-[#d1d5db] text-[#0052cc] focus:ring-[#0052cc] cursor-pointer h-3.5 w-3.5"
                  checked={isAllSelected}
                  onChange={handleSelectPageToggle}
                />
              </th>
              <th className="p-2.5 w-12 text-center border-r border-[#e5e7eb]">#</th>
              <th className="p-2.5 border-r border-[#e5e7eb] min-w-[220px]">
                <button 
                  onClick={() => handleSort("title")}
                  className="flex items-center gap-1 hover:text-[#1a1c1e] text-[10px] font-bold uppercase tracking-wider text-left focus:outline-none cursor-pointer w-full"
                >
                  Track Information
                  {sortField === "title" ? (
                    sortDirection === "asc" ? <ChevronUp className="w-3 h-3 text-[#0052cc]" /> : <ChevronDown className="w-3 h-3 text-[#0052cc]" />
                  ) : <ArrowUpDown className="w-3 h-3 text-slate-400" />}
                </button>
              </th>
              <th className="p-2.5 border-r border-[#e5e7eb] min-w-[124px]">
                <button 
                  onClick={() => handleSort("artist")}
                  className="flex items-center gap-1 hover:text-[#1a1c1e] text-[10px] font-bold uppercase tracking-wider text-left focus:outline-none cursor-pointer w-full"
                >
                  Artist
                  {sortField === "artist" ? (
                    sortDirection === "asc" ? <ChevronUp className="w-3 h-3 text-[#0052cc]" /> : <ChevronDown className="w-3 h-3 text-[#0052cc]" />
                  ) : <ArrowUpDown className="w-3 h-3 text-slate-400" />}
                </button>
              </th>
              <th className="p-2.5 border-r border-[#e5e7eb] min-w-[160px]">
                <button 
                  onClick={() => handleSort("genre")}
                  className="flex items-center gap-1 hover:text-[#1a1c1e] text-[10px] font-bold uppercase tracking-wider text-left focus:outline-none cursor-pointer w-full"
                >
                  Original Genre
                  {sortField === "genre" ? (
                    sortDirection === "asc" ? <ChevronUp className="w-3 h-3 text-[#0052cc]" /> : <ChevronDown className="w-3 h-3 text-[#0052cc]" />
                  ) : <ArrowUpDown className="w-3 h-3 text-slate-400" />}
                </button>
              </th>
              <th className="p-2.5 border-r border-[#e5e7eb] min-w-[220px] bg-[#f0f7ff]/70 text-blue-900">
                <button 
                  onClick={() => handleSort("curatedGenre")}
                  className="flex items-center gap-1 hover:text-blue-950 text-[10px] font-bold uppercase tracking-wider text-left focus:outline-none cursor-pointer w-full text-blue-900"
                >
                  Genre Analysis
                  {sortField === "curatedGenre" ? (
                    sortDirection === "asc" ? <ChevronUp className="w-3 h-3 text-[#0052cc]" /> : <ChevronDown className="w-3 h-3 text-[#0052cc]" />
                  ) : <ArrowUpDown className="w-3 h-3 text-blue-500" />}
                </button>
              </th>
              <th className="p-2.5 border-r border-[#e5e7eb] text-center w-20">
                <button 
                  onClick={() => handleSort("year")}
                  className="flex items-center justify-center gap-1 hover:text-[#1a1c1e] text-[10px] font-bold uppercase tracking-wider text-center focus:outline-none cursor-pointer w-full"
                >
                  Year
                  {sortField === "year" ? (
                    sortDirection === "asc" ? <ChevronUp className="w-2.5 h-2.5 text-[#0052cc]" /> : <ChevronDown className="w-2.5 h-2.5 text-[#0052cc]" />
                  ) : <ArrowUpDown className="w-2.5 h-2.5 text-slate-400" />}
                </button>
              </th>
              <th className="p-2.5 border-r border-[#e5e7eb] text-center w-28">
                <div className="flex items-center justify-center gap-1 text-[10px] uppercase font-bold tracking-wider">
                  <button 
                    onClick={() => handleSort("bpm")}
                    className="hover:text-[#1a1c1e] text-center focus:outline-none flex items-center cursor-pointer"
                  >
                    BPM
                    {sortField === "bpm" ? (
                      sortDirection === "asc" ? <ChevronUp className="w-2.5 h-2.5 ml-0.5 text-[#0052cc]" /> : <ChevronDown className="w-2.5 h-2.5 ml-0.5 text-[#0052cc]" />
                    ) : <ArrowUpDown className="w-2.5 h-2.5 ml-0.5 text-slate-400" />}
                  </button>
                  <span className="text-slate-300">/</span>
                  <button 
                    onClick={() => handleSort("key")}
                    className="hover:text-[#1a1c1e] text-center focus:outline-none flex items-center cursor-pointer"
                  >
                    Key
                    {sortField === "key" ? (
                      sortDirection === "asc" ? <ChevronUp className="w-2.5 h-2.5 ml-0.5 text-[#0052cc]" /> : <ChevronDown className="w-2.5 h-2.5 ml-0.5 text-[#0052cc]" />
                    ) : <ArrowUpDown className="w-2.5 h-2.5 ml-0.5 text-slate-400" />}
                  </button>
                </div>
              </th>
              <th className="p-2.5 border-r border-[#e5e7eb] text-center w-24">
                <button 
                  onClick={() => handleSort("rating")}
                  className="flex items-center justify-center gap-1 hover:text-[#1a1c1e] text-[10px] font-bold uppercase tracking-wider text-center focus:outline-none cursor-pointer w-full"
                >
                  Rating
                  {sortField === "rating" ? (
                    sortDirection === "asc" ? <ChevronUp className="w-3 h-3 text-[#0052cc]" /> : <ChevronDown className="w-3 h-3 text-[#0052cc]" />
                  ) : <ArrowUpDown className="w-3 h-3 text-slate-400" />}
                </button>
              </th>
              <th className="p-2.5 border-r border-[#e5e7eb] text-center w-28">Status</th>
              <th className="p-2.5 text-center w-24">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#e5e7eb] text-xs text-[#1a1c1e]">
            {paginatedTracks.length === 0 ? (
              <tr>
                <td colSpan={11} className="p-10 text-center text-[#6b7280]">
                  <div className="flex flex-col items-center gap-2 justify-center py-8">
                    <FolderMinus className="w-8 h-8 text-[#9ca3af]" />
                    <span className="font-medium text-xs">No records matched active filters.</span>
                  </div>
                </td>
              </tr>
            ) : (
              paginatedTracks.map((track) => {
                const hasExisting = !!track.genre;
                
                return (
                  <tr 
                    key={track.id}
                    className={`hover:bg-[#f8fafc] cursor-default transition-colors ${track.isSelected ? 'bg-blue-50/40' : ''}`}
                  >
                    <td className="p-2.5 w-10 text-center border-r border-[#e5e7eb]">
                      <input 
                        type="checkbox"
                        className="rounded border-[#d1d5db] text-[#0052cc] focus:ring-[#0052cc] cursor-pointer h-3.5 w-3.5"
                        checked={track.isSelected}
                        onChange={(e) => onSelectTrack(track.id, e.target.checked)}
                      />
                    </td>
                    <td className="p-2.5 text-center font-mono text-[11px] text-[#9ca3af] border-r border-[#e5e7eb]">
                      {track.originalRowIndex}
                    </td>
                    <td className="p-2.5 border-r border-[#e5e7eb]">
                      <div className="font-semibold text-[#1a1c1e] truncate max-w-[240px]" title={track.title}>
                        {track.title || <span className="text-slate-300 font-mono text-[10px]">(No Title)</span>}
                      </div>
                      <div className="text-[10px] text-[#6b7280] mt-0.5 truncate max-w-[240px]" title={track.artist}>
                        <span className="font-mono text-[9px] text-[#9ca3af] py-0.5 uppercase tracking-wide mr-1 select-none">Art:</span>
                        {track.artist || "n/a"}
                      </div>
                      <div className="text-[10px] text-[#6b7280] mt-0.5 truncate max-w-[240px]" title={track.album}>
                        <span className="font-mono text-[9px] text-[#9ca3af] py-0.5 uppercase tracking-wide mr-1 select-none">Alb:</span>
                        {track.album || <span className="text-slate-300 italic font-mono text-[9px]">empty</span>}
                      </div>
                    </td>
                    <td className="p-2.5 text-[#4b5563] truncate border-r border-[#e5e7eb] max-w-[140px]" title={track.artist || ""}>
                      {track.artist || <span className="text-slate-300 font-mono text-[10px]">-</span>}
                    </td>
                    <td className="p-2.5 border-r border-[#e5e7eb]">
                      {hasExisting ? (
                        <span className="inline-block bg-[#f4f5f7] border border-[#d1d5db] text-[#4b5563] px-2 py-0.5 rounded text-[11px] font-medium leading-tight break-words" title={track.genre}>
                          {track.genre}
                        </span>
                      ) : (
                        <span className="text-[10px] text-rose-600 font-mono italic">
                          [EMPTY]
                        </span>
                      )}
                    </td>
                    <td className="p-2.5 border-r border-[#e5e7eb] bg-blue-50/10">
                      {editingTrackId === track.id ? (
                        <div className="flex items-center gap-1">
                          <input
                            type="text"
                            className="bg-white border border-[#0052cc] text-xs text-[#1a1c1e] rounded px-1.5 py-0.5 focus:outline-none w-full min-w-[140px]"
                            value={overrideValue}
                            onChange={(e) => setOverrideValue(e.target.value)}
                            placeholder="Tag 1; Tag 2"
                            title="Separate multiple genres with semicolon (;)"
                            onKeyDown={(e) => {
                              if (e.key === "Enter") handleSaveOverride(track.id);
                              if (e.key === "Escape") setEditingTrackId(null);
                            }}
                            autoFocus
                          />
                          <button 
                            onClick={() => handleSaveOverride(track.id)}
                            className="p-1 text-emerald-600 hover:bg-emerald-50 rounded"
                            title="Save"
                          >
                            <Check className="w-3 h-3" />
                          </button>
                          <button 
                            onClick={() => setEditingTrackId(null)}
                            className="p-1 text-rose-600 hover:bg-rose-50 rounded"
                            title="Cancel"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-start justify-between group gap-1.5">
                          {track.curatedGenre ? (
                            <span 
                              className={`inline-block px-2 py-0.5 rounded text-[11px] font-bold leading-tight break-words ${
                                track.isModified 
                                  ? 'bg-amber-50 text-amber-800 border border-amber-200' 
                                  : track.genre 
                                    ? 'bg-emerald-50 text-emerald-850 border border-emerald-200' 
                                    : 'bg-blue-50 text-blue-800 border border-blue-200'
                              }`}
                              title={track.curatedGenre}
                            >
                              {track.curatedGenre}
                            </span>
                          ) : track.curationStatus === CurationStatus.ANALYZING ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-blue-600 animate-pulse">
                              <RefreshCw className="w-2.5 h-2.5 animate-spin text-blue-500" /> Analyzing...
                            </span>
                          ) : track.curationStatus === CurationStatus.FAILED ? (
                            <span className="text-rose-500 italic text-[11px] font-mono">[FAILED]</span>
                          ) : (
                            <span className="text-slate-400 font-mono text-xs select-none pl-1" title="Unanalyzed (Run curation or edit)">—</span>
                          )}
                          <button 
                            onClick={() => handleEditClick(track)}
                            disabled={isProcessing}
                            className="p-1 text-[#9ca3af] hover:text-[#1a1c1e] opacity-0 group-hover:opacity-100 transition-opacity rounded shrink-0 cursor-pointer"
                            title="Edit manually"
                          >
                            <Edit2 className="w-2.5 h-2.5" />
                          </button>
                        </div>
                      )}
                    </td>
                    <td className="p-2.5 text-center font-mono text-[10px] text-[#4b5563] border-r border-[#e5e7eb]">
                      {track.curatedYear && track.curatedYear !== track.year ? (
                        <div className="flex flex-col items-center justify-center">
                          {track.year && <span className="line-through text-slate-400 text-[9px]">{track.year}</span>}
                          <span className="text-purple-700 font-bold bg-purple-50 border border-purple-200 px-1.5 py-0.5 rounded text-[10px]">
                            {track.curatedYear}
                          </span>
                        </div>
                      ) : (
                        <span className={track.curatedYear || track.year ? "font-bold text-slate-700 text-[11px]" : "text-slate-400 text-[11px]"}>
                          {track.curatedYear || track.year || "—"}
                        </span>
                      )}
                    </td>
                    <td className="p-2.5 text-center font-mono text-[10px] text-[#4b5563] border-r border-[#e5e7eb]">
                      {track.curatedBpm && track.curatedBpm !== track.bpm ? (
                        <div className="flex flex-col items-center justify-center">
                          <span className="line-through text-slate-400 text-[9px]">{track.bpm ? `${parseFloat(track.bpm).toFixed(0)}` : "-"}</span>
                          <span className="text-emerald-700 font-bold bg-emerald-50 px-1 rounded text-[9px] inline-flex items-center">
                            {parseFloat(track.curatedBpm).toFixed(0)} BPM
                          </span>
                        </div>
                      ) : (
                        <div>{track.bpm ? `${parseFloat(track.bpm).toFixed(0)} BPM` : "-"}</div>
                      )}

                      {track.curatedKey && track.curatedKey !== track.key ? (
                        <div className="flex flex-col items-center justify-center mt-1">
                          <span className="line-through text-slate-400 text-[9px]">{track.key || "-"}</span>
                          <span className="text-blue-700 font-bold bg-blue-50 px-1 rounded text-[9px]">
                            {track.curatedKey}
                          </span>
                        </div>
                      ) : (
                        <div className="text-blue-600 font-bold mt-0.5">{track.key || "-"}</div>
                      )}
                    </td>
                    <td className="p-2.5 text-center border-r border-[#e5e7eb]">
                      {renderRating(track.rating)}
                    </td>
                    <td className="p-2.5 text-center border-r border-[#e5e7eb]">
                      {getStatusBadge(track.curationStatus)}
                    </td>
                    <td className="p-2.5">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => onViewDetails(track)}
                          className="p-1 rounded bg-[#f4f5f7] border border-[#d1d5db] text-[#4b5563] hover:text-[#1a1c1e] hover:bg-[#ebecef] transition-colors"
                          title="View Details"
                        >
                          <Eye className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => onSingleAction(track)}
                          disabled={isProcessing || track.curationStatus === CurationStatus.ANALYZING}
                          className="p-1 rounded bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-700 transition-colors disabled:opacity-40"
                          title="Run curation analysis"
                        >
                          <Sparkles className="w-3 h-3" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      {filteredTracks.length > 0 && (
        <div id="table-pagination" className="px-5 py-3 border-t border-[#d1d5db] bg-[#f9fafb] flex flex-col sm:flex-row gap-3 items-center justify-between shrink-0">
          <div id="selection-stats" className="text-[11px] text-[#6b7280] flex items-center gap-2">
            <span>Showing {Math.min(filteredTracks.length, (currentPage - 1) * pageSize + 1)}-{Math.min(filteredTracks.length, currentPage * pageSize)} of {filteredTracks.length} tracks</span>
            {selectedCount > 0 && (
              <span className="inline-block bg-blue-50 border border-blue-200 px-2 py-0.5 rounded text-blue-700 font-bold font-mono">
                {selectedCount} SELECTED
              </span>
            )}
          </div>
          
          <div id="pagination-nav" className="flex items-center gap-1.5">
            <button
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1}
              className="px-2 py-1 rounded bg-white border border-[#d1d5db] hover:bg-slate-50 text-[11px] font-bold text-[#4b5563] disabled:opacity-30 transition-colors"
            >
              PREV
            </button>
            <div className="flex items-center gap-1">
              {Array.from({ length: totalPages }).map((_, idx) => {
                const pageNum = idx + 1;
                if (totalPages > 5 && pageNum !== 1 && pageNum !== totalPages && Math.abs(pageNum - currentPage) > 1) {
                  if (pageNum === 2 || pageNum === totalPages - 1) {
                    return <span key={`trunc-${pageNum}`} className="text-slate-400 px-0.5 font-mono text-[10px]">...</span>;
                  }
                  return null;
                }
                return (
                  <button
                    key={`page-${pageNum}`}
                    onClick={() => handlePageChange(pageNum)}
                    className={`w-6 h-6 rounded text-[11px] font-bold transition-all ${
                      currentPage === pageNum 
                        ? 'bg-[#0052cc] text-white' 
                        : 'bg-white border border-[#d1d5db] text-[#4b5563] hover:bg-slate-50'
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}
            </div>
            <button
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
              className="px-2 py-1 rounded bg-white border border-[#d1d5db] hover:bg-slate-50 text-[11px] font-bold text-[#4b5563] disabled:opacity-30 transition-colors"
            >
              NEXT
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
