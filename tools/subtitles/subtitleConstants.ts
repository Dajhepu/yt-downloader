import { SubtitleStyleConfig } from '../../types';

export const HIGHLIGHT_COLOR_CHOICES = ['#facc15', '#34d399', '#38bdf8', '#f43f5e', '#ffffff'];

export const PLAYBACK_RATES = [0.5, 0.75, 1, 1.25, 1.5, 2];

export const INTRO_DELAY_PRESETS = [0, 1.0, 1.5, 2.0, 2.5, 3.0, 4.0];

export const DEFAULT_STYLE_PRESETS: Record<string, Partial<SubtitleStyleConfig>> = {
  tiktok: {
    preset: 'tiktok',
    fontSize: 34,
    textColor: '#ffffff',
    highlightColor: '#facc15',
    animation: 'karaoke',
    fontFamily: 'impact',
    bgColor: 'transparent',
    position: 'bottom',
    xOffsetPercent: 50,
    yOffsetPercent: 82,
    align: 'center',
    maxWidthPercent: 85,
    borderRadius: 12,
    boxPadding: 8,
    letterSpacing: 0,
    lineHeight: 1.3,
    uppercase: true,
    stroke: true,
    strokeColor: '#000000',
  },
  cinema: {
    preset: 'cinema',
    fontSize: 26,
    textColor: '#ffffff',
    highlightColor: '#38bdf8',
    animation: 'static',
    fontFamily: 'serif',
    bgColor: 'dark',
    position: 'bottom',
    xOffsetPercent: 50,
    yOffsetPercent: 88,
    align: 'center',
    maxWidthPercent: 90,
    borderRadius: 8,
    boxPadding: 10,
    letterSpacing: 0.5,
    lineHeight: 1.4,
    uppercase: false,
    stroke: false,
    strokeColor: '#000000',
  },
  minimal: {
    preset: 'minimal',
    fontSize: 26,
    textColor: '#ffffff',
    highlightColor: '#facc15',
    animation: 'bounce',
    fontFamily: 'sans',
    bgColor: 'transparent',
    position: 'bottom',
    xOffsetPercent: 50,
    yOffsetPercent: 86,
    align: 'center',
    maxWidthPercent: 80,
    borderRadius: 12,
    boxPadding: 8,
    letterSpacing: 0,
    lineHeight: 1.35,
    uppercase: false,
    stroke: true,
    strokeColor: '#1e293b',
  },
  youtube: {
    preset: 'youtube',
    fontSize: 28,
    textColor: '#0f172a',
    highlightColor: '#ef4444',
    animation: 'karaoke',
    fontFamily: 'sans',
    bgColor: 'yellow',
    position: 'bottom',
    xOffsetPercent: 50,
    yOffsetPercent: 88,
    align: 'center',
    maxWidthPercent: 85,
    borderRadius: 10,
    boxPadding: 8,
    letterSpacing: 0,
    lineHeight: 1.3,
    uppercase: false,
    stroke: false,
    strokeColor: '#000000',
  },
  neon: {
    preset: 'neon',
    fontSize: 32,
    textColor: '#6ee7b7',
    highlightColor: '#10b981',
    animation: 'wave',
    fontFamily: 'sans',
    bgColor: 'dark',
    position: 'bottom',
    xOffsetPercent: 50,
    yOffsetPercent: 84,
    align: 'center',
    maxWidthPercent: 85,
    borderRadius: 16,
    boxPadding: 10,
    letterSpacing: 1,
    lineHeight: 1.35,
    uppercase: true,
    stroke: true,
    strokeColor: '#064e3b',
  }
};

export const formatTimeMinutesSeconds = (secs: number): string => {
  if (isNaN(secs) || secs < 0) return '00:00.0';
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  const ms = Math.floor((secs % 1) * 10);
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${ms}`;
};
