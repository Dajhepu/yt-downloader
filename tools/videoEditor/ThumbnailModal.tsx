import React, { useState, useRef, useEffect } from 'react';
import {
  Camera,
  Upload,
  Download,
  Trash2,
  X,
  Check,
  Sparkles,
  Sliders,
  Image as ImageIcon,
  Clock,
  Play,
  CheckCircle2,
  RefreshCw
} from 'lucide-react';
import { VideoThumbnailData } from './types';
import { formatCapCutTimecode } from './editorUtils';
import { VideoEditorTranslationSchema } from '../../translations/videoEditorTranslations';

interface ThumbnailModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentThumbnail: VideoThumbnailData | null;
  onSaveThumbnail: (thumb: VideoThumbnailData | null) => void;
  onCaptureFrame: () => string | null;
  currentTime: number;
  duration: number;
  onSeek: (time: number) => void;
  aspectRatio: string;
  projectName?: string;
  lang?: string;
  t?: VideoEditorTranslationSchema;
}

export const ThumbnailModal: React.FC<ThumbnailModalProps> = ({
  isOpen,
  onClose,
  currentThumbnail,
  onSaveThumbnail,
  onCaptureFrame,
  currentTime,
  duration,
  onSeek,
  aspectRatio,
  projectName = 'video',
  lang = 'uz',
  t,
}) => {
  const [selectedThumb, setSelectedThumb] = useState<VideoThumbnailData | null>(currentThumbnail);
  const [scrubberTime, setScrubberTime] = useState<number>(currentTime);
  const [isCapturing, setIsCapturing] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Translation helpers with safe fallbacks
  const thumbT = t?.thumbnail;
  const modalTitle = thumbT?.modalTitle || "Video Muqovasi (Thumbnail & Cover)";
  const noCoverSelected = thumbT?.noCoverSelected || "Hozircha maxsus muqova tanlanmagan";
  const noCoverDesc = thumbT?.noCoverDesc || "Quyidagi tugma orqali joriy kadrni oling yoki o'z rasmingizni yuklang";
  const sourceUpload = thumbT?.sourceUpload || "Yuklangan rasm";
  const sourceFrame = thumbT?.sourceFrame || "Kadr";
  const downloadBtn = thumbT?.downloadBtn || "Yuklab olish";
  const downloadSuccessText = thumbT?.downloadSuccess || "Yuklab olindi!";
  const captureCardTitle = thumbT?.captureCardTitle || "Joriy kadrni olish";
  const captureCardDesc = thumbT?.captureCardDesc || "Pleyerdagi filtrlar, stikerlar va matnlar bilan to'liq kadr";
  const captureCardBtn = thumbT?.captureCardBtn || "Ushbu kadrni muqova qilish";
  const uploadCardTitle = thumbT?.uploadCardTitle || "Maxsus rasm yuklash";
  const uploadCardDesc = thumbT?.uploadCardDesc || "Canva yoki Photoshop'da tayyorlangan poster (PNG, JPG)";
  const uploadCardBtn = thumbT?.uploadCardBtn || "Kompyuterdan rasm tanlash";
  const timelineSearch = thumbT?.timelineSearch || "Video bo'ylab kadr qidirish:";
  const captureAtSecond = thumbT?.captureAtSecond || "Ushbu soniyadagi kadrni olish";
  const deleteCover = thumbT?.deleteCover || "Muqovani o'chirish";
  const cancelText = thumbT?.cancel || "Bekor qilish";
  const saveAndApplyText = thumbT?.saveAndApply || "Saqlash va Qo'llash";

  useEffect(() => {
    if (isOpen) {
      setSelectedThumb(currentThumbnail);
      setScrubberTime(currentTime);
    }
  }, [isOpen, currentThumbnail, currentTime]);

  if (!isOpen) return null;

  const handleCaptureCurrentFrame = () => {
    setIsCapturing(true);
    setTimeout(() => {
      const dataUrl = onCaptureFrame();
      if (dataUrl) {
        setSelectedThumb({
          dataUrl,
          source: 'frame',
          timestamp: currentTime,
        });
      }
      setIsCapturing(false);
    }, 50);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const result = ev.target?.result as string;
      if (result) {
        setSelectedThumb({
          dataUrl: result,
          source: 'upload',
        });
      }
    };
    reader.readAsDataURL(file);
    // Reset file input
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDownload = () => {
    if (!selectedThumb?.dataUrl) return;

    const link = document.createElement('a');
    link.href = selectedThumb.dataUrl;
    link.download = `${projectName}_thumbnail.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setDownloadSuccess(true);
    setTimeout(() => setDownloadSuccess(false), 2500);
  };

  const handleApplyAndClose = () => {
    onSaveThumbnail(selectedThumb);
    onClose();
  };

  const handleReset = () => {
    setSelectedThumb(null);
  };

  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-3 sm:p-6 overflow-y-auto animate-fadeIn">
      <div className="w-full max-w-2xl bg-[#141720] border border-[#242a38] rounded-2xl shadow-2xl overflow-hidden flex flex-col my-auto">
        {/* Modal Header */}
        <div className="h-14 px-5 border-b border-[#242a38] flex items-center justify-between bg-[#181c27] shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#00c5d4]/15 border border-[#00c5d4]/30 text-[#00c5d4] flex items-center justify-center">
              <Camera className="w-4 h-4 stroke-[2.5]" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <span>{modalTitle}</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#00c5d4]/10 text-[#00c5d4] border border-[#00c5d4]/20">
                  {aspectRatio}
                </span>
              </h3>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/60 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-5 overflow-y-auto max-h-[75vh]">
          {/* Main Thumbnail Preview Screen */}
          <div className="relative rounded-xl border-2 border-[#262c3a] bg-[#0c0e15] overflow-hidden flex items-center justify-center aspect-video max-h-[280px] shadow-inner group">
            {selectedThumb?.dataUrl ? (
              <img
                src={selectedThumb.dataUrl}
                alt="Thumbnail Preview"
                className="w-full h-full object-contain"
              />
            ) : (
              <div className="flex flex-col items-center justify-center text-center p-6 space-y-2">
                <div className="w-12 h-12 rounded-2xl bg-slate-800/80 text-slate-400 flex items-center justify-center">
                  <ImageIcon className="w-6 h-6" />
                </div>
                <p className="text-xs font-bold text-slate-300">
                  {noCoverSelected}
                </p>
                <p className="text-[11px] text-slate-500 max-w-xs">
                  {noCoverDesc}
                </p>
              </div>
            )}

            {/* Status Badge */}
            {selectedThumb && (
              <div className="absolute top-3 left-3 px-2.5 py-1 rounded-md bg-black/75 backdrop-blur-md border border-slate-700/60 text-[10px] text-emerald-400 font-semibold flex items-center gap-1.5 shadow-lg">
                <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                <span>
                  {selectedThumb.source === 'upload' ? sourceUpload : `${sourceFrame}: ${formatCapCutTimecode(selectedThumb.timestamp || 0)}`}
                </span>
              </div>
            )}

            {/* Download Button Overlay if thumb is selected */}
            {selectedThumb && (
              <div className="absolute bottom-3 right-3 flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleDownload}
                  className="px-3 py-1.5 rounded-lg bg-[#00c5d4] hover:bg-[#00d7e8] text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow-lg transition-all active:scale-95 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5 stroke-[2.5]" />
                  <span>{downloadSuccess ? downloadSuccessText : downloadBtn}</span>
                </button>
              </div>
            )}
          </div>

          {/* Action Cards: Capture Current Frame vs Upload Image */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Card 1: Capture Frame from Video */}
            <div className="p-3.5 rounded-xl bg-[#181c27] border border-[#262c3a] hover:border-[#00c5d4]/50 transition-all flex flex-col justify-between space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-[#00c5d4]/10 text-[#00c5d4] flex items-center justify-center shrink-0">
                  <Camera className="w-4 h-4 stroke-[2.5]" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white">{captureCardTitle}</h4>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    {captureCardDesc}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleCaptureCurrentFrame}
                disabled={isCapturing}
                className="w-full py-2.5 px-3 rounded-lg bg-[#242b3b] hover:bg-[#00c5d4] hover:text-slate-950 text-white font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md"
              >
                {isCapturing ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Camera className="w-3.5 h-3.5" />
                )}
                <span>{captureCardBtn}</span>
              </button>
            </div>

            {/* Card 2: Upload Custom Image from Device */}
            <div className="p-3.5 rounded-xl bg-[#181c27] border border-[#262c3a] hover:border-[#00c5d4]/50 transition-all flex flex-col justify-between space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center shrink-0">
                  <Upload className="w-4 h-4 stroke-[2.5]" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white">{uploadCardTitle}</h4>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    {uploadCardDesc}
                  </p>
                </div>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/jpg"
                onChange={handleFileUpload}
                className="hidden"
              />

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full py-2.5 px-3 rounded-lg bg-[#242b3b] hover:bg-purple-600 text-white font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>{uploadCardBtn}</span>
              </button>
            </div>
          </div>

          {/* Video Timeline Scrubber for picking frame */}
          {duration > 0 && (
            <div className="p-3.5 rounded-xl bg-[#181c27] border border-[#262c3a] space-y-2.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-300 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-[#00c5d4]" />
                  <span>{timelineSearch}</span>
                </span>
                <span className="font-mono text-xs text-[#00c5d4] font-bold">
                  {formatCapCutTimecode(scrubberTime)} / {formatCapCutTimecode(duration)}
                </span>
              </div>

              <input
                type="range"
                min={0}
                max={Math.max(0.1, duration)}
                step={0.05}
                value={scrubberTime}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  setScrubberTime(val);
                  onSeek(val);
                }}
                className="w-full h-1.5 bg-[#2a3040] rounded-lg appearance-none cursor-pointer accent-[#00c5d4]"
              />

              <div className="flex items-center justify-between pt-1">
                <span className="text-[10px] text-slate-500">00:00:00</span>
                <button
                  type="button"
                  onClick={handleCaptureCurrentFrame}
                  className="px-2.5 py-1 rounded bg-[#2a3244] hover:bg-[#343e54] text-[#00c5d4] font-bold text-[11px] flex items-center gap-1 transition-colors"
                >
                  <Camera className="w-3 h-3" />
                  <span>{captureAtSecond}</span>
                </button>
                <span className="text-[10px] text-slate-500">{formatCapCutTimecode(duration)}</span>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="h-16 px-5 border-t border-[#242a38] bg-[#181c27] flex items-center justify-between shrink-0">
          <div>
            {selectedThumb && (
              <button
                type="button"
                onClick={handleReset}
                className="text-xs text-rose-400 hover:text-rose-300 font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{deleteCover}</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="py-2 px-4 rounded-xl bg-[#242b3b] hover:bg-[#2d364a] text-slate-300 font-bold text-xs cursor-pointer transition-colors"
            >
              {cancelText}
            </button>
            <button
              type="button"
              onClick={handleApplyAndClose}
              className="py-2 px-5 rounded-xl bg-[#00c5d4] hover:bg-[#00d7e8] text-slate-950 font-extrabold text-xs flex items-center gap-1.5 shadow-lg shadow-[#00c5d4]/20 cursor-pointer transition-all active:scale-95"
            >
              <Check className="w-4 h-4 stroke-[3]" />
              <span>{saveAndApplyText}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

