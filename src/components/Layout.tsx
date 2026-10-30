import { ReactNode, useState } from 'react';
import {
  ClipboardList,
  Package,
  Boxes,
  Moon,
  Sun,
  LogOut,
  PanelLeftClose,
  PanelLeft,
  Webhook,
  Users,
  Tag,
  Download,
  Settings,
  Languages,
  MessageSquare,
  UserCog,
} from 'lucide-react';
import clsx from 'clsx';
import { Truck } from 'lucide-react';
import { CalendarClock } from 'lucide-react';
import { useLocale, useT } from '../lib/locale-context';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';

export type Page =
  | 'orders'
  | 'customers'
  | 'inventory'
  | 'products'
  | 'discounts'
  | 'downloads'
  | 'appointments'
  | 'shipping'
  | 'webhooks'
  | 'setup/payments'
  | 'setup/email'
  | 'messages'
  | 'team';

/** What a person needs to open each page. `team` is open to any signed-in person (it holds "my account"). */
export const PAGE_PERMISSION: Record<Page, string | null> = {
  orders: 'orders.read',
  customers: 'customers.read',
  inventory: 'inventory.read',
  products: 'products.read',
  discounts: 'discounts.read',
  downloads: 'orders.read',
  appointments: 'appointments.read',
  shipping: 'shipping.read',
  webhooks: 'webhooks.manage',
  'setup/payments': 'settings.manage',
  'setup/email': 'settings.manage',
  messages: 'messages.read',
  team: null,
};

// navItems is now a function that takes t() so labels are always reactive to locale changes.
// The icon and agencyOnly flag are stable; only label needs translation.
type NavItemDef = {
  id: Page;
  labelKey: Parameters<ReturnType<typeof useT>>[0];
  icon: typeof ClipboardList;
  agencyOnly?: boolean;
};

const NAV_ITEM_DEFS: NavItemDef[] = [
  { id: 'orders',          labelKey: 'nav.orders',    icon: ClipboardList },
  { id: 'customers',       labelKey: 'nav.customers', icon: Users },
  { id: 'inventory',       labelKey: 'nav.inventory', icon: Boxes },
  { id: 'products',        labelKey: 'nav.products',  icon: Package },
  { id: 'discounts',       labelKey: 'nav.discounts', icon: Tag },
  { id: 'downloads',       labelKey: 'nav.downloads', icon: Download },
  { id: 'appointments',    labelKey: 'nav.appointments', icon: CalendarClock },
  { id: 'shipping',        labelKey: 'nav.shipping',  icon: Truck },
  { id: 'messages',        labelKey: 'nav.messages',  icon: MessageSquare },
  { id: 'team',            labelKey: 'nav.team',      icon: UserCog },
  { id: 'webhooks',        labelKey: 'nav.webhooks',  icon: Webhook,   agencyOnly: true },
  { id: 'setup/payments',  labelKey: 'nav.payments',  icon: Settings,  agencyOnly: true },
  { id: 'setup/email',     labelKey: 'nav.email',     icon: Settings,  agencyOnly: true },
];

type LayoutProps = {
  children: ReactNode;
  currentPage: Page;
  onNavigate: (page: Page) => void;
  onLogout: () => void;
  theme: 'light' | 'dark';
  onThemeToggle: () => void;
  isAgency: boolean;
  /** Does the signed-in person hold this permission? */
  can: (permission: string) => boolean;
  /** Signed in as a person (not with an admin access key). */
  hasUser: boolean;
  /** Shown above the footer buttons, e.g. "owner@shop.com". */
  userLabel?: string;
};

