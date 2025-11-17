"use client";

import { useEffect, useRef, useState } from "react";
import type { WebContainer } from "@webcontainer/api";
import { AnsiUp } from "ansi_up";

const DEFAULT_CODE = `const helloJS = () => {
  return ["H", "E", "L", "L", "O"].map(s => s + "😀")
};

console.log(helloJS());`;

export default function CodeRunner() {
  const [code, setCode] = useState(DEFAULT_CODE);
  const [output, setOutput] = useState("");
  const [isBooting, setIsBooting] = useState(true);
  const [_, setIsRunning] = useState(false);
  const [ansi, setAnsi] = useState<AnsiUp | null>(null);
  const webcontainerRef = useRef<WebContainer | null>(null);

  useEffect(() => {
    // 브라우저에서만 실행
    const init = async () => {
      try {
        setIsBooting(true);
        const { WebContainer } = await import("@webcontainer/api");

        const webcontainer = await WebContainer.boot();
        webcontainerRef.current = webcontainer;

        // 초기 파일 시스템 마운트
        await webcontainer.mount({
          "package.json": {
            file: {
              contents: JSON.stringify({
                name: "wc-runner",
                version: "1.0.0",
                main: "main.js",
                scripts: {
                  start: "node main.js",
                },
              }),
            },
          },
          "main.js": {
            file: {
              contents: DEFAULT_CODE,
            },
          },
        });

        setOutput((prev) => prev + "WebContainer boot 완료\n");
      } catch (err) {
        console.error(err);
        setOutput("WebContainer 초기화 실패\n" + String(err));
      } finally {
        setIsBooting(false);
      }
    };

    init();
  }, []);

  useEffect(() => {
    const ansi_up = new AnsiUp();
    setAnsi(ansi_up);
  }, []);

  const runCode = async () => {
    const webcontainer = webcontainerRef.current;
    if (!webcontainer || isBooting) return;

    setIsRunning(() => true);
    setOutput("");

    try {
      // 코드 파일 업데이트
      await webcontainer.fs.writeFile("main.js", code);

      // node 프로세스 실행
      const process = await webcontainer.spawn("node", ["main.js"]);

      // 출력 스트림 읽어서 상태에 반영
      const readable = process.output;

      await readable.pipeTo(
        new WritableStream({
          write(data) {
            // setOutput((prev) => prev + data);
            setOutput(data);
          },
        })
      );

      const exitCode = await process.exit;
      setOutput((prev) => prev + `\n프로세스 종료 (코드: ${exitCode})`);
    } catch (err) {
      console.error(err);
      setOutput("실행 중 오류 발생:\n" + String(err));
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 border border-zinc-800 rounded-xl p-4 bg-zinc-900/60">
      <div className="flex justify-between items-center">
        <span className="text-sm text-zinc-400">Node.js</span>
        <button
          onClick={runCode}
          disabled={!output}
          className={`px-3 py-1 rounded text-sm font-medium border
            ${
              !output
                ? "bg-zinc-700 border-zinc-600 cursor-not-allowed"
                : "bg-emerald-600 border-emerald-500 hover:bg-emerald-500"
            }`}
        >
          {isBooting ? "환경 준비 중..." : "코드 실행"}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* 코드 에디터 영역 (간단히 textarea로 처리) */}
        <div className="flex flex-col">
          <label className="text-sm mb-2 text-zinc-300">javascript</label>
          <textarea
            className="flex-1 min-h-[260px] text-sm font-mono bg-black/60 border border-zinc-700 rounded-lg p-2 outline-none focus:border-emerald-500"
            value={code}
            spellCheck={false}
            onChange={(e) => setCode(e.target.value)}
          />
        </div>

        {/* 출력 영역 */}
        <div className="flex flex-col">
          <span className="text-sm mb-2 text-zinc-300">출력</span>
          <pre
            dangerouslySetInnerHTML={{
              __html: ansi ? ansi.ansi_to_html(output) : "loading...",
            }}
            className="flex-1 min-h-[260px] text-sm font-mono bg-black/80 border border-zinc-700 rounded-lg p-2 whitespace-pre-wrap"
          ></pre>
        </div>
      </div>
    </div>
  );
}
