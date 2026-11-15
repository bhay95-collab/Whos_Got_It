import { useState } from 'react';
import { Avatar, IconPlus } from '../ui.jsx';
import PersonSheet from '../sheets/PersonSheet.jsx';
import { useApp } from '../lib/ctx.jsx';
import { fmtBirthday } from '../lib/dates.js';

export default function Admin() {
  const { fam, reload } = useApp();
  const [sheet, setSheet] = useState({ open: false, person: null });
  const sideNames = (id) => fam.personSides.filter((s) => s.person_id === id).map((s) => fam.sides.find((x) => x.id === s.side_id)?.name).filter(Boolean).join(' · ');
  const hh = (id) => fam.households.find((h) => h.id === id)?.name;
  const missing = fam.people.filter((p) => p.active && !p.is_child && (!p.email || !p.birth_month));

  return (
    <main className="shell">
      <div className="page-head"><div><h1>People</h1><p className="sub">{fam.people.length} in the family</p></div>
        <button className="btn small" onClick={() => setSheet({ open: true, person: null })}><IconPlus size={18} /> Add</button></div>

      {missing.length > 0 && <div className="card pad" style={{ marginBottom: 16 }}><p className="small"><b>{missing.length} adult{missing.length > 1 ? 's' : ''} still need an email or birthday</b> — reminders can’t reach them yet: {missing.map((p) => p.full_name.split(' ')[0]).join(', ')}.</p></div>}

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
      <PersonSheet open={sheet.open} onClose={() => setSheet((s) => ({ ...s, open: false }))} person={sheet.person} mode="admin" onSaved={reload} />
    </main>
  );
}
