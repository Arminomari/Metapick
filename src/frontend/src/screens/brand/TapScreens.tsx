/** A kran (tap) for the brand: its month, its brief, its pending videos; and the form to open or edit one. */
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { t } from '@/lib/i18n';
import { money, formatDate, formatNumber, categoryLabel } from '@/lib/utils';
import { CATEGORIES } from '@/lib/categories';
import { useBrandTaps, useTapSubmissions, type TapDto } from '@/hooks/extra';
import { useToast } from '@/components/vyrle/Toast';
import { Badge, BottomSheet, Button, Card, EmptyState, Field, List, ListRow, Meter, Page, PageHead, Section, SkeletonList, StatRow, StatTile, StickyAction } from '@/components/ds';
import { MoreMenu, apiMessage } from '@/components/app/common';

export function TapDetailScreen() {
  const { id = '' } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const toast = useToast();
  const { data: taps = [], isLoading } = useBrandTaps();
  const { data: subs = [] } = useTapSubmissions();
  const [closing, setClosing] = useState(false);
  const refresh = () => ['brand-taps', 'brand-tap', 'action-counts'].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
  const status = useMutation({ mutationFn: async (active: boolean) => (await api.post(`/brand/tap/${id}/status?active=${active}`)).data.data, onSuccess: (_d, active) => { refresh(); toast.push(active ? t('Kranen är öppen igen') : t('Kranen är pausad'), 'success'); }, onError: (e) => toast.push(apiMessage(e, t('Kunde inte ändra kranen')), 'error') });
  const close = useMutation({ mutationFn: async () => (await api.delete(`/brand/tap/${id}`)).data, onSuccess: () => { refresh(); toast.push(t('Kranen är stängd. Historiken finns kvar.'), 'success'); navigate('/brand/campaigns?tab=taps'); }, onError: (e) => toast.push(apiMessage(e, t('Kunde inte stänga kranen')), 'error') });
  const tap = taps.find((x) => x.id === id);
  if (isLoading) return <Page><PageHead title="" back={{ to: '/brand/campaigns?tab=taps' }} /><SkeletonList rows={3} /></Page>;
  if (!tap) return <Page><PageHead title={t('Kran')} back={{ to: '/brand/campaigns?tab=taps' }} /><Card><EmptyState title={t('Kranen hittades inte')} /></Card></Page>;
  const active = tap.status === 'Active';
  const pct = tap.monthlyBudget > 0 ? Math.min(100, Math.round((tap.monthSpent / tap.monthlyBudget) * 100)) : 0;
  const pending = subs.filter((s) => !s.tapId || s.tapId === tap.id);

  return (
    <Page>
      <PageHead title={tap.name} back={{ to: '/brand/campaigns?tab=taps' }} actions={<MoreMenu items={[
        { label: t('Redigera'), to: `/brand/tap/${tap.id}/edit` },
        { label: active ? t('Pausa för alla creators') : t('Öppna igen'), onClick: () => status.mutate(!active) },
        { label: t('Stäng kranen för gott'), danger: true, onClick: () => setClosing(true) },
      ]} />} />
      <Card>
        <div className="ds-row ds-row--wrap"><Badge tone={active ? 'ok' : 'neutral'}>{active ? t('Öppen') : t('Pausad')}</Badge><span className="ds-caption ds-muted">#{tap.requiredHashtag} · {tap.cpm} kr CPM{tap.category ? ` · ${categoryLabel(tap.category)}` : ''}</span></div>
        <div style={{ marginTop: 12 }}><Meter value={tap.monthSpent} max={tap.monthlyBudget} tone={pct >= 100 ? 'bad' : 'accent'} left={`${money(tap.monthSpent)} ${t('av')} ${money(tap.monthlyBudget)} ${t('denna månad')}`} right={pct >= 100 ? t('Slut — öppnar den 1:a') : `${money(tap.monthRemaining)} ${t('kvar')}`} /></div>
        <div style={{ marginTop: 12 }}>
          <StatRow cols={3}>
            <StatTile plain label={t('Views')} count={tap.monthViews} format={formatNumber} hint={t('denna månad')} />
            <StatTile plain label={t('Aktiva creators')} value={String(tap.activeCreatorsThisMonth)} hint={`${tap.memberCount} ${t('medlemmar')}`} />
            <StatTile plain label={t('Att granska')} value={String(pending.length)} />
          </StatRow>
        </div>
        {(tap.payoutCapPerVideo || tap.monthlyCapPerCreator) ? <p className="ds-caption ds-muted" style={{ marginTop: 10 }}>{tap.payoutCapPerVideo ? `${t('max')} ${money(tap.payoutCapPerVideo)} / video` : ''}{tap.payoutCapPerVideo && tap.monthlyCapPerCreator ? ' · ' : ''}{tap.monthlyCapPerCreator ? `${t('max')} ${money(tap.monthlyCapPerCreator)} / creator / ${t('mån')}` : ''}</p> : null}
      </Card>
      <Section title={t('Stående brief')} action={tap.briefUpdatedAt ? <span className="ds-caption ds-muted">{t('uppdaterad')} {formatDate(tap.briefUpdatedAt)}</span> : undefined}>
        <Card><p className="ds-prose">{tap.brief}</p>{tap.contentInstructions && <p className="ds-prose ds-muted" style={{ marginTop: 8 }}>{tap.contentInstructions}</p>}</Card>
      </Section>
      <List>
        <ListRow title={t('Videor att granska')} subtitle={t('Godkänns automatiskt efter 48 timmar')} value={String(pending.length)} to={`/brand/review?tap=${tap.id}`} />
        <ListRow title={t('Medlemmar i communityn')} subtitle={t('Alla medlemmar kan hämta ur kranen')} value={String(tap.memberCount)} to="/brand/creators?tab=community" />
        <ListRow title={t('Skriv en uppdatering')} subtitle={t('Styr innehållet: "mer unboxing", "fokus på nya kollektionen"')} to="/brand/profile?post=1" />
      </List>
      {pending.length > 0 && <StickyAction><Button full to={`/brand/review?tap=${tap.id}`}>{t('Granska videor')} ({pending.length})</Button></StickyAction>}
      <BottomSheet open={closing} onClose={() => setClosing(false)} title={t('Stäng kranen för gott?')} footer={<><Button variant="secondary" onClick={() => setClosing(false)}>{t('Avbryt')}</Button><Button danger loading={close.isPending} onClick={() => close.mutate()}>{t('Stäng kranen')}</Button></>}>
        <p className="ds-body">{t('Creators kan inte längre hämta ur kranen. Historik och utbetalningar finns kvar.')}</p>
      </BottomSheet>
    </Page>
  );
}

