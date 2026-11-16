// Decides which emails should exist, and what they look like. Pure functions: data in, email objects out.
import { nextBirthday } from '../src/lib/dates.js';

export const BIRTHDAY_LEAD_DAYS = 42;   // 6 weeks
const first = (p) => p.full_name.split(' ')[0];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const plural = (n, one, many) => (n === 1 ? one : many);

/* ---------- design: the family's colour band on top, logo + family name, white card (see DESIGN.md) ---------- */
// [light accent, dark-mode accent, text on dark-mode accent]: same values as src/styles.css
const ACCENTS = {
  coral: ['#b4483a', '#ef8c79', '#2a0f09'], teal: ['#0b7080', '#5fc4d1', '#05252a'], indigo: ['#4a58b8', '#9aa6f0', '#0f1440'],
  plum: ['#8a3f8f', '#d79be0', '#2e0f33'], forest: ['#2f7a4b', '#7fd09b', '#08240f'], honey: ['#9a6200', '#f0b95a', '#2e1d00'],
};
const C = { bg: '#fcf6f1', card: '#ffffff', text: '#2b1f1b', text2: '#75645d', line: '#f0e5de', tile: '#f2e8e0',
  dbg: '#140e0c', dcard: '#221915', dtext: '#f8ede7', dtext2: '#bba8a0', dline: '#30251f', dtile: '#33271f' };
const FONT = `-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif`;

/** One layout for every email. `side` = { id, name, accent }; body/extra are already-escaped HTML. */
export function renderEmail({ siteUrl, side, preheader, title, subtitle, body = '', extra = '', button }) {
  const acc = ACCENTS[side?.accent] || ACCENTS.coral;
  const appUrl = side?.id ? `${siteUrl}/${side.id}/` : `${siteUrl}/`;
  const famName = esc(side?.name || 'Who’s Got It?');
  const btn = button ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:24px"><tr>
<td class="btn" align="center" style="background:${acc[0]};border-radius:12px"><a class="btn" href="${esc(button.url)}" style="display:block;padding:14px 22px;border-radius:12px;color:#ffffff;font-weight:600;font-size:16px;text-decoration:none;font-family:${FONT}">${esc(button.label)}</a></td>
</tr></table>` : '';
  return `<!doctype html><html lang="en-AU"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light dark"><meta name="supported-color-schemes" content="light dark"><title>${esc(title)}</title>
<style>
@media (prefers-color-scheme: dark){
  .bg{background:${C.dbg}!important} .card{background:${C.dcard}!important} .t1{color:${C.dtext}!important} .t2{color:${C.dtext2}!important}
  .line{border-color:${C.dline}!important} .tile{background:${C.dtile}!important} .acc{color:${acc[1]}!important}
  .btn{background:${acc[1]}!important;color:${acc[2]}!important}
}
</style></head>
<body class="bg" style="margin:0;padding:0;background:${C.bg}">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all">${esc(preheader)}${'&#8199;&#847;'.repeat(40)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="bg" style="background:${C.bg}"><tr><td align="center" style="padding:24px 16px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;font-family:${FONT}">
<tr><td style="background:${acc[0]};border-radius:20px 20px 0 0;padding:16px 24px">
  <table role="presentation" cellpadding="0" cellspacing="0"><tr>
  <td><img src="${siteUrl}/icons/icon-192.png" width="28" height="28" alt="" style="display:block;border-radius:7px"></td>
  <td style="padding-left:10px;font-size:14px;font-weight:600;color:#ffffff;font-family:${FONT}">${famName}</td></tr></table>
</td></tr>
<tr><td class="card" style="background:${C.card};border-radius:0 0 20px 20px;padding:24px">
  <div class="t1" style="font-size:24px;font-weight:700;letter-spacing:-0.5px;line-height:1.2;color:${C.text}">${esc(title)}</div>
  ${subtitle ? `<div class="t2" style="font-size:15px;line-height:1.4;color:${C.text2};margin-top:6px">${esc(subtitle)}</div>` : ''}
  ${body ? `<div class="t1" style="font-size:16px;line-height:1.5;color:${C.text};margin-top:16px">${body}</div>` : ''}
  ${extra}${btn}
</td></tr>
<tr><td align="center" style="padding:20px 8px 8px;font-size:12px;line-height:1.6;font-family:${FONT}">
  <span class="t2" style="color:${C.text2}">Who’s Got It?</span><br>
  <a class="acc" href="${appUrl}" style="color:${acc[0]};font-weight:600;text-decoration:none">Open ${famName}</a>
</td></tr>
</table></td></tr></table></body></html>`;
}

/** Up to 3 ideas as rows: photo if there is one, else a numbered tile. */
function ideaList(ideas, acc) {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${ideas.map((i, n) => {
    const meta = [i.price != null ? `$${Number(i.price) % 1 ? Number(i.price).toFixed(2) : Number(i.price)}` : null, i.url ? host(i.url) : null].filter(Boolean).map(esc).join('&nbsp;&nbsp;');
    const pic = i.image_url
      ? `<img src="${esc(i.image_url)}" width="44" height="44" alt="" style="display:block;width:44px;height:44px;border-radius:10px;object-fit:cover">`
      : `<div class="tile" style="width:44px;height:44px;border-radius:10px;background:${C.tile};text-align:center;line-height:44px;font-size:15px;font-weight:700"><span class="acc" style="color:${acc[0]}">${n + 1}</span></div>`;
    return `<tr><td class="line" style="padding:12px 0;${n ? `border-top:1px solid ${C.line};` : ''}">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td width="44" valign="top">${pic}</td>
<td valign="middle" style="padding-left:12px"><div class="t1" style="font-size:15px;font-weight:600;line-height:1.3;color:${C.text}">${esc(i.title)}</div>
${meta ? `<div class="t2" style="font-size:13px;color:${C.text2};margin-top:2px">${meta}</div>` : ''}</td></tr></table></td></tr>`;
  }).join('')}</table>`;
}
const host = (u) => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return ''; } };
const longDate = (iso) => new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });
const toGo = (days) => (days === 1 ? 'tomorrow' : `${days} days to go`);

