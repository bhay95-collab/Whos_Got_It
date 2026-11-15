import { supabase } from './supabase.js';
import { LOGIN_DOMAIN } from '../config.js';

const fail = (error) => { if (error) throw new Error(friendly(error)); };
function friendly(e) {
  const m = e.message || String(e);
  if (/duplicate key|claims_one_bought/.test(m)) return 'Someone just got that one — pick something else.';
  if (/Invalid login/.test(m)) return 'That PIN is not right.';
  if (/already registered/i.test(m)) return 'That profile is already set up. Try signing in instead.';
  if (/already set up/.test(m)) return 'That profile is already set up.';
  if (/Failed to fetch|NetworkError/.test(m)) return 'No connection. Try again.';
  return m;
}

// ---------- sign in: person + 4-digit PIN -> fake email + padded password ----------
const emailFor = (personId) => `p-${personId}@${LOGIN_DOMAIN}`;
// Must match sql/02_security.sql admin_set_pin()
const passFor = (personId, pin) => `wgi-${pin}-${personId.slice(0, 8)}`;

export async function loadRoster(side) {
  const { data, error } = await supabase.rpc('login_roster', { p_side: side });
  fail(error);
  return data;
}
export async function loadSides() {
  const { data, error } = await supabase.from('sides').select('*').order('sort');
  fail(error);
  return data;
}
export async function signIn(personId, pin) {
  const { error } = await supabase.auth.signInWithPassword({ email: emailFor(personId), password: passFor(personId, pin) });
  fail(error);
}
export async function firstSignUp(personId, pin) {
  const { data, error } = await supabase.auth.signUp({ email: emailFor(personId), password: passFor(personId, pin) });
  fail(error);
  if (!data.session) throw new Error('Sign-up needs "Confirm email" switched off in Supabase (see README).');
  const { error: e2 } = await supabase.rpc('claim_person', { p_person: personId });
  if (e2) { await supabase.auth.signOut(); fail(e2); }
}
export async function changeOwnPin(personId, pin) {
  const { error } = await supabase.auth.updateUser({ password: passFor(personId, pin) });
  fail(error);
}
export const signOut = () => supabase.auth.signOut();

// ---------- family snapshot ----------
export async function loadFamily() {
  const [people, ps, hh, sides] = await Promise.all([
    supabase.from('people').select('*').order('full_name'),
    supabase.from('person_sides').select('*'),
    supabase.from('households').select('*'),
    supabase.from('sides').select('*').order('sort'),
  ]);
  [people, ps, hh, sides].forEach((r) => fail(r.error));
  return { people: people.data, personSides: ps.data, households: hh.data, sides: sides.data };
}
export async function archiveGiven() { await supabase.rpc('archive_given_items'); }

export async function loadItemCounts() {
  const { data, error } = await supabase.from('wishlist_items').select('person_id').is('archived_at', null);
  fail(error);
  const m = {};
  data.forEach((r) => { m[r.person_id] = (m[r.person_id] || 0) + 1; });
  return m;
}

// ---------- one person's list ----------
export async function loadPersonData(personId) {
  const [items, claims] = await Promise.all([
    supabase.from('wishlist_items').select('*').eq('person_id', personId).order('priority', { ascending: false }).order('created_at', { ascending: false }),
    supabase.from('claims').select('*').eq('recipient_id', personId).order('created_at', { ascending: false }),
  ]);
  fail(items.error); // claims are empty (not an error) when you are looking at your own page
  return { items: items.data, claims: claims.data || [] };
}
export async function saveItem(item) {
  const { id, ...rest } = item;
  const q = id ? supabase.from('wishlist_items').update(rest).eq('id', id) : supabase.from('wishlist_items').insert(rest);
  const { error } = await q;
  fail(error);
}
export async function deleteItem(id) { fail((await supabase.from('wishlist_items').delete().eq('id', id)).error); }
export async function archiveItem(id, on = true) {
  fail((await supabase.from('wishlist_items').update({ archived_at: on ? new Date().toISOString() : null }).eq('id', id)).error);
}

// ---------- claims ----------
export async function saveClaim(claim) {
  const { id, ...rest } = claim;
  const q = id ? supabase.from('claims').update(rest).eq('id', id) : supabase.from('claims').insert(rest);
  fail((await q).error);
}
export async function deleteClaim(id) { fail((await supabase.from('claims').delete().eq('id', id)).error); }

// ---------- people (self, parent, admin) ----------
export async function updatePerson(id, patch) {
  const { error } = await supabase.from('people').update(patch).eq('id', id);
  fail(error);
}
export async function addPerson(person, sideIds) {
  const { data, error } = await supabase.from('people').insert(person).select().single();
  fail(error);
  await setSides(data.id, sideIds);
  return data;
}
export async function removePerson(id) { fail((await supabase.from('people').delete().eq('id', id)).error); }
export async function setSides(personId, sideIds) {
  fail((await supabase.from('person_sides').delete().eq('person_id', personId)).error);
  if (sideIds.length) fail((await supabase.from('person_sides').insert(sideIds.map((s) => ({ person_id: personId, side_id: s })))).error);
}
export async function addHousehold(name) {
  const { data, error } = await supabase.from('households').insert({ name }).select().single();
  fail(error);
  return data;
}
export async function adminSetPin(personId, pin) { fail((await supabase.rpc('admin_set_pin', { p_person: personId, p_pin: pin })).error); }

// ---------- photos ----------
export async function resizeImage(file, max = 1000) {
  const bmp = await createImageBitmap(file);
  const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas');
  c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
  c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
  return new Promise((res) => c.toBlob(res, 'image/jpeg', 0.82));
}
export async function uploadPhoto(bucket, file, max) {
  const blob = await resizeImage(file, max);
  const path = `${crypto.randomUUID()}.jpg`;
  const { error } = await supabase.storage.from(bucket).upload(path, blob, { contentType: 'image/jpeg', cacheControl: '31536000' });
  fail(error);
  return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
}

// ---------- link preview (free public service; falls back to manual entry) ----------
export async function fetchPreview(url) {
  try {
    const r = await fetch(`https://api.microlink.io/?url=${encodeURIComponent(url)}`);
    const j = await r.json();
    if (j.status !== 'success') return null;
    return { title: j.data.title || null, image: j.data.image?.url || j.data.logo?.url || null, site: j.data.publisher || null };
  } catch { return null; }
}

// ---------- Secret Santa (read-only here; the daily job writes) ----------
export async function loadSanta() {
  const { data, error } = await supabase.from('santa_pairs').select('giver_id, recipient_id, santa_draws!inner(year, side_id)');
  fail(error);
  return data.map((r) => ({ giver_id: r.giver_id, recipient_id: r.recipient_id, year: r.santa_draws.year, side_id: r.santa_draws.side_id }));
}
export async function loadDraws() {
  const { data, error } = await supabase.from('santa_draws').select('*');
  fail(error);
  return data;
}
