/**
 * Colour maths for the brand colours tool: parsing, WCAG 2.2 contrast, and palette derivation.
 * Pure functions, shared by the browser tool and unit tests.
 */

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

export interface Palette {
  ink: string;
  accent: string;
  surface: string;
  muted: string;
}

export interface NamedPalette extends Palette {
  name: string;
}

/** Starting palettes, carried over from the original Kurongeka portal. */
export const PRESETS: readonly NamedPalette[] = [
  { name: 'Sunburst', ink: '#0A0A0A', accent: '#F5C518', surface: '#FFFFFF', muted: '#1F1F1F' },
  { name: 'Northern Lights', ink: '#0E2A3F', accent: '#7BD3EA', surface: '#F0F9FF', muted: '#1F4A6B' },
  { name: 'Sahara Sand', ink: '#3A2C20', accent: '#E8A84A', surface: '#FBF4E8', muted: '#7A5530' },
  { name: 'Ocean Calm', ink: '#0C2A3D', accent: '#00B4D8', surface: '#F0FAFB', muted: '#0E5A6F' },
  { name: 'Forest Floor', ink: '#1B2D1F', accent: '#7A9D54', surface: '#F4F8F0', muted: '#3D5A40' },
  { name: 'Midnight Tech', ink: '#070914', accent: '#5E5CE6', surface: '#F5F6FF', muted: '#1E1F36' },
  { name: 'Citrus Pop', ink: '#1F1500', accent: '#FF7A00', surface: '#FFF8EB', muted: '#7A4D00' },
  { name: 'Playa Sunset', ink: '#2B0E1A', accent: '#FF4D6D', surface: '#FFF1F4', muted: '#7A1F35' },
  { name: 'Mono Ink', ink: '#0A0A0A', accent: '#666666', surface: '#FFFFFF', muted: '#222222' },
  { name: 'Berry Studio', ink: '#2D0C2C', accent: '#C2185B', surface: '#FFF3F8', muted: '#5A1F4A' },
];

export function parseHex(input: string): Rgb | null {
  const value = input.trim().replace(/^#/, '');
  const full = /^[0-9a-f]{3}$/i.test(value)
    ? value
        .split('')
        .map((c) => c + c)
        .join('')
    : value;
  if (!/^[0-9a-f]{6}$/i.test(full)) return null;
  return {
    r: parseInt(full.slice(0, 2), 16),
    g: parseInt(full.slice(2, 4), 16),
    b: parseInt(full.slice(4, 6), 16),
  };
}

export function toHex({ r, g, b }: Rgb): string {
  const part = (n: number) => Math.round(Math.min(255, Math.max(0, n))).toString(16).padStart(2, '0');
  return `#${part(r)}${part(g)}${part(b)}`.toUpperCase();
}

export function normaliseHex(input: string): string | null {
  const rgb = parseHex(input);
  return rgb ? toHex(rgb) : null;
}

/** WCAG relative luminance. */
export function luminance({ r, g, b }: Rgb): number {
  const channel = (c: number) => {
    const s = c / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** WCAG contrast ratio between two hex colours, from 1 to 21. */
export function contrastRatio(a: string, b: string): number {
  const ra = parseHex(a);
  const rb = parseHex(b);
  if (!ra || !rb) return 1;
  const [hi, lo] = [luminance(ra), luminance(rb)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

export type ContrastGrade = 'AAA' | 'AA' | 'Large text only' | 'Fails';

/** Grade for normal-size text (WCAG 2.2: AA 4.5:1, AAA 7:1, large text 3:1). */
export function gradeFor(ratio: number): ContrastGrade {
  if (ratio >= 7) return 'AAA';
  if (ratio >= 4.5) return 'AA';
  if (ratio >= 3) return 'Large text only';
  return 'Fails';
}

interface Hsl {
  h: number;
  s: number;
  l: number;
}

function toHsl({ r, g, b }: Rgb): Hsl {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === rn) h = (gn - bn) / d + (gn < bn ? 6 : 0);
  else if (max === gn) h = (bn - rn) / d + 2;
  else h = (rn - gn) / d + 4;
  return { h: h * 60, s, l };
}

function fromHsl({ h, s, l }: Hsl): Rgb {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  const [r, g, b] =
    h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return { r: (r + m) * 255, g: (g + m) * 255, b: (b + m) * 255 };
}

/**
 * Builds a four-colour system around one brand colour: a near-black ink and a soft surface
 * in the same hue, and a muted tone for secondary text.
 */
export function derivePalette(accentHex: string): Palette | null {
  const rgb = parseHex(accentHex);
  if (!rgb) return null;
  const { h, s } = toHsl(rgb);
  return {
    accent: toHex(rgb),
    ink: toHex(fromHsl({ h, s: Math.min(s, 0.45), l: 0.1 })),
    surface: toHex(fromHsl({ h, s: Math.min(s, 0.6), l: 0.975 })),
    muted: toHex(fromHsl({ h, s: Math.min(s, 0.25), l: 0.36 })),
  };
}

/** The better of white or the palette's ink as text on a coloured fill. */
export function textOn(fill: string, ink: string): string {
  return contrastRatio(fill, '#FFFFFF') >= contrastRatio(fill, ink) ? '#FFFFFF' : ink;
}

export interface ContrastCheck {
  use: string;
  foreground: string;
  background: string;
  ratio: number;
  grade: ContrastGrade;
}

export function paletteChecks(p: Palette): ContrastCheck[] {
  const buttonText = textOn(p.accent, p.ink);
  const pairs: [string, string, string][] = [
    ['Body text on your background', p.ink, p.surface],
    ['Secondary text on your background', p.muted, p.surface],
    ['Button text on your brand colour', buttonText, p.accent],
    ['Brand colour on dark sections', p.accent, p.ink],
    ['Brand colour as text on your background', p.accent, p.surface],
  ];
  return pairs.map(([use, foreground, background]) => {
    const ratio = contrastRatio(foreground, background);
    return { use, foreground, background, ratio, grade: gradeFor(ratio) };
  });
}

export function cssVariables(p: Palette): string {
  return [
    ':root {',
    `  --brand-ink: ${p.ink};`,
    `  --brand-accent: ${p.accent};`,
    `  --brand-surface: ${p.surface};`,
    `  --brand-muted: ${p.muted};`,
    `  --brand-on-accent: ${textOn(p.accent, p.ink)};`,
    '}',
  ].join('\n');
}
