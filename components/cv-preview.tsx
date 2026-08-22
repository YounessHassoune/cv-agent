import { UserRoundIcon } from "lucide-react";

import { type CvTemplateId, resolveTemplate } from "@/lib/cv-templates";
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
  /** Data URL. Shown in the preview only — the compiled PDF stays photo-free. */
  photoUrl?: string;
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

/** Per-template classes. Structure never changes — only type and spacing. */
const skins: Record<
  CvTemplateId,
  {
    body: string;
    padding: string;
    header: string;
    name: string;
    headline: string;
    sectionTitle: string;
    sectionGap: string;
    entryGap: string;
  }
> = {
  modern: {
    body: "font-sans text-[0.7rem] leading-relaxed",
    padding: "px-8 py-8 sm:px-10 sm:py-9",
    header: "text-left",
    name: "text-[1.35rem] font-semibold tracking-tight",
    headline: "text-[0.8rem] opacity-70",
    sectionTitle: "border-b border-black/15 pb-1 text-[0.6rem] uppercase tracking-[0.14em]",
    sectionGap: "mb-5",
    entryGap: "space-y-3.5",
  },
  classic: {
    body: "font-serif text-[0.72rem] leading-relaxed",
    padding: "px-10 py-10 sm:px-12",
    header: "text-center",
    name: "text-[1.5rem] font-semibold tracking-tight",
    headline: "text-[0.82rem] opacity-70",
    sectionTitle:
      "border-black/25 border-b pb-1 text-center text-[0.62rem] uppercase tracking-[0.2em]",
    sectionGap: "mb-5",
    entryGap: "space-y-4",
  },
  compact: {
    body: "font-sans text-[0.64rem] leading-snug",
    padding: "px-7 py-6 sm:px-8",
    header: "text-left",
    name: "text-[1.1rem] font-semibold tracking-tight",
    headline: "text-[0.72rem] opacity-70",
    sectionTitle: "text-[0.56rem] uppercase tracking-[0.16em] opacity-70",
    sectionGap: "mb-3.5",
    entryGap: "space-y-2.5",
  },
};

function dateRange(start?: string, end?: string) {
  if (!start && !end) return null;
  return `${start ?? ""} — ${end || "Present"}`;
}

/**
 * A paper-white rendering of the CV. It stays light in dark mode on purpose:
 * this is a document preview, and the compiled PDF is printed on white.
 */
