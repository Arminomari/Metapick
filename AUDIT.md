# VYRLE app audit (Phase 1)

Scope: the logged-in app for the **Creator** and **Brand** roles as routed in `src/frontend/src/App.tsx`. The admin area, auth pages and the marketing iframe are out of scope. No code was changed.

Method: every routed page and every component it renders was read in full. Labels are quoted as they appear in the UI (Swedish), with an English gloss where it helps. "Stat" means a number the user is shown (a KPI tile, a count in a tab, a value in a list row). "Above the fold" is judged at 375 px wide.

---

## 1. Route inventory

### 1.1 Creator (21 routes, 14 sidebar items)

| # | Route | Sidebar label | Component | File | In mobile tab bar? |
|---|---|---|---|---|---|
| C1 | `/creator` | Översikt (Overview) | `CreatorStudioDashboard` | `pages/creator/CreatorStudio.tsx` | Yes (slot 1) |
| C2 | `/creator/browse` | Upptäck (Discover) | `BrowseCampaignsPage` | `pages/creator/CreatorPages.tsx` | Yes (slot 2) |
| C3 | `/creator/assignments` | Mina kampanjer (My campaigns) | `CreatorAssignmentsPage` | `pages/creator/CreatorPages.tsx` | No (behind "Mer") |
| C4 | `/creator/assignments/:id` | (none) | `AssignmentDetailPage` | `pages/creator/CreatorPages.tsx` | n/a |
| C5 | `/creator/taps` | Kranar (Taps) | `CreatorTapsPage` | `pages/creator/CreatorTapsPage.tsx` | No |
| C6 | `/creator/ugc` | Videouppdrag (Video jobs) | `UgcCreatorHomePage` | `pages/ugc/UgcCreatorPages.tsx` | No |
| C7 | `/creator/ugc/applications` | (none) | `UgcCreatorApplicationsPage` | `pages/ugc/UgcCreatorPages.tsx` | n/a |
| C8 | `/creator/ugc/collabs` | (none) | `UgcPipelinePage role=creator` | `pages/ugc/UgcBrandPages.tsx` | n/a |
| C9 | `/creator/ugc/collabs/:id` | (none) | `UgcCollabPage` | `pages/ugc/UgcCollabPage.tsx` | n/a |
| C10 | `/creator/ugc/profile` | (none) | `UgcCreatorProfilePage` | `pages/ugc/UgcCreatorPages.tsx` | n/a |
| C11 | `/creator/portfolio` | Portfolio | `CreatorPortfolioPage` | `pages/creator/PortfolioPage.tsx` | No |
| C12 | `/creator/analytics` | Statistik (Analytics) | `CreatorAnalyticsPage` | `pages/creator/CreatorExtraPages.tsx` | No |
| C13 | `/creator/pr` | PR-hubb (PR inbox) | `CreatorPrInboxPage` | `pages/creator/PrInboxPage.tsx` | No |
| C14 | `/creator/links` | Länkar (Links) | `CreatorLinksPage` | `pages/creator/CreatorExtraPages.tsx` | Route and nav item hidden by `FEATURES.linkTree = false` |
| C15 | `/creator/brands/:id` | (none) | `BrandProfilePage` | `pages/creator/BrandProfilePage.tsx` | n/a |
| C16 | `/creator/earnings` | Intäkter (Earnings) | `EarningsPage` | `pages/creator/CreatorPages.tsx` | No |
| C17 | `/creator/levels` | Creator-nivåer (Levels) | `CreatorLevelsPage` | `pages/creator/CreatorExtraPages.tsx` | No |
| C18 | `/creator/saved` | Sparat (Saved) | `CreatorSavedPage` | `pages/creator/CreatorExtraPages.tsx` | No |
| C19 | `/creator/settings` **and** `/creator/profile` | Inställningar (Settings) | `CreatorProfilePage` (same component on both routes) | `pages/creator/CreatorPages.tsx` | No |
| C20 | `/creator/messages` | Meddelanden (Messages) | `SupportThreadPage` | `pages/shared/SupportThreadPage.tsx` | Tab bar opens the **drawer**, not this page |
| C21 | `/creator/*` | (none) | `NotFoundPage inApp` | `pages/NotFoundPage.tsx` | n/a |

### 1.2 Brand (22 routes, 12 sidebar items)

| # | Route | Sidebar label | Component | File | In mobile tab bar? |
|---|---|---|---|---|---|
| B1 | `/brand` | Översikt | `BrandStudioDashboard` | `pages/brand/BrandStudio.tsx` | Yes (slot 1) |
| B2 | `/brand/tap` | Kranar | `BrandTapPage` | `pages/brand/BrandTapPage.tsx` | Yes (slot 2) |
| B3 | `/brand/community` | Community | `BrandCommunityPage` | `pages/brand/BrandCommunityPage.tsx` | No |
| B4 | `/brand/analytics` | Statistik | `BrandAnalyticsPage` | `pages/brand/AnalyticsPage.tsx` | No |
| B5 | `/brand/campaigns` | Kampanjer | `BrandCampaignListPage` | `pages/brand/BrandPages.tsx` | No |
| B6 | `/brand/campaigns/new` | (none) | `CreateCampaignPage` | `pages/brand/BrandPages.tsx` | n/a |
| B7 | `/brand/campaigns/:id` | (none) | `BrandCampaignDetailPage` | `pages/brand/BrandPages.tsx` | n/a |
| B8 | `/brand/ugc` | Beställ video (Order video) | `UgcBrandHomePage` | `pages/ugc/UgcBrandPages.tsx` | No |
| B9 | `/brand/ugc/pipeline` | (none) | `UgcPipelinePage role=brand` | `pages/ugc/UgcBrandPages.tsx` | n/a |
| B10 | `/brand/ugc/campaigns/new` | (none) | `UgcCampaignBuilderPage` | `pages/ugc/UgcBrandPages.tsx` | n/a |
| B11 | `/brand/ugc/campaigns/:id` | (none) | `UgcBrandCampaignPage` | `pages/ugc/UgcBrandPages.tsx` | n/a |
| B12 | `/brand/ugc/campaigns/:id/edit` | (none) | `UgcCampaignBuilderPage` | `pages/ugc/UgcBrandPages.tsx` | n/a |
| B13 | `/brand/ugc/invite?creator=` | (none) | `UgcDirectInvitePage` | `pages/ugc/UgcBrandPages.tsx` | n/a |
| B14 | `/brand/ugc/collabs/:id` | (none) | `UgcCollabPage` | `pages/ugc/UgcCollabPage.tsx` | n/a |
| B15 | `/brand/applications` | Ansökningar (Applications) | `BrandApplicationsPage` | `pages/brand/BrandPages.tsx` | No |
| B16 | `/brand/creators` | Hitta creators (Find creators) | `DiscoverCreatorsPage` | `pages/brand/CreatorDiscoveryPages.tsx` | No |
| B17 | `/brand/creators/:id` | (none) | `BrandCreatorDetailPage` | `pages/brand/CreatorDiscoveryPages.tsx` | n/a |
| B18 | `/brand/pr` | PR-utskick (PR outreach) | `BrandPrHubPage` | `pages/brand/PrHubPage.tsx` | No |
| B19 | `/brand/public-profile` | Min profil (My profile) | `BrandOwnPublicProfilePage` | `pages/creator/BrandProfilePage.tsx` | No |
| B20 | `/brand/assignments/:id` | (none) | `BrandAssignmentDetailPage` | `pages/brand/BrandPages.tsx` | n/a |
| B21 | `/brand/messages` | Meddelanden | `SupportThreadPage` | `pages/shared/SupportThreadPage.tsx` | Tab bar opens the drawer |
| B22 | `/brand/settings` | Inställningar | `BrandSettingsPage` | `pages/brand/BrandPages.tsx` | No |

