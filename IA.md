# VYRLE information architecture

Written in Phase 2 from [AUDIT.md](AUDIT.md); sections 6–7 were rewritten in Phase 5 (2026-09-20) to match what shipped. Sections 1–5 are the plan as approved. Every current page, shell element and modal from the audit is mapped in section 6; nothing is removed.

Design rules applied throughout:

- Mobile first. Bottom tab bar with 5 slots, the middle one is the "+" action. Desktop (≥1024 px) swaps the bar for a left sidebar with the same five entries and the same screens.
- One primary action per screen, in thumb reach (sticky bottom or first thing on screen). Everything else is secondary, in a "…" menu on the item, or one level deeper.
- Home shows at most 3 numbers. All other metrics live in Statistik behind segmented tabs.
- Group by intent. The five tabs answer five questions: *What needs me?* (Hem) · *What can I work on / who can I work with?* (Kampanjer / Creators) · *Do the thing* (+) · *Talk* (Meddelanden) · *Me and my money* (Profil).
- A "feature" is reachable within 2 taps from the bar. Filters, chips and sort orders inside a screen do not count as separate features.
- Badges: a dot on Hem when "Behöver dig" is non-empty; an unread count on Meddelanden. No "NY" tags.

---

## 1. Intents → tabs

| Question the user has | Creator | Brand |
|---|---|---|
| What needs me right now, how is it going? | **Hem** | **Hem** |
| What can I earn from? / What am I in? | **Kampanjer** (Mina · Upptäck) | on **Hem** (programs list) + full list one tap deeper |
| Who can I work with? | (brands are reached through campaigns, taps and the feed) | **Creators** (Community · Hitta · Ansökningar) |
| Let me do the core thing | **+** Lägg till video | **+** Öppna kran · Skapa kampanj · Beställ video · Skriv uppdatering |
| Who is talking to me? | **Meddelanden** (Chatt · Förfrågningar) | **Meddelanden** (Chatt · Erbjudanden) |
| Me, my money, my settings | **Profil** | **Profil** |

Brand tabs follow the suggested starting point (Hem · Creators · + · Meddelanden · Profil). The brand's programs (kranar, kampanjer, beställningar) are the Home feed itself, with a full list one tap deeper. The alternative (a "Kampanjer" tab and Creators under Profil) was considered and rejected: after the tap pivot the creator pool is the asset a brand manages daily, and a brand's programs are exactly what a brand dashboard should show.

---

## 2. Creator sitemap

Tab bar: **Hem · Kampanjer · + · Meddelanden · Profil**

```
Hem                                   /creator
├─ Notiser (bell in header)           /creator/notifications
├─ Behöver dig (action rows)           → each row deep-links
├─ Din översikt: 3 numbers            → Statistik
├─ Dina kranar (rows)                 → assignment detail (tap)
└─ Ditt flöde (brand posts, new campaigns from followed brands)

Kampanjer                             /creator/assignments   (default segment: Mina)
├─ Mina                               /creator/assignments
│   ├─ Behöver dig · Kranar · Kampanjer · Videouppdrag · Ansökta · Avslutade (sections)
│   ├─ Assignment detail              /creator/assignments/:id      (campaign or tap)
│   └─ Videouppdrag detail            /creator/ugc/collabs/:id
└─ Upptäck                            /creator/browse   chips: Alla · Kampanjer · Kranar · Videouppdrag
    ├─ Campaign detail (NEW)          /creator/campaigns/:id   primary: Ansök
    ├─ Företagsprofil                 /creator/brands/:id      primary: Ansök till kranen / Följ
    └─ Videouppdrag (order) detail    /creator/ugc/orders/:id  primary: Ansök (bid)

+  Lägg till                          bottom sheet (no route needed; /creator/add for deep links)
├─ Lägg till video → pick active campaign/tap → VideoPicker / paste link
├─ Leverera videouppdrag → pick collab awaiting delivery → upload
└─ Lägg till i portfolio

Meddelanden                           /creator/messages
├─ Chatt (VYRLE Support pinned at top) /creator/messages/:threadId
└─ Förfrågningar                      /creator/messages?tab=requests
    ├─ PR-erbjudanden (accept / decline inline)   chip: Historik
    └─ Community-inbjudningar (accept / decline inline)

Profil                                /creator/profile        (public profile as brands see it)
├─ Redigera profil                    /creator/profile/edit
├─ Portfolio items (view, "…" per item)   on the profile itself
├─ Intäkter                           /creator/earnings       primary: Begär utbetalning
│   ├─ Utbetalningsmetod (sheet)
│   ├─ Verifiering & skatt (Stripe)   /creator/earnings/verification
│   └─ Historik (Väntande · Godkänt · Utbetalt)
├─ Statistik                          /creator/analytics      Översikt · Prestation · Plattformar · Pengar
├─ Creator-nivå                       /creator/levels
├─ Sparat                             /creator/saved
├─ Länkar (behind FEATURES.linkTree)  /creator/links
├─ Inställningar                      /creator/settings
│   ├─ TikTok-konto                   /creator/settings/tiktok
│   ├─ Videouppdrag (matchning)       /creator/settings/ugc
│   ├─ Konto (e-post, lösenord)       /creator/settings/account
│   ├─ Språk
│   ├─ Hjälp & support (→ pinned support chat)
│   ├─ Villkor · Integritet
│   └─ Radera konto
└─ Logga ut
```

