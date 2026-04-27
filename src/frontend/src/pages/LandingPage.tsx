import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';

/* ─────────────────────────────────────────────────────────────
   LandingPage — creator-coded edition.
   Inga påhittade siffror, inga riktiga varumärken, inga
   påhittade citat eller personer. All copy är generisk
   produktbeskrivning som inte gör faktiska påståenden.
   ───────────────────────────────────────────────────────────── */

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
    <div className="relative min-h-screen overflow-x-hidden">
      {/* Decorative sunset blobs */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-0 overflow-hidden">
        <div className="blob h-[460px] w-[460px] -top-20 -left-24 bg-[hsl(22_92%_70%_/_0.5)]" />
        <div className="blob h-[520px] w-[520px] top-[60vh] -right-32 bg-[hsl(8_78%_60%_/_0.4)]" />
        <div className="blob h-[360px] w-[360px] top-[140vh] left-[20vw] bg-[hsl(40_92%_70%_/_0.45)]" />
      </div>

      {/* NAV ──────────────────────────────────────────── */}
      <nav className="fixed inset-x-0 top-0 z-50 backdrop-blur-md bg-[hsl(var(--background)/0.7)]">
        <div className="mx-auto flex h-16 max-w-[1280px] items-center justify-between px-5 md:px-10">
          <a href="/" className="group flex items-center gap-1.5 leading-none" aria-label="MetaPick">
            <span className="text-display text-[1.55rem]">meta<span className="text-sunset">pick</span></span>
            <span className="ml-0.5 inline-block h-1.5 w-1.5 rounded-full bg-sunset" aria-hidden />
          </a>

          <div className="hidden md:flex items-center gap-8 text-sm font-medium">
            <a href="#creators" className="text-muted-foreground hover:text-foreground transition-colors">For Creators</a>
            <a href="#brands"   className="text-muted-foreground hover:text-foreground transition-colors">For Brands</a>
            <a href="#how"      className="text-muted-foreground hover:text-foreground transition-colors">How it works</a>
          </div>

          <div className="hidden md:flex items-center gap-2">
            <button onClick={() => navigate('/login')}    className="pill h-10 px-5 text-sm text-foreground hover:bg-[hsl(var(--sand))]">Logga in</button>
            <button onClick={() => navigate('/register')} className="pill h-10 px-5 text-sm bg-foreground text-background hover:opacity-90 shadow-soft">
              Skapa konto <span aria-hidden>→</span>
            </button>
          </div>

          <div className="md:hidden flex items-center gap-1">
            <button onClick={() => navigate('/login')} className="pill h-9 px-3 text-xs">Logga in</button>
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 text-muted-foreground hover:text-foreground"
              aria-label="Meny"
            >
              {mobileMenuOpen
                ? <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                : <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="3" y1="7" x2="21" y2="7"/><line x1="3" y1="13" x2="17" y2="13"/><line x1="3" y1="19" x2="13" y2="19"/></svg>
              }
            </button>
          </div>
        </div>
        <div className="hairline mx-5 md:mx-10" />

        {mobileMenuOpen && (
          <div className="md:hidden px-5 py-5 flex flex-col gap-3 bg-[hsl(var(--paper))]">
            <a href="#creators" onClick={() => setMobileMenuOpen(false)} className="py-1.5 font-medium">For Creators</a>
            <a href="#brands"   onClick={() => setMobileMenuOpen(false)} className="py-1.5 font-medium">For Brands</a>
            <a href="#how"      onClick={() => setMobileMenuOpen(false)} className="py-1.5 font-medium">How it works</a>
            <button onClick={() => navigate('/register')} className="pill mt-2 h-11 px-5 bg-foreground text-background self-start">Skapa konto →</button>
          </div>
        )}
      </nav>

      {/* HERO ─────────────────────────────────────────── */}
      <section className="relative pt-32 md:pt-40 pb-16 md:pb-24">
        <div className="mx-auto max-w-[1280px] px-5 md:px-10">
          <div className="flex justify-center mb-8">
            <div className="sticker">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-primary" />
              Creator marketplace
            </div>
          </div>

          <h1 className="text-display text-center text-[clamp(3rem,10vw,8rem)]">
            Get paid<br />
            for your <span className="text-sunset">vibe</span>.
          </h1>

          <p className="mt-8 text-center mx-auto col-prose text-[1.1rem] md:text-[1.2rem] text-muted-foreground">
            MetaPick är creator marketplace där brands och creators möts direkt.
            Inga cold DMs, inga spreadsheets, ingen agency-mellanhand — bara content och payouts på ett ställe.
          </p>

          <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
            <button
              onClick={handleJoinCreator}
              className="pill h-14 px-9 text-[1rem] bg-foreground text-background hover:opacity-95 shadow-lift"
            >
              Bli creator <span aria-hidden>→</span>
            </button>
            <button
              onClick={handleForBrands}
              className="pill h-14 px-9 text-[1rem] bg-[hsl(var(--ivory))] text-foreground border border-[hsl(var(--border))] hover:bg-[hsl(var(--sand))]"
            >
              Jag är ett brand
            </button>
          </div>

          <p className="mt-6 text-center text-xs text-muted-foreground">
            Gratis att registrera · Kom igång på minuter
          </p>

          {/* Visual mockup — abstract gradient surfaces, no fake metrics */}
          <div className="relative mt-20 md:mt-28 mx-auto max-w-[1080px]">
            <div className="grid grid-cols-12 gap-4 md:gap-6">
              {/* Big gradient hero card — abstract */}
              <div
                className="col-span-12 md:col-span-7 relative aspect-[16/10] rounded-[28px] overflow-hidden shadow-floaty bg-sunset"
                aria-hidden
              >
                <div className="absolute inset-0 mix-blend-overlay opacity-30 bg-[radial-gradient(ellipse_at_top_right,_white,_transparent_60%)]" />
                <div className="absolute inset-0 p-7 md:p-9 flex flex-col justify-between text-[hsl(var(--ivory))]">
                  <div className="flex items-center gap-3">
                    <div className="avatar-ring">
                      <div className="h-10 w-10 rounded-full bg-[hsl(var(--ivory))]" />
                    </div>
                    <div className="h-3 w-24 rounded-full bg-white/40" />
                    <span className="ml-auto sticker !bg-white/20 !border-white/30 !text-white !backdrop-blur-sm">Preview</span>
                  </div>
                  <div>
                    <div className="text-display text-[clamp(1.75rem,4.5vw,3rem)] leading-[0.95]">
                      Ditt content,<br />ditt språk.
                    </div>
                    <div className="mt-3 flex items-center gap-2">
                      <span className="h-2 w-16 rounded-full bg-white/50" />
                      <span className="h-2 w-10 rounded-full bg-white/30" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Feature card — payouts */}
              <div className="col-span-7 md:col-span-5 surface aspect-[5/4] md:aspect-auto p-7 md:p-8 flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <span className="eyebrow">Payouts</span>
                  <span className="sticker">Auto</span>
                </div>
                <div>
                  <div className="text-display text-sunset text-[clamp(2rem,5vw,3rem)] leading-[1]">Snabba<br />utbetalningar.</div>
                  <div className="mt-3 text-sm text-muted-foreground">Triggas automatiskt när dina mål nås.</div>
                </div>
                <div className="flex items-center gap-2 -space-x-3">
                  {['linear-gradient(135deg,#FFD27A,#FF8A4C)','linear-gradient(135deg,#FF8A4C,#E8423E)','linear-gradient(135deg,#E8423E,#7C2D2D)','linear-gradient(135deg,#FFB677,#FF6B6B)','linear-gradient(135deg,#F1C27D,#E07856)'].map((g, i) => (
                    <div key={i} className="h-9 w-9 rounded-full ring-2 ring-[hsl(var(--card))]" style={{ background: g }} aria-hidden />
                  ))}
                </div>
              </div>

              {/* Brief skeleton card — abstract, no real brand */}
              <div className="col-span-12 md:col-span-5 surface p-7 flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="h-9 w-9 rounded-2xl bg-foreground" aria-hidden />
                    <div className="h-3 w-28 rounded-full bg-[hsl(var(--muted))]" aria-hidden />
                  </div>
                  <span className="sticker">Brief</span>
                </div>
                <div className="text-display text-[1.5rem]">Så ser en brief ut.</div>
                <div className="flex flex-wrap gap-1.5">
                  <span className="chip">Nisch</span>
                  <span className="chip">Audience</span>
                  <span className="chip">Marknad</span>
                </div>
                <div className="hairline" />
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Tydliga villkor</span>
                  <span className="font-semibold">Per creator</span>
                </div>
              </div>

              {/* Auto-tracking card */}
              <div className="col-span-12 md:col-span-7 surface-deep relative overflow-hidden p-7 md:p-9 flex items-center gap-7">
                <div aria-hidden className="blob h-60 w-60 -top-10 -right-10 bg-[hsl(22_92%_60%_/_0.5)]" />
                <div className="relative">
                  <div className="eyebrow !text-[hsl(var(--ivory)/0.6)]">Tracking</div>
                  <div className="mt-3 text-display text-[clamp(1.6rem,3.2vw,2.4rem)] text-[hsl(var(--ivory))]">
                    Views räknas<br />
                    <span className="text-sunset">automatiskt</span>.
                  </div>
                  <div className="mt-4 text-sm text-[hsl(var(--ivory)/0.75)] max-w-[34ch]">
                    Anslut ditt TikTok-konto via TikToks officiella API. Ingen screenshot-jakt, inga spreadsheets.
                  </div>
                </div>
                <div className="hidden sm:block ml-auto relative shrink-0 w-32 h-56 rounded-[28px] bg-[hsl(var(--graphite))] ring-4 ring-[hsl(var(--ivory)/0.1)] shadow-floaty overflow-hidden">
                  <div className="absolute inset-2 rounded-[22px] bg-sunset opacity-90" />
                  <div className="absolute bottom-3 left-3 right-3 text-[hsl(var(--ivory))] space-y-1">
                    <div className="h-2 w-12 rounded-full bg-white/60" />
                    <div className="h-2 w-16 rounded-full bg-white/40" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* TWO-UP ───────────────────────────────────────── */}
      <section id="brands" className="py-20 md:py-28">
        <div className="mx-auto max-w-[1280px] px-5 md:px-10">
          <div className="max-w-2xl mb-12 md:mb-16">
            <p className="eyebrow">Two sides, one platform</p>
            <h2 className="mt-4 text-display text-[clamp(2.25rem,5.5vw,4rem)]">
              Byggd för båda<br />sidor av <span className="text-sunset">kameran</span>.
            </h2>
          </div>

          <div className="grid grid-cols-12 gap-5">
            <article className="col-span-12 md:col-span-7 surface p-8 md:p-12 relative overflow-hidden">
              <div aria-hidden className="blob h-72 w-72 -top-20 -right-20 bg-[hsl(22_92%_70%_/_0.45)]" />
              <span className="sticker mb-5 relative">For brands</span>
              <h3 className="relative text-display text-[clamp(1.85rem,4vw,2.85rem)]">
                Hitta creators som matchar <span className="text-sunset">din ton</span>.
              </h3>
              <p className="mt-5 text-muted-foreground col-prose relative">
                Skriv en brief, sätt målbild och budget, godkänn ansökningar.
                Tracka leverans i realtid och betala när villkoren uppfylls.
              </p>
              <ul className="mt-7 space-y-3 text-sm relative">
                {['Lansera en kampanj på minuter','Filtrera på nisch, marknad och audience','Transparent tracking och payouts'].map((t) => (
                  <li key={t} className="flex items-baseline gap-3">
                    <span className="mt-1 inline-block h-1.5 w-1.5 rounded-full bg-primary" />
                    <span>{t}</span>
                  </li>
                ))}
              </ul>
              <button onClick={handleForBrands} className="pill mt-9 h-12 px-7 bg-foreground text-background hover:opacity-90 shadow-soft relative">
                Starta kampanj →
              </button>
            </article>

            <article id="creators" className="col-span-12 md:col-span-5 surface-deep p-8 md:p-12 flex flex-col justify-between relative overflow-hidden">
              <div aria-hidden className="blob h-72 w-72 -bottom-20 -left-20 bg-[hsl(8_78%_60%_/_0.55)]" />
              <div className="relative">
                <span className="sticker !bg-white/10 !border-white/20 !text-[hsl(var(--ivory))] mb-5">For creators</span>
                <h3 className="text-display text-[clamp(1.7rem,3.5vw,2.5rem)] text-[hsl(var(--ivory))]">
                  Få betalt för content<br />du <span className="text-sunset">redan</span> gör.
                </h3>
                <p className="mt-5 text-[hsl(var(--ivory)/0.78)] col-prose">
                  Bläddra briefs som passar din röst, ansök på en tap, posta på TikTok,
                  och få utbetalning när dina views är verifierade.
                </p>
              </div>
              <ul className="mt-8 space-y-3 text-sm text-[hsl(var(--ivory)/0.85)] relative">
                {['Briefs anpassade efter din profil','Tydlig ersättning från start','Direkta payouts utan mellanhand'].map((t) => (
                  <li key={t} className="flex items-baseline gap-3">
                    <span className="mt-1 inline-block h-1.5 w-1.5 rounded-full bg-[hsl(22_92%_70%)]" />
                    <span>{t}</span>
                  </li>
                ))}
              </ul>
              <button onClick={handleJoinCreator} className="pill mt-9 h-12 px-7 self-start bg-[hsl(var(--ivory))] text-foreground hover:bg-white shadow-soft relative">
                Bli creator →
              </button>
            </article>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS ─────────────────────────────────── */}
      <section id="how" className="py-20 md:py-28 border-t border-[hsl(var(--border))]">
        <div className="mx-auto max-w-[1280px] px-5 md:px-10">
          <div className="max-w-2xl mb-12 md:mb-16">
            <p className="eyebrow">How it works</p>
            <h2 className="mt-4 text-display text-[clamp(2.25rem,5.5vw,4rem)]">
              Tre steg.<br />
              <span className="text-sunset">Noll</span> ceremoni.
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {[
              { step: '01', title: 'Discover', desc: 'Bläddra briefs som matchar din nisch, ditt språk och din publik.', tint: 'from-[hsl(40_92%_75%)] to-[hsl(22_92%_65%)]' },
              { step: '02', title: 'Create',   desc: 'Posta på din plattform i din takt. Views trackas via TikToks officiella API.', tint: 'from-[hsl(22_92%_65%)] to-[hsl(8_78%_55%)]' },
              { step: '03', title: 'Get paid', desc: 'Payouts triggas automatiskt när målen är uppfyllda och verifierade.', tint: 'from-[hsl(8_78%_55%)] to-[hsl(353_55%_38%)]' },
            ].map((s) => (
              <div key={s.step} className="surface p-7 md:p-8 relative overflow-hidden">
                <div className={`absolute -top-16 -right-10 h-44 w-44 rounded-full blur-2xl opacity-50 bg-gradient-to-br ${s.tint}`} aria-hidden />
                <div className="relative">
                  <div className="text-display text-[3rem] text-sunset leading-none">{s.step}</div>
                  <h3 className="mt-4 text-2xl font-bold tracking-tight">{s.title}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FEATURES (replaces fake stats + testimonials) ── */}
      <section className="py-20 md:py-28 bg-[hsl(var(--paper))] border-y border-[hsl(var(--border))]">
        <div className="mx-auto max-w-[1280px] px-5 md:px-10">
          <div className="max-w-2xl mb-12 md:mb-16">
            <p className="eyebrow">Vad du får</p>
            <h2 className="mt-4 text-display text-[clamp(2.25rem,5.5vw,4rem)]">
              Inga mellanhänder.<br />
              <span className="text-sunset">Bara verktygen.</span>
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {[
              {
                title: 'Verifierad tracking',
                desc: 'Views och engagement hämtas direkt från TikToks officiella API — ingen manuell rapportering.',
              },
              {
                title: 'Tydliga villkor',
                desc: 'Varje brief specificerar mål, ersättning och leveranskrav innan du ansöker.',
              },
              {
                title: 'Direkta payouts',
                desc: 'Utbetalning sker automatiskt när villkoren uppfylls, utan agency-cut.',
              },
              {
                title: 'Curated briefs',
                desc: 'Filtrera på nisch, marknad och audience så att du bara ser relevanta uppdrag.',
              },
              {
                title: 'Realtidsdashboard',
                desc: 'Följ dina aktiva uppdrag, intjäning och leveranser samlat på ett ställe.',
              },
              {
                title: 'Två sidor, en plattform',
                desc: 'Brands och creators delar samma vy — färre missförstånd, snabbare beslut.',
              },
            ].map((f) => (
              <div key={f.title} className="surface p-7 flex flex-col gap-3">
                <div className="h-10 w-10 rounded-2xl bg-sunset" aria-hidden />
                <h3 className="text-xl font-bold tracking-tight">{f.title}</h3>
                <p className="text-sm text-muted-foreground">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA ───────────────────────────────────────────── */}
      <section className="py-20 md:py-28">
        <div className="mx-auto max-w-[1280px] px-5 md:px-10">
          <div className="surface-deep relative overflow-hidden p-10 md:p-20 text-center">
            <div aria-hidden className="blob h-[420px] w-[420px] -top-32 left-1/2 -translate-x-1/2 bg-[hsl(8_78%_55%_/_0.55)]" />
            <div className="relative">
              <span className="sticker !bg-white/10 !border-white/20 !text-[hsl(var(--ivory))] mb-7">Kom igång</span>
              <h2 className="text-display text-[clamp(2.5rem,7vw,5.5rem)] text-[hsl(var(--ivory))]">
                Redo att <span className="text-sunset">börja</span>?
              </h2>
              <p className="mt-6 text-[hsl(var(--ivory)/0.75)] mx-auto col-prose">
                Skapa konto gratis och utforska plattformen — som creator eller brand.
              </p>
              <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
                <button onClick={handleJoinCreator} className="pill h-14 px-9 bg-[hsl(var(--ivory))] text-foreground hover:bg-white shadow-lift">
                  Bli creator →
                </button>
                <button onClick={handleForBrands} className="pill h-14 px-9 bg-white/10 text-[hsl(var(--ivory))] border border-white/20 hover:bg-white/20">
                  Jag är ett brand
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FOOTER ───────────────────────────────────────── */}
      <footer className="border-t border-[hsl(var(--border))] py-10">
        <div className="mx-auto max-w-[1280px] px-5 md:px-10 grid grid-cols-1 md:grid-cols-12 gap-6 items-baseline">
          <div className="md:col-span-4">
            <a href="/" className="text-display text-[1.4rem]">meta<span className="text-sunset">pick</span></a>
            <p className="mt-2 text-xs text-muted-foreground max-w-[28ch]">
              Creator marketplace för brands och creators.
            </p>
          </div>
          <div className="md:col-span-8 flex flex-wrap items-baseline gap-x-7 gap-y-2 md:justify-end">
            <a href="#creators" className="text-sm text-muted-foreground hover:text-foreground">For Creators</a>
            <a href="#brands"   className="text-sm text-muted-foreground hover:text-foreground">For Brands</a>
            <a href="/terms"    className="text-sm text-muted-foreground hover:text-foreground">Terms</a>
            <a href="/privacy"  className="text-sm text-muted-foreground hover:text-foreground">Privacy</a>
          </div>
          <div className="md:col-span-12 hairline" />
          <p className="md:col-span-12 text-center text-[0.72rem] tracking-wider uppercase text-muted-foreground">
            © 2026 MetaPick
          </p>
        </div>
      </footer>
    </div>
  );
}
