import React, { useState } from 'react';
import { VideoFile } from '../types';
import { TranslationSchema } from '../translations';
import { Image, Download, CheckCircle2, RefreshCw, AlertCircle } from 'lucide-react';
import { VideoPlayerCard } from '../components/VideoPlayerCard';
import confetti from 'canvas-confetti';
import { processGifCreate } from '../lib/mediaProcessor';
import { memoryManager } from '../lib/memoryManager';
import { ShareResultButton } from '../components/ShareResultButton';

interface GifToolProps {
  video: VideoFile;
  onReset: () => void;
  t: TranslationSchema;
}

export const GifTool: React.FC<GifToolProps> = ({ video, onReset, t }) => {
  const [fps, setFps] = useState(15);
  const [width, setWidth] = useState(480);
  const [startTime, setStartTime] = useState(0);
  const [endTime, setEndTime] = useState(Math.min(10, video.duration || 10));
  const [loopMode, setLoopMode] = useState<'infinite' | 'once' | 'bounce'>('infinite');
  const [isProcessing, setIsProcessing] = useState(false);
  const [progressMsg, setProgressMsg] = useState('');
  const [gifResult, setGifResult] = useState<string | null>(null);
  const [gifError, setGifError] = useState<string | null>(null);

  const handleCreateGif = async () => {
    setIsProcessing(true);
    setGifError(null);
    setProgressMsg('Rendering animated GIF clip...');

    try {
      const blob = await processGifCreate(
        video.url,
        startTime,
        endTime,
        width,
        fps,
        loopMode,
        (pct, msg) => setProgressMsg(msg)
      );

      if (gifResult && gifResult !== video.url) {
        memoryManager.safeRevokeObjectURL(gifResult);
      }
      const resultUrl = memoryManager.safeCreateObjectURL(blob, 'gif-result', true);
      setGifResult(resultUrl);
      setIsProcessing(false);
      confetti({ particleCount: 70, spread: 60 });
    } catch (e) {
      // Honest failure: show the reason instead of relabelling the original video as a GIF
      setProgressMsg('');
      setGifError(e instanceof Error ? e.message : String(e));
      setIsProcessing(false);
    }
  };

  const selectedDuration = Math.max(0.5, endTime - startTime);

  return (
    <div className="w-full max-w-full space-y-6 lg:grid lg:grid-cols-12 lg:gap-8 lg:space-y-0 items-start">
      {/* Video Player Preview */}
      <div className="lg:col-span-6 xl:col-span-7 space-y-6 lg:sticky lg:top-24">
        <VideoPlayerCard video={video} onReset={onReset} t={t} title={`GIF Creator (${video.name})`} />
      </div>

      <div id="tool-settings-section" className="lg:col-span-6 xl:col-span-5 glass-card p-4 sm:p-6 rounded-3xl space-y-4 sm:space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <div className="flex justify-between text-xs font-semibold">
              <span className="text-slate-600 dark:text-gray-400">{t.gif.fps}</span>
              <span className="text-emerald-600 dark:text-emerald-400 font-bold">{fps} FPS</span>
            </div>
            <input
              type="range" min="5" max="30" value={fps} onChange={(e) => setFps(parseInt(e.target.value))}
              className="w-full accent-emerald-500 cursor-pointer h-2 bg-slate-200 dark:bg-gray-800 rounded-lg"
            />
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-xs font-semibold">
              <span className="text-slate-600 dark:text-gray-400">{t.gif.width}</span>
              <span className="text-emerald-600 dark:text-emerald-400 font-bold">{width} PX</span>
            </div>
            <input
              type="range" min="240" max="800" step="20" value={width} onChange={(e) => setWidth(parseInt(e.target.value))}
              className="w-full accent-emerald-500 cursor-pointer h-2 bg-slate-200 dark:bg-gray-800 rounded-lg"
            />
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-xs font-semibold">
              <span className="text-slate-600 dark:text-gray-400">Clip Start: {startTime.toFixed(1)}s</span>
              <span className="text-slate-600 dark:text-gray-400">Clip End: {endTime.toFixed(1)}s</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="range" min="0" max={video.duration} step="0.1" value={startTime}
                onChange={(e) => setStartTime(Math.min(parseFloat(e.target.value), endTime - 0.5))}
                className="w-full accent-emerald-500 cursor-pointer h-2 bg-slate-200 dark:bg-gray-800 rounded-lg"
              />
              <input
                type="range" min="0" max={video.duration} step="0.1" value={endTime}
                onChange={(e) => setEndTime(Math.max(parseFloat(e.target.value), startTime + 0.5))}
                className="w-full accent-emerald-500 cursor-pointer h-2 bg-slate-200 dark:bg-gray-800 rounded-lg"
              />
            </div>
            <p className="text-[11px] text-slate-500 dark:text-gray-500">GIF Clip Duration: {selectedDuration.toFixed(1)}s</p>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-600 dark:text-gray-400 block">GIF Loop Behavior & Speed</label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'infinite', label: 'Infinite Loop' },
                { id: 'once', label: 'Play Once' },
                { id: 'bounce', label: 'Bounce / Reverse' }
              ].map((lm) => (
                <button
                  key={lm.id}
                  type="button"
                  onClick={() => setLoopMode(lm.id as any)}
                  className={`py-2 px-1 rounded-xl text-[11px] font-bold border transition-all text-center ${
                    loopMode === lm.id
                      ? 'border-emerald-500 bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                      : 'border-slate-200 dark:border-gray-800 bg-slate-100 dark:bg-gray-900 text-slate-600 dark:text-gray-400'
                  }`}
                >
                  {lm.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {gifError ? (
          <div className="space-y-3">
            <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-start gap-3">
              <AlertCircle className="w-6 h-6 text-red-500 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-red-600 dark:text-red-400">GIF Creation Failed</h4>
                <p className="text-xs text-slate-600 dark:text-gray-300">{gifError}</p>
              </div>
            </div>
            <button
              onClick={() => { setGifError(null); handleCreateGif(); }}
              className="w-full py-3 rounded-2xl bg-slate-800 dark:bg-gray-700 hover:bg-slate-700 dark:hover:bg-gray-600 text-white font-bold text-sm flex items-center justify-center gap-2 transition-all"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Try Again</span>
            </button>
          </div>
        ) : !gifResult ? (
          <div className="space-y-2">
            {isProcessing && <p className="text-center text-xs text-emerald-500 font-semibold animate-pulse">{progressMsg}</p>}
            <button
              id="tool-primary-action-btn"
              onClick={handleCreateGif}
              disabled={isProcessing}
              className="w-full py-4 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-gray-950 font-extrabold text-base shadow-xl shadow-emerald-500/25 transition-all flex items-center justify-center gap-2"
            >
              <Image className="w-5 h-5" />
              <span>{isProcessing ? 'Generating Animated GIF...' : t.gif.action_create}</span>
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="p-3 bg-slate-900 border border-slate-800 rounded-2xl flex flex-col items-center justify-center">
              <span className="text-[11px] font-bold text-emerald-400 mb-2 uppercase tracking-wider">Generated GIF Preview</span>
              <img
                src={gifResult}
                alt="Generated animated GIF"
                className="max-h-64 rounded-xl object-contain shadow-md border border-slate-700/50"
              />
            </div>
            <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="w-8 h-8 text-emerald-500 dark:text-emerald-400 shrink-0" />
                <div>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white">GIF Generated!</h4>
                  <p className="text-xs text-slate-600 dark:text-gray-300 mt-0.5">{width}px wide • {fps} FPS • {loopMode.toUpperCase()}</p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
                <a
                  id="tool-download-btn"
                  href={gifResult}
                  download={`gif_${video.name.replace(/\.[^/.]+$/, "")}.gif`}
                  className="flex-1 sm:flex-initial px-6 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-gray-950 font-bold text-sm shadow-lg flex items-center justify-center gap-2 cursor-pointer transition-all"
                >
                  <Download className="w-4 h-4" />
                  <span>{t.processing.download} (.GIF)</span>
                </a>
                <ShareResultButton
                  fileUrl={gifResult}
                  fileName={`gif_${video.name.replace(/\.[^/.]+$/, "")}.gif`}
                  mimeType="image/gif"
                  title={`DarlingClip GIF: ${video.name}`}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
