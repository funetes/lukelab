"use client";

import { Button } from "@/components/ui/button";
//  녹음 => 저장 (idb - blob형태)
//  1. 녹음할때 상태, 필요 데이터 파악하기
//  2. 저장 - 청크단위로 push하고 나중에 한번에 합치기

import { useCallback, useEffect, useRef, useState } from "react";
import WavesurferPlayer from "@wavesurfer/react";
import WaveSurfer from "wavesurfer.js";
import LiveMicWaveform from "./liveMicWaveform";
import { toFlac16kMono } from "@/lib/transcode";
import { LoaderCircleIcon, MicIcon } from "lucide-react";

const easySentences = [
  "지금 보시는 이 그래프는 지난 분기 대비 성장률을 보여줍니다",
  "이번 프로젝트의 가장 핵심적인 목표는 사용자 경험 개선입니다",
  "다음 장표로 넘어가서 구체적인 실행 방안을 말씀드리겠습니다",
  "우리가 직면한 문제를 해결하기 위해 새로운 접근이 필요합니다",
  "오늘 발표를 통해 여러분과 함께 새로운 기회를 찾고 싶습니다",
  "결과적으로 비용 절감과 효율성 증대라는 성과를 얻었습니다",
  "내일 전국적으로 비가 내릴 예정이니 우산을 챙기시기 바랍니다",
  "서울 도심에서 열린 축제에 많은 시민들이 참여해 즐겼습니다",
  "정부는 이번 정책을 통해 청년 일자리를 늘리겠다고 밝혔습니다",
  "지하철 이용 시 발이 빠지지 않도록 주의해 주시길 바랍니다",
  "이번 사건의 정확한 원인은 아직 조사 중에 있는 것으로 보입니다",
  "잠시 후 1번 게이트에서 탑승 수속이 시작될 예정입니다",
  "오늘 점심은 뭐 먹을까 한참 고민하다가 결국 김치찌개 먹었어",
  "주말에 시간 되면 같이 영화 보러 갈래? 재미있는 거 개봉했대",
  "날씨가 갑자기 너무 추워져서 내일은 패딩을 입어야 할 것 같아",
  "요즘 너무 바빠서 연락을 못  그동안 별일 없이 잘 지냈니",
  "퇴근하고 집에 가서 씻고 맥주 한 잔 마시면 딱 좋을 것 같아",
  "혹시 그 이야기 들었어? 이번에 새로 생긴 카페가 정말 예쁘대",
  "서버 배포하기 전에 반드시 도커 컨테이너 상태를 확인해야 해요",
  "이번 버그는 비동기 처리 과정에서 발생한 타이밍 문제 같습니다",
  "리액트 네이티브 성능 최적화를 위해 새로운 모듈을 도입했습니다",
  "데이터베이스 쿼리 속도가 느려서 인덱스를 다시 걸어야 합니다",
  "API 명세서가 변경되었으니 프론트엔드 코드 수정이 필요합니다",
  "코드를 병합하기 전에 테스트 코드를 한 번 더 돌려보겠습니다",
  "창밖으로 보이는 붉은 노을이 오늘따라 유난히 아름답게 느껴져",
  "그는 조용히 책을 덮고 나서 창가로 다가가 밖을 내다보았다",
  "차가운 겨울바람 끝에서 비로소 따뜻한 봄의 기운이 느껴진다",
  "아무것도 하지 않아도 괜찮은, 그런 평온한 오후가 지나간다",
  "우리가 함께 걸었던 그 길에는 여전히 추억이 머물러 있었다",
  "깊은 밤, 잠들지 못하는 생각들이 머릿속을 가득 채우고 있다",
];

const difficultSentences = [
  "서울특별시 특허허가과 허가과장 허 과장은 헌 과장이고, 새 과장은 안 과장입니다",
  "경찰청 창살 쇠창살은 외철 창살이고, 검찰청 창살 쇠창살은 쌍철 창살이라는 점입니다",
  "저기 계신 저분이 박 법학박사이고, 여기 계신 이분이 백 법학박사님이십니다",
  "간장 공장 공장장은 강 공장장이고, 된장 공장 공장장은 공 공장장이라는 사실입니다",
  "안 촉촉한 초코칩 나라에 살던 안 촉촉한 초코칩이 촉촉한 초코칩이 되었습니다",
  "한국관광공사 곽 관광 과장은 관광 과목 강의를 위해 관광 교육과정을 개설했습니다",
  "신진 샹송 가수의 신춘 샹송 쇼는 정말 쑥스럽고 색다른 센세이션을 일으켰습니다",
  "칠월 칠일은 평창 친구 친정 칠순 잔칫날이라 칠칠한 며느리가 채소 쌈을 차렸습니다",
  "붉은 팥 풋팥죽은 헛배가 부르고, 묽은 팥 풋팥죽은 배가 안 부르다는 옛말이 있죠",
  "상표를 붙인 큰 깡통은 깐 깡통인가 안 깐 깡통인가를 자세히 관찰해 보십시오",
  "금융감독원은 가상자산 이용자 보호법 시행에 따라 불공정 거래 행위를 엄중히 단속합니다",
  "중앙선거관리위원회는 공직선거법 위반 혐의에 대해 철저히 조사하겠다고 밝혔습니다",
  "기상청은 북태평양 고기압의 가장자리에 들어 대기 불안정에 의한 소나기를 예보했습니다",
  "헌법재판소는 이번 탄핵 심판 청구 사건에 대해 재판관 전원 일치로 기각을 선고했습니다",
  "생각이란 생각하면 생각할수록 생각나는 것이 바로 생각이라는 것을 생각하시길 바랍니다",
];