### 1.3 Shared redirects

| Route | Behaviour |
|---|---|
| `/dashboard` | → `/creator`, `/brand` or `/admin` by role |
| `/messages` | → `/creator/messages` or `/brand/messages` (mail CTAs land here) |
| `/ugc` | → `/creator/ugc/collabs` or `/brand/ugc/pipeline` |
| `*` | `NotFoundPage` (standalone) |

---

## 2. Shell (shared chrome on every page)

File: `components/layout/VyrleShell.tsx`, `ShellDrawers.tsx`, `GlobalSearch.tsx`.

| # | Element | Type | Where shown | Does |
|---|---|---|---|---|
| S1 | VYRLE logo | Link | Sidebar | → role home |
| S2 | Nav items | Links ×14 (creator) / ×12 (brand) | Sidebar (desktop); "Mer" overlay (mobile) | Navigate; 6 creator and 6 brand items carry a red count badge; 2 creator + 2 brand items carry a "NY" tag |
| S3 | Logga ut | Button | Sidebar | Logout → `/login` |
| S4 | Identity card | Avatar + name + handle + sub-line | Sidebar bottom | Not clickable. Creator sub-line shows follower count + category (**1 stat**). Brand sub-line shows industry + account status |
| S5 | Hamburger | Icon button | Topbar (mobile) | Opens sidebar overlay |
| S6 | Global search | Input + result panel | Topbar | Searches pages, campaigns, brands (creator) or creators (brand). ⌘K / Ctrl K. Campaign hit for creator goes to `/creator/browse?q=` (no campaign detail exists for creators) |
| S7 | Language switcher | 2 toggle buttons (sv / en) | Topbar | Also duplicated as a card in Settings |
| S8 | Messages icon | Icon button + badge | Topbar | Toggles Messages **drawer** |
| S9 | Notifications icon | Icon button + badge | Topbar | Toggles Notifications **drawer** |
| S10 | Profile chip | Avatar + name + handle | Topbar right | Not clickable |
| S11 | Email verify banner | Banner + "Skicka länken igen" + × | Under topbar until verified | Resend verification (60 s cooldown), dismiss for session |
| S12 | Mobile tab bar | 5 slots | Bottom, ≤920 px | Slot 1–2 = first two nav items (Översikt, Upptäck / Översikt, Kranar); slot 3 = Meddelanden (drawer); slot 4 = Notiser (drawer); slot 5 = Mer (sidebar overlay) |
| S13 | Notifications drawer | Side panel | Any page | "Markera alla lästa", close, list; each item deep-links per `notifTarget()` (30+ cases) |
| S14 | Messages drawer | Side panel | Any page | Conversation list → thread (back, counterpart header → profile, composer + send). Does **not** include the Support thread |

Mobile reality: on a phone the tab bar exposes **2 of 14** creator destinations and **2 of 12** brand destinations directly. Everything else is Mer → scroll → tap (3 taps), and two of the five tab slots are spent on drawers, not destinations.

---

## 3. Per-page inventory

Legend for the Type column: **P** primary button, **S** secondary/outline button, **L** text link, **T** tab/segment, **R** clickable row/card, **I** input/form control, **M** opens a modal/drawer, **X** external link.

### C1 · `/creator` · Översikt (Home)

Numbers shown:

| Where | Numbers | Count |
|---|---|---|
| Hero (dark gradient block) | Verifierade views, Totalt upplupet, Väntande utbetalning, Aktiva kampanjer | 4 |
| Metric toggle row | Views, Intäkter, Klick (each button shows its total) | 3 |
| Chart footer | Toppkampanj (name), Snitt, Totalt | 2 |
| Creator-betyg card | Average stars (donut), up to 4 reviewer rows with stars | 1–5 |
| Aktiva kampanjer rows (×5) | Views, Intjänat per row | up to 10 |
| Upptäck kampanjer items (×4) | Spots left / max, min views per item | up to 12 |
| Dina kranar section (per tap card) | CPM, monthly cap, month earned, month views, tap % used, hashtag; 2 meters | 5+ per tap |
| **Above the fold at 375 px** | 4 hero + 3 metric buttons | **7** |
| **Whole page** | | **30–50** |

Actions:

| # | Type | Label | Does |
|---|---|---|---|
| 1 | T×3 | Views / Intäkter / Klick | Switch chart metric |
| 2 | L | Alla kampanjer → | `/creator/assignments` |
| 3 | P | Upptäck kampanjer | `/creator/browse` (chart empty state) |
| 4 | L | Bygg din portfölj → | `/creator/portfolio` |
| 5 | R×5 | Active campaign row | `/creator/assignments/:id` |
| 6 | P | Upptäck kampanjer | `/creator/browse` (active empty state) |
| 7 | L | Visa alla kampanjer → | `/creator/assignments` |
| 8 | R×4 | Discover item | `/creator/browse` (**not** the campaign itself) |
| 9 | L | Utforska alla kampanjer → | `/creator/browse` |
| 10 | L | Visa alla kranar → | `/creator/taps` |
| 11 | R | Community chip (waiting for tap) | `/creator/brands/:id` |
| 12 | R | Tap card | `/creator/assignments/:id` |
| 13 | R | Feed post avatar / brand name | `/creator/brands/:id` |

No single primary action. Three separate "go to browse" CTAs on one screen.

### C2 · `/creator/browse` · Upptäck

| # | Type | Label | Does |
|---|---|---|---|
| 1 | P / S | Fortsätt med TikTok / Hantera | TikTok OAuth / `/creator/profile` (connect bar at top) |
| 2 | L | Rensa | Clears `?q=` search filter |
| 3 | Stat | "N kampanjer tillgängliga" | count |
| 4 | Icon | Bookmark toggle (per card) | Save / unsave campaign |
| 5 | L | Brand name (per card) | `/creator/brands/:id` |
| 6 | Badge | Godkänd / Skickad / Nekad | application status |
| 7 | Tags×3 | category, country, payout model | none |
| 8 | Stats×3 (per card) | Ersättning, Platser x / y, Period | |
| 9 | L | Räkna på din ersättning / Dölj kalkylen | Expands `PayoutEstimator` slider (1 more number) |
| 10 | P | Ansök | Opens `ApplyModal` (textarea min 10 chars, Skicka ansökan, Avbryt, ×) |
| 11 | S | ✓ Godkänd — gå till Mina uppdrag | `/creator/assignments/:id` |
| 12 | S disabled | Fullbokad / Ansökan skickad / Ansökan nekad | none |
| 13 | S×2 | Föregående / Nästa | pagination |

