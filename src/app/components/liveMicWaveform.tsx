import React, { useCallback, useEffect, useRef, useState } from "react";
import { RecState } from "./recorder";

/**
 * LiveMicGaugeBars
 * Mic-powered vertical bar gauge (equalizer-style) matching a pill/rounded container.
 * No external deps. Works in React + Tailwind, but Tailwind is optional.
 *
 * Example:
 * <LiveMicGaugeBars barCount={12} className="w-[360px]" />
 */
export default function LiveMicGaugeBars({
  barCount = 12,
  className = "",
  height = 64,
  bgColor = "#000000",
  barColor = "#2e3642",
  activeColor = "#9aa4b2", // optional accent when loud
  // radius = 9999,
  gap = 8,
  minBar = 8, // px
  smoothing = 0.85,
  floorDb = -70, // noise floor in dB to ignore very low noise
  capDecay = 0.08, // 0..1 decay per frame
  recordState,
}: {
  barCount?: number;
  className?: string;
  height?: number;
  bgColor?: string;
  barColor?: string;
  activeColor?: string;
  // radius?: number;
  gap?: number;
  minBar?: number;
  smoothing?: number;
  floorDb?: number;
  capDecay?: number;
  recordState: RecState;
}) {
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const barsRef = useRef<HTMLDivElement[]>([]);

  // audio
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const peaksRef = useRef<number[]>(Array(barCount).fill(0));

  // Helper to map linear freq bins -> N bars (log-scaled buckets for nicer movement)
  const buildBuckets = useCallback(
    (fftSize: number, sampleRate: number) => {
      const nyquist = sampleRate / 2;
      const bins = fftSize / 2;
      // Choose log-spaced frequency edges from ~60Hz to 8kHz (voice band)
      const minF = 60,
        maxF = 8000;
      const edges: number[] = [];
      for (let i = 0; i <= barCount; i++) {
        const t = i / barCount;
        const f = minF * Math.pow(maxF / minF, t);
        const bin = Math.min(
          bins - 1,
          Math.max(0, Math.round((f / nyquist) * bins))
        );
        edges.push(bin);
      }
      return edges;
    },
    [barCount]
  );

  const loop = useCallback(() => {
    const analyser = analyserRef.current;
    if (!analyser) return;

    const freq = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteFrequencyData(freq);

    const sampleRate = audioCtxRef.current!.sampleRate;
    const edges = buildBuckets(analyser.fftSize, sampleRate);

    for (let i = 0; i < barCount; i++) {
      const start = edges[i];
      const end = edges[i + 1];
      let sum = 0;
      for (let j = start; j < end; j++) sum += freq[j];
      const avg = sum / Math.max(1, end - start); // 0..255

      // Convert 0..255 to dB-ish 0..1 scale with noise floor
      const db = (avg / 255) * 60 - 60; // approx -60..0 dB
      let norm = (db - floorDb) / (0 - floorDb);
      norm = Math.max(0, Math.min(1, norm));

      // smooth peak-hold style
      const prev = peaksRef.current[i];
      const val = Math.max(prev * (1 - capDecay), norm);
      peaksRef.current[i] = val;

      const barEl = barsRef.current[i];
      if (barEl) {
        const px = Math.max(minBar, Math.round(val * (height - 6)));
        barEl.style.height = px + "px";
        barEl.style.background = val > 0.85 ? activeColor : barColor;
      }
    }

    rafRef.current = requestAnimationFrame(loop);
  }, [
    activeColor,
    barColor,
    barCount,
    buildBuckets,
    capDecay,
    floorDb,
    height,
    minBar,
  ]);

  const start = useCallback(async () => {
    setError(null);
    if (isRunning) return;
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext ||
          (window as any).webkitAudioContext)({ latencyHint: "interactive" });
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === "suspended") await ctx.resume();

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: false,
        },
      });
      streamRef.current = stream;

      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = smoothing;
      source.connect(analyser);
      analyserRef.current = analyser;

      setIsRunning(true);
      rafRef.current = requestAnimationFrame(loop);
    } catch (e: any) {
      console.error(e);
      setError(e?.message || "마이크를 시작할 수 없습니다.");
      stop();
    }
  }, [isRunning, loop, smoothing]);

  const stop = () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (audioCtxRef.current && audioCtxRef.current.state !== "closed") {
      audioCtxRef.current.close();
      audioCtxRef.current = null;
    }
    analyserRef.current = null;
    setIsRunning(false);
    barsRef.current.forEach((el) => {
      if (el) {
        el.style.height = `${minBar}px`;
        el.style.background = barColor;
      }
    });
  };

  useEffect(() => {
    if (recordState === "recording") {
      start();
    }
    if (recordState === "paused" || recordState === "finishing") {
      stop();
    }
  }, [recordState, start]);

  // Cleanup on unmount
  useEffect(() => {
    return () => stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Prepare bar refs
  const setBarRef = (idx: number) => (el: HTMLDivElement | null) => {
    if (el) barsRef.current[idx] = el;
  };

  return (
    <div className={`inline-flex flex-col gap-2 ${className}`}>
      <div
        ref={containerRef}
        className="relative flex items-end justify-center px-5"
        style={{
          height,
          background: bgColor,
          borderRadius: 8,
        }}
      >
        <div className="flex items-end" style={{ gap }}>
          {Array.from({ length: barCount }).map((_, i) => (
            <div
              key={i}
              ref={setBarRef(i)}
              style={{
                width: 6,
                height: minBar,
                background: barColor,
                borderRadius: 6,
                transition: "height 80ms linear, background 80ms linear",
              }}
            />
          ))}
        </div>
      </div>

      {/* <div className="flex items-center gap-2">
        <button
          onClick={start}
          disabled={isRunning}
          className="px-3 py-2 rounded-xl bg-white text-black font-medium disabled:opacity-40"
        >
          Start
        </button>
        <button
          onClick={stop}
          disabled={!isRunning}
          className="px-3 py-2 rounded-xl bg-neutral-800 text-white font-medium disabled:opacity-40"
        >
          Stop
        </button>
        <span className="text-sm text-neutral-400">
          {isRunning
            ? "실시간 게이지 표시 중"
            : error
            ? `에러: ${error}`
            : "대기 중"}
        </span>
      </div> */}
    </div>
  );
}
