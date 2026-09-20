/**
 * Profil tab for creators: the public profile as brands see it, the
 * portfolio, and the menu to everything else about me.
 */
import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Award, BarChart3, Bookmark, Link2, LogOut, Settings, Wallet } from 'lucide-react';
import { t } from '@/lib/i18n';
import { formatNumber, categoryLabel, countryName } from '@/lib/utils';
import { FEATURES } from '@/lib/features';
import { CATEGORIES } from '@/lib/categories';
import { ALL_TAGS } from '@/lib/tags';
import { useAuthStore } from '@/stores/authStore';
import { useCreatorProfile, useUpdateCreatorProfile, useUserReviews, usePortfolio, useAddPortfolioItem, useUpdatePortfolioItem, useDeletePortfolioItem, useCreatorAssignments, useCreatorPayouts, useTikTokStatus } from '@/hooks/api';
import { usePayables } from '@/hooks/extra';
import { useToast } from '@/components/vyrle/Toast';
import { TikTokEmbed } from '@/components/ui/TikTokEmbed';
import { ImagePicker } from '@/components/auth/ImagePicker';
import { DateInput } from '@/components/ui/DateInput';
import type { PortfolioItem, PortfolioMediaType } from '@/types';
import { Avatar, Badge, BottomSheet, Button, Card, Checkbox, Field, List, ListRow, Page, PageHead, Section, SkeletonList, StatRow, StatTile } from '@/components/ds';
import { MoreMenu, NotifBell, apiMessage } from '@/components/app/common';
import { ReviewList } from '@/components/app/Reviews';
import { money } from '@/lib/utils';

export const TIERS = [{ name: 'Rising', min: 0 }, { name: 'Established', min: 5000 }, { name: 'Pro', min: 25000 }, { name: 'Elite', min: 100000 }, { name: 'Icon', min: 500000 }];
/** Lifetime paid-out amount. Payout requests are "Completed" when paid; the old page looked for "Paid" and always read 0. */
export function useLevel() {
  const { data: pay } = useCreatorPayouts(undefined, 1);
  const paid = (pay?.data ?? []).filter((p) => p.status === 'Completed' || p.status === 'Paid').reduce((s, p) => s + p.amount, 0);
  let idx = 0; for (let i = 0; i < TIERS.length; i++) if (paid >= TIERS[i].min) idx = i;
  return { paid, idx, tier: TIERS[idx], next: TIERS[idx + 1] };
}

const MEDIA: { value: PortfolioMediaType; label: string }[] = [{ value: 'TikTok', label: t('TikTok-video') }, { value: 'Instagram', label: t('Instagram-inlägg') }, { value: 'Video', label: t('Video (länk)') }, { value: 'Image', label: t('Bild') }, { value: 'Link', label: t('Annan länk') }];
const emptyItem = { title: '', description: '', mediaType: 'TikTok' as PortfolioMediaType, mediaUrl: '', thumbnailUrl: '', category: '', brandName: '', isFeatured: false };

