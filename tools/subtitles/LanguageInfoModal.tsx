import React from 'react';
import { Globe } from 'lucide-react';

interface LanguageInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
  st: any;
}

export const LanguageInfoModal: React.FC<LanguageInfoModalProps> = ({
  isOpen,
  onClose,
  st
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white dark:bg-gray-950 border border-slate-200 dark:border-gray-800 rounded-3xl max-w-2xl w-full p-6 space-y-5 shadow-2xl max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-gray-800">
          <div className="flex items-center gap-2">
            <Globe className="w-5 h-5 text-emerald-500" />
            <h3 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white">
              {st.modal.title}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-gray-200 hover:bg-slate-100 dark:hover:bg-gray-800 cursor-pointer"
          >
            ✕
          </button>
        </div>

        <div className="space-y-4 text-xs sm:text-sm text-slate-700 dark:text-gray-300 leading-relaxed">
          <p>
            {st.modal.desc}
          </p>

          {/* Tiers List */}
          <div className="space-y-2">
            <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-bold text-emerald-600 dark:text-emerald-400">{st.modal.tier1}</span>
                <span className="text-[11px] font-mono font-bold bg-emerald-500/20 px-2 py-0.5 rounded-full text-emerald-600 dark:text-emerald-300">Ultra</span>
              </div>
              <p className="text-xs text-slate-600 dark:text-gray-400">
                <strong>English</strong>, <strong>Spanish (Español)</strong>, <strong>Italian (Italiano)</strong>, <strong>German (Deutsch)</strong>, <strong>French (Français)</strong>, <strong>Portuguese (Português)</strong>, <strong>Japanese (日本語)</strong>, <strong>Russian (Русский)</strong>, <strong>Polish</strong>, <strong>Dutch</strong>.
              </p>
            </div>

            <div className="p-3 rounded-2xl bg-sky-500/10 border border-sky-500/25 space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-bold text-sky-600 dark:text-sky-400">{st.modal.tier2}</span>
                <span className="text-[11px] font-mono font-bold bg-sky-500/20 px-2 py-0.5 rounded-full text-sky-600 dark:text-sky-300">High</span>
              </div>
              <p className="text-xs text-slate-600 dark:text-gray-400">
                <strong>Turkish (Türkçe)</strong>, <strong>Chinese (中文)</strong>, <strong>Korean (한국어)</strong>, <strong>Indonesian</strong>, <strong>Vietnamese</strong>, <strong>Arabic (العربية)</strong>.
              </p>
            </div>

            <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/25 space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-bold text-amber-600 dark:text-amber-400">{st.modal.tier3}</span>
                <span className="text-[11px] font-mono font-bold bg-amber-500/20 px-2 py-0.5 rounded-full text-amber-600 dark:text-amber-300">Active</span>
              </div>
              <p className="text-xs text-slate-600 dark:text-gray-400">
                {st.modal.uzDesc}
              </p>
            </div>
          </div>

          <div className="pt-2 flex justify-end">
            <button
              onClick={onClose}
              className="px-5 py-2 rounded-xl bg-emerald-500 text-gray-950 font-bold text-xs shadow-md cursor-pointer"
            >
              {st.modal.gotIt}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
