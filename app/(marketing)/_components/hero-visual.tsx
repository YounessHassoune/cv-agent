/**
 * The hero's picture: a tailored CV, mid-scoring.
 *
 * Drawn rather than screenshotted. A screenshot of the real app would be out of
 * date by the next layout change and unreadable at this size anyway, while this
 * says the same thing in one glance — a document, the job it was written for,
 * and a score attached to it.
 *
 * Every colour is `currentColor` at some opacity, so the whole thing inverts
 * with the theme for free and never needs a second dark-mode copy. The two
 * accents that are not — the score ring and the matched keyword — inherit from
 * a `text-success` wrapper for the same reason.
 */
export function HeroVisual() {
  return (
    <svg
      aria-hidden="true"
      className="h-auto w-full max-w-lg text-foreground"
      fill="none"
      role="presentation"
      viewBox="0 0 520 440"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* The sheet behind, just enough of it to read as a stack rather than a
          single floating rectangle. */}
      <rect
        height="360"
        opacity="0.06"
        rx="14"
        width="290"
        x="128"
        y="52"
        fill="currentColor"
      />
      <rect
        height="360"
        opacity="0.1"
        rx="14"
        stroke="currentColor"
        strokeWidth="1.5"
        width="290"
        x="118"
        y="44"
      />

      {/* The CV itself. */}
      <g>
        <rect
          height="376"
          rx="16"
          width="300"
          x="100"
          y="32"
          fill="var(--card)"
          stroke="currentColor"
          strokeOpacity="0.14"
          strokeWidth="1.5"
        />

        {/* Header: name, then headline. Weight carries the hierarchy, exactly as
            the compiled PDF does. */}
        <rect fill="currentColor" height="11" opacity="0.85" rx="5.5" width="126" x="128" y="64" />
        <rect fill="currentColor" height="7" opacity="0.35" rx="3.5" width="88" x="128" y="85" />

        {/* Contact strip. */}
        <rect fill="currentColor" height="20" opacity="0.05" rx="6" width="244" x="128" y="104" />
        <rect fill="currentColor" height="5" opacity="0.3" rx="2.5" width="52" x="140" y="112" />
        <rect fill="currentColor" height="5" opacity="0.3" rx="2.5" width="40" x="204" y="112" />
        <rect fill="currentColor" height="5" opacity="0.3" rx="2.5" width="46" x="256" y="112" />

        {/* Three sections, each a ruled heading over shortening lines — the
            shape of a CV read from across a desk. */}
        {[
          { y: 150, lines: [244, 210, 168] },
          { y: 228, lines: [244, 196] },
          { y: 290, lines: [244, 224, 180] },
        ].map((section) => (
          <g key={section.y}>
            <rect
              fill="currentColor"
              height="7"
              opacity="0.6"
              rx="3.5"
              width="74"
              x="128"
              y={section.y}
            />
            <rect
              fill="currentColor"
              height="1.5"
              opacity="0.12"
              width="244"
              x="128"
              y={section.y + 14}
            />
            {section.lines.map((width, index) => (
              <rect
                fill="currentColor"
                height="5"
                key={width}
                opacity="0.2"
                rx="2.5"
                width={width}
                x="128"
                y={section.y + 26 + index * 14}
              />
            ))}
          </g>
        ))}

        {/* Skill pills. */}
        <g opacity="0.14">
          {[
            { width: 44, x: 128 },
            { width: 58, x: 178 },
            { width: 38, x: 242 },
            { width: 50, x: 286 },
          ].map((pill) => (
            <rect
              fill="currentColor"
              height="16"
              key={pill.x}
              rx="8"
              width={pill.width}
              x={pill.x}
              y="360"
            />
          ))}
        </g>
      </g>

      {/* The job description, feeding in from the left. Deliberately smaller and
          plainer than the CV: it is the input, not the product. */}
      <g>
        <rect
          height="118"
          rx="12"
          width="128"
          x="14"
          y="118"
          fill="var(--card)"
          stroke="currentColor"
          strokeOpacity="0.14"
          strokeWidth="1.5"
        />
        <rect fill="currentColor" height="6" opacity="0.5" rx="3" width="52" x="32" y="140" />
        {[160, 172, 184, 196, 208].map((y, index) => (
          <rect
            fill="currentColor"
            height="4"
            key={y}
            opacity="0.18"
            rx="2"
            width={index % 2 === 0 ? 92 : 70}
            x="32"
            y={y}
          />
        ))}
        {/* The one line that matters: a matched keyword. */}
        <rect
          className="text-success"
          fill="currentColor"
          height="4"
          opacity="0.7"
          rx="2"
          width="46"
          x="32"
          y="172"
        />
      </g>

      {/* Score card. The number is the thing people come for, so it is the only
          element allowed to sit on top of the sheet. */}
      <g>
        <rect
          height="96"
          rx="14"
          width="150"
          x="352"
          y="236"
          fill="var(--card)"
          stroke="currentColor"
          strokeOpacity="0.14"
          strokeWidth="1.5"
        />

        {/* Ring: one full track, one arc stopping at 87%. The dash offset is the
            score — 201 is the circumference at r=32. */}
        <g transform="translate(398, 284)">
          <circle cx="0" cy="0" opacity="0.12" r="32" stroke="currentColor" strokeWidth="7" />
          <circle
            className="text-success"
            cx="0"
            cy="0"
            r="32"
            stroke="currentColor"
            strokeDasharray="201"
            strokeDashoffset="26"
            strokeLinecap="round"
            strokeWidth="7"
            transform="rotate(-90)"
          />
        </g>

        <text
          fill="currentColor"
          fontSize="20"
          fontWeight="600"
          textAnchor="middle"
          x="398"
          y="291"
        >
          87
        </text>

        <rect fill="currentColor" height="6" opacity="0.5" rx="3" width="44" x="444" y="268" />
        <rect fill="currentColor" height="5" opacity="0.2" rx="2.5" width="34" x="444" y="282" />
      </g>
    </svg>
  );
}
