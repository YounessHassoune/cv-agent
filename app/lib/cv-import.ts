import { Output, streamText } from "ai";
import mammoth from "mammoth";
import { extractText, getDocumentProxy } from "unpdf";
import { type ImportedProfile, ImportedProfileSchema } from "@/agent/lib/cv-import-schema.ts";
import { requireModelEnv } from "@/agent/lib/model-env.ts";
import { type CvPhoto, findDocxPhoto, findPdfPhoto } from "@/app/lib/cv-photo";

export type { CvPhoto } from "@/app/lib/cv-photo";

export const MAX_IMPORT_BYTES = 10 * 1024 * 1024;

const PDF = "application/pdf";
const DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const DOC = "application/msword";

/** What the file picker offers, and what the route accepts. */
export const IMPORT_ACCEPT = `${PDF},${DOCX},.pdf,.docx`;

/**
 * Below this the PDF is almost certainly a scan or an image export — the page
 * has glyphs a human reads but no extractable text layer. Two pages of a real
 * CV run well past a thousand characters.
 */
const TEXT_LAYER_MIN_CHARS = 220;

/** Text handed to the model. Long enough for a 4-page CV, short enough to stay cheap. */
const MAX_TEXT_CHARS = 40_000;

/** gpt-5*, o3, o4-mini and friends. Everything else rejects `reasoningEffort`. */
const reasoning = (model: string) => /(^|\/)(gpt-5|o\d)/.test(model);

/** What the model has pulled out so far, for the editor's progress panel. */
export type Found = {
  readonly name: string;
  readonly roles: number;
  readonly skills: number;
  readonly education: number;
  readonly projects: number;
};

