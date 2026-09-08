# UGC-marknadsplatsen — "Beställ video"

Ett företag beställer korta UGC-videor till fast pris. Pengarna hålls tills
leveransen är godkänd, kontraktet genereras från mall, och varje statusbyte
går genom en explicit state machine. Modulen är medvetet skild från
**kranen/kampanjerna** (`Campaign`, `CreatorCampaignAssignment`), som betalar
per verifierad view — det här är fasta leveranser med escrow.

> **Status:** Fas 1–3 byggda och driftsatta. Allt fungerar utan nycklar
> (betalning registreras manuellt av admin, video sparas på servern, briefen
> skrivs för hand). Lägg in nycklarna nedan så aktiveras Stripe, S3/R2 och AI
> automatiskt vid nästa omstart — ingen kodändring behövs.

## Var koden ligger

| Lager | Fil | Innehåll |
|---|---|---|
| Domain | `Enums/UgcEnums.cs` | Alla enums (status, rättighetspaket, aktörer …) |
| Domain | `Entities/UgcEntities.cs` | `UgcCreatorProfile`, `UgcCampaign`, `UgcApplication`, `UgcCollab`, `UgcDeliverable`, `UgcPayment`, `UgcWebhookEvent`, `UgcDispute`, `UgcMessage`, `UgcCollabEvent` |
| Domain | `Ugc/UgcCollabStateMachine.cs` | Transitionstabell + guards för collab, ansökan och kampanj |
| Domain | `Ugc/UgcFeeCalculator.cs` | Avgift, tvistfördelning, öre-formattering |
| Domain | `Ugc/UgcSchedule.cs` | Alla klockor: deadline, auto-approve, påminnelser, no-show |
| Domain | `Ugc/UgcVerificationRule.cs` | Automatiskt första filter, strikes, vem får söka |
| Application | `Ugc/UgcSettings.cs` | Konfiguration (sektionen `Ugc`) |
| Application | `Ugc/UgcContractGenerator.cs` + `Ugc/Contracts/*.md` | Kontraktsmallar (inbäddade) → text + SHA-256 |
| Application | `Ugc/IUgcPaymentGateway.cs` | Betalningsabstraktion (Stripe i fas 2) |
| Application | `Ugc/UgcSettlementService.cs` | Approved → Paid, Cancelled → refund, tvistdelning, strikes, track record |
| Application | `Ugc/Services/*.cs` | Creator-, kampanj-, bud-, collab- och admin-tjänsterna; `UgcMapper` (DTO + `AvailableActions`) |
| Application | `Ugc/UgcWebhookService.cs` | Idempotent webhook-hantering (claim → handler → release vid fel) |
| Application | `Ugc/IUgcFileStore.cs` | Videolagring — lokal disk eller S3/R2 |
| Infrastructure | `Services/StripeUgcPaymentGateway.cs` | Stripe Checkout, Transfer, Refund, Connect Express + webhook-parser |
| Infrastructure | `Services/UgcFileStores.cs` | `LocalUgcFileStore` (`/uploads/ugc/…`) och `S3UgcFileStore` (presignerade URL:er) |
| Infrastructure | `Services/AnthropicUgcBriefGenerator.cs` | AI-brief via Anthropic C#-SDK, strukturerad JSON |
| Api | `Controllers/UgcControllers.cs` | `/api/ugc/creator/*`, `/api/ugc/brand/*`, `/api/ugc/admin/*`, `/api/ugc/collabs/{id}/license`, `/api/ugc/webhooks/stripe` |
| Frontend | `src/hooks/ugc.ts`, `src/pages/ugc/*`, `src/pages/admin/AdminUgcSection.tsx` | Företag: Beställ video (lista, byggare med AI-brief, bud, pipeline-kanban, uppdrag). Creator: Videouppdrag (bud, mina uppdrag, UGC-profil). Admin: verifieringskö, tvister, integrationer |
| Infrastructure | `Data/Configurations/UgcConfigurations.cs` | EF-mappning, tabeller `ugc_*` |
| Infrastructure | `Migrations/*_AddUgcMarketplace.cs` | 10 tabeller |
| Worker | `Jobs/UgcJobs.cs` | `UgcDeadlineJob` (xx:10) och `UgcAutoApproveJob` (xx:20), varje timme |
| Tests | `CreatorPay.Tests/Ugc/*` | 423 tester, körs utan databas/Docker |

## Antaganden som styrde bygget

Prompten utgick från ett annat repo än det Vyrle faktiskt är. Så här hanterades skillnaderna:

