import { useEffect, useRef, useState } from 'react';
import { Sheet, Field, Avatar, IconCamera } from '../ui.jsx';
import { updatePerson, addPerson, setSides, addHousehold, adminSetPin, uploadPhoto, removePerson } from '../lib/api.js';
import { useApp } from '../lib/ctx.jsx';
import { MONTHS } from '../lib/dates.js';

const COLORS = ['blue', 'pink', 'lilac', 'green', 'yellow', 'peach'];
const DETAILS = [
  ['clothing', 'Clothing size', 'e.g. M / 10'],
  ['shoe', 'Shoe size', 'e.g. 9'],
  ['ring', 'Ring size', ''],
  ['colours', 'Favourite colours', ''],
  ['allergies', 'Allergies / dislikes', ''],
  ['avoid', 'Please no…', 'e.g. candles, mugs, anything scented'],
];
const blank = { full_name: '', email: '', color: 'blue', photo_url: '', birth_day: '', birth_month: '', birth_year: '', is_child: false, is_admin: false, active: true, household_id: '', spouse_id: '', sides: [], sizes: {} };

/** mode: 'self' (my profile / my child) | 'admin' (any person, or add new when person is null).
 *  brief: first sign-in, ask only for what reminders need (birthday + email); the rest lives under Me. */
