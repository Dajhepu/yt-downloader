import React from 'react';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  ChevronDown,
  Camera,
  Maximize2,
  Upload,
  Plus,
  Keyboard
} from 'lucide-react';
import { EditorSettings, Language } from '../../types';
import { VideoEditorTranslationSchema } from '../../translations/videoEditorTranslations';
import { VideoClipItem, StickerItem, VideoThumbnailData } from './types';
import { formatCapCutTimecode } from './editorUtils';
import { StickerOverlay } from './StickerOverlay';

interface VideoPlayerMonitorProps {
  editorT: VideoEditorTranslationSchema;
  lang: Language | string;
  playerMonitorWrapperRef: React.RefObject<HTMLDivElement>;
  canvasPreviewRef: React.RefObject<HTMLCanvasElement>;
  clips: VideoClipItem[];
  selectedStickerId: string | null;
  setSelectedStickerId: (id: string | null) => void;
  togglePlay: () => void;
  handleUploadClick: () => void;
  stickers: StickerItem[];
  setStickers: React.Dispatch<React.SetStateAction<StickerItem[]>>;
  pushSettingsChange: (updater: (prev: EditorSettings) => EditorSettings) => void;
  currentTime: number;
  duration: number;
  canvasDisplaySize: { width: number; height: number };
  isPlaying: boolean;
  showOriginal: boolean;
  setShowOriginal: (val: boolean) => void;
  handleSeek: (time: number) => void;
  settings: EditorSettings;
  setShowThumbnailModal: (val: boolean) => void;
  videoThumbnail: VideoThumbnailData | null | string;
  setShowShortcutsModal?: (val: boolean) => void;
}

