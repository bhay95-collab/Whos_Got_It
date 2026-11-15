import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { Avatar, Empty, Spinner, IconBack, IconPlus, IconEye } from '../ui.jsx';
import { goBack } from '../lib/router.js';
import ItemSheet from '../sheets/ItemSheet.jsx';
import ClaimSheet from '../sheets/ClaimSheet.jsx';
import PersonSheet from '../sheets/PersonSheet.jsx';
import { useApp, canManage } from '../lib/ctx.jsx';
import { loadPersonData, archiveItem } from '../lib/api.js';
import { todayISO, nextBirthday, fmtBirthday, fmtDay, inDays, firstName } from '../lib/dates.js';

const money = (n) => (n == null ? null : new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: n % 1 ? 2 : 0 }).format(n));
const host = (u) => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return u; } };

/** root: shown as a tab (My list), so there is nothing to go back to. */
export default function Person({ id, root = false }) {
  const { me, byId, fam, mySides, toast } = useApp();
  const person = byId[id];
  const isOwn = me.id === id;
  const editable = canManage(me, person);
  const showClaims = !isOwn;
  const today = todayISO();

  const [data, setData] = useState(null);
  const [tab, setTab] = useState('list');
  const [itemSheet, setItemSheet] = useState({ open: false, item: null });
  const [claimSheet, setClaimSheet] = useState({ open: false, item: null, claim: null });
  const [profile, setProfile] = useState(false);
  const [showDone, setShowDone] = useState(false);

  const refresh = useCallback(() => loadPersonData(id).then(setData).catch((e) => toast(e.message)), [id, toast]);
  useEffect(() => { setData(null); setTab('list'); refresh(); }, [id, refresh]);

  const active = useMemo(() => (data?.claims || []).filter((c) => c.occasion_date >= today), [data, today]);
  const past = useMemo(() => (data?.claims || []).filter((c) => c.occasion_date < today), [data, today]);

  if (!person) return <main className="shell"><Empty title="Not found">That person is not in the family list.</Empty></main>;

  const bd = nextBirthday(person, today);
  const sharesSide = (pid) => fam.personSides.some((s) => s.person_id === pid && mySides.includes(s.side_id));
  const takenByOther = (i) => showClaims && active.some((c) => c.item_id === i.id && c.state === 'bought' && c.claimer_id !== me.id);
  const items = (data?.items.filter((i) => !i.archived_at) || []).sort((a, b) => Number(takenByOther(a)) - Number(takenByOther(b)));
  const done = data?.items.filter((i) => i.archived_at) || [];
  const offList = active.filter((c) => !c.item_id);
  const details = Object.entries(person.sizes || {}).filter(([, v]) => v);
  const LABELS = { clothing: 'Clothing', shoe: 'Shoe', ring: 'Ring', colours: 'Colours', allergies: 'Allergies', avoid: 'Please no' };

  return (
    <main className={`shell ${editable || showClaims ? 'has-fab' : ''}`}>
      {(!root || (editable && !isOwn)) && (
        <div className="row" style={{ marginBottom: 8 }}>
          {!root && <button className="icon-btn" onClick={() => goBack('/')} aria-label="Back"><IconBack size={20} /></button>}
          {editable && !isOwn && <button className="btn gray small" style={{ marginLeft: 'auto' }} onClick={() => setProfile(true)}>Edit profile</button>}
        </div>
      )}

      <div className="row" style={{ gap: 16, margin: '8px 0 16px' }}>
        <Avatar person={person} size={72} />
        <div className="grow">
          <h1>{isOwn ? 'My list' : firstName(person)}</h1>
          <p className="muted" style={{ marginTop: 4 }}>
            {bd ? <>
              <span className="nowrap">Birthday {fmtBirthday(person)}</span>
              {bd.days <= 60 && <> · <span className={`nowrap ${bd.days <= 42 ? 'when-soon' : ''}`}>{bd.days === 0 ? 'today!' : bd.days === 1 ? 'tomorrow' : `in ${bd.days} days`}</span></>}
              {bd.turning ? <> · <span className="nowrap">turning {bd.turning}</span></> : ''}
            </> : 'No birthday saved yet'}
          </p>
        </div>
      </div>
      {isOwn && <p className="muted small" style={{ marginBottom: 16 }}>Everyone in the family can see this list. You never see what has been bought for you.</p>}

      {details.length > 0 && (
        <div className="card pad" style={{ marginBottom: 16 }}>
          <p className="label" style={{ marginBottom: 8 }}>{isOwn ? 'My details' : `${firstName(person)}’s details`}</p>
          <div className="stack" style={{ gap: 6 }}>
            {details.map(([k, v]) => <div key={k} className="row" style={{ alignItems: 'baseline' }}><span className="muted small" style={{ width: 86, flex: 'none' }}>{LABELS[k] || k}</span><span style={{ overflowWrap: 'anywhere' }}>{v}</span></div>)}
          </div>
        </div>
      )}

      {showClaims && (
        <div className="seg" style={{ marginBottom: 16 }}>
          <button aria-pressed={tab === 'list'} onClick={() => setTab('list')}>Wishlist</button>
          <button aria-pressed={tab === 'bought'} onClick={() => setTab('bought')}>Other gifts{offList.length ? ` · ${offList.length}` : ''}</button>
        </div>
      )}

      {!data ? <Spinner /> : tab === 'list' ? (
        <div className="stack">
          {items.length === 0 && (
            <Empty title={isOwn ? 'Nothing here yet' : `${firstName(person)} has not added ideas yet`}>
              {isOwn ? 'Tap “Add idea” any time you spot something. Links, photos or just a note.' : 'Check back soon, or log a gift you’re getting under “Other gifts”.'}
            </Empty>
          )}
          {items.map((it) => (
            <Item key={it.id} it={it} showClaims={showClaims} editable={editable} meId={me.id} byId={byId} sharesSide={sharesSide}
              claims={active.filter((c) => c.item_id === it.id)}
              onEdit={() => setItemSheet({ open: true, item: it })}
              onClaim={(claim) => setClaimSheet({ open: true, item: it, claim: claim || null })}
              onGot={async () => { await archiveItem(it.id); toast('Moved to received'); refresh(); }} />
          ))}

          {editable && done.length > 0 && (
            <>
              <button className="btn plain" onClick={() => setShowDone((s) => !s)}>{showDone ? 'Hide' : 'Show'} received & done ({done.length})</button>
              {showDone && done.map((it) => (
                <div key={it.id} className="item taken"><div className="item-main"><div className="grow"><p className="item-title">{it.title}</p>
                  <div className="item-meta"><button className="btn small gray" onClick={async () => { await archiveItem(it.id, false); refresh(); }}>Put back on list</button></div></div></div></div>
              ))}
            </>
          )}
        </div>
      ) : (
        <BoughtTab offList={offList} past={past} byId={byId} sharesSide={sharesSide} meId={me.id}
          onEdit={(c) => setClaimSheet({ open: true, item: null, claim: c })} />
      )}

      {/* actions */}
      {tab === 'list' && editable && (
        <motion.button className="btn fab" whileTap={{ scale: 0.95 }} onClick={() => setItemSheet({ open: true, item: null })}><IconPlus size={22} /> Add idea</motion.button>
      )}
      {tab === 'bought' && showClaims && (
        <motion.button className="btn fab" whileTap={{ scale: 0.95 }} onClick={() => setClaimSheet({ open: true, item: null, claim: null })}><IconPlus size={22} /> Add another gift</motion.button>
      )}

      <ItemSheet open={itemSheet.open} onClose={() => setItemSheet((s) => ({ ...s, open: false }))} owner={person} item={itemSheet.item} onSaved={refresh} />
      <ClaimSheet open={claimSheet.open} onClose={() => setClaimSheet((s) => ({ ...s, open: false }))} recipient={person} item={claimSheet.item} claim={claimSheet.claim} onSaved={refresh} />
      {editable && !isOwn && <PersonSheet open={profile} onClose={() => setProfile(false)} person={person} mode={me.is_admin ? 'admin' : 'self'} title={`${firstName(person)}’s profile`} onSaved={() => window.dispatchEvent(new Event('wgi-reload'))} />}
    </main>
  );
}

