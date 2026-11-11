import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { useLocale } from '../lib/locale-context';

/** Where an order came from (only when the Ad tracking module is on and the order was brought by a campaign). */
export function OrderSource({ orderId }: { orderId: string }) {
  const { locale } = useLocale(); const fr = locale !== 'en';
  const mods = useQuery({ queryKey: ['modules'], queryFn: () => api.getModules() });
  const on = !!mods.data?.items.find((m) => m.id === 'ads' && m.enabled && m.access);
  const { data } = useQuery({ queryKey: ['ads-order', orderId], queryFn: () => api.getAdsOrder(orderId), enabled: on, retry: false });
  const a = data?.attribution; if (!on || !a) return null;
  const text = [a.source, a.medium].filter(Boolean).join(' / ') + (a.campaign ? ` — ${a.campaign}` : '') + (a.content ? ` (${a.content})` : '');
  return <p className="text-xs" style={{ color: 'var(--text-secondary)' }} data-testid="order-source">{fr ? 'Origine' : 'Source'} : {text}</p>;
}