Observations: no filters (category state exists in code but has no control); cards are a 2-column grid of boxes; the TikTok connect bar takes the top of the page for every unconnected creator.

### C3 · `/creator/assignments` · Mina kampanjer

| Where | Numbers | Count |
|---|---|---|
| Stat tiles | Godkänd & aktiv, Verifierade views, Intjänat, Väntande ansökningar | 4 |
| Tabs | Alla (n), Aktiva (n), Avslutade (n), Pausade (n) | 4 |
| List header | "N uppdrag" | 1 |
| Per row | Views, Klick, Intjänat | 3 |
| **Above the fold** | | **8** |

| # | Type | Label | Does |
|---|---|---|---|
| 1 | T×4 | Alla / Aktiva / Avslutade / Pausade | filter (6 API calls on mount to fill the counts) |
| 2 | R | Assignment row (status badge, "Kran" badge) | `/creator/assignments/:id` |
| 3 | P | Hitta kampanjer | `/creator/browse` (empty state) |
| 4 | S×2 | Föregående / Nästa | pagination |

### C4 · `/creator/assignments/:id` · Assignment detail

| Where | Numbers | Count |
|---|---|---|
| Stat cards | Verifierade views, Estimerad ersättning, Ersättningsmodell, Slutar om / Slutdatum | 4 |
| Brief card | Payout terms rows, min views | 1–4 |
| TapBanner (tap assignments) | CPM, cap/video, cap/month, tap % used, month earned, lifetime earned | 6 |
| Goal-reached banner | amount | 1 |
| Per tracked video | Views, Gilla, Kommentarer, Delningar | 4 |
| **Above the fold** | | **4 (10 on a tap)** |

| # | Type | Label | Does |
|---|---|---|---|
| 1 | L | ‹ Mina kampanjer | back |
| 2 | L | Se företagets uppdateringar → | `/creator/brands/:id` (tap banner) |
| 3 | I×3 + S×3 | CopyField: hashtag, tracking-tag, färdig beskrivning, each with Kopiera | clipboard |
| 4 | P | Välj bland dina TikTok-videor | Expands `VideoPicker` grid (per video: "Använd denna"; "Stäng") |
| 5 | I + P | URL input + Lägg till | submit video by link |
| 6 | L | ↻ Uppdatera views nu | `RefreshViewsButton` |
| 7 | X | TikTok embed / submission URL | external |
| 8 | Chat | `ChatPanel` (header → brand profile, input, send) | messages |
| 9 | Form | `ReviewSection` (stars, textarea, Skicka omdöme) | review, only when Completed |

Observations: 8 stacked cards; "add video" has two competing methods side by side plus a third (auto-tracking) explained above them.

### C5 · `/creator/taps` · Kranar

| Where | Numbers | Count |
|---|---|---|
| Stat tiles | Denna månad (+ views sub), Totalt från kranar, Öppna kranar (+ "av N") | 5 |
| Inbjudningar / Väntande badges | counts | 2 |
| Per TapCard | CPM, cap/video, cap/mån, month earned, month views, cap meter, tap %, spent, budget, tap meter | ~10 |
| **Above the fold** | | **5** |

| # | Type | Label | Does |
|---|---|---|---|
| 1 | L | Brand name (invites, pending) | `/creator/brands/:id` |
| 2 | P / S | Acceptera / Avböj (per invite) | answer community invite |
| 3 | L | Ta tillbaka (per pending request) | withdraw request |
| 4 | R | Tap avatar / brand name | `/creator/brands/:id` |
| 5 | P | Lägg till video → | `/creator/assignments/:id` |
| 6 | S | Kopiera (hashtag) | clipboard |
| 7 | P | Hitta kampanjer | `/creator/browse` (empty state) |

### C6 · `/creator/ugc` · Videouppdrag

| Where | Numbers | Count |
|---|---|---|
| Profile status card | leveranser, ★ rating, tjänat | 3 |
| "Mina uppdrag" button badge | needs-action count | 1 |
| Per campaign card | Ersättning range, Format (s · st), Leverans (dagar), platser | 4 |

| # | Type | Label | Does |
|---|---|---|---|
| 1 | S | Min UGC-profil | `/creator/ugc/profile` |
| 2 | S + badge | Mina uppdrag | `/creator/ugc/collabs` |
| 3 | S | Verifiera dig för utbetalning | `/creator/profile` |
| 4 | R | "Väntar på dig" `CollabRow` | `/creator/ugc/collabs/:id` |
| 5 | T×2 | Passar dig / Alla öppna | filter |
| 6 | P | Ansök | Opens inline dialog (brief, bid input, pitch textarea ≥20 chars, Skicka ansökan, Avbryt, ×) |
| 7 | P | Anlitad — öppna uppdraget | `/creator/ugc/collabs/:id` |
| 8 | S | Verifiera dig först | toast + `/creator/profile` |
| 9 | S disabled | Ansökan skickad / antogs inte / återtagen | none |

### C7 · `/creator/ugc/applications` · Mina ansökningar

**Orphan: nothing in the app links here.**

| # | Type | Label | Does |
|---|---|---|---|
| 1 | Row | title + status badge + bid + date + note | |
| 2 | P | Öppna uppdraget | `/creator/ugc/collabs/:id` |
| 3 | L | Ta tillbaka | withdraw bid |
| 4 | P | Se öppna beställningar | `/creator/ugc` (empty state) |

### C8 · `/creator/ugc/collabs` · Mina videouppdrag (kanban)

7 columns (Inbjudna, Pågår, Att granska, Revision, Tvist, Klara, Avbrutna) at 270 px each in a horizontal scroller. On a 375 px screen only ~1.3 columns are visible. Per card: title, counterpart, amount, status badge, deadline, auto-approve date, unread count, "Din tur". Card → C9. Empty state has no CTA.

### C9 · `/creator/ugc/collabs/:id` (also B14) · Collab detail

| Where | Numbers | Count |
|---|---|---|
| Header | amount ("Du får" / "Du betalar"), brand fee split | 1–3 |
| Revision counter | N/M | 1 |
| Deliverables | version, date, MB per version | 3 per version |
| PaymentCard | 2–5 rows | 2–5 |

Actions (rendered only when the server lists them in `availableActions`):

| # | Type | Label | Role |
|---|---|---|---|
| 1 | L | ‹ Tillbaka | both |
| 2 | P | Acceptera & betala / Betala | brand |
| 3 | P | Acceptera kontraktet | creator |
| 4 | S | Markera som påbörjad | creator |
| 5 | P | Godkänn leveransen | brand |
| 6 | S | Begär ändring (N kvar) → textarea + Skicka revision | brand |
| 7 | S danger | Öppna tvist → textarea + Öppna tvist | both |
| 8 | S | ★ Betygsätt → 5 stars + Spara betyg | both |
| 9 | X | Licensbevis | both |
| 10 | L danger | Avböj / Avbryt uppdraget → textarea + confirm | both |
| 11 | I + P | file input, comment, Leverera video (+ progress) | creator |
| 12 | X | Ladda ner (per version) | both |
| 13 | L | Läs hela / Dölj (contract) | both |
| 14 | I + P | Chat textarea + Skicka | both |

