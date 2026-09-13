import React from 'react';
import { SubtitleCue } from '../../types';
import { formatTimeMinutesSeconds } from './subtitleConstants';
import {
  Play, Pause, Rewind, FastForward, SkipBack, SkipForward,
  Volume2, VolumeX, Minimize2, Maximize2
} from 'lucide-react';

interface SubtitleScrubberOverlayProps {
  scrubberTrackRef: React.RefObject<HTMLDivElement>;
  isPlaying: boolean;
  currentTime: number;
  totalDuration: number;
  cues: SubtitleCue[];
  activeCue: SubtitleCue | null;
  voiceTimeline: {
    hasSpeech: boolean;
    introMusicDuration: number;
    firstSpeechStart: number;
    speechSegmentsCount: number;
  } | null;
  isSeeking: boolean;
  hoverSeekTime: number | null;
  hoverSeekPos: number;
  hoverCue: SubtitleCue | null;
  playbackRate: number;
  isMuted: boolean;
  isFullscreen: boolean;
  st: any;
  onPlayPause: () => void;
  onScrubberPointerDown: (e: React.PointerEvent<HTMLDivElement>) => void;
  onScrubberPointerMove: (e: React.PointerEvent<HTMLDivElement>) => void;
  onScrubberPointerUp: (e: React.PointerEvent<HTMLDivElement>) => void;
  onScrubberPointerLeave: () => void;
  onJumpTime: (deltaSec: number) => void;
  onJumpToPrevCue: () => void;
  onJumpToNextCue: () => void;
  onSpeedChange: (rate: number) => void;
  onToggleMute: () => void;
  onToggleFullscreen: () => void;
}

