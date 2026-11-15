import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Avatar, Spinner } from '../ui.jsx';
import { loadRoster } from '../lib/api.js';
import { applyAccent } from '../lib/ctx.jsx';

const logo = `${import.meta.env.BASE_URL}icons/icon-192.png`;

/** The generic front door: every family gets an equal card and its own address (so each can be installed on its own). */
export default function Landing({ sides, error }) {
  const [rosters, setRosters] = useState({});
  useEffect(() => { applyAccent(''); }, []);
  useEffect(() => {
    (sides || []).forEach((s) => loadRoster(s.id).then((r) => setRosters((x) => ({ ...x, [s.id]: r }))).catch(() => {}));
  }, [sides]);

  return (
    <main className="shell bare">
      <div className="hero">
        <img src={logo} alt="" />
        <h1>Who’s Got It?</h1>
        <p>Choose your family</p>
      </div>
      {error && <p className="error" style={{ textAlign: 'center', marginTop: 16 }}>{error}</p>}
      {!sides ? <Spinner /> : (
        <div className="stack" style={{ marginTop: 28 }}>
          {sides.map((s, i) => {
            const people = rosters[s.id] || [];
            return (
              <motion.a key={s.id} className="family-card" href={`${import.meta.env.BASE_URL}${s.id}/`} whileTap={{ scale: 0.98 }}
                initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ type: 'spring', bounce: 0, duration: 0.5, delay: i * 0.06 }}>
                <span className="faces" aria-hidden="true">
                  {people.slice(0, 5).map((p) => <Avatar key={p.id} person={p} size={40} />)}
                </span>
                <span className="grow"><b>{s.name}</b><span className="muted small" style={{ display: 'block' }}>{people.length ? `${people.length} people` : ' '}</span></span>
                <span className="muted" aria-hidden="true">›</span>
              </motion.a>
            );
          })}
        </div>
      )}
      <p className="muted small" style={{ textAlign: 'center', marginTop: 28 }}>Tip: after choosing, add it to your home screen so it opens straight to your family.</p>
    </main>
  );
}
