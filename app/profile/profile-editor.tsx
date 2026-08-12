"use client";

import { PlusIcon, TrashIcon } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export type ProfileForm = {
  fullName: string;
  headline: string;
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

const lines = (value: string) => value.split("\n").map((v) => v.trim()).filter(Boolean);
const commas = (value: string) => value.split(",").map((v) => v.trim()).filter(Boolean);

function Section({
  title,
  hint,
  children,
  onAdd,
}: {
  readonly title: string;
  readonly hint?: string;
  readonly children: React.ReactNode;
  readonly onAdd?: () => void;
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="font-medium text-sm">{title}</h2>
          {hint ? <p className="text-muted-foreground text-xs">{hint}</p> : null}
        </div>
        {onAdd ? (
          <Button onClick={onAdd} size="sm" type="button" variant="outline">
            <PlusIcon className="size-3.5" /> Add
          </Button>
        ) : null}
      </div>
      {children}
    </section>
  );
}

function Row({ children, onRemove }: { readonly children: React.ReactNode; readonly onRemove: () => void }) {
  return (
    <div className="space-y-2 rounded-lg border p-3">
      <div className="space-y-2">{children}</div>
      <Button className="text-destructive" onClick={onRemove} size="sm" type="button" variant="ghost">
        <TrashIcon className="size-3.5" /> Remove
      </Button>
    </div>
  );
}

export function ProfileEditor({ initial }: { readonly initial: ProfileForm }) {
  const [form, setForm] = useState<ProfileForm>(initial);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [message, setMessage] = useState<string>();

  const patch = (values: Partial<ProfileForm>) => setForm((f) => ({ ...f, ...values }));

  const save = async () => {
    setStatus("saving");
    setMessage(undefined);
    const response = await fetch("/api/profile", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        fullName: form.fullName,
        headline: form.headline || undefined,
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

  return (
    <div className="mx-auto w-full max-w-3xl space-y-8 px-4 py-8 sm:px-6">
      <div>
        <h1 className="font-medium text-2xl tracking-tight">Master profile</h1>
        <p className="mt-1 text-muted-foreground text-sm">
          The agent may only claim what is written here. Anything missing cannot appear on a
          generated CV.
        </p>
      </div>

      <Section title="Identity">
        <div className="grid gap-2 sm:grid-cols-2">
          <Input
            onChange={(e) => patch({ fullName: e.target.value })}
            placeholder="Full name"
            value={form.fullName}
          />
          <Input
            onChange={(e) => patch({ headline: e.target.value })}
            placeholder="Headline (e.g. Full-Stack Engineer)"
            value={form.headline}
          />
          <Input
            onChange={(e) => patch({ contact: { ...form.contact, email: e.target.value } })}
            placeholder="Email"
            value={form.contact.email}
          />
          <Input
            onChange={(e) => patch({ contact: { ...form.contact, phone: e.target.value } })}
            placeholder="Phone"
            value={form.contact.phone}
          />
          <Input
            onChange={(e) => patch({ contact: { ...form.contact, location: e.target.value } })}
            placeholder="Location"
            value={form.contact.location}
          />
          <Input
            onChange={(e) =>
              patch({ contact: { ...form.contact, links: commas(e.target.value) } })
            }
            placeholder="Links (comma separated)"
            value={form.contact.links.join(", ")}
          />
        </div>
      </Section>

      <Section
        hint="Only list technologies you have actually used — these gate what the CV may claim."
        onAdd={() => patch({ skills: [...form.skills, { name: "", category: "" }] })}
        title="Skills"
      >
        <div className="grid gap-2 sm:grid-cols-2">
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
                onChange={(e) => {
                  const skills = [...form.skills];
                  skills[i] = { ...skill, category: e.target.value };
                  patch({ skills });
                }}
                placeholder="Category"
                value={skill.category}
              />
              <Button
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
      </Section>

      <Section
        hint="One achievement per line. Include real numbers wherever you have them."
        onAdd={() =>
          patch({
            experiences: [
              ...form.experiences,
              { company: "", role: "", location: "", start: "", end: "", bullets: "", stack: "" },
            ],
          })
        }
        title="Experience"
      >
        {form.experiences.map((exp, i) => {
          const update = (values: Partial<(typeof form.experiences)[number]>) => {
            const experiences = [...form.experiences];
            experiences[i] = { ...exp, ...values };
            patch({ experiences });
          };
          return (
            <Row
              key={i}
              onRemove={() => patch({ experiences: form.experiences.filter((_, x) => x !== i) })}
            >
              <div className="grid gap-2 sm:grid-cols-2">
                <Input onChange={(e) => update({ company: e.target.value })} placeholder="Company" value={exp.company} />
                <Input onChange={(e) => update({ role: e.target.value })} placeholder="Role" value={exp.role} />
                <Input onChange={(e) => update({ location: e.target.value })} placeholder="Location" value={exp.location} />
                <div className="grid grid-cols-2 gap-2">
                  <Input onChange={(e) => update({ start: e.target.value })} placeholder="Start" type="date" value={exp.start} />
                  <Input onChange={(e) => update({ end: e.target.value })} placeholder="End" type="date" value={exp.end} />
                </div>
              </div>
              <Textarea
                onChange={(e) => update({ bullets: e.target.value })}
                placeholder="Achievements, one per line"
                rows={4}
                value={exp.bullets}
              />
              <Input
                onChange={(e) => update({ stack: e.target.value })}
                placeholder="Tech actually used (comma separated)"
                value={exp.stack}
              />
            </Row>
          );
        })}
      </Section>

      <Section
        onAdd={() =>
          patch({
            projects: [...form.projects, { title: "", description: "", link: "", bullets: "", stack: "" }],
          })
        }
        title="Projects"
      >
        {form.projects.map((project, i) => {
          const update = (values: Partial<(typeof form.projects)[number]>) => {
            const projects = [...form.projects];
            projects[i] = { ...project, ...values };
            patch({ projects });
          };
          return (
            <Row key={i} onRemove={() => patch({ projects: form.projects.filter((_, x) => x !== i) })}>
              <div className="grid gap-2 sm:grid-cols-2">
                <Input onChange={(e) => update({ title: e.target.value })} placeholder="Title" value={project.title} />
                <Input onChange={(e) => update({ link: e.target.value })} placeholder="Link" value={project.link} />
              </div>
              <Input
                onChange={(e) => update({ description: e.target.value })}
                placeholder="One-line description"
                value={project.description}
              />
              <Textarea
                onChange={(e) => update({ bullets: e.target.value })}
                placeholder="Achievements, one per line"
                rows={3}
                value={project.bullets}
              />
              <Input
                onChange={(e) => update({ stack: e.target.value })}
                placeholder="Tech actually used (comma separated)"
                value={project.stack}
              />
            </Row>
          );
        })}
      </Section>

      <Section
        onAdd={() =>
          patch({ education: [...form.education, { institution: "", degree: "", start: "", end: "" }] })
        }
        title="Education"
      >
        {form.education.map((entry, i) => {
          const update = (values: Partial<(typeof form.education)[number]>) => {
            const education = [...form.education];
            education[i] = { ...entry, ...values };
            patch({ education });
          };
          return (
            <Row key={i} onRemove={() => patch({ education: form.education.filter((_, x) => x !== i) })}>
              <div className="grid gap-2 sm:grid-cols-2">
                <Input onChange={(e) => update({ institution: e.target.value })} placeholder="Institution" value={entry.institution} />
                <Input onChange={(e) => update({ degree: e.target.value })} placeholder="Degree" value={entry.degree} />
                <Input onChange={(e) => update({ start: e.target.value })} placeholder="Start year" value={entry.start} />
                <Input onChange={(e) => update({ end: e.target.value })} placeholder="End year" value={entry.end} />
              </div>
            </Row>
          );
        })}
      </Section>

      <Section
        onAdd={() => patch({ languages: [...form.languages, { name: "", level: "" }] })}
        title="Languages"
      >
        <div className="grid gap-2 sm:grid-cols-2">
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
                onChange={(e) => {
                  const languages = [...form.languages];
                  languages[i] = { ...language, level: e.target.value };
                  patch({ languages });
                }}
                placeholder="Level"
                value={language.level}
              />
              <Button
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
      </Section>

      <div className="sticky bottom-0 flex items-center gap-3 border-t bg-background py-4">
        <Button disabled={status === "saving"} onClick={save} type="button">
          {status === "saving" ? "Saving…" : "Save profile"}
        </Button>
        {status === "saved" ? <span className="text-muted-foreground text-sm">Saved.</span> : null}
        {status === "error" ? <span className="text-destructive text-sm">{message}</span> : null}
      </div>
    </div>
  );
}
