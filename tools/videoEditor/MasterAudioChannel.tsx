import React from 'react';
import { Video, Music, Volume2, VolumeX } from 'lucide-react';

interface MasterAudioChannelProps {
  type: 'video' | 'music';
  title: string;
  volume: number;
  isMuted: boolean;
  onVolumeChange: (vol: number) => void;
  onToggleMute: () => void;
  onReset: () => void;
  compact?: boolean;
}

export const MasterAudioChannel: React.FC<MasterAudioChannelProps> = ({
  type,
  title,
  volume,
  isMuted,
  onVolumeChange,
  onToggleMute,
  onReset,
  compact = false
}) => {
  const isVideo = type === 'video';
  const Icon = isVideo ? Video : Music;

  if (compact) {
    return (
      <div className="p-2 rounded-xl bg-[#13161f] border border-[#232733] space-y-1.5">
        <div className="flex items-center justify-between text-xs">
          <span className="font-semibold text-slate-300 flex items-center gap-1.5">
            <Icon className={`w-3.5 h-3.5 ${isVideo ? 'text-teal-400' : 'text-sky-400'}`} />
            <span>{title}</span>
          </span>
          <span className={`font-mono font-bold text-xs ${isVideo ? 'text-teal-400' : 'text-sky-400'}`}>
            {isMuted ? 'Muted' : `${volume}%`}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="range"
            min={0}
            max={200}
            value={isMuted ? 0 : volume}
            onChange={(e) => onVolumeChange(Number(e.target.value))}
            className={`flex-1 ${isVideo ? 'accent-teal-400' : 'accent-sky-400'} h-1.5 bg-[#26282d] rounded cursor-pointer`}
          />
          <button
            type="button"
            onClick={onToggleMute}
            className={`px-1.5 py-0.5 rounded text-[10px] font-bold transition-all cursor-pointer ${
              isMuted
                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                : 'bg-[#26282d] text-slate-300 hover:text-white'
            }`}
          >
            {isMuted ? <VolumeX className="w-3 h-3" /> : <Volume2 className="w-3 h-3" />}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-3 rounded-xl bg-[#171a22] border border-[#26282d] space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Icon className={`w-4 h-4 ${isVideo ? 'text-teal-400' : 'text-sky-400'}`} />
          <span className="text-xs font-bold text-white">{title}</span>
        </div>
        <span className={`font-mono text-xs font-bold ${isVideo ? 'text-teal-400' : 'text-sky-400'}`}>
          {isMuted ? 'Muted' : `${volume}%`}
        </span>
      </div>

      <input
        type="range"
        min={0}
        max={200}
        value={isMuted ? 0 : volume}
        onChange={(e) => onVolumeChange(Number(e.target.value))}
        className={`w-full ${isVideo ? 'accent-teal-400' : 'accent-sky-400'} cursor-pointer h-1.5 bg-slate-800 rounded-lg`}
      />

      <div className="flex items-center justify-between pt-1">
        <button
          type="button"
          onClick={onToggleMute}
          className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
            isMuted
              ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
              : 'bg-[#26282d] text-slate-300 hover:text-white'
          }`}
        >
          {isMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
          <span>{isMuted ? 'Yoqish' : "O'chirish"}</span>
        </button>

        <button
          type="button"
          onClick={onReset}
          className="text-xs text-slate-400 hover:text-white transition-colors cursor-pointer"
        >
          100% ga qaytarish
        </button>
      </div>
    </div>
  );
};
