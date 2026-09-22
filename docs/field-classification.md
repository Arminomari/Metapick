# Fältklassificering — Steg 0

Datum 2026-09-21, kodbas vid commit `addda93`. Ingen kod är ändrad. Underlag: läsning av alla frontend-skärmar (`src/frontend/src/screens`, `components/app`, `pages/auth`, `public/vyrle.html`) och hela backend-skrivytan (`src/backend/CreatorPay.Api/Controllers`, `CreatorPay.Application/Services`, `DTOs.cs`, jobb i `CreatorPay.Worker`).

**Klass** är exakt `USER_EDITABLE` eller `SYSTEM_COMPUTED` enligt byggordern. Innehåll som ett företag äger (kampanjnamn, brief, budget, CPM, min-views, beställningsfält) är `USER_EDITABLE` även när en creator ser det.

**Källa** använder dessa värden:

| Källa | Betydelse |
|---|---|
| `TikTok API` | Hämtat via TikTok OAuth (`user/info`, `video/list`) av `TikTokConnectService` eller `DailyCampaignSyncJob` |
| `Instagram API` | Finns inte. Det finns ingen Instagram-integration i kodbasen; två kolumner (`InstagramUsername`, `InstagramFollowerCount`) finns, den senare har ingen skrivare och är alltid 0 |
| `Intern ledger` | Utbetalningsberäkningar, kran-ackumulering, UGC-betalningar, kontrakt, transaktioner |
| `DB-beräkning` | Serverberäknade summor, antal, status, betyg |
| `DB (input)` | Lagrad användarinput (`USER_EDITABLE`) |
| `Klient` | Räknas ut i webbläsaren från hämtade rader — **flaggad** |
| `Hårdkodad` | Literal i JSX/HTML — **flaggad** |

**Åtgärd** är en av `behåll`, `gör read-only`, `flytta till server-beräkning`, `ta bort`. Parentes anger vad som krävs för att åtgärden ska uppfylla reglerna.

Reglerna som klassificeringen tvingar fram:

1. Ingen `SYSTEM_COMPUTED`-siffra får skrivas in i ett formulär eller komma från klientstate.
2. Varje visad `SYSTEM_COMPUTED`-siffra ska ha källa och tidsstämpel tillgänglig.
3. En badge får bara renderas när verifieringsvillkoret är uppfyllt i datan.

---

## 0. Sammanfattning — flaggor som bryter reglerna idag

Sorterat efter allvar. Filrader är klickbara i repo-roten.

**Regel 3 (badges utan datavillkor)**

| # | Fynd | Var |
|---|---|---|
| F1 | **"Verifierat företag" renderas för varje företag, utan villkor.** DTO:n saknar fält för det. Backend har ingen org.nr-verifiering alls: registreringen validerar `NotEmpty().MaximumLength(50)`, profiluppdateringen formaterar till `XXXXXX-XXXX`. Inget Luhn, inget register, ingen `org_verified`-kolumn. Lanseringsföretaget `nellie@vyrle.co` seedas `Approved` utan org.nr. | `src/frontend/src/screens/shared/BrandPublicScreen.tsx:47`, `src/backend/CreatorPay.Application/Services/BrandService.cs:42-48`, `Validators.cs:34`, `Api/Program.cs:491-521` |
| F2 | **`TikTokConnected` är `true` för manuellt inskrivna handtag** (`Scopes = "manual"`, tomma tokens). Alla brand-vända DTO:er (`CreatorDiscoveryDto`, `CreatorPublicProfileDto`, `CommunityMemberDto`) exponerar bara `TikTokConnected`, aldrig `IsOAuth`. Ett varumärke kan inte skilja OAuth-verifierad från självpåstådd. Handtaget kontrolleras bara för unikhet vid registrering, inte ägarskap. | `CreatorService.cs:234`, `PortfolioAndDiscoveryServices.cs:254,325`, `AuthService.cs:148-162`, `TikTokConnectService.cs:216` |
| F3 | **UGC-status "Verifierad" är ett default-värde**, inte en kontroll: nya marknadsplatsprofiler skapas med `Status = Verified`; migration `20260913150000` lyfte alla `Pending` till `Verified`. "Godkänd av VYRLE" (`Approved`) sätts däremot av admin och är korrekt. | `Ugc/Services/UgcCreatorService.cs:55-56`, `OrderScreens.tsx:72` |
| F4 | **Creator-nivå (Rising/Established/Pro/Elite/Icon) räknas i klienten** från sida 1 av `/payouts/mine` mot hårdkodade trösklar 0 / 5 000 / 25 000 / 100 000 / 500 000 kr. Badgen renderas alltid. Ingen backend-representation finns. | `src/frontend/src/screens/creator/ProfileScreen.tsx:26-33,99-106,154`, `MoreScreens.tsx:16-33` |
| F5 | Rubriken "Verifierat på VYRLE" renderas alltid; bara innehållet är datastyrt (`totalVerifiedViews > 0`). | `src/frontend/src/screens/brand/CreatorDetailScreen.tsx:135-136` |

**Regel 1 (SYSTEM_COMPUTED som kan sättas av klient eller kommer från klientstate)**

| # | Fynd | Var |
|---|---|---|
| F6 | **API:t accepterar fortfarande självrapporterad räckvidd.** `RegisterRequest`, `SocialRegisterRequest` och `UpdateCreatorProfileRequest` har `FollowerCount`, `AverageViews`, `InstagramFollowerCount`. Handlers ignorerar dem (register skriver 0/null, update rör dem inte), men fälten finns i kontraktet och i frontend-typen `Partial<CreatorProfile>` som `useUpdateCreatorProfile` tar emot. | `DTOs.cs:29-30,48-49,130-131`, `AuthService.cs:135-138`, `CreatorService.cs:123-124`, `src/frontend/src/hooks/api.ts:76-85` |
| F7 | **Portfolio-DTO:erna accepterar `Views` och `Likes`** från klienten; servicen nollar dem (`Views = null; Likes = null`) men kolumnerna och kontraktet finns kvar. **`BrandName` är fritext utan koppling** till kampanj, kran eller UGC-uppdrag, och visas för varumärken. | `DTOs.cs:161-169`, `PortfolioAndDiscoveryServices.cs:64-67,96-98`, `PortfolioAndPrEntities.cs:20-21`, `CreatorDetailScreen.tsx:154-162` |
| F8 | **Hela brand-Statistik räknas i webbläsaren** över sida 1 (max 20) av `/campaigns/mine` **utan statusfilter** (utkast, avslutade och avbrutna ingår) plus ett `/analytics`-anrop per kampanj. Det gäller Visningar, Spend, **"kvar"**, CPM, Snitt/post, AES (vikter 0.45/0.25/0.30, multiplikatorer ×8/×40/×20), viral rate (100K/500K/1M), Kostnad-per, Per nisch, Bästa creators, Topp-hashtags, Insikter. Backend har `BudgetReserved` utan skrivare (alltid 0). "464 445 kr kvar" är Σ(`Budget − BudgetSpent`) över alla kampanjer oavsett status; kranen visar sin egen serverberäknade `MonthRemaining`. Exakt ursprung kräver DB-fråga. | `src/frontend/src/screens/brand/AnalyticsScreen.tsx:29-62,115-116`, `hooks/api.ts:189-217`, `CampaignService.cs:393-406,678` |
| F9 | **Insikter utan minsta urval.** "Bäst att posta …", "Videor på 0–15 s drar flest …" tar `[0]` ur listor där en enda video räcker (`count > 0`). Dygnsdelen använder `new Date(publishedAt).getHours()` i **besökarens tidszon**; `publishedAt` för manuellt inskickade videor är inlämningstiden tills synken skriver över. Hashtags extraheras ur `Caption`, som för manuella inlämningar är **creatorns egen `Notes`-text**. Kampanjens lägsta CPM-insikt kräver bara `totalViews > 0`. | `AnalyticsScreen.tsx:45-61`, `CampaignService.cs:685-693`, `ApplicationAndAssignmentServices.cs:606-607`, `DailyCampaignSyncJob.cs:291` |
| F10 | **Creator-Statistik och profilens "Verifierade views"/"Intjänat" summeras i klienten** från `/assignments/mine?pageSize=100` och sida 1 av `/payouts/mine`. `CreatorAnalyticsDto` finns i backend men konstrueras aldrig. Skalfaktorer ×8 och ×2 för stapellängder är godtyckliga. | `ProfileScreen.tsx:57`, `HomeScreen.tsx:29-31`, `AnalyticsScreen.tsx:19-40,223`, `DTOs.cs:445-451` |
| F11 | **Auto-godkännande "48 timmar" är literal** på fem ställen; för kampanjvideor räknas timmarna kvar i klienten (`48 − förfluten tid`), för kran-videor kommer `hoursUntilAutoApprove` från servern. Blandas i samma kö. | `HomeScreen.tsx:43`, `TapScreens.tsx:55`, `ReviewQueueScreen.tsx:37,46`, `CampaignScreens.tsx:157` |
| F12 | **Avgiften "15 %" är klientliteral** (`0.15`) i beställningsformuläret; servern använder `feePercentApplied`. | `OrderScreens.tsx:21-23,186`, `hooks/ugc.ts:73` |
| F13 | **Diskrepans verifierat vs overifierat i samma DTO.** Brand-analytics `TotalViews` = Σ `Assignment.TotalVerifiedViews` (verifierade), men `TotalLikes/Comments/Shares` och per-video `Views/Likes/…` summeras över alla aktiva `SocialPost` **oavsett `VerificationStatus`**. Creatorprofilens "Verifierat på VYRLE" filtrerar på `Verified` men över **alla uppdrag, all tid**, utan scope-etikett och utan tidsstämpel. Det förklarar "embed visar 2 likes, aggregatet 5". | `CampaignService.cs:597-613,656-663`, `PortfolioAndDiscoveryServices.cs:298-312` |
| F14 | **Följarantal hämtas en gång vid OAuth-koppling och uppdateras aldrig.** `TokenRefreshJob` och `DailyCampaignSyncJob` rör inte `FollowerCount`. Manuella konton visar 0. `AverageViews` har ingen skrivare (alltid null) men visas som "Snittvisningar" och är sorteringsnyckel `views` i Hitta creators (sorteringen är död). | `TikTokConnectService.cs:152,169,179`, `PortfolioAndDiscoveryServices.cs:228`, `CreatorDetailScreen.tsx:118`, `CreatorsScreen.tsx:158` |
| F15 | **Instagram-siffror visas trots att ingen källa finns.** Creator-Statistik › Plattformar visar "Instagram · Följare" (`instagramFollowerCount`, alltid 0), Hitta creators och creator-detalj tar `max(followerCount, tikTokFollowerCount, instagramFollowerCount)` och `minFollowers`-filtret matchar mot Instagram-kolumnen. Instagram-användarnamn är fritext utan OAuth. | `screens/creator/AnalyticsScreen.tsx:242`, `CreatorsScreen.tsx:148`, `CreatorDetailScreen.tsx:93`, `PortfolioAndDiscoveryServices.cs:188-191,220-229` |
| F16 | **Spårade klick räknas per anonym träff utan dedupe** (`TotalClicks += 1`, endpoint `[AllowAnonymous]`). Klick, CTR, CPC och AES bygger på detta. | `Services/TrackingLinkService.cs:103-117`, `Api/Controllers/TrackingController.cs:31-33` |
| F17 | **"PR-värde att deklarera"** = Σ `compensationAmount + productValue` som **företaget skrev in** i erbjudandet. Visas som ett belopp utan att märkas som deklarerat av motparten. | `EarningsScreen.tsx:35,63`, `screens/creator/AnalyticsScreen.tsx:195-196` |
| F18 | **F-skatt / momsregistrerad / VAT-nummer är självdeklarerade kryssrutor** som gate:ar betalda uppdrag (`RequireFTaxForPaid`). Får aldrig renderas som "verifierad". | `EarningsScreen.tsx:140-142`, `UgcCreatorService.cs:88-90`, `Domain/Ugc/UgcVerificationRule.cs:41` |
| F19 | **Omdömen kan skickas på uppdrag i vilken status som helst** i backend (bara partskontroll + ett per recensent); UI:t låser till `Completed`. Stjärnor defaultar till 5 i alla betygsformulär. | `ReviewAndChatServices.cs:39-64`, `components/app/Reviews.tsx:149`, `CollabScreen.tsx:146-148` |
| F20 | Brand "Spenderat"-tile = `budgetSpent + budgetReserved` (reserverat visas som spenderat). | `CampaignScreens.tsx:59` |
| F21 | `GET /api/campaigns/{id}` saknar ägarkontroll: inloggad användare kan läsa vilken kampanjs `Budget`, `BudgetSpent`, `TotalViews` som helst. Inte klassificering, men dataintegritet. | `CampaignController.cs:23-25`, `CampaignService.cs:309-324` |
| F22 | **Landningssidan**: 60 hårdkodade siffror, count-up till `$12,480`, "Updated 11 minutes ago via API" som statisk text, "Level 4 creator / Top creator / TOP 5% / EXCELLENT"-badges, tre testimonials (en utan video), tio påhittade logotyper under "Built for the way modern brands actually grow", 17 döda `href="#"`-länkar. Sidan är engelsk utan språkväxel; `/terms` och `/privacy` länkas aldrig. | `src/frontend/public/vyrle.html` (radhänvisningar i avsnitt 1) |

