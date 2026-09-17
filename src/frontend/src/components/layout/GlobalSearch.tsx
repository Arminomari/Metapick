import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { t } from '@/lib/i18n';
import { categoryLabel } from '@/lib/utils';

type Hit = { key: string; group: string; title: string; sub?: string; to: string };
type PageLink = { label: string; path: string };

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || '');
const norm = (s: string) => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/**
 * Header search. Pages, campaigns and the people on the other side of the
 * marketplace (brands for a creator, creators for a brand). Data is only
 * fetched once the box is actually used. ⌘K / Ctrl+K focuses it.
 */
export function GlobalSearch({ role, pages }: { role: string; pages: PageLink[] }) {
  const navigate = useNavigate();
  const creator = role === 'Creator';
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const term = norm(q.trim());

  const { data: campaigns, isFetching: loadingCampaigns } = useQuery({
    queryKey: ['global-search-campaigns', role],
    enabled: open,
    staleTime: 60_000,
    queryFn: async () => {
      const res = await api.get(creator ? '/campaigns/browse' : '/campaigns/mine', { params: { page: 1, pageSize: 50 } });
      return (res.data?.data?.data ?? []) as any[];
    },
  });
  const { data: creators, isFetching: loadingCreators } = useQuery({
    queryKey: ['global-search-creators', term],
    enabled: open && !creator && term.length >= 2,
    staleTime: 30_000,
    queryFn: async () => {
      const res = await api.get('/creators/search', { params: { search: q.trim(), page: 1 } });
      return (res.data?.data?.data ?? []) as any[];
    },
  });

  const hits = useMemo<Hit[]>(() => {
    if (!term) return [];
    const out: Hit[] = [];
    pages.filter((p) => norm(p.label).includes(term)).slice(0, 4)
      .forEach((p) => out.push({ key: 'p' + p.path, group: t('Sidor'), title: p.label, to: p.path }));
    const list = campaigns ?? [];
    list.filter((c) => norm(`${c.name} ${c.brandName ?? ''} ${c.category ?? ''}`).includes(term)).slice(0, 6)
      .forEach((c) => out.push({
        key: 'c' + c.id, group: t('Kampanjer'), title: c.name,
        sub: [c.brandName, categoryLabel(c.category)].filter(Boolean).join(' · '),
        to: creator ? `/creator/browse?q=${encodeURIComponent(c.name)}` : `/brand/campaigns/${c.id}`,
      }));
    if (creator) {
      const seen = new Set<string>();
      list.filter((c) => c.brandProfileId && norm(c.brandName ?? '').includes(term))
        .forEach((c) => {
          if (seen.has(c.brandProfileId) || seen.size >= 4) return;
          seen.add(c.brandProfileId);
          out.push({ key: 'b' + c.brandProfileId, group: t('Varumärken'), title: c.brandName, to: `/creator/brands/${c.brandProfileId}` });
        });
    } else {
      (creators ?? []).slice(0, 6).forEach((c) => out.push({
        key: 'k' + c.id, group: t('Creators'), title: c.displayName, sub: categoryLabel(c.category), to: `/brand/creators/${c.id}`,
      }));
    }
    return out;
  }, [term, pages, campaigns, creators, creator]);

  useEffect(() => { setActive(0); }, [term]);

  // ⌘K / Ctrl+K from anywhere.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); inputRef.current?.focus(); inputRef.current?.select(); setOpen(true); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Click outside closes.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const go = (h: Hit) => { setOpen(false); setQ(''); inputRef.current?.blur(); navigate(h.to); };
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((i) => Math.min(i + 1, Math.max(hits.length - 1, 0))); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((i) => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter') { if (hits[active]) { e.preventDefault(); go(hits[active]); } }
    else if (e.key === 'Escape') { setOpen(false); inputRef.current?.blur(); }
  };

  const loading = loadingCampaigns || loadingCreators;
  const showPanel = open && term.length > 0;
  let lastGroup = '';

  return (
    <div className="search" ref={boxRef} style={{ position: 'relative' }} role="search">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
      <input
        ref={inputRef}
        type="search"
        value={q}
        onChange={(e) => { setQ(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        placeholder={creator ? t('Sök kampanjer, varumärken, sidor…') : t('Sök kampanjer, creators, sidor…')}
        aria-label={t('Sök')}
        aria-expanded={showPanel}
        aria-controls="global-search-results"
        autoComplete="off"
      />
      <span className="kbd" aria-hidden="true">{isMac ? '⌘ K' : 'Ctrl K'}</span>

      {showPanel && (
        <div id="global-search-results" role="listbox" style={{ position: 'absolute', top: 'calc(100% + 8px)', left: 0, right: 0, zIndex: 60, background: '#fff', border: '1px solid rgba(241,168,143,.3)', borderRadius: 16, boxShadow: '0 18px 50px rgba(11,15,23,.16)', padding: 8, maxHeight: 420, overflowY: 'auto' }}>
          {hits.length === 0 && (
            <div style={{ padding: '14px 12px', fontSize: 13, color: 'var(--muted)' }}>{loading ? t('Söker…') : `${t('Inga träffar för')} "${q.trim()}"`}</div>
          )}
          {hits.map((h, i) => {
            const head = h.group !== lastGroup ? h.group : null;
            lastGroup = h.group;
            return (
              <div key={h.key}>
                {head && <div style={{ padding: '8px 12px 4px', fontSize: 11, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--muted)' }}>{head}</div>}
                <button
                  type="button" role="option" aria-selected={i === active}
                  onMouseEnter={() => setActive(i)} onClick={() => go(h)}
                  style={{ display: 'block', width: '100%', textAlign: 'left', border: 'none', cursor: 'pointer', fontFamily: 'inherit', padding: '9px 12px', borderRadius: 11, background: i === active ? 'rgba(241,168,143,.16)' : 'transparent' }}
                >
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{h.title}</div>
                  {h.sub && <div style={{ fontSize: 12, color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{h.sub}</div>}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
