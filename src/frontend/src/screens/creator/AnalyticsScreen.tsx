/**
 * Creator Statistik: four segments, one at a time. Every number comes from
 * GET /creator/analytics — verified views from TikTok, money from the payout
 * ledger, level from money actually paid out. Nothing is summed in the browser.
 */
import { useNavigate, useSearchParams } from 'react-router-dom';
import { t } from '@/lib/i18n';
import { money, formatDate, formatNumber } from '@/lib/utils';
import { useCreatorAnalytics, useCreatorProfile, useUserReviews } from '@/hooks/api';
import { Avatar, Card, EmptyState, List, ListRow, Page, PageHead, SegmentedControl, Section, SkeletonList, StatRow, StatTile, Button, Badge } from '@/components/ds';
import { Bars, Donut, LineChart, PALETTE } from '@/components/app/Charts';
import { ReviewList } from '@/components/app/Reviews';
import { SourceNote, orDash } from '@/components/app/SourceNote';

type Seg = 'overview' | 'performance' | 'platforms' | 'money';
const short = (n: number) => n >= 1e6 ? (n / 1e6).toFixed(1).replace('.0', '') + 'M' : n >= 1e3 ? (n / 1e3).toFixed(1).replace('.0', '') + 'K' : String(Math.round(n));

export function CreatorAnalyticsScreen() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const seg = (params.get('tab') as Seg) || 'overview';
  const { data: s, isLoading } = useCreatorAnalytics();
  const { data: profile } = useCreatorProfile();
  const { data: reviews } = useUserReviews(profile?.userId ?? '');

  const rows = s?.campaigns ?? [];
  const byTime = [...rows].sort((x, y) => +new Date(x.assignedAt) - +new Date(y.assignedAt)).slice(-10);
  const maxViews = Math.max(1, ...rows.map((r) => r.views));

  return (
    <Page>
      <PageHead title={t('Statistik')} back={{ onClick: () => navigate(-1) }} />
      <SegmentedControl<Seg> segments={[{ key: 'overview', label: t('Översikt') }, { key: 'performance', label: t('Prestation') }, { key: 'platforms', label: t('Plattformar') }, { key: 'money', label: t('Pengar') }]} value={seg} onChange={(k) => setParams({ tab: k }, { replace: true })} />
      {isLoading || !s ? <SkeletonList rows={3} /> : rows.length === 0 && seg !== 'platforms' ? (
        <Card><EmptyState title={t('Ingen statistik ännu')} description={t('När du går med i en kampanj och dina videor går live visas din verifierade prestation här.')} action={<Button to="/creator/browse">{t('Upptäck kampanjer')}</Button>} /></Card>
      ) : seg === 'overview' ? (
        <>
          <StatRow cols={4}>
            <StatTile label={t('Verifierade views')} value={formatNumber(s.totalVerifiedViews)} hint={`${s.verifiedPosts} ${s.verifiedPosts === 1 ? t('verifierad video') : t('verifierade videor')}`} />
            <StatTile label={t('Intäkter')} value={money(s.totalEarned)} hint={`${orDash(s.earningsPerThousandViews, money)} / 1K views`} />
            <StatTile label={t('Spårade klick')} value={formatNumber(s.totalClicks)} hint={`${orDash(s.clickThroughRate, (v) => v.toFixed(2) + ' %')} ${t('klickfrekvens')}`} />
            <StatTile label={t('Live-kampanjer')} value={String(s.activeAssignments)} hint={`${orDash(s.avgViewsPerAssignment, short)} ${t('snittvisningar')}`} />
          </StatRow>
          <SourceNote source="tiktok" at={s.metricsUpdatedAt} scope={t('alla dina kampanjvideos')} />
          <Section title={t('Views per kampanj')}><Card>{byTime.length >= 2 ? <LineChart values={byTime.map((x) => x.views)} labels={byTime.map((x) => x.campaignName)} fmt={short} /> : <p className="ds-body ds-muted">{t('Kör ett par kampanjer så ritar din viewstrend upp sig här.')}</p>}</Card></Section>
          <Card><div className="ds-facts"><div className="ds-fact"><span>{t('Följare')}</span><span className="ds-num">{s.tikTokVerified ? formatNumber(s.followers) : '–'}</span></div><div className="ds-fact"><span>{t('Genomförda kampanjer')}</span><span className="ds-num">{s.completedAssignments}</span></div><div className="ds-fact"><span>{t('Kranar du hämtar ur')}</span><span className="ds-num">{s.tapsCount}</span></div></div>
            {s.tikTokVerified ? <SourceNote source="tiktok" at={s.followersSyncedAt} /> : <p className="ds-caption ds-muted" style={{ marginTop: 6 }}>{t('Följare visas när ditt TikTok-konto är kopplat via OAuth.')}</p>}
          </Card>
        </>
      ) : seg === 'performance' ? (
        <>
          <Section title={t('Per kampanj')}>
            <List>
              {rows.map((x) => <ListRow key={x.assignmentId} leading={<Avatar name={x.campaignName} size="sm" rounded />} title={x.campaignName} badge={x.isTap ? <Badge>{t('Kran')}</Badge> : undefined} subtitle={`${x.brandName} · ${formatNumber(x.clicks)} ${t('klick')} · ${money(x.earned)}`} value={`${formatNumber(x.views)} views`} to={`/creator/assignments/${x.assignmentId}`} />)}
            </List>
            <SourceNote source="tiktok" at={s.metricsUpdatedAt} />
          </Section>
          <Section title={t('Räckvidd & monetarisering')}>
            <Card>
              <Bars rows={rows.slice(0, 6).map((x) => ({ label: x.campaignName, value: (x.views / maxViews) * 100, display: formatNumber(x.views) }))} />
              <div className="ds-facts" style={{ marginTop: 12 }}>
                <div className="ds-fact"><span>{t('Klickfrekvens')}</span><span className="ds-num">{orDash(s.clickThroughRate, (v) => v.toFixed(2) + ' %')}</span></div>
                <div className="ds-fact"><span>{t('Intäkt / 1K views')}</span><span className="ds-num">{orDash(s.earningsPerThousandViews, money)}</span></div>
                <div className="ds-fact"><span>{t('Snittvisningar')}</span><span className="ds-num">{orDash(s.avgViewsPerAssignment, formatNumber)}</span></div>
              </div>
            </Card>
          </Section>
          {reviews && reviews.totalReviews > 0 && <Section title={t('Creator-betyg')}><Card><ReviewList summary={reviews} compact /></Card></Section>}
        </>
      ) : seg === 'platforms' ? (
        <>
          <Section title="TikTok">
            <Card>
              {s.tikTokVerified ? (
                <>
                  <div className="ds-facts">
                    <div className="ds-fact"><span>{t('Konto')}</span><span>@{s.tikTokUsername}</span></div>
                    <div className="ds-fact"><span>{t('Följare')}</span><span className="ds-num">{formatNumber(s.followers)}</span></div>
                    <div className="ds-fact"><span>{t('Verifierade views via VYRLE')}</span><span className="ds-num">{formatNumber(s.totalVerifiedViews)}</span></div>
                    <div className="ds-fact"><span>{t('Senast synkad')}</span><span>{s.followersSyncedAt ? formatDate(s.followersSyncedAt) : '–'}</span></div>
                  </div>
                  <SourceNote source="tiktok" at={s.followersSyncedAt} />
                </>
              ) : <EmptyState title={t('TikTok är inte anslutet')} description={t('Anslut kontot så hämtas följare, visningar och videor automatiskt.')} action={<Button to="/creator/settings/tiktok">{t('Anslut TikTok')}</Button>} />}
            </Card>
          </Section>
          <Section title="Instagram"><Card><div className="ds-facts"><div className="ds-fact"><span>{t('Konto')}</span><span>{profile?.instagramUsername ? `@${profile.instagramUsername}` : '–'}</span></div></div><p className="ds-caption ds-muted" style={{ marginTop: 8 }}>{t('Instagram är en länk du själv angett. Inga Instagram-siffror hämtas eller visas.')}</p></Card></Section>
        </>
      ) : (
        <>
          <Card>
            <Donut segments={[{ value: s.paidOut, color: PALETTE[0], label: t('Utbetalt') }, { value: s.approved, color: PALETTE[1], label: t('Godkänt') }, { value: s.pending, color: PALETTE[2], label: t('Väntande') }, { value: s.accrued, color: PALETTE[3], label: t('Upplupet') }]}>
              <span className="ds-caption ds-muted">{t('Totalt')}</span><span className="ds-heading ds-num">{money(Math.max(s.totalEarned, s.paidOut + s.approved + s.pending))}</span>
            </Donut>
            <SourceNote source="ledger" at={s.calculatedAt} />
          </Card>
          <Card><div className="ds-facts">
            <div className="ds-fact"><span>{t('Snitt per utbetalning')}</span><span className="ds-num">{orDash(s.avgPayout, money)}</span></div>
            <div className="ds-fact"><span>{t('Andel utbetalt')}</span><span className="ds-num">{orDash(s.paidShare, (v) => `${Math.round(v)} %`)}</span></div>
            <div className="ds-fact"><span>{t('Intäkt / 1K views')}</span><span className="ds-num">{orDash(s.earningsPerThousandViews, money)}</span></div>
            <div className="ds-fact"><span>{t('Kranar denna månad')}</span><span className="ds-num">{money(s.tapsThisMonth)}</span></div>
            <div className="ds-fact"><span>{t('Kranar totalt')}</span><span className="ds-num">{money(s.tapsLifetime)}</span></div>
            <div className="ds-fact"><span>{t('Creator-nivå')}</span><span>{s.level.name}{s.level.nextMinPaid != null ? ` · ${money(s.level.totalPaid)} / ${money(s.level.nextMinPaid)}` : ''}</span></div>
          </div></Card>
          <Card>
            <div className="ds-facts"><div className="ds-fact"><span>{t('PR-värde att deklarera')}</span><span className="ds-num">{money(s.prValueDeclared)}</span></div></div>
            <SourceNote source="declared" scope={t('belopp företagen angav i accepterade PR-erbjudanden')} />
          </Card>
          {s.topBrands.length > 0 && <Section title={t('Varumärken du tjänar mest på')}><Card><Bars rows={s.topBrands.map((b) => ({ label: b.brandName, value: b.earned, display: money(b.earned) }))} /></Card></Section>}
        </>
      )}
    </Page>
  );
}
