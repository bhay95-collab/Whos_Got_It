import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useApp } from './lib/ctx.jsx';
import { useRoute } from './lib/router.js';
import { signOut } from './lib/api.js';
import { Toasts, IconHome, IconList, IconGift, IconMe, IconAdmin, Spinner } from './ui.jsx';
import PersonSheet from './sheets/PersonSheet.jsx';
import Login from './pages/Login.jsx';
import Home from './pages/Home.jsx';
import Person from './pages/Person.jsx';
import Santa from './pages/Santa.jsx';
import Me from './pages/Me.jsx';
import Admin from './pages/Admin.jsx';

export default function App() {
  const { auth, fam, famError, me, toasts, reload } = useApp();
  const [path, go] = useRoute();
  const [skipOnboard, setSkipOnboard] = useState(false);
  useEffect(() => { window.scrollTo(0, 0); }, [path]);

  let body;
  if (!auth.ready) body = <main className="shell"><Spinner /></main>;
  else if (!auth.session) body = <Login />;
  else if (famError) body = <main className="shell"><div className="empty"><b>Couldn’t load</b>{famError}<p style={{ marginTop: 16 }}><button className="btn" onClick={reload}>Try again</button></p></div></main>;
  else if (!fam) body = <main className="shell"><Spinner /></main>;
  else if (!me) body = <main className="shell"><div className="empty"><b>This login isn’t linked to a person</b>Sign out and try again, or ask the admin.<p style={{ marginTop: 16 }}><button className="btn" onClick={() => signOut()}>Sign out</button></p></div></main>;
  else {
    const seg = path.split('/')[1] || '';
    const page =
      path.startsWith('/p/') ? (path.slice(3) === me.id ? <Person key={me.id} id={me.id} go={go} /> : <Person key={path} id={path.slice(3)} go={go} />) :
      seg === 'mine' ? <Person key="mine" id={me.id} go={go} /> :
      seg === 'santa' ? <Santa go={go} /> :
      seg === 'me' ? <Me go={go} /> :
      seg === 'admin' && me.is_admin ? <Admin /> :
      <Home go={go} />;
    const tabs = [
      ['', 'Family', IconHome], ['mine', 'My list', IconList], ['santa', 'Santa', IconGift], ['me', 'Me', IconMe],
      ...(me.is_admin ? [['admin', 'People', IconAdmin]] : []),
    ];
    const current = seg === 'p' ? '' : seg;
    body = (
      <>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={path} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}>{page}</motion.div>
        </AnimatePresence>
        <div className="tabbar"><nav aria-label="Main">
          {tabs.map(([to, label, Icon]) => (
            <button key={to} className="tab" aria-current={current === to ? 'page' : undefined} onClick={() => go('/' + to)}><Icon />{label}</button>
          ))}
        </nav></div>
        <PersonSheet open={!skipOnboard && (!me.birth_month || !me.email)} onClose={() => setSkipOnboard(true)} person={me} mode="self" title={`Welcome, ${me.full_name.split(' ')[0]}!`} onSaved={reload} />
      </>
    );
  }
  return <>{body}<Toasts toasts={toasts} /></>;
}
