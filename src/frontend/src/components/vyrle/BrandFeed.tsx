import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import api from '@/lib/api';
import { t } from '@/lib/i18n';
import { formatDate } from '@/lib/utils';
import type { ApiResponse } from '@/types';

interface FeedPost {
  id: string; body: string; imageUrl?: string | null; createdAt: string;
  brandProfileId: string; brandName: string; brandLogoUrl?: string | null;
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

/** Home feed: latest posts from the brands the creator follows. */
export function BrandFeedSection() {
  const navigate = useNavigate();
  const { data: posts = [], isLoading } = useQuery({
    queryKey: ['brand-feed'],
    queryFn: async () => (await api.get<ApiResponse<FeedPost[]>>('/brands/feed')).data.data,
    refetchInterval: 60000,
  });

  if (isLoading) return null;

  return (
    <div className="card" style={{ marginTop: 18 }}>
      <div className="vperf-head" style={{ flexWrap: 'wrap', gap: '4px 12px' }}>
        <h3>✦ {t('Ditt flöde')}</h3>
        <span style={{ fontSize: 13, color: 'var(--muted)' }}>{t('Senaste från företagen du följer')}</span>
      </div>
      {posts.length ? (
        <div style={{ display: 'grid', gap: 12, marginTop: 6 }}>
          {posts.map((post) => (
            <div key={post.id} style={{ display: 'flex', gap: 12, padding: '16px 16px 14px', border: '1px solid rgba(241,168,143,.24)', borderRadius: 18, background: 'linear-gradient(160deg,#fff,#FFF9F5)', boxShadow: '0 6px 20px rgba(180,120,90,.06)', minWidth: 0 }}>
              <div
                role="button"
                tabIndex={0}
                onClick={() => navigate(`/creator/brands/${post.brandProfileId}`)}
                onKeyDown={(e) => { if (e.key === 'Enter') navigate(`/creator/brands/${post.brandProfileId}`); }}
                style={{ cursor: 'pointer', flex: '0 0 46px' }}
                title={t('Visa företagsprofil')}
              >
                {post.brandLogoUrl
                  ? <img src={post.brandLogoUrl} style={{ width: 46, height: 46, borderRadius: '50%', objectFit: 'cover', boxShadow: '0 4px 12px rgba(180,120,90,.18)' }} alt="" />
                  : <div style={{ width: 46, height: 46, borderRadius: '50%', background: 'linear-gradient(135deg,#FFD8C7,#F1A88F)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontFamily: '"Fraunces",serif', fontSize: 19 }}>{(post.brandName[0] || '?').toUpperCase()}</div>}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
                  <span
                    onClick={() => navigate(`/creator/brands/${post.brandProfileId}`)}
                    style={{ fontWeight: 800, fontSize: 14.5, color: '#0B0F17', cursor: 'pointer', minWidth: 0, wordBreak: 'break-word' }}
                  >
                    {post.brandName}
                  </span>
                  <span style={{ width: 15, height: 15, borderRadius: '50%', background: 'linear-gradient(135deg,#3dbb77,#2f9d5b)', color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 800 }} title={t('Verifierat företag')}>✓</span>
                  <span style={{ fontSize: 12.5, color: 'var(--muted)' }}>· {ago(post.createdAt)}</span>
                </div>
                <p style={{ margin: '5px 0 0', fontSize: 14.5, lineHeight: 1.6, color: 'var(--ink)', whiteSpace: 'pre-line', wordBreak: 'break-word' }}>{post.body}</p>
                {post.imageUrl && <img src={post.imageUrl} alt="" style={{ marginTop: 10, maxWidth: '100%', maxHeight: 380, borderRadius: 16, objectFit: 'cover', border: '1px solid rgba(241,168,143,.2)' }} />}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ padding: '30px 10px', textAlign: 'center' }}>
          <div style={{ fontSize: 26, marginBottom: 8 }} aria-hidden>✦</div>
          <div style={{ fontWeight: 700 }}>{t('Ditt flöde är tomt')}</div>
          <div style={{ color: 'var(--muted)', fontSize: 13, marginTop: 6, maxWidth: 380, marginInline: 'auto' }}>
            {t('Följ företag du gillar så dyker deras uppdateringar, kampanjsläpp och nyheter upp här.')}
          </div>
        </div>
      )}
    </div>
  );
}
