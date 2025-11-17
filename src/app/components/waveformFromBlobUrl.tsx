// WaveformFromBlobUrlFinal.tsx
import React, { useEffect, useRef, useState } from "react";

type Peaks = { mins: Float32Array; maxs: Float32Array };

// Safari 호환 decode
async function decodeAudioBuffer(ctx: AudioContext, data: ArrayBuffer) {
  try {
    return await ctx.decodeAudioData(data);
  } catch {
    return await new Promise<AudioBuffer>((resolve, reject) => {
      ctx.decodeAudioData(data, resolve, reject);
    });
  }
}

/** 미디어 타임라인(<audio> duration) 기준으로, 캔버스 내부 폭(bins)과 1:1로 피크 생성 */
function extractPeaksFitToWidthByMediaTime(
  channelData: Float32Array,
  sampleRate: number,
  mediaDurationSec: number,
  bins: number
): Peaks {
  const mins = new Float32Array(bins);
  const maxs = new Float32Array(bins);

  const decodedDurationSec = channelData.length / sampleRate;
  const timeScale = decodedDurationSec / mediaDurationSec; // 인코더 딜레이/패딩 보정

  for (let i = 0; i < bins; i++) {
    const t0 = (i / bins) * mediaDurationSec;
    const t1 = ((i + 1) / bins) * mediaDurationSec;

    const d0 = t0 * timeScale;
    const d1 = t1 * timeScale;

    const s0 = Math.floor(d0 * sampleRate);
    const s1 = Math.min(channelData.length, Math.floor(d1 * sampleRate));

    if (s1 <= s0) {
      mins[i] = 0;
      maxs[i] = 0;
      continue;
    }

    let min = 1.0,
      max = -1.0;
    for (let s = s0; s < s1; s++) {
      const v = channelData[s];
      if (v < min) min = v;
      if (v > max) max = v;
    }
    mins[i] = min;
    maxs[i] = max;
  }
  return { mins, maxs };
}

interface WaveformProps {
  /** Blob으로 만든 object URL */
  audioUrl: string;
  /** CSS 높이(px) */
  height?: number;
}

