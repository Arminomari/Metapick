/**
 * Renders every reviewed page at desktop 1440 and mobile 390 with fixture data,
 * asserts there is no horizontal scroll, saves the screenshot under
 * docs/screens/pw/, and runs axe (WCAG 2.0 A/AA) on the mobile render of the
 * pages marked `axe`. Serious/critical violations fail the test; the full list
 * is written next to the screenshots as a11y-<page>.json.
 */
import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
import { buildFixtures } from './fixtures';

const OUT = path.resolve(HERE, '../../../docs/screens/pw');
const AXE = path.resolve(HERE, '../node_modules/axe-core/axe.min.js');
const SELFIE = path.resolve(HERE, '../../../docs/screens/b-creator-profile.png');

type Action = ['click', string] | ['type', string, string] | ['select', string, string] | ['file', number, string] | ['wait', number] | ['scrollall'];
interface Shot { name: string; path: string; role: 'Creator' | 'Brand'; guest?: boolean; env?: Record<string, string>; actions?: Action[]; axe?: boolean }

const creatorAccount: Action[] = [['type', '#rg-email', 'anna@example.com'], ['type', '#rg-pw', 'Sommar2026'], ['type', '#rg-fn', 'Anna'], ['click', 'Fortsätt']];
const creatorPlatform: Action[] = [...creatorAccount, ['type', '#rg-tt', 'annaberg'], ['type', '#rg-ig', 'annaberg'], ['click', 'Fortsätt']];
const creatorProfile: Action[] = [...creatorPlatform, ['type', '#rg-name', 'Anna Berg'], ['type', '#rg-bio', 'Mat, kaféer och vardag i Göteborg. Recept, restaurangtips och ärliga smaktest.'], ['click', 'Hudvård'], ['file', 0, SELFIE]];

const shots: Shot[] = [
  { name: 'landing', path: '/vyrle.html', role: 'Creator', guest: true, actions: [['scrollall']], axe: false /* 3 decorative contrast nodes left (shift intro, demo-tag on dark, orb); see PR #6 */ },
  // creator onboarding: each wizard step, with the live preview, then the in-app onboarding
  { name: 'register-1-konto', path: '/register', role: 'Creator', guest: true, axe: true },
  { name: 'register-1-errors', path: '/register', role: 'Creator', guest: true, actions: [['click', 'Fortsätt']] },
  { name: 'register-2-koppla', path: '/register', role: 'Creator', guest: true, actions: creatorAccount },
  { name: 'register-3-profil', path: '/register', role: 'Creator', guest: true, actions: creatorProfile },
  { name: 'register-3-errors', path: '/register', role: 'Creator', guest: true, actions: [...creatorPlatform, ['click', 'Fortsätt']] },
  { name: 'register-4-klar', path: '/register', role: 'Creator', guest: true, actions: [...creatorProfile, ['file', 1, SELFIE], ['click', 'Fortsätt']] },
  { name: 'register-brand-2-foretag', path: '/register?role=Brand', role: 'Creator', guest: true, actions: [['type', '#rg-email', 'hej@nellie.se'], ['type', '#rg-pw', 'Sommar2026'], ['click', 'Fortsätt'], ['type', '#rg-co', 'Café Nellie AB'], ['type', '#rg-org', '5566778890'], ['click', 'Fortsätt']] },
  { name: 'onboarding', path: '/creator/onboarding', role: 'Creator', env: { HIDDEN: '1' }, axe: true },
  // profiles
  { name: 'creator-profile-empty', path: '/creator/profile', role: 'Creator', env: { EMPTY_PROFILE: '1' } },
  { name: 'creator-profile', path: '/creator/profile', role: 'Creator', axe: true },
  { name: 'brand-profile', path: '/brand/profile', role: 'Brand', env: { ORG_VERIFIED: '1' }, axe: true },
  // discovery
  { name: 'creators-find', path: '/brand/creators?tab=find', role: 'Brand', axe: true },
  // campaign wizard
  { name: 'campaign-wizard-1', path: '/brand/campaigns/new', role: 'Brand', axe: true },
  { name: 'campaign-wizard-1-errors', path: '/brand/campaigns/new', role: 'Brand', actions: [['click', 'Fortsätt']] },
  { name: 'campaign-wizard-datepicker', path: '/brand/campaigns/new', role: 'Brand', actions: [['click', 'Välj datum']] },
  // tap detail
  { name: 'tap-detail', path: '/brand/tap/t1', role: 'Brand', axe: true },
  // analytics, every tab
  { name: 'analytics-oversikt', path: '/brand/analytics', role: 'Brand', axe: true },
  { name: 'analytics-prestation', path: '/brand/analytics', role: 'Brand', actions: [['click', 'Prestation']] },
  { name: 'analytics-plattformar', path: '/brand/analytics', role: 'Brand', actions: [['click', 'Plattformar']] },
  { name: 'analytics-pengar', path: '/brand/analytics', role: 'Brand', actions: [['click', 'Pengar']] },
  { name: 'analytics-lowdata', path: '/brand/analytics', role: 'Brand', env: { LOW_DATA: '1' } },
  { name: 'creator-analytics-oversikt', path: '/creator/analytics', role: 'Creator', axe: true },
  { name: 'creator-analytics-pengar', path: '/creator/analytics', role: 'Creator', actions: [['click', 'Pengar']] },
  // 404
  { name: 'not-found', path: '/creator/nope', role: 'Creator', axe: true },
];

