/**
 * Profil tab for creators: the public profile as brands see it, the
 * portfolio, and the menu to everything else about me.
 */
import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Award, BarChart3, Bookmark, Link2, LogOut, Settings, Wallet } from 'lucide-react';
import { t, statusLabel } from '@/lib/i18n';
import { formatNumber, categoryLabel, countryName } from '@/lib/utils';
import { FEATURES } from '@/lib/features';
import { CATEGORIES } from '@/lib/categories';
import { ALL_TAGS } from '@/lib/tags';
import { useAuthStore } from '@/stores/authStore';
import { useCreatorProfile, useUpdateCreatorProfile, useUserReviews, usePortfolio, useAddPortfolioItem, useUpdatePortfolioItem, useDeletePortfolioItem, useTikTokStatus, useCreatorAnalytics, useCreatorCollaborations } from '@/hooks/api';
import { SourceNote } from '@/components/app/SourceNote';
import { ProfileHero } from '@/components/app/ProfileHero';
import { ProfileChecklist } from '@/components/app/ProfileChecklist';
import { PortfolioGrid } from '@/components/app/PortfolioGrid';
import { useToast } from '@/components/vyrle/Toast';
import { ImagePicker } from '@/components/auth/ImagePicker';
import { DateInput } from '@/components/ui/DateInput';
import type { PortfolioItem, PortfolioMediaType } from '@/types';
import { Badge, BottomSheet, Button, Card, Checkbox, Field, List, ListRow, Page, PageHead, Section, SkeletonList, StatRow, StatTile, EmptyState } from '@/components/ds';
import { MoreMenu, NotifBell, apiMessage } from '@/components/app/common';
import { ReviewList } from '@/components/app/Reviews';
import { money } from '@/lib/utils';

/** Creator level as the server computed it from money actually paid out; the ladder comes with it. */
export function useLevel() {
  const { data } = useCreatorAnalytics();
  const l = data?.level;
  return {
    paid: l?.totalPaid ?? 0,
    idx: l?.index ?? 0,
    tier: { name: l?.name ?? 'Rising', min: l?.minPaid ?? 0 },
    next: l?.nextName != null ? { name: l.nextName, min: l.nextMinPaid ?? 0 } : undefined,
    tiers: (l?.tiers ?? []).map((x) => ({ name: x.name, min: x.minPaid })),
    progress: l?.progressPercent ?? 0,
    loaded: !!l,
  };
}

const MEDIA: { value: PortfolioMediaType; label: string }[] = [{ value: 'TikTok', label: t('TikTok-video') }, { value: 'Instagram', label: t('Instagram-inlägg') }, { value: 'Video', label: t('Video (länk)') }, { value: 'Image', label: t('Bild') }, { value: 'Link', label: t('Annan länk') }];
const emptyItem = { title: '', description: '', mediaType: 'TikTok' as PortfolioMediaType, mediaUrl: '', thumbnailUrl: '', category: '', brandName: '', isFeatured: false, link: '' };
const linkKey = (kind: string, id: string) => `${kind}:${id}`;

