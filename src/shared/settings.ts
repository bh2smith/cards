export interface Settings {
  reduceMotion: boolean;
  confirmNewGame: boolean;
  lightTheme: boolean;
}

const DEFAULTS: Settings = {
  reduceMotion: false,
  confirmNewGame: false,
  lightTheme: false,
};

const STORAGE_KEY = "cardroom:settings";

let cache: Settings | null = null;

function systemPrefersLight(): boolean {
  return window.matchMedia("(prefers-color-scheme: light)").matches;
}

function load(): Settings {
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      cache = { ...DEFAULTS, ...parsed };
      return cache!;
    }
  } catch {
    // fall through to defaults
  }
  cache = { ...DEFAULTS, lightTheme: systemPrefersLight() };
  return cache;
}

function persist(): void {
  if (!cache) return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cache));
  } catch {
    // ignore quota / privacy mode failures
  }
}

export function getSettings(): Readonly<Settings> {
  return load();
}

export function getSetting<K extends keyof Settings>(key: K): Settings[K] {
  return load()[key];
}

export function setSetting<K extends keyof Settings>(
  key: K,
  value: Settings[K],
): void {
  const s = load();
  s[key] = value;
  persist();
  applySettings();
  emitChange();
}

const listeners = new Set<(s: Readonly<Settings>) => void>();

export function onSettingsChange(
  listener: (s: Readonly<Settings>) => void,
): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function emitChange(): void {
  const s = getSettings();
  for (const fn of listeners) fn(s);
}

export function applySettings(): void {
  const s = load();
  document.body.classList.toggle("reduce-motion", s.reduceMotion);
  document.body.classList.toggle("light-theme", s.lightTheme);
}

export function confirmIfEnabled(message: string, action: () => void): void {
  if (!getSetting("confirmNewGame")) {
    action();
    return;
  }
  if (window.confirm(message)) action();
}