export const VideoPlayerMonitor: React.FC<VideoPlayerMonitorProps> = ({
  editorT,
  lang,
  playerMonitorWrapperRef,
  canvasPreviewRef,
  clips,
  selectedStickerId,
  setSelectedStickerId,
  togglePlay,
  handleUploadClick,
  stickers,
  setStickers,
  pushSettingsChange,
  currentTime,
  duration,
  canvasDisplaySize,
  isPlaying,
  showOriginal,
  setShowOriginal,
  handleSeek,
  settings,
  setShowThumbnailModal,
  videoThumbnail,
  setShowShortcutsModal
}) => {
  return (
    <>
      {/* Top Player Title Bar (Hidden on mobile to save vertical space) */}
      <div className="hidden md:flex h-8 px-4 items-center justify-between border-b border-[#26282d] bg-[#18191c] text-xs font-normal text-slate-400">
        <span>{editorT.landing.title}</span>
      </div>

      {/* Player Viewport (Canvas Video Monitor) */}
      <div
        ref={playerMonitorWrapperRef}
        className="h-[28vh] xs:h-[32vh] sm:h-[36vh] md:flex-1 md:min-h-[260px] relative flex items-center justify-center p-2 sm:p-5 overflow-hidden bg-[#121316] shrink-0"
      >
        <div className="relative inline-flex items-center justify-center max-w-full max-h-full">
          <canvas
            ref={canvasPreviewRef}
            onClick={clips.length > 0 ? (selectedStickerId ? () => setSelectedStickerId(null) : togglePlay) : handleUploadClick}
            className="max-w-full max-h-full rounded-md object-contain shadow-2xl cursor-pointer border border-[#26282d]"
          />

          {/* Interactive Sticker Layer (CapCut/Canva Style Draggable, Resizable, Rotatable) */}
          <StickerOverlay
            stickers={stickers}
            selectedStickerId={selectedStickerId}
            onSelectSticker={setSelectedStickerId}
            onUpdateSticker={(id, updates) => {
              setStickers(prev => {
                const next = prev.map(s => s.id === id ? { ...s, ...updates } : s);
                pushSettingsChange(ps => ({ ...ps, stickers: next }));
                return next;
              });
            }}
            onDeleteSticker={(id) => {
              setStickers(prev => {
                const next = prev.filter(s => s.id !== id);
                pushSettingsChange(ps => ({ ...ps, stickers: next }));
                return next;
              });
              if (selectedStickerId === id) setSelectedStickerId(null);
            }}
            onDuplicateSticker={(id) => {
              const target = stickers.find(s => s.id === id);
              if (target) {
                const copy: StickerItem = {
                  ...target,
                  id: `sticker_${Date.now()}_copy`,
                  x: Math.min(90, target.x + 4),
                  y: Math.min(90, target.y + 4),
                };
                setStickers(prev => {
                  const next = [...prev, copy];
                  pushSettingsChange(ps => ({ ...ps, stickers: next }));
                  return next;
                });
                setSelectedStickerId(copy.id);
              }
            }}
            currentTime={currentTime}
            width={canvasDisplaySize.width}
            height={canvasDisplaySize.height}
            isPlaying={isPlaying}
            lang={lang}
            t={editorT}
          />
        </div>

        {/* Empty workspace upload card when no video is loaded */}
        {clips.length === 0 && (
          <div className="absolute inset-0 m-auto flex flex-col items-center justify-center p-4 z-10 pointer-events-none">
            <div
              onClick={handleUploadClick}
              className="pointer-events-auto p-6 sm:p-8 rounded-2xl border-2 border-dashed border-[#2d3446] hover:border-[#00c5d4] bg-[#151822]/90 hover:bg-[#191f2d] transition-all cursor-pointer flex flex-col items-center max-w-sm w-full shadow-2xl text-center group"
            >
              <div className="w-12 h-12 rounded-2xl bg-[#00c5d4]/10 text-[#00c5d4] flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                <Upload className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold text-white mb-1">{editorT.mediaDrawer.importMedia}</h3>
              <p className="text-[11px] text-slate-400 mb-3 max-w-[220px]">
                {editorT.mediaDrawer.dragDropHint}
              </p>
              <span className="px-3.5 py-1.5 rounded-lg bg-[#00c5d4] text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow-md shadow-[#00c5d4]/20">
                <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                {editorT.mediaDrawer.addToTimeline}
              </span>
            </div>
          </div>
        )}

        {/* Big Play Overlay Icon when Paused and video exists (hidden when manipulating sticker) */}
        {!isPlaying && clips.length > 0 && !selectedStickerId && (
          <button
            type="button"
            onClick={togglePlay}
            className="absolute inset-0 m-auto w-12 h-12 rounded-full bg-black/60 hover:bg-black/80 text-white flex items-center justify-center shadow-xl backdrop-blur-sm transition-transform hover:scale-105 active:scale-95 cursor-pointer z-10"
            aria-label={editorT.player.play}
          >
            <Play className="w-5 h-5 fill-current ml-0.5" />
          </button>
        )}

        {/* Original Hold Notification */}
        {showOriginal && (
          <div className="absolute top-4 left-4 px-3 py-1 rounded-full bg-amber-500 text-slate-950 font-bold text-xs shadow-lg">
            {editorT.player.ratioOriginal}
          </div>
        )}
      </div>

      {/* Player Controls Deck (00:00:07:02 / 00:01:23:00, Play/Pause, 16:9, Fullscreen) */}
      <div className="h-9 sm:h-10 px-2 sm:px-4 bg-[#18191c] border-t border-b border-[#26282d] flex items-center justify-between shrink-0 text-xs select-none">
        {/* Left: Timecode */}
        <div className="flex items-center gap-1 font-mono text-[11px] sm:text-xs font-normal">
          <span className="text-[#00c5d4]">{formatCapCutTimecode(currentTime)}</span>
          <span className="text-slate-500">/</span>
          <span className="text-slate-300 hidden xs:inline">{formatCapCutTimecode(duration)}</span>
        </div>

        {/* Center: Play/Pause & Step Buttons */}
        <div className="flex items-center gap-1 sm:gap-2">
          <button
            type="button"
            onClick={() => handleSeek(Math.max(0, currentTime - 1))}
            className="p-1 sm:p-1.5 text-slate-400 hover:text-white transition-colors cursor-pointer"
            title={editorT.player.stepBack}
          >
            <SkipBack className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={togglePlay}
            className="p-1 sm:p-1.5 text-white hover:text-[#00c5d4] transition-colors cursor-pointer"
            title={isPlaying ? editorT.player.pause : editorT.player.play}
          >
            {isPlaying ? (
              <Pause className="w-4 h-4 fill-current" />
            ) : (
              <Play className="w-4 h-4 fill-current" />
            )}
          </button>

          <button
            type="button"
            onClick={() => handleSeek(Math.min(duration, currentTime + 1))}
            className="p-1 sm:p-1.5 text-slate-400 hover:text-white transition-colors cursor-pointer"
            title={editorT.player.stepForward}
          >
            <SkipForward className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Right: Aspect Ratio & Controls */}
        <div className="flex items-center gap-1.5 sm:gap-3">
          {/* Aspect Ratio Selector (16:9 ⌵) */}
          <div className="relative">
            <select
              value={settings.aspectRatio}
              onChange={(e) => pushSettingsChange(prev => ({ ...prev, aspectRatio: e.target.value as any }))}
              className="bg-[#26282d] hover:bg-[#30333a] border border-[#3a3e47] text-slate-200 text-[11px] sm:text-xs font-medium rounded px-2 sm:px-2.5 py-0.5 outline-none cursor-pointer appearance-none pr-5 sm:pr-6"
            >
              <option value="16:9">16:9</option>
              <option value="9:16">9:16</option>
              <option value="1:1">1:1</option>
              <option value="4:5">4:5</option>
              <option value="21:9">21:9</option>
            </select>
            <ChevronDown className="w-3 h-3 text-slate-400 absolute right-1 sm:right-1.5 top-1.5 pointer-events-none" />
          </div>

          {/* Video Thumbnail / Muqova Studio Trigger */}
          <button
            type="button"
            onClick={() => setShowThumbnailModal(true)}
            className={`flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-medium border transition-all cursor-pointer ${
              videoThumbnail
                ? 'border-[#00c5d4] bg-[#00c5d4]/15 text-[#00c5d4]'
                : 'border-[#3a3e47] text-slate-300 hover:text-white hover:bg-[#26282d]'
            }`}
            title={editorT.thumbnail?.btnTooltip || "Video Muqovasi (Thumbnail)"}
          >
            <Camera className="w-3.5 h-3.5" />
            <span className="hidden xs:inline">{editorT.thumbnail?.btnCover || "Muqova"}</span>
            {videoThumbnail && (
              <span className="w-1.5 h-1.5 rounded-full bg-[#00c5d4]" />
            )}
          </button>

          {/* Hold to Preview Original Button (Desktop / Tablet only) */}
          <button
            type="button"
            onMouseDown={() => setShowOriginal(true)}
            onMouseUp={() => setShowOriginal(false)}
            onTouchStart={() => setShowOriginal(true)}
            onTouchEnd={() => setShowOriginal(false)}
            className={`hidden sm:inline-flex px-2 py-0.5 rounded text-[11px] font-medium border transition-colors cursor-pointer select-none ${showOriginal
              ? 'border-amber-400 bg-amber-400/20 text-amber-300'
              : 'border-[#3a3e47] text-slate-400 hover:text-white hover:bg-[#26282d]'
              }`}
            title={editorT.player.ratioOriginal}
          >
            {editorT.player.ratioOriginal}
          </button>

          {/* Fullscreen Player Monitor */}
          <button
            type="button"
            onClick={() => {
              const target = playerMonitorWrapperRef.current || canvasPreviewRef.current;
              if (target) {
                if (document.fullscreenElement) {
                  document.exitFullscreen();
                } else {
                  target.requestFullscreen?.() || canvasPreviewRef.current?.requestFullscreen();
                }
              }
            }}
            className="p-1 rounded text-slate-400 hover:text-white hover:bg-[#26282d] transition-colors cursor-pointer"
            title={editorT.player.fullscreen}
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>

          {/* Keyboard Shortcuts Guide (Desktop / Tablet only) */}
          {setShowShortcutsModal && (
            <button
              type="button"
              onClick={() => setShowShortcutsModal(true)}
              className="hidden sm:inline-flex p-1 rounded text-slate-400 hover:text-white hover:bg-[#26282d] transition-colors cursor-pointer"
              title={editorT.timeline.shortcuts}
            >
              <Keyboard className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </>
  );
};
