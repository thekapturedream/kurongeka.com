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

export function initClickTracking(): void {
  document.addEventListener('click', (event) => {
    const target = event.target instanceof Element ? event.target.closest<HTMLElement>('[data-track]') : null;
    const name = target?.dataset['track'];
    if (name) track(name, { path: location.pathname });
  });
}
