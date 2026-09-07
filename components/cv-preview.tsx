import { UserRoundIcon } from "lucide-react";

import { titlesFor } from "@/lib/cv-sections";
import { CV_ALPHA, CV_SEPARATOR, ink, resolveTemplate, shade } from "@/lib/cv-templates";
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

function dateRange(start?: string, end?: string) {
  if (!start && !end) return null;
  return `${start ?? ""} - ${end || "Present"}`;
}

/**
 * A paper-white rendering of the CV, and the screen half of a pair: every size
 * here comes from the shared template layout that `agent/lib/pdf.ts` renders
 * from, so the preview and the downloaded PDF are the same document. It stays
 * light in dark mode on purpose — the PDF is printed on white.
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
  const l = resolveTemplate(template).layout;
  const t = titlesFor(cv.language);
  const photo = showPhoto ?? Boolean(cv.photoUrl);
  const contact = [cv.email, cv.phone, cv.location, ...(cv.links ?? [])].filter(Boolean);
  const skills = cv.skills ?? [];
  const experiences = cv.experiences ?? [];
  const projects = cv.projects ?? [];
  const education = cv.education ?? [];
  const languages = cv.languages ?? [];
  const hasBody =
    Boolean(cv.summary) ||
    skills.length + experiences.length + projects.length + education.length > 0;

  // Templates that skip the rule lean on a lighter title instead, and the serif
  // template draws its rule heavier. `stylesFor` in the PDF does the same.
  const ruleAlpha = l.serif ? CV_ALPHA.ruleStrong : CV_ALPHA.rule;

  /** `space-y-*` semantics: the gap goes on every item but the last. */
  const gapAfter = (i: number, length: number, gap: number) =>
    i < length - 1 ? rem(gap) : undefined;

  const Section = ({
    title,
    children,
  }: {
    readonly title: string;
    readonly children: React.ReactNode;
  }) => (
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

  const Bullets = ({ items }: { readonly items: string[] }) =>
    items.length === 0 ? null : (
      <ul>
        {items.map((item, i) => (
          <li className="flex" key={i} style={{ marginTop: rem(0.1) }}>
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
            <span>{item}</span>
          </li>
        ))}
      </ul>
    );

  const Chip = ({ children }: { readonly children: React.ReactNode }) => (
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

  const Stack = ({ items }: { readonly items?: string[] }) =>
    items && items.length > 0 ? (
      <p style={{ fontSize: rem(l.meta), color: ink(CV_ALPHA.soft), marginTop: rem(0.2) }}>
        {items.join(CV_SEPARATOR)}
      </p>
    ) : null;

  const EntryHeader = ({ children }: { readonly children: React.ReactNode }) => (
    <div className="flex items-baseline justify-between" style={{ columnGap: rem(0.75) }}>
      {children}
    </div>
  );

  return (
    <article
      className={cn(
        "mx-auto w-full overflow-hidden rounded-lg bg-paper text-paper-foreground shadow-paper",
        l.serif ? "font-serif" : "font-sans",
        className,
      )}
      style={{ maxWidth: "46rem", fontSize: rem(l.base), lineHeight: l.lineHeight }}
    >
      {/* Contact strip above the identity block, as in the compiled PDF. */}
      {contact.length > 0 ? (
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
          {contact.map((item, i) => (
            <span className="whitespace-nowrap" key={`${item}-${i}`}>
              {item}
            </span>
          ))}
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
              {cv.fullName || "Your name"}
            </h2>
            {cv.headline ? (
              <p
                style={{
                  fontSize: rem(l.headline),
                  color: ink(CV_ALPHA.muted),
                  marginTop: rem(l.headlineGap),
                  lineHeight: 1.2,
                }}
              >
                {cv.headline}
              </p>
            ) : null}
          </div>
        </header>

        {!hasBody ? (
          <p className="py-10 text-center opacity-50" style={{ fontSize: rem(l.base) }}>
            Fill in your profile to see the CV take shape here.
          </p>
        ) : null}

        {cv.summary ? (
          <Section title={t.summary}>
            <p>{cv.summary}</p>
          </Section>
        ) : null}

        {skills.length > 0 ? (
          <Section title={t.skills}>
            {skills.map((group, i) => (
              <div key={group.category} style={{ marginBottom: gapAfter(i, skills.length, 0.5) }}>
                <p
                  className="font-semibold"
                  style={{
                    fontSize: rem(l.label),
                    color: ink(CV_ALPHA.soft),
                    marginBottom: rem(0.2),
                  }}
                >
                  {group.category}
                </p>
                <div
                  className="flex flex-wrap"
                  style={{ columnGap: rem(0.25), rowGap: rem(0.2) }}
                >
                  {group.items.map((item) => (
                    <span
                      className="rounded-full"
                      key={item}
                      style={{
                        background: shade(CV_ALPHA.pill),
                        fontSize: rem(l.label),
                        lineHeight: 1.2,
                        padding: `${rem(0.125)} ${rem(0.375)}`,
                      }}
                    >
                      {item}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </Section>
        ) : null}

        {experiences.length > 0 ? (
          <Section title={t.experience}>
            {experiences.map((experience, i) => (
              <div
                key={`${experience.company}-${i}`}
                style={{ marginBottom: gapAfter(i, experiences.length, l.entryGap) }}
              >
                <EntryHeader>
                  <p className="min-w-0">
                    <span className="font-semibold">{experience.role}</span>
                    <span style={{ color: ink(CV_ALPHA.muted) }}>{`${CV_SEPARATOR}${experience.company}`}</span>
                  </p>
                  {[dateRange(experience.start, experience.end), experience.location].some(
                    Boolean,
                  ) ? (
                    <Chip>
                      {[dateRange(experience.start, experience.end), experience.location]
                        .filter(Boolean)
                        .join(CV_SEPARATOR)}
                    </Chip>
                  ) : null}
                </EntryHeader>
                <Bullets items={experience.bullets} />
                <Stack items={experience.stack} />
              </div>
            ))}
          </Section>
        ) : null}

        {projects.length > 0 ? (
          <Section title={t.projects}>
            {projects.map((project, i) => (
              <div
                key={`${project.title}-${i}`}
                style={{ marginBottom: gapAfter(i, projects.length, l.entryGap) }}
              >
                <EntryHeader>
                  <p className="min-w-0 font-semibold">{project.title}</p>
                  {project.link ? (
                    <span
                      className="shrink-0 whitespace-nowrap"
                      style={{ fontSize: rem(l.meta), color: ink(CV_ALPHA.soft) }}
                    >
                      {project.link}
                    </span>
                  ) : null}
                </EntryHeader>
                <Bullets items={project.bullets} />
                <Stack items={project.stack} />
              </div>
            ))}
          </Section>
        ) : null}

        {education.length > 0 ? (
          <Section title={t.education}>
            {education.map((entry, i) => (
              <div key={i} style={{ marginBottom: gapAfter(i, education.length, 0.375) }}>
                <EntryHeader>
                  <p className="min-w-0">
                    <span className="font-semibold">{entry.degree}</span>
                    <span style={{ color: ink(CV_ALPHA.muted) }}>{`${CV_SEPARATOR}${entry.institution}`}</span>
                  </p>
                  {entry.dates ? <Chip>{entry.dates}</Chip> : null}
                </EntryHeader>
              </div>
            ))}
          </Section>
        ) : null}

        {languages.length > 0 ? (
          <Section title={t.languages}>
            <p>{languages.map((entry) => `${entry.name} (${entry.level})`).join(CV_SEPARATOR)}</p>
          </Section>
        ) : null}
      </div>
    </article>
  );
}