Seven cards in a 2-column grid (Leverans, Tvist, Brief, Kontrakt / Chatt, Betalning, Händelser). Up to 8 action buttons in one row.

### C10 · `/creator/ugc/profile` · Min UGC-profil

Reachable only via the secondary button on C6. Controls: Kategorier tag toggles (max 6), Stad, Region, Exempelvideo; Rättigheter checkbox; **Spara profil**. Says "Verifiering och utbetalning hittar du under Inställningar".

### C11 · `/creator/portfolio` · Portfolio

| Where | Numbers | Count |
|---|---|---|
| Stat tiles | Följare (+ snittvisningar), Verifierade views, Samarbeten (+ intjänat), Omdöme (+ antal) | 7 |
| Omdömen card | avg, count, per review stars | 2+ |
| Om mig card | Land, Kategori, Språk, Medlem sedan | 4 facts |
| Företag du jobbat med chips | views per chip | 1 per brand |
| **Above the fold** | profile card first, then 4 tiles | **4 (7 with subs)** |

| # | Type | Label | Does |
|---|---|---|---|
| 1 | X×3 | TikTok, Instagram, Webbplats | external |
| 2 | S | Redigera profil | `/creator/profile` |
| 3 | L | Redigera (Om mig) | `/creator/profile` |
| 4 | P | + Lägg till arbete | Shows inline form (Titel, Typ av media, Kategori, Media-URL, Miniatyrbild-URL, Beskrivning, Varumärke, Utvald checkbox; Lägg till / Spara ändringar, Avbryt) |
| 5 | S×2 per item | Redigera, Ta bort (2-step) | edit / delete |
| 6 | X per item | media link / TikTok embed | external |
| 7 | P | Lägg till ditt första arbete | empty state |

### C12 · `/creator/analytics` · Statistik

| Where | Numbers | Count |
|---|---|---|
| BigStat tiles (each value + hint) | Verifierade views (+ N kampanjer), Spårade klick (+ CTR), Intäkter (+ kr/1K), Live-kampanjer (+ snittvisningar) | 8 |
| Chart footer | Total räckvidd, Bästa kampanjen, Klickfrekvens | 3 |
| Donut + legend | total + 4 campaigns | 5 |
| Innehåll som presterar bäst (×5) | Views, Klick | 10 |
| Räckvidd & monetarisering | följare, 3 mini-bars, Totalt antal klick, Genomförda kampanjer | 6 |
| **Above the fold** | | **8** |
| **Whole page** | | **~32** |

Actions: L Mina kampanjer →, L Öppna intäkter →, P Upptäck kampanjer (empty).

### C13 · `/creator/pr` · PR-hubb

| Where | Numbers | Count |
|---|---|---|
| Stat tiles | PR-värde att deklarera (+ produkter, ersättning), Aktiva PR-samarbeten, Nya erbjudanden, Totalt mottagna | 6 |
| Tabs | Alla (n), Nya (n), Aktiva (n), Historik (n) | 4 |
| Per expanded offer | Ersättning, Deadline, Du får (+ value) | 3–4 |
| **Above the fold** | | **6** |

| # | Type | Label | Does |
|---|---|---|---|
| 1 | L | Mina kampanjer → | `/creator/assignments` (info bar) |
| 2 | T×4 | tabs | filter |
| 3 | S | Läs erbjudande | expands card, marks viewed |
| 4 | I + P + S | textarea, Tacka ja, Tacka nej | respond |

### C15 · `/creator/brands/:id` · Brand public profile

| Where | Numbers | Count |
|---|---|---|
| Stat boxes | Följare, Aktiva kampanjer, Genomförda, Totala views, Ambassadörer, Betyg | 6 |
| Per tap | CPM, cap/video, cap/mån | 3 |
| Per active campaign card | payout, spots left, dates, levererade views | 3–4 |
| Per past campaign | views | 1 |
| Reviews header | avg of 5, count | 2 |
| **Above the fold** | | **6** |

| # | Type | Label | Does |
|---|---|---|---|
| 1 | P / S | ＋ Följ / ✓ Följer | follow toggle |
| 2 | X | Webbplats | external |
| 3 | P | Ansök till kranen → confirm (Ja, skicka ansökan / Avbryt) | request community membership |
| 4 | P / S | Acceptera / Avböj | answer invite |
| 5 | L danger | Ta tillbaka ansökan | withdraw |
| 6 | P | Ansök (per campaign) | `ApplyModal` |
| 7 | S | ✓ Godkänd — gå till Mina uppdrag | `/creator/assignments` (list, not the assignment) |
| 8 | L | ← Tillbaka | history back |

### C16 · `/creator/earnings` · Intäkter

| Where | Numbers | Count |
|---|---|---|
| PayoutState tiles (amount + count each) | Väntande, Godkänt, Utbetalt | 6 |
| Donut + legend | totalt sedan start, Utbetalt, Godkänt, Väntande, Upplupet | 5 |
| Footer | Totalt intjänat, Snitt / utbetalning, Andel utbetalt | 3 |
| Top brands bars | 4 amounts | 4 |
| Upplupet (ej begärt) row | 1 | 1 |
| PayoutRequestCard | total available; per payable: views, earned, claimed, available | 1 + 4/row |
| Utbetalningshistorik rows | amount each | 1/row |
| **Above the fold** | | **6** |
| **Whole page** | | **25+** |

| # | Type | Label | Does |
|---|---|---|---|
| 1 | P | Begär utbetalning (per payable) | request payout |
| 2 | L / P | Ändra / Lägg till metod | opens payout-method form (Bankkonto / Swish / PayPal toggles, details, Kontoinnehavare, Spara metod, Avbryt) |
| 3 | S×2 | Föregående / Nästa | pagination |

Observations: the one action that matters (Begär utbetalning) sits below a donut, a bar chart and a 4-step explainer. Payout method (needed before any payout) is even lower.

### C17 · `/creator/levels` · Creator-nivåer

Numbers: level index, tier name, lifetime utbetalt, slutförda kampanjer, XP bar, current / next threshold (6), then 5 tier thresholds twice (Stegen + Alla nivåer). No actions. Dark gradient hero block.

Observation (not changed in this phase): the page filters payouts on `status === 'Paid'` but the payout statuses used everywhere else are `Completed / Approved / Processing`, so lifetime earned reads 0 and every creator is level 1 "Rising".

### C18 · `/creator/saved` · Sparat

Per card: bookmark-remove button, 2 tags, "Sparad {date}", Ersättning, Platser x/y, Stänger (3 numbers), **Ansök via Upptäck** → `/creator/browse` (does not open the apply dialog; user must find the card again). Empty → Hitta kampanjer.

