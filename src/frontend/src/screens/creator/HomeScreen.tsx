/**
 * Creator Home: what needs me, three numbers, my taps, and the feed.
 * Everything else lives one tap deeper.
 */
import { useNavigate } from 'react-router-dom';
import { Sparkles } from 'lucide-react';
import { t } from '@/lib/i18n';
import { money, formatNumber, categoryLabel, payoutSummaryText } from '@/lib/utils';
import { useCreatorAssignments, useCreatorProfile, useReceivedPrOffers, useBrowseCampaigns, useTikTokStatus } from '@/hooks/api';
import { useUgcCollabs } from '@/hooks/ugc';
import { usePayables, useCreatorTaps, usePendingCommunityInvites, useBrandFeed } from '@/hooks/extra';
import { Avatar, Badge, Button, Card, EmptyState, List, ListRow, Page, PageHead, Section, SkeletonList, SkeletonStats, StatRow, StatTile } from '@/components/ds';
import { NotifBell, ago } from '@/components/app/common';

export function CreatorHomeScreen() {
  const navigate = useNavigate();
  const { data: profile } = useCreatorProfile();
  const { data: asg, isLoading } = useCreatorAssignments(undefined, 1, 100);
  const { data: payables = [] } = usePayables();
  const { data: taps = [] } = useCreatorTaps();
  const { data: invites = [] } = usePendingCommunityInvites();
  const { data: offers } = useReceivedPrOffers();
  const { data: collabs = [] } = useUgcCollabs('creator');
  const { data: tiktok } = useTikTokStatus();
  const { data: feed = [] } = useBrandFeed();
  const { data: browse } = useBrowseCampaigns();

  const assignments = asg?.data ?? [];
  const earned = assignments.reduce((s, a) => s + a.currentPayoutAmount, 0);
  const views = assignments.reduce((s, a) => s + a.totalVerifiedViews, 0);
  const available = payables.reduce((s, p) => s + p.available, 0);
  const newOffers = (offers?.data ?? []).filter((o) => o.status === 'Sent');
  const needsMe = collabs.filter((c) => c.needsMyAction);
  const noVideo = assignments.filter((a) => a.status === 'Active' && !a.isTap && a.totalVerifiedViews === 0).slice(0, 3);
  const tiktokMissing = tiktok && !(tiktok.connected && tiktok.isOAuth);
  const hasTodo = invites.length + needsMe.length + newOffers.length + noVideo.length + (available > 0 ? 1 : 0) + (tiktokMissing ? 1 : 0) > 0;
  const name = profile?.displayName?.split(' ')[0];

  return (
    <Page>
      <PageHead title={name ? `${t('Hej')} ${name}` : t('Hem')} actions={<NotifBell />} />

      {hasTodo && (
        <Section title={t('Behöver dig')}>
          <List>
            {tiktokMissing && <ListRow leading={<Avatar name="T" size="sm" />} title={t('Anslut ditt TikTok-konto')} subtitle={t('Krävs för att views ska verifieras och betalas')} to="/creator/settings/tiktok" />}
            {available > 0 && <ListRow leading={<Avatar name="kr" size="sm" />} title={`${money(available)} ${t('att hämta ut')}`} subtitle={t('Verifierade views är klara för utbetalning')} to="/creator/earnings" />}
            {invites.map((r) => (
              <ListRow key={r.brandProfileId} leading={<Avatar name={r.brandName} src={r.brandLogoUrl} size="sm" rounded />} title={`${r.brandName} ${t('bjöd in dig')}`} subtitle={t('Till sitt creator-community — svara under Förfrågningar')} to="/creator/messages?tab=requests" />
            ))}
            {newOffers.slice(0, 3).map((o) => (
              <ListRow key={o.id} leading={<Avatar name={o.brandName} src={o.brandLogoUrl} size="sm" rounded />} title={`${t('PR-erbjudande från')} ${o.brandName}`} subtitle={o.title} to="/creator/messages?tab=requests" />
            ))}
            {needsMe.map((c) => (
              <ListRow key={c.id} leading={<Avatar name={c.brandName} src={c.brandLogoUrl} size="sm" rounded />} title={c.title} badge={<Badge tone="accent">{t('Din tur')}</Badge>} subtitle={t('Videouppdrag')} to={`/creator/ugc/collabs/${c.id}`} />
            ))}
            {noVideo.map((a) => (
              <ListRow key={a.id} leading={<Avatar name={a.campaignName} size="sm" rounded />} title={a.campaignName} subtitle={t('Ingen video registrerad än — lägg till din')} to={`/creator/assignments/${a.id}?add=1`} />
            ))}
          </List>
        </Section>
      )}

      <Section title={t('Din översikt')} action={<Button variant="ghost" size="sm" to="/creator/analytics">{t('Statistik')}</Button>}>
        {isLoading ? <SkeletonStats n={3} /> : (
          <StatRow cols={3}>
            <StatTile label={t('Intjänat')} value={money(earned)} />
            <StatTile label={t('Views')} value={formatNumber(views)} />
            <StatTile label={t('Att hämta ut')} value={money(available)} accent={available > 0} />
          </StatRow>
        )}
      </Section>

      {taps.length > 0 && (
        <Section title={t('Dina kranar')} action={<Button variant="ghost" size="sm" to="/creator/assignments#kranar">{t('Visa alla')}</Button>}>
          <List>
            {taps.slice(0, 3).map((tap) => {
              const open = tap.tapStatus === 'Active' && tap.membershipStatus === 'Active';
              return <ListRow key={tap.tapId} leading={<Avatar name={tap.brandName} src={tap.brandLogoUrl} rounded />} title={tap.brandName} badge={<Badge tone={open ? 'ok' : 'neutral'}>{open ? t('Öppen') : t('Pausad')}</Badge>} subtitle={`${tap.cpm} kr / 1 000 views · ${formatNumber(tap.myMonthViews)} views ${t('denna månad')}`} value={money(tap.myMonthEarned)} to={`/creator/assignments/${tap.assignmentId}`} />;
            })}
          </List>
        </Section>
      )}

      <Section title={t('Ditt flöde')}>
        {feed.length === 0 && (browse?.data.length ?? 0) === 0 && !isLoading && (
          <Card><EmptyState icon={<Sparkles />} title={t('Ditt flöde är tomt')} description={t('Följ företag du gillar så dyker deras uppdateringar och kampanjsläpp upp här.')} action={<Button to="/creator/browse">{t('Upptäck kampanjer')}</Button>} /></Card>
        )}
        {feed.slice(0, 10).map((post) => (
          <Card key={post.id}>
            <ListRow className="ds-listrow--flush" leading={<Avatar name={post.brandName} src={post.brandLogoUrl} size="sm" rounded />} title={post.brandName} subtitle={ago(post.createdAt)} chevron={false} onClick={() => navigate(`/creator/brands/${post.brandProfileId}`)} />
            <p className="ds-prose" style={{ marginTop: 8 }}>{post.body}</p>
            {post.imageUrl && <img src={post.imageUrl} alt="" style={{ width: '100%', borderRadius: 12, marginTop: 10, maxHeight: 380, objectFit: 'cover' }} />}
          </Card>
        ))}
        {isLoading ? <SkeletonList rows={2} /> : (browse?.data.length ?? 0) > 0 && (
          <Card title={t('Öppna kampanjer')} action={<Button variant="ghost" size="sm" to="/creator/browse">{t('Visa alla')}</Button>} flush>
            <List plain>
              {browse!.data.slice(0, 3).map((c) => (
                <ListRow key={c.id} leading={<Avatar name={c.brandName || c.name} size="sm" rounded />} title={c.name} subtitle={`${c.brandName} · ${categoryLabel(c.category)} · ${payoutSummaryText(c.payoutSummary)}`} to={`/creator/campaigns/${c.id}`} />
              ))}
            </List>
          </Card>
        )}
      </Section>
    </Page>
  );
}
