import { useState } from 'react';
import { Avatar, Sheet, PinPad } from '../ui.jsx';
import PersonSheet from '../sheets/PersonSheet.jsx';
import { useApp } from '../lib/ctx.jsx';
import { signOut, changeOwnPin } from '../lib/api.js';
import { fmtBirthday, firstName } from '../lib/dates.js';

export default function Me({ go }) {
  const { me, reload, toast, sidePeople } = useApp();
  const [edit, setEdit] = useState(false);
  const [pinSheet, setPinSheet] = useState(false);
  const [first, setFirst] = useState('');
  const [kid, setKid] = useState(null);
  const kids = sidePeople.filter((p) => p.is_child && p.household_id === me.household_id && me.household_id);

  const setNewPin = async (pin) => {
    if (!first) { setFirst(pin); throw new Error(''); }
    if (first !== pin) { setFirst(''); throw new Error('Those did not match. Try again.'); }
    await changeOwnPin(me.id, pin);
    setFirst(''); setPinSheet(false); toast('PIN changed');
  };
  const standalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);

  return (
    <main className="shell">
      <div className="page-head"><h1>Me</h1></div>

      <div className="card pad row" style={{ gap: 16 }}>
        <Avatar person={me} size={64} />
        <div className="grow"><h2>{me.full_name}</h2><p className="muted small">{fmtBirthday(me) ? `Birthday ${fmtBirthday(me)}` : 'No birthday yet'} · {me.email || 'No email yet'}</p></div>
      </div>

      <div className="list" style={{ marginTop: 16 }}>
        <button className="list-row" onClick={() => setEdit(true)}><span className="grow">Edit profile & my details</span><span className="muted">›</span></button>
        <button className="list-row" onClick={() => go('/mine')}><span className="grow">My wishlist</span><span className="muted">›</span></button>
        <button className="list-row" onClick={() => { setFirst(''); setPinSheet(true); }}><span className="grow">Change my PIN</span><span className="muted">›</span></button>
      </div>

      {kids.length > 0 && (
        <>
          <p className="section-title">Kids you manage</p>
          <div className="list">
            {kids.map((k) => (
              <div key={k.id} className="list-row">
                <button className="row grow" style={{ background: 'none', border: 0, padding: 0, textAlign: 'left' }} onClick={() => go(`/p/${k.id}`)}><Avatar person={k} size={36} /><span className="grow">{k.full_name}</span></button>
                <button className="btn small gray" onClick={() => setKid(k)}>Profile</button>
              </div>
            ))}
          </div>
        </>
      )}

      {!standalone && (
        <div className="card pad" style={{ marginTop: 24 }}>
          <h3>Put it on your home screen</h3>
          <p className="muted" style={{ marginTop: 6 }}>
            {ios ? <>In Safari tap the <b>Share</b> button, then <b>Add to Home Screen</b>.</> : <>In Chrome tap the <b>⋮</b> menu, then <b>Add to Home screen</b> (or <b>Install app</b>).</>}
          </p>
        </div>
      )}

      <button className="btn gray block" style={{ marginTop: 24 }} onClick={() => signOut()}>Sign out</button>

      <PersonSheet open={edit} onClose={() => setEdit(false)} person={me} mode="self" onSaved={reload} />
      {kid && <PersonSheet open={!!kid} onClose={() => setKid(null)} person={kid} mode="self" title={`${firstName(kid)}’s profile`} onSaved={reload} />}
      <Sheet open={pinSheet} onClose={() => setPinSheet(false)} title={first ? 'Confirm new PIN' : 'New PIN'}>
        <PinPad key={first ? 2 : 1} onComplete={setNewPin} />
      </Sheet>
    </main>
  );
}