### C19 · `/creator/settings` = `/creator/profile` · Inställningar

Nine stacked cards, in this order:

| # | Card | Controls |
|---|---|---|
| 1 | Page head | Kontostatus badge |
| 2 | TikTok connection bar | Fortsätt med TikTok (OAuth) / Koppla bort (2-step); shows @handle, Verifierad badge, follower count, last sync |
| 3 | Verifiering (Stripe) | Verifiera dig / Fortsätt verifieringen; Skatt: F-skatt checkbox, momsregistrerad checkbox, VAT nr input, Spara |
| 4 | Profilinformation | Redigera (header) → Visningsnamn, TikTok-användarnamn, Bio, Kategori, Land, Födelsedatum, Instagram, Webbplats, Profilbild (`ImagePicker`), "Öppen för PR" checkbox, `TagSelector` (max 10); Spara profil / Avbryt / **Redigera profil** (second edit button at bottom) |
| 5 | Profiluppgifter | Följare, Medlem sedan, Status (3 read-only) |
| 6 | Byt e-postadress | Ny e-post, lösenord, Byt e-post |
| 7 | Språk | sv / en switcher (duplicate of topbar) |
| 8 | Radera konto | Begär radering → Ja, skicka begäran / Avbryt (posts to the support thread) |
| 9 | Byt lösenord | current, new, confirm, Byt lösenord |
| 10 | Omdömen | `ReviewList` (duplicate of Portfolio and Home) |

Observations: "Delete account" sits above "Change password"; two "Redigera" buttons for the same form; verification and TikTok connection (both onboarding tasks) are mixed with account security.

### C20 / B21 · `/creator/messages`, `/brand/messages` · Meddelanden

Tabs: Konversationer (n), Support från VYRLE (n). Chat tab embeds the same `ConversationList` + `ChatThread` as the drawer, in a fixed-height card. Support tab: bubble list + textarea + Skicka. Auto-picks the tab with unread items.

---

### B1 · `/brand` · Översikt (Home)

| Where | Numbers | Count |
|---|---|---|
| Hero | Aktiva kampanjer, Total budget, Spenderat (+ %), Godkända creators | 5 |
| Chart footer | Total budget, Spenderat, Utnyttjande (**same numbers as hero**) | 3 |
| PR-acceptans card | accept %, Skickade, Accepterade, Sedda, Väntar | 5 |
| Senaste kampanjer rows (×5) | progress %, Creators x/y, Spenderat | 15 |
| **Above the fold** | | **5** |
| **Whole page** | | **~28** |

| # | Type | Label | Does |
|---|---|---|---|
| 1 | L | Alla kampanjer → | `/brand/campaigns` |
| 2 | P | Skapa kampanj | `/brand/campaigns/new` (chart empty) |
| 3 | L | Öppna PR-hubben → | `/brand/pr` |
| 4 | P | + Ny kampanj | `/brand/campaigns/new` (section header) |
| 5 | R×5 | Campaign row | `/brand/campaigns/:id` |
| 6 | P | Skapa kampanj | `/brand/campaigns/new` (list empty) |
| 7 | L | Visa alla kampanjer → | `/brand/campaigns` |
| 8 | R | Hitta creators | `/brand/creators` |
| 9 | R | Granska ansökningar | `/brand/applications` |
| 10 | R | Lansera en kampanj | `/brand/campaigns/new` |

Observations: four entry points to "new campaign" on one screen. Home says nothing about Kranar (the core product per the Aug 2026 pivot), Community, Beställ video or pending reviews.

### B2 · `/brand/tap` · Kranar

| Where | Numbers | Count |
|---|---|---|
| TapReviewSection (per video) | views, submitted date, auto-approve hours | 3 |
| Stat cards | Öppna kranar, Spenderat denna månad, Månadsbudget, Views denna månad | 4 |
| Per TapCard | CPM, spent, budget, %, remaining, views, active creators, cap/video, cap/creator, brief date | ~10 |
| TapForm live calculator | views/month, cap kicks in at, min creators, min videos, 4 example payouts | 8 |
| **Above the fold (list mode)** | review queue first, then 4 tiles | **4–7** |

| # | Type | Label | Does |
|---|---|---|---|
| 1 | P | + Ny kran | show `TapForm` |
| 2 | P / S | ✓ Godkänn / Neka → reason input + Neka (per pending video) | review tap videos |
| 3 | S | Redigera (per tap) | edit form |
| 4 | S confirm | Pausa / P Öppna igen | toggle status |
| 5 | S confirm danger | Stäng | close tap |
| 6 | L×2 | Community, Min profil | `/brand/community`, `/brand/public-profile` (in the 4-step explainer) |
| 7 | Form | Namn, Månadsbudget, CPM, Tak per video, Månadstak per creator, Hashtag, Kategori, Stående brief, Hooks/regler; Öppna kranen / Spara ändringar, Avbryt | 9 inputs |

### B3 · `/brand/community` · Community

| Where | Numbers | Count |
|---|---|---|
| Stat cards | Medlemmar, Auto-kvalificerade, Inbjudna, Intjänat av communityn | 4 |
| Per member row sub-line | följare, samarbeten, views, utbetalt, medlem sedan | 5 |
| Badges | requests count, invited count, members count | 3 |

| # | Type | Label | Does |
|---|---|---|---|
| 1 | P | ＋ Bjud in creators | `InviteCreatorsModal` (search, Välj alla / Avmarkera alla, checkbox list, Bjud in (N), Avbryt, ×) |
| 2 | R | avatar / name (all rows) | `/brand/creators/:id` |
| 3 | P / S confirm | ✓ Godkänn / Neka (per request) | answer request |
| 4 | S 2-step | Dra tillbaka (per invited) | cancel invite |
| 5 | S | ✎ Skriv (per member) | `MessageCreatorModal` |
| 6 | S 2-step | Ta bort (per member) | remove member |
| 7 | P | Bjud in creators | empty state |

### B4 · `/brand/analytics` · Statistik & insikter

| Where | Numbers | Count |
|---|---|---|
| Kpi tiles (value + sub) | Totala visningar (+ creators · posts), Total spend (+ kvar), CPM, Snitt visningar / post (+ senaste dygnet) | 10 |
| Mini tiles (value + hint) | Engagemang (+ ER), Klick (+ CTR), Kostnad / klick, Attention score | 8 |
| AES card | score, 3 bars, CPM, Viral rate | 6 |
| Kostnad per … | CPM, CPC, CPE, CPP, CPSH, Visning, CPS | 7 |
| Engagemang donut + legend | ER, Likes, Kommentarer, Delningar, Sparningar | 5 |
| Kvalitetssignaler | 3 bars + Save rate, Save/like, Delning/visn. | 6 |
| Visningar per kampanj | chart + Total reach, Senaste dygnet, Kostnad / visning | 3 |
| Budget donut | %, Spenderat, Kvar | 3 |
| Bästa creators (×6) | Views, Kostnad/1K, Visn/1000kr | 18 |
| Per nisch (×6) | views, ER, CPM | 18 |
| Bäst presterande content (×6) | views, eng., klick | 18 |
| Videolängd | 5 bars + 5 rows (posts, ER) | 15 |
| Publiceringstid | 4 bars | 4 |
| Topp-hashtags (×8) | views, count | 16 |
| Viralitet | 3 tiles + Viral rate + Visningar senaste dygnet | 5 |
| Insikter | up to 4 sentences with numbers | 4 |
| **Above the fold** | | **18** |
| **Whole page** | | **140+** |

