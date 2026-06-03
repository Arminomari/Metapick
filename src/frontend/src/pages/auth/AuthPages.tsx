import React, { useState, type ReactNode } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useLogin, useRegister } from '@/hooks/api';
import { useAuthStore } from '@/stores/authStore';
import { DateInput } from '@/components/ui/DateInput';
import { ALL_TAGS } from '@/lib/tags';

/* ── shared marks ── */
const STAR_PATH = 'M12 1.5c.7 5.6 2.9 7.8 8.5 8.5 .9.1 .9 1.4 0 1.5-5.6.7-7.8 2.9-8.5 8.5-.1.9-1.4.9-1.5 0-.7-5.6-2.9-7.8-8.5-8.5-.9-.1-.9-1.4 0-1.5 5.6-.7 7.8-2.9 8.5-8.5.1-.9 1.4-.9 1.5 0z';
const Star = ({ fill }: { fill: string }) => (
  <svg className="brand-star" width="26" height="26" viewBox="0 0 24 24" fill={fill} aria-hidden="true"><path d={STAR_PATH} /></svg>
);
const Arrow = () => (
  <span className="auth-arrow"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg></span>
);
const Check = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12 4 4L19 7" /></svg>
);

function AuthShell({ children, wide }: { children: ReactNode; wide?: boolean }) {
  return (
    <div className="vy-app">
      <div className="auth-split">
        <aside className="auth-brand">
          <div className="hero-grain" />
          <div className="hero-glow" />
          <svg className="auth-star" viewBox="0 0 220 220" fill="none" aria-hidden="true">
            <defs>
              <radialGradient id="authGlow" cx="50%" cy="50%" r="50%"><stop offset="0%" stopColor="#FFF4EC" /><stop offset="30%" stopColor="#FFD8C7" stopOpacity=".9" /><stop offset="100%" stopColor="#F1A88F" stopOpacity="0" /></radialGradient>
              <linearGradient id="authCore" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#FFFFFF" /><stop offset="60%" stopColor="#FBEEF6" /><stop offset="100%" stopColor="#EDE1FF" /></linearGradient>
            </defs>
            <circle cx="110" cy="110" r="104" fill="url(#authGlow)" />
            <path d="M110 20 C118 78 142 102 200 110 C142 118 118 142 110 200 C102 142 78 118 20 110 C78 102 102 78 110 20Z" fill="url(#authCore)" />
            <path d="M110 58 C115 95 125 105 162 110 C125 115 115 125 110 162 C105 125 95 115 58 110 C95 105 105 95 110 58Z" fill="#fff" opacity=".96" />
          </svg>

          <div className="auth-brand-top"><Star fill="#FFF4EC" /> VYRLE</div>

          <div className="auth-brand-mid">
            <div className="hero-eyebrow"><span className="hero-live" /> KREATÖRER × VARUMÄRKEN</div>
            <h1>Där kreatörer och varumärken faktiskt <em>möts</em>.</h1>
            <p className="auth-brand-sub">VYRLE matchar rätt kreatörer med rätt kampanjer, och betalar ut i samma stund som jobbet presterar.</p>
            <div className="auth-props">
              <div className="auth-prop"><Check /> Briefs matchade mot din publik, inte ditt följarantal</div>
              <div className="auth-prop"><Check /> Transparent ersättning innan du postar</div>
              <div className="auth-prop"><Check /> Direkta utbetalningar, inga mellanhänder</div>
            </div>
          </div>

          <div className="auth-brand-foot">Byggt för kreatörer och varumärken i Norden.</div>
        </aside>

        <main className="auth-main">
          <div className={`card${wide ? ' auth-card-lg' : ''}`}>
            <div className="auth-lockup"><Star fill="#0B0F17" /> VYRLE</div>
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

/* ───────────────────────── Login ───────────────────────── */
export function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const login = useLogin();
  const authStore = useAuthStore();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      const data = await login.mutateAsync({ email, password });
      authStore.login(data);
      navigate(data.role === 'Admin' ? '/admin' : data.role === 'Brand' ? '/brand' : '/creator');
    } catch (err: any) {
      const msg = err?.response?.data?.error?.message || 'Fel e-post eller lösenord';
      setError(msg);
    }
  };

  return (
    <AuthShell>
      <h1 className="auth-title">Logga <em>in</em></h1>
      <p className="auth-sub">Fortsätt där du slutade.</p>
      <form className="auth-form" onSubmit={handleSubmit}>
        <div className="field"><label>E-post</label><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" placeholder="du@exempel.se" /></div>
        <div className="field"><label>Lösenord</label>
          <div className="auth-pw-wrap">
            <input type={showPw ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" placeholder="••••••••" />
            <EyeButton on={showPw} onClick={() => setShowPw((v) => !v)} />
          </div>
        </div>
        {error && <p className="auth-err">{error}</p>}
        <button type="submit" className="btn-apply" disabled={login.isPending} style={{ opacity: login.isPending ? 0.7 : 1 }}>
          {login.isPending ? 'Loggar in…' : <>Logga in <Arrow /></>}
        </button>
      </form>
      <p className="auth-foot">Inget konto? <a href="/register" className="auth-link">Skapa konto</a></p>
    </AuthShell>
  );
}

