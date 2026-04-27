import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { cn } from '@/lib/utils';
import { useState } from 'react';

/* ─────────────────────────────────────────────────────────────
   Editorial topbar — thin, generous andrum, serif wordmark.
   No mechanical borders. Hairline divider replaces solid line.
   ───────────────────────────────────────────────────────────── */

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
    <div className="min-h-screen">
      {/* Top nav */}
      <header className="sticky top-0 z-40 backdrop-blur-md bg-[hsl(var(--background)/0.78)]">
        <div className="mx-auto flex h-16 max-w-[1240px] items-center justify-between px-6 md:px-10">
          <Link to="/" className="group flex items-center gap-1.5 leading-none" aria-label="MetaPick">
            <span className="text-display text-[1.5rem]">meta<span className="text-sunset">pick</span></span>
            <span className="ml-0.5 h-1.5 w-1.5 rounded-full bg-sunset" aria-hidden />
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-8">
            <NavLinks role={role!} />
          </nav>

          <div className="hidden md:flex items-center gap-4">
            <div className="text-right leading-tight">
              <div className="eyebrow !tracking-[0.18em]">{role}</div>
              <div className="text-xs text-muted-foreground truncate max-w-[180px]">{email}</div>
            </div>
            <button
              onClick={handleLogout}
              className="pill h-9 px-4 text-xs border border-[hsl(var(--border))] bg-transparent hover:bg-[hsl(var(--sand))] hover:border-[hsl(var(--border-strong))] transition-all duration-300 ease-soft"
            >
              Logga ut
            </button>
          </div>

          {/* Mobile hamburger */}
          <button
            className="md:hidden p-2 text-muted-foreground hover:text-foreground transition-colors"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Meny"
          >
            {mobileOpen ? (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            ) : (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><line x1="3" y1="7" x2="21" y2="7"/><line x1="3" y1="13" x2="17" y2="13"/><line x1="3" y1="19" x2="13" y2="19"/></svg>
            )}
          </button>
        </div>

        {/* hairline */}
        <div className="hairline mx-6 md:mx-10" />

        {/* Mobile menu dropdown */}
        {mobileOpen && (
          <div className="md:hidden px-6 py-5 flex flex-col gap-2 animate-fade-rise">
            <MobileNavLinks role={role!} onNavigate={() => setMobileOpen(false)} />
            <div className="hairline my-3" />
            <div className="flex items-center justify-between">
              <div>
                <div className="eyebrow !tracking-[0.18em]">{role}</div>
                <span className="text-xs text-muted-foreground truncate max-w-[200px]">{email}</span>
              </div>
              <button
                onClick={handleLogout}
                className="pill h-9 px-4 text-xs border border-[hsl(var(--border))] hover:bg-[hsl(var(--sand))]"
              >
                Logga ut
              </button>
            </div>
          </div>
        )}
      </header>

      {/* Page content */}
      <main className="mx-auto max-w-[1240px] px-6 md:px-10 py-10 md:py-14 animate-fade-rise">
        <Outlet />
      </main>

      <footer className="mt-24 border-t border-[hsl(var(--border))]">
        <div className="mx-auto max-w-[1240px] px-6 md:px-10 py-10 flex flex-wrap items-center justify-between gap-3">
          <div className="text-display text-lg">meta<span className="text-sunset">pick</span></div>
          <p className="text-xs text-muted-foreground">© 2026 MetaPick · Made with ☀ in Stockholm</p>
        </div>
      </footer>
    </div>
  );
}

function navLinksFor(role: string) {
  const links: Record<string, { label: string; path: string }[]> = {
    Admin: [
      { label: 'Översikt', path: '/admin' },
    ],
    Brand: [
      { label: 'Översikt',     path: '/brand' },
      { label: 'Kampanjer',    path: '/brand/campaigns' },
      { label: 'Ansökningar',  path: '/brand/applications' },
      { label: 'Inställningar',path: '/brand/settings' },
    ],
    Creator: [
      { label: 'Översikt',     path: '/creator' },
      { label: 'Utforska',     path: '/creator/browse' },
      { label: 'Mina uppdrag', path: '/creator/assignments' },
      { label: 'Intjäning',    path: '/creator/earnings' },
      { label: 'Profil',       path: '/creator/profile' },
    ],
  };
  return links[role] ?? [];
}

function NavLinks({ role }: { role: string }) {
  const location = useLocation();
  // active = exact match, or longer path that begins with link.path + '/'
  const isActive = (path: string) => {
    if (location.pathname === path) return true;
    return location.pathname.startsWith(path + '/');
  };

  return (
    <>
      {navLinksFor(role).map((link) => {
        const active = isActive(link.path);
        return (
          <Link
            key={link.path}
            to={link.path}
            className={cn(
              'relative text-[0.85rem] font-medium tracking-tight transition-colors duration-300 ease-soft',
              active ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {link.label}
            <span
              className={cn(
                'absolute -bottom-1.5 left-0 h-px bg-primary transition-all duration-500 ease-editorial',
                active ? 'w-full' : 'w-0',
              )}
            />
          </Link>
        );
      })}
    </>
  );
}

function MobileNavLinks({ role, onNavigate }: { role: string; onNavigate: () => void }) {
  const location = useLocation();
  const isActive = (path: string) => {
    if (location.pathname === path) return true;
    return location.pathname.startsWith(path + '/');
  };

  return (
    <>
      {navLinksFor(role).map((link) => {
        const active = isActive(link.path);
        return (
          <Link
            key={link.path}
            to={link.path}
            onClick={onNavigate}
            className={cn(
              'flex items-center justify-between py-2.5 text-base transition-colors',
              active ? 'text-foreground font-medium' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <span>{link.label}</span>
            {active && <span className="h-1.5 w-1.5 rounded-full bg-primary" />}
          </Link>
        );
      })}
    </>
  );
}
