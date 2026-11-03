import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { useLocale, useT } from '../../lib/locale-context';

const card = { background: 'var(--bg-card)', border: '1px solid var(--border)' };

/** Owner-only: switch optional modules on or off. Off hides a module and keeps its data. */
export function ModulesCard() {
  const t = useT();
  const { locale } = useLocale();
  const l = locale === 'en' ? 'en' : 'fr';
  const qc = useQueryClient();
  const [err, setErr] = useState<string | null>(null);
  const { data } = useQuery({ queryKey: ['modules'], queryFn: () => api.getModules() });
  const toggle = useMutation({
    mutationFn: (v: { id: string; enabled: boolean }) => api.setModule(v.id, v.enabled),
    onSuccess: () => { setErr(null); qc.invalidateQueries({ queryKey: ['modules'] }); },
    onError: (e: unknown) => setErr(e instanceof Error ? e.message : String(e)),
  });
  if (!data || data.items.length === 0) return null;

  return (
    <section className="p-5" style={card} data-testid="modules-card">
      <h2 className="text-sm font-semibold mb-1" style={{ color: 'var(--text)' }}>{t('modules.title')}</h2>
      <p className="text-xs mb-3" style={{ color: 'var(--text-secondary)' }}>{t('modules.help')}</p>
      <ul className="divide-y" style={{ borderColor: 'var(--border-subtle)' }}>
        {data.items.map((m) => (
          <li key={m.id} className="py-3 flex items-center gap-3" style={{ borderColor: 'var(--border-subtle)' }}>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium" style={{ color: 'var(--text)' }}>{m.name[l]}</p>
              <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{m.description[l]}</p>
            </div>
            <button
              type="button" role="switch" aria-checked={m.enabled} aria-label={m.name[l]}
              data-testid={`module-toggle-${m.id}`}
              disabled={toggle.isPending}
              onClick={() => toggle.mutate({ id: m.id, enabled: !m.enabled })}
              className="tap px-3 py-2 text-xs font-medium rounded-lg disabled:opacity-50"
              style={m.enabled ? { background: 'var(--text)', color: 'var(--bg-card)' } : { border: '1px solid var(--border)', color: 'var(--text)' }}
            >
              {m.enabled ? t('modules.on') : t('modules.off')}
            </button>
          </li>
        ))}
      </ul>
      {err && <p className="text-xs mt-2 text-red-500">{err}</p>}
    </section>
  );
}
