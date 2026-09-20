/**
 * Design-system preview (Phase 3). Public route at /design.
 * Renders every token and component with realistic VYRLE content so the
 * system can be judged at 375 px before any screen is rebuilt.
 */
import { useState } from 'react';
import { Home, Briefcase, Plus, MessageCircle, User, Bell, Search, SlidersHorizontal, Inbox, MoreHorizontal, Wallet, BarChart3, Bookmark, Settings, LogOut, Video, Upload, Image } from 'lucide-react';
import {
  Page, PageHead, Section, Card, Button, IconButton, StickyAction,
  StatTile, StatRow, List, ListRow, Avatar, Badge, Count, Chip, Chips,
  SegmentedControl, Field, Checkbox, Meter, EmptyState,
  Skeleton, SkeletonList, SkeletonStats, BottomSheet, SheetMenu, TabBar,
} from '@/components/ds';

const swatches: [string, string, string][] = [
  ['bg', '--ds-bg', 'Page surface'],
  ['card', '--ds-card', 'Cards, bars'],
  ['line', '--ds-line', 'Dividers'],
  ['line-strong', '--ds-line-strong', 'Inputs'],
  ['ink', '--ds-ink', 'Text'],
  ['ink-2', '--ds-ink-2', 'Secondary text'],
  ['ink-3', '--ds-ink-3', 'Placeholder only'],
  ['accent', '--ds-accent', 'Primary actions, links, active'],
  ['accent-soft', '--ds-accent-soft', 'Active tint'],
  ['ok', '--ds-ok', 'Status: positive'],
  ['warn', '--ds-warn', 'Status: pending'],
  ['bad', '--ds-bad', 'Status: negative'],
];

