import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Copy, Check, AlertTriangle } from 'lucide-react';
import { api, ApiError, type AuthSettings, type InviteResult, type Me, type Role, type TeamUser } from '../lib/api';
import { useLocale, useT } from '../lib/locale-context';
import { useIntlDate } from './teamDate';
import { ApiKeys, SetupChecklist } from './ApiAccess';

type Props = { me: Me; onSignedOut: () => void };

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

export function Team({ me, onSignedOut }: Props) {
  const t = useT();
  const isAgency = me.kind === 'api_key' || me.role === 'agency';
  const canManage = me.permissions.includes('users.manage');
  const canAudit = me.permissions.includes('audit.read');

  return (
    <div className="max-w-4xl space-y-8">
      <h1 className="text-lg font-semibold" style={{ color: 'var(--text)' }}>
        {t('team.title')}
      </h1>
      {canManage && <Members me={me} isAgency={isAgency} />}
      {canManage && <SignInSettings />}
      {canManage && <ApiKeys me={me} />}
      {canManage && <SetupChecklist />}
      {me.user && <MyAccount onSignedOut={onSignedOut} />}
      {canAudit && <Audit />}
    </div>
  );
}

function errorText(err: unknown, t: ReturnType<typeof useT>): string {
  if (err instanceof ApiError) {
    if (err.status === 409 && /last active owner/i.test(err.message)) return t('team.lastOwner');
    return err.message;
  }
  return t('common.error');
}