export function CvPreview({
  cv,
  template,
  className,
  showPhoto,
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
}) {
  const skin = skins[resolveTemplate(template).id];
  const photo = showPhoto ?? Boolean(cv.photoUrl);
  const contact = [cv.email, cv.phone, cv.location, ...(cv.links ?? [])].filter(Boolean);
  const hasBody =
    (cv.summary?.length ?? 0) > 0 ||
    (cv.skills?.length ?? 0) > 0 ||
    (cv.experiences?.length ?? 0) > 0 ||
    (cv.projects?.length ?? 0) > 0 ||
    (cv.education?.length ?? 0) > 0;

  const SectionTitle = ({ children }: { readonly children: React.ReactNode }) => (
    <h3 className={cn("mb-2 font-semibold", skin.sectionTitle)}>{children}</h3>
  );

  const Bullets = ({ items }: { readonly items: string[] }) =>
    items.length === 0 ? null : (
      <ul className="mt-1 space-y-0.5">
        {items.map((item, i) => (
          <li className="flex gap-1.5" key={i}>
            <span
              aria-hidden="true"
              className="mt-[0.45em] size-0.75 shrink-0 rounded-full bg-current opacity-60"
            />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    );

  return (
    <article
      className={cn(
        "mx-auto w-full max-w-184 overflow-hidden rounded-lg bg-paper text-paper-foreground shadow-paper",
        skin.body,
        className,
      )}
    >
      {/* Contact strip above the identity block, as in the reference layout. */}
      {contact.length > 0 ? (
        <div
          className={cn(
            "flex flex-wrap gap-x-4 gap-y-1 bg-black/4 px-8 py-2.5 text-[0.58rem] opacity-70 sm:px-10",
            skin.header === "text-center" && "justify-center",
          )}
        >
          {/* Each item stays on one line so a narrow column wraps between
              entries instead of breaking an email or URL across rows. */}
          {contact.map((item, i) => (
            <span className="whitespace-nowrap" key={`${item}-${i}`}>
              {item}
            </span>
          ))}
        </div>
      ) : null}

      <div className={skin.padding}>
        <header
          className={cn(
            "mb-5",
            skin.header,
            photo &&
              (skin.header === "text-center"
                ? "flex flex-col items-center gap-3"
                : "flex items-center gap-5"),
          )}
        >
          {photo && cv.photoUrl ? (
            // biome-ignore lint/performance/noImgElement: inline data URL, not a remote asset
            <img
              alt=""
              className="size-16 shrink-0 rounded-full object-cover ring-1 ring-black/10"
              src={cv.photoUrl}
            />
          ) : null}
          {photo && !cv.photoUrl ? (
            <span
              aria-hidden="true"
              className="flex size-16 shrink-0 items-center justify-center rounded-full border border-black/15 border-dashed bg-black/3 text-black/25"
            >
              <UserRoundIcon className="size-7" />
            </span>
          ) : null}
          <div className="min-w-0">
            <h2 className={skin.name}>{cv.fullName || "Your name"}</h2>
            {cv.headline ? <p className={cn("mt-0.5 font-medium", skin.headline)}>{cv.headline}</p> : null}
          </div>
        </header>

        {!hasBody ? (
          <p className="py-10 text-center text-[0.7rem] opacity-50">
            Fill in your profile to see the CV take shape here.
          </p>
        ) : null}

        {cv.summary ? (
          <section className={skin.sectionGap}>
            <SectionTitle>Summary</SectionTitle>
            <p>{cv.summary}</p>
          </section>
        ) : null}

        {cv.skills && cv.skills.length > 0 ? (
          <section className={skin.sectionGap}>
            <SectionTitle>Skills</SectionTitle>
            <div className="space-y-2">
              {cv.skills.map((group) => (
                <div key={group.category}>
                  <p className="mb-1 font-semibold text-[0.6rem] opacity-60">{group.category}</p>
                  <div className="flex flex-wrap gap-1">
                    {group.items.map((item) => (
                      <span className="rounded-full bg-black/6 px-2 py-0.5 text-[0.6rem]" key={item}>
                        {item}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {cv.experiences && cv.experiences.length > 0 ? (
          <section className={skin.sectionGap}>
            <SectionTitle>Experience</SectionTitle>
            <div className={skin.entryGap}>
              {cv.experiences.map((experience, i) => (
                <div key={`${experience.company}-${i}`}>
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                    <p className="font-semibold">
                      {experience.role}
                      <span className="font-normal opacity-70"> · {experience.company}</span>
                    </p>
                    <p className="rounded-full bg-black/5 px-2 py-0.5 text-[0.58rem] opacity-70">
                      {[dateRange(experience.start, experience.end), experience.location]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                  <Bullets items={experience.bullets} />
                  {experience.stack && experience.stack.length > 0 ? (
                    <p className="mt-1 text-[0.58rem] opacity-60">{experience.stack.join(" · ")}</p>
                  ) : null}
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {cv.projects && cv.projects.length > 0 ? (
          <section className={skin.sectionGap}>
            <SectionTitle>Projects</SectionTitle>
            <div className={skin.entryGap}>
              {cv.projects.map((project, i) => (
                <div key={`${project.title}-${i}`}>
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                    <p className="font-semibold">{project.title}</p>
                    {project.link ? (
                      <span className="text-[0.58rem] opacity-60">{project.link}</span>
                    ) : null}
                  </div>
                  <Bullets items={project.bullets} />
                  {project.stack && project.stack.length > 0 ? (
                    <p className="mt-1 text-[0.58rem] opacity-60">{project.stack.join(" · ")}</p>
                  ) : null}
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {cv.education && cv.education.length > 0 ? (
          <section className={skin.sectionGap}>
            <SectionTitle>Education</SectionTitle>
            <div className="space-y-1.5">
              {cv.education.map((entry, i) => (
                <div className="flex flex-wrap items-baseline justify-between gap-x-3" key={i}>
                  <p>
                    <span className="font-semibold">{entry.degree}</span>
                    <span className="opacity-70"> · {entry.institution}</span>
                  </p>
                  {entry.dates ? (
                    <p className="rounded-full bg-black/5 px-2 py-0.5 text-[0.58rem] opacity-70">
                      {entry.dates}
                    </p>
                  ) : null}
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {cv.languages && cv.languages.length > 0 ? (
          <section>
            <SectionTitle>Languages</SectionTitle>
            <p>{cv.languages.map((l) => `${l.name} (${l.level})`).join(" · ")}</p>
          </section>
        ) : null}
      </div>
    </article>
  );
}