Actions: L Alla kampanjer →, L Hitta fler (creators), X Visa video (per content row), P Skapa kampanj (empty). Everything is shown at once; no tabs or segmentation.

### B5 · `/brand/campaigns` · Kampanjer

| # | Type | Label | Does |
|---|---|---|---|
| 1 | P | Ny kampanj | `/brand/campaigns/new` |
| 2 | T×5 | Alla / Utkast / Aktiva / Pausade / Avslutade (no counts) | filter |
| 3 | Stat | "N kampanjer" | |
| 4 | R | Campaign row: status badge, progress %, Creators x/y, Spenderat av budget (5 numbers) | `/brand/campaigns/:id` |
| 5 | L | Snabbvy | `CampaignQuickView` modal: 6 facts, progress %, **Öppna kampanjen →**, **Ta bort kampanj** (2-step), × |
| 6 | P | Skapa kampanj | empty state |
| 7 | S×2 | Föregående / Nästa | pagination |

Observation: delete-campaign lives only inside the quick-view modal.

### B6 · `/brand/campaigns/new` · Skapa ny kampanj

One long form, no steps: Kampanjnamn, Beskrivning, Kategori, Hashtag, Startdatum, Slutdatum, Total budget, Max antal creators, Antal videor per creator; Utbetalningsmodell (3 toggle cards: Fast / Per visning / Trappsteg) with 2 fields (Fixed / CPM) or N rows × 3 fields + "+ Lägg till steg" / remove (Tiered); summary box (Sammanfattning, Uppskattad maxkostnad); Instruktioner till creators; Innehållstaggar (2 `TagSelector`s); Förmåner & PR; **Skicka för granskning**, Avbryt. ≈ 20 inputs. Back link "‹ Mina kampanjer".

### B7 · `/brand/campaigns/:id` · Campaign detail

| Where | Numbers | Count |
|---|---|---|
| Stat cards | Views totalt, Budget kvar / Maximal kostnad, Upparbetat hittills (live only), Aktiva creators x/y, Utbetalningsmodell terms | 4–5 |
| Ansökningar header | count | 1 |
| Per creator block | views, payout, N/M videor godkända, payout status, paid date | 5 |
| Per video | views, date, auto-approve hours | 3 |
| **Above the fold** | | **5** |

| # | Type | Label | Does |
|---|---|---|---|
| 1 | L | ‹ Mina kampanjer | back |
| 2 | S | Redigera kampanj / Stäng redigering (Draft) | toggles `DraftEditCard` (6 fields, Spara ändringar, Avbryt) |
| 3 | P | Skicka för granskning (Draft) | publish |
| 4 | P / S confirm | Godkänn / Neka (per application; reject reason hardcoded) | application decision |
| 5 | X | @tiktok handle | external |
| 6 | P | Öppna kranen (Completed) | `/brand/tap` |
| 7 | P | Markera som betald (per creator) | manual payout |
| 8 | L | ↻ Uppdatera views nu (per creator) | refresh |
| 9 | P / S | ✓ Godkänn / ✗ Neka → reason + Neka + Avbryt (per video) | submission decision |
| 10 | Chat | `CreatorInlineChat` per creator (+ "+N nytt" badge) | messages |

Observations: no review/rating for the creator here (see B20). Uses Tailwind utility classes and `<Button>` while the rest of the page uses the custom CSS system.

### B15 · `/brand/applications` · Ansökningar

Per campaign: collapsed row (NYA badge, "N ansökningar") → expanded card with **Visa kampanj**, **Minimera**; per application: avatar / name / "Visa hela profilen →" (all → `/brand/creators/:id`), category badge, follower badge, @tiktok link, message quote, date, status, **Godkänn**, **Neka** → reason input (required) + Bekräfta + Avbryt. Empty state has no CTA.

### B16 · `/brand/creators` · Hitta creators

Filter card: Sök, Kategori, Land, Min. följare, Sortera, Expertis-tagg, "Endast öppna för PR" checkbox, **Sök** (8 controls, always expanded). Results count. Per card: Öppen för PR badge, bio, Följare / Arbeten / Betyg (3), 3 tags, **Visa profil**. Pagination.

### B17 · `/brand/creators/:id` · Creator detail

| Where | Numbers | Count |
|---|---|---|
| Header links | TikTok (followers), Instagram (followers) | 2 |
| Stat cards | Följare, Snittvisningar, Genomförda kampanjer, Betyg | 4 |
| Verifierat engagemang tiles | Views, Gilla, Kommentarer, Delningar, Engagemang % | 5 |
| Portfölj header, Omdömen header | counts, avg | 3 |
| **Above the fold** | | **6** |

| # | Type | Label | Does |
|---|---|---|---|
| 1 | L | ‹ Tillbaka till sök | `/brand/creators` |
| 2 | X×3 | TikTok, Instagram, Webbplats | external |
| 3 | **P** | Beställ video | `/brand/ugc/invite?creator=` |
| 4 | **S** | ＋ Bjud in till community | invite (inline) |
| 5 | **P** | Skicka PR-erbjudande / Stäng | toggles `SendPrOfferForm` (Rubrik, Typ, Kategori, Meddelande, PR-utbud, Ersättning, Produktvärde, Deadline; Skicka erbjudande, Avbryt; done → Stäng) |
| 6 | **S** | ✎ Skriv meddelande | `MessageCreatorModal` |
| 7 | X | portfolio media | external |

Four stacked action buttons of equal weight in the header, two of them styled primary.

### B18 · `/brand/pr` · PR-utskick

| Where | Numbers | Count |
|---|---|---|
| Stat cards | Totalt skickade, Väntar (osedda), Sedda, Accepterade, Nekade | 5 |
| Per kategori chips | count each | n |
| Per expanded row | Ersättning, Utbud, Deadline, Sedd, Svar | up to 5 |
| **Above the fold** | | **5** |

Actions: P Hitta creators (header), chip filters, T×6 (Alla / Skickade / Sedda / Accepterade / Nekade / Tillbakadragna), R row expands, S Dra tillbaka, pagination, P Hitta creators (empty). No "new offer" here; offers are only sent from a creator's detail page.

### B19 · `/brand/public-profile` · Min profil

Info banner; **✎ Redigera profil** toggle → form (Logotyp, Beskrivning, Bransch, Webbplats; Spara profil, Avbryt); then the same `BrandProfilePage` as C15 in `ownView`: 6 stat boxes, Uppdateringar with `PostComposer` (textarea, Lägg till bild / Utan bild, **Publicera**) and per-post **Ta bort** (2-step), Aktiva kampanjer grid, Tidigare kampanjer, Omdömen, ← Tillbaka. This is the only place a brand can post to followers.

