import React, { useState, useRef, useEffect } from 'react';
import { VideoFile } from '../types';
import { TranslationSchema } from '../translations';
import { Maximize2, Download, CheckCircle2, RotateCw, FlipHorizontal, FlipVertical, Grid, Eye, Sparkles, Crop, Layers, Frame, AlertCircle, RefreshCw } from 'lucide-react';
import { VideoPlayerCard } from '../components/VideoPlayerCard';
import confetti from 'canvas-confetti';
import { processVideoResize } from '../lib/mediaProcessor';
import { memoryManager } from '../lib/memoryManager';
import { ShareResultButton } from '../components/ShareResultButton';

interface VideoResizerToolProps {
  video: VideoFile;
  onReset: () => void;
  t: TranslationSchema;
}

export const VideoResizerTool: React.FC<VideoResizerToolProps> = ({ video, onReset, t }) => {
  const [aspectRatio, setAspectRatio] = useState<'21:9' | '16:9' | '1:1' | '4:5' | '9:16'>('21:9');
  const [fitMode, setFitMode] = useState<'contain' | 'cover' | 'fill'>('contain');
  const [bgColor, setBgColor] = useState<'blur' | 'black' | 'white' | 'emerald'>('blur');
  const [rotation, setRotation] = useState<number>(0);
  const [flipH, setFlipH] = useState(false);
  const [flipV, setFlipV] = useState(false);
  const [showGrid, setShowGrid] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progressMsg, setProgressMsg] = useState('');
  const [resizedResult, setResizedResult] = useState<string | null>(null);
  const [resizeError, setResizeError] = useState<string | null>(null);

  const mainVideoRef = useRef<HTMLVideoElement>(null);
  const bgVideoRef = useRef<HTMLVideoElement>(null);

  // Sync backdrop blur video with main video player time
  const handleTimeUpdate = () => {
    if (mainVideoRef.current && bgVideoRef.current && bgColor === 'blur') {
      if (Math.abs(bgVideoRef.current.currentTime - mainVideoRef.current.currentTime) > 0.3) {
        bgVideoRef.current.currentTime = mainVideoRef.current.currentTime;
      }
    }
  };

  const handlePlay = () => {
    if (bgVideoRef.current && bgColor === 'blur') {
      bgVideoRef.current.play().catch(() => {});
    }
  };

  const handlePause = () => {
    if (bgVideoRef.current && bgColor === 'blur') {
      bgVideoRef.current.pause();
    }
  };

  const handleResize = async () => {
    setIsProcessing(true);
    setResizeError(null);
    setProgressMsg(t.resizer.action_resize || 'Rendering canvas framed video...');

    try {
      const blob = await processVideoResize(
        video.url,
        aspectRatio,
        fitMode,
        bgColor,
        rotation,
        flipH,
        flipV,
        false,
        (pct: number, msg: string) => setProgressMsg(msg)
      );

      if (resizedResult && resizedResult !== video.url) {
        memoryManager.safeRevokeObjectURL(resizedResult);
      }
      const resultUrl = memoryManager.safeCreateObjectURL(blob, 'resizer-result', true);
      setResizedResult(resultUrl);
      setIsProcessing(false);
      confetti({ particleCount: 70, spread: 60 });
    } catch (e) {
      setResizedResult(video.url);
      setIsProcessing(false);
    }
  };

  const aspectPresets = [
    { id: '21:9', label: '21:9 Ultrawide Cinema', dims: '2560 x 1080', ratio: '21 / 9', desc: 'Ultrawide monitors, Cinematic Movies', iconRatio: 'w-10 h-4' },
    { id: '16:9', label: '16:9 Widescreen', dims: '1920 x 1080', ratio: '16 / 9', desc: 'YouTube, TV, Standard Monitors', iconRatio: 'w-8 h-4.5' },
    { id: '1:1', label: '1:1 Square', dims: '1080 x 1080', ratio: '1 / 1', desc: 'Instagram Posts, Square Banners', iconRatio: 'w-6 h-6' },
    { id: '4:5', label: '4:5 Vertical Feed', dims: '1080 x 1350', ratio: '4 / 5', desc: 'Instagram Feed, Portrait Posts', iconRatio: 'w-5 h-6' },
    { id: '9:16', label: '9:16 Full Portrait', dims: '1080 x 1920', ratio: '9 / 16', desc: 'TikTok, Instagram Reels, Shorts', iconRatio: 'w-4.5 h-8' },
  ];

  const activePreset = aspectPresets.find(p => p.id === aspectRatio) || aspectPresets[0];

  return (
    <div className="w-full max-w-full space-y-6 lg:grid lg:grid-cols-12 lg:gap-8 lg:space-y-0 items-start">
      {/* Real-time Interactive Video Player & Canvas Preview */}
      <div className="lg:col-span-6 xl:col-span-7 space-y-6 lg:sticky lg:top-24">
        <VideoPlayerCard video={video} onReset={onReset} t={t} title={`Video Canvas Resizer (${video.name})`}>
        
        {/* Live Canvas Preview Header Toolbar */}
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-2xl bg-slate-900/90 border border-slate-800 text-xs">
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-bold uppercase tracking-wider">
                <Eye className="w-3.5 h-3.5" />
                <span>Live Canvas Preview</span>
              </span>
              <span className="font-bold text-slate-200">
                {activePreset.label} ({activePreset.dims})
              </span>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-slate-400 text-[11px] hidden sm:inline">
                Fit: <strong className="text-emerald-400 uppercase">{fitMode}</strong> • Bg: <strong className="text-emerald-400 uppercase">{bgColor}</strong>
              </span>

              <button
                type="button"
                onClick={() => setShowGrid(!showGrid)}
                className={`px-2.5 py-1 rounded-lg border text-[11px] font-bold flex items-center gap-1.5 transition-all ${
                  showGrid 
                    ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400' 
                    : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
                }`}
              >
                <Grid className="w-3.5 h-3.5" />
                <span>3x3 Framing Grid</span>
              </button>
            </div>
          </div>

          {/* Main Stage Viewport Frame */}
          <div className="relative w-full h-[260px] xs:h-[320px] sm:h-[440px] bg-slate-950/95 rounded-2xl flex items-center justify-center p-3 sm:p-6 overflow-hidden border border-slate-800/80 shadow-2xl group">
            
            {/* The Target Canvas Box maintaining EXACT Aspect Ratio */}
            <div 
              className="relative max-w-full max-h-full transition-all duration-300 overflow-hidden rounded-xl border-2 border-emerald-500/60 shadow-2xl flex items-center justify-center"
              style={{
                aspectRatio: activePreset.ratio,
                width: aspectRatio === '21:9' || aspectRatio === '16:9' ? '100%' : 'auto',
                height: aspectRatio === '9:16' || aspectRatio === '4:5' || aspectRatio === '1:1' ? '100%' : 'auto',
              }}
            >
              {/* 1. Background Layer (for Letterbox / Contain Mode) */}
              {bgColor === 'blur' && (
                <video
                  ref={bgVideoRef}
                  src={video.url}
                  className="absolute inset-0 w-full h-full object-cover blur-2xl scale-125 opacity-60 pointer-events-none"
                  muted
                  playsInline
                />
              )}
              {bgColor === 'black' && <div className="absolute inset-0 bg-black pointer-events-none" />}
              {bgColor === 'white' && <div className="absolute inset-0 bg-white pointer-events-none" />}
              {bgColor === 'emerald' && <div className="absolute inset-0 bg-emerald-950 pointer-events-none" />}

              {/* 2. Main Interactive Video Element */}
              <video
                ref={mainVideoRef}
                src={video.url}
                controls
                preload="metadata"
                playsInline
                onTimeUpdate={handleTimeUpdate}
                onPlay={handlePlay}
                onPause={handlePause}
                style={{
                  transform: `rotate(${rotation}deg) scaleX(${flipH ? -1 : 1}) scaleY(${flipV ? -1 : 1})`,
                  transition: 'transform 0.3s ease'
                }}
                className={`relative z-10 w-full h-full ${
                  fitMode === 'contain' 
                    ? 'object-contain' 
                    : fitMode === 'cover' 
                    ? 'object-cover' 
                    : 'object-fill'
                }`}
              />

              {/* 3. Rule of Thirds / Framing Grid Overlay */}
              {showGrid && (
                <div className="absolute inset-0 z-20 pointer-events-none grid grid-cols-3 grid-rows-3 border border-emerald-500/30">
                  <div className="border-r border-b border-emerald-500/20" />
                  <div className="border-r border-b border-emerald-500/20" />
                  <div className="border-b border-emerald-500/20" />
                  <div className="border-r border-b border-emerald-500/20" />
                  <div className="border-r border-b border-emerald-500/20" />
                  <div className="border-b border-emerald-500/20" />
                  <div className="border-r border-emerald-500/20" />
                  <div className="border-r border-emerald-500/20" />
                  <div />
                </div>
              )}

              {/* 4. Canvas Live Aspect Label Tag */}
              <div className="absolute top-2 left-2 z-30 pointer-events-none px-2 py-0.5 rounded-md bg-black/70 backdrop-blur-md border border-white/10 text-[10px] font-mono text-emerald-400 font-bold">
                {activePreset.id} ({activePreset.dims})
              </div>
            </div>

          </div>
        </div>
      </VideoPlayerCard>
      </div>

      {/* Control Panel */}
      <div id="tool-settings-section" className="lg:col-span-6 xl:col-span-5 glass-card p-4 sm:p-6 rounded-3xl space-y-4 sm:space-y-6">
        
        {/* Aspect Ratio Selector Presets */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <label className="text-xs font-bold text-slate-500 dark:text-gray-400 tracking-wider uppercase flex items-center gap-1.5">
              <Frame className="w-4 h-4 text-emerald-500" />
              <span>{t.resizer.aspect_ratio}</span>
            </label>
            <span className="text-xs text-slate-500 dark:text-gray-400">
              Selected Frame: <strong className="text-emerald-500 font-bold">{activePreset.label}</strong>
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {aspectPresets.map((preset) => {
              const isSelected = aspectRatio === preset.id;
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => setAspectRatio(preset.id as any)}
                  className={`p-4 rounded-2xl border text-left transition-all flex flex-col justify-between space-y-3 relative overflow-hidden group ${
                    isSelected
                      ? 'border-emerald-500 bg-emerald-500/15 text-slate-900 dark:text-white shadow-lg ring-2 ring-emerald-500/30'
                      : 'border-slate-200 dark:border-gray-800 bg-slate-100/50 dark:bg-gray-900/60 text-slate-600 dark:text-gray-400 hover:border-slate-300 dark:hover:border-gray-700'
                  }`}
                >
                  <div className="flex items-center justify-between w-full">
                    <span className={`text-xs font-extrabold uppercase tracking-widest px-2 py-0.5 rounded-md ${
                      isSelected ? 'bg-emerald-500 text-gray-950' : 'bg-slate-200 dark:bg-gray-800 text-slate-700 dark:text-gray-300'
                    }`}>
                      {preset.id}
                    </span>

                    {/* Visual Aspect Ratio Mini Shape Illustration */}
                    <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-slate-900/80 border border-slate-700/60 p-1">
                      <div className={`border-2 border-emerald-400/80 rounded-sm bg-emerald-500/20 transition-transform ${
                        preset.id === '21:9' ? 'w-8 h-3' :
                        preset.id === '16:9' ? 'w-7 h-4' :
                        preset.id === '1:1' ? 'w-5 h-5' :
                        preset.id === '4:5' ? 'w-4 h-5' : 'w-3.5 h-7'
                      }`} />
                    </div>
                  </div>

                  <div>
                    <h4 className="font-extrabold text-sm text-slate-900 dark:text-white">{preset.label}</h4>
                    <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold mt-0.5">{preset.dims}</p>
                    <p className="text-[10px] text-slate-500 dark:text-gray-500 mt-1 line-clamp-1">{preset.desc}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Fit Mode, Backgrounds & Transformation Controls */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2 border-t border-slate-200 dark:border-gray-800/80">
          
          {/* Fit Mode */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-600 dark:text-gray-400 flex items-center gap-1 block">
              <Crop className="w-3.5 h-3.5 text-emerald-500" />
              <span>Frame Fit Mode</span>
            </label>
            <div className="grid grid-cols-3 gap-1.5">
              {[
                { id: 'contain', label: 'Contain' },
                { id: 'cover', label: 'Crop Fill' },
                { id: 'fill', label: 'Stretch' }
              ].map((fm) => (
                <button
                  key={fm.id}
                  type="button"
                  onClick={() => setFitMode(fm.id as any)}
                  className={`py-2 text-[11px] font-bold rounded-xl border text-center transition-all ${
                    fitMode === fm.id
                      ? 'border-emerald-500 bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 shadow-sm'
                      : 'border-slate-200 dark:border-gray-800 bg-slate-100 dark:bg-gray-900 text-slate-600 dark:text-gray-400 hover:border-slate-300'
                  }`}
                >
                  {fm.label}
                </button>
              ))}
            </div>
          </div>

          {/* Letterbox Background */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-600 dark:text-gray-400 flex items-center gap-1 block">
              <Layers className="w-3.5 h-3.5 text-emerald-500" />
              <span>Letterbox Background</span>
            </label>
            <div className="grid grid-cols-2 gap-1.5">
              {[
                { id: 'blur', label: 'Blurred Video' },
                { id: 'black', label: 'Solid Black' },
                { id: 'white', label: 'Solid White' },
                { id: 'emerald', label: 'Emerald' }
              ].map((bg) => (
                <button
                  key={bg.id}
                  type="button"
                  onClick={() => setBgColor(bg.id as any)}
                  className={`py-1.5 text-[11px] font-bold rounded-xl border text-center transition-all ${
                    bgColor === bg.id
                      ? 'border-emerald-500 bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 shadow-sm'
                      : 'border-slate-200 dark:border-gray-800 bg-slate-100 dark:bg-gray-900 text-slate-600 dark:text-gray-400 hover:border-slate-300'
                  }`}
                >
                  {bg.label}
                </button>
              ))}
            </div>
          </div>

          {/* Orientation & Flip */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-600 dark:text-gray-400 flex items-center gap-1 block">
              <RotateCw className="w-3.5 h-3.5 text-emerald-500" />
              <span>Orientation & Flip</span>
            </label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setRotation((r) => (r + 90) % 360)}
                className="flex-1 py-2 px-2 rounded-xl bg-slate-100 dark:bg-gray-900 border border-slate-200 dark:border-gray-800 text-slate-700 dark:text-gray-300 text-xs font-bold flex items-center justify-center gap-1 hover:border-emerald-500 transition-colors"
              >
                <RotateCw className="w-3.5 h-3.5 text-emerald-500" />
                <span>{rotation}° Rotate</span>
              </button>

              <button
                type="button"
                onClick={() => setFlipH(!flipH)}
                className={`p-2 rounded-xl border transition-all ${flipH ? 'border-emerald-500 bg-emerald-500/20 text-emerald-500' : 'border-slate-200 dark:border-gray-800 bg-slate-100 dark:bg-gray-900 text-slate-600 dark:text-gray-400'}`}
                title="Flip Horizontally"
              >
                <FlipHorizontal className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => setFlipV(!flipV)}
                className={`p-2 rounded-xl border transition-all ${flipV ? 'border-emerald-500 bg-emerald-500/20 text-emerald-500' : 'border-slate-200 dark:border-gray-800 bg-slate-100 dark:bg-gray-900 text-slate-600 dark:text-gray-400'}`}
                title="Flip Vertically"
              >
                <FlipVertical className="w-4 h-4" />
              </button>
            </div>
          </div>

        </div>

        {/* Action / Result */}
        {resizeError ? (
          <div className="space-y-3">
            <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-start gap-3">
              <AlertCircle className="w-6 h-6 text-red-500 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-red-600 dark:text-red-400">Resize Failed</h4>
                <p className="text-xs text-slate-600 dark:text-gray-300">{resizeError}</p>
              </div>
            </div>
            <button
              onClick={() => { setResizeError(null); handleResize(); }}
              className="w-full py-3 rounded-2xl bg-slate-800 dark:bg-gray-700 hover:bg-slate-700 dark:hover:bg-gray-600 text-white font-bold text-sm flex items-center justify-center gap-2 transition-all"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Try Again</span>
            </button>
          </div>
        ) : !resizedResult ? (
          <div className="space-y-2">
            {isProcessing && <p className="text-center text-xs text-emerald-500 font-semibold animate-pulse">{progressMsg}</p>}
            <button
              id="tool-primary-action-btn"
              onClick={handleResize}
              disabled={isProcessing}
              className="w-full py-4 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-gray-950 font-extrabold text-base shadow-xl shadow-emerald-500/25 transition-all flex items-center justify-center gap-2"
            >
              <Maximize2 className="w-5 h-5" />
              <span>{isProcessing ? 'Resizing Frame...' : t.resizer.action_resize}</span>
            </button>
          </div>
        ) : (
          <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-8 h-8 text-emerald-500 dark:text-emerald-400 shrink-0" />
              <div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-white">Video Resized to {activePreset.label} ({aspectRatio})!</h4>
                <p className="text-xs text-slate-600 dark:text-gray-300 mt-0.5">Fit: {fitMode} • Background: {bgColor} • Rotation: {rotation}°</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
              <a
                id="tool-download-btn"
                href={resizedResult}
                download={`resized_${aspectRatio.replace(':', 'x')}_${video.name}`}
                className="flex-1 sm:flex-initial px-6 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-gray-950 font-bold text-sm shadow-lg flex items-center justify-center gap-2 cursor-pointer transition-all"
              >
                <Download className="w-4 h-4" />
                <span>{t.processing.download}</span>
              </a>
              <ShareResultButton
                fileUrl={resizedResult}
                fileName={`resized_${aspectRatio.replace(':', 'x')}_${video.name}`}
                title={`DarlingClip Resized: ${video.name}`}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

