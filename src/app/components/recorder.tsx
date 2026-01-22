"use client";

import { Button } from "@/components/ui/button";
import { useCallback, useEffect, useRef, useState } from "react";
import WavesurferPlayer from "@wavesurfer/react";
import WaveSurfer from "wavesurfer.js";
import LiveMicWaveform from "./liveMicWaveform";
import { toFlac16kMono } from "@/lib/transcode";
import {
  CirclePauseIcon,
  LoaderCircleIcon,
  MicIcon,
  PlayCircleIcon,
} from "lucide-react";
import { difficultSentences, easySentences } from "../../../public/sentences";
import { shuffleArray } from "@/lib/suffleArray";

const words = shuffleArray([...easySentences, ...difficultSentences]);

type Transcript = {
  text: string;
  words: { start: number; end: number; word: string }[];
};

export type RecState =
  | "idle"
  | "ready"
  | "recording"
  | "paused"
  | "finished"
  | "done"
  | "error";

const Recorder = () => {
  const [state, setState] = useState<RecState>("idle");
  const [audioURL, setAudioURL] = useState<string>("");
  const [recorder, setRecorder] = useState<MediaRecorder>();

  const [wavesurfer, setWavesurfer] = useState<WaveSurfer>();
  const [blob, setBlob] = useState<Blob | File>();
  const [loading, setLoading] = useState(false);
  const [resText, setResText] = useState("");
  const [transcript, setTranscript] = useState<Transcript["words"]>([]);
  const [currentWord, setCurrentWord] = useState("");
  const [currentTime, setCurrentTime] = useState(0);

  const mimeRef = useRef<string>("audio/webm");
  const chunksRef = useRef<ArrayBuffer[]>([]);
  const progressBarRef = useRef<HTMLDivElement>(null);
  const timeRef = useRef<HTMLSpanElement>(null);
  const rafRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);

  const onReady = (ws: WaveSurfer) => {
    setWavesurfer(ws);
  };

  const onPlayPause = () => {
    wavesurfer?.playPause();
  };

  const start = async () => {
    setCurrentWord(words[Math.floor(Math.random() * words.length)]);
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mediaRecorder = new MediaRecorder(stream, {
      mimeType: mimeRef.current,
    });
    setRecorder(mediaRecorder);

    mediaRecorder.ondataavailable = async (ev) => {
      if (!ev.data || ev.data.size === 0) return;
      const ab = await ev.data.arrayBuffer();
      // TODO: worker 에게 위임.
      chunksRef.current?.push(ab);
      // workerRef.current?.postMessage({ type: "WRITE", chunk: ab } as InMsg, [
      //   ab,
      // ]);
    };

    mediaRecorder.onstart = () => setState("recording");
    mediaRecorder.onstop = () => {
      stream.getTracks().forEach((t) => t.stop());
      setState("finished");
    };

    mediaRecorder.start(500);
  };

  const stop = useCallback(async () => {
    if (recorder?.state === "recording" || recorder?.state === "paused") {
      recorder.stop();
      const chunk = chunksRef.current;

      if (!chunk.length) return;
      const blob = new Blob(chunk, { type: mimeRef.current });
      setBlob(blob);
      const audioURL = URL.createObjectURL(blob);
      setAudioURL(audioURL);
      chunksRef.current = [];
      // TODO: add worker thread
    }
  }, [recorder]);

  const reset = () => {
    if (audioURL) {
      URL.revokeObjectURL(audioURL);
    }
    setState("idle");
    setAudioURL("");
    setBlob(undefined);
    setResText("");
    setTranscript([]);
    setCurrentWord("");
    chunksRef.current = [];
    if (progressBarRef.current) progressBarRef.current.style.width = "0%";
    if (timeRef.current) timeRef.current.innerText = "00:00";
  };

  const transcribe = async () => {
    try {
      if (blob) {
        setLoading(true);
        const flac = await toFlac16kMono(blob);

        if (!flac) return;
        const fd = new FormData();
        fd.append("file", flac);

        const res = await fetch("/api/transcribe", {
          method: "POST",
          body: fd,
        });
        if (!res.ok) {
          const t = await res.text();
          alert(`Error: ${res.status} ${t}`);
          return;
        }

        const json = (await res.json()) as Transcript;
        setTranscript(json.words ?? []);
        setResText(json.text ?? "");
      }
    } catch (error) {
      console.log(error);
    } finally {
      setLoading(false);
    }
  };

  const getScore = (currentWord: string, userText: string) => {
    const tokensA = currentWord
      .replace(/[^\w\s가-힣]/g, "")
      .trim()
      .split(/\s+/)
      .filter((t) => t.length > 0);
    const tokensB = userText
      .replace(/[^\w\s가-힣]/g, "")
      .trim()
      .split(/\s+/)
      .filter((t) => t.length > 0);

    if (tokensA.length === 0 || tokensB.length === 0) return 0;

    const setA = new Set(tokensA);
    const setB = new Set(tokensB);

    const intersection = new Set(
      [...setA].filter((a) =>
        [...setB].some((b) => a.includes(b) || b.includes(a)),
      ),
    );
    const currentTextLength = [...setA].reduce((cur, val) => {
      return cur + val.length;
    }, 0);

    const correctTextLength = [...intersection].reduce((cur, val) => {
      return cur + val.length;
    }, 0);

    if (currentTextLength === 0) return 0;
    return Math.round((correctTextLength / currentTextLength) * 100);
  };

  useEffect(() => {
    if (!wavesurfer) return;

    const sub = wavesurfer.on("timeupdate", (time) => {
      setCurrentTime(time);
    });

    return () => sub();
  }, [wavesurfer]);

  useEffect(() => {
    // 녹음 MIME 결정 (Safari는 보통 audio/mp4가 안정적)
    const isSupportCodec = MediaRecorder.isTypeSupported(
      "audio/webm;codecs=opus",
    );
    const isMp4 = MediaRecorder.isTypeSupported("audio/mp4");
    if (isSupportCodec) {
      mimeRef.current = "audio/webm;codecs=opus";
      return;
    }
    if (isMp4) {
      mimeRef.current = "audio/mp4";
    }
  }, []);

  useEffect(() => {
    if (state === "recording") {
      startTimeRef.current = Date.now();
      const loop = () => {
        const now = Date.now();
        const diff = now - startTimeRef.current;

        if (progressBarRef.current) {
          progressBarRef.current.style.width = `${(diff / 5000) * 100}%`;
        }
        if (timeRef.current) {
          const sec = Math.floor(diff / 1000)
            .toString()
            .padStart(2, "0");

          timeRef.current.innerText = `00:${sec}`;
        }

        if (diff >= 5000) {
          stop();
          return;
        }

        rafRef.current = requestAnimationFrame(loop);
      };
      rafRef.current = requestAnimationFrame(loop);
    } else if (state === "idle" || state === "ready") {
      if (progressBarRef.current) progressBarRef.current.style.width = "0%";
      if (timeRef.current) timeRef.current.innerText = "00:00";
    }
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [state, stop]);

  return (
    <div className="flex flex-col justfy-center mt-20 items-center max-w-4xl mx-auto p-4">
      <div className="flex items-end justify-start mb-4 space-x-2 w-full">
        <h1 className="text-2xl font-bold">O-Cho (오초) </h1>
        <span>AI 발음 테스트</span>
      </div>
      <div className="p-6 border rounded-2xl w-full flex flex-col items-center">
        <div className="h-1 w-full bg-zinc-800 mb-4 rounded-full overflow-hidden">
          <div
            ref={progressBarRef}
            className="h-full bg-white transition-all duration-75 ease-linear"
            style={{ width: "0%" }}
          />
        </div>
        <span ref={timeRef} className="inline-block text-2xl font-bold">
          00:00
        </span>
        {state === "idle" && (
          <div
            className="border p-4 rounded-2xl mt-16 hover:bg-gray-800 cursor-pointer transition-colors"
            onClick={() => {
              start();
            }}
          >
            <MicIcon width={100} height={100} />
          </div>
        )}
        {state !== "idle" && (
          <div className="space-y-8 mt-16">
            <p className="text-2xl max-w-90 h-30 flex items-center">
              {currentWord}
            </p>
            {state !== "finished" && (
              <LiveMicWaveform recordState={state} className="w-full" />
            )}
          </div>
        )}
        <div className="space-y-4 flex flex-col mt-12 items-center">
          {audioURL && state === "finished" && (
            <div className="flex items-center justify-around flex-row w-full border p-2 rounded-xl">
              <button
                onClick={onPlayPause}
                className="cursor-pointer hover:bg-gray-600/50 rounded-full flex items-center justify-center"
              >
                {wavesurfer?.isPlaying() ? (
                  <CirclePauseIcon width={50} height={50} />
                ) : (
                  <PlayCircleIcon width={50} height={50} />
                )}
              </button>
              <div className="h-16 w-px bg-gray-500 mx-2" />

              <WavesurferPlayer
                height={80}
                width={250}
                barHeight={2}
                cursorColor="oklch(76.5% 0.177 163.223)"
                cursorWidth={2}
                waveColor="rgb(255,255,255)"
                progressColor="#FFFFFF"
                url={audioURL}
                onReady={onReady}
                onFinish={() => {
                  wavesurfer?.seekTo(0);
                }}
              />
            </div>
          )}
          {resText && (
            <div className="flex flex-col border rounded-2xl p-4">
              <span>AI 분석 결과 {getScore(currentWord, resText)}% 일치</span>
              <div className="max-w-90">
                {transcript.map((t, i) => {
                  const isActive =
                    currentTime >= t.start && currentTime <= t.end;
                  return (
                    <span
                      key={i}
                      className={`text-2xl transition-colors duration-100 ${
                        isActive
                          ? "text-emerald-400 font-bold"
                          : "text-zinc-400"
                      }`}
                    >
                      {t.word}{" "}
                    </span>
                  );
                })}
              </div>
            </div>
          )}
          {state === "finished" && (
            <div className="flex items-center flex-col space-y-4">
              {loading ? (
                <div className="flex items-center space-x-2">
                  <LoaderCircleIcon className="size-4 animate-spin" />
                  <span>분석중...</span>
                </div>
              ) : (
                <div className="flex gap-2">
                  {!resText && <Button onClick={transcribe}>분석하기</Button>}
                  {resText && (
                    <Button onClick={reset} variant="secondary">
                      다시하기
                    </Button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      <div className="ml-auto text-xs">사용 모델: whisperAI-small</div>
      <div className="ml-auto text-xs">ai는 다른 결과물을 낼수도 있어요 😅</div>
    </div>
  );
};

export default Recorder;
