"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  BriefcaseIcon,
  CheckIcon,
  FileTextIcon,
  FolderGitIcon,
  GraduationCapIcon,
  LanguagesIcon,
  LayoutTemplateIcon,
  LinkIcon,
  type LucideIcon,
  PanelRightOpenIcon,
  PlusIcon,
  SaveIcon,
  ScrollTextIcon,
  TextIcon,
  TrashIcon,
  UserRoundIcon,
  WrenchIcon,
} from "lucide-react";

import { type CvPreviewData, CvPreview } from "@/components/cv-preview";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { CV_TEMPLATE_LIST, DEFAULT_TEMPLATE } from "@/lib/cv-templates";
import { cn } from "@/lib/utils";
import { CvImportDialog } from "./cv-import-dialog";
import { ProfilePdfView } from "./profile-pdf-view";
import { MonthField } from "./month-field";
import { PhotoField } from "./photo-field";
import { SkillsField } from "./skills-field";
import { TagsField } from "./tags-field";

export type ProfileForm = {
  fullName: string;
  headline: string;
  summary: string;
  photoUrl: string;
  template: string;
  contact: { email: string; phone: string; location: string; links: string[] };
  languages: { name: string; level: string }[];
  education: { institution: string; degree: string; start: string; end: string }[];
  skills: { name: string; category: string }[];
  experiences: {
    company: string;
    role: string;
    location: string;
    start: string;
    end: string;
    bullets: string;
    stack: string;
  }[];
  projects: { title: string; description: string; link: string; bullets: string; stack: string }[];
};

type SectionId =
  | "identity"
  | "summary"
  | "experience"
  | "education"
  | "skills"
  | "projects"
  | "links"
  | "languages";

const lines = (value: string) => value.split("\n").map((v) => v.trim()).filter(Boolean);
const commas = (value: string) => value.split(",").map((v) => v.trim()).filter(Boolean);

/** "2021-03-01" → "Mar 2021", which is how the CV renders dates. */
function displayDate(value: string): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en", { month: "short", year: "numeric" });
}

function toPreview(form: ProfileForm): CvPreviewData {
  const grouped = new Map<string, string[]>();
  for (const skill of form.skills.filter((s) => s.name.trim())) {
    const category = skill.category.trim() || "Skills";
    grouped.set(category, [...(grouped.get(category) ?? []), skill.name.trim()]);
  }

  return {
    fullName: form.fullName,
    headline: form.headline,
    email: form.contact.email,
    phone: form.contact.phone,
    location: form.contact.location,
    links: form.contact.links.filter(Boolean),
    photoUrl: form.photoUrl || undefined,
    summary: form.summary,
    skills: [...grouped].map(([category, items]) => ({ category, items })),
    experiences: form.experiences
      .filter((e) => e.company.trim() || e.role.trim())
      .map((e) => ({
        company: e.company,
        role: e.role,
        location: e.location,
        start: displayDate(e.start),
        end: displayDate(e.end),
        bullets: lines(e.bullets),
        stack: commas(e.stack),
      })),
    projects: form.projects
      .filter((p) => p.title.trim())
      .map((p) => ({
        title: p.title,
        link: p.link,
        bullets: [p.description, ...lines(p.bullets)].filter(Boolean),
        stack: commas(p.stack),
      })),
    education: form.education
      .filter((e) => e.institution.trim() || e.degree.trim())
      .map((e) => ({
        institution: e.institution,
        degree: e.degree,
        dates: [displayDate(e.start), displayDate(e.end)].filter(Boolean).join(" - "),
      })),
    languages: form.languages
      .filter((l) => l.name.trim())
      .map((l) => ({ name: l.name, level: l.level || "-" })),
  };
}

