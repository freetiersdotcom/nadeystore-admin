import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, Plus, Trash2, Truck, AlertTriangle } from 'lucide-react';
import { api, ShippingZone, ShippingRate, ShippingSettings, ShippingQuote } from '../lib/api';
import { useLocale } from '../lib/locale-context';
import { countryList } from '../lib/geo';

// Delivery zones and rates. A zone is a set of countries (or the whole world), optionally narrowed to
// some cities; the most specific zone wins. Each zone has one or more rates: flat, by weight, or pickup.

const L = {
  en: {
    title: 'Shipping', intro: 'Zones and rates used at checkout. The most specific zone wins: a city beats a country, a country beats the rest of the world.',
    enabled: 'Charge shipping at checkout', enabledHint: 'While this is off, customers see no shipping and orders have 0 shipping, exactly as before.',
    defWeight: 'Weight used when a product has none (g per unit)', freeOver: 'Free shipping from this goods total (empty = never)',
    currency: 'Rates currency', fx: 'Exchange rate for other currencies (rates currency per 1 unit)', fxHint: 'Needed only if the shop sells in another currency. EUR is preset to the CFA parity.',
    save: 'Save', saved: 'Saved', missingTitle: 'Products without a weight', missingHint: 'Their weight is replaced by the default above, so shipping is only approximate. Enter the real weights (grams).',
    sku: 'SKU', grams: 'g', zones: 'Zones', addZone: 'Add a zone', zoneName: 'Zone name', countries: 'Countries', addCountry: 'Add a country…', world: 'Rest of the world',
    regions: 'Only these cities / regions (comma separated, empty = whole country)', active: 'Active', del: 'Delete', rates: 'Rates', addRate: 'Add a rate',
    nameFr: 'Name (French)', nameEn: 'Name (English)', kind: 'Type', flat: 'Flat price', weight: 'By weight', pickup: 'Pickup (free)',
    price: 'Price', bands: 'Weight bands', upTo: 'Up to (g)', addBand: 'Add a band', overKg: 'Above the last band: price per extra kg (empty = not available)',
    freeRate: 'Free from this goods total (empty = store setting)', minDays: 'Days min', maxDays: 'Days max', address: 'Pickup address',
    empty: 'No zone yet.', starter: 'Load example zones', starterHint: 'Creates editable examples (Cotonou, Benin, West Africa, Europe, world). The prices are placeholders: replace them with the real ones.',
    test: 'Try a destination', country: 'Country', city: 'City', weightG: 'Weight (g)', run: 'Calculate', noZone: 'No zone covers this destination.', tooHeavy: 'Too heavy for every rate of the zone.',
    confirmDel: 'Delete this?', error: 'Error', free: 'Free', estimated: 'Weights estimated',
  },
  fr: {
    title: 'Livraison', intro: 'Zones et tarifs utilisés à la commande. La zone la plus précise l’emporte : une ville passe avant un pays, un pays avant le reste du monde.',
    enabled: 'Facturer la livraison à la commande', enabledHint: 'Tant que c’est désactivé, les clients ne voient pas de livraison et les commandes ont 0 de frais, comme avant.',
    defWeight: 'Poids utilisé quand un produit n’en a pas (g par unité)', freeOver: 'Livraison offerte à partir de ce total de produits (vide = jamais)',
    currency: 'Devise des tarifs', fx: 'Taux pour les autres devises (devise des tarifs pour 1 unité)', fxHint: 'Utile seulement si la boutique vend dans une autre devise. L’EUR est préréglé à la parité du FCFA.',
    save: 'Enregistrer', saved: 'Enregistré', missingTitle: 'Produits sans poids', missingHint: 'Leur poids est remplacé par la valeur par défaut ci-dessus : la livraison n’est qu’approximative. Saisissez les vrais poids (grammes).',
    sku: 'SKU', grams: 'g', zones: 'Zones', addZone: 'Ajouter une zone', zoneName: 'Nom de la zone', countries: 'Pays', addCountry: 'Ajouter un pays…', world: 'Reste du monde',
    regions: 'Seulement ces villes / régions (séparées par des virgules, vide = tout le pays)', active: 'Active', del: 'Supprimer', rates: 'Tarifs', addRate: 'Ajouter un tarif',
    nameFr: 'Nom (français)', nameEn: 'Nom (anglais)', kind: 'Type', flat: 'Prix fixe', weight: 'Selon le poids', pickup: 'Retrait (gratuit)',
    price: 'Prix', bands: 'Tranches de poids', upTo: 'Jusqu’à (g)', addBand: 'Ajouter une tranche', overKg: 'Au-delà de la dernière tranche : prix par kg supplémentaire (vide = indisponible)',
    freeRate: 'Offert à partir de ce total de produits (vide = réglage de la boutique)', minDays: 'Jours min', maxDays: 'Jours max', address: 'Adresse de retrait',
    empty: 'Aucune zone pour le moment.', starter: 'Charger des zones d’exemple', starterHint: 'Crée des exemples modifiables (Cotonou, Bénin, Afrique de l’Ouest, Europe, monde). Les prix sont fictifs : remplacez-les par les vrais.',
    test: 'Tester une destination', country: 'Pays', city: 'Ville', weightG: 'Poids (g)', run: 'Calculer', noZone: 'Aucune zone ne couvre cette destination.', tooHeavy: 'Trop lourd pour tous les tarifs de la zone.',
    confirmDel: 'Supprimer ?', error: 'Erreur', free: 'Gratuit', estimated: 'Poids estimés',
  },
} as const;

