"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import { deleteImage, refreshImages, replaceImage } from "./actions";

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

async function upload(adminId: string, file: File) {
  const path = `${adminId}/library-${Date.now()}.jpg`;
  const { error } = await createClient().storage.from("uploads").upload(path, await toJpeg(file), { contentType: "image/jpeg" });
  if (error) throw error;
  return path;
}

/** CREATE: upload a new image to the library. */
export function UploadImage({ adminId }: { adminId: string }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState<{ ok?: string; error?: string }>({});
  const [pending, start] = useTransition();
  return (
    <div className="flex flex-wrap items-center gap-3">
      <input
        ref={input}
        type="file"
        accept="image/*"
        className="sr-only"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (!f) return;
          start(async () => {
            try {
              await upload(adminId, f);
              await refreshImages();
              setMsg({ ok: "Uploaded." });
              router.refresh();
            } catch (err) {
              setMsg({ error: err instanceof Error ? err.message : "Upload failed." });
            }
            if (input.current) input.current.value = "";
          });
        }}
      />
      <button onClick={() => input.current?.click()} disabled={pending} className="btn btn-primary px-4 py-2.5">
        {pending ? "Uploading…" : "+ Upload image"}
      </button>
      {msg.error && <span className="text-sm text-red-600">{msg.error}</span>}
      {msg.ok && <span className="text-sm text-human">{msg.ok}</span>}
    </div>
  );
}

/** UPDATE (replace file) and DELETE for one image. */
export function ImageActions({ adminId, path, used }: { adminId: string; path: string; used: boolean }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState<{ ok?: string; error?: string }>({});
  const [pending, start] = useTransition();
  return (
    <div className="mt-2 flex flex-wrap items-center gap-3 text-xs">
      <input
        ref={input}
        type="file"
        accept="image/*"
        className="sr-only"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (!f) return;
          start(async () => {
            try {
              const newPath = await upload(adminId, f);
              setMsg(await replaceImage(path, newPath));
              router.refresh();
            } catch (err) {
              setMsg({ error: err instanceof Error ? err.message : "Replace failed." });
            }
          });
        }}
      />
      <button onClick={() => input.current?.click()} disabled={pending} className="font-semibold text-accent hover:underline">
        Replace
      </button>
      <button
        disabled={pending || used}
        title={used ? "Used by AI media. Delete the media instead." : undefined}
        onClick={() => {
          if (!confirm("Delete this image? This can't be undone.")) return;
          start(async () => {
            setMsg(await deleteImage(path));
            router.refresh();
          });
        }}
        className="font-semibold text-red-600 hover:underline disabled:cursor-not-allowed disabled:opacity-40"
      >
        Delete
      </button>
      {pending && <span className="text-muted">Working…</span>}
      {msg.error && <span className="text-red-600">{msg.error}</span>}
      {msg.ok && <span className="text-human">{msg.ok}</span>}
    </div>
  );
}
