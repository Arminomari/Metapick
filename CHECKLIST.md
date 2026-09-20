# VYRLE redesign — final checklist (Phase 5)

Every feature from [AUDIT.md](AUDIT.md) (shell S1–S14, creator pages C1–C21, brand pages B1–B22, modals and components) and where it lives in the shipped app. "Taps" = taps from the bottom bar on a phone; the desktop sidebar has the same five entries, so the count is the same there.

Verification: every screen was rendered at 375 × 812 with fixture data (`docs/screens/*.png`) and checked for no horizontal scroll, one primary action and at most four numbers above the fold. Phase 5 re-rendered login, register, terms, creator Home, brand Home, the in-app 404 and the admin collab route after the CSS purge; `tsc --noEmit` and `vite build` pass.

Nothing that worked before was removed. Items marked *changed* behave slightly differently on purpose; each says how.

---

## 1. Shell

| Old | New location | Taps | Done |
|---|---|---|---|
| S1 Logo → role home | Desktop sidebar wordmark → Hem; on a phone the Hem tab | 1 | [x] |
| S2 Sidebar nav (14 / 12 items) | 5-slot tab bar: creator **Hem · Kampanjer · + · Meddelanden · Profil**, brand **Hem · Creators · + · Meddelanden · Profil**. Desktop ≥1024 px: left sidebar with the same five | – | [x] |
| S2 Red count badges | Dot on Hem when "Behöver dig" is non-empty; unread count on Meddelanden; counts inside segment headers | – | [x] |
| S2 "NY" tags | Removed as decoration; the items they marked are ordinary rows | – | [x] *changed* |
| S3 Logga ut | Profil → last row | 2 | [x] |
| S4 Identity card (avatar, name, handle, followers / industry, status) | Profil header | 1 | [x] |
| S5 Hamburger / "Mer" overlay | Gone; nothing is behind a hamburger | – | [x] |
| S6 Global search (pages, campaigns, brands / creators) | Creator: search field on Kampanjer › Upptäck (campaigns, taps, video orders, brand names). Brand: search field + Filter sheet on Creators › Hitta. Page-jump (⌘K) dropped because every page is ≤2 taps away | 2 | [x] *changed* |
| S7 Language switcher (topbar) | Profil › Inställningar › Språk (one place, both roles) | 3 | [x] |
| S8 Messages icon + drawer | Meddelanden tab with unread badge | 1 | [x] |
| S9 Notifications icon + drawer | Bell in every screen header → Notiser page (`/creator/notifications`, `/brand/notifications`) | 1 | [x] |
| S10 Profile chip | Profil tab | 1 | [x] |
| S11 Email verify banner (resend with 60 s cooldown, dismiss) | Same banner under the header on every screen (`EmailVerifyBanner` in `AppShell.tsx`) | – | [x] |
| S12 Mobile tab bar (2 destinations + 2 drawers + Mer) | New 5-slot bar, middle slot is "+" (Lägg till / Skapa sheet) | – | [x] |
| S13 Notifications drawer: Markera alla lästa, deep links | Notiser page; "Markera alla lästa" in its header; `notifTarget()` retargeted to the new routes, no notification type lost its destination | 1 | [x] |
| S14 Messages drawer: list → thread, counterpart → profile, composer | Meddelanden › Chatt; thread is a page (`?thread=<id>`); counterpart header → profile; VYRLE Support pinned at the top (`?thread=support`) | 1–2 | [x] |

## 2. Creator

### C1 `/creator` Översikt → Hem `/creator`

| Old | New location | Done |
|---|---|---|
| Hero: Verifierade views, Totalt upplupet, Väntande utbetalning, Aktiva kampanjer | "Din översikt": Intjänat · Views · Att hämta ut (3 tiles) → Statistik. Active count is the Kampanjer › Mina list | [x] |
| Views / Intäkter / Klick toggle + chart | Statistik › Översikt (Views per kampanj) and › Prestation (Klickfrekvens, Intäkt / 1K views, Snittvisningar) | [x] |
| Chart footer: Toppkampanj, Snitt, Totalt | Statistik › Översikt › Per kampanj rows | [x] |
| Creator-betyg card (donut + reviewer rows) | Statistik › Prestation › Creator-betyg; full list on Profil › Omdömen | [x] |
| Aktiva kampanjer rows (+ Alla kampanjer →) | Kampanjer › Mina (sections Behöver dig · Kranar · Kampanjer · Videouppdrag · Ansökta · Avslutade) | [x] |
| Upptäck kampanjer items (went to browse, not the campaign) | Hem › "Öppna kampanjer" rows → **campaign detail** `/creator/campaigns/:id`; full list on Kampanjer › Upptäck | [x] *changed* |
| Bygg din portfölj → | Profil tab; "+" › Lägg till i portfolio | [x] |
| Dina kranar section (tap cards, Visa alla kranar →) | Hem › "Dina kranar" rows → assignment detail (tap variant); Visa alla → Kampanjer › Mina › Kranar | [x] |
| Community chip "waiting for tap" | Hem › Behöver dig row + Meddelanden › Förfrågningar | [x] |
| Ditt flöde (brand posts → brand profile) | Hem › "Ditt flöde"; empty state → Upptäck | [x] |
| Three "Upptäck kampanjer" CTAs | One: Kampanjer › Upptäck (plus the flöde empty state) | [x] *changed* |

