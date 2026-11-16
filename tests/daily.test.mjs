import { test } from 'node:test';
import assert from 'node:assert/strict';
import { run } from '../scripts/daily.mjs';
import { planBirthdayEmails, renderEmail } from '../scripts/emails.mjs';

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
    async drawWithGivers(side, year) {
      const d = draws.find((x) => x.side_id === side && x.year === year);
      const g = d ? pairs.filter((p) => p.draw_id === d.id).map((p) => p.giver_id) : [];
      return g.length ? { draw: d, giverIds: g } : null;
    },
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

test('a family set to adults only leaves children out of its draw', async () => {
  const data = mkData();
  data.people.push(P('eve'), P('fay'), P('kid2', { is_child: true, email: null, household_id: 'h-dan' }));
  data.personSides.push(...['eve', 'fay', 'kid2'].map((person_id) => ({ person_id, side_id: 'hb' })));
  data.sides = [{ id: 'hm', name: 'Side A' }, { id: 'hb', name: 'Side B', santa_kids: false }];
  const store = fakeStore(data);
  const s = await run({ store, mailer: mailer(), now: NOW('2026-11-01'), siteUrl: 'u', log() {} });
  const hb = store.draws.find((d) => d.side_id === 'hb');
  const hbPairs = store.pairs.filter((p) => p.draw_id === hb.id);
  assert.equal(s.draws.find((d) => d.side === 'hb').people, 4, 'ann, dan, eve, fay');
  assert.ok(hbPairs.every((p) => p.giver_id !== 'kid2' && p.recipient_id !== 'kid2'), 'kid2 neither gives nor receives');
  const hm = store.draws.find((d) => d.side_id === 'hm');
  assert.ok(store.pairs.some((p) => p.draw_id === hm.id && p.giver_id === 'kid'), 'the other family still includes its kid');
});

test('birthday email lists only ideas still free, at most 3, safely escaped, in the family colour', () => {
  const d = mkData();
  d.sides = [{ id: 'hm', name: 'Side A', accent: 'plum' }, { id: 'hb', name: 'Side B', accent: 'teal' }];
  const item = (id, o = {}) => ({ id, person_id: 'ann', title: id, url: null, image_url: null, price: null, priority: 0, created_at: '2026-10-01', archived_at: null, ...o });
  d.items = [item('i1', { title: 'Mug <b>& saucer</b>', price: 45 }), item('i2', { priority: 2 }), item('i3'), item('i4'), item('taken')];
  d.claims = [{ item_id: 'taken', state: 'bought', occasion_date: '2026-12-20' }, { item_id: 'i3', state: 'thinking', occasion_date: '2026-12-20' }];
  const mails = planBirthdayEmails({ ...d, today: '2026-11-15', siteUrl: 'https://x.test/app' });
  const toBob = mails.find((m) => m.to_email === 'bob@example.com' && m.dedupe_key.includes(':ann:'));
  assert.ok(toBob, 'bob gets a reminder about ann');
  assert.ok(!toBob.html.includes('>taken<'), 'a bought idea never shows');
  assert.ok(toBob.html.includes('Mug &lt;b&gt;&amp; saucer&lt;/b&gt;'), 'titles are escaped');
  assert.ok(toBob.html.indexOf('>i2<') < toBob.html.indexOf('Mug'), 'most wanted first');
  assert.match(toBob.html, /\+ 1 more on ann’s list/i, '4 free ideas: 3 shown + 1 more');
  assert.ok(toBob.html.includes('#8a3f8f'), 'Side A colour (plum)');
  assert.match(toBob.text_body, /4 ideas are still up for grabs/);
});

test('every email shares one layout with the family name, preview line and a working button', () => {
  const html = renderEmail({ siteUrl: 'https://x.test/app', side: { id: 'hb', name: 'Side <B>', accent: 'teal' }, preheader: 'Preview', title: 'Hi', button: { label: 'Go', url: 'https://x.test/app/hb/' } });
  assert.ok(html.includes('Side &lt;B&gt;') && html.includes('#0b7080') && html.includes('Preview') && html.includes('href="https://x.test/app/hb/"'));
  assert.ok(html.includes('https://x.test/app/icons/icon-192.png'));
});

test('a draw that already exists gets its "ready" emails queued once, including people who add an email later', async () => {
  const data = mkData();
  data.people.push(P('eve'), P('fay', { email: null }));
  data.personSides.push(...['eve', 'fay'].map((person_id) => ({ person_id, side_id: 'hb' })));
  const store = fakeStore(data);
  store.draws.push({ id: 'old', side_id: 'hb', year: 2026 });
  store.pairs.push(...[['ann', 'dan'], ['dan', 'eve'], ['eve', 'fay'], ['fay', 'ann']].map(([giver_id, recipient_id]) => ({ giver_id, recipient_id, draw_id: 'old' })));
  const m = mailer();
  await run({ store, mailer: m, now: NOW('2026-11-16'), siteUrl: 'u', log() {} });
  const santa = () => m.sent.filter((e) => e.kind === 'santa' && e.dedupe_key.startsWith('santa:old:')).map((e) => e.to_email).sort();
  assert.deepEqual(santa(), ['ann@example.com', 'dan@example.com', 'eve@example.com'], 'fay has no email yet');
  assert.ok(!m.sent.some((e) => /Test/.test(e.text_body) && e.kind === 'santa'), 'no names');
  await run({ store, mailer: m, now: NOW('2026-11-17'), siteUrl: 'u', log() {} });
  assert.equal(santa().length, 3, 'no repeats');
  data.people.find((p) => p.id === 'fay').email = 'fay@example.com';
  await run({ store, mailer: m, now: NOW('2026-11-18'), siteUrl: 'u', log() {} });
  assert.deepEqual(santa(), ['ann@example.com', 'dan@example.com', 'eve@example.com', 'fay@example.com']);
});
