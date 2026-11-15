import { useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { Avatar } from '../ui.jsx';
import { useApp } from '../lib/ctx.jsx';
import { loadItemCounts } from '../lib/api.js';
import { nextBirthday, inDays, fmtBirthday, firstName, todayISO } from '../lib/dates.js';

export default function Home({ go }) {
  const { me, sidePeople, sideName, mySides, fam, side, setSide } = useApp();
  const [counts, setCounts] = useState({});
  useEffect(() => { loadItemCounts().then(setCounts).catch(() => {}); }, [side]);

  const today = todayISO();
  const upcoming = useMemo(() =>
    sidePeople.map((p) => ({ p, b: nextBirthday(p, today) })).filter((x) => x.b).sort((a, b) => a.b.days - b.b.days).slice(0, 6),
  [sidePeople, today]);
  const others = sidePeople.filter((p) => p.id !== me.id);
  const hour = Number(new Intl.DateTimeFormat('en-AU', { hour: 'numeric', hour12: false, timeZone: 'Australia/Brisbane' }).format());
  const greet = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  return (
    <main className="shell">
      <div className="page-head">
        <div>
          <p className="muted">{greet}, {firstName(me)}</p>
          <h1>{sideName || 'Family'}</h1>
        </div>
      </div>

      {mySides.length > 1 && (
        <div className="seg" style={{ marginBottom: 20 }} role="group" aria-label="Family">
          {fam.sides.filter((s) => mySides.includes(s.id)).map((s) => <button key={s.id} aria-pressed={s.id === side} onClick={() => setSide(s.id)}>{s.name}</button>)}
        </div>
      )}

      {upcoming.length > 0 && (
        <>
          <p className="section-title" style={{ marginTop: 8 }}>Coming up</p>
          <div className="hscroll">
            {upcoming.map(({ p, b }, idx) => (
              <motion.button key={p.id} whileTap={{ scale: 0.97 }} className={`bday ${idx === 0 && b.days <= 42 && p.id !== me.id ? 'soon' : ''}`} onClick={() => go(p.id === me.id ? '/mine' : `/p/${p.id}`)}>
                <Avatar person={p} size={40} />
                <span><span className="when tnum">{inDays(b.days)}</span><span className="muted small" style={{ display: 'block', marginTop: 4 }}>{p.id === me.id ? 'You' : firstName(p)} · {fmtBirthday(p)}</span></span>
              </motion.button>
            ))}
          </div>
        </>
      )}

      <p className="section-title">Everyone</p>
      <div className="people-grid">
        {others.map((p, i) => (
          <motion.button key={p.id} className="person-tile" onClick={() => go(`/p/${p.id}`)}
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ type: 'spring', bounce: 0, duration: 0.45, delay: Math.min(i, 8) * 0.03 }}>
            <Avatar person={p} size={44} />
            <span><b>{firstName(p)}</b><span>{counts[p.id] ? `${counts[p.id]} idea${counts[p.id] > 1 ? 's' : ''}` : 'No ideas yet'}</span></span>
          </motion.button>
        ))}
      </div>
    </main>
  );
}
