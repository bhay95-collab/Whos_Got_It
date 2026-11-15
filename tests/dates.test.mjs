import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nextBirthday, nextChristmas, daysBetween, todayISO } from '../src/lib/dates.js';

test('todayISO uses the Brisbane clock', () => {
  // 15:00 UTC on 14 Nov is 01:00 on 15 Nov in Brisbane (UTC+10, no daylight saving)
  assert.equal(todayISO(new Date('2026-11-14T15:00:00Z')), '2026-11-15');
});
test('next birthday later this year', () => {
  const b = nextBirthday({ birth_month: 12, birth_day: 20, birth_year: 1960 }, '2026-11-15');
  assert.deepEqual(b, { iso: '2026-12-20', days: 35, turning: 66 });
});
test('birthday today counts as 0 days', () => {
  assert.equal(nextBirthday({ birth_month: 11, birth_day: 15 }, '2026-11-15').days, 0);
});
test('birthday already passed rolls to next year', () => {
  const b = nextBirthday({ birth_month: 3, birth_day: 12, birth_year: 1988 }, '2026-11-15');
  assert.equal(b.iso, '2027-03-12');
  assert.equal(b.turning, 39);
});
test('29 Feb falls back to 28 Feb in a normal year', () => {
  assert.equal(nextBirthday({ birth_month: 2, birth_day: 29 }, '2026-11-15').iso, '2027-02-28');
});
test('no birthday saved', () => {
  assert.equal(nextBirthday({}, '2026-11-15'), null);
});
test('christmas', () => {
  assert.equal(nextChristmas('2026-11-15').iso, '2026-12-25');
  assert.equal(nextChristmas('2026-12-26').iso, '2027-12-25');
  assert.equal(daysBetween('2026-12-25', '2027-12-25'), 365);
});
