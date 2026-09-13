import React from 'react';
import { Download, AlertCircle, Sparkles, Keyboard, X } from 'lucide-react';
import { ExportConfig } from '../../components/ExportSettingsModal';
import { ShareResultButton } from '../../components/ShareResultButton';

interface ExportProgressModalProps {
  isProcessing: boolean;
  progressMsg: string;
  progressPercent: number;
  renderTitle: string;
  renderDesc: string;
}

export const ExportProgressModal: React.FC<ExportProgressModalProps> = ({
  isProcessing,
  progressMsg,
  progressPercent,
  renderTitle,
  renderDesc
}) => {
  if (!isProcessing) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-[#141720] border border-[#222733] rounded-2xl p-6 shadow-2xl space-y-4 text-center">
        <div className="w-12 h-12 rounded-2xl bg-[#00c5d4]/20 border border-[#00c5d4]/30 text-[#00c5d4] flex items-center justify-center mx-auto animate-pulse">
          <Download className="w-6 h-6 stroke-[2.5]" />
        </div>
        <h3 className="text-lg font-bold text-white">{renderTitle}</h3>
        <p className="text-xs text-slate-400">{progressMsg || renderDesc}</p>

        <div className="space-y-1.5">
          <div className="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden">
            <div
              className="bg-gradient-to-r from-[#00c5d4] to-emerald-400 h-full transition-all duration-200"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <span className="text-xs font-mono font-bold text-[#00c5d4]">{progressPercent}%</span>
        </div>
      </div>
    </div>
  );
};

interface ExportErrorModalProps {
  exportError: string | null;
  isProcessing: boolean;
  onDismiss: () => void;
  onRetry: () => void;
}

export const ExportErrorModal: React.FC<ExportErrorModalProps> = ({
  exportError,
  isProcessing,
  onDismiss,
  onRetry
}) => {
  if (!exportError || isProcessing) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-[#141720] border border-red-500/40 rounded-2xl p-6 shadow-2xl space-y-5 text-center">
        <div className="w-12 h-12 rounded-2xl bg-red-500/20 border border-red-500/30 text-red-400 flex items-center justify-center mx-auto">
          <AlertCircle className="w-6 h-6 stroke-[2.5]" />
        </div>
        <h3 className="text-lg font-bold text-white">Export Failed</h3>
        <p className="text-xs text-slate-300 leading-relaxed">{exportError}</p>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onDismiss}
            className="flex-1 px-4 py-3 rounded-xl bg-[#222733] hover:bg-[#2a3040] text-slate-200 font-bold text-sm transition-all cursor-pointer"
          >
            Dismiss
          </button>
          <button
            type="button"
            onClick={onRetry}
            className="flex-1 px-4 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-gray-950 font-bold text-sm transition-all cursor-pointer"
          >
            Try Again
          </button>
        </div>
      </div>
    </div>
  );
};

interface DownloadCompleteModalProps {
  editedResultUrl: string | null;
  activeExportConfig: ExportConfig;
  projectName: string;
  onClose: () => void;
  renderCompleteTitle: string;
  renderCompleteDesc: string;
  downloadBtnText: string;
  closeBtnText: string;
  thumbnailData?: { dataUrl: string } | null;
}

