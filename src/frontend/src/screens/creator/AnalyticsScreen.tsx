/** Creator Statistik: four segments, one at a time. Same numbers as before, nowhere else. */
import { useNavigate, useSearchParams } from 'react-router-dom';
import { t } from '@/lib/i18n';
import { money, formatDate, formatNumber } from '@/lib/utils';
import { useCreatorAssignments, useCreatorProfile, useCreatorPayouts, useTikTokStatus, useUserReviews, useReceivedPrOffers } from '@/hooks/api';
import { useCreatorTaps } from '@/hooks/extra';
import { Avatar, Card, EmptyState, List, ListRow, Page, PageHead, SegmentedControl, Section, SkeletonList, StatRow, StatTile, Button } from '@/components/ds';
import { Bars, Donut, LineChart, PALETTE } from '@/components/app/Charts';
import { ReviewList } from '@/components/app/Reviews';
import { useLevel } from './ProfileScreen';

type Seg = 'overview' | 'performance' | 'platforms' | 'money';
const short = (n: number) => n >= 1e6 ? (n / 1e6).toFixed(1).replace('.0', '') + 'M' : n >= 1e3 ? (n / 1e3).toFixed(1).replace('.0', '') + 'K' : String(Math.round(n));

export function CreatorAnalyticsScreen() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const seg = (params.get('tab') as Seg) || 'overview';
  const { data: res, isLoading } = useCreatorAssignments(undefined, 1, 100);
  const { data: profile } = useCreatorProfile();
  const { data: pay } = useCreatorPayouts(undefined, 1);
  const { data: taps = [] } = useCreatorTaps();
  const { data: tiktok } = useTikTokStatus();
  const { data: reviews } = useUserReviews(profile?.userId ?? '');
  const { data: offers } = useReceivedPrOffers();
  const level = useLevel();
  const a = res?.data ?? [];

  const views = a.reduce((s, x) => s + (x.totalVerifiedViews || 0), 0);
  const clicks = a.reduce((s, x) => s + (x.totalTrackedClicks || 0), 0);
  const earned = a.reduce((s, x) => s + (x.currentPayoutAmount || 0), 0);
  const ctr = views ? (clicks / views) * 100 : 0;
  const live = a.filter((x) => x.status === 'Active').length;
  const perK = views ? (earned / views) * 1000 : 0;
  const avgViews = a.length ? views / a.length : 0;
  const ranked = [...a].sort((x, y) => (y.totalVerifiedViews || 0) - (x.totalVerifiedViews || 0));
  const byTime = [...a].sort((x, y) => +new Date(x.assignedAt) - +new Date(y.assignedAt)).slice(-10);
  const payouts = pay?.data ?? [];
  const sum = (st: string[]) => payouts.filter((p) => st.includes(p.status)).reduce((s, p) => s + p.amount, 0);
  const paid = sum(['Completed', 'Paid']), approved = sum(['Approved', 'Processing']), pending = sum(['Pending']);
  const accrued = Math.max(0, earned - paid - approved - pending);
  const byBrand = new Map<string, number>(); payouts.forEach((p) => byBrand.set(p.campaignName, (byBrand.get(p.campaignName) ?? 0) + p.amount));
  const topBrands = [...byBrand.entries()].sort((x, y) => y[1] - x[1]).slice(0, 5);
  const tapMonth = taps.reduce((s, x) => s + x.myMonthEarned, 0), tapLife = taps.reduce((s, x) => s + x.myLifetimeEarned, 0);
  const accepted = (offers?.data ?? []).filter((o) => o.status === 'Accepted' || o.status === 'Completed');
  const prProducts = accepted.reduce((s, o) => s + (o.productValue ?? 0), 0), prCash = accepted.reduce((s, o) => s + (o.compensationAmount ?? 0), 0);

  return (
    <Page>
      <PageHead title={t('Statistik')} back={{ onClick: () => navigate(-1) }} />
      <SegmentedControl<Seg> segments={[{ key: 'overview', label: t('Översikt') }, { key: 'performance', label: t('Prestation') }, { key: 'platforms', label: t('Plattformar') }, { key: 'money', label: t('Pengar') }]} value={seg} onChange={(k) => setParams({ tab: k }, { replace: true })} />
      {isLoading ? <SkeletonList rows={3} /> : a.length === 0 && seg !== 'platforms' ? (
        <Card><EmptyState title={t('Ingen statistik ännu')} description={t('När du går med i en kampanj och dina videor går live visas din verifierade prestation här.')} action={<Button to="/creator/browse">{t('Upptäck kampanjer')}</Button>} /></Card>
      ) : seg === 'overview' ? (
        <>
          <StatRow cols={4}>
            <StatTile label={t('Verifierade views')} value={formatNumber(views)} hint={`${a.length} ${a.length === 1 ? t('kampanj') : t('kampanjer')}`} />
            <StatTile label={t('Intäkter')} value={money(earned)} hint={`${money(perK)} / 1K views`} />
            <StatTile label={t('Spårade klick')} value={formatNumber(clicks)} hint={`${ctr.toFixed(2)} % ${t('klickfrekvens')}`} />
            <StatTile label={t('Live-kampanjer')} value={String(live)} hint={`${short(avgViews)} ${t('snittvisningar')}`} />
          </StatRow>
          <Section title={t('Views per kampanj')}><Card>{byTime.length >= 2 ? <LineChart values={byTime.map((x) => x.totalVerifiedViews || 0)} labels={byTime.map((x) => x.campaignName)} fmt={short} /> : <p className="ds-body ds-muted">{t('Kör ett par kampanjer så ritar din viewstrend upp sig här.')}</p>}</Card></Section>
          <Card><div className="ds-facts"><div className="ds-fact"><span>{t('Följare')}</span><span className="ds-num">{formatNumber(profile?.followerCount ?? 0)}</span></div><div className="ds-fact"><span>{t('Genomförda kampanjer')}</span><span className="ds-num">{a.filter((x) => x.status === 'Completed').length}</span></div><div className="ds-fact"><span>{t('Kranar du hämtar ur')}</span><span className="ds-num">{taps.length}</span></div></div></Card>
        </>
      ) : seg === 'performance' ? (
        <>
          <Section title={t('Per kampanj')}>
            <List>
              {ranked.map((x) => <ListRow key={x.id} leading={<Avatar name={x.campaignName} size="sm" rounded />} title={x.campaignName} subtitle={`${formatNumber(x.totalTrackedClicks || 0)} ${t('klick')} · ${money(x.currentPayoutAmount)}`} value={`${formatNumber(x.totalVerifiedViews || 0)} views`} to={`/creator/assignments/${x.id}`} />)}
            </List>
          </Section>
          <Section title={t('Räckvidd & monetarisering')}>
            <Card><Bars rows={[{ label: t('Klickfrekvens'), value: Math.min(100, ctr * 8), display: `${ctr.toFixed(2)} %` }, { label: t('Intäkt / 1K views'), value: Math.min(100, perK * 2), display: money(perK) }, { label: t('Snittvisningar'), value: ranked[0] ? (avgViews / Math.max(1, ranked[0].totalVerifiedViews)) * 100 : 0, display: short(avgViews) }]} /></Card>
          </Section>
          {reviews && reviews.totalReviews > 0 && <Section title={t('Creator-betyg')}><Card><ReviewList summary={reviews} compact /></Card></Section>}
        </>
      ) : seg === 'platforms' ? (
        <>
          <Section title="TikTok">
            <Card>
              {tiktok?.connected && tiktok.isOAuth ? (
                <div className="ds-facts">
                  <div className="ds-fact"><span>{t('Konto')}</span><span>@{tiktok.username}</span></div>
                  <div className="ds-fact"><span>{t('Följare')}</span><span className="ds-num">{formatNumber(tiktok.followerCount ?? profile?.followerCount ?? 0)}</span></div>
                  <div className="ds-fact"><span>{t('Snittvisningar')}</span><span className="ds-num">{profile?.averageViews ? formatNumber(profile.averageViews) : '–'}</span></div>
                  <div className="ds-fact"><span>{t('Verifierade views via VYRLE')}</span><span className="ds-num">{formatNumber(views)}</span></div>
                  <div className="ds-fact"><span>{t('Senast synkad')}</span><span>{tiktok.lastSyncAt ? formatDate(tiktok.lastSyncAt) : '–'}</span></div>
                </div>
              ) : <EmptyState title={t('TikTok är inte anslutet')} description={t('Anslut kontot så hämtas följare, visningar och videor automatiskt.')} action={<Button to="/creator/settings/tiktok">{t('Anslut TikTok')}</Button>} />}
            </Card>
          </Section>
          <Section title="Instagram"><Card><div className="ds-facts"><div className="ds-fact"><span>{t('Konto')}</span><span>{profile?.instagramUsername ? `@${profile.instagramUsername}` : '–'}</span></div><div className="ds-fact"><span>{t('Följare')}</span><span className="ds-num">{profile?.instagramFollowerCount ? formatNumber(profile.instagramFollowerCount) : '–'}</span></div></div><p className="ds-caption ds-muted" style={{ marginTop: 8 }}>{t('Instagram-statistik hämtas inte automatiskt ännu.')}</p></Card></Section>
        </>
      ) : (
        <>
          <Card>
            <Donut segments={[{ value: paid, color: PALETTE[0], label: t('Utbetalt') }, { value: approved, color: PALETTE[1], label: t('Godkänt') }, { value: pending, color: PALETTE[2], label: t('Väntande') }, { value: accrued, color: PALETTE[3], label: t('Upplupet') }]}>
              <span className="ds-caption ds-muted">{t('Totalt')}</span><span className="ds-heading ds-num">{money(Math.max(earned, paid + approved + pending))}</span>
            </Donut>
          </Card>
          <Card><div className="ds-facts">
            <div className="ds-fact"><span>{t('Snitt per utbetalning')}</span><span className="ds-num">{money(payouts.length ? (paid + approved + pending) / payouts.length : 0)}</span></div>
            <div className="ds-fact"><span>{t('Andel utbetalt')}</span><span className="ds-num">{payouts.length ? Math.round((payouts.filter((p) => p.status === 'Completed').length / payouts.length) * 100) : 0} %</span></div>
            <div className="ds-fact"><span>{t('Intäkt / 1K views')}</span><span className="ds-num">{money(perK)}</span></div>
            <div className="ds-fact"><span>{t('Kranar denna månad')}</span><span className="ds-num">{money(tapMonth)}</span></div>
            <div className="ds-fact"><span>{t('Kranar totalt')}</span><span className="ds-num">{money(tapLife)}</span></div>
            <div className="ds-fact"><span>{t('PR-värde att deklarera')}</span><span className="ds-num">{money(prProducts + prCash)}</span></div>
            <div className="ds-fact"><span>{t('Creator-nivå')}</span><span>{level.tier.name}{level.next ? ` · ${money(level.paid)} / ${money(level.next.min)}` : ''}</span></div>
          </div></Card>
          {topBrands.length > 0 && <Section title={t('Varumärken du tjänar mest på')}><Card><Bars rows={topBrands.map(([n, v]) => ({ label: n, value: v, display: money(v) }))} /></Card></Section>}
        </>
      )}
    </Page>
  );
}
