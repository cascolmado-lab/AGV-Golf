// Simulation: fill a given day with random gross 3-8 for all 16 players.
// Usage: bun scripts/sim_day.ts <dayId> <courseId>
//   bun scripts/sim_day.ts venerdi arzaga
//   bun scripts/sim_day.ts sabato  verona
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://tihqzqarykkxrwcwgrbu.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRpaHF6cWFyeWtreHJ3Y3dncmJ1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU5MDg4MDcsImV4cCI6MjA4MTQ4NDgwN30.Jz3NUpT8vDjdFfiyYjD8-SflN1zTCFsms5tZFB-eCaU";
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const TEAM_A = [
  { name: "Dario", hcp: 7.5 }, { name: "Lino", hcp: 24.2 }, { name: "Marc", hcp: 25 },
  { name: "Titus", hcp: 39 }, { name: "Elliot", hcp: 40.5 }, { name: "Alexandre", hcp: 45 },
  { name: "Merlin", hcp: 45 }, { name: "Max", hcp: 45 },
];
const TEAM_B = [
  { name: "Loris", hcp: 13 }, { name: "Finley", hcp: 16.5 }, { name: "Gian", hcp: 27.5 },
  { name: "Kerem", hcp: 33 }, { name: "Victor", hcp: 45 }, { name: "Oliver J.", hcp: 45 },
  { name: "Oliver O.", hcp: 45 }, { name: "Tobias", hcp: 45 },
];

const slug = (n: string) => n.toLowerCase().replace(/\./g, "").trim().replace(/\s+/g, "-");
const rand38 = () => 3 + Math.floor(Math.random() * 6);

function courseHcp(idx: number, c: any): number {
  const i = c.holes === 9 ? idx / 2 : idx;
  return Math.round(i * (c.slope / 113) + (Number(c.cr) - c.par_total));
}
function distribute(n: number, holes: any[]): number[] {
  const t = holes.length; if (n <= 0) return holes.map(() => 0);
  const full = Math.floor(n / t), rem = n % t;
  return holes.map((h) => full + (h.si <= rem ? 1 : 0));
}
function stab(g: number, par: number, sr: number): number {
  if (!Number.isFinite(g) || g <= 0) return 0;
  return Math.max(0, 2 + (par - (g - sr)));
}

async function run() {
  const dayId = process.argv[2];
  const courseId = process.argv[3];
  if (!dayId || !courseId) { console.error("Usage: sim_day.ts <dayId> <courseId>"); process.exit(1); }

  const { data: courseRow, error: cErr } = await supabase
    .from("courses").select("id,holes,par_total,slope,cr,holes_data").eq("id", courseId).single();
  if (cErr || !courseRow) throw new Error(`Course ${courseId} not found: ${cErr?.message}`);
  const course: any = courseRow;
  const holes: any[] = course.holes_data;
  console.log(`Course ${courseId}: ${course.holes}H par ${course.par_total} slope ${course.slope} CR ${course.cr}`);

  const players = [...TEAM_A, ...TEAM_B];

  const { data: existing } = await supabase
    .from("player_scores").select("id, player_slug, day_id").eq("day_id", dayId);
  const existingMap = new Map<string, string>();
  (existing || []).forEach((r: any) => existingMap.set(r.player_slug, r.id));

  let updated = 0, inserted = 0;
  for (const p of players) {
    const grossPerHole = holes.map(() => rand38());
    const grossTotal = grossPerHole.reduce((a, b) => a + b, 0);
    const cHcp = Math.max(0, courseHcp(p.hcp, course));
    const sr = distribute(cHcp, holes);
    const totalSr = sr.reduce((a, b) => a + b, 0);
    const netTotal = grossTotal - totalSr;
    let stabTot = 0;
    const holesData = holes.map((h, i) => {
      const pts = stab(grossPerHole[i], h.par, sr[i]);
      stabTot += pts;
      return { hole: h.hole, par: h.par, si: h.si, gross: grossPerHole[i],
        strokes_received: sr[i], net: grossPerHole[i] - sr[i], stableford: pts };
    });

    const row = {
      player_slug: slug(p.name), day_id: dayId,
      gross: String(grossTotal), net: String(netTotal), stableford: String(stabTot),
      holes_data: holesData, notes: `||H:${grossPerHole.join(",")}`,
    };
    const id = existingMap.get(row.player_slug);
    if (id) {
      const { error } = await supabase.from("player_scores").update(row).eq("id", id);
      if (error) console.error("upd", p.name, error.message); else updated++;
    } else {
      const { error } = await supabase.from("player_scores").insert(row);
      if (error) console.error("ins", p.name, error.message); else inserted++;
    }
    console.log(`${p.name.padEnd(12)} HCP ${p.hcp}  CHcp ${cHcp}  G ${grossTotal}  N ${netTotal}  Stab ${stabTot}`);
  }
  console.log(`\nDone. Updated ${updated}, Inserted ${inserted}`);
}
run().catch((e) => { console.error(e); process.exit(1); });
