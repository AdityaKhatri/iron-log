/**
 * RaiseThatBar logo — barbell + heartbeat mark from the RTB brand.
 *
 * Defaults to CSS variables so colors adapt to the active theme.
 */

interface LogoMarkProps {
  size?: number;
  accent?: string;
  fg?: string;
}

export function LogoMark({ size = 24, accent = 'var(--fg)', fg = 'var(--fg-dim)' }: LogoMarkProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="20 50 160 110"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <g transform="rotate(-11 100 100)">
        <polyline
          points="30,100 78,100 88,100 93,114 100,69 108,126 114,100 122,100 170,100"
          fill="none"
          stroke={accent}
          strokeWidth="9"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        <rect x="42" y="62" width="16" height="76" rx="2" fill={fg} />
        <rect x="60" y="74" width="12" height="52" rx="2" fill={fg} />
        <rect x="128" y="74" width="12" height="52" rx="2" fill={fg} />
        <rect x="142" y="62" width="16" height="76" rx="2" fill={fg} />
      </g>
    </svg>
  );
}

interface LogoFullProps {
  markSize?: number;
  accent?: string;
  fg?: string;
  textColor?: string;
}

export function LogoFull({ markSize = 40, accent = 'var(--accent)', fg = 'var(--fg-dim)', textColor = 'var(--fg)' }: LogoFullProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: markSize * 0.3 }}>
      <LogoMark size={markSize} accent={accent} fg={fg} />
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: markSize * 0.05 }}>
        <span style={{
          fontFamily: "'JetBrains Mono', var(--mono)",
          fontSize: markSize * 0.2,
          fontWeight: 600,
          letterSpacing: '0.4em',
          textTransform: 'uppercase',
          color: textColor,
          userSelect: 'none',
        }}>
          RAISE THAT
        </span>
        <span style={{
          fontFamily: "'Space Grotesk', var(--mono)",
          fontSize: markSize * 0.65,
          fontWeight: 700,
          letterSpacing: '-0.04em',
          color: accent,
          userSelect: 'none',
          lineHeight: 1,
        }}>
          BAR
        </span>
      </div>
    </div>
  );
}
