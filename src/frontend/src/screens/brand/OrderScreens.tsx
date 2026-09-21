/** Video orders for brands: the order with its bids, and the stepped form (new, edit, direct invite). */
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { t } from '@/lib/i18n';
import { formatDate, formatNumber, money } from '@/lib/utils';
import { useBrandProfile, useCreatorPublicProfile } from '@/hooks/api';
import { useUgcBrandCampaign, useSaveUgcCampaign, useUgcCampaignAction, useUgcCampaignApplications, useUgcApplicationDecision, useUgcDirectInvite, formatOre, kronorToOre, oreToKronor, COMPENSATION_LABEL, RIGHTS_LABEL, RIGHTS_HINT, UGC_CATEGORIES, UGC_REGIONS, apiError, useUgcSettings, type UgcBrief, type UpsertUgcCampaign, type UgcApplication } from '@/hooks/ugc';
import { useToast } from '@/components/vyrle/Toast';
import { Avatar, Badge, BottomSheet, Button, Card, Field, List, ListRow, Page, PageHead, Section, SkeletonList, StatRow, StatTile, StickyAction } from '@/components/ds';
import { MoreMenu } from '@/components/app/common';
import { BriefView } from '@/screens/creator/OrderScreen';

const emptyBrief: UgcBrief = { goal: '', format: '9:16 vertikal, TikTok/Reels', lengthSeconds: 30, videoCount: 1, hooks: [], callToAction: '', referenceUrls: [], dos: [], donts: [], extraNotes: '' };
const toLines = (s: string) => s.split('\n').map((l) => l.trim()).filter(Boolean);

