import { VideoFile, EditorSettings, Language } from '../../types';
import { TranslationSchema } from '../../translations';
import type { RestoredProjectData } from '../../lib/projectStorage';

export interface ProjectAsset {
  id: string;
  name: string;
  type: 'video' | 'audio';
  duration: number; // in seconds
  durationStr: string;
  thumbnailUrl: string;
  url: string;
  isUploaded?: boolean;
}

export interface VideoEditorToolProps {
  video?: VideoFile | null;
  initialVideos?: VideoFile[];
  initialProject?: RestoredProjectData | null;
  onReset?: () => void;
  t: TranslationSchema;
  lang?: string;
  onSelectVideo?: (video: VideoFile) => void;
  onLanguageChange?: (lang: Language) => void;
}

export type LeftSidebarTab = 'media' | 'audio' | 'text' | 'stickers' | 'effects' | 'transitions' | 'filters' | 'library';
export type InspectorMainTab = 'video' | 'audio' | 'speed' | 'animation';
export type InspectorVideoSubTab = 'basic' | 'remove_bg' | 'background';

export interface VideoTrackItem {
  id: string;
  name: string;
  hidden?: boolean;
  muted?: boolean;
}

export interface AudioTrackItem {
  id: string;
  name: string;
  muted?: boolean;
}

export interface VideoClipItem {
  id: string;
  trackId?: string;
  name: string;
  start: number;
  end: number;
  offset?: number;
  sourceDuration?: number;
  assetId?: string;
  url?: string;
  volume?: number;
  muted?: boolean;
  speed?: number;
  transitionIn?: 'none' | 'fade_black' | 'dissolve' | 'zoom_in' | 'slide_left' | 'wipe';
  transitionDuration?: number;
  brightness?: number;
  contrast?: number;
  saturation?: number;
  filterPreset?: 'normal' | 'cinematic' | 'vintage' | 'cyberpunk' | 'noir' | 'vivid' | 'warm' | 'cool' | 'sepia';
}

export interface AudioClipItem {
  id: string;
  trackId?: string;
  name: string;
  url?: string;
  assetId?: string;
  start: number;
  end: number;
  offset?: number;
  sourceDuration?: number;
  volume?: number;
  muted?: boolean;
  speed?: number;
  fadeIn?: boolean;
  fadeInDuration?: number;
  fadeOut?: boolean;
  fadeOutDuration?: number;
}

export interface TextClipItem {
  id: string;
  text: string;
  start: number;
  end: number;
  fontSize?: number;
  fontColor?: string;
  bgColor?: 'transparent' | 'dark' | 'white' | 'emerald' | 'rose';
  position?: 'top' | 'center' | 'bottom';
}

export interface ActiveTrimmingState {
  id: string;
  type: 'video' | 'audio' | 'text';
  edge: 'start' | 'end';
  currentDuration: number;
  maxDuration: number;
  isAtMaxLimit: boolean;
}

export interface SnapGuide {
  time: number;
  label: string;
}

export interface StickerItem {
  id: string;
  emoji: string;
  x: number;          // 0 - 100 percentage (center point)
  y: number;          // 0 - 100 percentage (center point)
  scale: number;      // 0.2 - 4.0 (default 1.2)
  rotation?: number;  // -180 to 180 degrees (default 0)
  opacity?: number;   // 0.1 - 1.0 (default 1)
  startTime?: number; // start time in seconds (optional)
  endTime?: number;   // end time in seconds (optional)
  imageUrl?: string;  // custom image sticker url (optional)
  name?: string;
}

export interface VideoThumbnailData {
  dataUrl: string;       // base64 / blob URL of the thumbnail
  source: 'frame' | 'upload';
  timestamp?: number;    // timestamp in video if captured
  width?: number;
  height?: number;
}