export default function WaveformFromBlobUrlFinal({
  audioUrl,
  height = 120,
}: WaveformProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // <audio> duration만 사용(기준 타임라인)
  const [duration, setDuration] = useState<number>(0);
  const [peaks, setPeaks] = useState<Peaks | null>(null);
  const [canvasWidth, setCanvasWidth] = useState<number>(0); // 내부 픽셀 폭

  const mixedRef = useRef<Float32Array | null>(null); // 모노 PCM
  const sampleRateRef = useRef<number | null>(null);

  /** 파형 재계산(모든 선행조건 충족 시에만) */
  const recomputePeaks = () => {
    const mixed = mixedRef.current;
    const sr = sampleRateRef.current;
    const bins = canvasWidth;

    if (!mixed) {
      console.warn("[peaks] mixed not ready");
      return;
    }
    if (!sr) {
      console.warn("[peaks] sampleRate not ready");
      return;
    }
    if (!duration || !Number.isFinite(duration)) {
      console.warn("[peaks] media duration not ready", duration);
      return;
    }
    if (!bins || bins <= 0) {
      console.warn("[peaks] canvas width(bins) invalid", bins);
      return;
    }

    const p = extractPeaksFitToWidthByMediaTime(mixed, sr, duration, bins);
    setPeaks(p);
  };

  /** 캔버스 드로잉(파형 + 플레이헤드) */
  const draw = () => {
    const canvas = canvasRef.current;
    const p = peaks;
    if (!canvas || !p) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 파형
    const mid = canvas.height / 2;
    ctx.beginPath();
    ctx.lineWidth = 1;
    ctx.strokeStyle = "#111";

    // bins == canvas.width → 1픽셀당 1수직선
    for (let x = 0; x < canvas.width; x++) {
      const min = p.mins[x] ?? 0;
      const max = p.maxs[x] ?? 0;
      const y1 = mid + min * mid;
      const y2 = mid + max * mid;
      ctx.moveTo(x + 0.5, y1);
      ctx.lineTo(x + 0.5, y2);
    }
    ctx.stroke();

    // 플레이헤드(미디어 타임라인 기준)
    const audio = audioRef.current;
    if (audio && duration > 0) {
      const ratio = (audio.currentTime || 0) / duration;
      const headX = Math.floor(ratio * canvas.width);
      ctx.beginPath();
      ctx.strokeStyle = "#ff2d55";
      ctx.moveTo(headX + 0.5, 0);
      ctx.lineTo(headX + 0.5, canvas.height);
      ctx.stroke();
    }
  };

  /** 오디오 디코드: 모노라이즈 + sampleRate 보관 (duration은 여기서 다루지 않음) */
  useEffect(() => {
    let cancelled = false;
    const ctx = new AudioContext();

    (async () => {
      const res = await fetch(audioUrl);
      const arr = await res.arrayBuffer();
      const audioBuf = await decodeAudioBuffer(ctx, arr);
      if (cancelled) return;

      sampleRateRef.current = audioBuf.sampleRate;

      const ch0 = audioBuf.getChannelData(0);
      if (audioBuf.numberOfChannels === 1) {
        mixedRef.current = ch0; // 참조(복사 없음)
      } else {
        const ch1 = audioBuf.getChannelData(1);
        const mono = new Float32Array(ch0.length);
        for (let i = 0; i < ch0.length; i++) mono[i] = (ch0[i] + ch1[i]) / 2;
        mixedRef.current = mono;
      }

      // 조건 미충족 시 가드로 noop → 안전
      recomputePeaks();
      draw();
    })().catch(console.error);

    return () => {
      cancelled = true;
      ctx.close().catch(() => {});
    };
    // audioUrl 변경 시만 재디코드
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audioUrl]);

  /** <audio> duration 설정(loadedmetadata + durationchange 둘 다로 안정화) */
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const setDur = () => {
      if (Number.isFinite(audio.duration) && audio.duration > 0) {
        setDuration(audio.duration);
      }
    };

    audio.addEventListener("loadedmetadata", setDur);
    audio.addEventListener("durationchange", setDur);
    // 이미 로드된 경우 대비
    setDur();

    return () => {
      audio.removeEventListener("loadedmetadata", setDur);
      audio.removeEventListener("durationchange", setDur);
    };
  }, []);

  /** DPR 반영 리사이즈 → 내부 폭(state) 갱신 */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      canvas.width = Math.max(1, Math.floor(rect.width * dpr));
      canvas.height = Math.max(1, Math.floor(height * dpr));
      canvas.style.height = `${height}px`;
      setCanvasWidth(canvas.width);
    };

    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    resize();

    return () => ro.disconnect();
  }, [height]);

  /** duration/캔버스폭 변동 시 피크 재계산 + 리드로잉 */
  useEffect(() => {
    recomputePeaks();
    draw();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [duration, canvasWidth]);

  /** 진행선 애니메이션 */
  useEffect(() => {
    let raf = 0;
    const loop = () => {
      draw();
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [peaks, duration]);

  /** 클릭 스크럽 */
  const onCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!audioRef.current || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    audioRef.current.currentTime = Math.max(
      0,
      Math.min(duration * ratio, duration)
    );
  };

  return (
    <div style={{ width: "100%", userSelect: "none" }}>
      <audio
        ref={audioRef}
        src={audioUrl}
        controls
        style={{ width: "100%", marginBottom: 8 }}
      />
      <div style={{ width: "100%", height }}>
        <canvas
          ref={canvasRef}
          onClick={onCanvasClick}
          style={{ width: "100%", display: "block", cursor: "pointer" }}
        />
      </div>
    </div>
  );
}
