import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Avatar, Empty, Spinner } from '../ui.jsx';
import { useApp } from '../lib/ctx.jsx';
import { loadSanta, loadDraws } from '../lib/api.js';
import { todayISO, daysBetween, firstName } from '../lib/dates.js';

export default function Santa({ go }) {
  const { me, side, sideName, sidePeople, byId } = useApp();
  const [pairs, setPairs] = useState(null);
  const [draws, setDraws] = useState([]);
  const [open, setOpen] = useState(false);
  const [err, setErr] = useState('');
  const today = todayISO();
  const year = Number(today.slice(0, 4));

  useEffect(() => {
    Promise.all([loadSanta(), loadDraws()]).then(([p, d]) => { setPairs(p); setDraws(d); }).catch((e) => setErr(e.message));
  }, [side]);

  const drawn = draws.some((d) => d.side_id === side && d.year === year);
  const mine = pairs?.find((p) => p.side_id === side && p.year === year && p.giver_id === me.id);
  const kids = sidePeople.filter((p) => p.is_child && p.household_id && p.household_id === me.household_id && !me.is_child);
  const kidPairs = kids.map((k) => ({ kid: k, pair: pairs?.find((p) => p.side_id === side && p.year === year && p.giver_id === k.id) })).filter((x) => x.pair);
  const nov1 = `${year}-11-01`;
  const daysToDraw = daysBetween(today, nov1);

  // history = every revealed draw for this side (past years, or this year after 26 Dec)
  const history = useMemo(() => (pairs || []).filter((p) => p.side_id === side && (p.year < year || today >= `${p.year}-12-26`)), [pairs, side, year, today]);
  const counts = useMemo(() => {
    const m = {};
    history.forEach((p) => { m[`${p.giver_id}>${p.recipient_id}`] = (m[`${p.giver_id}>${p.recipient_id}`] || 0) + 1; });
    return m;
  }, [history]);
  const years = [...new Set(history.map((p) => p.year))].sort((a, b) => b - a);
  const lastYear = (g, r) => history.find((p) => p.giver_id === g && p.recipient_id === r && p.year === Math.max(...years));

  return (
    <main className="shell">
      <div className="page-head"><div><h1>Secret Santa</h1><p className="sub">{sideName} · $100 each</p></div></div>
      {err && <p className="error">{err}</p>}
      {!pairs ? <Spinner /> : (
        <>
          {drawn && mine && (
            <motion.button className="gift" onClick={() => setOpen((o) => !o)} aria-label={open ? 'Your Secret Santa person' : 'Tap to unwrap'} whileTap={{ scale: 0.98 }}>
              <AnimatePresence mode="wait" initial={false}>
                {!open ? (
                  <motion.div key="closed" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 1.08, rotate: 4 }} transition={{ type: 'spring', bounce: 0.3, duration: 0.5 }}>
                    <div style={{ fontSize: '3.5rem' }} aria-hidden="true">🎁</div>
                    <p className="big" style={{ marginTop: 8 }}>Tap to unwrap</p>
                    <p style={{ opacity: 0.8, marginTop: 6 }}>Your Secret Santa person for {year}</p>
                  </motion.div>
                ) : (
                  <motion.div key="open" initial={{ opacity: 0, scale: 0.7, rotate: -6 }} animate={{ opacity: 1, scale: 1, rotate: 0 }} transition={{ type: 'spring', bounce: 0.4, duration: 0.6 }}>
                    <div style={{ display: 'grid', placeItems: 'center' }}><Avatar person={byId[mine.recipient_id]} size={72} /></div>
                    <p className="big" style={{ marginTop: 12 }}>{byId[mine.recipient_id]?.full_name}</p>
                    <p style={{ opacity: 0.85, marginTop: 6 }}>Budget $100 · shh, it’s a secret 🤫</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.button>
          )}
          {open && mine && <button className="btn soft block" style={{ marginTop: 12 }} onClick={() => go(`/p/${mine.recipient_id}`)}>See {firstName(byId[mine.recipient_id])}’s wishlist</button>}

          {kidPairs.map(({ kid, pair }) => (
            <div key={kid.id} className="card pad row" style={{ marginTop: 12 }}>
              <Avatar person={kid} size={40} />
              <div className="grow"><p className="small muted">{firstName(kid)} is buying for</p><b>{byId[pair.recipient_id]?.full_name}</b></div>
              <button className="btn small gray" onClick={() => go(`/p/${pair.recipient_id}`)}>List</button>
            </div>
          ))}

          {drawn && !mine && <Empty title="You’re not in this year’s draw">Ask the admin to check you’re on this family.</Empty>}
          {!drawn && (
            <div className="card pad" style={{ textAlign: 'center' }}>
              <p style={{ fontSize: '3rem' }} aria-hidden="true">🎅</p>
              <h2 style={{ marginTop: 8 }}>{daysToDraw > 0 ? `The draw happens in ${daysToDraw} day${daysToDraw > 1 ? 's' : ''}` : 'The draw is coming'}</h2>
              <p className="muted" style={{ marginTop: 6 }}>It runs automatically on 1 November. You’ll get an email, then open the app to see who you’ve got.</p>
            </div>
          )}

          <p className="section-title">The rules</p>
          <div className="card pad small muted stack" style={{ gap: 6 }}>
            <span>• Never yourself, never your partner.</span>
            <span>• Kids never draw someone in their own household.</span>
            <span>• Never the same person as last year.</span>
            <span>• Otherwise whoever you’ve bought for least often, so everyone gets a turn.</span>
          </div>

          <p className="section-title">Who’s had who</p>
          {history.length === 0 ? <p className="muted small" style={{ marginInline: 4 }}>History appears here once a draw has been revealed (26 December).</p> : (
            <>
              <div className="matrix-wrap">
                <table className="matrix" aria-label="Number of times each person has bought for each other person">
                  <thead><tr><th />{sidePeople.map((p) => <th key={p.id} className="col">{firstName(p)}</th>)}</tr></thead>
                  <tbody>
                    {sidePeople.map((g) => (
                      <tr key={g.id}><th className="rowh">{firstName(g)}</th>
                        {sidePeople.map((r) => {
                          if (g.id === r.id || g.spouse_id === r.id) return <td key={r.id} className="na">–</td>;
                          const n = counts[`${g.id}>${r.id}`] || 0;
                          return <td key={r.id} className={n >= 2 ? 'n2' : n === 1 ? 'n1' : ''} title={`${firstName(g)} → ${firstName(r)}: ${n}`}>{n || ''}</td>;
                        })}</tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="small muted" style={{ marginTop: 8 }}>Rows buy for columns. Blank = hasn’t happened yet, so they’re next in line.</p>
            </>
          )}
        </>
      )}
    </main>
  );
}
