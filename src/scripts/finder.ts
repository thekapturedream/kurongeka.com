import { KIND_LABEL, search, type SearchEntry, type SearchResult } from '@/lib/domain/search';
import { track } from './analytics';

const MAX_RESULTS = 6;

/** Instant suggestions for every [data-finder] form. The form still submits to /find without this. */
export function initFinders(): void {
  document.querySelectorAll<HTMLFormElement>('form[data-finder]').forEach((form) => {
    if (form.dataset['finderReady']) return;
    form.dataset['finderReady'] = 'true';
    setup(form);
  });
}

function readIndex(form: HTMLFormElement): SearchEntry[] {
  try {
    const raw = form.querySelector('script[data-finder-index]')?.textContent ?? '[]';
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as SearchEntry[]) : [];
  } catch {
    return [];
  }
}

function setup(form: HTMLFormElement): void {
  const input = form.querySelector<HTMLInputElement>('[data-finder-input]');
  const panel = form.querySelector<HTMLElement>('[data-finder-panel]');
  const status = form.querySelector<HTMLElement>('[data-finder-status]');
  if (!input || !panel) return;
  const index = readIndex(form);

  const links = () => Array.from(panel.querySelectorAll<HTMLAnchorElement>('a'));

  const close = () => {
    panel.hidden = true;
    input.setAttribute('aria-expanded', 'false');
  };

  const open = () => {
    panel.hidden = false;
    input.setAttribute('aria-expanded', 'true');
  };

  const resultLink = (result: SearchResult): HTMLAnchorElement => {
    const a = document.createElement('a');
    a.className = 'finder-result';
    a.href = result.href;
    const title = document.createElement('span');
    title.className = 'finder-result-title';
    title.textContent = result.title;
    const meta = document.createElement('span');
    meta.className = 'finder-result-meta';
    meta.textContent = [KIND_LABEL[result.kind], result.meta].filter(Boolean).join(' · ');
    a.append(title, meta);
    a.addEventListener('click', () => track('search_select', { query: input.value.trim(), target: result.href }));
    return a;
  };

  const render = () => {
    const query = input.value.trim();
    panel.replaceChildren();
    if (!query) {
      close();
      if (status) status.textContent = '';
      return;
    }
    const results = search(index, query, MAX_RESULTS);
    if (results.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'finder-empty';
      empty.append('No match yet. ');
      const help = document.createElement('a');
      help.href = '/check';
      help.textContent = 'Take the free check';
      empty.append(help, ' and we will point you the right way.');
      panel.append(empty);
    } else {
      const list = document.createElement('ul');
      for (const result of results) {
        const li = document.createElement('li');
        li.append(resultLink(result));
        list.append(li);
      }
      panel.append(list);
    }
    const all = document.createElement('a');
    all.className = 'finder-all';
    all.href = `/find?q=${encodeURIComponent(query)}`;
    all.textContent = `See everything for “${query}”`;
    panel.append(all);
    if (status) status.textContent = results.length === 1 ? '1 result' : `${results.length} results`;
    open();
  };

  // Returning to the box reopens its suggestions, except when Escape just closed them.
  let dismissed = false;

  input.setAttribute('aria-expanded', 'false');
  input.addEventListener('input', () => {
    dismissed = false;
    render();
  });
  input.addEventListener('focus', () => {
    if (!dismissed && input.value.trim()) render();
  });

  // Arrow keys move between suggestions; Escape returns to the box.
  form.addEventListener('keydown', (event) => {
    if (panel.hidden) return;
    const items = links();
    const current = items.indexOf(document.activeElement as HTMLAnchorElement);
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      items[Math.min(current + 1, items.length - 1)]?.focus();
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (current <= 0) input.focus();
      else items[current - 1]?.focus();
    } else if (event.key === 'Escape') {
      dismissed = true;
      close();
      input.focus();
    }
  });

  form.addEventListener('focusout', (event) => {
    const next = event.relatedTarget;
    if (!(next instanceof Node) || !form.contains(next)) close();
  });

  document.addEventListener('pointerdown', (event) => {
    if (event.target instanceof Node && !form.contains(event.target)) close();
  });

  form.addEventListener('submit', (event) => {
    const query = input.value.trim();
    if (!query) {
      event.preventDefault();
      input.focus();
      return;
    }
    track('search', { query });
  });
}
