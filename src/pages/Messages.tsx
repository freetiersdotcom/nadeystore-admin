// → src/pages/Messages.tsx
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, Mail, Phone, MessageCircle, Trash2, Check, RotateCcw } from 'lucide-react';
import { api, type Submission } from '../lib/api';
import { Modal } from '../components/Modal';
import { useT, useLocale } from '../lib/locale-context';
import clsx from 'clsx';

type Filter = 'new' | 'handled' | 'all';

function whatsappLink(phone: string) {
  return `https://wa.me/${phone.replace(/\D/g, '')}`;
}

export function Messages() {
  const t = useT();
  const { intlLocale } = useLocale();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<Filter>('new');
  const [selected, setSelected] = useState<Submission | null>(null);
  const [note, setNote] = useState('');

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['messages', filter],
    queryFn: () => api.getSubmissions({ limit: 100, status: filter === 'all' ? undefined : filter }),
    refetchInterval: 60_000,
  });
  const items = data?.items ?? [];

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['messages'] });
    queryClient.invalidateQueries({ queryKey: ['messages-count'] });
  };

  const update = useMutation({
    mutationFn: ({ id, body }: { id: string; body: { status?: 'new' | 'handled'; note?: string | null } }) =>
      api.updateSubmission(id, body),
    onSuccess: (updated) => {
      setSelected(updated);
      refresh();
    },
  });
  const remove = useMutation({
    mutationFn: (id: string) => api.deleteSubmission(id),
    onSuccess: () => {
      setSelected(null);
      refresh();
    },
  });

  const open = (m: Submission) => {
    setSelected(m);
    setNote(m.note ?? '');
  };

  const tab = (id: Filter, label: string) => (
    <button
      key={id}
      onClick={() => setFilter(id)}
      className={clsx('px-3 py-1.5 rounded-sm text-sm', filter === id ? 'font-medium' : 'hover:bg-[var(--bg-hover)]')}
      style={{
        color: filter === id ? 'var(--sidebar-active-text)' : 'var(--text-secondary)',
        background: filter === id ? 'var(--sidebar-active-bg)' : undefined,
      }}
    >
      {label}
    </button>
  );

  const fmt = (iso: string) =>
    new Date(iso).toLocaleString(intlLocale, { dateStyle: 'medium', timeStyle: 'short' });

  return (
    <div>
      <div className="flex items-center justify-between mb-4 h-9">
        <h1 className="text-lg font-semibold" style={{ color: 'var(--text)' }}>
          {t('messages.title')}
        </h1>
        {isFetching && !isLoading && (
          <Loader2 className="animate-spin" size={16} style={{ color: 'var(--text-muted)' }} />
        )}
      </div>

      <div className="flex gap-1 mb-3">
        {tab('new', t('messages.filter.new'))}
        {tab('handled', t('messages.filter.handled'))}
        {tab('all', t('messages.filter.all'))}
      </div>

      <div
        className="rounded-lg overflow-hidden"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
      >
        {isLoading ? (
          <div className="py-12 flex items-center justify-center">
            <Loader2 size={20} className="animate-spin" style={{ color: 'var(--text-muted)' }} />
          </div>
        ) : items.length === 0 ? (
          <div className="py-12 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
            {t('messages.empty')}
          </div>
        ) : (
          <ul>
            {items.map((m) => (
              <li
                key={m.id}
                onClick={() => open(m)}
                className="px-4 py-3 cursor-pointer transition-colors hover:bg-[var(--bg-hover)]"
                style={{ borderBottom: '1px solid var(--border-subtle)' }}
              >
                <div className="flex items-center gap-2">
                  {m.status === 'new' && (
                    <span className="inline-block w-2 h-2 rounded-full flex-shrink-0" style={{ background: 'var(--accent, #0F6B4B)' }} />
                  )}
                  <span className={clsx('text-sm truncate', m.status === 'new' && 'font-semibold')} style={{ color: 'var(--text)' }}>
                    {m.name || m.email || m.phone}
                  </span>
                  {m.form !== 'contact' && (
                    <span className="text-xs px-1.5 py-0.5 rounded" style={{ border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
                      {m.form}
                    </span>
                  )}
                  <span className="ml-auto text-xs font-mono flex-shrink-0" style={{ color: 'var(--text-muted)' }}>
                    {fmt(m.created_at)}
                  </span>
                </div>
                <p className="text-sm mt-0.5 truncate" style={{ color: 'var(--text-muted)' }}>
                  {m.message}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Modal
        open={!!selected}
        onClose={() => setSelected(null)}
        title={selected?.name || selected?.email || selected?.phone || t('messages.title')}
        size="lg"
      >
        {selected && (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2 text-sm">
              {selected.email && (
                <a href={`mailto:${selected.email}`} className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg" style={{ border: '1px solid var(--border)', color: 'var(--text)' }}>
                  <Mail size={14} /> {selected.email}
                </a>
              )}
              {selected.phone && (
                <>
                  <a href={whatsappLink(selected.phone)} target="_blank" rel="noopener" className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg" style={{ border: '1px solid var(--border)', color: 'var(--text)' }}>
                    <MessageCircle size={14} /> WhatsApp
                  </a>
                  <a href={`tel:${selected.phone}`} className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg" style={{ border: '1px solid var(--border)', color: 'var(--text)' }}>
                    <Phone size={14} /> {selected.phone}
                  </a>
                </>
              )}
            </div>

            <div className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>
              {fmt(selected.created_at)}
              {selected.locale && ` · ${selected.locale.toUpperCase()}`}
              {selected.page && ` · ${selected.page}`}
              {selected.source && ` · ${Object.entries(selected.source).map(([k, v]) => `${k}=${v}`).join(' ')}`}
            </div>

            {selected.subject && (
              <div className="text-sm font-medium" style={{ color: 'var(--text)' }}>{selected.subject}</div>
            )}
            <div
              className="text-sm whitespace-pre-wrap p-3 rounded-lg"
              style={{ border: '1px solid var(--border)', color: 'var(--text)' }}
            >
              {selected.message}
            </div>

            <div>
              <label className="block text-xs font-medium uppercase tracking-wide mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                {t('messages.note')}
              </label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                onBlur={() => {
                  if (note !== (selected.note ?? '')) update.mutate({ id: selected.id, body: { note: note || null } });
                }}
                rows={3}
                placeholder={t('messages.notePlaceholder')}
                className="w-full px-3 py-2 text-sm rounded-lg focus:outline-none focus:ring-2"
                style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text)' }}
              />
            </div>

            <div className="flex items-center justify-between pt-1">
              <button
                onClick={() => {
                  if (window.confirm(t('messages.confirmDelete'))) remove.mutate(selected.id);
                }}
                className="inline-flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg hover:bg-[var(--bg-hover)]"
                style={{ color: 'var(--danger, #b91c1c)' }}
              >
                <Trash2 size={14} /> {t('messages.delete')}
              </button>
              <button
                disabled={update.isPending}
                onClick={() =>
                  update.mutate({ id: selected.id, body: { status: selected.status === 'new' ? 'handled' : 'new' } })
                }
                className="inline-flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg font-medium disabled:opacity-60"
                style={{ background: 'var(--sidebar-active-bg)', color: 'var(--sidebar-active-text)' }}
              >
                {selected.status === 'new' ? <Check size={14} /> : <RotateCcw size={14} />}
                {selected.status === 'new' ? t('messages.markHandled') : t('messages.markNew')}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