### C2 `/creator/browse` Upptäck → Kampanjer › Upptäck `/creator/browse`

| Old | New location | Done |
|---|---|---|
| TikTok connect bar (Fortsätt med TikTok / Hantera) | Hem › Behöver dig row when unconnected → Inställningar › TikTok-konto `/creator/settings/tiktok` | [x] |
| `?q=` search + Rensa | Search field on Upptäck (clearable) | [x] |
| "N kampanjer tillgängliga" | Not shown as a separate number; the list is the count | [x] *changed* |
| Bookmark toggle per card | Bookmark on the campaign detail header; saved list on Profil › Sparat | [x] |
| Brand name → brand profile | Campaign detail header and "…" › Visa företaget | [x] |
| Application status badge | StatusBadge on the row and on the detail; Kampanjer › Mina › Ansökta | [x] |
| Tags (category, country, model) | Campaign detail header tags | [x] |
| Per-card Ersättning, Platser, Period | Row caption; detail › Ersättning section | [x] |
| Räkna på din ersättning (PayoutEstimator) | Campaign detail › Ersättning (slider) | [x] |
| Ansök → ApplyModal | Campaign detail primary → bottom sheet (motivation, Skicka ansökan) | [x] |
| "Godkänd — gå till Mina uppdrag" | Detail primary "Godkänd — öppna uppdraget" → the assignment | [x] |
| Disabled Fullbokad / Ansökan skickad / nekad | Blocked primary with the reason written under it; "Se din ansökan" → Mina › Ansökta | [x] |
| Pagination | Föregående / Nästa under the campaign list (same page size) | [x] |
| Category filter (state without a control) | Chips Alla · Kampanjer · Kranar · Videouppdrag (`?type=`) | [x] |

### C3 `/creator/assignments` Mina kampanjer → Kampanjer › Mina `/creator/assignments`

| Old | New location | Done |
|---|---|---|
| Tiles Godkänd & aktiv, Verifierade views, Intjänat, Väntande ansökningar | Hem › Din översikt (Intjänat, Views); Statistik; Ansökta section for pending | [x] |
| Tabs Alla / Aktiva / Avslutade / Pausade (+ counts) | Sections Behöver dig · Kranar · Kampanjer · Videouppdrag · Ansökta · Avslutade; status badge per row | [x] *changed* |
| Row → assignment detail (Kran badge) | Same | [x] |
| Hitta kampanjer (empty) | Empty state → Upptäck | [x] |
| Pagination | Grouped sections, no pages | [x] *changed* |

### C4 `/creator/assignments/:id` → Assignment detail (same route)

| Old | New location | Done |
|---|---|---|
| 4 stat cards | 3 tiles (views, estimated payout, time left); model in Brief & villkor | [x] |
| Brief card (payout terms, min views) | "Brief & villkor" section (PayoutTerms) | [x] |
| TapBanner (6 numbers) | Tap header variant: CPM, cap, month earned, "Kranen använd" bar | [x] |
| Goal-reached banner | Banner "Mål uppnått — maxersättningen är säkrad." | [x] |
| CopyFields hashtag / tracking-tag / färdig beskrivning | "…" › Spårningskoder sheet, Kopiera → "Kopierat" | [x] |
| Välj bland dina TikTok-videor (VideoPicker) + URL form | "Lägg till video" sheet: pick from your TikTok videos or "Eller klistra in länken"; opened by the primary button, by "+" (`?add=1`) and from Hem | [x] |
| ↻ Uppdatera views nu | "…" › Uppdatera views nu | [x] |
| TikTok embed / submission link | Videor section (TikTokEmbed kept); per video views · likes · comments · shares as a caption | [x] |
| ChatPanel | Chatt section (same thread as Meddelanden) | [x] |
| ReviewSection (Completed only) | Omdöme section when Completed; also "…" › Lämna omdöme | [x] |
| Se företagets uppdateringar → | "…" › Visa företaget | [x] |
| ‹ Mina kampanjer | Back in header | [x] |

### C5 `/creator/taps` Kranar → dissolved (redirects to `/creator/assignments#kranar`)

| Old | New location | Done |
|---|---|---|
| Tiles Denna månad, Totalt från kranar, Öppna kranar | Statistik › Pengar (Kranar denna månad, Kranar totalt, Kranar / mån) | [x] |
| Inbjudningar: Acceptera / Avböj | Meddelanden › Förfrågningar (accept / decline inline) + Hem › Behöver dig row | [x] |
| Väntande ansökningar: Ta tillbaka | Brand profile `/creator/brands/:id` › Ta tillbaka | [x] |
| TapCard (numbers, brand link) | Kampanjer › Mina › Kranar rows and Hem › Dina kranar → assignment detail (tap variant) | [x] |
| Lägg till video → | Assignment primary / "+" sheet | [x] |
| Kopiera hashtag | Assignment "…" › Spårningskoder | [x] |
| Hitta kampanjer (empty) | Kampanjer › Upptäck › Kranar chip; empty state "Inga kranar att hämta ur än" → brand profiles | [x] |

### C6 `/creator/ugc` Videouppdrag → Kampanjer › Upptäck › Videouppdrag (`/creator/browse?type=video`)