**Regel 2 (tidsstämpel saknas)** — se avsnitt 7. Kort: bara `TikTokStatus.lastSyncAt` (egen creator), `PayableDto.calculatedAt`, `SocialSnapshotAt` (egen UGC-profil) och `briefUpdatedAt` finns. Inga brand-vända creator-siffror, inga analytics-summor, inga per-video-siffror har tidsstämpel.

---

## 1. Landningssida och juridiska sidor

`public/vyrle.html` serveras rått på `/` i produktion (nginx `try_files /vyrle.html`). Filen gör **inga** API-anrop; det enda dynamiska är `localStorage['creatorpay-auth']` för "Open app". Alla siffror nedan presenteras som prestationsdata och klassas därför `SYSTEM_COMPUTED`; källan är hårdkodad.

| Fält | Sida/komponent | Klass | Källa | Åtgärd |
|---|---|---|---|---|
| "10 min" synkintervall, "0" följarminimum, "4 ways to get paid", "30+ metrics", "24h velocity" | vyrle.html:850-882 (hero) | SYSTEM_COMPUTED | Hårdkodad | behåll (produktpåståenden; verifiera mot faktisk synk 10–15 min och 2 utbetalningstriggers Views/Clicks — "4 ways" och "codes and sales" saknar stöd i koden, ta bort dem) |
| "$0" vs "$12,480" count-up, "Up to 1,000,000 views", "€10,000", "+2.1M/+889K/+743K/+4.6M", "8.3M views" | vyrle.html:925-998, script 1929-1949 | SYSTEM_COMPUTED | Hårdkodad + JS-animation | behåll (märk blocket "Räkneexempel" / "Illustration") |
| "14.2K", "9.8K", "$14 CPM", "$11 CPM", "312,840 views syncing", "64 %", **"Updated 11 minutes ago via API"**, "$4,280 available", "Auto approve after three days" | vyrle.html:1047-1092 (How it works, creator) | SYSTEM_COMPUTED | Hårdkodad | ta bort tidsstämpel-texten och "three days" (produkten auto-godkänner efter 48 h); övriga siffror behåll märkta "Exempel" |
| "€12.00 CPM", "55 %", "€10,000", "2.4M views · 9.1", "41K views · 5.2", "8.3M", "Spend €8,210 / CPM €0.99", "24 active", "24 creators" | vyrle.html:1115-1168 (How it works, brand) | SYSTEM_COMPUTED | Hårdkodad | behåll märkta "Exempel"; ta bort "score 9.1/5.2" (ingen sådan score finns) |
| **"Level 4 creator", "Top creator"**, "$4,280 earned today", "2.4M views today", "$1,230 pending" | vyrle.html:1223-1229 | SYSTEM_COMPUTED | Hårdkodad | ta bort badges (ingen nivå 4 eller Top-creator-logik finns); siffror behåll som "Exempel" |
| "Lunaré · Summer launch", "CPM €9.40", "3.18M", "€29,892", "42 creators", "6.4 %", "812K/540K/388K", "Maya R. (S) / Jonas K. (A) / Sofia L. (A)" | vyrle.html:1277-1291 | SYSTEM_COMPUTED | Hårdkodad | behåll som "Exempel"; ta bort namn på fiktiva personer |
| "8.3M views at 24h" drag-graf, **"86 / EXCELLENT"** attention score, "64 % / 36 %" plattformssplit, "4.7x ROI / €142K EMV / 8.9M" | vyrle.html:1351-1419 | SYSTEM_COMPUTED | Hårdkodad (+ `makeDragChart peak: 8300000`) | ta bort ROI/EMV/Exposure och "EXCELLENT" (finns inte i produkten); resten "Exempel" |
| "€4,280 / day 30", **"92 / TOP 5 %"** reputation score, "71 % / 29 %", "€4,280 / €1,230 / €38K" | vyrle.html:1452-1520 | SYSTEM_COMPUTED | Hårdkodad | ta bort reputation score och "TOP 5 %" (finns inte); resten "Exempel" |
| Testimonials "Maya R. · 184K avg views", "Jordan T. · 92K avg views", "Hannah V. · Brand manager" (ingen video, "0:52" literal) | vyrle.html:1537-1562 | SYSTEM_COMPUTED | Hårdkodad; MP4-filer utan koppling till konto | ta bort tills verifierade case finns (avg views kan inte styrkas) |
| Logo-marquee Lunaré, Vela, Kvell, Orbital, Halcyon, Sonder, Strya, Aurelia, Nordic, Pulse under "Built for the way modern brands actually grow" | vyrle.html:890, 2116-2134 | SYSTEM_COMPUTED (trovärdighetssignal) | Hårdkodad, kommentar "no real trademarks" | ta bort |
| "Loved by creators and the brands behind them." | vyrle.html:1534 | SYSTEM_COMPUTED (påstående) | Hårdkodad | ta bort tills case finns |
| Prissättning "€0 forever", "€99 / mo + CPM", "flat platform fee", "Markup and VAT applied transparently at checkout" | vyrle.html:1573-1603 | USER_EDITABLE (marknadscopy) | Hårdkodad | gör read-only (stäm av: ingen prenumeration finns i koden; UGC-avgift är 15 %, kranar/kampanjer har ingen plattformsavgift) |
| "Native integrations: TikTok & IG", "Link TikTok or Instagram" | vyrle.html:856, 1044 | USER_EDITABLE (copy) | Hårdkodad | ta bort Instagram-påståendet tills OAuth finns |
| Footer: TikTok, Instagram, X, LinkedIn, About, Careers, Press, Blog, Contact, Creator guide, Brand playbook, Help center, API docs, Status, Privacy, Terms, Cookies | vyrle.html:1631-1667 | — | `href="#"` (17 st) | ta bort länkar som saknar mål; peka Privacy/Terms på `/privacy`, `/terms` |
| "Book a brand demo" | vyrle.html:1617 | — | → `/register?role=Brand` (självbetjäning) | gör read-only (byt text till "Skapa företagskonto" eller koppla till riktig bokning) |
| `index.html` title/description "verified views", "TikTok & Instagram" | index.html:8-11 | USER_EDITABLE | Hårdkodad | behåll (ta bort "Instagram") |
| Villkor/Integritet: "Senast uppdaterad 12 juni 2026", "TikTok-kreatörer", "kontonummer, Swish, PayPal", "AES-256", "EU/EES" | LegalPages.tsx:45-101 | USER_EDITABLE | Hårdkodad | behåll (uppdatera: Stripe, kranar, UGC-beställningar, Instagram-handtag saknas i texten) |
| Ingen LangSwitcher på legal-sidor; landningen `lang="en"`, SPA `lang="sv"` | LegalPages.tsx:7-29, index.html:2 | — | — | behåll (lägg till språkväxel) |

---

## 2. Auth och onboarding (`/register`, `/login`, `/verify-email`)

Wizarden samlar **inga** självrapporterade prestationssiffror. Den skickar dock hela payloaden inklusive fält backend accepterar men inte använder (se avsnitt 6).