export class CvImportError extends Error {
  readonly status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

function kindOf(file: File): "pdf" | "docx" {
  const name = file.name.toLowerCase();
  if (file.type === PDF || name.endsWith(".pdf")) return "pdf";
  if (file.type === DOCX || name.endsWith(".docx")) return "docx";
  if (file.type === DOC || name.endsWith(".doc")) {
    throw new CvImportError(
      "Old .doc files can't be read. Open it in Word and save as PDF or .docx, then try again.",
    );
  }
  throw new CvImportError("Upload a PDF or a Word (.docx) file.");
}

/**
 * Deterministic first pass: pull whatever text layer the file already carries.
 * No model involved — most CVs are text PDFs or Word documents, and paying a
 * vision model to read those would be slower, costlier and less accurate than
 * reading the bytes.
 */
async function readDocument(
  file: File,
  bytes: Uint8Array,
): Promise<{ text: string; photo: CvPhoto | null }> {
  if (kindOf(file) === "docx") {
    const { value } = await mammoth.extractRawText({ buffer: Buffer.from(bytes) });
    return { text: value.trim(), photo: await findDocxPhoto(bytes) };
  }

  // One parse serves both passes: reopening the document to look for the photo
  // would decode every page a second time.
  const pdf = await getDocumentProxy(bytes);
  const { text } = await extractText(pdf, { mergePages: true });
  const trimmed = text.trim();

  // A scan is a single page-sized image. There is no headshot to lift out of
  // it, and the page itself must never become someone's profile photo.
  const photo = trimmed.length < TEXT_LAYER_MIN_CHARS ? null : await findPdfPhoto(pdf);
  return { text: trimmed, photo };
}

const SYSTEM = `You transcribe a CV into structured fields. You are a parser, not a writer.

Rules, in order of importance:
1. Copy what the document says, word for word. Never rewrite, summarise, translate, improve or infer.
2. Never invent. If the document does not state something, return "" or an empty array. A missing field is correct; a plausible guess is a bug — these values become the only facts a generated CV is allowed to claim.
3. Keep the document's own language. A French CV stays French.
4. Attach each achievement line to the role it sits under. Strip bullet glyphs ("•", "-", "–") and leading whitespace, keep the wording.
5. "stack" lists only technologies named in that entry's own text — not skills from elsewhere in the CV.
6. Dates become YYYY-MM ("Mars 2021" -> "2021-03", "2021" -> "2021-01"). A role still held ends with "".
7. Split skill lines into one entry per skill: "TypeScript, Go, Postgres" is three entries, not one.
8. A bare technology name standing on its own is never a bullet — it is a stack entry that the layout pushed next to the text.
9. Ignore page headers, footers, page numbers and the word "Curriculum Vitae".

PDF text arrives with columns and spacing flattened, so entries may be interleaved or out of order. Reconstruct which company, dates and bullets belong together from the content itself.`;

/**
 * The one step that needs a model. CV layouts, section headings and date
 * formats vary per document and per language, and PDF extraction flattens the
 * layout that made them readable — pattern matching gets one template right
 * and mangles the next.
 */
async function parse(
  content: Array<{ type: "text"; text: string } | { type: "file"; data: Uint8Array; mediaType: string }>,
  model: string,
  effort: "minimal" | "low",
  onFound: (found: Found) => void,
): Promise<ImportedProfile> {
  const result = streamText({
    model,
    output: Output.object({ schema: ImportedProfileSchema, name: "cv" }),
    system: SYSTEM,
    messages: [{ role: "user", content }],
    // Only reasoning models take this, and sending it to the others earns a
    // warning per call. Left to itself a reasoning model spent ~15k tokens and
    // 115s thinking about a two-page CV before writing the same fields.
    ...(reasoning(model) ? { providerOptions: { openai: { reasoningEffort: effort } } } : {}),
  });

  // Streamed rather than awaited whole: this call is the entire wait, and the
  // partial object is the only honest progress there is to report — the caller
  // turns it into "found 4 roles, 31 skills" instead of a spinner.
  for await (const partial of result.partialOutputStream) {
    onFound({
      name: partial?.fullName ?? "",
      roles: partial?.experiences?.length ?? 0,
      skills: partial?.skills?.length ?? 0,
      education: partial?.education?.length ?? 0,
      projects: partial?.projects?.length ?? 0,
    });
  }

  return await result.output;
}

/**
 * Reads an uploaded CV into profile fields.
 *
 * Text PDFs and .docx go through the cheap extraction model. A scanned PDF has
 * no text to send, so the file itself goes to the agent model, which reads
 * PDFs natively — worth the extra cost on the minority of uploads that need it
 * rather than failing the user at the door.
 */
export async function importCv(
  file: File,
  /** Called as the import moves between steps, for the editor's progress panel. */
  onStage: (stage: "reading" | "parsing") => void = () => {},
  /** Called repeatedly while the model streams, with counts found so far. */
  onFound: (found: Found) => void = () => {},
): Promise<{ profile: ImportedProfile; source: "text" | "document"; photo: CvPhoto | null }> {
  kindOf(file); // reject unsupported types before reading the body

  if (file.size === 0) throw new CvImportError("That file is empty.");
  if (file.size > MAX_IMPORT_BYTES) throw new CvImportError("That file is over 10MB.", 413);

  const bytes = new Uint8Array(await file.arrayBuffer());

  let text: string;
  let photo: CvPhoto | null;
  onStage("reading");
  try {
    ({ text, photo } = await readDocument(file, bytes));
  } catch {
    throw new CvImportError("That file couldn't be opened — it may be corrupt or password-protected.");
  }

  const scanned = text.length < TEXT_LAYER_MIN_CHARS;
  if (scanned && kindOf(file) === "docx") {
    throw new CvImportError("That Word document has no readable text in it.");
  }

  onStage("parsing");
  try {
    if (scanned) {
      const profile = await parse(
        [
          { type: "text", text: "Transcribe the CV in the attached PDF into the schema." },
          { type: "file", data: bytes, mediaType: PDF },
        ],
        requireModelEnv("AGENT_MODEL"),
        // Reading a scanned page is worth a little more thought than reading text.
        "low",
        onFound,
      );
      return { profile, source: "document", photo };
    }

    const profile = await parse(
      [{ type: "text", text: `CV text:\n\n${text.slice(0, MAX_TEXT_CHARS)}` }],
      requireModelEnv("EXTRACTION_MODEL"),
      "low",
      onFound,
    );
    return { profile, source: "text", photo };
  } catch (error) {
    if (error instanceof CvImportError) throw error;
    const detail = error instanceof Error ? error.message : "";
    throw new CvImportError(
      `Couldn't read that CV${detail ? ` (${detail})` : ""}. Try again, or fill the form in by hand.`,
      502,
    );
  }
}
