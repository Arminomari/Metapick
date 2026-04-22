import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useLogin, useRegister } from '@/hooks/api';
import { useAuthStore } from '@/stores/authStore';
import { DateInput } from '@/components/ui/DateInput';
import { ALL_TAGS } from '@/lib/tags';

const metapickStyles = {
  page: { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0a0a0f', padding: '2rem 1rem' } as React.CSSProperties,
  card: { width: '100%', maxWidth: 480, background: '#14141f', border: '1px solid #1e1e2e', borderRadius: '1rem', padding: 'clamp(1.25rem, 5vw, 2.5rem)' } as React.CSSProperties,
  title: { fontSize: '1.5rem', fontWeight: 700, textAlign: 'center', marginBottom: '1.5rem', color: '#fafafa' } as React.CSSProperties,
  label: { display: 'block', fontSize: '.875rem', fontWeight: 500, marginBottom: '.25rem', color: '#8b8ba3' } as React.CSSProperties,
  input: { width: '100%', borderRadius: '.5rem', border: '1px solid #1e1e2e', background: '#0a0a0f', padding: '.625rem .75rem', fontSize: '.875rem', color: '#fafafa', outline: 'none' } as React.CSSProperties,
  select: { width: '100%', borderRadius: '.5rem', border: '1px solid #1e1e2e', background: '#0a0a0f', padding: '.625rem .75rem', fontSize: '.875rem', color: '#fafafa', outline: 'none' } as React.CSSProperties,
  btn: { width: '100%', padding: '.75rem', borderRadius: '.5rem', background: '#e84393', color: '#fff', border: 'none', fontWeight: 600, fontSize: '.875rem', cursor: 'pointer' } as React.CSSProperties,
  error: { fontSize: '.875rem', color: '#e84393', marginTop: '.5rem' } as React.CSSProperties,
  link: { color: '#e84393', textDecoration: 'none' } as React.CSSProperties,
  footer: { marginTop: '1.5rem', textAlign: 'center', fontSize: '.875rem', color: '#8b8ba3' } as React.CSSProperties,
  logo: { textAlign: 'center', marginBottom: '2rem', fontSize: '1.5rem', fontWeight: 700, color: '#fafafa' } as React.CSSProperties,
};

export function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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
    <div style={metapickStyles.page}>
      <div style={metapickStyles.card}>
        <div style={metapickStyles.logo}>Meta<span style={{ color: '#e84393' }}>Pick</span></div>
        <h1 style={metapickStyles.title}>Logga in</h1>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label style={metapickStyles.label}>E-post</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required style={metapickStyles.input} />
          </div>
          <div>
            <label style={metapickStyles.label}>Lösenord</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required style={metapickStyles.input} />
          </div>
          {error && <p style={metapickStyles.error}>{error}</p>}
          <button type="submit" disabled={login.isPending} style={{ ...metapickStyles.btn, opacity: login.isPending ? 0.6 : 1 }}>
            {login.isPending ? 'Loggar in...' : 'Logga in'}
          </button>
        </form>
        <p style={metapickStyles.footer}>
          Inget konto? <a href="/register" style={metapickStyles.link}>Registrera dig</a>
        </p>
      </div>
    </div>
  );
}

