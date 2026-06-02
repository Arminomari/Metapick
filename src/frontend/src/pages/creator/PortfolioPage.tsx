import { useState } from 'react';
import { TikTokEmbed } from '@/components/ui/TikTokEmbed';
import { usePortfolio, useAddPortfolioItem, useUpdatePortfolioItem, useDeletePortfolioItem } from '@/hooks/api';
import { formatNumber } from '@/lib/utils';
import type { PortfolioItem, PortfolioMediaType } from '@/types';

const GRADS = ['linear-gradient(135deg,#FFD8C7,#F1A88F)', 'linear-gradient(135deg,#cdb8f2,#9c7de0)', 'linear-gradient(135deg,#F2C58A,#e0a04e)', 'linear-gradient(135deg,#a9dcc0,#5fb98a)'];
const grad = (s: string) => GRADS[((s || '').charCodeAt(0) || 0) % GRADS.length];

const MEDIA_TYPES: { value: PortfolioMediaType; label: string }[] = [
  { value: 'TikTok', label: 'TikTok-video' },
  { value: 'Instagram', label: 'Instagram-inlägg' },
  { value: 'Video', label: 'Video (länk)' },
  { value: 'Image', label: 'Bild' },
  { value: 'Link', label: 'Annan länk' },
];

const emptyForm = {
  title: '', description: '', mediaType: 'TikTok' as PortfolioMediaType, mediaUrl: '',
  thumbnailUrl: '', category: '', brandName: '', views: '', likes: '', isFeatured: false,
};

