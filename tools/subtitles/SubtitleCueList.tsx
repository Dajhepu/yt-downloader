import React from 'react';
import { SubtitleCue } from '../../types';
import {
  FileText, Download, Plus, Music, MapPin, Clock, Zap,
  Sparkles, Scissors, Subtitles, Play, Trash2
} from 'lucide-react';
import { INTRO_DELAY_PRESETS } from './subtitleConstants';

interface SubtitleCueListProps {
  cues: SubtitleCue[];
  currentTime: number;
  totalDelayOffset: number;
  isSyncingAudio: boolean;
  st: any;
  onSeekToTime: (time: number) => void;
  onUpdateCue: (id: string, field: 'startTime' | 'endTime' | 'text', val: any) => void;
  onDeleteCue: (id: string) => void;
  onAddCue: () => void;
  onExportSrt: () => void;
  onExportVtt: () => void;
  onAlignFirstCueToCurrentTime: () => void;
  onSetIntroDelay: (targetStartTime: number) => void;
  onFixEarlySubtitles: (amountSec?: number) => void;
  onShiftAllTime: (deltaSec: number) => void;
  onResetOffset: () => void;
  onAutoSyncToVoice: () => void;
  onSplitLongCues: () => void;
}

export const SubtitleCueList: React.FC<SubtitleCueListProps> = ({
  cues,
  currentTime,
  totalDelayOffset,
  isSyncingAudio,
  st,
  onSeekToTime,
  onUpdateCue,
  onDeleteCue,
  onAddCue,
  onExportSrt,
  onExportVtt,
  onAlignFirstCueToCurrentTime,
  onSetIntroDelay,
  onFixEarlySubtitles,
  onShiftAllTime,
  onResetOffset,
  onAutoSyncToVoice,
  onSplitLongCues
}) => {
  return (
    <div className="glass-card p-4 sm:p-6 rounded-3xl border border-slate-200 dark:border-gray-800 space-y-4 shadow-xl">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-emerald-500" />
          <h4 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white">
            {st.cuesList.title}
          </h4>
        </div>

        <div className="flex items-center gap-2">
          {/* Export SRT */}
          <button
            onClick={onExportSrt}
            disabled={cues.length === 0}
            className="px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-gray-900 hover:bg-emerald-500/15 hover:text-emerald-500 text-slate-700 dark:text-gray-300 font-bold text-xs flex items-center gap-1 transition-colors border border-slate-200 dark:border-gray-800 disabled:opacity-40 cursor-pointer"
            title="Export to .SRT"
          >
            <Download className="w-3.5 h-3.5" />
            <span>.SRT</span>
          </button>

          {/* Export VTT */}
          <button
            onClick={onExportVtt}
            disabled={cues.length === 0}
            className="px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-gray-900 hover:bg-emerald-500/15 hover:text-emerald-500 text-slate-700 dark:text-gray-300 font-bold text-xs flex items-center gap-1 transition-colors border border-slate-200 dark:border-gray-800 disabled:opacity-40 cursor-pointer"
            title="Export to .VTT"
          >
            <Download className="w-3.5 h-3.5" />
            <span>.VTT</span>
          </button>

          {/* Add Cue Button */}
          <button
            onClick={onAddCue}
            className="px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-gray-950 font-extrabold text-xs flex items-center gap-1 transition-all shadow-sm cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{st.actions.addCue}</span>
          </button>
        </div>
      </div>

      {/* Quick Action Tools: Time Shift & Split Cues */}
      {cues.length > 0 && (
        <div className="p-3 rounded-2xl bg-slate-50 dark:bg-gray-950 border border-slate-200 dark:border-gray-800 text-xs space-y-3">
          {/* Intro Music & Speech Onset Control */}
          <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <Music className="w-3.5 h-3.5 text-amber-500" />
                <span className="font-extrabold text-[12px] text-amber-900 dark:text-amber-200">
                  {st.introSync.title}:
                </span>
                <span className="px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-800 dark:text-amber-200 font-mono font-bold text-[11px]">
                  {st.introSync.firstCue}: {cues[0]?.startTime.toFixed(2)}s
                </span>
              </div>

              {/* Snap to current player video time */}
              <button
                type="button"
                onClick={onAlignFirstCueToCurrentTime}
                className="px-2.5 py-1 rounded-xl bg-amber-500 hover:bg-amber-400 text-gray-950 font-extrabold text-[11px] flex items-center gap-1.5 transition-all shadow-sm cursor-pointer"
                title={st.introSync.snapTooltip}
              >
                <MapPin className="w-3.5 h-3.5 fill-current" />
                <span>
                  {`${st.introSync.snapBtn} (${currentTime.toFixed(1)}s)`}
                </span>
              </button>
            </div>

            {/* Preset quick buttons for common intro durations */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[11px] font-semibold text-slate-600 dark:text-gray-400">
                {st.introSync.presetDelay}:
              </span>
              {INTRO_DELAY_PRESETS.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => onSetIntroDelay(t)}
                  className={`px-2 py-0.5 rounded-lg border font-mono font-bold text-[11px] transition-all cursor-pointer ${
                    Math.abs((cues[0]?.startTime || 0) - t) < 0.1
                      ? 'bg-amber-500 border-amber-500 text-gray-950 shadow-sm'
                      : 'bg-white dark:bg-gray-900 border-slate-200 dark:border-gray-800 text-slate-700 dark:text-gray-300 hover:border-amber-500'
                  }`}
                >
                  {t === 0 ? `0s (${st.introSync.fromStart})` : `${t}s`}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[11px] font-bold text-slate-600 dark:text-gray-300 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-emerald-500" />
                <span>{st.introSync.timeShift}</span>
              </span>

              <button
                type="button"
                onClick={() => onFixEarlySubtitles(0.5)}
                className="px-2 py-0.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/40 text-emerald-700 dark:text-emerald-300 font-bold text-[11px] flex items-center gap-1 transition-all cursor-pointer"
                title={st.introSync.delayHalfSec}
              >
                <Zap className="w-3 h-3 text-emerald-500" />
                <span>{st.introSync.delayHalfSec}</span>
              </button>
            </div>

            <div className="flex items-center gap-1 flex-wrap">
              <button
                onClick={() => onShiftAllTime(-0.5)}
                className="px-2 py-0.5 rounded-lg bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-800 font-mono font-bold text-[11px] hover:border-emerald-500 text-slate-700 dark:text-gray-300 transition-colors cursor-pointer"
                title="-0.5s"
              >
                -0.5s
              </button>
              <button
                onClick={() => onShiftAllTime(-0.2)}
                className="px-2 py-0.5 rounded-lg bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-800 font-mono font-bold text-[11px] hover:border-emerald-500 text-slate-700 dark:text-gray-300 transition-colors cursor-pointer"
                title="-0.2s"
              >
                -0.2s
              </button>
              <button
                onClick={() => onShiftAllTime(0.2)}
                className="px-2 py-0.5 rounded-lg bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-800 font-mono font-bold text-[11px] hover:border-emerald-500 text-slate-700 dark:text-gray-300 transition-colors cursor-pointer"
                title="+0.2s"
              >
                +0.2s
              </button>
              <button
                onClick={() => onShiftAllTime(0.5)}
                className="px-2 py-0.5 rounded-lg bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-800 font-mono font-bold text-[11px] hover:border-emerald-500 text-slate-700 dark:text-gray-300 transition-colors cursor-pointer"
                title="+0.5s"
              >
                +0.5s
              </button>
              <button
                onClick={() => onShiftAllTime(1.0)}
                className="px-2 py-0.5 rounded-lg bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-800 font-mono font-bold text-[11px] hover:border-emerald-500 text-slate-700 dark:text-gray-300 transition-colors cursor-pointer"
                title="+1.0s"
              >
                +1.0s
              </button>
              {totalDelayOffset !== 0 && (
                <button
                  onClick={onResetOffset}
                  className="px-2 py-0.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 font-mono font-bold text-[10px] transition-colors cursor-pointer"
                >
                  Reset ({totalDelayOffset > 0 ? `+${totalDelayOffset}s` : `${totalDelayOffset}s`})
                </button>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-200/60 dark:border-gray-800/60">
            <button
              onClick={onAutoSyncToVoice}
              disabled={isSyncingAudio}
              className="px-2.5 py-1 rounded-xl bg-teal-500/15 hover:bg-teal-500/25 border border-teal-500/30 text-teal-700 dark:text-teal-300 font-bold text-[11px] flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
            >
              <Sparkles className="w-3.5 h-3.5 text-teal-500" />
              <span>{isSyncingAudio ? st.introSync.analyzingVad : st.introSync.autoVadSync}</span>
            </button>

            <button
              onClick={onSplitLongCues}
              className="px-2.5 py-1 rounded-xl bg-yellow-500/15 hover:bg-yellow-500/25 border border-yellow-500/30 text-yellow-700 dark:text-yellow-400 font-bold text-[11px] flex items-center gap-1 transition-all cursor-pointer"
              title={st.timeline.splitTooltip}
            >
              <Scissors className="w-3.5 h-3.5" />
              <span>{st.timeline.splitForReels}</span>
            </button>
          </div>
        </div>
      )}

      {/* Cue List */}
      {cues.length === 0 ? (
        <div className="py-10 text-center space-y-2 border-2 border-dashed border-slate-200 dark:border-gray-800 rounded-2xl">
          <Subtitles className="w-8 h-8 mx-auto text-slate-400 dark:text-gray-600" />
          <p className="text-xs sm:text-sm font-semibold text-slate-600 dark:text-gray-400">
            {st.cuesList.noCues}
          </p>
        </div>
      ) : (
        <div className="space-y-2.5 max-h-[420px] overflow-y-auto pr-1">
          {cues.map((cue) => {
            const isCurrent = currentTime >= cue.startTime && currentTime <= cue.endTime;
            return (
              <div
                key={cue.id}
                className={`p-3 rounded-2xl border transition-all flex flex-col sm:flex-row items-start sm:items-center gap-2.5 ${
                  isCurrent
                    ? 'bg-emerald-500/10 border-emerald-500/50 shadow-md'
                    : 'bg-white/80 dark:bg-gray-900/60 border-slate-200 dark:border-gray-800/80 hover:border-slate-300 dark:hover:border-gray-700'
                }`}
              >
                {/* Play & Time Inputs */}
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => onSeekToTime(cue.startTime)}
                    className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors cursor-pointer ${
                      isCurrent
                        ? 'bg-emerald-500 text-gray-950 font-bold'
                        : 'bg-slate-100 dark:bg-gray-800 text-slate-600 dark:text-gray-300 hover:text-emerald-500'
                    }`}
                    title={st.player.jumpStart}
                  >
                    <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                  </button>

                  <div className="flex items-center gap-1 text-[11px] font-mono">
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      value={cue.startTime}
                      onChange={(e) => onUpdateCue(cue.id, 'startTime', parseFloat(e.target.value) || 0)}
                      className="w-14 bg-slate-50 dark:bg-gray-950 border border-slate-200 dark:border-gray-800 rounded-lg px-1.5 py-1 text-center font-bold text-slate-800 dark:text-gray-200"
                    />
                    <span className="text-slate-400">→</span>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      value={cue.endTime}
                      onChange={(e) => onUpdateCue(cue.id, 'endTime', parseFloat(e.target.value) || 0)}
                      className="w-14 bg-slate-50 dark:bg-gray-950 border border-slate-200 dark:border-gray-800 rounded-lg px-1.5 py-1 text-center font-bold text-slate-800 dark:text-gray-200"
                    />
                  </div>
                </div>

                {/* Text Input */}
                <div className="flex-1 w-full min-w-0">
                  <input
                    type="text"
                    value={cue.text}
                    onChange={(e) => onUpdateCue(cue.id, 'text', e.target.value)}
                    className="w-full bg-slate-50 dark:bg-gray-950 border border-slate-200 dark:border-gray-800 rounded-xl px-3 py-1.5 text-xs sm:text-sm font-semibold text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                    placeholder={st.actions.newCueText}
                  />
                </div>

                {/* Delete Button */}
                <button
                  onClick={() => onDeleteCue(cue.id)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 transition-colors self-end sm:self-center shrink-0 cursor-pointer"
                  title={st.cuesList.delete}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