### B20 · `/brand/assignments/:id` · Brand assignment detail

**Orphan: nothing in the app links here.** Back, title "{campaign} — {creator}", status + views + amount (2 numbers), `ChatPanel`, `ReviewSection`. This is the **only** screen where a brand can rate a creator.

### B22 · `/brand/settings` · Inställningar

Tabs: Profil / Konto & säkerhet. Profil: Logotyp, Företagsnamn, Organisationsnummer, Bransch, Telefon, Webbplats, Beskrivning, **Spara ändringar**. Säkerhet: Byt e-postadress, Språk, Radera konto, Byt lösenord (a second, inline implementation; creator uses the shared `ChangePasswordCard`).

### B8 · `/brand/ugc` · Beställ video

Stat tiles: Öppna beställningar (+ nya bud), Pågående uppdrag (+ väntar på dig), Levererade videor (+ totalt kr) = 6. Header: **Pipeline** (badge) → B9, **+ Ny beställning** → B10. "Väntar på dig" `CollabRow`s → B14. Grouped lists Öppna / Utkast / Stängda: per row badges (nya bud, AI), meta (compensation, range, hired x/y, date), Draft rows have an inline **Publicera** button, row → B11 (or B12 for drafts). Empty → Skapa första beställningen.

### B9 · `/brand/ugc/pipeline` · Pipeline

Same 7-column kanban as C8 with brand copy.

### B10 / B12 · `/brand/ugc/campaigns/new`, `/:id/edit` · Ny beställning

Back "← Beställ video". `OrgNumberNotice` → **Lägg till org.nr →** `/brand/settings`. Brief card: Titel, Mål, Format, Längd, Antal videor, Hooks, Call to action, Gör, Undvik, Referenser, Övrigt (11). Ersättning & rättigheter: Ersättningstyp, Min / Max per video, `FeeNote`, Produkt, Ungefärligt värde, Rättighetspaket (+ hint), Leveranstid, Antal creators (8). Vilka creators: Region, Kategorier toggles, Min följare (3). **Publicera**, Spara utkast, Ta bort utkast. ≈ 22 inputs in a 2-column grid.

### B11 · `/brand/ugc/campaigns/:id` · Beställning detail

Header meta line: compensation, range, rights, days, hired x/y (5). Draft: **Redigera**, **Publicera**; Published: Stäng beställningen. Bud card: per `BidRow` avatar / name → B17, Favorit badge, Godkänd av VYRLE badge, bid, följare, L/F %, leveranser, i tid %, ★ (6 numbers), pitch quote, date; **Anlita {amount}**, Favorit, Avböj → reason + Avböj + Avbryt. `<details>` "N hanterade bud" (Öppna uppdraget → or status). Brief card. Målgrupp card (4 facts).

### B13 · `/brand/ugc/invite?creator=` · Beställ video av {name}

Reachable only from B17. Back, `OrgNumberNotice`, Brief (Titel, Mål, Format, Längd, Antal, Hooks, CTA, Gör, Undvik = 9), Ersättning (Ersättningstyp, Ersättning kr, `FeeNote`, Produkt, Rättighetspaket, Leveranstid = 6), **Skicka inbjudan**.

---

## 4. Findings

### 4.1 Duplicates (same action or same number reachable from several places)

| # | What | Where (count) | Note |
|---|---|---|---|
| D1 | Read / send messages | Topbar drawer, mobile tab drawer, Meddelanden page, `ChatPanel` on C4, `CreatorInlineChat` on B7, `ChatPanel` on B20, UGC `MessagesCard` on C9/B14, Support tab on C20/B21 (**8 surfaces**) | Two of the five mobile tab slots open drawers that duplicate a page in the sidebar |
| D2 | Approve / reject campaign applications | B15 Ansökningar page **and** B7 campaign detail | Different reject UX: B15 requires a reason, B7 hardcodes "Avvisad av varumärke" |
| D3 | Approve / reject submitted videos | B7 campaign detail (per creator) **and** B2 `TapReviewSection` | Two review queues with the same 48 h auto-approve rule |
| D4 | Edit brand profile (logo, description, industry, website) | B22 Settings → Profil **and** B19 Min profil → Redigera profil | Same fields, two forms |
| D5 | Creator profile / settings | `/creator/settings` and `/creator/profile` render the same component; C11 links to it twice ("Redigera profil", "Redigera") | |
| D6 | Change password | Creator: shared `ChangePasswordCard`; Brand: inline form in B22 | Two implementations |
| D7 | Apply to a campaign | C2 card, C15 brand profile card, C18 Saved ("Ansök via Upptäck" bounces to C2 without applying) | |
| D8 | Stripe verification CTA | C19 `CreatorVerificationCard`; C6 profile card "Verifiera dig för utbetalning"; C6 per-card "Verifiera dig först" | All land on C19 |
| D9 | PR stats | B1 Home (rate donut + 4 rows) and B18 (5 tiles) | |
| D10 | Total budget / Spenderat | B1 hero **and** B1 chart footer on the same screen; again on B4 | |
| D11 | Verifierade views + Intjänat | C1 hero, C1 metric row, C3 tiles, C12 tiles, C11 tiles, C16 totals (**6 screens**) | |
| D12 | "Hitta creators" CTA | Sidebar, B1 shortcut, B18 header + empty, B4 "Hitta fler", B3 copy | |
| D13 | "Skapa / Ny kampanj" CTA | B1 ×4 (header button, chart empty, list empty, shortcut), B5 header + empty, B4 empty (**7 entry points**) | |
| D14 | "Upptäck / Hitta kampanjer" CTA | Sidebar, C1 ×4, C3 empty, C12 empty, C18 empty + per card, C5 empty | |
| D15 | Invite creator to community | B3 bulk modal **and** B17 single button | |
| D16 | "Beställ video" | B17 (direct invite) **and** B8 (open order) | Same label, two flows |
| D17 | Connect TikTok | C2 connect bar **and** C19 connection card (plus a dead `TikTokAlertBanner`) | |
| D18 | Creator's own reviews list | C1 (4 rows), C11 (full), C19 (full) | |
| D19 | Brand's campaign list | B1 (5 rows), B5, B15 (per campaign), B4 (per campaign), B19 (active) | |
| D20 | Language switch | Topbar and Settings card (both roles) | |
| D21 | Community invite response (creator) | C5 Kranar **and** C15 brand profile | |
| D22 | Brand reviews of creators, creator reviews of brands | `ReviewList` embedded on C1, C11, C19, C15, B17 | |

### 4.2 Orphans (features that are hard or impossible to reach)

