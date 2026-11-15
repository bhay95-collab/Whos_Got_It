// Secret Santa draw engine. Pure functions, no I/O, so it is easy to test.
//
// Rules (hard):   never yourself · never your partner · a child never draws someone in their own household
//                 · never the person you had last time
// Fairness (soft): pick the combination where people buy for those they have had LEAST often;
//                  ties go to whoever was longest ago, then random.
// This is a minimum-cost assignment problem, solved exactly with the Hungarian algorithm.

const BIG = 1e9;

/** Hungarian algorithm: returns assignment[row] = column minimising total cost. */
export function assign(cost) {
  const n = cost.length;
  const u = Array(n + 1).fill(0), v = Array(n + 1).fill(0), p = Array(n + 1).fill(0), way = Array(n + 1).fill(0);
  for (let i = 1; i <= n; i++) {
    p[0] = i;
    let j0 = 0;
    const minv = Array(n + 1).fill(Infinity), used = Array(n + 1).fill(false);
    do {
      used[j0] = true;
      const i0 = p[j0];
      let delta = Infinity, j1 = 0;
      for (let j = 1; j <= n; j++) {
        if (used[j]) continue;
        const cur = cost[i0 - 1][j - 1] - u[i0] - v[j];
        if (cur < minv[j]) { minv[j] = cur; way[j] = j0; }
        if (minv[j] < delta) { delta = minv[j]; j1 = j; }
      }
      for (let j = 0; j <= n; j++) {
        if (used[j]) { u[p[j]] += delta; v[j] -= delta; } else minv[j] -= delta;
      }
      j0 = j1;
    } while (p[j0] !== 0);
    do { const j1 = way[j0]; p[j0] = p[j1]; j0 = j1; } while (j0);
  }
  const res = Array(n).fill(-1);
  for (let j = 1; j <= n; j++) res[p[j] - 1] = j - 1;
  return res;
}

/** Is giver g allowed to draw r at all (rules that are never relaxed)? */
export function allowed(g, r) {
  if (g.id === r.id) return false;
  if (g.spouse_id && g.spouse_id === r.id) return false;
  if (r.spouse_id && r.spouse_id === g.id) return false;
  if (g.is_child && g.household_id && g.household_id === r.household_id) return false;
  return true;
}

/**
 * @param people   [{id, spouse_id, household_id, is_child}]  everyone on this side
 * @param history  [{giver_id, recipient_id, year}]            earlier draws for this side
 * @param year     the year being drawn
 * @param rng      () => [0,1)
 * @returns {{pairs:[{giver_id,recipient_id}], relaxedLastYear:boolean}}
 */
export function drawSanta({ people, history = [], year, rng = Math.random }) {
  const n = people.length;
  if (n < 3) throw new Error('Need at least 3 people for a draw');
  const past = history.filter((h) => h.year < year);
  const count = new Map(), last = new Map();
  for (const h of past) {
    const k = `${h.giver_id}>${h.recipient_id}`;
    count.set(k, (count.get(k) || 0) + 1);
    last.set(k, Math.max(last.get(k) || 0, h.year));
  }
  // most recent prior pick of each giver = "last year's person"
  const lastPick = new Map();
  for (const h of past) {
    const cur = lastPick.get(h.giver_id);
    if (!cur || h.year > cur.year) lastPick.set(h.giver_id, h);
  }

  const build = (forbidLast) =>
    people.map((g) => people.map((r) => {
      if (!allowed(g, r)) return BIG;
      if (forbidLast && lastPick.get(g.id)?.recipient_id === r.id) return BIG;
      const k = `${g.id}>${r.id}`;
      const c = count.get(k) || 0;
      const ago = last.has(k) ? year - last.get(k) : null;
      const recency = ago == null ? 0 : Math.max(0, 30 - ago) * 10;   // had them recently -> worse
      return c * c * 1000 + recency + rng() * 9;
    }));

  for (const [forbidLast, relaxedLastYear] of [[true, false], [false, true]]) {
    const cost = build(forbidLast);
    const a = assign(cost);
    if (a.every((j, i) => cost[i][j] < BIG)) {
      return { pairs: a.map((j, i) => ({ giver_id: people[i].id, recipient_id: people[j].id })), relaxedLastYear };
    }
  }
  throw new Error('No valid draw exists with these people and rules (check partners / households).');
}
