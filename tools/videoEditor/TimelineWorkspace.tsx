import React, { useRef, useMemo } from 'react';
import {
  RotateCcw,
  RotateCw,
  Trash2,
  Type,
  Plus,
  Film,
  Music,
  Upload,
  Magnet,
  Activity,
  ZoomIn,
  ZoomOut,
  Volume2,
  VolumeX,
  Eye,
  EyeOff
} from 'lucide-react';
import { VideoFile, EditorSettings } from '../../types';
import { VideoEditorTranslationSchema } from '../../translations/videoEditorTranslations';
import {
  VideoTrackItem,
  AudioTrackItem,
  VideoClipItem,
  AudioClipItem,
  TextClipItem,
  LeftSidebarTab
} from './types';
import { TrimHandle } from './TrimHandle';
import { AudioWaveform } from './AudioWaveform';
import { formatShortDuration, formatCapCutTimecode } from './editorUtils';

interface TimelineWorkspaceProps {
  editorT: VideoEditorTranslationSchema;
  history: any[];
  historyIndex: number;
  handleUndo: () => void;
  handleRedo: () => void;
  handleSplitClip: () => void;
  handleDelete: () => void;
  handleRippleDelete: () => void;
  rippleMode: boolean;
  setRippleMode: React.Dispatch<React.SetStateAction<boolean>>;
  trimSelectedClipDelta: (edge: 'start' | 'end', delta: number) => void;
  trimSelectedClipToPlayhead: (edge: 'start' | 'end') => void;
  snappingEnabled: boolean;
  setSnappingEnabled: (enabled: boolean) => void;
  showAudioWaveforms: boolean;
  setShowAudioWaveforms: React.Dispatch<React.SetStateAction<boolean>>;
  timelineZoom: number;
  setTimelineZoom: (zoom: number) => void;
  videoTracks: VideoTrackItem[];
  audioTracks: AudioTrackItem[];
  video?: VideoFile | null;
  settings: EditorSettings;
  isVideoAudioMuted: boolean;
  getVideoClipSourceDuration: (clip: VideoClipItem) => number;
  clips: VideoClipItem[];
  setClips: React.Dispatch<React.SetStateAction<VideoClipItem[]>>;
  selectedClipId: string;
  setSelectedClipId: (id: string) => void;
  updateClip: (id: string, updates: Partial<VideoClipItem>) => void;
  audioClips: AudioClipItem[];
  setAudioClips: React.Dispatch<React.SetStateAction<AudioClipItem[]>>;
  selectedAudioClipId: string | null;
  setSelectedAudioClipId: (id: string | null) => void;
  updateAudioClip: (id: string, updates: Partial<AudioClipItem>) => void;
  textClips: TextClipItem[];
  setTextClips: React.Dispatch<React.SetStateAction<TextClipItem[]>>;
  selectedTextClipId: string | null;
  setSelectedTextClipId: (id: string | null) => void;
  addVideoTrack: () => void;
  addAudioTrack: () => void;
  toggleVideoTrackHide: (trackId: string) => void;
  toggleVideoTrackMute: (trackId: string) => void;
  deleteVideoTrack: (trackId: string) => void;
  toggleAudioTrackMute: (trackId: string) => void;
  deleteAudioTrack: (trackId: string) => void;
  setLeftNavTab: (tab: LeftSidebarTab) => void;
  setIsAssetDrawerOpen: (open: boolean) => void;
  setTransitionPickerClipId: (id: string | null) => void;
  handleUploadClick: () => void;
  handleAudioUploadClick: () => void;
  currentTime: number;
  duration: number;
  activeSnapLine: { time: number; label?: string } | null;
  activeTrimming: {
    id: string;
    type: 'video' | 'audio' | 'text';
    edge: 'start' | 'end';
    currentDuration: number;
    maxDuration: number;
    isAtMaxLimit: boolean;
  } | null;
  timelineTracksRef: React.RefObject<HTMLDivElement>;
  handleTimelinePointerDown: (e: React.PointerEvent<HTMLDivElement>) => void;
  handleClipPointerDown: (e: React.PointerEvent<HTMLDivElement>, id: string, type: 'video' | 'audio' | 'text') => void;
  handleTrimPointerDown: (e: React.PointerEvent<HTMLDivElement>, id: string, edge: 'start' | 'end', type: 'video' | 'audio' | 'text') => void;
}

