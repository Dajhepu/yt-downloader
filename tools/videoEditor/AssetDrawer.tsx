import React from 'react';
import {
  X,
  ChevronLeft,
  RotateCw,
  Plus,
  Play,
  Square,
  Trash2,
  Music,
  Video,
  Volume2,
  VolumeX,
  Type,
  Sparkles,
  Split,
  FolderOpen
} from 'lucide-react';
import { EditorSettings, Language } from '../../types';
import { VideoEditorTranslationSchema } from '../../translations/videoEditorTranslations';
import {
  LeftSidebarTab,
  ProjectAsset,
  VideoClipItem,
  AudioClipItem,
  TextClipItem,
  StickerItem
} from './types';
import {
  ASPECT_RATIOS,
  BACKGROUND_PRESETS,
  TRANSITION_PRESETS
} from './editorConstants';
import { MasterAudioChannel } from './MasterAudioChannel';
import { StickersPanel } from './StickersPanel';

interface AssetDrawerProps {
  isAssetDrawerOpen: boolean;
  setIsAssetDrawerOpen: React.Dispatch<React.SetStateAction<boolean>>;
  mobileActiveSheet: LeftSidebarTab | 'inspector' | null;
  setMobileActiveSheet: React.Dispatch<React.SetStateAction<LeftSidebarTab | 'inspector' | null>>;
  leftNavTab: LeftSidebarTab;
  editorT: VideoEditorTranslationSchema;
  lang: Language | string;
  assetTab: 'project' | 'cloud';
  setAssetTab: React.Dispatch<React.SetStateAction<'project' | 'cloud'>>;
  projectAssets: ProjectAsset[];
  activeAssetId: string;
  setActiveAssetId: (id: string) => void;
  setProjectName: React.Dispatch<React.SetStateAction<string>>;
  handleUploadClick: () => void;
  handleAudioUploadClick: () => void;
  handleRefreshAssets: () => void;
  handleDeleteAsset: (assetId: string) => void;
  handleAddAssetToTimeline: (asset: ProjectAsset) => void;
  togglePreviewAudio: (asset: ProjectAsset) => void;
  previewingAudioId: string | null;
  activeBgmName: string;
  clips: VideoClipItem[];
  setClips: React.Dispatch<React.SetStateAction<VideoClipItem[]>>;
  updateClip: (id: string, updates: Partial<VideoClipItem>) => void;
  selectedClipId: string;
  audioClips: AudioClipItem[];
  updateAudioClip: (id: string, updates: Partial<AudioClipItem>) => void;
  isVideoAudioMuted: boolean;
  setIsVideoAudioMuted: (muted: boolean) => void;
  toggleVideoAudioMute: () => void;
  isMusicAudioMuted: boolean;
  setIsMusicAudioMuted: (muted: boolean) => void;
  toggleMusicAudioMute: () => void;
  settings: EditorSettings;
  pushSettingsChange: (updater: (prev: EditorSettings) => EditorSettings) => void;
  textClips: TextClipItem[];
  setTextClips: React.Dispatch<React.SetStateAction<TextClipItem[]>>;
  selectedTextClipId: string | null;
  setSelectedTextClipId: (id: string | null) => void;
  stickers: StickerItem[];
  setStickers: React.Dispatch<React.SetStateAction<StickerItem[]>>;
  selectedStickerId: string | null;
  setSelectedStickerId: (id: string | null) => void;
  currentTime: number;
  duration: number;
  activeEffect: string;
  setActiveEffect: (effect: string) => void;
  activeTransition: string;
  setActiveTransition: (transition: string) => void;
  transitionPickerClipId: string | null;
  setTransitionPickerClipId: (id: string | null) => void;
}