| Old | New location | Done |
|---|---|---|
| Profile status card (leveranser, rating, tjänat) | Statistik; verification state on Intäkter › Verifiering & skatt | [x] |
| Min UGC-profil | Profil › Inställningar › Videouppdrag `/creator/settings/ugc` | [x] |
| Mina uppdrag (+ badge) | Kampanjer › Mina › Videouppdrag; "Din tur" rows under Behöver dig and on Hem | [x] |
| Verifiera dig för utbetalning | Intäkter › Verifiering & skatt `/creator/earnings/verification` (Stripe is optional; a paid order explains when it is needed) | [x] |
| "Väntar på dig" rows | Hem › Behöver dig and Kampanjer › Mina › Behöver dig | [x] |
| Passar dig / Alla öppna | "Passar dig" toggle on the Videouppdrag chip; empty state tells you to turn it off or fill in Inställningar › Videouppdrag | [x] |
| Order card numbers | Row caption; detail `/creator/ugc/orders/:id` › Brief | [x] |
| Ansök (inline dialog: bid, pitch) | Order detail primary → bid sheet (Ditt bud, pitch) | [x] |
| Anlitad — öppna uppdraget | Order detail primary → collab | [x] |
| Verifiera dig först | Blocked primary with "Verifiera dig under Profil › Intäkter först." | [x] |
| Disabled Ansökan skickad / antogs inte / återtagen | Status badge + "Se din ansökan" → Mina › Ansökta | [x] |

### C7 `/creator/ugc/applications` (orphan) → Kampanjer › Mina › Ansökta (`/creator/assignments#ansokta`)

| Old | New location | Done |
|---|---|---|
| Rows with status, bid, note | Ansökta section: campaign applications and UGC bids together | [x] |
| Öppna uppdraget | Row → collab / campaign | [x] |
| Ta tillbaka | "…" › Ta tillbaka | [x] |
| Se öppna beställningar (empty) | Empty state → Upptäck › Videouppdrag | [x] |

### C8 `/creator/ugc/collabs` kanban → Kampanjer › Mina › Videouppdrag (`/creator/assignments#video`)

| Old | New location | Done |
|---|---|---|
| 7 columns (Inbjudna … Avbrutna) | List rows with status badge, amount, deadline, unread count; "Din tur" rows under Behöver dig; Avslutade section for done / cancelled | [x] *changed* |

### C9 `/creator/ugc/collabs/:id` (also B14, admin) → Uppdrag detail (same routes; `/admin/ugc/collabs/:id` uses the same screen)

| Old | New location | Done |
|---|---|---|
| Header amount, fee split | Header hero number + Betalning section | [x] |
| Acceptera & betala / Betala (brand) · Acceptera kontraktet (creator) · Godkänn leveransen · Leverera video | The **one** primary button = the next step for your role; delivery form under Leverans (`#deliver` from "+") | [x] |
| Markera som påbörjad, Betygsätt, Läs kontraktet, Licensbevis, Öppna tvist, Avböj / Avbryt uppdraget, Begär ändring | "…" menu (only the actions the server lists) | [x] |
| Cards Leverans, Tvist, Brief, Kontrakt, Chatt, Betalning, Händelser | Same sections, single column, collapsed where long | [x] |
| Ladda ner per version, file upload + comment + progress | Leverans section | [x] |
| Chat textarea + Skicka | Chatt section | [x] |
| Admin: mark funded manually | "…" › Registrera betalning manuellt (admin only) | [x] |

### C10 `/creator/ugc/profile` → Profil › Inställningar › Videouppdrag `/creator/settings/ugc`

| Old | New location | Done |
|---|---|---|
| Kategorier (max 6), Stad, Region, Exempelvideo, Rättigheter checkbox, Spara profil | Cards "Så matchas du" and "Rättigheter", one Spara | [x] |

### C11 `/creator/portfolio` → Profil tab `/creator/profile`

| Old | New location | Done |
|---|---|---|
| 4 stat tiles (7 numbers) | 3 numbers in the profile header; the rest on Statistik | [x] |
| Omdömen card | Profil › Omdömen | [x] |
| Om mig facts (Land, Kategori, Språk, Medlem sedan) | Profile header facts | [x] |
| Företag du jobbat med | Statistik › Pengar › Varumärken du tjänar mest på | [x] |
| TikTok / Instagram / Webbplats links | Profile header links; edited under Redigera profil › Konton & länkar | [x] |
| Redigera profil (two buttons) | One: Profil header → `/creator/profile/edit` | [x] |
| + Lägg till arbete (inline form) | "+" › Lägg till i portfolio (`/creator/profile?add=1`): type sheet (TikTok-video, Instagram-inlägg, Video (länk), Bild, Annan länk) then the form | [x] |
| Per item Redigera / Ta bort (2-step) | "…" › Redigera / Ta bort (confirm) | [x] |
| Media link / TikTok embed | Portfolio section | [x] |

### C12 `/creator/analytics` → Profil › Statistik `/creator/analytics`

