# Coppa del Lago — Tournament App Template

Ein wiederverwendbares Template für ein Golf-Turnier-Wochenende (4 Tage, 2 Teams, 16 Spieler) mit Live-Scoring, Match Play, Stableford-Rankings und Cup-Wertung.

---

## 1. Tech Stack

| Layer | Tool |
|---|---|
| Frontend | React 18 + Vite 5 + TypeScript 5 |
| Styling | Tailwind CSS v3 + shadcn/ui |
| Routing | React Router v6 |
| State | Zustand + React Query |
| Backend | Supabase (Postgres + RLS + Realtime) — via Lovable Cloud |
| Hosting | Lovable (`*.lovable.app`) oder eigener Vercel/Netlify Deploy |

---

## 2. Setup — Frontend

```bash
# 1. Entpacken & Dependencies
unzip bbot-golf-app.zip -d my-tournament
cd my-tournament
npm install         # oder: bun install

# 2. Dev-Server starten
npm run dev         # http://localhost:8080
```

### `.env` (wird von Lovable Cloud automatisch befüllt)
```
VITE_SUPABASE_URL=...
VITE_SUPABASE_PUBLISHABLE_KEY=...
VITE_SUPABASE_PROJECT_ID=...
```
Bei eigenem Supabase-Projekt: Werte aus *Project Settings → API* eintragen.

---

## 3. Setup — Backend (Datenbank)

Alle Tabellen liegen in `supabase/migrations/`. Bei **neuem Lovable-Projekt** mit Cloud aktiv werden sie automatisch migriert. Bei **eigenem Supabase**: Migrationen via Supabase CLI ausführen (`supabase db push`).

### Tabellen-Übersicht

| Tabelle | Zweck |
|---|---|
| `courses` | Platzdaten (Par, Slope, CR, SI, Längen pro Loch) — Single Source of Truth |
| `player_scores` | Pro Spieler/Tag: gross, net, stableford, holes_data (JSONB) |
| `match_results` | Cup-Punkte pro Match (Foursome, Scramble, Singles) |
| `car_entries` | Fahrgemeinschaften (Hin-/Rückfahrt, Passagiere) |
| `scores` | Legacy Key-Value-Buffer (kann ignoriert werden) |

### RLS-Policies
Aktuell **public read/write** (kein Login). Das Template setzt stattdessen auf ein einfaches **4-stelliges PIN-Gate** (`src/components/PinGate.tsx`, sessionStorage). Für strengere Setups: Supabase Auth aktivieren und Policies auf `auth.uid()` umstellen.

---

## 4. Anpassen für ein neues Turnier

### A) Spieler & Teams
**`src/data/tournament.ts`**
- `PLAYERS`: Name, slug, Index (HCP), Team (`rimpinzati` / `bastardi`)
- `TEAMS`: Teamnamen, Farben, Crest
- Tee-Times und Pairings pro Tag (Donnerstag–Sonntag)

### B) Plätze
1. App starten → `/admin/courses` (Passwort: `12345`)
2. Pro Platz eintragen: Name, Holes (9/18), Par, Slope, CR, Tee-Farbe, pro Loch (Par + SI + Meter)
3. Daten landen direkt in `courses`-Tabelle, alle Scorecards lesen live via `useCoursesStore`

### C) Spielformate (pro Tag)
**`src/data/tournament.ts` → `DAYS`**
- `format`: `"fourball"` | `"stableford"` | `"scramble"` | `"singles"`
- Stroke-Logik pro Format: `src/data/strokeFormulas.ts`
  - Fourball: 90% individueller CH
  - Stableford: 95% individueller CH
  - Scramble: `round((0.15·low + 0.15·high) × 0.9)` (Team)
  - Singles Match Play: 90% der CH-Differenz

### D) Match Play & Cup-Wertung
- `src/data/scrambleMatchPlay.ts` — hole-by-hole Net-Vergleich → "2&1", "AS", etc.
- `src/hooks/useLiveCupScore.ts` — aggregiert Cup-Punkte (4+8+4+8 = 24)
- `src/components/Tabellino.tsx` — Live-Scoreboard

### E) Branding
| Datei | Was |
|---|---|
| `src/index.css` | Farb-Tokens (HSL), Schriften |
| `tailwind.config.ts` | Theme Extension |
| `src/components/Home.tsx` | Cover-Page, Logo, Titel |
| `src/components/Navigation.tsx` | Nav-Labels (aktuell italienisch) |
| `src/components/Schedule.tsx` | Reise-Programm, Apéro, Dinner |
| `src/pages/Info.tsx` | Links zu Plätzen, Unterkunft |

### F) Lock-Flag
**`src/data/lock.ts`** → `ENTRIES_LOCKED`
- `false` während Turnier (Eingabe aktiv)
- `true` nach Turnier (Read-Only Archiv-Modus)

---

## 5. Wichtige Routen

| Route | Inhalt |
|---|---|
| `/` | Cover / Home |
| `/corsi` | Plätze + Tee-Times |
| `/casa` | Unterkunft |
| `/orario` | Reise- & Tagesprogramm |
| `/giocatori` | Spielerliste + Live-Rankings (Stableford, Total Strokes, Stats) |
| `/player/:slug` | Individuelle Scorecard |
| `/tabellino` | Live Cup-Scoreboard |
| `/info` | Externe Links, Anleitung |
| `/admin/courses` | Platz-Editor (PW: `12345`) |
| `/scoreboard` | Match-Result-Editor |

PIN-Gate für die ganze App: `1234` (anpassbar in `src/components/PinGate.tsx`).

---

## 6. Reset für neues Turnier

```sql
-- Alle Scores löschen (Schema bleibt)
DELETE FROM player_scores;
DELETE FROM match_results;
DELETE FROM car_entries;
-- courses behalten oder via /admin/courses neu befüllen
```

Danach in `src/data/tournament.ts` Spieler/Pairings tauschen — fertig.

---

## 7. Bekannte Konventionen

- **Visual Editing**: Statisches JSX, keine dynamischen Arrays für Text-Komponenten (sonst kann Lovable's Visual Editor sie nicht anfassen).
- **Sprache**: Italienische Nav-Labels, deutscher Body-Text.
- **Course Data**: Immer aus `useCoursesStore`, nie hartcodiert.
- **Stroke-Formeln**: Zentral in `src/data/strokeFormulas.ts`, getestet via `src/tests/suites.ts`.

---

Viel Spass beim nächsten Turnier! 🏌️‍♂️