function Item({ it, claims, showClaims, editable, meId, byId, sharesSide, onEdit, onClaim, onGot }) {
  const [shown, setShown] = useState(false);
  const bought = claims.find((c) => c.state === 'bought');
  const thinking = claims.filter((c) => c.state === 'thinking');
  const mine = claims.find((c) => c.claimer_id === meId);
  const takenByOther = showClaims && bought && bought.claimer_id !== meId;
  const who = (c) => (sharesSide(c.claimer_id) ? firstName(byId[c.claimer_id]) : 'Someone on the other side');
  const claimer = takenByOther ? byId[bought.claimer_id] : null;

  return (
    <motion.div layout="position" className={`item ${takenByOther ? 'taken' : ''} ${mine && !takenByOther ? 'mine' : ''}`}>
      <div className="item-main">
        {it.image_url && <span className="thumb"><img src={it.image_url} alt="" loading="lazy" /></span>}
        <div className="grow">
          <p className="item-title">{it.title}</p>
          <div className="item-meta">
            {it.priority > 0 && <span className="prio">{it.priority === 2 ? 'Really want' : 'Would love'}</span>}
            {it.price != null && <span className="tnum">{money(Number(it.price))}</span>}
            {it.url && <a href={it.url} target="_blank" rel="noopener noreferrer">{host(it.url)} ↗</a>}
          </div>
          {it.note && <p className="item-note">{it.note}</p>}
        </div>
      </div>

      <div className="item-foot">
        {takenByOther && (
          <>
            <span className="pill ok">Taken</span>
            <Reveal shown={shown} onToggle={() => setShown((s) => !s)} name={who(bought)} />
            {shown && claimer?.email && sharesSide(claimer.id) && <a className="small" href={`mailto:${claimer.email}?subject=${encodeURIComponent('About the gift for ' + it.title)}`}>Message</a>}
          </>
        )}
        {showClaims && !takenByOther && mine && (
          <>
            <span className={`pill ${mine.state === 'bought' ? 'ok' : 'warn'}`}>{mine.state === 'bought' ? 'You’re getting this' : 'You said maybe'}</span>
            <button className="btn small gray" onClick={() => onClaim(mine)}>Change</button>
          </>
        )}
        {showClaims && !takenByOther && !mine && (
          <>
            <button className="btn small soft" onClick={() => onClaim(null)}>I’ll get this</button>
            {thinking.length > 0 && <ThinkingPill thinking={thinking} who={who} />}
          </>
        )}
        {showClaims && !takenByOther && mine && thinking.filter((c) => c.claimer_id !== meId).length > 0 && <ThinkingPill thinking={thinking.filter((c) => c.claimer_id !== meId)} who={who} />}
        {editable && <button className="btn small plain" style={{ marginLeft: 'auto' }} onClick={onEdit}>Edit</button>}
        {editable && !showClaims && <button className="btn small gray" onClick={onGot}>Received</button>}
      </div>
    </motion.div>
  );
}

