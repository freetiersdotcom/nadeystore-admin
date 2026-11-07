// Printable receipt / invoice built as one self-contained HTML string, printed through a hidden frame
// (so the admin's own styles never leak into the paper). Pure: no network, no React.
import { formatPrice } from './format';

export type ShopProfile = { name: string; address: string; phone: string; email: string; tax_id: string; footer_fr: string; footer_en: string; paper: 'ticket' | 'a4' };
export type ReceiptOrder = {
  number?: string; id: string; created_at: string; paid_at?: string | null; customer_email: string; walk_in?: boolean;
  shipping?: { name: string | null; phone: string | null } | null; delivery_option?: string | null;
  amounts: { subtotal_cents: number; discount_cents?: number; tax_cents: number; shipping_cents: number; total_cents: number; currency: string };
  discount?: { code: string; amount_cents: number } | null;
  items: { title: string; qty: number; unit_price_cents: number }[];
};
export type ReceiptPayments = { paid_cents: number; balance_cents: number; payments: { amount_cents: number; method: string; created_at: string }[] };
export type ReceiptOptions = { lang: 'fr' | 'en'; paper: 'ticket' | 'a4'; kind: 'receipt' | 'invoice' };

const T = {
  fr: { receipt: 'Reçu', invoice: 'Facture', no: 'N°', date: 'Date', client: 'Client', item: 'Article', qty: 'Qté', price: 'Prix', subtotal: 'Sous-total', discount: 'Remise', shipping: 'Livraison', tax: 'Taxes', total: 'Total', paid: 'Payé', balance: 'Reste à payer', paidInFull: 'Payé en totalité', method: 'Règlement', thanks: 'Merci pour votre achat.', tax_id: 'N° fiscal' },
  en: { receipt: 'Receipt', invoice: 'Invoice', no: 'No.', date: 'Date', client: 'Customer', item: 'Item', qty: 'Qty', price: 'Price', subtotal: 'Subtotal', discount: 'Discount', shipping: 'Shipping', tax: 'Tax', total: 'Total', paid: 'Paid', balance: 'Balance due', paidInFull: 'Paid in full', method: 'Payment', thanks: 'Thank you for your purchase.', tax_id: 'Tax no.' },
};
const METHODS: Record<string, { fr: string; en: string }> = {
  cash: { fr: 'Espèces', en: 'Cash' }, mobile_money: { fr: 'Mobile money', en: 'Mobile money' }, card: { fr: 'Carte', en: 'Card' }, bank_transfer: { fr: 'Virement', en: 'Bank transfer' }, online: { fr: 'En ligne', en: 'Online' },
};
export const esc = (s: unknown) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
const methodName = (m: string, lang: 'fr' | 'en') => METHODS[m]?.[lang] ?? m.replace(/_/g, ' ');
const dateOf = (iso: string, lang: 'fr' | 'en') => { const d = new Date(iso); return Number.isNaN(d.getTime()) ? '' : new Intl.DateTimeFormat(lang === 'en' ? 'en-GB' : 'fr-FR', { dateStyle: 'medium', timeStyle: 'short' }).format(d); };

