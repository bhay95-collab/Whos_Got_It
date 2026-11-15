import { useEffect, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence, useDragControls } from 'motion/react';
import { initials } from './lib/dates.js';

const SPRING = { type: 'spring', bounce: 0, duration: 0.42 };

export function Avatar({ person, size = 48 }) {
  return (
    <span className={`avatar ${person?.color || 'blue'}`} style={{ '--s': `${size}px` }} aria-hidden="true">
      {person?.photo_url ? <img src={person.photo_url} alt="" loading="lazy" /> : initials(person)}
    </span>
  );
}

/* ---------- icons (SF-style strokes) ---------- */
const I = (d, extra) => ({ size = 25 } = {}) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{d}{extra}</svg>
);
export const IconHome = I(<><path d="M4 11.5 12 5l8 6.5" /><path d="M6 10.5V19h12v-8.5" /></>);
export const IconList = I(<><path d="M9 6h11M9 12h11M9 18h11" /><path d="M4.5 6h.01M4.5 12h.01M4.5 18h.01" strokeWidth="2.6" /></>);
export const IconGift = I(<><rect x="4" y="9" width="16" height="11" rx="2" /><path d="M3 9h18v3H3zM12 9v11" /><path d="M12 9c-1-3-5-4-5-1.5S10.5 9 12 9ZM12 9c1-3 5-4 5-1.5S13.5 9 12 9Z" /></>);
export const IconMe = I(<><circle cx="12" cy="8.5" r="3.5" /><path d="M5 20c.7-3.6 3.5-5.5 7-5.5s6.3 1.9 7 5.5" /></>);
export const IconAdmin = I(<><circle cx="12" cy="12" r="3" /><path d="M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M18.4 5.6l-1.8 1.8M7.4 16.6l-1.8 1.8" /></>);
export const IconPlus = I(<path d="M12 5v14M5 12h14" />);
export const IconCheck = I(<path d="m5 12.5 4.5 4.5L19 7.5" />);
export const IconBack = I(<path d="m15 5-7 7 7 7" />);
export const IconLink = I(<><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" /><path d="M14 10a4 4 0 0 0-5.7 0l-3 3A4 4 0 0 0 11 18.7l1-1" /></>);
export const IconCamera = I(<><path d="M4 8.5A1.5 1.5 0 0 1 5.5 7H8l1.2-2h5.6L16 7h2.5A1.5 1.5 0 0 1 20 8.5v9a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17.5Z" /><circle cx="12" cy="13" r="3.4" /></>);
export const IconX = I(<path d="M6 6l12 12M18 6 6 18" />);

/* ---------- bottom sheet: spring in/out, drag the handle to dismiss with velocity handoff ---------- */
export function Sheet({ open, onClose, title, children, action }) {
  const controls = useDragControls();
  useEffect(() => {
    if (!open) return;
    const k = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [open, onClose]);
  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          <motion.div key="scrim" className="scrim" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }} onClick={onClose} />
          <motion.div
            key="sheet" className="sheet" role="dialog" aria-modal="true" aria-label={title}
            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={SPRING}
            drag="y" dragListener={false} dragControls={controls}
            dragConstraints={{ top: 0, bottom: 0 }} dragElastic={{ top: 0.04, bottom: 0.7 }}
            onDragEnd={(_, info) => { if (info.offset.y > 110 || info.velocity.y > 700) onClose(); }}
          >
            <div className="sheet-grab" onPointerDown={(e) => controls.start(e)}><i /></div>
            <div className="sheet-head">
              <h2>{title}</h2>
              {action || <button className="icon-btn" onClick={onClose} aria-label="Close"><IconX size={20} /></button>}
            </div>
            <div className="sheet-body">{children}</div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body,
  );
}

/* ---------- toast host ---------- */
export function Toasts({ toasts }) {
  return createPortal(
    <div className="toasts" aria-live="polite">
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div key={t.id} className="toast" initial={{ opacity: 0, y: -16, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -10 }} transition={SPRING}>{t.msg}</motion.div>
        ))}
      </AnimatePresence>
    </div>,
    document.body,
  );
}

/* ---------- PIN pad ---------- */
export function PinPad({ onComplete }) {
  const [pin, setPin] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [shake, setShake] = useState(0);
  const cb = useRef(onComplete);
  cb.current = onComplete;

  const press = useCallback((d) => setPin((p) => (p.length < 4 ? p + d : p)), []);
  useEffect(() => {
    const k = (e) => {
      if (/^[0-9]$/.test(e.key)) press(e.key);
      else if (e.key === 'Backspace') setPin((p) => p.slice(0, -1));
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [press]);

  useEffect(() => {
    if (pin.length !== 4 || busy) return;
    setBusy(true); setErr('');
    Promise.resolve(cb.current(pin))
      .catch((e) => { setErr(e.message); setShake((s) => s + 1); navigator.vibrate?.(60); })
      .finally(() => { setBusy(false); setPin(''); });
  }, [pin, busy]);

  return (
    <div>
      <motion.div className="dots" key={shake} animate={shake ? { x: [0, -10, 10, -7, 7, 0] } : {}} transition={{ duration: 0.38 }} role="img" aria-label={`${pin.length} of 4 digits entered`}>
        {[0, 1, 2, 3].map((i) => <span key={i} className={`dot ${i < pin.length ? 'on' : ''}`} />)}
      </motion.div>
      <p className="error" style={{ textAlign: 'center', minHeight: '1.4em' }}>{err}</p>
      <div className="keys">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => <button key={n} className="key" onClick={() => press(String(n))} disabled={busy}>{n}</button>)}
        <span />
        <button className="key" onClick={() => press('0')} disabled={busy}>0</button>
        <button className="key ghost" onClick={() => setPin((p) => p.slice(0, -1))} aria-label="Delete">⌫</button>
      </div>
    </div>
  );
}

export function Empty({ title, children }) {
  return <div className="empty"><b>{title}</b>{children}</div>;
}
export function Spinner() {
  return <div className="empty" role="status">Loading…</div>;
}

export function Field({ label, children, group }) {
  const Tag = group ? 'div' : 'label';
  return <Tag className="field"><span className="label">{label}</span>{children}</Tag>;
}
