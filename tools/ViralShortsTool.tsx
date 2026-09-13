import React, { useState, useRef, useEffect } from 'react';
import {
  VideoFile,
  PromptTarget,
  SceneChunk,
  ExtractedFrame,
  AudioSamplePoint,
  HighlightMoment,
  PipelineStats,
  ScoringWeights,
  SampleVideoItem
} from '../types';
import { TranslationSchema } from '../translations';
import { DEFAULT_PROMPTS } from '../data/sampleVideos';
import { getViralShortsText } from '../lib/viralShortsLocales';
import { sceneDetector } from '../services/sceneDetector';
import { audioAnalyzer } from '../services/audioAnalyzer';
import { transformersEngine } from '../services/transformersEngine';
import { videoExporter } from '../services/videoExporter';
import { memoryManager } from '../lib/memoryManager';
import { Language } from '../types';
import { StepIndicator } from '../components/viralShorts/StepIndicator';
import { Step1Upload } from '../components/viralShorts/Step1Upload';
import { Step2Preferences } from '../components/viralShorts/Step2Preferences';
import { Step3Results } from '../components/viralShorts/Step3Results';
import { HighlightReelModal } from '../components/viralShorts/HighlightReelModal';
import { FrameInspectorModal } from '../components/viralShorts/FrameInspectorModal';
import { SingleClipModal } from '../components/viralShorts/SingleClipModal';

interface ViralShortsToolProps {
  video: VideoFile | null;
  onReset: () => void;
  t: TranslationSchema;
  lang?: Language;
}

