import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, type RecoveryItem } from '../../lib/api';
import { formatPrice } from '../../lib/format';
import { useLocale } from '../../lib/locale-context';

const S = {
  en: {
    title: 'Abandoned carts', help: 'When someone enters their e-mail at checkout and leaves without paying, they get a friendly reminder with a link that refills their cart. At most two reminders, never to someone who bought or opted out.',
    noMail: 'E-mail is not set up yet, so no reminder can be sent. Set it up in Settings first.',
    waiting: 'Waiting', reminded: 'Reminded', recovered: 'Recovered', optout: 'Opted out', revenue: 'Recovered sales',
    settings: 'Timing', first: 'First reminder after (hours)', second: 'Second reminder after (hours, 0 = none)', code: 'Discount code in the second reminder (optional)', codeHelp: 'Create the code in Discounts first, then type it here.',
    cooldown: 'Days between reminders to the same person', maxAge: 'Forget carts older than (days)', save: 'Save', saved: 'Saved.',
    test: 'Send me a test', testTo: 'Send the test to', sent: (a: string) => `Test sent to ${a}.`, run: 'Check now', ran: (n: number) => `${n} reminder(s) sent.`,
    carts: 'Latest carts', empty: 'No abandoned cart yet. They appear here shortly after a customer leaves checkout.', step: 'Reminders', resumed: 'opened the link',
    st: { waiting: 'Waiting', reminded: 'Reminded', recovered: 'Recovered', optout: 'Opted out', closed: 'Closed' },
    why: { converted: 'bought anyway', old: 'too old', invalid: 'no usable address', optout: 'opted out' } as Record<string, string>,
  },
  fr: {
    title: 'Paniers abandonnés', help: 'Quand quelqu’un saisit son e-mail au paiement puis part sans payer, il reçoit un rappel aimable avec un lien qui remplit à nouveau son panier. Deux rappels au maximum, jamais à quelqu’un qui a acheté ou s’est désinscrit.',
    noMail: 'L’e-mail n’est pas encore configuré : aucun rappel ne peut partir. Configurez-le d’abord dans les réglages.',
    waiting: 'En attente', reminded: 'Relancés', recovered: 'Récupérés', optout: 'Désinscrits', revenue: 'Ventes récupérées',
    settings: 'Délais', first: 'Premier rappel après (heures)', second: 'Second rappel après (heures, 0 = aucun)', code: 'Code de réduction dans le second rappel (facultatif)', codeHelp: 'Créez d’abord le code dans Remises, puis saisissez-le ici.',
    cooldown: 'Jours entre deux rappels à la même personne', maxAge: 'Oublier les paniers de plus de (jours)', save: 'Enregistrer', saved: 'Enregistré.',
    test: 'M’envoyer un test', testTo: 'Envoyer le test à', sent: (a: string) => `Test envoyé à ${a}.`, run: 'Vérifier maintenant', ran: (n: number) => `${n} rappel(s) envoyé(s).`,
    carts: 'Derniers paniers', empty: 'Aucun panier abandonné pour le moment. Ils apparaissent ici peu après qu’un client quitte le paiement.', step: 'Rappels', resumed: 'a ouvert le lien',
    st: { waiting: 'En attente', reminded: 'Relancé', recovered: 'Récupéré', optout: 'Désinscrit', closed: 'Clos' },
    why: { converted: 'a acheté quand même', old: 'trop ancien', invalid: 'adresse inutilisable', optout: 'désinscrit' } as Record<string, string>,
  },
};
const inputStyle = { background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text)' };
const inputCls = 'w-full px-3 py-2.5 md:py-2 text-sm rounded-lg focus:outline-none focus:ring-2';
const labelCls = 'block text-xs font-medium uppercase tracking-wide mb-1';
const muted = { color: 'var(--text-secondary)' };
const btn = 'tap inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg disabled:opacity-50';
const ghost = { border: '1px solid var(--border)', color: 'var(--text)' };
const solid = { background: 'var(--text)', color: 'var(--bg-card)' };
const COLOR: Record<RecoveryItem['state'], string> = { waiting: 'var(--text-muted)', reminded: '#d97706', recovered: '#16a34a', optout: '#dc2626', closed: 'var(--text-muted)' };

