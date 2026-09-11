import { crc32, deflateSync } from "node:zlib";
import mammoth from "mammoth";
import { extractImages } from "unpdf";

/**
 * Pulls the candidate headshot out of an uploaded CV.
 *
 * A CV carries several images — social icons, language flags, section rules,
 * a company logo — so the photo is chosen by shape rather than by order:
 * headshots are large and square-to-portrait, decoration is small or wide.
 * A wrong pick costs the user one click on Remove, because the result lands in
 * the photo field for review like any other upload.
 */
export type CvPhoto = { buffer: Buffer; mediaType: string };

/** Below this it is an icon, a flag or a hairline rule, not a person. */
const MIN_SIDE = 90;
/** Square to portrait. Anything wider is a banner, a logo or a page background. */
const MIN_ASPECT = 0.45;
const MAX_ASPECT = 1.4;
/** Cloudinary re-crops to 512², so larger is bytes we would throw away anyway. */
const MAX_SIDE = 512;
/** A CV photo is on the first page. Later pages are references and portfolios. */
const PHOTO_PAGE = 1;

type Candidate = { width: number; height: number };

function isPortraitish({ width, height }: Candidate): boolean {
  if (width < MIN_SIDE || height < MIN_SIDE) return false;
  const aspect = width / height;
  return aspect >= MIN_ASPECT && aspect <= MAX_ASPECT;
}

/** Largest plausible headshot wins — a photo outweighs any logo that slips through. */
function best<T extends Candidate>(candidates: T[]): T | null {
  const viable = candidates.filter(isPortraitish);
  if (viable.length === 0) return null;
  return viable.reduce((a, b) => (b.width * b.height > a.width * a.height ? b : a));
}

/** Box-average downscale over raw channel data — no image library needed. */
function downscale(
  source: Uint8ClampedArray,
  width: number,
  height: number,
  channels: number,
): { data: Uint8ClampedArray; width: number; height: number } {
  const scale = Math.min(1, MAX_SIDE / Math.max(width, height));
  if (scale === 1) return { data: source, width, height };

  const w = Math.max(1, Math.round(width * scale));
  const h = Math.max(1, Math.round(height * scale));
  const out = new Uint8ClampedArray(w * h * channels);
  const xRatio = width / w;
  const yRatio = height / h;

  for (let y = 0; y < h; y++) {
    const y0 = Math.floor(y * yRatio);
    const y1 = Math.min(height, Math.max(y0 + 1, Math.floor((y + 1) * yRatio)));
    for (let x = 0; x < w; x++) {
      const x0 = Math.floor(x * xRatio);
      const x1 = Math.min(width, Math.max(x0 + 1, Math.floor((x + 1) * xRatio)));
      for (let c = 0; c < channels; c++) {
        let sum = 0;
        let n = 0;
        for (let sy = y0; sy < y1; sy++) {
          for (let sx = x0; sx < x1; sx++) {
            sum += source[(sy * width + sx) * channels + c];
            n++;
          }
        }
        out[(y * w + x) * channels + c] = sum / n;
      }
    }
  }
  return { data: out, width: w, height: h };
}

function pngChunk(type: string, data: Buffer): Buffer {
  const label = Buffer.from(type, "ascii");
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  label.copy(out, 4);
  data.copy(out, 8);
  out.writeUInt32BE(crc32(Buffer.concat([label, data])), 8 + data.length);
  return out;
}

/**
 * pdf.js hands back raw pixels, so something has to encode them. PNG over a
 * deflate stream is a few lines and exact, where pulling in a native image
 * library for one upload a user makes once is not.
 */
