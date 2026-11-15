import { test } from 'node:test';
import assert from 'node:assert/strict';
import { run } from '../scripts/daily.mjs';
import { planBirthdayEmails } from '../scripts/emails.mjs';

const P = (id, o = {}) => ({ id, full_name: `${id} Test`, active: true, is_child: false, is_admin: false, household_id: `h-${id}`, spouse_id: null, email: `${id}@example.com`, birth_month: null, birth_day: null, birth_year: null, ...o });
const mkData = () => ({
  people: [
    P('ann', { is_admin: true, birth_month: 12, birth_day: 20, birth_year: 1980 }),
    P('bob'), P('cat', { email: null }), P('dan'),
    P('kid', { is_child: true, email: null, birth_month: 12, birth_day: 21, household_id: 'h-ann' }),
  ],
  personSides: [['ann', 'hm'], ['bob', 'hm'], ['cat', 'hm'], ['kid', 'hm'], ['dan', 'hb'], ['ann', 'hb']].map(([person_id, side_id]) => ({ person_id, side_id })),
  sides: [{ id: 'hm', name: 'Side A' }, { id: 'hb', name: 'Side B' }],
  itemCounts: { ann: 1 },
});

function fakeStore(data) {
  const queue = new Map(); const draws = []; const pairs = [];
  return {
    draws, pairs,
    async keepAlive() {}, async archiveGiven() {},
    async loadAll() { return data; },
    async queue(emails) { let n = 0; for (const e of emails) if (!queue.has(e.dedupe_key)) { queue.set(e.dedupe_key, { ...e, id: e.dedupe_key, sent_at: null }); n++; } return n; },
    async drawExists(side, year) { return draws.some((d) => d.side_id === side && d.year === year); },
    async history() { return []; },
    async saveDraw(side_id, year, ps) { const d = { id: `d${draws.length}`, side_id, year }; draws.push(d); pairs.push(...ps.map((p) => ({ ...p, draw_id: d.id }))); return d; },
    async pending() { return [...queue.values()].filter((q) => !q.sent_at); },
    async markSent(id) { queue.get(id).sent_at = 'now'; }, async markError() {},
  };
}
const mailer = () => { const sent = []; return { sent, async send(m) { sent.push(m); } }; };
const NOW = (iso) => new Date(`${iso}T02:00:00Z`); // 12:00 Brisbane

test('birthday reminder goes to the right people, once', async () => {
  const store = fakeStore(mkData()); const m = mailer();
  await run({ store, mailer: m, now: NOW('2026-11-15'), siteUrl: 'https://x.test/app', log() {} });   // Ann: 35 days away
  const to = m.sent.filter((e) => e.kind === 'birthday').map((e) => e.to_email).sort();
  // Ann (35 days): bob (same side), dan (Ann is on both sides), plus Ann's own nudge (only 1 idea).
  // Kid (36 days): the adults on the kid's side with an email: ann, bob. Never cat (no email) or the kid.
  assert.deepEqual(to, ['ann@example.com', 'ann@example.com', 'bob@example.com', 'bob@example.com', 'dan@example.com']);
  assert.match(m.sent.find((e) => e.to_email === 'bob@example.com' && /ann/i.test(e.dedupe_key)).text_body, /https:\/\/x\.test\/app\/hm\/#\/p\/ann/);
  const again = mailer();
  await run({ store, mailer: again, now: NOW('2026-11-16'), siteUrl: 'https://x.test/app', log() {} });
  assert.equal(again.sent.filter((e) => e.kind === 'birthday').length, 0, 'no duplicates the next day');
});

test('no reminder more than 6 weeks out, and none on the day itself', () => {
  const d = mkData();
  assert.equal(planBirthdayEmails({ ...d, today: '2026-11-01', siteUrl: 'u' }).filter((e) => e.dedupe_key.includes('ann')).length, 0);   // 49 days
  assert.ok(planBirthdayEmails({ ...d, today: '2026-11-08', siteUrl: 'u' }).length > 0);                                                   // exactly 42
  assert.equal(planBirthdayEmails({ ...d, today: '2026-12-20', siteUrl: 'u' }).filter((e) => e.dedupe_key.includes(':ann:')).length, 0); // today
});

test('secret santa runs on 1 November, once per side, and emails givers without names', async () => {
  const data = mkData();
  data.people.push(P('eve'), P('fay'));
  data.personSides.push(...['eve', 'fay', 'dan'].map((person_id) => ({ person_id, side_id: 'hb' })).filter((x) => !(x.person_id === 'dan')), { person_id: 'eve', side_id: 'hm' }, { person_id: 'fay', side_id: 'hm' });
  const store = fakeStore(data); const m = mailer();
  const before = await run({ store, mailer: m, now: NOW('2026-10-31'), siteUrl: 'u', log() {} });
  assert.equal(before.draws.length, 0, 'not before 1 Nov');
  const s = await run({ store, mailer: m, now: NOW('2026-11-01'), siteUrl: 'https://x.test', log() {} });
  assert.ok(s.draws.length >= 1);
  const santa = m.sent.filter((e) => e.kind === 'santa');
  assert.ok(santa.length > 0);
  assert.ok(santa.every((e) => !/Test/.test(e.text_body)), 'no names in the email');
  const drawsNow = store.draws.length;
  await run({ store, mailer: mailer(), now: NOW('2026-11-02'), siteUrl: 'u', log() {} });
  assert.equal(store.draws.length, drawsNow, 'never draws twice');
});

test('a failed draw emails the admin instead of crashing', async () => {
  const data = mkData();   // hb side has only ann + dan: too few for a draw
  const store = fakeStore(data); const m = mailer();
  await run({ store, mailer: m, now: NOW('2026-11-01'), siteUrl: 'u', log() {} });
  assert.ok(m.sent.some((e) => e.kind === 'alert' && /failed/i.test(e.subject) && e.to_email === 'ann@example.com'));
});
