"use client";

import { useMemo, useState } from "react";
import {
  BriefcaseIcon,
  CheckIcon,
  FolderGitIcon,
  GraduationCapIcon,
  LanguagesIcon,
  LayoutTemplateIcon,
  LinkIcon,
  type LucideIcon,
  MinusIcon,
  PanelRightOpenIcon,
  PlusIcon,
  SaveIcon,
  TextIcon,
  TrashIcon,
  UserRoundIcon,
  WrenchIcon,
} from "lucide-react";

import { type CvPreviewData, CvPreview } from "@/components/cv-preview";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { CV_TEMPLATE_LIST, DEFAULT_TEMPLATE } from "@/lib/cv-templates";
import { cn } from "@/lib/utils";
import { PhotoField } from "./photo-field";

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
  | "languages"
  | "template";

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
        dates: [e.start, e.end].filter(Boolean).join(" — "),
      })),
    languages: form.languages
      .filter((l) => l.name.trim())
      .map((l) => ({ name: l.name, level: l.level || "—" })),
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
    hint: "2–3 sentences. The agent rewrites this per job, but keeps to the facts here.",
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
    hint: "Only list what you have actually used — these gate what a CV may claim.",
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
    hint: "GitHub, LinkedIn, a portfolio — whatever you want on the CV header.",
  },
  { id: "languages", label: "Languages", icon: LanguagesIcon, hint: "Spoken languages and level." },
  {
    id: "template",
    label: "Template",
    icon: LayoutTemplateIcon,
    hint: "Every template is single-column, plain-text and ATS-safe.",
  },
];

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
    <div className="space-y-4 rounded-xl border bg-background/60 p-4">
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

