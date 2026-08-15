"use client";

import { useRef, useState } from "react";
import { ImageUpIcon, Trash2Icon, UserRoundIcon } from "lucide-react";

import { Button } from "@/components/ui/button";

const MAX_DIMENSION = 320;
const MAX_INPUT_BYTES = 8 * 1024 * 1024;

/**
 * Downscales to a square JPEG data URL in the browser, so the photo stays a
 * few tens of KB in the database instead of a multi-megabyte camera file.
 */
async function toSquareDataUrl(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = MAX_DIMENSION;
  canvas.height = MAX_DIMENSION;

  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas is unavailable in this browser.");

  // Centre-crop to a square, then scale down.
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
  return canvas.toDataURL("image/jpeg", 0.85);
}

export function PhotoField({
  value,
  onChange,
}: {
  readonly value: string;
  readonly onChange: (dataUrl: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string>();

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

    try {
      onChange(await toSquareDataUrl(file));
    } catch {
      setError("Couldn't read that image.");
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-5">
        <div className="size-24 shrink-0 overflow-hidden rounded-full border bg-muted">
          {value ? (
            // biome-ignore lint/performance/noImgElement: inline data URL, not a remote asset
            <img alt="Profile" className="size-full object-cover" src={value} />
          ) : (
            <div className="flex size-full items-center justify-center text-muted-foreground">
              <UserRoundIcon className="size-8" />
            </div>
          )}
        </div>

        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => inputRef.current?.click()} size="sm" type="button" variant="outline">
              <ImageUpIcon className="size-3.5" />
              {value ? "Replace photo" : "Browse photos"}
            </Button>
            {value ? (
              <Button
                className="text-muted-foreground hover:text-destructive"
                onClick={() => onChange("")}
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
            Shown in the preview only. Compiled PDFs stay photo-free — ATS parsers ignore images
            and some reject them outright.
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