export const SubtitleScrubberOverlay: React.FC<SubtitleScrubberOverlayProps> = ({
  scrubberTrackRef,
  isPlaying,
  currentTime,
  totalDuration,
  cues,
  activeCue,
  voiceTimeline,
  isSeeking,
  hoverSeekTime,
  hoverSeekPos,
  hoverCue,
  playbackRate,
  isMuted,
  isFullscreen,
  st,
  onPlayPause,
  onScrubberPointerDown,
  onScrubberPointerMove,
  onScrubberPointerUp,
  onScrubberPointerLeave,
  onJumpTime,
  onJumpToPrevCue,
  onJumpToNextCue,
  onSpeedChange,
  onToggleMute,
  onToggleFullscreen,
}) => {
  return (
    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/95 via-black/80 to-transparent p-3 pt-7 pointer-events-auto z-40 transition-opacity space-y-2">
      {/* 1. Interactive Seek Scrubber Bar with Cue Markers */}
      <div
        ref={scrubberTrackRef}
        onPointerDown={onScrubberPointerDown}
        onPointerMove={onScrubberPointerMove}
        onPointerUp={onScrubberPointerUp}
        onPointerLeave={onScrubberPointerLeave}
        className="relative w-full h-5 flex items-center cursor-pointer group select-none touch-none"
        title={st.player.scrubTooltip}
      >
        {/* Background Track Rail */}
        <div className="w-full h-2 rounded-full bg-white/20 group-hover:bg-white/30 backdrop-blur-sm overflow-hidden relative transition-all">
          {/* Speech / Audio VAD indication if available */}
          {voiceTimeline?.hasSpeech && (
            <div
              className="absolute top-0 bottom-0 bg-emerald-500/20"
              style={{
                left: `${(voiceTimeline.firstSpeechStart / totalDuration) * 100}%`,
                right: 0,
              }}
            />
          )}

          {/* Subtitle Cue Markers along timeline */}
          {cues.map((c) => {
            const leftPct = (c.startTime / totalDuration) * 100;
            const widthPct = Math.max(0.6, ((c.endTime - c.startTime) / totalDuration) * 100);
            return (
              <div
                key={c.id}
                className="absolute top-0 bottom-0 bg-emerald-400/80 rounded-[1px] pointer-events-none"
                style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
              />
            );
          })}

          {/* Played Progress Bar */}
          <div
            className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 relative"
            style={{ width: `${Math.min(100, (currentTime / totalDuration) * 100)}%` }}
          />
        </div>

        {/* Scrubber Playhead Handle */}
        <div
          className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 rounded-full bg-emerald-400 border-2 border-white shadow-lg pointer-events-none transition-transform ${
            isSeeking ? 'w-4 h-4 scale-125 ring-4 ring-emerald-500/40' : 'w-3 h-3 group-hover:scale-125'
          }`}
          style={{ left: `${Math.min(100, (currentTime / totalDuration) * 100)}%` }}
        />

        {/* Hover Timestamp & Subtitle Tooltip */}
        {hoverSeekTime !== null && (
          <div
            className="absolute -top-9 -translate-x-1/2 px-2 py-1 rounded-lg bg-slate-900/95 text-white text-[10px] font-mono border border-slate-700 shadow-xl pointer-events-none whitespace-nowrap z-50 flex items-center gap-1.5"
            style={{ left: `${Math.max(6, Math.min(94, hoverSeekPos))}%` }}
          >
            <span className="font-bold text-emerald-400">{formatTimeMinutesSeconds(hoverSeekTime)}</span>
            {hoverCue && (
              <span className="max-w-[140px] truncate text-slate-300 font-sans border-l border-slate-700 pl-1.5">
                {hoverCue.text}
              </span>
            )}
          </div>
        )}
      </div>

      {/* 2. Controls & Status Row */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-white/90">
        {/* Left: Play/Pause, Rewind -5s, Forward +5s, Prev/Next Cue, Time */}
        <div className="flex items-center gap-1 sm:gap-2">
          <button
            type="button"
            onClick={onPlayPause}
            className="p-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500 text-emerald-400 hover:text-gray-950 transition-colors cursor-pointer"
            title={isPlaying ? st.player.pause : st.player.play}
          >
            {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
          </button>

          <button
            type="button"
            onClick={() => onJumpTime(-5)}
            className="px-1.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white text-[10px] font-mono font-bold flex items-center gap-0.5 transition-colors cursor-pointer"
            title={st.player.seekBack}
          >
            <Rewind className="w-3 h-3" />
            <span>-5s</span>
          </button>

          <button
            type="button"
            onClick={() => onJumpTime(5)}
            className="px-1.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white text-[10px] font-mono font-bold flex items-center gap-0.5 transition-colors cursor-pointer"
            title={st.player.seekForward}
          >
            <span>+5s</span>
            <FastForward className="w-3 h-3" />
          </button>

          {/* Previous / Next Cue Jumpers */}
          <button
            type="button"
            onClick={onJumpToPrevCue}
            disabled={cues.length === 0}
            className="p-1 rounded-lg bg-white/10 hover:bg-white/20 disabled:opacity-30 text-white text-xs transition-colors hidden xs:flex items-center cursor-pointer"
            title={st.player.prevCue}
          >
            <SkipBack className="w-3 h-3" />
          </button>

          <button
            type="button"
            onClick={onJumpToNextCue}
            disabled={cues.length === 0}
            className="p-1 rounded-lg bg-white/10 hover:bg-white/20 disabled:opacity-30 text-white text-xs transition-colors hidden xs:flex items-center cursor-pointer"
            title={st.player.nextCue}
          >
            <SkipForward className="w-3 h-3" />
          </button>

          {/* Time Digits */}
          <div className="font-mono text-[11px] font-semibold text-slate-200 px-1 whitespace-nowrap">
            <span className="text-emerald-400 font-bold">{formatTimeMinutesSeconds(currentTime)}</span>
            <span className="text-white/50"> / </span>
            <span className="text-slate-300">{formatTimeMinutesSeconds(totalDuration)}</span>
          </div>
        </div>

        {/* Right: Active Cue Badge, Speed Selector, Mute, Theater & Fullscreen */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Active Cue Status */}
          <div className="hidden md:flex items-center font-sans text-[10px] font-bold px-2 py-0.5 rounded-md bg-white/10 backdrop-blur-sm">
            {activeCue ? (
              <span className="text-emerald-400 flex items-center gap-1 truncate max-w-[160px]">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                <span className="truncate">{activeCue.text}</span>
              </span>
            ) : currentTime < (voiceTimeline?.firstSpeechStart || cues[0]?.startTime || 0) && (voiceTimeline?.firstSpeechStart || cues[0]?.startTime || 0) > 0.4 ? (
              <span className="text-amber-300 flex items-center gap-1">
                <span>🎵</span>
                <span>{st.player.introMusic}</span>
              </span>
            ) : (
              <span className="text-slate-400">
                {st.player.silence}
              </span>
            )}
          </div>

          {/* Playback Speed dropdown/toggle */}
          <button
            type="button"
            onClick={() => {
              const speeds = [0.5, 0.75, 1, 1.25, 1.5, 2];
              const next = speeds[(speeds.indexOf(playbackRate) + 1) % speeds.length];
              onSpeedChange(next);
            }}
            className="px-1.5 py-0.5 rounded-md bg-white/10 hover:bg-white/20 text-[10px] font-mono font-bold text-slate-200 transition-colors cursor-pointer"
            title={st.player.playbackSpeed}
          >
            {playbackRate}x
          </button>

          {/* Audio Mute */}
          <button
            type="button"
            onClick={onToggleMute}
            className="p-1 rounded-lg bg-white/10 hover:bg-white/20 text-slate-200 hover:text-white transition-colors cursor-pointer"
            title={isMuted ? st.player.unmute : st.player.mute}
          >
            {isMuted ? <VolumeX className="w-3.5 h-3.5 text-red-400" /> : <Volume2 className="w-3.5 h-3.5" />}
          </button>

          {/* Fullscreen */}
          <button
            type="button"
            onClick={onToggleFullscreen}
            className="p-1 rounded-lg bg-white/10 hover:bg-white/20 text-slate-200 hover:text-white transition-colors cursor-pointer"
            title="Fullscreen"
          >
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>
    </div>
  );
};
