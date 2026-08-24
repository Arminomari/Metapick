import { useState } from 'react';
import type { CSSProperties } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { useApplyToCampaign, useBrandProfile, useUpdateBrandProfile, useMyApplications } from '@/hooks/api';
import { ImagePicker } from '@/components/auth/ImagePicker';
import { formatNumber, formatDate, formatCurrency } from '@/lib/utils';
import { t, statusLabel } from '@/lib/i18n';
import { LoadingSpinner } from '@/components/ui';
import { StarRating } from '@/components/ui/StarRating';
import { useToast } from '@/components/vyrle/Toast';
import type { ApiResponse, ReviewDto } from '@/types';

interface BrandPublicCampaign {
  id: string; name: string; category: string; status: string; payoutSummary: string;
  startDate: string; endDate: string; spotsLeft: number; totalViews: number;
}
interface BrandPost {
  id: string; body: string; imageUrl?: string | null; createdAt: string;
}
interface BrandPublicProfile {
  brandProfileId: string; companyName: string; logoUrl?: string | null; industry: string; country: string;
  description?: string | null; website?: string | null; memberSince: string;
  followerCount: number; isFollowing: boolean;
  activeCampaignCount: number; completedCampaignCount: number; totalVerifiedViews: number; creatorsWorkedWith: number;
  averageRating: number; reviewCount: number; recentReviews: ReviewDto[];
  activeCampaigns: BrandPublicCampaign[]; pastCampaigns: BrandPublicCampaign[];
  posts?: BrandPost[] | null;
  hasTap?: boolean; tapCpm?: number; tapName?: string | null; tapBrief?: string | null;
  tapHashtag?: string | null; tapCapPerVideo?: number | null; tapMonthlyCapPerCreator?: number | null;
  membershipStatus?: string | null;
}

const ago = (iso: string): string => {
  const s = Math.floor((Date.now() - +new Date(iso)) / 1000);
  if (s < 60) return t('nyss');
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} ${t('tim')}`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d} ${t('dgr')}`;
  return formatDate(iso);
};

const statBox: CSSProperties = { textAlign: 'center', padding: '14px 10px', borderRadius: 15, background: 'rgba(255,255,255,.7)', border: '1px solid rgba(241,168,143,.22)' };

