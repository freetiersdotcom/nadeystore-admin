import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, Plus, Trash2, Pencil, CalendarClock, Ban } from 'lucide-react';
import clsx from 'clsx';
import { api, BookingService, BookingRule, AgendaItem } from '../lib/api';
import { Modal } from '../components/Modal';
import { useT } from '../lib/locale-context';

type Tab = 'agenda' | 'services' | 'blocks';

// ── helpers ───────────────────────────────────────────────────────────────

const DAYS = [1, 2, 3, 4, 5, 6, 0]; // Monday first

/** ISO (UTC) -> value for <input type="datetime-local"> in the browser's zone */
function toLocalInput(iso: string): string {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}
const fromLocalInput = (v: string) => new Date(v).toISOString();

function fmtDay(iso: string, loc: string) {
  return new Intl.DateTimeFormat(loc, { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(iso));
}
function fmtTime(iso: string, loc: string) {
  return new Intl.DateTimeFormat(loc, { hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
}
function fmtDateTime(iso: string, loc: string) {
  return new Intl.DateTimeFormat(loc, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso));
}

const inputCls = 'w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm';
const btnPrimary = 'inline-flex items-center gap-2 rounded-lg bg-gray-900 dark:bg-white text-white dark:text-gray-900 px-3 py-2 text-sm font-medium disabled:opacity-50';
const btnGhost = 'inline-flex items-center gap-1.5 rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-1.5 text-sm hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50';

// ── page ──────────────────────────────────────────────────────────────────

export function Appointments() {
  const t = useT();
  const [tab, setTab] = useState<Tab>('agenda');
  const tabs: Array<[Tab, string]> = [['agenda', t('appt.tab.agenda')], ['services', t('appt.tab.services')], ['blocks', t('appt.tab.blocks')]];
  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto">
      <h1 className="text-xl font-semibold mb-4">{t('appt.title')}</h1>
      <div className="flex gap-1 mb-6 border-b border-gray-200 dark:border-gray-800">
        {tabs.map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)}
            className={clsx('px-4 py-2 text-sm -mb-px border-b-2', tab === id ? 'border-gray-900 dark:border-white font-medium' : 'border-transparent text-gray-500')}>
            {label}
          </button>
        ))}
      </div>
      {tab === 'agenda' && <AgendaTab />}
      {tab === 'services' && <ServicesTab />}
      {tab === 'blocks' && <BlocksTab />}
    </div>
  );
}

// ── agenda ────────────────────────────────────────────────────────────────