| Fält | Sida/komponent | Klass | Källa | Åtgärd |
|---|---|---|---|---|
| Kontotyp (Creator/Brand) | AuthPages.tsx:393-410 | USER_EDITABLE | DB (input) | behåll |
| E-post, lösenord, förnamn, efternamn | AuthPages.tsx:438-459 | USER_EDITABLE | DB (input) | behåll (validera live per fält, inte ett fel i taget; `<div>` utan `<form>` gör `required`/`minLength` inerta) |
| Profilbild, **Selfie för verifiering** | AuthPages.tsx:468-480 | USER_EDITABLE | DB (input); selfie bara för admin | behåll (selfien visas aldrig som badge — bra) |
| Visningsnamn, Bio (≥20), Kategori, Land, Födelsedatum | AuthPages.tsx:481-497 | USER_EDITABLE | DB (input) | behåll (födelsedatum: native `<input type=date>`, max 13 år — villkoren kräver 18; byt datepicker och sätt 18) |
| **TikTok-användarnamn** (fritext, unikhetskontroll `/auth/check-tiktok`) | AuthPages.tsx:504-510 | USER_EDITABLE | DB (input) → skapar manuellt `TikTokAccount` med `FollowerCount 0` | gör read-only (ersätt med obligatorisk OAuth i wizarden; ett inskrivet handtag får aldrig ge `TikTokConnected = true`) |
| **Instagram-användarnamn** (fritext) | AuthPages.tsx:511-513 | USER_EDITABLE | DB (input) | behåll som länk, märkt "Ej verifierad"; inga IG-siffror får härledas |
| Webbplats / Linktree | AuthPages.tsx:514 | USER_EDITABLE | DB (input) | behåll |
| Expertis-taggar (≥1, ≤10), Öppen för PR | AuthPages.tsx:521-536 | USER_EDITABLE | DB (input) | behåll (`openToPrOffers` samlas in men skickas inte — fixa) |
| Företagsnamn, **Organisationsnummer** (regex `^\d{6}-?\d{4}$`), Bransch, Webbplats, Telefon, Land, Om företaget, Logotyp | AuthPages.tsx:544-575 | USER_EDITABLE | DB (input); ingen checksumma, inget register | behåll input; **lägg till `SYSTEM_COMPUTED` `orgVerified`** (Luhn + registeruppslag) som enda underlag för badge och för "gå live" |
| "Vi granskar och godkänner din profil … 1–2 arbetsdagar", "Kontot granskas av en administratör" | AuthPages.tsx:376, 599 | — | Hårdkodad | behåll |
| Status `PendingApproval` → `Approved` | UserProfile.status | SYSTEM_COMPUTED | DB (admin) | behåll (enda synlighetsgaten idag; ingen `isPublic`/OAuth-gate finns — lägg till) |
| E-post verifierad (banner) | AppShell.tsx:33-42 | SYSTEM_COMPUTED | DB (token-flöde) | behåll (ingen resend-väg för ej godkända konton — fixa) |

---

## 3. Creator-app

### 3.1 Hem (`/creator`)

| Fält | Sida/komponent | Klass | Källa | Åtgärd |
|---|---|---|---|---|
| "Hej {förnamn}" | HomeScreen.tsx:41 | USER_EDITABLE | DB (input) `displayName` | behåll |
| Rad "Anslut ditt TikTok-konto" | HomeScreen.tsx:46 | SYSTEM_COMPUTED | DB-beräkning `connected && isOAuth` | behåll |
| "{belopp} att hämta ut" | HomeScreen.tsx:47 | SYSTEM_COMPUTED | Intern ledger (`Payable.available`), summerat i **Klient** | flytta till server-beräkning (en `available`-summa + `calculatedAt`) |
| Inbjudan, PR-erbjudande, "Din tur", "Ingen video registrerad än" | HomeScreen.tsx:49-58 | SYSTEM_COMPUTED (status) | DB-beräkning; "ingen video" är **Klient**-heuristik `totalVerifiedViews === 0` | flytta till server-beräkning (server vet om inlämning finns) |
| Tile **Intjänat** | HomeScreen.tsx:67 | SYSTEM_COMPUTED | Intern ledger `currentPayoutAmount`, Σ i **Klient** över `pageSize=100` | flytta till server-beräkning |
| Tile **Views** | HomeScreen.tsx:68 | SYSTEM_COMPUTED | TikTok API → `TotalVerifiedViews`, Σ i **Klient** | flytta till server-beräkning (+ tidsstämpel) |
| Tile **Att hämta ut** | HomeScreen.tsx:69 | SYSTEM_COMPUTED | Intern ledger, Σ i **Klient** | flytta till server-beräkning |
| Kran-rad: företag, badge Öppen/Pausad | HomeScreen.tsx:78-79 | SYSTEM_COMPUTED | DB-beräkning (`tapStatus`, `membershipStatus`) | behåll |
| Kran-rad "{cpm} kr / 1 000 views" | HomeScreen.tsx:79 | USER_EDITABLE (företagets) | DB (input) | behåll |
| Kran-rad "{n} views denna månad", belopp | HomeScreen.tsx:79 | SYSTEM_COMPUTED | Intern ledger (`TapAccrual`) | behåll (lägg till "uppdaterad {tid}") |
| Flöde (företagsinlägg) | HomeScreen.tsx:91-93 | USER_EDITABLE (företagets) | DB (input) | behåll |
| Öppna kampanjer: namn, företag, kategori, ersättning | HomeScreen.tsx:100 | USER_EDITABLE (företagets) | DB (input) | behåll |

### 3.2 Kampanjer › Mina och Upptäck (`/creator/assignments`, `/creator/browse`)

| Fält | Sida/komponent | Klass | Källa | Åtgärd |
|---|---|---|---|---|
| Uppdragsrad titel, subtitle kran (cpm), kampanjbrief | WorkScreen.tsx:70-72 | USER_EDITABLE (företagets) | DB (input) | behåll |
| Badge "Kran · öppen", "Mål uppnått", status | WorkScreen.tsx:71 | SYSTEM_COMPUTED | DB-beräkning (`goalReached`, status) | behåll |
| "{views} views · tilldelad {datum}", belopp | WorkScreen.tsx:72-73 | SYSTEM_COMPUTED | TikTok API / Intern ledger | behåll (+ tidsstämpel) |
| Videouppdrag: status, "Din tur", belopp, deadline | WorkScreen.tsx:76-78 | SYSTEM_COMPUTED | Intern ledger (`agreedAmountOre`), DB | behåll |
| Ansökta: status, **"{bud} / video"** | WorkScreen.tsx:91-92 | bud = USER_EDITABLE (creatorns eget pris); status = SYSTEM_COMPUTED | DB (input) / DB | behåll |
| "Avslutade · Visa (N)" | WorkScreen.tsx:100 | SYSTEM_COMPUTED | **Klient** (count) | behåll (ren räkning av hämtade rader) |
| Upptäck: kampanjrad, "N platser kvar", "Fullbokad" | WorkScreen.tsx:148-150 | USER_EDITABLE (innehåll) / SYSTEM_COMPUTED (`spotsLeft`) | DB (input) / DB-beräkning | behåll |
| Badge Godkänd/Ansökt/Nekad | WorkScreen.tsx:149 | SYSTEM_COMPUTED | DB | behåll |
| Bokmärke | WorkScreen.tsx:151 | USER_EDITABLE | DB (input) | behåll |
| Kran-rad "Du hämtar / Öppen kran / Ingen kran öppen", "Medlem sedan" | WorkScreen.tsx:164-174 | SYSTEM_COMPUTED | DB-beräkning (klient-join mot `/creator/taps`) | behåll |
| Videouppdrag-rad "Produkt \| {min}–{max} · {s} s · {N} dagar", "Anlitad/Ansökt" | WorkScreen.tsx:193-195 | USER_EDITABLE (företagets) / SYSTEM_COMPUTED | DB | behåll |
| Sökfält, chip "Passar dig" | WorkScreen.tsx:122, 189 | — | Klientfilter | behåll |

### 3.3 Kampanjdetalj (`/creator/campaigns/:id`)

| Fält | Sida/komponent | Klass | Källa | Åtgärd |
|---|---|---|---|---|
| Namn, företag, kategori, land, beskrivning, brief, krav, hashtag, förmåner, taggar, period | CampaignDetailScreen.tsx:57-96 | USER_EDITABLE (företagets) | DB (input); företagsnamn via **Klient**-uppslag i browse-lista (fallback "Kampanj") | behåll (lägg `brandName` i `CampaignDetailDto`) |
| Badge Godkänd/Ansökt/Nekad, "Fullbokad" | CampaignDetailScreen.tsx:69,101-105 | SYSTEM_COMPUTED | DB | behåll |
| Tile Ersättning (regler), Maxersättning, "Visningar krävs {minViews}+" | CampaignDetailScreen.tsx:73,94; PayoutTerms.tsx:58-66 | USER_EDITABLE (företagets) | DB (input) | behåll |
| Tile "Platser {spotsLeft}/{max}" | CampaignDetailScreen.tsx:74 | SYSTEM_COMPUTED / USER_EDITABLE | DB-beräkning / DB (input) | behåll |
| "Slutar om N dgr" | CampaignDetailScreen.tsx:75 | SYSTEM_COMPUTED | **Klient** (`daysLeft(endDate)`) | behåll (datumaritmetik på serverdatum) |
| **Kalkyl "{views} visningar ≈ {kr}"** (slider 0–500 000, default 25 000) | PayoutTerms.tsx:12-39,71-80 | SYSTEM_COMPUTED-liknande | **Klient** (`estimatePayout` speglar backendkalkylatorn) | behåll (märkt "Uppskattning — din ersättning räknas på servern"; det står redan en disclaimer) |
| Ansökningstext | CampaignDetailScreen.tsx:108-110 | USER_EDITABLE | → POST /applications | behåll |

### 3.4 Uppdrag (`/creator/assignments/:id`)

| Fält | Sida/komponent | Klass | Källa | Åtgärd |
|---|---|---|---|---|
| Kampanjnamn, företag, brief, krav, förmåner, stående brief, hashtag, cpm, tak | AssignmentScreen.tsx:220-276 | USER_EDITABLE (företagets) | DB (input) | behåll |
| Badge "Kran · öppen/pausad", statusbadge, "Mål uppnått" | AssignmentScreen.tsx:228-239 | SYSTEM_COMPUTED | DB | behåll |
| Tile **Views** (kran: månad) | AssignmentScreen.tsx:233 | SYSTEM_COMPUTED | TikTok API → `TotalVerifiedViews` / Intern ledger `myMonthViews` | behåll (+ "verifierad via TikTok · uppdaterad {tid}"; `SocialPost` saknar per-post synk-tid — lägg till) |
| Tile **Intjänat** | AssignmentScreen.tsx:234 | SYSTEM_COMPUTED | Intern ledger | behåll (+ `calculatedAt`) |
| Tile **"Kranen använd N %"** | AssignmentScreen.tsx:235 | SYSTEM_COMPUTED | Intern ledger, % i **Klient** | flytta till server-beräkning (returnera `monthUsedPercent`) |
| Meter "Ditt månadstak {earned}/{cap}" | AssignmentScreen.tsx:240 | SYSTEM_COMPUTED / USER_EDITABLE (cap) | Intern ledger / DB (input) | behåll |
| Video-kort: status, "Hittad {datum}", **views · gilla · kommentarer · delningar** | AssignmentScreen.tsx:245-246 | SYSTEM_COMPUTED | TikTok API (`SocialPost.Latest*`), `VerificationStatus` | behåll (visa bara siffror när `status = Verified`; + tidsstämpel) |
| Inskickad video: status, länk, avslagsorsak | AssignmentScreen.tsx:251-253 | SYSTEM_COMPUTED (status) / USER_EDITABLE (url) | DB | behåll |
| Lägg till video: TikTok-rutnät (cover, views, "Används") | AssignmentScreen.tsx:177-185 | SYSTEM_COMPUTED | TikTok API (`my-tiktok-videos`) | behåll |
| "Eller klistra in länken" | AssignmentScreen.tsx:188-189 | USER_EDITABLE | → POST submit (servern kräver eget kopplat handtag) | behåll (kräv OAuth-konto; manuellt konto passerar kontrollen men synkas aldrig → views blir 0) |
| Spårningskoder (hashtag, tag, färdig beskrivning) | AssignmentScreen.tsx:289-291 | SYSTEM_COMPUTED | DB-beräkning | behåll |
| Chatt, omdöme | AssignmentScreen.tsx:282-283 | se 5 | | |