export function DesignPreviewPage() {
  const [seg, setSeg] = useState<'mine' | 'discover'>('mine');
  const [chip, setChip] = useState('Alla');
  const [sheet, setSheet] = useState<null | 'menu' | 'form'>(null);
  const [tab, setTab] = useState('home');

  const tabs = [
    { key: 'home', label: 'Hem', icon: <Home />, to: '#home', dot: true },
    { key: 'work', label: 'Kampanjer', icon: <Briefcase />, to: '#work' },
    { key: 'msg', label: 'Meddelanden', icon: <MessageCircle />, to: '#msg', badge: 3 },
    { key: 'me', label: 'Profil', icon: <User />, to: '#me' },
  ];

  return (
    <div className="ds-root" onClick={(e) => { const a = (e.target as HTMLElement).closest('a[href^="#"]'); if (a) { e.preventDefault(); setTab(a.getAttribute('href')!.slice(1)); } }}>
      <Page>
        <PageHead title="Designsystem" actions={<><IconButton label="Sök"><Search /></IconButton><IconButton label="Notiser" badge={2}><Bell /></IconButton></>} />
        <p className="ds-body ds-muted">En font (Inter), fyra storlekar, en accentfärg, 8-punktsraster. Allt nedan är byggt av samma komponenter som skärmarna i fas 4.</p>

        {/* ── Tokens ── */}
        <Section title="Färger">
          <Card>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(96px, 1fr))', gap: 12 }}>
              {swatches.map(([name, v, use]) => (
                <div key={name}>
                  <div style={{ height: 40, borderRadius: 8, background: `var(${v})`, border: '1px solid var(--ds-line)' }} />
                  <div className="ds-caption" style={{ marginTop: 6 }}>{name}</div>
                  <div className="ds-caption ds-muted" style={{ fontWeight: 400 }}>{use}</div>
                </div>
              ))}
            </div>
          </Card>
        </Section>

        <Section title="Typografi">
          <Card>
            <div className="ds-stack" style={{ gap: 12 }}>
              <div><div className="ds-title">Title 24 / 700</div><div className="ds-caption ds-muted">Sidrubriker, stora tal</div></div>
              <div><div className="ds-heading">Heading 17 / 600</div><div className="ds-caption ds-muted">Sektioner, listtitlar, knappar</div></div>
              <div><div className="ds-body">Body 15 / 400 — Löpande ersättning från företag vars community du är med i.</div><div className="ds-caption ds-muted">Brödtext, formulär</div></div>
              <div><div className="ds-caption ds-muted">Caption 12 / 500 — Tilldelad 12 sep · 18 400 views</div><div className="ds-caption ds-muted" style={{ fontWeight: 400 }}>Meta, etiketter, flikar</div></div>
              <div className="ds-row" style={{ gap: 16 }}>
                <span className="ds-title ds-num">1 234 567</span>
                <span className="ds-title ds-num">9 876 543</span>
              </div>
              <div className="ds-caption ds-muted" style={{ fontWeight: 400 }}>Tabulära siffror: kolumnerna ovan är lika breda.</div>
            </div>
          </Card>
        </Section>

        <Section title="Avstånd">
          <Card>
            <div className="ds-row ds-row--wrap" style={{ alignItems: 'flex-end', gap: 12 }}>
              {[4, 8, 12, 16, 24, 32].map((n) => (
                <div key={n} style={{ textAlign: 'center' }}>
                  <div style={{ width: n, height: n, background: 'var(--ds-accent-soft)', border: '1px solid var(--ds-accent)', borderRadius: 2, margin: '0 auto' }} />
                  <div className="ds-caption ds-muted" style={{ marginTop: 6 }}>{n}</div>
                </div>
              ))}
              <div className="ds-caption ds-muted" style={{ fontWeight: 400, marginLeft: 'auto' }}>Sidmarginal 16 · Touch 44</div>
            </div>
          </Card>
        </Section>

        {/* ── Buttons ── */}
        <Section title="Button">
          <Card>
            <div className="ds-stack" style={{ gap: 12 }}>
              <Button full>Begär utbetalning</Button>
              <div className="ds-row ds-row--wrap"><Button variant="secondary">Avbryt</Button><Button variant="ghost">Visa alla</Button><Button variant="secondary" danger>Ta bort</Button></div>
              <div className="ds-row ds-row--wrap"><Button size="sm">Godkänn</Button><Button size="sm" variant="secondary">Neka</Button><Button size="sm" variant="ghost" icon={<Plus />}>Lägg till</Button><Button disabled>Fullbokad</Button></div>
              <div className="ds-row ds-row--wrap"><IconButton label="Mer"><MoreHorizontal /></IconButton><IconButton label="Filter" boxed><SlidersHorizontal /></IconButton><IconButton label="Notiser" badge={12}><Bell /></IconButton><span className="ds-caption ds-muted" style={{ fontWeight: 400 }}>IconButton 44×44</span></div>
            </div>
          </Card>
        </Section>

        {/* ── Stats ── */}
        <Section title="StatTile" action={<Button variant="ghost" size="sm">Statistik</Button>}>
          <StatRow cols={3}>
            <StatTile label="Intjänat" value="12 340 kr" />
            <StatTile label="Verifierade views" value="184 200" />
            <StatTile label="Att hämta ut" value="1 240 kr" accent />
          </StatRow>
          <Card>
            <StatRow cols={3}>
              <StatTile plain label="Följare" value="24 100" />
              <StatTile plain label="Views" value="1,2M" />
              <StatTile plain label="Omdöme" value="4,8" hint="12 omdömen" />
            </StatRow>
          </Card>
        </Section>

        {/* ── Segmented + chips ── */}
        <Section title="SegmentedControl & Chip">
          <SegmentedControl segments={[{ key: 'mine', label: 'Mina', count: 2 }, { key: 'discover', label: 'Upptäck' }]} value={seg} onChange={setSeg} />
          <Chips>
            {['Alla', 'Kampanjer', 'Kranar', 'Videouppdrag', 'Sparade'].map((c) => <Chip key={c} selected={chip === c} onClick={() => setChip(c)}>{c}</Chip>)}
          </Chips>
        </Section>

        {/* ── List rows ── */}
        <Section title="ListRow" action={<Button variant="ghost" size="sm">Visa alla</Button>}>
          <List>
            <ListRow leading={<Avatar name="Nellie" />} title="Nellie Creators" badge={<Badge tone="ok">Öppen</Badge>} subtitle="Kran · 25 kr / 1 000 views" value="620 kr" onClick={() => {}} />
            <ListRow leading={<Avatar name="Sommarkampanj" rounded />} title="Sommarkampanj 2026" badge={<Badge tone="warn">Väntar på video</Badge>} subtitle="Café X · slutar om 4 dagar" value="18 400" onClick={() => {}} />
            <ListRow leading={<Avatar name="Lunchdeal" src={undefined} rounded />} title="Lunchdeal-video" badge={<Badge tone="accent">Din tur</Badge>} subtitle="Videouppdrag · 1 500 kr · leverans senast 24 sep" onClick={() => {}} />
            <ListRow leading={<Avatar name="Höst" rounded />} title="Höstkollektion" badge={<Badge>Avslutad</Badge>} subtitle="Tilldelad 2 aug · 9 100 views" value="450 kr" />
          </List>
          <List>
            <ListRow leading={<Wallet />} title="Intäkter" subtitle="1 240 kr att hämta ut" to="#me" />
            <ListRow leading={<BarChart3 />} title="Statistik" to="#me" />
            <ListRow leading={<Bookmark />} title="Sparat" trailing={<Count n={4} />} to="#me" />
            <ListRow leading={<Settings />} title="Inställningar" to="#me" />
            <ListRow leading={<LogOut />} title="Logga ut" chevron={false} onClick={() => {}} />
          </List>
        </Section>

        {/* ── Avatars & badges ── */}
        <Section title="Avatar & Badge">
          <Card>
            <div className="ds-row" style={{ gap: 12, flexWrap: 'wrap' }}>
              <Avatar name="Anna" size="sm" /><Avatar name="Brand" size="md" rounded /><Avatar name="Creator" size="lg" /><Avatar name="X" size="xl" rounded />
            </div>
            <div className="ds-row" style={{ gap: 8, flexWrap: 'wrap', marginTop: 16 }}>
              <Badge tone="ok">Godkänd</Badge><Badge tone="warn">Väntar</Badge><Badge tone="bad">Nekad</Badge><Badge>Utkast</Badge><Badge tone="accent">Kran</Badge><Count n={7} /><Count n={120} /><span className="ds-dot" />
            </div>
          </Card>
        </Section>

        {/* ── Meter ── */}
        <Section title="Meter">
          <Card>
            <div className="ds-stack" style={{ gap: 16 }}>
              <Meter value={6200} max={10000} left="6 200 kr av 10 000 kr" right="62 %" />
              <Meter value={10000} max={10000} tone="bad" left="Månadsbudgeten är slut" right="100 %" />
              <Meter value={3} max={4} tone="ok" left="3 av 4 videor godkända" />
            </div>
          </Card>
        </Section>

        {/* ── Fields ── */}
        <Section title="Field">
          <Card>
            <div className="ds-stack" style={{ gap: 16 }}>
              <div className="ds-search"><Search /><input className="ds-input" placeholder="Sök kampanjer, varumärken…" /></div>
              <Field label="Kampanjnamn" hint="Syns för creators i Upptäck"><input placeholder="t.ex. Sommarkampanj" /></Field>
              <Field label="Pris per 1 000 views" error="Minst 20 kr"><input inputMode="numeric" defaultValue="15" /></Field>
              <Field label="Kategori"><select defaultValue="Mat"><option>Mat</option><option>Mode</option><option>Skönhet</option></select></Field>
              <Field label="Brief"><textarea placeholder="Vad ska videon åstadkomma?" /></Field>
              <Checkbox label="Öppen för direkta PR-erbjudanden" defaultChecked />
            </div>
          </Card>
        </Section>

        {/* ── Empty & skeleton ── */}
        <Section title="EmptyState">
          <Card>
            <EmptyState icon={<Inbox />} title="Inga uppdrag än" description="Ansök till kampanjer så dyker ditt första uppdrag upp här." action={<Button>Upptäck kampanjer</Button>} />
          </Card>
        </Section>
        <Section title="Skeleton">
          <SkeletonStats n={3} />
          <SkeletonList rows={2} />
          <Card><Skeleton w="45%" h={24} /><div style={{ height: 8 }} /><Skeleton w="80%" /><div style={{ height: 6 }} /><Skeleton w="65%" /></Card>
        </Section>

        {/* ── Sheets ── */}
        <Section title="BottomSheet">
          <div className="ds-row ds-row--wrap">
            <Button variant="secondary" onClick={() => setSheet('menu')} icon={<MoreHorizontal />}>Meny-sheet</Button>
            <Button variant="secondary" onClick={() => setSheet('form')}>Formulär-sheet</Button>
          </div>
        </Section>

        <StickyAction><Button full icon={<Plus />}>Primär åtgärd (sticky)</Button></StickyAction>
      </Page>

      <TabBar items={tabs} current={tab} action={{ label: 'Lägg till', icon: <Plus />, onClick: () => setSheet('menu') }} brand={<span>VYRLE</span>} />

      <BottomSheet open={sheet === 'menu'} onClose={() => setSheet(null)} title="Lägg till">
        <SheetMenu>
          <ListRow leading={<Video />} title="Lägg till video" subtitle="Till en aktiv kampanj eller kran" onClick={() => setSheet(null)} />
          <ListRow leading={<Upload />} title="Leverera videouppdrag" subtitle="Lunchdeal-video · senast 24 sep" onClick={() => setSheet(null)} />
          <ListRow leading={<Image />} title="Lägg till i portfolio" onClick={() => setSheet(null)} />
        </SheetMenu>
      </BottomSheet>

      <BottomSheet open={sheet === 'form'} onClose={() => setSheet(null)} title="Ansök till Sommarkampanj 2026"
        footer={<><Button variant="secondary" onClick={() => setSheet(null)}>Avbryt</Button><Button onClick={() => setSheet(null)}>Skicka ansökan</Button></>}>
        <p className="ds-body ds-muted">Café X · Det du skriver här är det första företaget läser om dig.</p>
        <Field label="Varför passar just du?" hint="Minst 10 tecken"><textarea rows={4} placeholder="Berätta kort vad du skapar och vem som följer dig…" /></Field>
      </BottomSheet>
    </div>
  );
}
