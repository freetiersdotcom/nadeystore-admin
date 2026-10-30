import { useEffect, useRef, useState } from 'react';
import { Loader2, Eye, EyeOff, Mail } from 'lucide-react';
import { getAgencyMode, setAgencyMode, setApiUrl, setSessionToken, AUTH_MODE } from '../lib/store';
import { api, ApiError, type AuthConfig, type SignInResult } from '../lib/api';
import { useLocale, useT } from '../lib/locale-context';

type LoginProps = {
  /** A person signed in (session started). */
  onSignedIn: () => Promise<void>;
  /** Legacy: an admin access key (agency use). */
  onKeyLogin: (apiUrl: string, apiKey: string) => Promise<void>;
};

const STORE_NAME = import.meta.env.VITE_STORE_NAME || 'merchant';
const HAS_API_URL = Boolean(import.meta.env.VITE_API_URL);
const RESEND_SECONDS = 30;

type Step = 'email' | 'sent' | 'password' | 'key';

const inputStyle = {
  background: 'var(--bg-content)',
  border: '1px solid var(--border)',
  color: 'var(--text)',
  ['--tw-ring-color' as string]: 'var(--accent)',
};
const inputClass =
  'w-full px-3 py-2.5 text-sm rounded-sm transition-colors focus:outline-none focus:ring-2';
const labelClass = 'block text-xs font-medium mb-1.5';