export function RegisterPage() {
  const [searchParams] = useSearchParams();
  const defaultRole = searchParams.get('role') === 'Brand' ? 'Brand' : 'Creator';

  const [form, setForm] = useState({
    email: '', password: '', role: defaultRole,
    displayName: '', companyName: '', organizationNumber: '', contactPhone: '',
    tikTokUsername: '', bio: '', category: 'Övrigt', dateOfBirth: '', country: 'SE',
    profileTags: [] as string[],
  });
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const register = useRegister();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validate required fields
    if (form.role === 'Creator') {
      if (!form.displayName.trim()) { setError('Visningsnamn krävs'); return; }
      if (!form.bio.trim()) { setError('Bio krävs'); return; }
      if (!form.category.trim()) { setError('Kategori krävs'); return; }
      if (!form.country.trim()) { setError('Land krävs'); return; }
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

      if (!err?.response) {
        // Network error – API unreachable
        setError('Kunde inte nå servern. Kontrollera att backend-API:et körs.');
        return;
      }
      if (status === 429) {
        setError('För många försök. Vänta en minut och försök igen.');
        return;
      }
      // FluentValidation / ASP.NET model state: { errors: { Field: ["msg"] } }
      if (resp?.errors && typeof resp.errors === 'object') {
        const msgs = (Object.values(resp.errors) as string[][]).flat().filter(Boolean);
        if (msgs.length) { setError(msgs.join('. ')); return; }
      }
      // Custom API error: { error: { message: "..." } }
      if (resp?.error?.message) {
        setError(resp.error.message);
        return;
      }
      // title field from ProblemDetails
      if (resp?.title) {
        setError(resp.title);
        return;
      }
      setError(`Registrering misslyckades (${status ?? 'nätverksfel'}). Öppna konsolen för detaljer.`);
    }
  };

  const set = (key: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm({ ...form, [key]: e.target.value });

  if (submitted) {
    return <PendingApprovalPage />;
  }

  return (
    <div style={metapickStyles.page}>
      <div style={{ ...metapickStyles.card, maxWidth: 520 }}>
        <div style={metapickStyles.logo}>Meta<span style={{ color: '#e84393' }}>Pick</span></div>
        <h1 style={metapickStyles.title}>Skapa konto</h1>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label style={metapickStyles.label}>Jag är en</label>
            <select value={form.role} onChange={set('role')} style={metapickStyles.select}>
              <option value="Creator">Creator / Influencer</option>
              <option value="Brand">Brand / Företag</option>
            </select>
          </div>
          <div>
            <label style={metapickStyles.label}>E-post *</label>
            <input type="email" value={form.email} onChange={set('email')} required style={metapickStyles.input} />
          </div>
          <div>
            <label style={metapickStyles.label}>Lösenord * <span style={{ fontSize: '.75rem', color: '#555' }}>(minst 8 tecken)</span></label>
            <input type="password" value={form.password} onChange={set('password')} required minLength={8} style={metapickStyles.input} />
            <ul style={{ fontSize: '.72rem', color: '#666', marginTop: '.375rem', paddingLeft: '1rem', lineHeight: 1.8 }}>
              <li style={{ color: /[A-Z]/.test(form.password) ? '#4caf50' : '#666' }}>Minst en versal (A–Z)</li>
              <li style={{ color: /[a-z]/.test(form.password) ? '#4caf50' : '#666' }}>Minst en gemen (a–z)</li>
              <li style={{ color: /[0-9]/.test(form.password) ? '#4caf50' : '#666' }}>Minst en siffra (0–9)</li>
              <li style={{ color: form.password.length >= 8 ? '#4caf50' : '#666' }}>Minst 8 tecken</li>
            </ul>
          </div>

          {form.role === 'Creator' && (
            <>
              <div>
                <label style={metapickStyles.label}>Visningsnamn *</label>
                <input type="text" value={form.displayName} onChange={set('displayName')} required placeholder="Ditt namn eller alias" style={metapickStyles.input} />
              </div>
              <div>
                <label style={metapickStyles.label}>Bio *</label>
                <textarea value={form.bio} onChange={set('bio')} required rows={3} placeholder="Berätta om dig och ditt innehåll — varför ska brands samarbeta med dig?" style={{ ...metapickStyles.input, resize: 'vertical' } as React.CSSProperties} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem' }}>
                <div>
                  <label style={metapickStyles.label}>Kategori *</label>
                  <select value={form.category} onChange={set('category')} required style={metapickStyles.select}>
                    {['Övrigt', 'Mode', 'Skönhet', 'Mat', 'Teknik', 'Gaming', 'Sport', 'Musik', 'Resor', 'Livsstil', 'Humor'].map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={metapickStyles.label}>Land *</label>
                  <select value={form.country} onChange={set('country')} required style={metapickStyles.select}>
                    <option value="SE">Sverige</option>
                    <option value="NO">Norge</option>
                    <option value="DK">Danmark</option>
                    <option value="FI">Finland</option>
                  </select>
                </div>
              </div>
              <div style={{ background: '#0a0a0f', border: '1px solid #1e1e2e', borderRadius: '.5rem', padding: '1rem' }}>
                <label style={{ ...metapickStyles.label, marginBottom: '.75rem' }}>Expertis-taggar * — vad är du bra på?</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '.5rem', maxHeight: '10rem', overflowY: 'auto' }}>
                  {ALL_TAGS.map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => {
                        const updated = form.profileTags.includes(tag)
                          ? form.profileTags.filter(t => t !== tag)
                          : [...form.profileTags, tag];
                        setForm({ ...form, profileTags: updated });
                      }}
                      style={{
                        padding: '0.5rem 1rem',
                        borderRadius: '999px',
                        border: form.profileTags.includes(tag) ? '2px solid #e84393' : '1px solid #1e1e2e',
                        background: form.profileTags.includes(tag) ? 'rgba(232,67,147,.2)' : 'transparent',
                        color: form.profileTags.includes(tag) ? '#e84393' : '#8b8ba3',
                        fontSize: '.85rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                      }}
                    >
                      {form.profileTags.includes(tag) ? '✓ ' : ''}{tag}
                    </button>
                  ))}
                </div>
                {form.profileTags.length === 0 && (
                  <p style={{ fontSize: '.75rem', color: '#555', marginTop: '.5rem' }}>Välj minst en tagg</p>
                )}
                {form.profileTags.length > 0 && (
                  <p style={{ fontSize: '.75rem', color: '#8b8ba3', marginTop: '.5rem' }}>Valt: {form.profileTags.length} tagg(ar)</p>
                )}
              </div>
              <div>
                <label style={metapickStyles.label}>Födelsedatum</label>
                <DateInput value={form.dateOfBirth} onChange={v => setForm({ ...form, dateOfBirth: v })} style={metapickStyles.input} />
              </div>
              <div>
                <label style={metapickStyles.label}>TikTok-användarnamn</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem' }}>
                  <span style={{ color: '#8b8ba3', fontSize: '1rem' }}>@</span>
                  <input type="text" value={form.tikTokUsername} onChange={set('tikTokUsername')} placeholder="dittanvändarnamn" style={{ ...metapickStyles.input, flex: 1 }} />
                </div>
                <p style={{ fontSize: '.7rem', color: '#555', marginTop: '.25rem' }}>
                  Valfritt — du kopplar ditt TikTok-konto via OAuth efter godkännande.
                </p>
              </div>
            </>
          )}

          {form.role === 'Brand' && (
            <>
              <div>
                <label style={metapickStyles.label}>Företagsnamn *</label>
                <input type="text" value={form.companyName} onChange={set('companyName')} required style={metapickStyles.input} />
              </div>
              <div>
                <label style={metapickStyles.label}>Organisationsnummer *</label>
                <input type="text" value={form.organizationNumber} onChange={set('organizationNumber')} required placeholder="XXXXXX-XXXX" style={metapickStyles.input} />
              </div>
              <div>
                <label style={metapickStyles.label}>Kontakttelefon</label>
                <input type="text" value={form.contactPhone} onChange={set('contactPhone')} placeholder="+46..." style={metapickStyles.input} />
              </div>
            </>
          )}

          {error && <p style={metapickStyles.error}>{error}</p>}

          <button type="submit" disabled={register.isPending} style={{ ...metapickStyles.btn, opacity: register.isPending ? 0.6 : 1 }}>
            {register.isPending ? 'Skapar...' : 'Skicka ansökan'}
          </button>

          <p style={{ fontSize: '.75rem', color: '#555', textAlign: 'center', margin: 0 }}>
            Genom att registrera dig samtycker du till våra villkor. Ditt konto måste godkännas av en administratör innan du kan logga in.
          </p>
        </form>
        <p style={metapickStyles.footer}>
          Har redan konto? <a href="/login" style={metapickStyles.link}>Logga in</a>
        </p>
      </div>
    </div>
  );
}

