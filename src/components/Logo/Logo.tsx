/**
 * IronLog logo — barbell glyph extracted from the brand file.
 *
 * Original shapes normalized to viewBox "0 0 140 112" (offset -30,-44 from source).
 * Colors use CSS variables so they adapt to context (e.g. monochrome use).
 */

interface LogoMarkProps {
  /** Height of the mark in px. Width scales proportionally (140:112 ≈ 5:4). */
  size?: number;
  /** Override fg color (plates). Defaults to var(--fg). */
  fg?: string;
  /** Override dim color (collars). Defaults to var(--fg-mute). */
  dim?: string;
  /** Override accent color (bar). Defaults to var(--accent). */
  accent?: string;
}

export function LogoMark({ size = 24, fg = 'var(--fg)', dim = 'var(--fg-mute)', accent = 'var(--accent)' }: LogoMarkProps) {
  const w = (size * 140) / 112;
  return (
    <svg
      width={w}
      height={size}
      viewBox="0 0 140 112"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      {/* Outer left plate */}
      <rect x="0"   y="14" width="14" height="84"  fill={fg} />
      {/* Inner left plate */}
      <rect x="20"  y="0"  width="14" height="112" fill={fg} />
      {/* Left collar */}
      <rect x="38"  y="34" width="8"  height="44"  fill={dim} />
      {/* Barbell bar — accent color */}
      <rect x="48"  y="48" width="44" height="16"  fill={accent} />
      {/* Right collar */}
      <rect x="94"  y="34" width="8"  height="44"  fill={dim} />
      {/* Inner right plate */}
      <rect x="106" y="0"  width="14" height="112" fill={fg} />
      {/* Outer right plate */}
      <rect x="126" y="14" width="14" height="84"  fill={fg} />
    </svg>
  );
}

interface LogoFullProps {
  /** Height of the barbell mark portion. Text scales accordingly. */
  markSize?: number;
  fg?: string;
  dim?: string;
  accent?: string;
  textColor?: string;
}

/** Barbell mark + "IRON LOG" wordmark stacked vertically. */
export function LogoFull({ markSize = 40, fg = 'var(--fg)', dim = 'var(--fg-mute)', accent = 'var(--accent)', textColor = 'var(--fg-dim)' }: LogoFullProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: markSize * 0.3 }}>
      <LogoMark size={markSize} fg={fg} dim={dim} accent={accent} />
      <span style={{
        fontFamily: 'var(--mono)',
        fontSize: markSize * 0.28,
        fontWeight: 700,
        letterSpacing: '0.3em',
        textTransform: 'uppercase',
        color: textColor,
        userSelect: 'none',
      }}>
        IRON LOG
      </span>
    </div>
  );
}