// ─────────────────────────────────────────────────────────────────────────────
function Members({ me, isAgency }: { me: Me; isAgency: boolean }) {
  const t = useT();
  const { locale } = useLocale();
  const fmt = useIntlDate();
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['team'], queryFn: () => api.getTeam() });
  const refresh = () => qc.invalidateQueries({ queryKey: ['team'] });

  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<Role>('staff');
  const [notice, setNotice] = useState<InviteResult | null>(null);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  const roles: Role[] = isAgency ? ['owner', 'manager', 'staff', 'agency'] : ['owner', 'manager', 'staff'];

  const invite = useMutation({
    mutationFn: () => api.inviteUser({ email: email.trim(), name: name.trim() || undefined, role, locale }),
    onSuccess: (r) => {
      setNotice(r);
      setError('');
      setEmail('');
      setName('');
      refresh();
    },
    onError: (e) => setError(errorText(e, t)),
  });
  const update = useMutation({
    mutationFn: ({ id, body }: { id: string; body: { role?: Role; status?: 'active' | 'disabled' } }) =>
      api.updateUser(id, body),
    onSuccess: () => {
      setError('');
      refresh();
    },
    onError: (e) => setError(errorText(e, t)),
  });
  const resend = useMutation({
    mutationFn: (id: string) => api.resendInvite(id),
    onSuccess: (r) => setNotice(r),
    onError: (e) => setError(errorText(e, t)),
  });

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable: the link is selectable */
    }
  };

  return (
    <section className="p-5" style={card}>
      <h2 className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
        {t('team.members')}
      </h2>
      <p className="text-xs mt-1 mb-4" style={{ color: 'var(--text-muted)' }}>
        {t('team.hint')}
      </p>

      {isLoading ? (
        <Loader2 size={16} className="animate-spin" style={{ color: 'var(--text-muted)' }} />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs" style={{ color: 'var(--text-muted)' }}>
                <th className="py-2 pr-3 font-medium">{t('team.name')}</th>
                <th className="py-2 pr-3 font-medium">{t('team.role')}</th>
                <th className="py-2 pr-3 font-medium">{t('team.lastLogin')}</th>
                <th className="py-2" />
              </tr>
            </thead>
            <tbody>
              {(data?.items ?? []).map((u: TeamUser) => {
                const self = u.id === me.user?.id;
                return (
                  <tr key={u.id} className="border-t" style={{ borderColor: 'var(--border-subtle)' }}>
                    <td className="py-2.5 pr-3">
                      <div style={{ color: u.status === 'disabled' ? 'var(--text-muted)' : 'var(--text)' }}>
                        {u.name || u.email}
                        {self && (
                          <span className="ml-2 text-xs" style={{ color: 'var(--text-muted)' }}>
                            ({t('team.you')})
                          </span>
                        )}
                      </div>
                      {u.name && (
                        <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                          {u.email}
                        </div>
                      )}
                    </td>
                    <td className="py-2.5 pr-3">
                      <select
                        value={u.role}
                        disabled={self || update.isPending}
                        onChange={(e) => update.mutate({ id: u.id, body: { role: e.target.value as Role } })}
                        className="px-2 py-1 text-sm rounded-sm"
                        style={inputStyle}
                      >
                        {roles.concat(roles.includes(u.role) ? [] : [u.role]).map((r) => (
                          <option key={r} value={r}>
                            {t(`team.role.${r}` as 'team.role.owner')}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="py-2.5 pr-3 text-xs" style={{ color: 'var(--text-secondary)' }}>
                      {u.last_login_at ? fmt(u.last_login_at) : t('team.never')}
                      {u.status === 'disabled' && (
                        <span className="ml-2" style={{ color: 'var(--text-muted)' }}>
                          · {t('team.disabled')}
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 text-right whitespace-nowrap">
                      {u.status === 'active' && (
                        <button
                          onClick={() => resend.mutate(u.id)}
                          className="text-xs mr-3 hover:underline"
                          style={{ color: 'var(--text-secondary)' }}
                        >
                          {t('team.resend')}
                        </button>
                      )}
                      {!self && (
                        <button
                          onClick={() =>
                            update.mutate({ id: u.id, body: { status: u.status === 'active' ? 'disabled' : 'active' } })
                          }
                          className="text-xs hover:underline"
                          style={{ color: u.status === 'active' ? '#ef4444' : 'var(--text-secondary)' }}
                        >
                          {u.status === 'active' ? t('team.disable') : t('team.enable')}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <form
        className="mt-5 pt-5 border-t grid gap-3 sm:grid-cols-4"
        style={{ borderColor: 'var(--border)' }}
        onSubmit={(e) => {
          e.preventDefault();
          setNotice(null);
          invite.mutate();
        }}
      >
        <div className="sm:col-span-4 text-xs font-semibold" style={{ color: 'var(--text)' }}>
          {t('team.invite')}
        </div>
        <div className="sm:col-span-2">
          <label className={labelClass} style={{ color: 'var(--text-secondary)' }}>{t('team.email')}</label>
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} style={inputStyle} />
        </div>
        <div>
          <label className={labelClass} style={{ color: 'var(--text-secondary)' }}>{t('team.name')}</label>
          <input value={name} onChange={(e) => setName(e.target.value)} className={inputClass} style={inputStyle} />
        </div>
        <div>
          <label className={labelClass} style={{ color: 'var(--text-secondary)' }}>{t('team.role')}</label>
          <select value={role} onChange={(e) => setRole(e.target.value as Role)} className={inputClass} style={inputStyle}>
            {roles.map((r) => (
              <option key={r} value={r}>{t(`team.role.${r}` as 'team.role.owner')}</option>
            ))}
          </select>
        </div>
        <p className="sm:col-span-4 text-xs" style={{ color: 'var(--text-muted)' }}>
          {t(`team.roleHelp.${role}` as 'team.roleHelp.owner')}
        </p>
        <div className="sm:col-span-4">
          <button
            type="submit"
            disabled={invite.isPending}
            className="px-4 py-2 text-sm font-semibold rounded-sm disabled:opacity-50 inline-flex items-center gap-2"
            style={primary}
          >
            {invite.isPending && <Loader2 size={14} className="animate-spin" />}
            {invite.isPending ? t('team.sending') : t('team.send')}
          </button>
        </div>
      </form>

      {error && <p className="text-xs text-red-500 mt-3">{error}</p>}
      {notice?.invite_sent && <p className="text-xs mt-3" style={{ color: 'var(--text-secondary)' }}>{t('team.sent')}</p>}
      {notice && !notice.invite_sent && notice.invite_url && (
        <div className="mt-3 p-3 text-xs" style={{ border: '1px solid var(--border)', background: 'var(--bg-subtle)' }}>
          <p style={{ color: 'var(--text-secondary)' }}>{t('team.manual')}</p>
          <div className="mt-2 flex items-center gap-2">
            <code className="flex-1 break-all select-all" style={{ color: 'var(--text)' }}>{notice.invite_url}</code>
            <button onClick={() => void copy(notice.invite_url!)} className="p-1.5 hover:bg-[var(--bg-hover)]" title={t('team.copy')}>
              {copied ? <Check size={14} /> : <Copy size={14} />}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
function SignInSettings() {
  const t = useT();
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ['auth-settings'], queryFn: () => api.getAuthSettings() });
  const [draft, setDraft] = useState<AuthSettings | null>(null);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  const s = draft ?? data;
  const save = useMutation({
    mutationFn: (v: AuthSettings) =>
      api.saveAuthSettings({
        password_login: v.password_login,
        kdf: v.kdf,
        iterations: v.iterations,
        scrypt: v.scrypt,
        session_days: v.session_days,
        idle_days: v.idle_days,
      }),
    onSuccess: (r) => {
      qc.setQueryData(['auth-settings'], r);
      // "My account" decides whether to offer a password from the public config.
      void qc.invalidateQueries({ queryKey: ['auth-config'] });
      setDraft(null);
      setSaved(true);
      setError('');
      setTimeout(() => setSaved(false), 2000);
    },
    onError: (e) => setError(errorText(e, t)),
  });
  if (!s) return null;
  const set = (patch: Partial<AuthSettings>) => setDraft({ ...s, ...patch });

  return (
    <section className="p-5" style={card}>
      <h2 className="text-sm font-semibold mb-4" style={{ color: 'var(--text)' }}>
        {t('team.signin')}
      </h2>

      <label className="flex items-start gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={s.password_login}
          onChange={(e) => set({ password_login: e.target.checked })}
          className="mt-0.5"
        />
        <span>
          <span className="text-sm" style={{ color: 'var(--text)' }}>{t('team.passwordLogin')}</span>
          <span className="block text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{t('team.passwordLoginHelp')}</span>
        </span>
      </label>

      {s.password_login && (
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div>
            <label className={labelClass} style={{ color: 'var(--text-secondary)' }}>{t('team.kdf')}</label>
            <select value={s.kdf} onChange={(e) => set({ kdf: e.target.value as 'pbkdf2' | 'scrypt' })} className={inputClass} style={inputStyle}>
              <option value="pbkdf2">PBKDF2-SHA256</option>
              <option value="scrypt">scrypt</option>
            </select>
          </div>
          {s.kdf === 'pbkdf2' ? (
            <div>
              <label className={labelClass} style={{ color: 'var(--text-secondary)' }}>{t('team.iterations')}</label>
              <input
                type="number"
                min={10000}
                max={s.pbkdf2_max_iterations}
                step={10000}
                value={s.iterations}
                onChange={(e) => set({ iterations: Number(e.target.value) })}
                className={inputClass}
                style={inputStyle}
              />
            </div>
          ) : (
            <>
              <div>
                <label className={labelClass} style={{ color: 'var(--text-secondary)' }}>{t('team.scryptCost')}</label>
                <select value={s.scrypt.n} onChange={(e) => set({ scrypt: { ...s.scrypt, n: Number(e.target.value) } })} className={inputClass} style={inputStyle}>
                  {[14, 15, 16, 17].map((e) => (
                    <option key={e} value={2 ** e}>{`2^${e} (${2 ** e})`}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClass} style={{ color: 'var(--text-secondary)' }}>{t('team.scryptP')}</label>
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={s.scrypt.p}
                  onChange={(e) => set({ scrypt: { ...s.scrypt, p: Number(e.target.value) } })}
                  className={inputClass}
                  style={inputStyle}
                />
              </div>
            </>
          )}
        </div>
      )}

      {s.password_login && (
        <div className="mt-4 p-3 text-xs flex gap-2" style={{ border: '1px solid var(--border)', background: 'var(--bg-subtle)' }}>
          <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" style={{ color: '#d97706' }} />
          <div style={{ color: 'var(--text-secondary)' }}>
            <p className="font-medium" style={{ color: 'var(--text)' }}>{t('team.hashWarnTitle')}</p>
            <p className="mt-1">{t('team.hashWarn')}</p>
            <p className="mt-1">{s.meets_owasp ? t('team.owaspOk') : t('team.owaspNo')}</p>
            {!s.pepper_configured && <p className="mt-1" style={{ color: '#d97706' }}>{t('team.noPepper')}</p>}
          </div>
        </div>
      )}

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <div>
          <label className={labelClass} style={{ color: 'var(--text-secondary)' }}>{t('team.sessionDays')}</label>
          <input type="number" min={1} max={90} value={s.session_days} onChange={(e) => set({ session_days: Number(e.target.value) })} className={inputClass} style={inputStyle} />
        </div>
        <div>
          <label className={labelClass} style={{ color: 'var(--text-secondary)' }}>{t('team.idleDays')}</label>
          <input type="number" min={1} max={30} value={s.idle_days} onChange={(e) => set({ idle_days: Number(e.target.value) })} className={inputClass} style={inputStyle} />
        </div>
      </div>

      <div className="mt-4 flex items-center gap-3">
        <button
          onClick={() => save.mutate(s)}
          disabled={!draft || save.isPending}
          className="px-4 py-2 text-sm font-semibold rounded-sm disabled:opacity-50 inline-flex items-center gap-2"
          style={primary}
        >
          {save.isPending && <Loader2 size={14} className="animate-spin" />}
          {save.isPending ? t('common.saving') : t('common.save')}
        </button>
        {saved && <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{t('team.saved')}</span>}
        {error && <span className="text-xs text-red-500">{error}</span>}
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
function MyAccount({ onSignedOut }: { onSignedOut: () => void }) {
  const t = useT();
  const { data: settings } = useQuery({ queryKey: ['auth-config'], queryFn: () => api.authConfig() });
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  const change = useMutation({
    mutationFn: () => api.setPassword({ current_password: current || undefined, new_password: next }),
    onSuccess: () => {
      setMsg(t('team.passwordSaved'));
      setError('');
      setCurrent('');
      setNext('');
    },
    onError: (e) => {
      setMsg('');
      setError(errorText(e, t));
    },
  });
  const outAll = useMutation({ mutationFn: () => api.logoutAll(), onSuccess: onSignedOut });

  return (
    <section className="p-5" style={card}>
      <h2 className="text-sm font-semibold mb-4" style={{ color: 'var(--text)' }}>{t('team.account')}</h2>

      {settings?.methods.password && (
        <form
          className="grid gap-3 sm:grid-cols-3 items-end"
          onSubmit={(e) => {
            e.preventDefault();
            change.mutate();
          }}
        >
          <div>
            <label className={labelClass} style={{ color: 'var(--text-secondary)' }}>{t('team.currentPassword')}</label>
            <input type="password" value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" className={inputClass} style={inputStyle} />
          </div>
          <div>
            <label className={labelClass} style={{ color: 'var(--text-secondary)' }}>{t('team.newPassword')}</label>
            <input type="password" required minLength={10} value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" className={inputClass} style={inputStyle} />
          </div>
          <button type="submit" disabled={change.isPending} className="px-4 py-2 text-sm font-semibold rounded-sm disabled:opacity-50" style={primary}>
            {t('team.setPassword')}
          </button>
        </form>
      )}
      {msg && <p className="text-xs mt-3" style={{ color: 'var(--text-secondary)' }}>{msg}</p>}
      {error && <p className="text-xs text-red-500 mt-3">{error}</p>}

      <button
        onClick={() => outAll.mutate()}
        disabled={outAll.isPending}
        className="mt-4 text-xs hover:underline"
        style={{ color: '#ef4444' }}
      >
        {t('team.signOutAll')}
      </button>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
function Audit() {
  const t = useT();
  const fmt = useIntlDate();
  const { data } = useQuery({ queryKey: ['audit'], queryFn: () => api.getAudit(50) });
  const items = data?.items ?? [];
  return (
    <section className="p-5" style={card}>
      <h2 className="text-sm font-semibold mb-3" style={{ color: 'var(--text)' }}>{t('team.audit')}</h2>
      {items.length === 0 ? (
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{t('team.auditEmpty')}</p>
      ) : (
        <ul className="text-xs divide-y" style={{ borderColor: 'var(--border-subtle)' }}>
          {items.map((i) => (
            <li key={i.id} className="py-1.5 flex flex-wrap gap-x-3" style={{ borderColor: 'var(--border-subtle)' }}>
              <span style={{ color: 'var(--text-muted)' }}>{fmt(i.at)}</span>
              <span className="font-mono" style={{ color: 'var(--text)' }}>{i.action}</span>
              <span style={{ color: 'var(--text-secondary)' }}>{[i.actor, i.target].filter(Boolean).join(' → ')}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
