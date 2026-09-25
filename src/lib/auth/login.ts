import type { AstroCookies } from 'astro';
import { createClient, LoginState, OAuthStrategy, type OauthData, type StateMachine } from '@wix/sdk';
import { WIX_CLIENT_ID } from 'astro:env/server';
import { site } from '@/config/site';
import { clearSession, cookieOptions, decodeCookie, encodeCookie, memberSession, saveSession } from './session';

/**
 * Custom sign-in, sign-up and verification for Wix Members.
 * Credentials go to Wix from our server; Wix returns a session token that we exchange for
 * member tokens (OAuth with PKCE), then keep in an HTTP-only cookie.
 */

const OAUTH_COOKIE = 'kg_oauth';
const VERIFY_COOKIE = 'kg_verify';
const TEN_MINUTES = 10 * 60;
const FIFTEEN_MINUTES = 15 * 60;

export type AuthError =
  | 'invalid-credentials'
  | 'email-exists'
  | 'invalid-email'
  | 'reset-required'
  | 'captcha'
  | 'invalid-code'
  | 'expired'
  | 'unavailable';

export type AuthOutcome =
  | { kind: 'signed-in' }
  | { kind: 'redirect'; url: string }
  | { kind: 'verify' }
  | { kind: 'pending-approval' }
  | { kind: 'error'; error: AuthError };

interface Context {
  cookies: AstroCookies;
  url: URL;
}

function visitorClient() {
  return createClient({ modules: {}, auth: OAuthStrategy({ clientId: WIX_CLIENT_ID }) });
}

type VisitorClient = ReturnType<typeof visitorClient>;

function isLocal(url: URL): boolean {
  return url.hostname === 'localhost' || url.hostname === '127.0.0.1';
}

/** Must match an allowed authorization redirect URI on the Wix headless client exactly. */
export function callbackUri(url: URL): string {
  return isLocal(url) ? `${url.origin}/account/callback` : `${site.url}/account/callback`;
}

export function passwordResetReturnUri(url: URL): string {
  return isLocal(url) ? `${url.origin}/account/password-updated` : `${site.url}/account/password-updated`;
}

/** Follows Wix's authorization redirects on the server until they reach our callback with a code. */
async function followToCallback(authUrl: string, redirectUri: string): Promise<{ code: string; state: string } | null> {
  let next = authUrl;
  for (let hop = 0; hop < 5; hop++) {
    const response = await fetch(next, { redirect: 'manual', signal: AbortSignal.timeout(8000) });
    await response.body?.cancel().catch(() => undefined);
    const location = response.headers.get('location');
    if (!location) return null;
    const target = new URL(location, next);
    if (target.href.startsWith(redirectUri)) {
      const code = target.searchParams.get('code');
      const state = target.searchParams.get('state');
      return code && state ? { code, state } : null;
    }
    next = target.href;
  }
  return null;
}

async function finishWithSessionToken(client: VisitorClient, sessionToken: string, ctx: Context): Promise<AuthOutcome> {
  const redirectUri = callbackUri(ctx.url);
  const oauthData = client.auth.generateOAuthData(redirectUri);
  // `sessionToken` is supported at runtime but missing from the SDK's option type.
  const options = { prompt: 'none', responseMode: 'query', sessionToken } as Parameters<typeof client.auth.getAuthUrl>[1];
  const { authUrl } = await client.auth.getAuthUrl(oauthData, options);

  try {
    const result = await followToCallback(authUrl, redirectUri);
    if (result && result.state === oauthData.state) {
      const tokens = await client.auth.getMemberTokens(result.code, result.state, oauthData);
      saveSession(ctx.cookies, ctx.url, tokens);
      return { kind: 'signed-in' };
    }
  } catch (error) {
    console.warn('[auth] server-side token exchange failed, using browser redirect', error instanceof Error ? error.message : error);
  }

  // Fall back to finishing the exchange in the browser via /account/callback.
  ctx.cookies.set(OAUTH_COOKIE, encodeCookie(oauthData), cookieOptions(ctx.url, TEN_MINUTES));
  return { kind: 'redirect', url: authUrl };
}