export const TimelineWorkspace: React.FC<TimelineWorkspaceProps> = ({
  editorT,
  history,
  historyIndex,
  handleUndo,
  handleRedo,
  handleSplitClip,
  handleDelete,
  handleRippleDelete,
  rippleMode,
  setRippleMode,
  trimSelectedClipDelta,
  trimSelectedClipToPlayhead,
  snappingEnabled,
  setSnappingEnabled,
  showAudioWaveforms,
  setShowAudioWaveforms,
  timelineZoom,
  setTimelineZoom,
  videoTracks,
  audioTracks,
  video,
  settings,
  isVideoAudioMuted,
  getVideoClipSourceDuration,
  clips,
  setClips,
  selectedClipId,
  setSelectedClipId,
  updateClip,
  audioClips,
  setAudioClips,
  selectedAudioClipId,
  setSelectedAudioClipId,
  updateAudioClip,
  textClips,
  setTextClips,
  selectedTextClipId,
  setSelectedTextClipId,
  addVideoTrack,
  addAudioTrack,
  toggleVideoTrackHide,
  toggleVideoTrackMute,
  deleteVideoTrack,
  toggleAudioTrackMute,
  deleteAudioTrack,
  setLeftNavTab,
  setIsAssetDrawerOpen,
  setTransitionPickerClipId,
  handleUploadClick,
  handleAudioUploadClick,
  currentTime,
  duration,
  activeSnapLine,
  activeTrimming,
  timelineTracksRef,
  handleTimelinePointerDown,
  handleClipPointerDown,
  handleTrimPointerDown
}) => {
  const leftHeadersScrollRef = useRef<HTMLDivElement>(null);
  const rightTracksScrollRef = useRef<HTMLDivElement>(null);

  const handleTracksScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (leftHeadersScrollRef.current) {
      leftHeadersScrollRef.current.scrollTop = e.currentTarget.scrollTop;
    }
  };

  const rulerTicks = useMemo(() => {
    const total = Math.max(5, Math.ceil(duration || 83));
    let step = 5;
    if (total <= 20) step = 2;
    else if (total <= 60) step = 5;
    else if (total <= 120) step = 10;
    else step = 20;

    const ticks: Array<{ sec: number; label: string; pct: number }> = [];
    for (let s = 0; s <= total; s += step) {
      const mins = Math.floor(s / 60);
      const secs = s % 60;
      const label = mins.toString().padStart(2, '0') + ':' + secs.toString().padStart(2, '0');
      ticks.push({ sec: s, label, pct: (s / total) * 100 });
    }
    if (ticks.length > 0 && ticks[ticks.length - 1].pct < 98) {
      const mins = Math.floor(total / 60);
      const secs = total % 60;
      ticks.push({ sec: total, label: mins.toString().padStart(2, '0') + ':' + secs.toString().padStart(2, '0'), pct: 100 });
    }
    return ticks;
  }, [duration]);

  return (
          <div className="flex-1 md:h-64 lg:h-80 min-h-[170px] bg-[#18191c] flex flex-col border-t border-[#26282d] shrink-0 select-none overflow-hidden">

            {/* Timeline Tools Toolbar (Undo, Redo, Split ][, Delete, Snapping, Zoom Slider, Add Track buttons) */}
            <div className="h-9 px-2 sm:px-4 bg-[#18191c] border-b border-[#26282d] flex items-center justify-between shrink-0 text-slate-400 text-xs">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleUndo}
                  disabled={historyIndex <= 0}
                  className={`p-1.5 rounded transition-colors cursor-pointer ${historyIndex > 0 ? 'hover:bg-[#26282d] hover:text-white text-slate-300' : 'text-slate-600 cursor-not-allowed'
                    }`}
                  title={editorT.timeline.undo}
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={handleRedo}
                  disabled={historyIndex >= history.length - 1}
                  className={`p-1.5 rounded transition-colors cursor-pointer ${historyIndex < history.length - 1 ? 'hover:bg-[#26282d] hover:text-white text-slate-300' : 'text-slate-600 cursor-not-allowed'
                    }`}
                  title={editorT.timeline.redo}
                >
                  <RotateCw className="w-3.5 h-3.5" />
                </button>

                <div className="h-3.5 w-px bg-[#30333a] mx-1" />

                {/* Split Clip Button `][` like CapCut */}
                <button
                  type="button"
                  onClick={handleSplitClip}
                  className="px-2 py-1 rounded hover:bg-[#26282d] hover:text-white flex items-center gap-1 font-mono font-bold text-xs text-slate-300 cursor-pointer"
                  title={editorT.timeline.split}
                >
                  <span>][</span>
                  <span className="hidden sm:inline font-sans text-[11px] font-normal">{editorT.timeline.split}</span>
                </button>

                {/* Delete Button */}
                <button
                  type="button"
                  onClick={handleDelete}
                  className="p-1.5 rounded hover:bg-rose-500/20 hover:text-rose-400 text-slate-400 transition-colors cursor-pointer"
                  title={`${editorT.timeline.delete} (Del)`}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>

                {/* Feature 5: Ripple Delete Button (Deletes & closes gap) */}
                <button
                  type="button"
                  onClick={handleRippleDelete}
                  className={`px-2 py-0.5 rounded flex items-center gap-1 text-[11px] font-medium cursor-pointer transition-all border ${rippleMode ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 hover:bg-amber-500/30' : 'bg-[#1e2330] text-slate-400 border-[#30333a] hover:text-white'}`}
                  title="Ripple Delete: Klip o'chirilganda keyingi barcha kliplarni bo'shliqsiz chapga surish"
                >
                  <Trash2 className="w-3 h-3 text-amber-400" />
                  <span className="hidden sm:inline">Ripple Del</span>
                </button>

                {/* Auto-Ripple Toggle */}
                <button
                  type="button"
                  onClick={() => setRippleMode(prev => !prev)}
                  className={`px-1.5 py-0.5 rounded text-[10px] font-mono cursor-pointer border ${rippleMode ? 'bg-amber-500/10 text-amber-300 border-amber-500/30' : 'bg-transparent text-slate-500 border-transparent hover:text-slate-400'}`}
                  title="Bo'shliqsiz avtomatik ulash rejimi (Auto-Ripple)"
                >
                  Auto-Ripple: {rippleMode ? 'ON' : 'OFF'}
                </button>

                {/* Quick Add Track Buttons */}
                <div className="h-3.5 w-px bg-[#30333a] mx-1 hidden sm:block" />
                {/* Feature 2: Add Subtitle / Text Track Item */}
                <button
                  type="button"
                  onClick={() => {
                    const newText: TextClipItem = {
                      id: `text-${Date.now()}`,
                      text: 'Yangi matn',
                      start: currentTime,
                      end: Math.min(duration, currentTime + 3.5),
                      fontSize: 32,
                      fontColor: '#FFFFFF',
                      bgColor: 'dark',
                      position: 'bottom'
                    };
                    setTextClips(prev => [...prev, newText]);
                    setSelectedTextClipId(newText.id);
                    setLeftNavTab('text');
                  }}
                  className="px-2 py-0.5 rounded bg-[#2b1f3d] hover:bg-[#392952] text-fuchsia-300 border border-fuchsia-500/30 flex items-center gap-1 text-[11px] font-medium cursor-pointer transition-colors"
                  title="Playhead joyiga yangi matn / subtitr qo'shish"
                >
                  <Type className="w-3 h-3 text-fuchsia-400" />
                  <span>+ Matn</span>
                </button>
                <button
                  type="button"
                  onClick={addVideoTrack}
                  className="px-2 py-0.5 rounded bg-[#1e2330] hover:bg-[#282f42] text-teal-300 border border-teal-500/30 hidden md:flex items-center gap-1 text-[11px] font-medium cursor-pointer transition-colors"
                  title="Yangi video track qo'shish"
                >
                  <Plus className="w-3 h-3 text-teal-400" />
                  <span>+ Video Track</span>
                </button>
                <button
                  type="button"
                  onClick={addAudioTrack}
                  className="px-2 py-0.5 rounded bg-[#1e2330] hover:bg-[#282f42] text-sky-300 border border-sky-500/30 hidden md:flex items-center gap-1 text-[11px] font-medium cursor-pointer transition-colors"
                  title="Yangi audio track qo'shish"
                >
                  <Plus className="w-3 h-3 text-sky-400" />
                  <span>+ Audio Track</span>
                </button>

                {/* Precision Trim Bar for Selected Clip or Audio */}
                {(selectedClipId || selectedAudioClipId) && (
                  <>
                    <div className="h-3.5 w-px bg-[#30333a] mx-1 hidden md:block" />
                    <div className="hidden lg:flex items-center gap-1.5 text-[11px] bg-[#141720] px-2 py-0.5 rounded-lg border border-[#2a2e3d]">
                      <span className="font-semibold text-teal-300 flex items-center gap-1">
                        {selectedAudioClipId ? <Music className="w-3 h-3 text-sky-400" /> : <Film className="w-3 h-3 text-teal-400" />}
                        {selectedAudioClipId ? editorT.audioPanel.bgmAudio : editorT.audioPanel.videoAudio}
                      </span>

                      {/* Trim Start Controls */}
                      <span className="text-slate-400 ml-1">{editorT.timeline.trimLeftHandle}</span>
                      <button
                        type="button"
                        onClick={() => trimSelectedClipDelta('start', -0.5)}
                        className="px-1.5 py-0.5 bg-[#202533] hover:bg-[#2c3347] text-slate-200 rounded text-[10px] font-mono cursor-pointer"
                        title={editorT.timeline.trimLeftHandle}
                      >
                        -0.5s
                      </button>
                      <button
                        type="button"
                        onClick={() => trimSelectedClipDelta('start', 0.5)}
                        className="px-1.5 py-0.5 bg-[#202533] hover:bg-[#2c3347] text-slate-200 rounded text-[10px] font-mono cursor-pointer"
                        title={editorT.timeline.trimLeftHandle}
                      >
                        +0.5s
                      </button>
                      <button
                        type="button"
                        onClick={() => trimSelectedClipToPlayhead('start')}
                        className="px-1.5 py-0.5 bg-teal-500/20 hover:bg-teal-500/30 text-teal-300 rounded text-[10px] cursor-pointer"
                        title={editorT.timeline.trimLeftHandle}
                      >
                        [| Playhead
                      </button>

                      {/* Trim End Controls */}
                      <span className="text-slate-400 ml-2">{editorT.timeline.trimRightHandle}</span>
                      <button
                        type="button"
                        onClick={() => trimSelectedClipDelta('end', -0.5)}
                        className="px-1.5 py-0.5 bg-[#202533] hover:bg-[#2c3347] text-slate-200 rounded text-[10px] font-mono cursor-pointer"
                        title={editorT.timeline.trimRightHandle}
                      >
                        -0.5s
                      </button>
                      <button
                        type="button"
                        onClick={() => trimSelectedClipDelta('end', 0.5)}
                        className="px-1.5 py-0.5 bg-[#202533] hover:bg-[#2c3347] text-slate-200 rounded text-[10px] font-mono cursor-pointer"
                        title={editorT.timeline.trimRightHandle}
                      >
                        +0.5s
                      </button>
                      <button
                        type="button"
                        onClick={() => trimSelectedClipToPlayhead('end')}
                        className="px-1.5 py-0.5 bg-teal-500/20 hover:bg-teal-500/30 text-teal-300 rounded text-[10px] cursor-pointer"
                        title={editorT.timeline.trimRightHandle}
                      >
                        |] Playhead
                      </button>
                    </div>
                  </>
                )}
              </div>

              {/* Right: Snapping & Zoom Slider */}
              <div className="flex items-center gap-2 sm:gap-3">
                {/* Magnetic Snap All Clips (Close Gaps) */}
                {clips.length > 1 && (
                  <button
                    type="button"
                    onClick={() => {
                      setClips(prev => {
                        let cur = prev[0]?.start ?? 0;
                        return prev.map(c => {
                          const len = c.end - c.start;
                          const s = cur;
                          const e = cur + len;
                          cur = e;
                          return { ...c, start: s, end: e };
                        });
                      });
                    }}
                    className="px-1.5 py-0.5 rounded bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1 text-[10px] font-medium cursor-pointer transition-colors"
                    title="Barcha bo'shliqlarni yopish (Birlashtirib ulab qo'yish)"
                  >
                    <Magnet className="w-2.5 h-2.5 text-amber-400" />
                    <span className="hidden md:inline">Ulab qo'yish</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setSnappingEnabled(!snappingEnabled)}
                  className={`px-2 py-0.5 rounded text-[11px] font-semibold border transition-all cursor-pointer flex items-center gap-1 ${snappingEnabled ? 'border-[#00c5d4] text-[#00c5d4] bg-[#00c5d4]/10 shadow-[0_0_10px_rgba(0,197,212,0.25)]' : 'border-slate-700 text-slate-400 hover:text-slate-200'
                    }`}
                  title="Magnitli yopishish (Magnetic Snapping) ON/OFF"
                >
                  <Magnet className="w-3 h-3" />
                  <span>{editorT.timeline.snapping || 'Magnit'}: {snappingEnabled ? 'ON' : 'OFF'}</span>
                </button>

                {/* Audio Waveform Toggle */}
                <button
                  type="button"
                  onClick={() => setShowAudioWaveforms(prev => !prev)}
                  className={`px-2 py-0.5 rounded text-[11px] font-semibold border transition-all cursor-pointer flex items-center gap-1 ${
                    showAudioWaveforms
                      ? 'border-[#38bdf8] text-[#38bdf8] bg-[#38bdf8]/10 shadow-[0_0_10px_rgba(56,189,248,0.25)]'
                      : 'border-slate-700 text-slate-400 hover:text-slate-200'
                  }`}
                  title="Audio to'lqin shakli (Waveform) ON/OFF"
                >
                  <Activity className="w-3 h-3" />
                  <span className="hidden xs:inline">To'lqin:</span>
                  <span>{showAudioWaveforms ? 'ON' : 'OFF'}</span>
                </button>

                <div className="flex items-center gap-2">
                  <ZoomOut className="w-3 h-3 text-slate-500" />
                  <input
                    type="range"
                    min={10}
                    max={100}
                    value={timelineZoom}
                    onChange={(e) => setTimelineZoom(parseInt(e.target.value))}
                    className="w-20 sm:w-28 accent-[#00c5d4] cursor-pointer h-1 bg-slate-800 rounded-lg"
                  />
                  <ZoomIn className="w-3 h-3 text-slate-500" />
                </div>
              </div>
            </div>

            {/* Main Timeline Row: Left Track Headers (w-28 sm:w-36) + Right Scrollable Tracks Area */}
            <div className="flex-1 flex overflow-hidden">

              {/* Left Track Headers (Responsive w-20 sm:w-28 md:w-36) */}
              <div className="w-20 sm:w-28 md:w-36 bg-[#141720] border-r border-[#26282d] flex flex-col shrink-0 overflow-hidden">
                {/* Header aligned with ruler */}
                <div className="h-7 border-b border-[#222733] px-2 flex items-center justify-between text-[10px] text-slate-400 font-mono shrink-0">
                  <span className="font-semibold text-slate-300">TRACKS</span>
                  <div className="flex items-center gap-1 text-[9px]">
                    <span className="text-teal-400">V:{videoTracks.length}</span>
                    <span className="text-slate-600">|</span>
                    <span className="text-sky-400">A:{audioTracks.length}</span>
                  </div>
                </div>

                {/* Track Headers Container (Synchronized vertical scroll) */}
                <div ref={leftHeadersScrollRef} className="flex-1 p-2 space-y-2 overflow-y-hidden">
                  {/* Feature 2: Text / Subtitle Track Header */}
                  <div
                    className="h-10 rounded-xl border px-2 py-1 flex items-center justify-between transition-colors bg-[#0e1017] border-[#1b1f2b] hover:border-fuchsia-900/60"
                  >
                    <div className="flex items-center gap-1.5 min-w-0">
                      <Type className="w-3 h-3 text-fuchsia-400 shrink-0" />
                      <div className="flex flex-col min-w-0">
                        <span className="text-[11px] font-semibold text-slate-200 truncate">Matn / Subtitr</span>
                        <span className="text-[8px] font-mono text-fuchsia-400">T1</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const newText: TextClipItem = {
                          id: `text-${Date.now()}`,
                          text: 'Yangi matn',
                          start: currentTime,
                          end: Math.min(duration, currentTime + 3.5),
                          fontSize: 32,
                          fontColor: '#FFFFFF',
                          bgColor: 'dark',
                          position: 'bottom'
                        };
                        setTextClips(prev => [...prev, newText]);
                        setSelectedTextClipId(newText.id);
                        setLeftNavTab('text');
                        setIsAssetDrawerOpen(true);
                      }}
                      className="p-1 hover:text-fuchsia-300 cursor-pointer transition-colors rounded hover:bg-fuchsia-950/40 text-slate-400"
                      title="Playhead joyiga matn qo'shish"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>

                  {/* Video Track Headers */}
                  {videoTracks.map((track, trackIdx) => (
                    <div
                      key={track.id}
                      className={`h-16 rounded-xl border p-1.5 flex flex-col justify-between transition-colors ${
                        track.hidden
                          ? 'bg-[#0f1118]/60 border-slate-800 opacity-60'
                          : 'bg-[#0e1017] border-[#1b1f2b] hover:border-teal-900/60'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <div className="flex items-center gap-1 min-w-0">
                          <Film className="w-3 h-3 text-teal-400 shrink-0" />
                          <span className="text-[11px] font-semibold text-slate-200 truncate">{track.name}</span>
                        </div>
                        <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-teal-950/80 text-teal-300 shrink-0">
                          V{trackIdx + 1}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-slate-400">
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => toggleVideoTrackHide(track.id)}
                            className="p-1 hover:text-white cursor-pointer transition-colors rounded hover:bg-slate-800"
                            title={track.hidden ? editorT.timeline.showTrack : editorT.timeline.hideTrack}
                          >
                            {track.hidden ? <EyeOff className="w-3 h-3 text-rose-400" /> : <Eye className="w-3 h-3" />}
                          </button>
                          <button
                            type="button"
                            onClick={() => toggleVideoTrackMute(track.id)}
                            className="p-1 hover:text-white cursor-pointer transition-colors rounded hover:bg-slate-800"
                            title={track.muted ? editorT.timeline.unmuteTrack : editorT.timeline.muteTrack}
                          >
                            {track.muted ? <VolumeX className="w-3 h-3 text-rose-400" /> : <Volume2 className="w-3 h-3" />}
                          </button>
                        </div>
                        {videoTracks.length > 1 && (
                          <button
                            type="button"
                            onClick={() => deleteVideoTrack(track.id)}
                            className="p-1 hover:text-rose-400 cursor-pointer transition-colors rounded hover:bg-rose-950/40 text-slate-500"
                            title="Trackni o'chirish"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}

                  {/* Audio Track Headers */}
                  {audioTracks.map((track, trackIdx) => (
                    <div
                      key={track.id}
                      className={`h-12 rounded-xl border px-2 py-1 flex items-center justify-between transition-colors ${
                        track.muted
                          ? 'bg-[#0f1118]/60 border-slate-800 opacity-60'
                          : 'bg-[#0e1017] border-[#1b1f2b] hover:border-sky-900/60'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 min-w-0">
                        <Music className="w-3 h-3 text-sky-400 shrink-0" />
                        <div className="flex flex-col min-w-0">
                          <span className="text-[11px] font-semibold text-slate-200 truncate">{track.name}</span>
                          <span className="text-[8px] font-mono text-sky-400">A{trackIdx + 1}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => toggleAudioTrackMute(track.id)}
                          className="p-1 hover:text-white cursor-pointer transition-colors rounded hover:bg-slate-800 text-slate-400"
                          title={track.muted ? editorT.timeline.unmuteTrack : editorT.timeline.muteTrack}
                        >
                          {track.muted ? <VolumeX className="w-3 h-3 text-rose-400" /> : <Volume2 className="w-3 h-3" />}
                        </button>
                        {audioTracks.length > 1 && (
                          <button
                            type="button"
                            onClick={() => deleteAudioTrack(track.id)}
                            className="p-1 hover:text-rose-400 cursor-pointer transition-colors rounded hover:bg-rose-950/40 text-slate-500"
                            title="Audio trackni o'chirish"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Right Tracks & Ruler Area (Shares exact coordinate space & pointer events) */}
              <div
                ref={timelineTracksRef}
                onPointerDown={handleTimelinePointerDown}
                className="flex-1 flex flex-col relative overflow-x-auto select-none cursor-default bg-[#141720]/50"
              >
                {/* Ruler Row with real calculated timecodes */}
                <div style={{ minWidth: `${(timelineZoom / 50) * 100}%` }} className="flex flex-col flex-1 h-full origin-left">
                  <div className="h-7 border-b border-[#222733] bg-[#141720] relative shrink-0 cursor-pointer overflow-hidden">
                    {rulerTicks.map(tick => (
                      <div
                        key={tick.sec}
                        className="absolute top-0 bottom-0 -translate-x-1/2 flex flex-col items-center pointer-events-none"
                        style={{ left: `${tick.pct}%` }}
                      >
                        <span className="font-mono text-[9px] text-slate-400 leading-none pt-1 select-none">{tick.label}</span>
                        <div className="w-px h-1.5 bg-slate-600 mt-auto" />
                      </div>
                    ))}
                  </div>

                  {/* Tracks Rows Container (Vertically scrollable & synced with left headers) */}
                  <div
                    ref={rightTracksScrollRef}
                    onScroll={handleTracksScroll}
                    className="flex-1 p-2 space-y-2 relative overflow-y-auto"
                  >

                  {/* Feature 2: TEXT / SUBTITLE TRACK LANE */}
                  <div
                    className="h-10 relative w-full rounded-xl bg-[#0e1017] border border-[#1b1f2b] transition-colors overflow-hidden"
                  >
                    {textClips.length === 0 ? (
                      <div
                        onClick={() => {
                          const newText: TextClipItem = {
                            id: `text-${Date.now()}`,
                            text: 'Salom Dunyo!',
                            start: currentTime,
                            end: Math.min(duration, currentTime + 3.5),
                            fontSize: 32,
                            fontColor: '#FFFFFF',
                            bgColor: 'dark',
                            position: 'bottom'
                          };
                          setTextClips(prev => [...prev, newText]);
                          setSelectedTextClipId(newText.id);
                          setLeftNavTab('text');
                          setIsAssetDrawerOpen(true);
                        }}
                        className="w-full h-full flex items-center justify-center gap-2 text-slate-500 hover:text-fuchsia-300 hover:bg-[#1f152b]/30 transition-colors cursor-pointer text-xs font-medium"
                      >
                        <Type className="w-3 h-3 text-fuchsia-400" />
                        <span>Matn / Subtitr qo'shish (+ Matn)</span>
                      </div>
                    ) : (
                      textClips.map((tClip) => {
                        const isSelected = selectedTextClipId === tClip.id;
                        const tDur = Math.max(0.1, tClip.end - tClip.start);
                        const totalDur = Math.max(1, duration || 83);
                        const leftPct = (tClip.start / totalDur) * 100;
                        const widthPct = Math.max(2, (tDur / totalDur) * 100);
                        const isActive = currentTime >= tClip.start && currentTime <= tClip.end;

                        return (
                          <div
                            key={tClip.id}
                            style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
                            onPointerDown={(e) => handleClipPointerDown(e, tClip.id, 'text')}
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedTextClipId(tClip.id);
                              setLeftNavTab('text');
                              setIsAssetDrawerOpen(true);
                            }}
                            className={`timeline-clip absolute top-0 bottom-0 rounded-lg overflow-hidden flex items-center justify-between px-2 shadow-md select-none group cursor-pointer transition-all duration-200 ${
                              isSelected
                                ? 'bg-[#3b1d54] border-2 border-yellow-400 shadow-[0_0_20px_4px_rgba(250,204,21,0.5)] z-30'
                                : isActive
                                  ? 'bg-[#2f1742] border-2 border-fuchsia-400 shadow-[0_0_10px_2px_rgba(232,121,249,0.3)] z-20'
                                  : 'bg-[#221230] border border-fuchsia-700/60 hover:border-fuchsia-500 z-10'
                            }`}
                          >
                            <div className="flex items-center gap-1.5 min-w-0">
                              <Type className="w-3 h-3 text-fuchsia-300 shrink-0" />
                              <span className="text-[10px] font-bold text-white truncate max-w-[130px] drop-shadow">
                                {tClip.text}
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <span className="font-mono text-[8px] bg-black/50 px-1 py-0.5 rounded text-fuchsia-200 pointer-events-none">
                                {formatShortDuration(tDur)}
                              </span>
                              {isSelected && (
                                <button
                                  type="button"
                                  onPointerDown={(ev) => ev.stopPropagation()}
                                  onClick={(ev) => {
                                    ev.stopPropagation();
                                    setTextClips(prev => prev.filter(t => t.id !== tClip.id));
                                    setSelectedTextClipId(null);
                                  }}
                                  className="px-1.5 py-0.5 rounded bg-rose-500 hover:bg-rose-600 text-white text-[9px] font-bold cursor-pointer"
                                  title="O'chirish"
                                >
                                  ✕
                                </button>
                              )}
                            </div>

                            {/* Left trim handle */}
                            <div
                              onPointerDown={(e) => handleTrimPointerDown(e, tClip.id, 'start', 'text')}
                              className="trim-handle absolute left-0 top-0 bottom-0 w-2.5 bg-fuchsia-400 hover:bg-white cursor-ew-resize z-30 rounded-l"
                              title="Boshlanishini qisqartirish/cho'zish"
                            />
                            {/* Right trim handle */}
                            <div
                              onPointerDown={(e) => handleTrimPointerDown(e, tClip.id, 'end', 'text')}
                              className="trim-handle absolute right-0 top-0 bottom-0 w-2.5 bg-fuchsia-400 hover:bg-white cursor-ew-resize z-30 rounded-r"
                              title="Tugashini qisqartirish/cho'zish"
                            />
                          </div>
                        );
                      })
                    )}
                  </div>

                  {/* VIDEO TRACKS: Each video file has its own lane */}
                  {videoTracks.map((track, trackIdx) => {
                    const trackClips = clips.filter(c => c.trackId === track.id || (!c.trackId && trackIdx === 0));
                    return (
                      <div
                        key={track.id}
                        className={`h-16 relative w-full rounded-xl bg-[#0e1017] border transition-colors overflow-hidden ${
                          track.hidden ? 'border-slate-800 opacity-50' : 'border-[#1b1f2b]'
                        }`}
                      >
                        {trackClips.length === 0 ? (
                          <div
                            onClick={handleUploadClick}
                            className="w-full h-full flex items-center justify-center gap-2 text-slate-500 hover:text-teal-300 hover:bg-[#131724] transition-colors cursor-pointer text-xs font-semibold"
                          >
                            <Upload className="w-3.5 h-3.5" />
                            <span>{track.name}: {editorT.mediaDrawer.dragDropHint}</span>
                          </div>
                        ) : (
                          trackClips.map((clip, idx) => {
                            const isSelected = selectedClipId === clip.id;
                            const clipDur = Math.max(0.1, clip.end - clip.start);
                            const totalDur = Math.max(1, duration || 83);
                            const leftPct = (clip.start / totalDur) * 100;
                            const widthPct = Math.max(2, (clipDur / totalDur) * 100);
                            const isActive = currentTime >= clip.start && currentTime <= clip.end;

                            return (
                              <React.Fragment key={clip.id}>
                                <div
                                  style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
                                  onPointerDown={(e) => handleClipPointerDown(e, clip.id, 'video')}
                                  className={`timeline-clip absolute top-0 bottom-0 rounded-xl overflow-hidden flex flex-col justify-between p-1.5 shadow-md select-none group cursor-pointer transition-all duration-200 ${
                                    isSelected
                                      ? 'bg-[#18525a] border-2 border-yellow-400 shadow-[0_0_22px_5px_rgba(250,204,21,0.55)] z-30'
                                      : isActive
                                        ? 'bg-[#14444a] border-2 border-emerald-400/80 shadow-[0_0_10px_2px_rgba(52,211,153,0.3)] z-20'
                                        : 'bg-[#14444a] border border-[#207c87] hover:border-[#00c5d4]/60 z-10'
                                  }`}
                                >
                                  {/* Yellow shimmer sweep when selected */}
                                  {isSelected && (
                                    <div className="clip-shimmer-sweep absolute inset-0 pointer-events-none z-20" style={{
                                      background: 'linear-gradient(105deg, transparent 30%, rgba(250,204,21,0.3) 50%, transparent 70%)',
                                      width: '60%',
                                    }} />
                                  )}
                                  {/* Top Clip Info */}
                                  <div className="flex items-center justify-between text-[11px] font-bold text-white z-10 pl-3 pr-3">
                                    <div className="flex items-center gap-1 min-w-0">
                                      <span className="truncate max-w-[120px] drop-shadow-sm pointer-events-none">{clip.name}</span>
                                      {clip.transitionIn && clip.transitionIn !== 'none' && (
                                        <span className="text-[8px] font-mono bg-amber-400 text-slate-950 px-1 rounded font-bold shrink-0">
                                          ⧖ {clip.transitionIn}
                                        </span>
                                      )}
                                      {(clip.filterPreset || clip.brightness !== undefined) && (
                                        <span className="text-[8px] font-mono bg-teal-300 text-slate-950 px-1 rounded font-bold shrink-0">
                                          🎨
                                        </span>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                      <button
                                        type="button"
                                        onPointerDown={(ev) => ev.stopPropagation()}
                                        onClick={(ev) => {
                                          ev.stopPropagation();
                                          updateClip(clip.id, { muted: !clip.muted });
                                        }}
                                        className={`pointer-events-auto px-1.5 py-0.5 rounded text-[9px] font-bold flex items-center gap-0.5 cursor-pointer transition-colors ${
                                          clip.muted
                                            ? 'bg-rose-500 text-white'
                                            : (clip.volume !== undefined && clip.volume > 100)
                                              ? 'bg-amber-500 text-slate-950'
                                              : 'bg-slate-950/70 hover:bg-slate-900 text-teal-200'
                                        }`}
                                        title={clip.muted ? "Ovoz o'chirilgan (Unmute)" : `Ovoz: ${clip.volume ?? 100}%`}
                                      >
                                        {clip.muted ? <VolumeX className="w-2.5 h-2.5" /> : <Volume2 className="w-2.5 h-2.5" />}
                                        <span>{clip.muted ? '0%' : `${clip.volume ?? 100}%`}</span>
                                      </button>
                                      <span className="font-mono text-[9px] bg-slate-950/70 px-1.5 py-0.5 rounded text-teal-200 pointer-events-none">
                                        {formatShortDuration(clipDur)}
                                      </span>
                                    </div>
                                  </div>

                                  {/* Filmstrip styling repeating across entire clip */}
                                  <div className="absolute inset-0 flex opacity-25 pointer-events-none overflow-hidden">
                                    {Array.from({ length: 30 }).map((_, fIdx) => (
                                      <div
                                        key={fIdx}
                                        className="h-full w-14 bg-teal-950/60 border-r border-teal-500/20 shrink-0 flex items-center justify-center"
                                      >
                                        <Film className="w-4 h-4 text-teal-300/40" />
                                      </div>
                                    ))}
                                  </div>

                                  {/* Audio Waveform on Video Clip (Bottom half of lane) */}
                                  {showAudioWaveforms && (
                                    <div className="absolute left-0 right-0 bottom-0 h-6 opacity-65 pointer-events-none z-5 overflow-hidden">
                                      <AudioWaveform
                                        audioUrl={clip.url || video?.url}
                                        assetId={clip.assetId}
                                        offset={clip.offset || 0}
                                        clipDuration={clipDur}
                                        sourceDuration={clip.sourceDuration || getVideoClipSourceDuration(clip)}
                                        volume={clip.volume ?? 100}
                                        muted={Boolean(clip.muted || isVideoAudioMuted || settings.removeAudio)}
                                        color="#2dd4bf"
                                        secondaryColor="#0d9488"
                                        mirrored={false}
                                      />
                                    </div>
                                  )}

                                  {/* Bottom Info & Delete button */}
                                  <div className="z-10 flex items-center justify-between text-[9px] text-teal-200 pl-3 pr-3 pointer-events-none">
                                    <span className="bg-slate-950/60 px-1.5 py-0.5 rounded">#{idx + 1} ({track.name})</span>
                                    {isSelected && (
                                      <button
                                        type="button"
                                        onPointerDown={(ev) => ev.stopPropagation()}
                                        onClick={(ev) => {
                                          ev.stopPropagation();
                                          setClips(prev => prev.filter(c => c.id !== clip.id));
                                          setSelectedClipId('');
                                        }}
                                        className="pointer-events-auto px-1.5 py-0.5 rounded bg-rose-500 hover:bg-rose-600 text-white font-bold cursor-pointer transition-colors shadow"
                                        title={editorT.timeline.delete}
                                      >
                                        ✕
                                      </button>
                                    )}
                                  </div>

                                  {/* Left Trim Handle */}
                                  <TrimHandle
                                    side="start"
                                    color="#00c5d4"
                                    onPointerDown={(e) => handleTrimPointerDown(e, clip.id, 'start', 'video')}
                                    title={editorT.timeline.trimLeftHandle}
                                  />

                                  {/* Right Trim Handle */}
                                  <TrimHandle
                                    side="end"
                                    color="#00c5d4"
                                    onPointerDown={(e) => handleTrimPointerDown(e, clip.id, 'end', 'video')}
                                    title={editorT.timeline.trimRightHandle}
                                  />
                                </div>

                                {/* Feature 1: Transition Marker Button between adjacent clips */}
                                {idx < trackClips.length - 1 && (
                                  <button
                                    type="button"
                                    onPointerDown={(e) => e.stopPropagation()}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      const nextClip = trackClips[idx + 1];
                                      setTransitionPickerClipId(nextClip.id);
                                      setSelectedClipId(nextClip.id);
                                      setLeftNavTab('transitions');
                                      setIsAssetDrawerOpen(true);
                                    }}
                                    style={{ left: `calc(${leftPct + widthPct}% - 11px)` }}
                                    className={`absolute top-1/2 -translate-y-1/2 z-40 w-5 h-5 rounded-md flex items-center justify-center cursor-pointer transition-all shadow-lg border ${
                                      trackClips[idx + 1].transitionIn && trackClips[idx + 1].transitionIn !== 'none'
                                        ? 'bg-amber-400 border-amber-200 text-slate-950 font-bold scale-110 shadow-amber-400/40'
                                        : 'bg-[#181a24] border-[#3a3f52] text-slate-300 hover:border-amber-400 hover:text-white'
                                    }`}
                                    title={`O'tish effekti: ${trackClips[idx + 1].transitionIn || 'Yo\'q (None)'}. Tanlash uchun bosing`}
                                  >
                                    <span className="text-[10px] leading-none">⧖</span>
                                  </button>
                                )}
                              </React.Fragment>
                            );
                          })
                        )}
                      </div>
                    );
                  })}

                  {/* AUDIO TRACKS: Each audio/MP3 file has its own lane */}
                  {audioTracks.map((track, trackIdx) => {
                    const trackAudios = audioClips.filter(a => a.trackId === track.id || (!a.trackId && trackIdx === 0));
                    return (
                      <div
                        key={track.id}
                        className={`h-12 relative w-full rounded-xl bg-[#0e1017] border transition-colors overflow-hidden ${
                          track.muted ? 'border-slate-800 opacity-50' : 'border-[#1b1f2b]'
                        }`}
                      >
                        {trackAudios.length === 0 ? (
                          <div
                            onClick={handleAudioUploadClick}
                            className="w-full h-full flex items-center justify-center gap-2 text-slate-500 hover:text-sky-400 hover:bg-[#101726] transition-colors cursor-pointer text-xs font-semibold"
                          >
                            <Music className="w-3.5 h-3.5" />
                            <span>{track.name}: {editorT.audioPanel.noMusicSelected}</span>
                          </div>
                        ) : (
                          trackAudios.map((audio) => {
                            const isSelected = selectedAudioClipId === audio.id;
                            const audioDur = Math.max(0.1, audio.end - audio.start);
                            const totalDur = Math.max(1, duration || 83);
                            const leftPct = (audio.start / totalDur) * 100;
                            const widthPct = Math.max(2, (audioDur / totalDur) * 100);
                            const isActive = currentTime >= audio.start && currentTime <= audio.end;

                            return (
                              <div
                                key={audio.id}
                                style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
                                onPointerDown={(e) => handleClipPointerDown(e, audio.id, 'audio')}
                                className={`timeline-clip absolute top-0 bottom-0 rounded-xl overflow-hidden flex items-center justify-between px-2 shadow-md select-none group cursor-pointer transition-all duration-200 ${
                                  isSelected
                                    ? 'bg-[#1a3f68] border-2 border-yellow-400 shadow-[0_0_22px_5px_rgba(250,204,21,0.55)] z-30'
                                    : isActive
                                      ? 'bg-[#153150] border-2 border-sky-300/80 shadow-[0_0_10px_2px_rgba(125,211,252,0.3)] z-20'
                                      : 'bg-[#153150] border border-sky-600/70 hover:border-sky-400/80 z-10'
                                }`}
                              >
                                {/* Yellow shimmer sweep when selected */}
                                {isSelected && (
                                  <div className="clip-shimmer-sweep absolute inset-0 pointer-events-none z-20" style={{
                                    background: 'linear-gradient(105deg, transparent 30%, rgba(250,204,21,0.3) 50%, transparent 70%)',
                                    width: '60%',
                                  }} />
                                )}
                                {/* Audio Title & Duration */}
                                <div className="z-10 flex items-center justify-between text-[11px] font-bold text-sky-100 pl-3 pr-3 w-full">
                                  <div className="flex items-center gap-1.5 truncate pointer-events-none">
                                    <Music className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                                    <span className="truncate max-w-[130px] drop-shadow">{audio.name}</span>
                                  </div>
                                  <div className="flex items-center gap-1.5 shrink-0">
                                    <button
                                      type="button"
                                      onPointerDown={(ev) => ev.stopPropagation()}
                                      onClick={(ev) => {
                                        ev.stopPropagation();
                                        updateAudioClip(audio.id, { muted: !audio.muted });
                                      }}
                                      className={`pointer-events-auto px-1.5 py-0.5 rounded text-[9px] font-bold flex items-center gap-0.5 cursor-pointer transition-colors ${
                                        audio.muted
                                          ? 'bg-rose-500 text-white'
                                          : (audio.volume !== undefined && audio.volume > 100)
                                            ? 'bg-amber-500 text-slate-950'
                                            : 'bg-sky-950/80 hover:bg-sky-900 text-sky-200'
                                      }`}
                                      title={audio.muted ? "Ovoz o'chirilgan (Unmute)" : `Ovoz: ${audio.volume ?? 100}%`}
                                    >
                                      {audio.muted ? <VolumeX className="w-2.5 h-2.5" /> : <Volume2 className="w-2.5 h-2.5" />}
                                      <span>{audio.muted ? '0%' : `${audio.volume ?? 100}%`}</span>
                                    </button>
                                    <span className="font-mono text-[9px] text-sky-300 bg-sky-950/80 px-1.5 py-0.5 rounded pointer-events-none">
                                      {formatShortDuration(audioDur)}
                                    </span>
                                  </div>
                                </div>

                                {/* Real Audio Waveform Visualization */}
                                {showAudioWaveforms ? (
                                  <div className="absolute inset-0 px-2 pt-2.5 pb-1 opacity-70 pointer-events-none z-5 overflow-hidden">
                                    <AudioWaveform
                                      audioUrl={audio.url || settings.musicUrl}
                                      assetId={audio.assetId}
                                      offset={audio.offset || 0}
                                      clipDuration={audioDur}
                                      sourceDuration={audio.sourceDuration}
                                      volume={audio.volume ?? 100}
                                      muted={Boolean(audio.muted || track.muted)}
                                      color="#38bdf8"
                                      secondaryColor="#0284c7"
                                      fadeIn={audio.fadeIn}
                                      fadeInDuration={audio.fadeInDuration || 1.0}
                                      fadeOut={audio.fadeOut}
                                      fadeOutDuration={audio.fadeOutDuration || 1.0}
                                      mirrored={true}
                                    />
                                  </div>
                                ) : (
                                  <div className="absolute inset-0 flex items-center justify-around px-4 opacity-30 pointer-events-none">
                                    {Array.from({ length: 48 }).map((_, i) => (
                                      <div
                                        key={i}
                                        className="w-1 bg-sky-300 rounded-full"
                                        style={{
                                          height: `${Math.max(15, Math.sin(i * 0.45) * 80 + 20)}%`
                                        }}
                                      />
                                    ))}
                                  </div>
                                )}

                                {/* Feature 3: Visual Fade-In Triangle / Gradient Overlay */}
                                {audio.fadeIn && (
                                  <div
                                    className="absolute left-0 top-0 bottom-0 pointer-events-none z-15 bg-gradient-to-r from-black/80 to-transparent flex items-end pb-1 pl-1"
                                    style={{ width: `${Math.min(45, ((audio.fadeInDuration || 1.0) / audioDur) * 100)}%` }}
                                  >
                                    <span className="text-[7px] font-mono font-bold text-sky-300 bg-black/60 px-1 rounded">
                                      ▲ In {audio.fadeInDuration || 1}s
                                    </span>
                                  </div>
                                )}

                                {/* Feature 3: Visual Fade-Out Triangle / Gradient Overlay */}
                                {audio.fadeOut && (
                                  <div
                                    className="absolute right-0 top-0 bottom-0 pointer-events-none z-15 bg-gradient-to-l from-black/80 to-transparent flex items-end justify-end pb-1 pr-1"
                                    style={{ width: `${Math.min(45, ((audio.fadeOutDuration || 1.0) / audioDur) * 100)}%` }}
                                  >
                                    <span className="text-[7px] font-mono font-bold text-sky-300 bg-black/60 px-1 rounded">
                                      Out {audio.fadeOutDuration || 1}s ▲
                                    </span>
                                  </div>
                                )}

                                {/* Delete button if selected */}
                                {isSelected && (
                                  <button
                                    type="button"
                                    onPointerDown={(ev) => ev.stopPropagation()}
                                    onClick={(ev) => {
                                      ev.stopPropagation();
                                      setAudioClips(prev => prev.filter(a => a.id !== audio.id));
                                      setSelectedAudioClipId(null);
                                    }}
                                    className="z-10 pointer-events-auto mr-3 px-1.5 py-0.5 rounded bg-rose-500 hover:bg-rose-600 text-white text-[9px] font-bold cursor-pointer transition-colors shadow"
                                    title={editorT.timeline.delete}
                                  >
                                    ✕
                                  </button>
                                )}

                                {/* Left Trim Handle for Audio */}
                                <TrimHandle
                                  side="start"
                                  color="#38bdf8"
                                  onPointerDown={(e) => handleTrimPointerDown(e, audio.id, 'start', 'audio')}
                                  title={editorT.timeline.trimLeftHandle}
                                />

                                {/* Right Trim Handle for Audio */}
                                <TrimHandle
                                  side="end"
                                  color="#38bdf8"
                                  onPointerDown={(e) => handleTrimPointerDown(e, audio.id, 'end', 'audio')}
                                  title={editorT.timeline.trimRightHandle}
                                />
                              </div>
                            );
                          })
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Unified Playhead Needle (spanning from Ruler top across all tracks) */}
                <div
                  className="absolute top-0 bottom-0 w-[2px] bg-white z-30 pointer-events-none shadow-[0_0_8px_rgba(0,197,212,0.9)] will-change-[left]"
                  style={{
                    left: `${Math.min(99.5, Math.max(0, (currentTime / (duration || 83)) * 100))}%`
                  }}
                >
                  {/* Top needle marker cursor on ruler */}
                  <div
                    onPointerDown={handleTimelinePointerDown}
                    className="absolute top-0 left-1/2 -translate-x-1/2 flex flex-col items-center pointer-events-auto cursor-ew-resize active:scale-110 select-none"
                    title={editorT.player.timecode}
                  >
                    <div className="w-4 h-3.5 bg-white text-slate-900 rounded-t-sm shadow flex items-center justify-center">
                      <div className="w-1.5 h-1.5 bg-[#00c5d4] rounded-full" />
                    </div>
                    <div className="w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[6px] border-t-white" />
                  </div>
                </div>

                {/* Magnetic Snap Vertical Indicator Line with Floating Badge */}
                {activeSnapLine !== null && (
                  <div
                    className="absolute top-0 bottom-0 w-[2px] bg-amber-400 z-40 pointer-events-none shadow-[0_0_12px_rgba(251,191,36,0.95)]"
                    style={{
                      left: `${Math.min(99.8, Math.max(0, (activeSnapLine.time / (duration || 83)) * 100))}%`
                    }}
                  >
                    <div className="absolute top-1 left-1/2 -translate-x-1/2 bg-amber-400 text-slate-950 text-[9px] font-extrabold font-mono px-1.5 py-0.5 rounded shadow-lg flex items-center gap-1 whitespace-nowrap z-50 animate-in fade-in zoom-in-95 duration-75">
                      <Magnet className="w-2.5 h-2.5" />
                      <span>{activeSnapLine.label}: {formatShortDuration(activeSnapLine.time)}</span>
                    </div>
                  </div>
                )}

                {/* Active Trimming Feedback Badge (displays current clip length and original max duration limit) */}
                {activeTrimming && (
                  <div className="absolute top-2 right-4 z-50 pointer-events-none animate-in fade-in zoom-in-95 duration-100">
                    <div
                      className={`px-2.5 py-1 rounded-md text-[11px] font-bold font-mono shadow-xl flex items-center gap-1.5 border transition-all ${
                        activeTrimming.isAtMaxLimit
                          ? 'bg-rose-500/95 text-white border-rose-300 shadow-rose-500/40 animate-pulse'
                          : 'bg-slate-900/95 text-slate-100 border-slate-700 shadow-black/50'
                      }`}
                    >
                      {activeTrimming.isAtMaxLimit ? (
                        <span>Maksimal uzunlik: {formatShortDuration(activeTrimming.maxDuration)} (Original fayl chegarasi)</span>
                      ) : (
                        <span>
                          Davomiylik: {formatShortDuration(activeTrimming.currentDuration)} / maks. {formatShortDuration(activeTrimming.maxDuration)}
                        </span>
                      )}
                    </div>
                  </div>
                )}

              </div>
            </div>
          </div>
        </div>
  );
};
