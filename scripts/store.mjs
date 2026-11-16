// Supabase-backed store for the daily job. Uses the service_role key (kept in GitHub secrets only).
import { createClient } from '@supabase/supabase-js';

const ok = ({ data, error }) => { if (error) throw new Error(error.message); return data; };

export function createStore(url, serviceKey, { dry = false } = {}) {
  const db = createClient(url, serviceKey, { auth: { persistSession: false } });
  return {
    async keepAlive() { ok(await db.from('sides').select('id').limit(1)); },
    async archiveGiven() { if (!dry) await db.rpc('archive_given_items'); },
    async loadAll() {
      const [people, personSides, sides, items, claims] = await Promise.all([
        db.from('people').select('*'), db.from('person_sides').select('*'),
        db.from('sides').select('*').order('sort'),
        db.from('wishlist_items').select('id, person_id, title, url, image_url, price, priority, created_at, archived_at').is('archived_at', null),
        db.from('claims').select('item_id, state, occasion_date').eq('state', 'bought').not('item_id', 'is', null),
      ]).then((r) => r.map(ok));
      const itemCounts = {};
      items.forEach((i) => { itemCounts[i.person_id] = (itemCounts[i.person_id] || 0) + 1; });
      return { people, personSides, sides, items, claims, itemCounts };
    },
    async queue(emails) {
      if (!emails.length) return 0;
      if (dry) { console.log(`[dry] would queue ${emails.length} email(s)`); return emails.length; }
      const { data, error } = await db.from('email_queue').upsert(emails, { onConflict: 'dedupe_key', ignoreDuplicates: true }).select('id');
      if (error) throw new Error(error.message);
      return data.length;   // only the genuinely new ones
    },
    /** This year's draw for a side and who is giving in it, or null if there is no draw / no pairs yet. */
    async drawWithGivers(sideId, year) {
      const d = ok(await db.from('santa_draws').select('id, side_id, year').eq('side_id', sideId).eq('year', year));
      if (!d.length) return null;
      const pairs = ok(await db.from('santa_pairs').select('giver_id').eq('draw_id', d[0].id));
      return pairs.length ? { draw: d[0], giverIds: pairs.map((p) => p.giver_id) } : null;
    },
    async drawExists(sideId, year) { return ok(await db.from('santa_draws').select('id').eq('side_id', sideId).eq('year', year)).length > 0; },
    async history(sideId) {
      const rows = ok(await db.from('santa_pairs').select('giver_id, recipient_id, santa_draws!inner(year, side_id)').eq('santa_draws.side_id', sideId));
      return rows.map((r) => ({ giver_id: r.giver_id, recipient_id: r.recipient_id, year: r.santa_draws.year }));
    },
    async saveDraw(sideId, year, pairs) {
      if (dry) { console.log(`[dry] would save draw for ${sideId} ${year} (${pairs.length} pairs)`); return { id: `dry-${sideId}-${year}`, side_id: sideId, year }; }
      const ins = await db.from('santa_draws').insert({ side_id: sideId, year }).select().single();
      if (ins.error) { if (ins.error.code === '23505') return null; throw new Error(ins.error.message); }
      const pr = await db.from('santa_pairs').insert(pairs.map((p) => ({ ...p, draw_id: ins.data.id })));
      if (pr.error) { await db.from('santa_draws').delete().eq('id', ins.data.id); throw new Error(pr.error.message); }
      return ins.data;
    },
    async pending() {
      if (dry) return [];
      const since = new Date(Date.now() - 7 * 86400000).toISOString();   // stop retrying after a week
      return ok(await db.from('email_queue').select('*').is('sent_at', null).gte('created_at', since).order('created_at'));
    },
    async markSent(id) { ok(await db.from('email_queue').update({ sent_at: new Date().toISOString(), error: null }).eq('id', id)); },
    async markError(id, msg) { ok(await db.from('email_queue').update({ error: msg.slice(0, 500) }).eq('id', id)); },
  };
}
