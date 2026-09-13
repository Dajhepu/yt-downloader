import React, { useState } from 'react';
import {
  FolderOpen,
  ChevronDown,
  Save,
  FileDown,
  Plus,
  Loader2,
  Check,
  Sliders,
  Globe,
  Camera,
  Download,
  X
} from 'lucide-react';
import { Language } from '../../types';
import { VideoEditorTranslationSchema } from '../../translations/videoEditorTranslations';
import { LANGUAGE_LIST } from '../../components/Navbar';
import { FlagIcon } from '../../components/FlagIcon';
import { LeftSidebarTab, VideoThumbnailData } from './types';

interface EditorHeaderProps {
  projectName: string;
  setProjectName: (name: string) => void;
  saveStatus: 'idle' | 'saving' | 'saved' | 'error' | 'unsaved';
  lastSavedTime: Date | null;
  handleManualSave: () => void;
  setShowProjectsModal: (show: boolean) => void;
  handleExportProjectFile: () => void;
  handleNewBlankProject: () => void;
  mobileActiveSheet: LeftSidebarTab | 'inspector' | null;
  setMobileActiveSheet: React.Dispatch<React.SetStateAction<LeftSidebarTab | 'inspector' | null>>;
  setLeftNavTab: (tab: LeftSidebarTab) => void;
  lang?: string;
  onLanguageChange?: (lang: Language) => void;
  videoThumbnail: VideoThumbnailData | null;
  setShowThumbnailModal: (show: boolean) => void;
  setShowExportModal: (show: boolean) => void;
  isProcessing: boolean;
  onReset?: () => void;
  editorT: VideoEditorTranslationSchema;
}

