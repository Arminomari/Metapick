import { t } from '@/lib/i18n';

function extractVideoId(url: string): string {
  const match = url.match(/\/video\/(\d+)/);
  return match?.[1] ?? '';
}

/**
 * Plays a TikTok video inline via TikTok's official player iframe
 * (player/v1) — no redirect to tiktok.com and no embed.js script needed.
 * Falls back to a link card only when no video id can be resolved
 * (e.g. an unexpanded vm.tiktok.com short link with no id supplied).
 */
export function TikTokEmbed({ videoUrl, videoId, compact }: { videoUrl: string; videoId?: string; compact?: boolean }) {
  const id = videoId || extractVideoId(videoUrl);

  if (!id) {
    return (
      <a
        href={videoUrl}
        target="_blank"
        rel="noopener noreferrer"
        style={{
          display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px',
          borderRadius: 15, border: '1px solid rgba(241,168,143,.28)', minWidth: 0, maxWidth: '100%',
          background: 'linear-gradient(160deg,#fff,#FFF6F0)', textDecoration: 'none',
        }}
      >
        <span style={{ width: 40, height: 40, flex: '0 0 40px', borderRadius: '50%', background: '#0B0F17', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17 }} aria-hidden>♪</span>
        <span style={{ minWidth: 0, flex: 1 }}>
          <span style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#0B0F17', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{videoUrl}</span>
          <span style={{ display: 'block', fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>{t('Öppna på TikTok')} ↗</span>
        </span>
      </a>
    );
  }

  const maxWidth = compact ? 325 : 380;

  return (
    <div
      style={{
        width: '100%', maxWidth, minWidth: 0, aspectRatio: '9 / 16',
        borderRadius: 16, overflow: 'hidden', background: '#0B0F17',
        boxShadow: '0 10px 28px rgba(11,15,23,.18)',
      }}
    >
      <iframe
        src={`https://www.tiktok.com/player/v1/${id}?controls=1&rel=0&description=0&native_context_menu=0`}
        title="TikTok"
        loading="lazy"
        allow="fullscreen; autoplay; encrypted-media; picture-in-picture"
        allowFullScreen
        style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
      />
    </div>
  );
}