function encodePng(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  channels: number,
): Buffer {
  const colorType = channels === 1 ? 0 : channels === 3 ? 2 : 6;

  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header.writeUInt8(8, 8); // bit depth
  header.writeUInt8(colorType, 9);

  // Each scanline is prefixed with filter type 0 (none).
  const stride = width * channels;
  const raw = Buffer.alloc(height * (stride + 1));
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0;
    Buffer.from(data.buffer, data.byteOffset + y * stride, stride).copy(raw, y * (stride + 1) + 1);
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk("IHDR", header),
    pngChunk("IDAT", deflateSync(raw, { level: 6 })),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

/** Reads width/height straight out of the file header — no decode needed. */
function dimensionsOf(buffer: Buffer): Candidate | null {
  if (buffer.length > 24 && buffer.readUInt32BE(0) === 0x89504e47) {
    return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
  }

  if (buffer.length > 4 && buffer[0] === 0xff && buffer[1] === 0xd8) {
    let offset = 2;
    while (offset + 9 < buffer.length) {
      if (buffer[offset] !== 0xff) {
        offset++;
        continue;
      }
      const marker = buffer[offset + 1];
      const length = buffer.readUInt16BE(offset + 2);
      // SOF0..SOF15 carry the frame size; DHT/DAC/DNL reuse the range and don't.
      const isFrame = marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker);
      if (isFrame) {
        return { height: buffer.readUInt16BE(offset + 5), width: buffer.readUInt16BE(offset + 7) };
      }
      offset += 2 + length;
    }
  }

  return null;
}

/**
 * A print-resolution image shaped like the page itself is a full-bleed
 * background or a scan, never a headshot. Small images that happen to share
 * the page's proportions are left alone — plenty of photos are 3:4.
 */
function isPageSized(candidate: Candidate, pageAspect: number): boolean {
  const long = Math.max(candidate.width, candidate.height);
  return long >= 900 && Math.abs(candidate.width / candidate.height - pageAspect) < 0.04;
}

/** `pdf` is a pdf.js document proxy, already opened for the text pass. */
export async function findPdfPhoto(pdf: unknown): Promise<CvPhoto | null> {
  const document = pdf as Parameters<typeof extractImages>[0] & {
    getPage: (
      n: number,
    ) => Promise<{ getViewport: (o: { scale: number }) => { width: number; height: number } }>;
  };

  const images = await extractImages(document, PHOTO_PAGE).catch(() => []);
  const page = await document
    .getPage(PHOTO_PAGE)
    .then((p) => p.getViewport({ scale: 1 }))
    .catch(() => null);
  const pageAspect = page && page.height > 0 ? page.width / page.height : 0;

  const chosen = best(
    images.filter(
      (image) =>
        (image.channels === 1 || image.channels === 3 || image.channels === 4) &&
        !(pageAspect > 0 && isPageSized(image, pageAspect)),
    ),
  );
  if (!chosen) return null;

  const scaled = downscale(chosen.data, chosen.width, chosen.height, chosen.channels);
  return {
    buffer: encodePng(scaled.data, scaled.width, scaled.height, chosen.channels),
    mediaType: "image/png",
  };
}

/**
 * Word keeps its images as ordinary files inside the archive, so these come
 * back already encoded — no re-encoding, and Cloudinary does the resize.
 */
export async function findDocxPhoto(bytes: Uint8Array): Promise<CvPhoto | null> {
  const found: (Candidate & CvPhoto)[] = [];

  await mammoth
    .convertToHtml(
      { buffer: Buffer.from(bytes) },
      {
        convertImage: mammoth.images.imgElement(
          async (image: { contentType?: string; read: (encoding?: string) => Promise<Buffer> }) => {
            const mediaType = image.contentType ?? "";
            if (mediaType === "image/png" || mediaType === "image/jpeg") {
              const buffer = await image.read();
              const size = dimensionsOf(buffer);
              if (size) found.push({ ...size, buffer, mediaType });
            }
            return { src: "" };
          },
        ),
      },
    )
    .catch(() => undefined);

  const chosen = best(found);
  return chosen ? { buffer: chosen.buffer, mediaType: chosen.mediaType } : null;
}
