import React from 'react';

interface TrimHandleProps {
  side: 'start' | 'end';
  color?: string;
  onPointerDown: (e: React.PointerEvent<HTMLDivElement>) => void;
  title: string;
}

export const TrimHandle: React.FC<TrimHandleProps> = ({
  side,
  color = '#00c5d4',
  onPointerDown,
  title
}) => {
  const isStart = side === 'start';

  return (
    <div
      onPointerDown={onPointerDown}
      className={`trim-handle absolute top-0 bottom-0 w-3.5 hover:bg-white text-slate-950 flex flex-col items-center justify-center cursor-ew-resize select-none z-30 transition-colors shadow-md ${
        isStart ? 'left-0 rounded-l-md' : 'right-0 rounded-r-md'
      }`}
      style={{ backgroundColor: color }}
      title={title}
    >
      <div className="w-[2px] h-3 bg-slate-900 rounded-full my-[1px]" />
      <div className="w-[2px] h-3 bg-slate-900 rounded-full my-[1px]" />
    </div>
  );
};