---

## 3. Brand sitemap

Tab bar: **Hem · Creators · + · Meddelanden · Profil**

```
Hem                                   /brand
├─ Notiser (bell in header)           /brand/notifications
├─ Behöver dig (action rows)
│   ├─ N videor att granska           → /brand/review        (unified: campaign + tap submissions)
│   ├─ N ansökningar                  → Creators › Ansökningar
│   ├─ N vill gå med i communityn     → Creators › Community
│   ├─ N nya bud                      → Kampanjer › Beställningar
│   └─ Uppdrag väntar på dig          → collab detail
├─ Denna månad: 3 numbers             → Statistik
├─ Kranar (rows)          Visa alla → /brand/campaigns?tab=taps
├─ Kampanjer (rows)       Visa alla → /brand/campaigns?tab=campaigns
├─ Beställningar (rows)   Visa alla → /brand/campaigns?tab=orders
└─ Senaste från communityn (newest approved videos, feed style)

Alla kampanjer & kranar               /brand/campaigns   segments: Kranar · Kampanjer · Beställningar; chips per status
├─ Kran detail (NEW page)             /brand/tap/:id       month meter, brief, videos to review, "…": Redigera · Pausa · Stäng
├─ Kampanj detail                     /brand/campaigns/:id
│   ├─ Creator i kampanjen            /brand/campaigns/:id/creators/:assignmentId   (videos, chat, mark paid, betygsätt)
│   └─ Ansökningar (filtered queue)   → Creators › Ansökningar?campaign=
├─ Beställning detail                 /brand/ugc/campaigns/:id   bids, primary per bid: Anlita
└─ Uppdrag (collab) detail            /brand/ugc/collabs/:id

Creators                              /brand/creators        (default segment: Community)
├─ Community                          /brand/creators?tab=community   sections: Vill gå med · Inbjudna · Medlemmar
├─ Hitta                              /brand/creators?tab=find        search bar + Filter sheet
├─ Ansökningar                        /brand/creators?tab=applications   chips per campaign
└─ Creatorprofil                      /brand/creators/:id    primary: Bjud in till community; row: Meddelande · Beställ video · PR-erbjudande

+  Skapa                              bottom sheet
├─ Öppna en kran                      /brand/tap/new           (stepped form)
├─ Skapa kampanj                      /brand/campaigns/new     (stepped form)
├─ Beställ video                      /brand/ugc/campaigns/new (stepped form)
└─ Skriv uppdatering                  /brand/post/new          (composer sheet)

Meddelanden                           /brand/messages
├─ Chatt (VYRLE Support pinned)       /brand/messages/:threadId
└─ Erbjudanden (sent PR offers)       /brand/messages?tab=offers   chips: Alla · Väntar · Accepterade · Nekade

Profil                                /brand/profile          (own profile: logo, name, 3 numbers, posts)
├─ Visa som creators ser den          /brand/profile/public
├─ Företagsprofil (edit)              /brand/profile/edit     (one form: logo, name, org.nr, bransch, telefon, webb, beskrivning)
├─ Statistik                          /brand/analytics        Översikt · Prestation · Plattformar · Pengar
├─ Inställningar                      /brand/settings
│   ├─ Konto (e-post, lösenord)       /brand/settings/account
│   ├─ Språk
│   ├─ Hjälp & support
│   ├─ Villkor · Integritet
│   └─ Radera konto
└─ Logga ut
```

---

## 4. Screen contracts

Each screen: what is above the fold, the one primary action, and what moved to "…".

### 4.1 Creator