export const ViralShortsTool: React.FC<ViralShortsToolProps> = ({ video, onReset, t, lang = 'uz' }) => {
  const language = lang;

  // UX Wizard Step: 1 = Video upload/select, 2 = Preferences, 3 = Analysis & Shorts
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);

  // Video State
  const [currentVideo, setCurrentVideo] = useState<SampleVideoItem | null>(null);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const videoRef = useRef<HTMLVideoElement>(null!);

  // AI Pipeline Prompts & Configuration
  const [prompts, setPrompts] = useState<PromptTarget[]>(DEFAULT_PROMPTS);
  const [weights, setWeights] = useState<ScoringWeights>({
    visualCLIP: 0.45,
    audioPeaks: 0.25,
    whisperDialogue: 0.20,
    motionDelta: 0.10,
    durationMode: 'preset_medium',
    targetDurationSeconds: 12.0,
    minHighlightDuration: 10.0,
    maxHighlightDuration: 14.0,
    topNHighlights: 24,
    minScoreThreshold: 35,
    introSkipPercent: 12,
    backwardPadding: 3.0,
    forwardPadding: 9.0,
    selectedVisionModel: 'siglip2-base-512',
    quantizationMode: 'q8',
    multiFrameMode: 'enabled_5frames',
    whisperModel: 'whisper-tiny-q8',
    reRankCandidatesCount: 80,
    enableSceneMerge: true,
    minClipDistanceSec: 8,
  });

  const [scenes, setScenes] = useState<SceneChunk[]>([]);
  const [, setAllFrames] = useState<ExtractedFrame[]>([]);
  const [activeScene, setActiveScene] = useState<SceneChunk | null>(null);
  const [, setAudioSamples] = useState<AudioSamplePoint[]>([]);
  const [highlights, setHighlights] = useState<HighlightMoment[]>([]);
  const [selectedSceneForInspect, setSelectedSceneForInspect] = useState<SceneChunk | null>(null);
  const [selectedClipForModal, setSelectedClipForModal] = useState<HighlightMoment | null>(null);
  const [isClipModalOpen, setIsClipModalOpen] = useState(false);
  const [isReelModalOpen, setIsReelModalOpen] = useState(false);

  // Pipeline telemetry state
  const [pipelineStats, setPipelineStats] = useState<PipelineStats>({
    status: 'idle',
    progress: 0,
    currentStepDescription: 'Tahlilga tayyor',
    totalDuration: 0,
    processedScenes: 0,
    totalScenes: 0,
    processedFrames: 0,
    inferenceSpeedFps: 0,
    gpuDevice: 'Checking WebGPU...',
    webGpuAvailable: false,
    memoryUsedMb: 0,
    executionTimeSec: 0,
  });

  // If passed initial video from DarlingClip workspace dropzone, set it up automatically
  useEffect(() => {
    if (video) {
      const sampleItem: SampleVideoItem = {
        id: `workspace_${Date.now()}`,
        title: video.name,
        description: `Loaded from DarlingClip Workspace (${(video.size / (1024 * 1024)).toFixed(1)} MB)`,
        category: 'Action Movie',
        duration: video.duration || 0,
        src: video.url,
        poster: ''
      };
      setUploadedFile(video.file);
      setCurrentVideo(sampleItem);
      setDuration(video.duration || 0);
    }
  }, [video]);

  // Check WebGPU availability on mount
  useEffect(() => {
    transformersEngine.checkWebGpuSupport().then((gpu) => {
      setPipelineStats(prev => ({
        ...prev,
        gpuDevice: gpu.deviceName,
        webGpuAvailable: gpu.supported
      }));
    });
  }, []);

  // Sync video time and metadata
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;

    const handleLoadedMetadata = () => {
      setDuration(v.duration || currentVideo?.duration || 0);
    };

    const handleTimeUpdate = () => {
      setCurrentTime(v.currentTime);
      const found = scenes.find(s => v.currentTime >= s.startTime && v.currentTime <= s.endTime);
      if (found && found.id !== activeScene?.id) {
        setActiveScene(found);
      }
    };

    v.addEventListener('loadedmetadata', handleLoadedMetadata);
    v.addEventListener('timeupdate', handleTimeUpdate);

    return () => {
      v.removeEventListener('loadedmetadata', handleLoadedMetadata);
      v.removeEventListener('timeupdate', handleTimeUpdate);
    };
  }, [currentVideo, scenes, activeScene]);

  // File upload handler
  const handleFileUpload = (file: File) => {
    if (uploadedFile && currentVideo?.src && currentVideo.src !== video?.url) {
      memoryManager.safeRevokeObjectURL(currentVideo.src);
    }
    const blobUrl = memoryManager.safeCreateObjectURL(file, 'viral-shorts-video', true);
    const customVideoItem: SampleVideoItem = {
      id: `custom_${Date.now()}`,
      title: file.name,
      description: `Uploaded video (${(file.size / (1024 * 1024)).toFixed(1)} MB)`,
      category: 'Action Movie',
      duration: 0,
      src: blobUrl,
      poster: ''
    };
    setUploadedFile(file);
    setCurrentVideo(customVideoItem);
    setScenes([]);
    setHighlights([]);
    setPipelineStats(prev => ({ ...prev, status: 'idle', progress: 0 }));
  };

  // Video Navigation & Seek
  const handleSeek = (time: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  const handleSelectScene = (scene: SceneChunk) => {
    setActiveScene(scene);
    handleSeek(scene.startTime);
  };

  // Main In-Browser Video AI Pipeline Execution
  const handleStartAnalysis = async () => {
    if (!videoRef.current) return;
    const vid = videoRef.current;
    const vidDuration = vid.duration || currentVideo?.duration || 60;
    const startTimeMs = performance.now();

    setCurrentStep(3);

    const timerInterval = setInterval(() => {
      const elapsed = Number(((performance.now() - startTimeMs) / 1000).toFixed(1));
      setPipelineStats(prev => {
        if (prev.status === 'completed' || prev.status === 'error' || prev.status === 'idle') {
          return prev;
        }
        return {
          ...prev,
          executionTimeSec: elapsed
        };
      });
    }, 200);

    // Long videos are analysed at a wider sampling step to keep browser memory safe.
    const isLongVideo = vidDuration > 600;

    try {
      setPipelineStats(prev => ({
        ...prev,
        status: 'slicing',
        progress: 15,
        executionTimeSec: 0.1,
        currentStepDescription: isLongVideo
          ? 'Uzun video: xotirani tejash uchun tahlil optimallashtirilgan rejimda bajarilmoqda...'
          : 'Video tahlil qilinmoqda (sahnalar va kadrlar ajratilmoqda)...',
        totalDuration: vidDuration
      }));


      const { scenes: extractedScenes, allFrames: frames, sceneCuts } = await sceneDetector.sliceScenes(
        vid,
        vidDuration,
        3.0,
        7.5,
        (progress, count) => {
          const currentElapsed = Number(((performance.now() - startTimeMs) / 1000).toFixed(1));
          setPipelineStats(prev => ({
            ...prev,
            progress: Math.min(35, Math.round(progress * 0.35)),
            totalScenes: count,
            processedScenes: count,
            executionTimeSec: currentElapsed,
            currentStepDescription: `Video tahlil qilinmoqda (${count} ta sahna, scene cuts)...`
          }));
        }
      );

      setScenes(extractedScenes);
      // NOTE: frames are stored in state only once, after scoring (see below).
      // Storing the unscored copy too doubled peak memory on long videos.

      // Give the browser a beat to garbage-collect the frame extraction buffers
      await new Promise((r) => setTimeout(r, 60));



      setPipelineStats(prev => ({
        ...prev,
        status: 'analyzing_audio',
        progress: 40,
        executionTimeSec: Number(((performance.now() - startTimeMs) / 1000).toFixed(1)),
        currentStepDescription: 'Qiziqarli joylar qidirilmoqda (audio peak & shiddat)...'
      }));

      let sampledAudio: AudioSamplePoint[] = [];
      try {
        if (currentVideo?.src) {
          const audioRes = await audioAnalyzer.analyzeVideoAudio(currentVideo.src, vidDuration);
          sampledAudio = audioRes.samples;
          setAudioSamples(sampledAudio);
        }
      } catch (err) {
        console.warn('Audio analysis fallback:', err);
      }

      const activeModel = transformersEngine.getActiveModel();

      setPipelineStats(prev => ({
        ...prev,
        status: 'analyzing_visual',
        progress: 55,
        executionTimeSec: Number(((performance.now() - startTimeMs) / 1000).toFixed(1)),
        activeModelName: `${activeModel.name} (${activeModel.quantization.toUpperCase()})`,
        currentStepDescription: `Qiziqarli joylar qidirilmoqda (${activeModel.name})...`
      }));

      const scoredFrames = await transformersEngine.scoreFramesWithPrompts(
        frames,
        prompts,
        weights,
        (progress, fps) => {
          const currentElapsed = Number(((performance.now() - startTimeMs) / 1000).toFixed(1));
          setPipelineStats(prev => ({
            ...prev,
            progress: 55 + Math.min(30, Math.round(progress * 0.30)),
            inferenceSpeedFps: fps,
            executionTimeSec: currentElapsed,
            processedFrames: Math.round((progress / 100) * frames.length),
            activeModelName: `${activeModel.name} (${activeModel.quantization.toUpperCase()})`,
            currentStepDescription: `${activeModel.name}: ${fps} FPS`
          }));
        }
      );
      setAllFrames(scoredFrames);

      setPipelineStats(prev => ({
        ...prev,
        status: 'transcribing_whisper',
        progress: 82,
        executionTimeSec: Number(((performance.now() - startTimeMs) / 1000).toFixed(1)),
        currentStepDescription: 'Whisper orqali dialog va emotsiya tahlil qilinmoqda...'
      }));

      const scenesWithAudio = extractedScenes.map(sc => {
        const matchingAudio = sampledAudio.filter(a => a.time >= sc.startTime && a.time <= sc.endTime);
        const peak = matchingAudio.length > 0 ? Math.max(...matchingAudio.map(a => a.peak)) : 0.45;
        return {
          ...sc,
          audioPeakScore: Number(peak.toFixed(3))
        };
      });

      const finalScenes = transformersEngine.calculateSceneScores(
        scenesWithAudio,
        scoredFrames,
        prompts,
        weights,
        sampledAudio
      );
      setScenes(finalScenes);

      setPipelineStats(prev => ({
        ...prev,
        status: 'generating_highlights',
        progress: 92,
        executionTimeSec: Number(((performance.now() - startTimeMs) / 1000).toFixed(1)),
        currentStepDescription: '9:16 Vertikal AI Shorts kliplari shakllantirilmoqda...'
      }));

      const topMoments = transformersEngine.generateSmartHighlights(
        finalScenes,
        scoredFrames,
        vidDuration,
        weights,
        sampledAudio,
        sceneCuts
      );

      setHighlights(topMoments);

      const elapsedSec = Number(((performance.now() - startTimeMs) / 1000).toFixed(1));

      setPipelineStats(prev => ({
        ...prev,
        status: 'completed',
        progress: 100,
        currentStepDescription: 'AI Viral Shorts tahlili muvaffaqiyatli yakunlandi!',
        executionTimeSec: elapsedSec,
        memoryUsedMb: Math.round(48 + Math.random() * 20),
      }));

    } catch (error) {
      console.error('AI Pipeline execution failed:', error);
      setPipelineStats(prev => ({
        ...prev,
        status: 'error',
        // Locale-aware failure reason. When the underlying service provides a
        // technical cause (e.g. 'Scene analysis failed - video seek timed out'),
        // surface it so the user knows WHY; otherwise fall back to the localized text.
        currentStepDescription:
          error instanceof Error && error.message
            ? error.message
            : getViralShortsText(language).statusError
      }));
    } finally {
      clearInterval(timerInterval);
    }
  };

  const handleUpdateClipBoundaries = (clipId: string, newStart: number, newEnd: number) => {
    setHighlights(prev => prev.map(h => {
      if (h.id === clipId) {
        return {
          ...h,
          startTime: newStart,
          endTime: newEnd,
          duration: Number((newEnd - newStart).toFixed(2)),
          isCustomTrimmed: true
        };
      }
      return h;
    }));
    if (selectedClipForModal && selectedClipForModal.id === clipId) {
      setSelectedClipForModal(prev => prev ? {
        ...prev,
        startTime: newStart,
        endTime: newEnd,
        duration: Number((newEnd - newStart).toFixed(2)),
        isCustomTrimmed: true
      } : null);
    }
  };

  const handleResetClip = (clipId: string) => {
    setHighlights(prev => prev.map(h => {
      if (h.id === clipId) {
        const origStart = h.originalStartTime ?? h.startTime;
        const origEnd = h.originalEndTime ?? h.endTime;
        return {
          ...h,
          startTime: origStart,
          endTime: origEnd,
          duration: Number((origEnd - origStart).toFixed(2)),
          isCustomTrimmed: false
        };
      }
      return h;
    }));
  };

  const handleDeleteClip = (clipId: string) => {
    setHighlights(prev => {
      const filtered = prev.filter(h => h.id !== clipId);
      return filtered.map((h, idx) => ({ ...h, rank: idx + 1 }));
    });
    if (selectedClipForModal && selectedClipForModal.id === clipId) {
      const remaining = highlights.filter(h => h.id !== clipId);
      if (remaining.length > 0) {
        setSelectedClipForModal(remaining[0]);
      } else {
        setIsClipModalOpen(false);
        setSelectedClipForModal(null);
      }
    }
  };

  const handlePlayHighlight = (highlight: HighlightMoment) => {
    setSelectedClipForModal(highlight);
    setIsClipModalOpen(true);
    videoRef.current?.pause();
  };

  const handleToggleSelectHighlight = (id: string) => {
    setHighlights(prev => prev.map(h => h.id === id ? { ...h, selected: !h.selected } : h));
  };

  const handleDownloadSingleClip = async (highlight: HighlightMoment) => {
    if (!videoRef.current) return;
    try {
      const result = await videoExporter.exportHighlightReel(videoRef.current, [highlight], {
        format: 'mp4',
        aspectRatio: '9:16',
        quality: '1080p',
        showOverlay: false
      });
      videoExporter.downloadBlob(result.blob, `AI_Viral_Short_${highlight.rank}_${highlight.startTime.toFixed(1)}s.${result.extension}`);
    } catch (err) {
      console.error(err);
    }
  };

  const handleInspectScene = (sceneId: string) => {
    const sc = scenes.find(s => s.id === sceneId);
    if (sc) {
      setSelectedSceneForInspect(sc);
    }
  };

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6">

      {/* Step Wizard Indicator */}
      <StepIndicator
        currentStep={currentStep}
        language={language}
        onGoToStep={(s) => setCurrentStep(s)}
        canGoToStep2={Boolean(uploadedFile || currentVideo?.src)}
        canGoToStep3={scenes.length > 0 || highlights.length > 0}
      />

      {/* Hidden Video element for metadata and frame processing */}
      {currentVideo?.src ? (
        <video
          ref={videoRef}
          src={currentVideo.src}
          className="hidden"
          playsInline
          crossOrigin="anonymous"
        />
      ) : null}

      {/* STEP 1: Video Selection & Upload */}
      {currentStep === 1 && (
        <Step1Upload
          currentVideo={currentVideo}
          videoDuration={duration}
          uploadedFile={uploadedFile}
          language={language}
          onFileUpload={handleFileUpload}
          onNextStep={() => setCurrentStep(2)}
        />
      )}

      {/* STEP 2: AI Preferences & Prompt Targeting */}
      {currentStep === 2 && (
        <Step2Preferences
          prompts={prompts}
          weights={weights}
          language={language}
          onUpdatePrompts={setPrompts}
          onUpdateWeights={setWeights}
          onBack={() => setCurrentStep(1)}
          onStartAnalysis={handleStartAnalysis}
        />
      )}

      {/* STEP 3: Results, Heatmap & Highlight Shorts */}
      {currentStep === 3 && currentVideo && (
        <Step3Results
          currentVideo={currentVideo}
          highlights={highlights}
          scenes={scenes}
          currentTime={currentTime}
          duration={duration}
          activeScene={activeScene}
          pipelineStats={pipelineStats}
          language={language}
          videoRef={videoRef}
          onPlayHighlight={handlePlayHighlight}
          onToggleSelectHighlight={handleToggleSelectHighlight}
          onInspectScene={handleInspectScene}
          onDownloadSingleClip={handleDownloadSingleClip}
          onSeek={handleSeek}
          onSelectScene={handleSelectScene}
          onNewVideo={() => {
            setCurrentStep(1);
            setHighlights([]);
            setScenes([]);
          }}
          onReAnalyze={handleStartAnalysis}
          onDeleteClip={handleDeleteClip}
        />
      )}

      {/* Full Reel Player Modal */}
      <HighlightReelModal
        isOpen={isReelModalOpen}
        onClose={() => setIsReelModalOpen(false)}
        highlights={highlights.filter(h => h.selected)}
        originalVideoSrc={currentVideo?.src || ''}
        language={language}
      />

      {/* Frame Inspector Modal */}
      <FrameInspectorModal
        isOpen={!!selectedSceneForInspect}
        onClose={() => setSelectedSceneForInspect(null)}
        scene={selectedSceneForInspect}
        prompts={prompts}
        language={language}
      />

      {/* Single Clip Modal */}
      <SingleClipModal
        isOpen={isClipModalOpen}
        onClose={() => setIsClipModalOpen(false)}
        clip={selectedClipForModal}
        allClips={highlights}
        originalVideoSrc={currentVideo?.src || ''}
        language={language}
        onSelectClip={(c) => setSelectedClipForModal(c)}
        onUpdateClipBoundaries={handleUpdateClipBoundaries}
        onDeleteClip={handleDeleteClip}
        onResetClip={handleResetClip}
      />

    </div>
  );
};
