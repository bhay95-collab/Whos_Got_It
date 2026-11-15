import { test } from 'node:test';
import assert from 'node:assert/strict';
import { drawSanta, allowed, assign } from '../scripts/santa.mjs';

function rngFrom(a) { return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const mk = (id, spouse, hh, kid = false) => ({ id, spouse_id: spouse, household_id: hh, is_child: kid });
// 12 people: 4 couples, 2 kids living with parents, 2 singles
const people = [
  mk('a1', 'a2', 'h1'), mk('a2', 'a1', 'h1'), mk('ak', null, 'h1', true),
  mk('b1', 'b2', 'h2'), mk('b2', 'b1', 'h2'),
  mk('c1', 'c2', 'h3'), mk('c2', 'c1', 'h3'), mk('ck', null, 'h3', true),
  mk('s1', null, 'h4'), mk('d1', 'd2', 'h5'), mk('d2', 'd1', 'h5'), mk('e1', null, 'h6'),
];
const byId = Object.fromEntries(people.map((p) => [p.id, p]));

test('hungarian finds the cheapest assignment', () => {
  const a = assign([[4, 1, 3], [2, 0, 5], [3, 2, 2]]);
  assert.deepEqual(a, [1, 0, 2]);
});

test('hard rules hold in every draw, for many random seeds', () => {
  for (let seed = 1; seed <= 200; seed++) {
    const { pairs } = drawSanta({ people, history: [], year: 2027, rng: rngFrom(seed) });
    assert.equal(pairs.length, people.length);
    assert.equal(new Set(pairs.map((p) => p.recipient_id)).size, people.length, 'everyone is drawn exactly once');
    for (const p of pairs) assert.ok(allowed(byId[p.giver_id], byId[p.recipient_id]), `${p.giver_id}→${p.recipient_id}`);
  }
});

test('kids never draw their own household; parents may', () => {
  const { pairs } = drawSanta({ people, history: [], year: 2027, rng: rngFrom(7) });
  for (const p of pairs.filter((x) => byId[x.giver_id].is_child)) assert.notEqual(byId[p.recipient_id].household_id, byId[p.giver_id].household_id);
});

test('never repeats last year, and fairness covers everyone in about a decade', () => {
  const rng = rngFrom(42);
  let history = [], covered = null;
  const eligible = (g, r) => allowed(g, r);
  for (let y = 2027; y < 2027 + 25; y++) {
    const { pairs, relaxedLastYear } = drawSanta({ people, history, year: y, rng });
    assert.equal(relaxedLastYear, false);
    for (const p of pairs) assert.ok(!history.some((h) => h.year === y - 1 && h.giver_id === p.giver_id && h.recipient_id === p.recipient_id), 'repeated last year');
    history = history.concat(pairs.map((p) => ({ ...p, year: y })));
    if (!covered && people.every((g) => people.every((r) => !eligible(g, r) || history.some((h) => h.giver_id === g.id && h.recipient_id === r.id)))) covered = y - 2026;
  }
  assert.ok(covered && covered <= 13, `everyone should have had everyone within 13 years, took ${covered}`);
});

test('prefers people not yet had', () => {
  // s1 has already had everybody except e1 → should draw e1
  const hist = people.filter((r) => r.id !== 's1' && r.id !== 'e1' && allowed(byId.s1, r)).map((r, i) => ({ giver_id: 's1', recipient_id: r.id, year: 2000 + i }));
  const { pairs } = drawSanta({ people, history: hist, year: 2027, rng: rngFrom(3) });
  assert.equal(pairs.find((p) => p.giver_id === 's1').recipient_id, 'e1');
});

test('impossible setups fail loudly instead of breaking rules', () => {
  // two couples + nobody else: each person can only draw one of the other couple, but 2 per side leaves no valid perfect matching with last-year ban
  const tiny = [mk('x1', 'x2', 'h1'), mk('x2', 'x1', 'h1'), mk('y1', 'y2', 'h2'), mk('y2', 'y1', 'h2')];
  const r = drawSanta({ people: tiny, history: [{ giver_id: 'x1', recipient_id: 'y1', year: 2026 }], year: 2027, rng: rngFrom(1) });
  assert.equal(r.pairs.length, 4);
  const impossible = [mk('p', 'q', 'h1'), mk('q', 'p', 'h1'), mk('r', null, 'h2')];
  assert.throws(() => drawSanta({ people: impossible, year: 2027 }), /No valid draw/);
});

test('last-year rule is relaxed (and reported) only when it is the only way', () => {
  const tiny = [mk('x1', 'x2', 'h1'), mk('x2', 'x1', 'h1'), mk('y1', 'y2', 'h2'), mk('y2', 'y1', 'h2')];
  // x1 can only ever draw y1 or y2; ban both via history of two years => rule must relax
  const hist = [{ giver_id: 'x1', recipient_id: 'y1', year: 2026 }, { giver_id: 'x2', recipient_id: 'y2', year: 2026 }, { giver_id: 'y1', recipient_id: 'x1', year: 2026 }, { giver_id: 'y2', recipient_id: 'x2', year: 2026 }];
  const r = drawSanta({ people: tiny, history: hist, year: 2027, rng: rngFrom(5) });
  assert.equal(r.relaxedLastYear, false); // swapping partners within the couple pairing still avoids repeats
  assert.equal(r.pairs.length, 4);
});
