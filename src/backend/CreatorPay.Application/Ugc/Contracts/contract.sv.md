<!--
  UTKAST — KRÄVER JURIDISK GRANSKNING INNAN SKARP DRIFT.
  Mallen fylls av UgcContractGenerator. Platshållare: {{NAMN}}.
  Ändra texten här, inte i koden. Bumpa Ugc:ContractTemplateVersion när texten ändras
  så att redan ingångna avtal behåller sin version.
-->

# Uppdragsavtal — UGC-video via VYRLE

**Avtalsversion:** {{TEMPLATE_VERSION}}
**Datum:** {{DATE}}

## 1. Parter

**Beställare ("Företaget"):** {{BRAND_NAME}}{{BRAND_ORG_LINE}}
**Uppdragstagare ("Creatorn"):** {{CREATOR_NAME}}
**Plattform:** VYRLE (www.vyrle.co), som förmedlar uppdraget, håller betalningen och tillhandahåller tvistlösning enligt punkt 8.

## 2. Uppdraget

Creatorn ska producera och leverera följande innehåll ("Leveransen"):

**Uppdrag:** {{TITLE}}

{{BRIEF}}

Leveransen ska följa briefen ovan. Feedback som ligger utanför briefen utgör en ny beställning och omfattas inte av detta avtal.

## 3. Ersättning

{{COMPENSATION_SECTION}}

## 4. Leveranstid och revisioner

- Leveransen ska laddas upp via VYRLE senast **{{DEADLINE_DAYS}} dagar** efter att Creatorn accepterat detta avtal.
- Företaget har **{{AUTO_APPROVE_DAYS}} dagar** på sig att granska en leverans. Om Företaget varken godkänner eller begär revision inom den tiden anses Leveransen godkänd.
- Företaget får begära revision högst **{{MAX_REVISIONS}} gånger**. Varje revisionsbegäran ska innehålla skriftlig feedback och ger Creatorn **{{REVISION_DAYS}} dagar** för ny leverans.
- Om Creatorn inte levererar inom leveranstiden avbryts uppdraget automatiskt, Företaget återfår hela beloppet och Creatorn får en anmärkning i VYRLE.

## 5. Rättigheter

{{RIGHTS_CLAUSE}}

{{PLATFORM_LICENSE_CLAUSE}}

## 6. Creatorns åtaganden

- Innehållet är Creatorns eget verk och gör inte intrång i tredje parts rättigheter (musik, varumärken, personer i bild).
- Innehållet följer marknadsföringslagen, inklusive tydlig reklammärkning där så krävs, samt plattformarnas regler.
- Creatorn ansvarar själv för skatter och avgifter på ersättningen.

## 7. Företagets åtaganden

- Företaget tillhandahåller produkt, material och underlag som briefen förutsätter i tid.
- Företaget använder Leveransen endast inom det rättighetspaket som anges i punkt 5.

## 8. Tvist

Tvist om huruvida Leveransen följer briefen avgörs i första hand av VYRLE:s administration, som beslutar om utbetalning till Creatorn, återbetalning till Företaget eller fördelning däremellan. Beslutet grundas enbart på briefen och Leveransen. Parterna kan därefter vända sig till allmän domstol.

## 9. Accept

Avtalet ingås elektroniskt i VYRLE genom att båda parter klickar "Acceptera". Avtalstexten och en kontrollsumma (SHA-256) av den sparas tillsammans med tidpunkten för respektive accept.

**Kontrollsumma:** beräknas på denna text vid accept.
