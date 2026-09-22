/**
 * Platform pill for creator rows: icon, label and a caption. The TikTok caption
 * carries verified numbers; the Instagram chip is the creator's opt-in tag and
 * says "ej verifierad" because nothing on Instagram is synced.
 */
export function PlatformChip({ kind, label, caption }: { kind: 'tiktok' | 'instagram'; label: string; caption?: string }) {
  return (
    <span className={`ds-platchip ds-platchip--${kind}`}>
      <span className="ds-platchip-ic" aria-hidden>
        {kind === 'tiktok'
          ? <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M16.5 5.5c.9 1 2.1 1.6 3.5 1.7v2.6c-1.3 0-2.6-.4-3.6-1.1v6c0 3-2.4 5.4-5.4 5.4S5.6 17.7 5.6 14.7s2.4-5.4 5.4-5.4c.3 0 .6 0 .9.1v2.8c-.3-.1-.6-.2-.9-.2-1.5 0-2.7 1.2-2.7 2.7s1.2 2.7 2.7 2.7 2.7-1.2 2.7-2.7V2.5h2.8c0 1.1.2 2.1.5 3z" /></svg>
          : <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.5" cy="6.5" r="1.2" fill="currentColor" stroke="none" /></svg>}
      </span>
      <span className="ds-platchip-text"><b>{label}</b>{caption && <span>{caption}</span>}</span>
    </span>
  );
}
