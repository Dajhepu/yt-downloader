import React, { useEffect, useState, useRef } from 'react';
import {
  FolderOpen,
  Plus,
  Trash2,
  Download,
  Upload,
  Clock,
  Film,
  Music,
  Type,
  X,
  Check,
  AlertCircle,
  Play,
  FileCode
} from 'lucide-react';
import {
  listSavedProjects,
  deleteProjectFromDb,
  exportProjectAsJson,
  importProjectFromJson,
  SavedProjectSummary,
  RestoredProjectData
} from '../../lib/projectStorage';
import { formatShortDuration } from './editorUtils';

interface SavedProjectsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenProject: (projectId: string) => void;
  onProjectImported?: (project: RestoredProjectData) => void;
  onNewBlankProject?: () => void;
  currentProjectId?: string;
  lang?: string;
}

export const SavedProjectsModal: React.FC<SavedProjectsModalProps> = ({
  isOpen,
  onClose,
  onOpenProject,
  onProjectImported,
  onNewBlankProject,
  currentProjectId,
  lang = 'en'
}) => {
  const [projects, setProjects] = useState<SavedProjectSummary[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isUz = lang === 'uz';

  const t = {
    title: isUz ? 'Saqlangan Loyihalar' : 'Saved Projects',
    subtitle: isUz
      ? 'Barcha tahrirlar brauzeringiz xotirasida (IndexedDB) 100% xavfsiz saqlanadi'
      : 'All your edits and clips are stored 100% privately in your browser (IndexedDB)',
    newProject: isUz ? 'Yangi loyiha' : 'New Project',
    importProject: isUz ? 'Loyihani ochish (.dcproj)' : 'Import (.dcproj)',
    open: isUz ? 'Ochish' : 'Open',
    current: isUz ? 'Hozirgi' : 'Active',
    delete: isUz ? "O'chirish" : 'Delete',
    confirmDelete: isUz ? "Haqiqatan ham o'chirmoqchimisiz?" : 'Are you sure you want to delete?',
    confirmYes: isUz ? "Ha, o'chirish" : 'Yes, Delete',
    cancel: isUz ? 'Bekor qilish' : 'Cancel',
    export: isUz ? 'Eksport (.dcproj)' : 'Export (.dcproj)',
    noProjects: isUz ? 'Hozircha saqlangan loyihalar yo\'q' : 'No saved projects yet',
    noProjectsHint: isUz
      ? 'Videoni tahrirlashni boshlaganingizda barcha o\'zgarishlar avtomatik saqlanib boradi.'
      : 'Your edits are automatically saved here as soon as you start trimming or editing.',
    lastEdited: isUz ? 'So\'nggi o\'zgarish' : 'Last edited',
    clips: isUz ? 'ta klip' : 'clips',
    tracks: isUz ? 'ta musiqa' : 'audios',
    subtitles: isUz ? 'ta matn' : 'texts',
  };

  const loadList = async () => {
    setIsLoading(true);
    try {
      const list = await listSavedProjects();
      setProjects(list);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadList();
      setDeleteConfirmId(null);
      setErrorMessage(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleDelete = async (id: string) => {
    try {
      await deleteProjectFromDb(id);
      setProjects(prev => prev.filter(p => p.id !== id));
      setDeleteConfirmId(null);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to delete');
    }
  };

  const handleExport = async (id: string, name: string) => {
    try {
      const jsonStr = await exportProjectAsJson(id);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${name.replace(/\.[^.]+$/, '') || 'project'}.dcproj`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to export project');
    }
  };

  const handleFileImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const imported = await importProjectFromJson(text);
      await loadList();
      if (onProjectImported) {
        onProjectImported(imported);
      } else {
        onOpenProject(imported.id);
      }
      onClose();
    } catch (err: any) {
      setErrorMessage(isUz ? "Fayl formati noto'g'ri (.dcproj tanlang)" : 'Invalid .dcproj file format');
    } finally {
      e.target.value = '';
    }
  };

  const formatRelativeTime = (ts: number) => {
    const diffSec = Math.floor((Date.now() - ts) / 1000);
    if (diffSec < 60) return isUz ? 'Hozirgina' : 'Just now';
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return isUz ? `${diffMin} daqiqa oldin` : `${diffMin}m ago`;
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return isUz ? `${diffHours} soat oldin` : `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return isUz ? `${diffDays} kun oldin` : `${diffDays}d ago`;
    return new Date(ts).toLocaleDateString();
  };

  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200 select-none">
      <div className="w-full max-w-2xl bg-[#141720] border border-[#262c3d] rounded-2xl shadow-2xl flex flex-col max-h-[88vh] overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-[#222733] flex items-center justify-between shrink-0 bg-[#171b26]">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#00c5d4]/15 border border-[#00c5d4]/30 flex items-center justify-center text-[#00c5d4]">
              <FolderOpen className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <span>{t.title}</span>
                <span className="px-2 py-0.5 rounded-full bg-[#202533] text-[11px] font-mono font-medium text-slate-300">
                  {projects.length}
                </span>
              </h3>
              <p className="text-xs text-slate-400 max-w-md line-clamp-1">{t.subtitle}</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-[#202533] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Toolbar (New Project, Import .dcproj) */}
        <div className="px-5 py-3 border-b border-[#222733] bg-[#12141c] flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2">
            {onNewBlankProject && (
              <button
                type="button"
                onClick={() => {
                  onNewBlankProject();
                  onClose();
                }}
                className="px-3 py-1.5 rounded-lg bg-[#00c5d4] hover:bg-[#00b5c4] text-slate-950 text-xs font-bold flex items-center gap-1.5 shadow cursor-pointer transition-all"
              >
                <Plus className="w-4 h-4 stroke-[2.5]" />
                <span>{t.newProject}</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="px-3 py-1.5 rounded-lg bg-[#202533] hover:bg-[#282f40] border border-[#2a3042] text-slate-200 text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors"
            >
              <Upload className="w-3.5 h-3.5 text-[#00c5d4]" />
              <span>{t.importProject}</span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".dcproj,.json"
              onChange={handleFileImport}
              className="hidden"
            />
          </div>

          <div className="text-[11px] text-slate-400 font-medium hidden sm:flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span>IndexedDB Auto-Save</span>
          </div>
        </div>

        {errorMessage && (
          <div className="mx-5 mt-3 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Projects List */}
        <div className="flex-1 overflow-y-auto p-5 space-y-3">
          {isLoading ? (
            <div className="py-16 text-center text-slate-400 text-xs space-y-2">
              <div className="w-6 h-6 border-2 border-[#00c5d4] border-t-transparent rounded-full animate-spin mx-auto" />
              <p>Yuklanmoqda...</p>
            </div>
          ) : projects.length === 0 ? (
            <div className="py-16 text-center space-y-3 px-4">
              <div className="w-14 h-14 rounded-2xl bg-[#1e2330] border border-[#2a3042] flex items-center justify-center text-slate-400 mx-auto">
                <FolderOpen className="w-7 h-7 text-[#00c5d4]" />
              </div>
              <h4 className="text-sm font-bold text-white">{t.noProjects}</h4>
              <p className="text-xs text-slate-400 max-w-sm mx-auto leading-relaxed">{t.noProjectsHint}</p>
            </div>
          ) : (
            projects.map((proj) => {
              const isCurrent = currentProjectId === proj.id;
              const isDeleting = deleteConfirmId === proj.id;

              return (
                <div
                  key={proj.id}
                  className={`p-3.5 rounded-xl border transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${
                    isCurrent
                      ? 'bg-[#18212e] border-[#00c5d4]/60 shadow-lg shadow-cyan-500/5'
                      : 'bg-[#181a24] border-[#252834] hover:border-[#353a4a]'
                  }`}
                >
                  {/* Left: Thumbnail & Info */}
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div
                      onClick={() => {
                        onOpenProject(proj.id);
                        onClose();
                      }}
                      className="w-16 h-11 rounded-lg bg-slate-900 border border-[#2a3040] overflow-hidden shrink-0 relative flex items-center justify-center cursor-pointer group"
                    >
                      {proj.thumbnailDataUrl ? (
                        <img
                          src={proj.thumbnailDataUrl}
                          alt={proj.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                        />
                      ) : (
                        <Film className="w-5 h-5 text-slate-500 group-hover:text-[#00c5d4] transition-colors" />
                      )}
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                        <Play className="w-4 h-4 text-white fill-white" />
                      </div>
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h4
                          onClick={() => {
                            onOpenProject(proj.id);
                            onClose();
                          }}
                          className="text-xs sm:text-sm font-bold text-white truncate hover:text-[#00c5d4] cursor-pointer transition-colors"
                          title={proj.name}
                        >
                          {proj.name}
                        </h4>
                        {isCurrent && (
                          <span className="px-1.5 py-0.5 rounded bg-[#00c5d4]/20 border border-[#00c5d4]/40 text-[#00c5d4] text-[9px] font-bold uppercase tracking-wider shrink-0">
                            {t.current}
                          </span>
                        )}
                        <span className="px-1.5 py-0.5 rounded bg-[#202533] text-slate-300 text-[9px] font-mono shrink-0">
                          {proj.aspectRatio}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-[11px] text-slate-400">
                        <span className="flex items-center gap-1 font-mono">
                          <Clock className="w-3 h-3 text-slate-500" />
                          <span>{formatShortDuration(proj.duration)}</span>
                        </span>
                        <span className="flex items-center gap-1">
                          <Film className="w-3 h-3 text-slate-500" />
                          <span>{proj.clipCount} {t.clips}</span>
                        </span>
                        {proj.audioClipCount > 0 && (
                          <span className="flex items-center gap-1">
                            <Music className="w-3 h-3 text-slate-500" />
                            <span>{proj.audioClipCount} {t.tracks}</span>
                          </span>
                        )}
                        {proj.textClipCount > 0 && (
                          <span className="flex items-center gap-1">
                            <Type className="w-3 h-3 text-slate-500" />
                            <span>{proj.textClipCount} {t.subtitles}</span>
                          </span>
                        )}
                        <span className="text-slate-500 font-normal">
                          • {formatRelativeTime(proj.updatedAt)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Right: Actions */}
                  <div className="flex items-center gap-1.5 w-full sm:w-auto justify-end shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-[#222733]">
                    {isDeleting ? (
                      <div className="flex items-center gap-1.5 animate-in fade-in">
                        <button
                          type="button"
                          onClick={() => handleDelete(proj.id)}
                          className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors"
                        >
                          <Trash2 className="w-3 h-3" />
                          <span>{t.confirmYes}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteConfirmId(null)}
                          className="px-2.5 py-1 rounded-lg bg-[#202533] text-slate-300 hover:text-white text-xs font-medium cursor-pointer"
                        >
                          {t.cancel}
                        </button>
                      </div>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => handleExport(proj.id, proj.name)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-[#00c5d4] hover:bg-[#202533] transition-colors cursor-pointer"
                          title={t.export}
                        >
                          <FileCode className="w-4 h-4" />
                        </button>

                        <button
                          type="button"
                          onClick={() => setDeleteConfirmId(proj.id)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                          title={t.delete}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            onOpenProject(proj.id);
                            onClose();
                          }}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer transition-all ${
                            isCurrent
                              ? 'bg-[#202533] border border-[#2e3748] text-slate-200'
                              : 'bg-[#00c5d4] hover:bg-[#00b5c4] text-slate-950 shadow-sm'
                          }`}
                        >
                          <span>{t.open}</span>
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
