import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number, currency = 'SEK'): string {
  return new Intl.NumberFormat('sv-SE', { style: 'currency', currency }).format(amount);
}

export function formatNumber(n: number): string {
  return new Intl.NumberFormat('sv-SE').format(n);
}

export function formatDate(date: string): string {
  return new Date(date).toLocaleDateString('sv-SE');
}

export function formatDateTime(date: string): string {
  return new Date(date).toLocaleString('sv-SE');
}

export function getStatusColor(status: string): string {
  // Warm editorial palette — soft tinted backgrounds, deep ink foregrounds.
  const colors: Record<string, string> = {
    Active:               'bg-[hsl(90_22%_32%_/_0.12)]  text-[hsl(90_22%_24%)]   ring-1 ring-[hsl(90_22%_32%_/_0.25)]',
    Approved:             'bg-[hsl(90_22%_32%_/_0.12)]  text-[hsl(90_22%_24%)]   ring-1 ring-[hsl(90_22%_32%_/_0.25)]',
    Verified:             'bg-[hsl(90_22%_32%_/_0.12)]  text-[hsl(90_22%_24%)]   ring-1 ring-[hsl(90_22%_32%_/_0.25)]',
    Completed:            'bg-[hsl(28_14%_13%_/_0.06)]  text-[hsl(28_14%_18%)]   ring-1 ring-[hsl(28_14%_13%_/_0.18)]',
    Pending:              'bg-[hsl(36_55%_88%)]         text-[hsl(28_65%_28%)]   ring-1 ring-[hsl(28_65%_38%_/_0.30)]',
    PendingApproval:      'bg-[hsl(36_55%_88%)]         text-[hsl(28_65%_28%)]   ring-1 ring-[hsl(28_65%_38%_/_0.30)]',
    PendingReview:        'bg-[hsl(36_55%_88%)]         text-[hsl(28_65%_28%)]   ring-1 ring-[hsl(28_65%_38%_/_0.30)]',
    PendingVerification:  'bg-[hsl(36_55%_88%)]         text-[hsl(28_65%_28%)]   ring-1 ring-[hsl(28_65%_38%_/_0.30)]',
    UnderReview:          'bg-[hsl(36_55%_88%)]         text-[hsl(28_65%_28%)]   ring-1 ring-[hsl(28_65%_38%_/_0.30)]',
    AwaitingThreshold:    'bg-[hsl(36_55%_88%)]         text-[hsl(28_65%_28%)]   ring-1 ring-[hsl(28_65%_38%_/_0.30)]',
    Processing:           'bg-[hsl(353_36%_92%)]        text-[hsl(353_52%_28%)]  ring-1 ring-[hsl(353_52%_28%_/_0.22)]',
    ReadyForManualPayment:'bg-[hsl(90_22%_32%_/_0.12)]  text-[hsl(90_22%_24%)]   ring-1 ring-[hsl(90_22%_32%_/_0.25)]',
    Draft:                'bg-[hsl(36_22%_82%_/_0.6)]   text-[hsl(28_8%_42%)]    ring-1 ring-[hsl(36_22%_70%)]',
    Paused:               'bg-[hsl(28_65%_38%_/_0.10)]  text-[hsl(28_65%_28%)]   ring-1 ring-[hsl(28_65%_38%_/_0.25)]',
    Rejected:             'bg-[hsl(2_48%_42%_/_0.10)]   text-[hsl(2_48%_32%)]    ring-1 ring-[hsl(2_48%_42%_/_0.25)]',
    Suspended:            'bg-[hsl(2_48%_42%_/_0.10)]   text-[hsl(2_48%_32%)]    ring-1 ring-[hsl(2_48%_42%_/_0.25)]',
    Flagged:              'bg-[hsl(2_48%_42%_/_0.10)]   text-[hsl(2_48%_32%)]    ring-1 ring-[hsl(2_48%_42%_/_0.25)]',
    Failed:               'bg-[hsl(2_48%_42%_/_0.10)]   text-[hsl(2_48%_32%)]    ring-1 ring-[hsl(2_48%_42%_/_0.25)]',
    Cancelled:            'bg-[hsl(36_22%_82%_/_0.6)]   text-[hsl(28_8%_42%)]    ring-1 ring-[hsl(36_22%_70%)]',
  };
  return colors[status] ?? 'bg-[hsl(36_22%_82%_/_0.6)] text-[hsl(28_8%_42%)] ring-1 ring-[hsl(36_22%_70%)]';
}