export const DownloadCompleteModal: React.FC<DownloadCompleteModalProps> = ({
  editedResultUrl,
  activeExportConfig,
  projectName,
  onClose,
  renderCompleteTitle,
  renderCompleteDesc,
  downloadBtnText,
  closeBtnText,
  thumbnailData
}) => {
  if (!editedResultUrl) return null;

  const ext = activeExportConfig.format === 'mp3' ? 'mp3' : activeExportConfig.format === 'gif' ? 'gif' : activeExportConfig.format === 'webm' ? 'webm' : 'mp4';
  const fileName = `${activeExportConfig.fileName || `edited_${projectName}`}.${ext}`;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-[#141720] border border-[#222733] rounded-2xl p-6 shadow-2xl space-y-5 text-center">
        <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mx-auto">
          <Sparkles className="w-6 h-6 stroke-[2.5]" />
        </div>
        <h3 className="text-lg font-bold text-white">{renderCompleteTitle}</h3>
        <p className="text-xs text-slate-400">{renderCompleteDesc}</p>

        <div className="p-3 rounded-xl bg-[#0c0e15] border border-[#222838] flex items-center justify-around text-xs">
          <div>
            <span className="text-slate-400 block text-[10px]">Format</span>
            <span className="font-bold text-[#00c5d4] uppercase">{activeExportConfig.format}</span>
          </div>
          <div className="h-6 w-px bg-[#222838]" />
          <div>
            <span className="text-slate-400 block text-[10px]">Sifat</span>
            <span className="font-bold text-white uppercase">{activeExportConfig.quality}</span>
          </div>
          <div className="h-6 w-px bg-[#222838]" />
          <div>
            <span className="text-slate-400 block text-[10px]">FPS</span>
            <span className="font-bold text-white">{activeExportConfig.fps} FPS</span>
          </div>
        </div>

        {thumbnailData?.dataUrl && (
          <div className="p-3 rounded-xl bg-[#181c27] border border-[#262c3a] flex items-center justify-between text-left">
            <div className="flex items-center gap-2.5">
              <img
                src={thumbnailData.dataUrl}
                alt="Thumbnail"
                className="w-12 h-8 rounded-lg object-cover border border-slate-700/60"
              />
              <div>
                <span className="text-xs font-bold text-white block">Video Muqovasi</span>
                <span className="text-[10px] text-slate-400">YouTube / Reels uchun poster</span>
              </div>
            </div>
            <a
              href={thumbnailData.dataUrl}
              download={`${projectName}_thumbnail.png`}
              className="py-1.5 px-3 rounded-lg bg-[#242b3d] hover:bg-[#00c5d4] hover:text-slate-950 text-slate-200 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Yuklab olish</span>
            </a>
          </div>
        )}

        <div className="flex items-center gap-2.5">
          <a
            href={editedResultUrl}
            download={fileName}
            className="flex-1 py-3 px-4 rounded-xl bg-[#00c5d4] hover:bg-[#00d7e8] text-slate-950 font-extrabold text-sm flex items-center justify-center gap-2 shadow-lg shadow-[#00c5d4]/25 cursor-pointer"
          >
            <Download className="w-4 h-4 stroke-[2.5]" />
            <span>{downloadBtnText}</span>
          </a>
          <ShareResultButton
            fileUrl={editedResultUrl}
            fileName={fileName}
            title={`DarlingClip: ${fileName}`}
          />
          <button
            type="button"
            onClick={onClose}
            className="py-3 px-4 rounded-xl bg-[#1f2430] hover:bg-[#282f40] text-slate-200 font-bold text-sm cursor-pointer"
          >
            {closeBtnText}
          </button>
        </div>
      </div>
    </div>
  );
};

interface KeyboardShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
  shortcutsTitle: string;
  shortcuts: {
    playPause: string;
    stepBack: string;
    stepForward: string;
    split: string;
    delete: string;
    undo: string;
    redo: string;
    muteVideo: string;
    muteMusic: string;
    fullscreen: string;
  };
  gotItText: string;
}

export const KeyboardShortcutsModal: React.FC<KeyboardShortcutsModalProps> = ({
  isOpen,
  onClose,
  shortcutsTitle,
  shortcuts,
  gotItText
}) => {
  if (!isOpen) return null;

  const rows = [
    { label: shortcuts.playPause, key: 'Space' },
    { label: shortcuts.stepBack, key: '←' },
    { label: shortcuts.stepForward, key: '→' },
    { label: shortcuts.split, key: 'S' },
    { label: shortcuts.delete, key: 'Del / Backspace' },
    { label: shortcuts.undo, key: 'Ctrl + Z' },
    { label: shortcuts.redo, key: 'Ctrl + Y / Shift + Ctrl + Z' },
    { label: `${shortcuts.muteVideo} / ${shortcuts.muteMusic}`, key: 'M' },
    { label: shortcuts.fullscreen, key: 'F' }
  ];

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-[#18191c] border border-[#26282d] rounded-2xl p-6 shadow-2xl space-y-4">
        <div className="flex items-center justify-between border-b border-[#26282d] pb-3">
          <div className="flex items-center gap-2">
            <Keyboard className="w-5 h-5 text-[#00c5d4]" />
            <h3 className="text-base font-bold text-white">{shortcutsTitle}</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded text-slate-400 hover:text-white hover:bg-[#26282d] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-2.5 text-xs">
          {rows.map((row, idx) => (
            <div
              key={idx}
              className={`flex items-center justify-between py-1 ${idx < rows.length - 1 ? 'border-b border-[#22242a]' : ''}`}
            >
              <span className="text-slate-300">{row.label}</span>
              <kbd className="px-2 py-0.5 rounded bg-[#26282d] text-slate-200 font-mono text-[11px] border border-slate-700">
                {row.key}
              </kbd>
            </div>
          ))}
        </div>

        <div className="pt-2">
          <button
            type="button"
            onClick={onClose}
            className="w-full py-2 rounded-xl bg-[#00c5d4] hover:bg-[#00b5c4] text-slate-950 font-bold text-xs transition-colors cursor-pointer"
          >
            {gotItText}
          </button>
        </div>
      </div>
    </div>
  );
};