export function ProfileEditor({ initial }: { readonly initial: ProfileForm }) {
  const [form, setForm] = useState<ProfileForm>(initial);
  const [section, setSection] = useState<SectionId>("identity");
  const [status, setStatus] = useState<"idle" | "dirty" | "saving" | "saved" | "error">("idle");
  const [message, setMessage] = useState<string>();

  const patch = (values: Partial<ProfileForm>) => {
    setForm((f) => ({ ...f, ...values }));
    setStatus("dirty");
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
      template: true,
    }),
    [form],
  );

  // "Template" is always satisfied, so it doesn't count toward completeness.
  const scored = sections.filter((s) => s.id !== "template");
  const completion = Math.round(
    (scored.filter((s) => filled[s.id]).length / scored.length) * 100,
  );
  const preview = useMemo(() => toPreview(form), [form]);

  const save = async () => {
    setStatus("saving");
    setMessage(undefined);
    const response = await fetch("/api/profile", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        fullName: form.fullName,
        headline: form.headline || undefined,
        summary: form.summary || undefined,
        photoUrl: form.photoUrl || undefined,
        template: form.template || DEFAULT_TEMPLATE,
        contact: {
          email: form.contact.email,
          phone: form.contact.phone || undefined,
          location: form.contact.location || undefined,
          links: form.contact.links.filter(Boolean),
        },
        languages: form.languages.filter((l) => l.name),
        education: form.education.filter((e) => e.institution),
        skills: form.skills.filter((s) => s.name),
        experiences: form.experiences
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
        projects: form.projects
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

  const active = sections.find((s) => s.id === section) ?? sections[0];

  const sectionRail = (
    <nav className="surface-card overflow-hidden rounded-xl">
      <ul className="divide-y">
        {sections.map((item) => {
          const isActive = item.id === section;
          return (
            <li key={item.id}>
              <button
                aria-current={isActive ? "true" : undefined}
                className={cn(
                  "flex w-full items-center gap-2 px-4 py-3 text-left text-sm transition-colors",
                  isActive
                    ? "bg-primary/8 font-medium text-foreground"
                    : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
                )}
                onClick={() => setSection(item.id)}
                type="button"
              >
                <item.icon className={cn("size-4 shrink-0", isActive && "text-primary")} />
                <span className="min-w-0 flex-1 truncate">{item.label}</span>
                {filled[item.id] && item.id !== "template" ? (
                  <CheckIcon className="size-3.5 shrink-0 text-success" />
                ) : null}
                {isActive ? (
                  <MinusIcon className="size-3.5 shrink-0 text-muted-foreground" />
                ) : (
                  <PlusIcon className="size-3.5 shrink-0 text-muted-foreground" />
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );

  const previewPanel = (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <p className="font-medium text-sm">Live preview</p>
        <Badge variant="outline">
          {CV_TEMPLATE_LIST.find((t) => t.id === form.template)?.label ?? "Modern"}
        </Badge>
      </div>
      <div className="scrollbar-slim min-h-0 flex-1 overflow-y-auto rounded-xl bg-muted/50 p-4">
        <CvPreview cv={preview} template={form.template} />
      </div>
    </div>
  );

  return (
    <div className="mx-auto w-full max-w-440 px-4 py-6 sm:px-6">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          <h1 className="font-medium text-2xl tracking-tight">CV Builder</h1>
          <p className="text-muted-foreground text-sm">
            Your master profile. Everything a tailored CV can claim lives here.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden w-36 space-y-1.5 sm:block">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Completeness</span>
              <span className="font-mono tabular-nums">{completion}%</span>
            </div>
            <Progress value={completion} />
          </div>

          {/* Below xl the preview lives in a sheet instead of a third column. */}
          <Sheet>
            <SheetTrigger asChild>
              <Button className="xl:hidden" size="sm" type="button" variant="outline">
                <PanelRightOpenIcon className="size-3.5" />
                Preview
              </Button>
            </SheetTrigger>
            <SheetContent className="w-full p-4 sm:max-w-md" side="right">
              <SheetTitle className="sr-only">CV preview</SheetTitle>
              {previewPanel}
            </SheetContent>
          </Sheet>

          {status === "dirty" ? (
            <span className="hidden text-muted-foreground text-xs sm:inline">Unsaved changes</span>
          ) : null}

          <Button disabled={status === "saving"} onClick={save} type="button">
            <SaveIcon className="size-4" />
            {status === "saving" ? "Saving…" : "Save profile"}
          </Button>
        </div>
      </div>

      {status === "saved" ? (
        <p className="mb-4 flex items-center gap-2 rounded-lg border border-success/30 bg-success/5 px-3 py-2 text-sm">
          <CheckIcon className="size-4 text-success" /> Profile saved.
        </p>
      ) : null}
      {status === "error" ? (
        <p className="mb-4 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-destructive text-sm">
          {message}
        </p>
      ) : null}

      <div className="grid items-start gap-6 lg:grid-cols-[16rem_minmax(0,1fr)] xl:grid-cols-[16rem_minmax(0,1fr)_28rem]">
        <div className="lg:sticky lg:top-4">{sectionRail}</div>

        <div className="surface-card rounded-xl p-5 sm:p-6">
          <div className="mb-5 space-y-1">
            <h2 className="font-medium text-base tracking-tight">{active.label}</h2>
            <p className="text-muted-foreground text-sm">{active.hint}</p>
          </div>

          {section === "identity" ? (
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
                    onChange={(e) =>
                      patch({ contact: { ...form.contact, location: e.target.value } })
                    }
                    placeholder="Berlin, Germany"
                    value={form.contact.location}
                  />
                </FieldRow>
              </div>
            </div>
          ) : null}

          {section === "summary" ? (
            <FieldRow label="Professional summary">
              <Textarea
                onChange={(e) => patch({ summary: e.target.value })}
                placeholder="Full-stack engineer with 6 years building payment systems…"
                rows={6}
                value={form.summary}
              />
            </FieldRow>
          ) : null}

          {section === "experience" ? (
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
                    onRemove={() =>
                      patch({ experiences: form.experiences.filter((_, x) => x !== i) })
                    }
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
                          <Input
                            onChange={(e) => update({ start: e.target.value })}
                            type="date"
                            value={exp.start}
                          />
                        </FieldRow>
                        <FieldRow label="End">
                          <Input
                            onChange={(e) => update({ end: e.target.value })}
                            type="date"
                            value={exp.end}
                          />
                        </FieldRow>
                      </div>
                    </div>
                    <FieldRow label="Achievements — one per line">
                      <Textarea
                        onChange={(e) => update({ bullets: e.target.value })}
                        placeholder={"Cut checkout latency by 40% by…\nLed a team of 4 to ship…"}
                        rows={4}
                        value={exp.bullets}
                      />
                    </FieldRow>
                    <FieldRow label="Tech actually used (comma separated)">
                      <Input
                        onChange={(e) => update({ stack: e.target.value })}
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
          ) : null}

          {section === "education" ? (
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
                        <Input
                          onChange={(e) => update({ degree: e.target.value })}
                          value={entry.degree}
                        />
                      </FieldRow>
                      <FieldRow label="Start year">
                        <Input
                          onChange={(e) => update({ start: e.target.value })}
                          placeholder="2018"
                          value={entry.start}
                        />
                      </FieldRow>
                      <FieldRow label="End year">
                        <Input
                          onChange={(e) => update({ end: e.target.value })}
                          placeholder="2021"
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
          ) : null}

          {section === "skills" ? (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                {form.skills.map((skill, i) => (
                  <div className="flex gap-2" key={i}>
                    <Input
                      onChange={(e) => {
                        const skills = [...form.skills];
                        skills[i] = { ...skill, name: e.target.value };
                        patch({ skills });
                      }}
                      placeholder="Skill"
                      value={skill.name}
                    />
                    <Input
                      className="w-32 shrink-0"
                      onChange={(e) => {
                        const skills = [...form.skills];
                        skills[i] = { ...skill, category: e.target.value };
                        patch({ skills });
                      }}
                      placeholder="Category"
                      value={skill.category}
                    />
                    <Button
                      aria-label="Remove skill"
                      className="text-muted-foreground hover:text-destructive"
                      onClick={() => patch({ skills: form.skills.filter((_, x) => x !== i) })}
                      size="icon"
                      type="button"
                      variant="ghost"
                    >
                      <TrashIcon className="size-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
              <Button
                className="w-full border-dashed"
                onClick={() => patch({ skills: [...form.skills, { name: "", category: "" }] })}
                type="button"
                variant="outline"
              >
                <PlusIcon className="size-4" /> Add skill
              </Button>
            </div>
          ) : null}

          {section === "projects" ? (
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
                    <FieldRow label="Highlights — one per line">
                      <Textarea
                        onChange={(e) => update({ bullets: e.target.value })}
                        rows={3}
                        value={project.bullets}
                      />
                    </FieldRow>
                    <FieldRow label="Tech actually used (comma separated)">
                      <Input onChange={(e) => update({ stack: e.target.value })} value={project.stack} />
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
          ) : null}

          {section === "links" ? (
            <div className="space-y-4">
              {form.contact.links.map((link, i) => (
                <div className="flex gap-2" key={i}>
                  <Input
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
                    className="text-muted-foreground hover:text-destructive"
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
                onClick={() =>
                  patch({ contact: { ...form.contact, links: [...form.contact.links, ""] } })
                }
                type="button"
                variant="outline"
              >
                <PlusIcon className="size-4" /> Add link
              </Button>
            </div>
          ) : null}

          {section === "languages" ? (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                {form.languages.map((language, i) => (
                  <div className="flex gap-2" key={i}>
                    <Input
                      onChange={(e) => {
                        const languages = [...form.languages];
                        languages[i] = { ...language, name: e.target.value };
                        patch({ languages });
                      }}
                      placeholder="Language"
                      value={language.name}
                    />
                    <Input
                      className="w-32 shrink-0"
                      onChange={(e) => {
                        const languages = [...form.languages];
                        languages[i] = { ...language, level: e.target.value };
                        patch({ languages });
                      }}
                      placeholder="Level"
                      value={language.level}
                    />
                    <Button
                      aria-label="Remove language"
                      className="text-muted-foreground hover:text-destructive"
                      onClick={() => patch({ languages: form.languages.filter((_, x) => x !== i) })}
                      size="icon"
                      type="button"
                      variant="ghost"
                    >
                      <TrashIcon className="size-3.5" />
                    </Button>
                  </div>
                ))}
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
          ) : null}

          {section === "template" ? (
            <div className="space-y-3">
              {CV_TEMPLATE_LIST.map((template) => {
                const isActive = form.template === template.id;
                return (
                  <button
                    className={cn(
                      "flex w-full items-start gap-3 rounded-xl border p-4 text-left transition-colors",
                      isActive
                        ? "border-primary/40 bg-primary/5"
                        : "hover:border-primary/25 hover:bg-accent/40",
                    )}
                    key={template.id}
                    onClick={() => patch({ template: template.id })}
                    type="button"
                  >
                    <span
                      className={cn(
                        "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border",
                        isActive ? "border-primary bg-primary text-primary-foreground" : "bg-background",
                      )}
                    >
                      {isActive ? <CheckIcon className="size-3" /> : null}
                    </span>
                    <span className="space-y-1">
                      <span className="block font-medium text-sm">{template.label}</span>
                      <span className="block text-muted-foreground text-sm">
                        {template.description}
                      </span>
                    </span>
                  </button>
                );
              })}
              <p className="rounded-lg border bg-muted/40 p-3 text-muted-foreground text-xs leading-relaxed">
                All three render as a single column of real text with standard headings and a core
                PDF font — the parts an ATS parses. They differ in typography and spacing only.
              </p>
            </div>
          ) : null}
        </div>

        <div className="hidden xl:sticky xl:top-4 xl:block xl:h-[calc(100dvh-16rem)]">
          {previewPanel}
        </div>
      </div>
    </div>
  );
}
