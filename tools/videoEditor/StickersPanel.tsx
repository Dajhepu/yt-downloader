import React, { useState, useRef } from 'react';
import {
  Sparkles,
  Search,
  Upload,
  Trash2,
  Sliders,
  Clock,
  RotateCcw,
  Copy,
  Crosshair,
  ChevronRight,
  Eye,
  Plus,
  Compass,
  Smile,
  Share2,
  ArrowRight,
  Tag
} from 'lucide-react';
import { StickerItem } from './types';
import {
  STICKER_POPULAR,
  STICKER_SOCIAL,
  STICKER_ARROWS,
  STICKER_FUN,
  STICKER_BADGE_PRESETS
} from './editorConstants';
import { formatCapCutTimecode } from './editorUtils';
import { VideoEditorTranslationSchema } from '../../translations/videoEditorTranslations';

interface StickersPanelProps {
  stickers: StickerItem[];
  selectedStickerId: string | null;
  onSelectSticker: (id: string | null) => void;
  onAddSticker: (sticker: StickerItem) => void;
  onUpdateSticker: (id: string, updates: Partial<StickerItem>) => void;
  onDeleteSticker: (id: string) => void;
  onClearAllStickers: () => void;
  onDuplicateSticker?: (id: string) => void;
  currentTime: number;
  duration: number;
  lang?: string;
  t?: VideoEditorTranslationSchema;
}

type CategoryType = 'popular' | 'social' | 'arrows' | 'fun' | 'badges' | 'custom';

