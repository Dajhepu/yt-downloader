import React from 'react';
import { SubtitleCue } from '../../types';
import { formatTimeMinutesSeconds } from './subtitleConstants';
import {
  Sliders, RotateCcw, SkipBack, SkipForward,
  Clock, Zap, Sparkles, Check
} from 'lucide-react';

interface SubtitleNavPanelProps {
  currentTime: number;
  totalDuration: number;
  cues: SubtitleCue[];
  totalDelayOffset: number;
  isSyncingAudio: boolean;
  syncFeedback: string | null;
  st: any;
  onSeekToTime: (time: number) => void;
  onJumpTime: (deltaSec: number) => void;
  onJumpToPrevCue: () => void;
  onJumpToNextCue: () => void;
  onFixEarlySubtitles: (amountSec?: number) => void;
  onShiftAllTime: (deltaSec: number) => void;
  onResetOffset: () => void;
  onAutoSyncToVoice: () => void;
}

export const SubtitleNavPanel: React.FC<SubtitleNavPanelProps> = ({
  currentTime,
  totalDuration,
  cues,
  totalDelayOffset,
  isSyncingAudio,
  syncFeedback,
  st,
  onSeekToTime,
  onJumpTime,
  onJumpToPrevCue,
  onJumpToNextCue,
  onFixEarlySubtitles,
  onShiftAllTime,
  onResetOffset,
  onAutoSyncToVoice,
}) => {
  return (
    <div className="p-3 bg-slate-100 dark:bg-gray-900/90 rounded-2xl border border-slate-200 dark:border-gray-800 text-xs space-y-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        {/* Quick Seek Jump Buttons */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[11px] font-bold text-slate-500 dark:text-gray-400 mr-1 flex items-center gap-1">
            <Sliders className="w-3.5 h-3.5 text-emerald-500" />
            <span>{st.player.quickSeek}</span>
          </span>
          <button
            type="button"
            onClick={() => onSeekToTime(0)}
            className="px-2 py-1 rounded-lg bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-700 font-semibold hover:border-emerald-500 text-slate-700 dark:text-gray-200 transition-colors flex items-center gap-1 cursor-pointer"
            title={st.player.jumpStart}
          >
            <RotateCcw className="w-3 h-3 text-emerald-500" />
            <span>0:00</span>
          </button>
          <button
            type="button"
            onClick={() => onJumpTime(-5)}
            className="px-2 py-1 rounded-lg bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-700 font-semibold hover:border-emerald-500 text-slate-700 dark:text-gray-200 transition-colors cursor-pointer"
            title="-5s (←)"
          >
            -5s
          </button>
          <button
            type="button"
            onClick={() => onJumpTime(-1)}
            className="px-2 py-1 rounded-lg bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-700 font-semibold hover:border-emerald-500 text-slate-700 dark:text-gray-200 transition-colors cursor-pointer"
            title="-1s (Shift + ←)"
          >
            -1s
          </button>
          <button
            type="button"
            onClick={() => onJumpTime(1)}
            className="px-2 py-1 rounded-lg bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-700 font-semibold hover:border-emerald-500 text-slate-700 dark:text-gray-200 transition-colors cursor-pointer"
            title="+1s (Shift + →)"
          >
            +1s
          </button>
          <button
            type="button"
            onClick={() => onJumpTime(5)}
            className="px-2 py-1 rounded-lg bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-700 font-semibold hover:border-emerald-500 text-slate-700 dark:text-gray-200 transition-colors cursor-pointer"
            title="+5s (→)"
          >
            +5s
          </button>
          {cues.length > 0 && (
            <>
              <button
                type="button"
                onClick={onJumpToPrevCue}
                className="px-2 py-1 rounded-lg bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-700 font-semibold hover:border-emerald-500 text-slate-700 dark:text-gray-200 transition-colors flex items-center gap-1 cursor-pointer"
                title={st.player.prevCue}
              >
                <SkipBack className="w-3 h-3 text-emerald-500" />
                <span className="hidden sm:inline">{st.player.prevCue}</span>
              </button>
              <button
                type="button"
                onClick={onJumpToNextCue}
                className="px-2 py-1 rounded-lg bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-700 font-semibold hover:border-emerald-500 text-slate-700 dark:text-gray-200 transition-colors flex items-center gap-1 cursor-pointer"
                title={st.player.nextCue}
              >
                <span className="hidden sm:inline">{st.player.nextCue}</span>
                <SkipForward className="w-3 h-3 text-emerald-500" />
              </button>
            </>
          )}
        </div>

        {/* Keyboard Shortcuts Hint */}
        <div className="text-[11px] text-slate-500 dark:text-gray-400 font-mono hidden md:flex items-center gap-2">
          <span className="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-gray-800 font-bold text-slate-700 dark:text-gray-300">Space</span>
          <span>{st.player.play}</span>
          <span>•</span>
          <span className="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-gray-800 font-bold text-slate-700 dark:text-gray-300">← / →</span>
          <span>{st.player.quickSeek}</span>
          <span>•</span>
          <span className="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-gray-800 font-bold text-slate-700 dark:text-gray-300">J / L</span>
          <span>10s</span>
        </div>
      </div>

      {/* Continuous Range Scrubber Slider (Accessible) */}
      <div className="flex items-center gap-2.5 pt-1">
        <span className="text-[10px] font-mono text-slate-500 dark:text-gray-400 font-bold w-12 text-right">
          {formatTimeMinutesSeconds(currentTime)}
        </span>
        <input
          type="range"
          min={0}
          max={totalDuration}
          step={0.05}
          value={Math.min(totalDuration, currentTime)}
          onChange={(e) => onSeekToTime(parseFloat(e.target.value))}
          className="w-full h-1.5 bg-slate-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-emerald-500 hover:accent-emerald-400 transition-all"
          title={st.player.scrubTooltip}
        />
        <span className="text-[10px] font-mono text-slate-500 dark:text-gray-400 font-bold w-12">
          {formatTimeMinutesSeconds(totalDuration)}
        </span>
      </div>

      {/* Subtitle-Voice Alignment & Delay Controls */}
      {cues.length > 0 && (
        <div className="pt-2.5 border-t border-slate-200 dark:border-gray-800 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] font-bold text-slate-700 dark:text-gray-300 flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-emerald-500" />
              <span>{st.introSync.timeShift}</span>
            </span>

            {/* 1-Click Fix for Early Subtitles */}
            <button
              type="button"
              onClick={() => onFixEarlySubtitles(0.5)}
              className="px-2.5 py-1 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/50 text-emerald-700 dark:text-emerald-300 font-bold text-[11px] flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
              title={st.introSync.delayHalfSec}
            >
              <Zap className="w-3.5 h-3.5 text-emerald-500 fill-emerald-500/20" />
              <span>{st.introSync.delayHalfSec}</span>
            </button>

            {/* Quick Shift Step Buttons */}
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => onShiftAllTime(-0.5)}
                className="px-1.5 py-0.5 rounded-lg bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-700 font-mono font-bold text-[10px] text-slate-700 dark:text-gray-300 hover:border-emerald-500 transition-colors cursor-pointer"
                title="-0.5s"
              >
                -0.5s
              </button>
              <button
                type="button"
                onClick={() => onShiftAllTime(-0.2)}
                className="px-1.5 py-0.5 rounded-lg bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-700 font-mono font-bold text-[10px] text-slate-700 dark:text-gray-300 hover:border-emerald-500 transition-colors cursor-pointer"
                title="-0.2s"
              >
                -0.2s
              </button>
              <button
                type="button"
                onClick={() => onShiftAllTime(0.2)}
                className="px-1.5 py-0.5 rounded-lg bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-700 font-mono font-bold text-[10px] text-slate-700 dark:text-gray-300 hover:border-emerald-500 transition-colors cursor-pointer"
                title="+0.2s"
              >
                +0.2s
              </button>
              <button
                type="button"
                onClick={() => onShiftAllTime(0.5)}
                className="px-1.5 py-0.5 rounded-lg bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-700 font-mono font-bold text-[10px] text-slate-700 dark:text-gray-300 hover:border-emerald-500 transition-colors cursor-pointer"
                title="+0.5s"
              >
                +0.5s
              </button>
              <button
                type="button"
                onClick={() => onShiftAllTime(1.0)}
                className="px-1.5 py-0.5 rounded-lg bg-white dark:bg-gray-800 border border-slate-200 dark:border-gray-700 font-mono font-bold text-[10px] text-slate-700 dark:text-gray-300 hover:border-emerald-500 transition-colors cursor-pointer"
                title="+1.0s"
              >
                +1.0s
              </button>

              {totalDelayOffset !== 0 && (
                <button
                  type="button"
                  onClick={onResetOffset}
                  className="px-2 py-0.5 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-600 dark:text-rose-400 font-mono font-bold text-[10px] transition-colors cursor-pointer"
                  title={st.introSync.reset}
                >
                  Reset ({totalDelayOffset > 0 ? `+${totalDelayOffset}s` : `${totalDelayOffset}s`})
                </button>
              )}
            </div>
          </div>

          {/* VAD Auto Sync Button */}
          <button
            type="button"
            onClick={onAutoSyncToVoice}
            disabled={isSyncingAudio}
            className="px-2.5 py-1 rounded-xl bg-teal-500/15 hover:bg-teal-500/25 border border-teal-500/30 text-teal-700 dark:text-teal-300 font-bold text-[11px] flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
            title={st.introSync.autoVadSync}
          >
            <Sparkles className="w-3.5 h-3.5 text-teal-500" />
            <span>
              {isSyncingAudio
                ? st.introSync.analyzingVad
                : st.introSync.autoVadSync}
            </span>
          </button>
        </div>
      )}

      {/* Sync Feedback Toast */}
      {syncFeedback && (
        <div className="px-3 py-1.5 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-800 dark:text-emerald-300 font-bold text-xs flex items-center gap-2 animate-fadeIn">
          <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
          <span>{syncFeedback}</span>
        </div>
      )}
    </div>
  );
};
