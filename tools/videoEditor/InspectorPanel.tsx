import React from 'react';
import {
  X,
  RotateCcw,
  RotateCw,
  Music,
  Volume2,
  VolumeX,
  Video,
  Plus,
  Trash2,
  Sparkles
} from 'lucide-react';
import { EditorSettings } from '../../types';
import { VideoEditorTranslationSchema } from '../../translations/videoEditorTranslations';
import { MasterAudioChannel } from './MasterAudioChannel';
import { BACKGROUND_PRESETS } from './editorConstants';
import {
  InspectorMainTab,
  InspectorVideoSubTab,
  VideoClipItem,
  AudioClipItem,
  LeftSidebarTab
} from './types';

interface ChromaKeyState {
  enabled: boolean;
  keyColor: string;
  similarity: number;
  smoothness?: number;
}

interface InspectorPanelProps {
  mobileActiveSheet: LeftSidebarTab | 'inspector' | null;
  setMobileActiveSheet: React.Dispatch<React.SetStateAction<LeftSidebarTab | 'inspector' | null>>;
  editorT: VideoEditorTranslationSchema;
  inspectorTab: InspectorMainTab;
  setInspectorTab: (tab: InspectorMainTab) => void;
  videoSubTab: InspectorVideoSubTab;
  setVideoSubTab: (tab: InspectorVideoSubTab) => void;
  settings: EditorSettings;
  pushSettingsChange: (updater: (prev: EditorSettings) => EditorSettings) => void;
  resetPositionAndSize: () => void;
  resetBlend: () => void;
  chromaKey: ChromaKeyState;
  setChromaKey: React.Dispatch<React.SetStateAction<ChromaKeyState>>;
  audioInspectorMode: 'individual' | 'master';
  setAudioInspectorMode: (mode: 'individual' | 'master') => void;
  clips: VideoClipItem[];
  selectedClipId: string;
  setSelectedClipId: (id: string) => void;
  updateClip: (id: string, updates: Partial<VideoClipItem>) => void;
  audioClips: AudioClipItem[];
  selectedAudioClipId: string | null;
  setSelectedAudioClipId: (id: string | null) => void;
  setSelectedTextClipId: (id: string | null) => void;
  updateAudioClip: (id: string, updates: Partial<AudioClipItem>) => void;
  setAudioClips: React.Dispatch<React.SetStateAction<AudioClipItem[]>>;
  onUploadAudio?: () => void;
  isVideoAudioMuted: boolean;
  setIsVideoAudioMuted: (muted: boolean) => void;
  toggleVideoAudioMute: () => void;
  isMusicAudioMuted: boolean;
  setIsMusicAudioMuted: (muted: boolean) => void;
  toggleMusicAudioMute: () => void;
  activeEffect: string;
  setActiveEffect: (effect: string) => void;
  setActiveTransition: (transition: string) => void;
}

