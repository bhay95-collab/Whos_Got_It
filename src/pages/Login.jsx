import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Avatar, PinPad, IconBack, Spinner } from '../ui.jsx';
import { loadRoster, loadSides, signIn, firstSignUp } from '../lib/api.js';
import { ENTRY_SIDE, useApp } from '../lib/ctx.jsx';
import { firstName } from '../lib/dates.js';

const logo = `${import.meta.env.BASE_URL}icons/icon-192.png`;

export default function Login() {
  const { setSide } = useApp();
  const [sides, setSides] = useState(null);
  const [side, setLocalSide] = useState(ENTRY_SIDE);
  const [roster, setRoster] = useState(null);
  const [who, setWho] = useState(null);          // person tapped
  const [draft, setDraft] = useState('');        // first-time: first PIN, awaiting confirmation
  const [error, setError] = useState('');

  useEffect(() => { loadSides().then(setSides).catch((e) => setError(e.message)); }, []);
  useEffect(() => {
    if (!side) return;
    setRoster(null);
    loadRoster(side).then(setRoster).catch((e) => setError(e.message));
  }, [side]);

  const pickSide = (s) => { setLocalSide(s); setSide(s); };
  const back = () => { setWho(null); setDraft(''); };

  const verify = async (pin) => {
    if (who.claimed) return signIn(who.id, pin);
    if (!draft) { setDraft(pin); throw new Error(''); } // stay on pad, ask again
    if (draft !== pin) { setDraft(''); throw new Error('Those did not match. Start again.'); }
    return firstSignUp(who.id, pin);
  };

  const sideName = sides?.find((s) => s.id === side)?.name;

  return (
    <main className="shell bare">
      <div className="hero">
        <img src={logo} alt="" />
        <h1>Who’s Got It?</h1>
        <p>{sideName ? sideName : 'Family gifts, sorted.'}</p>
      </div>

      {error && <p className="error" style={{ textAlign: 'center', marginTop: 16 }}>{error}</p>}

      <AnimatePresence mode="wait" initial={false}>
        {!side && (
          <motion.div key="sides" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.22 }}>
            <p className="section-title" style={{ textAlign: 'center' }}>Which family?</p>
            {!sides ? <Spinner /> : (
              <div className="stack">
                {sides.map((s) => <button key={s.id} className="btn gray block" onClick={() => pickSide(s.id)}>{s.name}</button>)}
              </div>
            )}
          </motion.div>
        )}

        {side && !who && (
          <motion.div key="roster" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.22 }}>
            <p className="section-title" style={{ textAlign: 'center', marginTop: 28 }}>Who are you?</p>
            {!roster ? <Spinner /> : (
              <div className="face-grid">
                {roster.map((p) => (
                  <button key={p.id} className="face" onClick={() => setWho(p)}>
                    <Avatar person={p} size={60} />
                    {firstName(p)}
                    {!p.claimed && <small>First time?</small>}
                  </button>
                ))}
              </div>
            )}
            {!ENTRY_SIDE && <p style={{ textAlign: 'center', marginTop: 20 }}><button className="btn plain small" onClick={() => setLocalSide('')}>Other family</button></p>}
          </motion.div>
        )}

        {who && (
          <motion.div key={`pin-${draft ? 2 : 1}`} initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }} transition={{ type: 'spring', bounce: 0, duration: 0.4 }}>
            <div className="row" style={{ marginTop: 24 }}>
              <button className="icon-btn" onClick={back} aria-label="Back"><IconBack size={20} /></button>
              <div className="grow" style={{ textAlign: 'center', marginRight: 40 }}>
                <div style={{ display: 'grid', placeItems: 'center' }}><Avatar person={who} size={64} /></div>
                <h2 style={{ marginTop: 10 }}>{who.claimed ? `Hi ${firstName(who)}` : `Welcome, ${firstName(who)}`}</h2>
                <p className="muted" style={{ marginTop: 4 }}>
                  {who.claimed ? 'Enter your 4-digit PIN' : draft ? 'Enter it once more to confirm' : 'Choose a 4-digit PIN you will remember'}
                </p>
              </div>
            </div>
            <PinPad onComplete={verify} />
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}
