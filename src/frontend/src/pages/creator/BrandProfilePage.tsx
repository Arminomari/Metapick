import { useState } from 'react';
import type { CSSProperties } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { useApplyToCampaign } from '@/hooks/api';
import { formatNumber, formatDate } from '@/lib/utils';
import { t, statusLabel } from '@/lib/i18n';
import { LoadingSpinner } from '@/components/ui';
import { StarRating } from '@/components/ui/StarRating';
import { useToast } from '@/components/vyrle/Toast';
import type { ApiResponse, ReviewDto } from '@/types';

interface BrandPublicCampaign {
  id: string; name: string; category: string; status: string; payoutSummary: string;
  startDate: string; endDate: string; spotsLeft: number; totalViews: number;
}
interface BrandPublicProfile {
  brandProfileId: string; companyName: string; logoUrl?: string | null; industry: string; country: string;
  description?: string | null; website?: string | null; memberSince: string;
  followerCount: number; isFollowing: boolean;
  activeCampaignCount: number; completedCampaignCount: number; totalVerifiedViews: number; creatorsWorkedWith: number;
  averageRating: number; reviewCount: number; recentReviews: ReviewDto[];
  activeCampaigns: BrandPublicCampaign[]; pastCampaigns: BrandPublicCampaign[];
}

const statBox: CSSProperties = { textAlign: 'center', padding: '14px 10px', borderRadius: 15, background: 'rgba(255,255,255,.7)', border: '1px solid rgba(241,168,143,.22)' };

export function BrandProfilePage() {
  const { id } = useParams<{ id: string }>();
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
        <div style={{ height: 120, background: 'linear-gradient(120deg, #1A2230 0%, #0B0F17 55%, #3a2a22 100%), radial-gradient(600px 200px at 80% 0%, rgba(241,168,143,.5), transparent)', backgroundBlendMode: 'screen' }} />
        <div style={{ padding: '0 24px 22px' }}>
          <div style={{ display: 'flex', gap: 18, alignItems: 'flex-end', flexWrap: 'wrap', marginTop: -44 }}>
            {p.logoUrl
              ? <img src={p.logoUrl} alt={p.companyName} style={{ width: 92, height: 92, borderRadius: 24, objectFit: 'cover', border: '4px solid #fff', boxShadow: '0 10px 26px rgba(11,15,23,.18)' }} />
              : <div style={{ width: 92, height: 92, borderRadius: 24, border: '4px solid #fff', background: 'linear-gradient(135deg,#FFD8C7,#F1A88F)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: '"Fraunces",serif', fontSize: 38, color: '#fff', boxShadow: '0 10px 26px rgba(11,15,23,.18)' }}>{initial}</div>}
            <div style={{ flex: 1, minWidth: 220, paddingBottom: 4 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <h1 style={{ margin: 0, fontSize: 26, fontWeight: 700, letterSpacing: '-.02em', color: 'var(--ink)' }}>{p.companyName}</h1>
                <span className="badge green">✓ {t('Verifierat företag')}</span>
              </div>
              <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 3 }}>
                {p.industry} · {p.country} · {t('Medlem sedan')} {new Date(p.memberSince).getFullYear()}
                {p.website && <> · <a href={p.website} target="_blank" rel="noopener noreferrer" style={{ color: '#9c4f31', fontWeight: 600 }}>{t('Webbplats')}</a></>}
              </div>
            </div>
            <button
              type="button"
              onClick={() => follow.mutate(!p.isFollowing)}
              disabled={follow.isPending}
              className={p.isFollowing ? 'btn-outline' : 'btn-apply'}
              style={{ width: 'auto', padding: '11px 26px', marginBottom: 4 }}
            >
              {p.isFollowing ? `✓ ${t('Följer')}` : `＋ ${t('Följ')}`}
            </button>
          </div>
          {p.description && <p style={{ margin: '14px 0 0', fontSize: 14, color: 'var(--ink-2)', lineHeight: 1.6, maxWidth: 720 }}>{p.description}</p>}
        </div>
      </div>

      {/* ── Stats ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10, marginBottom: 16 }}>
        {[
          [t('Följare'), formatNumber(p.followerCount)],
          [t('Aktiva kampanjer'), String(p.activeCampaignCount)],
          [t('Genomförda'), String(p.completedCampaignCount)],
          [t('Totala views'), formatNumber(p.totalVerifiedViews)],
          [t('Creators anlitade'), String(p.creatorsWorkedWith)],
          [t('Betyg'), p.reviewCount > 0 ? `${p.averageRating.toFixed(1)} ★` : '–'],
        ].map(([lbl, val]) => (
          <div key={lbl} style={statBox}>
            <div style={{ fontWeight: 800, fontSize: 20, color: '#0B0F17' }}>{val}</div>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--muted)', marginTop: 2 }}>{lbl}</div>
          </div>
        ))}
      </div>

      {/* ── Active campaigns ── */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="sec-head"><h3>{t('Aktiva kampanjer')}</h3><span style={{ fontSize: 13, color: 'var(--muted)' }}>{p.activeCampaigns.length} {t('öppna just nu')}</span></div>
        {p.activeCampaigns.length ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: 14 }}>
            {p.activeCampaigns.map((c) => (
              <div key={c.id} style={{ border: '1px solid rgba(241,168,143,.25)', borderRadius: 16, padding: 16, background: 'linear-gradient(160deg,#fff,#FFF6F0)', display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ fontWeight: 700, fontSize: 15 }}>{c.name}</div>
                <div style={{ fontSize: 12.5, color: '#9c4f31', fontWeight: 700 }}>{c.payoutSummary}</div>
                <div style={{ fontSize: 12, color: 'var(--muted)' }}>{c.category} · {c.spotsLeft} {t('platser kvar')} · {formatDate(c.startDate)} – {formatDate(c.endDate)}</div>
                <button
                  type="button"
                  className="btn-apply"
                  style={{ width: '100%', padding: 10, marginTop: 'auto' }}
                  onClick={() => handleApply(c.id)}
                  disabled={applyingId === c.id || c.spotsLeft <= 0}
                >
                  {applyingId === c.id ? t('Skickar…') : c.spotsLeft <= 0 ? t('Fullbokad') : t('Ansök')}
                </button>
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
              <div className="row-main" style={{ flex: 1 }}>
                <div className="t">{c.name}</div>
                <div className="s">{c.category} · {formatDate(c.startDate)} – {formatDate(c.endDate)} · {statusLabel(c.status)}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
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
              <div className="row-main" style={{ flex: 1 }}>
                <div className="t" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>{r.reviewerName} <StarRating value={r.stars} readonly size="sm" /></div>
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
