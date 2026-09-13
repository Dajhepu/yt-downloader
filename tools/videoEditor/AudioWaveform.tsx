import React, { useEffect, useRef, useState, useMemo } from 'react';
import { extractWaveformData, getWaveformSlice, WaveformData } from '../../lib/waveformCache';

interface AudioWaveformProps {
  audioUrl?: string;
  assetId?: string;
  offset?: number;
  clipDuration: number;
  sourceDuration?: number;
  volume?: number;
  muted?: boolean;
  color?: string;
  secondaryColor?: string;
  fadeIn?: boolean;
  fadeInDuration?: number;
  fadeOut?: boolean;
  fadeOutDuration?: number;
  className?: string;
  mirrored?: boolean;
}

export const AudioWaveform: React.FC<AudioWaveformProps> = ({
  audioUrl,
  assetId,
  offset = 0,
  clipDuration,
  sourceDuration,
  volume = 100,
  muted = false,
  color = '#38bdf8', // Default sky blue
  secondaryColor = '#0284c7',
  fadeIn = false,
  fadeInDuration = 1.0,
  fadeOut = false,
  fadeOutDuration = 1.0,
  className = '',
  mirrored = true
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [waveformData, setWaveformData] = useState<WaveformData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [containerWidth, setContainerWidth] = useState<number>(0);

  // 1. Fetch / extract peaks when audioUrl changes
  useEffect(() => {
    if (!audioUrl) {
      setWaveformData(null);
      setIsLoading(false);
      return;
    }

    let isMounted = true;
    setIsLoading(true);

    extractWaveformData(audioUrl, assetId)
      .then((data) => {
        if (isMounted) {
          setWaveformData(data);
          setIsLoading(false);
        }
      })
      .catch(() => {
        if (isMounted) {
          setWaveformData(null);
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [audioUrl, assetId]);

  // 2. Observe container size for sharp rendering
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const cr = entry.contentRect;
        if (cr.width > 0) {
          setContainerWidth(Math.round(cr.width));
        }
      }
    });

    ro.observe(container);
    return () => ro.disconnect();
  }, []);

  // 3. Draw waveform whenever peaks, size, volume, or trims change
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const width = container.clientWidth || containerWidth || 100;
    const height = container.clientHeight || 36;
    if (width <= 0 || height <= 0) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, width, height);

    // Calculate bar geometry: 1 bar every 3.5 to 5px for crisp studio look
    const barSpacing = 4;
    const barWidth = 2.2;
    const numBars = Math.max(10, Math.floor(width / barSpacing));

    // Handle muted or zero-volume: draw subtle flatline
    const effectiveVolume = muted ? 0 : Math.min(200, Math.max(0, volume)) / 100;

    // Get slice of peaks for this clip's time range
    const slicedPeaks = getWaveformSlice(waveformData, offset, clipDuration, numBars);
    const hasRealAudio = waveformData?.hasAudio && slicedPeaks.length > 0;

    const centerY = height / 2;
    const maxBarHeight = height * 0.85;

    // Gradient styling for waveform bars
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, color);
    gradient.addColorStop(0.5, secondaryColor);
    gradient.addColorStop(1, color);

    ctx.fillStyle = gradient;

    for (let i = 0; i < numBars; i++) {
      const x = i * barSpacing;
      let amp = 0.12; // Fallback subtle noise floor

      if (hasRealAudio) {
        amp = slicedPeaks[i] ?? 0.05;
      } else if (isLoading) {
        // Subtle animated loading wave
        amp = 0.25 + 0.2 * Math.sin(i * 0.4 + Date.now() * 0.005);
      }

      // Apply volume scale
      amp *= effectiveVolume;

      // Apply Fade-in envelope
      if (fadeIn && fadeInDuration > 0 && clipDuration > 0) {
        const timeAtBar = (i / numBars) * clipDuration;
        if (timeAtBar < fadeInDuration) {
          const fadeFraction = Math.max(0, timeAtBar / fadeInDuration);
          amp *= fadeFraction;
        }
      }

      // Apply Fade-out envelope
      if (fadeOut && fadeOutDuration > 0 && clipDuration > 0) {
        const timeAtBar = (i / numBars) * clipDuration;
        const timeFromEnd = clipDuration - timeAtBar;
        if (timeFromEnd < fadeOutDuration) {
          const fadeFraction = Math.max(0, timeFromEnd / fadeOutDuration);
          amp *= fadeFraction;
        }
      }

      // Calculate bar heights
      if (mirrored) {
        const halfBarH = Math.max(1, (amp * maxBarHeight) / 2);
        const topY = centerY - halfBarH;
        const barH = halfBarH * 2;

        // Draw rounded capsule bar
        ctx.beginPath();
        if (ctx.roundRect) {
          ctx.roundRect(x, topY, barWidth, barH, 1.2);
        } else {
          ctx.rect(x, topY, barWidth, barH);
        }
        ctx.fill();
      } else {
        // Single sided bottom-up
        const barH = Math.max(2, amp * maxBarHeight);
        const topY = height - barH - 2;

        ctx.beginPath();
        if (ctx.roundRect) {
          ctx.roundRect(x, topY, barWidth, barH, 1.2);
        } else {
          ctx.rect(x, topY, barWidth, barH);
        }
        ctx.fill();
      }
    }

    // If muted, draw a subtle horizontal center line
    if (muted || effectiveVolume === 0) {
      ctx.strokeStyle = 'rgba(244, 63, 94, 0.4)'; // Rose muted line
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, centerY);
      ctx.lineTo(width, centerY);
      ctx.stroke();
    }
  }, [
    waveformData,
    isLoading,
    containerWidth,
    offset,
    clipDuration,
    volume,
    muted,
    color,
    secondaryColor,
    fadeIn,
    fadeInDuration,
    fadeOut,
    fadeOutDuration,
    mirrored
  ]);

  return (
    <div
      ref={containerRef}
      className={`relative w-full h-full overflow-hidden pointer-events-none ${className}`}
    >
      <canvas
        ref={canvasRef}
        className="w-full h-full block"
      />
    </div>
  );
};
