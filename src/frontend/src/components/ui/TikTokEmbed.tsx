import { useEffect, useRef } from 'react';

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
      <a href={videoUrl} target="_blank" rel="noopener noreferrer"
        className="flex items-center gap-3 rounded-lg border border-border bg-muted/30 p-3 hover:bg-muted/50 transition-colors">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-black text-white text-lg">♪</div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-primary truncate">{videoUrl}</p>
          <p className="text-xs text-muted-foreground">Öppna på TikTok</p>
        </div>
      </a>
    );
  }

  const maxWidth = compact ? '325px' : '605px';

  return (
    <div ref={ref} className={compact ? 'w-[325px] max-w-full' : undefined}>
      <blockquote
        className="tiktok-embed"
        cite={videoUrl}
        data-video-id={extractVideoId(videoUrl)}
        style={{ maxWidth, minWidth: '325px' }}
      >
        <section>
          <a href={videoUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline text-sm">
            Laddar video...
          </a>
        </section>
      </blockquote>
    </div>
  );
}
