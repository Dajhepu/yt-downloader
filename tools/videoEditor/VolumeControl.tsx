import React from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import { VOLUME_PRESET_BUTTONS } from './editorConstants';

interface VolumeControlProps {
  label?: string;
  volume: number;
  isMuted?: boolean;
  onVolumeChange: (vol: number) => void;
  onMuteToggle?: () => void;
  showPresets?: boolean;
  compact?: boolean;
  disabled?: boolean;
}

export const VolumeControl: React.FC<VolumeControlProps> = ({
  label,
  volume,
  isMuted = false,
  onVolumeChange,
  onMuteToggle,
  showPresets = true,
  compact = false,
  disabled = false
}) => {
  const currentVal = isMuted ? 0 : (volume ?? 100);

  return (
    <div className={`space-y-2 ${compact ? 'text-xs' : 'text-sm'}`}>
      {label && (
        <div className="flex items-center justify-between text-slate-300 font-medium">
          <span className="truncate">{label}</span>
          <span className="font-mono text-[#00c5d4] font-bold text-xs">{currentVal}%</span>
        </div>
      )}

      <div className="flex items-center gap-2">
        {onMuteToggle && (
          <button
            type="button"
            disabled={disabled}
            onClick={onMuteToggle}
            className={`p-1.5 rounded-lg border transition-colors cursor-pointer shrink-0 ${
              isMuted
                ? 'bg-red-500/20 border-red-500/40 text-red-400'
                : 'bg-[#202533] border-[#2a3042] text-slate-300 hover:text-white'
            }`}
            title={isMuted ? 'Ovozni yoqish' : 'Ovozni o\'chirish'}
          >
            {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>
        )}

        <input
          type="range"
          min={0}
          max={200}
          value={currentVal}
          disabled={disabled || isMuted}
          onChange={(e) => onVolumeChange(Number(e.target.value))}
          className="flex-1 accent-[#00c5d4] h-1.5 bg-slate-800 rounded-lg cursor-pointer disabled:opacity-40"
        />

        {!label && (
          <span className="font-mono text-[#00c5d4] font-bold text-xs w-10 text-right shrink-0">
            {currentVal}%
          </span>
        )}
      </div>

      {showPresets && !compact && (
        <div className="flex items-center gap-1.5 pt-1">
          {VOLUME_PRESET_BUTTONS.map((preset) => {
            const isActive = !isMuted && currentVal === preset.val;
            return (
              <button
                key={preset.val}
                type="button"
                disabled={disabled}
                onClick={() => {
                  if (isMuted && onMuteToggle) onMuteToggle();
                  onVolumeChange(preset.val);
                }}
                className={`flex-1 py-1 text-[10px] font-bold rounded-md border transition-all cursor-pointer ${
                  isActive
                    ? 'bg-[#00c5d4]/20 border-[#00c5d4] text-[#00c5d4]'
                    : 'bg-[#181c26] border-[#262c3d] text-slate-400 hover:text-white hover:border-slate-600'
                }`}
              >
                {preset.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