const sections: { id: SectionId; label: string; icon: LucideIcon; hint: string }[] = [
  {
    id: "identity",
    label: "Personal informations",
    icon: UserRoundIcon,
    hint: "Your photo, name and how recruiters reach you.",
  },
  {
    id: "summary",
    label: "Professional summary",
    icon: TextIcon,
    hint: "2-3 sentences. The agent rewrites this per job, but keeps to the facts here.",
  },
  {
    id: "experience",
    label: "Experience",
    icon: BriefcaseIcon,
    hint: "One achievement per line. Real numbers beat adjectives.",
  },
  { id: "education", label: "Education", icon: GraduationCapIcon, hint: "Degrees and programmes." },
  {
    id: "skills",
    label: "Skills",
    icon: WrenchIcon,
    hint: "Only list what you have actually used. These gate what a CV may claim.",
  },
  {
    id: "projects",
    label: "Projects",
    icon: FolderGitIcon,
    hint: "Side work and open source worth putting in front of a hiring manager.",
  },
  {
    id: "links",
    label: "Profile or portfolio URL",
    icon: LinkIcon,
    hint: "GitHub, LinkedIn, a portfolio: whatever you want on the CV header.",
  },
  { id: "languages", label: "Languages", icon: LanguagesIcon, hint: "Spoken languages and level." },
];

/** The levels people actually write on CVs, coarsest first. */
const LANGUAGE_LEVELS = ["Native", "Fluent", "C2", "C1", "B2", "B1", "A2", "A1"];

const NO_LEVEL = "none";

/**
 * A select rather than the free-text box this was: a bare input gave no hint
 * that there was anything to choose from, and the datalist behind it is barely
 * a control on Safari. A level the CV wrote its own way ("Mother tongue",
 * "TOEIC 900") is kept by joining the list rather than being thrown away.
 */