/** Ideas still free for someone: on their list, not archived, nobody "getting it" for an upcoming occasion. */
function freeIdeas(personId, items, claims, today) {
  const taken = new Set(claims.filter((c) => c.state === 'bought' && c.item_id && c.occasion_date >= today).map((c) => c.item_id));
  return items.filter((i) => i.person_id === personId && !i.archived_at && !taken.has(i.id))
    .sort((a, b) => (b.priority || 0) - (a.priority || 0) || String(b.created_at).localeCompare(String(a.created_at)));
}

/** Birthday reminders: from 6 weeks out, once per person per birthday, to the family on their side(s). */
export function planBirthdayEmails({ people, personSides, sides = [], items, claims = [], itemCounts = {}, today, siteUrl }) {
  const sidesOf = (id) => personSides.filter((s) => s.person_id === id).map((s) => s.side_id);
  const sideRow = (id) => sides.find((s) => s.id === id) || { id };
  const out = [];
  for (const p of people) {
    if (!p.active) continue;
    const b = nextBirthday(p, today);
    if (!b || b.days < 1 || b.days > BIRTHDAY_LEAD_DAYS) continue;
    const mine = sidesOf(p.id);
    const name = first(p);
    const free = items ? freeIdeas(p.id, items, claims, today) : [];
    const n = items ? free.length : (itemCounts[p.id] || 0);
    const sub = [longDate(b.iso), toGo(b.days), b.turning ? `turning ${b.turning}` : null].filter(Boolean).join(' · ');

    for (const r of people) {
      if (!r.active || r.is_child || !r.email || r.id === p.id) continue;
      const shared = sidesOf(r.id).find((s) => mine.includes(s));
      if (!shared) continue;
      const url = `${siteUrl}/${shared}/#/p/${p.id}`;
      const side = sideRow(shared);
      const acc = ACCENTS[side.accent] || ACCENTS.coral;
      const shown = free.slice(0, 3);
      const extra = shown.length
        ? `<div class="t2" style="font-size:13px;font-weight:600;color:${C.text2};margin:20px 0 2px">Ideas still up for grabs</div>${ideaList(shown, acc)}`
          + (n > 3 ? `<div class="t2" style="font-size:13px;color:${C.text2};margin-top:6px">+ ${n - 3} more on ${esc(name)}’s list</div>` : '')
        : '';
      out.push({
        kind: 'birthday', to_email: r.email,
        subject: `${name}’s birthday is coming up 🎁`,
        text_body: `${name}’s birthday is coming up! ${sub}. ${n ? `${n} ${plural(n, 'idea is', 'ideas are')} still up for grabs on their list.` : `Nothing on their list yet.`}\n${url}`,
        html: renderEmail({
          siteUrl, side, title: `${name}’s birthday is coming up!`, subtitle: sub,
          preheader: n ? `${toGo(b.days)[0].toUpperCase()}${toGo(b.days).slice(1)}. ${n} ${plural(n, 'idea', 'ideas')} still up for grabs on ${name}’s list.` : `${toGo(b.days)[0].toUpperCase()}${toGo(b.days).slice(1)}. Nothing on ${name}’s list yet.`,
          body: shown.length ? '' : `Nothing on ${esc(name)}’s list yet. Maybe give them a nudge?`,
          extra, button: { label: `Have a look at ${name}’s list`, url },
        }),
        dedupe_key: `bday:${p.id}:${b.iso}:${r.id}`,
      });
    }
    // gentle nudge to the birthday person if their own list is thin
    if (!p.is_child && p.email && n < 3 && mine.length) {
      const url = `${siteUrl}/${mine[0]}/#/mine`;
      const listLine = n ? `your list has ${n} ${plural(n, 'idea', 'ideas')}` : 'your list is empty';
      out.push({
        kind: 'birthday', to_email: p.email,
        subject: 'Your birthday’s coming up 🎂',
        text_body: `Your birthday's coming up! ${toGo(b.days)}, and ${listLine}. Add a few things you'd love so the family knows what to get.\n${url}`,
        html: renderEmail({
          siteUrl, side: sideRow(mine[0]), title: 'Your birthday’s coming up!', subtitle: sub,
          preheader: `Add a few ideas so the family knows what you’d love.`,
          body: `Right now ${listLine}. Add a few things you’d love so the family knows what to get.`,
          button: { label: 'Add some ideas', url },
        }),
        dedupe_key: `bday-self:${p.id}:${b.iso}`,
      });
    }
  }
  return out;
}

