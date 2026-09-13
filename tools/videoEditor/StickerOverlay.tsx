import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
  Trash2,
  RotateCcw,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Copy,
  Clock,
  Eye,
  Crosshair
} from 'lucide-react';
import { StickerItem } from './types';
import { VideoEditorTranslationSchema } from '../../translations/videoEditorTranslations';

interface StickerOverlayProps {
  stickers: StickerItem[];
  selectedStickerId: string | null;
  onSelectSticker: (id: string | null) => void;
  onUpdateSticker: (id: string, updates: Partial<StickerItem>) => void;
  onDeleteSticker: (id: string) => void;
  onDuplicateSticker?: (id: string) => void;
  currentTime: number;
  width: number;
  height: number;
  isPlaying: boolean;
  lang?: string;
  t?: VideoEditorTranslationSchema;
}

export const StickerOverlay: React.FC<StickerOverlayProps> = ({
  stickers,
  selectedStickerId,
  onSelectSticker,
  onUpdateSticker,
  onDeleteSticker,
  onDuplicateSticker,
  currentTime,
  width,
  height,
  isPlaying,
  lang,
  t,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  // Localization strings
  const spT = t?.stickersPanel;
  const rotateTooltip = spT?.rotateTooltip || "Aylantirish (Rotate)";
  const resizeTooltip = spT?.resizeTooltip || "O'lchamini o'zgartirish (Resize)";
  const zoomOutTooltip = spT?.zoomOut || "Kichraytirish (-)";
  const zoomInTooltip = spT?.zoomIn || "Kattalashtirish (+)";
  const resetRotationTooltip = spT?.resetRotation || "Aylanishni 0° ga qaytarish";
  const centerTooltip = spT?.center || "Markazga joylash (Center)";
  const duplicateTooltip = spT?.duplicate || "Nusxalash (Duplicate)";
  const deleteTooltip = spT?.delete || "O'chirish (Delete)";
  const [dragState, setDragState] = useState<{
    id: string;
    type: 'move' | 'resize' | 'rotate';
    startX: number;
    startY: number;
    origX: number;
    origY: number;
    origScale: number;
    origRotation: number;
    centerX: number;
    centerY: number;
  } | null>(null);

  const [snapX, setSnapX] = useState(false);
  const [snapY, setSnapY] = useState(false);

  // Global pointer move & up handlers during active drag/resize/rotate
  useEffect(() => {
    if (!dragState) return;

    const handlePointerMove = (e: PointerEvent) => {
      if (!containerRef.current || width <= 0 || height <= 0) return;

      const deltaPixelX = e.clientX - dragState.startX;
      const deltaPixelY = e.clientY - dragState.startY;

      if (dragState.type === 'move') {
        const deltaPercentX = (deltaPixelX / width) * 100;
        const deltaPercentY = (deltaPixelY / height) * 100;

        let newX = Math.round((dragState.origX + deltaPercentX) * 10) / 10;
        let newY = Math.round((dragState.origY + deltaPercentY) * 10) / 10;

        // Snapping to horizontal/vertical center
        if (Math.abs(newX - 50) < 1.8) {
          newX = 50;
          setSnapX(true);
        } else {
          setSnapX(false);
        }

        if (Math.abs(newY - 50) < 1.8) {
          newY = 50;
          setSnapY(true);
        } else {
          setSnapY(false);
        }

        newX = Math.max(3, Math.min(97, newX));
        newY = Math.max(3, Math.min(97, newY));

        onUpdateSticker(dragState.id, { x: newX, y: newY });
      } else if (dragState.type === 'resize') {
        // Distance from center to pointer
        const currentDist = Math.hypot(e.clientX - dragState.centerX, e.clientY - dragState.centerY);
        const initialDist = Math.hypot(dragState.startX - dragState.centerX, dragState.startY - dragState.centerY);
        if (initialDist > 5) {
          const ratio = currentDist / initialDist;
          const newScale = Math.max(0.3, Math.min(4.0, Math.round(dragState.origScale * ratio * 100) / 100));
          onUpdateSticker(dragState.id, { scale: newScale });
        }
      } else if (dragState.type === 'rotate') {
        // Angle from center
        const rad = Math.atan2(e.clientY - dragState.centerY, e.clientX - dragState.centerX);
        let deg = Math.round((rad * 180) / Math.PI) + 90;
        if (deg > 180) deg -= 360;
        // Snap to 0, 90, -90, 180
        if (Math.abs(deg) < 4) deg = 0;
        else if (Math.abs(deg - 90) < 4) deg = 90;
        else if (Math.abs(deg + 90) < 4) deg = -90;
        else if (Math.abs(Math.abs(deg) - 180) < 4) deg = 180;

        onUpdateSticker(dragState.id, { rotation: deg });
      }
    };

    const handlePointerUp = () => {
      setDragState(null);
      setSnapX(false);
      setSnapY(false);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerUp);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
    };
  }, [dragState, width, height, onUpdateSticker]);

  if (stickers.length === 0 || width <= 0 || height <= 0) return null;

  return (
    <div
      ref={containerRef}
      style={{ width: `${width}px`, height: `${height}px` }}
      className="absolute inset-0 m-auto pointer-events-none overflow-hidden select-none z-20"
    >
      {/* Visual Snap Guides */}
      {snapX && (
        <div className="absolute top-0 bottom-0 left-1/2 w-px -translate-x-1/2 bg-[#00c5d4] shadow-[0_0_8px_#00c5d4] z-10" />
      )}
      {snapY && (
        <div className="absolute left-0 right-0 top-1/2 h-px -translate-y-1/2 bg-[#00c5d4] shadow-[0_0_8px_#00c5d4] z-10" />
      )}

      {stickers.map((st) => {
        // Timing check
        const isTimeVisible =
          (st.startTime === undefined || st.endTime === undefined) ||
          (currentTime >= st.startTime && currentTime <= st.endTime);

        const isSelected = selectedStickerId === st.id;

        // If not playing, or if timed & current, or if selected, show it
        if (!isTimeVisible && !isSelected) return null;

        const posX = (st.x / 100) * width;
        const posY = (st.y / 100) * height;
        const basePixelSize = 48 * st.scale;
        const rotation = st.rotation || 0;
        const opacity = st.opacity !== undefined ? st.opacity : 1;

        return (
          <div
            key={st.id}
            style={{
              left: `${posX}px`,
              top: `${posY}px`,
              transform: `translate(-50%, -50%) rotate(${rotation}deg)`,
              opacity: !isTimeVisible && isSelected ? 0.5 : opacity,
            }}
            className={`absolute pointer-events-auto transition-shadow ${
              isSelected ? 'z-30 cursor-move' : 'z-20 cursor-pointer hover:scale-105 transition-transform'
            }`}
            onPointerDown={(e) => {
              e.stopPropagation();
              onSelectSticker(st.id);

              const rect = containerRef.current?.getBoundingClientRect();
              const cX = rect ? rect.left + posX : e.clientX;
              const cY = rect ? rect.top + posY : e.clientY;

              setDragState({
                id: st.id,
                type: 'move',
                startX: e.clientX,
                startY: e.clientY,
                origX: st.x,
                origY: st.y,
                origScale: st.scale,
                origRotation: rotation,
                centerX: cX,
                centerY: cY,
              });
            }}
          >
            {/* Sticker Graphic: Emoji or Custom Image */}
            <div
              style={{
                width: `${basePixelSize}px`,
                height: `${basePixelSize}px`,
                fontSize: `${basePixelSize * 0.8}px`,
              }}
              className="flex items-center justify-center select-none"
            >
              {st.imageUrl ? (
                <img
                  src={st.imageUrl}
                  alt={st.name || 'Sticker'}
                  className="w-full h-full object-contain pointer-events-none drop-shadow-md"
                  draggable={false}
                />
              ) : (
                <span className="leading-none drop-shadow-md filter select-none pointer-events-none">
                  {st.emoji}
                </span>
              )}
            </div>

            {/* Selection Bounding Box & Handles */}
            {isSelected && (
              <>
                {/* Dashed selection border with glow */}
                <div className="absolute -inset-2 border-2 border-dashed border-[#00c5d4] rounded-lg shadow-[0_0_12px_rgba(0,197,212,0.5)] pointer-events-none" />

                {/* Top Rotation Knob */}
                <div
                  className="absolute -top-7 left-1/2 -translate-x-1/2 flex flex-col items-center cursor-grab active:cursor-grabbing pointer-events-auto group"
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    const rect = containerRef.current?.getBoundingClientRect();
                    const cX = rect ? rect.left + posX : e.clientX;
                    const cY = rect ? rect.top + posY : e.clientY;

                    setDragState({
                      id: st.id,
                      type: 'rotate',
                      startX: e.clientX,
                      startY: e.clientY,
                      origX: st.x,
                      origY: st.y,
                      origScale: st.scale,
                      origRotation: rotation,
                      centerX: cX,
                      centerY: cY,
                    });
                  }}
                  title={rotateTooltip}
                >
                  <div className="w-3.5 h-3.5 rounded-full bg-[#00c5d4] border-2 border-white shadow-md group-hover:scale-125 transition-transform" />
                  <div className="w-0.5 h-3 bg-[#00c5d4]" />
                </div>

                {/* 4 Corner Resize Handles */}
                {/* Top-Left */}
                <div
                  className="absolute -top-3 -left-3 w-3 h-3 rounded-full bg-white border-2 border-[#00c5d4] cursor-nwse-resize pointer-events-auto hover:scale-125 transition-transform shadow"
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    const rect = containerRef.current?.getBoundingClientRect();
                    setDragState({
                      id: st.id,
                      type: 'resize',
                      startX: e.clientX,
                      startY: e.clientY,
                      origX: st.x,
                      origY: st.y,
                      origScale: st.scale,
                      origRotation: rotation,
                      centerX: rect ? rect.left + posX : e.clientX,
                      centerY: rect ? rect.top + posY : e.clientY,
                    });
                  }}
                  title={resizeTooltip}
                />

                {/* Top-Right */}
                <div
                  className="absolute -top-3 -right-3 w-3 h-3 rounded-full bg-white border-2 border-[#00c5d4] cursor-nesw-resize pointer-events-auto hover:scale-125 transition-transform shadow"
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    const rect = containerRef.current?.getBoundingClientRect();
                    setDragState({
                      id: st.id,
                      type: 'resize',
                      startX: e.clientX,
                      startY: e.clientY,
                      origX: st.x,
                      origY: st.y,
                      origScale: st.scale,
                      origRotation: rotation,
                      centerX: rect ? rect.left + posX : e.clientX,
                      centerY: rect ? rect.top + posY : e.clientY,
                    });
                  }}
                  title={resizeTooltip}
                />

                {/* Bottom-Left */}
                <div
                  className="absolute -bottom-3 -left-3 w-3 h-3 rounded-full bg-white border-2 border-[#00c5d4] cursor-nesw-resize pointer-events-auto hover:scale-125 transition-transform shadow"
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    const rect = containerRef.current?.getBoundingClientRect();
                    setDragState({
                      id: st.id,
                      type: 'resize',
                      startX: e.clientX,
                      startY: e.clientY,
                      origX: st.x,
                      origY: st.y,
                      origScale: st.scale,
                      origRotation: rotation,
                      centerX: rect ? rect.left + posX : e.clientX,
                      centerY: rect ? rect.top + posY : e.clientY,
                    });
                  }}
                  title={resizeTooltip}
                />

                {/* Bottom-Right */}
                <div
                  className="absolute -bottom-3 -right-3 w-3 h-3 rounded-full bg-white border-2 border-[#00c5d4] cursor-nwse-resize pointer-events-auto hover:scale-125 transition-transform shadow"
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    const rect = containerRef.current?.getBoundingClientRect();
                    setDragState({
                      id: st.id,
                      type: 'resize',
                      startX: e.clientX,
                      startY: e.clientY,
                      origX: st.x,
                      origY: st.y,
                      origScale: st.scale,
                      origRotation: rotation,
                      centerX: rect ? rect.left + posX : e.clientX,
                      centerY: rect ? rect.top + posY : e.clientY,
                    });
                  }}
                  title={resizeTooltip}
                />

                {/* Quick Floating Action Pill Above Sticker */}
                <div
                  style={{
                    transform: `translate(-50%, -100%) rotate(${-rotation}deg)`,
                  }}
                  className="absolute -top-9 left-1/2 flex items-center gap-1 px-2 py-1 rounded-full bg-[#141720]/95 border border-[#2c3345] shadow-xl text-[10px] text-white backdrop-blur-md whitespace-nowrap pointer-events-auto z-40"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    type="button"
                    onClick={() => {
                      onUpdateSticker(st.id, {
                        scale: Math.max(0.3, Math.round((st.scale - 0.2) * 10) / 10),
                      });
                    }}
                    className="p-1 hover:text-[#00c5d4] transition-colors cursor-pointer"
                    title={zoomOutTooltip}
                  >
                    <ZoomOut className="w-3 h-3" />
                  </button>

                  <span className="font-mono text-[9px] text-slate-300 font-bold px-0.5">
                    {Math.round(st.scale * 100)}%
                  </span>

                  <button
                    type="button"
                    onClick={() => {
                      onUpdateSticker(st.id, {
                        scale: Math.min(4.0, Math.round((st.scale + 0.2) * 10) / 10),
                      });
                    }}
                    className="p-1 hover:text-[#00c5d4] transition-colors cursor-pointer"
                    title={zoomInTooltip}
                  >
                    <ZoomIn className="w-3 h-3" />
                  </button>

                  <div className="w-px h-3 bg-slate-700 mx-0.5" />

                  {rotation !== 0 && (
                    <button
                      type="button"
                      onClick={() => onUpdateSticker(st.id, { rotation: 0 })}
                      className="p-1 hover:text-[#00c5d4] transition-colors cursor-pointer"
                      title={resetRotationTooltip}
                    >
                      <RotateCcw className="w-3 h-3" />
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => onUpdateSticker(st.id, { x: 50, y: 50 })}
                    className="p-1 hover:text-[#00c5d4] transition-colors cursor-pointer"
                    title={centerTooltip}
                  >
                    <Crosshair className="w-3 h-3" />
                  </button>

                  {onDuplicateSticker && (
                    <button
                      type="button"
                      onClick={() => onDuplicateSticker(st.id)}
                      className="p-1 hover:text-emerald-400 transition-colors cursor-pointer"
                      title={duplicateTooltip}
                    >
                      <Copy className="w-3 h-3" />
                    </button>
                  )}

                  <div className="w-px h-3 bg-slate-700 mx-0.5" />

                  <button
                    type="button"
                    onClick={() => onDeleteSticker(st.id)}
                    className="p-1 text-rose-400 hover:text-rose-300 transition-colors cursor-pointer"
                    title={deleteTooltip}
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </>
            )}
          </div>
        );
      })}
    </div>
  );
};