export const AssetDrawer: React.FC<AssetDrawerProps> = ({
  isAssetDrawerOpen,
  setIsAssetDrawerOpen,
  mobileActiveSheet,
  setMobileActiveSheet,
  leftNavTab,
  editorT,
  lang,
  assetTab,
  setAssetTab,
  projectAssets,
  activeAssetId,
  setActiveAssetId,
  setProjectName,
  handleUploadClick,
  handleAudioUploadClick,
  handleRefreshAssets,
  handleDeleteAsset,
  handleAddAssetToTimeline,
  togglePreviewAudio,
  previewingAudioId,
  activeBgmName,
  clips,
  setClips,
  updateClip,
  selectedClipId,
  audioClips,
  updateAudioClip,
  isVideoAudioMuted,
  setIsVideoAudioMuted,
  toggleVideoAudioMute,
  isMusicAudioMuted,
  setIsMusicAudioMuted,
  toggleMusicAudioMute,
  settings,
  pushSettingsChange,
  textClips,
  setTextClips,
  selectedTextClipId,
  setSelectedTextClipId,
  stickers,
  setStickers,
  selectedStickerId,
  setSelectedStickerId,
  currentTime,
  duration,
  activeEffect,
  setActiveEffect,
  activeTransition,
  setActiveTransition,
  transitionPickerClipId,
  setTransitionPickerClipId
}) => {
  const getTabTitle = (tab: LeftSidebarTab) => {
    switch (tab) {
      case 'media': return editorT.sidebarTabs.media;
      case 'audio': return editorT.sidebarTabs.audio;
      case 'text': return editorT.sidebarTabs.text;
      case 'stickers': return editorT.sidebarTabs.stickers;
      case 'effects': return editorT.sidebarTabs.effects;
      case 'transitions': return editorT.sidebarTabs.transitions;
      case 'filters': return editorT.sidebarTabs.filters;
      case 'library': return editorT.sidebarTabs.library;
      default: return tab;
    }
  };

  if (!isAssetDrawerOpen && (!mobileActiveSheet || mobileActiveSheet === 'inspector')) {
    return null;
  }

  return (
    <div
            className={
              mobileActiveSheet && mobileActiveSheet !== 'inspector'
                ? "fixed inset-x-0 bottom-0 z-50 bg-[#141720] border-t border-[#2a3040] rounded-t-2xl shadow-2xl flex flex-col h-[58vh] max-h-[75vh] md:hidden animate-in slide-in-from-bottom duration-250 select-none"
                : "hidden md:flex w-64 sm:w-80 bg-[#141720] border-r border-[#222733] flex-col shrink-0 z-10 transition-all select-none"
            }
          >
            {/* Drawer Header with Title & Collapse */}
            <div className="h-11 px-3 border-b border-[#222733] flex items-center justify-between shrink-0 bg-[#171b26] md:bg-transparent rounded-t-2xl md:rounded-none">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#00c5d4] md:hidden" />
                <span className="text-xs font-bold text-white capitalize tracking-wide">
                  {getTabTitle(leftNavTab)}
                </span>
              </div>

              <div className="w-10 h-1 bg-slate-600 rounded-full md:hidden" />

              <button
                type="button"
                onClick={() => {
                  setIsAssetDrawerOpen(false);
                  setMobileActiveSheet(null);
                }}
                className="p-1 rounded text-slate-400 hover:text-white hover:bg-[#26282d] transition-colors cursor-pointer"
                title="Close Panel"
              >
                <X className="w-4 h-4 md:hidden" />
                <ChevronLeft className="w-4 h-4 hidden md:block" />
              </button>
            </div>

            {/* TAB 1: MEDIA (Upload, Refresh, Project Assets) */}
            {leftNavTab === 'media' && (
              <div className="flex-1 flex flex-col overflow-hidden">
                {/* Project / Cloud tabs */}
                <div className="px-3 border-b border-[#222733] flex items-center gap-4 text-xs font-bold">
                  <button
                    type="button"
                    onClick={() => setAssetTab('project')}
                    className={`py-2 relative ${assetTab === 'project' ? 'text-white' : 'text-slate-400 hover:text-slate-200'}`}
                  >
                    <span>{editorT.mediaDrawer.projectMedia}</span>
                    {assetTab === 'project' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#00c5d4]" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => setAssetTab('cloud')}
                    className={`py-2 relative ${assetTab === 'cloud' ? 'text-white' : 'text-slate-400 hover:text-slate-200'}`}
                  >
                    <span>{editorT.mediaDrawer.cloudSamples}</span>
                    {assetTab === 'cloud' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#00c5d4]" />}
                  </button>
                </div>

                {/* Upload Button & Multi-file badge */}
                <div className="p-3 border-b border-[#26282d] space-y-2">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleUploadClick}
                      className="flex-1 flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#00c5d4] hover:bg-[#00b5c4] active:bg-[#009fad] text-slate-950 font-bold text-xs transition-all cursor-pointer shadow-sm"
                    >
                      <Plus className="w-4 h-4 stroke-[2.5]" />
                      <span>{editorT.mediaDrawer.importMedia}</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleRefreshAssets}
                      className="p-2 rounded-lg hover:bg-[#26282d] text-slate-400 hover:text-white transition-colors cursor-pointer border border-[#2e3340]"
                      title="Refresh Assets"
                    >
                      <RotateCw className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="text-[10px] text-[#00c5d4] bg-[#00c5d4]/10 border border-[#00c5d4]/20 rounded px-2 py-1 text-center font-medium">
                    {lang === 'uz' ? '✓ Xohlagancha video va MP3 fayl yuklashingiz mumkin' : '✓ Upload as many videos and MP3 files as you want'}
                  </div>
                </div>

                {/* Media Asset Items Grid */}
                <div className="flex-1 overflow-y-auto p-3 space-y-3">
                  {projectAssets.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-10 px-2 text-center">
                      <div className="w-10 h-10 rounded-xl bg-[#1e2330] flex items-center justify-center text-slate-400 mb-2.5">
                        <FolderOpen className="w-5 h-5 text-[#00c5d4]" />
                      </div>
                      <p className="text-xs font-semibold text-slate-200 mb-1">{editorT.mediaDrawer.noAssets}</p>
                      <p className="text-[11px] text-slate-400 mb-3 max-w-[170px] leading-relaxed">
                        {editorT.mediaDrawer.dragDropHint}
                      </p>
                      <button
                        type="button"
                        onClick={handleUploadClick}
                        className="px-3.5 py-1.5 rounded-lg bg-[#00c5d4] hover:bg-[#00b5c4] text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow cursor-pointer transition-all"
                      >
                        <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                        {editorT.mediaDrawer.uploadVideoAudio}
                      </button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-2.5">
                      {projectAssets.map((asset) => {
                        const isSelected = asset.id === activeAssetId;
                        const isAudio = asset.type === 'audio';

                        return (
                          <div
                            key={asset.id}
                            onClick={() => {
                              setActiveAssetId(asset.id);
                              if (!isAudio) setProjectName(asset.name);
                            }}
                            className={`group relative rounded-md overflow-hidden border cursor-pointer transition-all ${isSelected
                              ? 'border-[#00c5d4] bg-[#20232a]'
                              : 'border-[#26282d] bg-[#1a1c22] hover:border-slate-500'
                              }`}
                          >
                            <div className="w-full aspect-[16/10] relative flex items-center justify-center bg-slate-900 overflow-hidden">
                              {isAudio ? (
                                <div className="w-full h-full flex items-center justify-center bg-[#131418]">
                                  <div className="w-8 h-8 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                                    <Music className="w-4 h-4" />
                                  </div>
                                </div>
                              ) : (
                                <img
                                  src={asset.thumbnailUrl}
                                  alt={asset.name}
                                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                                />
                              )}

                              {asset.isUploaded && (
                                <div className="absolute top-1 left-1 px-1.5 py-0.5 rounded bg-black/75 backdrop-blur-sm text-[9px] font-semibold text-slate-200">
                                  {isAudio ? 'Audio' : 'Video'}
                                </div>
                              )}

                              <div className="absolute bottom-1 right-1 px-1 py-0.5 rounded bg-black/80 backdrop-blur-sm text-[10px] font-mono font-medium text-white">
                                {asset.durationStr}
                              </div>

                              {/* Hover Overlay with Add to Timeline and Delete buttons */}
                              <div className="absolute inset-0 bg-black/75 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1.5 p-1">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleAddAssetToTimeline(asset);
                                  }}
                                  className="px-2 py-1 rounded bg-[#00c5d4] hover:bg-[#00b5c4] text-slate-950 text-[10px] font-bold flex items-center gap-1 shadow cursor-pointer transition-all"
                                  title={editorT.audioPanel.addToTimeline}
                                >
                                  <Plus className="w-3 h-3 stroke-[2.5]" />
                                  <span>+ Timeline</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteAsset(asset.id);
                                  }}
                                  className="p-1.5 rounded bg-rose-500/80 hover:bg-rose-600 text-white shadow cursor-pointer transition-all"
                                  title={editorT.timeline.delete}
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>
                            </div>

                            <div className="p-1.5 text-[11px] font-medium text-slate-300 truncate">
                              {asset.name}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB 2: AUDIO & SOUND */}
            {leftNavTab === 'audio' && (
              <div className="flex-1 overflow-y-auto p-3 space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-white block">{editorT.audioPanel.title}</span>
                  </div>

                  {/* Upload Audio Button */}
                  <button
                    type="button"
                    onClick={handleAudioUploadClick}
                    className="w-full py-2.5 px-3 rounded-xl border border-dashed border-[#00c5d4]/40 hover:border-[#00c5d4] bg-[#00c5d4]/5 hover:bg-[#00c5d4]/10 text-[#00c5d4] hover:text-white text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm mb-2"
                  >
                    <Plus className="w-4 h-4 stroke-[2.5]" />
                    <span>{editorT.audioPanel.uploadBtn}</span>
                  </button>
                  <div className="text-[10px] text-[#00c5d4] bg-[#00c5d4]/10 border border-[#00c5d4]/20 rounded px-2 py-1 text-center font-medium mb-3">
                    {lang === 'uz' ? '✓ Bir nechta MP3 fayllarni bir vaqtda yuklash mumkin' : '✓ Upload multiple MP3 audio tracks at once'}
                  </div>

                  {/* List of user uploaded audio files */}
                  <div className="space-y-2">
                    {projectAssets.filter(a => a.type === 'audio').length === 0 ? (
                      <div className="p-4 rounded-xl bg-[#171a22] border border-[#232733] text-center">
                        <Music className="w-6 h-6 text-slate-500 mx-auto mb-1.5" />
                        <p className="text-xs font-medium text-slate-300 mb-0.5">{editorT.audioPanel.noMusicSelected}</p>
                        <p className="text-[11px] text-slate-400">
                          {editorT.mediaDrawer.uploadAudioPrompt}
                        </p>
                      </div>
                    ) : (
                      projectAssets.filter(a => a.type === 'audio').map(bgm => (
                        <div
                          key={bgm.id}
                          className={`p-2.5 rounded-xl border flex items-center justify-between transition-all ${activeBgmName === bgm.name
                            ? 'border-[#00c5d4] bg-[#00c5d4]/10 text-white'
                            : 'border-[#26282d] bg-[#1a1e29] text-slate-300 hover:border-slate-500'
                            }`}
                        >
                          <div className="flex items-center gap-2.5 overflow-hidden">
                            <div className="w-7 h-7 rounded-lg bg-sky-500/20 text-sky-400 flex items-center justify-center shrink-0">
                              <Music className="w-3.5 h-3.5" />
                            </div>
                            <div className="truncate">
                              <div className="text-xs font-semibold truncate">{bgm.name}</div>
                              <div className="text-[10px] text-slate-400 font-mono">{bgm.durationStr}</div>
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0 ml-2">
                            {/* Listen Preview Button */}
                            <button
                              type="button"
                              onClick={() => togglePreviewAudio(bgm)}
                              className={`p-1.5 rounded-lg border text-xs transition-all cursor-pointer ${previewingAudioId === bgm.id
                                ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                                : 'bg-[#12141a] border-slate-700 text-slate-300 hover:text-white hover:border-slate-500'
                                }`}
                              title={previewingAudioId === bgm.id ? editorT.audioPanel.stopListen : editorT.audioPanel.previewListen}
                            >
                              {previewingAudioId === bgm.id ? (
                                <Square className="w-3 h-3 fill-current" />
                              ) : (
                                <Play className="w-3 h-3 fill-current" />
                              )}
                            </button>

                            {/* Add to Timeline Button */}
                            <button
                              type="button"
                              onClick={() => handleAddAssetToTimeline(bgm)}
                              className="px-2 py-1 rounded-md bg-[#00c5d4] hover:bg-[#00b4c2] text-slate-950 text-[10px] font-bold cursor-pointer transition-all"
                              title={editorT.audioPanel.addToTimeline}
                            >
                              {editorT.audioPanel.addToTimeline}
                            </button>

                            {/* Delete Audio Asset Button */}
                            <button
                              type="button"
                              onClick={() => handleDeleteAsset(bgm.id)}
                              className="p-1 rounded-md bg-rose-500/20 border border-rose-500/30 text-rose-300 hover:bg-rose-500 hover:text-white text-[10px] font-bold cursor-pointer transition-all"
                              title={editorT.timeline.delete}
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Professional Multi-Track & Per-Clip Audio Mixer */}
                <div className="pt-3 border-t border-[#232733] space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white block">Ovoz Mikseri (Audio Mixer)</span>
                    <span className="text-[10px] text-[#00c5d4] font-medium font-mono">Alohida & Master</span>
                  </div>

                  {/* Individual Video Clips Volume */}
                  {clips.length > 0 && (
                    <div className="space-y-2">
                      <span className="text-[11px] font-bold text-teal-400 block">
                        Video kliplar ovozi ({clips.length})
                      </span>
                      {clips.map((clip, cIdx) => {
                        const curVol = clip.volume !== undefined ? clip.volume : 100;
                        const isMuted = clip.muted || false;
                        return (
                          <div key={clip.id} className="p-2 rounded-xl bg-[#171a22] border border-[#232733] space-y-1.5">
                            <div className="flex items-center justify-between text-xs">
                              <span className="font-semibold text-slate-200 truncate max-w-[140px] flex items-center gap-1">
                                <Video className="w-3 h-3 text-teal-400 shrink-0" />
                                <span className="truncate">#{cIdx + 1} {clip.name}</span>
                              </span>
                              <span className={`font-mono text-[11px] font-bold ${curVol > 100 ? 'text-amber-400' : 'text-teal-400'}`}>
                                {isMuted ? 'Muted' : `${curVol}%`}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <input
                                type="range"
                                min={0}
                                max={200}
                                value={isMuted ? 0 : curVol}
                                onChange={(e) => {
                                  const val = Number(e.target.value);
                                  updateClip(clip.id, { volume: val, muted: val === 0 });
                                }}
                                className="flex-1 accent-teal-400 h-1.5 bg-[#26282d] rounded cursor-pointer"
                              />
                              <button
                                type="button"
                                onClick={() => updateClip(clip.id, { muted: !isMuted })}
                                className={`px-1.5 py-0.5 rounded text-[10px] font-bold transition-all cursor-pointer shrink-0 ${
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
                      })}
                    </div>
                  )}

                  {/* Individual Audio/MP3 Clips Volume */}
                  {audioClips.length > 0 && (
                    <div className="space-y-2">
                      <span className="text-[11px] font-bold text-sky-400 block">
                        MP3 / Audio ovozlari ({audioClips.length})
                      </span>
                      {audioClips.map((audio, aIdx) => {
                        const curVol = audio.volume !== undefined ? audio.volume : 100;
                        const isMuted = audio.muted || false;
                        return (
                          <div key={audio.id} className="p-2 rounded-xl bg-[#171a22] border border-[#232733] space-y-1.5">
                            <div className="flex items-center justify-between text-xs">
                              <span className="font-semibold text-slate-200 truncate max-w-[140px] flex items-center gap-1">
                                <Music className="w-3 h-3 text-sky-400 shrink-0" />
                                <span className="truncate">#{aIdx + 1} {audio.name}</span>
                              </span>
                              <span className={`font-mono text-[11px] font-bold ${curVol > 100 ? 'text-amber-400' : 'text-sky-400'}`}>
                                {isMuted ? 'Muted' : `${curVol}%`}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <input
                                type="range"
                                min={0}
                                max={200}
                                value={isMuted ? 0 : curVol}
                                onChange={(e) => {
                                  const val = Number(e.target.value);
                                  updateAudioClip(audio.id, { volume: val, muted: val === 0 });
                                }}
                                className="flex-1 accent-sky-400 h-1.5 bg-[#26282d] rounded cursor-pointer"
                              />
                              <button
                                type="button"
                                onClick={() => updateAudioClip(audio.id, { muted: !isMuted })}
                                className={`px-1.5 py-0.5 rounded text-[10px] font-bold transition-all cursor-pointer shrink-0 ${
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
                      })}
                    </div>
                  )}

                  {/* Master Channels */}
                  <div className="space-y-2 pt-2 border-t border-[#232733]">
                    <span className="text-[11px] font-bold text-slate-400 block">
                      Umumiy Master Kanallar (Master Output)
                    </span>

                    {/* Master Video */}
                    <MasterAudioChannel
                      type="video"
                      title="Video Master"
                      volume={settings.volume ?? 100}
                      isMuted={settings.removeAudio || isVideoAudioMuted}
                      onVolumeChange={(val) => {
                        pushSettingsChange(prev => ({ ...prev, volume: val, removeAudio: val === 0 }));
                        if (val > 0 && isVideoAudioMuted) setIsVideoAudioMuted(false);
                      }}
                      onToggleMute={toggleVideoAudioMute}
                      onReset={() => {
                        setIsVideoAudioMuted(false);
                        pushSettingsChange(prev => ({ ...prev, volume: 100, removeAudio: false }));
                      }}
                      compact
                    />

                    {/* Master Music */}
                    <MasterAudioChannel
                      type="music"
                      title="MP3 / Musiqa Master"
                      volume={settings.musicVolume ?? 100}
                      isMuted={settings.removeMusic || isMusicAudioMuted}
                      onVolumeChange={(val) => {
                        pushSettingsChange(prev => ({ ...prev, musicVolume: val, removeMusic: val === 0 }));
                        if (val > 0 && isMusicAudioMuted) setIsMusicAudioMuted(false);
                      }}
                      onToggleMute={toggleMusicAudioMute}
                      onReset={() => {
                        setIsMusicAudioMuted(false);
                        pushSettingsChange(prev => ({ ...prev, musicVolume: 100, removeMusic: false }));
                      }}
                      compact
                    />
                  </div>
                </div>
              </div>
            )}

            {/* TAB 4: TEXT & TITLES */}
            {leftNavTab === 'text' && (
              <div className="flex-1 overflow-y-auto p-3 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white block">{editorT.textPanel.title}</span>
                  <button
                    type="button"
                    onClick={() => {
                      const newText: TextClipItem = {
                        id: `text-${Date.now()}`,
                        text: 'Yangi Subtitr',
                        start: currentTime,
                        end: Math.min(duration, currentTime + 3.5),
                        fontSize: 32,
                        fontColor: '#FFFFFF',
                        bgColor: 'dark',
                        position: 'bottom'
                      };
                      setTextClips(prev => [...prev, newText]);
                      setSelectedTextClipId(newText.id);
                    }}
                    className="px-2 py-1 rounded-lg bg-fuchsia-600 hover:bg-fuchsia-500 text-white text-[11px] font-bold flex items-center gap-1 cursor-pointer transition-colors shadow"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>+ Subtitr</span>
                  </button>
                </div>

                {/* Timeline Selected Subtitle Editor (if any selected) */}
                {(() => {
                  const selClip = textClips.find(t => t.id === selectedTextClipId);
                  if (!selClip) return null;

                  return (
                    <div className="p-3 rounded-xl bg-[#2a133d] border border-fuchsia-500/50 space-y-3 shadow-lg">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-fuchsia-300 flex items-center gap-1.5">
                          <Type className="w-3.5 h-3.5" />
                          <span>Tanlangan Matn Klipi</span>
                        </span>
                        <button
                          type="button"
                          onClick={() => setSelectedTextClipId(null)}
                          className="text-[10px] text-slate-400 hover:text-white"
                        >
                          ✕
                        </button>
                      </div>

                      {/* Subtitle text */}
                      <div className="space-y-1">
                        <label className="text-[10px] text-fuchsia-200">Matn mazmuni:</label>
                        <input
                          type="text"
                          value={selClip.text}
                          onChange={(e) => {
                            const val = e.target.value;
                            setTextClips(prev => prev.map(t => t.id === selClip.id ? { ...t, text: val } : t));
                          }}
                          className="w-full px-2.5 py-1.5 bg-[#180a24] border border-fuchsia-700/60 rounded-lg text-xs text-white outline-none focus:border-fuchsia-400"
                        />
                      </div>

                      {/* Font Size slider */}
                      <div className="space-y-1">
                        <div className="flex justify-between text-[10px] text-fuchsia-200">
                          <span>Hajmi (Font size):</span>
                          <span className="font-mono font-bold">{selClip.fontSize || 32}px</span>
                        </div>
                        <input
                          type="range"
                          min={16}
                          max={72}
                          value={selClip.fontSize || 32}
                          onChange={(e) => {
                            const sz = Number(e.target.value);
                            setTextClips(prev => prev.map(t => t.id === selClip.id ? { ...t, fontSize: sz } : t));
                          }}
                          className="w-full accent-fuchsia-400 cursor-pointer h-1.5 bg-slate-900 rounded-lg"
                        />
                      </div>

                      {/* Position (Top, Center, Bottom) */}
                      <div className="space-y-1">
                        <span className="text-[10px] text-fuchsia-200">Joylashuvi:</span>
                        <div className="grid grid-cols-3 gap-1">
                          {(['top', 'center', 'bottom'] as const).map(pos => (
                            <button
                              key={pos}
                              type="button"
                              onClick={() => setTextClips(prev => prev.map(t => t.id === selClip.id ? { ...t, position: pos } : t))}
                              className={`py-1 text-[10px] font-bold rounded cursor-pointer transition-colors ${
                                selClip.position === pos ? 'bg-fuchsia-500 text-white shadow' : 'bg-[#180a24] text-slate-300'
                              }`}
                            >
                              {pos === 'top' ? 'Yuqori' : pos === 'center' ? 'O\'rta' : 'Pastki'}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Actions: Duplicate or Delete */}
                      <div className="flex items-center justify-between pt-1 border-t border-fuchsia-500/20">
                        <button
                          type="button"
                          onClick={() => {
                            const dup: TextClipItem = {
                              ...selClip,
                              id: `text-${Date.now()}`,
                              start: selClip.end + 0.2,
                              end: selClip.end + (selClip.end - selClip.start) + 0.2
                            };
                            setTextClips(prev => [...prev, dup]);
                            setSelectedTextClipId(dup.id);
                          }}
                          className="px-2 py-1 rounded bg-[#180a24] hover:bg-[#201032] text-[10px] font-bold text-fuchsia-200 cursor-pointer"
                        >
                          Nusxa ko'chirish
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setTextClips(prev => prev.filter(t => t.id !== selClip.id));
                            setSelectedTextClipId(null);
                          }}
                          className="px-2 py-1 rounded bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 text-[10px] font-bold cursor-pointer"
                        >
                          O'chirish
                        </button>
                      </div>
                    </div>
                  );
                })()}

                {/* Global Text Content Input */}
                <div className="space-y-1.5">
                  <label className="text-[11px] text-slate-400">{editorT.textPanel.contentPlaceholder} (Global)</label>
                  <input
                    type="text"
                    placeholder={editorT.textPanel.contentPlaceholder}
                    value={settings.textOverlay?.text || ''}
                    onChange={(e) => {
                      const val = e.target.value;
                      pushSettingsChange(prev => ({
                        ...prev,
                        textOverlay: {
                          ...(prev.textOverlay || {
                            fontSize: 32,
                            fontColor: '#FFFFFF',
                            bgColor: 'dark',
                            position: 'bottom'
                          }),
                          enabled: val.trim().length > 0,
                          text: val
                        }
                      }));
                    }}
                    className="w-full px-3 py-1.5 bg-[#1a1e29] border border-slate-700 rounded-lg text-xs text-white outline-none focus:border-[#00c5d4]"
                  />
                </div>

                {/* Quick Preset Templates */}
                <div className="space-y-1.5">
                  <label className="text-[11px] text-slate-400">{editorT.textPanel.templates}</label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { label: editorT.textPanel.presetHeading, text: 'EPIC CINEMA', color: '#FFFFFF', bg: 'dark', pos: 'top', size: 36 },
                      { label: editorT.textPanel.presetNeon, text: 'CYBER VIBES', color: '#00c5d4', bg: 'dark', pos: 'center', size: 40 },
                      { label: editorT.textPanel.presetRetro, text: 'Adventure 2026', color: '#FFFFFF', bg: 'emerald', pos: 'bottom', size: 24 },
                      { label: editorT.textPanel.presetBold, text: 'DON’T MISS THIS!', color: '#FFFFFF', bg: 'rose', pos: 'bottom', size: 28 }
                    ].map(tmpl => (
                      <button
                        key={tmpl.label}
                        type="button"
                        onClick={() => {
                          pushSettingsChange(prev => ({
                            ...prev,
                            textOverlay: {
                              enabled: true,
                              text: tmpl.text,
                              fontSize: tmpl.size,
                              fontColor: tmpl.color,
                              bgColor: tmpl.bg as any,
                              position: tmpl.pos as any
                            }
                          }));
                        }}
                        className="p-2 rounded-lg bg-[#1a1e29] hover:bg-[#242a38] border border-slate-700 text-left text-xs font-bold text-slate-300 transition-all"
                      >
                        {tmpl.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Text Controls (Font Size, Position, Color) */}
                {settings.textOverlay?.enabled && (
                  <div className="space-y-3 pt-2 border-t border-slate-800">
                    <div className="flex items-center justify-between text-xs text-slate-300">
                      <span>{editorT.textPanel.fontSize}</span>
                      <span className="font-mono">{settings.textOverlay.fontSize || 32}px</span>
                    </div>
                    <input
                      type="range"
                      min={16}
                      max={64}
                      value={settings.textOverlay.fontSize || 32}
                      onChange={(e) => {
                        const size = parseInt(e.target.value);
                        pushSettingsChange(prev => ({
                          ...prev,
                          textOverlay: { ...prev.textOverlay!, fontSize: size }
                        }));
                      }}
                      className="w-full accent-[#00c5d4] cursor-pointer h-1.5 bg-slate-800 rounded-lg"
                    />

                    {/* Position Switch (Top, Center, Bottom) */}
                    <div className="space-y-1">
                      <span className="text-[11px] text-slate-400">{editorT.textPanel.position}</span>
                      <div className="grid grid-cols-3 gap-1.5">
                        {[
                          { key: 'top', label: editorT.textPanel.posTop },
                          { key: 'center', label: editorT.textPanel.posCenter },
                          { key: 'bottom', label: editorT.textPanel.posBottom }
                        ].map(posItem => (
                          <button
                            key={posItem.key}
                            type="button"
                            onClick={() => {
                              pushSettingsChange(prev => ({
                                ...prev,
                                textOverlay: { ...prev.textOverlay!, position: posItem.key as any }
                              }));
                            }}
                            className={`py-1 text-xs rounded font-medium transition-all ${settings.textOverlay?.position === posItem.key
                              ? 'bg-[#00c5d4] text-slate-950 font-bold'
                              : 'bg-[#1a1e29] border border-slate-700 text-slate-300'
                              }`}
                          >
                            {posItem.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Clear Text button */}
                    <button
                      type="button"
                      onClick={() => {
                        pushSettingsChange(prev => ({
                          ...prev,
                          textOverlay: { ...prev.textOverlay!, enabled: false, text: '' }
                        }));
                      }}
                      className="w-full py-1.5 rounded-lg border border-rose-500/40 text-rose-400 hover:bg-rose-500/10 text-xs font-semibold transition-colors"
                    >
                      {editorT.textPanel.removeText}
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* TAB 5: STICKERS & GRAPHICS */}
            {leftNavTab === 'stickers' && (
              <StickersPanel
                stickers={stickers}
                selectedStickerId={selectedStickerId}
                onSelectSticker={setSelectedStickerId}
                onAddSticker={(st) => {
                  setStickers(prev => {
                    const next = [...prev, st];
                    pushSettingsChange(ps => ({ ...ps, stickers: next }));
                    return next;
                  });
                  setSelectedStickerId(st.id);
                }}
                onUpdateSticker={(id, updates) => {
                  setStickers(prev => {
                    const next = prev.map(s => s.id === id ? { ...s, ...updates } : s);
                    pushSettingsChange(ps => ({ ...ps, stickers: next }));
                    return next;
                  });
                }}
                onDeleteSticker={(id) => {
                  setStickers(prev => {
                    const next = prev.filter(s => s.id !== id);
                    pushSettingsChange(ps => ({ ...ps, stickers: next }));
                    return next;
                  });
                  if (selectedStickerId === id) setSelectedStickerId(null);
                }}
                onClearAllStickers={() => {
                  setStickers([]);
                  pushSettingsChange(ps => ({ ...ps, stickers: [] }));
                  setSelectedStickerId(null);
                }}
                onDuplicateSticker={(id) => {
                  const target = stickers.find(s => s.id === id);
                  if (target) {
                    const copy: StickerItem = {
                      ...target,
                      id: `sticker_${Date.now()}_copy`,
                      x: Math.min(90, target.x + 4),
                      y: Math.min(90, target.y + 4),
                    };
                    setStickers(prev => {
                      const next = [...prev, copy];
                      pushSettingsChange(ps => ({ ...ps, stickers: next }));
                      return next;
                    });
                    setSelectedStickerId(copy.id);
                  }
                }}
                currentTime={currentTime}
                duration={duration}
                lang={lang}
                t={editorT}
              />
            )}

            {/* TAB 6: EFFECTS */}
            {leftNavTab === 'effects' && (
              <div className="flex-1 overflow-y-auto p-3 space-y-3">
                <span className="text-xs font-bold text-white block">{editorT.effectsPanel.title}</span>
                <div className="space-y-2">
                  {[
                    { id: 'none', name: editorT.effectsPanel.none, desc: '' },
                    { id: 'vignette', name: editorT.effectsPanel.cinema, desc: '' },
                    { id: 'glitch', name: editorT.effectsPanel.cyber, desc: '' },
                    { id: 'vhs', name: editorT.effectsPanel.vhs, desc: '' },
                    { id: 'glow', name: editorT.effectsPanel.glow, desc: '' },
                    { id: 'invert', name: editorT.effectsPanel.vibrant, desc: '' }
                  ].map(fx => (
                    <button
                      key={fx.id}
                      type="button"
                      onClick={() => {
                        setActiveEffect(fx.id);
                        if (fx.id === 'vignette') {
                          pushSettingsChange(prev => ({ ...prev, vignette: true }));
                        } else {
                          pushSettingsChange(prev => ({ ...prev, vignette: false }));
                        }
                      }}
                      className={`w-full p-2.5 rounded-xl border text-left transition-all ${activeEffect === fx.id
                        ? 'border-[#00c5d4] bg-[#00c5d4]/15 text-white'
                        : 'border-slate-800 bg-[#1a1e29] text-slate-300 hover:border-slate-600'
                        }`}
                    >
                      <div className="text-xs font-bold">{fx.name}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* TAB 7: TRANSITIONS */}
            {leftNavTab === 'transitions' && (
              <div className="flex-1 overflow-y-auto p-3 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white block">{editorT.transitionsPanel.title}</span>
                  {transitionPickerClipId && (
                    <button
                      type="button"
                      onClick={() => setTransitionPickerClipId(null)}
                      className="text-[10px] text-slate-400 hover:text-white"
                    >
                      Bekor qilish
                    </button>
                  )}
                </div>

                {/* Target Clip indicator */}
                {(() => {
                  const targetClipId = transitionPickerClipId || selectedClipId;
                  const targetClip = clips.find(c => c.id === targetClipId);

                  return (
                    <div className="p-2.5 rounded-xl bg-[#141d2b] border border-[#00c5d4]/30 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-slate-400">Nishon klip:</span>
                        <span className="text-[11px] font-bold text-[#00c5d4] truncate max-w-[150px]">
                          {targetClip ? targetClip.name : 'Tanlanmagan (Barcha kliplarga)'}
                        </span>
                      </div>
                      {targetClip && (
                        <div className="flex items-center justify-between text-[10px] text-slate-300">
                          <span>Joriy o'tish:</span>
                          <span className="font-mono font-bold text-amber-400">
                            {targetClip.transitionIn && targetClip.transitionIn !== 'none' 
                              ? `${targetClip.transitionIn} (${targetClip.transitionDuration || 0.8}s)`
                              : "Yo'q"}
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* Transition Preset Buttons */}
                <div className="grid grid-cols-2 gap-2">
                  {TRANSITION_PRESETS.map(tr => {
                    const targetClipId = transitionPickerClipId || selectedClipId;
                    const targetClip = clips.find(c => c.id === targetClipId);
                    const isSelected = targetClip ? (targetClip.transitionIn || 'none') === tr.id : activeTransition === tr.id;

                    return (
                      <button
                        key={tr.id}
                        type="button"
                        onClick={() => {
                          setActiveTransition(tr.id);
                          if (targetClipId) {
                            updateClip(targetClipId, { 
                              transitionIn: tr.id as any,
                              transitionDuration: targetClip?.transitionDuration || 0.8
                            });
                          }
                        }}
                        className={`p-3 rounded-xl border text-center text-xs font-bold transition-all cursor-pointer ${
                          isSelected
                            ? 'border-[#00c5d4] bg-[#00c5d4]/15 text-[#00c5d4] shadow-md'
                            : 'border-slate-700 bg-[#1a1e29] text-slate-300 hover:border-slate-500'
                        }`}
                      >
                        <Split className="w-4 h-4 mx-auto mb-1 text-slate-400" />
                        <span>{tr.name}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Duration Control for Selected Transition */}
                {(() => {
                  const targetClipId = transitionPickerClipId || selectedClipId;
                  const targetClip = clips.find(c => c.id === targetClipId);
                  const currentDur = targetClip?.transitionDuration || 0.8;

                  return (
                    <div className="space-y-2 pt-2 border-t border-slate-800">
                      <div className="flex items-center justify-between text-xs text-slate-300">
                        <span>O'tish davomiyligi</span>
                        <span className="font-mono text-[#00c5d4] font-bold">{currentDur}s</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {[0.3, 0.5, 0.8, 1.0, 1.5, 2.0].map(dur => (
                          <button
                            key={dur}
                            type="button"
                            onClick={() => {
                              if (targetClipId) {
                                updateClip(targetClipId, { transitionDuration: dur });
                              }
                            }}
                            className={`flex-1 py-1 rounded text-[10px] font-bold cursor-pointer transition-colors ${
                              currentDur === dur
                                ? 'bg-[#00c5d4] text-slate-950 shadow'
                                : 'bg-[#1a1e29] border border-slate-700 text-slate-300 hover:text-white'
                            }`}
                          >
                            {dur}s
                          </button>
                        ))}
                      </div>

                      {/* Apply to All Clips Button */}
                      <button
                        type="button"
                        onClick={() => {
                          const trToApply = (targetClip?.transitionIn || activeTransition || 'dissolve') as any;
                          setClips(prev => prev.map((c, i) => i === 0 ? c : { ...c, transitionIn: trToApply, transitionDuration: currentDur }));
                        }}
                        className="w-full mt-2 py-2 rounded-xl bg-[#1a2333] hover:bg-[#223045] border border-sky-500/40 text-sky-300 text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Barcha kliplarga qo'llash</span>
                      </button>
                    </div>
                  );
                })()}
              </div>
            )}

            {/* TAB 8: FILTERS / LUTS */}
            {leftNavTab === 'filters' && (
              <div className="flex-1 overflow-y-auto p-3 space-y-3">
                <span className="text-xs font-bold text-white block">{editorT.filtersPanel.title}</span>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: 'normal', name: editorT.filtersPanel.filterNormal },
                    { id: 'cinematic', name: editorT.filtersPanel.filterWarm },
                    { id: 'vivid', name: editorT.filtersPanel.filterVivid },
                    { id: 'vintage', name: editorT.filtersPanel.filterNoir }
                  ].map(flt => (
                    <button
                      key={flt.id}
                      type="button"
                      onClick={() => {
                        pushSettingsChange(prev => ({
                          ...prev,
                          filterPreset: flt.id as any
                        }));
                      }}
                      className={`p-2.5 rounded-xl border text-left transition-all ${settings.filterPreset === flt.id
                        ? 'border-[#00c5d4] bg-[#00c5d4]/15 text-white shadow-md'
                        : 'border-slate-800 bg-[#1a1e29] text-slate-300 hover:border-slate-600'
                        }`}
                    >
                      <div className="text-xs font-bold">{flt.name}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* TAB 9: LIBRARY */}
            {leftNavTab === 'library' && (
              <div className="flex-1 overflow-y-auto p-3 space-y-4">
                <div>
                  <span className="text-xs font-bold text-white block mb-2">{editorT.sidebarTabs.library}</span>
                  <div className="grid grid-cols-3 gap-2">
                    {ASPECT_RATIOS.map(ratio => (
                      <button
                        key={ratio}
                        type="button"
                        onClick={() => pushSettingsChange(prev => ({ ...prev, aspectRatio: ratio as any }))}
                        className={`py-2 px-1 text-xs font-bold rounded-lg border text-center transition-all ${settings.aspectRatio === ratio
                          ? 'border-[#00c5d4] bg-[#00c5d4]/20 text-white'
                          : 'border-slate-700 bg-[#1a1e29] text-slate-300 hover:border-slate-500'
                          }`}
                      >
                        {ratio}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <span className="text-xs font-bold text-white block mb-2">{editorT.inspector.background.title}</span>
                  <div className="grid grid-cols-2 gap-2">
                    {BACKGROUND_PRESETS.map(bg => (
                      <button
                        key={bg.id}
                        type="button"
                        onClick={() => pushSettingsChange(prev => ({ ...prev, bgColor: bg.id as any }))}
                        className={`p-2 rounded-lg border text-xs font-medium transition-all ${settings.bgColor === bg.id
                          ? 'border-[#00c5d4] bg-[#00c5d4]/15 text-white'
                          : 'border-slate-700 bg-[#1a1e29] text-slate-300'
                          }`}
                      >
                        {bg.name}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

          </div>
  );
};
