import { useState } from 'react';
import { updateSide } from '../lib/api.js';
import { Avatar, IconPlus } from '../ui.jsx';
import PersonSheet from '../sheets/PersonSheet.jsx';
import { useApp } from '../lib/ctx.jsx';
import { fmtBirthday } from '../lib/dates.js';

const ACCENTS = [['coral', 'Coral'], ['teal', 'Teal'], ['indigo', 'Slate blue'], ['plum', 'Mauve'], ['forest', 'Sage'], ['honey', 'Honey']];

export default function Admin() {
  const { fam, reload, toast } = useApp();
  const [sheet, setSheet] = useState({ open: false, person: null });
  const [draft, setDraft] = useState({});
  const val = (sd, k) => draft[sd.id]?.[k] ?? sd[k] ?? '';
  const kidsIn = (sd) => (draft[sd.id]?.santa_kids ?? sd.santa_kids) !== false;
  const edit = (sd, k, v) => setDraft((d) => ({ ...d, [sd.id]: { ...d[sd.id], [k]: v } }));
  const saveSide = async (sd) => {
    try {
      const d = draft[sd.id] || {};
      await updateSide(sd.id, { name: (d.name ?? sd.name).trim(), welcome: (d.welcome ?? sd.welcome ?? '').trim() || null, accent: d.accent ?? sd.accent, ...('santa_kids' in d ? { santa_kids: d.santa_kids } : {}) });
      toast('Saved'); setDraft((x) => { const c = { ...x }; delete c[sd.id]; return c; }); reload();
    } catch (e) { toast(e.message.includes('santa_kids') ? 'Run sql/06_santa_kids.sql first (see README).' : e.message.includes('accent') || e.message.includes('welcome') ? 'Run sql/05_family_themes.sql first (see README).' : e.message); }
  };
  const sideNames = (id) => fam.personSides.filter((s) => s.person_id === id).map((s) => fam.sides.find((x) => x.id === s.side_id)?.name).filter(Boolean).join(' · ');
  const hh = (id) => fam.households.find((h) => h.id === id)?.name;
  const missing = fam.people.filter((p) => p.active && !p.is_child && (!p.email || !p.birth_month));

  return (
    <main className="shell">
      <div className="page-head"><div><h1>People</h1><p className="sub">{fam.people.length} in the family</p></div>
        <button className="btn small" onClick={() => setSheet({ open: true, person: null })}><IconPlus size={18} /> Add</button></div>

      {missing.length > 0 && <div className="card pad" style={{ marginBottom: 16 }}><p className="small"><b>{missing.length} adult{missing.length > 1 ? 's' : ''} still need{missing.length > 1 ? '' : 's'} an email or birthday</b> — reminders can’t reach them yet: {missing.map((p) => p.full_name.split(' ')[0]).join(', ')}.</p></div>}

      <div className="list">
        {fam.people.map((p) => (
          <button key={p.id} className="list-row" onClick={() => setSheet({ open: true, person: p })} style={{ opacity: p.active ? 1 : 0.5 }}>
            <Avatar person={p} size={40} />
            <span className="grow"><b style={{ fontWeight: 600 }}>{p.full_name}</b>
              <span className="muted small" style={{ display: 'block' }}>{sideNames(p.id)}{hh(p.household_id) ? ` · ${hh(p.household_id)}` : ''}</span></span>
            <span style={{ textAlign: 'right' }}>
              {p.is_admin && <span className="pill accent">Admin</span>} {p.is_child && <span className="pill">Child</span>}
              <span className="muted small" style={{ display: 'block' }}>{fmtBirthday(p) || '—'}{!p.is_child && (p.auth_user_id ? '' : ' · not joined')}</span>
            </span>
          </button>
        ))}
      </div>
      <p className="section-title">Families</p>
      <div className="stack">
        {fam.sides.map((sd) => (
          <div key={sd.id} className="card pad stack" data-accent={val(sd, 'accent')} style={{ gap: 12 }}>
            <label className="field"><span className="label">Name</span><input className="input" value={val(sd, 'name')} onChange={(e) => edit(sd, 'name', e.target.value)} /></label>
            <label className="field"><span className="label">Welcome line (optional)</span><input className="input" placeholder="e.g. Welcome to the family" value={val(sd, 'welcome')} onChange={(e) => edit(sd, 'welcome', e.target.value)} /></label>
            <div className="field"><span className="label">Colour</span>
              <div className="chips">{ACCENTS.map(([k, label]) => <button key={k} className="chip swatch" data-accent={k} aria-pressed={val(sd, 'accent') === k} onClick={() => edit(sd, 'accent', k)}><i />{label}</button>)}</div></div>
            <div className="field"><span className="label">Secret Santa</span>
              <div className="seg" role="group" aria-label="Who is in the Secret Santa draw">
                <button aria-pressed={kidsIn(sd)} onClick={() => edit(sd, 'santa_kids', true)}>Kids draw too</button>
                <button aria-pressed={!kidsIn(sd)} onClick={() => edit(sd, 'santa_kids', false)}>Adults only</button>
              </div></div>
            <button className="btn small" disabled={!draft[sd.id]} onClick={() => saveSide(sd)}>Save {val(sd, 'name') || 'family'}</button>
          </div>
        ))}
      </div>
      <PersonSheet open={sheet.open} onClose={() => setSheet((s) => ({ ...s, open: false }))} person={sheet.person} mode="admin" onSaved={reload} />
    </main>
  );
}
