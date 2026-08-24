import { useNavigate } from 'react-router-dom';
import { t } from '@/lib/i18n';
import { formatCurrency, formatNumber, formatDate } from '@/lib/utils';
import { CardSkeleton } from '@/components/vyrle/Toast';
import { CopyButton } from '@/components/ui/CopyButton';
import { useCreatorTaps, type CreatorTap } from '@/components/vyrle/CreatorTaps';

const Meter = ({ value, max, danger }: { value: number; max: number; danger?: boolean }) => {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div style={{ height: 9, borderRadius: 980, background: 'rgba(241,168,143,.18)', overflow: 'hidden' }}>
      <div style={{ width: `${pct}%`, height: '100%', borderRadius: 980, transition: 'width .5s', background: danger && pct >= 100 ? 'linear-gradient(90deg,#ff8a7a,#cf4b4b)' : 'linear-gradient(90deg,#FFD8C7,#F1A88F)' }} />
    </div>
  );
};

/** Everything a creator draws continuously — one page per kind of work. */
export function CreatorTapsPage() {
  const navigate = useNavigate();
  const { data: taps = [], isLoading } = useCreatorTaps();

  const monthEarned = taps.reduce((s, x) => s + x.myMonthEarned, 0);
  const monthViews = taps.reduce((s, x) => s + x.myMonthViews, 0);
  const lifetime = taps.reduce((s, x) => s + x.myLifetimeEarned, 0);
  const open = taps.filter((x) => x.tapStatus === 'Active' && x.membershipStatus === 'Active').length;

  return (
    <section className="view active reveal">
      <div className="page-head">
        <div>
          <h1 className="page-title">💧 {t('Dina')} <em>{t('kranar')}</em></h1>
          <p className="page-sub">{t('Löpande ersättning från företag vars community du är med i. Publicera när du vill — betalt per verifierad view, varje månad.')}</p>
        </div>
      </div>

      <div className="vstat-row">
        <div className="card vstat" style={{ background: 'linear-gradient(160deg,#fff,#FFF6F0)' }}>
          <div className="vstat-lbl">{t('Denna månad')}</div>
          <div className="vstat-val">{formatCurrency(monthEarned)}</div>
          <div className="vstat-sub"><span className="vmut">{formatNumber(monthViews)} views</span></div>
        </div>
        <div className="card vstat">
          <div className="vstat-lbl">{t('Totalt från kranar')}</div>
          <div className="vstat-val">{formatCurrency(lifetime)}</div>
          <div className="vstat-sub"><span className="vmut">{t('sedan start')}</span></div>
        </div>
        <div className="card vstat">
          <div className="vstat-lbl">{t('Öppna kranar')}</div>
          <div className="vstat-val">{open}</div>
          <div className="vstat-sub"><span className="vmut">{t('av')} {taps.length}</span></div>
        </div>
      </div>

      {isLoading ? <CardSkeleton rows={3} /> : taps.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '54px 24px' }}>
          <div style={{ fontSize: 30, marginBottom: 10 }} aria-hidden>💧</div>
          <div style={{ fontSize: 18, fontWeight: 700 }}>{t('Du är inte med i någon kran ännu')}</div>
          <div style={{ color: 'var(--muted)', fontSize: 14, marginTop: 8, maxWidth: 460, marginInline: 'auto', lineHeight: 1.6 }}>
            {t('Kör en kampanj för ett företag så kvalificerar du in i deras community automatiskt — eller ansök direkt från företagets profil.')}
          </div>
          <button type="button" className="btn-apply" style={{ width: 'auto', padding: '11px 22px', marginTop: 16 }} onClick={() => navigate('/creator/browse')}>
            {t('Hitta kampanjer')}
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 16 }}>
          {taps.map((tap) => <TapCard key={tap.tapId} tap={tap} onOpen={() => navigate(`/creator/assignments/${tap.assignmentId}`)} onBrand={() => navigate(`/creator/brands/${tap.brandProfileId}`)} />)}
        </div>
      )}
    </section>
  );
}