function ThinkingPill({ thinking, who }) {
  const [shown, setShown] = useState(false);
  return <Reveal shown={shown} onToggle={() => setShown((s) => !s)} name={thinking.map(who).join(', ')} prefix={`${thinking.length} said maybe`} />;
}

/** Blurred name until tapped, so a glimpse over someone's shoulder spoils nothing. Screen readers get the name only once shown. */
function Reveal({ shown, onToggle, name, prefix }) {
  return (
    <button className="reveal" aria-pressed={shown} onClick={onToggle}>
      {prefix && <span>{prefix}:</span>}
      <span className="blur" aria-hidden={!shown}>{name}</span>
      {!shown && <><IconEye size={15} /><span className="sr">Show who</span></>}
    </button>
  );
}

function BoughtTab({ offList, past, byId, sharesSide, meId, onEdit }) {
  const who = (c) => (c.claimer_id === meId ? 'You' : sharesSide(c.claimer_id) ? firstName(byId[c.claimer_id]) : 'Someone on the other side');
  return (
    <div className="stack">
      <p className="muted small">Gifts people are getting that aren’t on the list, so nobody doubles up. Tap a blurred name to see who.</p>
      {offList.length === 0 && <Empty title="Nothing logged">Getting something that isn’t on the list? Add it here.</Empty>}
      {offList.map((c) => <OffRow key={c.id} c={c} who={who(c)} mine={c.claimer_id === meId} onEdit={() => onEdit(c)} />)}
      {past.length > 0 && <p className="section-title" style={{ marginTop: 20 }}>Past gifts</p>}
      {past.length > 0 && (
        <div className="list">
          {past.map((c) => (
            <div key={c.id} className="list-row"><div className="grow"><b style={{ fontWeight: 600 }}>{c.description}</b>
              <div className="muted small">{who(c)} · {c.occasion_type === 'birthday' ? 'Birthday' : 'Christmas'} {c.occasion_date.slice(0, 4)}</div></div></div>
          ))}
        </div>
      )}
    </div>
  );
}
function OffRow({ c, who, mine, onEdit }) {
  const [shown, setShown] = useState(mine);
  return (
    <div className="item"><div className="item-main">
      <div className="grow"><p className="item-title">{c.description}</p>
        <div className="item-meta"><span className={`pill ${c.state === 'bought' ? 'ok' : 'warn'}`}>{c.state === 'bought' ? 'Getting it' : 'Maybe'}</span>
          <span>{c.occasion_type === 'birthday' ? 'Birthday' : 'Christmas'} · {fmtDay(c.occasion_date)}</span></div></div></div>
      <div className="item-foot">
        <Reveal shown={shown} onToggle={() => setShown((s) => !s)} name={who} />
        {mine && <button className="btn small plain" style={{ marginLeft: 'auto' }} onClick={onEdit}>Change</button>}
      </div>
    </div>
  );
}
