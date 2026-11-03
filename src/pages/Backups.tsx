import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Download, Loader2 } from 'lucide-react';
import { api } from '../lib/api';
import { useT } from '../lib/locale-context';
import { useIntlDate } from './teamDate';

const card = { background: 'var(--bg-card)', border: '1px solid var(--border)' };
const btn = 'inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg disabled:opacity-50';
const ghost = { border: '1px solid var(--border)', color: 'var(--text)' };

/** Owner-only: a copy of all shop data that does not depend on Cloudflare. */
export function BackupCard() {
  const t = useT();
  const fmt = useIntlDate();
  const qc = useQueryClient();
  const [msg, setMsg] = useState<string | null>(null);
  const { data } = useQuery({ queryKey: ['backups'], queryFn: () => api.getBackups() });
  const fail = (e: unknown) => setMsg(e instanceof Error ? e.message : String(e));
  const run = useMutation({
    mutationFn: () => api.runBackup(),
    onSuccess: (r) => { setMsg(t('backup.done').replace('{n}', String(r.rows))); qc.invalidateQueries({ queryKey: ['backups'] }); },
    onError: fail,
  });
  const download = useMutation({ mutationFn: (name?: string) => api.downloadBackup(name), onError: fail });
  const kb = (n: number) => `${Math.max(1, Math.round(n / 1024))} KB`;

  return (
    <section className="p-5" style={card} data-testid="backup-card">
      <h2 className="text-sm font-semibold mb-1" style={{ color: 'var(--text)' }}>{t('backup.title')}</h2>
      <p className="text-xs mb-3" style={{ color: 'var(--text-secondary)' }}>{t('backup.help')}</p>
      <div className="flex flex-wrap gap-2">
        <button className={btn} style={ghost} disabled={download.isPending} onClick={() => { setMsg(null); download.mutate(undefined); }}>
          {download.isPending ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />} {t('backup.downloadNow')}
        </button>
        {data?.configured && (
          <button className={btn} style={ghost} disabled={run.isPending} onClick={() => { setMsg(null); run.mutate(); }}>
            {run.isPending && <Loader2 size={14} className="animate-spin" />} {t('backup.runNow')}
          </button>
        )}
      </div>
      {msg && <p className="text-xs mt-2" style={{ color: 'var(--text-secondary)' }}>{msg}</p>}
      {data && !data.configured && <p className="text-xs mt-3" style={{ color: 'var(--text-muted)' }}>{t('backup.notConfigured')}</p>}
      {data?.configured && (data.backups.length === 0
        ? <p className="text-xs mt-3" style={{ color: 'var(--text-muted)' }}>{t('backup.none')}</p>
        : (
          <ul className="mt-3 text-xs divide-y" style={{ borderColor: 'var(--border-subtle)' }}>
            {data.backups.map((b) => (
              <li key={b.name} className="py-2 flex flex-wrap items-center gap-x-3 gap-y-1" style={{ borderColor: 'var(--border-subtle)' }}>
                <span className="font-mono" style={{ color: 'var(--text)' }}>{b.name.replace('.ndjson.gz', '')}</span>
                <span style={{ color: 'var(--text-muted)' }}>{kb(b.size)} · {fmt(b.uploaded)}</span>
                <button className="tap ml-auto underline" style={{ color: 'var(--text-secondary)' }} onClick={() => download.mutate(b.name)}>{t('backup.download')}</button>
              </li>
            ))}
          </ul>
        ))}
    </section>
  );
}