/* ───────────────────────── Register ───────────────────────── */
export function RegisterPage() {
  const [searchParams] = useSearchParams();
  const defaultRole = searchParams.get('role') === 'Brand' ? 'Brand' : 'Creator';

  const [form, setForm] = useState({
    email: '', password: '', role: defaultRole,
    displayName: '', companyName: '', organizationNumber: '', contactPhone: '',
    tikTokUsername: '', instagramUsername: '', bio: '', category: 'Övrigt', dateOfBirth: '', country: 'SE',
    profileTags: [] as string[],
  });
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const register = useRegister();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (form.role === 'Creator') {
      if (!form.displayName.trim()) { setError('Visningsnamn krävs'); return; }
      if (!form.bio.trim()) { setError('Bio krävs'); return; }
      if (!form.category.trim()) { setError('Kategori krävs'); return; }
      if (!form.country.trim()) { setError('Land krävs'); return; }
      if (!form.tikTokUsername.trim()) { setError('TikTok-användarnamn krävs vid registrering'); return; }
      if (!form.profileTags || form.profileTags.length === 0) { setError('Minst en expertis-tagg krävs'); return; }
    }
    if (form.role === 'Brand') {
      if (!form.companyName.trim()) { setError('Företagsnamn krävs'); return; }
      if (!form.organizationNumber.trim()) { setError('Organisationsnummer krävs'); return; }
    }

    try {
      const payload = {
        ...form,
        dateOfBirth: form.dateOfBirth || null,
        profileTags: form.profileTags.length > 0 ? form.profileTags : null,
      };
      await register.mutateAsync(payload);
      setSubmitted(true);
    } catch (err: any) {
      console.error('Register error:', err?.response?.status, err?.response?.data ?? err?.message);
      const status = err?.response?.status;
      const resp = err?.response?.data;

      if (!err?.response) { setError('Kunde inte nå servern. Kontrollera att backend-API:et körs.'); return; }
      if (status === 429) { setError('För många försök. Vänta en minut och försök igen.'); return; }
      if (resp?.errors && typeof resp.errors === 'object') {
        const msgs = (Object.values(resp.errors) as string[][]).flat().filter(Boolean);
        if (msgs.length) { setError(msgs.join('. ')); return; }
      }
      if (resp?.error?.message) { setError(resp.error.message); return; }
      if (resp?.title) { setError(resp.title); return; }
      setError(`Registrering misslyckades (${status ?? 'nätverksfel'}). Öppna konsolen för detaljer.`);
    }
  };

  const set = (key: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm({ ...form, [key]: e.target.value });

  const toggleTag = (tag: string) => {
    const updated = form.profileTags.includes(tag) ? form.profileTags.filter((t) => t !== tag) : [...form.profileTags, tag];
    setForm({ ...form, profileTags: updated });
  };

  if (submitted) return <PendingApprovalPage />;

  const pw = form.password;
  const rules: [boolean, string][] = [
    [/[A-Z]/.test(pw), 'Versal (A–Z)'], [/[a-z]/.test(pw), 'Gemen (a–z)'], [/[0-9]/.test(pw), 'Siffra (0–9)'], [pw.length >= 8, 'Minst 8 tecken'],
  ];

  return (
    <AuthShell wide>
      <h1 className="auth-title">Skapa <em>konto</em></h1>
      <p className="auth-sub">Gå med på under en minut. Vi granskar och godkänner din profil innan du går live.</p>
      <form className="auth-form" onSubmit={handleSubmit}>
        <div className="auth-role" role="tablist">
          <button type="button" className={form.role === 'Creator' ? 'on' : ''} onClick={() => setForm({ ...form, role: 'Creator' })}>Jag är kreatör</button>
          <button type="button" className={form.role === 'Brand' ? 'on' : ''} onClick={() => setForm({ ...form, role: 'Brand' })}>Jag är varumärke</button>
        </div>

        <div className="field"><label>E-post *</label><input type="email" value={form.email} onChange={set('email')} required autoComplete="email" placeholder="du@exempel.se" /></div>

        <div className="field"><label>Lösenord *</label>
          <div className="auth-pw-wrap">
            <input type={showPw ? 'text' : 'password'} value={form.password} onChange={set('password')} required minLength={8} autoComplete="new-password" placeholder="Minst 8 tecken" />
            <EyeButton on={showPw} onClick={() => setShowPw((v) => !v)} />
          </div>
          <div className="auth-rules">
            {rules.map(([ok, label]) => (
              <span key={label} className={`auth-rule${ok ? ' ok' : ''}`}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">{ok ? <path d="m5 12 4 4L19 7" /> : <circle cx="12" cy="12" r="9" />}</svg>{label}
              </span>
            ))}
          </div>
        </div>

        {form.role === 'Creator' && (
          <>
            <div className="field"><label>Visningsnamn *</label><input type="text" value={form.displayName} onChange={set('displayName')} required placeholder="Ditt namn eller alias" /></div>
            <div className="field"><label>Bio *</label><textarea value={form.bio} onChange={set('bio')} required rows={3} placeholder="Berätta om dig och ditt innehåll — varför ska varumärken samarbeta med dig?" /></div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 16 }}>
              <div className="field"><label>Kategori *</label>
                <select value={form.category} onChange={set('category')} required>
                  {['Övrigt', 'Mode', 'Skönhet', 'Mat', 'Teknik', 'Gaming', 'Sport', 'Musik', 'Resor', 'Livsstil', 'Humor'].map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="field"><label>Land *</label>
                <select value={form.country} onChange={set('country')} required>
                  <option value="SE">Sverige</option><option value="NO">Norge</option><option value="DK">Danmark</option><option value="FI">Finland</option>
                </select>
              </div>
            </div>
            <div className="field"><label>Expertis-taggar * — vad är du bra på?</label>
              <div className="auth-tagbox">
                <div className="auth-tags">
                  {ALL_TAGS.map((tag) => (
                    <button key={tag} type="button" className={`auth-tag${form.profileTags.includes(tag) ? ' on' : ''}`} onClick={() => toggleTag(tag)}>
                      {form.profileTags.includes(tag) ? '✓ ' : ''}{tag}
                    </button>
                  ))}
                </div>
                <div className="auth-hint" style={{ marginTop: 10 }}>{form.profileTags.length === 0 ? 'Välj minst en tagg' : `Valt: ${form.profileTags.length} tagg(ar)`}</div>
              </div>
            </div>
            <div className="field"><label>Födelsedatum</label><DateInput value={form.dateOfBirth} onChange={(v) => setForm({ ...form, dateOfBirth: v })} className="" /></div>
            <div className="field"><label>TikTok-användarnamn *</label>
              <div className="auth-at"><span>@</span><input type="text" value={form.tikTokUsername} onChange={set('tikTokUsername')} required placeholder="dittanvändarnamn" /></div>
              <div className="auth-hint">Obligatoriskt. Efter godkännande kopplar du kontot via TikTok för automatisk tracking.</div>
            </div>
            <div className="field"><label>Instagram-användarnamn</label>
              <div className="auth-at"><span>@</span><input type="text" value={form.instagramUsername} onChange={set('instagramUsername')} placeholder="dittinstagram" /></div>
              <div className="auth-hint">Valfritt — lägg till om du även är aktiv på Instagram.</div>
            </div>
          </>
        )}

        {form.role === 'Brand' && (
          <>
            <div className="field"><label>Företagsnamn *</label><input type="text" value={form.companyName} onChange={set('companyName')} required /></div>
            <div className="field"><label>Organisationsnummer *</label><input type="text" value={form.organizationNumber} onChange={set('organizationNumber')} required placeholder="XXXXXX-XXXX" /></div>
            <div className="field"><label>Kontakttelefon</label><input type="text" value={form.contactPhone} onChange={set('contactPhone')} placeholder="+46…" /></div>
          </>
        )}

        {error && <p className="auth-err">{error}</p>}

        <button type="submit" className="btn-apply" disabled={register.isPending} style={{ opacity: register.isPending ? 0.7 : 1 }}>
          {register.isPending ? 'Skickar…' : <>Skicka ansökan <Arrow /></>}
        </button>
        <p className="auth-consent">Genom att fortsätta samtycker du till våra villkor. Ditt konto granskas av en administratör innan du kan logga in.</p>
      </form>
      <p className="auth-foot">Har redan konto? <a href="/login" className="auth-link">Logga in</a></p>
    </AuthShell>
  );
}