| Screen | Above the fold | Primary action | Secondary / "…" |
|---|---|---|---|
| Hem | Behöver dig rows; 3 numbers: **Intjänat · Verifierade views · Att hämta ut** | Whatever the top "Behöver dig" row is (contextual) | bell → Notiser |
| Kampanjer › Mina | Sectioned list; first section is "Behöver dig" | Row tap | none |
| Kampanjer › Upptäck | Search, chips, first cards | Card tap → detail | Bookmark on card |
| Campaign detail (new) | Brand, title, 3 facts: Ersättning · Platser · Slutar | **Ansök** (sticky bottom) → ApplyModal as bottom sheet | Räkna på ersättning (expand), Spara, Visa företag |
| Assignment detail | Title, status, 3 numbers: **Views · Intjänat · Slutar om** (tap: månad/månadstak instead of Slutar) | **Lägg till video** (sticky bottom) → sheet: från TikTok / klistra in länk | "…": Spårningskoder (copy fields), Uppdatera views, Lämna omdöme (when completed), Visa företag, Öppna chatt. Sections below: Videor · Brief & villkor · Chatt |
| Videouppdrag detail (collab) | Title, status line, amount | The first server-listed action (Acceptera / Leverera / Betygsätt) as sticky primary | Other server actions as secondary; Kontrakt, Licensbevis, Öppna tvist, Avbryt in "…". Sections: Leverans · Brief · Chatt · Betalning · Händelser (collapsed) |
| Företagsprofil | Header, Följ, 3 numbers: **Följare · Aktiva kampanjer · Betyg** ("Visa mer" reveals Genomförda · Views · Ambassadörer) | **Ansök till kranen** when a tap is open, otherwise Följ | Campaign cards → campaign detail; Tidigare kampanjer collapsed |
| Order detail (UGC) | Brand, title, Ersättning · Format · Leverans | **Ansök** → bid sheet | none |
| + sheet | List of active work items | Pick one | Upptäck kampanjer when empty |
| Meddelanden › Chatt | Support pinned, conversations | Row tap | none |
| Meddelanden › Förfrågningar | Requests newest first | Acceptera inline (Avböj secondary) | chip Historik |
| Profil | Avatar, name, handle, 3 numbers: **Följare · Verifierade views · Omdöme**, Redigera profil, bio, links, tags, portfolio grid, reviews | Redigera profil | "…" per portfolio item: Redigera · Ta bort. Menu rows below the profile |
| Intäkter | **Att hämta ut** (one big number) | **Begär utbetalning** (sticky) | Rows: Utbetalningsmetod, Verifiering & skatt, PR-värde att deklarera, Så får du betalt. Segmented history below |
| Statistik | Segment control, 3–4 tiles of the chosen segment | none | see section 5 |
| Creator-nivå | Level, progress bar | none | Alla nivåer list |
| Sparat | Saved cards | Card tap → campaign detail | Remove bookmark |
| Inställningar | Menu list | Row tap | each sub-screen has one Spara |

### 4.2 Brand

| Screen | Above the fold | Primary action | Secondary / "…" |
|---|---|---|---|
| Hem | Behöver dig rows; 3 numbers: **Spenderat · Views · Aktiva creators** | Top "Behöver dig" row | bell → Notiser |
| Alla kampanjer & kranar | Segment control, status chips, rows | Row tap | none (creation is in "+") |
| Kran detail (new) | Name, status, **Spenderat av budget** meter, Views · Aktiva creators | **Granska videor (N)** when pending, otherwise none | "…": Redigera · Pausa / Öppna igen · Stäng. Sections: Brief · Videor · Medlemmar |
| Kampanj detail | Title, status, 3 numbers: **Views · Spenderat av budget · Creators x/y** | Draft: **Skicka för granskning**. Completed: **Öppna kranen**. Active: none | "…": Redigera (draft) · Ta bort · Snabbfakta (the old quick-view facts). Sections: Creators (rows) · Ansökningar (N) → queue · Brief (collapsed) |
| Creator i kampanjen | Creator, status, Views · Intjänat · Videor godkända | **Godkänn** on the oldest pending video; otherwise **Markera som betald** when payable | "…": Uppdatera views · Betygsätt · Visa profil. Sections: Videor · Chatt |
| Att granska (unified) | Oldest pending video first (embed, creator, program, auto-approve timer) | **Godkänn** | Neka (secondary, asks reason) |
| Beställning detail | Title, status, meta | Draft: **Publicera**. Published: **Anlita** on each bid | "…": Redigera · Stäng · Ta bort utkast. Per bid "…": Favorit · Avböj. Brief collapsed |
| Uppdrag (collab) detail | as creator | first server action (Acceptera & betala / Godkänn leveransen) | rest as secondary / "…" |
| Creators › Community | Vill gå med (Godkänn primary per row), Inbjudna, Medlemmar | Godkänn requests; else none | Per member "…": Skriv · Ta bort. Per invited "…": Dra tillbaka. Header: "Bjud in" (secondary) → bulk sheet |
| Creators › Hitta | Search bar, Filter button, result cards | Card tap | Filter sheet (Kategori, Land, Min följare, Tagg, PR, Sortera) |
| Creators › Ansökningar | Pending first, chip per campaign | **Godkänn** per row | Neka (asks reason) · Visa profil |
| Creatorprofil | Avatar, name, 3 numbers: **Följare · Snittvisningar · Betyg**, tags | **Bjud in till community** (or "I ditt community ✓") | Action row: Meddelande · Beställ video · PR-erbjudande. "Visa mer" reveals engagement tiles. Portfolio · Omdömen below |
| + sheet | 4 options | Pick one | none |
| Meddelanden › Erbjudanden | Sent offers, status | Row expands | "…": Dra tillbaka |
| Profil | Logo, name, 3 numbers: **Följare · Ambassadörer · Betyg**, posts | Redigera profil | Per post "…": Ta bort. Menu rows below |
| Företagsprofil (edit) | One form | Spara | none |
| Statistik | Segment control | none | see section 5 |