export const InspectorPanel: React.FC<InspectorPanelProps> = ({
  mobileActiveSheet,
  setMobileActiveSheet,
  editorT,
  inspectorTab,
  setInspectorTab,
  videoSubTab,
  setVideoSubTab,
  settings,
  pushSettingsChange,
  resetPositionAndSize,
  resetBlend,
  chromaKey,
  setChromaKey,
  audioInspectorMode,
  setAudioInspectorMode,
  clips,
  selectedClipId,
  setSelectedClipId,
  updateClip,
  audioClips,
  selectedAudioClipId,
  setSelectedAudioClipId,
  setSelectedTextClipId,
  updateAudioClip,
  setAudioClips,
  onUploadAudio,
  isVideoAudioMuted,
  setIsVideoAudioMuted,
  toggleVideoAudioMute,
  isMusicAudioMuted,
  setIsMusicAudioMuted,
  toggleMusicAudioMute,
  activeEffect,
  setActiveEffect,
  setActiveTransition,
}) => {
  return (
    <aside
      className={
        mobileActiveSheet === 'inspector'
          ? "fixed inset-x-0 bottom-0 z-50 bg-[#18191c] border-t border-[#2a3040] rounded-t-2xl shadow-2xl flex flex-col h-[58vh] max-h-[75vh] md:hidden animate-in slide-in-from-bottom duration-250 select-none"
          : "hidden lg:flex w-72 sm:w-80 bg-[#18191c] border-l border-[#26282d] flex-col shrink-0 overflow-y-auto select-none"
      }
    >
      {/* Mobile Sheet Drag Indicator & Header */}
      <div className="h-10 px-3 border-b border-[#26282d] flex items-center justify-between shrink-0 bg-[#1c1e24] md:hidden rounded-t-2xl">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[#00c5d4]" />
          <span className="text-xs font-bold text-white uppercase tracking-wider">
            {editorT.header.adjustMobile}
          </span>
        </div>
        <div className="w-10 h-1 bg-slate-600 rounded-full" />
        <button
          type="button"
          onClick={() => setMobileActiveSheet(null)}
          className="p-1 rounded text-slate-400 hover:text-white hover:bg-[#26282d] transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Main Tabs (Video | Audio | Speed | Animation) */}
      <div className="h-10 px-3 border-b border-[#26282d] flex items-center justify-between shrink-0">
        <button
          type="button"
          onClick={() => setInspectorTab('video')}
          className={`py-2 text-xs font-medium relative cursor-pointer ${
            inspectorTab === 'video' ? 'text-white' : 'text-[#8c9099] hover:text-slate-200'
          }`}
        >
          <span>{editorT.inspector.tabs.video}</span>
          {inspectorTab === 'video' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-white" />}
        </button>

        <button
          type="button"
          onClick={() => setInspectorTab('audio')}
          className={`py-2 text-xs font-medium relative cursor-pointer ${
            inspectorTab === 'audio' ? 'text-white' : 'text-[#8c9099] hover:text-slate-200'
          }`}
        >
          <span>{editorT.inspector.tabs.audio}</span>
          {inspectorTab === 'audio' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-white" />}
        </button>

        <button
          type="button"
          onClick={() => setInspectorTab('speed')}
          className={`py-2 text-xs font-medium relative cursor-pointer ${
            inspectorTab === 'speed' ? 'text-white' : 'text-[#8c9099] hover:text-slate-200'
          }`}
        >
          <span>{editorT.inspector.tabs.speed}</span>
          {inspectorTab === 'speed' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-white" />}
        </button>

        <button
          type="button"
          onClick={() => setInspectorTab('animation')}
          className={`py-2 text-xs font-medium relative cursor-pointer ${
            inspectorTab === 'animation' ? 'text-white' : 'text-[#8c9099] hover:text-slate-200'
          }`}
        >
          <span>{editorT.inspector.tabs.animation}</span>
          {inspectorTab === 'animation' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-white" />}
        </button>
      </div>

      {/* Sub-tabs for Video (Basic | Remove background | Background) */}
      {inspectorTab === 'video' && (
        <div className="px-3 pt-2 pb-1 flex items-center gap-1.5 shrink-0 border-b border-[#26282d]">
          <button
            type="button"
            onClick={() => setVideoSubTab('basic')}
            className={`px-3 py-1 rounded text-xs font-medium transition-all cursor-pointer ${
              videoSubTab === 'basic' ? 'bg-[#26282d] text-white' : 'text-[#8c9099] hover:text-white'
            }`}
          >
            {editorT.inspector.subTabs.basic}
          </button>
          <button
            type="button"
            onClick={() => setVideoSubTab('remove_bg')}
            className={`px-3 py-1 rounded text-xs font-medium transition-all cursor-pointer ${
              videoSubTab === 'remove_bg' ? 'bg-[#26282d] text-white' : 'text-[#8c9099] hover:text-white'
            }`}
          >
            {editorT.inspector.subTabs.removeBg}
          </button>
          <button
            type="button"
            onClick={() => setVideoSubTab('background')}
            className={`px-3 py-1 rounded text-xs font-medium transition-all cursor-pointer ${
              videoSubTab === 'background' ? 'bg-[#26282d] text-white' : 'text-[#8c9099] hover:text-white'
            }`}
          >
            {editorT.inspector.subTabs.background}
          </button>
        </div>
      )}

      {/* Inspector Content Section */}
      <div className="p-4 space-y-6 flex-1 overflow-y-auto">

        {/* 1. POSITION AND SIZE */}
        {inspectorTab === 'video' && videoSubTab === 'basic' && (
          <>
            <div className="space-y-3.5">
              <div className="flex items-center justify-between text-xs font-bold text-white">
                <span>{editorT.inspector.transform.title}</span>
                <button
                  type="button"
                  onClick={resetPositionAndSize}
                  className="text-slate-400 hover:text-white p-1 cursor-pointer"
                  title={editorT.inspector.transform.reset}
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Size slider (100% default) */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs text-slate-300">
                  <span>{editorT.inspector.transform.scale}</span>
                  <span className="font-mono text-[#00c5d4]">{settings.scaleSize ?? 100}%</span>
                </div>
                <input
                  type="range"
                  min={10}
                  max={200}
                  value={settings.scaleSize ?? 100}
                  onChange={(e) => pushSettingsChange(prev => ({ ...prev, scaleSize: parseInt(e.target.value) }))}
                  className="w-full accent-[#00c5d4] cursor-pointer h-1.5 bg-slate-800 rounded-lg"
                />
              </div>

              {/* Position X and Y boxes (X 0, Y 0 default) */}
              <div className="flex items-center justify-between text-xs text-slate-300">
                <span>{editorT.textPanel.position}</span>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1 bg-[#1a1e29] border border-slate-700 rounded-lg px-2 py-1">
                    <span className="text-slate-500 font-bold">X</span>
                    <input
                      type="number"
                      value={settings.positionX ?? 0}
                      onChange={(e) => pushSettingsChange(prev => ({ ...prev, positionX: parseInt(e.target.value) || 0 }))}
                      className="w-10 bg-transparent text-white font-mono text-xs outline-none text-center"
                    />
                  </div>
                  <div className="flex items-center gap-1 bg-[#1a1e29] border border-slate-700 rounded-lg px-2 py-1">
                    <span className="text-slate-500 font-bold">Y</span>
                    <input
                      type="number"
                      value={settings.positionY ?? 0}
                      onChange={(e) => pushSettingsChange(prev => ({ ...prev, positionY: parseInt(e.target.value) || 0 }))}
                      className="w-10 bg-transparent text-white font-mono text-xs outline-none text-center"
                    />
                  </div>
                </div>
              </div>

              {/* Rotate (0 deg default) */}
              <div className="flex items-center justify-between text-xs text-slate-300">
                <span>{editorT.inspector.transform.rotation}</span>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1 bg-[#1a1e29] border border-slate-700 rounded-lg px-3 py-1">
                    <input
                      type="number"
                      value={settings.rotation ?? 0}
                      onChange={(e) => pushSettingsChange(prev => ({ ...prev, rotation: parseInt(e.target.value) || 0 }))}
                      className="w-12 bg-transparent text-white font-mono text-xs outline-none text-center"
                    />
                    <span className="text-slate-400">°</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => pushSettingsChange(prev => ({ ...prev, rotation: ((prev.rotation || 0) + 90) % 360 }))}
                    className="p-1.5 rounded-lg bg-[#1a1e29] border border-slate-700 text-slate-300 hover:text-white cursor-pointer"
                    title="Rotate 90°"
                  >
                    <RotateCw className="w-3 h-3" />
                  </button>
                </div>
              </div>

              {/* Flip & Fit Mode Controls */}
              <div className="pt-2 flex items-center justify-between gap-2">
                <span className="text-xs text-slate-300">{editorT.inspector.transform.title}</span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => pushSettingsChange(prev => ({ ...prev, flipH: !prev.flipH }))}
                    className={`px-2.5 py-1 text-xs rounded-lg border font-medium transition-all cursor-pointer ${
                      settings.flipH ? 'border-[#00c5d4] bg-[#00c5d4]/20 text-white' : 'border-slate-700 bg-[#1a1e29] text-slate-300'
                    }`}
                    title="Flip Horizontal"
                  >
                    {editorT.inspector.transform.flipH}
                  </button>
                  <button
                    type="button"
                    onClick={() => pushSettingsChange(prev => ({ ...prev, flipV: !prev.flipV }))}
                    className={`px-2.5 py-1 text-xs rounded-lg border font-medium transition-all cursor-pointer ${
                      settings.flipV ? 'border-[#00c5d4] bg-[#00c5d4]/20 text-white' : 'border-slate-700 bg-[#1a1e29] text-slate-300'
                    }`}
                    title="Flip Vertical"
                  >
                    {editorT.inspector.transform.flipV}
                  </button>
                  <button
                    type="button"
                    onClick={() => pushSettingsChange(prev => ({ ...prev, fitMode: prev.fitMode === 'cover' ? 'contain' : 'cover' }))}
                    className="px-2.5 py-1 text-xs rounded-lg border border-slate-700 bg-[#1a1e29] text-slate-300 hover:text-white cursor-pointer font-medium capitalize"
                    title="Toggle Fit Mode"
                  >
                    {settings.fitMode || 'contain'}
                  </button>
                </div>
              </div>
            </div>

            {/* 2. BLEND */}
            <div className="space-y-3.5 pt-4 border-t border-[#222733]">
              <div className="flex items-center justify-between text-xs font-bold text-white">
                <span>{editorT.inspector.transform.opacity}</span>
                <button
                  type="button"
                  onClick={resetBlend}
                  className="text-slate-400 hover:text-white p-1 cursor-pointer"
                  title={editorT.inspector.transform.reset}
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Opacity slider (100% default) */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs text-slate-300">
                  <span>{editorT.inspector.transform.opacity}</span>
                  <span className="font-mono text-[#00c5d4]">{settings.opacity ?? 100}%</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={settings.opacity ?? 100}
                  onChange={(e) => pushSettingsChange(prev => ({ ...prev, opacity: parseInt(e.target.value) }))}
                  className="w-full accent-[#00c5d4] cursor-pointer h-1.5 bg-slate-800 rounded-lg"
                />
              </div>
            </div>

            {/* Quick Filters */}
            <div className="space-y-3 pt-4 border-t border-[#222733]">
              <span className="text-xs font-bold text-white">{editorT.filtersPanel.title}</span>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: 'normal', name: editorT.effectsPanel.none },
                  { id: 'cinematic', name: editorT.effectsPanel.cinema },
                  { id: 'vivid', name: editorT.effectsPanel.vibrant },
                  { id: 'vintage', name: editorT.effectsPanel.vintage }
                ].map((lut) => (
                  <button
                    key={lut.id}
                    type="button"
                    onClick={() => pushSettingsChange(prev => ({ ...prev, filterPreset: lut.id as any }))}
                    className={`p-2 rounded-xl text-xs font-bold border text-left transition-all cursor-pointer ${
                      settings.filterPreset === lut.id
                        ? 'bg-[#00c5d4]/15 border-[#00c5d4] text-[#00c5d4]'
                        : 'bg-[#1a1e29] border-slate-700 text-slate-300 hover:border-slate-500'
                    }`}
                  >
                    {lut.name}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        {/* SUBTAB: REMOVE BG / CHROMA KEY */}
        {inspectorTab === 'video' && videoSubTab === 'remove_bg' && (
          <div className="space-y-4 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-bold text-white">{editorT.inspector.removeBg.chromaKey}</span>
              <button
                type="button"
                onClick={() => setChromaKey(prev => ({ ...prev, enabled: !prev.enabled }))}
                className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                  chromaKey.enabled ? 'bg-[#00c5d4] text-slate-950' : 'bg-[#1a1e29] border border-slate-700 text-slate-300'
                }`}
              >
                {chromaKey.enabled ? 'ON' : 'OFF'}
              </button>
            </div>

            <p className="text-slate-400 text-[11px]">
              {editorT.inspector.removeBg.autoCutoutDesc}
            </p>

            <div className="space-y-2 pt-2">
              <div className="flex items-center justify-between text-slate-300">
                <span>{editorT.inspector.removeBg.colorPicker}</span>
                <input
                  type="color"
                  value={chromaKey.keyColor}
                  onChange={(e) => setChromaKey(prev => ({ ...prev, keyColor: e.target.value }))}
                  className="w-8 h-8 rounded-lg border border-slate-700 bg-transparent cursor-pointer"
                />
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between text-slate-300">
                  <span>{editorT.inspector.removeBg.similarity}</span>
                  <span className="font-mono">{chromaKey.similarity}%</span>
                </div>
                <input
                  type="range"
                  min={5}
                  max={80}
                  value={chromaKey.similarity}
                  onChange={(e) => setChromaKey(prev => ({ ...prev, similarity: parseInt(e.target.value) }))}
                  className="w-full accent-[#00c5d4] cursor-pointer h-1.5 bg-slate-800 rounded-lg"
                />
              </div>
            </div>
          </div>
        )}

        {/* SUBTAB: BACKGROUND */}
        {inspectorTab === 'video' && videoSubTab === 'background' && (
          <div className="space-y-4 text-xs">
            <span className="font-bold text-white block">{editorT.inspector.background.title}</span>
            <div className="grid grid-cols-2 gap-2">
              {BACKGROUND_PRESETS.map(bg => (
                <button
                  key={bg.id}
                  type="button"
                  onClick={() => pushSettingsChange(prev => ({ ...prev, bgColor: bg.id as any }))}
                  className={`p-2.5 rounded-xl border text-left font-bold transition-all cursor-pointer ${
                    settings.bgColor === bg.id
                      ? 'border-[#00c5d4] bg-[#00c5d4]/15 text-[#00c5d4]'
                      : 'border-slate-800 bg-[#1a1e29] text-slate-300 hover:border-slate-600'
                  }`}
                >
                  {bg.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* AUDIO TAB (Individual Media Audio & Master Inspector) */}
        {inspectorTab === 'audio' && (
          <div className="space-y-4">
            {/* Switch between Per-Clip Settings and Master Mix */}
            <div className="flex rounded-xl bg-[#131722] p-1 border border-[#232733]">
              <button
                type="button"
                onClick={() => setAudioInspectorMode('individual')}
                className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-bold transition-all cursor-pointer text-center ${
                  audioInspectorMode === 'individual'
                    ? 'bg-[#00c5d4] text-slate-950 shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Alohida fayllar ({clips.length + audioClips.length})
              </button>
              <button
                type="button"
                onClick={() => setAudioInspectorMode('master')}
                className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-bold transition-all cursor-pointer text-center ${
                  audioInspectorMode === 'master'
                    ? 'bg-[#00c5d4] text-slate-950 shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Umumiy Master
              </button>
            </div>

            {audioInspectorMode === 'individual' ? (
              <div className="space-y-4">
                {/* Active Selected Clip Banner (if any selected) */}
                {(() => {
                  const activeAudio = audioClips.find(a => a.id === selectedAudioClipId);
                  const activeClip = clips.find(c => c.id === selectedClipId);

                  if (activeAudio) {
                    const curVol = activeAudio.volume !== undefined ? activeAudio.volume : 100;
                    const isMuted = activeAudio.muted || false;
                    return (
                      <div className="p-3 rounded-xl bg-[#142036] border border-sky-500/40 space-y-3 shadow-lg">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5 truncate">
                            <Music className="w-4 h-4 text-sky-400 shrink-0" />
                            <span className="text-xs font-bold text-sky-300 truncate">
                              Tanlangan MP3: {activeAudio.name}
                            </span>
                          </div>
                          <span className="font-mono text-xs font-bold text-sky-400 shrink-0 ml-2">
                            {isMuted ? 'Ovoz o\'chiq' : `${curVol}%`}
                          </span>
                        </div>

                        {/* Volume Slider */}
                        <div className="space-y-1">
                          <div className="flex justify-between text-[11px] text-slate-400">
                            <span>Ovoz balandligi</span>
                            <span className={curVol > 100 ? 'text-amber-400 font-bold' : 'text-slate-400'}>
                              {curVol > 100 ? `Kuchaytirish: +${curVol - 100}%` : curVol === 100 ? 'Asl (100%)' : curVol === 0 ? 'O\'chirilgan' : `${curVol}%`}
                            </span>
                          </div>
                          <input
                            type="range"
                            min={0}
                            max={200}
                            value={isMuted ? 0 : curVol}
                            onChange={(e) => {
                              const val = Number(e.target.value);
                              updateAudioClip(activeAudio.id, { volume: val, muted: val === 0 });
                            }}
                            className="w-full accent-sky-400 cursor-pointer h-2 bg-[#0e1724] rounded-lg"
                          />
                        </div>

                        {/* Quick Presets */}
                        <div className="flex items-center gap-1">
                          {[
                            { label: '0%', val: 0 },
                            { label: '50%', val: 50 },
                            { label: '100%', val: 100 },
                            { label: '150%', val: 150 },
                            { label: '200%', val: 200 },
                          ].map(p => (
                            <button
                              key={p.val}
                              type="button"
                              onClick={() => updateAudioClip(activeAudio.id, { volume: p.val, muted: p.val === 0 })}
                              className={`flex-1 py-1 rounded text-[10px] font-bold transition-all cursor-pointer ${
                                curVol === p.val && !isMuted
                                  ? 'bg-sky-500 text-slate-950 shadow'
                                  : 'bg-[#1b2a45] hover:bg-[#25395a] text-slate-300'
                              }`}
                            >
                              {p.label}
                            </button>
                          ))}
                        </div>

                        {/* Fade & Speed Controls */}
                        <div className="flex items-center justify-between pt-1 border-t border-sky-500/20">
                          <button
                            type="button"
                            onClick={() => updateAudioClip(activeAudio.id, { muted: !isMuted })}
                            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                              isMuted
                                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                                : 'bg-[#1b2a45] text-slate-200 hover:text-white'
                            }`}
                          >
                            {isMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
                            <span>{isMuted ? 'Ovozni yoqish' : 'Ovozni o\'chirish'}</span>
                          </button>

                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => updateAudioClip(activeAudio.id, { 
                                fadeIn: !activeAudio.fadeIn,
                                fadeInDuration: activeAudio.fadeInDuration || 1.0
                              })}
                              className={`px-2 py-0.5 rounded text-[10px] font-bold cursor-pointer transition-colors ${
                                activeAudio.fadeIn ? 'bg-sky-500 text-slate-950' : 'bg-[#1b2a45] text-slate-300'
                              }`}
                            >
                              Fade In
                            </button>
                            <button
                              type="button"
                              onClick={() => updateAudioClip(activeAudio.id, { 
                                fadeOut: !activeAudio.fadeOut,
                                fadeOutDuration: activeAudio.fadeOutDuration || 1.0
                              })}
                              className={`px-2 py-0.5 rounded text-[10px] font-bold cursor-pointer transition-colors ${
                                activeAudio.fadeOut ? 'bg-sky-500 text-slate-950' : 'bg-[#1b2a45] text-slate-300'
                              }`}
                            >
                              Fade Out
                            </button>
                          </div>
                        </div>

                        {/* Fade In & Out Duration Sliders (when active) */}
                        {(activeAudio.fadeIn || activeAudio.fadeOut) && (
                          <div className="pt-2 border-t border-sky-500/10 space-y-2">
                            {activeAudio.fadeIn && (
                              <div className="space-y-1">
                                <div className="flex justify-between text-[10px] text-sky-300">
                                  <span>Fade In davomiyligi:</span>
                                  <span className="font-mono font-bold">{activeAudio.fadeInDuration || 1.0}s</span>
                                </div>
                                <div className="flex items-center gap-1">
                                  {[0.5, 1.0, 1.5, 2.0, 3.0].map(sec => (
                                    <button
                                      key={sec}
                                      type="button"
                                      onClick={() => updateAudioClip(activeAudio.id, { fadeInDuration: sec })}
                                      className={`flex-1 py-0.5 rounded text-[9px] font-bold cursor-pointer transition-colors ${
                                        (activeAudio.fadeInDuration || 1.0) === sec
                                          ? 'bg-sky-400 text-slate-950'
                                          : 'bg-[#18243b] text-slate-400 hover:text-white'
                                      }`}
                                    >
                                      {sec}s
                                    </button>
                                  ))}
                                </div>
                              </div>
                            )}
                            {activeAudio.fadeOut && (
                              <div className="space-y-1">
                                <div className="flex justify-between text-[10px] text-sky-300">
                                  <span>Fade Out davomiyligi:</span>
                                  <span className="font-mono font-bold">{activeAudio.fadeOutDuration || 1.0}s</span>
                                </div>
                                <div className="flex items-center gap-1">
                                  {[0.5, 1.0, 1.5, 2.0, 3.0].map(sec => (
                                    <button
                                      key={sec}
                                      type="button"
                                      onClick={() => updateAudioClip(activeAudio.id, { fadeOutDuration: sec })}
                                      className={`flex-1 py-0.5 rounded text-[9px] font-bold cursor-pointer transition-colors ${
                                        (activeAudio.fadeOutDuration || 1.0) === sec
                                          ? 'bg-sky-400 text-slate-950'
                                          : 'bg-[#18243b] text-slate-400 hover:text-white'
                                      }`}
                                    >
                                      {sec}s
                                    </button>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  } else if (activeClip) {
                    const curVol = activeClip.volume !== undefined ? activeClip.volume : 100;
                    const isMuted = activeClip.muted || false;
                    return (
                      <div className="p-3 rounded-xl bg-[#14232c] border border-teal-500/40 space-y-3 shadow-lg">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5 truncate">
                            <span className="w-2 h-2 rounded-full bg-teal-400 animate-pulse shrink-0" />
                            <span className="text-xs font-bold text-teal-300 truncate">
                              Tanlangan: {activeClip.name}
                            </span>
                          </div>
                          <span className="font-mono text-xs font-bold text-teal-400 shrink-0 ml-2">
                            {isMuted ? 'Ovoz o\'chiq' : `${curVol}%`}
                          </span>
                        </div>

                        {/* Volume Slider (0 - 200%) */}
                        <div className="space-y-1">
                          <div className="flex justify-between text-[11px] text-slate-400">
                            <span>Ovoz balandligi</span>
                            <span className={curVol > 100 ? 'text-amber-400 font-bold' : 'text-slate-400'}>
                              {curVol > 100 ? `Kuchaytirish: +${curVol - 100}%` : curVol === 100 ? 'Asl (100%)' : curVol === 0 ? 'O\'chirilgan' : `${curVol}%`}
                            </span>
                          </div>
                          <input
                            type="range"
                            min={0}
                            max={200}
                            value={isMuted ? 0 : curVol}
                            onChange={(e) => {
                              const val = Number(e.target.value);
                              updateClip(activeClip.id, { volume: val, muted: val === 0 });
                            }}
                            className="w-full accent-teal-400 cursor-pointer h-2 bg-[#0e171e] rounded-lg"
                          />
                        </div>

                        {/* Quick Volume Presets */}
                        <div className="flex items-center gap-1">
                          {[
                            { label: '0%', val: 0 },
                            { label: '50%', val: 50 },
                            { label: '100%', val: 100 },
                            { label: '150%', val: 150 },
                            { label: '200%', val: 200 },
                          ].map(p => (
                            <button
                              key={p.val}
                              type="button"
                              onClick={() => updateClip(activeClip.id, { volume: p.val, muted: p.val === 0 })}
                              className={`flex-1 py-1 rounded text-[10px] font-bold transition-all cursor-pointer ${
                                curVol === p.val && !isMuted
                                  ? 'bg-teal-500 text-slate-950 shadow'
                                  : 'bg-[#1b2b36] hover:bg-[#253947] text-slate-300'
                              }`}
                            >
                              {p.label}
                            </button>
                          ))}
                        </div>

                        {/* Actions: Mute / Unmute & Speed */}
                        <div className="flex items-center justify-between pt-1 border-t border-teal-500/20">
                          <button
                            type="button"
                            onClick={() => updateClip(activeClip.id, { muted: !isMuted })}
                            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                              isMuted
                                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                                : 'bg-[#1b2b36] text-slate-200 hover:text-white'
                            }`}
                          >
                            {isMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
                            <span>{isMuted ? 'Ovozni yoqish' : 'Ovozni o\'chirish'}</span>
                          </button>

                          <div className="flex items-center gap-1">
                            <span className="text-[10px] text-slate-400">Tezlik:</span>
                            {[0.5, 1, 1.5, 2].map(sp => (
                              <button
                                key={sp}
                                type="button"
                                onClick={() => updateClip(activeClip.id, { speed: sp })}
                                className={`px-1.5 py-0.5 rounded text-[10px] font-bold cursor-pointer transition-colors ${
                                  (activeClip.speed || 1) === sp
                                    ? 'bg-teal-500 text-slate-950'
                                    : 'bg-[#1b2b36] text-slate-400 hover:text-white'
                                }`}
                              >
                                {sp}x
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    );
                  }

                  return null;
                })()}

                {/* All Video Clips List */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                      <Video className="w-3.5 h-3.5 text-teal-400" />
                      <span>Yuklangan Video Kliplar ({clips.length})</span>
                    </span>
                  </div>

                  {clips.length === 0 ? (
                    <div className="p-3 text-center rounded-xl bg-[#171a22] border border-[#232733] text-xs text-slate-400">
                      Video yuklanmagan
                    </div>
                  ) : (
                    clips.map((clip, cIdx) => {
                      const isSelected = selectedClipId === clip.id;
                      const curVol = clip.volume !== undefined ? clip.volume : 100;
                      const isMuted = clip.muted || false;

                      return (
                        <div
                          key={clip.id}
                          onClick={() => {
                            setSelectedClipId(clip.id);
                            setSelectedAudioClipId(null);
                            setSelectedTextClipId(null);
                          }}
                          className={`p-2.5 rounded-xl border transition-all cursor-pointer space-y-2 ${
                            isSelected
                              ? 'bg-[#172228] border-teal-400/80 shadow-md'
                              : 'bg-[#171a22] border-[#26282d] hover:border-slate-600'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5 truncate">
                              <span className="text-[10px] font-bold text-teal-400 bg-teal-950/80 px-1.5 py-0.5 rounded">
                                #{cIdx + 1}
                              </span>
                              <span className="text-xs font-bold text-white truncate max-w-[150px]">
                                {clip.name}
                              </span>
                            </div>
                            <span className="font-mono text-xs font-bold text-teal-400">
                              {isMuted ? 'O\'chiq' : `${curVol}%`}
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                            <input
                              type="range"
                              min={0}
                              max={200}
                              value={isMuted ? 0 : curVol}
                              onChange={(e) => {
                                e.stopPropagation();
                                const val = Number(e.target.value);
                                updateClip(clip.id, { volume: val, muted: val === 0 });
                              }}
                              className="flex-1 accent-teal-400 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
                            />
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                updateClip(clip.id, { muted: !isMuted });
                              }}
                              className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all cursor-pointer shrink-0 ${
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
                    })
                  )}
                </div>

                {/* All Audio / MP3 Clips List */}
                <div className="space-y-2 pt-2 border-t border-[#232733]">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                      <Music className="w-3.5 h-3.5 text-sky-400" />
                      <span>Yuklangan MP3 / Musiqalar ({audioClips.length})</span>
                    </span>
                    <button
                      type="button"
                      onClick={onUploadAudio}
                      className="text-[11px] font-bold text-sky-400 hover:text-sky-300 cursor-pointer flex items-center gap-1"
                    >
                      <Plus className="w-3 h-3" />
                      <span>+ Yangi MP3</span>
                    </button>
                  </div>

                  {audioClips.length === 0 ? (
                    <div className="p-3 text-center rounded-xl bg-[#171a22] border border-[#232733] text-xs text-slate-400 space-y-2">
                      <p>Musiqa yoki audio fayl yuklanmagan</p>
                      <button
                        type="button"
                        onClick={onUploadAudio}
                        className="px-3 py-1.5 rounded-lg bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 border border-sky-500/40 text-xs font-bold cursor-pointer transition-all"
                      >
                        + MP3 / Audio yuklash
                      </button>
                    </div>
                  ) : (
                    audioClips.map((audio, aIdx) => {
                      const isSelected = selectedAudioClipId === audio.id;
                      const curVol = audio.volume !== undefined ? audio.volume : 100;
                      const isMuted = audio.muted || false;

                      return (
                        <div
                          key={audio.id}
                          onClick={() => {
                            setSelectedAudioClipId(audio.id);
                            setSelectedClipId('');
                            setSelectedTextClipId(null);
                          }}
                          className={`p-2.5 rounded-xl border transition-all cursor-pointer space-y-2 ${
                            isSelected
                              ? 'bg-[#152336] border-sky-400/80 shadow-md'
                              : 'bg-[#171a22] border-[#26282d] hover:border-slate-600'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5 truncate">
                              <span className="text-[10px] font-bold text-sky-400 bg-sky-950/80 px-1.5 py-0.5 rounded">
                                #{aIdx + 1}
                              </span>
                              <span className="text-xs font-bold text-white truncate max-w-[150px]">
                                {audio.name}
                              </span>
                            </div>
                            <span className="font-mono text-xs font-bold text-sky-400">
                              {isMuted ? 'O\'chiq' : `${curVol}%`}
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                            <input
                              type="range"
                              min={0}
                              max={200}
                              value={isMuted ? 0 : curVol}
                              onChange={(e) => {
                                e.stopPropagation();
                                const val = Number(e.target.value);
                                updateAudioClip(audio.id, { volume: val, muted: val === 0 });
                              }}
                              className="flex-1 accent-sky-400 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
                            />
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                updateAudioClip(audio.id, { muted: !isMuted });
                              }}
                              className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all cursor-pointer shrink-0 ${
                                isMuted
                                  ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                                  : 'bg-[#26282d] text-slate-300 hover:text-white'
                              }`}
                            >
                              {isMuted ? <VolumeX className="w-3 h-3" /> : <Volume2 className="w-3 h-3" />}
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setAudioClips(prev => prev.filter(a => a.id !== audio.id));
                                if (selectedAudioClipId === audio.id) setSelectedAudioClipId(null);
                              }}
                              className="p-1 rounded text-rose-400 hover:text-rose-300 hover:bg-rose-500/20 cursor-pointer transition-colors"
                              title="O'chirish"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            ) : (
              /* Master Mix Controls */
              <div className="space-y-4">
                {/* Master Video */}
                <MasterAudioChannel
                  type="video"
                  title="Umumiy Video Master Kanali"
                  volume={settings.volume ?? 100}
                  isMuted={settings.removeAudio || isVideoAudioMuted}
                  onVolumeChange={(val) => {
                    pushSettingsChange(prev => ({
                      ...prev,
                      volume: val,
                      removeAudio: val === 0
                    }));
                    if (val > 0 && isVideoAudioMuted) {
                      setIsVideoAudioMuted(false);
                    }
                  }}
                  onToggleMute={toggleVideoAudioMute}
                  onReset={() => {
                    setIsVideoAudioMuted(false);
                    pushSettingsChange(prev => ({ ...prev, volume: 100, removeAudio: false }));
                  }}
                />

                {/* Master Music */}
                <MasterAudioChannel
                  type="music"
                  title="Umumiy MP3 / Musiqa Master Kanali"
                  volume={settings.musicVolume ?? 100}
                  isMuted={settings.removeMusic || isMusicAudioMuted}
                  onVolumeChange={(val) => {
                    pushSettingsChange(prev => ({
                      ...prev,
                      musicVolume: val,
                      removeMusic: val === 0
                    }));
                    if (val > 0 && isMusicAudioMuted) {
                      setIsMusicAudioMuted(false);
                    }
                  }}
                  onToggleMute={toggleMusicAudioMute}
                  onReset={() => {
                    setIsMusicAudioMuted(false);
                    pushSettingsChange(prev => ({ ...prev, musicVolume: 100, removeMusic: false }));
                  }}
                />
              </div>
            )}
          </div>
        )}

        {/* SPEED TAB */}
        {inspectorTab === 'speed' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between text-xs font-bold text-white">
              <span>{editorT.inspector.speedTab.title}</span>
              <span className="font-mono text-[#00c5d4] font-bold">{settings.speed}x</span>
            </div>
            <input
              type="range"
              min={0.25}
              max={4}
              step={0.25}
              value={settings.speed}
              onChange={(e) => pushSettingsChange(prev => ({ ...prev, speed: parseFloat(e.target.value) }))}
              className="w-full accent-[#00c5d4] cursor-pointer h-1.5 bg-slate-800 rounded-lg"
            />
            <div className="flex justify-between text-[11px] font-mono text-slate-400">
              <span onClick={() => pushSettingsChange(prev => ({ ...prev, speed: 0.25 }))} className="cursor-pointer hover:text-white">0.25x</span>
              <span onClick={() => pushSettingsChange(prev => ({ ...prev, speed: 1 }))} className="cursor-pointer hover:text-white">1x ({editorT.inspector.speedTab.normalSpeed})</span>
              <span onClick={() => pushSettingsChange(prev => ({ ...prev, speed: 2 }))} className="cursor-pointer hover:text-white">2x</span>
              <span onClick={() => pushSettingsChange(prev => ({ ...prev, speed: 4 }))} className="cursor-pointer hover:text-white">4x</span>
            </div>
          </div>
        )}

        {/* ANIMATION TAB */}
        {inspectorTab === 'animation' && (
          <div className="space-y-4 text-xs">
            <span className="font-bold text-white">{editorT.inspector.animationTab.title}</span>
            <div className="space-y-2">
              {[
                { id: 'fade', name: editorT.transitionsPanel.fade, effect: 'vignette' },
                { id: 'zoom', name: editorT.transitionsPanel.zoom, effect: 'glow' },
                { id: 'glitch', name: 'Glitch Climax', effect: 'glitch' },
                { id: 'vhs', name: 'VHS Retro Tone', effect: 'vhs' }
              ].map((fx) => (
                <button
                  key={fx.id}
                  type="button"
                  onClick={() => {
                    setActiveEffect(fx.effect);
                    setActiveTransition(fx.id);
                  }}
                  className={`w-full p-2.5 rounded-xl border text-left font-semibold flex items-center justify-between transition-all cursor-pointer ${
                    activeEffect === fx.effect
                      ? 'border-[#00c5d4] bg-[#00c5d4]/15 text-[#00c5d4]'
                      : 'border-slate-700 bg-[#1a1e29] hover:bg-[#222838] text-slate-300'
                  }`}
                >
                  <span>{fx.name}</span>
                  <Sparkles className="w-3.5 h-3.5 text-[#00c5d4]" />
                </button>
              ))}
            </div>
          </div>
        )}

      </div>
    </aside>
  );
};
