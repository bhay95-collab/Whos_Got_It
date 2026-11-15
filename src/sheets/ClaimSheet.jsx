import { useEffect, useState } from 'react';
import { Sheet, Field } from '../ui.jsx';
import { saveClaim, deleteClaim } from '../lib/api.js';
import { useApp } from '../lib/ctx.jsx';
import { nextBirthday, nextChristmas, fmtDay, firstName } from '../lib/dates.js';

/** Claim an item ("I'll get this") or log an off-list gift (item = null). `claim` = my existing claim, to edit. */
export default function ClaimSheet({ open, onClose, recipient, item, claim, onSaved }) {
  const { me, toast } = useApp();
  const bday = nextBirthday(recipient);
  const xmas = nextChristmas();
  const [state, setState] = useState('bought');
  const [occ, setOcc] = useState('christmas');
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!open) return;
    setErr('');
    if (claim) { setState(claim.state); setOcc(claim.occasion_type); setText(claim.description); return; }
    setState('bought'); setText('');
    setOcc(bday && bday.days <= xmas.days ? 'birthday' : 'christmas');
  }, [open, claim]); // eslint-disable-line react-hooks/exhaustive-deps

  const date = occ === 'birthday' && bday ? bday.iso : xmas.iso;

  const save = async () => {
    const description = item ? item.title : text.trim();
    if (!description) { setErr('What did you get?'); return; }
    setBusy(true); setErr('');
    try {
      await saveClaim({
        id: claim?.id, recipient_id: recipient.id, item_id: item?.id ?? claim?.item_id ?? null, claimer_id: me.id,
        description, state, occasion_type: occ, occasion_date: date,
      });
      toast(state === 'bought' ? 'Locked in for you 🎁' : 'Noted as a maybe');
      onSaved(); onClose();
    } catch (e) { setErr(e.message); }
    setBusy(false);
  };
  const undo = async () => {
    setBusy(true);
    try { await deleteClaim(claim.id); toast('Removed'); onSaved(); onClose(); } catch (e) { setErr(e.message); }
    setBusy(false);
  };

  return (
    <Sheet open={open} onClose={onClose} title={item || claim?.item_id ? 'Get this for ' + firstName(recipient) : 'Something not on the list'}>
      {item ? <p className="item-title">{item.title}</p> : (
        <Field label={`What are you getting ${firstName(recipient)}?`}>
          <input className="input" placeholder="e.g. Blue jumper" value={text} onChange={(e) => setText(e.target.value)} />
        </Field>
      )}

      <Field label="Status" group>
        <div className="seg">
          <button aria-pressed={state === 'thinking'} onClick={() => setState('thinking')}>Maybe</button>
          <button aria-pressed={state === 'bought'} onClick={() => setState('bought')}>I’m getting it</button>
        </div>
        <span className="small muted">{state === 'bought' ? 'Locks it so nobody else gets it too.' : 'A soft hold. Others see someone is considering it, and can still take it.'}</span>
      </Field>

      <Field label="For" group>
        <div className="chips">
          {bday && <button className="chip" aria-pressed={occ === 'birthday'} onClick={() => setOcc('birthday')}>Birthday · {fmtDay(bday.iso)}</button>}
          <button className="chip" aria-pressed={occ === 'christmas'} onClick={() => setOcc('christmas')}>Christmas · 25 Dec</button>
        </div>
        <span className="small muted">After this date it drops off the list automatically.</span>
      </Field>

      {err && <p className="error" role="alert">{err}</p>}
      <button className="btn block" onClick={save} disabled={busy}>{busy ? 'Saving…' : claim ? 'Save' : state === 'bought' ? 'I’m getting it' : 'Save as a maybe'}</button>
      {claim && <button className="btn danger block" onClick={undo} disabled={busy}>Undo — I’m not getting it</button>}
    </Sheet>
  );
}