### 3.5 Videouppdrag (`/creator/ugc/orders/:id`, `/creator/ugc/collabs/:id`)

| Fält | Sida/komponent | Klass | Källa | Åtgärd |
|---|---|---|---|---|
| Titel, företag, region, ersättningstyp, rättigheter, min–max, format, leverans, produkt, brief | OrderScreen.tsx:45-55, 14-21 | USER_EDITABLE (företagets) | DB (input) | behåll |
| Badge "AI" | OrderScreen.tsx:47 | SYSTEM_COMPUTED | DB (`briefGeneratedByAi`) | behåll |
| "N platser kvar / fullbokad" | OrderScreen.tsx:41,52 | SYSTEM_COMPUTED | **Klient** (`slots − hiredCount`) | behåll (enkel differens av serverfält) |
| "Ditt bud" / Budark "Ditt pris per video" (default mittvärde), Pitch | OrderScreen.tsx:58,68-69 | USER_EDITABLE | DB (input) → apply | behåll |
| "Verifiera dig först" (blocker) | OrderScreen.tsx:38,63 | SYSTEM_COMPUTED | DB-beräkning (`canTakePaid`, `blocker`) | behåll |
| Collab: status, "Du får {kr}", deadline, auto-godkänns, revision N/M, betald, avbrutet | CollabScreen.tsx:85-90,154-171 | SYSTEM_COMPUTED | Intern ledger / DB | behåll |
| Collab: leverans (version, datum, MB), tvist, kontrakt (hash, datum), händelser, betalning (till creatorn, utbetalt, återbetalt) | CollabScreen.tsx:101-227 | SYSTEM_COMPUTED | Intern ledger | behåll |
| Uppladdning (fil, kommentar), revision/tvist-text, betyg (default 5) | CollabScreen.tsx:142-148,196-198 | USER_EDITABLE | DB (input) | behåll (ta bort default 5 stjärnor) |

### 3.6 Profil (`/creator/profile`, `/creator/profile/edit`)

| Fält | Sida/komponent | Klass | Källa | Åtgärd |
|---|---|---|---|---|
| Avatar, visningsnamn, bio, kategori, land, expertis-taggar, webbplats, Öppen för PR | ProfileScreen.tsx:150-158,240-263 | USER_EDITABLE | DB (input) | behåll (lägg till cover; avatar-fallback på gradient) |
| Födelsedatum | ProfileScreen.tsx:250 | USER_EDITABLE | DB (input), **skrivs men läses aldrig tillbaka** (saknas i `CreatorProfileDto`) | behåll (lägg i DTO; app-datepicker) |
| **TikTok-användarnamn** | ProfileScreen.tsx:153,255 | USER_EDITABLE när ej OAuth; SYSTEM_COMPUTED när OAuth | DB (input) / TikTok API | gör read-only (alltid från OAuth; inget fritextläge) |
| **Instagram-användarnamn** | ProfileScreen.tsx:256 | USER_EDITABLE | DB (input), ingen OAuth | behåll som ren länk märkt "Ej verifierad" (eller OAuth + read-only) |
| **Badge creator-nivå** (Rising …) | ProfileScreen.tsx:154, 26-33, 99-106 | SYSTEM_COMPUTED | **Klient** (sida 1 av `/payouts/mine` mot hårdkodade TIERS) | flytta till server-beräkning (`level`, `paidTotal`, `nextThreshold` i DTO; trösklar i backend) |
| Badge "Konto: {status}" | ProfileScreen.tsx:154 | SYSTEM_COMPUTED | DB | behåll |
| Tile **Följare** | ProfileScreen.tsx:161 | SYSTEM_COMPUTED | TikTok API vid koppling, **uppdateras aldrig**; 0 för manuella | behåll (sekundär, märkt "TikTok · uppdaterad {lastSyncAt}"; uppdatera i synkjobbet) |
| Tile **Verifierade views** | ProfileScreen.tsx:57,162 | SYSTEM_COMPUTED | TikTok API, Σ i **Klient** över sida 1 (100) | flytta till server-beräkning |
| Tile **Omdöme** | ProfileScreen.tsx:163 | SYSTEM_COMPUTED | DB-beräkning (`Review`) | behåll |
| Portfolio: media, titel, beskrivning, kategori (fritext), "Utvald" | ProfileScreen.tsx:176-181, 205-214 | USER_EDITABLE | DB (input) | behåll (kategori → select) |
| **Portfolio: Varumärke** | ProfileScreen.tsx:212 | USER_EDITABLE | DB (input), fritext utan FK | gör read-only (välj ur verifierade Vyrle-samarbeten; fritext bara med "Ej verifierad"-märkning, exkluderas ur trovärdighetssignaler) |
| Portfolio: `views`, `likes` | types/index.ts:59-60 | SYSTEM_COMPUTED | DB, alltid null (klientinput nollas) | ta bort (fält + kolumner; visa TikTok-siffror bara via verifierad post-koppling) |
| Omdömen-lista | ProfileScreen.tsx:190 | SYSTEM_COMPUTED | DB | behåll |
| Meny "Intäkter · {kr} att hämta ut", "Creator-nivå · {paid} av {next}" | ProfileScreen.tsx:193-195 | SYSTEM_COMPUTED | **Klient** | flytta till server-beräkning (samma som ovan) |

### 3.7 Intäkter och verifiering (`/creator/earnings`, `/creator/earnings/verification`)

| Fält | Sida/komponent | Klass | Källa | Åtgärd |
|---|---|---|---|---|
| Hero "Att hämta ut" | EarningsScreen.tsx:44 | SYSTEM_COMPUTED | Intern ledger, Σ i **Klient** | flytta till server-beräkning |
| Payable-rad: "{views} views · intjänat · utbetalt", knapp belopp, "Pågår", "Allt utbetalt" | EarningsScreen.tsx:52-54 | SYSTEM_COMPUTED | Intern ledger (`PayoutCalculation`, `PayoutRequest`), `calculatedAt` finns men visas inte | behåll (visa `calculatedAt`) |
| Utbetalningsmetod (maskerad), "Saknas" | EarningsScreen.tsx:61,104-111 | USER_EDITABLE | DB (input, krypterad) | behåll |
| "Verifiering & skatt" badge Klar/Valfri/Avstängd, "Verifierad hos Stripe" | EarningsScreen.tsx:62,126-135 | SYSTEM_COMPUTED | DB via Stripe-webhook (`DetailsSubmitted && PayoutsEnabled`) | behåll (korrekt datavillkor) |
| **"PR-värde att deklarera"** | EarningsScreen.tsx:63 | SYSTEM_COMPUTED | Σ av **företagets inskrivna** `compensationAmount + productValue`, Σ i **Klient** | flytta till server-beräkning (märk "deklarerat av företaget") |
| Historik: belopp, status, datum, metod | EarningsScreen.tsx:72 | SYSTEM_COMPUTED | Intern ledger | behåll |
| **F-skatt, momsregistrerad, VAT-nummer** | EarningsScreen.tsx:140-142 | USER_EDITABLE | DB (input), självdeklarerat | behåll (aldrig som badge; märk "uppgett av dig") |
| "Från visning till pengar", "Varje natt räknas …", "Krypteras med AES-256" | EarningsScreen.tsx:64,81-84,110 | — | Hårdkodad | behåll |

### 3.8 Statistik (`/creator/analytics`) — allt räknas i klienten

| Fält | Sida/komponent | Klass | Källa | Åtgärd |
|---|---|---|---|---|
| Tiles Verifierade views, Intäkter (+ kr/1K), Spårade klick (+ CTR), Live-kampanjer (+ snittvisningar) | AnalyticsScreen.tsx:179-185,207-210 | SYSTEM_COMPUTED | TikTok API / Intern ledger / klick-räknare, alla Σ i **Klient** över `pageSize=100` | flytta till server-beräkning (konstruera `CreatorAnalyticsDto`, + `calculatedAt`) |
| LineChart "Views per kampanj" | AnalyticsScreen.tsx:187,212 | SYSTEM_COMPUTED | **Klient** | flytta till server-beräkning |
| Fakta Följare, Genomförda kampanjer, Kranar du hämtar ur | AnalyticsScreen.tsx:213 | SYSTEM_COMPUTED | TikTok API (stale) / **Klient**-count | flytta till server-beräkning |
| Prestation-rader, staplar Klickfrekvens (×8), Intäkt/1K (×2), Snittvisningar | AnalyticsScreen.tsx:219,223 | SYSTEM_COMPUTED | **Klient**, godtyckliga skalfaktorer | flytta till server-beräkning (staplar relativt max, inga konstanter) |
| Creator-betyg | AnalyticsScreen.tsx:225 | SYSTEM_COMPUTED | DB | behåll |
| Plattformar TikTok: konto, Följare (två källor), **Snittvisningar (alltid null)**, Verifierade views, Senast synkad | AnalyticsScreen.tsx:233-237 | SYSTEM_COMPUTED | TikTok API; `lastSyncAt` visas (enda tidsstämpeln i appen) | behåll konto/följare/synkad; **ta bort Snittvisningar** tills källa finns |
| **Plattformar Instagram: konto, Följare** | AnalyticsScreen.tsx:242 | Konto = USER_EDITABLE; Följare = SYSTEM_COMPUTED | DB (input) / **ingen källa** (alltid 0) | ta bort följare-siffran; konto som "Ej verifierad"-länk |
| Pengar: donut Utbetalt/Godkänt/Väntande/Upplupet, Totalt, Snitt per utbetalning, Andel utbetalt, Kranar denna månad, Kranar totalt, PR-värde | AnalyticsScreen.tsx:189-196,247-257 | SYSTEM_COMPUTED | Intern ledger, Σ i **Klient** över sida 1 av `/payouts/mine`; "Andel utbetalt" räknar `Completed` men summan även `Paid` | flytta till server-beräkning |
| Creator-nivå | AnalyticsScreen.tsx:258 | SYSTEM_COMPUTED | **Klient** (TIERS) | flytta till server-beräkning |
| "Varumärken du tjänar mest på" | AnalyticsScreen.tsx:260 | SYSTEM_COMPUTED | **Klient**, grupperat på kampanjnamn (inte varumärke) | flytta till server-beräkning (gruppera på brand) |