| # | What | Why it is hard to reach |
|---|---|---|
| O1 | B20 `/brand/assignments/:id` | **No inbound link anywhere.** It is the only place a brand can rate a creator, so brand → creator reviews are effectively unreachable |
| O2 | C7 `/creator/ugc/applications` | No inbound link anywhere |
| O3 | C10 `/creator/ugc/profile` | Only via a secondary outline button on C6 |
| O4 | B13 `/brand/ugc/invite` | Only via "Beställ video" on a creator's detail page |
| O5 | C8 / B9 UGC pipeline | Only via a secondary button on C6 / B8 or a notification; the sidebar item points at the marketplace home, not the user's own jobs |
| O6 | Every sidebar item except the first two | On mobile: Mer → scroll a 12–14 item list → tap (3 taps). 12 of 14 creator and 10 of 12 brand destinations |
| O7 | Support thread | Only the "Support från VYRLE" tab on the Messages page; the drawer that the tab bar opens does not include it. "Radera konto" silently posts into this thread |
| O8 | Begär utbetalning + Utbetalningsmetod | Bottom half of C16 under a donut, a bar chart and a 4-step explainer |
| O9 | Delete campaign | Only inside the Snabbvy modal on B5 |
| O10 | Post an update to followers | Only via B19 Min profil (referenced from B2 explainer text) |
| O11 | Send a PR offer | Only from B17; B18 PR-utskick has no "new" action, its header button goes to search |
| O12 | Campaign filters for creators | C2 has a category state but no control; the only filter is `?q=` set by global search |
| O13 | Global search | Topbar only; the mobile tab bar has no search entry |
| O14 | Tap video review queue | Inside B2 above the tap list; not on Home, only a sidebar badge |
| O15 | Community membership requests (brand side) | Only on B3; only a sidebar badge signals them |
| O16 | Creator campaign detail | Does not exist as a route. Notifications and search send creators to the browse grid and they must find the card again |

### 4.3 Screens that show more than 4 stats

Counted as numbers visible without scrolling at 375 px ("fold") and on the whole screen.

| Screen | Above the fold | Whole screen | Worst offender |
|---|---|---|---|
| B4 Brand Statistik | 18 | 140+ | Every metric on one page, no tabs |
| C1 Creator Home | 7 | 30–50 | Hero + metric row + 3 lists with numbers |
| B1 Brand Home | 5 | ~28 | Budget shown twice on the same screen |
| C12 Creator Statistik | 8 | ~32 | |
| C16 Intäkter | 6 | 25+ | Action buried under charts |
| B2 Kranar (brand) | 4–7 | 4 + ~10 per tap + 8 in form | |
| C5 Kranar (creator) | 5 | 5 + ~10 per tap | |
| C3 Mina kampanjer | 8 | 8 + 3 per row | Tile row + 4 tab counts |
| C13 PR-hubb | 6 | 6 + 4 tab counts + 4 per offer | |
| C11 Portfolio | 4 (7 with subs) | ~15 | |
| C15 / B19 Brand profile | 6 | 6 + 3 per tap + 4 per campaign | |
| B17 Creator detail (brand view) | 6 | 12 + | 4 tiles + 5 engagement tiles + link counts |
| B18 PR-utskick | 5 | 5 + category counts + 5 per row | |
| B3 Community | 4 | 4 + 5 per member | |
| B7 Campaign detail | 5 | 5 + 5 per creator + 3 per video | |
| B8 Beställ video | 6 | 6 + 4 per row | |
| B11 Beställning detail | 5 | 5 + 6 per bid | |
| C4 Assignment detail | 4 (10 on a tap) | 4 + 6 + 4 per video | |
| C17 Creator-nivåer | 6 | 16 | All static thresholds |
| C6 Videouppdrag | 4 | 4 + 4 per card | |
| B5 Kampanjer | 1 | 5 per row | |

Screens at or under 4: C2 Browse (3 per card), C18 Saved, C19 Settings (3), C20/B21 Messages (2 tab counts), C8/B9 Pipeline, C9/B14 Collab, B6, B10, B13, B15, B16 (3 per card), B22, C10.

### 4.4 Cross-cutting UI observations (input to Phases 3–5)

| # | Observation | Evidence |
|---|---|---|
| U1 | Two design systems coexist | Custom scoped CSS (`.vy-app .card`, `.btn-apply`, `.badge`) and Tailwind utilities + `<Card>`/`<Button>`/`<StatCard>` from `components/ui/index.tsx`, mixed inside B7, C2, C11, C13, B16, B18 |
| U2 | Inline styling instead of components | 1 844 `style={{…}}` blocks in `pages/` + `components/`; 29 distinct inline font sizes; 66 distinct inline hex colours |
| U3 | Three type families | "PP Neue Montreal"/Inter body, "Fraunces" serif for large numbers (no tabular figures), "Inter Tight" in `index.css` |
| U4 | Colored page surfaces | Body is warm ivory `#FFF4EC`; hero blocks are dark navy with peach/lilac radial gradients + grain + glow; many cards use `linear-gradient(160deg,#fff,#FFF6F0)` inline; stat icons have gradient chips; avatars are gradient tiles |
| U5 | Six stat-tile implementations | `.stat`, `.vstat`, `StatCard`, `BigStat`, `Kpi`, `Mini`, `PayoutState`, `statBox` (C15) |
| U6 | Two badge systems | `.badge green/amber/grey/red` and `.vy-badge pos/pend/neg/neu/info` |
| U7 | Five hand-rolled centered modals, zero bottom sheets | `ApplyModal`, `MessageCreatorModal`, `CampaignQuickView`, `InviteCreatorsModal`, UGC apply dialog in C6; plus two side drawers |
| U8 | Kanban on mobile | C8/B9: 7 × 270 px columns in a horizontal scroller on a 375 px viewport |
| U9 | Always-expanded filter panels | B16: 8 controls above the results; B6/B10: 20+ inputs in one scroll |
| U10 | Primary-action ambiguity | B17 has 4 stacked header buttons (2 primary); C9 up to 8 buttons in one row; C4 offers 3 ways to add a video; B1 has 4 "new campaign" entry points |
| U11 | Dead code | `CreatorDashboard`, `BrandDashboard`, `AssignmentTable`, `BrandCampaignTable`, `TikTokAlertBanner` (only used by the dead dashboard), `components/layout/AppLayout.tsx`, `StatCard`/`DataTable` (only used by dead dashboards), `CreatorLinksPage` behind a false flag |
| U12 | Route aliases | `/creator/settings` = `/creator/profile`; `/dashboard`, `/messages`, `/ugc` redirects |
| U13 | Data-mapping bug visible in UI | C17 levels page counts payouts with `status === 'Paid'`; real statuses are `Completed`, so every creator shows level 1 |

---

## 5. Counts at a glance

| | Creator | Brand |
|---|---|---|
| Routed pages | 21 (20 live, 1 flag-hidden) | 22 |
| Sidebar items | 14 (13 visible) | 12 |
| Destinations in mobile tab bar | 2 | 2 |
| Pages with > 4 stats above the fold | 8 | 7 |
| Orphan routes (no inbound link) | 1 | 1 |
| Distinct "go browse campaigns" CTAs | 12 | – |
| Distinct "new campaign" CTAs | – | 7 |
| Message surfaces | 8 | 8 |

Phase 1 complete. Waiting for approval before Phase 2 (information architecture).
