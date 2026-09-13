import React, { useState, useRef, useEffect, useCallback } from 'react';
import { VideoFile, SubtitleCue, SubtitleStyleConfig } from '../types';
import { TranslationSchema } from '../translations';
import {
  Subtitles, Sparkles, Play, HelpCircle,
  Globe, RefreshCw, Eye, Check,
  AlertCircle, X, Sliders, Upload, Minimize2, Maximize2
} from 'lucide-react';
import { VideoPlayerCard } from '../components/VideoPlayerCard';
import confetti from 'canvas-confetti';
import { processVideoSubtitles } from '../lib/mediaProcessor';
import { memoryManager } from '../lib/memoryManager';
import {
  WHISPER_SUPPORTED_LANGUAGES,
  generateSubtitlesWithWhisper,
  exportToSrt,
  exportToVtt,
  parseSrtOrVtt,
  formatSecondsToSrtTime,
  analyzeVideoVoiceTimeline
} from '../services/whisperSubtitleEngine';
import { alignCuesToVoiceAudio, computeCueWords } from '../services/voiceActivityDetector';
import { getSubtitlesTranslation } from '../translations/subtitlesTranslations';
import { DEFAULT_STYLE_PRESETS, formatTimeMinutesSeconds } from './subtitles/subtitleConstants';
import { SubtitleOverlay } from './subtitles/SubtitleOverlay';
import { SubtitleScrubberOverlay } from './subtitles/SubtitleScrubberOverlay';
import { SubtitleNavPanel } from './subtitles/SubtitleNavPanel';
import { SubtitleCueList } from './subtitles/SubtitleCueList';
import { SubtitleStylePanel } from './subtitles/SubtitleStylePanel';
import { LanguageInfoModal } from './subtitles/LanguageInfoModal';

interface SubtitlesToolProps {
  video: VideoFile;
  onReset: () => void;
  t: TranslationSchema;
  lang?: string;
}

