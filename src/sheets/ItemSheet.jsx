import { useEffect, useRef, useState } from 'react';
import { Sheet, Field, IconCamera, IconLink } from '../ui.jsx';
import { saveItem, deleteItem, fetchPreview, uploadPhoto } from '../lib/api.js';
import { useApp } from '../lib/ctx.jsx';

const looksLikeUrl = (s) => /^https?:\/\//i.test(s.trim()) || /^[\w-]+(\.[\w-]+)+(\/\S*)?$/.test(s.trim());
const withProto = (s) => (/^https?:\/\//i.test(s.trim()) ? s.trim() : `https://${s.trim()}`);

export default function ItemSheet({ open, onClose, owner, item, onSaved }) {
  const { me, toast } = useApp();
  const blank = { title: '', url: '', price: '', note: '', priority: 0, image_url: '' };
  const [f, setF] = useState(blank);
  const [busy, setBusy] = useState(false);
  const [looking, setLooking] = useState(false);
  const [err, setErr] = useState('');
  const file = useRef(null);

  useEffect(() => {
    if (!open) return;
    setErr('');
    setF(item ? { title: item.title, url: item.url || '', price: item.price ?? '', note: item.note || '', priority: item.priority, image_url: item.image_url || '' } : blank);
  }, [open, item]); // eslint-disable-line react-hooks/exhaustive-deps

  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));

  const lookup = async (raw) => {
    if (!raw || !looksLikeUrl(raw)) return;
    setLooking(true);
    const p = await fetchPreview(withProto(raw));
    setLooking(false);
    if (!p) { toast('Could not read that page — add the name yourself'); return; }
    setF((x) => ({ ...x, title: x.title || p.title || '', image_url: x.image_url || p.image || '' }));
  };

  const pickPhoto = async (e) => {
    const file0 = e.target.files?.[0];
    if (!file0) return;
    setBusy(true);
    try { set('image_url', await uploadPhoto('item-photos', file0, 1000)); } catch (x) { setErr(x.message); }
    setBusy(false);
  };

  const save = async () => {
    let site = '';
    try { site = f.url.trim() ? new URL(withProto(f.url)).hostname.replace(/^www\./, '') : ''; } catch { /* not a real link */ }
    const title = f.title.trim() || site || (f.image_url ? 'Photo idea' : '');
    if (!title) { setErr('Give it a name, a link or a photo.'); return; }
    setBusy(true); setErr('');
    try {
      await saveItem({
        id: item?.id, person_id: owner.id, title,
        url: f.url.trim() ? withProto(f.url) : null,
        image_url: f.image_url || null,
        price: f.price === '' ? null : Number(f.price),
        note: f.note.trim() || null,
        priority: f.priority,
        ...(item ? {} : { added_by: me.id }),
      });
      toast(item ? 'Saved' : 'Added to the list');
      onSaved(); onClose();
    } catch (x) { setErr(x.message); }
    setBusy(false);
  };

  const remove = async () => {
    if (!confirm('Remove this idea?')) return;
    setBusy(true);
    try { await deleteItem(item.id); onSaved(); onClose(); } catch (x) { setErr(x.message); }
    setBusy(false);
  };

  return (
    <Sheet open={open} onClose={onClose} title={item ? 'Edit idea' : 'Add an idea'}>
      <Field label="Paste a link (optional)">
        <div className="row" style={{ gap: 8 }}>
          <input className="input" inputMode="url" autoCapitalize="none" autoCorrect="off" placeholder="https://…" value={f.url}
            onChange={(e) => set('url', e.target.value)}
            onPaste={(e) => { const t = e.clipboardData.getData('text'); if (looksLikeUrl(t)) setTimeout(() => lookup(t), 0); }}
            onBlur={() => lookup(f.url)} />
          <button className="icon-btn" onClick={() => lookup(f.url)} aria-label="Fetch details" style={{ flex: 'none' }}><IconLink size={20} /></button>
        </div>
        {looking && <span className="small muted">Reading the page…</span>}
      </Field>

      <Field label="What is it?">
        <input className="input" placeholder="e.g. Merino beanie, anything from Aesop" value={f.title} onChange={(e) => set('title', e.target.value)} enterKeyHint="next" />
      </Field>

      <div className="row" style={{ alignItems: 'flex-end' }}>
        <div className="grow"><Field label="Price (AUD, optional)"><input className="input" inputMode="decimal" placeholder="0" value={f.price} onChange={(e) => set('price', e.target.value.replace(/[^0-9.]/g, ''))} /></Field></div>
        <button className="btn gray" onClick={() => file.current?.click()} disabled={busy}><IconCamera size={20} /> Photo</button>
        <input ref={file} type="file" accept="image/*" hidden onChange={pickPhoto} />
      </div>
      {f.image_url && (
        <div className="row">
          <span className="thumb"><img src={f.image_url} alt="" /></span>
          <button className="btn plain small" onClick={() => set('image_url', '')}>Remove photo</button>
        </div>
      )}

      <Field label="Notes (size, colour, model…)"><textarea className="input" value={f.note} onChange={(e) => set('note', e.target.value)} /></Field>

      <Field label="How much do you want it?" group>
        <div className="seg">
          {[['Nice to have', 0], ['Would love', 1], ['Really want', 2]].map(([l, v]) => (
            <button key={v} aria-pressed={f.priority === v} onClick={() => set('priority', v)}>{l}</button>
          ))}
        </div>
      </Field>

      {err && <p className="error" role="alert">{err}</p>}
      <button className="btn block" onClick={save} disabled={busy}>{busy ? 'Saving…' : item ? 'Save' : 'Add to list'}</button>
      {item && <button className="btn danger block" onClick={remove} disabled={busy}>Remove idea</button>}
    </Sheet>
  );
}
