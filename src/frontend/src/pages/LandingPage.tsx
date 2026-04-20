import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';

export function LandingPage() {
  const navigate = useNavigate();
  const { isAuthenticated, role } = useAuthStore();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleJoinCreator = () => {
    if (isAuthenticated) {
      navigate(role === 'Brand' ? '/brand' : '/creator');
    } else {
      navigate('/register?role=Creator');
    }
  };

  const handleForBrands = () => {
    if (isAuthenticated) {
      navigate(role === 'Brand' ? '/brand' : '/creator');
    } else {
      navigate('/register?role=Brand');
    }
  };

  return (
    <div className="min-h-screen" style={{ background: '#0a0a0f', color: '#fafafa', fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" }}>
      {/* NAV */}
      <nav style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 50, background: 'rgba(10,10,15,.7)', backdropFilter: 'blur(16px)', borderBottom: '1px solid #1e1e2e' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 64, maxWidth: 1100, margin: '0 auto', padding: '0 1.25rem' }}>
          <a href="/" style={{ fontSize: '1.25rem', fontWeight: 700, textDecoration: 'none', color: '#fafafa', flexShrink: 0 }}>
            Meta<span style={{ color: '#e84393' }}>Pick</span>
          </a>

          {/* Desktop center links */}
          <div className="hidden-mobile" style={{ display: 'flex', gap: '2rem', alignItems: 'center' }}>
            <a href="#creators" style={{ fontSize: '.875rem', color: '#8b8ba3', textDecoration: 'none' }}>For Creators</a>
            <a href="#brands" style={{ fontSize: '.875rem', color: '#8b8ba3', textDecoration: 'none' }}>For Brands</a>
            <a href="#how-it-works" style={{ fontSize: '.875rem', color: '#8b8ba3', textDecoration: 'none' }}>How It Works</a>
          </div>

          {/* Desktop right buttons */}
          <div className="hidden-mobile" style={{ display: 'flex', alignItems: 'center', gap: '.5rem' }}>
            <button onClick={() => navigate('/login')} style={{ background: 'none', border: 'none', color: '#8b8ba3', fontSize: '.875rem', cursor: 'pointer', padding: '.5rem 1rem' }}>Logga in</button>
            <button onClick={() => navigate('/register')} style={{ background: '#e84393', color: '#fff', border: 'none', padding: '.5rem 1.25rem', borderRadius: '.5rem', fontSize: '.875rem', fontWeight: 600, cursor: 'pointer' }}>Skapa konto</button>
          </div>

          {/* Mobile: login + hamburger */}
          <div className="show-mobile" style={{ display: 'none', alignItems: 'center', gap: '.5rem' }}>
            <button onClick={() => navigate('/login')} style={{ background: 'none', border: 'none', color: '#8b8ba3', fontSize: '.875rem', cursor: 'pointer', padding: '.375rem .75rem' }}>Logga in</button>
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              style={{ background: 'none', border: 'none', color: '#8b8ba3', cursor: 'pointer', padding: '.375rem' }}
              aria-label="Meny"
            >
              {mobileMenuOpen
                ? <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                : <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
              }
            </button>
          </div>
        </div>

        {/* Mobile dropdown */}
        {mobileMenuOpen && (
          <div style={{ borderTop: '1px solid #1e1e2e', padding: '1rem 1.25rem', display: 'flex', flexDirection: 'column', gap: '.75rem', background: 'rgba(10,10,15,.95)' }}>
            <a href="#creators" onClick={() => setMobileMenuOpen(false)} style={{ fontSize: '.9rem', color: '#8b8ba3', textDecoration: 'none' }}>For Creators</a>
            <a href="#brands" onClick={() => setMobileMenuOpen(false)} style={{ fontSize: '.9rem', color: '#8b8ba3', textDecoration: 'none' }}>For Brands</a>
            <a href="#how-it-works" onClick={() => setMobileMenuOpen(false)} style={{ fontSize: '.9rem', color: '#8b8ba3', textDecoration: 'none' }}>How It Works</a>
            <button onClick={() => navigate('/register')} style={{ background: '#e84393', color: '#fff', border: 'none', padding: '.625rem 1.25rem', borderRadius: '.5rem', fontSize: '.875rem', fontWeight: 600, cursor: 'pointer', textAlign: 'left' }}>
              Skapa konto
            </button>
          </div>
        )}
      </nav>

      <style>{`
        @keyframes scroll{0%{transform:translateX(0)}100%{transform:translateX(-50%)}}
        @media(max-width:640px){
          .hidden-mobile{display:none!important}
          .show-mobile{display:flex!important}
        }
      `}</style>

      {/* HERO */}
      <section style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', position: 'relative', paddingTop: 64 }}>
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 80% 60% at 50% 40%, rgba(124,58,237,.3), rgba(232,67,147,.15) 40%, transparent 70%)', pointerEvents: 'none' }} />
        <div style={{ position: 'relative', zIndex: 1, maxWidth: 800, padding: '0 1.5rem' }}>
          <div style={{ display: 'inline-block', padding: '.375rem 1rem', border: '1px solid #1e1e2e', borderRadius: 999, fontSize: '.75rem', color: '#8b8ba3', textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: '1.5rem' }}>
            The #1 Influencer-Brand Platform
          </div>
          <h1 style={{ fontSize: 'clamp(2.5rem, 6vw, 4.5rem)', fontWeight: 800, lineHeight: 1.1, marginBottom: '1.5rem', letterSpacing: '-.02em' }}>
            Where Influencers{' '}
            <span style={{ background: 'linear-gradient(135deg, #e84393, #7c3aed)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
              Meet Brands
            </span>
          </h1>
          <p style={{ fontSize: '1.125rem', color: '#8b8ba3', maxWidth: 600, margin: '0 auto 2.5rem' }}>
            Connect with top brands, create authentic content, and earn money doing what you love. MetaPick makes it effortless.
          </p>
          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            <button onClick={handleJoinCreator} style={{ padding: '.875rem 2rem', borderRadius: '.75rem', fontSize: '1rem', fontWeight: 600, cursor: 'pointer', background: '#e84393', color: '#fff', border: 'none' }}>
              Join as Creator →
            </button>
            <button onClick={handleForBrands} style={{ padding: '.875rem 2rem', borderRadius: '.75rem', fontSize: '1rem', fontWeight: 600, cursor: 'pointer', background: 'transparent', color: '#fafafa', border: '1px solid #1e1e2e' }}>
              For Brands
            </button>
          </div>
        </div>
      </section>

      {/* BRANDS MARQUEE */}
      <section style={{ padding: '4rem 0', borderTop: '1px solid #1e1e2e', borderBottom: '1px solid #1e1e2e', overflow: 'hidden' }}>
        <p style={{ textAlign: 'center', fontSize: '.7rem', textTransform: 'uppercase', letterSpacing: '.2em', color: '#8b8ba3', marginBottom: '2rem' }}>
          Trusted by leading brands
        </p>
        <div style={{ display: 'flex', whiteSpace: 'nowrap', animation: 'scroll 25s linear infinite' }}>
          {['NIKE', 'ADIDAS', 'H&M', 'ZARA', 'ASOS', 'PUMA', 'GUCCI', 'DIOR', 'CHANEL', 'BURBERRY'].concat(['NIKE', 'ADIDAS', 'H&M', 'ZARA', 'ASOS', 'PUMA', 'GUCCI', 'DIOR', 'CHANEL', 'BURBERRY']).map((b, i) => (
            <span key={i} style={{ margin: '0 2.5rem', fontSize: '1.25rem', fontWeight: 700, color: 'rgba(138,138,163,.35)', userSelect: 'none' }}>{b}</span>
          ))}
        </div>
      </section>

      {/* FEATURES */}
      <section id="brands" style={{ padding: '6rem 0' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 1.5rem' }}>
          <h2 style={{ fontSize: 'clamp(1.75rem, 4vw, 2.5rem)', fontWeight: 800, textAlign: 'center', marginBottom: '1rem' }}>Built for Both Sides</h2>
          <p style={{ textAlign: 'center', color: '#8b8ba3', maxWidth: 480, margin: '0 auto 4rem' }}>
            Whether you're a brand looking for reach or a creator looking for income — MetaPick has you covered.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem', maxWidth: 900, margin: '0 auto' }}>
            <div style={{ borderRadius: '1rem', padding: '2rem', border: '1px solid rgba(124,58,237,.2)', background: 'rgba(45,27,78,.4)' }}>
              <h3 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '.75rem' }}>For Brands</h3>
              <p style={{ color: '#8b8ba3', fontSize: '.9rem', marginBottom: '1.5rem' }}>
                Find the perfect creators for your campaigns. Target by niche, audience size, and engagement rate.
              </p>
              <div style={{ display: 'flex', alignItems: 'center', gap: '.75rem', marginBottom: '1rem', fontSize: '.875rem' }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#e84393', flexShrink: 0 }} /> Launch campaigns in minutes
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '.75rem', fontSize: '.875rem' }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#e84393', flexShrink: 0 }} /> Track real-time performance
              </div>
            </div>
            <div id="creators" style={{ borderRadius: '1rem', padding: '2rem', border: '1px solid rgba(232,67,147,.15)', background: 'rgba(232,67,147,.08)' }}>
              <h3 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '.75rem' }}>For Creators</h3>
              <p style={{ color: '#8b8ba3', fontSize: '.9rem', marginBottom: '1.5rem' }}>
                Discover brand deals that match your style. No more cold DMs — brands come to you.
              </p>
              <div style={{ display: 'flex', alignItems: 'center', gap: '.75rem', marginBottom: '1rem', fontSize: '.875rem' }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#e84393', flexShrink: 0 }} /> Get discovered by top brands
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '.75rem', fontSize: '.875rem' }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#e84393', flexShrink: 0 }} /> Transparent earnings & payouts
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how-it-works" style={{ padding: '6rem 0' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 1.5rem' }}>
          <h2 style={{ fontSize: 'clamp(1.75rem, 4vw, 2.5rem)', fontWeight: 800, textAlign: 'center', marginBottom: '1rem' }}>How It Works</h2>
          <p style={{ textAlign: 'center', color: '#8b8ba3', maxWidth: 480, margin: '0 auto 4rem' }}>
            Three simple steps to start earning as a creator.
          </p>
          <div style={{ maxWidth: 600, margin: '0 auto' }}>
            {[
              { num: '01', title: 'Discover', desc: 'Browse brands and campaigns that fit your niche and audience.' },
              { num: '02', title: 'Create & Share', desc: 'Create authentic content and share it with your followers.' },
              { num: '03', title: 'Earn', desc: 'Get paid directly through the platform. No hassle, no delays.' },
            ].map((step, i) => (
              <div key={i} style={{ display: 'flex', gap: '1.5rem' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'rgba(232,67,147,.15)', border: '1px solid rgba(232,67,147,.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, color: '#e84393', fontSize: '.875rem', flexShrink: 0 }}>
                    {i + 1}
                  </div>
                  {i < 2 && <div style={{ width: 1, flex: 1, background: '#1e1e2e', margin: '.5rem 0' }} />}
                </div>
                <div style={{ paddingBottom: i < 2 ? '3rem' : 0 }}>
                  <span style={{ fontSize: '.75rem', color: '#e84393', fontFamily: 'monospace' }}>{step.num}</span>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: 700, margin: '.25rem 0 .5rem' }}>{step.title}</h3>
                  <p style={{ fontSize: '.875rem', color: '#8b8ba3' }}>{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* STATS */}
      <section style={{ padding: '6rem 0', borderTop: '1px solid #1e1e2e', borderBottom: '1px solid #1e1e2e' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 1.5rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '3rem', textAlign: 'center' }}>
            {[
              { val: '10,000+', label: 'Creators' },
              { val: '500+', label: 'Brands' },
              { val: '€2M+', label: 'Earned by Creators' },
            ].map((s, i) => (
              <div key={i}>
                <div style={{ fontSize: 'clamp(2rem, 5vw, 3rem)', fontWeight: 800, background: 'linear-gradient(135deg, #e84393, #7c3aed)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
                  {s.val}
                </div>
                <div style={{ color: '#8b8ba3', marginTop: '.5rem' }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section style={{ padding: '6rem 0' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 1.5rem' }}>
          <h2 style={{ fontSize: 'clamp(1.75rem, 4vw, 2.5rem)', fontWeight: 800, textAlign: 'center', marginBottom: '4rem' }}>
            Loved by Creators & Brands
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem', maxWidth: 1000, margin: '0 auto' }}>
            {[
              { quote: 'MetaPick changed the game for me. I went from 0 brand deals to working with my dream companies in just 2 months.', name: 'Sara Lindström', role: 'Fashion Creator · 120K followers' },
              { quote: 'Finding micro-influencers used to take weeks. Now we launch campaigns in hours with creators that actually fit our brand.', name: 'Johan Eriksson', role: 'Marketing Lead, Nordic Brands' },
              { quote: "The payouts are fast, the dashboard is clean, and I always know what's coming next. Best creator platform I've used.", name: 'Maya Chen', role: 'Lifestyle Creator · 45K followers' },
            ].map((t, i) => (
              <div key={i} style={{ background: 'rgba(20,20,31,.6)', backdropFilter: 'blur(16px)', border: '1px solid rgba(30,30,46,.5)', borderRadius: '1rem', padding: '1.5rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <q style={{ fontSize: '.875rem', color: '#8b8ba3', lineHeight: 1.7, display: 'block', marginBottom: '1.5rem', quotes: 'none' }}>
                  {t.quote}
                </q>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '.875rem' }}>{t.name}</div>
                  <div style={{ fontSize: '.75rem', color: '#8b8ba3' }}>{t.role}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section style={{ padding: '6rem 0' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 1.5rem' }}>
          <div style={{ background: 'linear-gradient(135deg, #2d1b4e, rgba(124,58,237,.2), rgba(232,67,147,.15))', borderRadius: '1.5rem', padding: '5rem 2rem', textAlign: 'center' }}>
            <h2 style={{ fontSize: 'clamp(1.75rem, 4vw, 3rem)', fontWeight: 800, marginBottom: '1rem' }}>Ready to grow?</h2>
            <p style={{ color: '#8b8ba3', maxWidth: 440, margin: '0 auto 2rem' }}>
              Join thousands of creators and brands already using MetaPick to build partnerships that matter.
            </p>
            <button onClick={() => navigate('/register')} style={{ background: '#e84393', color: '#fff', border: 'none', padding: '.875rem 2.5rem', borderRadius: '.75rem', fontSize: '1rem', fontWeight: 600, cursor: 'pointer' }}>
              Get Started →
            </button>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer style={{ borderTop: '1px solid #1e1e2e', padding: '3rem 0' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 1.5rem' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '1.5rem' }}>
            <a href="/" style={{ fontSize: '1.125rem', fontWeight: 700, textDecoration: 'none', color: '#fafafa' }}>
              Meta<span style={{ color: '#e84393' }}>Pick</span>
            </a>
            <div style={{ display: 'flex', gap: '1.5rem' }}>
              <a href="#creators" style={{ fontSize: '.875rem', color: '#8b8ba3', textDecoration: 'none' }}>For Creators</a>
              <a href="#brands" style={{ fontSize: '.875rem', color: '#8b8ba3', textDecoration: 'none' }}>For Brands</a>
              <a href="#" style={{ fontSize: '.875rem', color: '#8b8ba3', textDecoration: 'none' }}>About</a>
              <a href="#" style={{ fontSize: '.875rem', color: '#8b8ba3', textDecoration: 'none' }}>Privacy</a>
            </div>
          </div>
          <p style={{ textAlign: 'center', fontSize: '.75rem', color: '#8b8ba3', marginTop: '2rem' }}>
            © 2026 MetaPick. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