export default function PersonSheet({ open, onClose, person, mode = 'self', title, onSaved, brief = false }) {
  const { fam, toast, side } = useApp();
  const [f, setF] = useState(blank);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [pin, setPin] = useState('');
  const file = useRef(null);
  const admin = mode === 'admin';

  useEffect(() => {
    if (!open) return;
    setErr(''); setPin('');
    if (person) {
      setF({
        ...blank, ...person,
        email: person.email || '', photo_url: person.photo_url || '',
        birth_day: person.birth_day || '', birth_month: person.birth_month || '', birth_year: person.birth_year || '',
        household_id: person.household_id || '', spouse_id: person.spouse_id || '', sizes: person.sizes || {},
        sides: fam.personSides.filter((s) => s.person_id === person.id).map((s) => s.side_id),
      });
    } else setF({ ...blank, sides: side ? [side] : [] });
  }, [open, person]); // eslint-disable-line react-hooks/exhaustive-deps

  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const setSize = (k, v) => setF((x) => ({ ...x, sizes: { ...x.sizes, [k]: v } }));
  const toggleSide = (id) => setF((x) => ({ ...x, sides: x.sides.includes(id) ? x.sides.filter((s) => s !== id) : [...x.sides, id] }));

  const pickPhoto = async (e) => {
    const f0 = e.target.files?.[0]; if (!f0) return;
    setBusy(true);
    try { set('photo_url', await uploadPhoto('avatars', f0, 400)); } catch (x) { setErr(x.message); }
    setBusy(false);
  };

  const save = async () => {
    if (!f.full_name.trim()) { setErr('Name please.'); return; }
    const d = f.birth_day === '' ? null : Number(f.birth_day);
    const m = f.birth_month === '' ? null : Number(f.birth_month);
    if ((d && !m) || (m && !d)) { setErr('Birthday needs both a day and a month.'); return; }
    if (d && (d < 1 || d > 31)) { setErr('Day must be 1–31.'); return; }
    if (f.email && !/^\S+@\S+\.\S+$/.test(f.email.trim())) { setErr('That email does not look right.'); return; }
    setBusy(true); setErr('');
    try {
      const patch = {
        full_name: f.full_name.trim(), email: f.email.trim() || null, color: f.color, photo_url: f.photo_url || null,
        birth_day: d, birth_month: m, birth_year: f.birth_year === '' ? null : Number(f.birth_year), sizes: f.sizes,
      };
      if (admin) {
        let hh = f.household_id || null;
        if (hh === '__new') hh = (await addHousehold(`${f.full_name.trim().split(' ').slice(-1)[0]} household`)).id;
        Object.assign(patch, { is_child: f.is_child, is_admin: f.is_admin, active: f.active, household_id: hh, spouse_id: f.spouse_id || null });
        if (person) { await updatePerson(person.id, patch); await setSides(person.id, f.sides); }
        else await addPerson(patch, f.sides);
        // keep couples mirrored
        if (person && f.spouse_id && fam.people.find((p) => p.id === f.spouse_id)?.spouse_id !== person.id) await updatePerson(f.spouse_id, { spouse_id: person.id });
      } else await updatePerson(person.id, patch);
      toast('Saved'); await onSaved(); onClose();
    } catch (x) { setErr(x.message); }
    setBusy(false);
  };

  const resetPin = async () => {
    try { await adminSetPin(person.id, pin); toast('PIN changed'); setPin(''); } catch (x) { setErr(x.message); }
  };
  const remove = async () => {
    if (!confirm(`Delete ${person.full_name} and everything they added? This cannot be undone.`)) return;
    try { await removePerson(person.id); toast('Deleted'); await onSaved(); onClose(); } catch (x) { setErr(x.message); }
  };

  const adults = fam.people.filter((p) => !p.is_child && p.id !== person?.id);

  return (
    <Sheet open={open} onClose={onClose} title={title || (person ? (admin ? 'Edit person' : 'Your profile') : 'Add a person')}>
      {brief && <p className="muted">Two quick things so birthday reminders and Secret Santa emails reach you. Photo and sizes can wait. They live under <b>Me</b>.</p>}
      {!brief && <>
      <div className="row">
        <Avatar person={{ ...f, full_name: f.full_name || '?' }} size={64} />
        <button className="btn gray small" onClick={() => file.current?.click()} disabled={busy}><IconCamera size={18} /> {f.photo_url ? 'Change photo' : 'Add a photo'}</button>
        <input ref={file} type="file" accept="image/*" hidden onChange={pickPhoto} />
      </div>
      <div className="chips" role="group" aria-label="Colour">
        {COLORS.map((c) => <button key={c} className="chip" aria-pressed={f.color === c} onClick={() => set('color', c)} style={{ textTransform: 'capitalize' }}>{c}</button>)}
      </div>

      <Field label="Name"><input className="input" value={f.full_name} onChange={(e) => set('full_name', e.target.value)} autoComplete="name" /></Field>
      </>}

      <Field label="Birthday" group>
        <div className="row" style={{ gap: 8 }}>
          <input className="input" style={{ width: 76 }} inputMode="numeric" placeholder="Day" maxLength={2} value={f.birth_day} onChange={(e) => set('birth_day', e.target.value.replace(/\D/g, ''))} aria-label="Day" />
          <select className="input" value={f.birth_month} onChange={(e) => set('birth_month', e.target.value)} aria-label="Month">
            <option value="">Month</option>
            {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
          </select>
          <input className="input" style={{ width: 96 }} inputMode="numeric" placeholder="Year" maxLength={4} value={f.birth_year} onChange={(e) => set('birth_year', e.target.value.replace(/\D/g, ''))} aria-label="Year (optional)" />
        </div>
        <span className="small muted">Year is optional. Birthday reminders go out 6 weeks ahead.</span>
      </Field>

      <Field label="Email (for birthday reminders & Secret Santa)">
        <input className="input" type="email" inputMode="email" autoCapitalize="none" autoCorrect="off" value={f.email} onChange={(e) => set('email', e.target.value)} autoComplete="email" />
      </Field>

      {!brief && <>
      <p className="section-title" style={{ margin: '8px 0 -4px' }}>My details</p>
      <p className="small muted" style={{ marginTop: -8 }}>Helps people buy the right thing.</p>
      {DETAILS.map(([k, l, ph]) => (
        <Field key={k} label={l}><input className="input" placeholder={ph} value={f.sizes[k] || ''} onChange={(e) => setSize(k, e.target.value)} /></Field>
      ))}
      </>}

      {admin && (
        <>
          <p className="section-title" style={{ margin: '12px 0 -4px' }}>Admin</p>
          <Field label="Family sides" group>
            <div className="chips">{fam.sides.map((s) => <button key={s.id} className="chip" aria-pressed={f.sides.includes(s.id)} onClick={() => toggleSide(s.id)}>{s.name}</button>)}</div>
          </Field>
          <Field label="Household">
            <select className="input" value={f.household_id} onChange={(e) => set('household_id', e.target.value)}>
              <option value="">— none —</option>
              {fam.households.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
              <option value="__new">+ New household</option>
            </select>
          </Field>
          <Field label="Partner">
            <select className="input" value={f.spouse_id} onChange={(e) => set('spouse_id', e.target.value)}>
              <option value="">— none —</option>
              {adults.map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
            </select>
          </Field>
          <Field label="Type" group>
            <div className="seg">
              <button aria-pressed={!f.is_child} onClick={() => set('is_child', false)}>Adult (has a login)</button>
              <button aria-pressed={f.is_child} onClick={() => set('is_child', true)}>Child (parents manage)</button>
            </div>
          </Field>
          <div className="chips">
            <button className="chip" aria-pressed={f.is_admin} onClick={() => set('is_admin', !f.is_admin)}>Admin</button>
            <button className="chip" aria-pressed={f.active} onClick={() => set('active', !f.active)}>Active</button>
          </div>
          {person && person.auth_user_id && (
            <Field label="Forgotten PIN? Set a new one">
              <div className="row" style={{ gap: 8 }}>
                <input className="input" inputMode="numeric" maxLength={4} placeholder="4 digits" value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))} />
                <button className="btn gray" disabled={pin.length !== 4} onClick={resetPin}>Set</button>
              </div>
            </Field>
          )}
        </>
      )}

      {err && <p className="error" role="alert">{err}</p>}
      <button className="btn block" onClick={save} disabled={busy}>{busy ? 'Saving…' : person ? 'Save' : 'Add person'}</button>
      {brief && <button className="btn plain block" onClick={onClose}>Later</button>}
      {admin && person && <button className="btn danger block" onClick={remove}>Delete person</button>}
    </Sheet>
  );
}
