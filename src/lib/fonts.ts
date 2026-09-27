/**
 * The two cuts the site uses: Wix Madefor Display Bold and Wix Madefor Text Regular.
 * Declared here (not with Fontsource's per-subset CSS, which omits unicode-range) so browsers fetch
 * Latin Extended only when a page contains those characters. The Latin files are preloaded.
 */
import displayLatin from '@fontsource/wix-madefor-display/files/wix-madefor-display-latin-700-normal.woff2?url';
import displayLatinExt from '@fontsource/wix-madefor-display/files/wix-madefor-display-latin-ext-700-normal.woff2?url';
import textLatin from '@fontsource/wix-madefor-text/files/wix-madefor-text-latin-400-normal.woff2?url';
import textLatinExt from '@fontsource/wix-madefor-text/files/wix-madefor-text-latin-ext-400-normal.woff2?url';

const LATIN =
  'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD';
const LATIN_EXT =
  'U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF';

const face = (family: string, weight: number, src: string, range: string) =>
  `@font-face{font-family:'${family}';font-style:normal;font-weight:${weight};font-display:swap;src:url(${src}) format('woff2');unicode-range:${range}}`;

export const fontFaceCss = [
  face('Wix Madefor Display', 700, displayLatin, LATIN),
  face('Wix Madefor Display', 700, displayLatinExt, LATIN_EXT),
  face('Wix Madefor Text', 400, textLatin, LATIN),
  face('Wix Madefor Text', 400, textLatinExt, LATIN_EXT),
].join('');

export const preloadFonts = [displayLatin, textLatin];