export const SubtitlesTool: React.FC<SubtitlesToolProps> = ({ video, onReset, t, lang = 'uz' }) => {
  const st = getSubtitlesTranslation(lang);

  // Cues state
  const [cues, setCues] = useState<SubtitleCue[]>([]);
  const [selectedLanguage, setSelectedLanguage] = useState<string>(
    WHISPER_SUPPORTED_LANGUAGES.some(l => l.code === lang) ? lang : 'auto'
  );

  useEffect(() => {
    if (lang && WHISPER_SUPPORTED_LANGUAGES.some(l => l.code === lang)) {
      setSelectedLanguage(lang);
    }
  }, [lang]);

  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcribeMsg, setTranscribeMsg] = useState('');
  const [transcribePercent, setTranscribePercent] = useState<number>(0);
  const [transcribeError, setTranscribeError] = useState<string | null>(null);

  // Voice & TTS Audio Timeline Sync State
  const [voiceTimeline, setVoiceTimeline] = useState<{
    hasSpeech: boolean;
    introMusicDuration: number;
    firstSpeechStart: number;
    speechSegmentsCount: number;
  } | null>(null);
  const [isSyncingAudio, setIsSyncingAudio] = useState(false);
  const [syncStatusMsg, setSyncStatusMsg] = useState('');
  const [totalDelayOffset, setTotalDelayOffset] = useState<number>(0);
  const [syncFeedback, setSyncFeedback] = useState<string | null>(null);

  // Style state with audio-synced animation and free positioning
  const [style, setStyle] = useState<SubtitleStyleConfig>({
    preset: 'tiktok',
    fontSize: 32,
    textColor: '#ffffff',
    bgColor: 'dark',
    position: 'bottom',
    xOffsetPercent: 50,
    yOffsetPercent: 84,
    align: 'center',
    animation: 'karaoke', // Audio-synced word highlight by default
    highlightColor: '#facc15', // Vibrant yellow highlight
    fontFamily: 'sans',
    letterSpacing: 0,
    lineHeight: 1.35,
    maxWidthPercent: 85,
    borderRadius: 12,
    boxPadding: 8,
    uppercase: false,
    stroke: true,
    strokeColor: '#000000',
  });

  // Dragging state for subtitle on video preview
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{ startX: number; startY: number; startOffsetX: number; startOffsetY: number } | null>(null);

  // Video playback & active subtitle sync
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState<number>(() => (video.duration && !isNaN(video.duration) ? video.duration : 0));
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackRate, setPlaybackRate] = useState<number>(1);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [isSeeking, setIsSeeking] = useState<boolean>(false);
  const [hoverSeekTime, setHoverSeekTime] = useState<number | null>(null);
  const [hoverSeekPos, setHoverSeekPos] = useState<number>(0);
  const [removeAudio, setRemoveAudio] = useState(false);

  // Burning export state
  const [isBurning, setIsBurning] = useState(false);
  const [burnProgressMsg, setBurnProgressMsg] = useState('');
  const [burnedVideoUrl, setBurnedVideoUrl] = useState<string | null>(null);

  // Modals & views
  const [showLanguageInfoModal, setShowLanguageInfoModal] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isTheaterMode, setIsTheaterMode] = useState(false);

  // Refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const stageWrapperRef = useRef<HTMLDivElement>(null);
  const scrubberTrackRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Dragging handlers for free interactive subtitle placement
  const handleDragStart = (e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    setIsDragging(true);
    dragStartRef.current = {
      startX: clientX,
      startY: clientY,
      startOffsetX: style.xOffsetPercent ?? 50,
      startOffsetY: style.yOffsetPercent ?? 84,
    };
  };

  useEffect(() => {
    const handleMove = (e: MouseEvent | TouchEvent) => {
      if (!isDragging || !dragStartRef.current || !stageWrapperRef.current) return;
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
      const rect = stageWrapperRef.current.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;

      const deltaXPercent = ((clientX - dragStartRef.current.startX) / rect.width) * 100;
      const deltaYPercent = ((clientY - dragStartRef.current.startY) / rect.height) * 100;

      const newX = Math.max(5, Math.min(95, Math.round(dragStartRef.current.startOffsetX + deltaXPercent)));
      const newY = Math.max(5, Math.min(95, Math.round(dragStartRef.current.startOffsetY + deltaYPercent)));

      setStyle(prev => ({
        ...prev,
        xOffsetPercent: newX,
        yOffsetPercent: newY,
        position: 'custom',
      }));
    };

    const handleUp = () => {
      if (isDragging) {
        setIsDragging(false);
        dragStartRef.current = null;
      }
    };

    if (isDragging) {
      window.addEventListener('mousemove', handleMove);
      window.addEventListener('touchmove', handleMove);
      window.addEventListener('mouseup', handleUp);
      window.addEventListener('touchend', handleUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('touchmove', handleMove);
      window.removeEventListener('mouseup', handleUp);
      window.removeEventListener('touchend', handleUp);
    };
  }, [isDragging]);

  // Clean up object URLs
  useEffect(() => {
    return () => {
      if (burnedVideoUrl && burnedVideoUrl !== video.url) {
        memoryManager.safeRevokeObjectURL(burnedVideoUrl);
      }
    };
  }, [burnedVideoUrl, video.url]);

  // Fullscreen change listener
  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    document.addEventListener('webkitfullscreenchange', handleFsChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFsChange);
      document.removeEventListener('webkitfullscreenchange', handleFsChange);
    };
  }, []);

  // Effective video duration
  const totalDuration = duration > 0 ? duration : (video.duration > 0 ? video.duration : 1);

  // 60 FPS High-Frequency Playback Clock for Seamless Audio & Word Sync
  useEffect(() => {
    let animId: number;
    const updateLoop = () => {
      if (videoRef.current && !videoRef.current.paused && !isSeeking) {
        setCurrentTime(videoRef.current.currentTime);
        animId = requestAnimationFrame(updateLoop);
      }
    };

    if (isPlaying && !isSeeking) {
      animId = requestAnimationFrame(updateLoop);
    }

    return () => {
      if (animId) cancelAnimationFrame(animId);
    };
  }, [isPlaying, isSeeking]);

  // Time update listener
  const handleTimeUpdate = () => {
    if (videoRef.current && !isSeeking) {
      setCurrentTime(videoRef.current.currentTime);
    }
  };

  const handlePlayPause = () => {
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      videoRef.current.play().catch(() => {});
      setIsPlaying(true);
    } else {
      videoRef.current.pause();
      setIsPlaying(false);
    }
  };

  const seekToTime = (time: number, autoPlay: boolean = false) => {
    if (videoRef.current) {
      const maxDur = duration > 0 ? duration : (video.duration > 0 ? video.duration : 0);
      const targetTime = Math.max(0, maxDur > 0 ? Math.min(time, maxDur) : time);
      videoRef.current.currentTime = targetTime;
      setCurrentTime(targetTime);
      if (autoPlay && videoRef.current.paused) {
        videoRef.current.play().catch(() => {});
        setIsPlaying(true);
      }
    }
  };

  const jumpTime = (deltaSec: number) => {
    const maxDur = duration > 0 ? duration : (video.duration > 0 ? video.duration : 0);
    const targetTime = Math.max(0, Math.min(maxDur, currentTime + deltaSec));
    seekToTime(targetTime);
  };

  const jumpToPrevCue = () => {
    if (cues.length === 0) {
      seekToTime(Math.max(0, currentTime - 5));
      return;
    }
    const sorted = [...cues].sort((a, b) => a.startTime - b.startTime);
    const prev = [...sorted].reverse().find(c => c.startTime < currentTime - 0.25);
    if (prev) {
      seekToTime(prev.startTime);
    } else {
      seekToTime(0);
    }
  };

  const jumpToNextCue = () => {
    if (cues.length === 0) {
      const maxDur = duration > 0 ? duration : (video.duration > 0 ? video.duration : 0);
      seekToTime(Math.min(maxDur, currentTime + 5));
      return;
    }
    const sorted = [...cues].sort((a, b) => a.startTime - b.startTime);
    const next = sorted.find(c => c.startTime > currentTime + 0.15);
    if (next) {
      seekToTime(next.startTime);
    } else {
      const maxDur = duration > 0 ? duration : (video.duration > 0 ? video.duration : 0);
      seekToTime(maxDur);
    }
  };

  const handleSpeedChange = (rate: number) => {
    setPlaybackRate(rate);
    if (videoRef.current) {
      videoRef.current.playbackRate = rate;
    }
  };

  const handleToggleMute = () => {
    if (videoRef.current) {
      const nextMute = !isMuted;
      videoRef.current.muted = nextMute;
      setIsMuted(nextMute);
    }
  };

  // Interactive scrubber timeline handlers
  const calcScrubTime = useCallback((clientX: number) => {
    if (!scrubberTrackRef.current) return 0;
    const rect = scrubberTrackRef.current.getBoundingClientRect();
    if (rect.width <= 0) return 0;
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const maxDur = duration > 0 ? duration : (video.duration > 0 ? video.duration : 1);
    return ratio * maxDur;
  }, [duration, video.duration]);

  const handleScrubberPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsSeeking(true);
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch (_) {}
    const target = calcScrubTime(e.clientX);
    seekToTime(target);
  };

  const handleScrubberPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (scrubberTrackRef.current) {
      const rect = scrubberTrackRef.current.getBoundingClientRect();
      if (rect.width > 0) {
        const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        const maxDur = duration > 0 ? duration : (video.duration > 0 ? video.duration : 1);
        setHoverSeekTime(ratio * maxDur);
        setHoverSeekPos(ratio * 100);
      }
    }
    if (isSeeking) {
      e.preventDefault();
      const target = calcScrubTime(e.clientX);
      seekToTime(target);
    }
  };

  const handleScrubberPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isSeeking) {
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch (_) {}
      setIsSeeking(false);
      const target = calcScrubTime(e.clientX);
      seekToTime(target);
    }
  };

  const handleScrubberPointerLeave = () => {
    if (!isSeeking) {
      setHoverSeekTime(null);
    }
  };

  // Keyboard navigation shortcuts: Space, Arrows, Home/End, J/K/L
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable ||
        target.tagName === 'SELECT'
      ) {
        return;
      }

      if (e.code === 'Space') {
        e.preventDefault();
        handlePlayPause();
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        const step = e.shiftKey ? 1 : 5;
        seekToTime(Math.max(0, currentTime - step));
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        const maxDur = duration > 0 ? duration : (video.duration > 0 ? video.duration : 0);
        const step = e.shiftKey ? 1 : 5;
        seekToTime(Math.min(maxDur, currentTime + step));
      } else if (e.code === 'Home') {
        e.preventDefault();
        seekToTime(0);
      } else if (e.code === 'End') {
        e.preventDefault();
        const maxDur = duration > 0 ? duration : (video.duration > 0 ? video.duration : 0);
        seekToTime(maxDur);
      } else if (e.key === 'j' || e.key === 'J') {
        seekToTime(Math.max(0, currentTime - 10));
      } else if (e.key === 'l' || e.key === 'L') {
        const maxDur = duration > 0 ? duration : (video.duration > 0 ? video.duration : 0);
        seekToTime(Math.min(maxDur, currentTime + 10));
      } else if (e.key === 'k' || e.key === 'K') {
        handlePlayPause();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentTime, duration, video.duration, isPlaying]);

  // Find active cue for current playback time
  const activeCue = cues.find(c => currentTime >= c.startTime && currentTime <= c.endTime) || null;
  const hoverCue = hoverSeekTime !== null ? (cues.find(c => hoverSeekTime >= c.startTime && hoverSeekTime <= c.endTime) || null) : null;

  // 1. Generate Subtitles with Exact Voice/TTS Timeline Synchronization
  const handleGenerateSubtitles = async () => {
    setIsTranscribing(true);
    setTranscribeError(null);
    setTranscribePercent(5);
    setTranscribeMsg(st.generator.readingAudio);
    try {
      const effectiveLang = selectedLanguage && selectedLanguage !== 'auto' ? selectedLanguage : lang;
      const generated = await generateSubtitlesWithWhisper(
        video.url,
        video.duration,
        effectiveLang,
        (progress, msg) => {
          setTranscribePercent(progress);
          setTranscribeMsg(msg);
        }
      );
      setCues(generated);

      // Determine intro & voice onset from generated cues
      if (generated.length > 0) {
        const firstStart = generated[0].startTime;
        setVoiceTimeline({
          hasSpeech: true,
          introMusicDuration: firstStart,
          firstSpeechStart: firstStart,
          speechSegmentsCount: generated.length,
        });
      }

      setTranscribePercent(100);
      confetti({ particleCount: 60, spread: 70, origin: { y: 0.6 } });
    } catch (err: any) {
      console.error('Subtitle generation error:', err);
      const msg = err?.message || st.generator.generateError;
      setTranscribeError(msg);
    } finally {
      setIsTranscribing(false);
      setTranscribeMsg('');
    }
  };

  // Auto-Sync existing/imported cues to Voice Audio & TTS Timestamps
  const handleAutoSyncToVoice = async () => {
    if (cues.length === 0) return;
    setIsSyncingAudio(true);
    setSyncStatusMsg(st.introSync.analyzingVad);
    try {
      const vad = await analyzeVideoVoiceTimeline(video.url, (pct, msg) => {
        setSyncStatusMsg(`${msg} (${pct}%)`);
      });

      setVoiceTimeline({
        hasSpeech: vad.hasSpeech,
        introMusicDuration: vad.introMusicDuration,
        firstSpeechStart: vad.firstSpeechStart,
        speechSegmentsCount: vad.speechSegments.length,
      });

      const aligned = alignCuesToVoiceAudio(cues, vad);
      setCues(aligned);
      setTotalDelayOffset(0);
      confetti({ particleCount: 50, spread: 60 });
      setSyncFeedback(`${st.introSync.vadSuccess} (${vad.firstSpeechStart.toFixed(2)}s)`);
      setTimeout(() => setSyncFeedback(null), 4000);
    } catch (err: any) {
      console.error('Audio sync error:', err);
      alert(st.generator.generateError);
    } finally {
      setIsSyncingAudio(false);
      setSyncStatusMsg('');
    }
  };

  // 2. Add New Cue
  const handleAddCue = () => {
    const newStart = Number(currentTime.toFixed(1));
    const newEnd = Number((currentTime + 3.0).toFixed(1));
    const newCue: SubtitleCue = {
      id: `cue-${Date.now()}`,
      startTime: newStart,
      endTime: newEnd,
      text: st.actions.newCueText
    };
    setCues(prev => [...prev, newCue].sort((a, b) => a.startTime - b.startTime));
  };

  // 3. Edit Cue
  const handleUpdateCue = (id: string, field: 'startTime' | 'endTime' | 'text', val: any) => {
    setCues(prev => prev.map(c => {
      if (c.id !== id) return c;
      return { ...c, [field]: val };
    }));
  };

  // 4. Delete Cue
  const handleDeleteCue = (id: string) => {
    setCues(prev => prev.filter(c => c.id !== id));
  };

  // 5. Presets with animations and typography
  const applyPreset = (presetName: SubtitleStyleConfig['preset']) => {
    const preset = DEFAULT_STYLE_PRESETS[presetName];
    if (preset) {
      setStyle(prev => ({
        ...prev,
        ...preset,
      }));
    }
  };

  // Quick 9-point placement handler
  const handleQuickPosition = (xPct: number, yPct: number, posName: 'top' | 'middle' | 'bottom' | 'custom') => {
    setStyle(prev => ({
      ...prev,
      xOffsetPercent: xPct,
      yOffsetPercent: yPct,
      position: posName,
    }));
  };

  // Synchronize audio offset (+/- seconds)
  const handleShiftAllTime = (deltaSec: number) => {
    if (cues.length === 0) return;
    setCues(prev => prev.map(c => {
      const newStart = Math.max(0, Number((c.startTime + deltaSec).toFixed(2)));
      const newEnd = Math.max(newStart + 0.3, Number((c.endTime + deltaSec).toFixed(2)));
      const words = computeCueWords(c.text, newStart, newEnd);
      return { ...c, startTime: newStart, endTime: newEnd, words };
    }));
    setTotalDelayOffset(prev => Number((prev + deltaSec).toFixed(2)));
    const msg = deltaSec > 0
      ? `${st.introSync.offsetDelayed} +${deltaSec}s`
      : `${st.introSync.offsetAdvanced} ${deltaSec}s`;
    setSyncFeedback(msg);
    setTimeout(() => setSyncFeedback(null), 3500);
  };

  // 1-Click Fix for subtitles appearing before speech (delays cues forward)
  const handleFixEarlySubtitles = (amountSec: number = 0.5) => {
    if (cues.length === 0) return;
    handleShiftAllTime(amountSec);
  };

  // Align the 1st subtitle to the current video playback position
  // (User pauses video when the person starts speaking, then clicks 1 button to sync everything)
  const handleAlignFirstCueToCurrentTime = () => {
    if (cues.length === 0) return;
    const sorted = [...cues].sort((a, b) => a.startTime - b.startTime);
    const firstCue = sorted[0];
    const targetTime = Number(currentTime.toFixed(2));
    const delta = Number((targetTime - firstCue.startTime).toFixed(2));
    if (Math.abs(delta) < 0.05) return;
    handleShiftAllTime(delta);
    setSyncFeedback(`${st.introSync.firstCueSnapped} (${targetTime}s)`);
  };

  // Set an exact intro delay / music offset (e.g. 1.5s, 2.0s, 2.5s, 3.0s)
  const handleSetIntroDelay = (targetStartTime: number) => {
    if (cues.length === 0) return;
    const sorted = [...cues].sort((a, b) => a.startTime - b.startTime);
    const firstCue = sorted[0];
    const delta = Number((targetStartTime - firstCue.startTime).toFixed(2));
    if (Math.abs(delta) < 0.02) return;
    handleShiftAllTime(delta);
    setSyncFeedback(`${st.introSync.presetDelay} ${targetStartTime}s`);
  };

  // Reset timing offset back to 0.0s
  const handleResetOffset = () => {
    if (cues.length === 0 || totalDelayOffset === 0) return;
    handleShiftAllTime(-totalDelayOffset);
    setTotalDelayOffset(0);
    setSyncFeedback(st.introSync.offsetReset);
    setTimeout(() => setSyncFeedback(null), 3000);
  };

  // Split long cues into short TikTok-style lines (2-4 words per cue)
  const handleSplitLongCues = () => {
    if (cues.length === 0) return;
    const newCuesList: SubtitleCue[] = [];
    cues.forEach(cue => {
      const words = cue.text.trim().split(/\s+/).filter(Boolean);
      if (words.length <= 4) {
        newCuesList.push(cue);
      } else {
        // Split into chunks of 3-4 words
        const chunkSize = 3;
        const totalChunks = Math.ceil(words.length / chunkSize);
        const durationPerChunk = (cue.endTime - cue.startTime) / totalChunks;

        for (let i = 0; i < totalChunks; i++) {
          const chunkWords = words.slice(i * chunkSize, (i + 1) * chunkSize);
          const chunkStart = Number((cue.startTime + (i * durationPerChunk)).toFixed(2));
          const chunkEnd = Number((i === totalChunks - 1 ? cue.endTime : chunkStart + durationPerChunk).toFixed(2));
          newCuesList.push({
            id: `split-${cue.id}-${i}-${Date.now()}`,
            startTime: chunkStart,
            endTime: chunkEnd,
            text: chunkWords.join(' '),
          });
        }
      }
    });

    setCues(newCuesList);
    confetti({ particleCount: 30, spread: 45 });
  };

  // 6. File Import (SRT or VTT)
  const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const content = evt.target?.result as string;
      if (content) {
        const parsed = parseSrtOrVtt(content);
        if (parsed.length > 0) {
          setCues(parsed);
          confetti({ particleCount: 40, spread: 50 });
        }
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // 7. File Export (SRT / VTT)
  const downloadTextFile = (content: string, filename: string) => {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleExportSrt = () => {
    if (cues.length === 0) return;
    const srt = exportToSrt(cues);
    const cleanName = video.name.replace(/\.[^/.]+$/, '');
    downloadTextFile(srt, `${cleanName}_subtitles.srt`);
  };

  const handleExportVtt = () => {
    if (cues.length === 0) return;
    const vtt = exportToVtt(cues);
    const cleanName = video.name.replace(/\.[^/.]+$/, '');
    downloadTextFile(vtt, `${cleanName}_subtitles.vtt`);
  };

  // 8. Burn Subtitles into Video
  const handleBurnSubtitles = async () => {
    if (cues.length === 0) return;
    setIsBurning(true);
    setBurnProgressMsg(st.export.exportingBtn);

    try {
      const blob = await processVideoSubtitles(
        video.url,
        cues,
        style,
        removeAudio,
        (progress, msg) => {
          setBurnProgressMsg(`${msg} (${progress}%)`);
        }
      );

      if (burnedVideoUrl) {
        memoryManager.safeRevokeObjectURL(burnedVideoUrl);
      }
      const url = URL.createObjectURL(blob);
      setBurnedVideoUrl(url);

      confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 } });
    } catch (err) {
      console.error('Burn subtitles error:', err);
    } finally {
      setIsBurning(false);
      setBurnProgressMsg('');
    }
  };

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        const elem = stageWrapperRef.current;
        if (elem?.requestFullscreen) {
          await elem.requestFullscreen();
        } else if ((elem as any)?.webkitRequestFullscreen) {
          await (elem as any).webkitRequestFullscreen();
        }
      } else {
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        } else if ((document as any)?.webkitExitFullscreen) {
          await (document as any).webkitExitFullscreen();
        }
      }
    } catch (_) {}
  };

  return (
    <div className="space-y-6">
      {/* Video Player Card with Preview */}
      <VideoPlayerCard video={video} onReset={onReset} t={t} title={st.header.toolTitle}>
        <div className="space-y-4">
          
          {/* Action Toolbar Header */}
          <div className="flex flex-wrap items-center justify-between gap-2.5 pb-2 border-b border-slate-100 dark:border-gray-800/80">
            <div className="flex items-center gap-2">
              <span className="text-xs font-extrabold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                <Subtitles className="w-4 h-4" />
                <span>{st.header.livePreview}</span>
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-bold border border-emerald-500/25">
                {cues.length} {st.header.cuesCount}
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              {/* Language Info Question Button */}
              <button
                onClick={() => setShowLanguageInfoModal(true)}
                className="px-2.5 py-1 rounded-xl bg-slate-100 dark:bg-gray-800 text-slate-700 dark:text-gray-300 hover:text-emerald-500 text-xs font-semibold flex items-center gap-1 transition-colors"
                title={st.header.supportedLangs}
              >
                <HelpCircle className="w-3.5 h-3.5 text-emerald-500" />
                <span className="hidden sm:inline">{st.header.languages}</span>
              </button>

              {/* Theater Mode Toggle */}
              <button
                onClick={() => setIsTheaterMode(!isTheaterMode)}
                className={`px-2.5 py-1 rounded-xl text-xs font-semibold flex items-center gap-1 transition-colors ${
                  isTheaterMode
                    ? 'bg-emerald-500 text-white shadow-sm'
                    : 'bg-slate-100 dark:bg-gray-800 text-slate-700 dark:text-gray-300 hover:text-emerald-500'
                }`}
                title="Theater View"
              >
                <Eye className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{isTheaterMode ? st.header.normal : st.header.theater}</span>
              </button>

              {/* Fullscreen Toggle */}
              <button
                onClick={toggleFullscreen}
                className="px-2.5 py-1 rounded-xl bg-slate-100 dark:bg-gray-800 text-slate-700 dark:text-gray-300 hover:text-emerald-500 text-xs font-semibold flex items-center gap-1 transition-colors"
                title="Fullscreen"
              >
                {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          {/* Video Stage with Interactive Subtitle Overlay */}
          <div
            ref={stageWrapperRef}
            className={`relative rounded-2xl overflow-hidden bg-black flex items-center justify-center border border-slate-200 dark:border-gray-800 shadow-2xl transition-all ${
              isTheaterMode ? 'w-full max-h-[80vh] min-h-[460px]' : 'w-full max-h-[60vh] min-h-[320px]'
            }`}
          >
            <video
              ref={videoRef}
              src={video.url}
              className="max-h-full max-w-full object-contain cursor-pointer"
              playsInline
              preload="auto"
              onClick={handlePlayPause}
              onTimeUpdate={handleTimeUpdate}
              onLoadedMetadata={(e) => {
                const d = e.currentTarget.duration;
                if (d && !isNaN(d) && isFinite(d) && d > 0) {
                  setDuration(d);
                }
              }}
              onEnded={() => setIsPlaying(false)}
            />

            {/* Live Subtitle Overlay on Top of Video */}
            <SubtitleOverlay
              activeCue={activeCue}
              style={style}
              currentTime={currentTime}
              isDragging={isDragging}
              onDragStart={handleDragStart}
              dragTip={st.styling.dragTip}
            />

            {/* Play/Pause Overlay Icon when paused */}
            {!isPlaying && (
              <button
                onClick={handlePlayPause}
                className="absolute inset-0 m-auto w-14 h-14 rounded-full bg-emerald-500/90 hover:bg-emerald-400 text-gray-950 flex items-center justify-center shadow-2xl transition-transform hover:scale-110 active:scale-95 z-20"
                aria-label="Play video"
              >
                <Play className="w-6 h-6 ml-0.5 fill-current" />
              </button>
            )}

            {/* Full-Featured Bottom Video Control & Interactive Scrubber Overlay */}
            <SubtitleScrubberOverlay
              scrubberTrackRef={scrubberTrackRef}
              isPlaying={isPlaying}
              currentTime={currentTime}
              totalDuration={totalDuration}
              cues={cues}
              activeCue={activeCue}
              voiceTimeline={voiceTimeline}
              isSeeking={isSeeking}
              hoverSeekTime={hoverSeekTime}
              hoverSeekPos={hoverSeekPos}
              hoverCue={hoverCue}
              playbackRate={playbackRate}
              isMuted={isMuted}
              isFullscreen={isFullscreen}
              st={st}
              onPlayPause={handlePlayPause}
              onScrubberPointerDown={handleScrubberPointerDown}
              onScrubberPointerMove={handleScrubberPointerMove}
              onScrubberPointerUp={handleScrubberPointerUp}
              onScrubberPointerLeave={handleScrubberPointerLeave}
              onJumpTime={jumpTime}
              onJumpToPrevCue={jumpToPrevCue}
              onJumpToNextCue={jumpToNextCue}
              onSpeedChange={handleSpeedChange}
              onToggleMute={handleToggleMute}
              onToggleFullscreen={toggleFullscreen}
            />
          </div>

          {/* Quick Seek & Navigation Panel right below the player */}
          <SubtitleNavPanel
            currentTime={currentTime}
            totalDuration={totalDuration}
            cues={cues}
            totalDelayOffset={totalDelayOffset}
            isSyncingAudio={isSyncingAudio}
            syncFeedback={syncFeedback}
            st={st}
            onSeekToTime={seekToTime}
            onJumpTime={jumpTime}
            onJumpToPrevCue={jumpToPrevCue}
            onJumpToNextCue={jumpToNextCue}
            onFixEarlySubtitles={handleFixEarlySubtitles}
            onShiftAllTime={handleShiftAllTime}
            onResetOffset={handleResetOffset}
            onAutoSyncToVoice={handleAutoSyncToVoice}
          />

        </div>
      </VideoPlayerCard>

      {/* Main Subtitle Workspace: AI Generator & Cue Editor & Styling Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column (7 cols): Subtitle Controls & Cues Timeline */}
        <div className="lg:col-span-7 space-y-6">
          
          {/* Subtitle Generator Box */}
          <div className="glass-card p-4 sm:p-6 rounded-3xl border border-emerald-500/30 bg-gradient-to-br from-emerald-500/10 via-white/80 dark:via-gray-900/60 to-teal-500/5 space-y-4 shadow-xl">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shadow-sm">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white">
                    {st.generator.title}
                  </h4>
                  {st.generator.subtitle && (
                    <p className="text-xs text-slate-600 dark:text-gray-400 mt-0.5">
                      {st.generator.subtitle}
                    </p>
                  )}
                </div>
              </div>

              {/* Language Selector */}
              <div className="flex items-center gap-1.5">
                <Globe className="w-4 h-4 text-emerald-500 shrink-0" />
                <select
                  value={selectedLanguage}
                  onChange={(e) => setSelectedLanguage(e.target.value)}
                  className="bg-white dark:bg-gray-950 border border-slate-200 dark:border-gray-800 rounded-xl px-2.5 py-1.5 text-xs font-bold text-slate-800 dark:text-gray-200 focus:outline-none focus:border-emerald-500 shadow-sm cursor-pointer"
                >
                  {WHISPER_SUPPORTED_LANGUAGES.map((l) => (
                    <option key={l.code} value={l.code}>
                      {l.nativeName}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Generate Action Button */}
            <div className="flex flex-wrap items-center gap-2.5 pt-2">
              <button
                onClick={handleGenerateSubtitles}
                disabled={isTranscribing}
                className="flex-1 min-w-[200px] px-4 py-3 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-gray-950 font-extrabold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/25 transition-all active:scale-[0.98] disabled:opacity-50 cursor-pointer"
              >
                {isTranscribing ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>{transcribeMsg || st.generator.generatingBtn}</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>{st.generator.generateBtn}</span>
                  </>
                )}
              </button>

              {/* Import SRT / VTT Button */}
              <button
                onClick={() => fileInputRef.current?.click()}
                className="px-3.5 py-3 rounded-2xl bg-slate-100 dark:bg-gray-800 hover:bg-slate-200 dark:hover:bg-gray-700 text-slate-700 dark:text-gray-300 font-bold text-xs flex items-center gap-1.5 transition-colors border border-slate-200 dark:border-gray-700 cursor-pointer"
                title={st.actions.uploadSrt}
              >
                <Upload className="w-4 h-4 text-emerald-500" />
                <span>{st.actions.uploadSrt}</span>
              </button>

              {/* Auto-Sync with Voice Audio & TTS Button (Only when cues exist) */}
              {cues.length > 0 && (
                <button
                  onClick={handleAutoSyncToVoice}
                  disabled={isSyncingAudio}
                  className="px-3.5 py-3 rounded-2xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-300 font-bold text-xs flex items-center gap-1.5 transition-colors border border-amber-500/30 cursor-pointer disabled:opacity-50"
                  title={st.actions.syncToVoice}
                >
                  {isSyncingAudio ? (
                    <RefreshCw className="w-4 h-4 animate-spin text-amber-500" />
                  ) : (
                    <Sliders className="w-4 h-4 text-amber-500" />
                  )}
                  <span>{st.actions.syncToVoice}</span>
                </button>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept=".srt,.vtt,text/plain"
                onChange={handleFileImport}
                className="hidden"
              />
            </div>

            {/* Audio Timeline & Synchronization Info Badge */}
            {cues.length > 0 && (
              <div className="p-3.5 rounded-2xl bg-slate-100/80 dark:bg-gray-950/60 border border-slate-200 dark:border-gray-800/80 text-xs space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 font-black text-slate-800 dark:text-gray-200">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                    <span>{st.timeline.title}</span>
                  </div>
                  <span className="px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-bold text-[11px]">
                    {st.timeline.syncedToVoice}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] pt-1">
                  <div className="flex items-center gap-2 p-2 rounded-xl bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-800">
                    <span className="text-base">🎵</span>
                    <div>
                      <div className="text-slate-500 dark:text-gray-400 font-medium">
                        {st.timeline.musicIntroDur}
                      </div>
                      <div className="font-mono font-bold text-amber-600 dark:text-amber-400">
                        {cues[0]?.startTime > 0.3
                          ? `0:00 - ${formatSecondsToSrtTime(cues[0].startTime).slice(3, 8)} (${cues[0].startTime.toFixed(2)}s)`
                          : st.timeline.noIntro}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 p-2 rounded-xl bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-800">
                    <span className="text-base">🎙️</span>
                    <div>
                      <div className="text-slate-500 dark:text-gray-400 font-medium">
                        {st.timeline.firstSubtitleStart}
                      </div>
                      <div className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                        {formatSecondsToSrtTime(cues[0]?.startTime || 0).slice(3, 8)} ({cues[0]?.startTime.toFixed(2)}s)
                      </div>
                    </div>
                  </div>
                </div>

                <div className="text-[11px] text-slate-500 dark:text-gray-400 flex items-center gap-1.5 pt-0.5">
                  <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                  <span>
                    {st.timeline.introExplanation}
                  </span>
                </div>
              </div>
            )}

            {/* Audio Syncing Progress Banner */}
            {isSyncingAudio && (
              <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-700 dark:text-amber-300 flex items-center gap-2 animate-pulse">
                <RefreshCw className="w-4 h-4 animate-spin text-amber-500 shrink-0" />
                <span>{syncStatusMsg || st.actions.syncing}</span>
              </div>
            )}

            {/* Real-time Progress Bar */}
            {isTranscribing && (
              <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 space-y-2 animate-pulse">
                <div className="flex items-center justify-between text-xs font-extrabold text-emerald-700 dark:text-emerald-300">
                  <span className="flex items-center gap-1.5 truncate pr-2">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin text-emerald-500" />
                    <span className="truncate">{transcribeMsg || st.generator.transcribing}</span>
                  </span>
                  <span className="tabular-nums font-black">{transcribePercent}%</span>
                </div>
                <div className="w-full h-2 bg-emerald-950/20 dark:bg-emerald-950/40 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-300 rounded-full"
                    style={{ width: `${Math.max(6, Math.min(100, transcribePercent))}%` }}
                  />
                </div>
              </div>
            )}

            {/* Error Notification Alert */}
            {transcribeError && (
              <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-500" />
                <div className="flex-1 space-y-1">
                  <div className="font-extrabold text-slate-900 dark:text-white">
                    {st.generator.generateError}
                  </div>
                  <div className="leading-relaxed text-slate-700 dark:text-gray-300">{transcribeError}</div>
                  <div className="flex flex-wrap items-center gap-2 pt-1.5">
                    <button
                      onClick={handleGenerateSubtitles}
                      className="px-3 py-1 rounded-xl bg-rose-500 hover:bg-rose-600 text-white font-bold text-[11px] transition-colors shadow-sm"
                    >
                      {st.generator.retry}
                    </button>
                    <button
                      onClick={handleAddCue}
                      className="px-3 py-1 rounded-xl bg-white dark:bg-gray-900 text-slate-800 dark:text-gray-200 border border-slate-200 dark:border-gray-800 font-bold text-[11px] hover:text-emerald-500 transition-colors"
                    >
                      {st.generator.addManually}
                    </button>
                  </div>
                </div>
                <button
                  onClick={() => setTranscribeError(null)}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-gray-300 p-0.5 rounded-lg"
                  aria-label="Close error"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

          {/* Subtitles Cue List & Interactive Editor */}
          <SubtitleCueList
            cues={cues}
            currentTime={currentTime}
            totalDelayOffset={totalDelayOffset}
            isSyncingAudio={isSyncingAudio}
            st={st}
            onSeekToTime={seekToTime}
            onUpdateCue={handleUpdateCue}
            onDeleteCue={handleDeleteCue}
            onAddCue={handleAddCue}
            onExportSrt={handleExportSrt}
            onExportVtt={handleExportVtt}
            onAlignFirstCueToCurrentTime={handleAlignFirstCueToCurrentTime}
            onSetIntroDelay={handleSetIntroDelay}
            onFixEarlySubtitles={handleFixEarlySubtitles}
            onShiftAllTime={handleShiftAllTime}
            onResetOffset={handleResetOffset}
            onAutoSyncToVoice={handleAutoSyncToVoice}
            onSplitLongCues={handleSplitLongCues}
          />
        </div>

        {/* Right Column (5 cols): Subtitle Styling & Burn Controls */}
        <div className="lg:col-span-5">
          <SubtitleStylePanel
            style={style}
            onStyleChange={setStyle}
            applyPreset={applyPreset}
            handleQuickPosition={handleQuickPosition}
            removeAudio={removeAudio}
            setRemoveAudio={setRemoveAudio}
            handleBurnSubtitles={handleBurnSubtitles}
            isBurning={isBurning}
            cuesCount={cues.length}
            burnProgressMsg={burnProgressMsg}
            burnedVideoUrl={burnedVideoUrl}
            videoName={video.name}
            st={st}
          />
        </div>
      </div>

      {/* Language Capabilities Modal */}
      <LanguageInfoModal
        isOpen={showLanguageInfoModal}
        onClose={() => setShowLanguageInfoModal(false)}
        st={st}
      />
    </div>
  );
};
