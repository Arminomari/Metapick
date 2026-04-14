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
  const colors: Record<string, string> = {
    Active: 'bg-green-900/30 text-green-400',
    Approved: 'bg-green-900/30 text-green-400',
    Completed: 'bg-blue-900/30 text-blue-400',
    Verified: 'bg-green-900/30 text-green-400',
    Pending: 'bg-yellow-900/30 text-yellow-400',
    PendingApproval: 'bg-yellow-900/30 text-yellow-400',
    PendingReview: 'bg-yellow-900/30 text-yellow-400',
    PendingVerification: 'bg-yellow-900/30 text-yellow-400',
    Draft: 'bg-gray-800/50 text-gray-400',
    Paused: 'bg-orange-900/30 text-orange-400',
    Rejected: 'bg-red-900/30 text-red-400',
    Suspended: 'bg-red-900/30 text-red-400',
    Flagged: 'bg-red-900/30 text-red-400',
    Failed: 'bg-red-900/30 text-red-400',
    Cancelled: 'bg-gray-800/50 text-gray-500',
    ReadyForManualPayment: 'bg-emerald-900/30 text-emerald-300',
    AwaitingThreshold: 'bg-yellow-900/30 text-yellow-300',
    Processing: 'bg-sky-900/30 text-sky-300',
    UnderReview: 'bg-amber-900/30 text-amber-300',
  };
  return colors[status] ?? 'bg-gray-800/50 text-gray-400';
}
