# VYRLE — produktbacklog

Uppdaterad 2026-08-21 (från Hozans lista). Status: ✅ klart · 🔧 delvis/scaffoldat · ⬜ ej påbörjat.

## Låsta affärsregler

- ✅ **Minst 20 kr per 1 000 views (CPM).** Hårdkodat i backend
  (`PayoutRuleValidator.MinCpmSek` + kontroll i `CampaignService`), hint i
  kampanjformuläret. Går inte att runda via API:et.
- **30 % plattformspåslag på slutbeloppet** (det brand betalar = creator-ersättning
  × 1,30). Konfig finns (`Platform:FeePercent`), men tillämpas först när
  fakturering/debitering byggs — se GigaPay + kortbetalning nedan.

## Utbetalningar — GigaPay 🔧

`GigaPayPayoutProvider` är byggd och aktiveras automatiskt när nycklarna
konfigureras i Railway (`GigaPay__ApiKey`, `GigaPay__IntegrationId`, valfritt
`GigaPay__BaseUrl` = `https://api.demo.gigapay.se/v2/` för test). Tills dess
vägrar plattformen markera utbetalningar som genomförda (säkert felläge).

Kvar att göra (kräver GigaPay-konto — teckna på gigapay.co):
1. Skaffa API-nyckel + Integration-ID (börja i deras demomiljö).
2. Onboarda creators som GigaPay-employees (POST /employees/ med e-post/mobil)
   och spara employee-id på creator-profilen.
3. Låt settlement-jobbet skicka employee-id (idag skickas payout-request-id).
4. Webhook/avstämning för slutförda utbetalningar.

## Fakturering av brands ⬜

- **Kortuppgifter i företagsvyn för löpande fakturering:** kortdata får aldrig
  lagras hos oss (PCI-DSS). Lösning: Stripe — brand lägger sitt kort via Stripe
  SetupIntent, vi debiterar löpande (kampanjkostnad + 30 % + ev. abonnemang).
  Kräver Stripe-konto. Detta är förutsättningen för både påslaget och
  abonnemangen nedan.
- **Abonnemang (framtid):** Basic 300 kr/mån · Mellan 2 500 kr/mån ·
  Stor 5 000 kr/mån (ex moms). Basic 300 kr ska in som baskostnad så snart
  Stripe-debitering finns.

## Instagram-koppling ⬜

Idag: endast manuellt användarnamn + följarantal (overifierat). Riktig koppling
går via **Instagram API with Instagram Login** (Meta): kräver Meta-utvecklarapp,
creators med Professional-konto (Business/Creator), OAuth-flöde likt TikTok
(`instagram_business_basic` m.fl. scopes) och Meta App Review innan andra än
testanvändare kan koppla. Basic Display API är nedlagt sedan dec 2024 — det är
Meta-review-vägen som gäller. Uppskattning: samma storlek som TikTok-kopplingen
plus deras granskningstid.

## Framtid (ej prio)

- **Vyrle-Linktree med betalning per klick:** creators får en publik länksida;
  klick spåras och ersätts per klick. Grund finns redan: tracking-länkar med
  klickattribution + "Link Tree"-vyn. Behöver: publik sida, klickpeng-regler,
  fraud-skydd på klick.
- **Shopify-integration:** koppla brands Shopify-butik (OAuth + Admin API,
  webhooks för ordrar) så försäljning kan attribueras till creators via
  tracking-länkar/rabattkoder → provisionbaserad ersättning.

## Tidigare kända luckor (från produktionsgenomgången 2026-08-21)

- Ingen mejltjänst (verifiering, lösenordsåterställning, notiser) — förslag: Resend.
- Social-registrering hoppar över fältvalidering.
- Ingen kontolåsning vid upprepade inloggningsförsök (rate limit finns, per IP).
- Brandens "manuellt betald"-väg går förbi admin (by design, bör ses över).

## Kranen (pivot, 2026-08-22) — löpande UGC-motor
Beslut: Vyrle byggs om från episodisk kampanjmarknadsplats till löpande UGC-motor. Kärnprodukt = kranen (stående månadsbudget som betalar varumärkets community per verifierad view). Kampanjer = on-ramp + boost; varje avslutad kampanj konverterar till "gör detta månatligt".

- [x] Fas 1 (shippad): Campaign.Kind=Tap, månadsbokföring (hårt tak, no rollover, cap/video, månadstak/creator, fast CPM ≥20), community-medlemskap (auto-kvalificering vid godkänd ansökan, inbjudan, borttagning), auto-assignment till kranen, brand-UI (Kranen + Community), creator-UI (Dina kranar + tap-banner), konverterings-CTA på avslutad kampanj.
- [ ] Fas 2 — community-ytan: posttyper (Nyhet / Önskemål / Pinnad), pinna brief & exempelvideor, gruppkommentarer brand↔community, "kranen är öppen"-post automatiskt, kran-uppdateringar i creator-flödet.
- [ ] Fas 3 — kran-analys: månadsrapport (kostnad/views/CPM/creators), per-creator leverans, budgetprognos, admin-vy över alla kranar (MRR).
- [ ] Fas 4 — fakturering: månadsbudget faktureras löpande (Stripe), kranen pausas automatiskt vid utebliven betalning.
