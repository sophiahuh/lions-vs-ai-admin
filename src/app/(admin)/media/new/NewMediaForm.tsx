/* eslint-disable @next/next/no-img-element */
"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

const MAX_EDGE = 1600;

async function toJpeg(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return new Promise((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error("Could not process image."))), "image/jpeg", 0.85));
}

export default function NewMediaForm({ adminId }: { adminId: string }) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [humanCaption, setHumanCaption] = useState("");
  const [words, setWords] = useState(10);
  const [status, setStatus] = useState<"idle" | "uploading" | "generating">("idle");
  const [error, setError] = useState<string | null>(null);
  const busy = status !== "idle";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return setError("Choose a photo.");
    setError(null);
    try {
      setStatus("uploading");
      const path = `${adminId}/${Date.now()}.jpg`;
      const { error: upError } = await createClient()
        .storage.from("uploads")
        .upload(path, await toJpeg(file), { contentType: "image/jpeg" });
      if (upError) throw upError;
      setStatus("generating");
      const res = await fetch("/api/media", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imagePath: path, humanCaption, words }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? "Something went wrong.");
      router.push(`/media/${json.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setStatus("idle");
    }
  }

  return (
    <form onSubmit={submit} className="card mt-6 space-y-5 p-5">
      <label className="block cursor-pointer overflow-hidden rounded-xl border-2 border-dashed border-line text-center hover:border-accent">
        {preview ? (
          <img src={preview} alt="Selected" className="max-h-80 w-full bg-cu-blue-soft object-contain" />
        ) : (
          <div className="px-4 py-12">
            <p className="text-3xl">🖼️</p>
            <p className="mt-2 font-medium">Choose a photo</p>
          </div>
        )}
        <input
          type="file"
          accept="image/*"
          className="sr-only"
          disabled={busy}
          onChange={(e) => {
            const f = e.target.files?.[0] ?? null;
            setFile(f);
            setPreview(f ? URL.createObjectURL(f) : null);
          }}
        />
      </label>

      <label className="block">
        <span className="text-sm font-medium">Seed human caption (optional)</span>
        <input value={humanCaption} onChange={(e) => setHumanCaption(e.target.value.slice(0, 140))} disabled={busy} className="field mt-1" placeholder="Posted as you, to start the first battle" />
      </label>

      {!humanCaption.trim() && (
        <label className="block">
          <span className="text-sm font-medium">Target AI caption length: {words} words</span>
          <input type="range" min={3} max={25} value={words} onChange={(e) => setWords(Number(e.target.value))} disabled={busy} className="mt-2 w-full accent-[var(--accent)]" />
        </label>
      )}

      {error && <p className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      <button disabled={busy} className="btn btn-primary w-full py-3">
        {status === "uploading" ? "Uploading…" : status === "generating" ? "Gemini is writing…" : "Generate AI caption"}
      </button>
    </form>
  );
}