export function BrandProfilePage({ brandId, ownView, onEdit }: { brandId?: string; ownView?: boolean; onEdit?: () => void } = {}) {
  const { id: routeId } = useParams<{ id: string }>();
  const id = brandId ?? routeId;
  const navigate = useNavigate();
  const qc = useQueryClient();
  const toast = useToast();
  const apply = useApplyToCampaign();
  const [applyingId, setApplyingId] = useState<string | null>(null);

  const { data: p, isLoading } = useQuery({
    queryKey: ['brand-public', id],
    queryFn: async () => (await api.get<ApiResponse<BrandPublicProfile>>(`/brands/${id}/public`)).data.data,
    enabled: !!id,
  });

  const follow = useMutation({
    mutationFn: async (next: boolean) => {
      if (next) await api.post(`/brands/${id}/follow`);
      else await api.delete(`/brands/${id}/follow`);
      return next;
    },
    onSuccess: (next) => {
      qc.invalidateQueries({ queryKey: ['brand-public', id] });
      toast.push(next ? t('Du följer nu företaget!') : t('Du har slutat följa företaget'), 'success');
    },
  });

  const joinTap = useMutation({
    mutationFn: async () => (await api.post(`/creator/communities/${id}/request`)).data.data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['brand-public', id] });
      toast.push(t('Ansökan skickad! Företaget får en notis och svarar snart.'), 'success');
    },
    onError: (e: any) => toast.push(e?.response?.data?.error?.message ?? t('Kunde inte skicka ansökan'), 'error'),
  });

  const { data: myApps } = useMyApplications();
  const appStatus = new Map<string, string>();
  (myApps?.data ?? []).forEach((a) => appStatus.set(a.campaignId, a.status));

  const handleApply = async (campaignId: string) => {
    setApplyingId(campaignId);
    try {
      await apply.mutateAsync({ campaignId, message: t('Jag vill gärna delta i denna kampanj!') });
      toast.push(t('Ansökan skickad!'), 'success');
    } catch (err: any) {
      toast.push(err?.response?.data?.error?.message ?? t('Kunde inte skicka ansökan'), 'error');
    }
    setApplyingId(null);
  };

  if (isLoading) return <LoadingSpinner />;
  if (!p) return (
    <section className="view active reveal"><div className="card" style={{ textAlign: 'center', padding: '54px 24px' }}>
      <div style={{ fontSize: 18, fontWeight: 700 }}>{t('Företaget hittades inte')}</div>
    </div></section>
  );

  const initial = (p.companyName[0] || '?').toUpperCase();

  return (
    <section className="view active reveal">
      {/* ── Cover + identity ── */}
      <div className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: 16 }}>
        <div style={{ padding: '24px 24px 22px', position: 'relative' }}>
          {ownView && (
            <button type="button" onClick={() => onEdit?.()} className="btn-outline"
              style={{ position: 'absolute', top: 18, right: 18, width: 'auto', padding: '9px 18px', fontSize: 13 }}>
              ✎ {t('Redigera profil')}
            </button>
          )}
          <div style={{ display: 'flex', gap: 18, alignItems: 'center', flexWrap: 'wrap' }}>
            {p.logoUrl
              ? <img src={p.logoUrl} alt={p.companyName} style={{ width: 112, height: 112, borderRadius: 30, objectFit: 'cover', border: '5px solid #fff', boxShadow: '0 14px 34px rgba(11,15,23,.22)' }} />
              : <div style={{ width: 112, height: 112, borderRadius: 30, border: '5px solid #fff', background: 'linear-gradient(135deg,#FFD8C7,#F1A88F)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: '"Fraunces",serif', fontSize: 46, color: '#fff', boxShadow: '0 14px 34px rgba(11,15,23,.22)' }}>{initial}</div>}
            <div style={{ flex: 1, minWidth: 'min(100%, 220px)', paddingBottom: 4 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <h1 style={{ margin: 0, fontSize: 'clamp(24px, 6vw, 32px)', fontWeight: 600, letterSpacing: '-.02em', color: 'var(--ink)', fontFamily: '"Fraunces",serif', minWidth: 0, wordBreak: 'break-word' }}>{p.companyName}</h1>
                <span className="badge green">✓ {t('Verifierat företag')}</span>
              </div>
              <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 3 }}>
                {p.industry} · {p.country} · {t('Medlem sedan')} {new Date(p.memberSince).getFullYear()}
                {p.website && <> · <a href={p.website} target="_blank" rel="noopener noreferrer" style={{ color: '#9c4f31', fontWeight: 600 }}>{t('Webbplats')}</a></>}
              </div>
            </div>
            {!ownView && (
              <button
                type="button"
                onClick={() => follow.mutate(!p.isFollowing)}
                disabled={follow.isPending}
                className={p.isFollowing ? 'btn-outline' : 'btn-apply'}
                style={{ width: 'auto', padding: '11px 26px', marginBottom: 4 }}
              >
                {p.isFollowing ? `✓ ${t('Följer')}` : `＋ ${t('Följ')}`}
              </button>
            )}
          </div>
          {p.description && <p style={{ margin: '14px 0 0', fontSize: 14, color: 'var(--ink-2)', lineHeight: 1.6, maxWidth: 720 }}>{p.description}</p>}
        </div>
      </div>

      {/* ── Stats ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10, marginBottom: 16 }}>
        {([
          [t('Följare'), formatNumber(p.followerCount), true],
          [t('Aktiva kampanjer'), String(p.activeCampaignCount), false],
          [t('Genomförda'), String(p.completedCampaignCount), false],
          [t('Totala views'), formatNumber(p.totalVerifiedViews), false],
          [t('Ambassadörer'), String(p.creatorsWorkedWith), false],
          [t('Betyg'), p.reviewCount > 0 ? `${p.averageRating.toFixed(1)} ★` : '–', false],
        ] as [string, string, boolean][]).map(([lbl, val, hi]) => (
          <div key={lbl} style={{ ...statBox, ...(hi ? { background: 'linear-gradient(140deg,#FFE3D3,#FFD3BC)', border: '1px solid rgba(241,168,143,.4)' } : {}) }}>
            <div style={{ fontWeight: 800, fontSize: 22, color: '#0B0F17', fontFamily: '"Fraunces",serif' }}>{val}</div>
            <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '.07em', textTransform: 'uppercase', color: hi ? '#9c4f31' : 'var(--muted)', marginTop: 2 }}>{lbl}</div>
          </div>
        ))}
      </div>

      {/* ── The tap: what a creator can draw, and how to get in ── */}
      {p.hasTap && !ownView && (
        <div className="card" style={{ marginBottom: 16, background: 'linear-gradient(160deg,#fff,#FFF6F0)', border: '1px solid rgba(241,168,143,.4)' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 26, flexShrink: 0 }} aria-hidden>💧</span>
            <div style={{ flex: '1 1 240px', minWidth: 0 }}>
              <div style={{ fontWeight: 800, fontSize: 16 }}>{t('Kranen är öppen')}{p.tapName ? ` · ${p.tapName}` : ''}</div>
              <div style={{ fontSize: 13.5, color: 'var(--ink-2)', marginTop: 3, lineHeight: 1.55 }}>
                <strong>{p.tapCpm} kr / 1 000 views</strong> {t('löpande varje månad')}
                {p.tapCapPerVideo ? ` · ${t('max')} ${formatCurrency(p.tapCapPerVideo)} / video` : ''}
                {p.tapMonthlyCapPerCreator ? ` · ${t('max')} ${formatCurrency(p.tapMonthlyCapPerCreator)} / ${t('mån')}` : ''}
                {p.tapHashtag ? ` · #${p.tapHashtag}` : ''}
              </div>
              {p.tapBrief && <p style={{ margin: '10px 0 0', fontSize: 13.5, lineHeight: 1.6, color: 'var(--ink-2)', whiteSpace: 'pre-line' }}>{p.tapBrief}</p>}
            </div>
            <div style={{ flex: '0 0 auto' }}>
              {p.membershipStatus === 'Active' ? (
                <span className="vy-badge pos">{t('Du är medlem — kranen är din')}</span>
              ) : p.membershipStatus === 'Requested' ? (
                <span className="vy-badge pend">{t('Ansökan skickad — väntar på svar')}</span>
              ) : (
                <button type="button" className="btn-apply" style={{ width: 'auto', padding: '12px 22px' }}
                  onClick={() => joinTap.mutate()} disabled={joinTap.isPending}>
                  {joinTap.isPending ? t('Skickar…') : t('Ansök till kranen')}
                </button>
              )}
            </div>
          </div>
          {p.membershipStatus !== 'Active' && p.membershipStatus !== 'Requested' && (
            <div style={{ marginTop: 10, fontSize: 12.5, color: 'var(--muted)' }}>
              {t('Medlemmar i communityn kan publicera när de vill och få betalt per verifierad view — företaget godkänner din ansökan först.')}
            </div>
          )}
        </div>
      )}

      {/* ── Community feed ── */}
      {(ownView || (p.posts?.length ?? 0) > 0) && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="sec-head"><h3>{t('Uppdateringar')}</h3>{!ownView && <span style={{ fontSize: 13, color: 'var(--muted)' }}>{t('Nytt från')} {p.companyName}</span>}</div>
          {ownView && <PostComposer logoUrl={p.logoUrl} initial={initial} onPosted={() => qc.invalidateQueries({ queryKey: ['brand-public', id] })} />}
          <div style={{ display: 'grid', gap: 12 }}>
            {(p.posts ?? []).map((post) => (
              <div key={post.id} style={{ display: 'flex', gap: 12, padding: '16px 16px 14px', border: '1px solid rgba(241,168,143,.24)', borderRadius: 18, background: 'linear-gradient(160deg,#fff,#FFF9F5)', boxShadow: '0 6px 20px rgba(180,120,90,.06)', minWidth: 0 }}>
                {p.logoUrl
                  ? <img src={p.logoUrl} style={{ width: 46, height: 46, borderRadius: '50%', objectFit: 'cover', flex: '0 0 46px', boxShadow: '0 4px 12px rgba(180,120,90,.18)' }} alt="" />
                  : <div style={{ width: 46, height: 46, borderRadius: '50%', flex: '0 0 46px', background: 'linear-gradient(135deg,#FFD8C7,#F1A88F)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontFamily: '"Fraunces",serif', fontSize: 19 }}>{initial}</div>}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 800, fontSize: 14.5, color: '#0B0F17' }}>{p.companyName}</span>
                    <span style={{ width: 15, height: 15, borderRadius: '50%', background: 'linear-gradient(135deg,#3dbb77,#2f9d5b)', color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 800 }} title={t('Verifierat företag')}>✓</span>
                    <span style={{ fontSize: 12.5, color: 'var(--muted)' }}>· {ago(post.createdAt)}</span>
                    {ownView && <DeletePostButton postId={post.id} onDeleted={() => qc.invalidateQueries({ queryKey: ['brand-public', id] })} />}
                  </div>
                  <p style={{ margin: '5px 0 0', fontSize: 14.5, lineHeight: 1.6, color: 'var(--ink)', whiteSpace: 'pre-line', wordBreak: 'break-word' }}>{post.body}</p>
                  {post.imageUrl && <img src={post.imageUrl} alt="" style={{ marginTop: 10, maxWidth: '100%', maxHeight: 380, borderRadius: 16, objectFit: 'cover', border: '1px solid rgba(241,168,143,.2)' }} />}
                </div>
              </div>
            ))}
          </div>
          {(p.posts?.length ?? 0) === 0 && ownView && (
            <p style={{ fontSize: 13, color: 'var(--muted)', margin: 0 }}>{t('Inga inlägg ännu — skriv ditt första och nå alla dina följare direkt.')}</p>
          )}
        </div>
      )}

      {/* ── Active campaigns ── */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="sec-head"><h3>{t('Aktiva kampanjer')}</h3><span style={{ fontSize: 13, color: 'var(--muted)' }}>{p.activeCampaigns.length} {t('öppna just nu')}</span></div>
        {p.activeCampaigns.length ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 250px), 1fr))', gap: 14 }}>
            {p.activeCampaigns.map((c) => (
              <div key={c.id} style={{ border: '1px solid rgba(241,168,143,.25)', borderRadius: 16, padding: 16, background: 'linear-gradient(160deg,#fff,#FFF6F0)', display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 15, wordBreak: 'break-word' }}>{c.name}</div>
                <div style={{ fontSize: 12.5, color: '#9c4f31', fontWeight: 700 }}>{c.payoutSummary}</div>
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>{c.category} · {c.spotsLeft} {t('platser kvar')} · {formatDate(c.startDate)} – {formatDate(c.endDate)}</div>
                {c.totalViews > 0 && <div style={{ fontSize: 12, fontWeight: 700, color: '#2f7d52' }}>👁 {formatNumber(c.totalViews)} {t('levererade views')}</div>}
                {!ownView && (() => {
                  const mine = appStatus.get(c.id);
                  if (mine === 'Approved') return (
                    <button type="button" className="btn-outline" style={{ width: '100%', padding: 10, marginTop: 'auto' }}
                      onClick={() => navigate('/creator/assignments')}>
                      ✓ {t('Godkänd — gå till Mina uppdrag')}
                    </button>
                  );
                  if (mine === 'Pending') return (
                    <div style={{ marginTop: 'auto', textAlign: 'center', padding: '10px 0' }}><span className="vy-badge pend">{t('Ansökan skickad — väntar på svar')}</span></div>
                  );
                  if (mine === 'Rejected') return (
                    <div style={{ marginTop: 'auto', textAlign: 'center', padding: '10px 0' }}><span className="vy-badge neg">{t('Ansökan nekad')}</span></div>
                  );
                  return (
                    <button
                      type="button"
                      className="btn-apply"
                      style={{ width: '100%', padding: 10, marginTop: 'auto' }}
                      onClick={() => handleApply(c.id)}
                      disabled={applyingId === c.id || c.spotsLeft <= 0}
                    >
                      {applyingId === c.id ? t('Skickar…') : c.spotsLeft <= 0 ? t('Fullbokad') : t('Ansök')}
                    </button>
                  );
                })()}
              </div>
            ))}
          </div>
        ) : (
          <p style={{ fontSize: 13, color: 'var(--muted)', margin: 0 }}>{t('Inga öppna kampanjer just nu — följ företaget så ser du när nästa släpps.')}</p>
        )}
      </div>

      {/* ── Past campaigns ── */}
      {p.pastCampaigns.length > 0 && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="sec-head"><h3>{t('Tidigare kampanjer')}</h3></div>
          {p.pastCampaigns.map((c) => (
            <div key={c.id} className="list-row">
              <div className="row-main" style={{ flex: 1, minWidth: 0 }}>
                <div className="t">{c.name}</div>
                <div className="s">{c.category} · {formatDate(c.startDate)} – {formatDate(c.endDate)} · {statusLabel(c.status)}</div>
              </div>
              <div style={{ textAlign: 'right', flex: '0 0 auto' }}>
                <div className="t">{formatNumber(c.totalViews)}</div>
                <div className="s">views</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Reviews ── */}
      {p.reviewCount > 0 && (
        <div className="card">
          <div className="sec-head"><h3>{t('Omdömen från creators')}</h3>
            <span style={{ fontSize: 13, color: 'var(--muted)' }}>{p.averageRating.toFixed(1)} {t('av')} 5 · {p.reviewCount} {p.reviewCount === 1 ? t('omdöme') : t('omdömen')}</span>
          </div>
          {p.recentReviews.map((r) => (
            <div key={r.id} className="list-row">
              <div className="row-main" style={{ flex: 1, minWidth: 0 }}>
                <div className="t" style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>{r.reviewerName} <StarRating value={r.stars} readonly size="sm" /></div>
                {r.comment && <div className="s">{r.comment}</div>}
              </div>
              <span style={{ fontSize: 12, color: 'var(--muted)', whiteSpace: 'nowrap' }}>{formatDate(r.createdAt)}</span>
            </div>
          ))}
        </div>
      )}

      <div style={{ marginTop: 16 }}>
        <button type="button" className="view-all" onClick={() => navigate(-1)}>← {t('Tillbaka')}</button>
      </div>
    </section>
  );
}

/** The brand's own view of its public profile — how creators see it, editable in place. */
export function BrandOwnPublicProfilePage() {
  const { data: profile, isLoading } = useBrandProfile();
  const update = useUpdateBrandProfile();
  const qc = useQueryClient();
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [form, setForm] = useState({ description: '', website: '', industry: '', logoUrl: null as string | null });

  if (profile && !loaded) {
    setForm({ description: profile.description ?? '', website: profile.website ?? '', industry: profile.industry ?? '', logoUrl: profile.logoUrl ?? null });
    setLoaded(true);
  }

  if (isLoading) return <LoadingSpinner />;
  if (!profile?.id) return null;

  const input: CSSProperties = { width: '100%', border: '1px solid rgba(241,168,143,.28)', borderRadius: 13, padding: '12px 14px', fontSize: 13.5, fontFamily: 'inherit', background: 'rgba(255,255,255,.8)', color: '#0B0F17' };
  const lbl: CSSProperties = { fontSize: 12, fontWeight: 700, letterSpacing: '.05em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 6, display: 'block' };

  const save = async () => {
    try {
      await update.mutateAsync({ companyName: profile.companyName, contactPhone: profile.contactPhone ?? undefined, ...form, logoUrl: form.logoUrl });
      await qc.invalidateQueries({ queryKey: ['brand-public'] });
      toast.push(t('Profilen uppdaterad!'), 'success');
      setEditing(false);
    } catch (err: any) {
      toast.push(err?.response?.data?.error?.message ?? t('Kunde inte spara'), 'error');
    }
  };

  return (
    <>
      <div className="card" style={{ marginBottom: 16, padding: '12px 18px', background: 'rgba(237,225,255,.35)', border: '1px solid rgba(157,139,196,.3)' }}>
        <span style={{ fontSize: 13, color: '#6a4ea8', fontWeight: 600 }}>👁 {t('Så här ser din profil ut för creators. En stark profil ger fler ansökningar.')}</span>
      </div>

      {editing && (
        <form className="card" style={{ marginBottom: 16, border: '1px solid rgba(241,168,143,.4)' }}
          onSubmit={(e) => { e.preventDefault(); void save(); }}>
          <div className="sec-head"><h3>{t('Redigera profil')}</h3></div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 14 }}>
            <div style={{ gridColumn: '1 / -1' }}>
              <ImagePicker value={form.logoUrl} onChange={(v) => setForm({ ...form, logoUrl: v })} label={t('Logotyp')} shape="rounded" />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <span style={lbl}>{t('Beskrivning — berätta vad ni gör och vilka creators ni söker')}</span>
              <textarea style={{ ...input, resize: 'vertical' }} rows={4} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder={t('Vilka är ni? Vad står ni för? Varför ska en creator jobba med er?')} />
            </div>
            <div><span style={lbl}>{t('Bransch')}</span><input style={input} value={form.industry} onChange={(e) => setForm({ ...form, industry: e.target.value })} /></div>
            <div><span style={lbl}>{t('Webbplats')}</span><input style={input} type="url" value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} placeholder="https://…" /></div>
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 16, flexWrap: 'wrap' }}>
            <button type="submit" className="btn-apply" style={{ width: 'auto', padding: '12px 26px' }} disabled={update.isPending}>{update.isPending ? t('Sparar…') : t('Spara profil')}</button>
            <button type="button" className="btn-outline" style={{ width: 'auto', padding: '12px 26px' }} onClick={() => setEditing(false)}>{t('Avbryt')}</button>
          </div>
        </form>
      )}

      <BrandProfilePage brandId={profile.id} ownView onEdit={() => setEditing((v) => !v)} />
    </>
  );
}