1. **Creator är ingen ny roll.** Vyrle har redan creators med onboarding, selfie, TikTok-OAuth, portfolio och utbetalningsmetod. Marknadsplatsen lägger en 1:1-utökning, `UgcCreatorProfile`, ovanpå `CreatorProfile` (verifieringsnivå, strikes, statistik, Stripe Connect, F-skatt/moms, portfolio-opt-out). Statusen på kärnkontot rörs aldrig.
2. **Det fanns ingen Stripe-integration.** Utbetalningar i kranen går via GigaPay. Modulen definierar `IUgcPaymentGateway`; `UnconfiguredUgcPaymentGateway` svarar ärligt "inte konfigurerad" tills Stripe kopplas in i fas 2. Jobben är byggda så att ett misslyckat anrop lämnar raden med orsak och försöker igen nästa timme.
3. **Det fanns inga AI-anrop.** "Generera brief med AI" byggs i fas 3 med Anthropic-API:et (`Anthropic__ApiKey`).
4. **Inga abonnemang/organisationer.** `BrandProfile` är organisationen; `OrganizationNumber` finns redan och krävs för publicering.
5. **Namn.** `Campaign`/`CampaignApplication`/`ChatMessage` är upptagna av kranen. Modulen använder prefixet `Ugc` och tabellerna `ugc_*`.
6. **Belopp i öre som `long`**, enligt prompten — en avsiktlig avvikelse från `decimal`-kronor i resten av koden. Håll gränsen: allt i modulen är öre.
7. **PR-hubben** (`PrOffer`: gåvor/direkterbjudanden utan escrow) finns kvar orörd. "Direktbjud från katalogen" i marknadsplatsen skapar en `UgcCollab` i `Invited`.
8. **L/F-kvot.** TikTok-profilen ger inte total likes; kvoten beräknas som likes på senaste videor / följare och sparas som ögonblicksbild på `UgcCreatorProfile` (fylls i fas 2:s verifieringstjänst).
9. **Filer.** Nuvarande `IFileStorageService` skriver till lokal disk (100 MB-tak). För videoleveranser krävs objektlagring (R2/S3) — beslut behövs innan fas 3. `UgcDeliverable` är lagringsagnostisk (`FileUrl` + `FileKey`).

## Flöde

```
Brand                        System                         Creator
─────                        ──────                         ───────
skapa UgcCampaign (Draft)
[AI-brief, fas 3]
publicera ──────────────────► matcha creators, notis ──────► ansök med bud + pitch
                                                             (UgcApplication: Applied)
preselecta / hira ──────────► UgcCollab: Invited
                              kontrakt genereras (text + hash)
acceptera + betala ─────────► pengar hålls (UgcPayment: Held)
                                                             acceptera kontrakt
                              ► Accepted, DeadlineAt = nu + DeadlineDays
                              påminnelse 48 h / 24 h ──────► 
                                                             ladda upp ► Submitted
                              AutoApproveAt = nu + 5 d
                              påminnelse 24 h före ◄────────
godkänn  ─────────────────►   Approved → transfer → Paid ──► pengar + licensbevis
eller begär revision ──────►  RevisionRequested (max 2, ny deadline 3 d) ─► ny version
                              deadline passerad utan leverans:
                              Cancelled, full refund, strike (3 → Suspended)
tvist (båda) ─────────────►   Disputed: auto-approve fryst, admin avgör
                              pay_creator / refund_brand / split
```

## Statusdiagram (collab)

```mermaid
stateDiagram-v2
    [*] --> Invited : hire / direktbjud
    Invited --> Accepted : creator accepterar (kräver brand-accept + pengar hålls)
    Invited --> Cancelled : någon part avböjer
    Accepted --> InProgress : creator
    Accepted --> Submitted : creator laddar upp
    Accepted --> Cancelled : no-show / avbryt
    InProgress --> Submitted : creator laddar upp
    InProgress --> Cancelled : no-show / avbryt
    Submitted --> Approved : brand, eller klockan (5 d)
    Submitted --> RevisionRequested : brand (max 2 ggr, skriftlig feedback)
    Submitted --> Disputed : brand eller creator
    RevisionRequested --> Submitted : ny version
    RevisionRequested --> Cancelled : no-show på revisionsdeadline
    RevisionRequested --> Disputed : brand eller creator
    Approved --> Paid : transfer klar (produktbyte: direkt)
    Disputed --> Approved : admin: pay_creator / split
    Disputed --> Cancelled : admin: refund_brand
    Paid --> [*]
    Cancelled --> [*]
```