async function handleState(state: StateMachine, client: VisitorClient, ctx: Context): Promise<AuthOutcome> {
  switch (state.loginState) {
    case LoginState.SUCCESS:
      return finishWithSessionToken(client, state.data.sessionToken, ctx);
    case LoginState.EMAIL_VERIFICATION_REQUIRED:
      ctx.cookies.set(VERIFY_COOKIE, encodeCookie({ t: state.data.stateToken }), cookieOptions(ctx.url, FIFTEEN_MINUTES));
      return { kind: 'verify' };
    case LoginState.OWNER_APPROVAL_REQUIRED:
      return { kind: 'pending-approval' };
    case LoginState.USER_CAPTCHA_REQUIRED:
    case LoginState.SILENT_CAPTCHA_REQUIRED:
      return { kind: 'error', error: 'captcha' };
    case LoginState.FAILURE:
      switch (state.errorCode) {
        case 'invalidEmail':
        case 'invalidPassword':
          return { kind: 'error', error: 'invalid-credentials' };
        case 'emailAlreadyExists':
          return { kind: 'error', error: 'email-exists' };
        case 'resetPassword':
          return { kind: 'error', error: 'reset-required' };
        case 'missingCaptchaToken':
        case 'invalidCaptchaToken':
          return { kind: 'error', error: 'captcha' };
        default:
          return { kind: 'error', error: 'unavailable' };
      }
    default:
      return { kind: 'error', error: 'unavailable' };
  }
}

export async function signIn(email: string, password: string, ctx: Context): Promise<AuthOutcome> {
  try {
    const client = visitorClient();
    const state = await client.auth.login({ email, password });
    return await handleState(state, client, ctx);
  } catch (error) {
    console.error('[auth] sign in failed', error instanceof Error ? error.message : error);
    return { kind: 'error', error: 'unavailable' };
  }
}

export interface SignUpInput {
  email: string;
  password: string;
  firstName: string;
  lastName?: string | undefined;
}

export async function signUp(input: SignUpInput, ctx: Context): Promise<AuthOutcome> {
  try {
    const client = visitorClient();
    const state = await client.auth.register({
      email: input.email,
      password: input.password,
      profile: { firstName: input.firstName, ...(input.lastName ? { lastName: input.lastName } : {}) },
    });
    if (state.loginState === LoginState.FAILURE && state.errorCode === 'invalidEmail') {
      return { kind: 'error', error: 'invalid-email' };
    }
    return await handleState(state, client, ctx);
  } catch (error) {
    console.error('[auth] sign up failed', error instanceof Error ? error.message : error);
    return { kind: 'error', error: 'unavailable' };
  }
}

export function hasPendingVerification(cookies: AstroCookies): boolean {
  return decodeCookie<{ t: string }>(cookies.get(VERIFY_COOKIE)?.value)?.t !== undefined;
}

export async function verifyEmailCode(code: string, ctx: Context): Promise<AuthOutcome> {
  const pending = decodeCookie<{ t: string }>(ctx.cookies.get(VERIFY_COOKIE)?.value);
  if (!pending?.t) return { kind: 'error', error: 'expired' };
  try {
    const client = visitorClient();
    const state = await client.auth.processVerification(
      { verificationCode: code },
      { loginState: LoginState.EMAIL_VERIFICATION_REQUIRED, data: { stateToken: pending.t } },
    );
    if (state.loginState === LoginState.FAILURE) return { kind: 'error', error: 'invalid-code' };
    const outcome = await handleState(state, client, ctx);
    if (outcome.kind === 'signed-in' || outcome.kind === 'redirect') ctx.cookies.delete(VERIFY_COOKIE, { path: '/' });
    return outcome;
  } catch {
    return { kind: 'error', error: 'invalid-code' };
  }
}

/** Completes the browser-side fallback: Wix sent the member back to /account/callback with a code. */
export async function completeCallback(ctx: Context): Promise<boolean> {
  const oauthData = decodeCookie<OauthData>(ctx.cookies.get(OAUTH_COOKIE)?.value);
  ctx.cookies.delete(OAUTH_COOKIE, { path: '/' });
  const code = ctx.url.searchParams.get('code');
  const state = ctx.url.searchParams.get('state');
  if (!oauthData || !code || !state || state !== oauthData.state) return false;
  try {
    const tokens = await visitorClient().auth.getMemberTokens(code, state, oauthData);
    saveSession(ctx.cookies, ctx.url, tokens);
    return true;
  } catch {
    return false;
  }
}

/** Always resolves, so the page never reveals whether an email has an account. */
export async function requestPasswordReset(email: string, url: URL): Promise<void> {
  try {
    await visitorClient().auth.sendPasswordResetEmail(email, passwordResetReturnUri(url));
  } catch (error) {
    console.warn('[auth] password reset request failed', error instanceof Error ? error.message : error);
  }
}

/** Ends the session here and at Wix. Returns where to send the browser next. */
export async function signOut(ctx: Context): Promise<string> {
  const session = memberSession(ctx.cookies, ctx.url);
  clearSession(ctx.cookies);
  if (!session || isLocal(ctx.url)) return '/';
  try {
    const { logoutUrl } = await session.client.auth.logout(`${site.url}/`);
    return logoutUrl;
  } catch {
    return '/';
  }
}