function AgendaTab() {
  const t = useT();
  const loc = t('appt.locale');
  const qc = useQueryClient();
  const [showPast, setShowPast] = useState(false);
  const [moving, setMoving] = useState<{ id?: string; orderId?: string; label: string; current?: string } | null>(null);
  const [when, setWhen] = useState('');
  const [notify, setNotify] = useState(true);
  const [error, setError] = useState('');

  const q = useQuery({
    queryKey: ['agenda', showPast],
    queryFn: () => api.getAgenda(showPast
      ? { from: new Date(Date.now() - 90 * 86400_000).toISOString(), status: 'all' }
      : { from: new Date().toISOString(), status: 'booked' }),
  });
  const refresh = () => qc.invalidateQueries({ queryKey: ['agenda'] });

  const save = useMutation({
    mutationFn: async () => {
      const start = fromLocalInput(when);
      if (moving?.id) return api.moveAppointment(moving.id, { start, notify });
      return api.bookAppointment({ order_id: moving!.orderId!, start, notify });
    },
    onSuccess: () => { setMoving(null); setError(''); refresh(); },
    onError: (e: any) => setError(e.message),
  });
  const cancel = useMutation({
    mutationFn: (id: string) => api.cancelAppointment(id, { notify: true }),
    onSuccess: refresh,
    onError: (e: any) => alert(e.message),
  });

  const items = (q.data?.items ?? []) as AgendaItem[];
  const groups = new Map<string, AgendaItem[]>();
  for (const it of items) {
    const k = fmtDay(it.starts_at, loc);
    groups.set(k, [...(groups.get(k) ?? []), it]);
  }

  const open = (m: NonNullable<typeof moving>) => {
    setMoving(m); setError(''); setNotify(true);
    setWhen(m.current ? toLocalInput(m.current) : '');
  };

  if (q.isLoading) return <Loader2 className="animate-spin" />;
  return (
    <div className="space-y-6">
      {(q.data?.unscheduled?.length ?? 0) > 0 && (
        <div className="rounded-xl border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 p-4">
          <h2 className="font-medium mb-1">{t('appt.toSchedule')}</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">{t('appt.toScheduleHint')}</p>
          <ul className="divide-y divide-amber-200 dark:divide-amber-800">
            {q.data!.unscheduled.map((u) => (
              <li key={u.order_id} className="py-2 flex items-center justify-between gap-3 text-sm">
                <span><strong>{u.order_number}</strong> · {u.customer_email}
                  {u.review_reason ? <span className="block text-xs text-amber-700 dark:text-amber-400">{u.review_reason}</span> : null}</span>
                <button className={btnGhost} onClick={() => open({ orderId: u.order_id, label: `${u.order_number} · ${u.customer_email}` })}>
                  <CalendarClock size={14} /> {t('appt.schedule')}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex items-center justify-between">
        <h2 className="font-medium">{showPast ? t('appt.allRecent') : t('appt.upcoming')}</h2>
        <label className="text-sm flex items-center gap-2">
          <input type="checkbox" checked={showPast} onChange={(e) => setShowPast(e.target.checked)} /> {t('appt.showPast')}
        </label>
      </div>

      {items.length === 0 && <p className="text-sm text-gray-500">{t('appt.empty')}</p>}

      {[...groups.entries()].map(([day, rows]) => (
        <div key={day}>
          <h3 className="text-sm font-semibold capitalize mb-2">{day}</h3>
          <ul className="rounded-xl border border-gray-200 dark:border-gray-800 divide-y divide-gray-100 dark:divide-gray-800">
            {rows.map((a) => (
              <li key={a.id} className={clsx('p-3 flex flex-wrap items-center justify-between gap-3', a.status === 'canceled' && 'opacity-50')}>
                <div className="text-sm">
                  <div className="font-medium">{fmtTime(a.starts_at, loc)} – {fmtTime(a.ends_at, loc)} · {a.title}</div>
                  <div className="text-gray-500">{a.order_number} · {a.customer_name ? a.customer_name + ' · ' : ''}{a.customer_email}</div>
                  {a.status === 'canceled' && <div className="text-xs text-red-600">{t('appt.canceled')}</div>}
                </div>
                {a.status === 'booked' && (
                  <div className="flex gap-2">
                    <button className={btnGhost} onClick={() => open({ id: a.id, label: `${a.title} · ${a.order_number}`, current: a.starts_at })}>
                      <Pencil size={14} /> {t('appt.move')}
                    </button>
                    <button className={btnGhost} disabled={cancel.isPending}
                      onClick={() => { if (confirm(t('appt.confirmCancel'))) cancel.mutate(a.id); }}>
                      <Ban size={14} /> {t('appt.cancel')}
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      ))}

      <Modal open={!!moving} onClose={() => setMoving(null)} title={moving?.id ? t('appt.moveTitle') : t('appt.scheduleTitle')}>
        <div className="space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">{moving?.label}</p>
          <label className="block text-sm">
            <span className="block mb-1">{t('appt.newTime')}</span>
            <input type="datetime-local" className={inputCls} value={when} onChange={(e) => setWhen(e.target.value)} />
          </label>
          <label className="text-sm flex items-center gap-2">
            <input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} /> {t('appt.notify')}
          </label>
          <p className="text-xs text-gray-500">{t('appt.overrideHint')}</p>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-2">
            <button className={btnGhost} onClick={() => setMoving(null)}>{t('appt.close')}</button>
            <button className={btnPrimary} disabled={!when || save.isPending} onClick={() => save.mutate()}>
              {save.isPending && <Loader2 size={14} className="animate-spin" />} {t('appt.save')}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

// ── services ──────────────────────────────────────────────────────────────

type Draft = {
  enabled: boolean; tz: string; rules: BookingRule[];
  lead_hours: number; horizon_days: number; buffer_min: number; step_min: number;
  default_duration_min: number; durations: Record<string, number>;
};

const DEFAULT_DRAFT = (tz: string): Draft => ({
  enabled: true, tz, lead_hours: 24, horizon_days: 60, buffer_min: 0, step_min: 30, default_duration_min: 60, durations: {},
  rules: [1, 2, 3, 4, 5].map((dow) => ({ dow, start: '09:00', end: '17:00' })),
});

function ServicesTab() {
  const t = useT();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['booking-services'], queryFn: () => api.getBookingServices() });
  const [editing, setEditing] = useState<BookingService | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState('');

  const save = useMutation({
    mutationFn: () => api.saveBookingService(editing!.product_id, draft!),
    onSuccess: () => { setEditing(null); qc.invalidateQueries({ queryKey: ['booking-services'] }); },
    onError: (e: any) => setError(e.message),
  });

  const edit = (s: BookingService) => {
    const b = s.booking;
    setDraft(b ? {
      enabled: b.enabled, tz: b.tz, rules: b.rules, lead_hours: b.lead_hours, horizon_days: b.horizon_days,
      buffer_min: b.buffer_min, step_min: b.step_min, default_duration_min: b.default_duration_min, durations: { ...b.durations },
    } : DEFAULT_DRAFT(q.data!.default_tz));
    setError(''); setEditing(s);
  };
  const num = (v: string) => Math.max(0, Math.floor(Number(v) || 0));
  const set = (patch: Partial<Draft>) => setDraft((d) => ({ ...d!, ...patch }));
  const dayLabel = (d: number) => t(`appt.day.${d}` as any);

  const summary = (b: BookingService['booking']) => {
    if (!b || !b.enabled) return t('appt.off');
    const byDay = DAYS.filter((d) => b.rules.some((r) => r.dow === d))
      .map((d) => `${dayLabel(d)} ${b.rules.filter((r) => r.dow === d).map((r) => `${r.start}–${r.end}`).join(', ')}`);
    return byDay.join(' · ') || t('appt.off');
  };

  if (q.isLoading) return <Loader2 className="animate-spin" />;
  const items = q.data?.items ?? [];
  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500">{t('appt.servicesHint')}</p>
      {items.length === 0 && <p className="text-sm text-gray-500">{t('appt.noServices')}</p>}
      {items.map((s) => (
        <div key={s.product_id} className="rounded-xl border border-gray-200 dark:border-gray-800 p-4 flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="font-medium">{s.title}</div>
            <div className="text-sm text-gray-500">{summary(s.booking)}</div>
          </div>
          <div className="flex items-center gap-2">
            <span className={clsx('text-xs px-2 py-0.5 rounded-full', s.booking?.enabled ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400')}>
              {s.booking?.enabled ? t('appt.bookingOn') : t('appt.bookingOff')}
            </span>
            <button className={btnGhost} onClick={() => edit(s)}><Pencil size={14} /> {t('appt.configure')}</button>
          </div>
        </div>
      ))}

      <Modal open={!!editing && !!draft} onClose={() => setEditing(null)} title={editing?.title ?? ''} size="lg">
        {draft && editing && (
          <div className="space-y-5">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={draft.enabled} onChange={(e) => set({ enabled: e.target.checked })} /> {t('appt.enable')}
            </label>

            <div>
              <h4 className="text-sm font-medium mb-2">{t('appt.hours')}</h4>
              <div className="space-y-2">
                {DAYS.map((d) => {
                  const rows = draft.rules.map((r, i) => ({ r, i })).filter((x) => x.r.dow === d);
                  return (
                    <div key={d} className="flex flex-wrap items-start gap-2 text-sm">
                      <div className="w-24 pt-2">{dayLabel(d)}</div>
                      <div className="flex-1 space-y-1">
                        {rows.length === 0 && <div className="pt-2 text-gray-400">{t('appt.closed')}</div>}
                        {rows.map(({ r, i }) => (
                          <div key={i} className="flex items-center gap-2">
                            <input type="time" className={clsx(inputCls, 'w-32')} value={r.start}
                              onChange={(e) => set({ rules: draft.rules.map((x, j) => j === i ? { ...x, start: e.target.value } : x) })} />
                            <span>–</span>
                            <input type="time" className={clsx(inputCls, 'w-32')} value={r.end}
                              onChange={(e) => set({ rules: draft.rules.map((x, j) => j === i ? { ...x, end: e.target.value } : x) })} />
                            <button className="p-1 text-gray-400 hover:text-red-600" onClick={() => set({ rules: draft.rules.filter((_, j) => j !== i) })}><Trash2 size={14} /></button>
                          </div>
                        ))}
                      </div>
                      <button className={btnGhost} onClick={() => set({ rules: [...draft.rules, { dow: d, start: '09:00', end: '12:00' }] })}><Plus size={14} /></button>
                    </div>
                  );
                })}
              </div>
            </div>

            <div>
              <h4 className="text-sm font-medium mb-2">{t('appt.durations')}</h4>
              <div className="space-y-2">
                {editing.variants.map((v) => (
                  <div key={v.sku} className="flex items-center gap-3 text-sm">
                    <span className="flex-1 truncate">{v.title} <span className="text-gray-400">({v.sku})</span></span>
                    <input type="number" min={5} className={clsx(inputCls, 'w-24')} placeholder={String(draft.default_duration_min)}
                      value={draft.durations[v.sku] ?? ''}
                      onChange={(e) => {
                        const next = { ...draft.durations };
                        if (e.target.value === '') delete next[v.sku]; else next[v.sku] = num(e.target.value);
                        set({ durations: next });
                      }} />
                    <span className="text-gray-500 w-10">min</span>
                  </div>
                ))}
              </div>
              <label className="flex items-center gap-3 text-sm mt-3">
                <span className="flex-1">{t('appt.defaultDuration')}</span>
                <input type="number" min={5} className={clsx(inputCls, 'w-24')} value={draft.default_duration_min} onChange={(e) => set({ default_duration_min: num(e.target.value) })} />
                <span className="text-gray-500 w-10">min</span>
              </label>
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm">
              <label><span className="block mb-1">{t('appt.lead')}</span>
                <input type="number" min={0} className={inputCls} value={draft.lead_hours} onChange={(e) => set({ lead_hours: num(e.target.value) })} /></label>
              <label><span className="block mb-1">{t('appt.horizon')}</span>
                <input type="number" min={1} className={inputCls} value={draft.horizon_days} onChange={(e) => set({ horizon_days: num(e.target.value) })} /></label>
              <label><span className="block mb-1">{t('appt.buffer')}</span>
                <input type="number" min={0} className={inputCls} value={draft.buffer_min} onChange={(e) => set({ buffer_min: num(e.target.value) })} /></label>
              <label><span className="block mb-1">{t('appt.step')}</span>
                <input type="number" min={5} className={inputCls} value={draft.step_min} onChange={(e) => set({ step_min: num(e.target.value) })} /></label>
              <label className="col-span-2"><span className="block mb-1">{t('appt.tz')}</span>
                <input className={inputCls} value={draft.tz} onChange={(e) => set({ tz: e.target.value })} /></label>
            </div>
            <p className="text-xs text-gray-500">{t('appt.sharedAgenda')}</p>

            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="flex justify-end gap-2">
              <button className={btnGhost} onClick={() => setEditing(null)}>{t('appt.close')}</button>
              <button className={btnPrimary} disabled={save.isPending} onClick={() => save.mutate()}>
                {save.isPending && <Loader2 size={14} className="animate-spin" />} {t('appt.save')}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

// ── blocked periods ───────────────────────────────────────────────────────

function BlocksTab() {
  const t = useT();
  const loc = t('appt.locale');
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['agenda', 'blocks'], queryFn: () => api.getAgenda({ from: new Date().toISOString(), to: new Date(Date.now() + 365 * 86400_000).toISOString(), status: 'booked' }) });
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const refresh = () => { qc.invalidateQueries({ queryKey: ['agenda'] }); };

  const add = useMutation({
    mutationFn: () => api.addBlock({ starts_at: fromLocalInput(from), ends_at: fromLocalInput(to), note: note || null }),
    onSuccess: () => { setFrom(''); setTo(''); setNote(''); setError(''); refresh(); },
    onError: (e: any) => setError(e.message),
  });
  const del = useMutation({ mutationFn: (id: string) => api.deleteBlock(id), onSuccess: refresh });

  return (
    <div className="space-y-6">
      <p className="text-sm text-gray-500">{t('appt.blocksHint')}</p>
      <div className="rounded-xl border border-gray-200 dark:border-gray-800 p-4 grid sm:grid-cols-4 gap-3 items-end text-sm">
        <label><span className="block mb-1">{t('appt.from')}</span><input type="datetime-local" className={inputCls} value={from} onChange={(e) => setFrom(e.target.value)} /></label>
        <label><span className="block mb-1">{t('appt.to')}</span><input type="datetime-local" className={inputCls} value={to} onChange={(e) => setTo(e.target.value)} /></label>
        <label><span className="block mb-1">{t('appt.note')}</span><input className={inputCls} value={note} onChange={(e) => setNote(e.target.value)} /></label>
        <button className={btnPrimary} disabled={!from || !to || add.isPending} onClick={() => add.mutate()}><Plus size={14} /> {t('appt.addBlock')}</button>
        {error && <p className="sm:col-span-4 text-red-600">{error}</p>}
      </div>
      {q.isLoading ? <Loader2 className="animate-spin" /> : (
        <ul className="rounded-xl border border-gray-200 dark:border-gray-800 divide-y divide-gray-100 dark:divide-gray-800">
          {(q.data?.blocks ?? []).length === 0 && <li className="p-4 text-sm text-gray-500">{t('appt.noBlocks')}</li>}
          {(q.data?.blocks ?? []).map((b) => (
            <li key={b.id} className="p-3 flex items-center justify-between gap-3 text-sm">
              <span>{fmtDateTime(b.starts_at, loc)} → {fmtDateTime(b.ends_at, loc)}{b.note ? <span className="text-gray-500"> · {b.note}</span> : null}</span>
              <button className="p-1 text-gray-400 hover:text-red-600" onClick={() => del.mutate(b.id)}><Trash2 size={14} /></button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
