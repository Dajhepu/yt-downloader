import React from 'react';
import { SubtitleCue, SubtitleStyleConfig } from '../../types';
import { computeCueWords } from '../../services/voiceActivityDetector';
import { Move } from 'lucide-react';

interface SubtitleOverlayProps {
  activeCue: SubtitleCue | null;
  style: SubtitleStyleConfig;
  currentTime: number;
  isDragging: boolean;
  onDragStart: (e: React.MouseEvent | React.TouchEvent) => void;
  dragTip?: string;
}

export const SubtitleOverlay: React.FC<SubtitleOverlayProps> = ({
  activeCue,
  style,
  currentTime,
  isDragging,
  onDragStart,
  dragTip
}) => {
  if (!activeCue) return null;

  const rawWords = (style.uppercase ? activeCue.text.toUpperCase() : activeCue.text).trim().split(/\s+/).filter(Boolean);
  if (rawWords.length === 0) return null;

  // High-precision phonetic word timings (syllable + punctuation weighted)
  const cueWords = activeCue.words && activeCue.words.length === rawWords.length
    ? activeCue.words
    : computeCueWords(activeCue.text, activeCue.startTime, activeCue.endTime);

  // Find active spoken word matching exact currentTime (60 FPS smooth)
  let activeWordIdx = cueWords.findIndex(w => currentTime >= w.startTime && currentTime <= w.endTime);
  if (activeWordIdx === -1) {
    if (currentTime < (cueWords[0]?.startTime || activeCue.startTime)) {
      activeWordIdx = -1; // Speech hasn't reached first word yet
    } else {
      for (let k = cueWords.length - 1; k >= 0; k--) {
        if (currentTime >= cueWords[k].startTime) {
          activeWordIdx = k;
          break;
        }
      }
    }
  }

  // Select font family
  const fontClass =
    style.fontFamily === 'impact'
      ? 'font-black tracking-tight uppercase'
      : style.fontFamily === 'serif'
      ? 'font-serif font-bold italic'
      : style.fontFamily === 'mono'
      ? 'font-mono font-bold'
      : 'font-extrabold';

  return (
    <div
      className="absolute pointer-events-auto select-none z-30 transition-transform duration-75"
      style={{
        left: `${style.xOffsetPercent ?? 50}%`,
        top: `${style.yOffsetPercent ?? 84}%`,
        transform: 'translate(-50%, -50%)',
        maxWidth: `${style.maxWidthPercent || 85}%`,
        width: 'max-content',
      }}
      onMouseDown={onDragStart}
      onTouchStart={onDragStart}
      title={dragTip}
    >
      {/* Drag Badge / Coordinates Guide */}
      {isDragging && (
        <div className="absolute -top-7 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-md bg-emerald-500 text-gray-950 text-[10px] font-black shadow-lg pointer-events-none flex items-center gap-1 whitespace-nowrap">
          <Move className="w-2.5 h-2.5" />
          <span>X: {style.xOffsetPercent}% | Y: {style.yOffsetPercent}%</span>
        </div>
      )}

      {/* Subtitle Container Box */}
      <div
        className={`inline-block text-center transition-all shadow-xl group border border-dashed ${
          isDragging
            ? 'border-emerald-400/80 cursor-grabbing scale-105 shadow-emerald-500/20'
            : 'border-transparent hover:border-white/30 cursor-grab'
        } ${
          style.bgColor === 'dark'
            ? 'bg-slate-950/85 text-white'
            : style.bgColor === 'white'
            ? 'bg-white/95 text-slate-950 shadow-md'
            : style.bgColor === 'emerald'
            ? 'bg-emerald-950/90 text-emerald-100 border-emerald-500/40'
            : style.bgColor === 'yellow'
            ? 'bg-yellow-400 text-black font-black'
            : 'bg-transparent'
        }`}
        style={{
          padding: `${style.boxPadding ?? 8}px ${((style.boxPadding ?? 8) + 8)}px`,
          borderRadius: `${style.borderRadius ?? 12}px`,
          textAlign: style.align || 'center',
          lineHeight: style.lineHeight || 1.35,
          letterSpacing: `${style.letterSpacing ?? 0}px`,
        }}
      >
        <div
          className={`flex flex-wrap items-center justify-center gap-x-2 gap-y-1.5 ${fontClass}`}
          style={{
            fontSize: `${style.fontSize}px`,
            color: style.textColor,
          }}
        >
          {rawWords.map((word, wIdx) => {
            const isCurrent = wIdx === activeWordIdx;
            const isPast = wIdx < activeWordIdx;

            let wordColor = style.textColor;
            let transformStyle = 'translate3d(0, 0, 0)';
            let wordFilter = 'none';

            if (style.animation === 'karaoke') {
              if (isCurrent) {
                wordColor = style.highlightColor || '#facc15';
                transformStyle = 'scale(1.12) translate3d(0, -2px, 0)';
                wordFilter = 'drop-shadow(0 0 8px rgba(250, 204, 21, 0.6))';
              } else if (isPast) {
                wordColor = style.highlightColor || '#facc15';
                transformStyle = 'scale(1.0) translate3d(0, 0, 0)';
              } else {
                wordColor = style.textColor || '#ffffff';
                transformStyle = 'scale(0.96) translate3d(0, 0, 0)';
              }
            } else if (style.animation === 'bounce') {
              if (isCurrent) {
                wordColor = style.highlightColor || '#facc15';
                transformStyle = 'scale(1.22) translate3d(0, -8px, 0)';
                wordFilter = 'drop-shadow(0 4px 12px rgba(250, 204, 21, 0.7))';
              } else {
                wordColor = style.textColor || '#ffffff';
                transformStyle = 'scale(1.0) translate3d(0, 0, 0)';
              }
            } else if (style.animation === 'wave') {
              const waveY = Math.sin((currentTime * 8) + (wIdx * 0.9)) * 4;
              if (isCurrent) {
                wordColor = style.highlightColor || '#34d399';
                transformStyle = `scale(1.15) translate3d(0, ${waveY - 4}px, 0)`;
                wordFilter = 'drop-shadow(0 0 10px rgba(52, 211, 153, 0.7))';
              } else {
                transformStyle = `scale(1.0) translate3d(0, ${waveY}px, 0)`;
              }
            }

            return (
              <span
                key={wIdx}
                className="inline-block transition-all duration-75 will-change-transform"
                style={{
                  color: wordColor,
                  transform: transformStyle,
                  filter: wordFilter,
                  textShadow: style.stroke
                    ? `-2px -2px 0 ${style.strokeColor}, 2px -2px 0 ${style.strokeColor}, -2px 2px 0 ${style.strokeColor}, 2px 2px 0 ${style.strokeColor}, 0 4px 10px rgba(0,0,0,0.8)`
                    : style.bgColor === 'transparent'
                    ? '0 2px 10px rgba(0,0,0,0.9), 0 0 2px rgba(0,0,0,0.9)'
                    : 'none',
                }}
              >
                {word}
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
};
