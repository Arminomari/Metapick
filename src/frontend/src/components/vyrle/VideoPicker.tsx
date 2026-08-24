import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { t } from '@/lib/i18n';
import { formatNumber, formatDate } from '@/lib/utils';
import { useToast } from '@/components/vyrle/Toast';
import type { ApiResponse } from '@/types';

interface MyVideo {
  videoId: string; title: string; coverImageUrl?: string | null; shareUrl: string;
  publishedAt: string; views: number; likes: number; alreadyTracked: boolean; trackedFor?: string | null;
}

/**
 * Attach content by picking it from the creator's own TikTok account —
 * no hashtag and no tracking code in the caption, so nothing about the
 * video has to look like an ad.
 */
export function VideoPicker({ assignmentId, onDone }: { assignmentId: string; onDone?: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const { data: videos = [], isLoading, isError, error } = useQuery({
    queryKey: ['my-tiktok-videos'],
    queryFn: async () => (await api.get<ApiResponse<MyVideo[]>>('/assignments/my-tiktok-videos')).data.data,
    enabled: open,
    staleTime: 60000,
  });

  const attach = async (v: MyVideo) => {
    setBusy(v.videoId);
    try {
      await api.post(`/assignments/${assignmentId}/submit`, { videoUrl: v.shareUrl });
      await qc.invalidateQueries({ queryKey: ['assignment', assignmentId] });
      await qc.invalidateQueries({ queryKey: ['my-tiktok-videos'] });
      toast.push(t('Videon är kopplad till uppdraget!'), 'success');
      setOpen(false);
      onDone?.();
    } catch (e: any) {
      toast.push(e?.response?.data?.error?.message ?? t('Kunde inte koppla videon'), 'error');
    }
    setBusy(null);
  };

  if (!open) {
    return (
      <button type="button" className="btn-apply" style={{ width: 'auto', padding: '12px 22px' }} onClick={() => setOpen(true)}>
        🎬 {t('Välj bland dina TikTok-videos')}
      </button>
    );
  }

  return (
    <div style={{ marginTop: 4 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
        <span style={{ fontWeight: 700, fontSize: 14 }}>{t('Dina senaste videos')}</span>
        <button type="button" className="btn-outline" style={{ width: 'auto', padding: '7px 14px', fontSize: 12.5, marginLeft: 'auto' }} onClick={() => setOpen(false)}>
          {t('Stäng')}
        </button>
      </div>

      {isLoading && <div style={{ padding: 20, color: 'var(--muted)', fontSize: 13 }}>{t('Hämtar dina videos från TikTok…')}</div>}

      {isError && (
        <div style={{ padding: '14px 16px', borderRadius: 14, background: 'rgba(242,197,138,.22)', color: '#7a5518', fontSize: 13, lineHeight: 1.55 }}>
          {(error as any)?.response?.data?.error?.message ?? t('Kunde inte hämta dina videos just nu.')}
        </div>
      )}

      {!isLoading && !isError && videos.length === 0 && (
        <div style={{ padding: '14px 16px', borderRadius: 14, background: 'rgba(183,188,200,.14)', color: 'var(--muted)', fontSize: 13, lineHeight: 1.55 }}>
          {t('Inga videos hittades på ditt TikTok-konto de senaste 90 dagarna. Publicera en video så dyker den upp här.')}
        </div>
      )}

      {videos.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 150px), 1fr))', gap: 12 }}>
          {videos.map((v) => (
            <div
              key={v.videoId}
              style={{
                borderRadius: 16, overflow: 'hidden', minWidth: 0,
                border: v.alreadyTracked ? '1px solid rgba(183,188,200,.4)' : '1px solid rgba(241,168,143,.3)',
                background: '#fff', opacity: v.alreadyTracked ? 0.62 : 1,
                boxShadow: '0 6px 18px rgba(180,120,90,.07)',
              }}
            >
              <div style={{ position: 'relative', aspectRatio: '9 / 16', background: '#0B0F17' }}>
                {v.coverImageUrl
                  ? <img src={v.coverImageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 22 }}>♪</div>}
                <span style={{ position: 'absolute', left: 8, bottom: 8, padding: '3px 9px', borderRadius: 980, background: 'rgba(11,15,23,.72)', color: '#fff', fontSize: 11, fontWeight: 700 }}>
                  👁 {formatNumber(v.views)}
                </span>
              </div>
              <div style={{ padding: '10px 11px 12px', minWidth: 0 }}>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: '#0B0F17', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {v.title || t('Utan text')}
                </div>
                <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{formatDate(v.publishedAt)}</div>
                {v.alreadyTracked ? (
                  <div style={{ marginTop: 8, fontSize: 11.5, fontWeight: 700, color: '#5a606d' }}>
                    {t('Används redan')}{v.trackedFor ? ` · ${v.trackedFor}` : ''}
                  </div>
                ) : (
                  <button
                    type="button"
                    className="btn-apply"
                    style={{ width: '100%', padding: '8px 10px', marginTop: 8, fontSize: 12.5 }}
                    disabled={busy === v.videoId}
                    onClick={() => void attach(v)}
                  >
                    {busy === v.videoId ? t('Kopplar…') : t('Använd denna')}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
