"use client";

import { useRef, useState } from "react";
import { ImageUpIcon, Loader2Icon, Trash2Icon, UserRoundIcon } from "lucide-react";

import { Button } from "@/components/ui/button";

const MAX_DIMENSION = 640;
const MAX_INPUT_BYTES = 8 * 1024 * 1024;

/**
 * Centre-crops to a square and downscales in the browser before upload, so a
 * multi-megabyte camera file becomes a few tens of KB on the wire. Cloudinary
 * does the final resize; this only keeps the request small.
 */
async function toSquareBlob(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = MAX_DIMENSION;
  canvas.height = MAX_DIMENSION;

  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas is unavailable in this browser.");

  context.drawImage(
    bitmap,
    (bitmap.width - side) / 2,
    (bitmap.height - side) / 2,
    side,
    side,
    0,
    0,
    MAX_DIMENSION,
    MAX_DIMENSION,
  );
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", 0.85),
  );
  if (!blob) throw new Error("Could not encode that image.");
  return blob;
}

async function uploadPhoto(file: File): Promise<string> {
  const body = new FormData();
  body.append("file", await toSquareBlob(file), "photo.jpg");

  const response = await fetch("/api/profile/photo", { method: "POST", body });
  const payload = (await response.json().catch(() => ({}))) as {
    url?: string;
    error?: string;
  };
  if (!response.ok || !payload.url) {
    throw new Error(payload.error ?? "Upload failed.");
  }
  return payload.url;
}

export function PhotoField({
  value,
  onChange,
}: {
  readonly value: string;
  readonly onChange: (url: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  const pick = async (file: File | undefined) => {
    if (!file) return;
    setError(undefined);

    if (!file.type.startsWith("image/")) {
      setError("Choose an image file.");
      return;
    }
    if (file.size > MAX_INPUT_BYTES) {
      setError("That image is over 8MB. Pick a smaller one.");
      return;
    }

    setBusy(true);
    try {
      onChange(await uploadPhoto(file));
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Couldn't upload that image.");
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setError(undefined);
    setBusy(true);
    try {
      await fetch("/api/profile/photo", { method: "DELETE" });
      onChange("");
    } catch {
      setError("Couldn't remove that photo.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-5">
        <div className="relative size-24 shrink-0 overflow-hidden rounded-full border bg-muted">
          {value ? (
            // biome-ignore lint/performance/noImgElement: remote Cloudinary asset, already sized
            <img alt="Profile" className="size-full object-cover" src={value} />
          ) : (
            <div className="flex size-full items-center justify-center text-muted-foreground">
              <UserRoundIcon className="size-8" />
            </div>
          )}
          {busy ? (
            <div className="absolute inset-0 flex items-center justify-center bg-background/70">
              <Loader2Icon className="size-5 animate-spin text-muted-foreground" />
            </div>
          ) : null}
        </div>

        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            <Button
              disabled={busy}
              onClick={() => inputRef.current?.click()}
              size="sm"
              type="button"
              variant="outline"
            >
              <ImageUpIcon className="size-3.5" />
              {value ? "Replace photo" : "Browse photos"}
            </Button>
            {value ? (
              <Button
                className="text-muted-foreground hover:text-destructive"
                disabled={busy}
                onClick={() => void remove()}
                size="sm"
                type="button"
                variant="ghost"
              >
                <Trash2Icon className="size-3.5" />
                Remove
              </Button>
            ) : null}
          </div>
          <p className="text-muted-foreground text-xs">
            Stored on Cloudinary and shown in the preview only. Compiled PDFs stay photo-free — ATS
            parsers ignore images and some reject them outright.
          </p>
        </div>
      </div>

      {error ? <p className="text-destructive text-xs">{error}</p> : null}

      <input
        accept="image/*"
        className="hidden"
        onChange={(event) => void pick(event.target.files?.[0])}
        ref={inputRef}
        type="file"
      />
    </div>
  );
}