| Old | New location | Done |
|---|---|---|
| BigStat tiles (8 numbers) | Översikt: 3 tiles | [x] |
| Chart + footer (Total räckvidd, Bästa kampanjen, Klickfrekvens) | Översikt › Views per kampanj + Per kampanj; Prestation › Klickfrekvens | [x] |
| Donut per campaign | Översikt › Per kampanj rows | [x] |
| Innehåll som presterar bäst | Översikt › Per kampanj (row → assignment) | [x] |
| Räckvidd & monetarisering (följare, bars, klick, genomförda) | Prestation › Räckvidd & monetarisering (Klickfrekvens, Intäkt / 1K views, Snittvisningar) | [x] |
| Platform data | Plattformar (TikTok connected state, Instagram "hämtas inte automatiskt ännu") | [x] |
| Money | Pengar (Utbetalt · Godkänt · Väntande · Upplupet, Varumärken du tjänar mest på) | [x] |
| Links Mina kampanjer →, Öppna intäkter → | Rows → assignment; Profil › Intäkter | [x] |

### C13 `/creator/pr` PR-hubb → Meddelanden › Förfrågningar (`/creator/messages?tab=requests`)

| Old | New location | Done |
|---|---|---|
| Tiles PR-värde att deklarera, Aktiva, Nya, Totalt | Intäkter › "PR-värde att deklarera" row; new count = badge on Meddelanden | [x] |
| Tabs Alla / Nya / Aktiva / Historik | Open items first; "Visa hanterade / Dölj hanterade" toggle | [x] *changed* |
| Läs erbjudande (expand, mark viewed) | Row expands; marks viewed | [x] |
| Textarea, Tacka ja, Tacka nej | Inline on the expanded offer | [x] |
| Community invites (were on C5) | Same list, "bjöd in dig" rows with Acceptera / Avböj | [x] |

### C14 `/creator/links` (flag) → Profil › Länkar `/creator/links`

| Old | New location | Done |
|---|---|---|
| Tracked links list | Same, still behind `FEATURES.linkTree`; rows → assignment | [x] |

### C15 `/creator/brands/:id` → Företagsprofil (same route)

| Old | New location | Done |
|---|---|---|
| 6 stat boxes | 3 + "Visa mer" | [x] |
| ＋ Följ / ✓ Följer | Header button | [x] |
| Webbplats | Header link | [x] |
| Ansök till kranen → confirm | Primary when the brand has an open tap → confirm sheet | [x] |
| Acceptera / Avböj invite | Header actions when invited | [x] |
| Ta tillbaka ansökan | "Ta tillbaka" when a request is pending | [x] |
| Campaign cards + Ansök (ApplyModal) | Aktiva kampanjer rows → campaign detail (apply there) | [x] |
| "Godkänd — gå till Mina uppdrag" | Campaign detail → the assignment | [x] |
| Tidigare kampanjer, Omdömen | Collapsed sections | [x] |
| Uppdateringar (posts) | Uppdateringar section | [x] |

### C16 `/creator/earnings` → Profil › Intäkter `/creator/earnings`

| Old | New location | Done |
|---|---|---|
| Begär utbetalning (buried) | Hero "Att hämta ut" + Begär utbetalning first, per payable | [x] |
| Ändra / Lägg till metod (Bankkonto / Swish / PayPal form) | "Utbetalningsmetod" row (shows the current method or "Saknas") → sheet with the same form | [x] |
| PayoutState tiles, donut, footer, top brands | Statistik › Pengar (incl. Snitt per utbetalning) | [x] |
| Upplupet (ej begärt) | Historik › Väntande | [x] |
| Utbetalningshistorik + pagination | Historik segmented Väntande · Godkänt · Utbetalt | [x] |
| "Så får du betalt" 4-step explainer | "Så får du betalt" › "Från visning till pengar på kontot" help row | [x] |
| Verification + tax (were on C19) | "Verifiering & skatt" row → `/creator/earnings/verification` (Stripe card, Skatt card: F-skatt, moms, VAT) | [x] |
| Stripe return (`?onboarding=done`) | Redirected to the verification screen | [x] |
| PR value (was on C13) | "PR-värde att deklarera" row | [x] |

### C17 `/creator/levels` → Profil › Creator-nivå `/creator/levels`

| Old | New location | Done |
|---|---|---|
| Hero (level, tier, utbetalt, kampanjer, XP bar) | "Din nivå" card + progress | [x] |
| Stegen + Alla nivåer (thresholds twice) | "Alla nivåer" once, "Du är här" marker | [x] *changed* |
| Lifetime paid counted with `status === 'Paid'` (always 0) | Counts `Completed` like the rest of the app; only the displayed level changes | [x] *changed* |

### C18 `/creator/saved` → Profil › Sparat `/creator/saved`

| Old | New location | Done |
|---|---|---|
| Card → "Ansök via Upptäck" (bounced to browse) | Row → campaign detail, apply there; "…" › Öppna kampanjen / Ta bort från sparade | [x] *changed* |
| Hitta kampanjer (empty) | Empty state → Upptäck | [x] |

### C19 `/creator/settings` = `/creator/profile` → split