function TapCard({ tap, onOpen, onBrand }: { tap: CreatorTap; onOpen: () => void; onBrand: () => void }) {
  const isOpen = tap.tapStatus === 'Active' && tap.membershipStatus === 'Active';
  const tapPct = tap.tapMonthBudget > 0 ? Math.round((tap.tapMonthSpent / tap.tapMonthBudget) * 100) : 0;
  const full = tapPct >= 100;

  return (
    <div className="card" style={{ background: 'linear-gradient(160deg,#fff,#FFF9F5)' }}>
      {/* identity */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
        <div role="button" tabIndex={0} onClick={onBrand} onKeyDown={(e) => { if (e.key === 'Enter') onBrand(); }} style={{ cursor: 'pointer', flex: '0 0 auto' }} title={t('Visa företagsprofil')}>
          {tap.brandLogoUrl
            ? <img src={tap.brandLogoUrl} alt="" style={{ width: 52, height: 52, borderRadius: 15, objectFit: 'cover' }} />
            : <span style={{ width: 52, height: 52, borderRadius: 15, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg,#FFD8C7,#F1A88F)', color: '#fff', fontWeight: 800, fontFamily: '"Fraunces",serif', fontSize: 21 }}>{(tap.brandName[0] || '?').toUpperCase()}</span>}
        </div>
        <div style={{ flex: '1 1 200px', minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span role="button" tabIndex={0} onClick={onBrand} onKeyDown={(e) => { if (e.key === 'Enter') onBrand(); }} style={{ fontWeight: 800, fontSize: 16, cursor: 'pointer', wordBreak: 'break-word' }}>{tap.brandName}</span>
            <span className={`vy-badge ${isOpen ? 'pos' : 'neu'}`}>{isOpen ? t('Öppen') : t('Pausad')}</span>
          </div>
          <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 2, wordBreak: 'break-word' }}>
            <strong style={{ color: '#9c4f31' }}>{tap.cpm} kr / 1 000 views</strong>
            {tap.payoutCapPerVideo ? ` · ${t('max')} ${formatCurrency(tap.payoutCapPerVideo)} / video` : ''}
            {tap.monthlyCapPerCreator ? ` · ${t('max')} ${formatCurrency(tap.monthlyCapPerCreator)} / ${t('mån')}` : ''}
          </div>
        </div>
        <button type="button" className="btn-apply" style={{ width: 'auto', padding: '11px 20px', flex: '0 0 auto' }} onClick={onOpen}>
          {t('Lägg till video')} →
        </button>
      </div>

      {/* money */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))', gap: 14, marginTop: 16 }}>
        <div style={{ padding: '14px 16px', borderRadius: 15, background: 'rgba(255,255,255,.85)', border: '1px solid rgba(241,168,143,.25)' }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.07em', textTransform: 'uppercase', color: 'var(--muted)' }}>{t('Du denna månad')}</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap', marginTop: 3 }}>
            <span style={{ fontFamily: '"Fraunces",serif', fontSize: 26, fontWeight: 700 }}>{formatCurrency(tap.myMonthEarned)}</span>
            <span style={{ fontSize: 12.5, color: 'var(--muted)' }}>{formatNumber(tap.myMonthViews)} views</span>
          </div>
          {tap.monthlyCapPerCreator ? (
            <div style={{ marginTop: 8 }}>
              <Meter value={tap.myMonthEarned} max={tap.monthlyCapPerCreator} />
              <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 4 }}>{t('av ditt månadstak')} {formatCurrency(tap.monthlyCapPerCreator)}</div>
            </div>
          ) : (
            <div style={{ fontSize: 11.5, color: 'var(--muted)', marginTop: 6 }}>{t('Inget månadstak — det du levererar är det du tjänar.')}</div>
          )}
        </div>

        <div style={{ padding: '14px 16px', borderRadius: 15, background: 'rgba(255,255,255,.85)', border: '1px solid rgba(241,168,143,.25)' }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.07em', textTransform: 'uppercase', color: 'var(--muted)' }}>{t('Kranens månad')}</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap', marginTop: 3 }}>
            <span style={{ fontFamily: '"Fraunces",serif', fontSize: 26, fontWeight: 700, color: full ? '#b3402f' : '#0B0F17' }}>{tapPct}%</span>
            <span style={{ fontSize: 12.5, color: 'var(--muted)' }}>{formatCurrency(tap.tapMonthSpent)} {t('av')} {formatCurrency(tap.tapMonthBudget)}</span>
          </div>
          <div style={{ marginTop: 8 }}><Meter value={tap.tapMonthSpent} max={tap.tapMonthBudget} danger /></div>
          <div style={{ fontSize: 11, color: full ? '#b3402f' : 'var(--muted)', marginTop: 4, fontWeight: full ? 700 : 400 }}>
            {full ? t('Månadsbudgeten är slut — öppnar den 1:a') : t('Först till kvarn tills budgeten är slut')}
          </div>
        </div>
      </div>

      {/* the standing brief */}
      <div style={{ marginTop: 14, padding: '14px 16px', borderRadius: 15, background: 'rgba(255,244,236,.7)', border: '1px solid rgba(241,168,143,.22)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.07em', textTransform: 'uppercase', color: 'var(--muted)' }}>
            {t('Stående brief')}{tap.briefUpdatedAt ? ` · ${t('uppdaterad')} ${formatDate(tap.briefUpdatedAt)}` : ''}
          </span>
          <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="tag g">#{tap.requiredHashtag}</span>
            <CopyButton text={`#${tap.requiredHashtag}`} />
          </span>
        </div>
        <p style={{ margin: '8px 0 0', fontSize: 13.5, lineHeight: 1.6, color: 'var(--ink-2)', whiteSpace: 'pre-line', wordBreak: 'break-word' }}>{tap.brief}</p>
        {tap.contentInstructions && (
          <p style={{ margin: '10px 0 0', fontSize: 12.5, lineHeight: 1.6, color: 'var(--muted)', whiteSpace: 'pre-line', wordBreak: 'break-word' }}>{tap.contentInstructions}</p>
        )}
      </div>
    </div>
  );
}
