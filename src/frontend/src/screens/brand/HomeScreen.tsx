/**
 * Brand Home: what needs me, three numbers, then my kranar, kampanjer and
 * beställningar as feed rows. Creation lives in "+".
 */
import { t } from '@/lib/i18n';
import { money, formatNumber, categoryLabel, formatDate } from '@/lib/utils';
import { useActionCounts, useBrandAnalyticsSummary, useBrandCampaigns, useBrandProfile } from '@/hooks/api';
import { SourceNote } from '@/components/app/SourceNote';
import { useUgcBrandCampaigns, useUgcCollabs, formatOre, COMPENSATION_LABEL } from '@/hooks/ugc';
import { useBrandTaps } from '@/hooks/extra';
import { Avatar, Badge, Button, Card, EmptyState, List, ListRow, Page, PageHead, Section, SkeletonList, SkeletonStats, StatRow, StatTile, statusTone } from '@/components/ds';
import { NotifBell } from '@/components/app/common';
import { statusLabel } from '@/lib/i18n';

export function BrandHomeScreen() {
  const { data: profile } = useBrandProfile();
  const { data: counts } = useActionCounts('brand');
  const { data: stats, isLoading: loadingAnalytics } = useBrandAnalyticsSummary();
  const { data: campaignsRes, isLoading } = useBrandCampaigns();
  const { data: taps = [] } = useBrandTaps();
  const { data: orders = [] } = useUgcBrandCampaigns();
  const { data: collabs = [] } = useUgcCollabs('brand');

  // Server-computed over active, paused and completed campaigns; drafts never count.
  const spend = stats?.totalSpent ?? 0;
  const views = stats?.totalViews ?? 0;
  const creators = stats?.creators ?? 0;
  const videosToReview = (counts?.pendingTapReviews ?? 0) + (counts?.pendingVideoReviews ?? 0);
  const needsMe = collabs.filter((c) => c.needsMyAction);
  const ordersWithBids = orders.filter((o) => o.pendingApplicationCount > 0);
  // Block C: going live needs a *verified* org number, not just a typed one.
  const orgMissing = !!profile && !profile.orgVerified;
  const hasTodo = videosToReview + (counts?.pendingApplications ?? 0) + (counts?.pendingCommunityRequests ?? 0) + needsMe.length + ordersWithBids.length + (orgMissing ? 1 : 0) > 0;
  const campaigns = campaignsRes?.data ?? [];
  const recentVideos = stats?.recentContent ?? [];
  const campaignName = (id: string) => stats?.campaigns.find((c) => c.campaignId === id)?.name ?? '';

  return (
    <Page>
      <PageHead title={profile?.companyName ?? t('Hem')} actions={<NotifBell />} />

      {hasTodo && (
        <Section title={t('Behöver dig')}>
          <List>
            {orgMissing && <ListRow leading={<Avatar name="!" size="sm" />} title={profile?.organizationNumber ? t('Organisationsnumret är inte verifierat') : t('Organisationsnummer saknas')} subtitle={t('Krävs för att publicera kampanjer och beställa video')} to="/brand/profile/edit" />}
            {videosToReview > 0 && <ListRow leading={<Avatar name={String(videosToReview)} size="sm" />} title={`${videosToReview} ${videosToReview === 1 ? t('video att granska') : t('videor att granska')}`} subtitle={counts?.reviewWindowHours ? `${t('Godkänns automatiskt efter')} ${counts.reviewWindowHours} ${t('timmar')}` : t('Godkänns automatiskt om de inte granskas i tid')} to="/brand/review" />}
            {(counts?.pendingApplications ?? 0) > 0 && <ListRow leading={<Avatar name={String(counts!.pendingApplications)} size="sm" />} title={`${counts!.pendingApplications} ${counts!.pendingApplications === 1 ? t('ansökan') : t('ansökningar')}`} subtitle={t('Creators vill vara med i dina kampanjer')} to="/brand/creators?tab=applications" />}
            {(counts?.pendingCommunityRequests ?? 0) > 0 && <ListRow leading={<Avatar name={String(counts!.pendingCommunityRequests)} size="sm" />} title={`${counts!.pendingCommunityRequests} ${t('vill gå med i communityn')}`} to="/brand/creators?tab=community" />}
            {ordersWithBids.map((o) => <ListRow key={o.id} leading={<Avatar name={String(o.pendingApplicationCount)} size="sm" />} title={`${o.pendingApplicationCount} ${t('nya bud')}`} subtitle={o.title} to={`/brand/ugc/campaigns/${o.id}`} />)}
            {needsMe.map((c) => <ListRow key={c.id} leading={<Avatar name={c.creatorName} src={c.creatorAvatarUrl} size="sm" />} title={c.title} badge={<Badge tone="accent">{t('Din tur')}</Badge>} subtitle={c.creatorName} to={`/brand/ugc/collabs/${c.id}`} />)}
          </List>
        </Section>
      )}

      <Section title={t('Just nu')} action={<Button variant="ghost" size="sm" to="/brand/analytics">{t('Statistik')}</Button>}>
        {loadingAnalytics ? <SkeletonStats n={3} /> : (
          <>
            <StatRow cols={3}>
              <StatTile label={t('Spenderat')} count={spend} format={money} />
              <StatTile label={t('Views')} count={views} format={formatNumber} />
              <StatTile label={t('Aktiva creators')} value={String(creators)} />
            </StatRow>
            <SourceNote source="tiktok" at={stats?.metricsUpdatedAt} scope={stats?.scope} />
          </>
        )}
      </Section>

      <Section title={t('Kranar')} action={<Button variant="ghost" size="sm" to="/brand/campaigns?tab=taps">{t('Visa alla')}</Button>}>
        {taps.length === 0 ? (
          <Card><EmptyState title={t('Ingen kran öppen')} description={t('En stående månadsbudget som betalar din community per verifierad view.')} action={<Button to="/brand/tap/new">{t('Öppna en kran')}</Button>} /></Card>
        ) : (
          <List>
            {taps.slice(0, 3).map((tap) => {
              const pct = tap.monthUsedPercent;
              return <ListRow key={tap.id} leading={<Avatar name={tap.name} rounded />} title={tap.name} badge={<Badge tone={tap.status === 'Active' ? 'ok' : 'neutral'}>{tap.status === 'Active' ? t('Öppen') : t('Pausad')}</Badge>} subtitle={`${money(tap.monthSpent)} ${t('av')} ${money(tap.monthlyBudget)} ${t('denna månad')} · ${tap.activeCreatorsThisMonth} ${t('creators')}`} wrapSubtitle value={`${pct} %`} to={`/brand/tap/${tap.id}`} />;
            })}
          </List>
        )}
      </Section>

      <Section title={t('Kampanjer')} action={<Button variant="ghost" size="sm" to="/brand/campaigns?tab=campaigns">{t('Visa alla')}</Button>}>
        {isLoading ? <SkeletonList rows={2} /> : campaigns.length === 0 ? (
          <Card><EmptyState title={t('Inga kampanjer än')} description={t('Sätt brief, budget och ersättning så kan creators ansöka.')} action={<Button to="/brand/campaigns/new">{t('Skapa kampanj')}</Button>} /></Card>
        ) : (
          <List>
            {campaigns.slice(0, 3).map((c) => (
              <ListRow key={c.id} leading={<Avatar name={c.name} rounded />} title={c.name} badge={<Badge tone={statusTone(c.status)}>{statusLabel(c.status)}</Badge>} subtitle={`${categoryLabel(c.category)} · ${c.approvedCreatorCount}/${c.maxCreators} ${t('creators')} · ${formatDate(c.endDate)}`} wrapSubtitle value={money(c.budgetSpent)} to={`/brand/campaigns/${c.id}`} />
            ))}
          </List>
        )}
      </Section>

      {orders.length > 0 && (
        <Section title={t('Beställningar')} action={<Button variant="ghost" size="sm" to="/brand/campaigns?tab=orders">{t('Visa alla')}</Button>}>
          <List>
            {orders.slice(0, 3).map((o) => (
              <ListRow key={o.id} leading={<Avatar name={o.title} rounded />} title={o.title} badge={<Badge tone={o.status === 'Published' ? 'ok' : o.status === 'Draft' ? 'warn' : 'neutral'}>{t(o.status === 'Published' ? 'Öppen' : o.status === 'Draft' ? 'Utkast' : 'Stängd')}</Badge>} subtitle={`${t(COMPENSATION_LABEL[o.compensation])} · ${o.compensation === 'ProductExchange' ? o.productDescription ?? '' : `${formatOre(o.budgetMinOre)}–${formatOre(o.budgetMaxOre)}`} · ${o.hiredCount}/${o.slots} ${t('anlitade')}`} to={o.status === 'Draft' ? `/brand/ugc/campaigns/${o.id}/edit` : `/brand/ugc/campaigns/${o.id}`} />
            ))}
          </List>
        </Section>
      )}

      {recentVideos.length > 0 && (
        <Section title={t('Senaste från communityn')}>
          <List>
            {recentVideos.map((v, i) => (
              <ListRow key={i} leading={<Avatar name={v.creatorName} size="sm" />} title={v.creatorName} subtitle={`${campaignName(v.campaignId)}${v.publishedAt ? ` · ${formatDate(v.publishedAt)}` : ''}`} value={`${formatNumber(v.views)} views`} to={`/brand/campaigns/${v.campaignId}/creators/${v.assignmentId}`} />
            ))}
          </List>
        </Section>
      )}
    </Page>
  );
}
