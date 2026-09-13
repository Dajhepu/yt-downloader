import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { VideoFile, EditorSettings, Language } from '../types';
import { TranslationSchema } from '../translations';
import { getVideoEditorTranslation, VideoEditorTranslationSchema } from '../translations/videoEditorTranslations';
import { LANGUAGE_LIST } from '../components/Navbar';
import { FlagIcon } from '../components/FlagIcon';
import {
  Film,
  Scissors,
  Palette,
  Type,
  Volume2,
  VolumeX,
  Play,
  Pause,
  RotateCw,
  FlipHorizontal,
  FlipVertical,
  Sparkles,
  Download,
  RotateCcw,
  Grid,
  Eye,
  EyeOff,
  Sliders,
  ZoomIn,
  ZoomOut,
  ShieldCheck,
  Sun,
  Contrast,
  Droplet,
  Layers,
  Trash2,
  FolderOpen,
  Music,
  Smile,
  Star,
  Maximize2,
  Minimize2,
  Upload,
  RefreshCw,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Plus,
  Keyboard,
  ArrowLeft,
  X,
  Split,
  Sparkle,
  SkipBack,
  SkipForward,
  Video,
  Square,
  Globe,
  Check,
  Zap,
  Magnet,
  AlertCircle,
  Camera,
  Image as ImageIcon,
  Save,
  HardDrive,
  Loader2,
  FileDown,
  Activity
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { processVideoEditor, processGifCreate, buildEditorFilterString } from '../lib/mediaProcessor';
import { memoryManager } from '../lib/memoryManager';
import { ExportSettingsModal, ExportConfig } from '../components/ExportSettingsModal';
import {
  saveProjectToDb,
  loadProjectFromDb,
  registerAssetBlob,
  exportProjectAsJson,
  RestoredProjectData
} from '../lib/projectStorage';
import {
  ProjectAsset,
  VideoEditorToolProps,
  LeftSidebarTab,
  InspectorMainTab,
  InspectorVideoSubTab,
  VideoTrackItem,
  AudioTrackItem,
  VideoClipItem,
  AudioClipItem,
  TextClipItem,
  ActiveTrimmingState,
  SnapGuide,
  StickerItem,
  VideoThumbnailData
} from './videoEditor/types';
import {
  formatCapCutTimecode,
  formatShortDuration,
  getClipSourceDuration,
  calculateMagneticSnap,
  clampTrimOffsetAndDuration,
  computeTrimDelta,
  computeTrimToPlayhead,
  playEditorSfx
} from './videoEditor/editorUtils';
import {
  STICKER_LIST,
  VOLUME_PRESET_BUTTONS,
  SPEED_PRESETS,
  BACKGROUND_PRESETS,
  ASPECT_RATIOS,
  FILTER_PRESETS,
  TRANSITION_PRESETS
} from './videoEditor/editorConstants';
import { VolumeControl } from './videoEditor/VolumeControl';
import { MasterAudioChannel } from './videoEditor/MasterAudioChannel';
import { TrimHandle } from './videoEditor/TrimHandle';
import {
  ExportProgressModal,
  ExportErrorModal,
  DownloadCompleteModal,
  KeyboardShortcutsModal
} from './videoEditor/EditorModals';
import { StickerOverlay } from './videoEditor/StickerOverlay';
import { StickersPanel } from './videoEditor/StickersPanel';
import { ThumbnailModal } from './videoEditor/ThumbnailModal';
import { SavedProjectsModal } from './videoEditor/SavedProjectsModal';
import { AudioWaveform } from './videoEditor/AudioWaveform';
import { EditorHeader } from './videoEditor/EditorHeader';
import { LeftSidebar } from './videoEditor/LeftSidebar';
import { InspectorPanel } from './videoEditor/InspectorPanel';
import { VideoPlayerMonitor } from './videoEditor/VideoPlayerMonitor';
import { AssetDrawer } from './videoEditor/AssetDrawer';
import { TimelineWorkspace } from './videoEditor/TimelineWorkspace';

export { formatCapCutTimecode, formatShortDuration };

export const VideoEditorTool: React.FC<VideoEditorToolProps> = ({
  video,
  initialVideos = [],
  initialProject,
  onReset,
  t,
  lang = 'en',
  onSelectVideo,
  onLanguageChange
}) => {
  const editorT = useMemo(() => getVideoEditorTranslation(lang), [lang]);
  const [showLangMenu, setShowLangMenu] = useState(false);

  // Navigation & Panels state
  const [leftNavTab, setLeftNavTab] = useState<LeftSidebarTab>('media');
  const [isAssetDrawerOpen, setIsAssetDrawerOpen] = useState(false);
  const [isMobileInspectorOpen, setIsMobileInspectorOpen] = useState(false);
  const [isMobileView, setIsMobileView] = useState(() => typeof window !== 'undefined' ? window.innerWidth < 768 : false);
  const [mobileActiveSheet, setMobileActiveSheet] = useState<LeftSidebarTab | 'inspector' | null>(null);

  useEffect(() => {
    const handleResize = () => {
      const isMob = window.innerWidth < 768;
      setIsMobileView(isMob);
      if (!isMob) {
        setMobileActiveSheet(null);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const [assetTab, setAssetTab] = useState<'project' | 'cloud'>('project');
  const [inspectorTab, setInspectorTab] = useState<InspectorMainTab>('video');
  const [videoSubTab, setVideoSubTab] = useState<InspectorVideoSubTab>('basic');
  const [isStudioFullScreen, setIsStudioFullScreen] = useState(false);

  // Project persistence state (IndexedDB)
  const currentProjectIdRef = useRef<string>(initialProject?.id || `proj_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'unsaved' | 'error'>('saved');
  const [lastSavedTime, setLastSavedTime] = useState<Date | null>(() => initialProject ? new Date(initialProject.updatedAt) : null);
  const [showProjectMenu, setShowProjectMenu] = useState(false);
  const [showProjectsModal, setShowProjectsModal] = useState(false);
  const isRestoringProjectRef = useRef(false);
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Project title
  const [projectName, setProjectName] = useState<string>(initialProject?.name || video?.name || 'Draft Project');

  // Video State
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasPreviewRef = useRef<HTMLCanvasElement>(null);
  const playerMonitorWrapperRef = useRef<HTMLDivElement>(null);
  const audioPreviewRef = useRef<HTMLAudioElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioFileInputRef = useRef<HTMLInputElement>(null);
  const timelineTracksRef = useRef<HTMLDivElement>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const currentTimeRef = useRef(0);
  currentTimeRef.current = currentTime;
  const isScrubbingRef = useRef(false);
  const isPlayingRef = useRef(false);
  const seekRafRef = useRef<number | null>(null);
  const [duration, setDuration] = useState(initialProject?.duration || video?.duration || 0);
  const [showGrid, setShowGrid] = useState(false);
  const [showOriginal, setShowOriginal] = useState(false);

  // Timeline State
  const [timelineZoom, setTimelineZoom] = useState(50); // 0 to 100
  const [isVideoAudioMuted, setIsVideoAudioMuted] = useState(false);
  const [isMusicAudioMuted, setIsMusicAudioMuted] = useState(false);
  const [snappingEnabled, setSnappingEnabled] = useState(true);
  const snappingEnabledRef = useRef(snappingEnabled);
  snappingEnabledRef.current = snappingEnabled;
  const [activeSnapLine, setActiveSnapLine] = useState<{ time: number; label?: string } | null>(null);
  const [activeTrimming, setActiveTrimming] = useState<{
    id: string;
    type: 'video' | 'audio' | 'text';
    edge: 'start' | 'end';
    currentDuration: number;
    maxDuration: number;
    isAtMaxLimit: boolean;
  } | null>(null);

  // Editor Settings (Zero tilt, 100% scale to fill frame, 100% opacity, centered)
  const [settings, setSettings] = useState<EditorSettings>(() => initialProject?.settings || ({
    startTime: 0,
    endTime: video?.duration ? Math.round(video.duration) : 60,
    speed: 1,
    aspectRatio: '16:9',
    fitMode: 'cover',
    bgColor: 'black',
    rotation: 0, // 0 deg - completely straight (not tilted)
    flipH: false,
    flipV: false,
    zoom: 1,
    scaleSize: 100, // 100% - completely fills frame
    positionX: 0,  // Centered
    positionY: 0,  // Centered
    opacity: 100,  // 100% full opacity (crisp and clear)
    brightness: 0,
    contrast: 5,
    saturation: 100,
    sepia: 0,
    grayscale: 0,
    invert: 0,
    blur: 0,
    vignette: false,
    filterPreset: 'normal',
    volume: 100,
    removeAudio: false,
    musicUrl: '',
    musicVolume: 100,
    removeMusic: false,
    textOverlay: {
      enabled: false,
      text: '',
      fontSize: 28,
      fontColor: '#FFFFFF',
      bgColor: 'dark',
      position: 'bottom'
    },
    outputFormat: 'mp4',
    quality: '1080p'
  }));

  // History stack for Undo / Redo
  const [history, setHistory] = useState<EditorSettings[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const historyIndexRef = useRef(-1);
  historyIndexRef.current = historyIndex;
  const isUndoingRef = useRef(false);
  const lastStateSnapshotRef = useRef<string>('');

  const pushSettingsChange = (newSettings: EditorSettings | ((prev: EditorSettings) => EditorSettings)) => {
    setSettings(prev => typeof newSettings === 'function' ? newSettings(prev) : newSettings);
  };

  const handleUndo = () => {
    if (historyIndex > 0) {
      isUndoingRef.current = true;
      const prevIdx = historyIndex - 1;
      historyIndexRef.current = prevIdx;
      setHistoryIndex(prevIdx);
      const snap = history[prevIdx];
      lastStateSnapshotRef.current = JSON.stringify(snap);
      setSettings(snap);
      if (snap.clips) setClips(snap.clips as any);
      if (snap.audioClips) setAudioClips(snap.audioClips as any);
      if (snap.textClips) setTextClips(snap.textClips as any);
      if (snap.stickers) setStickers(snap.stickers as any);
      if (snap.videoTracks) setVideoTracks(snap.videoTracks as any);
      if (snap.audioTracks) setAudioTracks(snap.audioTracks as any);
      setTimeout(() => { isUndoingRef.current = false; }, 100);
    }
  };

  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      isUndoingRef.current = true;
      const nextIdx = historyIndex + 1;
      historyIndexRef.current = nextIdx;
      setHistoryIndex(nextIdx);
      const snap = history[nextIdx];
      lastStateSnapshotRef.current = JSON.stringify(snap);
      setSettings(snap);
      if (snap.clips) setClips(snap.clips as any);
      if (snap.audioClips) setAudioClips(snap.audioClips as any);
      if (snap.textClips) setTextClips(snap.textClips as any);
      if (snap.stickers) setStickers(snap.stickers as any);
      if (snap.videoTracks) setVideoTracks(snap.videoTracks as any);
      if (snap.audioTracks) setAudioTracks(snap.audioTracks as any);
      setTimeout(() => { isUndoingRef.current = false; }, 100);
    }
  };

  // Overlay Stickers (Emojis & Custom Graphics)
  const [stickers, setStickers] = useState<StickerItem[]>(() => initialProject?.stickers || []);
  const stickersRef = useRef(stickers);
  useEffect(() => { stickersRef.current = stickers; }, [stickers]);
  const [selectedStickerId, setSelectedStickerId] = useState<string | null>(null);

  // Video Thumbnail / Cover State
  const [videoThumbnail, setVideoThumbnail] = useState<VideoThumbnailData | null>(null);
  const [showThumbnailModal, setShowThumbnailModal] = useState<boolean>(false);
  const [canvasDisplaySize, setCanvasDisplaySize] = useState<{ width: number; height: number }>({ width: 0, height: 0 });

  // Active Keyframe Visual FX
  const [activeEffect, setActiveEffect] = useState<string>('none');
  const [activeTransition, setActiveTransition] = useState<string>('none');

  // Background Audio tracks (User uploaded or selected)
  const [activeBgmName, setActiveBgmName] = useState<string>(initialProject?.activeBgmName || '');

  // Chroma key state for background removal
  const [chromaKey, setChromaKey] = useState(() => initialProject?.chromaKey || ({
    enabled: false,
    keyColor: '#00FF00',
    similarity: 40,
  }));
  const chromaCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [showShortcutsModal, setShowShortcutsModal] = useState(false);

  // Video Tracks in timeline
  const [videoTracks, setVideoTracks] = useState<VideoTrackItem[]>(() => {
    if (initialProject?.videoTracks && initialProject.videoTracks.length > 0) {
      return initialProject.videoTracks;
    }
    const list = initialVideos && initialVideos.length > 0 ? initialVideos : (video && video.url ? [video] : []);
    const vids = list.filter(v => !v.type?.startsWith('audio/'));
    if (vids.length > 0) {
      return vids.map((v, i) => ({
        id: `track-v-${i + 1}`,
        name: `Video ${i + 1}`,
        hidden: false,
        muted: false
      }));
    }
    return [{ id: 'track-v-1', name: 'Video 1', hidden: false, muted: false }];
  });
  const videoTracksRef = useRef(videoTracks);
  useEffect(() => { videoTracksRef.current = videoTracks; }, [videoTracks]);

  // Clips in timeline (Supports multiple clips across multiple videos and separate tracks)
  const [clips, setClips] = useState<VideoClipItem[]>(() => {
    if (initialProject?.clips && initialProject.clips.length > 0) {
      return initialProject.clips;
    }
    const list = initialVideos && initialVideos.length > 0 ? initialVideos : (video && video.url ? [video] : []);
    const vids = list.filter(v => !v.type?.startsWith('audio/'));
    if (vids.length > 0) {
      return vids.map((v, i) => {
        const dur = v.duration && !isNaN(v.duration) && v.duration > 0 ? Math.round(v.duration) : 60;
        return {
          id: `clip-${i + 1}`,
          trackId: `track-v-${i + 1}`,
          name: v.name,
          start: 0,
          end: dur,
          offset: 0,
          sourceDuration: dur,
          assetId: `asset-${i + 1}`,
          url: v.url || '',
          volume: 100,
          muted: false,
          speed: 1
        };
      });
    }
    return [];
  });
  const clipsRef = useRef(clips);
  useEffect(() => { clipsRef.current = clips; }, [clips]);
  const [selectedClipId, setSelectedClipId] = useState<string>('');

  // Audio tracks in timeline
  const [audioTracks, setAudioTracks] = useState<AudioTrackItem[]>(() => {
    if (initialProject?.audioTracks && initialProject.audioTracks.length > 0) {
      return initialProject.audioTracks;
    }
    const list = initialVideos && initialVideos.length > 0 ? initialVideos : (video && video.url ? [video] : []);
    const audios = list.filter(v => v.type?.startsWith('audio/') || /\.(mp3|wav|ogg|m4a|aac)$/i.test(v.name));
    if (audios.length > 0) {
      return audios.map((a, i) => ({
        id: `track-a-${i + 1}`,
        name: `Music ${i + 1}`,
        muted: false
      }));
    }
    return [{ id: 'track-a-1', name: 'Music 1', muted: false }];
  });
  const audioTracksRef = useRef(audioTracks);
  useEffect(() => { audioTracksRef.current = audioTracks; }, [audioTracks]);

  // Audio clips in timeline (Supports multiple audio files on separate tracks)
  const [audioClips, setAudioClips] = useState<AudioClipItem[]>(() => {
    if (initialProject?.audioClips && initialProject.audioClips.length > 0) {
      return initialProject.audioClips.map(a => ({
        volume: 100,
        muted: false,
        speed: 1,
        ...a
      }));
    }
    const list = initialVideos && initialVideos.length > 0 ? initialVideos : (video && video.url ? [video] : []);
    const audios = list.filter(v => v.type?.startsWith('audio/') || /\.(mp3|wav|ogg|m4a|aac)$/i.test(v.name));
    if (audios.length > 0) {
      return audios.map((a, i) => {
        const dur = a.duration && !isNaN(a.duration) && a.duration > 0 ? Math.round(a.duration) : 60;
        return {
          id: `audio-${i + 1}`,
          trackId: `track-a-${i + 1}`,
          name: a.name,
          url: a.url || '',
          start: 0,
          end: dur,
          offset: 0,
          sourceDuration: dur,
          volume: 100,
          muted: false,
          speed: 1
        };
      });
    }
    return [];
  });
  const audioClipsRef = useRef(audioClips);
  useEffect(() => { audioClipsRef.current = audioClips; }, [audioClips]);
  const [selectedAudioClipId, setSelectedAudioClipId] = useState<string | null>(null);
  const [audioInspectorMode, setAudioInspectorMode] = useState<'individual' | 'master'>('individual');

  // Text / Subtitle Clips in timeline
  const [textClips, setTextClips] = useState<TextClipItem[]>(() => initialProject?.textClips || []);
  const textClipsRef = useRef(textClips);
  useEffect(() => { textClipsRef.current = textClips; }, [textClips]);
  const [selectedTextClipId, setSelectedTextClipId] = useState<string | null>(null);

  // Debounced auto-commit for structural Undo/Redo tracking
  useEffect(() => {
    if (isUndoingRef.current) return;
    const timer = setTimeout(() => {
      const snap: EditorSettings = {
        ...settings,
        clips, audioClips, textClips, stickers, videoTracks, audioTracks
      };
      const str = JSON.stringify(snap);
      if (str !== lastStateSnapshotRef.current) {
        lastStateSnapshotRef.current = str;
        const curIdx = historyIndexRef.current;
        setHistory(h => {
          const sliced = h.slice(0, Math.max(0, curIdx + 1));
          return [...sliced, snap];
        });
        const nextIdx = Math.max(0, curIdx) + 1;
        historyIndexRef.current = nextIdx;
        setHistoryIndex(nextIdx);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [settings, clips, audioClips, textClips, stickers, videoTracks, audioTracks]);

  // Ripple Delete Mode (ON by default for seamless editing)
  const [rippleMode, setRippleMode] = useState<boolean>(true);

  // Audio Waveform Visualization Mode (ON by default)
  const [showAudioWaveforms, setShowAudioWaveforms] = useState<boolean>(true);

  // Transition Picker Popover State
  const [transitionPickerClipId, setTransitionPickerClipId] = useState<string | null>(null);

  // Multi-track audio elements pool for simultaneous playback
  const audioTrackElementsRef = useRef<Map<string, HTMLAudioElement>>(new Map());

  // Track control actions
  const toggleVideoTrackHide = (trackId: string) => {
    setVideoTracks(prev => prev.map(t => t.id === trackId ? { ...t, hidden: !t.hidden } : t));
  };

  const toggleVideoTrackMute = (trackId: string) => {
    setVideoTracks(prev => prev.map(t => t.id === trackId ? { ...t, muted: !t.muted } : t));
  };

  const toggleAudioTrackMute = (trackId: string) => {
    setAudioTracks(prev => prev.map(t => t.id === trackId ? { ...t, muted: !t.muted } : t));
  };

  const deleteVideoTrack = (trackId: string) => {
    setVideoTracks(prev => {
      const remaining = prev.filter(t => t.id !== trackId);
      return remaining.length > 0 ? remaining : [{ id: `track-v-${Date.now()}`, name: 'Video 1', hidden: false, muted: false }];
    });
    setClips(prev => prev.filter(c => c.trackId !== trackId));
  };

  const deleteAudioTrack = (trackId: string) => {
    setAudioTracks(prev => {
      const remaining = prev.filter(t => t.id !== trackId);
      return remaining.length > 0 ? remaining : [{ id: `track-a-${Date.now()}`, name: 'Music 1', muted: false }];
    });
    setAudioClips(prev => prev.filter(c => c.trackId !== trackId));
    const el = audioTrackElementsRef.current.get(trackId);
    if (el) {
      el.pause();
      audioTrackElementsRef.current.delete(trackId);
    }
  };

  // Helper functions for individual per-clip / per-audio updates
  const updateClip = (clipId: string, updates: Partial<VideoClipItem>) => {
    setClips(prev => {
      const next = prev.map(c => c.id === clipId ? { ...c, ...updates } : c);
      clipsRef.current = next;
      return next;
    });

    if (videoRef.current) {
      const curTime = currentTimeRef.current;
      const visibleTrackIds = new Set(videoTracksRef.current.filter(t => !t.hidden).map(t => t.id));
      const activeClip = clipsRef.current.find(c => (!c.trackId || visibleTrackIds.has(c.trackId)) && curTime >= c.start && curTime <= c.end) || clipsRef.current[0];
      if (activeClip && activeClip.id === clipId) {
        const clipTrack = videoTracksRef.current.find(t => t.id === activeClip.trackId);
        const clipVol = updates.volume !== undefined ? updates.volume : (activeClip.volume !== undefined ? activeClip.volume : 100);
        const isClipMuted = (updates.muted !== undefined ? updates.muted : activeClip.muted) || clipTrack?.muted || isVideoAudioMuted || settings.removeAudio;
        if (isClipMuted || clipVol === 0) {
          videoRef.current.muted = true;
          videoRef.current.volume = 0;
        } else {
          videoRef.current.muted = false;
          const masterVol = (settings.volume ?? 100) / 100;
          videoRef.current.volume = Math.max(0, Math.min(1, (clipVol / 100) * masterVol));
        }
      }
    }
  };

  const updateAudioClip = (audioId: string, updates: Partial<AudioClipItem>) => {
    setAudioClips(prev => {
      const next = prev.map(a => a.id === audioId ? { ...a, ...updates } : a);
      audioClipsRef.current = next;
      return next;
    });

    const clip = audioClipsRef.current.find(a => a.id === audioId);
    if (clip) {
      const clipVol = updates.volume !== undefined ? updates.volume : (clip.volume !== undefined ? clip.volume : 100);
      const trackId = clip.trackId || audioTracksRef.current[0]?.id;
      if (trackId) {
        const el = audioTrackElementsRef.current.get(trackId);
        if (el) {
          const track = audioTracksRef.current.find(t => t.id === trackId);
          const isMuted = (updates.muted !== undefined ? updates.muted : clip.muted) || track?.muted || isMusicAudioMuted || settings.removeMusic;
          if (isMuted || clipVol === 0) {
            el.muted = true;
            el.volume = 0;
          } else {
            el.muted = false;
            const masterMusicVol = (settings.musicVolume ?? 100) / 100;
            el.volume = Math.max(0, Math.min(1, (clipVol / 100) * masterMusicVol));
          }
        }
      }

      // Also sync single audio preview element if present
      const a = audioPreviewRef.current;
      if (a) {
        const isMuted = (updates.muted !== undefined ? updates.muted : clip.muted) || isMusicAudioMuted || settings.removeMusic;
        if (isMuted || clipVol === 0) {
          a.muted = true;
          a.volume = 0;
        } else {
          a.muted = false;
          const masterMusicVol = (settings.musicVolume ?? 100) / 100;
          a.volume = Math.max(0, Math.min(1, (clipVol / 100) * masterMusicVol));
        }
      }
    }
  };

  const addVideoTrack = () => {
    const newTrackId = `track-v-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    setVideoTracks(prev => [...prev, { id: newTrackId, name: `Video ${prev.length + 1}`, hidden: false, muted: false }]);
  };

  const addAudioTrack = () => {
    const newTrackId = `track-a-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    setAudioTracks(prev => [...prev, { id: newTrackId, name: `Music ${prev.length + 1}`, muted: false }]);
  };

  // Scroll sync between left track headers and right timeline lanes
  const leftHeadersScrollRef = useRef<HTMLDivElement>(null);
  const rightTracksScrollRef = useRef<HTMLDivElement>(null);

  const handleTracksScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (leftHeadersScrollRef.current) {
      leftHeadersScrollRef.current.scrollTop = e.currentTarget.scrollTop;
    }
  };

  // Audio sample preview in sidebar
  const [previewingAudioId, setPreviewingAudioId] = useState<string | null>(null);
  const audioSampleRef = useRef<HTMLAudioElement | null>(null);

  const togglePreviewAudio = (asset: ProjectAsset) => {
    if (previewingAudioId === asset.id) {
      if (audioSampleRef.current) {
        audioSampleRef.current.pause();
      }
      setPreviewingAudioId(null);
    } else {
      if (audioSampleRef.current) {
        audioSampleRef.current.pause();
      }
      const a = new Audio(asset.url);
      audioSampleRef.current = a;
      a.play().catch(() => { });
      setPreviewingAudioId(asset.id);
      a.onended = () => setPreviewingAudioId(null);
    }
  };

  useEffect(() => {
    return () => {
      if (audioSampleRef.current) {
        audioSampleRef.current.pause();
        audioSampleRef.current.src = '';
      }
      if (audioTrackElementsRef.current) {
        audioTrackElementsRef.current.forEach(el => {
          el.pause();
          el.src = '';
        });
        audioTrackElementsRef.current.clear();
      }
    };
  }, []);

  // Processing & Export State
  const [isProcessing, setIsProcessing] = useState(false);
  const [progressPercent, setProgressPercent] = useState(0);
  const [progressMsg, setProgressMsg] = useState('');
  const [exportError, setExportError] = useState<string | null>(null);
  const [editedResultUrl, setEditedResultUrl] = useState<string | null>(null);
  const [showExportModal, setShowExportModal] = useState(false);
  const [activeExportConfig, setActiveExportConfig] = useState<ExportConfig>(() => ({
    format: 'mp4',
    quality: '1080p',
    fps: 30,
    bitrateLevel: 'medium',
    fileName: video?.name?.replace(/\.[^.]+$/, '') || 'edited_video',
  }));

  // Project Media Library (supports multiple uploaded videos and audios)
  const [projectAssets, setProjectAssets] = useState<ProjectAsset[]>(() => {
    if (initialProject?.assets && initialProject.assets.length > 0) {
      return initialProject.assets;
    }
    const list = initialVideos && initialVideos.length > 0 ? initialVideos : (video && video.url ? [video] : []);
    if (list.length > 0) {
      return list.map((v, i) => {
        const isAudio = v.type?.startsWith('audio/') || /\.(mp3|wav|ogg|m4a|aac)$/i.test(v.name);
        const dur = v.duration && !isNaN(v.duration) && v.duration > 0 ? Math.round(v.duration) : 60;
        return {
          id: `asset-${i + 1}`,
          name: v.name,
          type: isAudio ? ('audio' as const) : ('video' as const),
          duration: dur,
          durationStr: formatShortDuration(dur),
          thumbnailUrl: v.url || '',
          url: v.url || '',
          isUploaded: true
        };
      });
    }
    return [];
  });
  
  const hasInitializedInitialVideosRef = useRef(Boolean(initialProject));
  const projectAssetsRef = useRef(projectAssets);
  useEffect(() => { projectAssetsRef.current = projectAssets; }, [projectAssets]);

  const [activeAssetId, setActiveAssetId] = useState<string>(() => {
    if (initialVideos && initialVideos.length > 0) return 'asset-1';
    if (video && video.url) return 'asset-1';
    return '';
  });

  // Active Music Helper (Seamlessly resolves audio track for playback and export)
  const activeMusicAsset = projectAssets.find(a => a.type === 'audio' && (a.name === activeBgmName || a.url === settings.musicUrl))
    || projectAssets.find(a => a.type === 'audio');
  const activeMusicUrl = activeMusicAsset?.url || settings.musicUrl || audioClips.find(a => a.url)?.url || '';

  // ACTUAL export duration: the span covered by visible video clips and
  // playable audio clips (exactly what the export engine renders) — used by
  // the export modal so Duration / Estimated Size match the real output.
  const exportTimelineSpan = useMemo(() => {
    const visibleTrackIds = new Set(videoTracks.filter(t => !t.hidden).map(t => t.id));
    const visClips = clips.filter(c => !c.trackId || visibleTrackIds.has(c.trackId));
    const audibleTrackIds = new Set(audioTracks.filter(t => !t.muted).map(t => t.id));
    const playAud = audioClips.filter(ac => ac.url && (!ac.trackId || audibleTrackIds.has(ac.trackId)));
    if (visClips.length === 0 && playAud.length === 0) {
      return Math.max(1, settings.endTime || duration || 1);
    }
    let start = Infinity;
    let end = -Infinity;
    if (visClips.length > 0) {
      start = Math.min(start, ...visClips.map(c => c.start));
      end = Math.max(end, ...visClips.map(c => c.end));
    }
    if (playAud.length > 0) {
      start = Math.min(start, ...playAud.map(c => c.start));
      end = Math.max(end, ...playAud.map(c => c.end));
    }
    if (!Number.isFinite(start) || !Number.isFinite(end)) {
      return Math.max(1, duration || 1);
    }
    return Math.max(0.2, end - start);
  }, [clips, audioClips, videoTracks, settings.endTime, duration]);

  // Sync initialProject media blobs into in-memory cache
  useEffect(() => {
    if (initialProject?.assetBlobs) {
      initialProject.assetBlobs.forEach((blob, assetId) => {
        registerAssetBlob(assetId, blob);
      });
    }
  }, [initialProject]);

  // Update active asset if initialVideos or video prop changes
  useEffect(() => {
    if (hasInitializedInitialVideosRef.current) return;
    const list = initialVideos && initialVideos.length > 0 ? initialVideos : (video && video.url ? [video] : []);
    if (list.length > 0) {
      hasInitializedInitialVideosRef.current = true;
      list.forEach((v, i) => {
        if (v.file) {
          registerAssetBlob(`asset-${i + 1}`, v.file);
        }
      });
      const videoItems = list.filter(v => !v.type?.startsWith('audio/'));
      const audioItems = list.filter(v => v.type?.startsWith('audio/') || /\.(mp3|wav|ogg|m4a|aac)$/i.test(v.name));

      setProjectAssets(list.map((v, i) => {
        const isAudio = v.type?.startsWith('audio/') || /\.(mp3|wav|ogg|m4a|aac)$/i.test(v.name);
        const dur = v.duration && !isNaN(v.duration) && v.duration > 0 ? Math.round(v.duration) : 60;
        return {
          id: `asset-${i + 1}`,
          name: v.name,
          type: isAudio ? 'audio' : 'video',
          duration: dur,
          durationStr: formatShortDuration(dur),
          thumbnailUrl: v.url || '',
          url: v.url || '',
          isUploaded: true
        };
      }));

      let maxVidDur = 60;
      if (videoItems.length > 0) {
        const vTracks: VideoTrackItem[] = videoItems.map((v, i) => ({
          id: `track-v-${i + 1}`,
          name: `Video ${i + 1}`,
          hidden: false,
          muted: false
        }));
        setVideoTracks(vTracks);

        const initialClips: VideoClipItem[] = videoItems.map((v, i) => {
          const dur = v.duration && !isNaN(v.duration) && v.duration > 0 ? Math.round(v.duration) : 60;
          if (dur > maxVidDur) maxVidDur = dur;
          return {
            id: `clip-${i + 1}`,
            trackId: `track-v-${i + 1}`,
            name: v.name,
            start: 0,
            end: dur,
            offset: 0,
            sourceDuration: dur,
            assetId: `asset-${i + 1}`,
            url: v.url || ''
          };
        });
        setClips(initialClips);
        setSelectedClipId(initialClips[0].id);
        setActiveAssetId('asset-1');
        setProjectName(videoItems[0].name);
      }

      let maxAudDur = 0;
      if (audioItems.length > 0) {
        const aTracks: AudioTrackItem[] = audioItems.map((a, i) => ({
          id: `track-a-${i + 1}`,
          name: `Music ${i + 1}`,
          muted: false
        }));
        setAudioTracks(aTracks);

        const initialAudioClips: AudioClipItem[] = audioItems.map((a, i) => {
          const dur = a.duration && !isNaN(a.duration) && a.duration > 0 ? Math.round(a.duration) : 60;
          if (dur > maxAudDur) maxAudDur = dur;
          return {
            id: `audio-${i + 1}`,
            trackId: `track-a-${i + 1}`,
            name: a.name,
            url: a.url || '',
            start: 0,
            end: dur,
            offset: 0,
            sourceDuration: dur,
            volume: 100,
            muted: false,
            speed: 1
          };
        });
        setAudioClips(initialAudioClips);
        if (videoItems.length === 0) {
          setSelectedAudioClipId(initialAudioClips[0].id);
        } else {
          setSelectedAudioClipId(null);
        }
        setActiveBgmName(audioItems[0].name);
      }
      setDuration(Math.max(60, maxVidDur, maxAudDur));
    }
  }, [initialVideos, video]);

  // Handle active video element duration
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;

    const handleLoadedMetadata = () => {
      const dur = v.duration && !isNaN(v.duration) && v.duration > 0 ? v.duration : 83;
      setDuration(prev => Math.max(prev, dur));
      setSettings(prev => ({
        ...prev,
        endTime: Math.max(prev.endTime, dur)
      }));
    };

    v.addEventListener('loadedmetadata', handleLoadedMetadata);
    if (v.duration) handleLoadedMetadata();

    return () => {
      v.removeEventListener('loadedmetadata', handleLoadedMetadata);
    };
  }, [video?.url, activeAssetId]);

  // Auto-save debounced effect to IndexedDB
  useEffect(() => {
    if (isRestoringProjectRef.current) return;
    if (!currentProjectIdRef.current) return;

    setSaveStatus('unsaved');
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);

    autoSaveTimerRef.current = setTimeout(async () => {
      try {
        setSaveStatus('saving');
        const pId = currentProjectIdRef.current;
        await saveProjectToDb({
          id: pId,
          name: projectName || 'Untitled Project',
          createdAt: Date.now(),
          updatedAt: Date.now(),
          duration: duration || 60,
          aspectRatio: settings.aspectRatio || '16:9',
          settings,
          clips,
          audioClips,
          textClips,
          stickers,
          videoTracks,
          audioTracks,
          chromaKey,
          activeAssetId: projectAssets[0]?.id,
          activeBgmName,
          assets: projectAssets
        });
        setSaveStatus('saved');
        setLastSavedTime(new Date());
      } catch (err) {
        console.warn('[AutoSave] failed:', err);
        setSaveStatus('error');
      }
    }, 1500);

    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    };
  }, [
    projectName, duration, settings, clips, audioClips, textClips,
    stickers, videoTracks, audioTracks, chromaKey, activeBgmName, projectAssets
  ]);

  // Manual save handler
  const handleManualSave = async () => {
    try {
      setSaveStatus('saving');
      const pId = currentProjectIdRef.current;
      await saveProjectToDb({
        id: pId,
        name: projectName || 'Untitled Project',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        duration: duration || 60,
        aspectRatio: settings.aspectRatio || '16:9',
        settings,
        clips,
        audioClips,
        textClips,
        stickers,
        videoTracks,
        audioTracks,
        chromaKey,
        activeAssetId: projectAssets[0]?.id,
        activeBgmName,
        assets: projectAssets
      });
      setSaveStatus('saved');
      setLastSavedTime(new Date());
    } catch (err) {
      console.error('Manual save failed:', err);
      setSaveStatus('error');
    }
  };

  // Keyboard shortcut Ctrl+S / Cmd+S
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        handleManualSave();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [projectName, duration, settings, clips, audioClips, textClips, stickers, videoTracks, audioTracks, chromaKey, activeBgmName, projectAssets]);

  // Load project from IndexedDB handler
  const handleLoadProject = async (projectId: string) => {
    try {
      setSaveStatus('saving');
      isRestoringProjectRef.current = true;
      const proj = await loadProjectFromDb(projectId);
      if (!proj) return;

      currentProjectIdRef.current = proj.id;
      setProjectName(proj.name);
      setDuration(proj.duration);
      setSettings(proj.settings);
      setClips(proj.clips || []);
      setAudioClips(proj.audioClips || []);
      setTextClips(proj.textClips || []);
      setStickers(proj.stickers || []);
      setVideoTracks(proj.videoTracks || [{ id: 'track-v-1', name: 'Video 1', hidden: false, muted: false }]);
      setAudioTracks(proj.audioTracks || [{ id: 'track-a-1', name: 'Music 1', muted: false }]);
      if (proj.chromaKey) setChromaKey(proj.chromaKey);
      setProjectAssets(proj.assets || []);
      if (proj.assetBlobs) {
        proj.assetBlobs.forEach((blob, aId) => {
          registerAssetBlob(aId, blob);
        });
      }
      setSaveStatus('saved');
      setLastSavedTime(new Date());
      setTimeout(() => {
        isRestoringProjectRef.current = false;
      }, 500);
    } catch (err) {
      console.error('Failed to load project:', err);
      setSaveStatus('error');
      isRestoringProjectRef.current = false;
    }
  };

  // New blank project handler
  const handleNewBlankProject = () => {
    isRestoringProjectRef.current = true;
    currentProjectIdRef.current = `proj_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    setProjectName('New Project');
    setDuration(60);
    setClips([]);
    setAudioClips([]);
    setTextClips([]);
    setStickers([]);
    setVideoTracks([{ id: 'track-v-1', name: 'Video 1', hidden: false, muted: false }]);
    setAudioTracks([{ id: 'track-a-1', name: 'Music 1', muted: false }]);
    setProjectAssets([]);
    setSaveStatus('saved');
    setLastSavedTime(new Date());
    setTimeout(() => {
      isRestoringProjectRef.current = false;
    }, 400);
  };

  // Export project as .dcproj file
  const handleExportProjectFile = async () => {
    try {
      await handleManualSave();
      const jsonStr = await exportProjectAsJson(currentProjectIdRef.current);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${projectName.replace(/\.[^.]+$/, '') || 'project'}.dcproj`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to export project file:', err);
    }
  };

  // Monitor Canvas Display Size for Interactive Overlays (Stickers, Snapping)
  useEffect(() => {
    const canvas = canvasPreviewRef.current;
    if (!canvas) return;

    const updateDisplaySize = () => {
      const rect = canvas.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        setCanvasDisplaySize({
          width: Math.round(rect.width),
          height: Math.round(rect.height),
        });
      }
    };

    updateDisplaySize();

    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(updateDisplaySize);
      ro.observe(canvas);
    }
    window.addEventListener('resize', updateDisplaySize);

    return () => {
      if (ro) ro.disconnect();
      window.removeEventListener('resize', updateDisplaySize);
    };
  }, [settings.aspectRatio, clips.length]);

  // Capture current preview frame for Video Thumbnail
  const handleCaptureCanvasFrame = useCallback((): string | null => {
    const canvas = canvasPreviewRef.current;
    if (!canvas) return null;
    try {
      const offscreen = document.createElement('canvas');
      offscreen.width = canvas.width;
      offscreen.height = canvas.height;
      const oCtx = offscreen.getContext('2d');
      if (!oCtx) return canvas.toDataURL('image/png', 0.95);

      // Draw base video frame
      oCtx.drawImage(canvas, 0, 0);

      // Render stickers on top if any
      const curStickers = stickersRef.current;
      if (curStickers.length > 0) {
        const curTime = currentTimeRef.current;
        curStickers.forEach((st) => {
          const isVisible = (st.startTime === undefined || st.endTime === undefined) ||
            (curTime >= st.startTime && curTime <= st.endTime);
          if (!isVisible) return;

          const posX = (st.x / 100) * offscreen.width;
          const posY = (st.y / 100) * offscreen.height;
          const size = 48 * st.scale * (offscreen.width / 960);

          oCtx.save();
          oCtx.translate(posX, posY);
          if (st.rotation) oCtx.rotate((st.rotation * Math.PI) / 180);
          if (st.opacity !== undefined) oCtx.globalAlpha = st.opacity;

          if (st.imageUrl) {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.src = st.imageUrl;
            if (img.complete && img.naturalWidth > 0) {
              const aspect = img.naturalWidth / img.naturalHeight;
              oCtx.drawImage(img, (-size * aspect) / 2, -size / 2, size * aspect, size);
            }
          } else {
            oCtx.font = `${size}px sans-serif`;
            oCtx.textAlign = 'center';
            oCtx.textBaseline = 'middle';
            oCtx.fillText(st.emoji, 0, 0);
          }
          oCtx.restore();
        });
      }

      return offscreen.toDataURL('image/png', 0.95);
    } catch (err) {
      console.error('Failed to capture canvas frame:', err);
      return null;
    }
  }, []);

  // Live Canvas Rendering Loop (Includes CapCut Position X, Y, Scale Size, Blend Opacity, Rotation)
  useEffect(() => {
    let animId: number;

    const renderPreviewFrame = () => {
      const v = videoRef.current;
      const c = canvasPreviewRef.current;
      if (!c) {
        animId = requestAnimationFrame(renderPreviewFrame);
        return;
      }

      const ctx = c.getContext('2d');
      if (!ctx) {
        animId = requestAnimationFrame(renderPreviewFrame);
        return;
      }

      const curTime = currentTimeRef.current;

      // Determine canvas aspect ratio
      let targetRatio = 16 / 9;
      if (settings.aspectRatio === '9:16') targetRatio = 9 / 16;
      else if (settings.aspectRatio === '1:1') targetRatio = 1;
      else if (settings.aspectRatio === '4:5') targetRatio = 4 / 5;
      else if (settings.aspectRatio === '21:9') targetRatio = 21 / 9;

      const canvasW = 960;
      const canvasH = Math.round(canvasW / targetRatio);

      if (c.width !== canvasW || c.height !== canvasH) {
        c.width = canvasW;
        c.height = canvasH;
      }

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';

      // 1. Background Fill
      if (settings.bgColor === 'white') {
        ctx.fillStyle = '#ffffff';
      } else if (settings.bgColor === 'emerald') {
        ctx.fillStyle = '#064e3b';
      } else if (settings.bgColor === 'navy') {
        ctx.fillStyle = '#0f172a';
      } else {
        ctx.fillStyle = '#0f1115';
      }
      ctx.fillRect(0, 0, canvasW, canvasH);

      const visibleTrackIds = new Set(videoTracksRef.current.filter(t => !t.hidden).map(t => t.id));
      const isPlayheadOverClip = clipsRef.current ? clipsRef.current.some(c => (!c.trackId || visibleTrackIds.has(c.trackId)) && curTime >= c.start && curTime <= c.end) : false;
      const hasValidVideo = v && v.readyState >= 2 && isPlayheadOverClip;

      if (showOriginal && hasValidVideo) {
        ctx.filter = 'none';
        ctx.drawImage(v, 0, 0, canvasW, canvasH);
      } else {
        // Blur background or dark
        if (hasValidVideo && settings.bgColor === 'blur') {
          ctx.save();
          ctx.filter = 'blur(24px) brightness(0.5)';
          ctx.drawImage(v, -30, -30, canvasW + 60, canvasH + 60);
          ctx.restore();
        }

        let activeClipTransType: string | undefined = undefined;
        let activeClipTransProgress = 1;

        // Draw Video or Synthetic Scenery if no video source loaded yet
        ctx.save();

        // Position & Size & Opacity
          const scaleVal = (settings.scaleSize !== undefined ? settings.scaleSize / 100 : 1);
          const posX = settings.positionX || 0;
          const posY = settings.positionY || 0;
          const opacityVal = settings.opacity !== undefined ? Math.max(0, Math.min(1, settings.opacity / 100)) : 1;

          ctx.globalAlpha = opacityVal;
          ctx.translate((canvasW / 2) + posX, (canvasH / 2) + posY);

          if (settings.rotation) {
            ctx.rotate((settings.rotation * Math.PI) / 180);
          }

          const scaleX = (settings.flipH ? -1 : 1) * (settings.zoom || 1) * scaleVal;
          const scaleY = (settings.flipV ? -1 : 1) * (settings.zoom || 1) * scaleVal;
          ctx.scale(scaleX, scaleY);

          // Combined filter string
          let filterStr = buildEditorFilterString(settings);
          if (activeEffect === 'invert') filterStr += ' invert(1)';
          if (activeEffect === 'glow') filterStr += ' brightness(1.3) contrast(1.2)';

          const activeClip = (clipsRef.current || []).find(c => (!c.trackId || visibleTrackIds.has(c.trackId)) && curTime >= c.start && curTime <= c.end);

          if (activeClip) {
            // Feature 4: Per-clip color grading & filters
            if (activeClip.brightness) {
              filterStr += ` brightness(${1 + activeClip.brightness / 100})`;
            }
            if (activeClip.contrast) {
              filterStr += ` contrast(${1 + activeClip.contrast / 100})`;
            }
            if (activeClip.saturation) {
              filterStr += ` saturate(${1 + activeClip.saturation / 100})`;
            }
            if (activeClip.filterPreset && activeClip.filterPreset !== 'normal') {
              if (activeClip.filterPreset === 'cinematic') filterStr += ' contrast(1.18) brightness(0.95) saturate(1.1)';
              else if (activeClip.filterPreset === 'vintage') filterStr += ' sepia(0.4) contrast(0.92) brightness(0.95)';
              else if (activeClip.filterPreset === 'cyberpunk') filterStr += ' hue-rotate(180deg) saturate(1.45) contrast(1.2)';
              else if (activeClip.filterPreset === 'noir') filterStr += ' grayscale(1) contrast(1.3)';
              else if (activeClip.filterPreset === 'vivid') filterStr += ' saturate(1.6) contrast(1.1)';
              else if (activeClip.filterPreset === 'warm') filterStr += ' sepia(0.2) saturate(1.3) brightness(1.05)';
              else if (activeClip.filterPreset === 'cool') filterStr += ' hue-rotate(20deg) saturate(1.1) brightness(0.95)';
              else if (activeClip.filterPreset === 'sepia') filterStr += ' sepia(0.85) contrast(1.1)';
            }

            // Feature 1: Transitions (Dissolve, Fade to Black, Zoom In, Slide Left, Wipe)
            const transType = activeClip.transitionIn || activeTransition;
            if (transType && transType !== 'none') {
              const transDur = activeClip.transitionDuration || 0.8;
              const timeInClip = curTime - activeClip.start;
              if (timeInClip >= 0 && timeInClip < transDur) {
                activeClipTransType = transType;
                activeClipTransProgress = timeInClip / transDur;
                if (transType === 'dissolve') {
                  ctx.globalAlpha = opacityVal * Math.max(0.05, Math.min(1, activeClipTransProgress));
                } else if (transType === 'zoom_in') {
                  const extraZoom = 1 + (1 - activeClipTransProgress) * 0.4;
                  ctx.scale(extraZoom, extraZoom);
                } else if (transType === 'slide_left') {
                  ctx.translate((1 - activeClipTransProgress) * (canvasW * 0.6), 0);
                }
              }
            }
          }
          ctx.filter = filterStr;

          if (hasValidVideo) {
            const origW = v.videoWidth || 640;
            const origH = v.videoHeight || 360;
            const videoRatio = origW / origH;
            let drawW = canvasW;
            let drawH = canvasH;

            if (settings.fitMode === 'cover') {
              if (targetRatio > videoRatio) {
                drawW = canvasW;
                drawH = canvasW / videoRatio;
              } else {
                drawH = canvasH;
                drawW = canvasH * videoRatio;
              }
            } else {
              if (targetRatio > videoRatio) {
                drawH = canvasH;
                drawW = canvasH * videoRatio;
              } else {
                drawW = canvasW;
                drawH = canvasW / videoRatio;
              }
            }

            if (chromaKey.enabled) {
              if (!chromaCanvasRef.current) {
                chromaCanvasRef.current = document.createElement('canvas');
              }
              const occ = chromaCanvasRef.current;
              const occW = Math.max(1, Math.round(drawW));
              const occH = Math.max(1, Math.round(drawH));
              if (occ.width !== occW || occ.height !== occH) {
                occ.width = occW;
                occ.height = occH;
              }
              const octx = occ.getContext('2d');
              if (octx) {
                octx.drawImage(v, 0, 0, occW, occH);
                try {
                  const imgData = octx.getImageData(0, 0, occW, occH);
                  const data = imgData.data;
                  const hex = chromaKey.keyColor.replace('#', '');
                  const tr = parseInt(hex.substring(0, 2) || '0', 16);
                  const tg = parseInt(hex.substring(2, 4) || '255', 16);
                  const tb = parseInt(hex.substring(4, 6) || '0', 16);
                  const threshold = (chromaKey.similarity / 100) * 440;
                  for (let i = 0; i < data.length; i += 4) {
                    const dist = Math.hypot(data[i] - tr, data[i + 1] - tg, data[i + 2] - tb);
                    if (dist < threshold) {
                      const edge = dist / threshold;
                      data[i + 3] = edge < 0.7 ? 0 : Math.round(((edge - 0.7) / 0.3) * data[i + 3]);
                    }
                  }
                  octx.putImageData(imgData, 0, 0);
                  ctx.drawImage(occ, -drawW / 2, -drawH / 2, drawW, drawH);
                } catch {
                  ctx.drawImage(v, -drawW / 2, -drawH / 2, drawW, drawH);
                }
              } else {
                ctx.drawImage(v, -drawW / 2, -drawH / 2, drawW, drawH);
              }
            } else {
              ctx.drawImage(v, -drawW / 2, -drawH / 2, drawW, drawH);
            }
          } else {
            // Clean empty studio workspace (No demo video playback)
            ctx.fillStyle = '#0f1117';
            ctx.fillRect(-canvasW / 2, -canvasH / 2, canvasW, canvasH);

            // Subtle studio grid pattern
            ctx.strokeStyle = '#1a1e2a';
            ctx.lineWidth = 1;
            const gridSpacing = 40;
            ctx.beginPath();
            for (let x = -canvasW / 2; x <= canvasW / 2; x += gridSpacing) {
              ctx.moveTo(x, -canvasH / 2);
              ctx.lineTo(x, canvasH / 2);
            }
            for (let y = -canvasH / 2; y <= canvasH / 2; y += gridSpacing) {
              ctx.moveTo(-canvasW / 2, y);
              ctx.lineTo(canvasW / 2, y);
            }
            ctx.stroke();
          }

          ctx.restore();

        // 2. Vignette Dark Corners
        if (settings.vignette || activeEffect === 'vignette') {
          ctx.save();
          const radialGrad = ctx.createRadialGradient(
            canvasW / 2, canvasH / 2, Math.min(canvasW, canvasH) * 0.3,
            canvasW / 2, canvasH / 2, Math.max(canvasW, canvasH) * 0.7
          );
          radialGrad.addColorStop(0, 'rgba(0, 0, 0, 0)');
          radialGrad.addColorStop(1, 'rgba(0, 0, 0, 0.75)');
          ctx.fillStyle = radialGrad;
          ctx.fillRect(0, 0, canvasW, canvasH);
          ctx.restore();
        }

        // 3. VHS Scanlines Effect
        if (activeEffect === 'vhs') {
          ctx.save();
          ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
          for (let y = 0; y < canvasH; y += 4) {
            ctx.fillRect(0, y, canvasW, 1.5);
          }
          ctx.fillStyle = 'rgba(0, 255, 128, 0.03)';
          ctx.fillRect(0, (curTime * 60) % canvasH, canvasW, 6);
          ctx.restore();
        }

        // 4. Glitch Effect
        if (activeEffect === 'glitch') {
          ctx.save();
          if (Math.sin(curTime * 10) > 0.5) {
            ctx.fillStyle = 'rgba(255, 0, 100, 0.15)';
            ctx.fillRect(10, 0, canvasW - 20, canvasH);
          }
          ctx.restore();
        }

        // 5. Draw Overlay Stickers (Emojis)
        if (stickers.length > 0) {
          ctx.save();
          stickers.forEach(st => {
            const posX = (st.x / 100) * canvasW;
            const posY = (st.y / 100) * canvasH;
            const size = 48 * st.scale;
            ctx.font = `${size}px sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(st.emoji, posX, posY);
          });
          ctx.restore();
        }

        // 6. Draw Text Overlay
        if (settings.textOverlay?.enabled && settings.textOverlay.text.trim()) {
          const textInfo = settings.textOverlay;
          ctx.save();
          const fontSizePx = Math.max(18, Math.round((textInfo.fontSize || 32) * (canvasW / 1280)));
          ctx.font = `bold ${fontSizePx}px 'Plus Jakarta Sans', system-ui, sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';

          const metrics = ctx.measureText(textInfo.text);
          const textWidth = metrics.width;
          const boxPadH = fontSizePx * 0.6;
          const boxPadV = fontSizePx * 0.35;
          const boxW = textWidth + boxPadH * 2;
          const boxH = fontSizePx + boxPadV * 2;

          let boxY = canvasH * 0.5 - boxH / 2;
          if (textInfo.position === 'top') {
            boxY = canvasH * 0.12;
          } else if (textInfo.position === 'bottom') {
            boxY = canvasH * 0.85 - boxH;
          }
          const boxX = (canvasW - boxW) / 2;

          if (textInfo.bgColor !== 'transparent') {
            if (textInfo.bgColor === 'emerald') ctx.fillStyle = 'rgba(5, 150, 105, 0.9)';
            else if (textInfo.bgColor === 'white') ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
            else if (textInfo.bgColor === 'rose') ctx.fillStyle = 'rgba(225, 29, 72, 0.9)';
            else ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';

            const radius = Math.round(boxH * 0.35);
            ctx.beginPath();
            if ((ctx as any).roundRect) {
              (ctx as any).roundRect(boxX, boxY, boxW, boxH, radius);
            } else {
              ctx.rect(boxX, boxY, boxW, boxH);
            }
            ctx.fill();
          }

          ctx.fillStyle = textInfo.fontColor || '#FFFFFF';
          ctx.fillText(textInfo.text, canvasW / 2, boxY + boxH / 2);
          ctx.restore();
        }

        // 6b. Draw Timeline Text / Subtitle Clips (Multiple animated subtitles over time)
        const activeTextClips = (textClipsRef.current || []).filter(t => curTime >= t.start && curTime <= t.end);
        if (activeTextClips.length > 0) {
          activeTextClips.forEach(tClip => {
            if (!tClip.text.trim()) return;
            ctx.save();
            const fontSizePx = Math.max(16, Math.round((tClip.fontSize || 32) * (canvasW / 1280)));
            ctx.font = `bold ${fontSizePx}px 'Plus Jakarta Sans', system-ui, sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';

            const metrics = ctx.measureText(tClip.text);
            const textWidth = metrics.width;
            const boxPadH = fontSizePx * 0.55;
            const boxPadV = fontSizePx * 0.32;
            const boxW = textWidth + boxPadH * 2;
            const boxH = fontSizePx + boxPadV * 2;

            let boxY = canvasH * 0.5 - boxH / 2;
            if (tClip.position === 'top') {
              boxY = canvasH * 0.12;
            } else if (tClip.position === 'bottom') {
              boxY = canvasH * 0.85 - boxH;
            }
            const boxX = (canvasW - boxW) / 2;

            const bg = tClip.bgColor || 'dark';
            if (bg !== 'transparent') {
              if (bg === 'emerald') ctx.fillStyle = 'rgba(5, 150, 105, 0.92)';
              else if (bg === 'white') ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
              else if (bg === 'rose') ctx.fillStyle = 'rgba(225, 29, 72, 0.92)';
              else ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';

              const radius = Math.round(boxH * 0.35);
              ctx.beginPath();
              if ((ctx as any).roundRect) {
                (ctx as any).roundRect(boxX, boxY, boxW, boxH, radius);
              } else {
                ctx.rect(boxX, boxY, boxW, boxH);
              }
              ctx.fill();
            }

            ctx.fillStyle = tClip.fontColor || (bg === 'white' ? '#0f172a' : '#FFFFFF');
            ctx.fillText(tClip.text, canvasW / 2, boxY + boxH / 2);
            ctx.restore();
          });
        }

        // 6c. Transition Fade-to-Black Overlay
        if (activeClipTransType === 'fade_black' && activeClipTransProgress < 1) {
          ctx.save();
          const blackAlpha = 1 - Math.sin(activeClipTransProgress * (Math.PI / 2));
          ctx.fillStyle = `rgba(0, 0, 0, ${Math.max(0, Math.min(1, blackAlpha))})`;
          ctx.fillRect(0, 0, canvasW, canvasH);
          ctx.restore();
        }

        // 7. 3x3 Grid Overlay
        if (showGrid) {
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
          ctx.lineWidth = 1;
          ctx.setLineDash([4, 4]);
          ctx.beginPath();
          ctx.moveTo(canvasW / 3, 0);
          ctx.lineTo(canvasW / 3, canvasH);
          ctx.moveTo((canvasW * 2) / 3, 0);
          ctx.lineTo((canvasW * 2) / 3, canvasH);
          ctx.moveTo(0, canvasH / 3);
          ctx.lineTo(canvasW, canvasH / 3);
          ctx.moveTo(0, (canvasH * 2) / 3);
          ctx.lineTo(canvasW, (canvasH * 2) / 3);
          ctx.stroke();
          ctx.setLineDash([]);
        }
      }

      animId = requestAnimationFrame(renderPreviewFrame);
    };

    animId = requestAnimationFrame(renderPreviewFrame);
    return () => cancelAnimationFrame(animId);
  }, [settings, showOriginal, showGrid, activeAssetId, activeEffect, stickers, chromaKey]);
  // Play / Pause toggle — Timeline is single source of truth
  // We never call v.play() or a.play() here.
  // The tick engine handles syncing video/audio to the timeline.
  const togglePlay = () => {
    const totalDur = Math.max(1, duration || 83);
    if (isPlaying) {
      // Pause: stop video and audio elements
      isPlayingRef.current = false;
      const v = videoRef.current;
      const a = audioPreviewRef.current;
      if (v && !v.paused) v.pause();
      if (a && !a.paused) a.pause();
      audioTrackElementsRef.current.forEach(el => {
        if (!el.paused) el.pause();
      });
      setIsPlaying(false);
    } else {
      // Play: if at end, rewind timeline to 0
      if (currentTimeRef.current >= totalDur) {
        currentTimeRef.current = 0;
        setCurrentTime(0);
        // Seek video to start of the clip that covers time=0, or the first clip's offset
        const v = videoRef.current;
        if (v) {
          const visibleTrackIds = new Set(videoTracksRef.current.filter(t => !t.hidden).map(t => t.id));
          const startClip = clipsRef.current.find(c => (!c.trackId || visibleTrackIds.has(c.trackId)) && c.start === 0)
            || clipsRef.current[0];
          v.currentTime = startClip ? (startClip.offset || 0) : 0;
        }
        const a = audioPreviewRef.current;
        if (a) a.currentTime = 0;
        audioTrackElementsRef.current.forEach(el => {
          el.currentTime = 0;
        });
      }
      isPlayingRef.current = true;
      setIsPlaying(true);
    }
  };

  // High-Precision 60 FPS Playhead & Playback Engine (Eliminates lag and jerky playhead needle)
  useEffect(() => {
    if (!isPlaying) return;

    let animId: number;
    let lastTime = performance.now();

    const tick = (now: number) => {
      const v = videoRef.current;
      const a = audioPreviewRef.current;
      const totalDur = Math.max(1, duration || 83);
      const deltaSec = ((now - lastTime) / 1000) * (settings.speed || 1);
      lastTime = now;

      // Advance currentTime by delta
      const prev = currentTimeRef.current;
      const next = prev + deltaSec;

      if (next >= totalDur) {
        // Reached end — stop
        currentTimeRef.current = 0;
        setCurrentTime(0);
        setIsPlaying(false);
        if (v && !v.paused) v.pause();
        if (a && !a.paused) a.pause();
        audioTrackElementsRef.current.forEach(el => {
          if (!el.paused) el.pause();
        });
        return;
      }

      currentTimeRef.current = next;
      setCurrentTime(next);

      // --- Sync Video to Timeline (multi-track aware) ---
      if (v && clipsRef.current.length > 0) {
        const visibleTrackIds = new Set(videoTracksRef.current.filter(t => !t.hidden).map(t => t.id));
        let activeClip = clipsRef.current.find(c => c.id === selectedClipId && (!c.trackId || visibleTrackIds.has(c.trackId)) && next >= c.start && next <= c.end);
        if (!activeClip) {
          activeClip = clipsRef.current.find(c => (!c.trackId || visibleTrackIds.has(c.trackId)) && next >= c.start && next <= c.end);
        }
        if (activeClip) {
          const clipTrack = videoTracksRef.current.find(t => t.id === activeClip!.trackId);
          const clipVol = activeClip.volume !== undefined ? activeClip.volume : 100;
          const isClipMuted = activeClip.muted || clipTrack?.muted || isVideoAudioMuted || settings.removeAudio;
          if (isClipMuted || clipVol === 0) {
            v.muted = true;
          } else {
            v.muted = false;
            const masterVol = (settings.volume ?? 100) / 100;
            v.volume = Math.max(0, Math.min(1, (clipVol / 100) * masterVol));
          }
          const clipUrl = (activeClip as any).url || projectAssetsRef.current.find(p => p.id === (activeClip as any).assetId || p.name === activeClip!.name)?.url;
          if (clipUrl && v.src !== clipUrl) {
            v.src = clipUrl;
          }
          const expectedMediaTime = Math.max(0, (activeClip.offset || 0) + (next - activeClip.start) * (activeClip.speed || 1));
          if (v.paused) v.play().catch(() => { });
          if (Math.abs(v.currentTime - expectedMediaTime) > 0.15) {
            v.currentTime = expectedMediaTime;
          }
          const targetPlaybackRate = (activeClip.speed || 1) * (settings.speed || 1);
          if (v.playbackRate !== targetPlaybackRate) {
            v.playbackRate = targetPlaybackRate;
          }
        } else {
          if (!v.paused) v.pause();
        }
      }

      // --- Sync Audio Multi-Tracks to Timeline ---
      if (audioTracksRef.current.length > 0) {
        audioTracksRef.current.forEach(track => {
          let el = audioTrackElementsRef.current.get(track.id);
          if (!el) {
            el = new Audio();
            audioTrackElementsRef.current.set(track.id, el);
          }
          const activeAudio = audioClipsRef.current.find(c => (c.trackId === track.id || (!c.trackId && track.id === audioTracksRef.current[0]?.id)) && next >= c.start && next <= c.end);
          if (activeAudio) {
            const clipVol = activeAudio.volume !== undefined ? activeAudio.volume : 100;
            const isAudioMuted = activeAudio.muted || track.muted || isMusicAudioMuted || settings.removeMusic;
            // Feature 3: Audio Fade-in / Fade-out calculation
            let fadeMultiplier = 1;
            if (activeAudio.fadeIn && (activeAudio.fadeInDuration ?? 1.5) > 0) {
              const fromStart = next - activeAudio.start;
              const fInDur = activeAudio.fadeInDuration ?? 1.5;
              if (fromStart >= 0 && fromStart < fInDur) {
                fadeMultiplier = Math.max(0, Math.min(1, fromStart / fInDur));
              }
            }
            if (activeAudio.fadeOut && (activeAudio.fadeOutDuration ?? 1.5) > 0) {
              const fromEnd = activeAudio.end - next;
              const fOutDur = activeAudio.fadeOutDuration ?? 1.5;
              if (fromEnd >= 0 && fromEnd < fOutDur) {
                fadeMultiplier = Math.min(fadeMultiplier, Math.max(0, Math.min(1, fromEnd / fOutDur)));
              }
            }

            if (isAudioMuted || clipVol === 0) {
              el.volume = 0;
            } else {
              const masterMusicVol = (settings.musicVolume ?? 100) / 100;
              el.volume = Math.max(0, Math.min(1, (clipVol / 100) * masterMusicVol * fadeMultiplier));
            }
            if (!isAudioMuted && clipVol > 0) {
              const audioUrl = activeAudio.url || projectAssetsRef.current.find(p => p.type === 'audio' && p.name === activeAudio.name)?.url;
              if (audioUrl && el.src !== audioUrl) {
                el.src = audioUrl;
              }
              const expectedAudioTime = Math.max(0, (activeAudio.offset || 0) + (next - activeAudio.start) * (activeAudio.speed || 1));
              if (el.paused) {
                el.play().catch(() => { });
              }
              if (Math.abs(el.currentTime - expectedAudioTime) > 0.15) {
                el.currentTime = expectedAudioTime;
              }
              const targetPlaybackRate = (activeAudio.speed || 1) * (settings.speed || 1);
              if (el.playbackRate !== targetPlaybackRate) {
                el.playbackRate = targetPlaybackRate;
              }
            } else {
              if (!el.paused) el.pause();
            }
          } else {
            if (!el.paused) el.pause();
          }
        });
      } else if (a) {
        // Fallback for single audio preview
        const activeAudio = audioClipsRef.current.find(c => next >= c.start && next <= c.end);
        if (activeAudio) {
          const clipVol = activeAudio.volume !== undefined ? activeAudio.volume : 100;
          const isAudioMuted = activeAudio.muted || isMusicAudioMuted || settings.removeMusic;
          // Feature 3: Audio Fade-in / Fade-out calculation
          let fadeMultiplier = 1;
          if (activeAudio.fadeIn && (activeAudio.fadeInDuration ?? 1.5) > 0) {
            const fromStart = next - activeAudio.start;
            const fInDur = activeAudio.fadeInDuration ?? 1.5;
            if (fromStart >= 0 && fromStart < fInDur) {
              fadeMultiplier = Math.max(0, Math.min(1, fromStart / fInDur));
            }
          }
          if (activeAudio.fadeOut && (activeAudio.fadeOutDuration ?? 1.5) > 0) {
            const fromEnd = activeAudio.end - next;
            const fOutDur = activeAudio.fadeOutDuration ?? 1.5;
            if (fromEnd >= 0 && fromEnd < fOutDur) {
              fadeMultiplier = Math.min(fadeMultiplier, Math.max(0, Math.min(1, fromEnd / fOutDur)));
            }
          }

          if (isAudioMuted || clipVol === 0) {
            a.volume = 0;
            if (!a.paused) a.pause();
          } else {
            const masterMusicVol = (settings.musicVolume ?? 100) / 100;
            a.volume = Math.max(0, Math.min(1, (clipVol / 100) * masterMusicVol * fadeMultiplier));
            const audioUrl = activeAudio.url || projectAssetsRef.current.find(p => p.type === 'audio' && p.name === activeAudio.name)?.url;
            if (audioUrl && a.src !== audioUrl) {
              a.src = audioUrl;
            }
            const expectedAudioTime = Math.max(0, (activeAudio.offset || 0) + (next - activeAudio.start));
            if (a.paused) {
              a.play().catch(() => { });
            }
            if (Math.abs(a.currentTime - expectedAudioTime) > 0.15) {
              a.currentTime = expectedAudioTime;
            }
          }
        } else {
          if (!a.paused) a.pause();
        }
      }

      animId = requestAnimationFrame(tick);
    };

    animId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animId);
  }, [isPlaying, duration, settings.speed, isMusicAudioMuted, settings.musicVolume, isVideoAudioMuted, settings.volume, settings.removeAudio, settings.removeMusic, selectedClipId]);

  const handleVideoTimeUpdate = () => {
    // Driven by 60fps tick engine and handleSeek
  };

  const handleSeek = (newTime: number) => {
    const clamped = Math.max(0, Math.min(newTime, duration || 83));
    setCurrentTime(clamped);
    currentTimeRef.current = clamped;

    const v = videoRef.current;
    if (v) {
      if (seekRafRef.current) cancelAnimationFrame(seekRafRef.current);
      seekRafRef.current = requestAnimationFrame(() => {
        const visibleTrackIds = new Set(videoTracksRef.current.filter(t => !t.hidden).map(t => t.id));
        let activeClip = clipsRef.current.find(c => c.id === selectedClipId && (!c.trackId || visibleTrackIds.has(c.trackId)) && clamped >= c.start && clamped <= c.end);
        if (!activeClip) {
          activeClip = clipsRef.current.find(c => (!c.trackId || visibleTrackIds.has(c.trackId)) && clamped >= c.start && clamped <= c.end) || clipsRef.current[0];
        }
        if (activeClip) {
          const clipTrack = videoTracksRef.current.find(t => t.id === activeClip!.trackId);
          const clipVol = activeClip.volume !== undefined ? activeClip.volume : 100;
          const isClipMuted = activeClip.muted || clipTrack?.muted || isVideoAudioMuted || settings.removeAudio;
          if (isClipMuted || clipVol === 0) {
            v.muted = true;
          } else {
            v.muted = false;
            const masterVol = (settings.volume ?? 100) / 100;
            v.volume = Math.max(0, Math.min(1, (clipVol / 100) * masterVol));
          }
          const clipUrl = (activeClip as any).url || projectAssetsRef.current.find(p => p.id === (activeClip as any).assetId || p.name === activeClip.name)?.url;
          if (clipUrl && v.src !== clipUrl) {
            v.src = clipUrl;
          }
          const targetTime = Math.max(0, (activeClip.offset || 0) + (clamped - activeClip.start) * (activeClip.speed || 1));
          try {
            if ('fastSeek' in v && typeof (v as any).fastSeek === 'function') {
              (v as any).fastSeek(targetTime);
            } else {
              v.currentTime = targetTime;
            }
          } catch {
            v.currentTime = targetTime;
          }
        }
      });
    }

    // Sync all audio tracks on seek
    if (audioTracksRef.current.length > 0) {
      audioTracksRef.current.forEach(track => {
        let el = audioTrackElementsRef.current.get(track.id);
        if (!el) {
          el = new Audio();
          audioTrackElementsRef.current.set(track.id, el);
        }
        const activeAudio = audioClipsRef.current.find(c => (c.trackId === track.id || (!c.trackId && track.id === audioTracksRef.current[0]?.id)) && clamped >= c.start && clamped <= c.end);
        if (activeAudio) {
          const clipVol = activeAudio.volume !== undefined ? activeAudio.volume : 100;
          const isAudioMuted = activeAudio.muted || track.muted || isMusicAudioMuted || settings.removeMusic;
          if (isAudioMuted || clipVol === 0) {
            el.volume = 0;
          } else {
            const masterMusicVol = (settings.musicVolume ?? 100) / 100;
            el.volume = Math.max(0, Math.min(1, (clipVol / 100) * masterMusicVol));
          }
          if (!isAudioMuted && clipVol > 0) {
            const audioUrl = activeAudio.url || projectAssetsRef.current.find(p => p.type === 'audio' && p.name === activeAudio.name)?.url;
            if (audioUrl && el.src !== audioUrl) {
              el.src = audioUrl;
            }
            el.currentTime = Math.max(0, (activeAudio.offset || 0) + (clamped - activeAudio.start) * (activeAudio.speed || 1));
            if (isPlayingRef.current && el.paused) {
              el.play().catch(() => { });
            }
          } else {
            if (!el.paused) el.pause();
          }
        } else {
          if (!el.paused) el.pause();
        }
      });
    } else {
      const a = audioPreviewRef.current;
      if (a) {
        try {
          const activeAudio = audioClipsRef.current.find(c => clamped >= c.start && clamped <= c.end);
          if (activeAudio) {
            const clipVol = activeAudio.volume !== undefined ? activeAudio.volume : 100;
            const isAudioMuted = activeAudio.muted || isMusicAudioMuted || settings.removeMusic;
            if (isAudioMuted || clipVol === 0) {
              a.volume = 0;
              if (!a.paused) a.pause();
            } else {
              const masterMusicVol = (settings.musicVolume ?? 100) / 100;
              a.volume = Math.max(0, Math.min(1, (clipVol / 100) * masterMusicVol));
              const audioUrl = activeAudio.url || projectAssetsRef.current.find(p => p.type === 'audio' && p.name === activeAudio.name)?.url;
              if (audioUrl && a.src !== audioUrl) {
                a.src = audioUrl;
              }
              a.currentTime = Math.max(0, (activeAudio.offset || 0) + (clamped - activeAudio.start) * (activeAudio.speed || 1));
              if (isPlayingRef.current && a.paused) {
                a.play().catch(() => { });
              }
            }
          } else {
            if (!a.paused) a.pause();
          }
        } catch (_) { }
      }
    }
  };

  // Helper: Append asset to timeline (Creates a dedicated track for each media item)
  const handleAddAssetToTimeline = (asset: ProjectAsset) => {
    if (asset.type === 'video') {
      const newTrackId = `track-v-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      setVideoTracks(prev => [...prev, {
        id: newTrackId,
        name: `Video ${prev.length + 1}`,
        hidden: false,
        muted: false
      }]);

      const newClipId = `clip-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      const dur = asset.duration || 15;
      const newClip = {
        id: newClipId,
        trackId: newTrackId,
        name: asset.name,
        start: 0,
        end: dur,
        offset: 0,
        sourceDuration: dur,
        assetId: asset.id,
        url: asset.url,
        volume: 100,
        muted: false,
        speed: 1
      };
      setClips(prev => [...prev, newClip]);
      setDuration(prev => Math.max(prev, dur));
      setSelectedClipId(newClipId);
      setSelectedAudioClipId(null);
      setSelectedTextClipId(null);
      setInspectorTab('video');
      setActiveAssetId(asset.id);
    } else {
      const newTrackId = `track-a-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      setAudioTracks(prev => [...prev, {
        id: newTrackId,
        name: `Music ${prev.length + 1}`,
        muted: false
      }]);

      const newAudioId = `audio-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      const dur = asset.duration || 30;
      const newAudioClip = {
        id: newAudioId,
        trackId: newTrackId,
        name: asset.name,
        url: asset.url,
        start: 0,
        end: dur,
        offset: 0,
        sourceDuration: dur,
        volume: 100,
        muted: false,
        speed: 1
      };
      setAudioClips(prev => [...prev, newAudioClip]);
      setDuration(prev => Math.max(prev, dur));
      setSelectedAudioClipId(newAudioId);
      setSelectedClipId('');
      setSelectedTextClipId(null);
      setInspectorTab('audio');
      setAudioInspectorMode('individual');
      setActiveBgmName(asset.name);
      setSettings(prev => ({ ...prev, musicUrl: asset.url, removeMusic: false }));
      setIsMusicAudioMuted(false);
    }
  };

  // Helper: Delete asset and remove associated clips from timeline
  const handleDeleteAsset = (assetId: string) => {
    const asset = projectAssets.find(a => a.id === assetId);
    setProjectAssets(prev => prev.filter(a => a.id !== assetId));
    if (asset) {
      if (asset.type === 'video') {
        setClips(prev => prev.filter(c => (c as any).assetId !== assetId && (c as any).url !== asset.url));
      } else {
        setAudioClips(prev => prev.filter(c => c.url !== asset.url));
      }
    }
  };

  // Multi-file processor for any number of video and audio files (Auto-assigns each to its own track)
  const processAndAddFiles = async (files: File[]) => {
    if (!files || files.length === 0) return;

    const usedAudioTracks = new Set(audioClipsRef.current.map(c => c.trackId));
    const usedVideoTracks = new Set(clipsRef.current.map(c => c.trackId));

    for (const file of files) {
      const isAudio = file.type.startsWith('audio/') || /\.(mp3|wav|ogg|m4a|aac|flac|wma)$/i.test(file.name);
      const blobUrl = URL.createObjectURL(file);

      if (isAudio) {
        const audioDur = await new Promise<number>((resolve) => {
          let settled = false;
          const done = (d: number) => {
            if (settled) return;
            settled = true;
            a.src = '';
            resolve(d);
          };
          const a = new Audio(blobUrl);
          a.onloadedmetadata = () => {
            const d = a.duration && !isNaN(a.duration) && a.duration > 0 ? Math.round(a.duration) : 60;
            done(d);
          };
          a.onerror = () => done(60);
          setTimeout(() => done(60), 1200);
        });

        const newAssetId = `asset-audio-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
        registerAssetBlob(newAssetId, file);
        const newAsset: ProjectAsset = {
          id: newAssetId,
          name: file.name,
          type: 'audio',
          duration: audioDur,
          durationStr: formatShortDuration(audioDur),
          thumbnailUrl: '',
          url: blobUrl,
          isUploaded: true
        };

        setProjectAssets(prev => [newAsset, ...prev]);

        const newTrackId = `track-a-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
        setAudioTracks(prev => {
          const hasClips = usedAudioTracks.has(prev[0]?.id);
          if (prev.length === 1 && !hasClips) {
            return [{ id: newTrackId, name: 'Music 1', muted: false }];
          }
          return [...prev, {
            id: newTrackId,
            name: `Music ${prev.length + 1}`,
            muted: false
          }];
        });
        usedAudioTracks.add(newTrackId);

        const audioClipId = `audio-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
        const newAudioClip = {
          id: audioClipId,
          trackId: newTrackId,
          name: file.name,
          url: blobUrl,
          start: 0,
          end: audioDur,
          offset: 0,
          sourceDuration: audioDur,
          volume: 100,
          muted: false,
          speed: 1
        };
        setAudioClips(prev => [...prev, newAudioClip]);
        setDuration(curDur => Math.max(curDur, audioDur));
        setSelectedAudioClipId(audioClipId);
        setSelectedClipId('');
        setSelectedTextClipId(null);
        setInspectorTab('audio');
        setAudioInspectorMode('individual');

        setActiveBgmName(file.name);
        setSettings(prev => ({
          ...prev,
          musicUrl: blobUrl,
          removeMusic: false,
          musicVolume: prev.musicVolume && prev.musicVolume > 0 ? prev.musicVolume : 100
        }));
        setIsMusicAudioMuted(false);
      } else {
        // Video file
        const { videoDur, videoW, videoH } = await new Promise<{ videoDur: number; videoW: number; videoH: number }>((resolve) => {
          let settled = false;
          const done = (result: { videoDur: number; videoW: number; videoH: number }) => {
            if (settled) return;
            settled = true;
            resolve(result);
          };
          const tempV = document.createElement('video');
          tempV.preload = 'metadata';
          tempV.src = blobUrl;
          tempV.onloadedmetadata = () => {
            const d = tempV.duration && !isNaN(tempV.duration) && tempV.duration > 0 ? Math.round(tempV.duration) : 60;
            const w = tempV.videoWidth || 1920;
            const h = tempV.videoHeight || 1080;
            memoryManager.cleanMediaElement(tempV);
            done({ videoDur: d, videoW: w, videoH: h });
          };
          tempV.onerror = () => {
            memoryManager.cleanMediaElement(tempV);
            done({ videoDur: 60, videoW: 1920, videoH: 1080 });
          };
          setTimeout(() => done({ videoDur: 60, videoW: 1920, videoH: 1080 }), 1500);
        });

        const newAssetId = `asset-video-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
        registerAssetBlob(newAssetId, file);
        const newAsset: ProjectAsset = {
          id: newAssetId,
          name: file.name,
          type: 'video',
          duration: videoDur,
          durationStr: formatShortDuration(videoDur),
          thumbnailUrl: blobUrl,
          url: blobUrl,
          isUploaded: true
        };

        setProjectAssets(prev => [newAsset, ...prev]);

        const newTrackId = `track-v-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
        setVideoTracks(prev => {
          const hasClips = usedVideoTracks.has(prev[0]?.id);
          if (prev.length === 1 && !hasClips) {
            return [{ id: newTrackId, name: 'Video 1', hidden: false, muted: false }];
          }
          return [...prev, {
            id: newTrackId,
            name: `Video ${prev.length + 1}`,
            hidden: false,
            muted: false
          }];
        });
        usedVideoTracks.add(newTrackId);

        const clipId = `clip-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
        const newClip = {
          id: clipId,
          trackId: newTrackId,
          name: file.name,
          start: 0,
          end: videoDur,
          offset: 0,
          sourceDuration: videoDur,
          assetId: newAssetId,
          url: blobUrl,
          volume: 100,
          muted: false,
          speed: 1
        };
        setClips(prev => [...prev, newClip]);
        setDuration(curDur => Math.max(curDur, videoDur));
        setSelectedClipId(clipId);
        setSelectedAudioClipId(null);
        setSelectedTextClipId(null);
        setInspectorTab('video');

        setActiveAssetId(newAssetId);
        setProjectName(file.name);
        // Bug #16 fix: Sync export fileName with uploaded video name
        setActiveExportConfig(prev => ({
          ...prev,
          fileName: file.name.replace(/\.[^.]+$/, '') || 'edited_video'
        }));

        if (onSelectVideo) {
          const parsedVideo: VideoFile = {
            file,
            name: file.name,
            size: file.size,
            type: file.type || 'video/mp4',
            url: blobUrl,
            duration: videoDur,
            width: videoW,
            height: videoH
          };
          onSelectVideo(parsedVideo);
        }
      }
    }
  };

  // File Upload (+ Upload button)
  const handleUploadClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const fileArray = Array.from(files);
    e.target.value = '';
    processAndAddFiles(fileArray);
  };

  // Split Clip handler (`][` button in timeline)
  const handleSplitClip = () => {
    const splitTime = Math.max(0.2, Math.min(currentTime, duration - 0.2));

    if (selectedAudioClipId) {
      const activeAudio = audioClips.find(a => a.id === selectedAudioClipId && splitTime > a.start && splitTime < a.end);
      if (activeAudio) {
        const sourceDur = getAudioClipSourceDuration(activeAudio);
        const speed = activeAudio.speed || 1;
        const newAudio1: AudioClipItem = { ...activeAudio, end: splitTime, sourceDuration: sourceDur };
        const newAudio2: AudioClipItem = {
          ...activeAudio,
          id: `audio-${Date.now()}`,
          name: `${activeAudio.name} (Part 2)`,
          start: splitTime,
          end: activeAudio.end,
          offset: (activeAudio.offset || 0) + (splitTime - activeAudio.start) * speed,
          sourceDuration: sourceDur
        };
        setAudioClips(prev => {
          const idx = prev.findIndex(a => a.id === activeAudio.id);
          if (idx !== -1) {
            const updated = [...prev];
            updated.splice(idx, 1, newAudio1, newAudio2);
            return updated;
          }
          return [...prev, newAudio2];
        });
        setSelectedAudioClipId(newAudio2.id);
        setSelectedClipId('');
        setSelectedTextClipId(null);
        setInspectorTab('audio');
        setAudioInspectorMode('individual');
        return;
      }
    }

    const activeClip = clips.find(c => c.id === selectedClipId) || clips.find(c => splitTime >= c.start && splitTime <= c.end) || clips[0];
    if (activeClip && splitTime > activeClip.start + 0.1 && splitTime < activeClip.end - 0.1) {
      const sourceDur = getVideoClipSourceDuration(activeClip);
      const speed = activeClip.speed || 1;
      const newClip1: VideoClipItem = {
        ...activeClip,
        end: splitTime,
        sourceDuration: sourceDur
      };
      const newClip2: VideoClipItem = {
        ...activeClip,
        id: `clip-${Date.now()}`,
        name: `${activeClip.name} (Part 2)`,
        start: splitTime,
        end: activeClip.end,
        offset: (activeClip.offset || 0) + (splitTime - activeClip.start) * speed,
        sourceDuration: sourceDur
      };
      setClips(prev => {
        const idx = prev.findIndex(c => c.id === activeClip.id);
        if (idx !== -1) {
          const updated = [...prev];
          updated.splice(idx, 1, newClip1, newClip2);
          return updated;
        }
        return [...prev, newClip2];
      });
      setSelectedClipId(newClip2.id);
      setSelectedAudioClipId(null);
      setSelectedTextClipId(null);
      setInspectorTab('video');
    }
  };

  // Delete handler (deletes selected sticker, audio clip, video clip, text clip or text)
  const handleDelete = () => {
    if (selectedStickerId) {
      setStickers(prev => prev.filter(s => s.id !== selectedStickerId));
      setSelectedStickerId(null);
      return;
    }
    if (selectedTextClipId) {
      setTextClips(prev => prev.filter(t => t.id !== selectedTextClipId));
      setSelectedTextClipId(null);
      return;
    }
    if (selectedAudioClipId) {
      if (rippleMode) {
        handleRippleDelete();
        return;
      }
      const remaining = audioClips.filter(a => a.id !== selectedAudioClipId);
      setAudioClips(remaining);
      setSelectedAudioClipId(null);
      if (remaining.length === 0) {
        setSettings(prev => ({ ...prev, musicUrl: '', removeMusic: false }));
        setActiveBgmName('');
        if (audioPreviewRef.current) {
          audioPreviewRef.current.pause();
        }
      }
      return;
    }
    if (selectedClipId) {
      if (clips.length > 1) {
        if (rippleMode) {
          handleRippleDelete();
          return;
        }
        setClips(prev => prev.filter(c => c.id !== selectedClipId));
        // BUG #2 fix: don't use clips[0] — it may be the deleted clip itself
        setSelectedClipId(clips.find(c => c.id !== selectedClipId)?.id || '');
      }
      return;
    }
    if (settings.textOverlay?.enabled) {
      pushSettingsChange(prev => ({
        ...prev,
        textOverlay: { ...prev.textOverlay!, enabled: false, text: '' }
      }));
      return;
    }
    // Reset position & size
    resetPositionAndSize();
  };

  // Feature 5: Ripple Delete (O'chirilganda bo'shliq qolmasligi - shift subsequent clips left)
  const handleRippleDelete = () => {
    if (selectedClipId && clips.length > 0) {
      const targetClip = clips.find(c => c.id === selectedClipId);
      if (targetClip) {
        const dur = targetClip.end - targetClip.start;
        const targetTrackId = targetClip.trackId;
        setClips(prev => {
          const remaining = prev.filter(c => c.id !== selectedClipId);
          return remaining.map(c => {
            if (c.start >= targetClip.end) {
              return {
                ...c,
                start: Math.max(0, c.start - dur),
                end: Math.max(0, c.end - dur)
              };
            }
            return c;
          });
        });
        // Bug #15 fix: Compute willHave* BEFORE setClips (from current state snapshot)
        const willHaveVideoClips = clips.some(c => c.id !== selectedClipId && c.trackId === targetTrackId);
        if (targetTrackId && !willHaveVideoClips) {
          setVideoTracks(prev => {
            const remaining = prev.filter(t => t.id !== targetTrackId);
            return remaining.length > 0 ? remaining : [{ id: `track-v-${Date.now()}`, name: 'Video 1', hidden: false, muted: false }];
          });
        }
        const nextSelected = clips.find(c => c.id !== selectedClipId);
        setSelectedClipId(nextSelected ? nextSelected.id : '');
        return;
      }
    }
    if (selectedAudioClipId && audioClips.length > 0) {
      const targetAudio = audioClips.find(a => a.id === selectedAudioClipId);
      if (targetAudio) {
        const dur = targetAudio.end - targetAudio.start;
        const targetTrackId = targetAudio.trackId;
        setAudioClips(prev => {
          const remaining = prev.filter(a => a.id !== selectedAudioClipId);
          return remaining.map(a => {
            if (a.start >= targetAudio.end) {
              return {
                ...a,
                start: Math.max(0, a.start - dur),
                end: Math.max(0, a.end - dur)
              };
            }
            return a;
          });
        });
        // Bug #15 fix: Compute willHave* BEFORE setAudioClips (from current state snapshot)
        const willHaveAudioClips = audioClips.some(a => a.id !== selectedAudioClipId && a.trackId === targetTrackId);
        if (targetTrackId && !willHaveAudioClips) {
          setAudioTracks(prev => {
            const remaining = prev.filter(t => t.id !== targetTrackId);
            return remaining.length > 0 ? remaining : [{ id: `track-a-${Date.now()}`, name: 'Music 1', muted: false }];
          });
        }
        setSelectedAudioClipId(null);
        return;
      }
    }
    if (selectedTextClipId) {
      setTextClips(prev => prev.filter(t => t.id !== selectedTextClipId));
      setSelectedTextClipId(null);
    }
  };

  // Reset Position and Size (CapCut reset icon)
  const resetPositionAndSize = () => {
    pushSettingsChange(prev => ({
      ...prev,
      scaleSize: 100,
      positionX: 0,
      positionY: 0,
      rotation: 0,
      flipH: false,
      flipV: false,
      zoom: 1
    }));
  };

  // Reset Blend (CapCut reset icon)
  const resetBlend = () => {
    pushSettingsChange(prev => ({
      ...prev,
      opacity: 100
    }));
  };

  // Refresh assets
  const handleRefreshAssets = () => {
    const list = initialVideos && initialVideos.length > 0 ? initialVideos : (video && video.url ? [video] : []);
    if (list.length > 0) {
      setProjectAssets(list.map((v, i) => {
        const isAudio = v.type?.startsWith('audio/') || /\.(mp3|wav|ogg|m4a|aac)$/i.test(v.name);
        const dur = v.duration && !isNaN(v.duration) && v.duration > 0 ? Math.round(v.duration) : 60;
        return {
          id: `asset-${i + 1}`,
          name: v.name,
          type: isAudio ? 'audio' : 'video',
          duration: dur,
          durationStr: formatShortDuration(dur),
          thumbnailUrl: v.url || '',
          url: v.url || '',
          isUploaded: true
        };
      }));
    } else if (projectAssets.length === 0 && video?.url) {
      setProjectAssets([
        {
          id: 'asset-video',
          name: video.name || 'Video',
          type: 'video',
          duration: video.duration || 60,
          durationStr: formatShortDuration(video.duration || 60),
          thumbnailUrl: video.url || '',
          url: video.url || '',
          isUploaded: true
        }
      ]);
    }
  };

  // Web Audio Sound Engine for SFX & BGM Previews
  const playSfx = (name: string) => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();

      if (name.includes('Whoosh')) {
        const bufferSize = ctx.sampleRate * 0.4;
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
        const noise = ctx.createBufferSource();
        noise.buffer = buffer;
        const filter = ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(300, ctx.currentTime);
        filter.frequency.exponentialRampToValueAtTime(3200, ctx.currentTime + 0.18);
        filter.frequency.exponentialRampToValueAtTime(400, ctx.currentTime + 0.38);
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.01, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.3, ctx.currentTime + 0.15);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
        noise.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);
        noise.start();
      } else if (name.includes('Camera')) {
        [0, 0.08].forEach((timeOffset) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(1400, ctx.currentTime + timeOffset);
          osc.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + timeOffset + 0.04);
          gain.gain.setValueAtTime(0.4, ctx.currentTime + timeOffset);
          gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + timeOffset + 0.04);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(ctx.currentTime + timeOffset);
          osc.stop(ctx.currentTime + timeOffset + 0.05);
        });
      } else if (name.includes('Pop')) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(800, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(160, ctx.currentTime + 0.12);
        gain.gain.setValueAtTime(0.35, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.13);
      } else if (name.includes('Glitch')) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(160, ctx.currentTime);
        osc.frequency.setValueAtTime(980, ctx.currentTime + 0.05);
        osc.frequency.setValueAtTime(320, ctx.currentTime + 0.1);
        osc.frequency.setValueAtTime(1400, ctx.currentTime + 0.18);
        gain.gain.setValueAtTime(0.2, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.26);
      }
      // BUG #11 fix: Schedule AudioContext cleanup to prevent memory leaks
      setTimeout(() => { try { ctx.close(); } catch (_) {} }, 1500);
    } catch {
      // AudioContext unavailable or autoplay blocked
    }
  };

  const handleAudioUploadClick = () => {
    if (audioFileInputRef.current) {
      audioFileInputRef.current.click();
    }
  };

  const processAndAddAudioFiles = async (files: File[]) => {
    if (!files || files.length === 0) return;

    for (const file of files) {
      const blobUrl = URL.createObjectURL(file);
      const audioDur = await new Promise<number>((resolve) => {
        let settled = false;
        const done = (d: number) => {
          if (settled) return;
          settled = true;
          a.src = '';
          resolve(d);
        };
        const a = new Audio(blobUrl);
        a.onloadedmetadata = () => {
          const d = a.duration && !isNaN(a.duration) && a.duration > 0 ? Math.round(a.duration) : 60;
          done(d);
        };
        a.onerror = () => done(60);
        setTimeout(() => done(60), 1200);
      });

      const audioId = `audio-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      const newAsset: ProjectAsset = {
        id: `asset-audio-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        name: file.name,
        type: 'audio',
        duration: audioDur,
        durationStr: formatShortDuration(audioDur),
        thumbnailUrl: '',
        url: blobUrl,
        isUploaded: true
      };

      setProjectAssets(prev => [newAsset, ...prev]);

      const newTrackId = `track-a-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      setAudioTracks(prev => {
        const hasClips = audioClipsRef.current.some(c => c.trackId === prev[0]?.id);
        if (prev.length === 1 && !hasClips) {
          return [{ id: newTrackId, name: 'Music 1', muted: false }];
        }
        return [...prev, {
          id: newTrackId,
          name: `Music ${prev.length + 1}`,
          muted: false
        }];
      });

      const newAudioClip = {
        id: audioId,
        trackId: newTrackId,
        name: file.name,
        url: blobUrl,
        start: 0,
        end: audioDur,
        offset: 0,
        sourceDuration: audioDur,
        volume: 100,
        muted: false,
        speed: 1
      };
      setAudioClips(prev => [...prev, newAudioClip]);
      setDuration(curDur => Math.max(curDur, audioDur));
      setSelectedAudioClipId(audioId);
      setSelectedClipId('');

      setActiveBgmName(file.name);
      setSettings(prev => ({
        ...prev,
        musicUrl: blobUrl,
        removeMusic: false,
        musicVolume: prev.musicVolume && prev.musicVolume > 0 ? prev.musicVolume : 100
      }));
      setIsMusicAudioMuted(false);
      setInspectorTab('audio');
      setAudioInspectorMode('individual');
    }
  };

  const handleAudioFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const fileArray = Array.from(files);
    e.target.value = '';
    processAndAddAudioFiles(fileArray);
  };

  // Sync playback speed to real video element and audio preview element
  useEffect(() => {
    const rate = Math.max(0.25, Math.min(4, settings.speed || 1));
    if (videoRef.current) {
      videoRef.current.playbackRate = rate;
    }
    if (audioPreviewRef.current) {
      audioPreviewRef.current.playbackRate = rate;
    }
  }, [settings.speed]);

  // Unified toggle helpers for Video and Music audio muting
  const toggleVideoAudioMute = () => {
    const willMute = !(settings.removeAudio || isVideoAudioMuted || settings.volume === 0);
    setIsVideoAudioMuted(willMute);
    pushSettingsChange(prev => ({
      ...prev,
      removeAudio: willMute
    }));
  };

  const toggleMusicAudioMute = () => {
    const willMute = !(settings.removeMusic || isMusicAudioMuted || (settings.musicVolume ?? 100) === 0);
    setIsMusicAudioMuted(willMute);
    pushSettingsChange(prev => ({
      ...prev,
      removeMusic: willMute
    }));
  };

  // Sync volume and mute across real video element, audio preview, and all multi-track audio elements
  useEffect(() => {
    // 1. Sync Video Element Volume & Mute
    if (videoRef.current) {
      const curTime = currentTimeRef.current;
      const visibleTrackIds = new Set(videoTracks.filter(t => !t.hidden).map(t => t.id));
      const activeClip = clips.find(c => (!c.trackId || visibleTrackIds.has(c.trackId)) && curTime >= c.start && curTime <= c.end)
        || clips.find(c => c.id === selectedClipId)
        || clips[0];
      const clipTrack = activeClip ? videoTracks.find(t => t.id === activeClip.trackId) : null;
      const clipVol = activeClip?.volume !== undefined ? activeClip.volume : 100;
      const isClipMuted = !activeClip || activeClip.muted || clipTrack?.muted || isVideoAudioMuted || settings.removeAudio;

      if (isClipMuted || clipVol === 0 || (settings.volume ?? 100) === 0) {
        videoRef.current.muted = true;
        videoRef.current.volume = 0;
      } else {
        videoRef.current.muted = false;
        const masterVol = (settings.volume ?? 100) / 100;
        videoRef.current.volume = Math.max(0, Math.min(1, (clipVol / 100) * masterVol));
      }
    }

    // 2. Sync Audio Preview element (fallback)
    const shouldMuteMusic = Boolean(settings.removeMusic || ((settings.musicVolume ?? 100) === 0) || isMusicAudioMuted);
    if (audioPreviewRef.current) {
      const curTime = currentTimeRef.current;
      const activeAudio = audioClips.find(c => curTime >= c.start && curTime <= c.end)
        || audioClips.find(c => c.id === selectedAudioClipId)
        || audioClips[0];
      const clipVol = activeAudio?.volume !== undefined ? activeAudio.volume : 100;
      const isMuted = shouldMuteMusic || (activeAudio?.muted ?? false);
      audioPreviewRef.current.muted = isMuted || clipVol === 0;
      audioPreviewRef.current.volume = isMuted || clipVol === 0 ? 0 : Math.min(1, Math.max(0, (clipVol / 100) * ((settings.musicVolume ?? 100) / 100)));
    }

    // 3. Sync All Multi-Track Audio Elements
    audioTracks.forEach(track => {
      const el = audioTrackElementsRef.current.get(track.id);
      if (!el) return;
      const curTime = currentTimeRef.current;
      const activeAudio = audioClips.find(c => (c.trackId === track.id || (!c.trackId && track.id === audioTracks[0]?.id)) && curTime >= c.start && curTime <= c.end)
        || audioClips.find(c => c.id === selectedAudioClipId)
        || audioClips.find(c => c.trackId === track.id);

      if (activeAudio) {
        const clipVol = activeAudio.volume !== undefined ? activeAudio.volume : 100;
        const isMuted = activeAudio.muted || track.muted || shouldMuteMusic;
        if (isMuted || clipVol === 0) {
          el.muted = true;
          el.volume = 0;
        } else {
          el.muted = false;
          const masterMusicVol = (settings.musicVolume ?? 100) / 100;
          el.volume = Math.max(0, Math.min(1, (clipVol / 100) * masterMusicVol));
        }
      } else {
        el.muted = true;
        el.volume = 0;
      }
    });
  }, [
    settings.volume,
    settings.removeAudio,
    isVideoAudioMuted,
    settings.musicVolume,
    settings.removeMusic,
    isMusicAudioMuted,
    clips,
    audioClips,
    videoTracks,
    audioTracks,
    selectedClipId,
    selectedAudioClipId
  ]);

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return;
      }

      if (e.code === 'Space') {
        e.preventDefault();
        togglePlay();
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        handleSeek(Math.max(0, currentTime - (e.shiftKey ? 5 : 1)));
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        handleSeek(Math.min(duration, currentTime + (e.shiftKey ? 5 : 1)));
      } else if (e.code === 'Delete' || e.code === 'Backspace') {
        handleDelete();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          handleRedo();
        } else {
          handleUndo();
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        handleRedo();
      } else if (e.key.toLowerCase() === 's' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        handleSplitClip();
      } else if (e.key.toLowerCase() === 'm' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        if (e.shiftKey) {
          toggleMusicAudioMute();
        } else {
          toggleVideoAudioMute();
        }
      } else if (e.key.toLowerCase() === 'f') {
        e.preventDefault();
        const canvas = canvasPreviewRef.current;
        if (canvas) {
          if (document.fullscreenElement) {
            document.exitFullscreen();
          } else {
            canvas.requestFullscreen();
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentTime, duration, isPlaying, historyIndex, history, selectedStickerId, selectedClipId, selectedAudioClipId, clips, audioClips, settings, isVideoAudioMuted, isMusicAudioMuted]);

  // Export video with user-selected format and quality
  const handleExport = async (config?: ExportConfig) => {
    const finalConfig = config || activeExportConfig;
    setActiveExportConfig(finalConfig);
    setShowExportModal(false);
    setIsProcessing(true);
    setProgressPercent(0);
    setProgressMsg(editorT.modals.renderTitle);

    try {
      const activeVideo = projectAssets.find(a => a.type === 'video' && a.id === activeAssetId)
        || projectAssets.find(a => a.type === 'video');
      const sourceUrl = activeVideo?.url || video?.url;

      if (sourceUrl) {
        // Remove reliance on 'selectedClipId' and 'selectedAudioClipId' for global export volume.
        // The backend export engine (WebCodecs) currently only supports a single global multiplier.
        // Muting should only happen globally if isVideoAudioMuted or settings.removeAudio is true.
        const effectiveVideoVolume = (isVideoAudioMuted || settings.removeAudio) ? 0 : (settings.volume ?? 100);
        const effectiveMusicVolume = (isMusicAudioMuted || settings.removeMusic) ? 0 : (settings.musicVolume ?? 100);

        // Build enriched clips for the export engine:
        // Exclude clips that are on hidden tracks
        const visibleTrackIds = new Set(videoTracks.filter(t => !t.hidden).map(t => t.id));
        const exportClips = clips
          .filter(c => !c.trackId || visibleTrackIds.has(c.trackId))
          .map(c => {
            const asset = projectAssets.find(a => a.id === c.assetId || a.url === c.url);
            return {
            id: c.id,
            name: c.name,
            start: c.start,
            end: c.end,
            offset: c.offset || 0,
            url: c.url || asset?.url || sourceUrl,
            assetId: c.assetId,
            speed: c.speed,
            brightness: c.brightness,
            contrast: c.contrast,
            saturation: c.saturation,
            filterPreset: c.filterPreset,
            transitionIn: c.transitionIn,
            transitionDuration: c.transitionDuration,
            volume: c.volume,
            muted: c.muted,
          };
        });

        // Exportable audio clips: skip clips sitting on muted/hidden audio tracks
        const activeAudioTrackIds = new Set(audioTracks.filter(t => !t.muted).map(t => t.id));
        const exportAudioClips = audioClips
          .filter(ac => !ac.trackId || activeAudioTrackIds.has(ac.trackId))
          .map(ac => {
            const asset = projectAssets.find(a => a.id === ac.assetId || a.url === ac.url);
            return {
              id: ac.id,
              trackId: ac.trackId,
              name: ac.name,
              start: ac.start,
              end: ac.end,
              offset: ac.offset || 0,
              sourceDuration: ac.sourceDuration,
              url: ac.url || asset?.url || '',
              assetId: ac.assetId,
              volume: ac.volume,
              muted: ac.muted,
              speed: ac.speed,
              fadeIn: ac.fadeIn,
              fadeInDuration: ac.fadeInDuration,
              fadeOut: ac.fadeOut,
              fadeOutDuration: ac.fadeOutDuration,
            };
          });

        // Compute total timeline span covered by all clips (video + audio —
        // the preview keeps playing music past the last video clip, so the
        // export must cover it too)
        const spanSources: Array<{ start: number; end: number }> = [
          ...exportClips,
          ...exportAudioClips.filter(ac => ac.url),
        ];
        const timelineStart = spanSources.length > 0 ? Math.min(...spanSources.map(c => c.start)) : (settings.startTime || 0);
        const timelineEnd   = spanSources.length > 0 ? Math.max(...spanSources.map(c => c.end))   : (settings.endTime || duration);

        const exportSettings: EditorSettings = {
          ...settings,
          clips: exportClips,
          audioClips: exportAudioClips,
          videoTracks,
          audioTracks,
          activeTransition,
          textClips,
          stickers,
          chromaKey,
          activeEffect,
          outputFormat: finalConfig.format,
          quality: finalConfig.quality,
          fps: finalConfig.fps,
          bitrateLevel: finalConfig.bitrateLevel,
          exportFileName: finalConfig.fileName,
          removeAudio: Boolean(settings.removeAudio || isVideoAudioMuted || effectiveVideoVolume === 0),
          removeMusic: Boolean(settings.removeMusic || isMusicAudioMuted || effectiveMusicVolume === 0 || !activeMusicUrl),
          musicUrl: activeMusicUrl || settings.musicUrl,
          musicVolume: effectiveMusicVolume,
          volume: effectiveVideoVolume,
          // Use timeline-derived start/end so the engine knows the full output window
          startTime: timelineStart,
          endTime: timelineEnd,
        };

        let blob: Blob;
        if (finalConfig.format === 'gif') {
          const startSec = Math.max(0, timelineStart || 0);
          const endSec = Math.max(startSec + 0.2, timelineEnd || duration || 5);
          let targetW = 640;
          if (finalConfig.quality === '4k' || finalConfig.quality === '2k' || finalConfig.quality === '1080p') targetW = 800;
          else if (finalConfig.quality === '480p') targetW = 480;

          // Process MP4 first so we capture all clips, overlays, text
          const tempMp4Blob = await processVideoEditor(
            sourceUrl,
            {
              ...exportSettings,
              outputFormat: 'mp4',
              quality: finalConfig.quality,
              fps: Math.min(20, finalConfig.fps || 15)
            },
            (pct) => setProgressPercent(pct * 0.7) // 0-70% for MP4
          );

          const tempMp4Url = URL.createObjectURL(tempMp4Blob);

          blob = await processGifCreate(
            tempMp4Url,
            0,
            endSec - startSec,
            targetW,
            Math.min(20, finalConfig.fps || 15),
            'infinite',
            (percent: number, msg: string) => {
              setProgressPercent(70 + percent * 0.3); // 70-100% for GIF
              setProgressMsg(msg);
            }
          );
          URL.revokeObjectURL(tempMp4Url);
        } else {
          blob = await processVideoEditor(
            sourceUrl,
            exportSettings,
            (percent: number, msg: string) => {
              setProgressPercent(percent);
              setProgressMsg(msg);
            }
          );
        }

        if (editedResultUrl) {
          URL.revokeObjectURL(editedResultUrl);
        }
        const resultUrl = memoryManager.safeCreateObjectURL(blob, 'editor-result', true);
        setEditedResultUrl(resultUrl);
        setIsProcessing(false);
        confetti({ particleCount: 100, spread: 80, origin: { y: 0.5 } });
      } else {
        // Render canvas directly to video
        const canvas = canvasPreviewRef.current;
        if (canvas) {
          const stream = canvas.captureStream(finalConfig.fps || 30);
          const mimeTypes = finalConfig.format === 'webm'
            ? ['video/webm;codecs=vp9', 'video/webm']
            : ['video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm'];
          const supportedMime = mimeTypes.find(m => typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(m)) || '';
          const options = supportedMime ? { mimeType: supportedMime } : undefined;
          const recorder = new MediaRecorder(stream, options);
          const chunks: Blob[] = [];
          recorder.ondataavailable = e => {
            if (e.data && e.data.size > 0) chunks.push(e.data);
          };
          recorder.onstop = () => {
            const blob = new Blob(chunks, { type: supportedMime || (finalConfig.format === 'webm' ? 'video/webm' : 'video/mp4') });
            const url = URL.createObjectURL(blob);
            setEditedResultUrl(url);
            setIsProcessing(false);
            setProgressPercent(100);
            confetti({ particleCount: 100, spread: 80, origin: { y: 0.5 } });
          };

          let p = 0;
          const progressTimer = setInterval(() => {
            p += 10;
            setProgressPercent(Math.min(95, p));
          }, 250);

          recorder.start(250);
          setTimeout(() => {
            clearInterval(progressTimer);
            if (recorder.state !== 'inactive') {
              recorder.stop();
            }
          }, 3000);
        } else {
          setIsProcessing(false);
        }
      }
    } catch (err) {
      // Honest failure: surface the reason to the user instead of silently
      // closing the progress UI with no result (silent export failure).
      const reason = err instanceof Error ? err.message : String(err || 'Unknown export error');
      console.error('Export failed:', reason);
      setProgressMsg('');
      setExportError(
        reason.includes('Audio treki') || reason.toLowerCase().includes('audio')
          ? `Export failed — ${reason} (the source clip may have no audio track.)`
          : `Export failed — ${reason}`
      );
      setIsProcessing(false);
    }
  };

  // Dynamic Ruler Ticks based on real duration
  const rulerTicks = useMemo(() => {
    const total = Math.max(5, Math.ceil(duration || 83));
    let step = 5;
    if (total <= 20) step = 2;
    else if (total <= 60) step = 5;
    else if (total <= 120) step = 10;
    else step = 20;

    const ticks: Array<{ sec: number; label: string; pct: number }> = [];
    for (let s = 0; s <= total; s += step) {
      const mins = Math.floor(s / 60);
      const secs = s % 60;
      const label = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
      ticks.push({ sec: s, label, pct: (s / total) * 100 });
    }
    if (ticks.length > 0 && ticks[ticks.length - 1].pct < 98) {
      const mins = Math.floor(total / 60);
      const secs = total % 60;
      ticks.push({ sec: total, label: `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`, pct: 100 });
    }
    return ticks;
  }, [duration]);

  // Timeline scrub and seek handler
  const handleTimelinePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (
      target.closest('.timeline-clip') ||
      target.closest('.trim-handle') ||
      target.closest('button') ||
      target.closest('input')
    ) {
      return;
    }

    const trackArea = timelineTracksRef.current;
    if (!trackArea) return;

    const rect = trackArea.getBoundingClientRect();
    const seekFromX = (clientX: number) => {
      const totalDur = Math.max(1, duration || 83);
      const scrollLeft = trackArea.scrollLeft || 0;
      const innerEl = trackArea.firstElementChild as HTMLElement;
      const totalWidth = innerEl ? Math.max(rect.width, innerEl.scrollWidth) : rect.width;
      const offsetX = Math.max(0, Math.min(totalWidth, (clientX - rect.left) + scrollLeft));
      const newTime = (offsetX / Math.max(1, totalWidth)) * totalDur;
      handleSeek(newTime);
    };

    isScrubbingRef.current = true;
    seekFromX(e.clientX);

    const onMove = (me: PointerEvent) => {
      seekFromX(me.clientX);
    };
    const onUp = () => {
      isScrubbingRef.current = false;
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  // Helper to determine original media file duration for a video clip
  const getVideoClipSourceDuration = (clip: VideoClipItem): number => {
    return getClipSourceDuration(clip, projectAssetsRef.current, initialVideos);
  };

  // Helper to reliably determine original media file duration for an audio clip
  const getAudioClipSourceDuration = (audio: AudioClipItem): number => {
    return getClipSourceDuration(audio, projectAssetsRef.current, initialVideos);
  };

  // Dedicated Trim Handler for Left and Right handles of video, audio and text clips
  const handleTrimPointerDown = (
    e: React.PointerEvent,
    id: string,
    edge: 'start' | 'end',
    type: 'video' | 'audio' | 'text'
  ) => {
    e.stopPropagation();
    e.preventDefault();

    if (type === 'video') {
      setSelectedClipId(id);
      setSelectedAudioClipId(null);
      setSelectedTextClipId(null);
      setInspectorTab('video');
    } else if (type === 'audio') {
      setSelectedAudioClipId(id);
      setSelectedClipId('');
      setSelectedTextClipId(null);
      setInspectorTab('audio');
      setAudioInspectorMode('individual');
    } else {
      setSelectedTextClipId(id);
      setSelectedClipId('');
      setSelectedAudioClipId(null);
      setLeftNavTab('text');
    }

    const trackArea = timelineTracksRef.current;
    if (!trackArea) return;
    const rect = trackArea.getBoundingClientRect();
    const totalDur = Math.max(1, duration || 83);

    const initialClip = clipsRef.current.find(c => c.id === id);
    const initialAudio = audioClipsRef.current.find(a => a.id === id);
    const initialText = textClipsRef.current.find(t => t.id === id);

    const initStart = type === 'video' ? initialClip?.start ?? 0 : type === 'audio' ? initialAudio?.start ?? 0 : initialText?.start ?? 0;
    const initEnd = type === 'video' ? initialClip?.end ?? totalDur : type === 'audio' ? initialAudio?.end ?? totalDur : initialText?.end ?? totalDur;
    const initOffset = type === 'video' ? initialClip?.offset ?? 0 : type === 'audio' ? initialAudio?.offset ?? 0 : 0;
    const initSpeed = type === 'video' ? initialClip?.speed ?? 1 : type === 'audio' ? initialAudio?.speed ?? 1 : 1;
    const sourceDur = type === 'video'
      ? (initialClip ? getVideoClipSourceDuration(initialClip) : totalDur)
      : type === 'audio'
        ? (initialAudio ? getAudioClipSourceDuration(initialAudio) : totalDur)
        : totalDur;

    const onPointerMove = (moveEvt: PointerEvent) => {
      moveEvt.preventDefault();
      const offsetX = Math.max(0, Math.min(rect.width, moveEvt.clientX - rect.left));
      const rawTimeAtX = (offsetX / Math.max(1, rect.width)) * totalDur;

      const snap = calculateMagneticSnap(
        rawTimeAtX,
        id,
        rect.width,
        totalDur,
        edge === 'start' ? 'start' : 'end',
        0,
        snappingEnabledRef.current,
        currentTimeRef.current,
        clipsRef.current,
        audioClipsRef.current,
        textClipsRef.current
      );
      setActiveSnapLine(snap.snapGuide);
      const timeAtX = snap.snapGuide ? (edge === 'start' ? snap.finalStart : snap.finalEnd) : rawTimeAtX;

      if (type === 'video' || type === 'audio') {
        const { newStart, newEnd, newOffset, isAtLimit, currentDur } = clampTrimOffsetAndDuration(
          timeAtX,
          edge,
          initStart,
          initEnd,
          initOffset,
          initSpeed,
          sourceDur,
          totalDur
        );

        setActiveTrimming({
          id,
          type,
          edge,
          currentDuration: currentDur,
          maxDuration: sourceDur,
          isAtMaxLimit: isAtLimit
        });

        if (type === 'video') {
          setClips(prevClips =>
            prevClips.map(c => c.id !== id ? c : { ...c, start: newStart, end: newEnd, offset: newOffset, sourceDuration: sourceDur })
          );
        } else {
          setAudioClips(prevAudio =>
            prevAudio.map(a => a.id !== id ? a : { ...a, start: newStart, end: newEnd, offset: newOffset, sourceDuration: sourceDur })
          );
        }
        handleSeek(edge === 'start' ? newStart : newEnd);
      } else {
        const newStart = edge === 'start' ? Math.max(0, Math.min(initEnd - 0.2, timeAtX)) : initStart;
        const newEnd = edge === 'end' ? Math.max(initStart + 0.2, Math.min(totalDur, timeAtX)) : initEnd;
        setActiveTrimming({
          id,
          type: 'text',
          edge,
          currentDuration: newEnd - newStart,
          maxDuration: totalDur,
          isAtMaxLimit: false
        });
        setTextClips(prev =>
          prev.map(t => t.id !== id ? t : { ...t, start: newStart, end: newEnd })
        );
        handleSeek(edge === 'start' ? newStart : newEnd);
      }
    };

    const onPointerUp = () => {
      setActiveSnapLine(null);
      setActiveTrimming(null);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
  };

  // Unified Clip drag/move handler across Video, Audio and Text tracks
  const handleClipPointerDown = (
    e: React.PointerEvent<HTMLDivElement>,
    id: string,
    type: 'video' | 'audio' | 'text'
  ) => {
    const target = e.target as HTMLElement;
    if (target.closest('.trim-handle') || target.closest('button')) return;

    if (type === 'video') {
      setSelectedClipId(id);
      setSelectedAudioClipId(null);
      setSelectedTextClipId(null);
      setInspectorTab('video');
    } else if (type === 'audio') {
      setSelectedAudioClipId(id);
      setSelectedClipId('');
      setSelectedTextClipId(null);
      setInspectorTab('audio');
      setAudioInspectorMode('individual');
    } else {
      setSelectedTextClipId(id);
      setSelectedClipId('');
      setSelectedAudioClipId(null);
      setLeftNavTab('text');
    }

    const startX = e.clientX;
    const trackArea = timelineTracksRef.current;
    if (!trackArea) return;
    const rect = trackArea.getBoundingClientRect();
    const totalDur = Math.max(1, duration || 83);

    const clipEl = e.currentTarget;
    const origLeftPx = clipEl.offsetLeft;
    const clipWidthPx = clipEl.offsetWidth;
    const clipDurSec = (clipWidthPx / Math.max(1, rect.width)) * totalDur;

    let hasMoved = false;

    const onMove = (me: PointerEvent) => {
      const deltaX = me.clientX - startX;
      if (Math.abs(deltaX) > 2) hasMoved = true;
      if (!hasMoved) return;

      const rawLeftPx = Math.max(0, Math.min(rect.width - clipWidthPx, origLeftPx + deltaX));
      const rawStart = (rawLeftPx / Math.max(1, rect.width)) * totalDur;

      const snap = calculateMagneticSnap(
        rawStart,
        id,
        rect.width,
        totalDur,
        'both',
        clipDurSec,
        snappingEnabledRef.current,
        currentTimeRef.current,
        clipsRef.current,
        audioClipsRef.current,
        textClipsRef.current
      );
      setActiveSnapLine(snap.snapGuide);

      if (type === 'video') {
        setClips(prev =>
          prev.map(c => c.id !== id ? c : { ...c, start: snap.finalStart, end: snap.finalEnd })
        );
      } else if (type === 'audio') {
        setAudioClips(prev =>
          prev.map(a => a.id !== id ? a : { ...a, start: snap.finalStart, end: snap.finalEnd })
        );
      } else {
        setTextClips(prev =>
          prev.map(t => t.id !== id ? t : { ...t, start: snap.finalStart, end: snap.finalEnd })
        );
      }
      handleSeek(snap.finalStart);
    };

    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      setActiveSnapLine(null);
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  // Keyboard shortcut fine-trimming by delta (← / → arrow keys or buttons)
  const trimSelectedClipDelta = (edge: 'start' | 'end', delta: number) => {
    const totalDur = Math.max(1, duration || 83);
    if (selectedClipId) {
      setClips(prev => prev.map(c => {
        if (c.id !== selectedClipId) return c;
        const sourceDur = getVideoClipSourceDuration(c);
        const { start, end, offset } = computeTrimDelta(c, sourceDur, edge, delta, totalDur);
        return { ...c, start, end, offset, sourceDuration: sourceDur };
      }));
    } else if (selectedAudioClipId) {
      setAudioClips(prev => prev.map(a => {
        if (a.id !== selectedAudioClipId) return a;
        const sourceDur = getAudioClipSourceDuration(a);
        const { start, end, offset } = computeTrimDelta(a, sourceDur, edge, delta, totalDur);
        return { ...a, start, end, offset, sourceDuration: sourceDur };
      }));
    }
  };

  // Trim to playhead shortcut ('[' / ']' or contextual buttons)
  const trimSelectedClipToPlayhead = (edge: 'start' | 'end') => {
    const targetTime = currentTimeRef.current;
    const totalDur = Math.max(1, duration || 83);

    if (selectedClipId) {
      setClips(prev => prev.map(c => {
        if (c.id !== selectedClipId) return c;
        if (edge === 'start' && targetTime < c.end - 0.2) {
          const sourceDur = getVideoClipSourceDuration(c);
          const { start, offset } = computeTrimToPlayhead(c, sourceDur, 'start', targetTime, totalDur);
          return { ...c, start, offset, sourceDuration: sourceDur };
        } else if (edge === 'end' && targetTime > c.start + 0.2) {
          const sourceDur = getVideoClipSourceDuration(c);
          const { end } = computeTrimToPlayhead(c, sourceDur, 'end', targetTime, totalDur);
          return { ...c, end, sourceDuration: sourceDur };
        }
        return c;
      }));
    } else if (selectedAudioClipId) {
      setAudioClips(prev => prev.map(a => {
        if (a.id !== selectedAudioClipId) return a;
        if (edge === 'start' && targetTime < a.end - 0.2) {
          const sourceDur = getAudioClipSourceDuration(a);
          const { start, offset } = computeTrimToPlayhead(a, sourceDur, 'start', targetTime, totalDur);
          return { ...a, start, offset, sourceDuration: sourceDur };
        } else if (edge === 'end' && targetTime > a.start + 0.2) {
          const sourceDur = getAudioClipSourceDuration(a);
          const { end } = computeTrimToPlayhead(a, sourceDur, 'end', targetTime, totalDur);
          return { ...a, end, sourceDuration: sourceDur };
        }
        return a;
      }));
    }
  };

  const currentVideoAsset = projectAssets.find(a => a.type === 'video' && a.id === activeAssetId)
    || projectAssets.find(a => a.type === 'video')
    || (video ? { id: 'prop-video', name: video.name, type: 'video' as const, duration: video.duration || 60, durationStr: '', thumbnailUrl: video.url || '', url: video.url || '', isUploaded: true } : null);

  const getTabTitle = (tab: LeftSidebarTab) => {
    switch (tab) {
      case 'media': return editorT.sidebarTabs.media;
      case 'audio': return editorT.sidebarTabs.audio;
      case 'text': return editorT.sidebarTabs.text;
      case 'stickers': return editorT.sidebarTabs.stickers;
      case 'effects': return editorT.sidebarTabs.effects;
      case 'transitions': return editorT.sidebarTabs.transitions;
      case 'filters': return editorT.sidebarTabs.filters;
      case 'library': return editorT.sidebarTabs.library;
      default: return tab;
    }
  };

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
      onDrop={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
          processAndAddFiles(Array.from(e.dataTransfer.files));
        }
      }}
      className="fixed inset-0 w-screen h-screen bg-[#121316] text-slate-100 flex flex-col font-sans select-none overflow-hidden z-50"
    >
      {/* Shimmer animation for selected clips */}
      <style>{`
        @keyframes clip-shimmer {
          0%   { transform: translateX(-100%) skewX(-15deg); }
          100% { transform: translateX(300%) skewX(-15deg); }
        }
        .clip-shimmer-sweep {
          animation: clip-shimmer 1.4s ease-in-out infinite;
        }
      `}</style>
      {/* Hidden File Input for + Upload (Video & Audio, unlimited files) */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="video/*,audio/*,.mp4,.mov,.webm,.mkv,.avi,.3gp,.flv,.mp3,.wav,.ogg,.m4a,.aac,.flac"
        onChange={handleFileChange}
        className="hidden"
      />

      {/* Hidden File Input for Audio (unlimited files) */}
      <input
        ref={audioFileInputRef}
        type="file"
        multiple
        accept="audio/*,.mp3,.wav,.ogg,.m4a,.aac,.flac,.wma"
        onChange={handleAudioFileInputChange}
        className="hidden"
      />

      {/* Hidden Video element for decoding real video files */}
      <video
        ref={videoRef}
        src={currentVideoAsset?.url || ''}
        crossOrigin="anonymous"
        playsInline
        muted={Boolean(settings.removeAudio || settings.volume === 0 || isVideoAudioMuted)}
        onTimeUpdate={handleVideoTimeUpdate}
        onEnded={() => {
          setIsPlaying(false);
          if (audioPreviewRef.current && !audioPreviewRef.current.paused) {
            audioPreviewRef.current.pause();
          }
        }}
        className="hidden"
      />

      {/* Hidden Audio element for previewing background music */}
      <audio
        ref={audioPreviewRef}
        src={activeMusicUrl}
        crossOrigin="anonymous"
        playsInline
        muted={Boolean(settings.removeMusic || (settings.musicVolume ?? 100) === 0 || isMusicAudioMuted)}
        onEnded={() => {
          if (audioPreviewRef.current) {
            audioPreviewRef.current.currentTime = 0;
          }
        }}
        className="hidden"
      />

      {/* TOP HEADER BAR (Responsive CapCut Web Style) */}
      <EditorHeader
        projectName={projectName}
        setProjectName={setProjectName}
        saveStatus={saveStatus}
        lastSavedTime={lastSavedTime}
        handleManualSave={handleManualSave}
        setShowProjectsModal={setShowProjectsModal}
        handleExportProjectFile={handleExportProjectFile}
        handleNewBlankProject={handleNewBlankProject}
        mobileActiveSheet={mobileActiveSheet}
        setMobileActiveSheet={setMobileActiveSheet}
        setLeftNavTab={setLeftNavTab}
        lang={lang}
        onLanguageChange={onLanguageChange}
        videoThumbnail={videoThumbnail}
        setShowThumbnailModal={setShowThumbnailModal}
        setShowExportModal={setShowExportModal}
        isProcessing={isProcessing}
        onReset={onReset}
        editorT={editorT}
      />

      {/* MAIN WORKSPACE BODY */}
      <div className="flex-1 flex overflow-hidden relative">

        {/* 1. LEFTMOST ICON SIDEBAR (Desktop: Media, Stock, Audio, Text, Stickers, Effects, Transitions, Filters) */}
        <LeftSidebar
          leftNavTab={leftNavTab}
          setLeftNavTab={setLeftNavTab}
          isAssetDrawerOpen={isAssetDrawerOpen}
          setIsAssetDrawerOpen={setIsAssetDrawerOpen}
          setShowShortcutsModal={setShowShortcutsModal}
          editorT={editorT}
        />

        {/* 2. MEDIA / ASSET / TOOL DRAWER (Desktop & Mobile Bottom Sheet) */}
        <AssetDrawer
          isAssetDrawerOpen={isAssetDrawerOpen}
          setIsAssetDrawerOpen={setIsAssetDrawerOpen}
          mobileActiveSheet={mobileActiveSheet}
          setMobileActiveSheet={setMobileActiveSheet}
          leftNavTab={leftNavTab}
          editorT={editorT}
          lang={lang}
          assetTab={assetTab}
          setAssetTab={setAssetTab}
          projectAssets={projectAssets}
          activeAssetId={activeAssetId}
          setActiveAssetId={setActiveAssetId}
          setProjectName={setProjectName}
          handleUploadClick={handleUploadClick}
          handleAudioUploadClick={handleAudioUploadClick}
          handleRefreshAssets={handleRefreshAssets}
          handleDeleteAsset={handleDeleteAsset}
          handleAddAssetToTimeline={handleAddAssetToTimeline}
          togglePreviewAudio={togglePreviewAudio}
          previewingAudioId={previewingAudioId}
          activeBgmName={activeBgmName}
          clips={clips}
          setClips={setClips}
          updateClip={updateClip}
          selectedClipId={selectedClipId}
          audioClips={audioClips}
          updateAudioClip={updateAudioClip}
          isVideoAudioMuted={isVideoAudioMuted}
          setIsVideoAudioMuted={setIsVideoAudioMuted}
          toggleVideoAudioMute={toggleVideoAudioMute}
          isMusicAudioMuted={isMusicAudioMuted}
          setIsMusicAudioMuted={setIsMusicAudioMuted}
          toggleMusicAudioMute={toggleMusicAudioMute}
          settings={settings}
          pushSettingsChange={pushSettingsChange}
          textClips={textClips}
          setTextClips={setTextClips}
          selectedTextClipId={selectedTextClipId}
          setSelectedTextClipId={setSelectedTextClipId}
          stickers={stickers}
          setStickers={setStickers}
          selectedStickerId={selectedStickerId}
          setSelectedStickerId={setSelectedStickerId}
          currentTime={currentTime}
          duration={duration}
          activeEffect={activeEffect}
          setActiveEffect={setActiveEffect}
          activeTransition={activeTransition}
          setActiveTransition={setActiveTransition}
          transitionPickerClipId={transitionPickerClipId}
          setTransitionPickerClipId={setTransitionPickerClipId}
        />

        {/* 3. CENTER COLUMN: PLAYER VIEWPORT & BOTTOM MULTI-TRACK TIMELINE */}
        <div className="flex-1 flex flex-col overflow-hidden bg-[#121316]">

          {/* Player Viewport & Deck */}
          <VideoPlayerMonitor
            editorT={editorT}
            lang={lang}
            playerMonitorWrapperRef={playerMonitorWrapperRef}
            canvasPreviewRef={canvasPreviewRef}
            clips={clips}
            selectedStickerId={selectedStickerId}
            setSelectedStickerId={setSelectedStickerId}
            togglePlay={togglePlay}
            handleUploadClick={handleUploadClick}
            stickers={stickers}
            setStickers={setStickers}
            pushSettingsChange={pushSettingsChange}
            currentTime={currentTime}
            duration={duration}
            canvasDisplaySize={canvasDisplaySize}
            isPlaying={isPlaying}
            showOriginal={showOriginal}
            setShowOriginal={setShowOriginal}
            handleSeek={handleSeek}
            settings={settings}
            setShowThumbnailModal={setShowThumbnailModal}
            videoThumbnail={videoThumbnail}
            setShowShortcutsModal={setShowShortcutsModal}
          />

          {/* BOTTOM MULTI-TRACK TIMELINE DECK */}
          <TimelineWorkspace
            editorT={editorT}
            history={history}
            historyIndex={historyIndex}
            handleUndo={handleUndo}
            handleRedo={handleRedo}
            handleSplitClip={handleSplitClip}
            handleDelete={handleDelete}
            handleRippleDelete={handleRippleDelete}
            rippleMode={rippleMode}
            setRippleMode={setRippleMode}
            trimSelectedClipDelta={trimSelectedClipDelta}
            trimSelectedClipToPlayhead={trimSelectedClipToPlayhead}
            snappingEnabled={snappingEnabled}
            setSnappingEnabled={setSnappingEnabled}
            showAudioWaveforms={showAudioWaveforms}
            setShowAudioWaveforms={setShowAudioWaveforms}
            timelineZoom={timelineZoom}
            setTimelineZoom={setTimelineZoom}
            videoTracks={videoTracks}
            audioTracks={audioTracks}
            video={video}
            settings={settings}
            isVideoAudioMuted={isVideoAudioMuted}
            getVideoClipSourceDuration={getVideoClipSourceDuration}
            clips={clips}
            setClips={setClips}
            selectedClipId={selectedClipId}
            setSelectedClipId={setSelectedClipId}
            updateClip={updateClip}
            audioClips={audioClips}
            setAudioClips={setAudioClips}
            selectedAudioClipId={selectedAudioClipId}
            setSelectedAudioClipId={setSelectedAudioClipId}
            updateAudioClip={updateAudioClip}
            textClips={textClips}
            setTextClips={setTextClips}
            selectedTextClipId={selectedTextClipId}
            setSelectedTextClipId={setSelectedTextClipId}
            addVideoTrack={addVideoTrack}
            addAudioTrack={addAudioTrack}
            toggleVideoTrackHide={toggleVideoTrackHide}
            toggleVideoTrackMute={toggleVideoTrackMute}
            deleteVideoTrack={deleteVideoTrack}
            toggleAudioTrackMute={toggleAudioTrackMute}
            deleteAudioTrack={deleteAudioTrack}
            setLeftNavTab={setLeftNavTab}
            setIsAssetDrawerOpen={setIsAssetDrawerOpen}
            setTransitionPickerClipId={setTransitionPickerClipId}
            handleUploadClick={handleUploadClick}
            handleAudioUploadClick={handleAudioUploadClick}
            currentTime={currentTime}
            duration={duration}
            activeSnapLine={activeSnapLine}
            activeTrimming={activeTrimming}
            timelineTracksRef={timelineTracksRef}
            handleTimelinePointerDown={handleTimelinePointerDown}
            handleClipPointerDown={handleClipPointerDown}
            handleTrimPointerDown={handleTrimPointerDown}
          />
        </div>

        {/* 4. RIGHT INSPECTOR / PROPERTIES PANEL (Desktop: Video, Audio, Speed, Animation & Mobile Bottom Sheet) */}
        <InspectorPanel
          mobileActiveSheet={mobileActiveSheet}
          setMobileActiveSheet={setMobileActiveSheet}
          editorT={editorT}
          inspectorTab={inspectorTab}
          setInspectorTab={setInspectorTab}
          videoSubTab={videoSubTab}
          setVideoSubTab={setVideoSubTab}
          settings={settings}
          pushSettingsChange={pushSettingsChange}
          resetPositionAndSize={resetPositionAndSize}
          resetBlend={resetBlend}
          chromaKey={chromaKey}
          setChromaKey={setChromaKey}
          audioInspectorMode={audioInspectorMode}
          setAudioInspectorMode={setAudioInspectorMode}
          clips={clips}
          selectedClipId={selectedClipId}
          setSelectedClipId={setSelectedClipId}
          updateClip={updateClip}
          audioClips={audioClips}
          selectedAudioClipId={selectedAudioClipId}
          setSelectedAudioClipId={setSelectedAudioClipId}
          setSelectedTextClipId={setSelectedTextClipId}
          updateAudioClip={updateAudioClip}
          setAudioClips={setAudioClips}
          onUploadAudio={handleAudioUploadClick}
          isVideoAudioMuted={isVideoAudioMuted}
          setIsVideoAudioMuted={setIsVideoAudioMuted}
          toggleVideoAudioMute={toggleVideoAudioMute}
          isMusicAudioMuted={isMusicAudioMuted}
          setIsMusicAudioMuted={setIsMusicAudioMuted}
          toggleMusicAudioMute={toggleMusicAudioMute}
          activeEffect={activeEffect}
          setActiveEffect={setActiveEffect}
          setActiveTransition={setActiveTransition}
        />

      </div>

      {/* Mobile Backdrop for Bottom Sheets */}
      {mobileActiveSheet && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-xs z-40 md:hidden animate-in fade-in duration-200"
          onClick={() => setMobileActiveSheet(null)}
        />
      )}

      {/* MOBILE BOTTOM TOOLBAR / DOCK (CapCut Mobile Layout) */}
      <div className="h-14 bg-[#0f1118] border-t border-[#222733] flex items-center px-1 shrink-0 z-30 select-none overflow-x-auto no-scrollbar md:hidden">
        {selectedClipId || selectedAudioClipId ? (
          /* Contextual Action Bar for Selected Clip */
          <div className="flex items-center justify-around w-full gap-1 px-1">
            <button
              type="button"
              onClick={handleSplitClip}
              className="flex-1 py-1.5 px-1 rounded-lg bg-[#1a202d] hover:bg-[#252c3d] text-teal-300 flex flex-col items-center justify-center text-[10px] font-bold transition-colors cursor-pointer"
            >
              <span className="font-mono text-xs">][</span>
              <span>{editorT.timeline.split}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setInspectorTab('speed');
                setMobileActiveSheet('inspector');
              }}
              className="flex-1 py-1.5 px-1 rounded-lg bg-[#1a202d] hover:bg-[#252c3d] text-slate-200 flex flex-col items-center justify-center text-[10px] font-semibold transition-colors cursor-pointer"
            >
              <Zap className="w-3.5 h-3.5 text-amber-400 mb-0.5" />
              <span>{editorT.inspector.tabs.speed}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setInspectorTab('audio');
                setMobileActiveSheet('inspector');
              }}
              className="flex-1 py-1.5 px-1 rounded-lg bg-[#1a202d] hover:bg-[#252c3d] text-slate-200 flex flex-col items-center justify-center text-[10px] font-semibold transition-colors cursor-pointer"
            >
              <Volume2 className="w-3.5 h-3.5 text-sky-400 mb-0.5" />
              <span>{editorT.inspector.tabs.audio}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setLeftNavTab('filters');
                setMobileActiveSheet('filters');
              }}
              className="flex-1 py-1.5 px-1 rounded-lg bg-[#1a202d] hover:bg-[#252c3d] text-slate-200 flex flex-col items-center justify-center text-[10px] font-semibold transition-colors cursor-pointer"
            >
              <Palette className="w-3.5 h-3.5 text-pink-400 mb-0.5" />
              <span>{editorT.sidebarTabs.filters}</span>
            </button>

            <button
              type="button"
              onClick={handleDelete}
              className="flex-1 py-1.5 px-1 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 text-rose-400 flex flex-col items-center justify-center text-[10px] font-semibold transition-colors cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5 mb-0.5" />
              <span>{editorT.timeline.delete}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setSelectedClipId('');
                setSelectedAudioClipId(null);
              }}
              className="py-1.5 px-2 rounded-lg bg-[#161a24] text-slate-400 hover:text-white flex flex-col items-center justify-center text-[10px] cursor-pointer"
              title="Deselect"
            >
              <X className="w-3.5 h-3.5 mb-0.5" />
              <span>✕</span>
            </button>
          </div>
        ) : (
          /* Standard Mobile Bottom Tools (Media, Audio, Text, Stickers, Effects, Filters, Adjust) */
          <div className="flex items-center gap-1 min-w-full justify-around px-1">
            <button
              type="button"
              onClick={() => {
                setLeftNavTab('media');
                setMobileActiveSheet(prev => (prev === 'media' ? null : 'media'));
              }}
              className={`flex-1 py-1 px-1 rounded-lg flex flex-col items-center justify-center text-[10px] transition-colors cursor-pointer ${
                mobileActiveSheet === 'media' ? 'text-[#00c5d4] bg-[#1a1f2c]' : 'text-slate-400 hover:text-white'
              }`}
            >
              <FolderOpen className="w-4 h-4 mb-0.5 stroke-[2]" />
              <span className="truncate max-w-[48px]">{editorT.sidebarTabs.media}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setLeftNavTab('audio');
                setMobileActiveSheet(prev => (prev === 'audio' ? null : 'audio'));
              }}
              className={`flex-1 py-1 px-1 rounded-lg flex flex-col items-center justify-center text-[10px] transition-colors cursor-pointer ${
                mobileActiveSheet === 'audio' ? 'text-[#00c5d4] bg-[#1a1f2c]' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Music className="w-4 h-4 mb-0.5 stroke-[2]" />
              <span className="truncate max-w-[48px]">{editorT.sidebarTabs.audio}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setLeftNavTab('text');
                setMobileActiveSheet(prev => (prev === 'text' ? null : 'text'));
              }}
              className={`flex-1 py-1 px-1 rounded-lg flex flex-col items-center justify-center text-[10px] transition-colors cursor-pointer ${
                mobileActiveSheet === 'text' ? 'text-[#00c5d4] bg-[#1a1f2c]' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Type className="w-4 h-4 mb-0.5 stroke-[2]" />
              <span className="truncate max-w-[48px]">{editorT.sidebarTabs.text}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setLeftNavTab('stickers');
                setMobileActiveSheet(prev => (prev === 'stickers' ? null : 'stickers'));
              }}
              className={`flex-1 py-1 px-1 rounded-lg flex flex-col items-center justify-center text-[10px] transition-colors cursor-pointer ${
                mobileActiveSheet === 'stickers' ? 'text-[#00c5d4] bg-[#1a1f2c]' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Smile className="w-4 h-4 mb-0.5 stroke-[2]" />
              <span className="truncate max-w-[48px]">{editorT.sidebarTabs.stickers}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setLeftNavTab('effects');
                setMobileActiveSheet(prev => (prev === 'effects' ? null : 'effects'));
              }}
              className={`flex-1 py-1 px-1 rounded-lg flex flex-col items-center justify-center text-[10px] transition-colors cursor-pointer ${
                mobileActiveSheet === 'effects' ? 'text-[#00c5d4] bg-[#1a1f2c]' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Star className="w-4 h-4 mb-0.5 stroke-[2]" />
              <span className="truncate max-w-[48px]">{editorT.sidebarTabs.effects}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setLeftNavTab('filters');
                setMobileActiveSheet(prev => (prev === 'filters' ? null : 'filters'));
              }}
              className={`flex-1 py-1 px-1 rounded-lg flex flex-col items-center justify-center text-[10px] transition-colors cursor-pointer ${
                mobileActiveSheet === 'filters' ? 'text-[#00c5d4] bg-[#1a1f2c]' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Palette className="w-4 h-4 mb-0.5 stroke-[2]" />
              <span className="truncate max-w-[48px]">{editorT.sidebarTabs.filters}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setInspectorTab('video');
                setMobileActiveSheet(prev => (prev === 'inspector' ? null : 'inspector'));
              }}
              className={`flex-1 py-1 px-1 rounded-lg flex flex-col items-center justify-center text-[10px] transition-colors cursor-pointer ${
                mobileActiveSheet === 'inspector' ? 'text-[#00c5d4] bg-[#1a1f2c]' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Sliders className="w-4 h-4 mb-0.5 stroke-[2]" />
              <span className="truncate max-w-[48px]">{editorT.header.adjustMobile}</span>
            </button>
          </div>
        )}
      </div>

      {/* EXPORT / PROGRESS MODAL */}
      <ExportProgressModal
        isProcessing={isProcessing}
        progressMsg={progressMsg}
        progressPercent={progressPercent}
        renderTitle={editorT.modals.renderTitle}
        renderDesc={editorT.modals.renderDesc}
      />

      {/* EXPORT ERROR MODAL */}
      <ExportErrorModal
        exportError={exportError}
        isProcessing={isProcessing}
        onDismiss={() => setExportError(null)}
        onRetry={() => { setExportError(null); handleExport(activeExportConfig); }}
      />

      {/* DOWNLOAD MODAL WHEN COMPLETE */}
      <DownloadCompleteModal
        editedResultUrl={editedResultUrl}
        activeExportConfig={activeExportConfig}
        projectName={projectName}
        onClose={() => setEditedResultUrl(null)}
        renderCompleteTitle={editorT.modals.renderCompleteTitle}
        renderCompleteDesc={editorT.modals.renderCompleteDesc}
        downloadBtnText={editorT.modals.downloadBtn}
        closeBtnText={editorT.modals.closeBtn}
        thumbnailData={videoThumbnail}
      />

      {/* THUMBNAIL STUDIO MODAL (Video Muqovasi) */}
      <ThumbnailModal
        isOpen={showThumbnailModal}
        onClose={() => setShowThumbnailModal(false)}
        currentThumbnail={videoThumbnail}
        onSaveThumbnail={(thumb) => {
          setVideoThumbnail(thumb);
          pushSettingsChange(ps => ({
            ...ps,
            thumbnailUrl: thumb?.dataUrl,
            thumbnailTime: thumb?.timestamp
          }));
        }}
        onCaptureFrame={handleCaptureCanvasFrame}
        currentTime={currentTime}
        duration={duration}
        onSeek={handleSeek}
        aspectRatio={settings.aspectRatio || '16:9'}
        projectName={projectName}
        lang={lang}
        t={editorT}
      />

      {/* EXPORT SETTINGS MODAL (Format, Quality, FPS, Bitrate, File Name) */}
      <ExportSettingsModal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        onConfirm={handleExport}
        duration={exportTimelineSpan}
        aspectRatio={settings.aspectRatio || '16:9'}
        defaultProjectName={projectName}
        lang={lang}
        isProcessing={isProcessing}
      />

      {/* KEYBOARD SHORTCUTS MODAL */}
      <KeyboardShortcutsModal
        isOpen={showShortcutsModal}
        onClose={() => setShowShortcutsModal(false)}
        shortcutsTitle={editorT.modals.shortcutsTitle}
        shortcuts={editorT.modals.shortcuts}
        gotItText={editorT.modals.gotIt}
      />

      {/* SAVED PROJECTS MODAL */}
      <SavedProjectsModal
        isOpen={showProjectsModal}
        onClose={() => setShowProjectsModal(false)}
        currentProjectId={currentProjectIdRef.current}
        onOpenProject={(pId) => {
          handleLoadProject(pId);
          setShowProjectsModal(false);
        }}
        onNewBlankProject={() => {
          handleNewBlankProject();
          setShowProjectsModal(false);
        }}
        onProjectImported={(proj) => {
          handleLoadProject(proj.id);
          setShowProjectsModal(false);
        }}
        lang={lang}
      />
    </div>
  );
};
