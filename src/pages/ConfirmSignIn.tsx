import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { api, ApiError } from '../lib/api';
import { AUTH_MODE, getAuth, setSessionToken } from '../lib/store';
import { useT } from '../lib/locale-context';

// The link in a sign-in email opens here. It does not sign anyone in by itself:
// the token is only sent when the person presses the button. Mail scanners that
// pre-open links therefore cannot use the link up.

type Props = {
  token: string;
  onSignedIn: () => Promise<void>;
  onCancel: () => void;
};

export function ConfirmSignIn({ token, onSignedIn, onCancel }: Props) {
  const t = useT();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const hasApi = Boolean(getAuth().apiUrl);

  const confirm = async () => {
    setError('');
    setLoading(true);
    try {
      const r = await api.verifyLink(token);
      if (AUTH_MODE === 'bearer' && r.session_token) setSessionToken(r.session_token);
      await onSignedIn();
    } catch (err) {
      setError(err instanceof ApiError && err.status === 429 ? t('login.tooMany') : t('confirm.failed'));
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'var(--bg-app)' }}>
      <div
        className="w-full max-w-sm p-6 rounded-lg shadow-sm text-center"
        style={{ background: 'var(--bg-content)', border: '1px solid var(--border)' }}
      >
        <h1 className="text-base font-semibold" style={{ color: 'var(--text)' }}>
          {t('confirm.title')}
        </h1>
        <p className="text-sm mt-2 mb-5" style={{ color: 'var(--text-secondary)' }}>
          {hasApi ? t('confirm.body') : t('confirm.noApi')}
        </p>
        {error && <p className="text-xs text-red-500 pb-3">{error}</p>}
        <button
          onClick={confirm}
          disabled={loading || !hasApi}
          className="w-full px-4 py-2.5 text-sm font-semibold rounded-sm transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          style={{ background: 'var(--accent)', color: 'var(--text-inverse)' }}
        >
          {loading && <Loader2 size={15} className="animate-spin" />}
          {loading ? t('confirm.working') : t('confirm.button')}
        </button>
        <button
          onClick={onCancel}
          className="mt-4 text-xs underline-offset-2 hover:underline"
          style={{ color: 'var(--text-secondary)' }}
        >
          {t('confirm.back')}
        </button>
      </div>
    </div>
  );
}