export function Login({ onSignedIn, onKeyLogin }: LoginProps) {
  const t = useT();
  const { locale } = useLocale();

  const [step, setStep] = useState<Step>('email');
  const [apiUrl, setApiUrlState] = useState('');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [showSecret, setShowSecret] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [config, setConfig] = useState<AuthConfig | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const [agencyMode, setAgencyModeState] = useState(getAgencyMode());

  // Triple-click on the logo reveals the agency toggle (unchanged behaviour).
  const logoClickCount = useRef(0);
  const logoClickTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [agencyUnlocked, setAgencyUnlocked] = useState(getAgencyMode());
  const handleLogoClick = () => {
    logoClickCount.current += 1;
    if (logoClickTimer.current) clearTimeout(logoClickTimer.current);
    logoClickTimer.current = setTimeout(() => (logoClickCount.current = 0), 600);
    if (logoClickCount.current >= 3) {
      logoClickCount.current = 0;
      setAgencyUnlocked(true);
    }
  };
  const handleAgencyToggle = (enabled: boolean) => {
    setAgencyMode(enabled);
    setAgencyModeState(enabled);
  };

  const resolvedUrl = () => (HAS_API_URL ? (import.meta.env.VITE_API_URL as string) : apiUrl.replace(/\/$/, ''));

  const loadConfig = async () => {
    const url = resolvedUrl();
    if (!url) return;
    setApiUrl(url);
    try {
      setConfig(await api.authConfig());
    } catch {
      setConfig(null);
    }
  };

  useEffect(() => {
    if (HAS_API_URL) void loadConfig();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(id);
  }, [cooldown]);

  const explain = (err: unknown): string => {
    if (err instanceof ApiError) {
      if (err.status === 429) return t('login.tooMany');
      if (err.code === 'password_login_disabled') return t('login.passwordOff');
      if (err.status === 401) return step === 'password' ? t('login.badPassword') : t('login.invalidCode');
      if (err.status === 400 && err.message) return err.message;
    }
    return t('login.genericError');
  };

  const finish = async (r: SignInResult) => {
    if (AUTH_MODE === 'bearer' && r.session_token) setSessionToken(r.session_token);
    await onSignedIn();
  };

  const run = async (fn: () => Promise<void>) => {
    setError('');
    setLoading(true);
    try {
      if (!HAS_API_URL) setApiUrl(resolvedUrl());
      await fn();
    } catch (err) {
      setError(explain(err));
    } finally {
      setLoading(false);
    }
  };

  const sendLink = () =>
    run(async () => {
      await api.requestLoginLink(email.trim(), locale);
      setCode('');
      setCooldown(RESEND_SECONDS);
      setStep('sent');
    });

  const verifyCode = () => run(async () => finish(await api.verifyCode(email.trim(), code.trim())));
  const passwordLogin = () => run(async () => finish(await api.passwordLogin(email.trim(), password)));
  const keyLogin = () => run(async () => onKeyLogin(resolvedUrl(), apiKey.trim()));

  const secretInput = (value: string, onChange: (v: string) => void, placeholder: string, auto: string) => (
    <div className="relative">
      <input
        type={showSecret ? 'text' : 'password'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required
        autoComplete={auto}
        className={`${inputClass} pr-10 font-mono`}
        style={inputStyle}
      />
      <button
        type="button"
        onClick={() => setShowSecret(!showSecret)}
        className="absolute right-3 top-1/2 -translate-y-1/2"
        style={{ color: 'var(--text-muted)' }}
        tabIndex={-1}
      >
        {showSecret ? <EyeOff size={15} /> : <Eye size={15} />}
      </button>
    </div>
  );

  const submitButton = (label: string, busyLabel?: string) => (
    <button
      type="submit"
      disabled={loading}
      className="w-full mt-1 px-4 py-2.5 text-sm font-semibold rounded-sm transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
      style={{ background: 'var(--accent)', color: 'var(--text-inverse)' }}
    >
      {loading && <Loader2 size={15} className="animate-spin" />}
      {loading ? busyLabel ?? t('common.loading') : label}
    </button>
  );

  const linkButton = (label: string, onClick: () => void, disabled = false) => (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="text-xs underline-offset-2 hover:underline disabled:opacity-50 disabled:no-underline"
      style={{ color: 'var(--text-secondary)' }}
    >
      {label}
    </button>
  );

  const go = (s: Step) => {
    setError('');
    setStep(s);
  };

  const emailField = (
    <div>
      <label className={labelClass} style={{ color: 'var(--text-secondary)' }}>
        {t('login.emailLabel')}
      </label>
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder={t('login.emailPlaceholder')}
        required
        autoComplete="username"
        autoFocus
        className={inputClass}
        style={inputStyle}
      />
    </div>
  );

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'var(--bg-app)' }}>
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <button
            type="button"
            onClick={handleLogoClick}
            className="inline-flex items-center justify-center mb-4 select-none focus:outline-none"
            tabIndex={-1}
          >
            <svg className="w-10 h-10" viewBox="0 0 88 88" fill="currentColor" style={{ color: 'var(--text)' }}>
              <path d="M46 84V88H42V84H46ZM84 46V42C84 21.0132 66.9868 4 46 4H42C21.0132 4 4 21.0132 4 42V46C4 66.9868 21.0132 84 42 84V88C18.804 88 0 69.196 0 46V42C1.01484e-06 19.1665 18.221 0.588624 40.916 0.0136719L42 0H46L47.084 0.0136719C69.779 0.588625 88 19.1665 88 42V46L87.9863 47.084C87.4114 69.779 68.8335 88 46 88V84C66.9868 84 84 66.9868 84 46Z" />
              <path d="M55.6 29C60.4 29 63.6 32.2 63.6 37V61H57.2V40.2C57.2 37 55.6 35.4 52.4 35.4C49.2 35.4 47.6 37 47.6 40.2V61H41.2V35.4H31.6V61H25.2V29H47.6V37C47.6 32.2 50.8 29 55.6 29Z" />
            </svg>
          </button>
          <h1 className="text-base font-semibold" style={{ color: 'var(--text)' }}>
            {STORE_NAME}
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
            {t('login.tagline')}
          </p>
        </div>

        <div
          className="p-6 rounded-lg shadow-sm"
          style={{ background: 'var(--bg-content)', border: '1px solid var(--border)' }}
        >
          {/* API URL: only when the build has none (development / agency) */}
          {!HAS_API_URL && (
            <div className="mb-3">
              <label className={labelClass} style={{ color: 'var(--text-secondary)' }}>
                {t('login.apiUrl')}
              </label>
              <input
                type="url"
                value={apiUrl}
                onChange={(e) => setApiUrlState(e.target.value)}
                onBlur={loadConfig}
                placeholder={t('login.apiUrlPlaceholder')}
                className={`${inputClass} font-mono`}
                style={inputStyle}
              />
            </div>
          )}

          {step === 'email' && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void sendLink();
              }}
              className="space-y-3"
            >
              {emailField}
              {config && !config.email_ready && (
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  {t('login.emailNotReady')}
                </p>
              )}
              {error && <p className="text-xs text-red-500 py-1">{error}</p>}
              {submitButton(t('login.sendLink'), t('login.sending'))}
              <div className="flex items-center justify-between pt-1">
                {config?.methods.password ? linkButton(t('login.usePassword'), () => go('password')) : <span />}
                {linkButton(t('login.useKey'), () => go('key'))}
              </div>
            </form>
          )}

          {step === 'sent' && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void verifyCode();
              }}
              className="space-y-3"
            >
              <div className="flex items-start gap-3">
                <Mail size={18} className="mt-0.5 flex-shrink-0" style={{ color: 'var(--text-muted)' }} />
                <div>
                  <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>
                    {t('login.checkInbox')}
                  </p>
                  <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
                    {t('login.sentTo')} <strong>{email}</strong>. {t('login.sentHelp')}
                  </p>
                </div>
              </div>
              <div>
                <label className={labelClass} style={{ color: 'var(--text-secondary)' }}>
                  {t('login.codeLabel')}
                </label>
                <input
                  inputMode="numeric"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                  autoComplete="one-time-code"
                  autoFocus
                  required
                  className={`${inputClass} font-mono text-center tracking-[0.4em] text-lg`}
                  style={inputStyle}
                />
              </div>
              {error && <p className="text-xs text-red-500 py-1">{error}</p>}
              {submitButton(t('login.verify'))}
              <div className="flex items-center justify-between pt-1">
                {linkButton(
                  cooldown > 0 ? `${t('login.resendIn')} ${cooldown}s` : t('login.resend'),
                  () => void sendLink(),
                  cooldown > 0 || loading
                )}
                {linkButton(t('login.differentEmail'), () => go('email'))}
              </div>
            </form>
          )}

          {step === 'password' && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void passwordLogin();
              }}
              className="space-y-3"
            >
              {emailField}
              <div>
                <label className={labelClass} style={{ color: 'var(--text-secondary)' }}>
                  {t('login.password')}
                </label>
                {secretInput(password, setPassword, '', 'current-password')}
              </div>
              {error && <p className="text-xs text-red-500 py-1">{error}</p>}
              {submitButton(t('login.verify'))}
              <div className="pt-1">{linkButton(t('login.useLink'), () => go('email'))}</div>
            </form>
          )}

          {step === 'key' && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void keyLogin();
              }}
              className="space-y-3"
            >
              <div>
                <label className={labelClass} style={{ color: 'var(--text-secondary)' }}>
                  {t('login.accessKey')}
                </label>
                {secretInput(apiKey, setApiKey, t('login.accessKeyPlaceholder'), 'off')}
              </div>
              {error && <p className="text-xs text-red-500 py-1">{error}</p>}
              {submitButton(t('login.submit'))}
              <div className="pt-1">{linkButton(t('login.useEmail'), () => go('email'))}</div>
            </form>
          )}

          {agencyUnlocked && (
            <div
              className="mt-4 pt-4 border-t flex items-center justify-between"
              style={{ borderColor: 'var(--border)' }}
            >
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                {t('login.agencyMode')}
              </span>
              <button
                type="button"
                onClick={() => handleAgencyToggle(!agencyMode)}
                className="relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none"
                style={{ background: agencyMode ? 'var(--accent)' : 'var(--border)' }}
              >
                <span
                  className="inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform"
                  style={{ transform: agencyMode ? 'translateX(18px)' : 'translateX(3px)' }}
                />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