const ZERO_DECIMAL = new Set(['XOF', 'XAF', 'GNF', 'JPY', 'KRW', 'RWF', 'UGX', 'VND', 'CLP', 'PYG', 'KMF', 'DJF', 'BIF', 'MGA', 'VUV', 'XPF']);
const factor = (cur: string) => (ZERO_DECIMAL.has(cur.toUpperCase()) ? 1 : 100);

const inputCls = 'w-full px-3 py-2 text-sm rounded-lg focus:outline-none focus:ring-2';
const inputStyle = { background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text)' };
const card = 'rounded-xl border p-4';
const cardStyle = { background: 'var(--bg-card)', borderColor: 'var(--border)' };
const btn = 'inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg disabled:opacity-50';
const btnPrimary = { background: 'var(--accent, #2563eb)', color: '#fff' };
const btnGhost = { border: '1px solid var(--border)', color: 'var(--text)' };
const lab = 'block text-xs font-medium uppercase tracking-wide mb-1';
const labStyle = { color: 'var(--text-secondary)' };

type Txt = { [K in keyof (typeof L)['en']]: string };

// An amount typed in whole units ("1500") <-> stored in the smallest unit.
const toUnits = (cents: number | null, cur: string) => (cents == null ? '' : String(cents / factor(cur)));
const toCents = (v: string, cur: string): number | null => (v.trim() === '' || !Number.isFinite(Number(v)) ? null : Math.round(Number(v) * factor(cur)));

