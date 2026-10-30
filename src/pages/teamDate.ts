import { useLocale } from '../lib/locale-context';

/** Format an ISO timestamp for the current language, e.g. "29 Oct 2026, 14:05". */
export function useIntlDate() {
  const { intlLocale } = useLocale();
  return (iso: string) =>
    new Intl.DateTimeFormat(intlLocale, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso));
}