export function buildReceiptHtml(order: ReceiptOrder, pay: ReceiptPayments | null, shop: ShopProfile, o: ReceiptOptions): string {
  const t = T[o.lang]; const cur = order.amounts.currency; const m = (n: number) => esc(formatPrice(n, cur));
  const ticket = o.paper === 'ticket';
  const customer = order.walk_in ? '' : (order.shipping?.name || order.customer_email || '');
  const discount = order.discount?.amount_cents ?? order.amounts.discount_cents ?? 0;
  const footer = (o.lang === 'en' ? shop.footer_en : shop.footer_fr) || t.thanks;
  const rows = order.items.map((i) => `<tr><td>${esc(i.title)}</td><td class="n">${esc(i.qty)}</td><td class="n">${m(i.unit_price_cents * i.qty)}</td></tr>`).join('');
  const line = (label: string, value: string, strong = false) => `<tr class="${strong ? 'b' : ''}"><td colspan="2">${esc(label)}</td><td class="n">${value}</td></tr>`;
  const settled = pay ? pay.balance_cents <= 0 : false;
  const payRows = pay ? pay.payments.map((p) => line(`${t.method}: ${methodName(p.method, o.lang)}`, m(p.amount_cents))).join('') : '';
  return `<!doctype html><html lang="${o.lang}"><head><meta charset="utf-8"><title>${esc(t[o.kind])} ${esc(order.number ?? order.id.slice(0, 8))}</title>
<style>
@page{size:${ticket ? '80mm auto' : 'A4'};margin:${ticket ? '4mm' : '16mm'}}
*{box-sizing:border-box}body{font-family:system-ui,Arial,sans-serif;color:#000;margin:0;font-size:${ticket ? '12px' : '14px'};${ticket ? 'width:72mm;' : 'max-width:180mm;'}}
h1{font-size:${ticket ? '15px' : '22px'};margin:0 0 2px}h2{font-size:${ticket ? '13px' : '16px'};margin:10px 0 2px;text-transform:uppercase;letter-spacing:.04em}
.m{color:#333;white-space:pre-line}.c{text-align:${ticket ? 'center' : 'left'}}table{width:100%;border-collapse:collapse;margin:8px 0}
th{text-align:left;font-size:.8em;text-transform:uppercase;border-bottom:1px solid #000;padding:3px 0}td{padding:3px 0;vertical-align:top}.n{text-align:right;white-space:nowrap}.b td{font-weight:700;border-top:1px solid #000}
.f{margin-top:12px;text-align:${ticket ? 'center' : 'left'};color:#333;white-space:pre-line}
</style></head><body>
<div class="c"><h1>${esc(shop.name)}</h1><div class="m">${esc(shop.address)}${shop.phone ? '\n' + esc(shop.phone) : ''}${shop.email ? '\n' + esc(shop.email) : ''}${shop.tax_id ? '\n' + esc(t.tax_id) + ': ' + esc(shop.tax_id) : ''}</div></div>
<h2>${esc(t[o.kind])} ${t.no} ${esc(order.number ?? order.id.slice(0, 8))}</h2>
<div class="m">${esc(t.date)}: ${esc(dateOf(order.paid_at || order.created_at, o.lang))}${customer ? '\n' + esc(t.client) + ': ' + esc(customer) : ''}</div>
<table><thead><tr><th>${t.item}</th><th class="n">${t.qty}</th><th class="n">${t.price}</th></tr></thead><tbody>${rows}</tbody><tfoot>
${line(t.subtotal, m(order.amounts.subtotal_cents))}
${discount > 0 ? line(order.discount?.code ? `${t.discount} (${order.discount.code})` : t.discount, '−' + m(discount)) : ''}
${order.amounts.shipping_cents > 0 ? line(order.delivery_option ? `${t.shipping} (${order.delivery_option})` : t.shipping, m(order.amounts.shipping_cents)) : ''}
${order.amounts.tax_cents > 0 ? line(t.tax, m(order.amounts.tax_cents)) : ''}
${line(t.total, m(order.amounts.total_cents), true)}
${payRows}
${pay ? (settled ? line(t.paidInFull, '', true) : line(t.balance, m(pay.balance_cents), true)) : ''}
</tfoot></table>
<div class="f">${esc(footer)}</div></body></html>`;
}

/** Print an HTML document through a hidden frame. */
export function printHtml(html: string) {
  const frame = document.createElement('iframe');
  frame.setAttribute('aria-hidden', 'true');
  frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0';
  document.body.appendChild(frame);
  const doc = frame.contentDocument!;
  doc.open(); doc.write(html); doc.close();
  const go = () => { frame.contentWindow!.focus(); frame.contentWindow!.print(); setTimeout(() => frame.remove(), 60_000); };
  setTimeout(go, 150);
}

/** wa.me link with a plain-text summary; the phone is digits only. Null when there is no usable number. */
export function whatsappLink(order: ReceiptOrder, pay: ReceiptPayments | null, shop: ShopProfile, lang: 'fr' | 'en', phone: string | null | undefined): string | null {
  const digits = (phone ?? '').replace(/[^\d]/g, ''); if (digits.length < 8) return null;
  const t = T[lang]; const cur = order.amounts.currency; const m = (n: number) => formatPrice(n, cur);
  const lines = [`${shop.name} — ${t.receipt} ${t.no} ${order.number ?? order.id.slice(0, 8)}`, ...order.items.map((i) => `${i.qty} × ${i.title} — ${m(i.unit_price_cents * i.qty)}`), `${t.total}: ${m(order.amounts.total_cents)}`];
  if (pay && pay.balance_cents > 0) lines.push(`${t.balance}: ${m(pay.balance_cents)}`); else if (pay) lines.push(t.paidInFull);
  lines.push('', (lang === 'en' ? shop.footer_en : shop.footer_fr) || t.thanks);
  return `https://wa.me/${digits}?text=${encodeURIComponent(lines.join('\n'))}`;
}