export function CreatorPortfolioPage() {
  const { data: items, isLoading } = usePortfolio();
  const add = useAddPortfolioItem();
  const update = useUpdatePortfolioItem();
  const remove = useDeletePortfolioItem();

  const [form, setForm] = useState({ ...emptyForm });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState('');

  const startEdit = (it: PortfolioItem) => {
    setEditingId(it.id);
    setForm({
      title: it.title, description: it.description ?? '', mediaType: it.mediaType,
      mediaUrl: it.mediaUrl, thumbnailUrl: it.thumbnailUrl ?? '', category: it.category ?? '',
      brandName: it.brandName ?? '', views: it.views?.toString() ?? '', likes: it.likes?.toString() ?? '',
      isFeatured: it.isFeatured,
    });
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const reset = () => { setForm({ ...emptyForm }); setEditingId(null); setShowForm(false); setError(''); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!form.title.trim()) { setError('Titel krävs'); return; }
    try { new URL(form.mediaUrl); } catch { setError('Media-URL måste vara en giltig länk (https://…)'); return; }

    const payload = {
      title: form.title.trim(),
      description: form.description.trim() || undefined,
      mediaType: form.mediaType,
      mediaUrl: form.mediaUrl.trim(),
      thumbnailUrl: form.thumbnailUrl.trim() || undefined,
      category: form.category.trim() || undefined,
      brandName: form.brandName.trim() || undefined,
      views: form.views ? Number(form.views) : undefined,
      likes: form.likes ? Number(form.likes) : undefined,
      isFeatured: form.isFeatured,
    };
    try {
      if (editingId) {
        const existing = items?.find((i) => i.id === editingId);
        await update.mutateAsync({ id: editingId, ...payload, sortOrder: existing?.sortOrder ?? 0 });
      } else {
        await add.mutateAsync(payload);
      }
      reset();
    } catch (err: any) {
      setError(err?.response?.data?.error?.message ?? 'Kunde inte spara');
    }
  };

  const handleDelete = (id: string) => {
    if (confirm('Ta bort detta portföljobjekt?')) remove.mutate(id);
  };

  return (
    <section className="view active reveal" data-view="portfolio">
      <div className="page-head">
        <div>
          <h1 className="page-title">Visa upp ditt <em>bästa</em></h1>
          <p className="page-sub">Företag ser din portfölj när du ansöker eller söks upp. Lägg till dina starkaste samarbeten.</p>
          {!showForm && (
            <button className="btn-apply" style={{ width: 'auto', padding: '11px 20px', marginTop: 16, display: 'inline-flex', alignItems: 'center', gap: 8 }} onClick={() => { reset(); setShowForm(true); }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14" /></svg> Lägg till arbete
            </button>
          )}
        </div>
      </div>

      {showForm && (
        <div className="card" style={{ marginBottom: 16, maxWidth: 860 }}>
          <div className="sec-head"><h3>{editingId ? 'Redigera arbete' : 'Nytt arbete'}</h3></div>
          <form onSubmit={handleSubmit} className="form-grid">
            <div className="field full"><label>Titel *</label><input type="text" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required placeholder="t.ex. Sommarkampanj för X" /></div>
            <div className="field"><label>Typ av media</label><select value={form.mediaType} onChange={(e) => setForm({ ...form, mediaType: e.target.value as PortfolioMediaType })}>{MEDIA_TYPES.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}</select></div>
            <div className="field"><label>Kategori</label><input type="text" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="t.ex. Mat, Mode" /></div>
            <div className="field full"><label>Media-URL *</label><input type="url" value={form.mediaUrl} onChange={(e) => setForm({ ...form, mediaUrl: e.target.value })} required placeholder="https://www.tiktok.com/@.../video/…" /></div>
            {(form.mediaType === 'Image' || form.mediaType === 'Video' || form.mediaType === 'Link') && (
              <div className="field full"><label>Miniatyrbild-URL (valfritt)</label><input type="url" value={form.thumbnailUrl} onChange={(e) => setForm({ ...form, thumbnailUrl: e.target.value })} placeholder="https://…" /></div>
            )}
            <div className="field full"><label>Beskrivning</label><textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} placeholder="Vad gjorde du? Vilket resultat?" /></div>
            <div className="field"><label>Varumärke</label><input type="text" value={form.brandName} onChange={(e) => setForm({ ...form, brandName: e.target.value })} placeholder="t.ex. Café X" /></div>
            <div className="field"><label>Views</label><input type="text" inputMode="numeric" value={form.views} onChange={(e) => setForm({ ...form, views: e.target.value.replace(/\D/g, '') })} placeholder="t.ex. 25000" /></div>
            <div className="field"><label>Likes</label><input type="text" inputMode="numeric" value={form.likes} onChange={(e) => setForm({ ...form, likes: e.target.value.replace(/\D/g, '') })} placeholder="t.ex. 1200" /></div>
            <div className="field full checkrow" style={{ flexDirection: 'row', justifyContent: 'flex-start' }}><input type="checkbox" checked={form.isFeatured} onChange={(e) => setForm({ ...form, isFeatured: e.target.checked })} /> Markera som utvald (visas först)</div>
            <div className="field full">
              {error && <p style={{ color: 'var(--red)', fontSize: 13, marginBottom: 8 }}>{error}</p>}
              <div style={{ display: 'flex', gap: 10 }}>
                <button type="submit" className="btn-apply" style={{ width: 'auto', padding: '12px 22px' }} disabled={add.isPending || update.isPending}>{add.isPending || update.isPending ? 'Sparar…' : editingId ? 'Spara ändringar' : 'Lägg till'}</button>
                <button type="button" className="btn-outline" onClick={reset}>Avbryt</button>
              </div>
            </div>
          </form>
        </div>
      )}

      {isLoading ? <div style={{ padding: 60, textAlign: 'center', color: 'var(--muted)' }}>Laddar…</div> : items && items.length > 0 ? (
        <div className="grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: 16 }}>
          {items.map((it) => (
            <div className="pf-card" key={it.id}>
              {(it.mediaType === 'TikTok') ? (
                <div className="pf-img" style={{ height: 'auto', background: 'transparent' }}><TikTokEmbed videoUrl={it.mediaUrl} compact /></div>
              ) : it.thumbnailUrl || it.mediaType === 'Image' ? (
                <a href={it.mediaUrl} target="_blank" rel="noopener noreferrer" className="pf-img" style={{ display: 'block', backgroundImage: `url(${it.thumbnailUrl || it.mediaUrl})` }}>
                  {it.isFeatured && <div className="pf-flag">Utvald</div>}
                </a>
              ) : (
                <div className="pf-img" style={{ background: grad(it.title), display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
                  {it.isFeatured && <div className="pf-flag">Utvald</div>}
                  <a href={it.mediaUrl} target="_blank" rel="noopener noreferrer" style={{ color: '#fff', fontWeight: 700, textAlign: 'center', wordBreak: 'break-all', fontSize: 13 }}>{it.title}</a>
                </div>
              )}
              <div className="pf-body">
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                  <div className="t">{it.title}</div>
                  {it.isFeatured && it.mediaType === 'TikTok' && <span className="badge green">Utvald</span>}
                </div>
                <div className="s">{[it.category, it.brandName].filter(Boolean).join(' · ')}</div>
                {it.description && <p style={{ fontSize: 13, color: 'var(--muted)', marginTop: 8, lineHeight: 1.5 }}>{it.description}</p>}
                {(it.views != null || it.likes != null) && (
                  <div className="pf-stats">
                    {it.views != null && <span><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><circle cx="12" cy="12" r="9" /><path d="m10 9 5 3-5 3z" fill="currentColor" stroke="none" /></svg>{formatNumber(it.views)}</span>}
                    {it.likes != null && <span><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M12 20s-7-4.3-7-9a4 4 0 0 1 7-2.5A4 4 0 0 1 19 11c0 4.7-7 9-7 9z" /></svg>{formatNumber(it.likes)}</span>}
                  </div>
                )}
                <div className="pf-actions">
                  <button className="btn-outline" style={{ flex: 1, padding: 10 }} onClick={() => startEdit(it)}>Redigera</button>
                  <button className="btn-outline" style={{ flex: 1, padding: 10 }} onClick={() => handleDelete(it.id)} disabled={remove.isPending}>Ta bort</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="card" style={{ textAlign: 'center', padding: '54px 24px' }}>
          <div style={{ fontSize: 18, fontWeight: 700 }}>Din portfölj är tom</div>
          <div style={{ color: 'var(--muted)', fontSize: 14, marginTop: 8 }}>Lägg till dina bästa videos och samarbeten så företag kan se vad du kan.</div>
          <button className="btn-apply" style={{ width: 'auto', display: 'inline-block', padding: '11px 22px', marginTop: 16 }} onClick={() => { reset(); setShowForm(true); }}>Lägg till ditt första arbete</button>
        </div>
      )}
    </section>
  );
}
