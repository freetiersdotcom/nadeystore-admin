// Simple auth store using localStorage
const API_URL_KEY = 'merchant_api_url';
const API_KEY_KEY = 'merchant_api_key';
const THEME_KEY = 'merchant_theme';
const AGENCY_MODE_KEY = 'merchant_agency_mode';

const SESSION_KEY = 'merchant_session';

/**
 * How a person's session travels.
 *  - 'cookie': the API sets an HttpOnly cookie (admin and API on the same registrable
 *    domain, e.g. admin.shop.com + api.shop.com). The token never reaches JavaScript.
 *  - 'bearer' (default): the API returns a session token that is kept in sessionStorage
 *    for this tab and sent as `Authorization: Bearer`. Used on workers.dev / pages.dev,
 *    where the two sites differ, and for local development.
 * Set VITE_AUTH_MODE=cookie in production once both live under the shop's domain.
 */
export const AUTH_MODE: 'cookie' | 'bearer' =
  import.meta.env.VITE_AUTH_MODE === 'cookie' ? 'cookie' : 'bearer';

export type AuthState = {
  apiUrl: string;
  /** Legacy admin access key (agency use). */
  apiKey: string;
  /** Bearer session token of a signed-in person (bearer mode). */
  sessionToken: string;
  /** True when something is stored that could authenticate. Cookie mode has to ask the API. */
  hasCredentials: boolean;
};

function readSession(): string {
  try {
    return sessionStorage.getItem(SESSION_KEY) || '';
  } catch {
    return '';
  }
}

export function getAuth(): AuthState {
  const apiUrl =
    import.meta.env.VITE_API_URL || localStorage.getItem(API_URL_KEY) || '';
  const apiKey = localStorage.getItem(API_KEY_KEY) || '';
  const sessionToken = readSession();
  return {
    apiUrl,
    apiKey,
    sessionToken,
    hasCredentials: Boolean(apiUrl && (apiKey || sessionToken || AUTH_MODE === 'cookie')),
  };
}

/** Remember the API address when it is not fixed by VITE_API_URL. */
export function setApiUrl(apiUrl: string) {
  if (!import.meta.env.VITE_API_URL) localStorage.setItem(API_URL_KEY, apiUrl);
}

export function setSessionToken(token: string) {
  try {
    sessionStorage.setItem(SESSION_KEY, token);
  } catch {
    /* storage unavailable: the session lasts until reload */
  }
  localStorage.removeItem(API_KEY_KEY);
}

export function setAuth(apiKey: string) {
  // API URL comes from env var; only persist the key
  if (!import.meta.env.VITE_API_URL) {
    // Fallback: if no env var, key field doubles as "url :: key" — not used
    // in normal deployments, but keeps dev mode working without env var
    localStorage.setItem(API_URL_KEY, 'http://localhost:8787');
  }
  localStorage.setItem(API_KEY_KEY, apiKey);
  try {
    sessionStorage.removeItem(SESSION_KEY);
  } catch {
    /* ignore */
  }
}

export function setAuthWithUrl(apiUrl: string, apiKey: string) {
  localStorage.setItem(API_URL_KEY, apiUrl);
  localStorage.setItem(API_KEY_KEY, apiKey);
  try {
    sessionStorage.removeItem(SESSION_KEY);
  } catch {
    /* ignore */
  }
}

export function clearAuth() {
  localStorage.removeItem(API_URL_KEY);
  localStorage.removeItem(API_KEY_KEY);
  try {
    sessionStorage.removeItem(SESSION_KEY);
  } catch {
    /* ignore */
  }
}

export function getTheme(): 'light' | 'dark' {
  const stored = localStorage.getItem(THEME_KEY);
  if (stored === 'dark' || stored === 'light') return stored;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function setTheme(theme: 'light' | 'dark') {
  localStorage.setItem(THEME_KEY, theme);
  document.documentElement.classList.toggle('dark', theme === 'dark');
}

export type Locale = 'fr' | 'en';

// Store currency — set once to match the merchant's store config
export const STORE_CURRENCY = import.meta.env.VITE_STORE_CURRENCY || 'XOF';

// Locale — persisted in localStorage, toggleable
export function getLocale(): Locale {
  return (localStorage.getItem('locale') as Locale) || 'fr';
}

export function setLocale(locale: Locale): void {
  localStorage.setItem('locale', locale);
}

// Maps locale to Intl locale string for number/date formatting
export const INTL_LOCALE: Record<Locale, string> = {
  fr: 'fr-FR',
  en: 'en-US',
};

// Agency mode — unlocked via triple-click on logo at login
// Persists in localStorage so it survives page reloads
export function getAgencyMode(): boolean {
  return localStorage.getItem(AGENCY_MODE_KEY) === 'true';
}

export function setAgencyMode(enabled: boolean) {
  if (enabled) {
    localStorage.setItem(AGENCY_MODE_KEY, 'true');
  } else {
    localStorage.removeItem(AGENCY_MODE_KEY);
  }
}

// Initialize theme on load
if (typeof window !== 'undefined') {
  setTheme(getTheme());
}