### 3.9 Övriga creator-skärmar

| Fält | Sida/komponent | Klass | Källa | Åtgärd |
|---|---|---|---|---|
| Nivåer: "Din nivå", "{kr} utbetalt · N slutförda", meter, lista med trösklar | MoreScreens.tsx:16-33 | SYSTEM_COMPUTED | **Klient** + hårdkodade TIERS | flytta till server-beräkning |
| Sparat: kampanjrad, "sparad {datum}", "Fullbokad" | MoreScreens.tsx:48-49 | USER_EDITABLE (bokmärke) / SYSTEM_COMPUTED | DB | behåll |
| Inställningar › TikTok-konto: "@{user}", badge **Ansluten / Ej verifierad / Ej ansluten**, "{n} följare · synkad {datum}" | AccountForms.tsx:195-200 | SYSTEM_COMPUTED | TikTok API + `isOAuth`, `lastSyncAt` | behåll (**målbilden**: korrekt villkor + tidsstämpel; sprid mönstret) |
| Inställningar › Videouppdrag: kategorier (≤6), stad, region, exempelvideo, portfoliosamtycke | MoreScreens.tsx:107-116 | USER_EDITABLE | DB (input) | behåll |
| Konto: e-post, lösenord, radera konto ("inom 30 dagar") | AccountForms.tsx:114-174 | USER_EDITABLE | DB | behåll |
| Länkar (flaggad av): "{klick} klick" | MoreScreens.tsx:127-133 | SYSTEM_COMPUTED | Klick-räknare (ingen dedupe, F16) | behåll bakom flaggan |
| Företagsprofil (`/creator/brands/:id`) | BrandPublicScreen.tsx | se 4.9 (samma komponent) | | |

---

## 4. Brand-app

### 4.1 Hem (`/brand`)

| Fält | Sida/komponent | Klass | Källa | Åtgärd |
|---|---|---|---|---|
| Företagsnamn | HomeScreen.tsx:37 | USER_EDITABLE | DB (input) | behåll |
| "Organisationsnummer saknas" | HomeScreen.tsx:42 | SYSTEM_COMPUTED | DB (`!organizationNumber`) | behåll (byt villkor till `!orgVerified`) |
| "{n} videor att granska" + **"Godkänns automatiskt efter 48 timmar"** | HomeScreen.tsx:43 | SYSTEM_COMPUTED | DB-beräkning (`ActionCounts`), Σ i **Klient**; 48 = **Hårdkodad** | flytta till server-beräkning (server returnerar auto-approve-fönstret) |
| "{n} ansökningar", "{n} vill gå med", "{n} nya bud", "Din tur" | HomeScreen.tsx:44-47 | SYSTEM_COMPUTED | DB-beräkning | behåll |
| Tiles **Spenderat, Views, Aktiva creators** | HomeScreen.tsx:55-57 | SYSTEM_COMPUTED | Intern ledger / TikTok API, Σ i **Klient** över sida 1 av `/campaigns/mine` (alla statusar) | flytta till server-beräkning (brand-summary-endpoint med statusscope + `calculatedAt`) |
| Kran-rad: namn, "{spent} av {budget} · {n} creators", "{pct} %" | HomeScreen.tsx:68-69 | USER_EDITABLE (namn, budget) / SYSTEM_COMPUTED (spent, creators; % i **Klient**) | DB (input) / Intern ledger | behåll (returnera `monthUsedPercent` från server) |
| Kampanj-rad: namn, status, "{a}/{max} creators · {slut}", spenderat | HomeScreen.tsx:81 | USER_EDITABLE / SYSTEM_COMPUTED | DB (input) / Intern ledger (`LiveSpent`) | behåll |
| Beställning-rad: titel, status, ersättning, "{hired}/{slots} anlitade" | HomeScreen.tsx:91 | USER_EDITABLE / SYSTEM_COMPUTED | DB | behåll |
| "Senaste från communityn": creator, kampanj, datum, "{views} views" | HomeScreen.tsx:101 | SYSTEM_COMPUTED | TikTok API (`CreatorVideo.views`, **overifierade `Latest*`**), urval i **Klient** | flytta till server-beräkning (bara `Verified`-poster) |

### 4.2 Kampanjer & kranar (`/brand/campaigns?tab=`)

| Fält | Sida/komponent | Klass | Källa | Åtgärd |
|---|---|---|---|---|
| Kran-rad "#{hashtag} · {cpm} kr CPM · {spent} av {budget}", "{pct} %" | ProgramsScreen.tsx:40-41 | USER_EDITABLE / SYSTEM_COMPUTED | DB (input) / Intern ledger; % **Klient** | behåll (% från server) |
| Kampanj-rad "{spent} / {budget}", creators, period | ProgramsScreen.tsx:63 | SYSTEM_COMPUTED / USER_EDITABLE | Intern ledger / DB (input) | behåll |
| Uppdragsrad: status, "Din tur", belopp, deadline, auto-godkänns | ProgramsScreen.tsx:86-88 | SYSTEM_COMPUTED | Intern ledger / DB | behåll |
| "{n} nya bud", "Visa (N)" | ProgramsScreen.tsx:91,102 | SYSTEM_COMPUTED | DB / **Klient**-count | behåll |

### 4.3 Kran (`/brand/tap/:id`, `/brand/tap/new`, `/brand/tap/:id/edit`)

| Fält | Sida/komponent | Klass | Källa | Åtgärd |
|---|---|---|---|---|
| Namn, hashtag, CPM, kategori, tak/video, månadstak/creator, brief, instruktioner | TapScreens.tsx:34-52, 99-127 | USER_EDITABLE | DB (input); validering budget ≥ 500, CPM ≥ 20 | behåll |
| Badge Öppen/Pausad | TapScreens.tsx:40 | SYSTEM_COMPUTED | DB | behåll |
| Meter "{spent} av {budget} denna månad", "**{remaining} kvar**" / "Slut — öppnar den 1:a" | TapScreens.tsx:41 | SYSTEM_COMPUTED | Intern ledger `SummarizeAsync` (server); växling till "Slut" via **Klient**-% | behåll (växla på server-`monthRemaining === 0`) |
| Tiles Views (månad), Aktiva creators, "{n} medlemmar", Att granska | TapScreens.tsx:44-46 | SYSTEM_COMPUTED | Intern ledger / DB; Att granska = **Klient**-filter som räknar `tapId == null` under **varje** kran | behåll (+ tidsstämpel); flytta Att granska till server |
| "uppdaterad {briefUpdatedAt}" | TapScreens.tsx:51 | SYSTEM_COMPUTED | DB | behåll |
| "Videor att granska" + **48 timmar** | TapScreens.tsx:55 | SYSTEM_COMPUTED | **Klient**-count; 48 **Hårdkodad** | flytta till server-beräkning |
| **Kalkylator "{n} views i månaden", "1 000 / 10 000 / 100 000 views → kr", "Slår in vid", "Räcker till minst"** | TapScreens.tsx:86-90,112-114 | SYSTEM_COMPUTED-liknande | **Klient** från inskrivna värden | behåll (märkt "Räkneexempel på din budget", aldrig som utfall) |
| Default CPM "25" | TapScreens.tsx:74 | — | Hårdkodad | behåll (produktdefault) |

### 4.4 Kampanj (`/brand/campaigns/:id`, `/brand/campaigns/new`, creator-i-kampanj)

| Fält | Sida/komponent | Klass | Källa | Åtgärd |
|---|---|---|---|---|
| Namn, beskrivning, kategori, hashtag, period, budget, max creators, videor/creator, utbetalningsmodell och regler, instruktioner, taggar, förmåner | CampaignScreens.tsx:51-88; CampaignFormScreen.tsx | USER_EDITABLE | DB (input); wizarden skickar alltid `country:'SE'`, `minViews:0`, `reviewMode:'ManualReview'` | behåll (validera alla fält samtidigt; CPM-hint "Minst 20 kr" saknar `min`) |
| Statusbadge, "{left} dgr kvar" | CampaignScreens.tsx:56 | SYSTEM_COMPUTED | DB / **Klient**-datumaritmetik | behåll |
| Tile **Views** | CampaignScreens.tsx:58 | SYSTEM_COMPUTED | TikTok API → Σ `TotalVerifiedViews` | behåll (+ tidsstämpel) |
| Tile **Spenderat** "av {budget}" | CampaignScreens.tsx:59 | SYSTEM_COMPUTED | Intern ledger; **Klient** adderar `budgetReserved` (alltid 0) | behåll (visa `budgetSpent` ensamt) |
| Tile Creators "{approved}/{max}" | CampaignScreens.tsx:60 | SYSTEM_COMPUTED / USER_EDITABLE | DB | behåll |
| "{n} ansökningar" | CampaignScreens.tsx:67 | SYSTEM_COMPUTED | DB, **Klient**-count över sida 1 | flytta till server-beräkning (finns i `ActionCounts`) |
| Creator-rad: "{views} views · {a}/{n} videor godkända · {payoutStatus}", belopp, "{pend} att granska" | CampaignScreens.tsx:71-72 | SYSTEM_COMPUTED | TikTok API / Intern ledger; antal godkända räknas i **Klient**; `requiredVideoCount ?? 1` | flytta till server-beräkning (`approvedVideoCount`, `pendingVideoCount` per creator) |
| Snabbfakta: status, kategori, period, creators, budget, reserverat, videor/creator, publicerad | CampaignScreens.tsx:100-107 | blandat | DB | behåll (ta bort "Reserverat" tills `BudgetReserved` har en skrivare) |
| Kalkyl "max {kr} för {n} creators", varning "Budgeten är lägre …" | CampaignFormScreen.tsx:33-39,116-117 | SYSTEM_COMPUTED-liknande | **Klient** från inskrivna värden | behåll (märkt "Maxkostnad enligt dina regler") |
| Creator i kampanj: tiles Views, Intjänat (+ payoutStatus), "Videor godkända {a}/{n}" | CampaignScreens.tsx:148-150 | SYSTEM_COMPUTED | TikTok API / Intern ledger; godkända i **Klient** | flytta till server-beräkning |
| Video-kort: status, "{views} views · {datum}", **"auto-godkänns om {h} tim"** | CampaignScreens.tsx:157-160 | SYSTEM_COMPUTED | TikTok API (**overifierad `LatestViewCount`**); timmar i **Klient** med literal 48 | flytta till server-beräkning (`autoApproveAt` per video; views med verifieringsstatus) |
| "Markera som betald · {kr}" | CampaignScreens.tsx:172 | SYSTEM_COMPUTED | Intern ledger; **företaget sätter utbetalningsstatus** (`POST /payouts/assignments/{id}/manual`) | behåll (visa som "Markerad som betald av företaget", inte som verifierad utbetalning) |
| "Nekade creators får ett kort meddelande", statusförklaringar | CampaignScreens.tsx:62-64; CreatorsScreen.tsx:184 | — | Hårdkodad | behåll |