export function Shipping() {
  const { locale } = useLocale();
  const t: Txt = String(locale) === 'fr' ? L.fr : L.en;
  const qc = useQueryClient();
  const settings = useQuery({ queryKey: ['ship-settings'], queryFn: () => api.getShippingSettings() });
  const zones = useQuery({ queryKey: ['ship-zones'], queryFn: () => api.getShippingZones() });
  const missing = useQuery({ queryKey: ['ship-missing'], queryFn: () => api.getShippingMissingWeights() });
  const refresh = () => { qc.invalidateQueries({ queryKey: ['ship-zones'] }); };
  const onError = (e: unknown) => alert(e instanceof Error ? e.message : String(e));

  const starter = useMutation({ mutationFn: () => api.loadShippingStarter(), onSuccess: refresh, onError });
  const addZone = useMutation({
    mutationFn: () => api.createShippingZone({ name: t.zoneName, countries: ['BJ'], regions: [], active: true, position: (zones.data?.data.length ?? 0) }),
    onSuccess: refresh, onError,
  });

  if (settings.isLoading || zones.isLoading) return <Loader2 className="animate-spin" />;
  const cur = settings.data?.base_currency ?? 'XOF';

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-xl font-semibold flex items-center gap-2" style={{ color: 'var(--text)' }}><Truck size={20} /> {t.title}</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>{t.intro}</p>
      </div>

      {settings.data && <SettingsCard t={t} value={settings.data} />}
      {(missing.data?.data.length ?? 0) > 0 && <MissingWeights t={t} rows={missing.data!.data} onDone={() => qc.invalidateQueries({ queryKey: ['ship-missing'] })} />}

      <div className="flex items-center justify-between">
        <h2 className="font-medium" style={{ color: 'var(--text)' }}>{t.zones}</h2>
        <button className={btn} style={btnPrimary} onClick={() => addZone.mutate()}><Plus size={14} /> {t.addZone}</button>
      </div>

      {(zones.data?.data.length ?? 0) === 0 && (
        <div className={card} style={cardStyle}>
          <p className="text-sm mb-1" style={{ color: 'var(--text-secondary)' }}>{t.empty}</p>
          <p className="text-xs mb-3" style={{ color: 'var(--text-muted, var(--text-secondary))' }}>{t.starterHint}</p>
          <button className={btn} style={btnGhost} disabled={starter.isPending} onClick={() => starter.mutate()}>{t.starter}</button>
        </div>
      )}

      {zones.data?.data.map((z) => <ZoneCard key={z.id} t={t} zone={z} cur={cur} onChange={refresh} />)}

      <TestCard t={t} />
    </div>
  );
}

// ── Settings ────────────────────────────────────────────────────────────────
function SettingsCard({ t, value }: { t: Txt; value: ShippingSettings }) {
  const qc = useQueryClient();
  const [enabled, setEnabled] = useState(value.enabled);
  const [defW, setDefW] = useState(String(value.default_weight_g));
  const [freeOver, setFreeOver] = useState(toUnits(value.free_over_cents, value.base_currency));
  const [cur, setCur] = useState(value.base_currency);
  const [fx, setFx] = useState<Record<string, string>>(Object.fromEntries(Object.entries(value.fx).map(([k, v]) => [k, String(v)])));
  const [newFx, setNewFx] = useState('');
  const [done, setDone] = useState(false);
  useEffect(() => { setDone(false); }, [enabled, defW, freeOver, cur, fx]);

  const save = useMutation({
    mutationFn: () => {
      const fxNum: Record<string, number> = {};
      for (const [k, v] of Object.entries(fx)) if (Number(v) > 0 && /^[A-Za-z]{3}$/.test(k)) fxNum[k.toUpperCase()] = Number(v);
      return api.saveShippingSettings({
        enabled,
        default_weight_g: Math.max(1, Math.floor(Number(defW) || 500)),
        free_over_cents: toCents(freeOver, cur),
        base_currency: cur.toUpperCase(),
        fx: fxNum,
      });
    },
    onSuccess: () => { setDone(true); qc.invalidateQueries({ queryKey: ['ship-settings'] }); },
    onError: (e: unknown) => alert(e instanceof Error ? e.message : String(e)),
  });

  return (
    <div className={card} style={cardStyle}>
      <label className="flex items-start gap-2 mb-4">
        <input type="checkbox" className="mt-1" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
        <span><span className="text-sm font-medium" style={{ color: 'var(--text)' }}>{t.enabled}</span>
          <span className="block text-xs" style={{ color: 'var(--text-secondary)' }}>{t.enabledHint}</span></span>
      </label>
      <div className="grid sm:grid-cols-3 gap-3">
        <div><label className={lab} style={labStyle}>{t.defWeight}</label>
          <input type="number" min={1} className={inputCls} style={inputStyle} value={defW} onChange={(e) => setDefW(e.target.value)} /></div>
        <div><label className={lab} style={labStyle}>{t.freeOver}</label>
          <input type="number" min={0} className={inputCls} style={inputStyle} value={freeOver} onChange={(e) => setFreeOver(e.target.value)} /></div>
        <div><label className={lab} style={labStyle}>{t.currency}</label>
          <input className={inputCls} style={inputStyle} maxLength={3} value={cur} onChange={(e) => setCur(e.target.value.toUpperCase())} /></div>
      </div>
      <div className="mt-3">
        <label className={lab} style={labStyle}>{t.fx}</label>
        <div className="flex flex-wrap gap-2 items-center">
          {Object.entries(fx).map(([k, v]) => (
            <span key={k} className="inline-flex items-center gap-1 text-sm" style={{ color: 'var(--text)' }}>
              {k}
              <input type="number" step="any" className="w-28 px-2 py-1 text-sm rounded-lg" style={inputStyle} value={v} onChange={(e) => setFx({ ...fx, [k]: e.target.value })} />
              <button type="button" aria-label="remove" onClick={() => { const n = { ...fx }; delete n[k]; setFx(n); }}><Trash2 size={13} /></button>
            </span>
          ))}
          <input placeholder="USD" maxLength={3} className="w-20 px-2 py-1 text-sm rounded-lg" style={inputStyle} value={newFx} onChange={(e) => setNewFx(e.target.value.toUpperCase())} />
          <button type="button" className={btn} style={btnGhost} disabled={!/^[A-Z]{3}$/.test(newFx)} onClick={() => { setFx({ ...fx, [newFx]: '1' }); setNewFx(''); }}><Plus size={13} /></button>
        </div>
        <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>{t.fxHint}</p>
      </div>
      <div className="mt-4 flex items-center gap-3">
        <button className={btn} style={btnPrimary} disabled={save.isPending} onClick={() => save.mutate()}>{t.save}</button>
        {done && <span className="text-sm text-green-600">{t.saved}</span>}
      </div>
    </div>
  );
}

