"use client";

import { useEffect, useRef, useState } from "react";
import { SendHorizonal, RefreshCcw, LoaderCircle } from "lucide-react";
import ReactMarkdown from "react-markdown";
import type { Components } from "react-markdown";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type MessageRole = "user" | "assistant" | "system";

interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
}

const DEFAULT_GREETING =
  "안녕하세요! 왼쪽 입력창에 메세지를 작성하면 간단한 요약을 만들어 드릴게요.";

const markdownComponents: Components = {
  p: ({ children }) => (
    <p className="mb-2 last:mb-0 whitespace-pre-wrap">{children}</p>
  ),
  strong: ({ children }) => (
    <strong className="font-semibold text-white">{children}</strong>
  ),
  em: ({ children }) => <em className="italic text-zinc-200">{children}</em>,
  ul: ({ children }) => (
    <ul className="list-disc pl-5 space-y-1 text-zinc-200">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="list-decimal pl-5 space-y-1 text-zinc-200">{children}</ol>
  ),
  li: ({ children }) => <li className="">{children}</li>,
  blockquote: ({ children }) => (
    <blockquote className="border-l-4 border-emerald-500/50 pl-3 text-zinc-300 italic">
      {children}
    </blockquote>
  ),
  code: ({ children }) => (
    <pre className="bg-black/60 border border-zinc-800 rounded-xl p-3 text-emerald-100 text-sm overflow-x-auto">
      <code>{children}</code>
    </pre>
  ),
  a: ({ children, href }) => (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="text-emerald-300 underline underline-offset-2"
    >
      {children}
    </a>
  ),
};

export default function ChatPanel() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "assistant-welcome",
      role: "assistant",
      content: DEFAULT_GREETING,
    },
  ]);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // 새 메세지가 추가될 때마다 맨 아래로 스크롤
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages]);

  const resetChat = () => {
    setMessages([
      {
        id: "assistant-welcome",
        role: "assistant",
        content: DEFAULT_GREETING,
      },
    ]);
    setInput("");
  };

  const handleSubmit = async () => {
    const trimmedInput = input.trim();
    if (!trimmedInput || isSending) return;

    const newMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: trimmedInput,
    };

    setMessages((prev) => [...prev, newMessage]);
    setInput("");
    setIsSending(true);

    const historyPayload = [...messages, newMessage]
      .slice(-6)
      .map(({ role, content }) => ({
        role,
        content,
      }));

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: newMessage.content,
          history: historyPayload,
        }),
      });

      if (!response.ok || !response.body) {
        const errorBody = await response.text();
        throw new Error(
          errorBody || "응답을 받지 못했습니다. 잠시 후 다시 시도해주세요."
        );
      }

      const assistantId = crypto.randomUUID();
      setMessages((prev) => [
        ...prev,
        { id: assistantId, role: "assistant", content: "" },
      ]);

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let aggregated = "";

      const appendChunk = (chunk: string) => {
        if (!chunk) return;
        aggregated += chunk;
        setMessages((prev) =>
          prev.map((message) =>
            message.id === assistantId
              ? { ...message, content: message.content + chunk }
              : message
          )
        );
      };

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        appendChunk(chunk);
      }

      // flush any remaining buffered text
      appendChunk(decoder.decode());

      if (!aggregated) {
        appendChunk("서버에서 비어있는 응답이 도착했습니다.");
      }
    } catch (error) {
      const assistantMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: `오류가 발생했어요: ${
          error instanceof Error ? error.message : "알 수 없는 이유"
        }`,
      };
      setMessages((prev) => [...prev, assistantMessage]);
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSubmit();
    }
  };

  const renderMessage = (message: ChatMessage) => {
    const isUser = message.role === "user";
    return (
      <div
        key={message.id}
        className={cn(
          "rounded-2xl px-4 py-3 text-sm whitespace-nowrap leading-relaxed shadow-sm",
          isUser
            ? "bg-emerald-500/20 border border-emerald-500/40 self-end text-emerald-50 text-right"
            : "bg-zinc-900/70 border border-zinc-800 text-zinc-100"
        )}
      >
        <ReactMarkdown components={markdownComponents}>
          {message.content}
        </ReactMarkdown>
      </div>
    );
  };

  return (
    <section className="flex flex-col w-full h-[calc(100vh-4rem)] max-w-4xl mx-auto gap-4">
      <header className="flex items-center justify-between">
        <div>
          <p className="text-sm uppercase text-zinc-400">Chat playground</p>
          <h1 className="text-xl font-semibold text-white">
            ChatGPT 스타일 대화
          </h1>
        </div>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-zinc-200"
          onClick={resetChat}
          disabled={isSending}
        >
          <RefreshCcw className="size-4" /> 초기화
        </Button>
      </header>
      <div className="flex-1 flex flex-col gap-3">
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto rounded-3xl border border-zinc-800 bg-linear-to-b from-zinc-900/80 to-zinc-950 p-4 space-y-4"
        >
          {messages.map((message) => renderMessage(message))}
          {isSending && (
            <div className="flex items-center gap-2 text-xs text-emerald-200/80 px-2">
              <LoaderCircle className="size-4 animate-spin text-emerald-300" />
            </div>
          )}
        </div>
      </div>
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-4 space-y-3 shadow-lg shadow-zinc-950/40">
        <textarea
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="메세지를 입력하고 Enter를 눌러보세요"
          maxLength={1000}
          className="w-full min-h-24 resize-none rounded-xl bg-black/30 border border-zinc-800 text-sm text-zinc-100 p-3 focus:outline-none focus:ring-2 focus:ring-emerald-500/60"
          disabled={isSending}
        />
        <div className="flex justify-between items-center text-xs text-zinc-400">
          <span>
            Shift + Enter = 줄바꿈 · 최대 1,000자까지 전송할 수 있어요
          </span>
          <Button
            type="button"
            className="min-w-28"
            onClick={handleSubmit}
            disabled={!input.trim() || isSending}
          >
            {isSending ? (
              "전송 중..."
            ) : (
              <>
                메세지 전송 <SendHorizonal className="size-4" />
              </>
            )}
          </Button>
        </div>
      </div>
    </section>
  );
}