| Old | New location | Done |
|---|---|---|
| Kontostatus badge | Profil header | [x] |
| TikTok bar (connect, Koppla bort 2-step, handle, followers, last sync) | Inställningar › TikTok-konto `/creator/settings/tiktok` (`TikTokCard`: Fortsätt med TikTok / Koppla bort, handle, followers, "synkad … / synkas automatiskt") | [x] |
| Verifiering (Stripe) + Skatt | Intäkter › Verifiering & skatt | [x] |
| Profilinformation form (name, TikTok user, bio, kategori, land, födelsedatum, Instagram, webbplats, bild, Öppen för PR, TagSelector) | Profil › Redigera profil `/creator/profile/edit` (cards incl. Konton & länkar, "Vad är du expert på?") | [x] |
| Profiluppgifter (Följare, Medlem sedan, Status) | Profil header | [x] |
| Byt e-postadress, Byt lösenord | Inställningar › Konto `/creator/settings/account` | [x] |
| Språk | Inställningar › Språk | [x] |
| Radera konto (posts to support thread) | Inställningar › Konto, last card; same request | [x] |
| Omdömen | Profil › Omdömen | [x] |
| `/creator/profile` ≡ `/creator/settings` | `/creator/profile` = Profil tab; `/creator/settings` = settings menu (Villkor, Integritet, Skriv till VYRLE-teamet included) | [x] |

### C20 `/creator/messages` → Meddelanden tab

| Old | New location | Done |
|---|---|---|
| Konversationer tab (list + thread in a fixed card) | Chatt: list → thread page | [x] |
| Support från VYRLE tab | Pinned "VYRLE Support" conversation at the top (`?thread=support`) | [x] |
| PR offers / community invites (were C13 / C5) | Förfrågningar segment | [x] |

### C21 `/creator/*` NotFound

| Old | New location | Done |
|---|---|---|
| In-app 404 | `NotFoundScreen` inside the shell, "Till start" | [x] |

## 3. Brand

### B1 `/brand` Översikt → Hem `/brand`

| Old | New location | Done |
|---|---|---|
| Hero (5 numbers) + chart footer (same numbers again) | "Just nu": Spenderat · Views · Aktiva creators (3 tiles) → Statistik | [x] |
| Chart | Statistik › Pengar › Spenderat per kampanj | [x] |
| PR-acceptans card | Statistik › Prestation › PR-utskick | [x] |
| Senaste kampanjer rows | Hem › Kampanjer rows (+ Visa alla → Kampanjer & kranar › Kampanjer) | [x] |
| Four "new campaign" entry points | One: "+" › Skapa kampanj (plus the empty state) | [x] *changed* |
| Hitta creators / Granska ansökningar / Lansera en kampanj shortcuts | Creators tab, Hem › Behöver dig row, "+" | [x] |
| Nothing about taps, reviews, orders, community | Hem › Behöver dig (org.nr saknas, videor att granska, ansökningar, vill gå med, nya bud, Din tur), Kranar, Beställningar, Senaste från communityn | [x] |

### B2 `/brand/tap` Kranar → Kampanjer & kranar › Kranar (`/brand/campaigns?tab=taps`) + new tap pages

| Old | New location | Done |
|---|---|---|
| Tap list (TapCard numbers) | Rows on Hem › Kranar and Kampanjer & kranar › Kranar → **Kran detail** `/brand/tap/:id` (använt / av månadsbudget, views, active creators, Stående brief) | [x] |
| + Ny kran → TapForm (9 inputs, live calculator) | "+" › Öppna en kran `/brand/tap/new` (Budget, "Så här räknar kranen", Brief cards) | [x] |
| Redigera | Kran detail "…" › Redigera `/brand/tap/:id/edit` | [x] |
| Pausa / Öppna igen | Kran detail "…" › Pausa för alla creators / Öppna igen | [x] |
| Stäng (confirm) | Kran detail "…" › Stäng kranen för gott (confirm sheet) | [x] |
| TapReviewSection (Godkänn / Neka + reason) | **Att granska** queue `/brand/review` (`?tap=` / `?campaign=`), reached from Hem › Behöver dig, kran detail and campaign detail | [x] |
| 4 stat tiles | Statistik › Pengar › Kranar | [x] |
| "Så fylls kranarna på" explainer (links to Community, Min profil) | Kran detail rows: Videor att granska, Medlemmar i communityn, Skriv uppdatering | [x] |

### B3 `/brand/community` → Creators › Community (`/brand/creators?tab=community`)

| Old | New location | Done |
|---|---|---|
| 4 stat tiles | Count in the segment header; Statistik › Översikt | [x] |
| ＋ Bjud in creators → InviteCreatorsModal (search, Välj alla / Avmarkera alla, Bjud in N) | Header button → "Bjud in till din community" sheet (search, tick creators, Bjud in N). No select-all shortcut: invitations are sent one creator at a time on purpose | [x] *changed* |
| Requests: Godkänn / Neka | "Vill gå med" section: Godkänn primary, "…" › Neka / Visa profil | [x] |
| Invited: Dra tillbaka | "Inbjudna" section: "…" › Dra tillbaka inbjudan | [x] |
| Members: Skriv (MessageCreatorModal), Ta bort | "Medlemmar" section: "…" › Skriv meddelande (sheet) / Visa profil / Ta bort ur communityn | [x] |
| Member sub-line numbers | Creator profile | [x] |
| Bjud in creators (empty) | Empty state | [x] |

### B4 `/brand/analytics` → Profil › Statistik `/brand/analytics`