export function Layout({
  children,
  currentPage,
  onNavigate,
  onLogout,
  theme,
  onThemeToggle,
  isAgency,
  can,
  hasUser,
  userLabel,
}: LayoutProps) {
  const t = useT();
  const { data: unread } = useQuery({
      queryKey: ['messages-count'],
      queryFn: () => api.getSubmissionCount(),
      refetchInterval: 60_000,
    });
  const { locale, toggleLocale } = useLocale();

  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem('sidebar_collapsed') === 'true'
  );

  const toggleCollapse = () => {
    const newState = !collapsed;
    setCollapsed(newState);
    localStorage.setItem('sidebar_collapsed', String(newState));
  };

  const visibleItems = NAV_ITEM_DEFS.filter((item) => {
    if (item.agencyOnly && !isAgency) return false;
    if (item.id === 'team') return hasUser;
    const needed = PAGE_PERMISSION[item.id];
    return !needed || can(needed);
  });

  const standardItems = visibleItems.filter(
    (item) => item.id !== 'setup/payments' && item.id !== 'setup/email'
  );
  const setupItems = visibleItems.filter(
    (item) => item.id === 'setup/payments' || item.id === 'setup/email'
  );

  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <nav
        className={clsx(
          'relative flex flex-col border-r p-3 transition-all duration-200',
          collapsed ? 'w-14' : 'w-56'
        )}
        style={{ background: 'var(--sidebar-bg)', borderColor: 'var(--sidebar-border)' }}
      >
        {/* Collapse toggle */}
        <button
          onClick={toggleCollapse}
          className="absolute -right-3 top-1/2 -translate-y-1/2 z-10 p-1 rounded hover:bg-[var(--bg-hover)]"
          style={{ color: 'var(--text-muted)' }}
        >
          {collapsed ? <PanelLeft size={16} /> : <PanelLeftClose size={16} />}
        </button>

        {/* Logo */}
        <div className="flex items-center gap-2.5 px-2.5 py-2 mb-4">
          <svg
            className="w-5 h-5 flex-shrink-0"
            viewBox="0 0 88 88"
            fill="currentColor"
            style={{ color: 'var(--text)' }}
          >
            <path d="M46 84V88H42V84H46ZM84 46V42C84 21.0132 66.9868 4 46 4H42C21.0132 4 4 21.0132 4 42V46C4 66.9868 21.0132 84 42 84V88C18.804 88 0 69.196 0 46V42C1.01484e-06 19.1665 18.221 0.588624 40.916 0.0136719L42 0H46L47.084 0.0136719C69.779 0.588625 88 19.1665 88 42V46L87.9863 47.084C87.4114 69.779 68.8335 88 46 88V84C66.9868 84 84 66.9868 84 46Z" />
            <path d="M55.6 29C60.4 29 63.6 32.2 63.6 37V61H57.2V40.2C57.2 37 55.6 35.4 52.4 35.4C49.2 35.4 47.6 37 47.6 40.2V61H41.2V35.4H31.6V61H25.2V29H47.6V37C47.6 32.2 50.8 29 55.6 29Z" />
          </svg>
          {!collapsed && (
            <span className="font-semibold text-sm" style={{ color: 'var(--text)' }}>
              merchant
            </span>
          )}
        </div>

        {/* Standard nav items */}
        <div className="space-y-0.5 flex-1">
          {standardItems.map(({ id, labelKey, icon: Icon }) => (
            <NavButton
              key={id}
              id={id}
              label={id === 'team' && !can('users.manage') ? t('team.account') : t(labelKey)}
              Icon={Icon}
              active={currentPage === id}
              collapsed={collapsed}
              onClick={() => onNavigate(id)}
              badge={id === 'messages' ? unread?.new : undefined}
            />
          ))}

          {/* Setup section — agency only */}
          {setupItems.length > 0 && (
            <>
              <div
                className={clsx(
                  'pt-3 pb-1',
                  collapsed ? 'px-0' : 'px-2.5'
                )}
              >
                {!collapsed && (
                  <span
                    className="text-[10px] font-medium uppercase tracking-widest"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    {t('nav.setup')}
                  </span>
                )}
                {collapsed && (
                  <div
                    className="h-px w-full"
                    style={{ background: 'var(--sidebar-border)' }}
                  />
                )}
              </div>
              {setupItems.map(({ id, labelKey, icon: Icon }) => (
                <NavButton
                  key={id}
                  id={id}
                  label={t(labelKey)}
                  Icon={Icon}
                  active={currentPage === id}
                  collapsed={collapsed}
                  onClick={() => onNavigate(id)}
                />
              ))}
            </>
          )}
        </div>

        {/* Footer */}
        <div
          className="pt-3 space-y-0.5 border-t"
          style={{ borderColor: 'var(--sidebar-border)' }}
        >
          {!collapsed && userLabel && (
            <div className="px-2.5 pb-2 text-[11px] leading-snug break-all" style={{ color: 'var(--text-muted)' }}>
              {t('nav.signedInAs')}
              <br />
              <span style={{ color: 'var(--sidebar-text)' }}>{userLabel}</span>
            </div>
          )}
          <button
            onClick={onThemeToggle}
            className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-sm transition-colors hover:bg-[var(--bg-hover)]"
            style={{ color: 'var(--sidebar-text)' }}
          >
            {theme === 'dark' ? (
              <Sun size={16} className="flex-shrink-0 opacity-60" />
            ) : (
              <Moon size={16} className="flex-shrink-0 opacity-60" />
            )}
            {!collapsed && (
              <span>{theme === 'dark' ? t('nav.lightMode') : t('nav.darkMode')}</span>
            )}
          </button>
          <button
            onClick={toggleLocale}
            className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-sm transition-colors hover:bg-[var(--bg-hover)]"
            style={{ color: 'var(--sidebar-text)' }}
            title={t('nav.switchLang')}
          >
            <Languages size={16} className="flex-shrink-0 opacity-60" />
            {!collapsed && <span>{t('nav.switchLang')}</span>}
          </button>
          <button
            onClick={onLogout}
            className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-sm transition-colors hover:bg-red-500/10 hover:text-red-500"
            style={{ color: 'var(--sidebar-text)' }}
          >
            <LogOut size={16} className="flex-shrink-0 opacity-60" />
            {!collapsed && <span>{t('nav.signout')}</span>}
          </button>
        </div>
      </nav>

      {/* Main content */}
      <main className="flex-1 overflow-auto" style={{ background: 'var(--bg-content)' }}>
        <div className="p-6">{children}</div>
      </main>
    </div>
  );
}

function NavButton({
  id,
  label,
  Icon,
  active,
  collapsed,
  onClick,
  badge,
}: {
  id: Page;
  label: string;
  Icon: typeof ClipboardList;
  active: boolean;
  collapsed: boolean;
  onClick: () => void;
  badge?: number;
}) {
  return (
    <button
      onClick={onClick}
      title={collapsed ? label : undefined}
      className={clsx(
        'w-full flex items-center gap-2.5 px-2.5 py-2 rounded-sm transition-colors',
        active ? 'font-medium' : 'hover:bg-[var(--bg-hover)]'
      )}
      style={{
        color: active ? 'var(--sidebar-active-text)' : 'var(--sidebar-text)',
        background: active ? 'var(--sidebar-active-bg)' : undefined,
      }}
    >
      <Icon size={16} className="flex-shrink-0 opacity-60" />
      {!collapsed && <span>{label}</span>}
      {!!badge && (
        <span
          className="ml-auto text-[11px] leading-none px-1.5 py-1 rounded-full font-medium"
          style={{ background: 'var(--sidebar-active-bg)', color: 'var(--sidebar-active-text)' }}
        >
          {badge}
        </span>
      )}
    </button>
  );
}