export const EditorHeader: React.FC<EditorHeaderProps> = ({
  projectName,
  setProjectName,
  saveStatus,
  lastSavedTime,
  handleManualSave,
  setShowProjectsModal,
  handleExportProjectFile,
  handleNewBlankProject,
  mobileActiveSheet,
  setMobileActiveSheet,
  setLeftNavTab,
  lang,
  onLanguageChange,
  videoThumbnail,
  setShowThumbnailModal,
  setShowExportModal,
  isProcessing,
  onReset,
  editorT,
}) => {
  const [showProjectMenu, setShowProjectMenu] = useState(false);
  const [showLangMenu, setShowLangMenu] = useState(false);

  return (
    <header className="h-12 bg-[#18191c] border-b border-[#26282d] px-2 sm:px-4 flex items-center justify-between shrink-0 z-30 select-none">
      {/* Left: CapCut Dual Trapezoid Logo & Saved in cloud */}
      <div className="flex items-center gap-2 sm:gap-3">
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* CapCut dual wing/trapezoid logo */}
          <svg className="w-5 h-5 text-white shrink-0" viewBox="0 0 24 24" fill="currentColor">
            <path d="M3.5 6.2L10 11.5L3.5 16.8V6.2Z" />
            <path d="M20.5 6.2L14 11.5L20.5 16.8V6.2Z" />
          </svg>
          <span className="text-slate-600 font-light mx-0.5 hidden sm:inline">|</span>

          {/* Project Actions Dropdown Menu */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowProjectMenu(prev => !prev)}
              className="flex items-center gap-1.5 px-2 py-1 rounded hover:bg-[#26282d] text-slate-200 text-xs font-semibold transition-colors cursor-pointer"
              title="Loyiha amallari (Saqlash, Yuklash, Eksport)"
            >
              <FolderOpen className="w-3.5 h-3.5 text-[#00c5d4]" />
              <span className="hidden sm:inline">Loyiha</span>
              <ChevronDown className="w-3 h-3 text-slate-400" />
            </button>

            {showProjectMenu && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setShowProjectMenu(false)}
                />
                <div className="absolute left-0 mt-1 w-56 bg-[#18191c] border border-[#2e3340] rounded-xl shadow-2xl py-1.5 z-50 text-xs divide-y divide-[#242834]">
                  <div className="py-1">
                    <button
                      type="button"
                      onClick={() => {
                        setShowProjectMenu(false);
                        handleManualSave();
                      }}
                      className="w-full px-3 py-2 text-left text-slate-200 hover:bg-[#202533] flex items-center justify-between cursor-pointer"
                    >
                      <span className="flex items-center gap-2">
                        <Save className="w-3.5 h-3.5 text-[#00c5d4]" />
                        <span className="font-medium">Loyihani saqlash</span>
                      </span>
                      <kbd className="text-[10px] text-slate-500 font-mono bg-[#121316] px-1.5 py-0.5 rounded border border-[#2a2d36]">Ctrl+S</kbd>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setShowProjectMenu(false);
                        setShowProjectsModal(true);
                      }}
                      className="w-full px-3 py-2 text-left text-slate-200 hover:bg-[#202533] flex items-center justify-between cursor-pointer"
                    >
                      <span className="flex items-center gap-2">
                        <FolderOpen className="w-3.5 h-3.5 text-blue-400" />
                        <span className="font-medium">Saqlangan loyihalar...</span>
                      </span>
                      <span className="text-[10px] text-slate-500 font-mono">IndexedDB</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setShowProjectMenu(false);
                        handleExportProjectFile();
                      }}
                      className="w-full px-3 py-2 text-left text-slate-200 hover:bg-[#202533] flex items-center gap-2 cursor-pointer"
                    >
                      <FileDown className="w-3.5 h-3.5 text-amber-400" />
                      <span className="font-medium">Faylga eksport (.dcproj)</span>
                    </button>
                  </div>

                  <div className="py-1">
                    <button
                      type="button"
                      onClick={() => {
                        setShowProjectMenu(false);
                        if (confirm("Yangi loyiha ochilsinmi? Joriy loyiha avtomatik saqlangan.")) {
                          handleNewBlankProject();
                        }
                      }}
                      className="w-full px-3 py-2 text-left text-slate-200 hover:bg-[#202533] flex items-center gap-2 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="font-medium">Yangi bo'sh loyiha</span>
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Live Auto-save status badge */}
          <button
            type="button"
            onClick={handleManualSave}
            className="flex items-center gap-1.5 px-2 py-1 rounded text-[11px] hover:bg-[#26282d] transition-colors cursor-pointer"
            title={lastSavedTime ? `Oxirgi saqlangan: ${lastSavedTime.toLocaleTimeString()}` : 'Lokal saqlangan'}
          >
            {saveStatus === 'saving' ? (
              <>
                <Loader2 className="w-3 h-3 text-[#00c5d4] animate-spin" />
                <span className="text-[#00c5d4] hidden sm:inline">Saqlanmoqda...</span>
              </>
            ) : saveStatus === 'unsaved' ? (
              <>
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                <span className="text-amber-300 hidden sm:inline">Saqlanmoqda...</span>
              </>
            ) : saveStatus === 'error' ? (
              <>
                <span className="w-2 h-2 rounded-full bg-rose-500" />
                <span className="text-rose-400 hidden sm:inline">Xatolik</span>
              </>
            ) : (
              <>
                <Check className="w-3 h-3 text-emerald-400" />
                <span className="text-slate-400 hidden md:inline">{editorT.header.autoSaved}</span>
              </>
            )}
          </button>
        </div>

        {/* Mobile Media Drawer Toggle */}
        <button
          type="button"
          onClick={() => {
            setMobileActiveSheet(prev => prev === 'media' ? null : 'media');
            setLeftNavTab('media');
          }}
          className={`md:hidden px-2 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors border cursor-pointer ${
            mobileActiveSheet === 'media'
              ? 'bg-[#00c5d4]/20 border-[#00c5d4] text-[#00c5d4]'
              : 'bg-[#202533] border-[#2a3042] text-slate-300 hover:text-white'
          }`}
          title={editorT.header.mediaDrawerTooltip}
        >
          <FolderOpen className="w-3.5 h-3.5" />
          <span className="hidden xs:inline">{editorT.header.mediaDrawer}</span>
        </button>
      </div>

      {/* Center: Project Title */}
      <div className="flex items-center justify-center min-w-0 px-1">
        <input
          type="text"
          value={projectName}
          onChange={(e) => setProjectName(e.target.value)}
          className="bg-transparent hover:bg-[#26282d]/50 focus:bg-[#26282d] text-center text-white font-medium text-xs sm:text-sm px-2 sm:px-3 py-1 rounded border border-transparent hover:border-[#333740] focus:border-[#00c5d4] transition-all outline-none max-w-[120px] xs:max-w-[160px] sm:max-w-[280px] truncate"
          title={editorT.header.renameProjectTooltip}
        />
      </div>

      {/* Right: Mobile Adjust, 25-Language Switcher, Export Button & Close */}
      <div className="flex items-center gap-1.5 sm:gap-2.5">
        {/* Mobile Inspector Toggle */}
        <button
          type="button"
          onClick={() => {
            setMobileActiveSheet(prev => prev === 'inspector' ? null : 'inspector');
          }}
          className={`lg:hidden px-2 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors border cursor-pointer ${
            mobileActiveSheet === 'inspector'
              ? 'bg-[#00c5d4]/20 border-[#00c5d4] text-[#00c5d4]'
              : 'bg-[#202533] border-[#2a3042] text-slate-300 hover:text-white'
          }`}
          title={editorT.header.adjustMobileTooltip}
        >
          <Sliders className="w-3.5 h-3.5" />
          <span className="hidden xs:inline">{editorT.header.adjustMobile}</span>
        </button>

        {/* 25-Language Switcher Dropdown - Desktop only */}
        <div className="hidden md:block relative">
          <button
            type="button"
            onClick={() => setShowLangMenu(prev => !prev)}
            className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-[#202533] hover:bg-[#2a3142] border border-[#2a3042] text-slate-200 text-xs font-medium transition-colors cursor-pointer"
            title={editorT.header.selectLanguage}
          >
            <Globe className="w-3.5 h-3.5 text-[#00c5d4]" />
            <span className="uppercase text-[11px] font-bold">{lang}</span>
            <ChevronDown className="w-3 h-3 text-slate-400" />
          </button>

          {showLangMenu && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setShowLangMenu(false)}
              />
              <div className="absolute right-0 mt-1 w-52 max-h-72 overflow-y-auto bg-[#18191c] border border-[#2e3340] rounded-xl shadow-2xl py-1 z-50 divide-y divide-[#242834]">
                <div className="px-3 py-1.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                  <span>{editorT.header.selectLanguage}</span>
                  <span className="text-[10px] text-[#00c5d4] font-mono">25</span>
                </div>
                <div className="py-1">
                  {LANGUAGE_LIST.map((lItem) => {
                    const isSelected = lItem.code === lang;
                    return (
                      <button
                        key={lItem.code}
                        type="button"
                        onClick={() => {
                          onLanguageChange?.(lItem.code as Language);
                          setShowLangMenu(false);
                        }}
                        className={`w-full px-3 py-1.5 text-xs flex items-center justify-between transition-colors cursor-pointer ${
                          isSelected
                            ? 'bg-[#00c5d4]/15 text-[#00c5d4] font-bold'
                            : 'text-slate-300 hover:bg-[#202533] hover:text-white'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <FlagIcon countryCode={lItem.countryCode} className="w-4 h-3 rounded-[2px]" />
                          <span>{lItem.nativeName}</span>
                          <span className="text-[10px] text-slate-500 font-mono">({lItem.name})</span>
                        </div>
                        {isSelected && <Check className="w-3.5 h-3.5 text-[#00c5d4]" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Quick Cover / Thumbnail Studio Trigger */}
        <button
          type="button"
          onClick={() => setShowThumbnailModal(true)}
          className={`hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border text-xs font-semibold transition-all cursor-pointer ${
            videoThumbnail
              ? 'border-[#00c5d4]/60 bg-[#00c5d4]/15 text-[#00c5d4]'
              : 'border-[#3a3e47] bg-[#1f2127] text-slate-300 hover:text-white hover:bg-[#282b33]'
          }`}
          title={editorT.thumbnail?.btnTooltip || "Video Muqovasi (Thumbnail)"}
        >
          <Camera className="w-3.5 h-3.5" />
          <span>{editorT.thumbnail?.btnCover || "Muqova"}</span>
          {videoThumbnail && <span className="w-1.5 h-1.5 rounded-full bg-[#00c5d4]" />}
        </button>

        <button
          type="button"
          onClick={() => setShowExportModal(true)}
          disabled={isProcessing}
          className="px-3 sm:px-4 py-1.5 rounded-md bg-[#00c5d4] hover:bg-[#00b5c4] active:bg-[#009fad] text-slate-950 font-bold text-xs shadow-sm transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
        >
          <Download className="w-3.5 h-3.5" />
          <span>{isProcessing ? editorT.header.exporting : editorT.header.export}</span>
        </button>

        {/* Close / Return to Home */}
        {onReset && (
          <button
            type="button"
            onClick={onReset}
            className="p-1 rounded text-slate-400 hover:text-white hover:bg-[#26282d] transition-colors cursor-pointer"
            title={editorT.header.closeEditor}
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    </header>
  );
};
