import React, { useState, useRef, useEffect, useCallback } from 'react';
import { VideoFile } from '../types';
import { TranslationSchema } from '../translations';
import {
  Stamp, Download, CheckCircle2, Type, Image as ImageIcon, LayoutGrid, Eye,
  Upload, VolumeX, Volume2, Maximize2, Minimize2, Move, ArrowUp, ArrowDown,
  ArrowLeft, ArrowRight, Expand, AlertCircle, RefreshCw
} from 'lucide-react';
import { VideoPlayerCard } from '../components/VideoPlayerCard';
import confetti from 'canvas-confetti';
import { processVideoWatermark } from '../lib/mediaProcessor';
import { memoryManager } from '../lib/memoryManager';
import { ShareResultButton } from '../components/ShareResultButton';

interface WatermarkToolProps {
  video: VideoFile;
  onReset: () => void;
  t: TranslationSchema;
}

interface PresetPosition {
  id: string;
  label: string;
  x: number;
  y: number;
}

const getPresetPositions = (t: TranslationSchema): PresetPosition[] => [
  { id: 'top-left', label: t.watermark.posTopLeft, x: 12, y: 12 },
  { id: 'top', label: t.watermark.posTopCenter, x: 50, y: 12 },
  { id: 'top-right', label: t.watermark.posTopRight, x: 88, y: 12 },
  { id: 'center-left', label: t.watermark.posMidLeft, x: 12, y: 50 },
  { id: 'center', label: t.watermark.posCenter, x: 50, y: 50 },
  { id: 'center-right', label: t.watermark.posMidRight, x: 88, y: 50 },
  { id: 'bottom-left', label: t.watermark.posBottomLeft, x: 12, y: 88 },
  { id: 'bottom', label: t.watermark.posBottomCenter, x: 50, y: 88 },
  { id: 'bottom-right', label: t.watermark.posBottomRight, x: 88, y: 88 },
];