// ── Community composer (own view) ──────────────────────
function PostComposer({ onPosted, logoUrl, initial: brandInitial }: { onPosted: () => void; logoUrl?: string | null; initial?: string }) {
  const toast = useToast();
  const [body, setBody] = useState('');
  const [image, setImage] = useState<string | null>(null);
  const [showImage, setShowImage] = useState(false);
  const [busy, setBusy] = useState(false);

  const publish = async () => {
    if (!body.trim()) return;
    setBusy(true);
    try {
      await api.post('/brand/posts', { body: body.trim(), imageUrl: image });
      setBody(''); setImage(null); setShowImage(false);
      toast.push(t('Inlägget publicerat — alla följare har notifierats!'), 'success');
      onPosted();
    } catch (err: any) {
      toast.push(err?.response?.data?.error?.message ?? t('Kunde inte publicera inlägget'), 'error');
    }
    setBusy(false);
  };

  return (
    <div style={{ border: '1px solid rgba(241,168,143,.3)', borderRadius: 18, padding: 14, background: 'linear-gradient(160deg,#fff,#FFF9F5)', marginBottom: 12 }}>
      <div style={{ display: 'flex', gap: 12 }}>
        {logoUrl
          ? <img src={logoUrl} style={{ width: 44, height: 44, borderRadius: '50%', objectFit: 'cover', flex: '0 0 44px' }} alt="" />
          : <div style={{ width: 44, height: 44, borderRadius: '50%', flex: '0 0 44px', background: 'linear-gradient(135deg,#FFD8C7,#F1A88F)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontFamily: '"Fraunces",serif', fontSize: 18 }}>{brandInitial ?? '?'}</div>}
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={3}
          maxLength={2000}
          placeholder={t('Vad händer hos er? Dela nyheter, kampanjsläpp eller reklam — dina följare ser det direkt…')}
          style={{ flex: 1, minWidth: 0, width: '100%', border: 'none', outline: 'none', background: 'transparent', fontSize: 15, fontFamily: 'inherit', color: '#0B0F17', resize: 'vertical', lineHeight: 1.55, paddingTop: 8 }}
        />
      </div>
      {showImage && (
        <div style={{ marginTop: 10 }}>
          <ImagePicker value={image} onChange={setImage} label={t('Bild till inlägget')} shape="rounded" />
        </div>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10, flexWrap: 'wrap' }}>
        <button type="button" className="btn-outline" style={{ width: 'auto', padding: '8px 14px', fontSize: 12.5 }} onClick={() => setShowImage((v) => !v)}>
          🖼 {showImage ? t('Utan bild') : t('Lägg till bild')}
        </button>
        <button type="button" className="btn-apply" style={{ width: 'auto', padding: '9px 22px', marginLeft: 'auto' }} onClick={() => void publish()} disabled={busy || !body.trim()}>
          {busy ? t('Publicerar…') : t('Publicera')}
        </button>
      </div>
    </div>
  );
}

function DeletePostButton({ postId, onDeleted }: { postId: string; onDeleted: () => void }) {
  const [armed, setArmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const del = async () => {
    if (!armed) { setArmed(true); setTimeout(() => setArmed(false), 3500); return; }
    setBusy(true);
    try { await api.delete(`/brand/posts/${postId}`); onDeleted(); } catch { /* stays visible */ }
    setBusy(false);
  };
  return (
    <button type="button" onClick={() => void del()} disabled={busy}
      style={{ marginLeft: 'auto', border: 'none', background: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700, color: armed ? '#cf4b4b' : 'var(--muted)', fontFamily: 'inherit', padding: 0 }}>
      {armed ? t('Säker?') : t('Ta bort')}
    </button>
  );
}