/* ───────────────────────── Pending ───────────────────────── */
export function PendingApprovalPage() {
  const navigate = useNavigate();
  return (
    <AuthShell>
      <div style={{ textAlign: 'center' }}>
        <div className="auth-pending-ic"><svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg></div>
        <h1 className="auth-title">Ansökan <em>mottagen</em></h1>
        <p className="auth-sub" style={{ maxWidth: 360, margin: '8px auto 0' }}>Tack för att du går med i VYRLE. Vi granskar din profil nu och hör av oss så snart du är godkänd, oftast inom 1 till 2 arbetsdagar.</p>
        <div style={{ background: 'rgba(237,225,255,.35)', border: '1px solid rgba(157,139,196,.2)', borderRadius: 14, padding: 14, margin: '20px 0', fontSize: 12.5, color: 'var(--muted)' }}>
          Du får ett meddelande när ditt konto har godkänts.
        </div>
        <button onClick={() => navigate('/')} className="btn-outline" style={{ width: '100%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>Tillbaka till startsidan</button>
      </div>
    </AuthShell>
  );
}

function EyeButton({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <button type="button" className="auth-eye" onClick={onClick} aria-label={on ? 'Dölj lösenord' : 'Visa lösenord'}>
      {on ? (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" /><circle cx="12" cy="12" r="3" /></svg>
      ) : (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-10-7-10-7a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 10 7 10 7a18.5 18.5 0 0 1-2.16 3.19M1 1l22 22" /></svg>
      )}
    </button>
  );
}
