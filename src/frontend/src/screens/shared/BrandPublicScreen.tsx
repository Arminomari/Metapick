/**
 * A brand's public profile. Creators see it with Följ / Ansök till kranen;
 * the brand sees the same view under Profil › "Visa som creators ser den".
 */
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { t, statusLabel } from '@/lib/i18n';
import { money, formatDate, formatNumber, categoryLabel, countryName, payoutSummaryText, plural } from '@/lib/utils';
import { useMyApplications } from '@/hooks/api';
import { useBrandPublicProfile } from '@/hooks/extra';
import { SourceNote } from '@/components/app/SourceNote';
import { ProfileHero } from '@/components/app/ProfileHero';
import { useToast } from '@/components/vyrle/Toast';
import { Avatar, Badge, BottomSheet, Button, Card, List, ListRow, Page, PageHead, Section, SkeletonList, StatRow, StatTile, StickyAction, EmptyState } from '@/components/ds';
import { MoreMenu, ago, apiMessage } from '@/components/app/common';
import { ReviewList } from '@/components/app/Reviews';

export function BrandPublicView({ id, ownView, onDeletePost }: { id: string; ownView?: boolean; onDeletePost?: (postId: string) => void }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const toast = useToast();
  const { data: p, isLoading } = useBrandPublicProfile(id);
  const { data: myApps } = useMyApplications();
  const [past, setPast] = useState(false);
  const [confirmJoin, setConfirmJoin] = useState(false);
  const bust = () => { ['brand-public', 'my-communities', 'creator-taps', 'action-counts'].forEach((k) => qc.invalidateQueries({ queryKey: [k] })); };
  const follow = useMutation({ mutationFn: async (next: boolean) => { if (next) await api.post(`/brands/${id}/follow`); else await api.delete(`/brands/${id}/follow`); return next; }, onSuccess: (next) => { qc.invalidateQueries({ queryKey: ['brand-public', id] }); toast.push(next ? t('Du följer nu företaget') : t('Du har slutat följa företaget'), 'success'); } });
  const join = useMutation({ mutationFn: async () => (await api.post(`/creator/communities/${id}/request`)).data.data, onSuccess: () => { setConfirmJoin(false); bust(); toast.push(t('Ansökan skickad! Företaget får en notis och svarar snart.'), 'success'); }, onError: (e) => toast.push(apiMessage(e, t('Kunde inte skicka ansökan')), 'error') });
  const leave = useMutation({ mutationFn: async () => (await api.delete(`/creator/communities/${id}`)).data, onSuccess: () => { bust(); toast.push(t('Ansökan är återtagen'), 'success'); }, onError: (e) => toast.push(apiMessage(e, t('Kunde inte ta tillbaka ansökan')), 'error') });
  const answer = useMutation({ mutationFn: async (accept: boolean) => (await api.post(`/creator/communities/${id}/${accept ? 'accept' : 'decline'}`)).data, onSuccess: (_d, accept) => { bust(); toast.push(accept ? t('Du är med i communityn — deras öppna kranar finns under Kampanjer.') : t('Inbjudan avböjd'), 'success'); }, onError: (e) => toast.push(apiMessage(e, t('Kunde inte svara på inbjudan')), 'error') });

  if (isLoading) return <SkeletonList rows={3} />;
  if (!p) return <Card><EmptyState title={t('Företaget hittades inte')} /></Card>;
  const appStatus = new Map((myApps?.data ?? []).map((a) => [a.campaignId, a.status]));
  const taps = p.taps?.length ? p.taps : (p.hasTap ? [{ id: 'main', name: p.tapName ?? '', cpm: p.tapCpm ?? 0, brief: p.tapBrief ?? '', requiredHashtag: p.tapHashtag ?? '', capPerVideo: p.tapCapPerVideo, monthlyCapPerCreator: p.tapMonthlyCapPerCreator, category: '' }] : []);
  const m = p.membershipStatus;

  return (
    <>
      <ProfileHero coverUrl={p.coverUrl} avatarUrl={p.logoUrl} name={p.companyName} rounded
        meta={<>{categoryLabel(p.industry)} · {countryName(p.country)} · {t('sedan')} {new Date(p.memberSince).getFullYear()}</>}
        badges={p.orgVerified ? <Badge tone="ok">{t('Verifierat företag')}</Badge> : ownView ? <Badge tone="neutral">{t('Org.nr ej verifierat')}</Badge> : undefined}>
        {p.description && <p className="ds-body" style={{ marginTop: 12 }}>{p.description}</p>}
        <div style={{ marginTop: 14 }}>
          <StatRow cols={3}>
            <StatTile plain label={t('Verifierade views')} count={p.totalVerifiedViews} format={formatNumber} />
            <StatTile plain label={t('Ambassadörer')} value={String(p.creatorsWorkedWith)} />
            <StatTile plain label={t('Betyg')} value={p.reviewCount > 0 ? p.averageRating.toFixed(1) : '–'} hint={p.reviewCount > 0 ? `${p.reviewCount} ${t('omdömen')}` : undefined} />
          </StatRow>
          <SourceNote source="tiktok" at={p.metricsUpdatedAt} scope={t('alla kampanjvideos')} />
          <div className="ds-facts" style={{ marginTop: 10 }}>
            <div className="ds-fact"><span>{t('Aktiva kampanjer')}</span><span className="ds-num">{p.activeCampaignCount}</span></div>
            <div className="ds-fact"><span>{t('Genomförda')}</span><span className="ds-num">{p.completedCampaignCount}</span></div>
            <div className="ds-fact"><span>{t('Följare på VYRLE')}</span><span className="ds-num">{formatNumber(p.followerCount)}</span></div>
          </div>
        </div>
        {!ownView && <div className="ds-row" style={{ marginTop: 14 }}><Button variant={p.isFollowing ? 'secondary' : 'primary'} full={!p.hasTap} onClick={() => follow.mutate(!p.isFollowing)} loading={follow.isPending}>{p.isFollowing ? t('Följer') : t('Följ')}</Button>{p.website && <Button variant="secondary" size="sm" onClick={() => window.open(p.website!, '_blank', 'noopener')}>{t('Webbplats')}</Button>}</div>}
      </ProfileHero>

      {taps.length > 0 && (
        <Section title={taps.length > 1 ? `${taps.length} ${t('kranar är öppna')}` : t('Kranen är öppen')}>
          {taps.map((k) => (
            <Card key={k.id}>
              <div className="ds-heading">{k.name}</div>
              <p className="ds-caption ds-muted" style={{ marginTop: 2 }}><strong>{k.cpm} kr / 1 000 views</strong> {t('löpande varje månad')}{k.capPerVideo ? ` · ${t('max')} ${money(k.capPerVideo)} / video` : ''}{k.monthlyCapPerCreator ? ` · ${t('max')} ${money(k.monthlyCapPerCreator)} / ${t('mån')}` : ''}{k.requiredHashtag ? ` · #${k.requiredHashtag}` : ''}</p>
              {k.brief && <p className="ds-prose" style={{ marginTop: 8 }}>{k.brief}</p>}
            </Card>
          ))}
          {!ownView && (m === 'Active' ? <Badge tone="ok">{t('Du är medlem — kranarna är dina')}</Badge>
            : m === 'Invited' ? <Card><p className="ds-body">{p.companyName} {t('har bjudit in dig till sitt community. Tackar du ja kan du hämta ur deras öppna kranar direkt.')}</p><div className="ds-row" style={{ marginTop: 10 }}><Button onClick={() => answer.mutate(true)} loading={answer.isPending}>{t('Acceptera')}</Button><Button variant="secondary" onClick={() => answer.mutate(false)} disabled={answer.isPending}>{t('Avböj')}</Button></div></Card>
            : m === 'Requested' ? <div className="ds-row"><Badge tone="warn">{t('Ansökan skickad — väntar på svar')}</Badge><Button variant="ghost" size="sm" danger onClick={() => leave.mutate()} loading={leave.isPending}>{t('Ta tillbaka')}</Button></div>
            : <p className="ds-caption ds-muted">{t('Medlemmar i communityn kan publicera när de vill och få betalt per verifierad view — företaget godkänner din ansökan först.')}</p>)}
        </Section>
      )}

      {(ownView || (p.posts?.length ?? 0) > 0) && (
        <Section title={t('Uppdateringar')}>
          {(p.posts ?? []).length === 0 && <Card><EmptyState title={t('Inga inlägg ännu')} description={t('Skriv ditt första via + så når du alla följare direkt.')} /></Card>}
          {(p.posts ?? []).map((post) => (
            <Card key={post.id}>
              <div className="ds-row"><Avatar name={p.companyName} src={p.logoUrl} size="sm" rounded /><div className="ds-grow"><div className="ds-body" style={{ fontWeight: 600 }}>{p.companyName}</div><div className="ds-caption ds-muted">{ago(post.createdAt)}</div></div>{ownView && onDeletePost && <MoreMenu items={[{ label: t('Ta bort inlägget'), danger: true, onClick: () => onDeletePost(post.id) }]} />}</div>
              <p className="ds-prose" style={{ marginTop: 8 }}>{post.body}</p>
              {post.imageUrl && <img src={post.imageUrl} alt="" style={{ width: '100%', borderRadius: 12, marginTop: 10, maxHeight: 380, objectFit: 'cover' }} />}
            </Card>
          ))}
        </Section>
      )}

      <Section title={t('Aktiva kampanjer')}>
        {p.activeCampaigns.length === 0 ? <Card><EmptyState title={t('Inga öppna kampanjer just nu')} description={t('Följ företaget så ser du när nästa släpps.')} /></Card> : (
          <List>
            {p.activeCampaigns.map((c) => {
              const s = appStatus.get(c.id);
              return <ListRow key={c.id} leading={<Avatar name={c.name} size="sm" rounded />} title={c.name} badge={s === 'Approved' ? <Badge tone="ok">{t('Godkänd')}</Badge> : s === 'Pending' ? <Badge tone="warn">{t('Ansökt')}</Badge> : s === 'Rejected' ? <Badge tone="bad">{t('Nekad')}</Badge> : c.spotsLeft <= 0 ? <Badge>{t('Fullbokad')}</Badge> : undefined} subtitle={`${payoutSummaryText(c.payoutSummary)} · ${categoryLabel(c.category)} · ${plural(c.spotsLeft, t('plats kvar'), t('platser kvar'))} · ${formatDate(c.endDate)}`} wrapSubtitle to={ownView ? `/brand/campaigns/${c.id}` : `/creator/campaigns/${c.id}`} />;
            })}
          </List>
        )}
      </Section>
      {p.pastCampaigns.length > 0 && (
        <Section title={t('Tidigare kampanjer')} action={<Button variant="ghost" size="sm" onClick={() => setPast((v) => !v)}>{past ? t('Dölj') : `${t('Visa')} (${p.pastCampaigns.length})`}</Button>}>
          {past && <List>{p.pastCampaigns.map((c) => <ListRow key={c.id} title={c.name} subtitle={`${categoryLabel(c.category)} · ${formatDate(c.startDate)} – ${formatDate(c.endDate)} · ${statusLabel(c.status)}`} value={`${formatNumber(c.totalViews)} views`} chevron={false} />)}</List>}
        </Section>
      )}
      {p.reviewCount > 0 && <Section title={t('Omdömen från creators')}><Card><ReviewList summary={{ averageStars: p.averageRating, totalReviews: p.reviewCount, reviews: p.recentReviews }} /></Card></Section>}

      {!ownView && p.hasTap && m !== 'Active' && m !== 'Requested' && m !== 'Invited' && <StickyAction><Button full onClick={() => setConfirmJoin(true)}>{t('Ansök till kranen')}</Button></StickyAction>}
      <BottomSheet open={confirmJoin} onClose={() => setConfirmJoin(false)} title={t('Ansök till kranen')} footer={<><Button variant="secondary" onClick={() => setConfirmJoin(false)} disabled={join.isPending}>{t('Avbryt')}</Button><Button onClick={() => join.mutate()} loading={join.isPending}>{t('Ja, skicka ansökan')}</Button></>}>
        <p className="ds-body">{t('Skicka en ansökan till')} <strong>{p.companyName}</strong>? {t('Företaget ser din profil och svarar med en notis. Du kan ta tillbaka ansökan tills de svarat.')}</p>
      </BottomSheet>
      {!ownView && !p.hasTap && <div style={{ height: 1 }} onClick={() => navigate(-1)} />}
    </>
  );
}

export function BrandPublicScreen() {
  const { id = '' } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: p } = useBrandPublicProfile(id);
  return (
    <Page>
      <PageHead title={p?.companyName ?? t('Företag')} back={{ onClick: () => navigate(-1) }} />
      <BrandPublicView id={id} />
    </Page>
  );
}
