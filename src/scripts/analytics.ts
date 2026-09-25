/**
 * First-party event layer. No third-party tracker is loaded by default.
 * Events are pushed to `window.dataLayer` (for a consented tag manager, if one is added later)
 * and dispatched as `kurongeka:track` DOM events.
 */
type Params = Record<string, string | number | boolean>;

declare global {
  interface Window {
    dataLayer?: unknown[];
  }
}

export function track(event: string, params: Params = {}): void {
  const payload = { event, ...params };
  if (Array.isArray(window.dataLayer)) window.dataLayer.push(payload);
  window.dispatchEvent(new CustomEvent('kurongeka:track', { detail: payload }));
}

/** Server-rendered outcomes (a sent enquiry, a finished tool run) mark themselves with data-track-view. */
export function initViewTracking(): void {
  document.querySelectorAll<HTMLElement>('[data-track-view]').forEach((el) => {
    const name = el.dataset['trackView'];
    if (!name) return;
    const params: Params = { path: location.pathname };
    for (const [key, value] of Object.entries(el.dataset)) {
      if (key.startsWith('trackParam') && value) params[key.slice('trackParam'.length).toLowerCase()] = value;
    }
    track(name, params);
  });
}

export function initClickTracking(): void {
  document.addEventListener('click', (event) => {
    const target = event.target instanceof Element ? event.target.closest<HTMLElement>('[data-track]') : null;
    const name = target?.dataset['track'];
    if (name) track(name, { path: location.pathname });
  });
}
