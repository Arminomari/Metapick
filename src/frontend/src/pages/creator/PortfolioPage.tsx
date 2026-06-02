import { useState } from 'react';
import { Link } from 'react-router-dom';
import { TikTokEmbed } from '@/components/ui/TikTokEmbed';
import { ReviewList } from '@/components/ui/ReviewSection';
import { usePortfolio, useAddPortfolioItem, useUpdatePortfolioItem, useDeletePortfolioItem, useCreatorProfile, useCreatorAssignments, useUserReviews } from '@/hooks/api';
import { formatNumber, formatDate, formatCurrency } from '@/lib/utils';
import type { PortfolioItem, PortfolioMediaType } from '@/types';

const GRADS = ['linear-gradient(135deg,#FFD8C7,#F1A88F)', 'linear-gradient(135deg,#cdb8f2,#9c7de0)', 'linear-gradient(135deg,#F2C58A,#e0a04e)', 'linear-gradient(135deg,#a9dcc0,#5fb98a)'];
const grad = (s: string) => GRADS[((s || '').charCodeAt(0) || 0) % GRADS.length];
const initial = (s: string) => (s?.[0] || '?').toUpperCase();
const COUNTRY: Record<string, string> = { SE: 'Sverige', NO: 'Norge', DK: 'Danmark', FI: 'Finland' };

const MEDIA_TYPES: { value: PortfolioMediaType; label: string }[] = [
  { value: 'TikTok', label: 'TikTok-video' },
  { value: 'Instagram', label: 'Instagram-inlägg' },
  { value: 'Video', label: 'Video (länk)' },
  { value: 'Image', label: 'Bild' },
  { value: 'Link', label: 'Annan länk' },
];

const emptyForm = {
  title: '', description: '', mediaType: 'TikTok' as PortfolioMediaType, mediaUrl: '',
  thumbnailUrl: '', category: '', brandName: '', views: '', likes: '', isFeatured: false,
};