/** "Your Secret Santa is ready": deliberately no names in the email. */
export function planSantaEmails({ draw, side, sideName, givers, people, siteUrl }) {
  const url = `${siteUrl}/${draw.side_id}/#/santa`;
  const s = side || { id: draw.side_id, name: sideName };
  return givers
    .filter((g) => !g.is_child && g.email)
    .map((g) => {
      const kids = people.filter((k) => k.is_child && k.household_id && k.household_id === g.household_id && givers.some((x) => x.id === k.id));
      const kidLine = kids.length ? ` ${kids.map(first).join(' and ')} ${kids.length > 1 ? 'have' : 'has'} a pick too, on the same page.` : '';
      return {
        kind: 'santa', to_email: g.email,
        subject: 'Your Secret Santa is ready 🎅',
        text_body: `The ${s.name} Secret Santa draw is done! Pop into the app and unwrap who you've got. Budget $100. Shh, keep it secret.${kidLine}\n${url}`,
        html: renderEmail({
          siteUrl, side: s, title: 'Your Secret Santa is ready!', subtitle: 'Budget $100',
          preheader: 'The draw is done. Unwrap who you’ve got in the app.',
          body: `The ${esc(s.name)} draw is done! Pop into the app and unwrap who you’ve got. Shh, keep it secret.${esc(kidLine)}`,
          button: { label: 'Unwrap your Secret Santa', url },
        }),
        dedupe_key: `santa:${draw.id}:${g.id}`,
      };
    });
}

export function planAlert({ admins, key, subject, text, siteUrl = '', side }) {
  return admins.filter((a) => a.email).map((a) => ({
    kind: 'alert', to_email: a.email, subject, text_body: text,
    html: renderEmail({
      siteUrl, side, title: subject, preheader: text.split('\n')[0],
      body: esc(text).replace(/\n/g, '<br>'),
      button: siteUrl ? { label: 'Open the app', url: side?.id ? `${siteUrl}/${side.id}/#/admin` : `${siteUrl}/` } : null,
    }),
    dedupe_key: `alert:${key}:${a.id}`,
  }));
}
