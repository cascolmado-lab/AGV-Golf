// Quick par-everywhere test fill — writes player_scores rows for all 16 players × 4 days.
// Net/stableford computed using the same formulas as the app.

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://tihqzqarykkxrwcwgrbu.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRpaHF6cWFyeWtreHJ3Y3dncmJ1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU5MDg4MDcsImV4cCI6MjA4MTQ4NDgwN30.Jz3NUpT8vDjdFfiyYjD8-SflN1zTCFsms5tZFB-eCaU";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ── Players (mirrors src/data/tournament.ts) ────────────────
const TEAM_A = [
  { name: "Dario", hcp: 7.5 },
  { name: "Lino", hcp: 24.2 },
  { name: "Marc", hcp: 25 },
  { name: "Titus", hcp: 39 },
  { name: "Elliot", hcp: 40.5 },
  { name: "Alexandre", hcp: 45 },
  { name: "Merlin", hcp: 45 },
  { name: "Max", hcp: 45 },
];
const TEAM_B = [
  { name: "Loris", hcp: 13 },
  { name: "Finley", hcp: 16.5 },
  { name: "Gian", hcp: 27.5 },
  { name: "Kerem", hcp: 33 },
  { name: "Victor", hcp: 45 },
  { name: "Oliver J.", hcp: 45 },
  { name: "Oliver O.", hcp: 45 },
  { name: "Tobias", hcp: 45 },
];

function slug(name: string): string {
  return name.toLowerCase().replace(/\./g, "").trim().replace(/\s+/g, "-");
}

const DAY_TO_COURSE: Record<string, string> = {
  giovedi: "franciacorta",
  venerdi: "arzaga",
  sabato: "verona",
  domenica: "garda",
};

// ── Stroke / Stableford math (mirrors src/data/strokeFormulas.ts) ────
function courseHcp(playerIndex: number, course: any): number {
  const idx = course.holes === 9 ? playerIndex / 2 : playerIndex;
  return Math.round(idx * (course.slope / 113) + (Number(course.cr) - course.par_total));
}
function distributeStrokes(n: number, holes: any[]): number[] {
  const total = holes.length;
  if (n <= 0 || total === 0) return holes.map(() => 0);
  const fullPasses = Math.floor(n / total);
  const remainder = n % total;
  return holes.map((h) => fullPasses + (h.si <= remainder ? 1 : 0));
}
function stablefordPoints(gross: number, par: number, sr: number): number {
  if (!Number.isFinite(gross) || gross <= 0) return 0;
  const net = gross - sr;
  return Math.max(0, 2 + (par - net));
}

async function run() {
  const { data: courses, error } = await supabase
    .from("courses")
    .select("id,name,holes,par_total,slope,cr,holes_data");
  if (error || !courses) throw error;
  const cMap: Record<string, any> = {};
  for (const c of courses) cMap[c.id] = c;

  const allPlayers = [...TEAM_A, ...TEAM_B];
  const days = ["giovedi", "venerdi", "sabato", "domenica"];
  const rows: any[] = [];

  for (const dayId of days) {
    const course = cMap[DAY_TO_COURSE[dayId]];
    if (!course) { console.warn("missing course", dayId); continue; }
    const holes: any[] = course.holes_data;

    for (const p of allPlayers) {
      // PAR everywhere.
      const grossPerHole = holes.map((h) => h.par);
      const grossTotal = grossPerHole.reduce((a, b) => a + b, 0);

      const cHcp = Math.max(0, courseHcp(p.hcp, course));
      const sr = distributeStrokes(cHcp, holes);
      const totalSr = sr.reduce((a, b) => a + b, 0);
      const netTotal = grossTotal - totalSr;

      let stab = 0;
      const holesData = holes.map((h, i) => {
        const pts = stablefordPoints(grossPerHole[i], h.par, sr[i]);
        stab += pts;
        return {
          hole: h.hole,
          par: h.par,
          si: h.si,
          gross: grossPerHole[i],
          strokes_received: sr[i],
          net: grossPerHole[i] - sr[i],
          stableford: pts,
        };
      });

      rows.push({
        player_slug: slug(p.name),
        day_id: dayId,
        gross: String(grossTotal),
        net: String(netTotal),
        stableford: String(stab),
        holes_data: holesData,
        notes: `||H:${grossPerHole.join(",")}`,
      });
    }
  }

  console.log(`Prepared ${rows.length} rows. Wiping + inserting…`);

  // Wipe existing rows for the days we're testing
  // (We only have insert/select via anon; we need to upsert. There is no unique key on (player_slug, day_id) that we know of.)
  // Strategy: select existing rows then for each, update by id. Otherwise insert.
  const { data: existing } = await supabase
    .from("player_scores")
    .select("id, player_slug, day_id");
  const existingMap = new Map<string, string>();
  (existing || []).forEach((r: any) => existingMap.set(`${r.player_slug}|${r.day_id}`, r.id));

  let updated = 0, inserted = 0;
  for (const row of rows) {
    const key = `${row.player_slug}|${row.day_id}`;
    const existingId = existingMap.get(key);
    if (existingId) {
      const { error: upErr } = await supabase
        .from("player_scores")
        .update({
          gross: row.gross,
          net: row.net,
          stableford: row.stableford,
          holes_data: row.holes_data,
          notes: row.notes,
        })
        .eq("id", existingId);
      if (upErr) console.error("update err", row.player_slug, row.day_id, upErr.message);
      else updated++;
    } else {
      const { error: insErr } = await supabase
        .from("player_scores")
        .insert(row);
      if (insErr) console.error("insert err", row.player_slug, row.day_id, insErr.message);
      else inserted++;
    }
  }

  console.log(`Done. Updated: ${updated}, Inserted: ${inserted}`);
}

run().catch((e) => { console.error(e); process.exit(1); });
