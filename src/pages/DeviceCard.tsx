import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { api } from '../lib/api';
import { useLocale, useT } from '../lib/locale-context';
import { disablePush, enablePush, currentSubscription, pushSupported } from '../lib/pwa';
import { isStandalone } from '../lib/store';

const card = { background: 'var(--bg-card)', border: '1px solid var(--border)' };
const btn = 'tap inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg disabled:opacity-50';
const ghost = { border: '1px solid var(--border)', color: 'var(--text)' };

type InstallEvent = Event & { prompt: () => Promise<void> };

/** Everyone: install the admin like an app on this device and switch on order notifications. */
export function DeviceCard() {
  const t = useT();
  const { locale } = useLocale();
  const [installEvent, setInstallEvent] = useState<InstallEvent | null>(null);
  const [on, setOn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const standalone = isStandalone();
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);

  useEffect(() => {
    const h = (e: Event) => { e.preventDefault(); setInstallEvent(e as InstallEvent); };
    window.addEventListener('beforeinstallprompt', h);
    return () => window.removeEventListener('beforeinstallprompt', h);
  }, []);
  useEffect(() => { currentSubscription().then((s) => setOn(!!s && Notification.permission === 'granted')); }, []);

  const toggle = async () => {
    setBusy(true); setMsg(null);
    try {
      if (on) { await disablePush(); setOn(false); }
      else {
        const r = await enablePush(locale === 'en' ? 'en' : 'fr');
        if (r === 'blocked') setMsg(t('pwa.blocked')); else setOn(true);
      }
    } catch (e) { setMsg(t('pwa.failed') + (e instanceof Error ? e.message : String(e))); }
    setBusy(false);
  };
  const test = async () => {
    setBusy(true); setMsg(null);
    try { await api.pushTest(); setMsg(t('pwa.testSent')); } catch (e) { setMsg(e instanceof Error ? e.message : String(e)); }
    setBusy(false);
  };

  return (
    <section className="p-5" style={card} data-testid="device-card">
      <h2 className="text-sm font-semibold mb-1" style={{ color: 'var(--text)' }}>{t('pwa.title')}</h2>
      <p className="text-xs mb-3" style={{ color: 'var(--text-secondary)' }}>{t('pwa.help')}</p>
      <div className="flex flex-wrap items-center gap-2">
        {standalone
          ? <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{t('pwa.installed')}</span>
          : installEvent && <button className={btn} style={ghost} data-testid="pwa-install" onClick={async () => { await installEvent.prompt(); setInstallEvent(null); }}>{t('pwa.install')}</button>}
        {pushSupported() ? (
          <>
            <button type="button" role="switch" aria-checked={on} className={btn} data-testid="push-toggle" disabled={busy} onClick={toggle}
              style={on ? { background: 'var(--text)', color: 'var(--bg-card)' } : ghost}>
              {busy && <Loader2 size={14} className="animate-spin" />} {t('pwa.notif')}: {on ? t('pwa.notifOn') : t('pwa.notifOff')}
            </button>
            {on && <button className={btn} style={ghost} data-testid="push-test" disabled={busy} onClick={test}>{t('pwa.test')}</button>}
          </>
        ) : <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{t('pwa.unsupported')}</span>}
      </div>
      {ios && !standalone && <p className="text-xs mt-3" style={{ color: 'var(--text-muted)' }}>{t('pwa.iosHint')}</p>}
      {msg && <p className="text-xs mt-2" style={{ color: 'var(--text-secondary)' }} data-testid="push-msg">{msg}</p>}
    </section>
  );
}
