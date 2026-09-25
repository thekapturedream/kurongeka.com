import { media } from '@wix/sdk';

/** Resolves a CMS image value (wix:image:// URI or plain URL) to a sized, CDN-served URL. */
export function imageUrl(value: unknown, width: number, height: number): string | null {
  if (typeof value !== 'string' || value.length === 0) return null;
  if (value.startsWith('wix:image://')) {
    try {
      return media.getScaledToFillImageUrl(value, width, height, {});
    } catch {
      return null;
    }
  }
  return /^https:\/\//.test(value) ? value : null;
}
