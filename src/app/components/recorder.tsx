"use client";

import { Button } from "@/components/ui/button";
//  녹음 => 저장 (idb - blob형태)
//  1. 녹음할때 상태, 필요 데이터 파악하기
//  2. 저장 - 청크단위로 push하고 나중에 한번에 합치기

import { useEffect, useRef, useState } from "react";
import WavesurferPlayer from "@wavesurfer/react";
import WaveSurfer from "wavesurfer.js";
import LiveMicWaveform from "./liveMicWaveform";
import { toFlac16kMono } from "@/lib/transcode";

export type RecState =
  | "idle"
  | "ready"
  | "recording"
  | "paused"
  | "finishing"
  | "done"
  | "error";

// const fmtBytes = (n: number) => {
//   if (n < 1024) return `${n} B`;
//   const u = ["KB", "MB", "GB", "TB"];
//   let i = -1;
//   let v = n;
//   do {
//     v /= 1024;
//     i++;
//   } while (v >= 1024 && i < u.length - 1);
//   return `${v.toFixed(2)} ${u[i]}`;
// };

const Recorder = () => {
  const [state, setState] = useState<RecState>("idle");
  const [audioURL, setAudioURL] = useState<string>("");
  const [recorder, setRecorder] = useState<MediaRecorder>();

  const mimeRef = useRef<string>("audio/webm");
  const chunksRef = useRef<ArrayBuffer[]>([]);
  // const audioRef = useRef<HTMLAudioElement>(null);

  const [wavesurfer, setWavesurfer] = useState<WaveSurfer>();
  const [isPlaying, setIsPlaying] = useState(false);
  const [blob, setBlob] = useState<Blob | File>();
  // const [flac, setFlac] = useState<File | null>();
  const [loading, setLoading] = useState(false);
  const [resText, setResText] = useState("");

  const onReady = (ws: WaveSurfer) => {
    setWavesurfer(ws);
    setIsPlaying(false);
  };

  const onPlayPause = () => {
    wavesurfer?.playPause();
  };

  useEffect(() => {
    // 녹음 MIME 결정 (Safari는 보통 audio/mp4가 안정적)
    const isSupportCodec = MediaRecorder.isTypeSupported(
      "audio/webm;codecs=opus"
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

  const start = async () => {
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
    mediaRecorder.onpause = () => setState("paused");
    mediaRecorder.onresume = () => setState("recording");
    mediaRecorder.onstop = () => {
      stream.getTracks().forEach((t) => t.stop());
      // stopTimer();
      setState("finishing");
    };

    mediaRecorder.start(500);
  };

  // const pause = () => {
  //   if (recorder?.state === "recording") {
  //     setState("paused");
  //     recorder.pause();
  //   }
  // };

  // const resume = () => {
  //   if (recorder?.state === "paused") {
  //     setState("recording");
  //     recorder.resume();
  //   }
  // };

  const stop = async () => {
    if (recorder?.state === "recording" || recorder?.state === "paused") {
      recorder.stop();
      const chunk = chunksRef.current;

      // if (!chunk.length) return;
      const blob = new Blob(chunk, { type: mimeRef.current });
      setBlob(blob);
      const audioURL = URL.createObjectURL(blob);
      setAudioURL(audioURL);
      chunksRef.current = [];
      // TODO: add worker thread
    }
  };

  const deleteAudio = () => {
    URL.revokeObjectURL(audioURL);
    // chunksRef.current = [];
    setAudioURL("");
    // setFlac(null);
  };

  const transcribe = async () => {
    try {
      if (blob) {
        setLoading(true);
        const flac = await toFlac16kMono(blob);
        // TODO: fileupload / transcribe 요청
        // setFlac(flac);

        if (!flac) return;
        const fd = new FormData();
        fd.append("file", flac);
        fd.append("language", "ko"); // 옵션: ko/en/auto
        fd.append("task", "transcribe"); // 또는 translate
        fd.append("output", "json"); // srt/vtt/txt 가능

        const res = await fetch("https://ai.rootly.kr/transcribe", {
          method: "POST",
          headers: {
            "x-api-key": process.env.NEXT_PUBLIC_STT_KEY as string,
          },
          body: fd,
        });
        if (!res.ok) {
          const t = await res.text();
          alert(`Error: ${res.status} ${t}`);
          return;
        }

        const json = await res.json();
        setResText(json.text ?? "");
      }
    } catch (error) {
      console.log(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-2">녹음기</h1>
      <p>TODO</p>
      <ul>
        <li>web worker - indexed db에 저장</li>
        <li>upload server and transcribe file</li>
      </ul>
      <div className="space-y-4 flex flex-col">
        <LiveMicWaveform recordState={state} />
        <div className="flex gap-4 justify-center">
          <Button
            onClick={() => {
              if (
                recorder?.state === "recording" ||
                recorder?.state === "paused"
              ) {
                stop();
                return;
              }
              start();
            }}
          >
            {recorder?.state === "recording" || recorder?.state === "paused"
              ? "중지"
              : "시작"}
          </Button>
          {(recorder?.state === "recording" ||
            recorder?.state === "paused") && (
            <Button
              onClick={() => {
                if (recorder?.state === "recording") {
                  setState("paused");
                  recorder.pause();
                  return;
                }
                if (recorder?.state === "paused") {
                  setState("recording");
                  recorder.resume();
                }
              }}
            >
              {recorder?.state === "recording" && "일시 중지"}
              {recorder?.state === "paused" && "재개"}
            </Button>
          )}
        </div>
        {audioURL && state === "finishing" && (
          <div className="flex items-center flex-col space-y-4">
            <div>미리듣기</div>
            <WavesurferPlayer
              height={100}
              width={250}
              waveColor="rgb(255,255,255)"
              progressColor="#FFFFFF"
              url={audioURL}
              onReady={onReady}
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
            />

            <div className="space-x-4">
              <Button onClick={onPlayPause}>
                {isPlaying ? "Pause" : "Play"}
              </Button>

              <Button onClick={deleteAudio}>삭제</Button>
            </div>
          </div>
        )}
        <div className="flex items-center flex-col space-y-4">
          {loading ? (
            "loading..."
          ) : (
            <Button onClick={transcribe}>받아쓰기</Button>
          )}
        </div>
        {resText && <div>{resText}</div>}
      </div>
    </div>
  );
};

export default Recorder;
