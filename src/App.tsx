import { useCallback, useEffect, useState } from 'react';
import { getAuth, setAuthWithUrl, setAuth, clearAuth, getTheme, setTheme, getAgencyMode } from './lib/store';
import { api, ApiError, type Me } from './lib/api';
import { Layout, Page, PAGE_PERMISSION } from './components/Layout';
import { Login } from './pages/Login';
import { ConfirmSignIn } from './pages/ConfirmSignIn';
import { Team } from './pages/Team';
import { Orders } from './pages/Orders';
import { Customers } from './pages/Customers';
import { Inventory } from './pages/Inventory';
import { Products } from './pages/Products';
import { Webhooks } from './pages/Webhooks';
import { Discounts } from './pages/Discounts';
import { Downloads } from './pages/Downloads';
import { Appointments } from './pages/Appointments';
import { Shipping } from './pages/Shipping';
import { SetupPayments } from './pages/SetupPayments';
import { SetupEmail } from './pages/SetupEmail';
import { Messages } from './pages/Messages';

const VALID_PAGES: Page[] = [
  'orders',
  'customers',
  'inventory',
  'products',
  'discounts',
  'downloads',
  'appointments',
  'shipping',
  'webhooks',
  'setup/payments',
  'setup/email',
  'messages',
  'team',
];

// A sign-in email links to `<admin>/#confirm=<token>`. Read it, and take it out of the address
// bar straight away so it does not linger in history or screenshots.
function takeConfirmToken(): string | null {
  const m = /^#confirm=(.+)$/.exec(window.location.hash);
  if (!m) return null;
  window.history.replaceState(null, '', window.location.pathname + window.location.search);
  try {
    return decodeURIComponent(m[1]);
  } catch {
    return m[1];
  }
}

// Read once at load, in module scope, so React's double render cannot lose it.
const initialConfirmToken = takeConfirmToken();

export default function App() {
  const [me, setMe] = useState<Me | null>(null);
  const [isLoading, setIsLoading] = useState(!initialConfirmToken);
  const [confirmToken, setConfirmToken] = useState<string | null>(initialConfirmToken);
  const [currentPage, setCurrentPage] = useState<Page>('orders');
  const [theme, setThemeState] = useState<'light' | 'dark'>(getTheme());

  const can = useCallback(
    (permission: string) => !!me && (me.permissions.includes('*') || me.permissions.includes(permission)),
    [me]
  );
  // Agency pages: the agency role, or an admin key with the agency toggle on (as before).
  const isAgency = !!me && (me.kind === 'api_key' ? getAgencyMode() : me.role === 'agency');

  /** Ask the API who we are. Resolves true when there is a valid session or key. */
  const loadMe = useCallback(async (): Promise<boolean> => {
    try {
      setMe(await api.me());
      return true;
    } catch (err) {
      // An API that predates sign-in has no /v1/auth/me: fall back to checking the key directly.
      if (err instanceof ApiError && err.status === 404 && getAuth().apiKey) {
        try {
          await api.getOrders({ limit: 1 });
          setMe({ kind: 'api_key', user: null, role: null, permissions: ['*'] });
          return true;
        } catch {
          /* fall through */
        }
      }
      clearAuth();
      setMe(null);
      return false;
    }
  }, []);

  useEffect(() => {
    if (initialConfirmToken) return;
    if (!getAuth().hasCredentials) {
      setIsLoading(false);
      return;
    }
    void loadMe().finally(() => setIsLoading(false));
  }, [loadMe]);

  // A request that comes back 401 while signed in: the session ended.
  useEffect(() => {
    const onExpired = () => {
      clearAuth();
      setMe(null);
    };
    window.addEventListener('auth:expired', onExpired);
    return () => window.removeEventListener('auth:expired', onExpired);
  }, []);

  useEffect(() => {
    const handleHashChange = () => {
      // A sign-in link opened in a tab that is already on the admin only changes the hash.
      const token = takeConfirmToken();
      if (token) {
        setConfirmToken(token);
        return;
      }
      const hash = window.location.hash.slice(1) as Page;
      if (!VALID_PAGES.includes(hash)) return;
      // Guard: agency-only pages, and pages the person's role cannot open.
      const agencyOnlyPages: Page[] = ['webhooks', 'setup/payments', 'setup/email'];
      if (agencyOnlyPages.includes(hash) && !isAgency) return;
      const needed = PAGE_PERMISSION[hash];
      if (me && needed && !can(needed)) return;
      setCurrentPage(hash);
    };
    handleHashChange();
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [me, can, isAgency]);

  const handleSignedIn = async () => {
    const ok = await loadMe();
    if (!ok) throw new Error('Could not start the session');
    setConfirmToken(null);
  };

  const handleKeyLogin = async (apiUrl: string, apiKey: string) => {
    // If VITE_API_URL is set, apiUrl is already resolved from env
    if (import.meta.env.VITE_API_URL) {
      setAuth(apiKey);
    } else {
      setAuthWithUrl(apiUrl || 'http://localhost:8787', apiKey);
    }
    if (!(await loadMe())) throw new Error('Invalid access key. Please try again.');
  };

  const handleLogout = async () => {
    try {
      await api.logout();
    } catch {
      /* already signed out */
    }
    clearAuth();
    setMe(null);
  };

  const handleThemeToggle = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    setThemeState(newTheme);
  };

  const handleNavigate = (page: Page) => {
    window.location.hash = page;
    setCurrentPage(page);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg-app)' }}>
        <div className="animate-pulse text-[var(--text-muted)]">Loading...</div>
      </div>
    );
  }

  if (!me && confirmToken) {
    return <ConfirmSignIn token={confirmToken} onSignedIn={handleSignedIn} onCancel={() => setConfirmToken(null)} />;
  }

  if (!me) {
    return <Login onSignedIn={handleSignedIn} onKeyLogin={handleKeyLogin} />;
  }

  return (
    <Layout
      currentPage={currentPage}
      onNavigate={handleNavigate}
      onLogout={handleLogout}
      theme={theme}
      onThemeToggle={handleThemeToggle}
      isAgency={isAgency}
      can={can}
      hasUser={!!me.user}
      userLabel={me.user ? `${me.user.email} · ${me.user.role}` : undefined}
    >
      {currentPage === 'orders' && <Orders />}
      {currentPage === 'customers' && <Customers />}
      {currentPage === 'inventory' && <Inventory />}
      {currentPage === 'products' && <Products />}
      {currentPage === 'discounts' && <Discounts />}
      {currentPage === 'downloads' && <Downloads />}
      {currentPage === 'appointments' && <Appointments />}
      {currentPage === 'shipping' && <Shipping />}
      {currentPage === 'webhooks' && isAgency && <Webhooks />}
      {currentPage === 'setup/payments' && isAgency && <SetupPayments />}
      {currentPage === 'setup/email' && isAgency && <SetupEmail />}
      {currentPage === 'messages' && <Messages />}
      {currentPage === 'team' && <Team me={me} onSignedOut={handleLogout} />}
    </Layout>
  );
}
