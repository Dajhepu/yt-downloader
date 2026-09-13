import React, { useState } from 'react';
import { VideoFile } from '../types';
import { TranslationSchema } from '../translations';
import { Music, Download, CheckCircle2, RefreshCw, Volume2, AlertCircle } from 'lucide-react';
import { VideoPlayerCard } from '../components/VideoPlayerCard';
import confetti from 'canvas-confetti';
import { processAudioExtract } from '../lib/mediaProcessor';
import { memoryManager } from '../lib/memoryManager';
import { ShareResultButton } from '../components/ShareResultButton';

interface AudioExtractorToolProps {
  video: VideoFile;
  onReset: () => void;
  t: TranslationSchema;
}

export const AudioExtractorTool: React.FC<AudioExtractorToolProps> = ({ video, onReset, t }) => {
  const [audioFormat, setAudioFormat] = useState<'mp3' | 'wav'>('mp3');
  const [bitrate, setBitrate] = useState<'128' | '192' | '256' | '320'>('192');
  const [channels, setChannels] = useState<'stereo' | 'mono'>('stereo');
  const [volume, setVolume] = useState<number>(100);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progressMsg, setProgressMsg] = useState('');
  const [audioResult, setAudioResult] = useState<string | null>(null);
  const [actualFormat, setActualFormat] = useState<'mp3' | 'wav'>('mp3');
  const [extractError, setExtractError] = useState<string | null>(null);

  const handleExtractAudio = async () => {
    setIsProcessing(true);
    setExtractError(null);
    setProgressMsg('Extracting audio track via Web Audio API...');

    try {
      const volumeMultiplier = volume / 100;
      const blob = await processAudioExtract(
        video.url,
        audioFormat,
        parseInt(bitrate),
        channels,
        volumeMultiplier,
        (pct, msg) => setProgressMsg(msg)
      );

      // Detect the REAL container we produced (engine may fall back WAV↔MP3)
      const realFormat: 'mp3' | 'wav' = blob.type === 'audio/mpeg' ? 'mp3' : 'wav';

      if (audioResult && audioResult !== video.url) {
        memoryManager.safeRevokeObjectURL(audioResult);
      }
      const audioUrl = memoryManager.safeCreateObjectURL(blob, 'audio-extractor-result', true);
      setAudioResult(audioUrl);
      setActualFormat(realFormat);
      setIsProcessing(false);
      confetti({ particleCount: 70, spread: 60 });
    } catch (e) {
      // Honest failure: show the reason, never hand back the source video as "audio"
      const reason = e instanceof Error ? e.message : String(e);
      setProgressMsg('');
      setExtractError(
        `Audio extraction failed: ${reason}` +
        (reason.toLowerCase().includes('decode') || reason.toLowerCase().includes('audio')
          ? ' — this file may have no audio track or an unsupported codec.'
          : '')
      );
      setIsProcessing(false);
    }
  };

  return (
    <div className="w-full max-w-full space-y-6 lg:grid lg:grid-cols-12 lg:gap-8 lg:space-y-0 items-start">
      {/* Video Player Preview */}
      <div className="lg:col-span-6 xl:col-span-7 space-y-6 lg:sticky lg:top-24">
        <VideoPlayerCard video={video} onReset={onReset} t={t} title={`Audio Extractor (${video.name})`} />
      </div>

      <div id="tool-settings-section" className="lg:col-span-6 xl:col-span-5 glass-card p-4 sm:p-6 rounded-3xl space-y-4 sm:space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* Format buttons */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-600 dark:text-gray-400 block">{t.audio.format}</label>
            <div className="grid grid-cols-2 gap-2">
              {(['mp3', 'wav'] as const).map((fmt) => (
                <button
                  key={fmt}
                  type="button"
                  onClick={() => setAudioFormat(fmt)}
                  className={`py-2 rounded-xl text-xs font-bold uppercase border transition-all ${
                    audioFormat === fmt 
                      ? 'border-emerald-500 bg-emerald-500/20 text-emerald-600 dark:text-emerald-400' 
                      : 'border-slate-200 dark:border-gray-800 bg-slate-100 dark:bg-gray-900 text-slate-600 dark:text-gray-400'
                  }`}
                >
                  .{fmt}
                </button>
              ))}
            </div>
          </div>

          {/* Bitrate selection (MP3 only — WAV is lossless/PCM) */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-600 dark:text-gray-400 block">{t.audio.bitrate}</label>
            <select
              value={bitrate}
              onChange={(e) => setBitrate(e.target.value as any)}
              disabled={audioFormat !== 'mp3'}
              className={`w-full px-4 py-2.5 bg-slate-100 dark:bg-gray-900 border border-slate-200 dark:border-gray-800 rounded-xl text-xs text-slate-800 dark:text-gray-200 font-semibold focus:border-emerald-500 focus:outline-none ${
                audioFormat !== 'mp3' ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              <option value="320">320 kbps (Studio High Fidelity)</option>
              <option value="256">256 kbps (Premium Audio)</option>
              <option value="192">192 kbps (Standard Music Quality)</option>
              <option value="128">128 kbps (Compact Audio)</option>
            </select>
            {audioFormat !== 'mp3' && (
              <p className="text-[10px] text-slate-500 dark:text-gray-500">WAV is uncompressed PCM — bitrate applies to MP3 only.</p>
            )}
          </div>

          {/* Volume Gain Boost */}
          <div className="space-y-2">
            <div className="flex justify-between text-xs font-semibold">
              <span className="text-slate-600 dark:text-gray-400 flex items-center gap-1">
                <Volume2 className="w-3.5 h-3.5 text-emerald-500" />
                <span>Volume Gain / Boost</span>
              </span>
              <span className="text-emerald-600 dark:text-emerald-400 font-bold">{volume}%</span>
            </div>
            <input
              type="range" min="50" max="200" step="5" value={volume}
              onChange={(e) => setVolume(parseInt(e.target.value))}
              className="w-full accent-emerald-500 cursor-pointer h-2 bg-slate-200 dark:bg-gray-800 rounded-lg"
            />
          </div>

          {/* Stereo / Mono Channels */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-600 dark:text-gray-400 block">Audio Channels</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setChannels('stereo')}
                className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all ${
                  channels === 'stereo'
                    ? 'border-emerald-500 bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                    : 'border-slate-200 dark:border-gray-800 bg-slate-100 dark:bg-gray-900 text-slate-600 dark:text-gray-400'
                }`}
              >
                Stereo (2 Channels)
              </button>
              <button
                type="button"
                onClick={() => setChannels('mono')}
                className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all ${
                  channels === 'mono'
                    ? 'border-emerald-500 bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                    : 'border-slate-200 dark:border-gray-800 bg-slate-100 dark:bg-gray-900 text-slate-600 dark:text-gray-400'
                }`}
              >
                Mono (Single Channel)
              </button>
            </div>
          </div>

        </div>

        {extractError ? (
          <div className="space-y-3">
            <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-start gap-3">
              <AlertCircle className="w-6 h-6 text-red-500 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-red-600 dark:text-red-400">Audio Extraction Failed</h4>
                <p className="text-xs text-slate-600 dark:text-gray-300">{extractError}</p>
              </div>
            </div>
            <button
              onClick={() => { setExtractError(null); handleExtractAudio(); }}
              className="w-full py-3 rounded-2xl bg-slate-800 dark:bg-gray-700 hover:bg-slate-700 dark:hover:bg-gray-600 text-white font-bold text-sm flex items-center justify-center gap-2 transition-all"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Try Again</span>
            </button>
          </div>
        ) : !audioResult ? (
          <div className="space-y-2">
            {isProcessing && <p className="text-center text-xs text-emerald-500 font-semibold">{progressMsg}</p>}
            <button
              id="tool-primary-action-btn"
              onClick={handleExtractAudio}
              disabled={isProcessing}
              className="w-full py-4 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-gray-950 font-extrabold text-base shadow-xl shadow-emerald-500/25 transition-all flex items-center justify-center gap-2"
            >
              <Music className="w-5 h-5" />
              <span>{isProcessing ? 'Extracting Audio Track...' : t.audio.action_extract}</span>
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="p-3 bg-slate-900 border border-slate-800 rounded-2xl flex flex-col items-center justify-center space-y-2">
              <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider">Audio Playback Preview</span>
              <audio controls src={audioResult} className="w-full rounded-xl" />
            </div>
            <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="w-8 h-8 text-emerald-500 dark:text-emerald-400 shrink-0" />
                <div>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white">Audio Track Extracted!</h4>
                  <p className="text-xs text-slate-600 dark:text-gray-300 mt-0.5">Format: .{actualFormat.toUpperCase()}{actualFormat === 'mp3' ? ` (${bitrate} kbps, ${channels}, ${volume}% vol)` : ` (lossless PCM, ${channels}, ${volume}% vol)`}</p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
                <a
                  id="tool-download-btn"
                  href={audioResult}
                  download={`audio_${video.name.replace(/\.[^/.]+$/, "")}.${actualFormat}`}
                  className="flex-1 sm:flex-initial px-6 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-gray-950 font-bold text-sm shadow-lg flex items-center justify-center gap-2 cursor-pointer transition-all"
                >
                  <Download className="w-4 h-4" />
                  <span>{t.processing.download}</span>
                </a>
                <ShareResultButton
                  fileUrl={audioResult}
                  fileName={`audio_${video.name.replace(/\.[^/.]+$/, "")}.${actualFormat}`}
                  mimeType={actualFormat === 'mp3' ? 'audio/mp3' : 'audio/wav'}
                  title={`DarlingClip Audio: ${video.name}`}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