---

## 5. Statistik: where every metric goes

Home keeps 3 numbers per role. Everything else is here, one segment at a time. Only existing data is used; nothing new is computed server-side.

### 5.1 Creator

| Segment | Metrics (from audit pages C1, C3, C5, C11, C12, C16, C17) |
|---|---|
| **Översikt** | Verifierade views · Intäkter · Spårade klick · Live-kampanjer; hints: kampanjer, klickfrekvens, kr/1K views, snittvisningar; chart: views per kampanj; Genomförda kampanjer; Följare |
| **Prestation** | Per-campaign rows (Views · Klick · Intjänat); Toppkampanj / Bästa kampanjen; Innehåll som presterar bäst; per video: Views · Gilla · Kommentarer · Delningar; Creator-betyg (avg stars, reviews count); tracked link clicks (from the flag-hidden Länkar page) |
| **Plattformar** | TikTok: ansluten, @handle, följare, snittvisningar, senast synkad, antal spårade videor; Instagram: handle (no metrics available today). Label the segment honestly: only TikTok has data |
| **Pengar** | Totalt intjänat · Upplupet · Väntande · Godkänt · Utbetalt (donut + legend); Snitt / utbetalning · Andel utbetalt; Varumärken du tjänar mest på; Intäkt / 1K views; Kranar: denna månad, totalt från kranar, kranens % använd; PR-värde att deklarera (produkter, ersättning); Creator-nivå threshold progress |

### 5.2 Brand

| Segment | Metrics (from B1, B2, B3, B4, B7, B8, B18) |
|---|---|
| **Översikt** | Totala visningar · Total spend · CPM · Snitt visningar / post; Engagemang (ER) · Klick (CTR) · Kostnad / klick · Attention score (AES) with its 3 bars; senaste dygnet; creators · posts; Community: medlemmar · auto-kvalificerade · inbjudna; Insikter |
| **Prestation** | Visningar per kampanj (chart); Bästa creators (Views · Kostnad/1K · Visn/1000 kr); Per nisch (views · ER · CPM); Bäst presterande content; Kvalitetssignaler (ER · share rate · CTR · delning/visn.); Viralitet (100K+ · 500K+ · 1M+ · viral rate); PR-utskick: skickade · sedda · accepterade · nekade · acceptans %, per kategori; Beställ video: levererade videor |
| **Plattformar** | TikTok: Likes · Kommentarer · Delningar · Sparningar (0, with the "ej från TikTok ännu" note); Prestanda per videolängd; Bästa publiceringstid; Topp-hashtags; Save rate / Save-like (unavailable). Instagram: none today |
| **Pengar** | Total budget · Spenderat · Kvar · Utnyttjande; Spenderad budget per kampanj (chart); Budget donut; Kostnad per: CPM · CPC · CPE · CPP · CPSH · visning · CPS; Kranar: månadsbudget, spenderat denna månad, kvar, per kran; Beställ video: totalt betalt; Intjänat av communityn; Manual payouts per creator (status, datum) |

---

## 6. Before → After mapping (as shipped)

Updated after Phase 5 (2026-09-20) to what is in the code. Every row of the audit's route tables, plus shell elements and modals. "Taps" = taps from the bottom bar on a phone. The feature-level list is in [CHECKLIST.md](CHECKLIST.md).

### 6.1 Shell

