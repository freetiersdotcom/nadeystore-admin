import type { ComponentType } from 'react';
import { FileText, type LucideIcon } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { api } from './api';
import { useLocale } from './locale-context';
import { Quotes } from '../pages/modules/Quotes';

/**
 * Admin side of the optional modules. The API decides which modules exist and are on
 * (GET /v1/modules); this table only says how each one looks here. To add a module:
 * add one line below and drop its page in pages/modules/.
 */
export const MODULE_UI: Record<string, { icon: LucideIcon; Page: ComponentType<{ canWrite: boolean }> }> = {
  quotes: { icon: FileText, Page: Quotes },
};

export function ModulePage({ id }: { id: string }) {
  const { locale } = useLocale();
  const { data, isLoading } = useQuery({ queryKey: ['modules'], queryFn: () => api.getModules() });
  const ui = MODULE_UI[id];
  const m = data?.items.find((x) => x.id === id);
  if (isLoading) return null;
  if (!ui || !m || !m.enabled || !m.access) {
    return <p className="p-6 text-sm" style={{ color: 'var(--text-secondary)' }}>{locale === 'en' ? 'This module is not available.' : "Ce module n'est pas disponible."}</p>;
  }
  return <ui.Page canWrite={m.access === 'write'} />;
}
