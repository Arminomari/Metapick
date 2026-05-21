import { useState } from 'react';
import { Button, Card, EmptyState, LoadingSpinner } from '@/components/ui';
import { TikTokEmbed } from '@/components/ui/TikTokEmbed';
import { usePortfolio, useAddPortfolioItem, useUpdatePortfolioItem, useDeletePortfolioItem } from '@/hooks/api';
import { formatNumber } from '@/lib/utils';
import type { PortfolioItem, PortfolioMediaType } from '@/types';

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
    <div className="space-y-6">
      <header className="grid grid-cols-12 gap-x-6 items-end">
        <div className="col-span-12 md:col-span-8">
          <p className="eyebrow">Creator studio · Portfölj</p>
          <h1 className="mt-3 text-display text-[clamp(2rem,4.5vw,3.25rem)]">
            Visa upp ditt <span className="text-sunset">bästa</span>.
          </h1>
        </div>
        <div className="col-span-12 md:col-span-4 md:text-right">
          <p className="text-sm text-muted-foreground col-prose md:ml-auto">
            Företag ser din portfölj när du ansöker eller söks upp. Lägg till dina starkaste samarbeten.
          </p>
        </div>
      </header>
      <div className="hairline" />

      {!showForm && (
        <Button onClick={() => { reset(); setShowForm(true); }}>+ Lägg till arbete</Button>
      )}

      {showForm && (
        <Card>
          <h2 className="font-semibold mb-4">{editingId ? 'Redigera arbete' : 'Nytt arbete'}</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Titel *</label>
              <input type="text" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" placeholder="t.ex. Sommarkampanj för X" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Typ av media</label>
                <select value={form.mediaType} onChange={(e) => setForm({ ...form, mediaType: e.target.value as PortfolioMediaType })}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                  {MEDIA_TYPES.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Kategori</label>
                <input type="text" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" placeholder="t.ex. Mat, Mode" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Media-URL *</label>
              <input type="url" value={form.mediaUrl} onChange={(e) => setForm({ ...form, mediaUrl: e.target.value })} required
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" placeholder="https://www.tiktok.com/@.../video/…" />
            </div>
            {(form.mediaType === 'Image' || form.mediaType === 'Video' || form.mediaType === 'Link') && (
              <div>
                <label className="block text-sm font-medium mb-1">Miniatyrbild-URL (valfritt)</label>
                <input type="url" value={form.thumbnailUrl} onChange={(e) => setForm({ ...form, thumbnailUrl: e.target.value })}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" placeholder="https://…" />
              </div>
            )}
            <div>
              <label className="block text-sm font-medium mb-1">Beskrivning</label>
              <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" placeholder="Vad gjorde du? Vilket resultat?" />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Varumärke</label>
                <input type="text" value={form.brandName} onChange={(e) => setForm({ ...form, brandName: e.target.value })}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" placeholder="t.ex. Café X" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Views</label>
                <input type="text" inputMode="numeric" value={form.views}
                  onChange={(e) => setForm({ ...form, views: e.target.value.replace(/\D/g, '') })}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" placeholder="t.ex. 25000" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Likes</label>
                <input type="text" inputMode="numeric" value={form.likes}
                  onChange={(e) => setForm({ ...form, likes: e.target.value.replace(/\D/g, '') })}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" placeholder="t.ex. 1200" />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.isFeatured} onChange={(e) => setForm({ ...form, isFeatured: e.target.checked })} />
              Markera som utvald (visas först)
            </label>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <div className="flex gap-3">
              <Button type="submit" disabled={add.isPending || update.isPending}>
                {add.isPending || update.isPending ? 'Sparar…' : editingId ? 'Spara ändringar' : 'Lägg till'}
              </Button>
              <Button type="button" variant="secondary" onClick={reset}>Avbryt</Button>
            </div>
          </form>
        </Card>
      )}

      {isLoading ? <LoadingSpinner /> : items && items.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {items.map((it) => (
            <Card key={it.id} className="flex flex-col">
              <div className="flex items-start justify-between gap-2 mb-2">
                <h3 className="font-bold leading-tight">{it.title}</h3>
                {it.isFeatured && <span className="sticker sticker-hot !py-0.5 !px-2 !text-[0.7rem]">Utvald</span>}
              </div>
              {(it.mediaType === 'TikTok') ? (
                <TikTokEmbed videoUrl={it.mediaUrl} compact />
              ) : it.thumbnailUrl || it.mediaType === 'Image' ? (
                <a href={it.mediaUrl} target="_blank" rel="noopener noreferrer">
                  <img src={it.thumbnailUrl || it.mediaUrl} alt={it.title}
                    className="w-full h-40 object-cover rounded-lg border border-border" />
                </a>
              ) : (
                <a href={it.mediaUrl} target="_blank" rel="noopener noreferrer"
                  className="text-sm text-primary hover:underline break-all">{it.mediaUrl}</a>
              )}
              {it.description && <p className="text-sm text-muted-foreground mt-3 line-clamp-3">{it.description}</p>}
              <div className="flex flex-wrap gap-1.5 mt-3 text-xs">
                {it.category && <span className="chip">{it.category}</span>}
                {it.brandName && <span className="chip">{it.brandName}</span>}
              </div>
              {(it.views != null || it.likes != null) && (
                <div className="flex gap-3 text-xs text-muted-foreground mt-2">
                  {it.views != null && <span>▶ {formatNumber(it.views)} views</span>}
                  {it.likes != null && <span>❤ {formatNumber(it.likes)}</span>}
                </div>
              )}
              <div className="flex gap-2 mt-4 pt-3 border-t border-border">
                <Button size="sm" variant="secondary" onClick={() => startEdit(it)}>Redigera</Button>
                <Button size="sm" variant="ghost" onClick={() => handleDelete(it.id)} disabled={remove.isPending}>Ta bort</Button>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState title="Din portfölj är tom"
          description="Lägg till dina bästa videos och samarbeten så företag kan se vad du kan."
          action={<Button onClick={() => { reset(); setShowForm(true); }}>+ Lägg till ditt första arbete</Button>} />
      )}
    </div>
  );
}
