/** Create a campaign in four steps. Same fields, same request as before. */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { t } from '@/lib/i18n';
import { money, formatNumber } from '@/lib/utils';
import { CATEGORIES } from '@/lib/categories';
import { PLATFORM_TAGS, NICHE_TAGS } from '@/lib/tags';
import { useCreateCampaign } from '@/hooks/api';
import { DateInput } from '@/components/ui/DateInput';
import type { CreateCampaignRequest } from '@/types';
import { Button, Card, Chip, Chips, Field, Page, PageHead, StickyAction } from '@/components/ds';
import { apiMessage } from '@/components/app/common';

type Rule = CreateCampaignRequest['payoutRules'][number];
const STEPS = ['Grund', 'Ersättning', 'Brief', 'Granska'];

export function CampaignFormScreen() {
  const navigate = useNavigate();
  const create = useCreateCampaign();
  const [step, setStep] = useState(0);
  const [error, setError] = useState('');
  const [form, setForm] = useState<CreateCampaignRequest>({ name: '', description: '', country: 'SE', category: 'Övrigt', requiredHashtag: '', payoutModel: 'Fixed', budget: 0, maxCreators: 10, requiredVideoCount: 1, startDate: '', endDate: '', reviewMode: 'ManualReview', minViews: 0, requirements: [], rules: [], payoutRules: [{ payoutType: 'FixedThreshold', minViews: 1000, amount: 500, sortOrder: 0 }], perks: '', contentTags: [] });
  const set = (patch: Partial<CreateCampaignRequest>) => setForm((f) => ({ ...f, ...patch }));
  const num = (v: string) => Number(v.replace(/\D/g, '')) || 0;
  const setModel = (model: string) => {
    const rules: Rule[] = model === 'CPM' ? [{ payoutType: 'CPM', minViews: 0, amount: 50, sortOrder: 0 }]
      : model === 'Tiered' ? [{ payoutType: 'Tiered', minViews: 1000, maxViews: 4999, amount: 200, sortOrder: 0 }, { payoutType: 'Tiered', minViews: 5000, maxViews: 19999, amount: 500, sortOrder: 1 }, { payoutType: 'Tiered', minViews: 20000, amount: 1500, sortOrder: 2 }]
      : [{ payoutType: 'FixedThreshold', minViews: 1000, amount: 500, sortOrder: 0 }];
    set({ payoutModel: model, payoutRules: rules });
  };
  const updateRule = (i: number, patch: Partial<Rule>) => set({ payoutRules: form.payoutRules.map((r, j) => j === i ? { ...r, ...patch } : r) });
  const toggleTag = (tg: string) => set({ contentTags: form.contentTags.includes(tg) ? form.contentTags.filter((x) => x !== tg) : [...form.contentTags, tg] });
  const summary = () => {
    const r = form.payoutRules; if (!r.length) return '';
    if (form.payoutModel === 'Fixed') return `${r[0].amount} ${t('kr per creator som når')} ${formatNumber(r[0].minViews)} views`;
    if (form.payoutModel === 'CPM') return `${r[0].amount} ${t('kr per 1 000 views')}${r[0].maxPayoutPerCreator ? ` (max ${r[0].maxPayoutPerCreator} ${t('kr/creator')})` : ''}`;
    return r.map((x) => `${formatNumber(x.minViews)}${x.maxViews ? `–${formatNumber(x.maxViews)}` : '+'} views → ${x.amount} kr`).join(' · ');
  };
  const maxCost = () => { const r = form.payoutRules; if (!r.length) return 0; if (form.payoutModel === 'Fixed') return r[0].amount * form.maxCreators; if (form.payoutModel === 'CPM') return r[0].maxPayoutPerCreator ? r[0].maxPayoutPerCreator * form.maxCreators : 0; return Math.max(...r.map((x) => x.amount)) * form.maxCreators; };

  const validate = (s: number): string => {
    if (s === 0) {
      if (!form.name.trim()) return t('Ge kampanjen ett namn.');
      if (!form.description.trim()) return t('Skriv en beskrivning.');
      if (!form.requiredHashtag.trim()) return t('Ange en hashtag.');
      if (!form.startDate || !form.endDate) return t('Ange start- och slutdatum.');
      if (form.endDate < form.startDate) return t('Slutdatumet måste vara efter startdatumet.');
      if (form.endDate <= new Date().toISOString().slice(0, 10)) return t('Slutdatumet måste vara i framtiden.');
    }
    if (s === 1) {
      if (form.budget <= 0) return t('Ange en budget.');
      if (form.payoutRules.some((r) => r.amount <= 0)) return t('Alla utbetalningsbelopp måste vara större än 0.');
    }
    return '';
  };
  const next = () => { const e = validate(step); setError(e); if (!e) setStep(step + 1); };
  const submit = async () => {
    setError('');
    try {
      const result = await create.mutateAsync({ ...form, startDate: `${form.startDate}T00:00:00`, endDate: `${form.endDate}T00:00:00` } as unknown as Record<string, unknown>);
      navigate(`/brand/campaigns/${result.id}`);
    } catch (e) { setError(apiMessage(e, t('Kunde inte skapa kampanjen'))); }
  };

  return (
    <Page>
      <PageHead title={t('Skapa kampanj')} back={{ onClick: () => step > 0 ? setStep(step - 1) : navigate(-1) }} />
      <div><div className="ds-steps">{STEPS.map((s, i) => <span key={s} className={i <= step ? 'on' : ''} />)}</div><div className="ds-caption ds-muted" style={{ marginTop: 6 }}>{t('Steg')} {step + 1} {t('av')} {STEPS.length} · {t(STEPS[step])}</div></div>

      {step === 0 && (
        <Card>
          <div className="ds-stack" style={{ gap: 12 }}>
            <Field label={t('Kampanjnamn')}><input value={form.name} onChange={(e) => set({ name: e.target.value })} /></Field>
            <Field label={t('Beskrivning')} hint={t('Syns för creators i Upptäck.')}><textarea rows={3} value={form.description} onChange={(e) => set({ description: e.target.value })} /></Field>
            <div className="ds-kv">
              <Field label={t('Kategori')}><select value={form.category} onChange={(e) => set({ category: e.target.value })}>{CATEGORIES.map((c) => <option key={c} value={c}>{t(c)}</option>)}</select></Field>
              <Field label={t('Hashtag')}><input value={form.requiredHashtag} onChange={(e) => set({ requiredHashtag: e.target.value })} placeholder="#mittvarumärke" /></Field>
            </div>
            <div className="ds-kv">
              <Field label={t('Startdatum')}><DateInput value={form.startDate} onChange={(v) => set({ startDate: v })} className="ds-input" required /></Field>
              <Field label={t('Slutdatum')}><DateInput value={form.endDate} onChange={(v) => set({ endDate: v })} className="ds-input" required /></Field>
            </div>
          </div>
        </Card>
      )}

      {step === 1 && (
        <>
          <Card title={t('Budget & platser')}>
            <div className="ds-stack" style={{ gap: 12 }}>
              <Field label={t('Total budget (kr)')}><input inputMode="numeric" value={form.budget || ''} onChange={(e) => set({ budget: num(e.target.value) })} placeholder="10000" /></Field>
              <div className="ds-kv">
                <Field label={t('Max antal creators')}><input inputMode="numeric" value={form.maxCreators || ''} onChange={(e) => set({ maxCreators: num(e.target.value) })} /></Field>
                <Field label={t('Videor per creator')}><input inputMode="numeric" value={form.requiredVideoCount || ''} onChange={(e) => set({ requiredVideoCount: num(e.target.value) })} /></Field>
              </div>
            </div>
          </Card>
          <Card title={t('Utbetalningsmodell')}>
            <Chips>{([['Fixed', t('Fast belopp')], ['CPM', t('Per visning')], ['Tiered', t('Trappsteg')]] as const).map(([k, l]) => <Chip key={k} selected={form.payoutModel === k} onClick={() => setModel(k)}>{l}</Chip>)}</Chips>
            <div className="ds-stack" style={{ gap: 12, marginTop: 12 }}>
              {form.payoutModel === 'Fixed' && <div className="ds-kv"><Field label={t('Belopp per creator (kr)')}><input inputMode="numeric" value={form.payoutRules[0]?.amount || ''} onChange={(e) => updateRule(0, { amount: num(e.target.value) })} /></Field><Field label={t('Minsta antal views')}><input inputMode="numeric" value={form.payoutRules[0]?.minViews || ''} onChange={(e) => updateRule(0, { minViews: num(e.target.value) })} /></Field></div>}
              {form.payoutModel === 'CPM' && <div className="ds-kv"><Field label={t('Kr per 1 000 views')} hint={t('Minst 20 kr')}><input inputMode="numeric" value={form.payoutRules[0]?.amount || ''} onChange={(e) => updateRule(0, { amount: num(e.target.value) })} /></Field><Field label={t('Max per creator (kr)')} hint={t('Valfritt')}><input inputMode="numeric" value={form.payoutRules[0]?.maxPayoutPerCreator ?? ''} onChange={(e) => { const v = num(e.target.value); updateRule(0, { maxPayoutPerCreator: v || undefined }); }} /></Field></div>}
              {form.payoutModel === 'Tiered' && (
                <>
                  {form.payoutRules.map((r, i) => (
                    <div key={i} className="ds-row" style={{ alignItems: 'flex-end' }}>
                      <Field label={i === 0 ? t('Från views') : ''}><input inputMode="numeric" value={r.minViews || ''} onChange={(e) => updateRule(i, { minViews: num(e.target.value) })} /></Field>
                      <Field label={i === 0 ? t('Till views') : ''}><input inputMode="numeric" value={r.maxViews ?? ''} onChange={(e) => { const v = num(e.target.value); updateRule(i, { maxViews: v || undefined }); }} placeholder="∞" /></Field>
                      <Field label={i === 0 ? t('Kr') : ''}><input inputMode="numeric" value={r.amount || ''} onChange={(e) => updateRule(i, { amount: num(e.target.value) })} /></Field>
                      <Button variant="ghost" size="sm" disabled={form.payoutRules.length <= 1} onClick={() => set({ payoutRules: form.payoutRules.filter((_, j) => j !== i).map((x, j) => ({ ...x, sortOrder: j })) })} aria-label={t('Ta bort steg')}>×</Button>
                    </div>
                  ))}
                  <Button variant="ghost" size="sm" onClick={() => { const last = form.payoutRules[form.payoutRules.length - 1]; set({ payoutRules: [...form.payoutRules, { payoutType: 'Tiered', minViews: (last?.maxViews ?? last?.minViews ?? 0) + 1, amount: 0, sortOrder: form.payoutRules.length }] }); }}>{t('+ Lägg till steg')}</Button>
                </>
              )}
              {summary() && <p className="ds-caption ds-muted"><strong>{t('Sammanfattning')}:</strong> {summary()}{maxCost() > 0 ? ` · ${t('max')} ${money(maxCost())} ${t('för')} ${form.maxCreators} ${t('creators')}` : ''}</p>}
              {maxCost() > 0 && form.budget > 0 && form.budget < maxCost() && <p className="ds-caption" style={{ color: 'var(--ds-warn)' }}>{t('Budgeten är lägre än maxkostnaden om alla creators får max.')}</p>}
            </div>
          </Card>
        </>
      )}

      {step === 2 && (
        <>
          <Card>
            <div className="ds-stack" style={{ gap: 12 }}>
              <Field label={t('Instruktioner till creators')}><textarea rows={3} value={form.contentInstructions ?? ''} onChange={(e) => set({ contentInstructions: e.target.value })} placeholder={t('Beskriv vad creators ska göra…')} /></Field>
              <Field label={t('Förmåner & PR (valfritt)')} hint={t('Rabattkod, PR-utskick, gratisprodukt…')}><textarea rows={2} value={form.perks ?? ''} onChange={(e) => set({ perks: e.target.value })} /></Field>
            </div>
          </Card>
          <Card title={t('Innehållstaggar')}>
            <div className="ds-caption ds-muted" style={{ marginBottom: 6 }}>{t('Plattform & format')}</div>
            <div className="ds-tags">{PLATFORM_TAGS.map((tg) => <button key={tg} type="button" className={`ds-tag${form.contentTags.includes(tg) ? ' ds-tag--on' : ''}`} onClick={() => toggleTag(tg)}>{tg}</button>)}</div>
            <div className="ds-caption ds-muted" style={{ margin: '12px 0 6px' }}>{t('Nisch & kategori')}</div>
            <div className="ds-tags">{NICHE_TAGS.map((tg) => <button key={tg} type="button" className={`ds-tag${form.contentTags.includes(tg) ? ' ds-tag--on' : ''}`} onClick={() => toggleTag(tg)}>{tg}</button>)}</div>
          </Card>
        </>
      )}

      {step === 3 && (
        <Card title={form.name}>
          <div className="ds-facts">
            <div className="ds-fact"><span>{t('Kategori')}</span><span>{t(form.category)}</span></div>
            <div className="ds-fact"><span>{t('Period')}</span><span>{form.startDate} – {form.endDate}</span></div>
            <div className="ds-fact"><span>{t('Budget')}</span><span className="ds-num">{money(form.budget)}</span></div>
            <div className="ds-fact"><span>{t('Creators')}</span><span className="ds-num">{form.maxCreators} × {form.requiredVideoCount} {t('videor')}</span></div>
            <div className="ds-fact"><span>{t('Ersättning')}</span><span>{summary()}</span></div>
            <div className="ds-fact"><span>{t('Hashtag')}</span><span>{form.requiredHashtag}</span></div>
          </div>
          <p className="ds-caption ds-muted" style={{ marginTop: 10 }}>{t('Kampanjen granskas av VYRLE innan den öppnas för ansökningar.')}</p>
        </Card>
      )}

      {error && <p className="ds-body" style={{ color: 'var(--ds-bad)', fontWeight: 600 }}>{error}</p>}
      <StickyAction>{step < STEPS.length - 1 ? <Button full onClick={next}>{t('Fortsätt')}</Button> : <Button full loading={create.isPending} onClick={() => void submit()}>{t('Skicka för granskning')}</Button>}</StickyAction>
    </Page>
  );
}
