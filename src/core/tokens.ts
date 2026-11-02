export const colors = {
  white: "#FFFFFF",
  bg: "#F4F2EC",
  surface: "#FBFAF7",
  ink: "#16181D",
  ink2: "#5B5F6B",
  ink3: "#8A8D97",
  ink3Text: "#666973",
  line: "#E3E0D8",
  accent: "#3F6F63",
  accentSoft: "#DCE8E2",
  accentSoftText: "#2F5A4F",
  mist: "#D9E6DF",
  lilac: "#E4DDF3",
  peach: "#F3E1D3",
  ok: "#7FB59B",
  watch: "#E8C77E",
  watchTint: "#F5EBD3",
  watchText: "#7A5A16",
  out: "#E5A592",
  alertText: "#9A4A33",
  stage: "#EEF1EC",
  emergencyBorder: "#E9C8BC",
  emergencyFill: "#F6E3DC",
  emergencyText: "#9A4A33",
  darkHeading: "#F4F2EC",
  darkAccent: "#A9D6C4",
  darkBody: "#A3A9A6",
  darkDivider: "rgba(233,236,232,.16)",
  bannerText: "#C9CEC9",
} as const;

export const fonts = {
  serif: "'Instrument Serif', 'Mukta', serif",
  sans: "'Geist Variable', 'Geist', 'Mukta', system-ui, sans-serif",
  mono: "'Geist Mono', ui-monospace, monospace",
  devanagari: "'Mukta', 'Geist Variable', sans-serif",
} as const;

export type FontFamilyKey = "serif" | "sans" | "mono";

export interface TypeStyle {
  family: FontFamilyKey;
  weight: number;
  size: number;
  line: number;
  tracking: number;
  mobileSize?: number;
  mobileLine?: number;
  uppercase?: boolean;
  color?: "ink2" | "ink3Text";
}

export const typeScale = {
  "display-xl": { family: "serif", weight: 400, size: 112, line: 104, tracking: -0.035, mobileSize: 56, mobileLine: 56 },
  "display-l": { family: "serif", weight: 400, size: 80, line: 80, tracking: -0.03, mobileSize: 44, mobileLine: 46 },
  h2: { family: "serif", weight: 400, size: 56, line: 60, tracking: -0.025, mobileSize: 36, mobileLine: 40 },
  stat: { family: "serif", weight: 400, size: 40, line: 44, tracking: 0, mobileSize: 32, mobileLine: 36 },
  quote: { family: "serif", weight: 400, size: 24, line: 30, tracking: 0 },
  h3: { family: "sans", weight: 500, size: 20, line: 28, tracking: -0.01 },
  lead: { family: "sans", weight: 400, size: 20, line: 32, tracking: 0, mobileSize: 18, mobileLine: 28, color: "ink2" },
  body: { family: "sans", weight: 400, size: 16, line: 26, tracking: 0, color: "ink2" },
  small: { family: "sans", weight: 400, size: 14, line: 22, tracking: 0, color: "ink2" },
  button: { family: "sans", weight: 500, size: 15, line: 15, tracking: 0 },
  label: { family: "sans", weight: 500, size: 12, line: 16, tracking: 0.08, uppercase: true, color: "ink3Text" },
  data: { family: "mono", weight: 500, size: 14, line: 22, tracking: 0 },
} as const satisfies Record<string, TypeStyle>;

export type TypeToken = keyof typeof typeScale;

export const spacing = [4, 8, 12, 16, 24, 32, 48, 64, 96, 128] as const;

export const radii = {
  pill: 999,
  card: 24,
  panel: 32,
  small: 12,
} as const;

export const shadows = {
  card: "0 1px 0 rgba(22,24,29,.02), 0 24px 48px -24px rgba(22,24,29,.12)",
  input: "0 24px 48px -24px rgba(63,111,99,.28)",
  orb: "0 40px 80px -30px rgba(47,90,79,.45), inset 0 -12px 30px rgba(63,111,99,.12)",
} as const;

export const gradients = {
  orb: "radial-gradient(circle at 38% 32%, #FFFFFF 0%, #EEF4F0 40%, #CFE0D7 75%, #AFCBBF 100%)",
  mark: "radial-gradient(circle at 35% 30%, #fff, #D9E6DF 55%, #9CC2B3)",
} as const;

export const layout = {
  designWidth: 1440,
  container: 1200,
  sideMargin: 120,
  mobileSideMargin: 20,
  gutter: 24,
  mobileGutter: 16,
  sectionPadding: 128,
  mobileSectionPadding: 80,
  mobileBreakpoint: 768,
  patientColumn: 480,
  navHeight: 88,
  stickyNavHeight: 72,
  bannerHeight: 40,
  minTouchTarget: 44,
} as const;

export const motionTokens = {
  ease: [0.22, 1, 0.36, 1] as readonly [number, number, number, number],
  easeCss: "cubic-bezier(.22, 1, .36, 1)",
  hoverMs: 200,
  revealMs: 700,
  revealOffset: 24,
  revealStaggerMs: 80,
  revealThreshold: 0.15,
  orbBreathSeconds: 4,
  orbBreathScale: 1.04,
  glowDriftSeconds: 20,
  glowDriftPx: 24,
  reasoningStepMs: 250,
  numberRollMs: 400,
} as const;

export const focusRing = { width: 2, offset: 2 } as const;

export const elderTypeScale = 1.25;