| Old | New location | Done |
|---|---|---|
| Kpi + Mini tiles (18 numbers) | Översikt: 3 tiles + Insikter | [x] |
| AES card, Kvalitetssignaler, Per nisch, Bäst presterande content, Videolängd, Publiceringstid, Topp-hashtags, Viralitet | Prestation | [x] |
| Engagemang donut (Likes, Kommentarer, Delningar, Sparningar) | Plattformar | [x] |
| Kostnad per …, Budget donut, Visningar per kampanj, Kranar | Pengar (Kostnad per, Spenderat per kampanj, Kranar); chart on Översikt | [x] |
| Bästa creators (rows) | Översikt › Bästa creators → creator in campaign | [x] |
| PR stats (were B18) | Prestation › PR-utskick | [x] |
| Links Alla kampanjer →, Hitta fler, Visa video | Rows; Creators › Hitta; external | [x] |
| Skapa kampanj (empty) | Empty state → Öppna en kran | [x] |

### B5 `/brand/campaigns` → Kampanjer & kranar › Kampanjer (`/brand/campaigns?tab=campaigns`)

| Old | New location | Done |
|---|---|---|
| Ny kampanj | "+" › Skapa kampanj | [x] |
| Tabs Alla / Utkast / Aktiva / Pausade / Avslutade | Status chips | [x] |
| Row numbers | Row caption; detail | [x] |
| Snabbvy modal (facts, Öppna kampanjen) | Campaign detail "…" › Snabbfakta | [x] |
| Ta bort kampanj (only in Snabbvy) | Campaign detail "…" › Ta bort kampanj (two-step) | [x] |
| Skapa kampanj (empty), pagination | Empty state; list | [x] |

### B6 `/brand/campaigns/new` → "+" › Skapa kampanj (same route, stepped)

| Old | New location | Done |
|---|---|---|
| One long form (≈20 inputs) | Steps Grund · Ersättning · Brief · Granska, same fields: namn, beskrivning, kategori, hashtag, datum, Budget & platser, Utbetalningsmodell (Fast / Per visning / Trappsteg + steg rows), Maxkostnad summary, Instruktioner, Innehållstaggar, Förmåner & PR | [x] |
| Skicka för granskning, Avbryt | Last step primary; Spara som utkast; back | [x] |

### B7 `/brand/campaigns/:id` → Kampanj detail (same route) + Creator i kampanjen

| Old | New location | Done |
|---|---|---|
| Stat cards | 3 tiles | [x] |
| Redigera kampanj (DraftEditCard) | "…" › Redigera utkast (sheet) | [x] |
| Skicka för granskning (Draft) | Primary | [x] |
| Ansökningar: Godkänn / Neka (hardcoded reason) | Row → Creators › Ansökningar filtered (`?campaign=`); Neka always asks for a reason | [x] *changed* |
| Per-creator blocks (numbers, @tiktok, Markera som betald, Uppdatera views, video Godkänn / Neka, CreatorInlineChat) | Creators section rows → **Creator i kampanjen** `/brand/campaigns/:id/creators/:assignmentId`: tiles, Videor (Godkänn / Neka), Chatt, Omdöme, "…" › Uppdatera views nu / Visa profil / Betygsätt, Markera som betald primary when ready | [x] |
| Öppna kranen (Completed) | Primary → Öppna en kran | [x] |
| Beskrivning / taggar / förmåner | Brief section (collapsed) | [x] |
| Pending videos | Sticky "Granska videor (N)" → Att granska queue | [x] |

### B8 `/brand/ugc` Beställ video → Kampanjer & kranar › Beställningar (`/brand/campaigns?tab=orders`)

| Old | New location | Done |
|---|---|---|
| 3 stat tiles | Hem › Beställningar rows; Statistik | [x] |
| Pipeline button | Same segment (sections below) | [x] |
| + Ny beställning | "+" › Beställ video | [x] |
| Väntar på dig rows | "Väntar på dig" section + Hem › Behöver dig | [x] |
| Öppna / Utkast / Stängda groups, inline Publicera on drafts | Sections Öppna beställningar · Pågående uppdrag · Utkast · Klara; Publicera is the order detail primary | [x] |
| Skapa första beställningen (empty) | Empty state | [x] |

### B9 `/brand/ugc/pipeline` kanban → Beställningar segment sections (`#uppdrag`)

| Old | New location | Done |
|---|---|---|
| 7 columns | Sections Väntar på dig · Pågående uppdrag · Klara (status badge per row) | [x] *changed* |

### B10 / B12 `/brand/ugc/campaigns/new`, `/:id/edit` → stepped order form (same routes)

| Old | New location | Done |
|---|---|---|
| OrgNumberNotice → Lägg till org.nr | Hem › Behöver dig "Org.nr saknas" + notice on step 1 → `/brand/profile/edit`; Publicera blocked with the reason | [x] |
| Brief (11), Ersättning & rättigheter (8), Vilka creators (3) | Steps Brief · Ersättning · Creators · Granska, same fields | [x] |
| Publicera, Spara utkast, Ta bort utkast | Last step primary; Spara som utkast; Ta bort utkast in detail "…" | [x] |

### B11 `/brand/ugc/campaigns/:id` → Beställning detail (same route)

