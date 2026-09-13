import { ProjectAsset, SnapGuide } from './types';
import { VideoFile } from '../../types';

// Time formatters: 00:00:07:02
export function formatCapCutTimecode(seconds: number, fps = 30): string {
  const s = Math.max(0, seconds || 0);
  const hrs = Math.floor(s / 3600);
  const mins = Math.floor((s % 3600) / 60);
  const secs = Math.floor(s % 60);
  const frames = Math.floor((s % 1) * fps);
  return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}:${frames.toString().padStart(2, '0')}`;
}

export function formatShortDuration(seconds: number): string {
  const s = Math.max(0, seconds || 0);
  const mins = Math.floor(s / 60);
  const secs = Math.floor(s % 60);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

// Helper to determine original media duration for a clip (video or audio)
export function getClipSourceDuration(
  item: { sourceDuration?: number; assetId?: string; url?: string; name?: string; start: number; end: number },
  projectAssets: ProjectAsset[] = [],
  initialVideos: VideoFile[] = []
): number {
  if (item.sourceDuration && !isNaN(item.sourceDuration) && item.sourceDuration > 0) {
    return item.sourceDuration;
  }
  if ((item as any).originalDuration && (item as any).originalDuration > 0) {
    return (item as any).originalDuration;
  }
  if (item.assetId) {
    const asset = projectAssets.find(a => a.id === item.assetId);
    if (asset?.duration && !isNaN(asset.duration) && asset.duration > 0) {
      return asset.duration;
    }
  }
  if (item.url) {
    const asset = projectAssets.find(a => a.url === item.url);
    if (asset?.duration && !isNaN(asset.duration) && asset.duration > 0) {
      return asset.duration;
    }
    const matched = initialVideos.find(v => v.url === item.url || v.name === item.name);
    if (matched?.duration && !isNaN(matched.duration) && matched.duration > 0) {
      return matched.duration;
    }
  }
  const fallback = item.end - item.start;
  return fallback > 0 ? fallback : 60;
}

// Calculate magnetic boundary snap
export function calculateMagneticSnap(
  candidateTime: number,
  excludeClipId: string,
  rectWidth: number,
  totalDur: number,
  candidateEdge: 'start' | 'end' | 'both' = 'both',
  clipLength = 0,
  snappingEnabled = true,
  currentPlayhead = 0,
  videoClips: { id: string; name: string; start: number; end: number }[] = [],
  audioClips: { id: string; name: string; start: number; end: number }[] = [],
  textClips: { id: string; text: string; start: number; end: number }[] = []
): { finalStart: number; finalEnd: number; snapGuide: SnapGuide | null } {
  if (!snappingEnabled || rectWidth <= 0 || totalDur <= 0) {
    return {
      finalStart: candidateTime,
      finalEnd: candidateTime + clipLength,
      snapGuide: null
    };
  }

  // 14 pixels magnetic attraction threshold converted to seconds
  const thresholdSec = Math.max(0.12, (14 / rectWidth) * totalDur);

  const targets: { time: number; label: string }[] = [
    { time: 0, label: '00:00 (Boshi)' },
    { time: totalDur, label: 'Tugash' }
  ];

  if (currentPlayhead > 0.05 && Math.abs(currentPlayhead - totalDur) > 0.05) {
    targets.push({ time: currentPlayhead, label: 'Playhead' });
  }

  videoClips.forEach(c => {
    if (c.id !== excludeClipId) {
      targets.push({ time: c.start, label: `Klip ulanishi (${c.name})` });
      targets.push({ time: c.end, label: `Klip ulanishi (${c.name})` });
    }
  });

  audioClips.forEach(a => {
    if (a.id !== excludeClipId) {
      targets.push({ time: a.start, label: `Audio ulanishi (${a.name})` });
      targets.push({ time: a.end, label: `Audio ulanishi (${a.name})` });
    }
  });

  textClips.forEach(t => {
    if (t.id !== excludeClipId) {
      targets.push({ time: t.start, label: `Matn (${t.text.slice(0, 10)})` });
      targets.push({ time: t.end, label: `Matn (${t.text.slice(0, 10)})` });
    }
  });

  let bestSnap: {
    appliedStart: number;
    appliedEnd: number;
    guideTime: number;
    diff: number;
    label: string;
  } | null = null;

  if (candidateEdge === 'both') {
    const rawStart = candidateTime;
    const rawEnd = candidateTime + clipLength;

    for (const t of targets) {
      const diffStart = Math.abs(rawStart - t.time);
      if (diffStart <= thresholdSec && (!bestSnap || diffStart < bestSnap.diff)) {
        bestSnap = {
          appliedStart: t.time,
          appliedEnd: t.time + clipLength,
          guideTime: t.time,
          diff: diffStart,
          label: t.label
        };
      }
      const diffEnd = Math.abs(rawEnd - t.time);
      if (diffEnd <= thresholdSec && (!bestSnap || diffEnd < bestSnap.diff)) {
        bestSnap = {
          appliedStart: Math.max(0, t.time - clipLength),
          appliedEnd: t.time,
          guideTime: t.time,
          diff: diffEnd,
          label: t.label
        };
      }
    }
  } else if (candidateEdge === 'start') {
    for (const t of targets) {
      const diff = Math.abs(candidateTime - t.time);
      if (diff <= thresholdSec && (!bestSnap || diff < bestSnap.diff)) {
        bestSnap = {
          appliedStart: t.time,
          appliedEnd: candidateTime + clipLength,
          guideTime: t.time,
          diff,
          label: t.label
        };
      }
    }
  } else if (candidateEdge === 'end') {
    for (const t of targets) {
      const diff = Math.abs(candidateTime - t.time);
      if (diff <= thresholdSec && (!bestSnap || diff < bestSnap.diff)) {
        bestSnap = {
          appliedStart: candidateTime - clipLength,
          appliedEnd: t.time,
          guideTime: t.time,
          diff,
          label: t.label
        };
      }
    }
  }

  if (bestSnap) {
    return {
      finalStart: bestSnap.appliedStart,
      finalEnd: bestSnap.appliedEnd,
      snapGuide: { time: bestSnap.guideTime, label: bestSnap.label }
    };
  }

  return {
    finalStart: candidateTime,
    finalEnd: candidateTime + clipLength,
    snapGuide: null
  };
}

// Unified Trimming math for start/end drag handles
export function clampTrimOffsetAndDuration(
  timeAtX: number,
  edge: 'start' | 'end',
  initStart: number,
  initEnd: number,
  initOffset: number,
  initSpeed: number,
  sourceDur: number,
  totalDur: number
): {
  newStart: number;
  newEnd: number;
  newOffset: number;
  isAtLimit: boolean;
  currentDur: number;
} {
  const maxTimelineDuration = sourceDur / initSpeed;
  let newStart = initStart;
  let newEnd = initEnd;
  let newOffset = initOffset;
  let isAtLimit = false;

  if (edge === 'start') {
    const minStartDueToOffset = initStart - (initOffset / initSpeed);
    const minStartDueToMaxDur = initEnd - maxTimelineDuration;
    const minAllowedStart = Math.max(0, minStartDueToOffset, minStartDueToMaxDur);
    const maxAllowedStart = initEnd - 0.2;

    newStart = Math.max(minAllowedStart, Math.min(maxAllowedStart, timeAtX));
    const timeDelta = newStart - initStart;
    newOffset = Math.max(0, Math.min(sourceDur - 0.2, initOffset + timeDelta * initSpeed));
    newEnd = initEnd;

    if (timeAtX <= minAllowedStart + 0.05) {
      isAtLimit = true;
    }
  } else {
    const maxRemainingTimeline = Math.max(0.2, (sourceDur - initOffset) / initSpeed);
    const maxAllowedEnd = Math.min(totalDur, initStart + maxRemainingTimeline);
    const minAllowedEnd = initStart + 0.2;

    newEnd = Math.max(minAllowedEnd, Math.min(maxAllowedEnd, timeAtX));
    newStart = initStart;
    newOffset = initOffset;

    if (timeAtX >= maxAllowedEnd - 0.05) {
      isAtLimit = true;
    }
  }

  return {
    newStart,
    newEnd,
    newOffset,
    isAtLimit,
    currentDur: newEnd - newStart
  };
}

// Unified Delta Trimming calculation
export function computeTrimDelta(
  item: { start: number; end: number; offset?: number; speed?: number },
  sourceDur: number,
  edge: 'start' | 'end',
  delta: number,
  totalDur: number
): { start: number; end: number; offset: number } {
  const speed = item.speed || 1;
  const offset = item.offset || 0;
  const maxTimelineDur = sourceDur / speed;

  if (edge === 'start') {
    const minStart = Math.max(0, item.start - (offset / speed), item.end - maxTimelineDur);
    const maxStart = item.end - 0.2;
    const newStart = Math.max(minStart, Math.min(maxStart, item.start + delta));
    const timeDelta = newStart - item.start;
    const newOffset = Math.max(0, Math.min(sourceDur - 0.2, offset + timeDelta * speed));
    return { start: newStart, end: item.end, offset: newOffset };
  } else {
    const maxRemaining = Math.max(0.2, (sourceDur - offset) / speed);
    const maxEnd = Math.min(totalDur, item.start + maxRemaining);
    const minEnd = item.start + 0.2;
    const newEnd = Math.max(minEnd, Math.min(maxEnd, item.end + delta));
    return { start: item.start, end: newEnd, offset };
  }
}

// Unified Playhead Trimming calculation
export function computeTrimToPlayhead(
  item: { start: number; end: number; offset?: number; speed?: number },
  sourceDur: number,
  edge: 'start' | 'end',
  targetTime: number,
  totalDur: number
): { start: number; end: number; offset: number } {
  const speed = item.speed || 1;
  const offset = item.offset || 0;
  const maxTimelineDur = sourceDur / speed;

  if (edge === 'start') {
    const minStart = Math.max(0, item.start - (offset / speed), item.end - maxTimelineDur);
    const newStart = Math.max(minStart, targetTime);
    const timeDelta = newStart - item.start;
    const newOffset = Math.max(0, Math.min(sourceDur - 0.2, offset + timeDelta * speed));
    return { start: newStart, end: item.end, offset: newOffset };
  } else {
    const maxRemaining = Math.max(0.2, (sourceDur - offset) / speed);
    const maxEnd = Math.min(totalDur, item.start + maxRemaining);
    const newEnd = Math.min(maxEnd, targetTime);
    return { start: item.start, end: newEnd, offset };
  }
}

// Web Audio Sound Engine for SFX & BGM Previews
export function playEditorSfx(name: string): void {
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
    setTimeout(() => { try { ctx.close(); } catch (_) {} }, 1500);
  } catch {
    // AudioContext blocked
  }
}
