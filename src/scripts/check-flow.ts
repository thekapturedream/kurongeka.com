import { track } from './analytics';

/**
 * Turns the all-questions check form into a one-question-at-a-time flow.
 * Without JavaScript the form still works as a normal POST to /api/check.
 */

const STORAGE_KEY = 'kurongeka-check-v1';

type Values = Record<string, string | string[] | boolean>;

interface ApiResponse {
  ok: boolean;
  resultUrl?: string;
  score?: number;
  fieldErrors?: Record<string, string>;
}

const storage = {
  read(): { index: number; values: Values } | null {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      return raw ? (JSON.parse(raw) as { index: number; values: Values }) : null;
    } catch {
      return null;
    }
  },
  write(index: number, values: Values) {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ index, values }));
    } catch {
      /* Storage unavailable (private mode, blocked). The flow still works. */
    }
  },
  clear() {
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  },
};

export function initCheckFlow(form: HTMLFormElement): void {
  const steps = Array.from(form.querySelectorAll<HTMLFieldSetElement>('[data-step]'));
  const progress = form.querySelector<HTMLElement>('[data-progress]');
  const bar = form.querySelector<HTMLElement>('[data-progress-bar]');
  const progressLabel = form.querySelector<HTMLElement>('[data-progress-label]');
  const back = form.querySelector<HTMLButtonElement>('[data-back]');
  const next = form.querySelector<HTMLButtonElement>('[data-next]');
  const submit = form.querySelector<HTMLButtonElement>('[data-submit]');
  const submitLabel = form.querySelector<HTMLElement>('[data-submit-label]');
  const formError = form.querySelector<HTMLElement>('[data-form-error]');
  const formErrorText = form.querySelector<HTMLElement>('[data-form-error-text]');
  const formErrorWhatsapp = form.querySelector<HTMLAnchorElement>('[data-form-error-whatsapp]');
  if (!steps.length || !back || !next || !submit) return;

  let index = 0;
  let started = false;

  const control = (name: string) => form.elements.namedItem(name);

  function serialize(): Values {
    const data = new FormData(form);
    const text = (key: string) => String(data.get(key) ?? '').trim();
    return {
      businessType: text('businessType'),
      stage: text('stage'),
      website: text('website'),
      maps: text('maps'),
      payments: data.getAll('payments').map(String),
      brand: text('brand'),
      priority: text('priority'),
      name: text('name'),
      business: text('business'),
      country: text('country'),
      phone: text('phone'),
      email: text('email'),
      contactPreference: text('contactPreference') || 'whatsapp',
      subscribe: data.get('subscribe') === 'true',
      interest: text('interest'),
      company_website: text('company_website'),
    };
  }

  function restore(values: Values) {
    for (const [key, value] of Object.entries(values)) {
      if (key === 'company_website') continue;
      const el = control(key);
      if (!el) continue;
      if (el instanceof RadioNodeList) {
        const wanted = Array.isArray(value) ? value : [String(value)];
        el.forEach((node) => {
          if (node instanceof HTMLInputElement) node.checked = wanted.includes(node.value);
        });
      } else if (el instanceof HTMLInputElement && el.type === 'checkbox') {
        el.checked = Array.isArray(value) ? value.includes(el.value) : value === true || value === el.value;
      } else if (el instanceof HTMLInputElement || el instanceof HTMLSelectElement) {
        if (typeof value === 'string' && value) el.value = value;
      }
    }
  }

  function setError(name: string, message: string | null) {
    const target = form.querySelector<HTMLElement>(`[data-error-for="${name}"]`);
    if (target) {
      target.textContent = message ?? '';
      target.hidden = !message;
    }
    const el = control(name);
    if (el instanceof HTMLInputElement || el instanceof HTMLSelectElement) {
      el.setAttribute('aria-invalid', message ? 'true' : 'false');
    }
  }

  function validateStep(i: number): boolean {
    const step = steps[i];
    if (!step) return true;
    const name = step.dataset['step'] ?? '';
    const type = step.dataset['type'];
    const values = serialize();

    if (type === 'single') {
      const ok = Boolean(values[name]);
      setError(name, ok ? null : 'Choose one to continue.');
      if (!ok) step.querySelector<HTMLInputElement>('input')?.focus();
      return ok;
    }

    if (type === 'multi') {
      const ok = Array.isArray(values[name]) && (values[name] as string[]).length > 0;
      setError(name, ok ? null : 'Choose at least one to continue.');
      if (!ok) step.querySelector<HTMLInputElement>('input')?.focus();
      return ok;
    }

    const errors: Record<string, string | null> = {
      name: values['name'] ? null : 'Enter your name.',
      business: values['business'] ? null : 'Enter your business name.',
      phone: String(values['phone']).replace(/\D/g, '').length >= 7 ? null : 'Enter your WhatsApp number.',
      email:
        values['email'] && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(values['email']))
          ? 'Enter a valid email address.'
          : values['contactPreference'] === 'email' && !values['email']
            ? 'Add an email address so we can reply by email.'
            : null,
    };
    let firstInvalid: string | null = null;
    for (const [field, message] of Object.entries(errors)) {
      setError(field, message);
      if (message && !firstInvalid) firstInvalid = field;
    }
    if (firstInvalid) {
      const el = control(firstInvalid);
      if (el instanceof HTMLElement) el.focus();
      return false;
    }
    return true;
  }

  function show(i: number, moveFocus = true) {
    index = Math.max(0, Math.min(i, steps.length - 1));
    steps.forEach((step, n) => step.classList.toggle('is-active', n === index));
    const last = index === steps.length - 1;
    back!.hidden = index === 0;
    next!.hidden = last;
    submit!.hidden = !last;
    bar?.style.setProperty('--progress', `${((index + 1) / steps.length) * 100}%`);
    if (progressLabel) progressLabel.textContent = last ? 'Last step' : `Question ${index + 1} of ${steps.length}`;
    if (moveFocus) {
      const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      form.scrollIntoView({ block: 'start', behavior: reduce ? 'auto' : 'smooth' });
      steps[index]?.querySelector<HTMLElement>('legend')?.focus({ preventScroll: true });
    }
    storage.write(index, serialize());
  }

  function goNext() {
    if (!validateStep(index)) return;
    if (!started) {
      started = true;
      track('check_start');
    }
    track('check_step', { step: steps[index]?.dataset['step'] ?? String(index) });
    show(index + 1);
  }

  function summaryMessage(values: Values): string {
    const labelOf = (name: string) => {
      const checked = Array.from(form.querySelectorAll<HTMLInputElement>(`input[name="${name}"]:checked`));
      return checked.map((c) => c.closest('label')?.textContent?.trim() ?? c.value).join(', ');
    };
    return [
      'Hi Kurongeka, my check did not send. My answers:',
      `Name: ${values['name']}`,
      `Business: ${values['business']} (${labelOf('businessType')})`,
      `Stage: ${labelOf('stage')}`,
      `Website: ${labelOf('website')}`,
      `Google Maps: ${labelOf('maps')}`,
      `Payments: ${labelOf('payments')}`,
      `Brand: ${labelOf('brand')}`,
      `Priority: ${labelOf('priority')}`,
    ].join('\n');
  }

  function setBusy(busy: boolean) {
    submit!.setAttribute('aria-busy', String(busy));
    submit!.disabled = busy;
    if (submitLabel) submitLabel.textContent = busy ? 'Scoring your answers' : 'Get my score';
  }

  function showServerErrors(fieldErrors: Record<string, string>) {
    const fields = Object.keys(fieldErrors);
    const stepIndex = steps.findIndex((step) =>
      fields.some((f) => step.dataset['step'] === f || step.querySelector(`[name="${f}"]`)),
    );
    if (stepIndex >= 0) show(stepIndex);
    for (const [field, message] of Object.entries(fieldErrors)) setError(field, message);
  }

  // Enhance.
  form.classList.add('is-enhanced');
  if (progress) progress.hidden = false;
  const saved = storage.read();
  if (saved) restore(saved.values);
  show(saved ? saved.index : 0, false);

  // Deliberately no auto-advance: one explicit Continue per question is predictable
  // for touch, keyboard and screen reader users alike.
  form.addEventListener('change', (event) => {
    const input = event.target;
    if (!(input instanceof HTMLInputElement)) return;
    setError(input.name, null);
    storage.write(index, serialize());
  });

  form.addEventListener('input', (event) => {
    const input = event.target;
    if (input instanceof HTMLInputElement && input.getAttribute('aria-invalid') === 'true') setError(input.name, null);
  });

  next.addEventListener('click', goNext);
  back.addEventListener('click', () => show(index - 1));

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (index < steps.length - 1) {
      goNext();
      return;
    }
    if (!validateStep(index)) return;

    const values = serialize();
    if (formError) formError.hidden = true;
    setBusy(true);
    track('check_submit', { businessType: String(values['businessType']), priority: String(values['priority']) });

    try {
      const response = await fetch(form.action, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(values),
      });
      const data = (await response.json().catch(() => null)) as ApiResponse | null;

      if (response.ok && data?.ok && data.resultUrl) {
        track('check_complete', { score: data.score ?? 0 });
        storage.clear();
        window.location.assign(data.resultUrl);
        return;
      }
      if (response.status === 400 && data?.fieldErrors) {
        showServerErrors(data.fieldErrors);
        setBusy(false);
        return;
      }
      throw new Error(`Unexpected response ${response.status}`);
    } catch {
      track('check_error');
      if (formErrorText) formErrorText.textContent = 'We could not send your answers. Your answers are saved on this page.';
      if (formErrorWhatsapp) {
        // encodeURIComponent (not URLSearchParams) so spaces are %20, which WhatsApp decodes reliably.
        const base = formErrorWhatsapp.href.split('?')[0];
        formErrorWhatsapp.href = `${base}?text=${encodeURIComponent(summaryMessage(values))}`;
      }
      if (formError) formError.hidden = false;
      setBusy(false);
    }
  });
}
