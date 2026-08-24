import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { t } from '@/lib/i18n';
import { formatCurrency, formatNumber } from '@/lib/utils';
import { useToast } from '@/components/vyrle/Toast';
import type { ApiResponse } from '@/types';

interface Payable {
  assignmentId: string; calculationId: string; campaignName: string; isTap: boolean;
  earned: number; alreadyClaimed: number; available: number; hasPendingRequest: boolean;
  verifiedViews: number; calculatedAt: string;
}

/** Where a creator actually cashes out — campaigns and taps in one place. */
export function PayoutRequestCard() {
  const qc = useQueryClient();
  const toast = useToast();
  const [busyId, setBusyId] = useState<string | null>(null);

  const { data: payables = [], isLoading } = useQuery({
    queryKey: ['payables'],
    queryFn: async () => (await api.get<ApiResponse<Payable[]>>('/payouts/payable')).data.data,
    refetchInterval: 60000,
  });

  const request = useMutation({
    mutationFn: async (calculationId: string) =>
      (await api.post('/payouts/request', { calculationId })).data.data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['payables'] });
      qc.invalidateQueries({ queryKey: ['creator-payouts'] });
      toast.push(t('Utbetalning begärd! Vi granskar och betalar ut till din valda metod.'), 'success');
    },
    onError: (e: any) => toast.push(e?.response?.data?.error?.message ?? t('Kunde inte begära utbetalning'), 'error'),
  });

  if (isLoading) return null;

  const totalAvailable = payables.reduce((s, p) => s + p.available, 0);
  const anythingPending = payables.some((p) => p.hasPendingRequest);

  return (
    <div className="card" style={{ marginTop: 18, background: totalAvailable > 0 ? 'linear-gradient(160deg,#fff,#F3FBF6)' : undefined, border: totalAvailable > 0 ? '1px solid rgba(95,185,138,.4)' : undefined }}>
      <div className="sec-head" style={{ flexWrap: 'wrap', gap: '4px 12px' }}>
        <h3>{t('Begär utbetalning')}</h3>
        {totalAvailable > 0 && (
          <span style={{ fontSize: 13, color: '#2c7a51', fontWeight: 700 }}>
            {formatCurrency(totalAvailable)} {t('att hämta ut')}
          </span>
        )}
      </div>

      {payables.length === 0 ? (
        <p style={{ margin: 0, fontSize: 13.5, color: 'var(--muted)', lineHeight: 1.6 }}>
          {t('Inget att begära ut ännu. Så fort dina views verifierats dyker beloppet upp här.')}
        </p>
      ) : (
        <div style={{ display: 'grid', gap: 10 }}>
          {payables.map((p) => (
            <div
              key={p.assignmentId}
              style={{
                display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', minWidth: 0,
                padding: '14px 16px', borderRadius: 16,
                background: 'rgba(255,255,255,.8)', border: '1px solid rgba(241,168,143,.24)',
              }}
            >
              <div style={{ flex: '1 1 200px', minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontWeight: 700, fontSize: 14.5, wordBreak: 'break-word' }}>{p.campaignName}</span>
                  {p.isTap && <span className="vy-badge info">💧 {t('Kranen')}</span>}
                </div>
                <div style={{ fontSize: 12.5, color: 'var(--muted)', marginTop: 3 }}>
                  {formatNumber(p.verifiedViews)} {t('verifierade views')} · {t('intjänat')} {formatCurrency(p.earned)}
                  {p.alreadyClaimed > 0 ? ` · ${t('redan utbetalt/begärt')} ${formatCurrency(p.alreadyClaimed)}` : ''}
                </div>
              </div>

              <div style={{ textAlign: 'right', flex: '0 0 auto' }}>
                <div style={{ fontFamily: '"Fraunces",serif', fontSize: 22, fontWeight: 700, color: p.available > 0 ? '#2c7a51' : 'var(--muted)' }}>
                  {formatCurrency(p.available)}
                </div>
                <div style={{ fontSize: 11, color: 'var(--muted)' }}>{t('att hämta ut')}</div>
              </div>

              <div style={{ flex: '0 0 auto' }}>
                {p.hasPendingRequest ? (
                  <span className="vy-badge pend">{t('Utbetalning pågår')}</span>
                ) : p.available > 0 ? (
                  <button
                    type="button"
                    className="btn-apply"
                    style={{ width: 'auto', padding: '10px 20px' }}
                    disabled={request.isPending && busyId === p.calculationId}
                    onClick={() => { setBusyId(p.calculationId); request.mutate(p.calculationId); }}
                  >
                    {request.isPending && busyId === p.calculationId ? t('Skickar…') : t('Begär utbetalning')}
                  </button>
                ) : (
                  <span className="vy-badge neu">{t('Allt utbetalt')}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={{ marginTop: 12, fontSize: 12, color: 'var(--muted)', lineHeight: 1.6 }}>
        {anythingPending
          ? t('En begäran i taget per uppdrag — nästa kan skickas när den pågående är utbetald.')
          : t('Du begär ut det som är verifierat. Vi granskar och betalar till din valda utbetalningsmetod.')}
      </div>
    </div>
  );
}
