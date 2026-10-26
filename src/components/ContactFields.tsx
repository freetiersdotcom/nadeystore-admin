import type { CSSProperties } from 'react';
import { useLocale, useT } from '../lib/locale-context';
import { countryList, postalRule, buildPhone } from '../lib/geo';

// Country picker + phone with country code + postal code (only where the country uses one).
// The list, the dial codes and the postal rules are the same as on the storefront (lib/geo.ts).

export type ContactValue = { country: string; postal: string; dial: string; phone: string };
export const emptyContact = (country = 'BJ'): ContactValue => ({ country, postal: '', dial: country, phone: '' });

/** What the API expects. Phone is international ("+22901610000000") or empty. */
export const contactPayload = (v: ContactValue) => ({
  country: v.country,
  postal_code: v.postal.trim(),
  phone: buildPhone(v.dial, v.phone) || undefined,
});

type Props = {
  value: ContactValue;
  onChange: (v: ContactValue) => void;
  inputCls: string;
  inputStyle: CSSProperties;
};

export function ContactFields({ value, onChange, inputCls, inputStyle }: Props) {
  const t = useT();
  const { locale } = useLocale();
  const list = countryList(locale);
  const rule = postalRule(value.country);
  const optionsFor = (label: (c: (typeof list)[number]) => string) =>
    list.map((c) => <option key={c.iso} value={c.iso}>{label(c)}</option>);

  return (
    <div className="grid grid-cols-2 gap-3">
      <select
        value={value.country}
        onChange={(e) => {
          const country = e.target.value;
          // The code next to the phone follows the country until someone changes it by hand.
          onChange({ ...value, country, dial: value.dial === value.country ? country : value.dial });
        }}
        className={inputCls}
        style={inputStyle}
        aria-label={t('contact.country')}
      >
        <option value="">{t('contact.pickCountry')}</option>
        {optionsFor((c) => c.name)}
      </select>
      {rule !== 'none' ? (
        <input
          type="text"
          value={value.postal}
          onChange={(e) => onChange({ ...value, postal: e.target.value })}
          placeholder={`${t('contact.postal')}${rule === 'required' ? ' *' : ` (${t('contact.optional')})`}`}
          className={inputCls}
          style={inputStyle}
        />
      ) : <div />}
      <div className="col-span-2 grid grid-cols-[110px_1fr] gap-2">
        <select
          value={value.dial}
          onChange={(e) => onChange({ ...value, dial: e.target.value })}
          className={inputCls}
          style={inputStyle}
          aria-label={t('contact.dial')}
        >
          {optionsFor((c) => `${c.iso} +${c.dial}`)}
        </select>
        <input
          type="tel"
          inputMode="tel"
          value={value.phone}
          onChange={(e) => onChange({ ...value, phone: e.target.value })}
          placeholder={t('orders.manual.phone')}
          className={inputCls}
          style={inputStyle}
        />
      </div>
    </div>
  );
}