function ListField({ label, values, onChange, placeholder }: { label: string; values: string[]; onChange: (v: string[]) => void; placeholder?: string }) {
  const [text, setText] = useState(values.join('\n'));
  useEffect(() => { if (values.join('\n') !== toLines(text).join('\n')) setText(values.join('\n')); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [values]);
  return <Field label={label} hint={t('En per rad')}><textarea rows={Math.min(5, Math.max(2, text.split('\n').length))} value={text} onChange={(e) => { setText(e.target.value); onChange(toLines(e.target.value)); }} placeholder={placeholder} /></Field>;
}
function FeeNote({ amountOre }: { amountOre: number }) {
  // The fee percent comes from server settings — the same value the contract is generated with.
  const { data: settings } = useUgcSettings();
  if (settings == null) return null;
  const fee = Math.round((amountOre * settings.feePercent) / 100);
  return <p className="ds-caption ds-muted">{t('Vid')} {formatOre(amountOre)} {t('till creatorn betalar ni')} <strong>{formatOre(amountOre + fee)}</strong> {t('inkl. VYRLE:s avgift')} ({settings.feePercent} %). {t('Creatorn får exakt sitt bud.')}</p>;
}
function OrgNotice() {
  const { data: profile } = useBrandProfile();
  if (!profile || profile.organizationNumber) return null;
  return <Card><p className="ds-body" style={{ fontWeight: 600 }}>{t('Organisationsnummer saknas')}</p><p className="ds-caption ds-muted">{t('Ni kan fylla i beställningen nu, men den kan inte publiceras förrän organisationsnumret finns på företagsprofilen.')}</p><div style={{ marginTop: 8 }}><Button variant="secondary" size="sm" to="/brand/profile/edit">{t('Lägg till org.nr')}</Button></div></Card>;
}

/* ── Order detail ─────────────────────────────────────────── */
export function BrandOrderDetailScreen() {
  const { id = '' } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const toast = useToast();
  const { data: profile } = useBrandProfile();
  const { data: c, isLoading } = useUgcBrandCampaign(id);
  const { data: apps = [] } = useUgcCampaignApplications(id);
  const decide = useUgcApplicationDecision();
  const action = useUgcCampaignAction();
  const [rejecting, setRejecting] = useState<UgcApplication | null>(null);
  const [note, setNote] = useState('');
  const [showDone, setShowDone] = useState(false);
  const [brief, setBrief] = useState(false);
  if (isLoading || !c) return <Page><PageHead title="" back={{ to: '/brand/campaigns?tab=orders' }} /><SkeletonList rows={3} /></Page>;
  const needsOrg = !!profile && !profile.organizationNumber;
  const open = apps.filter((a) => a.status === 'Applied' || a.status === 'Preselected');
  const done = apps.filter((a) => !open.includes(a));
  const run = (appId: string, act: 'preselect' | 'reject' | 'hire', n?: string) => decide.mutate({ id: appId, action: act, note: n }, {
    onSuccess: (res: unknown) => { if (act === 'hire') { toast.push(t('Anlitad! Läs och acceptera kontraktet för att betala.'), 'success'); navigate(`/brand/ugc/collabs/${(res as { id: string }).id}`); } else toast.push(act === 'preselect' ? t('Markerad som favorit') : t('Budet är avböjt'), 'success'); setRejecting(null); setNote(''); },
    onError: (e) => toast.push(apiError(e, t('Något gick fel')), 'error'),
  });
  const publish = () => { if (needsOrg) { toast.push(t('Lägg till företagets organisationsnummer innan ni publicerar.'), 'error'); navigate('/brand/profile/edit'); return; } action.mutate({ id: c.id, action: 'publish' }, { onSuccess: () => toast.push(t('Publicerad — creators som matchar får en notis.'), 'success'), onError: (e) => toast.push(apiError(e, t('Kunde inte publicera')), 'error') }); };

  return (
    <Page>
      <PageHead title={c.title} back={{ to: '/brand/campaigns?tab=orders' }} actions={<MoreMenu items={[
        { label: t('Redigera'), hidden: c.status !== 'Draft', to: `/brand/ugc/campaigns/${c.id}/edit` },
        { label: t('Stäng beställningen'), hidden: c.status !== 'Published', danger: true, onClick: () => action.mutate({ id: c.id, action: 'close' }, { onSuccess: () => toast.push(t('Stängd'), 'success') }) },
        { label: t('Ta bort utkast'), hidden: c.status !== 'Draft', danger: true, onClick: () => action.mutate({ id: c.id, action: 'delete' }, { onSuccess: () => navigate('/brand/campaigns?tab=orders') }) },
      ]} />} />
      <div className="ds-row ds-row--wrap"><Badge tone={c.status === 'Published' ? 'ok' : c.status === 'Draft' ? 'warn' : 'neutral'}>{t(c.status === 'Published' ? 'Öppen' : c.status === 'Draft' ? 'Utkast' : 'Stängd')}</Badge><span className="ds-caption ds-muted">{t(COMPENSATION_LABEL[c.compensation])} · {t(RIGHTS_LABEL[c.rightsPackage])}</span></div>
      <StatRow cols={3}>
        <StatTile label={t('Per video')} value={c.compensation === 'ProductExchange' ? t('Produkt') : `${money(c.budgetMinOre / 100)}–${money(c.budgetMaxOre / 100)}`} />
        <StatTile label={t('Anlitade')} value={`${c.hiredCount} / ${c.slots}`} />
        <StatTile label={t('Leverans')} value={`${c.deadlineDays} ${t('dgr')}`} />
      </StatRow>

      <Section title={`${t('Bud')} (${open.length})`}>
        {open.length === 0 ? <Card><p className="ds-body ds-muted">{c.status === 'Published' ? t('Inga bud ännu — creators som matchar har fått en notis.') : t('Inga öppna bud.')}</p></Card> : open.map((a) => (
          <Card key={a.id}>
            <ListRow className="ds-listrow--flush" leading={<Avatar name={a.creatorName} src={a.creatorAvatarUrl} />} title={a.creatorName} badge={a.status === 'Preselected' ? <Badge tone="accent">{t('Favorit')}</Badge> : a.creatorStatus === 'Approved' ? <Badge tone="ok">{t('Godkänd av VYRLE')}</Badge> : undefined} subtitle={`${formatNumber(a.followers)} ${t('följare')} · ${a.deliveredCount} ${t('leveranser')}${a.deliveredCount > 0 ? ` · ${Math.round((a.onTimeCount / a.deliveredCount) * 100)} % ${t('i tid')}` : ''}${a.ratingCount > 0 ? ` · ★ ${a.averageRating.toFixed(1)}` : ''}${a.city || a.region ? ` · ${a.city || a.region}` : ''}`} wrapSubtitle value={a.bidOre > 0 ? formatOre(a.bidOre) : undefined} chevron onClick={() => navigate(`/brand/creators/${a.creatorProfileId}`)} />
            <p className="ds-prose ds-muted" style={{ marginTop: 6 }}>“{a.pitch}”</p>
            <div className="ds-row" style={{ marginTop: 10 }}>
              <Button size="sm" disabled={c.hiredCount >= c.slots} loading={decide.isPending} onClick={() => run(a.id, 'hire')}>{t('Anlita')}{a.bidOre > 0 ? ` · ${money(a.bidOre / 100)}` : ''}</Button>
              <MoreMenu items={[{ label: t('Favorit'), hidden: a.status === 'Preselected', onClick: () => run(a.id, 'preselect') }, { label: t('Visa profil'), to: `/brand/creators/${a.creatorProfileId}` }, { label: t('Avböj'), danger: true, onClick: () => { setNote(''); setRejecting(a); } }]} />
            </div>
          </Card>
        ))}
        {done.length > 0 && <Button variant="ghost" size="sm" onClick={() => setShowDone((v) => !v)}>{showDone ? t('Dölj hanterade') : `${done.length} ${t('hanterade bud')}`}</Button>}
        {showDone && <List>{done.map((a) => <ListRow key={a.id} leading={<Avatar name={a.creatorName} src={a.creatorAvatarUrl} size="sm" />} title={a.creatorName} badge={<Badge tone={a.status === 'Hired' ? 'ok' : 'neutral'}>{t(a.status === 'Hired' ? 'Anlitad' : a.status === 'Rejected' ? 'Avböjt' : a.status === 'Withdrawn' ? 'Återtaget' : a.status)}</Badge>} subtitle={formatDate(a.createdAt)} to={a.collabId ? `/brand/ugc/collabs/${a.collabId}` : undefined} chevron={!!a.collabId} />)}</List>}
      </Section>

      <Section title={t('Brief')} action={<Button variant="ghost" size="sm" onClick={() => setBrief((v) => !v)}>{brief ? t('Dölj') : t('Visa')}</Button>}>
        {brief && <Card><BriefView b={c.brief} /><div className="ds-divider" /><div className="ds-facts"><div className="ds-fact"><span>{t('Region')}</span><span>{c.region || t('Var som helst')}</span></div><div className="ds-fact"><span>{t('Kategorier')}</span><span>{c.categories.length ? c.categories.join(', ') : t('Alla')}</span></div><div className="ds-fact"><span>{t('Följare')}</span><span>{c.minFollowers ? `${formatNumber(c.minFollowers)}+` : t('Alla')}</span></div></div></Card>}
      </Section>

      {c.status === 'Draft' && <StickyAction><Button full loading={action.isPending} onClick={publish}>{t('Publicera')}</Button></StickyAction>}
      <BottomSheet open={!!rejecting} onClose={() => setRejecting(null)} title={`${t('Avböj')} ${rejecting?.creatorName ?? ''}`} footer={<><Button variant="secondary" onClick={() => setRejecting(null)}>{t('Avbryt')}</Button><Button danger loading={decide.isPending} onClick={() => rejecting && run(rejecting.id, 'reject', note)}>{t('Avböj')}</Button></>}>
        <Field label={t('Anledning (valfritt)')}><textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} /></Field>
      </BottomSheet>
    </Page>
  );
}