// ── Products without a weight ───────────────────────────────────────────────
function MissingWeights({ t, rows, onDone }: { t: Txt; rows: Array<{ variant_id: string; product_id: string; sku: string; title: string; product_title: string }>; onDone: () => void }) {
  const [vals, setVals] = useState<Record<string, string>>({});
  const save = useMutation({
    mutationFn: (r: (typeof rows)[number]) => api.updateVariant(r.product_id, r.variant_id, { weight_g: Math.floor(Number(vals[r.variant_id])) }),
    onSuccess: onDone,
    onError: (e: unknown) => alert(e instanceof Error ? e.message : String(e)),
  });
  return (
    <div className="rounded-xl border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 p-4">
      <h2 className="font-medium flex items-center gap-2" style={{ color: 'var(--text)' }}><AlertTriangle size={16} /> {t.missingTitle} ({rows.length})</h2>
      <p className="text-sm mb-3" style={{ color: 'var(--text-secondary)' }}>{t.missingHint}</p>
      <ul className="space-y-2">
        {rows.map((r) => {
          const v = Number(vals[r.variant_id]);
          return (
            <li key={r.variant_id} className="flex flex-wrap items-center gap-2 text-sm" style={{ color: 'var(--text)' }}>
              <span className="flex-1 min-w-[10rem]">{r.product_title}{r.title && r.title !== r.product_title ? ` — ${r.title}` : ''} <span className="font-mono text-xs opacity-70">{r.sku}</span></span>
              <input type="number" min={1} placeholder={t.grams} className="w-28 px-2 py-1 rounded-lg" style={inputStyle}
                value={vals[r.variant_id] ?? ''} onChange={(e) => setVals({ ...vals, [r.variant_id]: e.target.value })} />
              <button className={btn} style={btnGhost} disabled={!(v > 0) || save.isPending} onClick={() => save.mutate(r)}>{t.save}</button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// ── One zone ────────────────────────────────────────────────────────────────
function ZoneCard({ t, zone, cur, onChange }: { t: Txt; zone: ShippingZone; cur: string; onChange: () => void }) {
  const { locale } = useLocale();
  const names = countryList(locale);
  const nameOf = (iso: string) => (iso === '*' ? t.world : names.find((c) => c.iso === iso)?.name ?? iso);
  const [name, setName] = useState(zone.name);
  const [countries, setCountries] = useState(zone.countries);
  const [regions, setRegions] = useState(zone.regions.join(', '));
  const [active, setActive] = useState(zone.active);
  const err = (e: unknown) => alert(e instanceof Error ? e.message : String(e));
  const save = useMutation({
    mutationFn: () => api.updateShippingZone(zone.id, {
      name: name.trim() || zone.name, countries, regions: regions.split(',').map((s) => s.trim()).filter(Boolean), active,
    }),
    onSuccess: onChange, onError: err,
  });
  const del = useMutation({ mutationFn: () => api.deleteShippingZone(zone.id), onSuccess: onChange, onError: err });
  const addRate = useMutation({
    mutationFn: () => api.createShippingRate(zone.id, {
      name_fr: 'Livraison', name_en: 'Delivery', kind: 'flat', flat_cents: 0, bands: [], over_per_kg_cents: null, free_over_cents: null,
      min_days: null, max_days: null, pickup_address: null, active: true, position: zone.rates.length,
    }),
    onSuccess: onChange, onError: err,
  });
  const dirty = name !== zone.name || active !== zone.active || countries.join() !== zone.countries.join() || regions !== zone.regions.join(', ');

  return (
    <div className={card} style={cardStyle}>
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-[12rem]"><label className={lab} style={labStyle}>{t.zoneName}</label>
          <input className={inputCls} style={inputStyle} value={name} onChange={(e) => setName(e.target.value)} /></div>
        <label className="flex items-center gap-2 text-sm pb-2" style={{ color: 'var(--text)' }}>
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} /> {t.active}
        </label>
        <button className={btn} style={btnGhost} onClick={() => { if (confirm(t.confirmDel)) del.mutate(); }}><Trash2 size={14} /> {t.del}</button>
      </div>

      <div className="mt-3">
        <label className={lab} style={labStyle}>{t.countries}</label>
        <div className="flex flex-wrap gap-1.5 mb-2">
          {countries.map((c) => (
            <span key={c} className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full" style={{ border: '1px solid var(--border)', color: 'var(--text)' }}>
              {nameOf(c)}
              <button type="button" aria-label="remove" onClick={() => setCountries(countries.filter((x) => x !== c))}>×</button>
            </span>
          ))}
        </div>
        <select className={inputCls} style={inputStyle} value="" onChange={(e) => { const v = e.target.value; if (v && !countries.includes(v)) setCountries([...countries, v]); }}>
          <option value="">{t.addCountry}</option>
          <option value="*">{t.world}</option>
          {names.map((c) => <option key={c.iso} value={c.iso}>{c.name}</option>)}
        </select>
      </div>

      <div className="mt-3">
        <label className={lab} style={labStyle}>{t.regions}</label>
        <input className={inputCls} style={inputStyle} value={regions} placeholder="Cotonou, Abomey-Calavi" onChange={(e) => setRegions(e.target.value)} />
      </div>

      {dirty && <button className={`${btn} mt-3`} style={btnPrimary} disabled={save.isPending || countries.length === 0} onClick={() => save.mutate()}>{t.save}</button>}

      <h3 className="text-sm font-semibold mt-5 mb-2" style={{ color: 'var(--text)' }}>{t.rates}</h3>
      <div className="space-y-3">
        {zone.rates.map((r) => <RateEditor key={r.id} t={t} rate={r} cur={cur} onChange={onChange} />)}
      </div>
      <button className={`${btn} mt-3`} style={btnGhost} onClick={() => addRate.mutate()}><Plus size={14} /> {t.addRate}</button>
    </div>
  );
}

// ── One rate ────────────────────────────────────────────────────────────────
function RateEditor({ t, rate, cur, onChange }: { t: Txt; rate: ShippingRate; cur: string; onChange: () => void }) {
  const [r, setR] = useState({
    name_fr: rate.name_fr, name_en: rate.name_en, kind: rate.kind, active: rate.active,
    flat: toUnits(rate.flat_cents, cur), over: toUnits(rate.over_per_kg_cents, cur), free: toUnits(rate.free_over_cents, cur),
    min: rate.min_days == null ? '' : String(rate.min_days), max: rate.max_days == null ? '' : String(rate.max_days),
    address: rate.pickup_address ?? '',
    bands: rate.bands.map((b) => ({ up: String(b.up_to_g), price: toUnits(b.cents, cur) })),
  });
  const set = (p: Partial<typeof r>) => setR({ ...r, ...p });
  const int = (v: string) => (v.trim() === '' ? null : Math.max(0, Math.floor(Number(v))));
  const err = (e: unknown) => alert(e instanceof Error ? e.message : String(e));
  const save = useMutation({
    mutationFn: () => api.updateShippingRate(rate.id, {
      name_fr: r.name_fr.trim() || rate.name_fr, name_en: r.name_en.trim() || rate.name_en, kind: r.kind, active: r.active,
      flat_cents: toCents(r.flat, cur) ?? 0,
      bands: r.bands.map((b) => ({ up_to_g: Math.max(1, Math.floor(Number(b.up) || 0)), cents: toCents(b.price, cur) ?? 0 })).filter((b) => b.up_to_g > 0),
      over_per_kg_cents: toCents(r.over, cur),
      free_over_cents: toCents(r.free, cur) || null,
      min_days: int(r.min), max_days: int(r.max),
      pickup_address: r.kind === 'pickup' ? r.address.trim() || null : null,
      position: rate.position,
    }),
    onSuccess: onChange, onError: err,
  });
  const del = useMutation({ mutationFn: () => api.deleteShippingRate(rate.id), onSuccess: onChange, onError: err });
  const small = 'w-full px-2 py-1.5 text-sm rounded-lg';

  return (
    <div className="rounded-lg border p-3" style={{ borderColor: 'var(--border)' }}>
      <div className="grid sm:grid-cols-3 gap-2">
        <div><label className={lab} style={labStyle}>{t.nameFr}</label><input className={small} style={inputStyle} value={r.name_fr} onChange={(e) => set({ name_fr: e.target.value })} /></div>
        <div><label className={lab} style={labStyle}>{t.nameEn}</label><input className={small} style={inputStyle} value={r.name_en} onChange={(e) => set({ name_en: e.target.value })} /></div>
        <div><label className={lab} style={labStyle}>{t.kind}</label>
          <select className={small} style={inputStyle} value={r.kind} onChange={(e) => set({ kind: e.target.value as ShippingRate['kind'] })}>
            <option value="flat">{t.flat}</option><option value="weight">{t.weight}</option><option value="pickup">{t.pickup}</option>
          </select></div>
      </div>

      {r.kind === 'flat' && (
        <div className="mt-2 max-w-xs"><label className={lab} style={labStyle}>{t.price} ({cur})</label>
          <input type="number" min={0} step="any" className={small} style={inputStyle} value={r.flat} onChange={(e) => set({ flat: e.target.value })} /></div>
      )}

      {r.kind === 'weight' && (
        <div className="mt-2">
          <label className={lab} style={labStyle}>{t.bands}</label>
          <div className="space-y-1.5">
            {r.bands.map((b, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="text-xs w-16" style={{ color: 'var(--text-secondary)' }}>{t.upTo}</span>
                <input type="number" min={1} className="w-28 px-2 py-1.5 text-sm rounded-lg" style={inputStyle} value={b.up}
                  onChange={(e) => set({ bands: r.bands.map((x, j) => (j === i ? { ...x, up: e.target.value } : x)) })} />
                <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>g →</span>
                <input type="number" min={0} step="any" className="w-32 px-2 py-1.5 text-sm rounded-lg" style={inputStyle} value={b.price}
                  onChange={(e) => set({ bands: r.bands.map((x, j) => (j === i ? { ...x, price: e.target.value } : x)) })} />
                <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{cur}</span>
                <button type="button" aria-label="remove" onClick={() => set({ bands: r.bands.filter((_, j) => j !== i) })}><Trash2 size={13} /></button>
              </div>
            ))}
          </div>
          <button type="button" className={`${btn} mt-2`} style={btnGhost} onClick={() => set({ bands: [...r.bands, { up: '', price: '' }] })}><Plus size={13} /> {t.addBand}</button>
          <div className="mt-2 max-w-md"><label className={lab} style={labStyle}>{t.overKg}</label>
            <input type="number" min={0} step="any" className={small} style={inputStyle} value={r.over} onChange={(e) => set({ over: e.target.value })} /></div>
        </div>
      )}

      {r.kind === 'pickup' && (
        <div className="mt-2"><label className={lab} style={labStyle}>{t.address}</label>
          <input className={small} style={inputStyle} value={r.address} onChange={(e) => set({ address: e.target.value })} /></div>
      )}

      <div className="mt-2 grid sm:grid-cols-3 gap-2">
        {r.kind !== 'pickup' && (
          <div><label className={lab} style={labStyle}>{t.freeRate}</label>
            <input type="number" min={0} step="any" className={small} style={inputStyle} value={r.free} onChange={(e) => set({ free: e.target.value })} /></div>
        )}
        <div><label className={lab} style={labStyle}>{t.minDays}</label><input type="number" min={0} className={small} style={inputStyle} value={r.min} onChange={(e) => set({ min: e.target.value })} /></div>
        <div><label className={lab} style={labStyle}>{t.maxDays}</label><input type="number" min={0} className={small} style={inputStyle} value={r.max} onChange={(e) => set({ max: e.target.value })} /></div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm" style={{ color: 'var(--text)' }}>
          <input type="checkbox" checked={r.active} onChange={(e) => set({ active: e.target.checked })} /> {t.active}
        </label>
        <button className={btn} style={btnPrimary} disabled={save.isPending} onClick={() => save.mutate()}>{t.save}</button>
        <button className={btn} style={btnGhost} onClick={() => { if (confirm(t.confirmDel)) del.mutate(); }}><Trash2 size={14} /> {t.del}</button>
      </div>
    </div>
  );
}

// ── Try a destination ───────────────────────────────────────────────────────
function TestCard({ t }: { t: Txt }) {
  const { locale } = useLocale();
  const names = countryList(locale);
  const [country, setCountry] = useState('BJ');
  const [city, setCity] = useState('');
  const [weight, setWeight] = useState('1000');
  const [res, setRes] = useState<ShippingQuote | null>(null);
  const run = useMutation({
    mutationFn: () => api.testShipping({ country, city: city.trim() || undefined, weight_g: Math.max(0, Math.floor(Number(weight) || 0)) }),
    onSuccess: setRes,
    onError: (e: unknown) => alert(e instanceof Error ? e.message : String(e)),
  });
  const name = (o: { name_fr: string; name_en: string }) => (String(locale) === 'fr' ? o.name_fr : o.name_en);
  return (
    <div className={card} style={cardStyle}>
      <h2 className="font-medium mb-3" style={{ color: 'var(--text)' }}>{t.test}</h2>
      <div className="grid sm:grid-cols-3 gap-2">
        <div><label className={lab} style={labStyle}>{t.country}</label>
          <select className={inputCls} style={inputStyle} value={country} onChange={(e) => setCountry(e.target.value)}>{names.map((c) => <option key={c.iso} value={c.iso}>{c.name}</option>)}</select></div>
        <div><label className={lab} style={labStyle}>{t.city}</label><input className={inputCls} style={inputStyle} value={city} onChange={(e) => setCity(e.target.value)} /></div>
        <div><label className={lab} style={labStyle}>{t.weightG}</label><input type="number" min={0} className={inputCls} style={inputStyle} value={weight} onChange={(e) => setWeight(e.target.value)} /></div>
      </div>
      <button className={`${btn} mt-3`} style={btnPrimary} disabled={run.isPending} onClick={() => run.mutate()}>{t.run}</button>
      {res && (
        <div className="mt-3 text-sm" style={{ color: 'var(--text)' }}>
          {!res.deliverable ? <p>{res.reason === 'too_heavy' ? t.tooHeavy : t.noZone}</p> : (
            <>
              <p className="text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>{res.zone?.name} · {res.weight_g} g</p>
              <ul className="space-y-0.5">{res.options.map((o) => <li key={o.id}>{name(o)} — {o.free ? t.free : `${o.cents}`}</li>)}</ul>
            </>
          )}
        </div>
      )}
    </div>
  );
}