### 4.5 Att granska (`/brand/review`)

| Fält | Sida/komponent | Klass | Källa | Åtgärd |
|---|---|---|---|---|
| Kran-video: creator, kran, "{views} views", datum, "{h} tim / snart" | ReviewQueueScreen.tsx:36,50 | SYSTEM_COMPUTED | TikTok API; `hoursUntilAutoApprove` från **server** | behåll |
| Kampanj-video: samma fält | ReviewQueueScreen.tsx:25-37 | SYSTEM_COMPUTED | TikTok API; timmar i **Klient** (`48 − elapsed`); bara `Active`-kampanjer sida 1 | flytta till server-beräkning (en kö-endpoint för båda) |
| "Videor som inte granskas inom 48 timmar godkänns automatiskt." | ReviewQueueScreen.tsx:46 | — | **Hårdkodad** | flytta till server-beräkning (hämta fönstret från config/DTO) |
| Neka-anledning | ReviewQueueScreen.tsx:59-60 | USER_EDITABLE | DB (input) | behåll |

### 4.6 Creators (`/brand/creators?tab=community|find|applications`)

| Fält | Sida/komponent | Klass | Källa | Åtgärd |
|---|---|---|---|---|
| "{n} medlemmar" | CreatorsScreen.tsx:50,56 | SYSTEM_COMPUTED | DB, **Klient**-count | behåll |
| Medlem/förfrågan: namn, "{följare} följare · @{handle}", badge **Kvalificerad**, "{views} views · {kr} utbetalt", "Inbjuden {datum}" | CreatorsScreen.tsx:62-81 | SYSTEM_COMPUTED | TikTok API (`TikTokAccount.FollowerCount`, stale, 0 för manuella) / Intern ledger / DB (`source === 'AutoQualified'`) | behåll (badge korrekt); följare märkt "TikTok · uppdaterad {tid}" och dolt när ej OAuth |
| Inbjudningsark: namn, kategori, @handle, "{followerCount} följare" | CreatorsScreen.tsx:98-116 | SYSTEM_COMPUTED | TikTok API (stale), bara sida 1 av sök | behåll (samma villkor som ovan) |
| **Hitta: "{followers} följare · ★ {rating}"**, "Öppen för PR", "{totalCount} creators" | CreatorsScreen.tsx:145-149 | SYSTEM_COMPUTED (följare, betyg) / USER_EDITABLE (Öppen för PR) | `max(followerCount, tikTokFollowerCount, instagramFollowerCount)` i **Klient**; betyg DB | flytta till server-beräkning (primär signal: verifierade views, EPM, approval rate, senaste aktivitet; följare sekundärt, bara OAuth) |
| **Filter: Minst antal följare, Sortera (följare/betyg/snittvisningar/senast)** | CreatorsScreen.tsx:155-162 | — | Server: `minFollowers` matchar även IG-kolumn; sort `views` på död `AverageViews` | ta bort "Snittvisningar"-sortering och IG-matchning; lägg till filter på verifierade views/EPM |
| Ansökningar: namn, status, "{kategori} · {följare} följare · {datum} “{meddelande}”" | CreatorsScreen.tsx:204-205 | SYSTEM_COMPUTED / USER_EDITABLE (meddelande) | `max(FollowerCount, TikTokAccount.FollowerCount)` server | behåll (följare bara OAuth) |

### 4.7 Creatorprofil sedd av företag (`/brand/creators/:id`)

| Fält | Sida/komponent | Klass | Källa | Åtgärd |
|---|---|---|---|---|
| Namn, kategori, land, @tiktok, bio, taggar, "Öppen för PR" | CreatorDetailScreen.tsx:97-114 | USER_EDITABLE (creatorns) | DB (input) | behåll (@tiktok bara när OAuth, annars "ej verifierat handtag") |
| Tile **Följare** | CreatorDetailScreen.tsx:93,117 | SYSTEM_COMPUTED | `max(...)` inkl. Instagram i **Klient**; TikTok-värde stale | flytta till server-beräkning (`tikTokFollowers` + `syncedAt`, bara OAuth; sekundär plats) |
| Tile **Snittvisningar** | CreatorDetailScreen.tsx:118 | SYSTEM_COMPUTED | `averageViews`, **alltid null** | ta bort (ersätt med Verifierade views / EPM / Approval rate som primär statsrad) |
| Tile Betyg "{n} omdömen" | CreatorDetailScreen.tsx:119 | SYSTEM_COMPUTED | DB | behåll |
| Membership-badge | CreatorDetailScreen.tsx:123-125 | SYSTEM_COMPUTED | DB | behåll |
| **"Verifierat på VYRLE"**: Views, Gilla, Engagemang %, Kommentarer, Delningar, Kampanjer | CreatorDetailScreen.tsx:135-147 | SYSTEM_COMPUTED | DB-beräkning över **alla uppdrag, all tid**, bara `Verified`-poster; engagement i server; **ingen tidsstämpel, ingen scope-etikett**; "Kampanjer" räknar även kranar | behåll (rubrik bara när data finns; lägg till "över alla kampanjvideos · uppdaterad {tid}"; samma scope som per-video) |
| "Uppmätt av VYRLE på kampanjvideos — inte självrapporterat." | CreatorDetailScreen.tsx:149 | — | Hårdkodad | behåll (**målbilden**; ska följa med varje sifferblock) |
| Portfölj: media, titel, **varumärke** | CreatorDetailScreen.tsx:154-162 | USER_EDITABLE (creatorns) | DB (input), fritext | gör read-only (bara verifierade samarbeten, annars "Ej verifierad") |
| Omdömen | CreatorDetailScreen.tsx:169 | SYSTEM_COMPUTED | DB | behåll |
| PR-erbjudande: rubrik, typ, kategori, meddelande, **Ersättning (SEK), Produktvärde (SEK)**, deadline | CreatorDetailScreen.tsx:56-65 | USER_EDITABLE (företagets deklaration) | DB (input) | behåll (märks "deklarerat av företaget" där det summeras, F17; app-datepicker) |

### 4.8 Beställningar (`/brand/ugc/campaigns/:id`, `/new`, `/:id/edit`, `/brand/ugc/collabs/:id`)

| Fält | Sida/komponent | Klass | Källa | Åtgärd |
|---|---|---|---|---|
| Titel, brief (mål, format, längd, antal, hooks, CTA, gör/undvik, referenser), ersättningstyp, min–max, produkt, värde, rättigheter, leveranstid, platser, region, kategorier, min följare | OrderScreens.tsx:57-66,162-202 | USER_EDITABLE | DB (input) | behåll |
| Status Öppen/Utkast/Stängd, "{hired}/{slots}" | OrderScreens.tsx:62,65 | SYSTEM_COMPUTED | DB | behåll |
| "Bud ({n})" | OrderScreens.tsx:69 | SYSTEM_COMPUTED | **Klient**-count | behåll |
| Bud-rad: **"Godkänd av VYRLE"**, "Favorit" | OrderScreens.tsx:72 | SYSTEM_COMPUTED | DB (`creatorStatus === 'Approved'` sätts av admin; `Preselected`) | behåll (korrekt villkor) |
| Bud-rad: "{följare} följare" | OrderScreens.tsx:72 | SYSTEM_COMPUTED | `max(FollowerCount, FollowerSnapshot)` (TikTok API); `SocialSnapshotAt` finns men saknas i bud-DTO | behåll (+ tidsstämpel i DTO) |
| Bud-rad: "{n} leveranser", "{x} % i tid", "★ {rating}" | OrderScreens.tsx:72 | SYSTEM_COMPUTED | Intern ledger (`RecordDelivery`), % i **Klient**; betyg DB | behåll (% från server) |
| Bud-rad: stad/region, pitch, belopp | OrderScreens.tsx:72-73 | USER_EDITABLE (creatorns) | DB (input) | behåll |
| Bud-DTO `likeFollowerRatio` | hooks/ugc.ts:38 | SYSTEM_COMPUTED | TikTok API (bara OAuth) | behåll (renderas inte idag) |
| **FeeNote "… inkl. VYRLE:s avgift (15 %)"** | OrderScreens.tsx:21-23,186 | SYSTEM_COMPUTED-liknande | **Klient**-literal 0.15 | flytta till server-beräkning (`feePercent` från API) |
| Order-defaults (1 000–2 500 kr, 1 500 kr direkt, 7 dagar, 6 mån rättigheter) | OrderScreens.tsx:112-113 | — | Hårdkodad | behåll (produktdefault) |
| OrgNotice "Lägg till organisationsnummer innan ni publicerar" | OrderScreens.tsx:25-28 | SYSTEM_COMPUTED | DB (`!organizationNumber`) | behåll (byt till `!orgVerified`) |
| Collab (brand-vy): "Du betalar {kr}", "Företaget betalade", "VYRLE-avgift", kontrakt, händelser, tvist, betalning | CollabScreen.tsx:89-125,213-227 | SYSTEM_COMPUTED | Intern ledger | behåll |
| Revision/tvist/avbryt-text, betyg (default 5) | CollabScreen.tsx:134-148 | USER_EDITABLE | DB (input) | behåll (ta bort default 5) |

### 4.9 Företagsprofil (`/brand/profile`, `/brand/profile/edit`, publik vy `BrandPublicScreen`)