/* ── Order form: new / edit / direct invite ───────────────── */
const STEPS = ['Brief', 'Ersättning', 'Creators', 'Granska'];

export function BrandOrderFormScreen() {
  const { id } = useParams<{ id?: string }>();
  const [params] = useSearchParams();
  const creatorId = params.get('creator') ?? '';
  const navigate = useNavigate();
  const toast = useToast();
  const { data: existing, isLoading } = useUgcBrandCampaign(id ?? '');
  const { data: creator } = useCreatorPublicProfile(creatorId);
  const save = useSaveUgcCampaign();
  const action = useUgcCampaignAction();
  const invite = useUgcDirectInvite();
  const [step, setStep] = useState(0);
  const [error, setError] = useState('');
  const [form, setForm] = useState<UpsertUgcCampaign>({ title: '', brief: emptyBrief, region: '', categories: [], minFollowers: null, maxFollowers: null, compensation: 'Paid', budgetMinOre: 100_000, budgetMaxOre: 250_000, productDescription: '', productValueOre: null, rightsPackage: 'OrganicPlusAds6M', deadlineDays: 7, slots: 1, briefGeneratedByAi: false });
  const [amountOre, setAmountOre] = useState(150_000);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => { if (existing && !loaded) { setForm({ title: existing.title, brief: { ...existing.brief, extraNotes: existing.brief.extraNotes ?? '' }, region: existing.region ?? '', categories: existing.categories, minFollowers: existing.minFollowers, maxFollowers: existing.maxFollowers, compensation: existing.compensation, budgetMinOre: existing.budgetMinOre, budgetMaxOre: existing.budgetMaxOre, productDescription: existing.productDescription ?? '', productValueOre: existing.productValueOre, rightsPackage: existing.rightsPackage, deadlineDays: existing.deadlineDays, slots: existing.slots, briefGeneratedByAi: existing.briefGeneratedByAi }); setLoaded(true); } }, [existing, loaded]);
  const set = (p: Partial<UpsertUgcCampaign>) => setForm((f) => ({ ...f, ...p }));
  const setBrief = (p: Partial<UgcBrief>) => setForm((f) => ({ ...f, brief: { ...f.brief, ...p } }));
  const direct = !!creatorId && !id;
  const paid = form.compensation !== 'ProductExchange';
  const steps = direct ? ['Brief', 'Ersättning', 'Granska'] : STEPS;

  const validate = (s: string): string => {
    if (s === 'Brief') {
      if (form.title.trim().length < 3) return t('Ge beställningen en titel (minst 3 tecken).');
      if (!form.brief.goal.trim()) return t('Skriv vad videon ska åstadkomma.');
      if (!form.brief.format.trim()) return t('Ange format.');
      if (!(form.brief.lengthSeconds >= 5 && form.brief.lengthSeconds <= 180)) return t('Längd: 5–180 sekunder.');
      if (!(form.brief.videoCount >= 1 && form.brief.videoCount <= 10)) return t('Antal videor: 1–10.');
      if (!form.brief.callToAction.trim()) return t('Skriv en call to action.');
    }
    if (s === 'Ersättning') {
      if (!direct && paid && form.budgetMinOre < 5_000) return t('Minst 50 kr per video.');
      if (!direct && paid && form.budgetMaxOre < form.budgetMinOre) return t('Max kan inte vara lägre än min.');
      if (form.compensation !== 'Paid' && !(form.productDescription ?? '').trim()) return t('Beskriv produkten creatorn får.');
      if (!(form.deadlineDays >= 1 && form.deadlineDays <= 60)) return t('Leveranstid: 1–60 dagar.');
      if (!direct && !(form.slots >= 1 && form.slots <= 50)) return t('Antal creators: 1–50.');
    }
    return '';
  };
  const next = () => { const e = validate(steps[step]); setError(e); if (!e) setStep(step + 1); };
  const submit = async (publish: boolean) => {
    setError('');
    try {
      if (direct) { const c = await invite.mutateAsync({ creatorProfileId: creatorId, title: form.title, brief: form.brief, compensation: form.compensation, amountOre, productDescription: form.productDescription || null, productValueOre: form.productValueOre, rightsPackage: form.rightsPackage, deadlineDays: form.deadlineDays }); toast.push(t('Inbjudan skickad — acceptera kontraktet för att betala.'), 'success'); navigate(`/brand/ugc/collabs/${c.id}`); return; }
      const saved = await save.mutateAsync({ id, body: { ...form, region: form.region || null, productDescription: form.productDescription || null } });
      if (publish) { await action.mutateAsync({ id: saved.id, action: 'publish' }); toast.push(t('Publicerad — creators som matchar får en notis.'), 'success'); navigate(`/brand/ugc/campaigns/${saved.id}`); }
      else { toast.push(t('Utkastet är sparat'), 'success'); navigate('/brand/campaigns?tab=orders'); }
    } catch (e) { setError(apiError(e, t('Kunde inte spara'))); }
  };
  if (id && isLoading) return <Page><PageHead title={t('Redigera beställning')} back={{ onClick: () => navigate(-1) }} /><SkeletonList rows={3} /></Page>;
  const cur = steps[step];

  return (
    <Page>
      <PageHead title={direct ? `${t('Beställ video av')} ${creator?.displayName ?? '…'}` : id ? t('Redigera beställning') : t('Beställ video')} back={{ onClick: () => step > 0 ? setStep(step - 1) : navigate(-1) }} />
      <div><div className="ds-steps">{steps.map((s, i) => <span key={s} className={i <= step ? 'on' : ''} />)}</div><div className="ds-caption ds-muted" style={{ marginTop: 6 }}>{t('Steg')} {step + 1} {t('av')} {steps.length} · {t(cur)}</div></div>
      {step === 0 && <OrgNotice />}

      {cur === 'Brief' && (
        <Card>
          <div className="ds-stack" style={{ gap: 12 }}>
            <Field label={t('Titel')}><input value={form.title} onChange={(e) => set({ title: e.target.value })} placeholder={t('t.ex. Lunchdeal-video för TikTok')} maxLength={200} /></Field>
            <Field label={t('Mål')}><textarea rows={2} value={form.brief.goal} onChange={(e) => setBrief({ goal: e.target.value })} placeholder={t('Vad ska videon åstadkomma?')} /></Field>
            <Field label={t('Format')}><input value={form.brief.format} onChange={(e) => setBrief({ format: e.target.value })} /></Field>
            <div className="ds-kv">
              <Field label={t('Längd (sek)')}><input type="number" min={5} max={180} value={form.brief.lengthSeconds} onChange={(e) => setBrief({ lengthSeconds: Number(e.target.value) })} /></Field>
              <Field label={t('Antal videor')}><input type="number" min={1} max={10} value={form.brief.videoCount} onChange={(e) => setBrief({ videoCount: Number(e.target.value) })} /></Field>
            </div>
            <ListField label={t('Hooks (första meningen i bild)')} values={form.brief.hooks} onChange={(v) => setBrief({ hooks: v })} placeholder={t('Visste du att…')} />
            <Field label={t('Call to action')}><input value={form.brief.callToAction} onChange={(e) => setBrief({ callToAction: e.target.value })} placeholder={t('t.ex. Boka bord via länken i bion')} /></Field>
            <ListField label={t('Gör')} values={form.brief.dos} onChange={(v) => setBrief({ dos: v })} />
            <ListField label={t('Undvik')} values={form.brief.donts} onChange={(v) => setBrief({ donts: v })} />
            {!direct && <ListField label={t('Referenser (länkar)')} values={form.brief.referenceUrls} onChange={(v) => setBrief({ referenceUrls: v })} />}
            <Field label={t('Övrigt')}><textarea rows={2} value={form.brief.extraNotes ?? ''} onChange={(e) => setBrief({ extraNotes: e.target.value })} /></Field>
          </div>
        </Card>
      )}

      {cur === 'Ersättning' && (
        <Card>
          <div className="ds-stack" style={{ gap: 12 }}>
            <Field label={t('Ersättningstyp')}><select value={form.compensation} onChange={(e) => set({ compensation: e.target.value })}>{Object.entries(COMPENSATION_LABEL).map(([k, v]) => <option key={k} value={k}>{t(v)}</option>)}</select></Field>
            {paid && (direct
              ? <Field label={t('Ersättning till creatorn (kr)')}><input inputMode="decimal" value={oreToKronor(amountOre)} onChange={(e) => setAmountOre(kronorToOre(e.target.value))} /></Field>
              : <div className="ds-kv"><Field label={t('Min per video (kr)')}><input inputMode="decimal" value={oreToKronor(form.budgetMinOre)} onChange={(e) => set({ budgetMinOre: kronorToOre(e.target.value) })} /></Field><Field label={t('Max per video (kr)')}><input inputMode="decimal" value={oreToKronor(form.budgetMaxOre)} onChange={(e) => set({ budgetMaxOre: kronorToOre(e.target.value) })} /></Field></div>)}
            {paid && <FeeNote amountOre={direct ? amountOre : form.budgetMaxOre} />}
            {form.compensation !== 'Paid' && <><Field label={t('Produkt/tjänst creatorn får')}><input value={form.productDescription ?? ''} onChange={(e) => set({ productDescription: e.target.value })} placeholder={t('t.ex. Middag för två')} /></Field><Field label={t('Ungefärligt värde (kr)')}><input inputMode="decimal" value={oreToKronor(form.productValueOre)} onChange={(e) => set({ productValueOre: kronorToOre(e.target.value) || null })} /></Field></>}
            <Field label={t('Rättighetspaket')} hint={t(RIGHTS_HINT[form.rightsPackage])}><select value={form.rightsPackage} onChange={(e) => set({ rightsPackage: e.target.value })}>{Object.entries(RIGHTS_LABEL).map(([k, v]) => <option key={k} value={k}>{t(v)}</option>)}</select></Field>
            <div className="ds-kv">
              <Field label={t('Leveranstid (dagar)')}><input type="number" min={1} max={60} value={form.deadlineDays} onChange={(e) => set({ deadlineDays: Number(e.target.value) })} /></Field>
              {!direct && <Field label={t('Antal creators')}><input type="number" min={1} max={50} value={form.slots} onChange={(e) => set({ slots: Number(e.target.value) })} /></Field>}
            </div>
          </div>
        </Card>
      )}

      {cur === 'Creators' && (
        <Card>
          <div className="ds-stack" style={{ gap: 12 }}>
            <Field label={t('Region')}><select value={form.region ?? ''} onChange={(e) => set({ region: e.target.value })}><option value="">{t('Var som helst')}</option>{UGC_REGIONS.map((r) => <option key={r} value={r}>{r}</option>)}</select></Field>
            <div><div className="ds-field-label" style={{ marginBottom: 6 }}>{t('Kategorier')}</div><div className="ds-tags">{UGC_CATEGORIES.map((c) => <button key={c} type="button" className={`ds-tag${form.categories?.includes(c) ? ' ds-tag--on' : ''}`} onClick={() => set({ categories: form.categories?.includes(c) ? form.categories.filter((x) => x !== c) : [...(form.categories ?? []), c] })}>{c}</button>)}</div></div>
            <Field label={t('Minst antal följare')} hint={t('Lämna tomt för alla')}><input type="number" min={0} value={form.minFollowers ?? ''} onChange={(e) => set({ minFollowers: e.target.value ? Number(e.target.value) : null, maxFollowers: null })} /></Field>
          </div>
        </Card>
      )}

      {cur === 'Granska' && (
        <Card title={form.title}>
          <div className="ds-facts">
            {direct && <div className="ds-fact"><span>{t('Creator')}</span><span>{creator?.displayName ?? '…'}</span></div>}
            <div className="ds-fact"><span>{t('Ersättning')}</span><span>{paid ? (direct ? formatOre(amountOre) : `${formatOre(form.budgetMinOre)}–${formatOre(form.budgetMaxOre)} / video`) : form.productDescription}</span></div>
            <div className="ds-fact"><span>{t('Rättigheter')}</span><span>{t(RIGHTS_LABEL[form.rightsPackage])}</span></div>
            <div className="ds-fact"><span>{t('Leverans')}</span><span>{form.deadlineDays} {t('dagar')}</span></div>
            {!direct && <div className="ds-fact"><span>{t('Creators')}</span><span>{form.slots} · {form.region || t('var som helst')}</span></div>}
            <div className="ds-fact"><span>{t('Format')}</span><span>{form.brief.lengthSeconds} s × {form.brief.videoCount}</span></div>
          </div>
          <p className="ds-caption ds-muted" style={{ marginTop: 10 }}>{direct ? t('Creatorn får ett kontrakt att acceptera när ni betalat.') : t('Creators som passar lägger bud inom er budget — ni betalar först när ni anlitar.')}</p>
          {!direct && <div style={{ marginTop: 10 }}><Button variant="ghost" size="sm" loading={save.isPending} onClick={() => void submit(false)}>{t('Spara som utkast')}</Button></div>}
          {id && <Link to={`/brand/ugc/campaigns/${id}`} className="ds-link ds-caption">{t('Tillbaka till beställningen')}</Link>}
        </Card>
      )}

      {error && <p className="ds-body" style={{ color: 'var(--ds-bad)', fontWeight: 600 }}>{error}</p>}
      <StickyAction>{step < steps.length - 1 ? <Button full onClick={next}>{t('Fortsätt')}</Button> : <Button full loading={save.isPending || action.isPending || invite.isPending} onClick={() => void submit(true)}>{direct ? t('Skicka inbjudan') : t('Publicera')}</Button>}</StickyAction>
    </Page>
  );
}