export const StickersPanel: React.FC<StickersPanelProps> = ({
  stickers,
  selectedStickerId,
  onSelectSticker,
  onAddSticker,
  onUpdateSticker,
  onDeleteSticker,
  onClearAllStickers,
  onDuplicateSticker,
  currentTime,
  duration,
  lang = 'uz',
  t,
}) => {
  const [activeCategory, setActiveCategory] = useState<CategoryType>('popular');
  const [searchQuery, setSearchQuery] = useState('');
  const [customUploads, setCustomUploads] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const selectedSticker = stickers.find((s) => s.id === selectedStickerId);

  // Translation helpers
  const spT = t?.stickersPanel;
  const catPopular = spT?.categories?.popular || "Ommabop";
  const catSocial = spT?.categories?.social || "Ijtimoiy";
  const catArrows = spT?.categories?.arrows || "Ko'rsatkichlar";
  const catBadges = spT?.categories?.badges || "Belgilar";
  const catCustom = spT?.categories?.custom || "O'z rasmim";

  const lblSelectedSticker = spT?.selectedSticker || "Tanlangan stiker";
  const lblDuplicate = spT?.duplicate || "Nusxalash";
  const lblDelete = spT?.delete || "O'chirish";
  const lblScale = spT?.scale || "O'lchami (Scale)";
  const lblRotation = spT?.rotation || "Aylanishi (Rotation)";
  const lblResetRotation = spT?.resetRotation || "0° ga qaytarish";
  const lblQuickAlign = spT?.quickAlign || "Tezkor joylashtirish";
  const lblTimeRange = spT?.timeRange || "Vaqt oralig'i";
  const lblAlwaysShow = spT?.alwaysShow || "Doimiy ko'rsatish";
  const lblSetTime = spT?.setTime || "Vaqt belgilash";
  const lblStartTime = spT?.startTime || "Boshlanish";
  const lblEndTime = spT?.endTime || "Tugash";
  const lblCurrentTimeBtn = spT?.currentTimeBtn || "Now";

  const lblCustomUploadPrompt = spT?.customUploadPrompt || "O'z rasmingizni stiker qiling";
  const lblCustomUploadFormats = spT?.customUploadFormats || "PNG, JPG, WEBP formatlari";
  const lblUploadedImages = spT?.uploadedImages || "Yuklangan rasmlar:";

  const lblStickersOnVideo = spT?.stickersOnVideo || "Videodagi stikerlar";
  const lblClearAll = spT?.clearAll || "Barchasini tozalash";

  // Handle adding an emoji sticker
  const handleAddEmojiSticker = (emoji: string, name?: string) => {
    const newSticker: StickerItem = {
      id: `sticker_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      emoji,
      name: name || emoji,
      x: 50,
      y: 50,
      scale: 1.2,
      rotation: 0,
      opacity: 1,
      startTime: 0,
      endTime: duration > 0 ? duration : 10,
    };
    onAddSticker(newSticker);
    onSelectSticker(newSticker.id);
  };

  // Handle custom image upload
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const url = ev.target?.result as string;
      if (url) {
        setCustomUploads((prev) => [url, ...prev]);
        const newSticker: StickerItem = {
          id: `sticker_custom_${Date.now()}`,
          emoji: '🖼️',
          imageUrl: url,
          name: file.name,
          x: 50,
          y: 50,
          scale: 1.5,
          rotation: 0,
          opacity: 1,
          startTime: 0,
          endTime: duration > 0 ? duration : 10,
        };
        onAddSticker(newSticker);
        onSelectSticker(newSticker.id);
      }
    };
    reader.readAsDataURL(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Preset Position alignments
  const alignPositions = [
    { label: '↖', x: 20, y: 20, title: spT?.alignTopLeft || "Chap-yuqori" },
    { label: '⬆', x: 50, y: 20, title: spT?.alignTopCenter || "Markaz-yuqori" },
    { label: '↗', x: 80, y: 20, title: spT?.alignTopRight || "O'ng-yuqori" },
    { label: '⬅', x: 20, y: 50, title: spT?.alignLeftCenter || "Chap-markaz" },
    { label: '⏺', x: 50, y: 50, title: spT?.alignCenter || "Markaz" },
    { label: '➡', x: 80, y: 50, title: spT?.alignRightCenter || "O'ng-markaz" },
    { label: '↙', x: 20, y: 80, title: spT?.alignBottomLeft || "Chap-pastki" },
    { label: '⬇', x: 50, y: 80, title: spT?.alignBottomCenter || "Markaz-pastki" },
    { label: '↘', x: 80, y: 80, title: spT?.alignBottomRight || "O'ng-pastki" },
  ];

  return (
    <div className="flex-1 flex flex-col overflow-y-auto p-3 space-y-4 text-xs select-none">
      {/* Category Tabs Bar */}
      <div className="flex items-center gap-1 overflow-x-auto pb-1 scrollbar-none shrink-0">
        <button
          type="button"
          onClick={() => setActiveCategory('popular')}
          className={`px-2.5 py-1.5 rounded-lg font-medium whitespace-nowrap transition-colors flex items-center gap-1 cursor-pointer ${
            activeCategory === 'popular'
              ? 'bg-[#00c5d4] text-slate-950 font-bold'
              : 'bg-[#1e222d] text-slate-400 hover:text-white'
          }`}
        >
          <span>🔥</span>
          <span>{catPopular}</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveCategory('social')}
          className={`px-2.5 py-1.5 rounded-lg font-medium whitespace-nowrap transition-colors flex items-center gap-1 cursor-pointer ${
            activeCategory === 'social'
              ? 'bg-[#00c5d4] text-slate-950 font-bold'
              : 'bg-[#1e222d] text-slate-400 hover:text-white'
          }`}
        >
          <span>📢</span>
          <span>{catSocial}</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveCategory('arrows')}
          className={`px-2.5 py-1.5 rounded-lg font-medium whitespace-nowrap transition-colors flex items-center gap-1 cursor-pointer ${
            activeCategory === 'arrows'
              ? 'bg-[#00c5d4] text-slate-950 font-bold'
              : 'bg-[#1e222d] text-slate-400 hover:text-white'
          }`}
        >
          <span>➡️</span>
          <span>{catArrows}</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveCategory('badges')}
          className={`px-2.5 py-1.5 rounded-lg font-medium whitespace-nowrap transition-colors flex items-center gap-1 cursor-pointer ${
            activeCategory === 'badges'
              ? 'bg-[#00c5d4] text-slate-950 font-bold'
              : 'bg-[#1e222d] text-slate-400 hover:text-white'
          }`}
        >
          <span>🏷️</span>
          <span>{catBadges}</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveCategory('custom')}
          className={`px-2.5 py-1.5 rounded-lg font-medium whitespace-nowrap transition-colors flex items-center gap-1 cursor-pointer ${
            activeCategory === 'custom'
              ? 'bg-[#00c5d4] text-slate-950 font-bold'
              : 'bg-[#1e222d] text-slate-400 hover:text-white'
          }`}
        >
          <span>📁</span>
          <span>{catCustom}</span>
        </button>
      </div>

      {/* Selected Sticker Inspector Panel (Active Editing) */}
      {selectedSticker && (
        <div className="p-3 rounded-xl bg-[#1a1f2c] border-2 border-[#00c5d4]/50 shadow-lg space-y-3 shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-7 h-7 rounded-lg bg-[#242b3d] flex items-center justify-center text-base border border-slate-700/50">
                {selectedSticker.imageUrl ? (
                  <img
                    src={selectedSticker.imageUrl}
                    alt=""
                    className="w-5 h-5 object-contain"
                  />
                ) : (
                  selectedSticker.emoji
                )}
              </span>
              <div>
                <h4 className="font-bold text-white text-[11px]">{lblSelectedSticker}</h4>
                <p className="text-[10px] text-[#00c5d4]">
                  X: {Math.round(selectedSticker.x)}% | Y: {Math.round(selectedSticker.y)}%
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              {onDuplicateSticker && (
                <button
                  type="button"
                  onClick={() => onDuplicateSticker(selectedSticker.id)}
                  className="p-1.5 rounded bg-[#242b3d] hover:bg-emerald-500/20 text-slate-300 hover:text-emerald-400 transition-colors cursor-pointer"
                  title={lblDuplicate}
                >
                  <Copy className="w-3.5 h-3.5" />
                </button>
              )}
              <button
                type="button"
                onClick={() => onDeleteSticker(selectedSticker.id)}
                className="p-1.5 rounded bg-[#242b3d] hover:bg-rose-500/20 text-slate-300 hover:text-rose-400 transition-colors cursor-pointer"
                title={lblDelete}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Scale Slider */}
          <div className="space-y-1">
            <div className="flex justify-between text-[10px] text-slate-400">
              <span>{lblScale}</span>
              <span className="font-mono text-[#00c5d4]">{Math.round(selectedSticker.scale * 100)}%</span>
            </div>
            <input
              type="range"
              min={0.3}
              max={3.5}
              step={0.05}
              value={selectedSticker.scale}
              onChange={(e) => onUpdateSticker(selectedSticker.id, { scale: parseFloat(e.target.value) })}
              className="w-full h-1 bg-[#262d3d] rounded appearance-none cursor-pointer accent-[#00c5d4]"
            />
          </div>

          {/* Rotation Slider */}
          <div className="space-y-1">
            <div className="flex justify-between text-[10px] text-slate-400">
              <span>{lblRotation}</span>
              <span className="font-mono text-[#00c5d4]">{selectedSticker.rotation || 0}°</span>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="range"
                min={-180}
                max={180}
                step={5}
                value={selectedSticker.rotation || 0}
                onChange={(e) => onUpdateSticker(selectedSticker.id, { rotation: parseInt(e.target.value, 10) })}
                className="flex-1 h-1 bg-[#262d3d] rounded appearance-none cursor-pointer accent-[#00c5d4]"
              />
              <button
                type="button"
                onClick={() => onUpdateSticker(selectedSticker.id, { rotation: 0 })}
                className="p-1 rounded bg-[#242b3d] text-slate-400 hover:text-white cursor-pointer"
                title={lblResetRotation}
              >
                <RotateCcw className="w-3 h-3" />
              </button>
            </div>
          </div>

          {/* Quick Alignment 3x3 Grid */}
          <div className="space-y-1">
            <span className="text-[10px] text-slate-400 block">{lblQuickAlign}</span>
            <div className="grid grid-cols-3 gap-1">
              {alignPositions.map((pos) => (
                <button
                  key={pos.label}
                  type="button"
                  onClick={() => onUpdateSticker(selectedSticker.id, { x: pos.x, y: pos.y })}
                  className="py-1 rounded bg-[#242b3d] hover:bg-[#00c5d4] hover:text-slate-950 text-slate-300 font-bold text-[10px] transition-colors cursor-pointer"
                  title={pos.title}
                >
                  {pos.label}
                </button>
              ))}
            </div>
          </div>

          {/* Timing (Duration) */}
          <div className="pt-1 border-t border-slate-700/50 space-y-2">
            <div className="flex items-center justify-between text-[10px]">
              <span className="text-slate-400 flex items-center gap-1">
                <Clock className="w-3 h-3 text-[#00c5d4]" />
                <span>{lblTimeRange}</span>
              </span>
              <button
                type="button"
                onClick={() => {
                  const isTimed = selectedSticker.startTime !== undefined && selectedSticker.endTime !== undefined;
                  if (isTimed) {
                    onUpdateSticker(selectedSticker.id, { startTime: undefined, endTime: undefined });
                  } else {
                    onUpdateSticker(selectedSticker.id, {
                      startTime: Math.max(0, Math.floor(currentTime)),
                      endTime: Math.min(duration, Math.floor(currentTime) + 3),
                    });
                  }
                }}
                className="text-[#00c5d4] hover:underline font-medium cursor-pointer"
              >
                {selectedSticker.startTime !== undefined ? lblAlwaysShow : lblSetTime}
              </button>
            </div>

            {selectedSticker.startTime !== undefined && selectedSticker.endTime !== undefined && (
              <div className="grid grid-cols-2 gap-2 text-[10px]">
                <div className="p-1.5 rounded bg-[#242b3d] space-y-1">
                  <span className="text-slate-500 block">{lblStartTime}</span>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      min={0}
                      max={duration}
                      step={0.5}
                      value={selectedSticker.startTime}
                      onChange={(e) => onUpdateSticker(selectedSticker.id, { startTime: parseFloat(e.target.value) || 0 })}
                      className="w-full bg-transparent text-white font-mono outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => onUpdateSticker(selectedSticker.id, { startTime: currentTime })}
                      className="px-1 text-[9px] bg-[#00c5d4] text-slate-950 font-bold rounded cursor-pointer"
                      title={lblCurrentTimeBtn}
                    >
                      {lblCurrentTimeBtn}
                    </button>
                  </div>
                </div>

                <div className="p-1.5 rounded bg-[#242b3d] space-y-1">
                  <span className="text-slate-500 block">{lblEndTime}</span>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      min={0}
                      max={duration}
                      step={0.5}
                      value={selectedSticker.endTime}
                      onChange={(e) => onUpdateSticker(selectedSticker.id, { endTime: parseFloat(e.target.value) || duration })}
                      className="w-full bg-transparent text-white font-mono outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => onUpdateSticker(selectedSticker.id, { endTime: currentTime })}
                      className="px-1 text-[9px] bg-[#00c5d4] text-slate-950 font-bold rounded cursor-pointer"
                      title={lblCurrentTimeBtn}
                    >
                      {lblCurrentTimeBtn}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Category Content: Stickers Grid */}
      <div className="space-y-3">
        {/* Popular Category */}
        {activeCategory === 'popular' && (
          <div className="grid grid-cols-4 gap-2">
            {STICKER_POPULAR.map((emoji, idx) => (
              <button
                key={`${emoji}-${idx}`}
                type="button"
                onClick={() => handleAddEmojiSticker(emoji)}
                className="h-12 rounded-xl bg-[#1b1e27] hover:bg-[#252a37] border border-[#272d3b] hover:border-[#00c5d4] flex items-center justify-center text-2xl transition-all hover:scale-110 active:scale-95 cursor-pointer shadow-sm"
              >
                <span>{emoji}</span>
              </button>
            ))}
          </div>
        )}

        {/* Social & CTA Category */}
        {activeCategory === 'social' && (
          <div className="grid grid-cols-4 gap-2">
            {STICKER_SOCIAL.map((emoji, idx) => (
              <button
                key={`${emoji}-${idx}`}
                type="button"
                onClick={() => handleAddEmojiSticker(emoji)}
                className="h-12 rounded-xl bg-[#1b1e27] hover:bg-[#252a37] border border-[#272d3b] hover:border-[#00c5d4] flex items-center justify-center text-2xl transition-all hover:scale-110 active:scale-95 cursor-pointer shadow-sm"
              >
                <span>{emoji}</span>
              </button>
            ))}
          </div>
        )}

        {/* Arrows & Badges */}
        {activeCategory === 'arrows' && (
          <div className="grid grid-cols-4 gap-2">
            {STICKER_ARROWS.map((emoji, idx) => (
              <button
                key={`${emoji}-${idx}`}
                type="button"
                onClick={() => handleAddEmojiSticker(emoji)}
                className="h-12 rounded-xl bg-[#1b1e27] hover:bg-[#252a37] border border-[#272d3b] hover:border-[#00c5d4] flex items-center justify-center text-2xl transition-all hover:scale-110 active:scale-95 cursor-pointer shadow-sm"
              >
                <span>{emoji}</span>
              </button>
            ))}
          </div>
        )}

        {/* Badges Category */}
        {activeCategory === 'badges' && (
          <div className="grid grid-cols-2 gap-2">
            {STICKER_BADGE_PRESETS.map((badge, idx) => (
              <button
                key={badge.text}
                type="button"
                onClick={() => handleAddEmojiSticker(badge.text, badge.text)}
                className={`py-2 px-3 rounded-xl font-extrabold text-xs text-center transition-all hover:scale-105 active:scale-95 cursor-pointer shadow-md ${badge.bg} ${badge.color}`}
              >
                {badge.text}
              </button>
            ))}
          </div>
        )}

        {/* Custom Image Uploads */}
        {activeCategory === 'custom' && (
          <div className="space-y-3">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full py-4 rounded-xl border-2 border-dashed border-[#2d3446] hover:border-[#00c5d4] bg-[#151822] hover:bg-[#191f2d] text-slate-300 font-bold flex flex-col items-center justify-center gap-1.5 transition-all cursor-pointer"
            >
              <Upload className="w-5 h-5 text-[#00c5d4]" />
              <span>{lblCustomUploadPrompt}</span>
              <span className="text-[10px] text-slate-500">{lblCustomUploadFormats}</span>
            </button>

            {customUploads.length > 0 && (
              <div className="space-y-1.5">
                <span className="text-[10px] text-slate-400 font-bold">{lblUploadedImages}</span>
                <div className="grid grid-cols-3 gap-2">
                  {customUploads.map((url, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        const newSticker: StickerItem = {
                          id: `sticker_custom_${Date.now()}_${idx}`,
                          emoji: '🖼️',
                          imageUrl: url,
                          x: 50,
                          y: 50,
                          scale: 1.5,
                          rotation: 0,
                          opacity: 1,
                          startTime: 0,
                          endTime: duration > 0 ? duration : 10,
                        };
                        onAddSticker(newSticker);
                        onSelectSticker(newSticker.id);
                      }}
                      className="aspect-square rounded-xl bg-[#1b1e27] border border-[#272d3b] hover:border-[#00c5d4] p-1 overflow-hidden transition-all hover:scale-105 cursor-pointer"
                    >
                      <img src={url} alt="" className="w-full h-full object-contain" />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Active Stickers on Video List */}
      {stickers.length > 0 && (
        <div className="pt-3 border-t border-[#242938] space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-300">
              {lblStickersOnVideo} ({stickers.length})
            </span>
            <button
              type="button"
              onClick={onClearAllStickers}
              className="text-[10px] text-rose-400 hover:text-rose-300 transition-colors cursor-pointer"
            >
              {lblClearAll}
            </button>
          </div>

          <div className="space-y-1.5 max-h-48 overflow-y-auto">
            {stickers.map((st) => {
              const isSelected = selectedStickerId === st.id;
              return (
                <div
                  key={st.id}
                  onClick={() => onSelectSticker(st.id)}
                  className={`p-2 rounded-xl flex items-center justify-between cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-[#00c5d4]/15 border border-[#00c5d4] text-white'
                      : 'bg-[#181c26] border border-[#242a38] text-slate-300 hover:bg-[#1f2433]'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded bg-[#242b3d] flex items-center justify-center text-sm">
                      {st.imageUrl ? (
                        <img src={st.imageUrl} alt="" className="w-4 h-4 object-contain" />
                      ) : (
                        st.emoji
                      )}
                    </span>
                    <div className="text-[11px]">
                      <span className="font-semibold block truncate max-w-[120px]">
                        {st.name || st.emoji}
                      </span>
                      <span className="text-[9px] text-slate-500 font-mono">
                        {Math.round(st.x)}%, {Math.round(st.y)}% • {Math.round(st.scale * 100)}%
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteSticker(st.id);
                      }}
                      className="p-1 rounded text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                      title={lblDelete}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
