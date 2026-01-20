// /Users/kimhwan/Documents/toy/src/app/api/transcribe/route.ts
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!file) {
      return NextResponse.json({ error: "File is required" }, { status: 400 });
    }

    // 외부 API로 전송할 FormData 구성
    const externalFormData = new FormData();
    externalFormData.append("file", file);
    externalFormData.append("language", "ko");
    externalFormData.append("task", "transcribe");
    externalFormData.append("output", "json");

    const apiKey = process.env.STT_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: "API Key configuration error" },
        { status: 500 },
      );
    }

    const res = await fetch("https://ai.rootly.kr/transcribe", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
      },
      body: externalFormData,
    });

    if (!res.ok) {
      const errorText = await res.text();
      return NextResponse.json({ error: errorText }, { status: res.status });
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Transcribe API Error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
