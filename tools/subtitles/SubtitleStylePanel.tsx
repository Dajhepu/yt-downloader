import React from 'react';
import { SubtitleStyleConfig } from '../../types';
import {
  Palette, Sparkles, Zap, Move, Info, Sliders, Type,
  AlignLeft, AlignCenter, AlignRight, CheckCircle2, Download,
  RefreshCw, Check
} from 'lucide-react';
import { HIGHLIGHT_COLOR_CHOICES } from './subtitleConstants';
import { ShareResultButton } from '../../components/ShareResultButton';

interface SubtitleStylePanelProps {
  style: SubtitleStyleConfig;
  onStyleChange: React.Dispatch<React.SetStateAction<SubtitleStyleConfig>>;
  applyPreset: (presetName: SubtitleStyleConfig['preset']) => void;
  handleQuickPosition: (xPct: number, yPct: number, posName: 'top' | 'middle' | 'bottom' | 'custom') => void;
  removeAudio: boolean;
  setRemoveAudio: (remove: boolean) => void;
  handleBurnSubtitles: () => void;
  isBurning: boolean;
  cuesCount: number;
  burnProgressMsg: string;
  burnedVideoUrl: string | null;
  videoName: string;
  st: any;
}

export const SubtitleStylePanel: React.FC<SubtitleStylePanelProps> = ({
  style,
  onStyleChange,
  applyPreset,
  handleQuickPosition,
  removeAudio,
  setRemoveAudio,
  handleBurnSubtitles,
  isBurning,
  cuesCount,
  burnProgressMsg,
  burnedVideoUrl,
  videoName,
  st
}) => {
  return (
    <div className="space-y-6">
      {/* Subtitle Style & Animation Configuration */}
      <div id="tool-settings-section" className="glass-card p-4 sm:p-6 rounded-3xl border border-slate-200 dark:border-gray-800 space-y-5 shadow-xl">
        <div className="flex items-center justify-between gap-2 border-b border-slate-100 dark:border-gray-800/80 pb-3">
          <div className="flex items-center gap-2">
            <Palette className="w-4 h-4 text-emerald-500" />
            <h4 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white">
              {st.styling.title}
            </h4>
          </div>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-bold border border-emerald-500/25 uppercase">
            {style.animation || 'karaoke'}
          </span>
        </div>

        {/* Presets */}
        <div className="space-y-2">
          <label className="text-[11px] font-bold text-slate-600 dark:text-gray-400 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-emerald-500" />
            <span>{st.styling.presets}</span>
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            <button
              onClick={() => applyPreset('tiktok')}
              className={`p-2 rounded-xl border text-left transition-all cursor-pointer ${
                style.preset === 'tiktok'
                  ? 'bg-yellow-500/20 border-yellow-500 text-yellow-600 dark:text-yellow-400 font-black'
                  : 'bg-white dark:bg-gray-900 border-slate-200 dark:border-gray-800 text-slate-700 dark:text-gray-300 hover:border-yellow-500/40'
              }`}
            >
              <span className="text-xs block font-bold">🔥 {st.styling.presetTiktok}</span>
              <span className="text-[9px] text-slate-500 dark:text-gray-400">Karaoke, CAPS</span>
            </button>

            <button
              onClick={() => applyPreset('cinema')}
              className={`p-2 rounded-xl border text-left transition-all cursor-pointer ${
                style.preset === 'cinema'
                  ? 'bg-emerald-500/20 border-emerald-500 text-emerald-600 dark:text-emerald-400 font-black'
                  : 'bg-white dark:bg-gray-900 border-slate-200 dark:border-gray-800 text-slate-700 dark:text-gray-300 hover:border-emerald-500/40'
              }`}
            >
              <span className="text-xs block font-bold">🎬 {st.styling.presetCinema}</span>
              <span className="text-[9px] text-slate-500 dark:text-gray-400">Serif, Box</span>
            </button>

            <button
              onClick={() => applyPreset('neon')}
              className={`p-2 rounded-xl border text-left transition-all cursor-pointer ${
                style.preset === 'neon'
                  ? 'bg-teal-500/20 border-teal-500 text-teal-600 dark:text-teal-400 font-black'
                  : 'bg-white dark:bg-gray-900 border-slate-200 dark:border-gray-800 text-slate-700 dark:text-gray-300 hover:border-teal-500/40'
              }`}
            >
              <span className="text-xs block font-bold">⚡ {st.styling.presetNeon}</span>
              <span className="text-[9px] text-slate-500 dark:text-gray-400">Wave Cyan</span>
            </button>

            <button
              onClick={() => applyPreset('minimal')}
              className={`p-2 rounded-xl border text-left transition-all cursor-pointer ${
                style.preset === 'minimal'
                  ? 'bg-sky-500/20 border-sky-500 text-sky-600 dark:text-sky-400 font-black'
                  : 'bg-white dark:bg-gray-900 border-slate-200 dark:border-gray-800 text-slate-700 dark:text-gray-300 hover:border-sky-500/40'
              }`}
            >
              <span className="text-xs block font-bold">✨ {st.styling.presetModern}</span>
              <span className="text-[9px] text-slate-500 dark:text-gray-400">Bounce Clean</span>
            </button>

            <button
              onClick={() => applyPreset('youtube')}
              className={`p-2 rounded-xl border text-left transition-all col-span-2 sm:col-span-1 cursor-pointer ${
                style.preset === 'youtube'
                  ? 'bg-amber-500/20 border-amber-500 text-amber-600 dark:text-amber-400 font-black'
                  : 'bg-white dark:bg-gray-900 border-slate-200 dark:border-gray-800 text-slate-700 dark:text-gray-300 hover:border-amber-500/40'
              }`}
            >
              <span className="text-xs block font-bold">📺 {st.styling.presetBoxed}</span>
              <span className="text-[9px] text-slate-500 dark:text-gray-400">Yellow Tag</span>
            </button>
          </div>
        </div>

        {/* Section 1: Audio-Synced Motion / Animation Mode */}
        <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-gray-800">
          <div className="flex items-center justify-between">
            <label className="text-[11px] font-bold text-slate-700 dark:text-gray-300 flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-yellow-500" />
              <span>{st.styling.audioSyncedAnim}</span>
            </label>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
            <button
              onClick={() => onStyleChange(prev => ({ ...prev, animation: 'karaoke' }))}
              className={`px-2 py-2 rounded-xl border text-center transition-all cursor-pointer ${
                style.animation === 'karaoke'
                  ? 'bg-yellow-500/20 border-yellow-500 text-yellow-600 dark:text-yellow-400 font-bold'
                  : 'bg-white dark:bg-gray-900 border-slate-200 dark:border-gray-800 text-slate-700 dark:text-gray-300 hover:border-yellow-500/30'
              }`}
            >
              <span className="text-xs block font-extrabold">🎤 {st.styling.animKaraoke}</span>
              <span className="text-[9px] text-slate-400 block">{st.styling.animKaraoke}</span>
            </button>

            <button
              onClick={() => onStyleChange(prev => ({ ...prev, animation: 'bounce' }))}
              className={`px-2 py-2 rounded-xl border text-center transition-all cursor-pointer ${
                style.animation === 'bounce'
                  ? 'bg-emerald-500/20 border-emerald-500 text-emerald-600 dark:text-emerald-400 font-bold'
                  : 'bg-white dark:bg-gray-900 border-slate-200 dark:border-gray-800 text-slate-700 dark:text-gray-300 hover:border-emerald-500/30'
              }`}
            >
              <span className="text-xs block font-extrabold">⚡ {st.styling.animBounce}</span>
              <span className="text-[9px] text-slate-400 block">{st.styling.animBounce}</span>
            </button>

            <button
              onClick={() => onStyleChange(prev => ({ ...prev, animation: 'wave' }))}
              className={`px-2 py-2 rounded-xl border text-center transition-all cursor-pointer ${
                style.animation === 'wave'
                  ? 'bg-teal-500/20 border-teal-500 text-teal-600 dark:text-teal-400 font-bold'
                  : 'bg-white dark:bg-gray-900 border-slate-200 dark:border-gray-800 text-slate-700 dark:text-gray-300 hover:border-teal-500/30'
              }`}
            >
              <span className="text-xs block font-extrabold">🌊 {st.styling.animWave}</span>
              <span className="text-[9px] text-slate-400 block">{st.styling.animWave}</span>
            </button>

            <button
              onClick={() => onStyleChange(prev => ({ ...prev, animation: 'static' }))}
              className={`px-2 py-2 rounded-xl border text-center transition-all cursor-pointer ${
                style.animation === 'static'
                  ? 'bg-slate-500/20 border-slate-500 text-slate-800 dark:text-slate-200 font-bold'
                  : 'bg-white dark:bg-gray-900 border-slate-200 dark:border-gray-800 text-slate-700 dark:text-gray-300 hover:border-slate-500/30'
              }`}
            >
              <span className="text-xs block font-extrabold">⏹ {st.styling.animStatic}</span>
              <span className="text-[9px] text-slate-400 block">{st.styling.animStatic}</span>
            </button>
          </div>

          {/* Highlight Color Picker for active word */}
          {style.animation !== 'static' && (
            <div className="flex items-center justify-between gap-2 p-2 rounded-xl bg-slate-50 dark:bg-gray-950 border border-slate-200 dark:border-gray-800">
              <span className="text-[11px] font-bold text-slate-600 dark:text-gray-400">
                {st.styling.activeWordColor}
              </span>
              <div className="flex items-center gap-1.5">
                {HIGHLIGHT_COLOR_CHOICES.map(c => (
                  <button
                    key={c}
                    onClick={() => onStyleChange(prev => ({ ...prev, highlightColor: c }))}
                    className={`w-6 h-6 rounded-full border-2 transition-transform cursor-pointer ${
                      style.highlightColor === c ? 'scale-110 border-slate-900 dark:border-white shadow-sm' : 'border-transparent hover:scale-105'
                    }`}
                    style={{ backgroundColor: c }}
                    title={c}
                  />
                ))}
                <input
                  type="color"
                  value={style.highlightColor || '#facc15'}
                  onChange={(e) => onStyleChange(prev => ({ ...prev, highlightColor: e.target.value }))}
                  className="w-6 h-6 rounded-md border border-slate-300 dark:border-gray-700 cursor-pointer ml-1"
                />
              </div>
            </div>
          )}
        </div>

        {/* Section 2: Precise Positioning & Drag */}
        <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-gray-800">
          <div className="flex items-center justify-between">
            <label className="text-[11px] font-bold text-slate-700 dark:text-gray-300 flex items-center gap-1.5">
              <Move className="w-3.5 h-3.5 text-emerald-500" />
              <span>{st.styling.positioning}</span>
            </label>
            <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-mono font-bold">
              X: {style.xOffsetPercent ?? 50}% | Y: {style.yOffsetPercent ?? 84}%
            </span>
          </div>

          {/* 9-point placement grid */}
          <div className="grid grid-cols-3 gap-1.5 p-2 rounded-2xl bg-slate-50 dark:bg-gray-950 border border-slate-200 dark:border-gray-800">
            <button
              onClick={() => handleQuickPosition(20, 14, 'top')}
              className="py-1 rounded-lg text-[10px] font-bold bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-800 hover:border-emerald-500 text-slate-600 dark:text-gray-400 cursor-pointer"
            >
              ↖ {st.styling.posTopL}
            </button>
            <button
              onClick={() => handleQuickPosition(50, 14, 'top')}
              className="py-1 rounded-lg text-[10px] font-bold bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-800 hover:border-emerald-500 text-slate-600 dark:text-gray-400 cursor-pointer"
            >
              ↑ {st.styling.posTopC}
            </button>
            <button
              onClick={() => handleQuickPosition(80, 14, 'top')}
              className="py-1 rounded-lg text-[10px] font-bold bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-800 hover:border-emerald-500 text-slate-600 dark:text-gray-400 cursor-pointer"
            >
              ↗ {st.styling.posTopR}
            </button>

            <button
              onClick={() => handleQuickPosition(20, 50, 'middle')}
              className="py-1 rounded-lg text-[10px] font-bold bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-800 hover:border-emerald-500 text-slate-600 dark:text-gray-400 cursor-pointer"
            >
              ← {st.styling.posMidL}
            </button>
            <button
              onClick={() => handleQuickPosition(50, 50, 'middle')}
              className="py-1 rounded-lg text-[10px] font-bold bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-800 hover:border-emerald-500 text-slate-600 dark:text-gray-400 cursor-pointer"
            >
              • {st.styling.posCenter}
            </button>
            <button
              onClick={() => handleQuickPosition(80, 50, 'middle')}
              className="py-1 rounded-lg text-[10px] font-bold bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-800 hover:border-emerald-500 text-slate-600 dark:text-gray-400 cursor-pointer"
            >
              → {st.styling.posMidR}
            </button>

            <button
              onClick={() => handleQuickPosition(20, 84, 'bottom')}
              className="py-1 rounded-lg text-[10px] font-bold bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-800 hover:border-emerald-500 text-slate-600 dark:text-gray-400 cursor-pointer"
            >
              ↙ {st.styling.posBotL}
            </button>
            <button
              onClick={() => handleQuickPosition(50, 84, 'bottom')}
              className="py-1 rounded-lg text-[10px] font-bold bg-emerald-500/15 border border-emerald-500/40 text-emerald-600 dark:text-emerald-400 cursor-pointer"
            >
              ↓ {st.styling.posBotC}
            </button>
            <button
              onClick={() => handleQuickPosition(80, 84, 'bottom')}
              className="py-1 rounded-lg text-[10px] font-bold bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-800 hover:border-emerald-500 text-slate-600 dark:text-gray-400 cursor-pointer"
            >
              ↘ {st.styling.posBotR}
            </button>
          </div>

          {/* Horizontal X Slider */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[11px] font-bold text-slate-600 dark:text-gray-400">
              <span>{st.styling.horizontalOffset}</span>
              <span className="font-mono text-emerald-500">{style.xOffsetPercent ?? 50}%</span>
            </div>
            <input
              type="range"
              min="10"
              max="90"
              value={style.xOffsetPercent ?? 50}
              onChange={(e) => onStyleChange(prev => ({ ...prev, xOffsetPercent: parseInt(e.target.value) || 50, position: 'custom' }))}
              className="w-full accent-emerald-500 h-1.5 bg-slate-200 dark:bg-gray-800 rounded-lg cursor-pointer"
            />
          </div>

          {/* Vertical Y Slider */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[11px] font-bold text-slate-600 dark:text-gray-400">
              <span>{st.styling.verticalOffset}</span>
              <span className="font-mono text-emerald-500">{style.yOffsetPercent ?? 84}%</span>
            </div>
            <input
              type="range"
              min="10"
              max="94"
              value={style.yOffsetPercent ?? 84}
              onChange={(e) => onStyleChange(prev => ({ ...prev, yOffsetPercent: parseInt(e.target.value) || 84, position: 'custom' }))}
              className="w-full accent-emerald-500 h-1.5 bg-slate-200 dark:bg-gray-800 rounded-lg cursor-pointer"
            />
          </div>

          <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-[11px] text-emerald-700 dark:text-emerald-300 flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5 shrink-0" />
            <span>{st.styling.dragTip}</span>
          </div>
        </div>

        {/* Section 3: Sizing, Font & Box Design */}
        <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-gray-800">
          <label className="text-[11px] font-bold text-slate-700 dark:text-gray-300 flex items-center gap-1.5">
            <Sliders className="w-3.5 h-3.5 text-emerald-500" />
            <span>{st.styling.sizingTypography}</span>
          </label>

          {/* Font Family selector */}
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 dark:text-gray-400 block">
                {st.styling.fontFamily}
              </label>
              <select
                value={style.fontFamily || 'sans'}
                onChange={(e) => onStyleChange(prev => ({ ...prev, fontFamily: e.target.value as any }))}
                className="w-full bg-white dark:bg-gray-950 border border-slate-200 dark:border-gray-800 rounded-xl px-2.5 py-1.5 text-xs font-bold text-slate-800 dark:text-gray-200 cursor-pointer"
              >
                <option value="sans">{st.styling.fontSans}</option>
                <option value="impact">{st.styling.fontImpact}</option>
                <option value="serif">{st.styling.fontSerif}</option>
                <option value="mono">{st.styling.fontMono}</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 dark:text-gray-400 block">
                {st.styling.alignment}
              </label>
              <div className="flex items-center gap-1 bg-white dark:bg-gray-950 border border-slate-200 dark:border-gray-800 rounded-xl p-0.5">
                <button
                  type="button"
                  onClick={() => onStyleChange(prev => ({ ...prev, align: 'left' }))}
                  className={`flex-1 py-1 rounded-lg flex items-center justify-center transition-colors cursor-pointer ${
                    style.align === 'left' ? 'bg-emerald-500 text-white' : 'text-slate-600 dark:text-gray-400'
                  }`}
                  title={st.styling.alignLeft}
                >
                  <AlignLeft className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => onStyleChange(prev => ({ ...prev, align: 'center' }))}
                  className={`flex-1 py-1 rounded-lg flex items-center justify-center transition-colors cursor-pointer ${
                    (style.align === 'center' || !style.align) ? 'bg-emerald-500 text-white' : 'text-slate-600 dark:text-gray-400'
                  }`}
                  title={st.styling.alignCenter}
                >
                  <AlignCenter className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => onStyleChange(prev => ({ ...prev, align: 'right' }))}
                  className={`flex-1 py-1 rounded-lg flex items-center justify-center transition-colors cursor-pointer ${
                    style.align === 'right' ? 'bg-emerald-500 text-white' : 'text-slate-600 dark:text-gray-400'
                  }`}
                  title={st.styling.alignRight}
                >
                  <AlignRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>

          {/* Font Size Slider */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[11px] font-bold text-slate-600 dark:text-gray-400">
              <span className="flex items-center gap-1">
                <Type className="w-3.5 h-3.5 text-emerald-500" />
                <span>{st.styling.fontSize}</span>
              </span>
              <span className="font-mono text-emerald-500">{style.fontSize}px</span>
            </div>
            <input
              type="range"
              min="16"
              max="60"
              value={style.fontSize}
              onChange={(e) => onStyleChange(prev => ({ ...prev, fontSize: parseInt(e.target.value) || 32 }))}
              className="w-full accent-emerald-500 h-1.5 bg-slate-200 dark:bg-gray-800 rounded-lg cursor-pointer"
            />
          </div>

          {/* Max Width Slider */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[11px] font-bold text-slate-600 dark:text-gray-400">
              <span>{st.styling.maxWidth}</span>
              <span className="font-mono text-emerald-500">{style.maxWidthPercent || 85}%</span>
            </div>
            <input
              type="range"
              min="40"
              max="98"
              value={style.maxWidthPercent || 85}
              onChange={(e) => onStyleChange(prev => ({ ...prev, maxWidthPercent: parseInt(e.target.value) || 85 }))}
              className="w-full accent-emerald-500 h-1.5 bg-slate-200 dark:bg-gray-800 rounded-lg cursor-pointer"
            />
          </div>

          {/* Text Color & Background Box */}
          <div className="grid grid-cols-2 gap-3 pt-1">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-600 dark:text-gray-400 block">
                {st.styling.textColor}
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={style.textColor}
                  onChange={(e) => onStyleChange(prev => ({ ...prev, textColor: e.target.value }))}
                  className="w-8 h-8 rounded-lg border border-slate-200 dark:border-gray-700 cursor-pointer"
                />
                <span className="text-xs font-mono uppercase text-slate-700 dark:text-gray-300">{style.textColor}</span>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-600 dark:text-gray-400 block">
                {st.styling.bgColor}
              </label>
              <select
                value={style.bgColor}
                onChange={(e) => onStyleChange(prev => ({ ...prev, bgColor: e.target.value as any }))}
                className="w-full bg-white dark:bg-gray-950 border border-slate-200 dark:border-gray-800 rounded-xl px-2.5 py-1.5 text-xs font-bold text-slate-800 dark:text-gray-200 cursor-pointer"
              >
                <option value="transparent">{st.styling.bgTransparent}</option>
                <option value="dark">{st.styling.bgDark}</option>
                <option value="white">{st.styling.bgWhite}</option>
                <option value="emerald">{st.styling.bgEmerald}</option>
                <option value="yellow">{st.styling.bgYellow}</option>
              </select>
            </div>
          </div>

          {/* Box Rounding (Border Radius) & Padding */}
          {style.bgColor !== 'transparent' && (
            <div className="grid grid-cols-2 gap-3 pt-1">
              <div className="space-y-1">
                <div className="flex justify-between text-[10px] font-bold text-slate-500">
                  <span>{st.styling.borderRadius}</span>
                  <span>{style.borderRadius ?? 12}px</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="24"
                  value={style.borderRadius ?? 12}
                  onChange={(e) => onStyleChange(prev => ({ ...prev, borderRadius: parseInt(e.target.value) || 0 }))}
                  className="w-full accent-emerald-500 h-1.5 bg-slate-200 dark:bg-gray-800 rounded-lg cursor-pointer"
                />
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-[10px] font-bold text-slate-500">
                  <span>{st.styling.boxPadding}</span>
                  <span>{style.boxPadding ?? 8}px</span>
                </div>
                <input
                  type="range"
                  min="2"
                  max="20"
                  value={style.boxPadding ?? 8}
                  onChange={(e) => onStyleChange(prev => ({ ...prev, boxPadding: parseInt(e.target.value) || 6 }))}
                  className="w-full accent-emerald-500 h-1.5 bg-slate-200 dark:bg-gray-800 rounded-lg cursor-pointer"
                />
              </div>
            </div>
          )}

          {/* Toggles: Uppercase & Stroke Outline */}
          <div className="flex items-center justify-between gap-3 pt-1">
            <label className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-gray-300 cursor-pointer">
              <input
                type="checkbox"
                checked={style.uppercase}
                onChange={(e) => onStyleChange(prev => ({ ...prev, uppercase: e.target.checked }))}
                className="rounded accent-emerald-500 w-4 h-4 cursor-pointer"
              />
              <span>{st.styling.uppercase}</span>
            </label>

            <label className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-gray-300 cursor-pointer">
              <input
                type="checkbox"
                checked={style.stroke}
                onChange={(e) => onStyleChange(prev => ({ ...prev, stroke: e.target.checked }))}
                className="rounded accent-emerald-500 w-4 h-4 cursor-pointer"
              />
              <span>{st.styling.stroke}</span>
            </label>
          </div>
        </div>
      </div>

      {/* Hardcode / Burn Subtitles Action Box */}
      <div className="glass-card p-4 sm:p-6 rounded-3xl border-2 border-emerald-500/40 bg-gradient-to-br from-emerald-500/10 via-transparent to-teal-500/10 space-y-4 shadow-xl">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white">
              {st.export.title}
            </h4>
            <p className="text-xs text-slate-600 dark:text-gray-400">
              {st.export.subtitle}
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-gray-300 cursor-pointer">
            <input
              type="checkbox"
              checked={removeAudio}
              onChange={(e) => setRemoveAudio(e.target.checked)}
              className="rounded accent-emerald-500 w-4 h-4 cursor-pointer"
            />
            <span>{st.export.muteAudio}</span>
          </label>
        </div>

        {/* Burn Action Button */}
        <button
          id="tool-primary-action-btn"
          onClick={handleBurnSubtitles}
          disabled={isBurning || cuesCount === 0}
          className="w-full py-3.5 px-4 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-gray-950 font-extrabold text-sm flex items-center justify-center gap-2 shadow-xl shadow-emerald-500/30 transition-all active:scale-[0.98] disabled:opacity-50 cursor-pointer"
        >
          {isBurning ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span>{burnProgressMsg || st.export.exportingBtn}</span>
            </>
          ) : (
            <>
              <Download className="w-4 h-4" />
              <span>{st.export.exportBtn}</span>
            </>
          )}
        </button>

        {/* Download Link when ready */}
        {burnedVideoUrl && (
          <div className="p-4 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 space-y-3 animate-fadeIn">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-emerald-700 dark:text-emerald-300 flex items-center gap-1.5">
                <Check className="w-4 h-4 text-emerald-500" />
                <span>{st.export.readyTitle}</span>
              </span>
              <div className="flex items-center gap-2">
                <a
                  id="tool-download-btn"
                  href={burnedVideoUrl}
                  download={`${videoName.replace(/\.[^/.]+$/, '')}_subtitled.mp4`}
                  className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-gray-950 font-extrabold text-xs flex items-center gap-1.5 shadow-md transition-all active:scale-95 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>{st.export.downloadMp4}</span>
                </a>
                <ShareResultButton
                  fileUrl={burnedVideoUrl}
                  fileName={`${videoName.replace(/\.[^/.]+$/, '')}_subtitled.mp4`}
                  size="sm"
                  title={`DarlingClip Subtitled: ${videoName}`}
                />
              </div>
            </div>
            <video
              src={burnedVideoUrl}
              controls
              className="w-full rounded-xl max-h-48 bg-black object-contain"
            />
          </div>
        )}
      </div>
    </div>
  );
};