export const WatermarkTool: React.FC<WatermarkToolProps> = ({ video, onReset, t }) => {
  const [watermarkType, setWatermarkType] = useState<'text' | 'image'>('image');
  const [text, setText] = useState('@DarlingClip');
  const [fontSize, setFontSize] = useState(28);
  const [fontColor, setFontColor] = useState('#ffffff');
  const [bgColor, setBgColor] = useState<'transparent' | 'dark' | 'white' | 'emerald'>('dark');
  const [opacity, setOpacity] = useState(0.9);

  // Position in percentage coordinates (0% to 100%)
  const [posX, setPosX] = useState<number>(88); // 88% = bottom-right by default
  const [posY, setPosY] = useState<number>(88);
  const [isDragging, setIsDragging] = useState<boolean>(false);

  // Logo file & sizing
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageWidth, setImageWidth] = useState(160);

  // Audio & export
  const [removeAudio, setRemoveAudio] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progressMsg, setProgressMsg] = useState('');
  const [watermarkError, setWatermarkError] = useState<string | null>(null);
  const [watermarkResult, setWatermarkResult] = useState<string | null>(null);

  // Video aspect ratio detection
  const [videoAspect, setVideoAspect] = useState<number>(() => {
    if (video.width && video.height && video.width > 0 && video.height > 0) {
      return video.width / video.height;
    }
    return 16 / 9;
  });

  // Display modes: Fullscreen & Theater mode
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isTheaterMode, setIsTheaterMode] = useState(false);

  // Refs
  const mainVideoRef = useRef<HTMLVideoElement>(null);
  const stageWrapperRef = useRef<HTMLDivElement>(null);
  const videoBoxRef = useRef<HTMLDivElement>(null);
  const watermarkElemRef = useRef<HTMLDivElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const dragSessionRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    startPosX: number;
    startPosY: number;
    boxWidth: number;
    boxHeight: number;
  } | null>(null);

  const presetPositions = getPresetPositions(t);

  // Fullscreen change listener
  useEffect(() => {
    const handleFsChange = () => {
      const isFs = Boolean(document.fullscreenElement);
      setIsFullscreen(isFs);
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    document.addEventListener('webkitfullscreenchange', handleFsChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFsChange);
      document.removeEventListener('webkitfullscreenchange', handleFsChange);
    };
  }, []);

  // Clean up object URLs
  useEffect(() => {
    return () => {
      if (imageUrl) {
        memoryManager.safeRevokeObjectURL(imageUrl);
      }
      if (watermarkResult && watermarkResult !== video.url) {
        memoryManager.safeRevokeObjectURL(watermarkResult);
      }
    };
  }, [imageUrl, watermarkResult, video.url]);

  const handleVideoLoadedMetadata = (e: React.SyntheticEvent<HTMLVideoElement>) => {
    const el = e.currentTarget;
    if (el.videoWidth && el.videoHeight) {
      setVideoAspect(el.videoWidth / el.videoHeight);
    }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (imageUrl) memoryManager.safeRevokeObjectURL(imageUrl);
      const url = URL.createObjectURL(file);
      setImageFile(file);
      setImageUrl(url);
    }
  };

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        const elem = stageWrapperRef.current;
        if (elem?.requestFullscreen) {
          await elem.requestFullscreen();
        } else if ((elem as any)?.webkitRequestFullscreen) {
          await (elem as any).webkitRequestFullscreen();
        }
      } else {
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        } else if ((document as any)?.webkitExitFullscreen) {
          await (document as any).webkitExitFullscreen();
        }
      }
    } catch (err) {
      console.warn('Fullscreen toggle failed:', err);
    }
  };

  // Drag handlers using Pointer Events
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();

    const box = videoBoxRef.current;
    if (!box) return;

    const rect = box.getBoundingClientRect();
    dragSessionRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      startPosX: posX,
      startPosY: posY,
      boxWidth: rect.width,
      boxHeight: rect.height,
    };

    setIsDragging(true);
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch (err) {
      console.warn('Pointer capture error:', err);
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging || !dragSessionRef.current || dragSessionRef.current.pointerId !== e.pointerId) {
      return;
    }
    e.preventDefault();
    const { startX, startY, startPosX, startPosY, boxWidth, boxHeight } = dragSessionRef.current;
    if (boxWidth <= 0 || boxHeight <= 0) return;

    const deltaX = e.clientX - startX;
    const deltaY = e.clientY - startY;

    const deltaXPercent = (deltaX / boxWidth) * 100;
    const deltaYPercent = (deltaY / boxHeight) * 100;

    const newX = Math.max(4, Math.min(96, Math.round((startPosX + deltaXPercent) * 10) / 10));
    const newY = Math.max(4, Math.min(96, Math.round((startPosY + deltaYPercent) * 10) / 10));

    setPosX(newX);
    setPosY(newY);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (dragSessionRef.current && dragSessionRef.current.pointerId === e.pointerId) {
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch (err) {
        // ignore
      }
      dragSessionRef.current = null;
      setIsDragging(false);
    }
  };

  // Direct click-to-place on video frame
  const handleStageClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!videoBoxRef.current) return;
    const rect = videoBoxRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    const newX = Math.max(5, Math.min(95, Math.round((clickX / rect.width) * 100)));
    const newY = Math.max(5, Math.min(95, Math.round((clickY / rect.height) * 100)));

    setPosX(newX);
    setPosY(newY);
  };

  // Nudge adjustment helper
  const nudge = useCallback((dx: number, dy: number) => {
    setPosX((prev) => Math.max(4, Math.min(96, Math.round((prev + dx) * 10) / 10)));
    setPosY((prev) => Math.max(4, Math.min(96, Math.round((prev + dy) * 10) / 10)));
  }, []);

  const handleWatermark = async () => {
    // BUG #5 fix: Validate that an image is uploaded when image mode is selected
    if (watermarkType === 'image' && !imageUrl) {
      alert(t.watermark.selectLogoFile || 'Please upload a logo image first.');
      return;
    }
    setIsProcessing(true);
    setWatermarkError(null);
    setProgressMsg(t.watermark.renderingMsg);

    try {
      const blob = await processVideoWatermark(
        video.url,
        watermarkType,
        text,
        fontColor,
        fontSize,
        bgColor,
        'custom',
        20,
        opacity,
        imageUrl,
        imageWidth,
        removeAudio,
        (_pct: number, msg: string) => setProgressMsg(msg),
        { posXPercent: posX, posYPercent: posY }
      );

      if (watermarkResult && watermarkResult !== video.url) {
        memoryManager.safeRevokeObjectURL(watermarkResult);
      }
      const resultUrl = memoryManager.safeCreateObjectURL(blob, 'watermark-result', true);
      setWatermarkResult(resultUrl);
      setIsProcessing(false);
      confetti({ particleCount: 70, spread: 60 });
    } catch (e) {
      // Honest failure: show the reason instead of relabelling the original video
      setProgressMsg('');
      setWatermarkError(e instanceof Error ? e.message : String(e));
      setIsProcessing(false);
    }
  };

  const colorSwatches = ['#ffffff', '#facc15', '#22d3ee', '#f43f5e', '#10b981', '#fb923c', '#a855f7', '#000000'];

  // Identify if current coordinates match a preset
  const activePreset = presetPositions.find(
    (p) => Math.abs(p.x - posX) <= 3 && Math.abs(p.y - posY) <= 3
  );

  return (
    <div className="w-full max-w-full space-y-6 transition-all">
      <div className={`w-full lg:grid lg:gap-8 items-start ${isTheaterMode ? 'lg:grid-cols-1 space-y-6' : 'lg:grid-cols-12 lg:space-y-0'}`}>
        
        {/* Real-time Video Player & Live Watermark Overlay Stage */}
        <div className={`${isTheaterMode ? 'lg:col-span-1' : 'lg:col-span-6 xl:col-span-7'} space-y-4 lg:sticky lg:top-20`}>
          <VideoPlayerCard video={video} onReset={onReset} t={t} title={`${t.watermark.title} (${video.name})`}>

            {/* Header controls: Live Overlay Status & Enlargement / Fullscreen Buttons */}
            <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 sm:p-3 rounded-2xl bg-slate-900/90 border border-slate-800 text-xs shadow-md">
              <div className="flex items-center gap-2 min-w-0">
                <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-bold uppercase tracking-wider text-[10px] sm:text-xs shrink-0">
                  <Eye className="w-3.5 h-3.5" />
                  <span>{t.watermark.livePreview}</span>
                </span>
                <span className="font-bold text-slate-200 text-xs truncate">
                  {watermarkType === 'text' ? `"${text}"` : (imageFile ? imageFile.name : t.watermark.pngJpgLogo)}
                </span>
              </div>

              {/* Viewport Enlargement & Fullscreen Controls */}
              <div className="flex items-center gap-1.5 shrink-0 ml-auto">
                <div className="px-2 py-1 rounded-lg bg-slate-800 text-emerald-400 font-mono font-bold text-[11px] border border-slate-700 hidden sm:inline-block">
                  X:{Math.round(posX)}% Y:{Math.round(posY)}%
                </div>

                {/* Theater Mode */}
                <button
                  type="button"
                  onClick={() => setIsTheaterMode(!isTheaterMode)}
                  className={`px-2.5 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                    isTheaterMode
                      ? 'bg-emerald-500 text-slate-950 border-emerald-400 shadow-md'
                      : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
                  }`}
                  title={isTheaterMode ? t.watermark.normalViewTitle : t.watermark.theaterViewTitle}
                >
                  <Expand className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">{isTheaterMode ? t.watermark.standard : t.watermark.expand}</span>
                </button>

                {/* True Stage Fullscreen */}
                <button
                  type="button"
                  onClick={toggleFullscreen}
                  className="px-2.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-emerald-900/30 transition-all cursor-pointer"
                  title={t.watermark.fullscreenTitle}
                >
                  <Maximize2 className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">{t.watermark.fullscreen}</span>
                </button>
              </div>
            </div>

            {/* Video Stage with Interactive Watermark Overlay */}
            <div
              ref={stageWrapperRef}
              className={`relative w-full rounded-2xl bg-slate-950 flex items-center justify-center overflow-hidden border border-slate-800 shadow-2xl transition-all ${
                isFullscreen
                  ? 'fixed inset-0 z-[9999] rounded-none w-screen h-screen border-none bg-black p-4'
                  : ''
              }`}
            >
              {/* Fullscreen Floating Exit & Status Bar */}
              {isFullscreen && (
                <div className="absolute top-4 left-4 right-4 z-40 flex items-center justify-between pointer-events-auto bg-slate-900/90 backdrop-blur-md px-4 py-2.5 rounded-2xl border border-slate-700 shadow-2xl">
                  <div className="flex items-center gap-2 text-white text-xs font-bold">
                    <Move className="w-4 h-4 text-emerald-400 animate-pulse" />
                    <span>{t.watermark.fullscreenHint}</span>
                  </div>
                  <button
                    type="button"
                    onClick={toggleFullscreen}
                    className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-lg"
                  >
                    <Minimize2 className="w-3.5 h-3.5" />
                    <span>{t.watermark.exitFullscreen}</span>
                  </button>
                </div>
              )}

              {/* Aspect-Ratio Video Box */}
              <div
                ref={videoBoxRef}
                onClick={handleStageClick}
                className="relative max-w-full max-h-full flex items-center justify-center overflow-hidden select-none"
                style={{
                  aspectRatio: `${videoAspect}`,
                  height: isFullscreen ? '92vh' : (isTheaterMode ? '72vh' : 'auto'),
                  maxHeight: isFullscreen ? '94vh' : (isTheaterMode ? '78vh' : '52vh'),
                  width: 'auto',
                }}
              >
                {/* Video Element */}
                <video
                  ref={mainVideoRef}
                  src={video.url}
                  controls
                  controlsList="nofullscreen nodownload"
                  disablePictureInPicture
                  preload="metadata"
                  playsInline
                  onLoadedMetadata={handleVideoLoadedMetadata}
                  className="w-full h-full object-contain pointer-events-auto relative z-10"
                />

                {/* Interactive Drag Overlay Layer */}
                <div className="absolute inset-0 z-20 pointer-events-none">
                  {/* Draggable Watermark Component */}
                  <div
                    ref={watermarkElemRef}
                    onPointerDown={handlePointerDown}
                    onPointerMove={handlePointerMove}
                    onPointerUp={handlePointerUp}
                    onPointerCancel={handlePointerUp}
                    className={`absolute pointer-events-auto cursor-grab active:cursor-grabbing select-none transition-shadow duration-150 group/watermark ${
                      isDragging
                        ? 'ring-2 ring-emerald-400 ring-offset-2 ring-offset-slate-900 shadow-2xl scale-[1.03]'
                        : 'hover:ring-2 hover:ring-emerald-400/80'
                    }`}
                    style={{
                      left: `${posX}%`,
                      top: `${posY}%`,
                      transform: 'translate(-50%, -50%)',
                      opacity: opacity,
                      touchAction: 'none',
                    }}
                    title={t.watermark.dragTooltip}
                  >
                    {/* Floating Drag Indicator Badge */}
                    <div className="absolute -top-7 left-1/2 -translate-x-1/2 opacity-0 group-hover/watermark:opacity-100 transition-opacity bg-slate-900/90 text-emerald-400 border border-emerald-500/40 text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap shadow-md pointer-events-none flex items-center gap-1">
                      <Move className="w-2.5 h-2.5" />
                      <span>{t.watermark.dragLabel}</span>
                    </div>

                    {/* Watermark Content: Text or Image */}
                    {watermarkType === 'text' ? (
                      <div
                        className={`px-3 py-1.5 rounded-xl font-bold font-sans tracking-wide text-center transition-all ${
                          bgColor === 'dark'
                            ? 'bg-slate-900/85 text-white border border-slate-700/60 shadow-xl'
                            : bgColor === 'white'
                            ? 'bg-white/95 text-slate-900 border border-slate-200 shadow-xl'
                            : bgColor === 'emerald'
                            ? 'bg-emerald-950/90 text-white border border-emerald-700/60 shadow-xl'
                            : 'bg-transparent text-white drop-shadow-[0_2px_5px_rgba(0,0,0,0.95)]'
                        }`}
                        style={{
                          fontSize: `${Math.max(12, Math.min(54, fontSize * 0.7))}px`,
                          color: fontColor,
                        }}
                      >
                        {text || 'Watermark'}
                      </div>
                    ) : (
                      imageUrl ? (
                        <div className="relative">
                          <img
                            src={imageUrl}
                            alt="Watermark Logo"
                            draggable={false}
                            className="object-contain drop-shadow-xl rounded-lg pointer-events-none"
                            style={{
                              width: `${Math.max(36, Math.min(320, imageWidth * 0.7))}px`,
                            }}
                          />
                        </div>
                      ) : (
                        <div className="px-3.5 py-2 rounded-xl bg-slate-900/90 text-amber-400 border border-amber-500/50 text-xs font-bold flex items-center gap-2 shadow-2xl backdrop-blur-sm">
                          <Upload className="w-4 h-4 animate-bounce" />
                          <span>{t.watermark.uploadLogoBelow}</span>
                        </div>
                      )
                    )}

                    {/* Subtle Corner Handles */}
                    <div className="absolute -top-1 -left-1 w-2.5 h-2.5 bg-emerald-400 rounded-full border border-slate-950 opacity-0 group-hover/watermark:opacity-100 pointer-events-none" />
                    <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-400 rounded-full border border-slate-950 opacity-0 group-hover/watermark:opacity-100 pointer-events-none" />
                    <div className="absolute -bottom-1 -left-1 w-2.5 h-2.5 bg-emerald-400 rounded-full border border-slate-950 opacity-0 group-hover/watermark:opacity-100 pointer-events-none" />
                    <div className="absolute -bottom-1 -right-1 w-2.5 h-2.5 bg-emerald-400 rounded-full border border-slate-950 opacity-0 group-hover/watermark:opacity-100 pointer-events-none" />
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Helper Instructions */}
            <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-xs flex items-center justify-between gap-3 text-slate-700 dark:text-gray-300">
              <div className="flex items-center gap-2">
                <Move className="w-4 h-4 text-emerald-500 shrink-0" />
                <span className="text-[11px] sm:text-xs">
                  <strong>{t.watermark.dragInstructionTitle}</strong> {t.watermark.dragInstructionDesc}
                </span>
              </div>
              <div className="shrink-0 font-mono font-bold text-emerald-500 text-[11px]">
                {activePreset ? activePreset.label : t.watermark.customPosition}
              </div>
            </div>

          </VideoPlayerCard>
        </div>

        {/* Watermark Control Panel */}
        <div id="tool-settings-section" className={`${isTheaterMode ? 'lg:col-span-1' : 'lg:col-span-6 xl:col-span-5'} glass-card p-4 sm:p-6 rounded-3xl space-y-5 sm:space-y-6 shadow-xl`}>

          {/* Type Switcher: Text vs Image Logo */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-500 dark:text-gray-400 tracking-wider uppercase flex items-center gap-1.5">
              <Stamp className="w-4 h-4 text-emerald-500" />
              <span>{t.watermark.typeLabel}</span>
            </label>
            <div className="grid grid-cols-2 gap-2 p-1 rounded-2xl bg-slate-100 dark:bg-gray-900 border border-slate-200 dark:border-gray-800">
              <button
                type="button"
                onClick={() => setWatermarkType('image')}
                className={`py-2.5 px-3 rounded-xl text-xs font-extrabold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  watermarkType === 'image'
                    ? 'bg-emerald-500 text-gray-950 shadow-md'
                    : 'text-slate-600 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <ImageIcon className="w-4 h-4" />
                <span>{t.watermark.imageLogo}</span>
              </button>
              <button
                type="button"
                onClick={() => setWatermarkType('text')}
                className={`py-2.5 px-3 rounded-xl text-xs font-extrabold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  watermarkType === 'text'
                    ? 'bg-emerald-500 text-gray-950 shadow-md'
                    : 'text-slate-600 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Type className="w-4 h-4" />
                <span>{t.watermark.textWatermark}</span>
              </button>
            </div>
          </div>

          {/* Logo Image Upload & Sizing Controls */}
          {watermarkType === 'image' ? (
            <div className="space-y-4 animate-fadeIn">
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-700 dark:text-gray-300 flex items-center justify-between">
                  <span>{t.watermark.logoImageLabel}</span>
                  {imageFile && <span className="text-[11px] text-emerald-500 font-bold">{t.watermark.uploaded}</span>}
                </label>
                <input
                  ref={imageInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => imageInputRef.current?.click()}
                  className={`w-full py-4 px-4 rounded-2xl border-2 border-dashed transition-all cursor-pointer flex flex-col items-center justify-center gap-2 ${
                    imageFile
                      ? 'border-emerald-500/60 bg-emerald-500/5 text-emerald-700 dark:text-emerald-400'
                      : 'border-slate-300 dark:border-gray-800 hover:border-emerald-500/50 bg-slate-50 dark:bg-gray-900/50 text-slate-700 dark:text-gray-300'
                  }`}
                >
                  <Upload className="w-5 h-5 text-emerald-500" />
                  <span className="text-xs font-bold">
                    {imageFile ? imageFile.name : t.watermark.selectLogoFile}
                  </span>
                  <span className="text-[10px] text-slate-400">{t.watermark.pngRecommended}</span>
                </button>
              </div>

              {/* Logo Width Slider & Presets */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-semibold">
                  <span className="text-slate-700 dark:text-gray-300">{t.watermark.logoWidth}</span>
                  <span className="text-emerald-500 font-bold">{imageWidth}px</span>
                </div>
                <input
                  type="range"
                  min="40"
                  max="380"
                  step="5"
                  value={imageWidth}
                  onChange={(e) => setImageWidth(parseInt(e.target.value))}
                  className="w-full accent-emerald-500 cursor-pointer"
                />
                <div className="grid grid-cols-4 gap-1.5 pt-1">
                  {[
                    { label: t.watermark.sizeSmall, w: 80 },
                    { label: t.watermark.sizeMedium, w: 160 },
                    { label: t.watermark.sizeLarge, w: 240 },
                    { label: t.watermark.sizeXLarge, w: 320 },
                  ].map((sz) => (
                    <button
                      key={sz.label}
                      type="button"
                      onClick={() => setImageWidth(sz.w)}
                      className={`py-1 px-2 rounded-lg text-[11px] font-bold border transition-colors cursor-pointer ${
                        imageWidth === sz.w
                          ? 'bg-emerald-500 text-slate-950 border-emerald-400'
                          : 'bg-slate-100 dark:bg-gray-800 hover:bg-slate-200 text-slate-700 dark:text-gray-300 border-slate-200 dark:border-gray-700'
                      }`}
                    >
                      {sz.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            /* Text Watermark Controls */
            <div className="space-y-4 animate-fadeIn">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-700 dark:text-gray-300">{t.watermark.textLabel}</label>
                  <div className="flex items-center gap-1">
                    {['@DarlingClip', 'MAXFIY', 'PREMYERA'].map((presetText) => (
                      <button
                        key={presetText}
                        type="button"
                        onClick={() => setText(presetText)}
                        className="px-2 py-0.5 rounded-md bg-slate-200 dark:bg-gray-800 hover:bg-emerald-500/20 text-[10px] font-bold text-slate-700 dark:text-gray-300 hover:text-emerald-500 transition-colors cursor-pointer"
                      >
                        {presetText}
                      </button>
                    ))}
                  </div>
                </div>
                <input
                  type="text"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder={t.watermark.textPlaceholder}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-100 dark:bg-gray-900 border border-slate-200 dark:border-gray-800 text-slate-900 dark:text-white text-sm font-bold focus:outline-none focus:border-emerald-500 transition-colors"
                />
              </div>

              {/* Color Swatches */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-gray-300">{t.watermark.fontColor}</label>
                <div className="flex flex-wrap items-center gap-2">
                  {colorSwatches.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setFontColor(color)}
                      className={`w-7 h-7 rounded-xl border-2 transition-transform cursor-pointer ${
                        fontColor === color ? 'border-emerald-500 scale-110 shadow-md' : 'border-slate-300 dark:border-gray-700'
                      }`}
                      style={{ backgroundColor: color }}
                      title={color}
                    />
                  ))}
                  <input
                    type="color"
                    value={fontColor}
                    onChange={(e) => setFontColor(e.target.value)}
                    className="w-8 h-8 rounded-xl border border-slate-300 dark:border-gray-700 p-0.5 bg-transparent cursor-pointer"
                    title={t.watermark.customColor}
                  />
                </div>
              </div>

              {/* Font Size & Background Badge */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs font-semibold">
                    <span className="text-slate-700 dark:text-gray-300">{t.watermark.fontSize}</span>
                    <span className="text-emerald-500 font-bold">{fontSize}px</span>
                  </div>
                  <input
                    type="range"
                    min="14"
                    max="72"
                    value={fontSize}
                    onChange={(e) => setFontSize(parseInt(e.target.value))}
                    className="w-full accent-emerald-500 cursor-pointer"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 dark:text-gray-300">{t.watermark.bgBadge}</label>
                  <select
                    value={bgColor}
                    onChange={(e) => setBgColor(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-gray-900 border border-slate-200 dark:border-gray-800 text-slate-900 dark:text-white text-xs font-bold focus:outline-none focus:border-emerald-500"
                  >
                    <option value="dark">{t.watermark.bgDark}</option>
                    <option value="transparent">{t.watermark.bgTransparent}</option>
                    <option value="white">{t.watermark.bgWhite}</option>
                    <option value="emerald">{t.watermark.bgEmerald}</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Position Controls */}
          <div className="space-y-3 pt-3 border-t border-slate-200 dark:border-gray-800/80">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-500 dark:text-gray-400 tracking-wider uppercase flex items-center gap-1.5">
                <LayoutGrid className="w-4 h-4 text-emerald-500" />
                <span>{t.watermark.positionLabel}</span>
              </label>
              <span className="text-[11px] font-mono text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
                X: {Math.round(posX)}% • Y: {Math.round(posY)}%
              </span>
            </div>

            {/* 3x3 Preset Grid */}
            <div className="grid grid-cols-3 gap-2">
              {presetPositions.map((preset) => {
                const isSelected = Math.abs(preset.x - posX) <= 4 && Math.abs(preset.y - posY) <= 4;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => {
                      setPosX(preset.x);
                      setPosY(preset.y);
                    }}
                    className={`py-2 px-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-emerald-500 text-slate-950 border-emerald-400 shadow-md font-extrabold'
                        : 'bg-slate-100 dark:bg-gray-900 text-slate-700 dark:text-gray-300 border-slate-200 dark:border-gray-800 hover:bg-slate-200 dark:hover:bg-gray-800'
                    }`}
                  >
                    {preset.label}
                  </button>
                );
              })}
            </div>

            {/* Nudge Arrow Pad */}
            <div className="p-3 rounded-2xl bg-slate-100 dark:bg-gray-900 border border-slate-200 dark:border-gray-800 flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-slate-600 dark:text-gray-400">{t.watermark.nudgeLabel}</span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => nudge(-2, 0)}
                  className="p-1.5 rounded-lg bg-slate-200 dark:bg-gray-800 hover:bg-emerald-500/20 text-slate-700 dark:text-gray-200 hover:text-emerald-500 transition-colors cursor-pointer"
                  title={t.watermark.nudgeLeft}
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => nudge(0, -2)}
                  className="p-1.5 rounded-lg bg-slate-200 dark:bg-gray-800 hover:bg-emerald-500/20 text-slate-700 dark:text-gray-200 hover:text-emerald-500 transition-colors cursor-pointer"
                  title={t.watermark.nudgeUp}
                >
                  <ArrowUp className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => nudge(0, 2)}
                  className="p-1.5 rounded-lg bg-slate-200 dark:bg-gray-800 hover:bg-emerald-500/20 text-slate-700 dark:text-gray-200 hover:text-emerald-500 transition-colors cursor-pointer"
                  title={t.watermark.nudgeDown}
                >
                  <ArrowDown className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => nudge(2, 0)}
                  className="p-1.5 rounded-lg bg-slate-200 dark:bg-gray-800 hover:bg-emerald-500/20 text-slate-700 dark:text-gray-200 hover:text-emerald-500 transition-colors cursor-pointer"
                  title={t.watermark.nudgeRight}
                >
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPosX(50);
                    setPosY(50);
                  }}
                  className="px-2 py-1 rounded-lg bg-slate-200 dark:bg-gray-800 hover:bg-emerald-500/20 text-slate-700 dark:text-gray-200 hover:text-emerald-500 text-[11px] font-bold transition-colors cursor-pointer ml-1"
                  title={t.watermark.resetCenter}
                >
                  {t.watermark.centerBtn}
                </button>
              </div>
            </div>
          </div>

          {/* Opacity Slider */}
          <div className="space-y-1.5 pt-3 border-t border-slate-200 dark:border-gray-800/80">
            <div className="flex items-center justify-between text-xs font-semibold">
              <span className="text-slate-700 dark:text-gray-300">{t.watermark.opacityLabel}</span>
              <span className="text-emerald-500 font-bold">{Math.round(opacity * 100)}%</span>
            </div>
            <input
              type="range"
              min="0.1"
              max="1.0"
              step="0.05"
              value={opacity}
              onChange={(e) => setOpacity(parseFloat(e.target.value))}
              className="w-full accent-emerald-500 cursor-pointer"
            />
          </div>

          {/* Remove Audio Toggle */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-slate-100 dark:bg-gray-900 border border-slate-200 dark:border-gray-800">
            <div className="flex items-center gap-2">
              {removeAudio ? <VolumeX className="w-4 h-4 text-rose-500" /> : <Volume2 className="w-4 h-4 text-emerald-500" />}
              <span className="text-xs font-bold text-slate-800 dark:text-gray-200">{t.watermark.muteAudio}</span>
            </div>
            <input
              type="checkbox"
              checked={removeAudio}
              onChange={(e) => setRemoveAudio(e.target.checked)}
              className="w-4 h-4 accent-emerald-500 cursor-pointer"
            />
          </div>

          {/* Action Button & Processing Result */}
          {watermarkError ? (
            <div className="space-y-3 pt-2">
              <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-start gap-3">
                <AlertCircle className="w-6 h-6 text-red-500 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <h4 className="text-sm font-bold text-red-600 dark:text-red-400">Watermark Failed</h4>
                  <p className="text-xs text-slate-600 dark:text-gray-300">{watermarkError}</p>
                </div>
              </div>
              <button
                onClick={() => { setWatermarkError(null); handleWatermark(); }}
                className="w-full py-3 rounded-2xl bg-slate-800 dark:bg-gray-700 hover:bg-slate-700 dark:hover:bg-gray-600 text-white font-bold text-sm flex items-center justify-center gap-2 transition-all"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Try Again</span>
              </button>
            </div>
          ) : !watermarkResult ? (
            <div className="space-y-2 pt-2">
              {isProcessing && (
                <div className="space-y-1.5 text-center">
                  <p className="text-xs text-emerald-500 font-bold animate-pulse">{progressMsg}</p>
                  <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-500 animate-pulse rounded-full w-3/4" />
                  </div>
                </div>
              )}
              <button
                id="tool-primary-action-btn"
                onClick={handleWatermark}
                disabled={isProcessing}
                className="w-full py-4 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-gray-950 font-extrabold text-base shadow-xl shadow-emerald-500/25 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <Stamp className="w-5 h-5" />
                <span>{isProcessing ? t.watermark.processingBtn : t.watermark.saveWatermarkBtn}</span>
              </button>
            </div>
          ) : (
            <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex flex-col sm:flex-row items-center justify-between gap-4 animate-fadeIn">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="w-8 h-8 text-emerald-500 shrink-0" />
                <div>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white">{t.watermark.successTitle}</h4>
                  <p className="text-xs text-slate-600 dark:text-gray-300 mt-0.5">
                    {t.watermark.successSubtitle
                      .replace('{x}', Math.round(posX).toString())
                      .replace('{y}', Math.round(posY).toString())
                      .replace('{opacity}', Math.round(opacity * 100).toString())}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
                <a
                  id="tool-download-btn"
                  href={watermarkResult}
                  download={`watermarked_${video.name}`}
                  className="flex-1 sm:flex-initial px-6 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-gray-950 font-bold text-sm shadow-lg flex items-center justify-center gap-2 cursor-pointer transition-all"
                >
                  <Download className="w-4 h-4" />
                  <span>{t.processing.download}</span>
                </a>
                <ShareResultButton
                  fileUrl={watermarkResult}
                  fileName={`watermarked_${video.name}`}
                  title={`DarlingClip Watermark: ${video.name}`}
                />
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};