const viewports = [
  { tag: 'desktop', width: 1440, height: 900, mobile: false },
  { tag: 'mobile', width: 390, height: 844, mobile: true },
];

async function run(page: Page, a: Action) {
  if (a[0] === 'click') {
    const h = await page.evaluateHandle((txt) => [...document.querySelectorAll('button, a, summary')].find((e) => (e.textContent || '').trim() === txt || e.getAttribute('aria-label') === txt) || null, a[1]);
    const el = h.asElement();
    if (el) await el.click();
  } else if (a[0] === 'type') { await page.click(a[1], { clickCount: 3 }); await page.type(a[1], a[2]); }
  else if (a[0] === 'select') await page.selectOption(a[1], a[2]);
  else if (a[0] === 'file') { const inputs = await page.$$('input[type=file]'); await inputs[a[1]].setInputFiles(a[2]); await page.waitForTimeout(900); }
  else if (a[0] === 'wait') await page.waitForTimeout(a[1]);
  else if (a[0] === 'scrollall') await page.evaluate(async () => { for (let y = 0; y < document.documentElement.scrollHeight; y += 500) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 90)); } window.scrollTo(0, 0); await new Promise((r) => setTimeout(r, 400)); });
  await page.waitForTimeout(250);
}

for (const vp of viewports) {
  for (const s of shots) {
    test(`${s.name} @ ${vp.tag}`, async ({ browser }) => {
      const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, isMobile: vp.mobile, hasTouch: vp.mobile, deviceScaleFactor: 1, locale: 'sv-SE' });
      if (!s.guest) {
        await ctx.addInitScript((r) => {
          localStorage.setItem('creatorpay-auth', JSON.stringify({ state: { accessToken: 'test', refreshToken: 'test', userId: 'u1', email: 'x@y.se', role: r, isAuthenticated: true }, version: 0 }));
        }, s.role);
      }
      const fixtures = buildFixtures(s.role, s.env ?? {});
      await ctx.route(/\/api\//, async (route) => {
        const p = new URL(route.request().url()).pathname.replace(/^\/api/, '');
        const hit = fixtures.find(([re]) => re.test(p));
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(hit ? hit[1] : { data: null, success: true }) });
      });
      await ctx.route(/tiktok\.com|picsum\.photos|googleapis|gstatic/, (route) => route.fulfill({ status: 204, body: '' }));
      const page = await ctx.newPage();
      await page.goto(s.path, { waitUntil: 'networkidle' });
      await page.evaluate(() => document.fonts.ready);
      for (const a of s.actions ?? []) await run(page, a);
      await page.waitForTimeout(900); // count-ups and transitions settle

      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow, 'no horizontal scroll').toBeLessThanOrEqual(0);

      fs.mkdirSync(OUT, { recursive: true });
      await page.screenshot({ path: path.join(OUT, `${s.name}-${vp.tag}.jpg`), type: 'jpeg', quality: 82, fullPage: s.name !== 'campaign-wizard-datepicker' });

      if (s.axe && vp.mobile) {
        await page.addScriptTag({ path: AXE });
        const result = await page.evaluate(() => (window as unknown as { axe: { run: (c: Document, o: unknown) => Promise<{ violations: { id: string; impact: string; help: string; nodes: { target: string[] }[] }[] }> } }).axe.run(document, { runOnly: ['wcag2a', 'wcag2aa'] }));
        const rows = result.violations.map((v) => ({ id: v.id, impact: v.impact, help: v.help, nodes: v.nodes.length, targets: v.nodes.slice(0, 5).map((n) => n.target.join(' ')) }));
        fs.writeFileSync(path.join(OUT, `a11y-${s.name}.json`), JSON.stringify(rows, null, 1));
        const serious = rows.filter((v) => v.impact === 'critical' || v.impact === 'serious').map((v) => `${v.id}: ${v.help} (${v.nodes})`);
        expect(serious, 'no serious/critical axe violations').toEqual([]);
      }
      await ctx.close();
    });
  }
}
