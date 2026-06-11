import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

const STAR_PATH = 'M12 1.5c.7 5.6 2.9 7.8 8.5 8.5 .9.1 .9 1.4 0 1.5-5.6.7-7.8 2.9-8.5 8.5-.1.9-1.4.9-1.5 0-.7-5.6-2.9-7.8-8.5-8.5-.9-.1-.9-1.4 0-1.5 5.6-.7 7.8-2.9 8.5-8.5.1-.9 1.4-.9 1.5 0z';

function LegalShell({ title, accent, updated, children }: { title: string; accent: string; updated: string; children: ReactNode }) {
  return (
    <div className="vy-app">
      <div className="auth-split" style={{ display: 'block', minHeight: '100vh' }}>
        <div style={{ maxWidth: 760, margin: '0 auto', padding: '40px 22px 70px' }}>
          <Link to="/" style={{ display: 'inline-flex', alignItems: 'center', gap: 9, fontWeight: 600, fontSize: 19, letterSpacing: '-.04em', color: 'var(--ink)', textDecoration: 'none', marginBottom: 30 }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="#0B0F17" aria-hidden="true"><path d={STAR_PATH} /></svg>
            VYRLE
          </Link>
          <div className="card" style={{ padding: '40px 38px' }}>
            <h1 className="auth-title" style={{ fontSize: 32 }}>{title} <em>{accent}</em></h1>
            <p className="auth-sub" style={{ marginBottom: 8 }}>Senast uppdaterad: {updated}</p>
            {children}
            <div style={{ marginTop: 34, paddingTop: 20, borderTop: '1px solid rgba(241,168,143,.2)', fontSize: 13, color: 'var(--muted)' }}>
              Frågor? Kontakta oss på <a className="auth-link" href="mailto:support@vyrle.co">support@vyrle.co</a> ·{' '}
              <Link className="auth-link" to="/terms">Villkor</Link> · <Link className="auth-link" to="/privacy">Integritetspolicy</Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Sec({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <section style={{ marginTop: 26 }}>
      <h2 style={{ fontSize: 17, fontWeight: 700, letterSpacing: '-.01em', color: 'var(--ink)', display: 'flex', alignItems: 'center', gap: 10 }}>
        <span aria-hidden="true" style={{ width: 26, height: 26, borderRadius: '50%', flex: '0 0 26px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, background: 'linear-gradient(135deg,#FFD8C7,#F1A88F)', color: '#3a1d12' }}>{n}</span>
        {title}
      </h2>
      <div style={{ marginTop: 9, fontSize: 13.5, lineHeight: 1.7, color: 'var(--ink-2)' }}>{children}</div>
    </section>
  );
}

export function TermsPage() {
  return (
    <LegalShell title="Användar" accent="villkor" updated="12 juni 2026">
      <Sec n={1} title="Om Vyrle">
        Vyrle är en marknadsplats som kopplar samman varumärken med TikTok-kreatörer för
        kampanjbaserade samarbeten. Tjänsten tillhandahålls av Vyrle (&quot;vi&quot;, &quot;oss&quot;) via www.vyrle.co.
        Genom att skapa ett konto godkänner du dessa villkor.
      </Sec>
      <Sec n={2} title="Konton och godkännande">
        Du måste vara minst 18 år för att använda Vyrle. Alla konton — både kreatörer och
        varumärken — granskas och godkänns manuellt innan de aktiveras. Du ansvarar för att
        uppgifterna i din profil är korrekta och att dina inloggningsuppgifter hålls säkra.
        Vi förbehåller oss rätten att stänga av konton som bryter mot dessa villkor, anger
        vilseledande information eller försöker manipulera visningsstatistik.
      </Sec>
      <Sec n={3} title="Kampanjer och innehåll">
        Varumärken ansvarar för innehållet i sina kampanjbriefs. Kreatörer ansvarar för att
        publicerat innehåll följer kampanjens krav, TikToks riktlinjer och tillämplig
        marknadsföringslagstiftning, inklusive korrekt reklammärkning. Innehåll som publiceras
        inom ett samarbete får inte vara vilseledande, kränkande eller olagligt.
      </Sec>
      <Sec n={4} title="Ersättning och utbetalningar">
        Ersättningen för en kampanj framgår av kampanjens villkor innan du ansöker, till exempel
        ett belopp per 1 000 verifierade visningar eller ett fast belopp vid uppnådd visningströskel.
        Alla utbetalningar baseras på verifierade visningar och kan granskas innan de godkänns.
        Uppskattningar som visas i appen är vägledande; det slutgiltiga beloppet beräknas av
        plattformen enligt kampanjens regler. Kreatörer ansvarar själva för skatter och avgifter
        på mottagen ersättning.
      </Sec>
      <Sec n={5} title="Otillåten användning">
        Det är inte tillåtet att köpa visningar, använda botar eller på annat sätt artificiellt
        blåsa upp statistik; att kringgå plattformen för att undvika avgifter efter att kontakt
        etablerats via Vyrle; eller att använda tjänsten för olagliga ändamål. Överträdelser kan
        leda till innehållen ersättning och permanent avstängning.
      </Sec>
      <Sec n={6} title="Ansvarsbegränsning">
        Vyrle förmedlar kontakt mellan varumärken och kreatörer och är inte part i de samarbeten
        som ingås. Tjänsten tillhandahålls i befintligt skick. Vi ansvarar inte för indirekta
        skador, utebliven vinst eller innehåll som publiceras av användare, i den utsträckning
        det är tillåtet enligt lag.
      </Sec>
      <Sec n={7} title="Ändringar">
        Vi kan uppdatera dessa villkor. Väsentliga ändringar meddelas i appen eller via e-post.
        Fortsatt användning efter en ändring innebär att du godkänner de nya villkoren.
      </Sec>
    </LegalShell>
  );
}

export function PrivacyPage() {
  return (
    <LegalShell title="Integritets" accent="policy" updated="12 juni 2026">
      <Sec n={1} title="Vilka uppgifter vi samlar in">
        När du skapar ett konto samlar vi in e-postadress, namn och lösenord (lagrat krypterat som hash),
        samt profiluppgifterna du själv anger: visningsnamn eller företagsnamn, bio, kategori, land,
        profilbild/logotyp, webbplats och sociala användarnamn. Om du loggar in med Google, Apple eller
        Facebook tar vi emot din verifierade e-postadress, ditt namn och eventuell profilbild från
        leverantören — aldrig ditt lösenord.
      </Sec>
      <Sec n={2} title="TikTok-data">
        Kreatörer kan koppla sitt TikTok-konto via TikToks officiella inloggning (OAuth). Med ditt
        uttryckliga samtycke hämtar vi då offentliga profiluppgifter (användarnamn, visningsnamn,
        följarantal) och statistik för videor du publicerar inom kampanjer (visningar, gillningar)
        för att verifiera räckvidd och beräkna ersättning. Du kan när som helst koppla bort ditt
        TikTok-konto från din profil; då slutar vi hämta ny data.
      </Sec>
      <Sec n={3} title="Hur uppgifterna används">
        Uppgifterna används för att driva tjänsten: matcha kreatörer med kampanjer, visa profiler för
        varumärken, verifiera visningar, beräkna och betala ut ersättning, förhindra missbruk samt ge
        support. Vi säljer aldrig dina personuppgifter och använder dem inte för tredjepartsannonsering.
      </Sec>
      <Sec n={4} title="Utbetalningsuppgifter">
        Utbetalningsuppgifter (t.ex. kontonummer, Swish-nummer eller PayPal-adress) lagras krypterade
        med AES-256 och visas alltid maskerade i appen. De används enbart för att genomföra utbetalningar.
      </Sec>
      <Sec n={5} title="Lagring och delning">
        Uppgifterna lagras inom EU/EES hos vår driftleverantör. Varumärken ser endast den kreatörsinformation
        som behövs för samarbetet: offentlig profil, portfolio och kampanjstatistik — aldrig e-postadress
        eller utbetalningsuppgifter. Vi delar uppgifter med myndigheter endast när lagen kräver det.
      </Sec>
      <Sec n={6} title="Dina rättigheter (GDPR)">
        Du har rätt att få tillgång till, rätta och radera dina personuppgifter, samt invända mot eller
        begränsa behandlingen. Du kan själv uppdatera din profil i appen och begära kontoradering via
        support. Vid radering tas personuppgifter bort eller anonymiseras, med undantag för det vi måste
        spara enligt bokföringslag. Du kan klaga hos Integritetsskyddsmyndigheten (IMY) om du anser att
        vi behandlar dina uppgifter felaktigt.
      </Sec>
      <Sec n={7} title="Cookies och lokal lagring">
        Vi använder endast nödvändig lokal lagring i din webbläsare för att hålla dig inloggad.
        Vi använder inga spårningscookies från tredje part.
      </Sec>
      <Sec n={8} title="Kontakt">
        Personuppgiftsansvarig är Vyrle. Kontakta oss på{' '}
        <a className="auth-link" href="mailto:support@vyrle.co">support@vyrle.co</a> för frågor om
        dataskydd, registerutdrag eller radering.
      </Sec>
    </LegalShell>
  );
}