export function CreatorProfileScreen() {
  const navigate = useNavigate();
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const { logout } = useAuthStore();
  const { data: p, isLoading } = useCreatorProfile();
  const { data: items = [] } = usePortfolio();
  const { data: reviews } = useUserReviews(p?.userId ?? '');
  const { data: stats } = useCreatorAnalytics();
  const { data: collabs = [] } = useCreatorCollaborations();
  const add = useAddPortfolioItem();
  const update = useUpdatePortfolioItem();
  const remove = useDeletePortfolioItem();
  const level = useLevel();
  const [editing, setEditing] = useState<null | { id?: string; form: typeof emptyItem }>(null);
  const [error, setError] = useState('');
  useEffect(() => { if (params.get('add') === '1') { setEditing({ form: { ...emptyItem } }); const n = new URLSearchParams(params); n.delete('add'); setParams(n, { replace: true }); } /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [params.get('add')]);
  if (isLoading || !p) return <Page><PageHead title={t('Profil')} /><SkeletonList rows={3} /></Page>;

  const views = stats?.totalVerifiedViews ?? 0;
  const available = stats?.availableToWithdraw ?? 0;
  const saveItem = async () => {
    if (!editing) return; setError('');
    const f = editing.form;
    if (!f.title.trim()) { setError(t('Titel krävs')); return; }
    try { new URL(f.mediaUrl); } catch { setError(t('Media-URL måste vara en giltig länk (https://…)')); return; }
    // A linked collaboration makes the brand verified; only an unlinked item keeps the typed name.
    const [linkKind, linkId] = f.link ? f.link.split(':') : ['', ''];
    const payload = { title: f.title.trim(), description: f.description.trim() || undefined, mediaType: f.mediaType, mediaUrl: f.mediaUrl.trim(), thumbnailUrl: f.thumbnailUrl.trim() || undefined, category: f.category.trim() || undefined, brandName: f.link ? undefined : (f.brandName.trim() || undefined), isFeatured: f.isFeatured, campaignId: linkKind === 'Campaign' || linkKind === 'Tap' ? linkId : null, ugcCollabId: linkKind === 'Ugc' ? linkId : null };
    try {
      if (editing.id) await update.mutateAsync({ id: editing.id, ...payload, sortOrder: items.find((i) => i.id === editing.id)?.sortOrder ?? 0 }); else await add.mutateAsync(payload);
      setEditing(null); toast.push(t('Sparat'), 'success');
    } catch (e) { setError(apiMessage(e, t('Kunde inte spara'))); }
  };
  const startEdit = (it: PortfolioItem) => setEditing({ id: it.id, form: { title: it.title, description: it.description ?? '', mediaType: it.mediaType, mediaUrl: it.mediaUrl, thumbnailUrl: it.thumbnailUrl ?? '', category: it.category ?? '', brandName: it.brandName ?? '', isFeatured: it.isFeatured, link: it.campaignId ? linkKey(collabs.find((c) => c.id === it.campaignId)?.kind ?? 'Campaign', it.campaignId) : it.ugcCollabId ? linkKey('Ugc', it.ugcCollabId) : '' } });

  return (
    <Page>
      <PageHead title={t('Profil')} actions={<NotifBell />} />
      <ProfileHero coverUrl={p.coverUrl} avatarUrl={p.avatarUrl} name={p.displayName}
        meta={<>{p.tikTokUsername ? `@${p.tikTokUsername} · ` : ''}{categoryLabel(p.category)} · {countryName(p.country)}</>}
        badges={<>
          <Badge tone="accent">{level.tier.name}</Badge>
          {stats?.verifiedCreator && <Badge tone="ok">{t('Verifierad kreatör')}</Badge>}
          {stats?.topCreator && <Badge tone="accent">{t('Top creator')}</Badge>}
          {p.status !== 'Approved' && <Badge tone="warn">{t('Konto')}: {statusLabel(p.status)}</Badge>}
        </>}>
        {p.bio && <p className="ds-body" style={{ marginTop: 12 }}>{p.bio}</p>}
        {p.profileTags.length > 0 && <div className="ds-tags" style={{ marginTop: 10 }}>{p.profileTags.map((tg) => <span key={tg} className="ds-tag">{tg}</span>)}</div>}
        <div style={{ marginTop: 14 }}>
          <StatRow cols={3}>
            <StatTile plain label={t('Verifierade views')} count={views} format={formatNumber} />
            <StatTile plain label={t('Intäkt / 1K views')} value={stats?.earningsPerThousandViews != null ? money(stats.earningsPerThousandViews) : '–'} />
            <StatTile plain label={t('Godkänt')} value={stats?.approvalRate != null ? `${Math.round(stats.approvalRate)} %` : '–'} hint={stats?.totalVideos ? `${stats.approvedVideos}/${stats.totalVideos} ${t('videor')}` : undefined} />
          </StatRow>
          <SourceNote source="tiktok" at={stats?.metricsUpdatedAt} scope={t('alla dina kampanjvideos')} />
          <div className="ds-facts" style={{ marginTop: 10 }}>
            <div className="ds-fact"><span>{t('Följare')} · TikTok</span><span className="ds-num">{p.tikTokVerified ? formatNumber(p.followerCount) : t('ej verifierat')}</span></div>
            <div className="ds-fact"><span>{t('Omdöme')}</span><span className="ds-num">{reviews && reviews.totalReviews > 0 ? `${reviews.averageStars.toFixed(1)} · ${reviews.totalReviews} ${t('omdömen')}` : '–'}</span></div>
          </div>
        </div>
        <div className="ds-row ds-row--wrap" style={{ marginTop: 14 }}>
          <Button variant="secondary" full onClick={() => navigate('/creator/profile/edit')}>{t('Redigera profil')}</Button>
          {p.tikTokUsername && <Button variant="secondary" size="sm" onClick={() => window.open(`https://www.tiktok.com/@${p.tikTokUsername}`, '_blank', 'noopener')}>TikTok</Button>}
          {p.instagramUsername && <Button variant="secondary" size="sm" onClick={() => window.open(`https://www.instagram.com/${p.instagramUsername}`, '_blank', 'noopener')}>{`Instagram · ${t('ej verifierad')}`}</Button>}
        </div>
      </ProfileHero>

      {!p.visibleToBrands && (
        <Card>
          <Badge tone="warn">{t('Inte synlig för företag än')}</Badge>
          {p.visibilityBlocker && <p className="ds-caption ds-muted" style={{ marginTop: 8 }}>{p.visibilityBlocker}</p>}
          <div style={{ marginTop: 10 }}><Button size="sm" variant="secondary" to="/creator/onboarding">{t('Kom igång')}</Button></div>
        </Card>
      )}

      <ProfileChecklist items={[
        { key: 'tiktok', label: t('Koppla TikTok'), done: !!p.tikTokVerified, to: '/creator/onboarding' },
        { key: 'avatar', label: t('Lägg till profilbild'), done: !!p.avatarUrl, to: '/creator/profile/edit' },
        { key: 'cover', label: t('Lägg till cover'), done: !!p.coverUrl, to: '/creator/profile/edit' },
        { key: 'bio', label: t('Skriv en bio (minst 20 tecken)'), done: (p.bio ?? '').trim().length >= 20, to: '/creator/profile/edit' },
        { key: 'tags', label: t('Välj minst en expertis-tagg'), done: p.profileTags.length > 0, to: '/creator/profile/edit' },
        { key: 'portfolio', label: t('Lägg till 3 portfolio-verk'), done: items.length >= 3, onClick: () => setEditing({ form: { ...emptyItem } }) },
      ]} />

      <Section title={t('Portfolio')} action={<Button variant="ghost" size="sm" onClick={() => setEditing({ form: { ...emptyItem } })}>{t('Lägg till')}</Button>}>
        {items.length === 0 ? <Card><EmptyState description={t('Lägg till dina bästa videor och samarbeten så företag kan se vad du kan.')} /></Card> : (
          <PortfolioGrid items={items} menu={(it) => <MoreMenu title={it.title} items={[{ label: t('Redigera'), onClick: () => startEdit(it) }, { label: t('Ta bort'), danger: true, onClick: () => remove.mutate(it.id, { onSuccess: () => toast.push(t('Borttaget ur portföljen'), 'success'), onError: () => toast.push(t('Kunde inte ta bort'), 'error') }) }]} />} />
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
              <Field label={t('Samarbete')} hint={t('Välj ett samarbete på VYRLE så visas varumärket som verifierat. Fritext visas alltid som ej verifierat.')}><select value={editing.form.link} onChange={(e) => setEditing({ ...editing, form: { ...editing.form, link: e.target.value } })}><option value="">{t('Inget VYRLE-samarbete (fritext)')}</option>{collabs.map((c) => <option key={linkKey(c.kind, c.id)} value={linkKey(c.kind, c.id)}>{c.brandName} · {c.title}</option>)}</select></Field>
              {!editing.form.link && <Field label={`${t('Varumärke')} (${t('ej verifierat')})`}><input value={editing.form.brandName} onChange={(e) => setEditing({ ...editing, form: { ...editing.form, brandName: e.target.value } })} placeholder={t('Valfritt')} /></Field>}
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
  const [form, setForm] = useState<null | { displayName: string; bio: string; category: string; country: string; language: string; tikTokUsername: string; dateOfBirth: string; profileTags: string[]; instagramUsername: string; website: string; avatarUrl: string; coverUrl: string; openToPrOffers: boolean; showInstagramBadge: boolean }>(null);
  useEffect(() => { if (p && !form) setForm({ displayName: p.displayName, bio: p.bio ?? '', category: p.category, country: p.country, language: p.language, tikTokUsername: p.tikTokUsername ?? '', dateOfBirth: '', profileTags: p.profileTags ?? [], instagramUsername: p.instagramUsername ?? '', website: p.website ?? '', avatarUrl: p.avatarUrl ?? '', coverUrl: p.coverUrl ?? '', openToPrOffers: p.openToPrOffers ?? true, showInstagramBadge: !!p.showInstagramBadge }); }, [p, form]);
  if (isLoading || !form) return <Page><PageHead title={t('Redigera profil')} back={{ to: '/creator/profile' }} /><SkeletonList rows={3} /></Page>;
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    try { await update.mutateAsync({ displayName: form.displayName, bio: form.bio, category: form.category, country: form.country, language: form.language, tikTokUsername: form.tikTokUsername || undefined, dateOfBirth: form.dateOfBirth || undefined, profileTags: form.profileTags, avatarUrl: form.avatarUrl, coverUrl: form.coverUrl, instagramUsername: form.instagramUsername || undefined, website: form.website || undefined, openToPrOffers: form.openToPrOffers, showInstagramBadge: form.showInstagramBadge }); toast.push(t('Profilen sparad'), 'success'); navigate('/creator/profile'); }
    catch (e2) { toast.push(apiMessage(e2, t('Kunde inte spara profilen')), 'error'); }
  };
  const toggleTag = (tg: string) => setForm({ ...form, profileTags: form.profileTags.includes(tg) ? form.profileTags.filter((x) => x !== tg) : form.profileTags.length >= 10 ? form.profileTags : [...form.profileTags, tg] });
  return (
    <Page>
      <PageHead title={t('Redigera profil')} back={{ to: '/creator/profile' }} />
      <form onSubmit={save} className="ds-stack" style={{ gap: 16 }}>
        <Card>
          <ImagePicker label={t('Profilbild')} value={form.avatarUrl || null} onChange={(v) => setForm({ ...form, avatarUrl: v ?? '' })} hint={t('Varumärken ser den när de hittar dig.')} />
          <ImagePicker label={t('Omslagsbild')} shape="wide" aspect={3} value={form.coverUrl || null} onChange={(v) => setForm({ ...form, coverUrl: v ?? '' })} hint={t('Bred bild överst på profilen (3:1). Utan bild visas en färgad bakgrund.')} />
        </Card>
        <Card>
          <div className="ds-stack" style={{ gap: 12 }}>
            <Field label={t('Visningsnamn')}><input required value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} /></Field>
            <Field label={t('Bio')}><textarea rows={3} value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} placeholder={t('Berätta om dig själv och ditt innehåll…')} /></Field>
            <div className="ds-kv">
              <Field label={t('Kategori')}><select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>{CATEGORIES.map((c) => <option key={c} value={c}>{t(c)}</option>)}</select></Field>
              <Field label={t('Land')}><select value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })}><option value="SE">{t('Sverige')}</option><option value="NO">{t('Norge')}</option><option value="DK">{t('Danmark')}</option><option value="FI">{t('Finland')}</option></select></Field>
            </div>
            <Field label={t('Födelsedatum')}><DateInput value={form.dateOfBirth} onChange={(v) => setForm({ ...form, dateOfBirth: v })} max={new Date(Date.now() - 13 * 365.25 * 86400000).toISOString().slice(0, 10)} /></Field>
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
          {form.instagramUsername.trim() !== '' && <div style={{ marginTop: 8 }}><Checkbox label={t('Visa taggen "Instagram kreatör" för företag (länk, märkt ej verifierad — inga siffror hämtas)')} checked={form.showInstagramBadge} onChange={(e) => setForm({ ...form, showInstagramBadge: e.target.checked })} /></div>}
        </Card>
        <div className="ds-sticky-action"><Button type="submit" full loading={update.isPending}>{t('Spara profil')}</Button></div>
      </form>
    </Page>
  );
}