| Old | New location | Done |
|---|---|---|
| Header meta (5 numbers) | Header facts | [x] |
| Draft: Redigera, Publicera · Published: Stäng | Primary Publicera; "…" › Redigera / Ta bort utkast / Stäng beställningen | [x] |
| BidRow (numbers, pitch), Anlita, Favorit, Avböj + reason | Bud rows: Anlita primary, "…" › Favorit / Visa profil / Avböj (reason) | [x] |
| "N hanterade bud" details | Visa hanterade / Dölj hanterade toggle | [x] |
| Brief card, Målgrupp facts | Brief section, facts | [x] |

### B13 `/brand/ugc/invite?creator=` → order form with the creator prefilled (`/brand/ugc/campaigns/new?creator=`)

| Old | New location | Done |
|---|---|---|
| Direct invite form, Skicka inbjudan | Creatorprofil › Beställ video → same stepped form in direct mode | [x] |

### B14 `/brand/ugc/collabs/:id` → Uppdrag detail (see C9)

### B15 `/brand/applications` → Creators › Ansökningar (`/brand/creators?tab=applications`)

| Old | New location | Done |
|---|---|---|
| Per campaign collapsed rows, Visa kampanj, Minimera | Chip per campaign (`&campaign=` deep link from campaign detail) | [x] |
| Application (profile, badges, message, date), Godkänn, Neka + required reason | Row: Godkänn primary, Neka → reason sheet | [x] |
| Visa hela profilen → | Row avatar / name → creator profile | [x] |

### B16 `/brand/creators` Hitta creators → Creators › Hitta (`/brand/creators?tab=find`)

| Old | New location | Done |
|---|---|---|
| 8 always-open controls | Search field + Filter sheet (Kategori, Land, Minst antal följare, Sortera, Expertis, Endast öppna för PR) | [x] |
| Result cards (3 numbers, tags, Visa profil) | Rows → creator profile | [x] |
| Pagination | Visa mer | [x] |

### B17 `/brand/creators/:id` → Creatorprofil (same route)

| Old | New location | Done |
|---|---|---|
| 4 header buttons (2 primary) | 1 primary: Beställ video. "…" › Skicka PR-erbjudande (sheet), Skriv meddelande (sheet), Bjud in till community, Ta bort ur communityn, Öppna TikTok / Instagram / webbplats | [x] |
| 4 stat cards + Verifierat engagemang (5) | 3 tiles; "Verifierat på VYRLE" section with Visa mer | [x] |
| SendPrOfferForm (8 fields) | Bottom sheet | [x] |
| MessageCreatorModal | Bottom sheet | [x] |
| Portfölj, Omdömen | Sections | [x] |
| ‹ Tillbaka till sök | Back | [x] |

### B18 `/brand/pr` PR-utskick → Meddelanden › Erbjudanden (`/brand/messages?tab=offers`)

| Old | New location | Done |
|---|---|---|
| 5 stat tiles + per-category chips | Statistik › Prestation › PR-utskick | [x] |
| Tabs Alla / Skickade / Sedda / … | Status badge per row (Sedd, Väntar på svar, Inte accepterat, Erbjudandet är tillbakadraget) | [x] *changed* |
| Row expand (Ersättning, Utbud, Deadline, Sedd, Svar) | Row expands | [x] |
| Dra tillbaka | "…" › Dra tillbaka | [x] |
| Hitta creators (header, empty) | Empty state → Creators › Hitta; sending a new offer happens from a creator's profile | [x] |

### B19 `/brand/public-profile` → Profil tab `/brand/profile`

