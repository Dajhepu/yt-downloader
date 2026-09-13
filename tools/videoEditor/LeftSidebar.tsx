import React from 'react';
import {
  FolderOpen,
  Music,
  Type,
  Smile,
  Star,
  Split,
  Palette,
  Layers,
  Keyboard
} from 'lucide-react';
import { LeftSidebarTab } from './types';
import { VideoEditorTranslationSchema } from '../../translations/videoEditorTranslations';

interface LeftSidebarProps {
  leftNavTab: LeftSidebarTab;
  setLeftNavTab: (tab: LeftSidebarTab) => void;
  isAssetDrawerOpen: boolean;
  setIsAssetDrawerOpen: (open: boolean) => void;
  setShowShortcutsModal: (show: boolean) => void;
  editorT: VideoEditorTranslationSchema;
}

export const LeftSidebar: React.FC<LeftSidebarProps> = ({
  leftNavTab,
  setLeftNavTab,
  isAssetDrawerOpen,
  setIsAssetDrawerOpen,
  setShowShortcutsModal,
  editorT,
}) => {
  return (
    <aside className="hidden md:flex w-16 bg-[#11131a] border-r border-[#222733] flex-col justify-between py-2 shrink-0 z-20">
      <div className="space-y-1">
        <button
          type="button"
          onClick={() => { setLeftNavTab('media'); setIsAssetDrawerOpen(true); }}
          className={`w-full flex flex-col items-center justify-center py-2 px-1 rounded-xl text-[10px] font-medium transition-all cursor-pointer ${
            leftNavTab === 'media' && isAssetDrawerOpen
              ? 'text-[#00c5d4] bg-[#1a1f2c]'
              : 'text-slate-400 hover:text-slate-200 hover:bg-[#161a24]'
          }`}
        >
          <FolderOpen className="w-4 h-4 mb-1 stroke-[1.8]" />
          <span>{editorT.sidebarTabs.media}</span>
        </button>

        <button
          type="button"
          onClick={() => { setLeftNavTab('audio'); setIsAssetDrawerOpen(true); }}
          className={`w-full flex flex-col items-center justify-center py-2 px-1 rounded-xl text-[10px] font-medium transition-all cursor-pointer ${
            leftNavTab === 'audio' && isAssetDrawerOpen
              ? 'text-[#00c5d4] bg-[#1a1f2c]'
              : 'text-slate-400 hover:text-slate-200 hover:bg-[#161a24]'
          }`}
        >
          <Music className="w-4 h-4 mb-1 stroke-[1.8]" />
          <span>{editorT.sidebarTabs.audio}</span>
        </button>

        <button
          type="button"
          onClick={() => { setLeftNavTab('text'); setIsAssetDrawerOpen(true); }}
          className={`w-full flex flex-col items-center justify-center py-2 px-1 rounded-xl text-[10px] font-medium transition-all cursor-pointer ${
            leftNavTab === 'text' && isAssetDrawerOpen
              ? 'text-[#00c5d4] bg-[#1a1f2c]'
              : 'text-slate-400 hover:text-slate-200 hover:bg-[#161a24]'
          }`}
        >
          <Type className="w-4 h-4 mb-1 stroke-[1.8]" />
          <span>{editorT.sidebarTabs.text}</span>
        </button>

        <button
          type="button"
          onClick={() => { setLeftNavTab('stickers'); setIsAssetDrawerOpen(true); }}
          className={`w-full flex flex-col items-center justify-center py-2 px-1 rounded-xl text-[10px] font-medium transition-all cursor-pointer ${
            leftNavTab === 'stickers' && isAssetDrawerOpen
              ? 'text-[#00c5d4] bg-[#1a1f2c]'
              : 'text-slate-400 hover:text-slate-200 hover:bg-[#161a24]'
          }`}
        >
          <Smile className="w-4 h-4 mb-1 stroke-[1.8]" />
          <span>{editorT.sidebarTabs.stickers}</span>
        </button>

        <button
          type="button"
          onClick={() => { setLeftNavTab('effects'); setIsAssetDrawerOpen(true); }}
          className={`w-full flex flex-col items-center justify-center py-2 px-1 rounded-xl text-[10px] font-medium transition-all cursor-pointer ${
            leftNavTab === 'effects' && isAssetDrawerOpen
              ? 'text-[#00c5d4] bg-[#1a1f2c]'
              : 'text-slate-400 hover:text-slate-200 hover:bg-[#161a24]'
          }`}
        >
          <Star className="w-4 h-4 mb-1 stroke-[1.8]" />
          <span>{editorT.sidebarTabs.effects}</span>
        </button>

        <button
          type="button"
          onClick={() => { setLeftNavTab('transitions'); setIsAssetDrawerOpen(true); }}
          className={`w-full flex flex-col items-center justify-center py-2 px-1 rounded-xl text-[10px] font-medium transition-all cursor-pointer ${
            leftNavTab === 'transitions' && isAssetDrawerOpen
              ? 'text-[#00c5d4] bg-[#1a1f2c]'
              : 'text-slate-400 hover:text-slate-200 hover:bg-[#161a24]'
          }`}
        >
          <Split className="w-4 h-4 mb-1 stroke-[1.8]" />
          <span className="text-[9px]">{editorT.sidebarTabs.transitions}</span>
        </button>

        <button
          type="button"
          onClick={() => { setLeftNavTab('filters'); setIsAssetDrawerOpen(true); }}
          className={`w-full flex flex-col items-center justify-center py-2 px-1 rounded-xl text-[10px] font-medium transition-all cursor-pointer ${
            leftNavTab === 'filters' && isAssetDrawerOpen
              ? 'text-[#00c5d4] bg-[#1a1f2c]'
              : 'text-slate-400 hover:text-slate-200 hover:bg-[#161a24]'
          }`}
        >
          <Palette className="w-4 h-4 mb-1 stroke-[1.8]" />
          <span>{editorT.sidebarTabs.filters}</span>
        </button>

        <button
          type="button"
          onClick={() => { setLeftNavTab('library'); setIsAssetDrawerOpen(true); }}
          className={`w-full flex flex-col items-center justify-center py-2 px-1 rounded-xl text-[10px] font-medium transition-all cursor-pointer ${
            leftNavTab === 'library' && isAssetDrawerOpen
              ? 'text-[#00c5d4] bg-[#1a1f2c]'
              : 'text-slate-400 hover:text-slate-200 hover:bg-[#161a24]'
          }`}
        >
          <Layers className="w-4 h-4 mb-1 stroke-[1.8]" />
          <span>{editorT.sidebarTabs.library}</span>
        </button>
      </div>

      <div className="space-y-1">
        <button
          type="button"
          onClick={() => setShowShortcutsModal(true)}
          className="w-full flex flex-col items-center justify-center py-2 text-slate-500 hover:text-slate-300 cursor-pointer"
          title={editorT.timeline.shortcuts}
        >
          <Keyboard className="w-4 h-4" />
        </button>
      </div>
    </aside>
  );
};