| Fält | Sida/komponent | Klass | Källa | Åtgärd |
|---|---|---|---|---|
| Logotyp, företagsnamn, **organisationsnummer**, bransch, telefon, webbplats, beskrivning | ProfileScreen.tsx:83-98 | USER_EDITABLE | DB (input); org.nr normaliseras till 10 siffror, inget mer | behåll input (lägg till cover; org.nr utlöser server-verifiering) |
| Statusbadge (Godkänd …), "Org.nr saknas" | ProfileScreen.tsx:51 | SYSTEM_COMPUTED | DB | behåll |
| **Badge "Verifierat företag"** | BrandPublicScreen.tsx:47 | SYSTEM_COMPUTED | **Hårdkodad, villkorslös** | ta bort (rendera endast när `orgVerified === true`; annars "Ej verifierad" eller inget) |
| "{bransch} · {land} · sedan {år}" | BrandPublicScreen.tsx:46 | USER_EDITABLE / SYSTEM_COMPUTED (memberSince) | DB | behåll |
| Tile **Följare** (brand-följare) | BrandPublicScreen.tsx:53 | SYSTEM_COMPUTED | DB-beräkning (`BrandFollower`) | behåll |
| Tile **Aktiva kampanjer** | BrandPublicScreen.tsx:54 | SYSTEM_COMPUTED | DB, **lagrad** status (inte slutdatumsmedveten som listan) | behåll (använd `EffectiveCampaignStatus`) |
| Tile Betyg, Genomförda, **Totala views**, Ambassadörer | BrandPublicScreen.tsx:55-57 | SYSTEM_COMPUTED | DB / TikTok API-summa över Active/Completed/Paused kampanjer, **alla uppdragsstatusar**; ingen tidsstämpel | behåll (+ scope-etikett och tidsstämpel) |
| Kran-kort: namn, "{cpm} kr / 1 000 views", tak, hashtag, brief | BrandPublicScreen.tsx:67-69 | USER_EDITABLE | DB (input) | behåll |
| Inlägg (text, bild, "ago") | BrandPublicScreen.tsx:84-86 | USER_EDITABLE | DB (input) | behåll |
| Aktiva kampanjer: namn, ersättning, "{n} platser kvar", badge Godkänd/Ansökt/Nekad/Fullbokad | BrandPublicScreen.tsx:97 | USER_EDITABLE / SYSTEM_COMPUTED | DB; ansökningsstatus via creator-endpoint (anropas även i brand-vy) | behåll (hoppa över anropet i brand-vy) |
| Tidigare kampanjer "{views} views" | BrandPublicScreen.tsx:104 | SYSTEM_COMPUTED | TikTok API-summa | behåll (+ tidsstämpel) |
| Omdömen från creators | BrandPublicScreen.tsx:107 | SYSTEM_COMPUTED | DB | behåll |

### 4.10 Statistik (`/brand/analytics`) — allt räknas i klienten (F8, F9)

| Fält | Sida/komponent | Klass | Källa | Åtgärd |
|---|---|---|---|---|
| Översikt: Visningar (+ creators · posts), Spend (+ **"{remaining} kvar"**), CPM, Snitt/post (+ senaste dygnet) | AnalyticsScreen.tsx:31-34,74-77 | SYSTEM_COMPUTED | Σ i **Klient** över sida 1 av `/campaigns/mine` utan statusfilter; `budgetRemaining = Budget − BudgetSpent − 0` per kampanj | flytta till server-beräkning (brand-analytics-endpoint: scope = Active + Completed, aldrig Draft; `calculatedAt`; enhetstest på orimliga aggregat) |
| **Attention efficiency score** (+ staplar) | AnalyticsScreen.tsx:35,79-81 | SYSTEM_COMPUTED | **Klient**; vikter 0.45/0.25/0.30, ×8/×40/×20 **hårdkodade** | flytta till server-beräkning (eller ta bort tills formeln är definierad och dokumenterad) |
| "Vägt index … Allt från verifierad data." | AnalyticsScreen.tsx:82 | — | Hårdkodad; osann (klick odedupade, likes overifierade) | ta bort tills det stämmer |
| Fakta Engagemang/ER, Klick/CTR, Community medlemmar/kvalificerade | AnalyticsScreen.tsx:84 | SYSTEM_COMPUTED | **Klient**; likes/comments/shares **overifierade** (F13); klick odedupade (F16) | flytta till server-beräkning |
| **Insikt "levererar din lägsta CPM"** | AnalyticsScreen.tsx:58-59 | SYSTEM_COMPUTED | **Klient**, kräver bara `totalViews > 0` | flytta till server-beräkning (tröskel: ≥ N videor och ≥ M views per kampanj; annars låg-data-state) |
| **Insikt "Videor på {bucket} drar flest"** | AnalyticsScreen.tsx:45-46,60 | SYSTEM_COMPUTED | **Klient**, en video räcker | flytta till server-beräkning (≥ N poster per bucket och ≥ 2 buckets) |
| **Insikt "Bäst att posta {daypart}"** | AnalyticsScreen.tsx:47-48,61 | SYSTEM_COMPUTED | **Klient**, besökarens tidszon, `publishedAt` ibland inlämningstid | flytta till server-beräkning (UTC→Europe/Stockholm; bara synkade `PublishedAt`; ≥ N poster per bucket) |
| Prestation: "Visningar per kampanj" (sorterad på views, inte datum), Bästa creators ({kr}/1K), Kvalitetssignaler (ER, share, CTR, **viral rate 100K+**), "Videor över 100K/500K/1M", Per nisch, Bäst presterande content, Levererade videouppdrag | AnalyticsScreen.tsx:37-53,89-97 | SYSTEM_COMPUTED | **Klient**; trösklar hårdkodade; per-video views **overifierade** | flytta till server-beräkning |
| PR-utskick: skickade, sedda, accepterade (%), nekade, per kategori | AnalyticsScreen.tsx:96 | SYSTEM_COMPUTED | DB (`/pr-offers/sent/stats`), % i **Klient** | behåll |
| Plattformar: TikTok-donut Gilla/Kommentarer/Delningar/Sparningar, "ER" | AnalyticsScreen.tsx:103 | SYSTEM_COMPUTED | **Klient**; `totalSaves` är konstant 0 i backend | flytta till server-beräkning (ta bort Sparningar ur donut tills TikTok exponerar det) |
| "Sparningar exponeras inte av TikTok ännu och visas därför som 0.", "Instagram-data hämtas inte automatiskt ännu." | AnalyticsScreen.tsx:104,110 | — | Hårdkodad | behåll (sant) |
| Prestanda per videolängd, Bästa publiceringstid, Topp-hashtags (views dubbelräknas per tagg) | AnalyticsScreen.tsx:107-109 | SYSTEM_COMPUTED | **Klient**; hashtags från `Caption` = creatorns `Notes` vid manuell inlämning | flytta till server-beräkning (bara TikTok-caption; trösklar) |
| Pengar: Budget (= spent + remaining), Spenderat (%), Kranar/mån (Active-budget vs **all** spend), Videouppdrag (bara `Paid`) | AnalyticsScreen.tsx:54-55,115-118 | SYSTEM_COMPUTED | **Klient** | flytta till server-beräkning (Budget = Σ konfigurerad budget i scope) |
| Kostnad per CPM/CPC/CPE/CPP/CPSH/visning/CPS | AnalyticsScreen.tsx:121-127 | SYSTEM_COMPUTED | **Klient** | flytta till server-beräkning |
| Spenderat per kampanj, Kranar ("{remaining} kvar", % **oklampat**), Intjänat av communityn | AnalyticsScreen.tsx:129-131 | SYSTEM_COMPUTED | Intern ledger; % **Klient** | behåll rader; % från server |
| "Allt bygger på verifierad visnings-, klick-, engagemangs- och spend-data." | AnalyticsScreen.tsx:134 | — | Hårdkodad; osann idag (F13, F16) | ta bort tills det stämmer |

### 4.11 Inställningar, meddelanden, notiser

| Fält | Sida/komponent | Klass | Källa | Åtgärd |
|---|---|---|---|---|
| E-post, lösenord, radera konto, språk | SettingsScreen.tsx; AccountForms.tsx | USER_EDITABLE | DB | behåll |
| Skickade PR-erbjudanden: status, sedd, svar, belopp, produkt | MessagesScreen.tsx:190-198 | SYSTEM_COMPUTED (status/datum) / USER_EDITABLE (belopp, text) | DB | behåll |
| Segment "Erbjudanden" antal | MessagesScreen.tsx:35 | — | Hårdkodad `0` för brand | behåll (räkna olästa svar från server) |

---

## 5. Delade komponenter

| Fält | Sida/komponent | Klass | Källa | Åtgärd |
|---|---|---|---|---|
| Tab-badges (Hem-punkt, Meddelanden-antal), notisklocka | AppShell.tsx:86-96,135-145; common.tsx:40-42 | SYSTEM_COMPUTED | DB-beräkning (`ActionCounts`, `/chat/unread`, `/notifications`), Σ i **Klient** | behåll (summor av serverfält) |
| E-postbanner, cooldown 60 s | AppShell.tsx:24-49 | SYSTEM_COMPUTED | DB | behåll |
| Chatt: motpart, kampanj, senaste meddelande, oläst, ✓/✓✓, tid | Chat.tsx:22-45 | SYSTEM_COMPUTED / USER_EDITABLE (text) | DB | behåll |
| Omdöme: stjärnor (default 5), kommentar; lista med snitt, antal, "Varumärke"-badge | Reviews.tsx:24-36,57-75,125-137,149 | USER_EDITABLE (input) / SYSTEM_COMPUTED (aggregat) | DB | behåll (ta bort default 5; server ska kräva `Completed`, F19) |
| Notiser: titel, text, oläst, "ago" | NotificationsScreen.tsx:53-68 | SYSTEM_COMPUTED | DB | behåll |
| `ago()`, `daysLeft()`, `Meter`-fyllnad | common.tsx:61-78; ds/index.tsx:206-208 | — | **Klient**-aritmetik på serverdatum/-tal | behåll |
| StatusBadge/statusTone-mappningar, label-kartor (COMPENSATION_LABEL, RIGHTS_LABEL, OFFER_TYPE, PAYOUT_LABEL) | ds/index.tsx:113-118; hooks/ugc.ts:121-139 | — | Hårdkodade etiketter för serverstatusar | behåll |

---

## 6. API-skrivyta: fält som accepteras men inte får vara klientstyrda