export function CreatorProfileScreen() {
  const navigate = useNavigate();
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const { logout } = useAuthStore();
  const { data: p, isLoading } = useCreatorProfile();
  const { data: items = [] } = usePortfolio();
  const { data: reviews } = useUserReviews(p?.userId ?? '');
  const { data: asg } = useCreatorAssignments(undefined, 1, 100);
  const { data: payables = [] } = usePayables();
  const add = useAddPortfolioItem();
  const update = useUpdatePortfolioItem();
  const remove = useDeletePortfolioItem();
  const level = useLevel();
  const [editing, setEditing] = useState<null | { id?: string; form: typeof emptyItem }>(null);
  const [error, setError] = useState('');
  useEffect(() => { if (params.get('add') === '1') { setEditing({ form: { ...emptyItem } }); const n = new URLSearchParams(params); n.delete('add'); setParams(n, { replace: true }); } /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [params.get('add')]);
  if (isLoading || !p) return <Page><PageHead title={t('Profil')} /><SkeletonList rows={3} /></Page>;

  const views = (asg?.data ?? []).reduce((s, a) => s + a.totalVerifiedViews, 0);
  const available = payables.reduce((s, x) => s + x.available, 0);
  const saveItem = async () => {
    if (!editing) return; setError('');
    const f = editing.form;
    if (!f.title.trim()) { setError(t('Titel krävs')); return; }
    try { new URL(f.mediaUrl); } catch { setError(t('Media-URL måste vara en giltig länk (https://…)')); return; }
    const payload = { title: f.title.trim(), description: f.description.trim() || undefined, mediaType: f.mediaType, mediaUrl: f.mediaUrl.trim(), thumbnailUrl: f.thumbnailUrl.trim() || undefined, category: f.category.trim() || undefined, brandName: f.brandName.trim() || undefined, isFeatured: f.isFeatured };
    try {
      if (editing.id) await update.mutateAsync({ id: editing.id, ...payload, sortOrder: items.find((i) => i.id === editing.id)?.sortOrder ?? 0 }); else await add.mutateAsync(payload);
      setEditing(null); toast.push(t('Sparat'), 'success');
    } catch (e) { setError(apiMessage(e, t('Kunde inte spara'))); }
  };
  const startEdit = (it: PortfolioItem) => setEditing({ id: it.id, form: { title: it.title, description: it.description ?? '', mediaType: it.mediaType, mediaUrl: it.mediaUrl, thumbnailUrl: it.thumbnailUrl ?? '', category: it.category ?? '', brandName: it.brandName ?? '', isFeatured: it.isFeatured } });

  return (
    <Page>
      <PageHead title={t('Profil')} actions={<NotifBell />} />
      <Card>
        <div className="ds-row" style={{ alignItems: 'flex-start', gap: 14 }}>
          <Avatar name={p.displayName} src={p.avatarUrl} size="xl" />
          <div className="ds-grow">
            <div className="ds-heading">{p.displayName}</div>
            <div className="ds-caption ds-muted">{p.tikTokUsername ? `@${p.tikTokUsername} · ` : ''}{categoryLabel(p.category)} · {countryName(p.country)}</div>
            <div className="ds-row ds-row--wrap" style={{ marginTop: 6 }}><Badge tone="accent">{level.tier.name}</Badge>{p.status !== 'Approved' && <Badge tone="warn">{t('Konto')}: {p.status}</Badge>}</div>
          </div>
        </div>
        {p.bio && <p className="ds-body" style={{ marginTop: 12 }}>{p.bio}</p>}
        {p.profileTags.length > 0 && <div className="ds-tags" style={{ marginTop: 10 }}>{p.profileTags.map((tg) => <span key={tg} className="ds-tag">{tg}</span>)}</div>}
        <div style={{ marginTop: 14 }}>
          <StatRow cols={3}>
            <StatTile plain label={t('Följare')} value={formatNumber(p.followerCount)} />
            <StatTile plain label={t('Verifierade views')} value={formatNumber(views)} />
            <StatTile plain label={t('Omdöme')} value={reviews && reviews.totalReviews > 0 ? reviews.averageStars.toFixed(1) : '–'} hint={reviews && reviews.totalReviews > 0 ? `${reviews.totalReviews} ${t('omdömen')}` : undefined} />
          </StatRow>
        </div>
        <div className="ds-row" style={{ marginTop: 14 }}>
          <Button variant="secondary" full onClick={() => navigate('/creator/profile/edit')}>{t('Redigera profil')}</Button>
          {p.tikTokUsername && <Button variant="secondary" size="sm" onClick={() => window.open(`https://www.tiktok.com/@${p.tikTokUsername}`, '_blank', 'noopener')}>TikTok</Button>}
          {p.instagramUsername && <Button variant="secondary" size="sm" onClick={() => window.open(`https://www.instagram.com/${p.instagramUsername}`, '_blank', 'noopener')}>Instagram</Button>}
        </div>
      </Card>

      <Section title={t('Portfolio')} action={<Button variant="ghost" size="sm" onClick={() => setEditing({ form: { ...emptyItem } })}>{t('Lägg till')}</Button>}>
        {items.length === 0 ? <Card><p className="ds-body ds-muted">{t('Lägg till dina bästa videor och samarbeten så företag kan se vad du kan.')}</p></Card> : (
          <div className="ds-media-grid">
            {items.map((it) => (
              <div key={it.id} style={{ position: 'relative' }}>
                {it.mediaType === 'TikTok' ? <div className="ds-embed"><TikTokEmbed videoUrl={it.mediaUrl} compact /></div>
                  : <a href={it.mediaUrl} target="_blank" rel="noopener noreferrer" className="ds-media">{(it.thumbnailUrl || it.mediaType === 'Image') ? <img src={it.thumbnailUrl || it.mediaUrl} alt="" /> : <span className="ds-caption" style={{ padding: 12, textAlign: 'center' }}>{it.title}</span>}{it.isFeatured && <span className="ds-media-tag">{t('Utvald')}</span>}</a>}
                <div className="ds-row" style={{ marginTop: 2 }}>
                  <div className="ds-grow"><div className="ds-caption" style={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.title}</div>{it.brandName && <div className="ds-caption ds-muted">{it.brandName}</div>}</div>
                  <MoreMenu title={it.title} items={[{ label: t('Redigera'), onClick: () => startEdit(it) }, { label: t('Ta bort'), danger: true, onClick: () => remove.mutate(it.id, { onSuccess: () => toast.push(t('Borttaget ur portföljen'), 'success'), onError: () => toast.push(t('Kunde inte ta bort'), 'error') }) }]} />
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>

      {reviews && reviews.totalReviews > 0 && <Section title={t('Omdömen')}><Card><ReviewList summary={reviews} /></Card></Section>}

      <List>
        <ListRow leading={<Wallet />} title={t('Intäkter')} subtitle={available > 0 ? `${money(available)} ${t('att hämta ut')}` : t('Utbetalningar, metod och verifiering')} badge={available > 0 ? <Badge tone="accent">{t('Redo')}</Badge> : undefined} to="/creator/earnings" />
        <ListRow leading={<BarChart3 />} title={t('Statistik')} to="/creator/analytics" />
        <ListRow leading={<Award />} title={t('Creator-nivå')} subtitle={level.next ? `${money(level.paid)} ${t('av')} ${money(level.next.min)} ${t('till')} ${level.next.name}` : t('Högsta nivån nådd')} to="/creator/levels" />
        <ListRow leading={<Bookmark />} title={t('Sparat')} to="/creator/saved" />
        {FEATURES.linkTree && <ListRow leading={<Link2 />} title={t('Länkar')} to="/creator/links" />}
        <ListRow leading={<Settings />} title={t('Inställningar')} to="/creator/settings" />
        <ListRow leading={<LogOut />} title={t('Logga ut')} chevron={false} onClick={() => { logout(); navigate('/login'); }} />
      </List>

      <BottomSheet open={!!editing} onClose={() => setEditing(null)} title={editing?.id ? t('Redigera arbete') : t('Nytt arbete')} footer={<><Button variant="secondary" onClick={() => setEditing(null)}>{t('Avbryt')}</Button><Button loading={add.isPending || update.isPending} onClick={() => void saveItem()}>{t('Spara')}</Button></>}>
        {editing && (
          <>
            <Field label={t('Titel')} error={error}><input value={editing.form.title} onChange={(e) => setEditing({ ...editing, form: { ...editing.form, title: e.target.value } })} placeholder={t('t.ex. Sommarkampanj för X')} /></Field>
            <Field label={t('Typ av media')}><select value={editing.form.mediaType} onChange={(e) => setEditing({ ...editing, form: { ...editing.form, mediaType: e.target.value as PortfolioMediaType } })}>{MEDIA.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}</select></Field>
            <Field label={t('Media-URL')}><input type="url" value={editing.form.mediaUrl} onChange={(e) => setEditing({ ...editing, form: { ...editing.form, mediaUrl: e.target.value } })} placeholder="https://www.tiktok.com/@…/video/…" /></Field>
            {['Image', 'Video', 'Link'].includes(editing.form.mediaType) && <Field label={t('Miniatyrbild-URL (valfritt)')}><input type="url" value={editing.form.thumbnailUrl} onChange={(e) => setEditing({ ...editing, form: { ...editing.form, thumbnailUrl: e.target.value } })} /></Field>}
            <Field label={t('Beskrivning')}><textarea rows={2} value={editing.form.description} onChange={(e) => setEditing({ ...editing, form: { ...editing.form, description: e.target.value } })} placeholder={t('Vad gjorde du? Vilket resultat?')} /></Field>
            <div className="ds-kv">
              <Field label={t('Kategori')}><input value={editing.form.category} onChange={(e) => setEditing({ ...editing, form: { ...editing.form, category: e.target.value } })} /></Field>
              <Field label={t('Varumärke')}><input value={editing.form.brandName} onChange={(e) => setEditing({ ...editing, form: { ...editing.form, brandName: e.target.value } })} /></Field>
            </div>
            <Checkbox label={t('Markera som utvald (visas först)')} checked={editing.form.isFeatured} onChange={(e) => setEditing({ ...editing, form: { ...editing.form, isFeatured: e.target.checked } })} />
          </>
        )}
      </BottomSheet>
    </Page>
  );
}

export function CreatorProfileEditScreen() {
  const navigate = useNavigate();
  const toast = useToast();
  const { data: p, isLoading } = useCreatorProfile();
  const { data: tiktok } = useTikTokStatus();
  const update = useUpdateCreatorProfile();
  const [form, setForm] = useState<null | { displayName: string; bio: string; category: string; country: string; language: string; tikTokUsername: string; dateOfBirth: string; profileTags: string[]; instagramUsername: string; website: string; avatarUrl: string; openToPrOffers: boolean }>(null);
  useEffect(() => { if (p && !form) setForm({ displayName: p.displayName, bio: p.bio ?? '', category: p.category, country: p.country, language: p.language, tikTokUsername: p.tikTokUsername ?? '', dateOfBirth: '', profileTags: p.profileTags ?? [], instagramUsername: p.instagramUsername ?? '', website: p.website ?? '', avatarUrl: p.avatarUrl ?? '', openToPrOffers: p.openToPrOffers ?? true }); }, [p, form]);
  if (isLoading || !form) return <Page><PageHead title={t('Redigera profil')} back={{ to: '/creator/profile' }} /><SkeletonList rows={3} /></Page>;
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    try { await update.mutateAsync({ displayName: form.displayName, bio: form.bio, category: form.category, country: form.country, language: form.language, tikTokUsername: form.tikTokUsername || undefined, dateOfBirth: form.dateOfBirth || undefined, profileTags: form.profileTags, avatarUrl: form.avatarUrl, instagramUsername: form.instagramUsername || undefined, website: form.website || undefined, openToPrOffers: form.openToPrOffers }); toast.push(t('Profilen sparad'), 'success'); navigate('/creator/profile'); }
    catch (e2) { toast.push(apiMessage(e2, t('Kunde inte spara profilen')), 'error'); }
  };
  const toggleTag = (tg: string) => setForm({ ...form, profileTags: form.profileTags.includes(tg) ? form.profileTags.filter((x) => x !== tg) : form.profileTags.length >= 10 ? form.profileTags : [...form.profileTags, tg] });
  return (
    <Page>
      <PageHead title={t('Redigera profil')} back={{ to: '/creator/profile' }} />
      <form onSubmit={save} className="ds-stack" style={{ gap: 16 }}>
        <Card><ImagePicker label={t('Profilbild')} value={form.avatarUrl || null} onChange={(v) => setForm({ ...form, avatarUrl: v ?? '' })} hint={t('Varumärken ser den när de hittar dig.')} /></Card>
        <Card>
          <div className="ds-stack" style={{ gap: 12 }}>
            <Field label={t('Visningsnamn')}><input required value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} /></Field>
            <Field label={t('Bio')}><textarea rows={3} value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} placeholder={t('Berätta om dig själv och ditt innehåll…')} /></Field>
            <div className="ds-kv">
              <Field label={t('Kategori')}><select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>{CATEGORIES.map((c) => <option key={c} value={c}>{t(c)}</option>)}</select></Field>
              <Field label={t('Land')}><select value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })}><option value="SE">{t('Sverige')}</option><option value="NO">{t('Norge')}</option><option value="DK">{t('Danmark')}</option><option value="FI">{t('Finland')}</option></select></Field>
            </div>
            <Field label={t('Födelsedatum')}><DateInput value={form.dateOfBirth} onChange={(v) => setForm({ ...form, dateOfBirth: v })} className="ds-input" max={new Date(Date.now() - 13 * 365.25 * 86400000).toISOString().slice(0, 10)} /></Field>
          </div>
        </Card>
        <Card title={t('Konton & länkar')}>
          <div className="ds-stack" style={{ gap: 12 }}>
            <Field label={t('TikTok-användarnamn')} hint={tiktok?.connected ? t('Hämtas från ditt kopplade konto.') : undefined}><input value={tiktok?.connected ? '@' + (tiktok.username || '') : form.tikTokUsername} disabled={!!tiktok?.connected} onChange={(e) => setForm({ ...form, tikTokUsername: e.target.value })} placeholder="@dittanvändarnamn" /></Field>
            <Field label={t('Instagram-användarnamn')}><input value={form.instagramUsername} onChange={(e) => setForm({ ...form, instagramUsername: e.target.value })} placeholder="@dittinstagram" /></Field>
            <Field label={t('Webbplats / Linktree')}><input type="url" value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} placeholder="https://…" /></Field>
            <p className="ds-caption ds-muted">{t('Följare och visningar hämtas automatiskt från ditt kopplade TikTok-konto.')}</p>
          </div>
        </Card>
        <Card title={t('Vad är du expert på?')} action={<span className="ds-caption ds-muted">{form.profileTags.length}/10</span>}>
          <div className="ds-tags">{ALL_TAGS.map((tg) => <button key={tg} type="button" className={`ds-tag${form.profileTags.includes(tg) ? ' ds-tag--on' : ''}`} onClick={() => toggleTag(tg)}>{tg}</button>)}</div>
          <div style={{ marginTop: 12 }}><Checkbox label={t('Öppen för direkta PR-erbjudanden från företag')} checked={form.openToPrOffers} onChange={(e) => setForm({ ...form, openToPrOffers: e.target.checked })} /></div>
        </Card>
        <div className="ds-sticky-action"><Button type="submit" full loading={update.isPending}>{t('Spara profil')}</Button></div>
      </form>
    </Page>
  );
}
