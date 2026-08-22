import { useEffect, useRef } from 'react';
import { t } from '@/lib/i18n';

declare global {
  interface Window {
    tiktokEmbedLoaded?: boolean;
  }
}

function loadTikTokScript() {
  if (window.tiktokEmbedLoaded) return;
  window.tiktokEmbedLoaded = true;
  const script = document.createElement('script');
  script.src = 'https://www.tiktok.com/embed.js';
  script.async = true;
  document.body.appendChild(script);
}

function isEmbeddableUrl(url: string): boolean {
  return /tiktok\.com\/@.+\/video\/\d+/.test(url);
}

function extractVideoId(url: string): string {
  const match = url.match(/\/video\/(\d+)/);
  return match?.[1] ?? '';
}

export function TikTokEmbed({ videoUrl, compact }: { videoUrl: string; compact?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isEmbeddableUrl(videoUrl)) return;
    loadTikTokScript();
    const timer = setTimeout(() => {
      if ((window as any).tiktokEmbed?.lib?.render) {
        (window as any).tiktokEmbed.lib.render();
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [videoUrl]);

  // For short URLs (vm.tiktok.com etc), show a link card instead of broken embed
  if (!isEmbeddableUrl(videoUrl)) {
    return (
      <a
        href={videoUrl}
        target="_blank"
        rel="noopener noreferrer"
        style={{
          display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px',
          borderRadius: 15, border: '1px solid rgba(241,168,143,.28)',
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

  const maxWidth = compact ? '325px' : '605px';

  return (
    <div ref={ref} style={{ maxWidth, width: '100%' }}>
      <blockquote
        className="tiktok-embed"
        cite={videoUrl}
        data-video-id={extractVideoId(videoUrl)}
        style={{ maxWidth, minWidth: 'min(325px, 100%)', margin: 0 }}
      >
        {/* Shown until TikTok's script swaps the blockquote for the player */}
        <section>
          <a
            href={videoUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              gap: 10, minHeight: 170, borderRadius: 16, textDecoration: 'none',
              border: '1px dashed rgba(241,168,143,.5)',
              background: 'linear-gradient(160deg,#FFF9F5,#FFF1E8)',
              color: '#9c6b52', fontSize: 12.5, fontWeight: 600,
            }}
          >
            <span style={{ width: 38, height: 38, borderRadius: '50%', background: '#0B0F17', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17 }} aria-hidden>♪</span>
            {t('Laddar video från TikTok…')}
          </a>
        </section>
      </blockquote>
    </div>
  );
}