| Old | New location | Done |
|---|---|---|
| Info banner + ✎ Redigera profil (logo, description, industry, website) | Profil › Företagsprofil `/brand/profile/edit` (merged with B22's profile form) | [x] |
| Own public view (stats, campaigns, reviews) | Profil tab shows exactly what creators see | [x] |
| PostComposer (text, image, Publicera) | "+" › Skriv uppdatering (sheet, `/brand/profile?post=1`) | [x] |
| Per post Ta bort (2-step) | "…" › Ta bort inlägget (confirm) | [x] |

### B20 `/brand/assignments/:id` (orphan) → Creator i kampanjen `/brand/campaigns/:id/creators/:assignmentId`

| Old | New location | Done |
|---|---|---|
| Status + views + amount, ChatPanel, ReviewSection | Tiles, Chatt, Omdöme ("…" › Betygsätt); reachable from campaign detail rows, Hem › Senaste från communityn and Statistik; old URL redirects | [x] |

### B21 `/brand/messages` → Meddelanden tab (see C20; Erbjudanden instead of Förfrågningar)

### B22 `/brand/settings` → Profil › Inställningar `/brand/settings`

| Old | New location | Done |
|---|---|---|
| Profil tab (Logotyp, Företagsnamn, Org.nr, Bransch, Telefon, Webbplats, Beskrivning) | "Företagsprofil" row → `/brand/profile/edit` | [x] |
| Byt e-postadress, Byt lösenord (inline copy), Radera konto | "Konto" row → `/brand/settings/account`, the shared cards | [x] |
| Språk | Inställningar › Språk | [x] |
| – | Skriv till VYRLE-teamet, Villkor, Integritet rows added for parity with creator | [x] |

## 4. Modals and components

| Old | New | Done |
|---|---|---|
| ApplyModal | Bottom sheet on campaign detail | [x] |
| UGC apply dialog | Bid bottom sheet on order detail | [x] |
| MessageCreatorModal | `MessageCreatorSheet` (creator profile "…", Community "…") | [x] |
| CampaignQuickView | "…" › Snabbfakta / Ta bort kampanj on campaign detail | [x] |
| InviteCreatorsModal | Bottom sheet on Creators › Community | [x] |
| NotificationsDrawer, MessagesDrawer | Pages | [x] |
| VideoPicker | Content of the "Lägg till video" sheet | [x] |
| PayoutRequestCard | Top of Intäkter | [x] |
| PayoutMethodCard | Row + sheet on Intäkter | [x] |
| PayoutEstimator, PayoutTerms | `components/app/PayoutTerms.tsx` (estimate logic moved there unchanged) | [x] |
| TapBanner | Assignment header, tap variant | [x] |
| CreatorTapsSection, BrandFeedSection | Hem sections | [x] |
| TikTokConnectBar, TikTokConnectionCard, TikTokAlertBanner | Hem › Behöver dig row + Inställningar › TikTok-konto (`TikTokCard`) | [x] |
| CreatorVerificationCard | Intäkter › Verifiering & skatt | [x] |
| ChatPanel, CreatorInlineChat, ConversationList, ChatThread | `components/app/Chat.tsx`, used by Meddelanden, assignment, creator in campaign | [x] |
| ReviewSection, ReviewList, StarRating | `components/app/Reviews.tsx` (`Stars`, `ReviewList`, `ReviewSection`) | [x] |
| ChangeEmailCard, ChangePasswordCard, LanguageCard, DeleteAccountCard | `components/app/AccountForms.tsx`, both roles | [x] |
| ConfirmButton | DS `Button` two-step ("Säker? Tryck igen") and confirm sheets | [x] |
| CopyButton | Copy rows in the Spårningskoder sheet ("Kopierat" toast) | [x] |
| RefreshViewsButton | "…" › Uppdatera views nu | [x] |
| TikTokEmbed, DateInput, ImagePicker, Toast | Kept as they were | [x] |
| GlobalSearch | Search fields on Upptäck / Hitta | [x] |
| LangSwitcher | `LanguagePicker` on Inställningar | [x] |
| Viz (Donut, AreaChart, MiniBars, Ring) | `components/app/Charts.tsx` (`Bars`, `LineChart`, `Donut`) | [x] |
| Skeletons | DS `Skeleton` | [x] |
| CreatorDashboard, BrandDashboard, AssignmentTable, BrandCampaignTable, AppLayout, VyrleShell, ShellDrawers | Deleted (dead) | [x] |

## 5. Old URLs that still work

| Old | Goes to |
|---|---|
| `/creator/taps` | `/creator/assignments#kranar` |
| `/creator/ugc` | `/creator/browse?type=video` |
| `/creator/ugc/applications` | `/creator/assignments#ansokta` |
| `/creator/ugc/collabs` | `/creator/assignments#video` |
| `/creator/ugc/profile` | `/creator/settings/ugc` |
| `/creator/pr` | `/creator/messages?tab=requests` |
| `/creator/portfolio` | `/creator/profile` |
| `/creator/profile?onboarding=…` (Stripe return) | `/creator/earnings/verification` |
| `/brand/tap` | `/brand/campaigns?tab=taps` |
| `/brand/community` | `/brand/creators?tab=community` |
| `/brand/applications` | `/brand/creators?tab=applications` |
| `/brand/ugc` | `/brand/campaigns?tab=orders` |
| `/brand/ugc/pipeline` | `/brand/campaigns?tab=orders` |
| `/brand/ugc/invite?creator=` | `/brand/ugc/campaigns/new?creator=` |
| `/brand/pr` | `/brand/messages?tab=offers` |
| `/brand/public-profile` | `/brand/profile` |
| `/brand/assignments/:id` | `/brand/campaigns/:campaignId/creators/:id` (campaign id read from the assignment) |
| `/dashboard`, `/messages`, `/ugc` | Role redirects as before (`/ugc` → the Videouppdrag / Beställningar section) |
| Every other route | Unchanged path |

## 6. Cleanup done in Phase 5

- Deleted: `src/pages/{brand,creator,shared,ugc}/*`, `components/layout/*`, `components/ui/{AccountCards,ChatPanel,ConfirmButton,CopyButton,MessageCreatorModal,RefreshViewsButton,ReviewSection,StarRating,TagSelector,index}.tsx`, `components/vyrle/{ApplyModal,BrandFeed,CreatorTaps,PayoutEstimator,PayoutRequestCard,VideoPicker,Viz}.tsx`. Hooks and the payout estimate that lived in those files moved to `hooks/extra.ts` and `components/app/PayoutTerms.tsx` with the same endpoints and query keys.
- `styles/vyrle.css` pruned from 847 rules to the 78 that auth, legal, admin, toast, TikTok embed and date input still use (97 KB → 16 KB); `vyrle.extra.css` pruned from 183 to 134 rules. `ds.css` is the app stylesheet.
- English strings for the new screens added in `src/i18n/en/app.ts` (370 entries). Older dictionary entries were left in place because some keys are looked up dynamically (statuses, labels).
- `/admin/ugc/collabs/:id` now renders the shared `CollabScreen` (admin actions included) instead of the deleted `UgcCollabPage`.
- Nothing is committed; the working tree holds the whole redesign.