function shuffleArray(array: Array<string>) {
  let currentIndex = array.length,
    randomIndex;

  // While there remain elements to shuffle.
  while (currentIndex !== 0) {
    // Pick a remaining element.
    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex--;

    // And swap it with the current element.
    [array[currentIndex], array[randomIndex]] = [
      array[randomIndex],
      array[currentIndex],
    ];
  }

  return array;
}

const words = shuffleArray([...easySentences, ...difficultSentences]);

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
  const [isPlaying, setIsPlaying] = useState(false);
  const [blob, setBlob] = useState<Blob | File>();
  const [loading, setLoading] = useState(false);
  const [resText, setResText] = useState("");
  const [currentWord, setCurrentWord] = useState("");

  const mimeRef = useRef<string>("audio/webm");
  const chunksRef = useRef<ArrayBuffer[]>([]);
  const progressBarRef = useRef<HTMLDivElement>(null);
  const timeRef = useRef<HTMLSpanElement>(null);
  const rafRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);

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

      // if (!chunk.length) return;
      const blob = new Blob(chunk, { type: mimeRef.current });
      setBlob(blob);
      const audioURL = URL.createObjectURL(blob);
      setAudioURL(audioURL);
      chunksRef.current = [];
      // TODO: add worker thread
    }
  }, [recorder]);

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

  const reset = () => {
    if (audioURL) {
      URL.revokeObjectURL(audioURL);
    }
    setState("idle");
    setAudioURL("");
    setBlob(undefined);
    setResText("");
    setCurrentWord("");
    setIsPlaying(false);
    chunksRef.current = [];
    if (progressBarRef.current) progressBarRef.current.style.width = "0%";
    if (timeRef.current) timeRef.current.innerText = "00:00";
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

        const res = await fetch("/api/transcribe", {
          method: "POST",
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

  const getScore = (currentWord: string, resText: string) => {
    const currentWordTrim = currentWord.trim().replaceAll(" ", "");
    const resTextTrim = resText.trim().replaceAll(" ", "");
    if (!currentWordTrim || !resTextTrim) return 0;
    if (currentWordTrim === resTextTrim) return 100;

    let score = 0;

    Array.from(currentWordTrim).forEach((char, i) => {
      if (char[i] === resText[i]) score = +score;
    });
    return Math.round(score / resText.length);
  };

  return (
    <div className="flex flex-col justfy-center mt-20 items-center max-w-4xl mx-auto p-4">
      <div className="flex items-end justify-start mb-4 space-x-2 w-full">
        <h1 className="text-2xl font-bold">O-Cho (오초) </h1>
        <span>ai가 발음을 채점해드립니다.</span>
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
        <div className="space-y-4 flex flex-col mt-20 items-center">
          {audioURL && state === "finished" && (
            <div className="flex items-center flex-col space-y-4">
              <div className="space-x-4">
                <Button onClick={onPlayPause} variant={"ghost"}>
                  미리듣기
                </Button>
              </div>
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
            </div>
          )}
          {state === "finished" && (
            <div className="flex items-center flex-col space-y-4">
              {loading ? (
                <div className="flex items-center space-x-2">
                  <LoaderCircleIcon className="size-4 animate-spin" />
                  <span>채점중...</span>
                </div>
              ) : (
                <div className="flex gap-2">
                  <Button onClick={transcribe}>채점하기</Button>
                  <Button onClick={reset} variant="secondary">
                    다시하기
                  </Button>
                </div>
              )}
            </div>
          )}
          {resText && (
            <div className="flex flex-col border rounded-2xl p-4">
              <span>AI 채점 결과 {getScore(currentWord, resText)} %일치</span>
              <div className="text-2xl max-w-90 flex items-center">
                {resText}
              </div>
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
