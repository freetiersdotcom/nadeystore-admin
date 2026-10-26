import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { api } from '../lib/api';
import { formatPrice } from '../lib/format';
import { Modal } from '../components/Modal';
import { useT } from '../lib/locale-context';
import { ContactFields, emptyContact, contactPayload } from '../components/ContactFields';
import { postalRule, buildPhone } from '../lib/geo';

// Order entered by the merchant: counter sale, phone or WhatsApp order.
// Stock is deducted, an optional first payment is recorded, no email is sent.

const METHODS = ['cash', 'mobile_money', 'bank_transfer', 'card', 'other'] as const;
const ZERO_DECIMAL = new Set(['XOF', 'GNF', 'JPY', 'KRW', 'VND']);

type Line = { sku: string; qty: string; price: string };

type Props = {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
};

export function ManualOrderModal({ open, onClose, onCreated }: Props) {
  const t = useT();

  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [line1, setLine1] = useState('');
  const [city, setCity] = useState('');
  const [contact, setContact] = useState(emptyContact());
  const [currency, setCurrency] = useState('XOF');
  const [lines, setLines] = useState<Line[]>([{ sku: '', qty: '1', price: '' }]);
  const [paidNow, setPaidNow] = useState('');
  const [method, setMethod] = useState<(typeof METHODS)[number]>('cash');
  const [error, setError] = useState<string | null>(null);

  const { data: products } = useQuery({
    queryKey: ['manual-order-products'],
    queryFn: () => api.getProducts({ limit: 100 }),
    enabled: open,
  });

  const variants = (products?.items ?? []).flatMap((p) =>
    p.variants
      .filter((v) => v.product_type !== 'digital')
      .map((v) => ({
        sku: v.sku,
        label: `${p.title}${v.title && v.title !== p.title ? ' — ' + v.title : ''} (${v.sku})`,
        price: v.price_cents,
      }))
  );

  const factor = ZERO_DECIMAL.has(currency.toUpperCase()) ? 1 : 100;
  const toCents = (s: string) => Math.round(Number(s.replace(',', '.')) * factor);

  const total = lines.reduce((sum, l) => {
    const v = variants.find((x) => x.sku === l.sku);
    const qty = parseInt(l.qty, 10) || 0;
    const unit = l.price.trim() !== '' ? toCents(l.price) : (v?.price ?? 0);
    return sum + (Number.isFinite(unit) ? unit : 0) * qty;
  }, 0);

  const mutation = useMutation({
    mutationFn: (body: Parameters<typeof api.createManualOrder>[0]) => api.createManualOrder(body),
    onSuccess: () => {
      onCreated();
      reset();
      onClose();
    },
    onError: (e: unknown) => setError(e instanceof Error ? e.message : String(e)),
  });

  function reset() {
    setEmail(''); setName(''); setLine1(''); setCity(''); setContact(emptyContact());
    setLines([{ sku: '', qty: '1', price: '' }]);
    setPaidNow(''); setMethod('cash'); setError(null);
  }

  function submit() {
    const items = lines
      .filter((l) => l.sku)
      .map((l) => ({
        sku: l.sku,
        qty: parseInt(l.qty, 10),
        unit_price_cents: l.price.trim() !== '' ? toCents(l.price) : undefined,
      }));
    if (!email.trim() || items.length === 0 || items.some((i) => !Number.isInteger(i.qty) || i.qty <= 0)) {
      setError(t('orders.manual.invalid'));
      return;
    }
    const hasAddress = !!(line1.trim() && city.trim());
    if (hasAddress) {
      // Same rules as the API: a known country, a postal code where the country needs one,
      // and a phone number that looks like one (the API makes the final check).
      const digits = buildPhone(contact.dial, contact.phone).replace(/\D/g, '');
      if (!contact.country) { setError(t('contact.errCountry')); return; }
      if (postalRule(contact.country) === 'required' && !contact.postal.trim()) { setError(t('contact.errPostal')); return; }
      if (contact.phone.trim() && (digits.length < 8 || digits.length > 15)) { setError(t('contact.errPhone')); return; }
    }
    let payment: { amount_cents: number; method: (typeof METHODS)[number] } | undefined;
    if (paidNow.trim() !== '') {
      const cents = toCents(paidNow);
      if (!Number.isFinite(cents) || cents <= 0 || cents > total) {
        setError(t('orders.pay.invalidAmount'));
        return;
      }
      payment = { amount_cents: cents, method };
    }
    setError(null);
    mutation.mutate({
      customer_email: email.trim(),
      customer_name: name.trim() || undefined,
      currency: currency.toUpperCase(),
      address: hasAddress
        ? { line1: line1.trim(), city: city.trim(), ...contactPayload(contact) }
        : undefined,
      items,
      payment,
    });
  }

  const inputStyle = { background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text)' };
  const inputCls = 'w-full px-3 py-2 font-mono text-sm rounded-lg focus:outline-none focus:ring-2';
  const labelCls = 'block text-xs font-medium uppercase tracking-wide mb-1';
  const muted = { color: 'var(--text-secondary)' };

  return (
    <Modal open={open} onClose={onClose} title={t('orders.manual.title')} size="lg">
      <div className="p-6 space-y-5">
        <p className="text-sm" style={muted}>{t('orders.manual.help')}</p>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls} style={muted}>{t('orders.manual.email')} *</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} style={inputStyle} />
          </div>
          <div>
            <label className={labelCls} style={muted}>{t('orders.manual.name')}</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} className={inputCls} style={inputStyle} />
          </div>
        </div>

        <div>
          <label className={labelCls} style={muted}>{t('orders.manual.items')} *</label>
          <div className="space-y-2">
            {lines.map((l, i) => (
              <div key={i} className="grid grid-cols-[1fr_70px_130px_auto] gap-2 items-center">
                <select
                  value={l.sku}
                  onChange={(e) => setLines(lines.map((x, j) => (j === i ? { ...x, sku: e.target.value } : x)))}
                  className={inputCls}
                  style={inputStyle}
                >
                  <option value="">{t('orders.manual.item')}</option>
                  {variants.map((v) => (
                    <option key={v.sku} value={v.sku}>{v.label} · {formatPrice(v.price, currency)}</option>
                  ))}
                </select>
                <input
                  type="text" inputMode="numeric" value={l.qty} placeholder={t('orders.manual.qty')}
                  onChange={(e) => setLines(lines.map((x, j) => (j === i ? { ...x, qty: e.target.value } : x)))}
                  className={inputCls} style={inputStyle}
                />
                <input
                  type="text" inputMode="decimal" value={l.price} placeholder={t('orders.manual.price')}
                  onChange={(e) => setLines(lines.map((x, j) => (j === i ? { ...x, price: e.target.value } : x)))}
                  className={inputCls} style={inputStyle}
                />
                <button
                  type="button"
                  onClick={() => setLines(lines.length > 1 ? lines.filter((_, j) => j !== i) : lines)}
                  className="px-2 text-sm"
                  style={{ color: 'var(--text-muted)' }}
                  aria-label="remove"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setLines([...lines, { sku: '', qty: '1', price: '' }])}
            className="mt-2 text-sm font-medium hover:underline"
            style={{ color: 'var(--accent)' }}
          >
            + {t('orders.manual.addItem')}
          </button>
          <p className="mt-2 font-mono text-sm text-right">
            {t('orders.manual.total')}: {formatPrice(total, currency)}
          </p>
        </div>

        <div>
          <label className={labelCls} style={muted}>{t('orders.manual.address')}</label>
          <div className="grid grid-cols-2 gap-3">
            <input type="text" value={line1} onChange={(e) => setLine1(e.target.value)} placeholder={t('orders.manual.addressLine')} className={inputCls} style={inputStyle} />
            <input type="text" value={city} onChange={(e) => setCity(e.target.value)} placeholder={t('orders.manual.city')} className={inputCls} style={inputStyle} />
          </div>
          <div className="mt-3">
            <ContactFields value={contact} onChange={setContact} inputCls={inputCls} inputStyle={inputStyle} />
          </div>
        </div>

        <div className="grid grid-cols-[1fr_1fr_90px] gap-3">
          <div>
            <label className={labelCls} style={muted}>{t('orders.manual.paidNow')}</label>
            <input type="text" inputMode="decimal" value={paidNow} onChange={(e) => setPaidNow(e.target.value)} className={inputCls} style={inputStyle} />
          </div>
          <div>
            <label className={labelCls} style={muted}>{t('orders.pay.method')}</label>
            <select value={method} onChange={(e) => setMethod(e.target.value as (typeof METHODS)[number])} className={inputCls} style={inputStyle}>
              {METHODS.map((m) => (
                <option key={m} value={m}>{t(`orders.pay.method.${m}` as Parameters<typeof t>[0])}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls} style={muted}>{t('orders.manual.currency')}</label>
            <input type="text" value={currency} maxLength={3} onChange={(e) => setCurrency(e.target.value.toUpperCase())} className={inputCls} style={inputStyle} />
          </div>
        </div>

        {error && <p className="text-sm text-red-500">{error}</p>}

        <div className="flex items-center justify-end gap-3">
          <button type="button" onClick={onClose} className="text-sm hover:underline" style={{ color: 'var(--text-muted)' }}>
            {t('orders.manual.cancel')}
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={mutation.isPending}
            className="px-4 py-2 text-sm font-medium rounded-lg disabled:opacity-50"
            style={{ background: 'var(--text)', color: 'var(--bg-card)' }}
          >
            {t('orders.manual.submit')}
          </button>
        </div>
      </div>
    </Modal>
  );
}
