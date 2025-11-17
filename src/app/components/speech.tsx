"use client";

import { Button } from "@/components/ui/button";
import { useState } from "react";

const Speech = () => {
  const [text, setText] = useState("");
  const [speechState, setSpeechState] = useState("idle");

  const startDictation = () => {
    if ("webkitSpeechRecogition" in window || "SpeechRecognition" in window) {
      const SpeechRecognition =
        (window as any).SpeechRecognition ||
        (window as any).webkitSpeechRecogition;

      const recognition = new SpeechRecognition();

      recognition.continuous = true;
      recognition.lang = "ko-KR"; // 한국어 인식
      recognition.interimResults = true; // 중간 결과 표시

      recognition.addEventListener("result", (e: any) => {
        const result = e.results[e.resultIndex];
        setText((prev) => (prev += result[0].transcript));
      });
      recognition.start();
      setSpeechState("start");

      recognition.addEventListener("end", (e: any) => {
        setSpeechState("end");
      });
      return recognition;
    }
  };

  return (
    <div>
      <div>{text.toString()}</div>
      <div>{speechState}</div>
      <Button onClick={startDictation}>음성인식 시작</Button>
    </div>
  );
};

export default Speech;
