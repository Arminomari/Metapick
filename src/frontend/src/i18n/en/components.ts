/**
 * English translations for shared components (Swedish-string-as-key).
 * Covers ui primitives, layout shell/drawers, payout estimator and
 * the error boundary. Merged into the EN dictionary in ./index.ts.
 */
export const components: Record<string, string> = {
  // ── Pagination (ui/index.tsx) ──────────────────────
  'Visar': 'Showing',
  'av': 'of',
  'Föregående': 'Previous',
  'Nästa': 'Next',

  // ── DateInput ──────────────────────────────────────
  'ÅÅÅÅ-MM-DD': 'YYYY-MM-DD',

  // ── RefreshViewsButton ─────────────────────────────
  'Startar…': 'Starting…',
  '✓ Synk startad — klar inom någon minut': '✓ Sync started — ready within a minute',
  '↻ Uppdatera views nu': '↻ Refresh views now',

  // ── TagSelector ────────────────────────────────────
  'valda': 'selected',

  // ── PayoutEstimator / PayoutTerms ──────────────────
  'kr per 1 000 visningar': 'kr per 1,000 views',
  'när du når': 'when you reach',
  'visningar': 'views',
  'bonus över': 'bonus above',
  'vid': 'at',
  'Maxersättning per kreatör': 'Maximum payout per creator',
  'Visningar krävs för utbetalning': 'Views required for payout',
  'Räkna på din ersättning': 'Estimate your earnings',
  'Antal visningar': 'Number of views',
  'Uppskattning — den faktiska ersättningen beräknas på verifierade visningar.':
    'An estimate — the actual payout is calculated from verified views.',

  // ── AppLayout ──────────────────────────────────────
  'Meny': 'Menu',
  'Skapad med ☀ i Stockholm': 'Made with ☀ in Stockholm',
  'Hitta kreatörer': 'Find Creators',
  'Utforska': 'Browse',
  'Mina uppdrag': 'My Assignments',
  'PR-erbjudanden': 'PR Offers',
  'Portfölj': 'Portfolio',
  'Intjäning': 'Earnings',
  'Profil': 'Profile',

  // ── ShellDrawers ───────────────────────────────────
  'nyss': 'just now',
  'Inga konversationer än. När ett samarbete startar kan ni chatta här.':
    'No conversations yet. Once a collaboration starts you can chat here.',
  'Konversationer': 'Conversations',
  'Tillbaka': 'Back',
  'Starta konversationen': 'Start the conversation',
  'Meddelande': 'Message',
  'Skicka': 'Send',

  // ── ErrorBoundary ──────────────────────────────────
  'Något gick fel': 'Something went wrong',
  'Ett oväntat fel inträffade.': 'An unexpected error occurred.',
  'Försök igen': 'Try again',
  'Bekräfta din e-postadress — vi har skickat en länk till': 'Confirm your email address — we have sent a link to',
  'Skickat! Kolla inkorgen (och skräpposten).': 'Sent! Check your inbox (and spam folder).',
  'Skicka länken igen': 'Send the link again',
};