| Before (audit #) | After | Taps |
|---|---|---|
| S1 Logo link | Desktop sidebar wordmark → Hem; Hem tab on a phone | 0–1 |
| S2 Sidebar nav (14 / 12 items) | 5-slot tab bar; desktop sidebar with the same 5 (`components/app/AppShell.tsx`). Remaining destinations are segments of Kampanjer / Creators or rows on Profil | – |
| S3 Logga ut | Profil → last row | 2 |
| S4 Identity card | Profil header | 1 |
| S5 Hamburger / "Mer" | Removed; nothing is behind a hamburger | – |
| S6 Global search | Creator: search field on Kampanjer › Upptäck. Brand: search field + Filter sheet on Creators › Hitta. The planned desktop ⌘K page-jump was not built: every page is ≤2 taps away | 2 |
| S7 Language switcher (topbar) | Profil › Inställningar › Språk (single place) | 3 |
| S8 Messages icon + drawer | Meddelanden tab (page, no drawer) | 1 |
| S9 Notifications icon + drawer | Bell in every screen header → Notiser page (`/creator/notifications`, `/brand/notifications`) | 1 |
| S10 Profile chip | Profil tab | 1 |
| S11 Email verify banner | Unchanged: slim banner under the header on every screen | – |
| S12 Mobile tab bar | New 5-slot bar per section 2/3; the middle slot opens the "+" sheet | – |
| S13 Notifications drawer | Notiser page; "Markera alla lästa" in its header; `notifTarget()` retargeted to the new routes | 1 |
| S14 Messages drawer | Meddelanden › Chatt; thread view is the same page with `?thread=<id>`; VYRLE Support pinned at the top (`?thread=support`) | 1–2 |

### 6.2 Creator pages

| Before | After (route) | Taps | Notes |
|---|---|---|---|
| C1 `/creator` Översikt | **Hem** `/creator` (`screens/creator/HomeScreen.tsx`): Behöver dig rows · Din översikt (3 numbers) · Dina kranar · Ditt flöde · Öppna kampanjer. Chart, reputation donut, per-campaign footer → Statistik | 0 | Discover rows open the campaign itself |
| C2 `/creator/browse` Upptäck | **Kampanjer › Upptäck** `/creator/browse?type=all|campaigns|taps|video` (`WorkScreen.tsx`); search field; rows → **campaign detail** `/creator/campaigns/:id` (`CampaignDetailScreen.tsx`) with the apply sheet, PayoutEstimator, bookmark; video orders → `/creator/ugc/orders/:id` (`OrderScreen.tsx`) with the bid sheet. TikTok connect bar → Hem row + Inställningar › TikTok-konto | 2 | New campaign and order detail routes (fixes O16) |
| C3 `/creator/assignments` Mina kampanjer | **Kampanjer › Mina** `/creator/assignments` (default): sections Behöver dig · Kranar (`#kranar`) · Kampanjer · Videouppdrag (`#video`) · Ansökta (`#ansokta`) · Avslutade. Stat tiles → Hem / Statistik | 1 | |
| C4 `/creator/assignments/:id` | **Assignment detail** (same route, `AssignmentScreen.tsx`). 3 tiles; Brief & villkor; tap header variant; "…" › Spårningskoder · Uppdatera views nu · Visa företaget · Lämna omdöme; "Lägg till video" sheet (`?add=1`); Videor; Chatt; Omdöme | 2 | |
| C5 `/creator/taps` Kranar | Dissolved into Kampanjer › Mina › Kranar and Hem › Dina kranar; tap detail = assignment detail (tap variant); invites → Meddelanden › Förfrågningar; withdraw request → brand profile; tiles → Statistik › Pengar | 1–2 | Redirects |
| C6 `/creator/ugc` Videouppdrag | **Kampanjer › Upptäck › Videouppdrag** chip with "Passar dig" toggle; order detail per C2; profile card → Statistik + Intäkter › Verifiering & skatt; "Väntar på dig" → Behöver dig | 2 | Redirects |
| C7 `/creator/ugc/applications` (orphan) | **Kampanjer › Mina › Ansökta** (campaign applications + UGC bids); "…" › Ta tillbaka | 1 | Fixes O2 |
| C8 `/creator/ugc/collabs` kanban | **Kampanjer › Mina › Videouppdrag** list rows | 1 | No kanban |
| C9 `/creator/ugc/collabs/:id` | **Uppdrag detail** (same route, `screens/shared/CollabScreen.tsx`, shared with brand and admin): one primary = next step, other actions in "…", sections Leverans · Tvist · Brief · Kontrakt · Chatt · Betalning · Händelser | 2 | `/admin/ugc/collabs/:id` uses the same screen |
| C10 `/creator/ugc/profile` | **Profil › Inställningar › Videouppdrag** `/creator/settings/ugc` | 3 | |
| C11 `/creator/portfolio` | **Profil** tab `/creator/profile` (`ProfileScreen.tsx`): header with 3 numbers and facts, Portfolio, Omdömen, rows to Intäkter · Statistik · Creator-nivå · Sparat · Länkar · Inställningar. Add item: "+" › Lägg till i portfolio (`?add=1`); edit form at `/creator/profile/edit` | 1 | |
| C12 `/creator/analytics` | **Statistik** `/creator/analytics` (`AnalyticsScreen.tsx`), segments Översikt · Prestation · Plattformar · Pengar | 2 | |
| C13 `/creator/pr` PR-hubb | **Meddelanden › Förfrågningar** `/creator/messages?tab=requests` (PR offers + community invites, accept / decline inline, Visa hanterade toggle). PR-värde att deklarera → Intäkter row | 2 | Redirects |
| C14 `/creator/links` (flag off) | **Profil › Länkar** `/creator/links`, still behind `FEATURES.linkTree` | 2 | |
| C15 `/creator/brands/:id` | **Företagsprofil** (same route, `screens/shared/BrandPublicScreen.tsx`): 3 numbers + Visa mer, Följ, Ansök till kranen (confirm sheet), invite answer, Uppdateringar, campaigns → campaign detail, collapsed history and reviews | 2–3 | Same component renders the brand's own Profil tab |
| C16 `/creator/earnings` | **Profil › Intäkter** `/creator/earnings` (`EarningsScreen.tsx`): Att hämta ut + Begär utbetalning first; rows Utbetalningsmetod (sheet) · Verifiering & skatt (`/creator/earnings/verification`) · PR-värde att deklarera · Så får du betalt; Historik segmented. Charts → Statistik › Pengar | 2 | Fixes O8; Stripe return `?onboarding=` lands on the verification screen |
| C17 `/creator/levels` | **Profil › Creator-nivå** `/creator/levels` (`MoreScreens.tsx`) | 2 | Counts payouts with status `Completed` (display fix for U13) |
| C18 `/creator/saved` | **Profil › Sparat** `/creator/saved`; rows → campaign detail; "…" › Öppna kampanjen / Ta bort från sparade | 2 | |
| C19 `/creator/settings` = `/creator/profile` | Split: `/creator/profile` = Profil tab; `/creator/profile/edit` = profile form; `/creator/settings` = menu (`SettingsScreen`) with `/creator/settings/tiktok`, `/creator/settings/ugc`, `/creator/settings/account` (e-post, lösenord, radera konto), Språk, Skriv till VYRLE-teamet, Villkor, Integritet. Verifiering + Skatt → Intäkter | 2–3 | Fixes D5, D6 |
| C20 `/creator/messages` | **Meddelanden** `/creator/messages?tab=chat|requests&thread=` (`screens/shared/MessagesScreen.tsx`) | 1 | |
| C21 `/creator/*` NotFound | `screens/shared/NotFoundScreen.tsx` inside the shell | – | |

### 6.3 Brand pages

| Before | After (route) | Taps | Notes |
|---|---|---|---|
| B1 `/brand` Översikt | **Hem** `/brand` (`screens/brand/HomeScreen.tsx`): Behöver dig (org.nr, videor att granska, ansökningar, vill gå med, nya bud, Din tur) · Just nu (3 numbers) · Kranar · Kampanjer · Beställningar · Senaste från communityn | 0 | |
| B2 `/brand/tap` Kranar | **Kampanjer & kranar › Kranar** `/brand/campaigns?tab=taps` (`ProgramsScreen.tsx`) + Hem rows. New pages: **Kran detail** `/brand/tap/:id`, **Öppna en kran** `/brand/tap/new`, **Redigera kranen** `/brand/tap/:id/edit` (`TapScreens.tsx`). Review → **Att granska** `/brand/review?tap=` (`ReviewQueueScreen.tsx`) | 2 | Redirects |
| B3 `/brand/community` | **Creators › Community** `/brand/creators?tab=community` (`CreatorsScreen.tsx`): sections Vill gå med · Inbjudna · Medlemmar; invite sheet from the header | 1 | Redirects |
| B4 `/brand/analytics` | **Statistik** `/brand/analytics` (`AnalyticsScreen.tsx`), segments Översikt · Prestation · Plattformar · Pengar | 2 | 140+ numbers → 4 screens |
| B5 `/brand/campaigns` | **Kampanjer & kranar › Kampanjer** `/brand/campaigns?tab=campaigns` with status chips; Snabbvy → detail "…" › Snabbfakta; delete → "…" › Ta bort kampanj | 2 | Fixes O9 |
| B6 `/brand/campaigns/new` | **+ › Skapa kampanj** (same route, `CampaignFormScreen.tsx`), steps Grund · Ersättning · Brief · Granska; Spara som utkast | 2 | Same fields, same submit |
| B7 `/brand/campaigns/:id` | **Kampanj detail** (same route, `CampaignScreens.tsx`): 3 tiles, draft primary + "…" › Redigera utkast, Creators rows → **Creator i kampanjen** `/brand/campaigns/:id/creators/:assignmentId` (Videor, Chatt, Omdöme, Markera som betald, "…" › Uppdatera views · Visa profil · Betygsätt), Ansökningar → Creators › Ansökningar `?campaign=`, sticky Granska videor → `/brand/review?campaign=` | 2 | |
| B8 `/brand/ugc` Beställ video | **Kampanjer & kranar › Beställningar** `/brand/campaigns?tab=orders`: Väntar på dig · Öppna beställningar · Pågående uppdrag (`#uppdrag`) · Utkast · Klara | 2 | Redirects |
| B9 `/brand/ugc/pipeline` kanban | Same segment, list sections | 2 | Redirects to `?tab=orders` |
| B10 `/brand/ugc/campaigns/new` | **+ › Beställ video** (same route, `OrderScreens.tsx`), steps Brief · Ersättning · Creators · Granska; `?creator=` = direct invite | 2 | |
| B11 `/brand/ugc/campaigns/:id` | **Beställning detail** (same route): primary Publicera / Anlita per bid; "…" › Redigera · Stäng beställningen · Ta bort utkast; bid "…" › Favorit · Visa profil · Avböj | 3 | |
| B12 `/brand/ugc/campaigns/:id/edit` | Same stepped form, from order detail "…" › Redigera | 3 | |
| B13 `/brand/ugc/invite?creator=` | `/brand/ugc/campaigns/new?creator=` from Creatorprofil › Beställ video | 3 | Redirects |
| B14 `/brand/ugc/collabs/:id` | **Uppdrag detail** (same route, shared `CollabScreen`) | 3 | |
| B15 `/brand/applications` | **Creators › Ansökningar** `/brand/creators?tab=applications&campaign=`; Godkänn primary, Neka asks for a reason | 2 | Fixes D2; redirects |
| B16 `/brand/creators` Hitta creators | **Creators › Hitta** `/brand/creators?tab=find`: search field + Filter sheet | 2 | |
| B17 `/brand/creators/:id` | **Creatorprofil** (same route, `CreatorDetailScreen.tsx`): primary Beställ video; "…" › Skicka PR-erbjudande (sheet) · Skriv meddelande (sheet) · Bjud in till community · Ta bort ur communityn · open links; 3 tiles + Verifierat på VYRLE | 2–3 | |
| B18 `/brand/pr` PR-utskick | **Meddelanden › Erbjudanden** `/brand/messages?tab=offers`; "…" › Dra tillbaka · Visa profil; stats → Statistik › Prestation | 2 | Fixes O11; redirects |
| B19 `/brand/public-profile` | **Profil** tab `/brand/profile` (own view = public view); edit at **Företagsprofil** `/brand/profile/edit`; post via "+" › Skriv uppdatering (`?post=1`); "…" › Ta bort inlägget | 1 | Fixes D4; no separate `/brand/profile/public` route was needed |
| B20 `/brand/assignments/:id` (orphan) | **Creator i kampanjen** `/brand/campaigns/:id/creators/:assignmentId`; old URL redirects via the assignment's campaign id | 3 | Fixes O1 |
| B21 `/brand/messages` | **Meddelanden** `/brand/messages?tab=chat|offers&thread=` | 1 | |
| B22 `/brand/settings` | **Inställningar** `/brand/settings` (`SettingsScreen.tsx`): Företagsprofil row → `/brand/profile/edit`; Konto → `/brand/settings/account` (shared cards); Språk; Skriv till VYRLE-teamet; Villkor; Integritet | 2–3 | Fixes D6 |

### 6.4 Modals and components

| Before | After |
|---|---|
| ApplyModal (centered) | Bottom sheet on campaign detail |
| UGC apply dialog in C6 | Bid bottom sheet on order detail |
| MessageCreatorModal | `MessageCreatorSheet` (exported from `CreatorDetailScreen.tsx`) |
| CampaignQuickView | "…" › Snabbfakta / Ta bort kampanj on campaign detail |
| InviteCreatorsModal | Bottom sheet on Creators › Community |
| NotificationsDrawer, MessagesDrawer | Pages |
| VideoPicker (inline expand) | Content of the "Lägg till video" sheet |
| PayoutRequestCard | Top of Intäkter |
| PayoutMethodCard | Row → sheet on Intäkter |
| PayoutEstimator, PayoutTerms | `components/app/PayoutTerms.tsx` (estimate function moved unchanged) |
| TapBanner | Assignment header, tap variant |
| CreatorTapsSection, BrandFeedSection | Hem sections |
| TikTokConnectBar, TikTokConnectionCard, TikTokAlertBanner | Hem "Behöver dig" row + `TikTokCard` on Inställningar › TikTok-konto |
| CreatorVerificationCard | Intäkter › Verifiering & skatt |
| ChatPanel, CreatorInlineChat | `components/app/Chat.tsx`: Chatt sections + Meddelanden |
| ReviewSection, ReviewList, StarRating | `components/app/Reviews.tsx` |
| ChangeEmailCard, ChangePasswordCard, LanguageCard, DeleteAccountCard | `components/app/AccountForms.tsx` |
| ConfirmButton, CopyButton, RefreshViewsButton | DS two-step `Button` / confirm sheets; copy rows in Spårningskoder; "…" › Uppdatera views nu. Files deleted |
| TikTokEmbed, DateInput, ImagePicker, Toast, Skeletons | Kept (Skeleton is the DS one) |
| GlobalSearch | Search fields on Upptäck / Hitta |
| LangSwitcher | `LanguagePicker` on Inställningar |
| Viz (Donut, AreaChart, MiniBars, Ring) | `components/app/Charts.tsx` (`Bars`, `LineChart`, `Donut`), Statistik only |
| CreatorDashboard, BrandDashboard, AssignmentTable, BrandCampaignTable, AppLayout, VyrleShell, ShellDrawers | Deleted in Phase 5 |

### 6.5 Contextual "…" menus (as shipped)

| Item | "…" contains |
|---|---|
| Campaign detail (creator) | Visa företaget (bookmark is a header button) |
| Assignment (creator) | Spårningskoder · Uppdatera views nu · Visa företaget · Lämna omdöme |
| Uppdrag (both roles, admin) | Markera som påbörjad · Betygsätt · Läs kontraktet · Licensbevis · Öppna tvist · Avböj / Avbryt · admin: Registrera betalning manuellt (only what the server lists) |
| Application / bid (creator, Ansökta) | Ta tillbaka · Visa företag |
| Portfolio item | Redigera · Ta bort |
| Saved campaign | Öppna kampanjen · Ta bort från sparade |
| Kran (brand) | Redigera · Pausa för alla creators / Öppna igen · Stäng kranen för gott |
| Kampanj (brand) | Redigera utkast · Snabbfakta · Ta bort kampanj |
| Creator in campaign (brand) | Uppdatera views nu · Visa profil · Betygsätt |
| Beställning (brand) | Redigera · Stäng beställningen · Ta bort utkast |
| Bid (brand) | Favorit · Visa profil · Avböj |
| Community request (brand) | Visa profil · Neka |
| Invited creator (brand) | Dra tillbaka inbjudan |
| Community member (brand) | Skriv meddelande · Visa profil · Ta bort ur communityn |
| Creatorprofil (brand) | Skicka PR-erbjudande · Skriv meddelande · Bjud in till community · Ta bort ur communityn · Öppna TikTok / Instagram / webbplats |
| Sent PR offer (brand) | Dra tillbaka · Visa profil |
| Own post (brand) | Ta bort inlägget |

---

## 7. Redirects (shipped in `App.tsx`)

| Old | New |
|---|---|
| `/creator/taps` | `/creator/assignments#kranar` |
| `/creator/ugc` | `/creator/browse?type=video` |
| `/creator/ugc/applications` | `/creator/assignments#ansokta` |
| `/creator/ugc/collabs` | `/creator/assignments#video` |
| `/creator/ugc/profile` | `/creator/settings/ugc` |
| `/creator/pr` | `/creator/messages?tab=requests` |
| `/creator/portfolio` | `/creator/profile` |
| `/creator/profile?onboarding=…`, `/creator/settings?onboarding=…` | `/creator/earnings/verification` (Stripe return) |
| `/creator/analytics`, `/creator/earnings`, `/creator/levels`, `/creator/saved`, `/creator/settings` | unchanged |
| `/brand/tap` | `/brand/campaigns?tab=taps` |
| `/brand/community` | `/brand/creators?tab=community` |
| `/brand/applications` | `/brand/creators?tab=applications` |
| `/brand/ugc` | `/brand/campaigns?tab=orders` |
| `/brand/ugc/pipeline` | `/brand/campaigns?tab=orders` (sections start at the top; `#uppdrag` exists for deep links) |
| `/brand/ugc/invite?creator=` | `/brand/ugc/campaigns/new?creator=` (query preserved) |
| `/brand/pr` | `/brand/messages?tab=offers` |
| `/brand/public-profile` | `/brand/profile` |
| `/brand/assignments/:id` | `/brand/campaigns/:campaignId/creators/:id` (campaign id fetched from the assignment) |
| `/brand/settings` | unchanged (menu); profile fields at `/brand/profile/edit` |
| `/dashboard`, `/messages`, `/ugc` | role redirects as before; `/ugc` → `/creator/assignments#video` or `/brand/campaigns?tab=orders` |
| Notification deep links in `notifTarget()` | retargeted to the rows above; no notification type lost a destination |

---

## 8. Reachability check (Definition of Done, "2 taps from the bar")

| Feature | Creator | Brand |
|---|---|---|
| See what needs me | Hem (0) | Hem (0) |
| Find work / find people | Kampanjer › Upptäck (2) | Creators › Hitta (2) |
| My active work / my programs | Kampanjer (1) | Hem (0), full list (1) |
| Add content / create | + (1) | + (1) |
| Review videos | – | Hem row (1) |
| Applications / requests | Meddelanden › Förfrågningar (2) | Creators › Ansökningar (2) |
| Chat, support | Meddelanden (1) | Meddelanden (1) |
| Money | Profil › Intäkter (2) | Profil › Statistik › Pengar (3, analytics only; there is no brand billing feature today) |
| Analytics | Hem numbers (1) or Profil › Statistik (2) | same |
| Public profile / portfolio | Profil (1) | Profil (1) |
| Settings, TikTok, account, language, delete | Profil › Inställningar (2) | Profil › Inställningar (2) |
| Saved, levels | Profil › (2) | – |
| Notifications | bell (1) | bell (1) |

Status (2026-09-20): all five phases shipped. Both open questions above were resolved as written (Creators is the brand's second tab; Support is a pinned conversation in Chatt). Section 6 and 7 describe the code as it is; [CHECKLIST.md](CHECKLIST.md) lists every old feature and its new place.
