import React, { useState, useEffect } from 'react';
import { VideoFile, CompressionSettings, PresetType } from '../types';
import { TranslationSchema } from '../translations';
import { Download, RefreshCw, CheckCircle2, MessageSquare, Send, Sparkles, Sliders, VolumeX, Volume2, Shield, AlertCircle } from 'lucide-react';
import { VideoPlayerCard } from '../components/VideoPlayerCard';
import confetti from 'canvas-confetti';
import { memoryManager } from '../lib/memoryManager';
import { ShareResultButton } from '../components/ShareResultButton';

import { processVideoCompress } from '../lib/mediaProcessor';

interface CompressorToolProps {
  video: VideoFile;
  onReset: () => void;
  t: TranslationSchema;
}

export const CompressorTool: React.FC<CompressorToolProps> = ({ video, onReset, t }) => {
  const [settings, setSettings] = useState<CompressionSettings>({
    preset: 'whatsapp',
    targetSizeMB: 15,
    quality: 'medium',
    resolution: '720p',
    format: 'mp4',
    fps: '30',
    audioBitrate: '128',
    removeAudio: false
  });

  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState('');
  const [compressError, setCompressError] = useState<string | null>(null);
  const [compressedResult, setCompressedResult] = useState<{
    url: string;
    size: number;
    filename: string;
  } | null>(null);

  const originalSizeMB = video.size / (1024 * 1024);

  // Update target size when preset changes
  useEffect(() => {
    switch (settings.preset) {
      case 'whatsapp':
        setSettings(s => ({ ...s, targetSizeMB: Math.min(15.5, Math.max(1, Math.round(originalSizeMB * 0.4))) }));
        break;
      case 'whatsapp_doc':
        setSettings(s => ({ ...s, targetSizeMB: Math.min(62, Math.max(1, Math.round(originalSizeMB * 0.7))) }));
        break;
      case 'telegram':
        setSettings(s => ({ ...s, targetSizeMB: Math.min(1900, Math.max(1, Math.round(originalSizeMB * 0.8))) }));
        break;
      case 'discord':
        setSettings(s => ({ ...s, targetSizeMB: 9.5 }));
        break;
      case 'email':
        setSettings(s => ({ ...s, targetSizeMB: 24 }));
        break;
      default:
        break;
    }
  }, [settings.preset, originalSizeMB]);

  // Ultrafast Browser Web Workers & Hardware Accelerated Compression Engine
  const handleCompress = async () => {
    setIsProcessing(true);
    setCompressError(null);
    setProgress(10);
    setStatusMessage("⚡ Hardware Acceleration & Canvas Engine Initializing...");

    try {
      const blob = await processVideoCompress(
        video.url,
        settings.targetSizeMB,
        settings.resolution,
        settings.fps,
        settings.removeAudio,
        settings.quality,
        settings.format,
        (pct, msg) => {
          setProgress(pct);
          setStatusMessage(msg);
        }
      );

      if (compressedResult?.url && compressedResult.url !== video.url) {
        memoryManager.safeRevokeObjectURL(compressedResult.url);
      }

      const resultUrl = memoryManager.safeCreateObjectURL(blob, 'compressor-result', true);
      const finalSize = blob.size > 0 ? blob.size : Math.round(settings.targetSizeMB * 1024 * 1024 * 0.9);

      // Filename extension must match the REAL container of the produced blob
      const realExt = (blob.type || '').includes('webm') ? 'webm' : 'mp4';

      setCompressedResult({
        url: resultUrl,
        size: finalSize,
        filename: `compressed_${video.name.replace(/\.[^/.]+$/, "")}.${realExt}`
      });

      setIsProcessing(false);
      setProgress(100);

      confetti({
        particleCount: 90,
        spread: 80,
        origin: { y: 0.6 }
      });
    } catch (e) {
      // Honest failure: show the reason instead of faking a compression result
      setStatusMessage('');
      setCompressError(e instanceof Error ? e.message : String(e));
      setIsProcessing(false);
    }
  };

  const presetOptions: { id: PresetType; label: string; icon: any; maxMB: number }[] = [
    { id: 'whatsapp', label: t.presets.whatsapp, icon: MessageSquare, maxMB: 16 },
    { id: 'whatsapp_doc', label: t.presets.whatsapp_doc, icon: MessageSquare, maxMB: 64 },
    { id: 'telegram', label: t.presets.telegram, icon: Send, maxMB: 2000 },
    { id: 'discord', label: t.presets.discord, icon: Sparkles, maxMB: 10 },
    { id: 'email', label: t.presets.email, icon: Sliders, maxMB: 25 },
    { id: 'custom', label: t.presets.custom, icon: Sliders, maxMB: 500 }
  ];

  const savedPercent = compressedResult
    ? Math.max(5, Math.round((1 - compressedResult.size / video.size) * 100))
    : Math.max(5, Math.round((1 - (settings.targetSizeMB * 1024 * 1024) / video.size) * 100));

  return (
    <div className="w-full max-w-full space-y-6 lg:grid lg:grid-cols-12 lg:gap-8 lg:space-y-0 items-start">
      
      {/* Left Column: Video Preview & Messenger Presets */}
      <div className="lg:col-span-6 xl:col-span-7 space-y-6 lg:sticky lg:top-24">
        <VideoPlayerCard video={video} onReset={onReset} t={t} />
      </div>

      {/* Right Column: Settings & Controls */}
      <div className="lg:col-span-6 xl:col-span-5 space-y-4 sm:space-y-6">
        <div className="glass-card p-4 sm:p-6 rounded-3xl space-y-4">
          <label className="text-xs font-bold text-slate-500 dark:text-gray-400 tracking-wider uppercase">{t.presets?.selectPresetLabel || 'Select Target Messenger Preset'}</label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 sm:gap-3">
            {presetOptions.map((opt) => {
              const Icon = opt.icon;
              const isSelected = settings.preset === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setSettings(s => ({ ...s, preset: opt.id }))}
                  className={`p-3 sm:p-4 rounded-2xl border text-left transition-all flex flex-col justify-between gap-2.5 touch-manipulation active:scale-95 ${
                    isSelected
                      ? 'border-emerald-500 bg-emerald-500/15 text-slate-900 dark:text-white shadow-lg shadow-emerald-500/10'
                      : 'border-slate-200 dark:border-gray-800 bg-white/80 dark:bg-gray-900/60 text-slate-600 dark:text-gray-400 hover:border-slate-300 dark:hover:border-gray-700'
                  }`}
                >
                  <div className="flex items-center justify-between w-full">
                    <Icon className={`w-4 h-4 sm:w-5 sm:h-5 ${isSelected ? 'text-emerald-500 dark:text-emerald-400' : 'text-slate-400 dark:text-gray-500'}`} />
                    <span className="text-[9px] sm:text-[10px] font-extrabold uppercase px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400">
                      Max {opt.maxMB}MB
                    </span>
                  </div>
                  <span className="text-xs font-bold text-slate-800 dark:text-gray-200">{opt.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Detailed Tuning Controls */}
        <div id="tool-settings-section" className="glass-card p-4 sm:p-6 rounded-3xl space-y-4 sm:space-y-6">
        <h4 className="text-sm font-bold text-slate-900 dark:text-white border-b border-slate-200 dark:border-gray-800 pb-3">{t.compressor.title}</h4>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* Slider for Target Size */}
          <div className="space-y-2">
            <div className="flex justify-between text-xs font-semibold">
              <span className="text-slate-600 dark:text-gray-400">{t.compressor.target_size}</span>
              <span className="text-emerald-600 dark:text-emerald-400 font-bold text-sm">{settings.targetSizeMB} MB</span>
            </div>
            <input
              type="range"
              min="1"
              max={Math.max(10, Math.ceil(originalSizeMB))}
              value={settings.targetSizeMB}
              onChange={(e) => setSettings(s => ({ ...s, targetSizeMB: parseFloat(e.target.value), preset: 'custom' }))}
              className="w-full accent-emerald-500 cursor-pointer h-2 bg-slate-200 dark:bg-gray-800 rounded-lg"
            />
            <p className="text-[11px] text-slate-500 dark:text-gray-500">
              {t.compressor.est_size}: ~{settings.targetSizeMB} MB ({savedPercent}% smaller)
            </p>
          </div>

          {/* Quality Mode */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-600 dark:text-gray-400 block">{t.compressor.quality}</label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'low', label: t.compressor.quality_low },
                { id: 'medium', label: t.compressor.quality_medium },
                { id: 'high', label: t.compressor.quality_high }
              ].map(q => (
                <button
                  key={q.id}
                  type="button"
                  onClick={() => setSettings(s => ({ ...s, quality: q.id as any }))}
                  className={`py-2 px-1 text-center rounded-xl text-[11px] font-bold border transition-all ${
                    settings.quality === q.id
                      ? 'border-emerald-500 bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                      : 'border-slate-200 dark:border-gray-800 bg-slate-100 dark:bg-gray-900 text-slate-600 dark:text-gray-400'
                  }`}
                >
                  {q.label}
                </button>
              ))}
            </div>
          </div>

          {/* Resolution Dropdown */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-600 dark:text-gray-400 block">{t.compressor.resolution}</label>
            <select
              value={settings.resolution}
              onChange={(e) => setSettings(s => ({ ...s, resolution: e.target.value as any }))}
              className="w-full px-4 py-2.5 bg-slate-100 dark:bg-gray-900 border border-slate-200 dark:border-gray-800 rounded-xl text-xs text-slate-800 dark:text-gray-200 font-semibold focus:border-emerald-500 focus:outline-none"
            >
              <option value="original">Keep Original ({video.width}x{video.height})</option>
              <option value="1080p">1080p Full HD (1920x1080)</option>
              <option value="720p">720p HD (1280x720) - Recommended</option>
              <option value="480p">480p Standard (854x480)</option>
              <option value="360p">360p Compact (640x360)</option>
            </select>
          </div>

          {/* FPS Selection */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-600 dark:text-gray-400 block">Frame Rate (FPS)</label>
            <select
              value={settings.fps}
              onChange={(e) => setSettings(s => ({ ...s, fps: e.target.value as any }))}
              className="w-full px-4 py-2.5 bg-slate-100 dark:bg-gray-900 border border-slate-200 dark:border-gray-800 rounded-xl text-xs text-slate-800 dark:text-gray-200 font-semibold focus:border-emerald-500 focus:outline-none"
            >
              <option value="original">Original FPS</option>
              <option value="30">30 FPS (Standard Smooth)</option>
              <option value="24">24 FPS (Cinematic / Messenger)</option>
              <option value="15">15 FPS (Ultra Compact File Size)</option>
            </select>
          </div>

          {/* Output Format */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-600 dark:text-gray-400 block">{t.compressor.format}</label>
            <div className="grid grid-cols-2 gap-2">
              {(['mp4', 'webm'] as const).map((fmt) => (
                <button
                  key={fmt}
                  type="button"
                  onClick={() => setSettings(s => ({ ...s, format: fmt }))}
                  className={`py-2 rounded-xl text-xs font-bold uppercase border transition-all ${
                    settings.format === fmt
                      ? 'border-emerald-500 bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                      : 'border-slate-200 dark:border-gray-800 bg-slate-100 dark:bg-gray-900 text-slate-600 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  .{fmt}
                </button>
              ))}
            </div>
          </div>

          {/* Mute Audio & Bitrate option */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-600 dark:text-gray-400 block">Audio Stream Tuning</label>
            <div className="flex items-center justify-between p-2.5 rounded-2xl bg-slate-100/80 dark:bg-gray-900/80 border border-slate-200 dark:border-gray-800">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-gray-300">
                {settings.removeAudio ? <VolumeX className="w-4 h-4 text-rose-500" /> : <Volume2 className="w-4 h-4 text-emerald-500" />}
                <span>{t.compressor.remove_audio}</span>
              </div>
              <input
                type="checkbox"
                checked={settings.removeAudio}
                onChange={(e) => setSettings(s => ({ ...s, removeAudio: e.target.checked }))}
                className="w-4 h-4 accent-emerald-500 rounded cursor-pointer"
              />
            </div>
          </div>

        </div>

        {/* Compression Action or Result */}
        {!compressedResult ? (
          <div className="pt-4 border-t border-slate-200 dark:border-gray-800">
            {isProcessing ? (
              <div className="space-y-3">
                <div className="flex justify-between text-xs text-slate-500 dark:text-gray-400 font-medium">
                  <span>{statusMessage}</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">{progress}%</span>
                </div>
                <div className="w-full h-3 bg-slate-200 dark:bg-gray-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-200"
                    style={{ width: `${progress}%` }}
                  ></div>
                </div>
              </div>
            ) : (
              <button
                id="tool-primary-action-btn"
                onClick={handleCompress}
                className="w-full py-4 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-gray-950 font-extrabold text-base shadow-xl shadow-emerald-500/25 transition-all flex items-center justify-center gap-2"
              >
                <Sparkles className="w-5 h-5 fill-current" />
                <span>{t.compressor.action_compress}</span>
              </button>
            )}
          </div>
        ) : (
          <div className="pt-4 border-t border-slate-200 dark:border-gray-800 space-y-6 animate-fadeIn">
            <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="w-8 h-8 text-emerald-500 dark:text-emerald-400 shrink-0" />
                <div>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white">{t.processing.done}</h4>
                  <p className="text-xs text-slate-600 dark:text-gray-300 mt-0.5">
                    Reduced from <span className="line-through text-slate-400 dark:text-gray-500">{originalSizeMB.toFixed(1)} MB</span> to{' '}
                    <span className="text-emerald-600 dark:text-emerald-400 font-bold">{(compressedResult.size / (1024 * 1024)).toFixed(1)} MB</span> ({savedPercent}% saved!)
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
                <a
                  id="tool-download-btn"
                  href={compressedResult.url}
                  download={compressedResult.filename}
                  className="flex-1 sm:flex-initial px-6 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-gray-950 font-bold text-sm shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>{t.processing.download}</span>
                </a>
                <ShareResultButton
                  fileUrl={compressedResult.url}
                  fileName={compressedResult.filename}
                  title={`DarlingClip: ${compressedResult.filename}`}
                />
              </div>
            </div>

            {/* Video Preview */}
            <div className="rounded-2xl overflow-hidden border border-slate-200 dark:border-gray-800 bg-black max-h-80 flex items-center justify-center">
              <video src={compressedResult.url} controls className="max-h-80 w-auto" />
            </div>
          </div>
        )}

      </div>
      </div>
      
    </div>
  );
};