export function CreatorPortfolioPage() {
  const { data: items, isLoading } = usePortfolio();
  const { data: profile } = useCreatorProfile();
  const { data: asgRes } = useCreatorAssignments();
  const { data: reviews } = useUserReviews(profile?.userId ?? '');
  const add = useAddPortfolioItem();
  const update = useUpdatePortfolioItem();
  const remove = useDeletePortfolioItem();

  const assignments = asgRes?.data ?? [];
  const brands = [...new Map(assignments.map((a) => [a.campaignName, a])).values()];
  const pfViews = (items ?? []).reduce((s, it) => s + (it.views ?? 0), 0);
  const pfLikes = (items ?? []).reduce((s, it) => s + (it.likes ?? 0), 0);
  const realViews = assignments.reduce((s, a) => s + (a.totalVerifiedViews || 0), 0);
  const realEarned = assignments.reduce((s, a) => s + (a.currentPayoutAmount || 0), 0);
  const name = profile?.displayName || 'Creator';
  const handle = profile?.tikTokUsername ? '@' + profile.tikTokUsername : '';

  const [form, setForm] = useState({ ...emptyForm });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState('');

  const startEdit = (it: PortfolioItem) => {
    setEditingId(it.id);
    setForm({
      title: it.title, description: it.description ?? '', mediaType: it.mediaType,
      mediaUrl: it.mediaUrl, thumbnailUrl: it.thumbnailUrl ?? '', category: it.category ?? '',
      brandName: it.brandName ?? '', views: it.views?.toString() ?? '', likes: it.likes?.toString() ?? '',
      isFeatured: it.isFeatured,
    });
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const reset = () => { setForm({ ...emptyForm }); setEditingId(null); setShowForm(false); setError(''); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!form.title.trim()) { setError('Titel krävs'); return; }
    try { new URL(form.mediaUrl); } catch { setError('Media-URL måste vara en giltig länk (https://…)'); return; }

    const payload = {
      title: form.title.trim(),
      description: form.description.trim() || undefined,
      mediaType: form.mediaType,
      mediaUrl: form.mediaUrl.trim(),
      thumbnailUrl: form.thumbnailUrl.trim() || undefined,
      category: form.category.trim() || undefined,
      brandName: form.brandName.trim() || undefined,
      views: form.views ? Number(form.views) : undefined,
      likes: form.likes ? Number(form.likes) : undefined,
      isFeatured: form.isFeatured,
    };
    try {
      if (editingId) {
        const existing = items?.find((i) => i.id === editingId);
        await update.mutateAsync({ id: editingId, ...payload, sortOrder: existing?.sortOrder ?? 0 });
      } else {
        await add.mutateAsync(payload);
      }
      reset();
    } catch (err: any) {
      setError(err?.response?.data?.error?.message ?? 'Kunde inte spara');
    }
  };

  const handleDelete = (id: string) => {
    if (confirm('Ta bort detta portföljobjekt?')) remove.mutate(id);
  };

  return (
    <section className="view active reveal" data-view="portfolio">
      <div className="page-head">
        <div>
          <h1 className="page-title">Din <em>profil</em></h1>
          <p className="page-sub">Det här ser företag när du ansöker eller söks upp. Profil, samarbeten, bästa content och dina omdömen, samlat.</p>
        </div>
      </div>

      {/* ── 1. Profil ── */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 22, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          {profile?.avatarUrl
            ? <img src={profile.avatarUrl} alt={name} style={{ width: 84, height: 84, borderRadius: '50%', objectFit: 'cover', border: '2.5px solid #fff', boxShadow: '0 6px 16px rgba(241,168,143,.35)' }} />
            : <span style={{ width: 84, height: 84, borderRadius: '50%', flex: '0 0 84px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: '"Fraunces",serif', fontSize: 34, color: '#fff', background: grad(name), boxShadow: '0 6px 16px rgba(241,168,143,.35)' }}>{initial(name)}</span>}
          <div style={{ flex: 1, minWidth: 240 }}>
            <div style={{ fontSize: 26, fontWeight: 600, letterSpacing: '-.02em', color: 'var(--ink)' }}>{name}</div>
            <div style={{ fontSize: 13, color: 'var(--muted)' }}>{handle}{handle && (profile?.category || profile?.country) ? ' · ' : ''}{profile?.category}{profile?.country ? ` · ${COUNTRY[profile.country] || profile.country}` : ''}</div>
            {profile?.bio && <p style={{ fontSize: 14, marginTop: 10, color: 'var(--ink-2)', lineHeight: 1.55, maxWidth: 560 }}>{profile.bio}</p>}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 12, fontSize: 13 }}>
              {profile?.tikTokUsername && <a href={`https://www.tiktok.com/@${profile.tikTokUsername}`} target="_blank" rel="noopener noreferrer" style={{ color: '#C26A4A', fontWeight: 600 }}>TikTok</a>}
              {profile?.instagramUsername && <a href={`https://www.instagram.com/${profile.instagramUsername}`} target="_blank" rel="noopener noreferrer" style={{ color: '#C26A4A', fontWeight: 600 }}>Instagram</a>}
              {profile?.website && <a href={profile.website} target="_blank" rel="noopener noreferrer" style={{ color: '#C26A4A', fontWeight: 600 }}>Webbplats</a>}
            </div>
            {(profile?.profileTags?.length ?? 0) > 0 && <div className="tags" style={{ marginTop: 12 }}>{profile!.profileTags.map((t) => <span key={t} className="tag g">{t}</span>)}</div>}
          </div>
          <Link to="/creator/profile" className="btn-outline" style={{ flex: '0 0 auto' }}>Redigera profil</Link>
        </div>
      </div>

      {/* ── 4. Analytics: utvalda metrics ── */}
      <div className="vstat-row">
        <div className="card vstat" style={{ background: 'linear-gradient(160deg,#fff,#FFF6F0)' }}><div className="vstat-ico" style={{ background: 'linear-gradient(140deg,#FFE3D3,#FFC2A6)', color: '#9c4f31' }}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="8" r="3" /><circle cx="16" cy="9" r="2.5" /><path d="M3 19a6 6 0 0 1 12 0M14 18a5 5 0 0 1 7-1" /></svg></div><div className="vstat-lbl">Följare</div><div className="vstat-val">{formatNumber(profile?.followerCount ?? 0)}</div><div className="vstat-sub"><span className="vmut">{profile?.averageViews ? `${formatNumber(profile.averageViews)} snittvisningar` : 'din publik'}</span></div></div>
        <div className="card vstat"><div className="vstat-ico" style={{ background: 'linear-gradient(140deg,#EDE1FF,#cdb8f2)', color: '#6a4ea8' }}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" /><circle cx="12" cy="12" r="3" /></svg></div><div className="vstat-lbl">Verifierade views</div><div className="vstat-val">{formatNumber(realViews || pfViews)}</div><div className="vstat-sub"><span className="vmut">{realViews ? 'genom kampanjer' : `${formatNumber(pfLikes)} likes i portfölj`}</span></div></div>
        <div className="card vstat"><div className="vstat-ico" style={{ background: 'linear-gradient(140deg,#d7f0e0,#a9dcc0)', color: '#2f7d52' }}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M11 12 8 9a2 2 0 0 0-3 3l4 4a3 3 0 0 0 4 0M13 12l3-3a2 2 0 0 1 3 3l-4 4a3 3 0 0 1-4 0" /></svg></div><div className="vstat-lbl">Samarbeten</div><div className="vstat-val">{brands.length}</div><div className="vstat-sub"><span className="vmut">{realEarned ? formatCurrency(realEarned) + ' intjänat' : 'företag du jobbat med'}</span></div></div>
        <div className="card vstat"><div className="vstat-ico" style={{ background: 'linear-gradient(140deg,#FFE9D2,#F2C58A)', color: '#9c6b1c' }}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="m12 4 2.3 4.8 5.2.7-3.8 3.6.9 5.1L12 16l-4.6 2.8.9-5.1L4.5 9.5l5.2-.7z" /></svg></div><div className="vstat-lbl">Omdöme</div><div className="vstat-val">{reviews && reviews.totalReviews > 0 ? reviews.averageStars.toFixed(1) : '—'}</div><div className="vstat-sub"><span className="vmut">{reviews && reviews.totalReviews > 0 ? `${reviews.totalReviews} omdömen` : 'inga omdömen än'}</span></div></div>
      </div>

      {/* ── 2. Företag du jobbat med ── */}
      {brands.length > 0 && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="sec-head"><h3>Företag du jobbat med</h3><span style={{ fontSize: 13, color: 'var(--muted)' }}>{brands.length}</span></div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
            {brands.map((b) => (
              <div key={b.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 14, border: '1px solid rgba(241,168,143,.18)', background: 'rgba(255,255,255,.6)' }}>
                <span className="mono" style={{ width: 34, height: 34, flex: '0 0 34px', fontSize: 13, background: grad(b.campaignName) }}>{initial(b.campaignName)}</span>
                <div><div style={{ fontWeight: 600, fontSize: 13.5 }}>{b.campaignName}</div><div style={{ fontSize: 11.5, color: 'var(--muted)' }}>{formatNumber(b.totalVerifiedViews)} views</div></div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── 3. Best content ── */}
      <div className="sec-head" style={{ marginBottom: 14 }}>
        <h3 style={{ fontSize: 17, fontWeight: 600 }}>Best content</h3>
        {!showForm && (
          <button className="btn-apply" style={{ width: 'auto', padding: '9px 18px', fontSize: 12.5, display: 'inline-flex', alignItems: 'center', gap: 7 }} onClick={() => { reset(); setShowForm(true); }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14" /></svg> Lägg till arbete
          </button>
        )}
      </div>

      {showForm && (
        <div className="card" style={{ marginBottom: 16, maxWidth: 860 }}>
          <div className="sec-head"><h3>{editingId ? 'Redigera arbete' : 'Nytt arbete'}</h3></div>
          <form onSubmit={handleSubmit} className="form-grid">
            <div className="field full"><label>Titel *</label><input type="text" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required placeholder="t.ex. Sommarkampanj för X" /></div>
            <div className="field"><label>Typ av media</label><select value={form.mediaType} onChange={(e) => setForm({ ...form, mediaType: e.target.value as PortfolioMediaType })}>{MEDIA_TYPES.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}</select></div>
            <div className="field"><label>Kategori</label><input type="text" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="t.ex. Mat, Mode" /></div>
            <div className="field full"><label>Media-URL *</label><input type="url" value={form.mediaUrl} onChange={(e) => setForm({ ...form, mediaUrl: e.target.value })} required placeholder="https://www.tiktok.com/@.../video/…" /></div>
            {(form.mediaType === 'Image' || form.mediaType === 'Video' || form.mediaType === 'Link') && (
              <div className="field full"><label>Miniatyrbild-URL (valfritt)</label><input type="url" value={form.thumbnailUrl} onChange={(e) => setForm({ ...form, thumbnailUrl: e.target.value })} placeholder="https://…" /></div>
            )}
            <div className="field full"><label>Beskrivning</label><textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} placeholder="Vad gjorde du? Vilket resultat?" /></div>
            <div className="field"><label>Varumärke</label><input type="text" value={form.brandName} onChange={(e) => setForm({ ...form, brandName: e.target.value })} placeholder="t.ex. Café X" /></div>
            <div className="field"><label>Views</label><input type="text" inputMode="numeric" value={form.views} onChange={(e) => setForm({ ...form, views: e.target.value.replace(/\D/g, '') })} placeholder="t.ex. 25000" /></div>
            <div className="field"><label>Likes</label><input type="text" inputMode="numeric" value={form.likes} onChange={(e) => setForm({ ...form, likes: e.target.value.replace(/\D/g, '') })} placeholder="t.ex. 1200" /></div>
            <div className="field full checkrow" style={{ flexDirection: 'row', justifyContent: 'flex-start' }}><input type="checkbox" checked={form.isFeatured} onChange={(e) => setForm({ ...form, isFeatured: e.target.checked })} /> Markera som utvald (visas först)</div>
            <div className="field full">
              {error && <p style={{ color: 'var(--red)', fontSize: 13, marginBottom: 8 }}>{error}</p>}
              <div style={{ display: 'flex', gap: 10 }}>
                <button type="submit" className="btn-apply" style={{ width: 'auto', padding: '12px 22px' }} disabled={add.isPending || update.isPending}>{add.isPending || update.isPending ? 'Sparar…' : editingId ? 'Spara ändringar' : 'Lägg till'}</button>
                <button type="button" className="btn-outline" onClick={reset}>Avbryt</button>
              </div>
            </div>
          </form>
        </div>
      )}

      {isLoading ? <div style={{ padding: 60, textAlign: 'center', color: 'var(--muted)' }}>Laddar…</div> : items && items.length > 0 ? (
        <div className="grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: 16 }}>
          {items.map((it) => (
            <div className="pf-card" key={it.id}>
              {(it.mediaType === 'TikTok') ? (
                <div className="pf-img" style={{ height: 'auto', background: 'transparent' }}><TikTokEmbed videoUrl={it.mediaUrl} compact /></div>
              ) : it.thumbnailUrl || it.mediaType === 'Image' ? (
                <a href={it.mediaUrl} target="_blank" rel="noopener noreferrer" className="pf-img" style={{ display: 'block', backgroundImage: `url(${it.thumbnailUrl || it.mediaUrl})` }}>
                  {it.isFeatured && <div className="pf-flag">Utvald</div>}
                </a>
              ) : (
                <div className="pf-img" style={{ background: grad(it.title), display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
                  {it.isFeatured && <div className="pf-flag">Utvald</div>}
                  <a href={it.mediaUrl} target="_blank" rel="noopener noreferrer" style={{ color: '#fff', fontWeight: 700, textAlign: 'center', wordBreak: 'break-all', fontSize: 13 }}>{it.title}</a>
                </div>
              )}
              <div className="pf-body">
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                  <div className="t">{it.title}</div>
                  {it.isFeatured && it.mediaType === 'TikTok' && <span className="badge green">Utvald</span>}
                </div>
                <div className="s">{[it.category, it.brandName].filter(Boolean).join(' · ')}</div>
                {it.description && <p style={{ fontSize: 13, color: 'var(--muted)', marginTop: 8, lineHeight: 1.5 }}>{it.description}</p>}
                {(it.views != null || it.likes != null) && (
                  <div className="pf-stats">
                    {it.views != null && <span><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><circle cx="12" cy="12" r="9" /><path d="m10 9 5 3-5 3z" fill="currentColor" stroke="none" /></svg>{formatNumber(it.views)}</span>}
                    {it.likes != null && <span><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M12 20s-7-4.3-7-9a4 4 0 0 1 7-2.5A4 4 0 0 1 19 11c0 4.7-7 9-7 9z" /></svg>{formatNumber(it.likes)}</span>}
                  </div>
                )}
                <div className="pf-actions">
                  <button className="btn-outline" style={{ flex: 1, padding: 10 }} onClick={() => startEdit(it)}>Redigera</button>
                  <button className="btn-outline" style={{ flex: 1, padding: 10 }} onClick={() => handleDelete(it.id)} disabled={remove.isPending}>Ta bort</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="card" style={{ textAlign: 'center', padding: '54px 24px' }}>
          <div style={{ fontSize: 18, fontWeight: 700 }}>Din portfölj är tom</div>
          <div style={{ color: 'var(--muted)', fontSize: 14, marginTop: 8 }}>Lägg till dina bästa videos och samarbeten så företag kan se vad du kan.</div>
          <button className="btn-apply" style={{ width: 'auto', display: 'inline-block', padding: '11px 22px', marginTop: 16 }} onClick={() => { reset(); setShowForm(true); }}>Lägg till ditt första arbete</button>
        </div>
      )}

      {/* ── 5. Omdömen & om mig ── */}
      <div className="vcsplit" style={{ marginTop: 18 }}>
        <div className="card">
          <div className="sec-head"><h3>Omdömen</h3>{reviews && reviews.totalReviews > 0 && <span style={{ fontSize: 13, color: 'var(--muted)' }}>{reviews.averageStars.toFixed(1)} av {reviews.totalReviews}</span>}</div>
          {reviews && reviews.totalReviews > 0 ? (
            <ReviewList summary={reviews} />
          ) : (
            <div style={{ padding: '30px 6px', textAlign: 'center', color: 'var(--muted)', fontSize: 13.5 }}>Inga omdömen än. Slutför kampanjer så samlar du betyg från företagen.</div>
          )}
        </div>
        <div className="card">
          <div className="sec-head"><h3>Om mig</h3><Link to="/creator/profile" className="view-all">Redigera</Link></div>
          {profile?.bio
            ? <p style={{ fontSize: 13.5, color: 'var(--ink-2)', lineHeight: 1.6 }}>{profile.bio}</p>
            : <p style={{ fontSize: 13.5, color: 'var(--muted)', lineHeight: 1.6 }}>Lägg till en bio i inställningarna så företag lär känna dig.</p>}
          <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 14 }}>
            <div><div className="vcamp-k">Land</div><div className="vcamp-v" style={{ fontSize: 15 }}>{profile?.country ? (COUNTRY[profile.country] || profile.country) : '—'}</div></div>
            <div><div className="vcamp-k">Kategori</div><div className="vcamp-v" style={{ fontSize: 15 }}>{profile?.category || '—'}</div></div>
            <div><div className="vcamp-k">Språk</div><div className="vcamp-v" style={{ fontSize: 15 }}>{profile?.language === 'sv' ? 'Svenska' : profile?.language || '—'}</div></div>
            <div><div className="vcamp-k">Medlem sedan</div><div className="vcamp-v" style={{ fontSize: 15 }}>{profile?.createdAt ? formatDate(profile.createdAt) : '—'}</div></div>
          </div>
        </div>
      </div>
    </section>
  );
}