export function Recovery({ canWrite }: { canWrite: boolean }) {
  const { locale } = useLocale(); const s = S[locale === 'en' ? 'en' : 'fr']; const lang = locale === 'en' ? 'en' : 'fr';
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ['recovery'], queryFn: () => api.getRecovery() });
  const [f, setF] = useState<Record<string, string> | null>(null);
  const [note, setNote] = useState(''); const [err, setErr] = useState(''); const [to, setTo] = useState('');
  if (!data) return null;
  const st = data.settings;
  const v = f ?? { a: String(st.step1_hours), b: String(st.step2_hours), code: st.discount_code ?? '', c: String(st.cooldown_days), m: String(st.max_age_days) };
  const set = (k: string, val: string) => setF({ ...v, [k]: val });
  const save = useMutation({
    mutationFn: () => api.saveRecoverySettings({ step1_hours: parseInt(v.a, 10), step2_hours: parseInt(v.b, 10), discount_code: v.code.trim() || null, cooldown_days: parseInt(v.c, 10), max_age_days: parseInt(v.m, 10) }),
    onSuccess: () => { setErr(''); setNote(s.saved); setF(null); qc.invalidateQueries({ queryKey: ['recovery'] }); }, onError: (e: any) => { setNote(''); setErr(e.message); },
  });
  const test = useMutation({ mutationFn: (step: number) => api.testRecovery({ to: to || undefined, step, lang }), onSuccess: (r) => { setErr(''); setNote(s.sent(r.sent_to)); }, onError: (e: any) => { setNote(''); setErr(e.message); } });
  const run = useMutation({ mutationFn: () => api.runRecovery(), onSuccess: (r) => { setErr(''); setNote(s.ran(r.sent)); qc.invalidateQueries({ queryKey: ['recovery'] }); }, onError: (e: any) => setErr(e.message) });
  const tile = (label: string, val: React.ReactNode, tid: string) => (
    <div className="p-3" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}><div className="text-xs" style={muted}>{label}</div><div className="text-lg font-semibold" style={{ color: 'var(--text)' }} data-testid={tid}>{val}</div></div>
  );
  return (
    <div className="space-y-5" data-testid="recovery-page">
      <div>
        <h1 className="text-lg font-semibold" style={{ color: 'var(--text)' }}>{s.title}</h1>
        <p className="text-xs" style={muted}>{s.help}</p>
        {!data.has_email && <p className="text-sm mt-2" style={{ color: '#d97706' }}>{s.noMail}</p>}
        {note && <p className="text-xs mt-1" role="status" style={{ color: 'var(--text)' }}>{note}</p>}
        {err && <p className="text-sm mt-1" style={{ color: '#dc2626' }}>{err}</p>}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
        {tile(s.waiting, data.stats.waiting, 'r-waiting')}{tile(s.reminded, data.stats.reminded, 'r-reminded')}{tile(s.recovered, data.stats.recovered, 'r-recovered')}{tile(s.optout, data.stats.optout, 'r-optout')}
        {tile(s.revenue, data.stats.recovered_revenue.length ? data.stats.recovered_revenue.map((r) => formatPrice(r.cents, r.currency)).join(' + ') : '—', 'r-revenue')}
      </div>

      {canWrite && (
        <div className="p-3 space-y-3" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
          <h2 className="text-sm font-semibold" style={{ color: 'var(--text)' }}>{s.settings}</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <div><label className={labelCls} style={muted}>{s.first}</label><input inputMode="numeric" className={inputCls} style={inputStyle} value={v.a} onChange={(e) => set('a', e.target.value)} data-testid="r-h1" /></div>
            <div><label className={labelCls} style={muted}>{s.second}</label><input inputMode="numeric" className={inputCls} style={inputStyle} value={v.b} onChange={(e) => set('b', e.target.value)} data-testid="r-h2" /></div>
            <div className="sm:col-span-2"><label className={labelCls} style={muted}>{s.code}</label><input className={inputCls} style={inputStyle} value={v.code} onChange={(e) => set('code', e.target.value)} data-testid="r-code" /><p className="text-xs mt-1" style={muted}>{s.codeHelp}</p></div>
            <div><label className={labelCls} style={muted}>{s.cooldown}</label><input inputMode="numeric" className={inputCls} style={inputStyle} value={v.c} onChange={(e) => set('c', e.target.value)} /></div>
            <div><label className={labelCls} style={muted}>{s.maxAge}</label><input inputMode="numeric" className={inputCls} style={inputStyle} value={v.m} onChange={(e) => set('m', e.target.value)} /></div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button className={btn} style={solid} disabled={save.isPending} onClick={() => save.mutate()} data-testid="r-save">{s.save}</button>
            <button className={btn} style={ghost} disabled={run.isPending} onClick={() => run.mutate()}>{s.run}</button>
          </div>
          <div className="flex flex-wrap items-center gap-2 pt-2" style={{ borderTop: '1px solid var(--border)' }}>
            <input type="email" className={inputCls} style={{ ...inputStyle, flex: '1 1 200px', width: 'auto' }} placeholder={s.testTo} value={to} onChange={(e) => setTo(e.target.value)} />
            <button className={btn} style={ghost} disabled={test.isPending} onClick={() => test.mutate(1)}>{s.test} (1)</button>
            <button className={btn} style={ghost} disabled={test.isPending} onClick={() => test.mutate(2)}>{s.test} (2)</button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        <h2 className="text-sm font-semibold" style={{ color: 'var(--text)' }}>{s.carts}</h2>
        {data.items.length === 0 && <p className="text-sm" style={muted}>{s.empty}</p>}
        {data.items.map((c) => (
          <div key={c.cart_id} className="p-3 text-sm flex flex-wrap items-center gap-x-4 gap-y-1" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
            <b className="break-all" style={{ color: 'var(--text)' }}>{c.email}</b>
            <span style={muted}>{c.items.map((i) => `${i.title} × ${i.qty}`).join(', ')}</span>
            <span>{formatPrice(c.total_cents, c.currency)}</span>
            <span className="text-xs font-medium" style={{ color: COLOR[c.state] }}>{s.st[c.state]}{c.closed && c.state === 'closed' ? ` (${s.why[c.closed] ?? c.closed})` : ''}</span>
            <span className="text-xs" style={muted}>{s.step}: {c.step}{c.resumed ? ` · ${s.resumed}` : ''}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
