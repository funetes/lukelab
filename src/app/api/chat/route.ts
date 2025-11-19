import { NextResponse } from "next/server";

interface ChatRequest {
  message?: string;
  history?: { role: string; content: string }[];
}

const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";

const buildMessages = (message: string, history: ChatRequest["history"]) => {
  const messages: ChatRequest["history"] = [
    {
      role: "system",
      content:
        "You are a friendly Korean AI assistant who responds with concise, helpful explanations.",
    },
  ];

  if (history && history.length > 0) {
    for (const entry of history) {
      if (entry.role === "user" || entry.role === "assistant") {
        messages.push({ role: entry.role, content: entry.content });
      }
    }
  }

  messages.push({ role: "user", content: message });
  return messages;
};

const streamOpenAIResponse = async (payload: {
  message: string;
  history?: ChatRequest["history"];
  apiKey: string;
}) => {
  const { message, history, apiKey } = payload;

  const response = await fetch(OPENAI_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
      stream: true,
      temperature: 0.2,
      messages: buildMessages(message, history),
    }),
  });

  if (!response.ok || !response.body) {
    const errorText = await response.text();
    throw new Error(
      `OpenAI API 호출 실패 (${response.status}): ${
        errorText || "상세 오류 없음"
      }`
    );
  }

  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  return new ReadableStream({
    async start(controller) {
      const reader = response.body!.getReader();
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith(":")) continue;

          if (trimmed === "data: [DONE]") {
            controller.close();
            return;
          }

          if (!trimmed.startsWith("data:")) continue;
          const jsonString = trimmed.slice(5).trim();

          try {
            const parsed = JSON.parse(jsonString);
            const content =
              parsed.choices?.[0]?.delta?.content ??
              parsed.choices?.[0]?.message?.content;
            if (content) {
              controller.enqueue(encoder.encode(content));
            }
          } catch (error) {
            console.error("OpenAI chunk parse error", error, jsonString);
          }
        }
      }

      controller.close();
    },
  });
};

export async function POST(request: Request) {
  const body = (await request.json()) as ChatRequest;
  const { message } = body;

  if (!message || typeof message !== "string") {
    return NextResponse.json(
      { error: "message 필드를 포함해서 호출해 주세요." },
      { status: 400 }
    );
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "OPENAI_API_KEY 환경 변수가 설정되어 있지 않습니다." },
      { status: 500 }
    );
  }

  try {
    const stream = await streamOpenAIResponse({
      message,
      history: body.history,
      apiKey,
    });

    return new Response(stream, {
      headers: {
        "Cache-Control": "no-cache",
        "Content-Type": "text/plain; charset=utf-8",
        "Transfer-Encoding": "chunked",
      },
    });
  } catch (error) {
    console.error("Chat route error:", error);
    const errMessage =
      error instanceof Error ? error.message : "OpenAI 응답 처리 중 오류";
    return NextResponse.json({ error: errMessage }, { status: 500 });
  }
}
