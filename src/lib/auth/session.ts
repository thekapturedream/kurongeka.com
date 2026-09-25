import type { AstroCookies } from 'astro';
import { createClient, OAuthStrategy, TokenRole, type Tokens } from '@wix/sdk';
import { items } from '@wix/data';
import { members } from '@wix/members';
import { orders } from '@wix/pricing-plans';
import { WIX_CLIENT_ID } from 'astro:env/server';

/**
 * Member sessions for the client portal.
 * Wix issues the tokens; we keep them in an HTTP-only cookie, so browser scripts never see them.
 */

const SESSION_COOKIE = 'kg_session';
const THIRTY_DAYS = 60 * 60 * 24 * 30;

interface StoredTokens {
  /** access token */
  a: string;
  /** access token expiry, epoch seconds */
  e: number;
  /** refresh token */
  r: string;
}

export function encodeCookie(value: unknown): string {
  return Buffer.from(JSON.stringify(value), 'utf8').toString('base64url');
}

export function decodeCookie<T>(value: string | undefined): T | null {
  if (!value) return null;
  try {
    return JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as T;
  } catch {
    return null;
  }
}

export function cookieOptions(url: URL, maxAge: number) {
  return {
    httpOnly: true,
    secure: url.protocol === 'https:',
    sameSite: 'lax' as const,
    path: '/',
    maxAge,
  };
}

export function saveSession(cookies: AstroCookies, url: URL, tokens: Tokens): void {
  const stored: StoredTokens = { a: tokens.accessToken.value, e: tokens.accessToken.expiresAt, r: tokens.refreshToken.value };
  cookies.set(SESSION_COOKIE, encodeCookie(stored), cookieOptions(url, THIRTY_DAYS));
}

export function clearSession(cookies: AstroCookies): void {
  cookies.delete(SESSION_COOKIE, { path: '/' });
}

function readSession(cookies: AstroCookies): Tokens | null {
  const stored = decodeCookie<StoredTokens>(cookies.get(SESSION_COOKIE)?.value);
  if (!stored?.r || typeof stored.a !== 'string' || typeof stored.e !== 'number') return null;
  return {
    accessToken: { value: stored.a, expiresAt: stored.e },
    refreshToken: { value: stored.r, role: TokenRole.MEMBER },
  };
}

function createMemberClient(tokens: Tokens) {
  return createClient({
    modules: { members, items, orders },
    auth: OAuthStrategy({ clientId: WIX_CLIENT_ID, tokens }),
  });
}

export type MemberClient = ReturnType<typeof createMemberClient>;

export interface MemberSession {
  client: MemberClient;
  /**
   * Saves renewed tokens, or ends the session if Wix no longer accepts it. Call after using the client.
   * Returns false when the member is no longer signed in.
   */
  persist(): boolean;
}

export function hasSession(cookies: AstroCookies): boolean {
  return readSession(cookies) !== null;
}

export function memberSession(cookies: AstroCookies, url: URL): MemberSession | null {
  const tokens = readSession(cookies);
  if (!tokens) return null;
  const client = createMemberClient(tokens);
  return {
    client,
    persist() {
      const current = client.auth.getTokens();
      // The SDK falls back to an anonymous visitor when a refresh token is no longer valid.
      if (current.refreshToken.role !== TokenRole.MEMBER || !current.refreshToken.value) {
        clearSession(cookies);
        return false;
      }
      if (current.accessToken.value !== tokens.accessToken.value) saveSession(cookies, url, current);
      return true;
    },
  };
}