export function PendingApprovalPage() {
  const navigate = useNavigate();

  return (
    <div style={metapickStyles.page}>
      <div style={{ ...metapickStyles.card, textAlign: 'center', maxWidth: 500 }}>
        <div style={metapickStyles.logo}>Meta<span style={{ color: '#e84393' }}>Pick</span></div>

        {/* Checkmark icon */}
        <div style={{ margin: '0 auto 1.5rem', width: 80, height: 80, borderRadius: '50%', background: 'rgba(232,67,147,.15)', border: '2px solid rgba(232,67,147,.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#e84393" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>

        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#fafafa', marginBottom: '.75rem' }}>
          Din ansökan har skickats!
        </h1>
        <p style={{ color: '#8b8ba3', fontSize: '.9rem', lineHeight: 1.7, marginBottom: '2rem' }}>
          Tack för din registrering! Vi granskar nu din profil och ansökan. Du kommer att kunna logga in så snart en administratör har godkänt ditt konto. Detta brukar ta 1-2 arbetsdagar.
        </p>

        <div style={{ background: 'rgba(232,67,147,.08)', border: '1px solid rgba(232,67,147,.15)', borderRadius: '.75rem', padding: '1rem', marginBottom: '2rem' }}>
          <p style={{ fontSize: '.8rem', color: '#8b8ba3', margin: 0 }}>
            📧 Du får ett meddelande när ditt konto har godkänts.
          </p>
        </div>

        <button onClick={() => navigate('/')} style={{ ...metapickStyles.btn, background: 'transparent', border: '1px solid #1e1e2e', color: '#fafafa' }}>
          ← Tillbaka till startsidan
        </button>
      </div>
    </div>
  );
}
