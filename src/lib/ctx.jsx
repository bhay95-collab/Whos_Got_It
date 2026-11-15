import { createContext, useContext, useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { supabase } from './supabase.js';
import { loadFamily, archiveGiven } from './api.js';

const Ctx = createContext(null);
export const useApp = () => useContext(Ctx);

export const ENTRY_SIDE = document.documentElement.dataset.side || '';

export function AppProvider({ children }) {
  const [auth, setAuth] = useState({ ready: false, session: null });
  const [fam, setFam] = useState(null);
  const [famError, setFamError] = useState('');
  const [sidePick, setSidePick] = useState(() => { try { return localStorage.getItem('wgi.side') || ''; } catch { return ''; } });
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setAuth({ ready: true, session: data.session }));
    const { data } = supabase.auth.onAuthStateChange((_e, session) => setAuth({ ready: true, session }));
    return () => data.subscription.unsubscribe();
  }, []);

  const uid = auth.session?.user.id;
  const reload = useCallback(async () => {
    if (!uid) { setFam(null); return; }
    try { await archiveGiven(); setFam(await loadFamily()); setFamError(''); }
    catch (e) { setFamError(e.message); }
  }, [uid]);
  useEffect(() => { reload(); }, [reload]);
  useEffect(() => { window.addEventListener('wgi-reload', reload); return () => window.removeEventListener('wgi-reload', reload); }, [reload]);

  // refresh when the app comes back to the foreground
  const last = useRef(0);
  useEffect(() => {
    const on = () => { if (document.visibilityState === 'visible' && Date.now() - last.current > 30000) { last.current = Date.now(); reload(); } };
    document.addEventListener('visibilitychange', on);
    return () => document.removeEventListener('visibilitychange', on);
  }, [reload]);

  const me = useMemo(() => fam?.people.find((p) => p.auth_user_id === uid) || null, [fam, uid]);
  const mySides = useMemo(() => (me && fam ? fam.personSides.filter((s) => s.person_id === me.id).map((s) => s.side_id) : []), [me, fam]);

  // which side we are looking at: the link you opened (if you belong), else your last pick, else your first side
  const side = useMemo(() => {
    if (!me) return ENTRY_SIDE || sidePick;
    for (const s of [ENTRY_SIDE, sidePick]) if (s && mySides.includes(s)) return s;
    return mySides[0] || '';
  }, [me, mySides, sidePick]);
  const setSide = (s) => { setSidePick(s); try { localStorage.setItem('wgi.side', s); } catch { /* private mode */ } };

  const sidePeople = useMemo(() => {
    if (!fam || !side) return [];
    const ids = new Set(fam.personSides.filter((s) => s.side_id === side).map((s) => s.person_id));
    return fam.people.filter((p) => ids.has(p.id) && p.active);
  }, [fam, side]);
  const byId = useMemo(() => Object.fromEntries((fam?.people || []).map((p) => [p.id, p])), [fam]);
  const sideName = fam?.sides.find((s) => s.id === side)?.name || '';

  const toast = useCallback((msg) => {
    const id = Math.random();
    setToasts((t) => [...t, { id, msg }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 2600);
  }, []);

  const value = { auth, fam, famError, me, mySides, side, setSide, sidePeople, byId, sideName, reload, toast, toasts };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** People I can edit lists for: me + my children (admin: everyone). */
export function canManage(me, person) {
  if (!me || !person) return false;
  if (me.is_admin || me.id === person.id) return true;
  return person.is_child && !me.is_child && me.household_id && me.household_id === person.household_id;
}
