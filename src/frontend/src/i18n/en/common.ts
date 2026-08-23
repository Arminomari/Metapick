/**
 * English translations, Swedish-string-as-key.
 * Swedish is the base language of the app: source code contains Swedish
 * strings, and this dictionary maps them to English. A missing key falls
 * back to the Swedish source (never an empty render).
 *
 * Add page-specific namespaces as sibling files and spread them in index.ts.
 */
export const common: Record<string, string> = {
  // ── Shell / navigation ─────────────────────────────
  'Översikt': 'Dashboard',
  'Upptäck': 'Discover',
  'Mina kampanjer': 'My Campaigns',
  'Portfolio': 'Portfolio',
  'Statistik': 'Analytics',
  'PR-hubb': 'PR Hub',
  'Länkar': 'Link Tree',
  'Intäkter': 'Earnings',
  'Creator-nivåer': 'Creator Levels',
  'Sparat': 'Saved',
  'Inställningar': 'Settings',
  'Logga ut': 'Log out',
  'Kampanjer': 'Campaigns',
  'Ansökningar': 'Applications',
  'Hitta creators': 'Find Creators',
  'PR-utskick': 'PR Outreach',
  'Varumärke': 'Brand',
  'Sök kampanjer, varumärken, insikter…': 'Search campaigns, brands, insights…',
  'följare': 'followers',

  // ── Common actions ─────────────────────────────────
  'Kopiera': 'Copy',
  'Kopierad!': 'Copied!',
  'Stäng': 'Close',
  'Laddar…': 'Loading…',
  'Skickar…': 'Sending…',
  'Spara': 'Save',
  'Avbryt': 'Cancel',

  // ── Tracking / "how it works" card ─────────────────
  'Så här funkar det': 'How it works',
  'Kopiera med ett tryck och klistra in i din videobeskrivning på TikTok — så hittar vi videon automatiskt.':
    'One-tap copy, then paste into your TikTok video description — we will find the video automatically.',
  'Kampanjens hashtag': 'Campaign hashtag',
  'Din unika tracking-tag (utan #)': 'Your unique tracking tag (without #)',
  'Skriv den som vanlig text — sätt inget # framför.': 'Write it as plain text — do not put a # in front.',
  'Färdig videobeskrivning (exempel)': 'Ready-made video description (example)',
  'Min recension av produkten!': 'My review of the product!',
  'Automatisk tracking:': 'Automatic tracking:',
  'Vi scannar regelbundet efter nya videos. När din video hittas dyker den upp nedan av sig själv — publicera och luta dig tillbaka.':
    'We scan for new videos regularly. Once your video is found it shows up below on its own — publish and lean back.',

  // ── Tracked videos ─────────────────────────────────
  'Spårade videos': 'Tracked videos',
  'Skicka in video manuellt': 'Submit a video manually',
  'Videos som matchar din tracking-tag hittas automatiskt. Använd formuläret nedan om du vill lägga till en video manuellt.':
    'Videos matching your tracking tag are found automatically. Use the form below to add a video manually.',
  'Skicka in': 'Submit',
  'Hittad': 'Found',
  'Gilla': 'Likes',
  'Kommentarer': 'Comments',
  'Delningar': 'Shares',
  'Godkänd av varumärket': 'Approved by the brand',
  'Nekad': 'Rejected',
  'Väntar på att systemet ska hämta videodata…': 'Waiting for the system to fetch video data…',
  'Inga videos ännu. Publicera en TikTok-video med din tracking-tag så hittas den automatiskt, eller skicka in manuellt ovan.':
    'No videos yet. Publish a TikTok video with your tracking tag and it will be found automatically, or submit one manually above.',

  // ── TikTok connection ──────────────────────────────
  'TikTok-konto': 'TikTok account',
  'Kopplat via OAuth': 'Connected via OAuth',
  'Manuellt tillagd': 'Added manually',
  'anslut via OAuth för automatisk tracking': 'connect via OAuth for automatic tracking',
  'Senast synkad': 'Last synced',
  'Anslut ditt TikTok-konto för automatisk tracking av views och engagement.':
    'Connect your TikTok account for automatic tracking of views and engagement.',
  'Anslut via OAuth': 'Connect via OAuth',
  'Ansluter…': 'Connecting…',
  'Koppla bort': 'Disconnect',
  'Kopplar bort…': 'Disconnecting…',
  'Klicka igen för att bekräfta': 'Click again to confirm',
  'Laddar video från TikTok…': 'Loading video from TikTok…',
  'Öppna på TikTok': 'Open on TikTok',

  // ── Chat & notifications ───────────────────────────
  'Meddelanden': 'Messages',
  'Notiser': 'Notifications',
  'nya': 'new',
  'Markera alla lästa': 'Mark all as read',
  'Direktchatt': 'Direct chat',
  'Skriv ett meddelande…': 'Write a message…',
  'Inga meddelanden än — starta konversationen!': 'No messages yet — start the conversation!',
  'Inga notiser än. Vi hör av oss här när något händer.': 'No notifications yet. We will let you know here when something happens.',

  // ── Reviews ────────────────────────────────────────
  'Omdöme': 'Review',
  'Lämna ett omdöme': 'Leave a review',
  'Betyg': 'Rating',
  'Kommentar': 'Comment',
  'valfritt': 'optional',
  'Berätta om din upplevelse…': 'Tell us about your experience…',
  'Skicka omdöme': 'Submit review',
  'Kunde inte skicka omdömet': 'Could not submit the review',
  'Ditt omdöme': 'Your review',
  'Tack för ditt omdöme!': 'Thank you for your review!',
  'omdömen': 'reviews',
  'omdöme': 'review',
  'Omdömen låses upp när samarbetet är markerat som slutfört.': 'Reviews unlock once the collaboration is marked as completed.',
  'Mer': 'More',
};
