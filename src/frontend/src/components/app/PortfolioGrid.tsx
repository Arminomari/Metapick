/**
 * Portfolio grid: 2 columns on a phone, 3 from 720px. A card shows engagement
 * only when the server matched the video to one of the creator's own verified
 * campaign videos; a brand line says whether the collaboration is verified.
 */
import { t } from '@/lib/i18n';
import { formatNumber } from '@/lib/utils';
import type { PortfolioItem } from '@/types';
import { TikTokEmbed } from '@/components/ui/TikTokEmbed';
import { ago } from '@/components/app/common';

export function PortfolioGrid({ items, menu }: { items: PortfolioItem[]; menu?: (it: PortfolioItem) => React.ReactNode }) {
  return (
    <div className="ds-media-grid">
      {items.map((it) => (
        <div key={it.id} className="ds-media-card">
          {it.mediaType === 'TikTok' ? (
            <div className="ds-embed"><TikTokEmbed videoUrl={it.mediaUrl} compact /></div>
          ) : (
            <a href={it.mediaUrl} target="_blank" rel="noopener noreferrer" className="ds-media" aria-label={it.title}>
              {(it.thumbnailUrl || it.mediaType === 'Image') ? <img src={it.thumbnailUrl || it.mediaUrl} alt="" loading="lazy" /> : <span className="ds-caption" style={{ padding: 12, textAlign: 'center' }}>{it.title}</span>}
              {it.isFeatured && <span className="ds-media-tag">{t('Utvald')}</span>}
              <span className="ds-media-overlay"><strong>{it.title}</strong>{it.description && <span>{it.description}</span>}</span>
            </a>
          )}
          <div className="ds-row" style={{ marginTop: 2, alignItems: 'flex-start' }}>
            <div className="ds-grow" style={{ minWidth: 0 }}>
              <div className="ds-caption" style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.title}</div>
              {it.brandName && <div className="ds-caption ds-muted">{it.brandName} · {it.brandVerified ? t('verifierat samarbete') : t('ej verifierat')}</div>}
              {it.verifiedViews != null && (
                <div className="ds-caption ds-num" title={`${t('Verifierad via TikTok')}${it.metricsUpdatedAt ? ` · ${t('uppdaterad')} ${ago(it.metricsUpdatedAt)}` : ''}`}>
                  {formatNumber(it.verifiedViews)} {t('views')}{it.verifiedLikes != null ? ` · ${formatNumber(it.verifiedLikes)} ${t('gilla')}` : ''} <span className="ds-muted">· TikTok</span>
                </div>
              )}
            </div>
            {menu?.(it)}
          </div>
        </div>
      ))}
    </div>
  );
}