Vem som får göra vad finns i tabellen `Rules` i `UgcCollabStateMachine` och
testas uttömmande (varje (från, till, aktör)-trippel) i
`UgcCollabStateMachineTests`. Ändra tabellen → uppdatera `Expected` i testet.

**Ansökan:** `Applied → Preselected → Hired`, ut via `Rejected` (brand) eller `Withdrawn` (creator).
**Kampanj:** `Draft → Published → Closed`. Publicering kräver org.nr.

## Pengar

- Creatorn får exakt det överenskomna beloppet. Vyrles avgift (`Ugc:PlatformFeePercent`, default 15 %) läggs **ovanpå** och betalas av företaget. `UgcFeeCalculator.Quote(150_000, 15)` → creator 1 500 kr, avgift 225 kr, företaget betalar 1 725 kr.
- Avrundning: hela öre, halva öre bort från noll.
- **No-show:** full återbetalning inklusive avgift — inget levererades.
- **Tvist:** `pay_creator` → hela beloppet till creatorn; `refund_brand` → allt inkl. avgift tillbaka; `split` → creatorns andel (%) av det överenskomna beloppet, avgiften behålls.
- Produktbyte: ingen betalning, `UgcPayment.Status = NotApplicable`, samma kontrakt och statusflöde. Kontraktet innehåller standardtexten om att creatorn själv ansvarar för skatt på produkten.

Stripe-modellen i fas 2 är *separate charges and transfers*: PaymentIntent på
plattformskontot vid hire (→ `Held`), Transfer till creatorns Express-konto
vid approve (→ `Transferred`), Refund vid cancel/tvist. Kortdata lagras aldrig.
`UgcWebhookEvent` med unikt index på (provider, event_id) är idempotensspärren.

## Kontrakt

Mallarna ligger i `Ugc/Contracts/*.md` och bäddas in i assemblyn
(`WithCulture=false` — `.sv` i filnamnet är ett språk, inte en kultur).
`UgcContractGenerator.Generate` fyller platshållare, stryker HTML-kommentarer,
normaliserar radslut och hashar (SHA-256). Samma indata ger alltid samma hash,
på alla plattformar. Hashen sparas på collab:en tillsammans med båda parternas
accept-tidsstämplar.

**Texterna är utkast och kräver juridisk granskning.** Ändra i `.md`-filerna,
inte i koden, och bumpa `Ugc:ContractTemplateVersion` så att ingångna avtal
behåller sin version.

## Jobb (idempotenta, kan köras om)

| Jobb | Cron | Gör |
|---|---|---|
| `UgcDeadlineJob` | `10 * * * *` | Påminnelser 48 h/24 h före deadline (markörer `DeadlineReminder*SentAt`); no-show → Cancelled, refund, strike, notiser |
| `UgcAutoApproveJob` | `20 * * * *` | Påminnelse 24 h före auto-approve; auto-approve när klockan gått; försöker igen med transfer för allt som står i `Approved` |

Varje rad sparas för sig; en trasig rad loggas och stoppar inte de andra.
Alla beslut tas från tidsstämplar och markörer på raden, aldrig från "när
jobbet råkade köra" — det är vad `UgcJobsTests` kör varje scenario två gånger
för att bevisa.

## Miljövariabler / konfiguration

Sektionen `Ugc` (alla valfria, defaults i `UgcSettings`):

| Nyckel | Default | Betydelse |
|---|---|---|
| `Ugc__PlatformFeePercent` | `15` | Avgift i % av creatorbeloppet |
| `Ugc__AutoApproveDays` | `5` | Granskningsfönster efter leverans |
| `Ugc__RevisionDeadlineDays` | `3` | Ny, kortare deadline per revisionsrunda |
| `Ugc__MaxRevisions` | `2` | Revisionsrundor per collab |
| `Ugc__StrikesToSuspend` | `3` | No-shows innan avstängning |
| `Ugc__AutoVerifyMinFollowers` | `1000` | Tröskel för automatisk verifiering |
| `Ugc__AutoVerifyMinLikeFollowerRatio` | `0.05` | Tröskel för L/F-kvot |
| `Ugc__RequireFTaxForPaid` | `false` | Blockera betalda uppdrag utan F-skatt |
| `Ugc__ContractTemplateVersion` | `2026-09-draft-1` | Version på mallsatsen |

**Nycklar som aktiverar integrationerna (Railway → Metapick-tjänsten):**

