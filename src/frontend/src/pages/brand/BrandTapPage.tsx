import { useState } from 'react';
import type { CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { t } from '@/lib/i18n';
import { formatCurrency, formatNumber, formatDate } from '@/lib/utils';
import { useToast, CardSkeleton } from '@/components/vyrle/Toast';
import type { ApiResponse } from '@/types';

export interface TapDto {
  id: string; name: string; status: string; monthlyBudget: number; cpm: number;
  payoutCapPerVideo?: number | null; monthlyCapPerCreator?: number | null;
  brief: string; contentInstructions?: string | null; requiredHashtag: string; category: string;
  monthSpent: number; monthRemaining: number; monthViews: number; activeCreatorsThisMonth: number;
  memberCount: number; briefUpdatedAt?: string | null; createdAt: string;
}

const input: CSSProperties = { width: '100%', border: '1px solid rgba(241,168,143,.28)', borderRadius: 13, padding: '12px 14px', fontSize: 13.5, fontFamily: 'inherit', background: 'rgba(255,255,255,.8)', color: '#0B0F17' };
const lbl: CSSProperties = { fontSize: 12, fontWeight: 700, letterSpacing: '.05em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 6, display: 'block' };
const hint: CSSProperties = { fontSize: 11.5, color: 'var(--muted)', marginTop: 5, lineHeight: 1.45 };

export function useBrandTap() {
  return useQuery({
    queryKey: ['brand-tap'],
    queryFn: async () => (await api.get<ApiResponse<TapDto | null>>('/brand/tap')).data.data,
  });
}

function TapForm({ tap, onDone }: { tap: TapDto | null; onDone: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [form, setForm] = useState({
    name: tap?.name ?? '',
    monthlyBudget: tap ? String(tap.monthlyBudget) : '',
    cpm: tap ? String(tap.cpm) : '25',
    payoutCapPerVideo: tap?.payoutCapPerVideo ? String(tap.payoutCapPerVideo) : '',
    monthlyCapPerCreator: tap?.monthlyCapPerCreator ? String(tap.monthlyCapPerCreator) : '',
    brief: tap?.brief ?? '',
    contentInstructions: tap?.contentInstructions ?? '',
    requiredHashtag: tap?.requiredHashtag ?? '',
    category: tap?.category ?? '',
  });
  const [err, setErr] = useState('');
  const save = useMutation({
    mutationFn: async () => (await api.put('/brand/tap', {
      name: form.name,
      monthlyBudget: Number(form.monthlyBudget),
      cpm: Number(form.cpm),
      payoutCapPerVideo: form.payoutCapPerVideo ? Number(form.payoutCapPerVideo) : null,
      monthlyCapPerCreator: form.monthlyCapPerCreator ? Number(form.monthlyCapPerCreator) : null,
      brief: form.brief,
      contentInstructions: form.contentInstructions || null,
      requiredHashtag: form.requiredHashtag,
      category: form.category || null,
    })).data.data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['brand-tap'] });
      toast.push(tap ? t('Kranen uppdaterad') : t('Kranen är öppen! Alla i din community kan nu hämta.'), 'success');
      onDone();
    },
    onError: (e: any) => setErr(e?.response?.data?.error?.message ?? e?.response?.data?.error?.details?.[0] ?? t('Kunde inte spara kranen')),
  });

  // Live math — everything the brand needs to judge the tap before opening it.
  const cpm = Number(form.cpm) || 0;
  const budget = Number(form.monthlyBudget) || 0;
  const capVideo = Number(form.payoutCapPerVideo) || 0;      // 0 = no cap
  const capCreator = Number(form.monthlyCapPerCreator) || 0; // 0 = no cap
  const viewsPerMonth = cpm > 0 ? Math.floor((budget / cpm) * 1000) : 0;
  const payFor = (views: number) => {
    const raw = (views * cpm) / 1000;
    return capVideo > 0 ? Math.min(raw, capVideo) : raw;
  };
  const capKicksInAt = capVideo > 0 && cpm > 0 ? Math.floor((capVideo / cpm) * 1000) : 0;
  const minCreators = capCreator > 0 && budget > 0 ? Math.ceil(budget / capCreator) : 0;
  const minVideos = capVideo > 0 && budget > 0 ? Math.ceil(budget / capVideo) : 0;
  const ready = budget > 0 && cpm > 0;

  return (
    <form className="card" onSubmit={(e) => { e.preventDefault(); setErr(''); save.mutate(); }} style={{ border: '1px solid rgba(241,168,143,.4)', minWidth: 0 }}>
      <div className="sec-head"><h3>{tap ? t('Redigera kranen') : t('Öppna kranen')}</h3></div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16, minWidth: 0 }}>
        <div style={{ gridColumn: '1 / -1' }}>
          <span style={lbl}>{t('Namn på kranen')}</span>
          <input style={input} required maxLength={120} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder={t('t.ex. Nellie Creators — löpande')} />
        </div>
        <div>
          <span style={lbl}>{t('Månadsbudget (SEK)')}</span>
          <input style={input} type="number" min={500} step={100} required value={form.monthlyBudget} onChange={(e) => setForm({ ...form, monthlyBudget: e.target.value })} placeholder="10000" />
          <div style={hint}>{t('Hårt tak. Månaden stannar vid 100 % — inget förs över.')}</div>
        </div>
        <div>
          <span style={lbl}>{t('CPM — kr per 1 000 views')}</span>
          <input style={input} type="number" min={20} step={1} required value={form.cpm} onChange={(e) => setForm({ ...form, cpm: e.target.value })} />
          <div style={hint}>{t('Minst 20 kr. Fast för hela kranen.')}</div>
        </div>
        <div>
          <span style={lbl}>{t('Tak per video (SEK)')}</span>
          <input style={input} type="number" min={0} step={50} value={form.payoutCapPerVideo} onChange={(e) => setForm({ ...form, payoutCapPerVideo: e.target.value })} placeholder={t('valfritt')} />
          <div style={hint}>{capVideo > 0 && cpm > 0
            ? <>{t('Taket slår in vid')} <strong>{formatNumber(capKicksInAt)}</strong> {t('views per video.')}</>
            : t('Tomt = inget tak. Med tak kan en enskild video max ge så här mycket.')}</div>
        </div>
        <div>
          <span style={lbl}>{t('Månadstak per creator (SEK)')}</span>
          <input style={input} type="number" min={0} step={100} value={form.monthlyCapPerCreator} onChange={(e) => setForm({ ...form, monthlyCapPerCreator: e.target.value })} placeholder={t('valfritt')} />
          <div style={hint}>{capCreator > 0 && budget > 0
            ? <>{t('Budgeten räcker till minst')} <strong>{minCreators}</strong> {t('creators per månad.')}</>
            : t('Tomt = inget tak. Med tak sprids budgeten över fler creators.')}</div>
        </div>
        <div style={{ gridColumn: '1 / -1', padding: '16px 18px', borderRadius: 16, background: ready ? 'linear-gradient(160deg,#fff,#FFF6F0)' : 'rgba(183,188,200,.10)', border: '1px solid rgba(241,168,143,.3)', minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--muted)' }}>{t('Så här räknar kranen')}</span>
            {!ready && <span style={{ fontSize: 12.5, color: 'var(--muted)' }}>{t('Fyll i månadsbudget och CPM så räknar vi åt dig.')}</span>}
          </div>

          {ready && (
            <>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap', marginTop: 10 }}>
                <span style={{ fontFamily: '"Fraunces",serif', fontSize: 30, fontWeight: 700, color: '#0B0F17' }}>{formatNumber(viewsPerMonth)}</span>
                <span style={{ fontSize: 13.5, color: 'var(--muted)' }}>{t('views i månaden köper budgeten')} ({formatCurrency(budget)} ÷ {cpm} kr × 1 000)</span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 210px), 1fr))', gap: 10, marginTop: 14 }}>
                <div style={{ padding: '10px 12px', borderRadius: 12, background: 'rgba(255,255,255,.75)', border: '1px solid rgba(241,168,143,.22)' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--muted)' }}>{t('Spridning')}</div>
                  <div style={{ fontSize: 13.5, marginTop: 3, lineHeight: 1.5 }}>
                    {capCreator > 0
                      ? <>{t('Minst')} <strong>{minCreators}</strong> {t('creators kan maxa sin månad.')}</>
                      : <span style={{ color: '#9c6b1c' }}>⚠ {t('Inget månadstak — en ensam creator kan ta hela budgeten.')}</span>}
                  </div>
                </div>
                <div style={{ padding: '10px 12px', borderRadius: 12, background: 'rgba(255,255,255,.75)', border: '1px solid rgba(241,168,143,.22)' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--muted)' }}>{t('Per video')}</div>
                  <div style={{ fontSize: 13.5, marginTop: 3, lineHeight: 1.5 }}>
                    {capVideo > 0
                      ? <>{t('Max')} <strong>{formatCurrency(capVideo)}</strong> {t('per video — minst')} <strong>{minVideos}</strong> {t('videos för att förbruka månaden.')}</>
                      : <span style={{ color: '#9c6b1c' }}>⚠ {t('Inget tak per video — en viral video kan äta stora delar av månaden.')}</span>}
                  </div>
                </div>
              </div>

              <div style={{ marginTop: 14 }}>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 6 }}>{t('Så mycket tjänar en creator på en video')}</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 120px), 1fr))', gap: 8 }}>
                  {[1000, 10000, 100000, 1000000].map((v) => {
                    const amount = payFor(v);
                    const capped = capVideo > 0 && (v * cpm) / 1000 > capVideo;
                    return (
                      <div key={v} style={{ padding: '10px 12px', borderRadius: 12, textAlign: 'center', background: capped ? 'rgba(242,197,138,.22)' : 'rgba(255,244,236,.85)', border: '1px solid rgba(241,168,143,.22)' }}>
                        <div style={{ fontSize: 11.5, color: 'var(--muted)', fontWeight: 600 }}>{formatNumber(v)} views</div>
                        <div style={{ fontWeight: 800, fontSize: 16, color: '#0B0F17', marginTop: 2 }}>{formatCurrency(amount)}</div>
                        {capped && <div style={{ fontSize: 10.5, fontWeight: 700, color: '#9c6b1c', marginTop: 1 }}>{t('tak nått')}</div>}
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>

        <div>
          <span style={lbl}>{t('Hashtag')}</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
            <span style={{ fontWeight: 800, color: '#9c4f31', flex: '0 0 auto' }}>#</span>
            <input style={{ ...input, flex: '1 1 auto', minWidth: 0 }} required maxLength={60} value={form.requiredHashtag} onChange={(e) => setForm({ ...form, requiredHashtag: e.target.value.replace(/^#/, '') })} placeholder="nelliecreators" />
          </div>
        </div>
        <div>
          <span style={lbl}>{t('Kategori')}</span>
          <input style={input} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder={t('t.ex. Mode')} />
        </div>
        <div style={{ gridColumn: '1 / -1' }}>
          <span style={lbl}>{t('Stående brief — vad vill ni se?')}</span>
          <textarea style={{ ...input, resize: 'vertical' }} rows={4} required maxLength={4000} value={form.brief} onChange={(e) => setForm({ ...form, brief: e.target.value })} placeholder={t('Produkter, ton, vad som funkar. Detta ser alla i din community varje gång de skapar.')} />
        </div>
        <div style={{ gridColumn: '1 / -1' }}>
          <span style={lbl}>{t('Hooks, regler & dos/don\'ts (valfritt)')}</span>
          <textarea style={{ ...input, resize: 'vertical' }} rows={3} maxLength={4000} value={form.contentInstructions} onChange={(e) => setForm({ ...form, contentInstructions: e.target.value })} placeholder={t('Hooks som funkar, hashtags utöver er egen, vad som INTE får förekomma.')} />
        </div>
      </div>
      {err && <div style={{ marginTop: 12, fontSize: 13, fontWeight: 600, color: '#cf4b4b' }}>{err}</div>}
      <div style={{ display: 'flex', gap: 10, marginTop: 18, flexWrap: 'wrap' }}>
        <button type="submit" className="btn-apply" style={{ width: 'auto', padding: '12px 26px' }} disabled={save.isPending}>{save.isPending ? t('Sparar…') : tap ? t('Spara ändringar') : t('Öppna kranen')}</button>
        {tap && <button type="button" className="btn-outline" style={{ width: 'auto', padding: '12px 26px' }} onClick={onDone}>{t('Avbryt')}</button>}
      </div>
    </form>
  );
}

export function BrandTapPage() {
  const { data: tap, isLoading } = useBrandTap();
  const qc = useQueryClient();
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const status = useMutation({
    mutationFn: async (active: boolean) => (await api.post(`/brand/tap/status?active=${active}`)).data.data,
    onSuccess: (_d, active) => { qc.invalidateQueries({ queryKey: ['brand-tap'] }); toast.push(active ? t('Kranen är öppen igen') : t('Kranen är pausad'), 'success'); },
  });

  if (isLoading) return <section className="view active reveal"><CardSkeleton rows={4} /></section>;

  const pct = tap && tap.monthlyBudget > 0 ? Math.min(100, Math.round((tap.monthSpent / tap.monthlyBudget) * 100)) : 0;
  const isActive = tap?.status === 'Active';

  return (
    <section className="view active reveal">
      <div className="page-head">
        <div>
          <h1 className="page-title">{t('Kranen')} <em>{t('löpande')}</em></h1>
          <p className="page-sub">{t('En stående månadsbudget som kontinuerligt betalar din creator-community för godkänt innehåll. Förutsägbart för dig, jämn intjäning för creators.')}</p>
        </div>
        {tap && !editing && (
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button className="btn-outline" style={{ width: 'auto', padding: '12px 22px' }} onClick={() => setEditing(true)}>✎ {t('Redigera')}</button>
            <button className={isActive ? 'btn-outline' : 'btn-apply'} style={{ width: 'auto', padding: '12px 22px' }} onClick={() => status.mutate(!isActive)} disabled={status.isPending}>
              {isActive ? t('Pausa kranen') : t('Öppna kranen igen')}
            </button>
          </div>
        )}
      </div>

      {!tap || editing ? (
        <>
          {!tap && (
            <div className="card" style={{ marginBottom: 16, background: 'linear-gradient(160deg,#fff,#FFF6F0)' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
                {[
                  ['1', t('Sätt en månadsbudget'), t('Hårt tak — du vet exakt vad månaden kostar.')],
                  ['2', t('Fast CPM & brief'), t('Din community vet vad som gäller och vad det ger.')],
                  ['3', t('Creators skapar löpande'), t('Godkänt innehåll betalas per verifierad view tills budgeten är nådd.')],
                ].map(([n, h, s]) => (
                  <div key={n} style={{ display: 'flex', gap: 12, minWidth: 0 }}>
                    <span style={{ width: 30, height: 30, borderRadius: '50%', background: 'linear-gradient(135deg,#1A2230,#0B0F17)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, flex: '0 0 30px' }}>{n}</span>
                    <div style={{ minWidth: 0 }}><div style={{ fontWeight: 700, fontSize: 14 }}>{h}</div><div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 2 }}>{s}</div></div>
                  </div>
                ))}
              </div>
            </div>
          )}
          <TapForm tap={tap ?? null} onDone={() => setEditing(false)} />
        </>
      ) : (
        <>
          {/* ── Month meter ── */}
          <div className="card" style={{ marginBottom: 16, background: isActive ? 'linear-gradient(160deg,#fff,#FFF6F0)' : 'rgba(183,188,200,.12)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 10 }}>
              <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>{tap.name}</h3>
              <span className={`badge ${isActive ? 'green' : 'grey'}`}>{isActive ? t('Öppen') : t('Pausad')}</span>
              <span style={{ marginLeft: 'auto', fontSize: 13, color: 'var(--muted)' }}>{t('Denna månad')}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
              <span style={{ fontFamily: '"Fraunces",serif', fontSize: 34, fontWeight: 700, color: '#0B0F17' }}>{formatCurrency(tap.monthSpent)}</span>
              <span style={{ fontSize: 14, color: 'var(--muted)' }}>{t('av')} {formatCurrency(tap.monthlyBudget)} · {pct}%</span>
              <span style={{ marginLeft: 'auto', fontSize: 13, fontWeight: 700, color: pct >= 100 ? '#cf4b4b' : '#2f7d52' }}>{pct >= 100 ? t('Månaden är full — öppnar igen den 1:a') : `${formatCurrency(tap.monthRemaining)} ${t('kvar')}`}</span>
            </div>
            <div style={{ height: 12, borderRadius: 980, background: 'rgba(241,168,143,.18)', marginTop: 12, overflow: 'hidden' }}>
              <div style={{ width: `${pct}%`, height: '100%', borderRadius: 980, background: pct >= 100 ? 'linear-gradient(90deg,#ff8a7a,#cf4b4b)' : 'linear-gradient(90deg,#FFD8C7,#F1A88F)', transition: 'width .6s' }} />
            </div>
          </div>

          <div className="stat-row">
            <div className="card stat"><div className="top"><div><div className="lbl">{t('Views denna månad')}</div><div className="val">{formatNumber(tap.monthViews)}</div></div></div></div>
            <div className="card stat"><div className="top"><div><div className="lbl">{t('Aktiva creators i månaden')}</div><div className="val">{tap.activeCreatorsThisMonth}</div></div></div></div>
            <div className="card stat"><div className="top"><div><div className="lbl">{t('Community')}</div><div className="val">{tap.memberCount}</div></div></div></div>
            <div className="card stat"><div className="top"><div><div className="lbl">CPM</div><div className="val">{tap.cpm} kr</div></div></div></div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16 }}>
            <div className="card">
              <div className="sec-head"><h3>{t('Stående brief')}</h3>{tap.briefUpdatedAt && <span style={{ fontSize: 12, color: 'var(--muted)' }}>{t('Uppdaterad')} {formatDate(tap.briefUpdatedAt)}</span>}</div>
              <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, whiteSpace: 'pre-line' }}>{tap.brief}</p>
              {tap.contentInstructions && <p style={{ margin: '12px 0 0', fontSize: 13, lineHeight: 1.6, color: 'var(--ink-2)', whiteSpace: 'pre-line' }}>{tap.contentInstructions}</p>}
              <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <span className="tag g">#{tap.requiredHashtag}</span>
                {tap.payoutCapPerVideo && <span className="tag">{t('max')} {formatCurrency(tap.payoutCapPerVideo)} / video</span>}
                {tap.monthlyCapPerCreator && <span className="tag">{t('max')} {formatCurrency(tap.monthlyCapPerCreator)} / creator / {t('mån')}</span>}
              </div>
            </div>
            <div className="card">
              <div className="sec-head"><h3>{t('Så fylls kranen på')}</h3></div>
              <ol style={{ margin: 0, paddingLeft: 18, fontSize: 13.5, lineHeight: 1.7, color: 'var(--ink-2)' }}>
                <li>{t('Alla som gjort en kampanj med er är redan medlemmar. Bjud in fler under')} <Link to="/brand/community" style={{ color: '#9c4f31', fontWeight: 700 }}>{t('Community')}</Link>.</li>
                <li>{t('Medlemmar publicerar med sin tracking-tag — videorna hittas och verifieras automatiskt.')}</li>
                <li>{t('Views räknas per verifierad video tills månadens tak är nått. Du godkänner/nekar som vanligt.')}</li>
                <li>{t('Posta en uppdatering på')} <Link to="/brand/public-profile" style={{ color: '#9c4f31', fontWeight: 700 }}>{t('Min profil')}</Link> {t('när ni vill styra innehållet — "mer unboxing", "fokus på nya kollektionen".')}</li>
              </ol>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
