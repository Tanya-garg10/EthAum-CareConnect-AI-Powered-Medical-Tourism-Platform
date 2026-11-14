import { useCallback, useEffect, useState } from 'react';
import LandingPage from './components/LandingPage';
import AuthPortal from './components/AuthPortal';
import PatientDashboard from './components/PatientDashboard';
import ProviderDashboard from './components/ProviderDashboard';
import AdminDashboard from './components/AdminDashboard';
import { signOutFirebase } from './lib/firebase';
import type { PlatformBootstrapData, User } from './types';

type AppView = 'landing' | 'auth' | 'portal';

const TOKEN_KEY = 'careconnect_auth_token';

export default function App() {
  const [view, setView] = useState<AppView>('landing');
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [authRole, setAuthRole] = useState<'patient' | 'provider'>('patient');
  const [prefillSpecialty, setPrefillSpecialty] = useState<string | undefined>(undefined);

  const [token, setToken] = useState<string | null>(() => {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  });
  const [user, setUser] = useState<User | null>(null);
  const [bootstrapData, setBootstrapData] = useState<PlatformBootstrapData | null>(null);

  const loadWorkspace = useCallback(async (activeToken: string) => {
    try {
      const [meRes, bootRes] = await Promise.all([
        fetch('/api/auth/me', {
          headers: { Authorization: `Bearer ${activeToken}` },
        }),
        fetch('/api/bootstrap', {
          headers: { Authorization: `Bearer ${activeToken}` },
        }),
      ]);
      if (!meRes.ok || !bootRes.ok) {
        localStorage.removeItem(TOKEN_KEY);
        setToken(null);
        setUser(null);
        setBootstrapData(null);
        return false;
      }
      const meJson = await meRes.json();
      const bootJson = await bootRes.json();
      setUser(meJson.user);
      setBootstrapData(bootJson);
      return true;
    } catch {
      return false;
    }
  }, []);

  useEffect(() => {
    if (token) {
      loadWorkspace(token);
    }
  }, [token, loadWorkspace]);

  const handleOpenAuth = (
    mode: 'login' | 'register',
    role: 'patient' | 'provider' = 'patient',
    specialty?: string,
  ) => {
    setAuthMode(mode);
    setAuthRole(role);
    setPrefillSpecialty(specialty);
    setView('auth');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleAuthenticated = async (
    newToken: string,
    authenticatedUser: User,
    specialty?: string,
  ) => {
    try {
      localStorage.setItem(TOKEN_KEY, newToken);
    } catch {
      // ignore storage failure
    }
    setToken(newToken);
    setUser(authenticatedUser);
    setPrefillSpecialty(specialty);
    const ok = await loadWorkspace(newToken);
    if (ok) {
      setView('portal');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleSignOut = () => {
    void signOutFirebase().catch(() => {});
    try {
      localStorage.removeItem(TOKEN_KEY);
    } catch {
      // ignore
    }
    setToken(null);
    setUser(null);
    setBootstrapData(null);
    setView('landing');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (view === 'auth') {
    return (
      <AuthPortal
        initialMode={authMode}
        initialRole={authRole}
        prefillSpecialty={prefillSpecialty}
        onBackToLanding={() => setView('landing')}
        onAuthenticated={handleAuthenticated}
      />
    );
  }

  if (view === 'portal' && token && user) {
    if (!bootstrapData) {
      return (
        <div className="min-h-screen bg-[#070B18] flex items-center justify-center text-sm text-slate-300">
          Loading EthAum CareConnect workspace...
        </div>
      );
    }

    if (user.role === 'admin') {
      return (
        <AdminDashboard
          user={user}
          token={token}
          data={bootstrapData}
          onRefresh={async () => {
            await loadWorkspace(token);
          }}
          onSignOut={handleSignOut}
          onBackToLanding={() => setView('landing')}
        />
      );
    }

    if (user.role === 'provider') {
      return (
        <ProviderDashboard
          user={user}
          token={token}
          data={bootstrapData}
          onRefresh={async () => {
            await loadWorkspace(token);
          }}
          onSignOut={handleSignOut}
          onBackToLanding={() => setView('landing')}
        />
      );
    }

    return (
      <PatientDashboard
        user={user}
        token={token}
        data={bootstrapData}
        prefillSpecialty={prefillSpecialty}
        onRefresh={async () => {
          await loadWorkspace(token);
        }}
        onSignOut={handleSignOut}
        onBackToLanding={() => setView('landing')}
      />
    );
  }

  return (
    <LandingPage
      currentUser={user}
      onOpenAuth={handleOpenAuth}
      onEnterPortal={() => {
        if (user && token) {
          setView('portal');
          window.scrollTo({ top: 0, behavior: 'smooth' });
        } else {
          handleOpenAuth('login');
        }
      }}
    />
  );
}