function LevelSelect({
  value,
  onChange,
}: {
  readonly value: string;
  readonly onChange: (next: string) => void;
}) {
  const levels =
    value && !LANGUAGE_LEVELS.includes(value) ? [value, ...LANGUAGE_LEVELS] : LANGUAGE_LEVELS;

  return (
    <Select onValueChange={(next) => onChange(next === NO_LEVEL ? "" : (next as string))} value={value || NO_LEVEL}>
      <SelectTrigger aria-label="Level" className="h-7 w-28 shrink-0 border-0 bg-secondary/70 px-2 text-xs shadow-none" size="sm">
        <SelectValue>
          <span className={cn("truncate", !value && "text-muted-foreground")}>{value || "Level"}</span>
        </SelectValue>
      </SelectTrigger>
      <SelectContent align="end">
        <SelectItem value={NO_LEVEL}>No level</SelectItem>
        {levels.map((level) => (
          <SelectItem key={level} value={level}>
            {level}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function FieldRow({
  label,
  children,
  className,
}: {
  readonly label: string;
  readonly children: React.ReactNode;
  readonly className?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label className="text-muted-foreground text-xs">{label}</Label>
      {children}
    </div>
  );
}

function EntryCard({
  title,
  children,
  onRemove,
}: {
  readonly title: string;
  readonly children: React.ReactNode;
  readonly onRemove: () => void;
}) {
  return (
    <div className="space-y-4 rounded-xl border bg-field/60 p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="font-medium text-sm">{title}</p>
        <Button
          aria-label={`Remove ${title}`}
          className="text-muted-foreground hover:text-destructive"
          onClick={onRemove}
          size="icon-sm"
          type="button"
          variant="ghost"
        >
          <TrashIcon className="size-3.5" />
        </Button>
      </div>
      {children}
    </div>
  );
}

/**
 * Donut gauge for profile completeness, the header's at-a-glance signal. It is
 * banded like an ATS score rather than tinted with the brand, because a thin
 * profile is the single biggest cause of a weak CV and should read as a warning
 * rather than as decoration.
 */
function completionTone(value: number): string {
  if (value >= 85) return "text-success";
  if (value >= 50) return "text-warning";
  return "text-destructive";
}

function CompletionRing({ value }: { readonly value: number }) {
  const circumference = 2 * Math.PI * 16;
  const tone = completionTone(value);

  return (
    <div className="relative flex size-11 shrink-0 items-center justify-center" title={`${value}% complete`}>
      <svg aria-hidden="true" className="-rotate-90 absolute inset-0 size-full" viewBox="0 0 36 36">
        <circle
          className="text-secondary"
          cx="18"
          cy="18"
          fill="transparent"
          r="16"
          stroke="currentColor"
          strokeWidth="3"
        />
        <circle
          className={cn(tone, "transition-[stroke-dashoffset] duration-500")}
          cx="18"
          cy="18"
          fill="transparent"
          r="16"
          stroke="currentColor"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - value / 100)}
          strokeLinecap="round"
          strokeWidth="3"
        />
      </svg>
      <span className={cn("relative font-semibold text-[0.6rem] tabular-nums", tone)}>
        {value}%
      </span>
    </div>
  );
}

export function ProfileEditor({ initial }: { readonly initial: ProfileForm }) {
  const [form, setForm] = useState<ProfileForm>(initial);
  // Every section is on the page at once, so what has to be tracked is where
  // each one sits (for the rail's jump links) and which one you are currently
  // looking at (so the rail can say so).
  const sectionRefs = useRef<Partial<Record<SectionId, HTMLElement | null>>>({});
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [activeSection, setActiveSection] = useState<SectionId>("identity");
  // Preview-only: the photo slot is always drawn so the header keeps its shape.
  const [showPhoto, setShowPhoto] = useState(true);
  // The preview pane shows either the live document or the PDF it compiles to,
  // the same pair of views the application review page offers.
  const [previewView, setPreviewView] = useState<"preview" | "pdf">("preview");
  const [status, setStatus] = useState<"idle" | "dirty" | "saving" | "saved" | "error">("idle");
  const [message, setMessage] = useState<string>();

  const patch = (values: Partial<ProfileForm>) => {
    setForm((f) => ({ ...f, ...values }));
    setStatus("dirty");
  };

  // A CV import rewrites whole sections at once, so it replaces the form
  // rather than patching fields. Still only a draft: nothing reaches the
  // database until Save.
  const applyImport = (apply: (current: ProfileForm) => ProfileForm) => {
    const next = apply(form);
    setForm(next);
    // Straight to the database: an import the user waited for (and may have
    // reloaded the page for) sitting unsaved in the form reads as lost work.
    void save(next);
  };

  const filled = useMemo<Record<SectionId, boolean>>(
    () => ({
      identity: Boolean(form.fullName.trim() && form.contact.email.trim()),
      summary: form.summary.trim().length > 0,
      experience: form.experiences.some((e) => e.company.trim() && e.role.trim()),
      education: form.education.some((e) => e.institution.trim()),
      skills: form.skills.some((s) => s.name.trim()),
      projects: form.projects.some((p) => p.title.trim()),
      links: form.contact.links.filter(Boolean).length > 0,
      languages: form.languages.some((l) => l.name.trim()),
    }),
    [form],
  );

  const completion = Math.round(
    (sections.filter((s) => filled[s.id]).length / sections.length) * 100,
  );
  const preview = useMemo(() => toPreview(form), [form]);

  /**
   * The API rejects these outright and answers with a field path, which is no
   * use to someone looking at a form. Catching them here names the row instead.
   */
  const blocker = (f: ProfileForm): string | undefined => {
    if (!f.fullName.trim()) return "Add your full name before saving.";
    if (!f.contact.email.trim()) return "Add a contact email before saving.";
    const index = f.experiences.findIndex((e) => e.company && e.role && !e.start);
    if (index >= 0) {
      const { company, role } = f.experiences[index];
      return `${role || company || `Experience ${index + 1}`} needs a start date — imported CVs often leave it out.`;
    }
    return undefined;
  };

  /**
   * Takes the form to save so an import can persist the merge it just made
   * without waiting a render for `form` to catch up.
   */
  const save = async (next: ProfileForm = form) => {
    const problem = blocker(next);
    if (problem) {
      setStatus("error");
      setMessage(problem);
      return;
    }

    setStatus("saving");
    setMessage(undefined);
    const response = await fetch("/api/profile", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        fullName: next.fullName,
        headline: next.headline || undefined,
        summary: next.summary || undefined,
        photoUrl: next.photoUrl || undefined,
        template: next.template || DEFAULT_TEMPLATE,
        contact: {
          email: next.contact.email,
          phone: next.contact.phone || undefined,
          location: next.contact.location || undefined,
          links: next.contact.links.filter(Boolean),
        },
        languages: next.languages.filter((l) => l.name),
        education: next.education.filter((e) => e.institution),
        skills: next.skills.filter((s) => s.name),
        experiences: next.experiences
          .filter((e) => e.company && e.role)
          .map((e) => ({
            company: e.company,
            role: e.role,
            location: e.location || undefined,
            start: e.start,
            end: e.end || undefined,
            bullets: lines(e.bullets),
            stack: commas(e.stack),
          })),
        projects: next.projects
          .filter((p) => p.title)
          .map((p) => ({
            title: p.title,
            description: p.description || undefined,
            link: p.link || undefined,
            bullets: lines(p.bullets),
            stack: commas(p.stack),
          })),
      }),
    });

    if (response.ok) {
      setStatus("saved");
      return;
    }
    setStatus("error");
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    setMessage(body?.error ?? `Save failed (${response.status})`);
  };

  /** Body of one section. */
  function sectionBody(id: SectionId) {
    if (id === "identity") {
      return (
        <div className="space-y-6">
          <PhotoField onChange={(photoUrl) => patch({ photoUrl })} value={form.photoUrl} />

          <div className="grid gap-4 sm:grid-cols-2">
            <FieldRow label="Full name">
              <Input
                onChange={(e) => patch({ fullName: e.target.value })}
                placeholder="Ada Lovelace"
                value={form.fullName}
              />
            </FieldRow>
            <FieldRow label="Job title">
              <Input
                onChange={(e) => patch({ headline: e.target.value })}
                placeholder="Full-Stack Engineer"
                value={form.headline}
              />
            </FieldRow>
            <FieldRow label="Email address">
              <Input
                onChange={(e) => patch({ contact: { ...form.contact, email: e.target.value } })}
                placeholder="you@example.com"
                type="email"
                value={form.contact.email}
              />
            </FieldRow>
            <FieldRow label="Mobile number">
              <Input
                onChange={(e) => patch({ contact: { ...form.contact, phone: e.target.value } })}
                placeholder="+1 555 0100"
                value={form.contact.phone}
              />
            </FieldRow>
            <FieldRow className="sm:col-span-2" label="Address">
              <Input
                onChange={(e) => patch({ contact: { ...form.contact, location: e.target.value } })}
                placeholder="Berlin, Germany"
                value={form.contact.location}
              />
            </FieldRow>
          </div>
        </div>
      );
    }

    if (id === "summary") {
      return (
        <FieldRow label="Professional summary">
          <Textarea
            onChange={(e) => patch({ summary: e.target.value })}
            placeholder="Full-stack engineer with 6 years building payment systems…"
            rows={6}
            value={form.summary}
          />
        </FieldRow>
      );
    }

    if (id === "experience") {
      return (
        <div className="space-y-4">
          {form.experiences.map((exp, i) => {
            const update = (values: Partial<(typeof form.experiences)[number]>) => {
              const experiences = [...form.experiences];
              experiences[i] = { ...exp, ...values };
              patch({ experiences });
            };
            return (
              <EntryCard
                key={i}
                onRemove={() => patch({ experiences: form.experiences.filter((_, x) => x !== i) })}
                title={exp.role || exp.company || `Role ${i + 1}`}
              >
                <div className="grid gap-4 sm:grid-cols-2">
                  <FieldRow label="Role">
                    <Input
                      onChange={(e) => update({ role: e.target.value })}
                      placeholder="Senior Engineer"
                      value={exp.role}
                    />
                  </FieldRow>
                  <FieldRow label="Company">
                    <Input
                      onChange={(e) => update({ company: e.target.value })}
                      placeholder="Acme Inc."
                      value={exp.company}
                    />
                  </FieldRow>
                  <FieldRow label="Location">
                    <Input
                      onChange={(e) => update({ location: e.target.value })}
                      placeholder="Remote"
                      value={exp.location}
                    />
                  </FieldRow>
                  <div className="grid grid-cols-2 gap-3">
                    <FieldRow label="Start">
                      <MonthField onChange={(start) => update({ start })} value={exp.start} />
                    </FieldRow>
                    <FieldRow label="End">
                      <MonthField
                        emptyLabel="Present"
                        onChange={(end) => update({ end })}
                        value={exp.end}
                      />
                    </FieldRow>
                  </div>
                </div>
                <FieldRow label="Achievements, one per line">
                  <Textarea
                    onChange={(e) => update({ bullets: e.target.value })}
                    placeholder={"Cut checkout latency by 40% by…\nLed a team of 4 to ship…"}
                    rows={4}
                    value={exp.bullets}
                  />
                </FieldRow>
                <FieldRow label="Tech actually used">
                  <TagsField
                    label="Technology"
                    onChange={(stack) => update({ stack })}
                    placeholder="TypeScript, Postgres, AWS"
                    value={exp.stack}
                  />
                </FieldRow>
              </EntryCard>
            );
          })}

          <Button
            className="w-full border-dashed"
            onClick={() =>
              patch({
                experiences: [
                  ...form.experiences,
                  { company: "", role: "", location: "", start: "", end: "", bullets: "", stack: "" },
                ],
              })
            }
            type="button"
            variant="outline"
          >
            <PlusIcon className="size-4" /> Add experience
          </Button>
        </div>
      );
    }

    if (id === "education") {
      return (
        <div className="space-y-4">
          {form.education.map((entry, i) => {
            const update = (values: Partial<(typeof form.education)[number]>) => {
              const education = [...form.education];
              education[i] = { ...entry, ...values };
              patch({ education });
            };
            return (
              <EntryCard
                key={i}
                onRemove={() => patch({ education: form.education.filter((_, x) => x !== i) })}
                title={entry.degree || entry.institution || `Entry ${i + 1}`}
              >
                <div className="grid gap-4 sm:grid-cols-2">
                  <FieldRow label="Institution">
                    <Input
                      onChange={(e) => update({ institution: e.target.value })}
                      value={entry.institution}
                    />
                  </FieldRow>
                  <FieldRow label="Degree">
                    <Input onChange={(e) => update({ degree: e.target.value })} value={entry.degree} />
                  </FieldRow>
                  <FieldRow label="Start">
                    <MonthField onChange={(start) => update({ start })} value={entry.start} />
                  </FieldRow>
                  <FieldRow label="End">
                    <MonthField
                      emptyLabel="Ongoing"
                      onChange={(end) => update({ end })}
                      value={entry.end}
                    />
                  </FieldRow>
                </div>
              </EntryCard>
            );
          })}
          <Button
            className="w-full border-dashed"
            onClick={() =>
              patch({
                education: [...form.education, { institution: "", degree: "", start: "", end: "" }],
              })
            }
            type="button"
            variant="outline"
          >
            <PlusIcon className="size-4" /> Add education
          </Button>
        </div>
      );
    }

    if (id === "skills") {
      return <SkillsField onChange={(skills) => patch({ skills })} value={form.skills} />;
    }

    if (id === "projects") {
      return (
        <div className="space-y-4">
          {form.projects.map((project, i) => {
            const update = (values: Partial<(typeof form.projects)[number]>) => {
              const projects = [...form.projects];
              projects[i] = { ...project, ...values };
              patch({ projects });
            };
            return (
              <EntryCard
                key={i}
                onRemove={() => patch({ projects: form.projects.filter((_, x) => x !== i) })}
                title={project.title || `Project ${i + 1}`}
              >
                <div className="grid gap-4 sm:grid-cols-2">
                  <FieldRow label="Title">
                    <Input
                      onChange={(e) => update({ title: e.target.value })}
                      placeholder="Realtime dashboard"
                      value={project.title}
                    />
                  </FieldRow>
                  <FieldRow label="Link">
                    <Input
                      onChange={(e) => update({ link: e.target.value })}
                      placeholder="github.com/you/project"
                      value={project.link}
                    />
                  </FieldRow>
                </div>
                <FieldRow label="One-line description">
                  <Input
                    onChange={(e) => update({ description: e.target.value })}
                    placeholder="What it does, in one sentence"
                    value={project.description}
                  />
                </FieldRow>
                <FieldRow label="Highlights, one per line">
                  <Textarea
                    onChange={(e) => update({ bullets: e.target.value })}
                    rows={3}
                    value={project.bullets}
                  />
                </FieldRow>
                <FieldRow label="Tech actually used">
                  <TagsField
                    label="Technology"
                    onChange={(stack) => update({ stack })}
                    placeholder="React, Node, Redis"
                    value={project.stack}
                  />
                </FieldRow>
              </EntryCard>
            );
          })}
          <Button
            className="w-full border-dashed"
            onClick={() =>
              patch({
                projects: [
                  ...form.projects,
                  { title: "", description: "", link: "", bullets: "", stack: "" },
                ],
              })
            }
            type="button"
            variant="outline"
          >
            <PlusIcon className="size-4" /> Add project
          </Button>
        </div>
      );
    }

    if (id === "links") {
      return (
        <div className="space-y-2">
          {form.contact.links.map((link, i) => (
            <div
              className="flex items-center gap-2 rounded-xl border bg-field/50 py-1.5 pr-1.5 pl-3 focus-within:border-foreground/30"
              key={i}
            >
              <LinkIcon className="size-3.5 shrink-0 text-muted-foreground" />
              <input
                aria-label="Link"
                className="min-w-0 flex-1 bg-transparent text-sm outline-none"
                onChange={(e) => {
                  const links = [...form.contact.links];
                  links[i] = e.target.value;
                  patch({ contact: { ...form.contact, links } });
                }}
                placeholder="github.com/you"
                value={link}
              />
              <Button
                aria-label="Remove link"
                className="size-7 shrink-0 text-muted-foreground hover:text-destructive"
                onClick={() =>
                  patch({
                    contact: {
                      ...form.contact,
                      links: form.contact.links.filter((_, x) => x !== i),
                    },
                  })
                }
                size="icon"
                type="button"
                variant="ghost"
              >
                <TrashIcon className="size-3.5" />
              </Button>
            </div>
          ))}
          <Button
            className="w-full border-dashed"
            onClick={() => patch({ contact: { ...form.contact, links: [...form.contact.links, ""] } })}
            type="button"
            variant="outline"
          >
            <PlusIcon className="size-4" /> Add link
          </Button>
        </div>
      );
    }

    if (id === "languages") {
      return (
        <div className="space-y-3">
          <div className="grid gap-2 sm:grid-cols-2">
            {form.languages.map((language, i) => {
              const update = (values: Partial<(typeof form.languages)[number]>) => {
                const languages = [...form.languages];
                languages[i] = { ...language, ...values };
                patch({ languages });
              };
              return (
                <div
                  className="flex items-center gap-2 rounded-xl border bg-field/50 py-1.5 pr-1.5 pl-3 focus-within:border-foreground/30"
                  key={i}
                >
                  <input
                    aria-label="Language"
                    className="min-w-0 flex-1 bg-transparent text-sm outline-none"
                    onChange={(e) => update({ name: e.target.value })}
                    placeholder="Language"
                    value={language.name}
                  />
                  <LevelSelect onChange={(level) => update({ level })} value={language.level} />
                  <Button
                    aria-label="Remove language"
                    className="size-7 shrink-0 text-muted-foreground hover:text-destructive"
                    onClick={() => patch({ languages: form.languages.filter((_, x) => x !== i) })}
                    size="icon"
                    type="button"
                    variant="ghost"
                  >
                    <TrashIcon className="size-3.5" />
                  </Button>
                </div>
              );
            })}
          </div>
          <Button
            className="w-full border-dashed"
            onClick={() => patch({ languages: [...form.languages, { name: "", level: "" }] })}
            type="button"
            variant="outline"
          >
            <PlusIcon className="size-4" /> Add language
          </Button>
        </div>
      );
    }

    return null;
  }

  const activeTemplate =
    CV_TEMPLATE_LIST.find((t) => t.id === form.template) ?? CV_TEMPLATE_LIST[0];

  /** Rendered twice — as a column on xl and inside a sheet below it — so the
      switch needs an id unique to each copy. */
  const previewPanel = (instance: string) => (
    <div className="flex h-full min-h-0 flex-col gap-3">
      {/* One compact toolbar rather than a heading row plus a controls row: the
          two choices here both restyle the document below, so they sit on it. */}
      <div className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-2">
        {/* Two views of one document: the live rendering, and the PDF it
            actually compiles to — built from the draft on screen, so it shows
            unsaved edits too. */}
        <div className="mr-auto flex rounded-lg bg-muted p-[3px]">
          {[
            { id: "preview" as const, label: "Preview", icon: ScrollTextIcon },
            { id: "pdf" as const, label: "PDF", icon: FileTextIcon },
          ].map((item) => (
            <button
              aria-pressed={previewView === item.id}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 font-medium text-sm transition-colors",
                previewView === item.id
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
              key={item.id}
              onClick={() => setPreviewView(item.id)}
              type="button"
            >
              <item.icon className="size-3.5" />
              {item.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Switch
              checked={showPhoto}
              id={`show-photo-${instance}`}
              onCheckedChange={setShowPhoto}
            />
            <Label className="text-muted-foreground text-xs" htmlFor={`show-photo-${instance}`}>
              Photo
            </Label>
          </div>

          {/* The template picker sits over the sheet it restyles, so the choice
              is made against the result instead of blind in a form section. */}
          {/* Base UI reports the value as `string | null` because a select can be
              cleared in general. This one has no null item, so the guard just
              satisfies the type. */}
          <Select
            onValueChange={(template) => {
              if (template) patch({ template });
            }}
            value={form.template}
          >
            <SelectTrigger
              aria-label="CV template"
              className="gap-1.5 rounded-full bg-card pr-2.5 pl-3.5 font-medium"
              size="sm"
            >
              <LayoutTemplateIcon className="size-3.5" />
              <SelectValue>{activeTemplate.label}</SelectValue>
            </SelectTrigger>
            <SelectContent align="end" className="w-80">
              {CV_TEMPLATE_LIST.map((template) => (
                <SelectItem className="py-2" key={template.id} value={template.id}>
                  {/* The wrapper must be its own flex column: SelectItem lays its
                      last span child out as a row. */}
                  <span className="flex flex-col gap-0.5">
                    <span className="font-medium">{template.label}</span>
                    <span className="text-muted-foreground text-xs leading-relaxed">
                      {template.description}
                    </span>
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {previewView === "preview" ? (
        <div className="scrollbar-slim min-h-0 flex-1 overflow-y-auto pb-6">
          <CvPreview cv={preview} showPhoto={showPhoto} template={form.template} />
        </div>
      ) : (
        <ProfilePdfView
          className="min-h-0 flex-1 pb-6"
          cv={preview}
          photo={showPhoto && Boolean(form.photoUrl)}
          template={form.template}
        />
      )}

    </div>
  );

  const jumpTo = (id: SectionId) => {
    sectionRefs.current[id]?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  /*
   * Scroll spy for the rail. A long form with a static nav tells you where you
   * can go but not where you are, which is the thing you actually lose while
   * scrolling. The bottom margin keeps the "current" section the one near the
   * top of the viewport rather than whichever one happens to be tallest.
   */
  useEffect(() => {
    const root = scrollerRef.current;
    if (!root) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const topMost = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        const id = topMost?.target.getAttribute("data-section");
        if (id) setActiveSection(id as SectionId);
      },
      { root, rootMargin: "-8px 0px -62% 0px", threshold: 0 },
    );

    for (const node of Object.values(sectionRefs.current)) {
      if (node) observer.observe(node);
    }
    return () => observer.disconnect();
  }, []);

  const saveButton = (
    <Button
      disabled={status === "saving" || status === "idle"}
      onClick={() => void save()}
      size="sm"
      type="button"
    >
      <SaveIcon className="size-4" />
      {status === "saving" ? "Saving…" : "Save"}
    </Button>
  );

  const statusLine =
    status === "saving"
      ? "Saving…"
      : status === "dirty"
        ? "Unsaved changes"
        : status === "saved"
          ? "All changes saved"
          : `${completion}% complete`;

  const previewSheet = (
    <Sheet>
      <SheetTrigger
        render={
          <Button className="xl:hidden" size="sm" type="button" variant="outline">
            <PanelRightOpenIcon className="size-3.5" />
            Preview
          </Button>
        }
      />
      <SheetContent className="w-full bg-secondary/50 p-4 sm:max-w-2xl" side="right">
        <SheetTitle className="sr-only">CV preview</SheetTitle>
        {previewPanel("sheet")}
      </SheetContent>
    </Sheet>
  );

  return (
    /*
     * Two panels on a padded canvas, the same shape as the application review
     * workspace: the thing you work in, and the thing it produces, each with its
     * own edge and its own scroll.
     *
     * This started as three flush full-bleed columns divided by hairlines, which
     * made every pane too narrow to breathe and read as one dense wall. The
     * section nav moved into the form panel's own header, which buys the form
     * back the width that the rail was taking and leaves two panels instead of
     * three.
     */
    <div className="container flex h-full min-h-0 flex-col gap-3 px-4 py-4 sm:px-6 lg:px-8">
      <header className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-2">
        <CompletionRing value={completion} />
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-semibold text-lg tracking-tight">CV Builder</h1>
          <p className="truncate text-muted-foreground text-xs">{statusLine}</p>
        </div>
        {previewSheet}
        <CvImportDialog
          hasContent={sections.some((item) => filled[item.id])}
          onImport={applyImport}
        />
        {saveButton}
      </header>

      <div className="grid min-h-0 flex-1 gap-3 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        <section className="flex min-h-0 overflow-hidden rounded-xl border bg-card">
          {/* A column inside the panel rather than a strip across the top of it:
              eight sections do not fit on one line, and a nav you have to scroll
              sideways to read is not a nav. It sits inside the panel's own border
              so the page is still two panels, not three, and the scroll spy keeps
              it pointed at wherever you currently are in the form. */}
          <nav className="scrollbar-slim hidden w-44 shrink-0 flex-col gap-0.5 overflow-y-auto border-r p-2.5 md:flex">
            {sections.map((item) => (
              <button
                aria-current={activeSection === item.id ? "true" : undefined}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm transition-colors",
                  activeSection === item.id
                    ? "bg-accent font-medium text-foreground"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground",
                )}
                key={item.id}
                onClick={() => jumpTo(item.id)}
                type="button"
              >
                <item.icon className="size-4 shrink-0" />
                <span className="min-w-0 flex-1 truncate">{item.label}</span>
                {/* A hollow dot is a section with nothing in it yet. */}
                <span
                  className={cn(
                    "size-1.5 shrink-0 rounded-full",
                    filled[item.id] ? "bg-success" : "border border-muted-foreground/40",
                  )}
                />
              </button>
            ))}
          </nav>

          <div
            className="scrollbar-slim min-h-0 flex-1 overflow-y-auto px-5 py-6 sm:px-7"
            ref={scrollerRef}
          >
            {status === "error" ? (
              <p className="mb-4 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-destructive text-sm">
                {message}
              </p>
            ) : null}

            {/* Sections are separated by a hairline and their own heading rather
                than boxed into cards. The entries inside them are already boxed,
                and a box inside a box inside a panel was three borders deep. */}
            {sections.map((item) => (
              <section
                className="scroll-mt-6 border-t pt-9 pb-3 first:border-t-0"
                data-section={item.id}
                key={item.id}
                ref={(node) => {
                  sectionRefs.current[item.id] = node;
                }}
              >
                <div className="mb-6 space-y-1.5">
                  {/* No icon here: the nav column beside it already carries one
                      per section, and repeating it is just noise. */}
                  <div className="flex items-center gap-2.5">
                    <h2 className="min-w-0 font-semibold tracking-tight">{item.label}</h2>
                    {filled[item.id] ? (
                      <CheckIcon className="size-4 shrink-0 text-success" />
                    ) : (
                      <span className="shrink-0 rounded-full bg-secondary px-2 py-0.5 text-muted-foreground text-xs">
                        Empty
                      </span>
                    )}
                  </div>
                  <p className="text-muted-foreground text-sm leading-relaxed">{item.hint}</p>
                </div>

                <div className="space-y-6">{sectionBody(item.id)}</div>
              </section>
            ))}
          </div>
        </section>

        {/* The document, on its own canvas so the paper reads as paper. */}
        <section className="hidden min-h-0 flex-col overflow-hidden rounded-xl border bg-secondary/40 p-5 xl:flex">
          {previewPanel("panel")}
        </section>
      </div>
    </div>
  );
}
