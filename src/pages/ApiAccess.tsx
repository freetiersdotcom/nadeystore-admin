import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Copy, Check, CircleCheck, Circle } from 'lucide-react';
import { api, ApiError, type ApiKeyItem, type Me } from '../lib/api';
import { useT } from '../lib/locale-context';
import { useIntlDate } from './teamDate';

const card = { background: 'var(--bg-card)', border: '1px solid var(--border)' };
const inputClass = 'w-full px-3 py-2 text-sm rounded-sm focus:outline-none focus:ring-2';
const inputStyle = {
  background: 'var(--bg-content)',
  border: '1px solid var(--border)',
  color: 'var(--text)',
  ['--tw-ring-color' as string]: 'var(--accent)',
};
const labelClass = 'block text-xs font-medium mb-1.5';
const primary = { background: 'var(--accent)', color: 'var(--text-inverse)' };
const ghost = { border: '1px solid var(--border)', color: 'var(--text-secondary)' };

function errText(err: unknown, t: ReturnType<typeof useT>) {
  return err instanceof ApiError ? err.message : t('common.error');
}

// ─────────────────────────────────────────────────────────────────────────────
export function SetupChecklist() {
  const t = useT();
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ['setup-status'], queryFn: () => api.getSetupStatus() });
  const seal = useMutation({
    mutationFn: () => api.sealSecrets(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['setup-status'] }),
  });
  if (!data) return null;

  const plain = data.encryption.plain_rows;
  const rows: { ok: boolean; label: string; extra?: React.ReactNode }[] = [
    { ok: data.owner_exists, label: t('setup.owner') },
    { ok: data.email.configured, label: t('setup.email') },
    { ok: data.stripe.configured, label: t('setup.stripe') },
    { ok: data.fedapay.configured, label: t('setup.fedapay') },
    { ok: data.environment.admin_origins, label: t('setup.origins') },
    { ok: data.environment.cookie_ready, label: t('setup.https') },
    { ok: data.environment.password_pepper, label: t('setup.pepper') },
    { ok: data.environment.setup_token, label: t('setup.token') },
    {
      ok: data.encryption.enabled && plain.length === 0,
      label: t('setup.encryption'),
      extra:
        data.encryption.enabled && plain.length > 0 ? (
          <button
            type="button"
            onClick={() => seal.mutate()}
            disabled={seal.isPending}
            className="ml-2 px-2 py-0.5 text-xs rounded-sm"
            style={ghost}
          >
            {seal.isPending ? <Loader2 className="inline w-3 h-3 animate-spin" /> : t('setup.encryptNow').replace('{n}', String(plain.length))}
          </button>
        ) : null,
    },
  ];

  return (
    <section className="p-5" style={card}>
      <h2 className="text-sm font-semibold" style={{ color: 'var(--text)' }}>{t('setup.title')}</h2>
      <p className="text-xs mt-1 mb-3" style={{ color: 'var(--text-muted)' }}>{t('setup.help')}</p>
      <ul className="space-y-1.5">
        {rows.map((r) => (
          <li key={r.label} className="flex items-start gap-2 text-sm" style={{ color: 'var(--text)' }}>
            {r.ok ? (
              <CircleCheck className="w-4 h-4 mt-0.5 shrink-0" style={{ color: 'var(--accent)' }} aria-label={t('setup.done')} />
            ) : (
              <Circle className="w-4 h-4 mt-0.5 shrink-0" style={{ color: 'var(--text-muted)' }} aria-label={t('setup.todo')} />
            )}
            <span style={{ color: r.ok ? 'var(--text-secondary)' : 'var(--text)' }}>{r.label}{r.extra}</span>
          </li>
        ))}
      </ul>
      {seal.isError && <p className="text-xs mt-2" style={{ color: 'var(--danger, #b42318)' }}>{errText(seal.error, t)}</p>}
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
function SecretBox({ secret, onDismiss }: { secret: string; onDismiss: () => void }) {
  const t = useT();
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(secret);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable: the key is selectable */
    }
  };
  return (
    <div className="p-3 mb-4" style={{ border: '1px solid var(--accent)', background: 'var(--bg-content)' }} role="status">
      <p className="text-xs font-medium mb-2" style={{ color: 'var(--text)' }}>{t('keys.secretTitle')}</p>
      <div className="flex gap-2 items-center">
        <code data-testid="new-key-secret" className="flex-1 text-xs break-all select-all font-mono px-2 py-1.5" style={{ border: '1px solid var(--border)', color: 'var(--text)' }}>
          {secret}
        </code>
        <button type="button" onClick={copy} className="px-2.5 py-1.5 text-xs rounded-sm flex items-center gap-1" style={ghost}>
          {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
          {copied ? t('keys.copied') : t('keys.copy')}
        </button>
      </div>
      <button type="button" onClick={onDismiss} className="mt-2 text-xs underline" style={{ color: 'var(--text-secondary)' }}>
        {t('keys.dismiss')}
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
export function ApiKeys({ me }: { me: Me }) {
  const t = useT();
  const fmt = useIntlDate();
  const qc = useQueryClient();
  const [role, setRole] = useState<'public' | 'admin'>('public');
  const [label, setLabel] = useState('');
  const [secret, setSecret] = useState<string | null>(null);
  const [rotating, setRotating] = useState<string | null>(null);
  const [grace, setGrace] = useState(24);
  const [revoking, setRevoking] = useState<string | null>(null);

  const { data, isLoading } = useQuery({ queryKey: ['api-keys'], queryFn: () => api.getApiKeys(), enabled: !!me.user });
  const refresh = () => qc.invalidateQueries({ queryKey: ['api-keys'] });

  const create = useMutation({
    mutationFn: () => api.createApiKey({ role, label: label.trim() || undefined }),
    onSuccess: (r) => { setSecret(r.secret); setLabel(''); refresh(); },
  });
  const rotate = useMutation({
    mutationFn: (id: string) => api.rotateApiKey(id, grace),
    onSuccess: (r) => { setSecret(r.secret); setRotating(null); refresh(); },
  });
  const revoke = useMutation({
    mutationFn: (id: string) => api.revokeApiKey(id),
    onSuccess: () => { setRevoking(null); refresh(); },
  });

  if (!me.user) {
    return (
      <section className="p-5" style={card}>
        <h2 className="text-sm font-semibold" style={{ color: 'var(--text)' }}>{t('keys.title')}</h2>
        <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>{t('keys.signInNeeded')}</p>
      </section>
    );
  }

  const items: ApiKeyItem[] = data?.items ?? [];
  const live = items.filter((k) => k.status === 'active' || k.status === 'expiring');
  const past = items.filter((k) => !(k.status === 'active' || k.status === 'expiring'));
  const err = create.error ?? rotate.error ?? revoke.error;

  const row = (k: ApiKeyItem) => {
    const isLive = k.status === 'active' || k.status === 'expiring';
    return (
      <li key={k.id} className="py-2.5 text-sm" style={{ borderColor: 'var(--border-subtle)' }} data-testid="key-row">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="font-medium" style={{ color: 'var(--text)' }}>{k.label ?? t('keys.unnamed')}</span>
          <span className="text-xs px-1.5 py-0.5" style={ghost}>{k.role === 'admin' ? 'admin' : 'public'}</span>
          <code className="text-xs font-mono" style={{ color: 'var(--text-secondary)' }}>{k.key_prefix}…{k.last4 ?? '••••'}</code>
          <span className="text-xs" style={{ color: k.status === 'active' ? 'var(--accent)' : 'var(--text-muted)' }}>
            {t(`keys.status.${k.status}` as 'keys.status.active')}
          </span>
          {!k.created_by && <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{t('keys.legacy')}</span>}
          <span className="ml-auto flex gap-2">
            {isLive && (
              <>
                <button type="button" className="px-2 py-1 text-xs rounded-sm" style={ghost}
                  onClick={() => { setRotating(rotating === k.id ? null : k.id); setRevoking(null); }}>
                  {t('keys.rotate')}
                </button>
                <button type="button" className="px-2 py-1 text-xs rounded-sm" style={ghost}
                  onClick={() => { setRevoking(revoking === k.id ? null : k.id); setRotating(null); }}>
                  {t('keys.revoke')}
                </button>
              </>
            )}
          </span>
        </div>
        <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
          {t('keys.lastUsed')}: {k.last_used_at ? fmt(k.last_used_at) : t('keys.never')}
          {k.status === 'expiring' && k.expires_at ? ` · ${t('keys.expiresAt').replace('{date}', fmt(k.expires_at))}` : ''}
        </p>
        {rotating === k.id && (
          <div className="mt-2 p-3 flex flex-wrap items-end gap-3" style={{ background: 'var(--bg-content)', border: '1px solid var(--border)' }}>
            <div>
              <label className={labelClass} style={{ color: 'var(--text-secondary)' }} htmlFor={`grace-${k.id}`}>{t('keys.rotateGrace')}</label>
              <select id={`grace-${k.id}`} className={inputClass} style={inputStyle} value={grace} onChange={(e) => setGrace(Number(e.target.value))}>
                <option value={0}>{t('keys.grace0')}</option>
                <option value={24}>{t('keys.grace24')}</option>
                <option value={168}>{t('keys.grace168')}</option>
              </select>
            </div>
            <button type="button" onClick={() => rotate.mutate(k.id)} disabled={rotate.isPending} className="px-3 py-2 text-xs font-medium rounded-sm" style={primary}>
              {rotate.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : t('keys.rotateGo')}
            </button>
            <button type="button" onClick={() => setRotating(null)} className="px-3 py-2 text-xs rounded-sm" style={ghost}>{t('keys.cancel')}</button>
          </div>
        )}
        {revoking === k.id && (
          <div className="mt-2 p-3 flex flex-wrap items-center gap-3" style={{ background: 'var(--bg-content)', border: '1px solid var(--border)' }}>
            <p className="text-xs flex-1" style={{ color: 'var(--text)' }}>{t('keys.revokeConfirm')}</p>
            <button type="button" onClick={() => revoke.mutate(k.id)} disabled={revoke.isPending} className="px-3 py-2 text-xs font-medium rounded-sm" style={primary}>
              {revoke.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : t('keys.revoke')}
            </button>
            <button type="button" onClick={() => setRevoking(null)} className="px-3 py-2 text-xs rounded-sm" style={ghost}>{t('keys.cancel')}</button>
          </div>
        )}
      </li>
    );
  };

  return (
    <section className="p-5" style={card}>
      <h2 className="text-sm font-semibold" style={{ color: 'var(--text)' }}>{t('keys.title')}</h2>
      <p className="text-xs mt-1 mb-4" style={{ color: 'var(--text-muted)' }}>{t('keys.help')}</p>

      {secret && <SecretBox secret={secret} onDismiss={() => setSecret(null)} />}

      <form
        className="flex flex-wrap items-end gap-3 mb-4"
        onSubmit={(e) => { e.preventDefault(); create.mutate(); }}
      >
        <div>
          <label className={labelClass} style={{ color: 'var(--text-secondary)' }} htmlFor="key-role">{t('keys.role')}</label>
          <select id="key-role" className={inputClass} style={inputStyle} value={role} onChange={(e) => setRole(e.target.value as 'public' | 'admin')}>
            <option value="public">{t('keys.role.public')}</option>
            <option value="admin">{t('keys.role.admin')}</option>
          </select>
        </div>
        <div className="flex-1 min-w-[10rem]">
          <label className={labelClass} style={{ color: 'var(--text-secondary)' }} htmlFor="key-label">{t('keys.label')}</label>
          <input id="key-label" className={inputClass} style={inputStyle} value={label} maxLength={80} placeholder={t('keys.labelPh')} onChange={(e) => setLabel(e.target.value)} />
        </div>
        <button type="submit" disabled={create.isPending} className="px-4 py-2 text-sm font-medium rounded-sm" style={primary}>
          {create.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : t('keys.create')}
        </button>
      </form>

      {err && <p className="text-xs mb-3" style={{ color: 'var(--danger, #b42318)' }} role="alert">{errText(err, t)}</p>}

      {isLoading ? (
        <Loader2 className="w-4 h-4 animate-spin" style={{ color: 'var(--text-muted)' }} />
      ) : items.length === 0 ? (
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{t('keys.empty')}</p>
      ) : (
        <>
          <ul className="divide-y" style={{ borderColor: 'var(--border-subtle)' }}>{live.map(row)}</ul>
          {past.length > 0 && (
            <ul className="divide-y mt-3 opacity-60" style={{ borderColor: 'var(--border-subtle)' }}>{past.map(row)}</ul>
          )}
        </>
      )}
    </section>
  );
}
