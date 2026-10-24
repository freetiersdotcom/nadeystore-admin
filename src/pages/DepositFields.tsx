import { useState } from 'react';
import { useT } from '../lib/locale-context';

// Product form: optional deposit asked at checkout (percentage, or fixed amount per unit).
// Saves on blur/change through onSave, like the other product fields.

type Props = {
  productId: string;
  type: 'percent' | 'fixed' | null | undefined;
  value: number | null | undefined;
  onSave: (data: { deposit_type: 'percent' | 'fixed' | null; deposit_value: number | null }) => void;
};

const fieldClass = 'w-full px-3 py-2 text-sm font-mono rounded-lg focus:outline-none focus:ring-2';
const fieldStyle = { background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text)' } as const;

export function DepositFields({ productId, type, value, onSave }: Props) {
  const t = useT();
  const [error, setError] = useState<string | null>(null);
  const [kind, setKind] = useState<'' | 'percent' | 'fixed'>(type ?? '');

  function commit(nextKind: '' | 'percent' | 'fixed', raw: string) {
    if (!nextKind) { setError(null); onSave({ deposit_type: null, deposit_value: null }); return; }
    const n = Math.floor(Number(raw));
    if (!Number.isFinite(n) || n < 1 || (nextKind === 'percent' && n > 99)) { setError(t('products.deposit.invalid')); return; }
    setError(null);
    if (nextKind !== (type ?? '') || n !== value) onSave({ deposit_type: nextKind, deposit_value: n });
  }

  return (
    <div>
      <label className="block text-xs font-medium uppercase tracking-wide mb-2" style={{ color: 'var(--text-secondary)' }}>
        {t('products.deposit.title')}
      </label>
      <div className="grid grid-cols-2 gap-3">
        <select
          value={kind}
          onChange={(e) => {
            const k = e.target.value as '' | 'percent' | 'fixed';
            setKind(k);
            if (!k) commit('', '');
          }}
          className={fieldClass} style={fieldStyle}
        >
          <option value="">{t('products.deposit.none')}</option>
          <option value="percent">{t('products.deposit.percent')}</option>
          <option value="fixed">{t('products.deposit.fixed')}</option>
        </select>
        {kind && (
          <input
            type="number" min={1} max={kind === 'percent' ? 99 : undefined}
            key={`deposit-${productId}-${type ?? ''}-${value ?? ''}`}
            defaultValue={value ?? ''}
            placeholder={kind === 'percent' ? '30' : '5000'}
            onBlur={(e) => commit(kind, e.target.value)}
            className={fieldClass} style={fieldStyle}
          />
        )}
      </div>
      {error && <p className="text-xs mt-1 text-red-500">{error}</p>}
      <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{t('products.deposit.help')}</p>
    </div>
  );
}
