import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui';

export function AppLayout() {
  const { role, email, logout, isAuthenticated } = useAuthStore();
  const navigate = useNavigate();

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
          <nav className="flex items-center gap-6">
            <NavLinks role={role!} />
            <span className="text-sm text-muted-foreground">{email}</span>
            <Button variant="ghost" size="sm" onClick={handleLogout}>
              Logga ut
            </Button>
          </nav>
        </div>
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
      { label: 'Brands', path: '/admin/brands' },
      { label: 'Creators', path: '/admin/creators' },
      { label: 'Kampanjer', path: '/admin/campaigns' },
      { label: 'Utbetalningar', path: '/admin/payouts' },
      { label: 'Bedrägeri', path: '/admin/fraud' },
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