| Endpoint | Fält i request-DTO | Idag | Åtgärd |
|---|---|---|---|
| `POST /auth/register`, `POST /auth/social/register` | `FollowerCount`, `AverageViews`, `InstagramFollowerCount` | Ignoreras (skriver 0/null) | ta bort ur DTO |
| `PUT /creator/profile` | `FollowerCount`, `AverageViews`, `InstagramFollowerCount` | Ignoreras | ta bort ur DTO och ur frontend-typen `Partial<CreatorProfile>` |
| `PUT /creator/profile` | `TikTokUsername` (fritext när ej OAuth) | Skapar/döper om manuellt `TikTokAccount` → `TikTokConnected = true` | gör read-only (bara OAuth får sätta handtag; manuellt konto får inte räknas som anslutet) |
| `PUT /creator/profile` | `InstagramUsername` | Lagras som fritext | behåll som länk, märk "Ej verifierad" |
| `POST/PUT /creator/portfolio` | `Views`, `Likes` | Nollas av servern | ta bort ur DTO och entitet |
| `POST/PUT /creator/portfolio` | `BrandName` | Fritext utan FK | gör read-only (välj `campaignId`/`collabId`; fritext → `unverifiedBrandName`, aldrig i trovärdighetssignaler) |
| `PUT /brand/profile`, `POST /auth/register` | `OrganizationNumber` | Format/längd, ingen verifiering, ingen `orgVerified` | behåll input; lägg till `SYSTEM_COMPUTED` `OrgVerified`, `OrgVerifiedAt` (Luhn + register) som enda gate för badge, UGC-publicering och "gå live" |
| `PUT /ugc/creator/profile` | `HasFTax`, `VatRegistered`, `VatNumber` | Självdeklarerat, gate:ar betalda uppdrag | behåll (visa som "uppgett av creatorn"; aldrig badge) |
| `POST /reviews/assignments/{id}` | `Stars` | Ingen statuskontroll på uppdraget | behåll (server kräver `Completed`) |
| `POST /ugc/brand/collabs/{id}/rate` | `Rating` | Bara Approved/Paid, en gång | behåll |
| `POST /payouts/assignments/{id}/manual` | — (brand markerar utbetald) | Företaget sätter utbetalningsstatus | behåll (etikett "markerad av företaget") |
| `POST /pr-offers` | `CompensationAmount`, `ProductValue` | Företagets deklaration | behåll (märk vid summering) |
| `GET /tracking/r/{code}` | — | `TotalClicks += 1` per anonym träff | flytta till server-beräkning (dedupe per IP-hash/UA/tidsfönster) |
| `POST /brand/tap`, `POST /campaigns` | `MonthlyBudget`, `Cpm`, `Budget`, `Amount` | Deklarerade tak, ingen escrow (`BudgetReserved` saknar skrivare) | behåll (USER_EDITABLE); visa aldrig som "reserverat" |
| `GET /campaigns/{id}` | — | Ingen ägarkontroll | gör read-only (kräv ägare/part) |
| Migrationer `20260913120000`, `20260917100000` | — | Nollade historiska självrapporterade stats | behåll |
| `Api/Bootstrap/DemoDataSeeder.cs` | Fejkade views/utbetalningar/portfolio-varumärken | Avstängd (`SeedDemoDataEnabled=false`), städas vid boot | ta bort (så att den inte kan slås på i produktion); seedat lanseringsföretag utan org.nr får ingen badge |

---

## 7. Tidsstämplar (regel 2)

| Finns | Var |
|---|---|
| `TikTokStatus.lastSyncAt`, `connectedAt` | bara egen creator (`GET /creator/tiktok/status`); sätts bara när videohämtning lyckas |
| `PayableDto.calculatedAt`, `PayoutCalculationDto.calculatedAt` | egen creator; visas inte i UI |
| `UgcCreatorProfileDto.socialSnapshotAt` | egen creator; saknas i bud-rader |
| `TapDto.briefUpdatedAt` | visas |
| `SocialPostInfoDto.discoveredAt`, `CreatorVideoDto.publishedAt/createdAt` | upptäckt/publicering, **inte** senaste synk |

**Saknas helt** (ska läggas till innan siffran får visas med "verifierad via … · uppdaterad …"): `CreatorProfileDto.followerCount`; alla siffror i `CreatorDiscoveryDto`; `CreatorPublicProfileDto` (följare, `TotalVerifiedViews/Likes/Comments/Shares`, engagement, `CompletedCampaigns`); `BrandPublicProfileDto` (följare, `TotalVerifiedViews`, `CreatorsWorkedWith`, per-kampanj views); `CampaignAnalyticsDto` (alla summor, `CreatorPerformanceDto`, `CreatorVideoDto.Views/Likes/…` — `SocialPost` saknar per-post synk-kolumn, `SocialPostMetricSnapshot.SnapshotDate` finns men exponeras inte); `CampaignDetailDto.TotalViews/BudgetSpent`; `AssignmentDetailDto.TotalVerifiedViews/CurrentPayoutAmount`; `TapDto.MonthSpent/MonthViews`; `CommunityMemberDto`; `UgcApplicationDto`; `MarketBenchmarkDto`.

---

## 8. Regelkontroll

**Regel 1 — SYSTEM_COMPUTED får inte komma från formulär eller klientstate**

| Status | Fält |
|---|---|
| Bryter (klientstate) | Creator: Hem-tiles, "Att hämta ut", profilens Verifierade views, creator-nivå, hela Statistik, PR-värde. Brand: Hem-tiles, "Senaste från communityn", hela Statistik inkl. "kvar", AES, insikter, viral rate, kostnad-per; antal ansökningar/godkända/pending videor per kampanj; auto-godkännande-timmar; 15 %-avgift; "Spenderat" med reserverat |
| Bryter (accepteras i API) | `FollowerCount`, `AverageViews`, `InstagramFollowerCount` (3 DTO:er); portfolio `Views`, `Likes`; manuellt TikTok-handtag som ger `TikTokConnected` |
| Uppfyller | Kran-ackumulering (`SummarizeAsync`), payables, UGC-betalningar/kontrakt/leveranser, betygssnitt, brand-följare, `ActionCounts`, `hoursUntilAutoApprove` för kranar, Stripe-flagga |

**Regel 2 — källa och tidsstämpel** — uppfylls idag bara av TikTok-kortet under Inställningar ("{n} följare · synkad {datum}") och kran-briefen. Alla övriga sifferblock saknar tidsstämpel i DTO:n (avsnitt 7).

**Regel 3 — badges**

| Badge | Villkor idag | Status |
|---|---|---|
| "Verifierat företag" | inget | **bryter** |
| "Verifierat på VYRLE" (rubrik) | inget (innehåll gate:at) | bryter (rubrik) |
| Creator-nivå Rising/… | klientsumma mot hårdkodade trösklar | bryter |
| UGC "Verifierad" (admin-vy) | default vid skapande | bryter |
| Landningssidans "Level 4", "Top creator", "TOP 5 %", "EXCELLENT" | inget | bryter |
| "Ansluten" / "Ej verifierad" / "Ej ansluten" (TikTok) | `connected && isOAuth` | uppfyller |
| "Godkänd av VYRLE" | `creatorStatus === 'Approved'` (admin) | uppfyller |
| "Kvalificerad" | `source === 'AutoQualified'` | uppfyller |
| "Verifierad hos Stripe" / "Klar" | Stripe `DetailsSubmitted && PayoutsEnabled` | uppfyller |
| "Fullbokad", "Mål uppnått", "Din tur", "Favorit", "Öppen för PR", statusbadges | serverfält | uppfyller |

---

## 9. Åtgärdslista (underlag för block A–E)

1. Backend: `OrgVerified/OrgVerifiedAt` på `BrandProfile` (Luhn + registeruppslag), exponera i båda brand-DTO:erna; badge, UGC-publicering och "gå live" gate:as på den. Ta bort den villkorslösa badgen.
2. Backend: `TikTokVerified` (= OAuth med token) i alla brand-vända creator-DTO:er; manuellt handtag ger aldrig "ansluten"; discovery filtrerar/sorterar bara på verifierad data; följare uppdateras i synkjobbet och får `syncedAt`.
3. Backend: ta bort `FollowerCount/AverageViews/InstagramFollowerCount` ur request-DTO:er och `Views/Likes` ur portfolio; portfolio-`BrandName` blir FK till verifierat samarbete med fritext-fallback märkt "Ej verifierad".
4. Backend: `GET /creator/analytics` (bygg `CreatorAnalyticsDto`), creator-nivå server-side, `GET /brand/analytics` med statusscope, verifieringsscope för likes/comments/shares, minsta-urval för insikter (låg-data-state annars), tidszon, `calculatedAt`. Enhetstester: aggregat > Σ konfigurerad budget i scope är fel; insikt med n < tröskel renderas inte.
5. Backend: tidsstämplar i alla DTO:er i avsnitt 7; `autoApproveAt` per video; `feePercent` i order-DTO; klick-dedupe; ägarkontroll på `GET /campaigns/{id}`; `Completed`-krav för omdömen.
6. Frontend: byt alla klientsummor mot serverfält; varje `SYSTEM_COMPUTED`-block får "verifierad via {källa} · uppdaterad {tid}" och scope-etikett; ta bort Snittvisningar, Instagram-följare, "Allt från verifierad data"-texter tills de är sanna; default 5 stjärnor bort.
7. Landningssida: ta bort fiktiva badges, scores, testimonials och logotyper; märk räkneexempel; laga 17 länkar; Instagram-påståenden bort.

Steg 0 är levererat. Inget är kodat. Väntar på "OK" innan block A påbörjas.

## Tillägg 2026-09-22 — Hitta: nyligen presterat

| Fält | Sida/komponent | Klass | Källa | Åtgärd |
|---|---|---|---|---|
| Views senaste 7 / 30 dagarna | Creators › Hitta (plattforms-chip, sortering Relevans) | SYSTEM_COMPUTED | `SocialPostMetricSnapshot` (dagliga TikTok-snapshots) via `CreatorRanking.WindowViews` | behåll (server-beräknad, visas med fönster) |
| "Presterat nyligen"-tröskel (≥10 000 / 7 d eller ≥100 000 / 30 d) | Creators › Hitta (standardfilter) | SYSTEM_COMPUTED | `CreatorRanking.Recent7dViews/Recent30dViews` | behåll |
| Följare (chip till höger) | Creators › Hitta | SYSTEM_COMPUTED | `TikTokAccount.FollowerCount` via OAuth (`VerifiedFollowers()`) | behåll; summa över verifierade plattformar = TikTok idag |
| Instagram kreatör-tagg | Creators › Hitta, profil | USER_EDITABLE | `CreatorProfile.ShowInstagramBadge` + `InstagramUsername` | behåll som länk märkt "ej verifierad"; inga siffror |

