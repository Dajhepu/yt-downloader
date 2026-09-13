import React, { useState } from 'react';
import { VideoFile } from '../types';
import { TranslationSchema } from '../translations';
import { RefreshCw, Download, CheckCircle2, FileType, AlertCircle } from 'lucide-react';
import { VideoPlayerCard } from '../components/VideoPlayerCard';
import confetti from 'canvas-confetti';
import { processVideoConvert } from '../lib/mediaProcessor';
import { memoryManager } from '../lib/memoryManager';
import { ShareResultButton } from '../components/ShareResultButton';

interface ConverterToolProps {
  video: VideoFile;
  onReset: () => void;
  t: TranslationSchema;
}

export const ConverterTool: React.FC<ConverterToolProps> = ({ video, onReset, t }) => {
  const [targetFormat, setTargetFormat] = useState<'mp4' | 'webm'>('mp4');
  const [preset, setPreset] = useState<'ultrafast' | 'medium' | 'high_quality'>('medium');
  const [removeAudio, setRemoveAudio] = useState(false);
  const [resolution, setResolution] = useState<'original' | '1080p' | '720p'>('original');
  const [isProcessing, setIsProcessing] = useState(false);
  const [progressMsg, setProgressMsg] = useState('');
  const [convertedResult, setConvertedResult] = useState<string | null>(null);
  const [convertError, setConvertError] = useState<string | null>(null);

  const handleConvert = async () => {
    setIsProcessing(true);
    setConvertError(null);
    setProgressMsg('Initializing client-side video transcode...');

    try {
      const blob = await processVideoConvert(
        video.url,
        targetFormat,
        resolution,
        removeAudio,
        preset,
        (pct, msg) => setProgressMsg(msg)
      );

      if (convertedResult && convertedResult !== video.url) {
        memoryManager.safeRevokeObjectURL(convertedResult);
      }
      const resultUrl = memoryManager.safeCreateObjectURL(blob, 'converter-result', true);
      setConvertedResult(resultUrl);
      setIsProcessing(false);
      confetti({ particleCount: 70, spread: 60 });
    } catch (e) {
      // Honest failure: show the reason instead of relabelling the original video
      setProgressMsg('');
      setConvertError(e instanceof Error ? e.message : String(e));
      setIsProcessing(false);
    }
  };

  const formats = [
    { id: 'mp4', label: 'MP4 (Universal)', desc: 'Works on iOS, Android, Web & Messengers' },
    { id: 'webm', label: 'WEBM (Web Optimized)', desc: 'Ultra-compressed for modern web browsers' }
  ];

  return (
    <div className="w-full max-w-full space-y-6 lg:grid lg:grid-cols-12 lg:gap-8 lg:space-y-0 items-start">
      {/* Video Player Preview */}
      <div className="lg:col-span-6 xl:col-span-7 space-y-6 lg:sticky lg:top-24">
        <VideoPlayerCard video={video} onReset={onReset} t={t} title={`Convert Video Format (${video.name})`} />
      </div>

      <div id="tool-settings-section" className="lg:col-span-6 xl:col-span-5 glass-card p-4 sm:p-6 rounded-3xl space-y-4 sm:space-y-6">
        <label className="text-xs font-bold text-slate-500 dark:text-gray-400 tracking-wider uppercase block">{t.converter.target_format}</label>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {formats.map((fmt) => (
            <button
              key={fmt.id}
              type="button"
              onClick={() => setTargetFormat(fmt.id as any)}
              className={`p-4 rounded-2xl border text-left transition-all ${
                targetFormat === fmt.id
                  ? 'border-emerald-500 bg-emerald-500/15 text-slate-900 dark:text-white shadow-lg'
                  : 'border-slate-200 dark:border-gray-800 bg-slate-100/50 dark:bg-gray-900/60 text-slate-600 dark:text-gray-400 hover:border-slate-300 dark:hover:border-gray-700'
              }`}
            >
              <div className="flex items-center gap-2">
                <FileType className={`w-5 h-5 ${targetFormat === fmt.id ? 'text-emerald-500 dark:text-emerald-400' : 'text-slate-400 dark:text-gray-500'}`} />
                <span className="font-bold text-sm text-slate-900 dark:text-white">{fmt.label}</span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-gray-500 mt-1">{fmt.desc}</p>
            </button>
          ))}
        </div>

        {/* Detailed Encoder Tuning */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-600 dark:text-gray-400 block">Encoder Speed Preset</label>
            <select
              value={preset}
              onChange={(e) => setPreset(e.target.value as any)}
              className="w-full px-3 py-2 bg-slate-100 dark:bg-gray-900 border border-slate-200 dark:border-gray-800 rounded-xl text-xs font-semibold text-slate-800 dark:text-gray-200"
            >
              <option value="ultrafast">Ultrafast (Instant Conversion)</option>
              <option value="medium">Medium (Balanced Quality)</option>
              <option value="high_quality">High Quality (Max Fidelity)</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-600 dark:text-gray-400 block">Target Resolution</label>
            <select
              value={resolution}
              onChange={(e) => setResolution(e.target.value as any)}
              className="w-full px-3 py-2 bg-slate-100 dark:bg-gray-900 border border-slate-200 dark:border-gray-800 rounded-xl text-xs font-semibold text-slate-800 dark:text-gray-200"
            >
              <option value="original">Keep Original ({video.width}x{video.height})</option>
              <option value="1080p">Downscale to 1080p</option>
              <option value="720p">Downscale to 720p</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-600 dark:text-gray-400 block">Audio Stream</label>
            <button
              type="button"
              onClick={() => setRemoveAudio(!removeAudio)}
              className={`w-full py-2 px-3 rounded-xl text-xs font-bold border transition-all ${
                removeAudio
                  ? 'border-rose-500 bg-rose-500/15 text-rose-600 dark:text-rose-400'
                  : 'border-slate-200 dark:border-gray-800 bg-slate-100 dark:bg-gray-900 text-slate-700 dark:text-gray-300'
              }`}
            >
              {removeAudio ? 'Mute / Remove Audio Track' : 'Keep Audio Stream Active'}
            </button>
          </div>
        </div>

        {convertError ? (
          <div className="space-y-3">
            <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-start gap-3">
              <AlertCircle className="w-6 h-6 text-red-500 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-red-600 dark:text-red-400">Conversion Failed</h4>
                <p className="text-xs text-slate-600 dark:text-gray-300">{convertError}</p>
              </div>
            </div>
            <button
              onClick={() => { setConvertError(null); handleConvert(); }}
              className="w-full py-3 rounded-2xl bg-slate-800 dark:bg-gray-700 hover:bg-slate-700 dark:hover:bg-gray-600 text-white font-bold text-sm flex items-center justify-center gap-2 transition-all"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Try Again</span>
            </button>
          </div>
        ) : !convertedResult ? (
          <div className="space-y-2">
            {isProcessing && <p className="text-center text-xs text-emerald-500 font-semibold animate-pulse">{progressMsg}</p>}
            <button
              id="tool-primary-action-btn"
              onClick={handleConvert}
              disabled={isProcessing}
              className="w-full py-4 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-gray-950 font-extrabold text-base shadow-xl shadow-emerald-500/25 transition-all flex items-center justify-center gap-2"
            >
              <RefreshCw className={`w-5 h-5 ${isProcessing ? 'animate-spin' : ''}`} />
              <span>{isProcessing ? 'Converting Format...' : t.converter.action_convert}</span>
            </button>
          </div>
        ) : (
          <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-8 h-8 text-emerald-500 dark:text-emerald-400 shrink-0" />
              <div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-white">Converted to .{targetFormat.toUpperCase()}!</h4>
                <p className="text-xs text-slate-600 dark:text-gray-300 mt-0.5">Preset: {preset.replace('_', ' ')} • Ready for instant download.</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
              <a
                id="tool-download-btn"
                href={convertedResult}
                download={`converted_${video.name.replace(/\.[^/.]+$/, "")}.${targetFormat}`}
                className="flex-1 sm:flex-initial px-6 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-gray-950 font-bold text-sm shadow-lg flex items-center justify-center gap-2 cursor-pointer transition-all"
              >
                <Download className="w-4 h-4" />
                <span>{t.processing.download}</span>
              </a>
              <ShareResultButton
                fileUrl={convertedResult}
                fileName={`converted_${video.name.replace(/\.[^/.]+$/, "")}.${targetFormat}`}
                title={`DarlingClip: converted_${video.name.replace(/\.[^/.]+$/, "")}.${targetFormat}`}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
