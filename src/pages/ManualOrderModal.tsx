import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { api } from '../lib/api';
import { formatPrice } from '../lib/format';
import { Modal } from '../components/Modal';
import { useT, useLocale } from '../lib/locale-context';
import { ContactFields, emptyContact, contactPayload } from '../components/ContactFields';
import { postalRule, buildPhone } from '../lib/geo';

// Order entered by the merchant: counter sale, phone or WhatsApp order.
// Stock is deducted, an optional first payment is recorded, no email is sent.

const METHODS = ['cash', 'mobile_money', 'bank_transfer', 'card', 'other'] as const;
const ZERO_DECIMAL = new Set(['XOF', 'GNF', 'JPY', 'KRW', 'VND']);

type Line = { sku: string; qty: string; price: string; title?: string };
const FREE = 'CUSTOM';                                    // the hidden catalog entry behind every free-hand line

type Props = {
  open: boolean;
  onClose: () => void;
  onCreated: (orderId?: string) => void;
};

export function ManualOrderModal({ open, onClose, onCreated }: Props) {
  const t = useT();
  const { locale } = useLocale();

  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [line1, setLine1] = useState('');
  const [city, setCity] = useState('');
  const [contact, setContact] = useState(emptyContact());
  const [currency, setCurrency] = useState('XOF');
  const [lines, setLines] = useState<Line[]>([{ sku: '', qty: '1', price: '' }]);
  const [paidNow, setPaidNow] = useState('');
  const [method, setMethod] = useState<(typeof METHODS)[number]>('cash');
  // Delivery: 'none' (counter sale), a stored delivery option id, or 'custom' (a price agreed by hand).
  const [delivery, setDelivery] = useState<string>('none');
  const [customDelivery, setCustomDelivery] = useState('');
  const [customLabel, setCustomLabel] = useState('');
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

  const pricedLines = lines.filter((l) => l.sku && parseInt(l.qty, 10) > 0);
  const goodsTotal = lines.reduce((sum, l) => {
    const v = variants.find((x) => x.sku === l.sku);
    const qty = parseInt(l.qty, 10) || 0;
    const unit = l.price.trim() !== '' ? toCents(l.price) : (v?.price ?? 0);
    return sum + (Number.isFinite(unit) ? unit : 0) * qty;
  }, 0);

  // The same delivery options customers would see, for this cart and destination.
  const country = contact.country;
  const quoteKey = JSON.stringify([pricedLines.map((l) => [l.sku, l.qty, l.price]), currency, country, city.trim()]);
  const { data: quote } = useQuery({
    queryKey: ['manual-order-quote', quoteKey],
    queryFn: () =>
      api.quoteManualOrder({
        items: pricedLines.map((l) => ({ sku: l.sku, qty: parseInt(l.qty, 10), unit_price_cents: l.price.trim() !== '' ? toCents(l.price) : undefined })),
        currency: currency.toUpperCase(),
        address: { country, city: city.trim() || undefined },
      }),
    enabled: open && pricedLines.length > 0 && !!country && currency.length === 3,
    retry: false,
  });
  const options = quote?.deliverable ? quote.options : [];
  const chosenOption = options.find((o) => o.id === delivery);
  const customCents = delivery === 'custom' && customDelivery.trim() !== '' ? toCents(customDelivery) : 0;
  const deliveryCents = chosenOption ? chosenOption.cents : Number.isFinite(customCents) ? customCents : 0;
  const total = goodsTotal + deliveryCents;

  const mutation = useMutation({
    mutationFn: (body: Parameters<typeof api.createManualOrder>[0]) => api.createManualOrder(body),
    onSuccess: (res) => {
      onCreated(res?.order_id);
      reset();
      onClose();
    },
    onError: (e: unknown) => setError(e instanceof Error ? e.message : String(e)),
  });

  function reset() {
    setEmail(''); setName(''); setLine1(''); setCity(''); setContact(emptyContact());
    setLines([{ sku: '', qty: '1', price: '' }]);
    setPaidNow(''); setMethod('cash'); setError(null);
    setDelivery('none'); setCustomDelivery(''); setCustomLabel('');
  }

  function submit() {
    const items = lines
      .filter((l) => l.sku)
      .map((l) => ({
        sku: l.sku,
        qty: parseInt(l.qty, 10),
        unit_price_cents: l.price.trim() !== '' ? toCents(l.price) : undefined,
        ...(l.sku === FREE ? { title: (l.title ?? '').trim() } : {}),
      }));
    if (items.some((i) => i.sku === FREE && (!i.title || i.unit_price_cents === undefined || !Number.isFinite(i.unit_price_cents)))) {
      setError(t('orders.manual.freeInvalid'));
      return;
    }
    if ((email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) || items.length === 0 || items.some((i) => !Number.isInteger(i.qty) || i.qty <= 0)) {
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
    // A delivery option only means something with its address; a custom one needs an amount.
    let shipping: Parameters<typeof api.createManualOrder>[0]['shipping'];
    if (delivery === 'custom') {
      if (!Number.isFinite(customCents) || customDelivery.trim() === '') { setError(t('orders.manual.deliveryInvalid')); return; }
      shipping = { custom_cents: customCents, label: customLabel.trim() || undefined };
    } else if (delivery !== 'none') {
      if (!chosenOption) { setError(t('orders.manual.deliveryGone')); return; }
      shipping = { rate_id: chosenOption.id };
    }
    setError(null);
    mutation.mutate({
      customer_email: email.trim() || undefined,
      customer_name: name.trim() || undefined,
      currency: currency.toUpperCase(),
      address: hasAddress
        ? { line1: line1.trim(), city: city.trim(), ...contactPayload(contact) }
        : undefined,
      items,
      shipping,
      locale,
      payment,
    });
  }

  const inputStyle = { background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text)' };
  const inputCls = 'w-full px-3 py-2.5 md:py-2 font-mono text-sm rounded-lg focus:outline-none focus:ring-2';
  const labelCls = 'block text-xs font-medium uppercase tracking-wide mb-1';
  const muted = { color: 'var(--text-secondary)' };

  return (
    <Modal open={open} onClose={onClose} title={t('orders.manual.title')} size="lg">
      <div className="md:p-6 space-y-5">
        <p className="text-sm" style={muted}>{t('orders.manual.help')}</p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className={labelCls} style={muted}>{t('orders.manual.email')}</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t('orders.manual.emailPlaceholder')} className={inputCls} style={inputStyle} />
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
              <div key={i} className="grid grid-cols-[1fr_1fr_auto] md:grid-cols-[1fr_70px_130px_auto] gap-2 items-center pb-3 border-b md:pb-0 md:border-0" style={{ borderColor: 'var(--border-subtle)' }}>
                {l.sku === FREE ? (
                  <input
                    type="text" value={l.title ?? ''} maxLength={200} placeholder={t('orders.manual.freeDesc')} data-testid={`manual-free-${i}`}
                    onChange={(e) => setLines(lines.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))}
                    className={inputCls + ' col-span-3 md:col-span-1'} style={inputStyle}
                  />
                ) : (
                <select
                  value={l.sku}
                  onChange={(e) => setLines(lines.map((x, j) => (j === i ? { ...x, sku: e.target.value } : x)))}
                  className={inputCls + ' col-span-3 md:col-span-1'}
                  style={inputStyle}
                >
                  <option value="">{t('orders.manual.item')}</option>
                  {variants.filter((v) => v.sku !== FREE).map((v) => (
                    <option key={v.sku} value={v.sku}>{v.label} · {formatPrice(v.price, currency)}</option>
                  ))}
                </select>
                )}
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
                  className="px-2 h-10 w-10 md:h-auto md:w-auto text-sm"
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
          <button
            type="button"
            onClick={() => setLines([...lines, { sku: FREE, qty: '1', price: '', title: '' }])}
            className="mt-2 ml-4 text-sm font-medium hover:underline"
            style={{ color: 'var(--accent)' }}
            data-testid="manual-add-free"
          >
            + {t('orders.manual.addFree')}
          </button>
          <p className="mt-2 font-mono text-sm text-right">
            {deliveryCents > 0 && <span className="block text-xs" style={muted}>{t('orders.manual.delivery')}: {formatPrice(deliveryCents, currency)}</span>}
            {t('orders.manual.total')}: {formatPrice(total, currency)}
          </p>
        </div>

        <div>
          <label className={labelCls} style={muted}>{t('orders.manual.address')}</label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input type="text" value={line1} onChange={(e) => setLine1(e.target.value)} placeholder={t('orders.manual.addressLine')} className={inputCls} style={inputStyle} />
            <input type="text" value={city} onChange={(e) => setCity(e.target.value)} placeholder={t('orders.manual.city')} className={inputCls} style={inputStyle} />
          </div>
          <div className="mt-3">
            <ContactFields value={contact} onChange={setContact} inputCls={inputCls} inputStyle={inputStyle} />
          </div>
        </div>

        <div>
          <label className={labelCls} style={muted}>{t('orders.manual.delivery')}</label>
          <select
            value={delivery === 'custom' || chosenOption ? delivery : 'none'}
            onChange={(e) => setDelivery(e.target.value)}
            className={inputCls}
            style={inputStyle}
            data-testid="delivery-select"
          >
            <option value="none">{t('orders.manual.deliveryNone')}</option>
            {options.map((o) => (
              <option key={o.id} value={o.id}>
                {(locale === 'en' ? o.name_en : o.name_fr)} · {o.cents === 0 ? t('orders.manual.deliveryFree') : formatPrice(o.cents, currency)}
              </option>
            ))}
            <option value="custom">{t('orders.manual.deliveryCustom')}</option>
          </select>
          {!country && <p className="mt-1 text-xs" style={muted}>{t('orders.manual.deliveryHint')}</p>}
          {quote && quote.deliverable === false && quote.needed !== false && country && (
            <p className="mt-1 text-xs" style={muted}>{t('orders.manual.deliveryNoZone')}</p>
          )}
          {delivery === 'custom' && (
            <div className="grid grid-cols-2 gap-3 mt-2">
              <input type="text" inputMode="decimal" value={customDelivery} onChange={(e) => setCustomDelivery(e.target.value)} placeholder={t('orders.manual.deliveryAmount')} className={inputCls} style={inputStyle} />
              <input type="text" value={customLabel} onChange={(e) => setCustomLabel(e.target.value)} placeholder={t('orders.manual.deliveryLabel')} className={inputCls} style={inputStyle} />
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-[1fr_1fr_90px] gap-3">
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

        <div className="sticky bottom-0 -mx-4 px-4 py-3 md:static md:mx-0 md:px-0 md:py-0 flex items-center justify-end gap-3 border-t md:border-0" style={{ background: 'var(--bg-card)', borderColor: 'var(--border)' }}>
          <button type="button" onClick={onClose} className="text-sm hover:underline" style={{ color: 'var(--text-muted)' }}>
            {t('orders.manual.cancel')}
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={mutation.isPending}
            className="flex-1 md:flex-none px-4 py-3 md:py-2 text-sm font-medium rounded-lg disabled:opacity-50"
            style={{ background: 'var(--text)', color: 'var(--bg-card)' }}
          >
            {t('orders.manual.submit')}
          </button>
        </div>
      </div>
    </Modal>
  );
}
