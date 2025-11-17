"use client";

import { fetchFile } from "@ffmpeg/util";
import { ensureFFmpeg } from "./ffmpeg";
import { FileData } from "@ffmpeg/ffmpeg";

/** Blob/File → FLAC(16kHz/mono) */
export async function toFlac16kMono(
  input: Blob | File,
  outName = "audio.flac"
) {
  const ffmpeg = await ensureFFmpeg(false);

  const inName =
    "input." +
    (input instanceof File ? input.name.split(".").pop() || "webm" : "webm");
  await ffmpeg.writeFile(inName, await fetchFile(input));

  await ffmpeg.exec([
    "-i",
    inName,
    "-ac",
    "1",
    "-ar",
    "16000",
    "-c:a",
    "flac",
    outName,
  ]);

  const data: FileData = await ffmpeg.readFile(outName);

  // @ts-ignore
  const file = new File([data], outName, { type: "audio/flac" });

  try {
    await ffmpeg.deleteFile(inName);
  } catch {}
  try {
    await ffmpeg.deleteFile(outName);
  } catch {}

  return file;
}
