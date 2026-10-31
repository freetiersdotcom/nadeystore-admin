import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Fingerprint, Loader2, Trash2 } from 'lucide-react';
import { api, ApiError, type Passkey } from '../lib/api';
import { createPasskey, passkeyFailure, passkeysSupported } from '../lib/passkeys';
import { useT } from '../lib/locale-context';
import { useIntlDate } from './teamDate';

const inputStyle = {
  background: 'var(--bg-content)',
  border: '1px solid var(--border)',
  color: 'var(--text)',
  ['--tw-ring-color' as string]: 'var(--accent)',
};

/** "My passkeys": list, add on this device, remove. Shown inside the Team page's My account card. */
export function PasskeyCard() {
  const t = useT();
  const fmt = useIntlDate();
  const qc = useQueryClient();
  const supported = passkeysSupported();
  const { data } = useQuery({ queryKey: ['passkeys'], queryFn: () => api.getPasskeys(), retry: false });
  const [name, setName] = useState('');
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  const add = useMutation({
    mutationFn: async () => {
      const { challenge_id, options } = await api.passkeyRegisterOptions();
      const response = await createPasskey(options);
      return api.passkeyRegister(challenge_id, response, name.trim() || undefined);
    },
    onSuccess: () => {
      setMsg(t('passkeys.added')); setError(''); setName('');
      void qc.invalidateQueries({ queryKey: ['passkeys'] });
    },
    onError: (e) => {
      setMsg('');
      const why = passkeyFailure(e);
      setError(why === 'cancelled' ? t('passkeys.cancelled') : why === 'exists' ? t('passkeys.exists')
        : e instanceof ApiError && e.status === 409 ? e.message : t('passkeys.error'));
    },
  });
  const remove = useMutation({
    mutationFn: (id: string) => api.deletePasskey(id),
    onSuccess: () => { setMsg(''); void qc.invalidateQueries({ queryKey: ['passkeys'] }); },
    onError: () => setError(t('passkeys.error')),
  });

  const items: Passkey[] = data?.items ?? [];
  return (
    <div className="mt-5 pt-5" style={{ borderTop: '1px solid var(--border-subtle)' }}>
      <h3 className="text-sm font-semibold flex items-center gap-2" style={{ color: 'var(--text)' }}>
        <Fingerprint size={15} /> {t('passkeys.title')}
      </h3>
      <p className="text-xs mt-1 mb-3" style={{ color: 'var(--text-muted)' }}>{t('passkeys.help')}</p>

      {items.length === 0 ? (
        <p className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>{t('passkeys.empty')}</p>
      ) : (
        <ul className="mb-3 divide-y text-sm" style={{ borderColor: 'var(--border-subtle)' }}>
          {items.map((p) => (
            <li key={p.id} className="py-2 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="truncate" style={{ color: 'var(--text)' }}>
                  {p.name || t('passkeys.defaultName')}{p.backed_up ? ` · ${t('passkeys.synced')}` : ''}
                </div>
                <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  {t('passkeys.created')} {fmt(p.created_at)} · {t('passkeys.lastUsed')}: {p.last_used_at ? fmt(p.last_used_at) : t('passkeys.never')}
                </div>
              </div>
              <button
                type="button"
                onClick={() => { if (window.confirm(t('passkeys.removeAsk'))) remove.mutate(p.id); }}
                disabled={remove.isPending}
                className="p-1.5 rounded-sm hover:opacity-80"
                style={{ color: '#ef4444' }}
                aria-label={t('passkeys.remove')}
                title={t('passkeys.remove')}
              >
                <Trash2 size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}

      {supported ? (
        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={(e) => { e.preventDefault(); setError(''); setMsg(''); add.mutate(); }}
        >
          <div className="flex-1 min-w-[10rem]">
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>{t('passkeys.nameLabel')}</label>
            <input
              value={name} onChange={(e) => setName(e.target.value)} maxLength={60} placeholder={t('passkeys.defaultName')}
              className="w-full px-3 py-2 text-sm rounded-sm focus:outline-none focus:ring-2" style={inputStyle}
            />
          </div>
          <button
            type="submit" disabled={add.isPending}
            className="px-4 py-2 text-sm font-semibold rounded-sm disabled:opacity-50 flex items-center gap-2"
            style={{ background: 'var(--accent)', color: 'var(--text-inverse)' }}
          >
            {add.isPending && <Loader2 size={14} className="animate-spin" />}
            {add.isPending ? t('passkeys.adding') : t('passkeys.add')}
          </button>
        </form>
      ) : (
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{t('passkeys.unsupported')}</p>
      )}
      {msg && <p className="text-xs mt-2" style={{ color: 'var(--text-secondary)' }}>{msg}</p>}
      {error && <p className="text-xs text-red-500 mt-2">{error}</p>}
    </div>
  );
}
