"use client";

import { PlusIcon, UserRoundIcon, XIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { titlesFor } from "@/lib/cv-sections";
import {
  CV_ALPHA,
  CV_SEPARATOR,
  type CvLayout,
  SHEET_REM,
  ink,
  resolveTemplate,
  shade,
} from "@/lib/cv-templates";
import { cn } from "@/lib/utils";

/**
 * Shape shared by the compiled CV (`Application.cvJson`) and the live builder
 * draft, so one renderer serves both the review page and the profile editor.
 */
export type CvPreviewData = {
  fullName: string;
  headline?: string;
  email?: string;
  phone?: string;
  location?: string;
  links?: string[];
  /**
   * Cloudinary delivery URL (older profiles may still hold a data URL). Shown
   * in the preview only — the compiled PDF stays photo-free.
   */
  photoUrl?: string;
  /** ISO code; picks the section headings. Defaults to English. */
  language?: string;
  summary?: string;
  skills?: { category: string; items: string[] }[];
  experiences?: {
    company: string;
    role: string;
    location?: string;
    start?: string;
    end?: string;
    bullets: string[];
    stack?: string[];
  }[];
  projects?: { title: string; link?: string; bullets: string[]; stack?: string[] }[];
  education?: { institution: string; degree: string; dates?: string }[];
  languages?: { name: string; level: string }[];
};

const rem = (value: number) => `${value}rem`;

/**
 * Keeps the sheet at page width whatever the pane it sits in.
 *
 * The document is laid out at exactly `SHEET_REM` — the same width the PDF
 * renderer maps to A4 — and then scaled to fit. Letting the paper itself get
 * narrower would keep the type at full size against a shorter measure, so the
 * contact strip and the entry headers would wrap in the preview at widths where
 * the printed page has room to spare, and the preview would stop being a
 * picture of the PDF.
 */
function useSheetScale() {
  const frame = useRef<HTMLDivElement>(null);
  const sheet = useRef<HTMLElement>(null);
  const [scale, setScale] = useState(1);
  const [box, setBox] = useState<{ width?: number; height?: number }>({});

  useEffect(() => {
    const frameElement = frame.current;
    const sheetElement = sheet.current;
    if (!frameElement || !sheetElement) return;

    const measure = () => {
      const page = sheetElement.offsetWidth;
      if (page === 0) return;
      // Only ever scaled down: a full-width sheet is already the real thing.
      const next = Math.min(1, frameElement.clientWidth / page);
      setScale(next);
      setBox({ width: page * next, height: sheetElement.offsetHeight * next });
    };

    // The sheet's own height changes as the CV is edited, so both are watched.
    const observer = new ResizeObserver(measure);
    observer.observe(frameElement);
    observer.observe(sheetElement);
    measure();
    return () => observer.disconnect();
  }, []);

  return { frame, sheet, scale, ...box };
}

function dateRange(start?: string, end?: string) {
  if (!start && !end) return null;
  return `${start ?? ""} - ${end || "Present"}`;
}

const replaceAt = <T,>(list: readonly T[], index: number, value: T): T[] =>
  list.map((item, i) => (i === index ? value : item));

const removeAt = <T,>(list: readonly T[], index: number): T[] =>
  list.filter((_, i) => i !== index);

/** `space-y-*` semantics: the gap goes on every item but the last. */
const gapAfter = (i: number, length: number, gap: number) =>
  i < length - 1 ? rem(gap) : undefined;

/*
 * The pieces below are module-level components on purpose. Declared inside
 * `CvPreview` they would be a new component type on every render, so React
 * would tear the whole document down and rebuild it — which throws away the
 * caret the moment editing is on.
 */

/**
 * One editable run of text, rendered as the document's own type rather than as
 * a form field: the CV *is* the editor.
 *
 * React never owns the text after the first render. The initial value is
 * rendered once and afterwards the DOM is written to directly, and only while
 * the field is not focused — otherwise every keystroke would re-render the node
 * React had just typed into and drop the caret to position zero.
 */
function InlineText({
  value,
  onChange,
  onEnter,
  placeholder,
  multiline,
  className,
  style,
}: {
  readonly value: string;
  readonly onChange: (value: string) => void;
  /** Enter with the field focused; used to append the next bullet or entry. */
  readonly onEnter?: () => void;
  readonly placeholder?: string;
  readonly multiline?: boolean;
  readonly className?: string;
  readonly style?: React.CSSProperties;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  // Rendered once, then left alone — see the note above.
  const initial = useRef(value).current;

  const read = (element: HTMLSpanElement) =>
    multiline ? element.innerText : (element.textContent ?? "");

  useEffect(() => {
    const element = ref.current;
    if (!element || document.activeElement === element) return;
    if (read(element) !== value) {
      if (multiline) element.innerText = value;
      else element.textContent = value;
    }
  });

  return (
    <span
      className={cn(
        // The affordance has to survive on paper: a tint on hover, a ring on
        // focus, and a greyed placeholder where a field is empty.
        "mx-[-0.15em] cursor-text rounded-[3px] px-[0.15em] outline-none transition-colors",
        "hover:bg-black/4.5 focus:bg-black/5 focus:ring-1 focus:ring-black/25",
        "empty:before:text-black/30 empty:before:content-[attr(data-placeholder)]",
        multiline && "whitespace-pre-wrap",
        className,
      )}
      contentEditable
      data-placeholder={placeholder ?? ""}
      onBlur={(event) => onChange(read(event.currentTarget).trim())}
      onInput={(event) => onChange(read(event.currentTarget))}
      onKeyDown={(event) => {
        if (event.key !== "Enter" || (multiline && !onEnter)) return;
        event.preventDefault();
        if (onEnter) onEnter();
        else event.currentTarget.blur();
      }}
      onPaste={(event) => {
        // Paste as text, never as whatever markup the clipboard carries.
        event.preventDefault();
        const text = event.clipboardData.getData("text/plain");
        event.currentTarget.ownerDocument.execCommand("insertText", false, text);
      }}
      ref={ref}
      role="textbox"
      style={style}
      suppressContentEditableWarning
      tabIndex={0}
    >
      {initial}
    </span>
  );
}

/** Editing chrome. Deliberately not paper-coloured — it is not part of the CV. */
function AddButton({
  label,
  onClick,
  className,
}: {
  readonly label: string;
  readonly onClick: () => void;
  readonly className?: string;
}) {
  return (
    <button
      className={cn(
        "inline-flex items-center gap-1 rounded-full border border-black/15 border-dashed px-2 py-0.5 text-[0.7rem] text-black/45 leading-tight transition-colors hover:border-black/30 hover:bg-black/4 hover:text-black/70",
        className,
      )}
      onClick={onClick}
      type="button"
    >
      <PlusIcon className="size-3" />
      {label}
    </button>
  );
}

function RemoveButton({
  label,
  onClick,
  className,
}: {
  readonly label: string;
  readonly onClick: () => void;
  readonly className?: string;
}) {
  return (
    <button
      aria-label={label}
      className={cn(
        "inline-flex size-4 shrink-0 items-center justify-center rounded-full text-black/30 opacity-0 transition-opacity hover:bg-black/10 hover:text-black/70 focus-visible:opacity-100 group-hover:opacity-100",
        className,
      )}
      onClick={onClick}
      title={label}
      type="button"
    >
      <XIcon className="size-3" />
    </button>
  );
}

function Section({
  l,
  title,
  children,
}: {
  readonly l: CvLayout;
  readonly title: string;
  readonly children: React.ReactNode;
}) {
  // Templates that skip the rule lean on a lighter title instead, and the serif
  // template draws its rule heavier. `stylesFor` in the PDF does the same.
  const ruleAlpha = l.serif ? CV_ALPHA.ruleStrong : CV_ALPHA.rule;

  return (
    <section style={{ marginBottom: rem(l.sectionGap) }}>
      <h3
        className="font-semibold uppercase"
        style={{
          fontSize: rem(l.sectionTitle),
          letterSpacing: `${l.sectionTracking}em`,
          lineHeight: 1.2,
          textAlign: l.centered ? "center" : "left",
          color: l.sectionRule ? undefined : ink(CV_ALPHA.muted),
          borderBottom: l.sectionRule ? `0.75px solid ${shade(ruleAlpha)}` : undefined,
          paddingBottom: l.sectionRule ? rem(0.25) : undefined,
          marginBottom: rem(0.5),
        }}
      >
        {title}
      </h3>
      {children}
    </section>
  );
}

function Bullets({
  l,
  items,
  onChange,
}: {
  readonly l: CvLayout;
  readonly items: string[];
  /** Absent in read-only mode. */
  readonly onChange?: (items: string[]) => void;
}) {
  if (items.length === 0 && !onChange) return null;

  return (
    <ul>
      {items.map((item, i) => (
        <li className="group flex" key={i} style={{ marginTop: rem(0.1) }}>
          <span
            aria-hidden="true"
            className="shrink-0 rounded-full"
            style={{
              width: rem(0.19),
              height: rem(0.19),
              marginTop: rem(l.base * 0.55),
              marginRight: rem(0.375),
              background: ink(CV_ALPHA.soft),
            }}
          />
          {onChange ? (
            <>
              <InlineText
                className="min-w-0 flex-1"
                onChange={(value) => onChange(replaceAt(items, i, value))}
                onEnter={() => onChange([...items.slice(0, i + 1), "", ...items.slice(i + 1)])}
                placeholder="Achievement, with a number where you have one"
                value={item}
              />
              <RemoveButton
                className="mt-[0.15rem] ml-1"
                label="Remove bullet"
                onClick={() => onChange(removeAt(items, i))}
              />
            </>
          ) : (
            <span>{item}</span>
          )}
        </li>
      ))}
      {onChange ? (
        <li style={{ marginTop: rem(0.25) }}>
          <AddButton label="Bullet" onClick={() => onChange([...items, ""])} />
        </li>
      ) : null}
    </ul>
  );
}

function Chip({ l, children }: { readonly l: CvLayout; readonly children: React.ReactNode }) {
  return (
    <span
      className="shrink-0 whitespace-nowrap rounded-full"
      style={{
        background: shade(CV_ALPHA.chip),
        color: ink(CV_ALPHA.muted),
        fontSize: rem(l.meta),
        lineHeight: 1.2,
        padding: `${rem(0.125)} ${rem(0.375)}`,
      }}
    >
      {children}
    </span>
  );
}

const splitStack = (value: string) =>
  value
    .split(/[·,]/)
    .map((item) => item.trim())
    .filter(Boolean);

function Stack({
  l,
  items,
  onChange,
}: {
  readonly l: CvLayout;
  readonly items?: string[];
  readonly onChange?: (items: string[]) => void;
}) {
  const list = items ?? [];
  if (list.length === 0 && !onChange) return null;

  const style = { fontSize: rem(l.meta), color: ink(CV_ALPHA.soft), marginTop: rem(0.2) };

  // One editable line rather than a chip each: the stack is written as a list
  // and reads as one, and splitting on the separator keeps it stored as one.
  return onChange ? (
    <p style={style}>
      <InlineText
        onChange={(value) => onChange(splitStack(value))}
        placeholder="Tech used, comma separated"
        value={list.join(CV_SEPARATOR)}
      />
    </p>
  ) : (
    <p style={style}>{list.join(CV_SEPARATOR)}</p>
  );
}

function EntryHeader({ children }: { readonly children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between" style={{ columnGap: rem(0.75) }}>
      {children}
    </div>
  );
}

/**
 * A paper-white rendering of the CV, and the screen half of a pair: every size
 * here comes from the shared template layout that `agent/lib/pdf.ts` renders
 * from, so the preview and the downloaded PDF are the same document. It stays
 * light in dark mode on purpose — the PDF is printed on white.
 *
 * With `onChange` it is also the editor. Every run of text on the page is typed
 * into where it sits, so there is no form to map back from and no second
 * rendering of the CV that could disagree with this one.
 */
export function CvPreview({
  cv,
  template,
  className,
  showPhoto,
  onChange,
}: {
  readonly cv: CvPreviewData;
  readonly template?: string;
  readonly className?: string;
  /**
   * Reserve the photo slot even before one is uploaded, so the header keeps
   * its shape while the builder is still empty. Defaults to showing the slot
   * only once there is a photo to put in it.
   */
  readonly showPhoto?: boolean;
  /**
   * Turns the document into an editable one. Fires on every keystroke with the
   * whole CV, so the owner keeps the draft and decides when it is saved.
   */
  readonly onChange?: (cv: CvPreviewData) => void;
}) {
  const { frame, sheet, scale, width, height } = useSheetScale();
  const l = resolveTemplate(template).layout;
  const t = titlesFor(cv.language);
  const photo = showPhoto ?? Boolean(cv.photoUrl);
  const contact = [cv.email, cv.phone, cv.location, ...(cv.links ?? [])].filter(Boolean);
  const skills = cv.skills ?? [];
  const experiences = cv.experiences ?? [];
  const projects = cv.projects ?? [];
  const education = cv.education ?? [];
  const languages = cv.languages ?? [];
  const editing = Boolean(onChange);
  const set = (patch: Partial<CvPreviewData>) => onChange?.({ ...cv, ...patch });
  const links = cv.links ?? [];
  const hasBody =
    Boolean(cv.summary) ||
    skills.length + experiences.length + projects.length + education.length > 0;

  return (
    /* Three elements for one sheet: the frame measures the space available, the
       box reserves the scaled height so the pane scrolls correctly, and the
       article is the page itself, always laid out at full width. */
    <div className={cn("w-full", className)} ref={frame}>
      <div className="mx-auto" style={{ height, width }}>
        <article
          className={cn(
            "overflow-hidden rounded-lg bg-paper text-paper-foreground shadow-paper",
            l.serif ? "font-serif" : "font-sans",
          )}
          ref={sheet}
          style={{
            width: rem(SHEET_REM),
            fontSize: rem(l.base),
            lineHeight: l.lineHeight,
            transform: scale === 1 ? undefined : `scale(${scale})`,
            transformOrigin: "top left",
          }}
        >
      {/* Contact strip above the identity block, as in the compiled PDF. */}
      {contact.length > 0 || editing ? (
        <div
          className="flex flex-wrap"
          style={{
            background: shade(CV_ALPHA.strip),
            color: ink(CV_ALPHA.muted),
            fontSize: rem(l.meta),
            lineHeight: 1.2,
            padding: `${rem(0.3)} ${rem(l.padX)}`,
            columnGap: rem(1),
            rowGap: rem(0.15),
            justifyContent: l.centered ? "center" : "flex-start",
          }}
        >
          {/* Each item stays on one line so a narrow column wraps between
              entries instead of breaking an email or URL across rows. */}
          {editing ? (
            <>
              <InlineText
                className="whitespace-nowrap"
                onChange={(email) => set({ email })}
                placeholder="you@example.com"
                value={cv.email ?? ""}
              />
              <InlineText
                className="whitespace-nowrap"
                onChange={(phone) => set({ phone })}
                placeholder="Phone"
                value={cv.phone ?? ""}
              />
              <InlineText
                className="whitespace-nowrap"
                onChange={(location) => set({ location })}
                placeholder="City, country"
                value={cv.location ?? ""}
              />
              {links.map((link, i) => (
                <span className="group flex items-center gap-0.5 whitespace-nowrap" key={i}>
                  <InlineText
                    onChange={(value) => set({ links: replaceAt(links, i, value) })}
                    placeholder="https://"
                    value={link}
                  />
                  <RemoveButton
                    label="Remove link"
                    onClick={() => set({ links: removeAt(links, i) })}
                  />
                </span>
              ))}
              <AddButton label="Link" onClick={() => set({ links: [...links, ""] })} />
            </>
          ) : (
            contact.map((item, i) => (
              <span className="whitespace-nowrap" key={`${item}-${i}`}>
                {item}
              </span>
            ))
          )}
        </div>
      ) : null}

      <div style={{ padding: `${rem(l.padY)} ${rem(l.padX)}` }}>
        <header
          className={cn(photo && (l.centered ? "flex flex-col items-center" : "flex items-center"))}
          style={{ marginBottom: rem(l.sectionGap), gap: photo ? rem(l.photoGap) : undefined }}
        >
          {photo && cv.photoUrl ? (
            // biome-ignore lint/performance/noImgElement: Cloudinary already
            // delivers this pre-sized and format-negotiated; next/image would
            // only add a second optimizer in front of it.
            <img
              alt=""
              className="shrink-0 rounded-full object-cover ring-1 ring-black/10"
              src={cv.photoUrl}
              style={{ width: rem(l.photoSize), height: rem(l.photoSize) }}
            />
          ) : null}
          {photo && !cv.photoUrl ? (
            <span
              aria-hidden="true"
              className="flex shrink-0 items-center justify-center rounded-full border border-black/15 border-dashed bg-black/3 text-black/25"
              style={{ width: rem(l.photoSize), height: rem(l.photoSize) }}
            >
              <UserRoundIcon className="size-7" />
            </span>
          ) : null}
          <div className="min-w-0" style={{ textAlign: l.centered ? "center" : "left" }}>
            <h2
              className="font-semibold"
              style={{ fontSize: rem(l.name), letterSpacing: "-0.02em", lineHeight: 1.15 }}
            >
              {editing ? (
                <InlineText
                  onChange={(fullName) => set({ fullName })}
                  placeholder="Your name"
                  value={cv.fullName}
                />
              ) : (
                cv.fullName || "Your name"
              )}
            </h2>
            {cv.headline || editing ? (
              <p
                style={{
                  fontSize: rem(l.headline),
                  color: ink(CV_ALPHA.muted),
                  marginTop: rem(l.headlineGap),
                  lineHeight: 1.2,
                }}
              >
                {editing ? (
                  <InlineText
                    onChange={(headline) => set({ headline })}
                    placeholder="Target job title"
                    value={cv.headline ?? ""}
                  />
                ) : (
                  cv.headline
                )}
              </p>
            ) : null}
          </div>
        </header>

        {!hasBody && !editing ? (
          <p className="py-10 text-center opacity-50" style={{ fontSize: rem(l.base) }}>
            Fill in your profile to see the CV take shape here.
          </p>
        ) : null}

        {cv.summary || editing ? (
          <Section l={l} title={t.summary}>
            <p>
              {editing ? (
                <InlineText
                  multiline
                  onChange={(summary) => set({ summary })}
                  placeholder="2-3 sentences on what you do and what you have shipped."
                  value={cv.summary ?? ""}
                />
              ) : (
                cv.summary
              )}
            </p>
          </Section>
        ) : null}

        {skills.length > 0 || editing ? (
          <Section l={l} title={t.skills}>
            {skills.map((group, i) => {
              const setGroup = (next: (typeof skills)[number]) =>
                set({ skills: replaceAt(skills, i, next) });

              return (
                <div
                  className="group"
                  key={i}
                  style={{ marginBottom: gapAfter(i, skills.length, 0.5) }}
                >
                  <p
                    className="flex items-center gap-1 font-semibold"
                    style={{
                      fontSize: rem(l.label),
                      color: ink(CV_ALPHA.soft),
                      marginBottom: rem(0.2),
                    }}
                  >
                    {editing ? (
                      <>
                        <InlineText
                          onChange={(category) => setGroup({ ...group, category })}
                          placeholder="Category"
                          value={group.category}
                        />
                        <RemoveButton
                          label="Remove skill group"
                          onClick={() => set({ skills: removeAt(skills, i) })}
                        />
                      </>
                    ) : (
                      group.category
                    )}
                  </p>
                  <div className="flex flex-wrap" style={{ columnGap: rem(0.25), rowGap: rem(0.2) }}>
                    {group.items.map((item, index) => (
                      <span
                        className={cn("rounded-full", editing && "group/pill inline-flex items-center gap-0.5")}
                        key={index}
                        style={{
                          background: shade(CV_ALPHA.pill),
                          fontSize: rem(l.label),
                          lineHeight: 1.2,
                          padding: `${rem(0.125)} ${rem(0.375)}`,
                        }}
                      >
                        {editing ? (
                          <>
                            <InlineText
                              onChange={(value) =>
                                setGroup({ ...group, items: replaceAt(group.items, index, value) })
                              }
                              placeholder="Skill"
                              value={item}
                            />
                            <RemoveButton
                              className="group-hover/pill:opacity-100"
                              label="Remove skill"
                              onClick={() =>
                                setGroup({ ...group, items: removeAt(group.items, index) })
                              }
                            />
                          </>
                        ) : (
                          item
                        )}
                      </span>
                    ))}
                    {editing ? (
                      <AddButton
                        label="Skill"
                        onClick={() => setGroup({ ...group, items: [...group.items, ""] })}
                      />
                    ) : null}
                  </div>
                </div>
              );
            })}
            {editing ? (
              <AddButton
                className="mt-2"
                label="Skill group"
                onClick={() => set({ skills: [...skills, { category: "", items: [""] }] })}
              />
            ) : null}
          </Section>
        ) : null}

        {experiences.length > 0 || editing ? (
          <Section l={l} title={t.experience}>
            {experiences.map((experience, i) => {
              const setExperience = (next: (typeof experiences)[number]) =>
                set({ experiences: replaceAt(experiences, i, next) });
              const meta = [dateRange(experience.start, experience.end), experience.location];

              return (
                <div
                  className="group"
                  key={i}
                  style={{ marginBottom: gapAfter(i, experiences.length, l.entryGap) }}
                >
                  <EntryHeader>
                    <p className="min-w-0">
                      {editing ? (
                        <>
                          <InlineText
                            className="font-semibold"
                            onChange={(role) => setExperience({ ...experience, role })}
                            placeholder="Role"
                            value={experience.role}
                          />
                          <span style={{ color: ink(CV_ALPHA.muted) }}>{CV_SEPARATOR}</span>
                          <InlineText
                            onChange={(company) => setExperience({ ...experience, company })}
                            placeholder="Company"
                            style={{ color: ink(CV_ALPHA.muted) }}
                            value={experience.company}
                          />
                        </>
                      ) : (
                        <>
                          <span className="font-semibold">{experience.role}</span>
                          <span
                            style={{ color: ink(CV_ALPHA.muted) }}
                          >{`${CV_SEPARATOR}${experience.company}`}</span>
                        </>
                      )}
                    </p>

                    {editing ? (
                      <span className="flex shrink-0 items-center gap-1">
                        <Chip l={l}>
                          <InlineText
                            onChange={(start) => setExperience({ ...experience, start })}
                            placeholder="Start"
                            value={experience.start ?? ""}
                          />
                          {" - "}
                          <InlineText
                            onChange={(end) => setExperience({ ...experience, end })}
                            placeholder="Present"
                            value={experience.end ?? ""}
                          />
                          {CV_SEPARATOR}
                          <InlineText
                            onChange={(location) => setExperience({ ...experience, location })}
                            placeholder="Location"
                            value={experience.location ?? ""}
                          />
                        </Chip>
                        <RemoveButton
                          label="Remove experience"
                          onClick={() => set({ experiences: removeAt(experiences, i) })}
                        />
                      </span>
                    ) : meta.some(Boolean) ? (
                      <Chip l={l}>{meta.filter(Boolean).join(CV_SEPARATOR)}</Chip>
                    ) : null}
                  </EntryHeader>

                  <Bullets
                    items={experience.bullets}
                    l={l}
                    onChange={
                      editing
                        ? (bullets) => setExperience({ ...experience, bullets })
                        : undefined
                    }
                  />
                  <Stack
                    items={experience.stack}
                    l={l}
                    onChange={
                      editing ? (stack) => setExperience({ ...experience, stack }) : undefined
                    }
                  />
                </div>
              );
            })}
            {editing ? (
              <AddButton
                className="mt-2"
                label="Experience"
                onClick={() =>
                  set({
                    experiences: [
                      ...experiences,
                      {
                        company: "",
                        role: "",
                        location: "",
                        start: "",
                        end: "",
                        bullets: [""],
                        stack: [],
                      },
                    ],
                  })
                }
              />
            ) : null}
          </Section>
        ) : null}

        {projects.length > 0 || editing ? (
          <Section l={l} title={t.projects}>
            {projects.map((project, i) => {
              const setProject = (next: (typeof projects)[number]) =>
                set({ projects: replaceAt(projects, i, next) });

              return (
                <div
                  className="group"
                  key={i}
                  style={{ marginBottom: gapAfter(i, projects.length, l.entryGap) }}
                >
                  <EntryHeader>
                    <p className="min-w-0 font-semibold">
                      {editing ? (
                        <InlineText
                          onChange={(title) => setProject({ ...project, title })}
                          placeholder="Project"
                          value={project.title}
                        />
                      ) : (
                        project.title
                      )}
                    </p>
                    {editing ? (
                      <span
                        className="flex shrink-0 items-center gap-1 whitespace-nowrap"
                        style={{ fontSize: rem(l.meta), color: ink(CV_ALPHA.soft) }}
                      >
                        <InlineText
                          onChange={(link) => setProject({ ...project, link })}
                          placeholder="Link"
                          value={project.link ?? ""}
                        />
                        <RemoveButton
                          label="Remove project"
                          onClick={() => set({ projects: removeAt(projects, i) })}
                        />
                      </span>
                    ) : project.link ? (
                      <span
                        className="shrink-0 whitespace-nowrap"
                        style={{ fontSize: rem(l.meta), color: ink(CV_ALPHA.soft) }}
                      >
                        {project.link}
                      </span>
                    ) : null}
                  </EntryHeader>
                  <Bullets
                    items={project.bullets}
                    l={l}
                    onChange={editing ? (bullets) => setProject({ ...project, bullets }) : undefined}
                  />
                  <Stack
                    items={project.stack}
                    l={l}
                    onChange={editing ? (stack) => setProject({ ...project, stack }) : undefined}
                  />
                </div>
              );
            })}
            {editing ? (
              <AddButton
                className="mt-2"
                label="Project"
                onClick={() =>
                  set({ projects: [...projects, { title: "", link: "", bullets: [""], stack: [] }] })
                }
              />
            ) : null}
          </Section>
        ) : null}

        {education.length > 0 || editing ? (
          <Section l={l} title={t.education}>
            {education.map((entry, i) => {
              const setEntry = (next: (typeof education)[number]) =>
                set({ education: replaceAt(education, i, next) });

              return (
                <div
                  className="group"
                  key={i}
                  style={{ marginBottom: gapAfter(i, education.length, 0.375) }}
                >
                  <EntryHeader>
                    <p className="min-w-0">
                      {editing ? (
                        <>
                          <InlineText
                            className="font-semibold"
                            onChange={(degree) => setEntry({ ...entry, degree })}
                            placeholder="Degree"
                            value={entry.degree}
                          />
                          <span style={{ color: ink(CV_ALPHA.muted) }}>{CV_SEPARATOR}</span>
                          <InlineText
                            onChange={(institution) => setEntry({ ...entry, institution })}
                            placeholder="Institution"
                            style={{ color: ink(CV_ALPHA.muted) }}
                            value={entry.institution}
                          />
                        </>
                      ) : (
                        <>
                          <span className="font-semibold">{entry.degree}</span>
                          <span
                            style={{ color: ink(CV_ALPHA.muted) }}
                          >{`${CV_SEPARATOR}${entry.institution}`}</span>
                        </>
                      )}
                    </p>
                    {editing ? (
                      <span className="flex shrink-0 items-center gap-1">
                        <Chip l={l}>
                          <InlineText
                            onChange={(dates) => setEntry({ ...entry, dates })}
                            placeholder="Dates"
                            value={entry.dates ?? ""}
                          />
                        </Chip>
                        <RemoveButton
                          label="Remove education entry"
                          onClick={() => set({ education: removeAt(education, i) })}
                        />
                      </span>
                    ) : entry.dates ? (
                      <Chip l={l}>{entry.dates}</Chip>
                    ) : null}
                  </EntryHeader>
                </div>
              );
            })}
            {editing ? (
              <AddButton
                className="mt-2"
                label="Education"
                onClick={() =>
                  set({ education: [...education, { institution: "", degree: "", dates: "" }] })
                }
              />
            ) : null}
          </Section>
        ) : null}

        {languages.length > 0 || editing ? (
          <Section l={l} title={t.languages}>
            {editing ? (
              <div className="flex flex-wrap items-center" style={{ columnGap: rem(0.5), rowGap: rem(0.25) }}>
                {languages.map((entry, i) => {
                  const setEntry = (next: (typeof languages)[number]) =>
                    set({ languages: replaceAt(languages, i, next) });

                  return (
                    <span className="group flex items-center" key={i}>
                      <InlineText
                        onChange={(name) => setEntry({ ...entry, name })}
                        placeholder="Language"
                        value={entry.name}
                      />
                      <span>{" ("}</span>
                      <InlineText
                        onChange={(level) => setEntry({ ...entry, level })}
                        placeholder="Level"
                        value={entry.level}
                      />
                      <span>{")"}</span>
                      <RemoveButton
                        label="Remove language"
                        onClick={() => set({ languages: removeAt(languages, i) })}
                      />
                    </span>
                  );
                })}
                <AddButton
                  label="Language"
                  onClick={() => set({ languages: [...languages, { name: "", level: "" }] })}
                />
              </div>
            ) : (
              <p>{languages.map((entry) => `${entry.name} (${entry.level})`).join(CV_SEPARATOR)}</p>
            )}
          </Section>
        ) : null}
        </div>
      </article>
      </div>
    </div>
  );
}