export function TapFormScreen() {
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const toast = useToast();
  const { data: taps = [], isLoading } = useBrandTaps();
  const tap: TapDto | null = id ? taps.find((x) => x.id === id) ?? null : null;
  const [form, setForm] = useState({ name: '', monthlyBudget: '', cpm: '25', payoutCapPerVideo: '', monthlyCapPerCreator: '', brief: '', contentInstructions: '', requiredHashtag: '', category: '' });
  const [loaded, setLoaded] = useState(false);
  const [err, setErr] = useState('');
  useEffect(() => { if (tap && !loaded) { setForm({ name: tap.name, monthlyBudget: String(tap.monthlyBudget), cpm: String(tap.cpm), payoutCapPerVideo: tap.payoutCapPerVideo ? String(tap.payoutCapPerVideo) : '', monthlyCapPerCreator: tap.monthlyCapPerCreator ? String(tap.monthlyCapPerCreator) : '', brief: tap.brief, contentInstructions: tap.contentInstructions ?? '', requiredHashtag: tap.requiredHashtag, category: tap.category ?? '' }); setLoaded(true); } }, [tap, loaded]);
  const save = useMutation({
    mutationFn: async () => { const payload = { name: form.name, monthlyBudget: Number(form.monthlyBudget), cpm: Number(form.cpm), payoutCapPerVideo: form.payoutCapPerVideo ? Number(form.payoutCapPerVideo) : null, monthlyCapPerCreator: form.monthlyCapPerCreator ? Number(form.monthlyCapPerCreator) : null, brief: form.brief, contentInstructions: form.contentInstructions || null, requiredHashtag: form.requiredHashtag, category: form.category || null }; return (await (tap ? api.put(`/brand/tap/${tap.id}`, payload) : api.post('/brand/tap', payload))).data.data; },
    onSuccess: () => { ['brand-taps', 'brand-tap', 'action-counts'].forEach((k) => qc.invalidateQueries({ queryKey: [k] })); toast.push(tap ? t('Kranen uppdaterad') : t('Kranen är öppen! Alla i din community kan nu hämta.'), 'success'); navigate(tap ? `/brand/tap/${tap.id}` : '/brand/campaigns?tab=taps'); },
    onError: (e) => setErr(apiMessage(e, t('Kunde inte spara kranen'))),
  });
  if (id && isLoading) return <Page><PageHead title={t('Redigera kranen')} back={{ onClick: () => navigate(-1) }} /><SkeletonList rows={3} /></Page>;

  const cpm = Number(form.cpm) || 0, budget = Number(form.monthlyBudget) || 0, capVideo = Number(form.payoutCapPerVideo) || 0, capCreator = Number(form.monthlyCapPerCreator) || 0;
  const viewsPerMonth = cpm > 0 ? Math.floor((budget / cpm) * 1000) : 0;
  const minCreators = capCreator > 0 && budget > 0 ? Math.ceil(budget / capCreator) : 0;
  const capAt = capVideo > 0 && cpm > 0 ? Math.floor((capVideo / cpm) * 1000) : 0;
  const ready = budget > 0 && cpm > 0;
  const payFor = (v: number) => { const raw = (v * cpm) / 1000; return capVideo > 0 ? Math.min(raw, capVideo) : raw; };

  return (
    <Page>
      <PageHead title={tap ? t('Redigera kranen') : t('Öppna en kran')} back={{ onClick: () => navigate(-1) }} />
      {!tap && <p className="ds-body ds-muted">{t('En hård månadsbudget, en fast CPM och en stående brief. Din community skapar löpande och betalas per verifierad view tills budgeten är nådd.')}</p>}
      <form onSubmit={(e) => { e.preventDefault(); setErr(''); save.mutate(); }} className="ds-stack" style={{ gap: 16 }}>
        <Card title={t('Budget')}>
          <div className="ds-stack" style={{ gap: 12 }}>
            <Field label={t('Namn på kranen')}><input required maxLength={120} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder={t('t.ex. Nellie Creators — löpande')} /></Field>
            <div className="ds-kv">
              <Field label={t('Månadsbudget (kr)')} hint={t('Hårt tak — inget förs över.')}><input type="number" min={500} step={100} required value={form.monthlyBudget} onChange={(e) => setForm({ ...form, monthlyBudget: e.target.value })} placeholder="10000" /></Field>
              <Field label={t('CPM (kr / 1 000 views)')} hint={t('Minst 20 kr.')}><input type="number" min={20} step={1} required value={form.cpm} onChange={(e) => setForm({ ...form, cpm: e.target.value })} /></Field>
            </div>
            <div className="ds-kv">
              <Field label={t('Tak per video (kr)')} hint={capAt ? `${t('Slår in vid')} ${formatNumber(capAt)} views` : t('Tomt = inget tak')}><input type="number" min={0} step={50} value={form.payoutCapPerVideo} onChange={(e) => setForm({ ...form, payoutCapPerVideo: e.target.value })} /></Field>
              <Field label={t('Månadstak per creator (kr)')} hint={minCreators ? `${t('Räcker till minst')} ${minCreators} ${t('creators')}` : t('Tomt = inget tak')}><input type="number" min={0} step={100} value={form.monthlyCapPerCreator} onChange={(e) => setForm({ ...form, monthlyCapPerCreator: e.target.value })} /></Field>
            </div>
          </div>
        </Card>
        {ready && (
          <Card title={t('Så här räknar kranen')}>
            <div className="ds-hero-number ds-num">{formatNumber(viewsPerMonth)} <span className="ds-caption ds-muted" style={{ fontWeight: 500 }}>{t('views i månaden')}</span></div>
            <div className="ds-facts" style={{ marginTop: 10 }}>
              {[1000, 10000, 100000].map((v) => <div key={v} className="ds-fact"><span>{formatNumber(v)} views</span><span className="ds-num">{money(payFor(v))}{capVideo > 0 && (v * cpm) / 1000 > capVideo ? ` (${t('tak')})` : ''}</span></div>)}
            </div>
            {!capCreator && <p className="ds-caption" style={{ color: 'var(--ds-warn)', marginTop: 8 }}>{t('Inget månadstak — en ensam creator kan ta hela budgeten.')}</p>}
            {!capVideo && <p className="ds-caption" style={{ color: 'var(--ds-warn)', marginTop: 4 }}>{t('Inget tak per video — en viral video kan äta stora delar av månaden.')}</p>}
          </Card>
        )}
        <Card title={t('Brief')}>
          <div className="ds-stack" style={{ gap: 12 }}>
            <div className="ds-kv">
              <Field label={t('Hashtag')}><input required maxLength={60} value={form.requiredHashtag} onChange={(e) => setForm({ ...form, requiredHashtag: e.target.value.replace(/^#/, '') })} placeholder="nelliecreators" /></Field>
              <Field label={t('Kategori')}><select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}><option value="">{t('Välj')}</option>{CATEGORIES.map((c) => <option key={c} value={c}>{t(c)}</option>)}</select></Field>
            </div>
            <Field label={t('Stående brief — vad vill ni se?')}><textarea rows={4} required maxLength={4000} value={form.brief} onChange={(e) => setForm({ ...form, brief: e.target.value })} placeholder={t('Produkter, ton, vad som funkar. Detta ser alla i din community varje gång de skapar.')} /></Field>
            <Field label={t('Hooks, regler & dos/don’ts (valfritt)')}><textarea rows={3} maxLength={4000} value={form.contentInstructions} onChange={(e) => setForm({ ...form, contentInstructions: e.target.value })} /></Field>
          </div>
        </Card>
        {err && <p className="ds-body" style={{ color: 'var(--ds-bad)', fontWeight: 600 }}>{err}</p>}
        <StickyAction><Button type="submit" full loading={save.isPending}>{tap ? t('Spara ändringar') : t('Öppna kranen')}</Button></StickyAction>
      </form>
    </Page>
  );
}
