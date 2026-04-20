import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui';
import { useState } from 'react';

export function AppLayout() {
  const { role, email, logout, isAuthenticated } = useAuthStore();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  if (!isAuthenticated) {
    navigate('/login');
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Top nav */}
      <header className="border-b bg-card">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4">
          <Link to="/" className="text-lg font-bold">
            <span className="text-foreground">Meta</span><span style={{ color: '#e84393' }}>Pick</span>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-6">
            <NavLinks role={role!} />
            <span className="text-sm text-muted-foreground truncate max-w-[160px]">{email}</span>
            <Button variant="ghost" size="sm" onClick={handleLogout}>
              Logga ut
            </Button>
          </nav>

          {/* Mobile hamburger */}
          <button
            className="md:hidden p-2 text-muted-foreground hover:text-foreground"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Meny"
          >
            {mobileOpen ? (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            ) : (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
            )}
          </button>
        </div>

        {/* Mobile menu dropdown */}
        {mobileOpen && (
          <div className="md:hidden border-t bg-card px-4 py-3 flex flex-col gap-3">
            <MobileNavLinks role={role!} onNavigate={() => setMobileOpen(false)} />
            <div className="border-t pt-3 flex items-center justify-between">
              <span className="text-sm text-muted-foreground truncate max-w-[200px]">{email}</span>
              <Button variant="ghost" size="sm" onClick={handleLogout}>Logga ut</Button>
            </div>
          </div>
        )}
      </header>

      {/* Page content */}
      <main className="mx-auto max-w-7xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}

function NavLinks({ role }: { role: string }) {
  const location = useLocation();
  const isActive = (path: string) => location.pathname.startsWith(path);

  const links: Record<string, { label: string; path: string }[]> = {
    Admin: [
      { label: 'Översikt', path: '/admin' },
    ],
    Brand: [
      { label: 'Dashboard', path: '/brand' },
      { label: 'Kampanjer', path: '/brand/campaigns' },
      { label: 'Ansökningar', path: '/brand/applications' },
    ],
    Creator: [
      { label: 'Dashboard', path: '/creator' },
      { label: 'Utforska', path: '/creator/browse' },
      { label: 'Mina uppdrag', path: '/creator/assignments' },
      { label: 'Intjäning', path: '/creator/earnings' },
      { label: 'Min profil', path: '/creator/profile' },
    ],
  };

  return (
    <>
      {(links[role] ?? []).map((link) => (
        <Link
          key={link.path}
          to={link.path}
          className={cn(
            'text-sm hover:text-primary transition-colors',
            isActive(link.path) ? 'text-primary font-medium' : 'text-muted-foreground',
          )}
        >
          {link.label}
        </Link>
      ))}
    </>
  );
}

function MobileNavLinks({ role, onNavigate }: { role: string; onNavigate: () => void }) {
  const location = useLocation();
  const isActive = (path: string) => location.pathname.startsWith(path);

  const links: Record<string, { label: string; path: string }[]> = {
    Admin: [
      { label: 'Översikt', path: '/admin' },
    ],
    Brand: [
      { label: 'Dashboard', path: '/brand' },
      { label: 'Kampanjer', path: '/brand/campaigns' },
      { label: 'Ansökningar', path: '/brand/applications' },
    ],
    Creator: [
      { label: 'Dashboard', path: '/creator' },
      { label: 'Utforska', path: '/creator/browse' },
      { label: 'Mina uppdrag', path: '/creator/assignments' },
      { label: 'Intjäning', path: '/creator/earnings' },
      { label: 'Min profil', path: '/creator/profile' },
    ],
  };

  return (
    <>
      {(links[role] ?? []).map((link) => (
        <Link
          key={link.path}
          to={link.path}
          onClick={onNavigate}
          className={cn(
            'block py-2 text-sm hover:text-primary transition-colors',
            isActive(link.path) ? 'text-primary font-medium' : 'text-muted-foreground',
          )}
        >
          {link.label}
        </Link>
      ))}
    </>
  );
}