| Variabel | Aktiverar | Var den kommer ifrån |
|---|---|---|
| `Stripe__SecretKey` | Checkout, transfers, refunds, Connect-onboarding | Stripe Dashboard → Developers → API keys (`sk_live_…`) |
| `Stripe__WebhookSecret` | Webhook-verifiering | Stripe Dashboard → Webhooks → endpoint `https://<api-host>/api/ugc/webhooks/stripe`, events: `checkout.session.completed`, `payment_intent.succeeded`, `charge.refunded`, `account.updated` (`whsec_…`) |
| `Storage__S3__Bucket`, `Storage__S3__AccessKey`, `Storage__S3__SecretKey` | Videolagring i molnet | R2: Cloudflare → R2 → Manage R2 API tokens. S3: IAM-nyckel med rätt till bucketen |
| `Storage__S3__ServiceUrl` | R2/MinIO-endpoint (`https://<accountid>.r2.cloudflarestorage.com`); utelämna för AWS | |
| `Storage__S3__Region` | Region för AWS (`eu-north-1`); för R2 räcker ServiceUrl | |
| `Storage__S3__PublicBaseUrl` | Valfritt: publik CDN-domän i stället för presignerade URL:er | |
| `Anthropic__ApiKey` | "Generera brief med AI" | console.anthropic.com |
| `Anthropic__Model` | Valfritt, default `claude-opus-5` | |

Utan nycklarna: admin ser gul status under **Beställ video → Översikt → Integrationer**, betalningar registreras
med **Registrera betalning manuellt** på uppdraget, videos ligger på API-servern (ok för test, försvinner vid omstart).

## Stripe-webhooks lokalt (fas 2)

```bash
stripe login
stripe listen --forward-to https://localhost:5001/api/ugc/webhooks/stripe
# skriv ut whsec_… i Stripe__WebhookSecret
stripe trigger payment_intent.succeeded
```

Endpointen verifierar signaturen, skriver `UgcWebhookEvent` (unikt event-id)
och först därefter agerar — ett event som redan finns i tabellen är ett no-op.

## Så testar du hela flödet utan nycklar

1. **Företag:** Beställ video → Ny beställning → skriv brief → Publicera (kräver org.nr och godkänt konto).
2. **Creator:** Videouppdrag → Min UGC-profil → kategorier + exempelvideo → *Kolla igen* (verifieras automatiskt om
   följare ≥ 1 000 och L/F-kvot ≥ 5 %; annars **Admin → Beställ video → Verifieringskö → Godkänn**). Lägg bud.
3. **Företag:** öppna beställningen → Anlita → Acceptera & betala (utan Stripe: stannar med "Betalningar är inte aktiverade").
4. **Admin:** Beställ video → Alla uppdrag → uppdraget → *Registrera betalning manuellt*.
5. **Creator:** Acceptera kontraktet → Leverera video (mp4/mov/webm, max 500 MB).
6. **Företag:** Godkänn (eller Begär ändring / Öppna tvist). Vid godkännande: utan Stripe stannar uppdraget i *Godkänd*
   med orsak på betalningsraden; med Stripe går transfern och uppdraget blir *Betald* med licensbevis.
7. Auto-approve och no-show sköts av timjobben (`UgcAutoApproveJob` 20 över, `UgcDeadlineJob` 10 över).

## Avvikelser att känna till

- **Licensbeviset** är en utskriftsvänlig HTML-sida (`/api/ugc/collabs/{id}/license`, skriv ut → PDF), inte en genererad PDF-fil.
- **Uppladdning** går via API:t (multipart, 500 MB). Nästa steg vid volym: presignerad direktuppladdning till R2.
- **Refusal-fallback** för AI-anropet är inte påslagen (icke-beta-vägen används); en refusal ger ett läsbart fel.
- **Tester** (`CreatorPay.Tests/Ugc`, 431 st) kördes gröna fram till sista ändringen (event-sekvens). Därefter blockerar
  **Windows Smart App Control** laddning av nybyggda DLL:er på utvecklarmaskinen (`0x800711C7`); stäng av det under
  Windows-säkerhet → App- och webbläsarkontroll för att köra `dotnet test` och `dotnet ef` lokalt igen.
  Migrationen `AddUgcEventSequence` är handskriven av samma skäl (kolumn + index; snapshot uppdaterad).

## Öppna beslut

1. PR-hubben: slå ihop med direktbeställning på sikt, eller leva parallellt? (Båda finns nu.)
2. F-skatt-krav från start (`Ugc__RequireFTaxForPaid=true`)? Default av.
3. Juridisk granskning av kontraktsmallarna innan skarpa betalningar.
