// Decides which emails should exist. Pure functions: data in, email objects out.
import { nextBirthday, fmtBirthday } from '../src/lib/dates.js';

export const BIRTHDAY_LEAD_DAYS = 42;   // 6 weeks
const first = (p) => p.full_name.split(' ')[0];

function wrap(title, bodyHtml, buttonText, url) {
  return `<!doctype html><html><body style="margin:0;background:#fcf6f1;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#2b1f1b">
<div style="max-width:480px;margin:0 auto;padding:32px 20px">
<div style="background:#ffffff;border-radius:20px;padding:28px;box-shadow:0 2px 10px rgba(90,40,25,.08)">
<div style="font-size:22px;font-weight:700;letter-spacing:-0.02em;margin-bottom:10px">${title}</div>
<div style="font-size:16px;line-height:1.5;color:#4a3a34">${bodyHtml}</div>
<div style="margin-top:22px"><a href="${url}" style="display:inline-block;background:#b4483a;color:#ffffff;text-decoration:none;font-weight:600;padding:13px 22px;border-radius:12px">${buttonText}</a></div>
</div>
<div style="text-align:center;color:#94847d;font-size:12px;margin-top:16px">Who’s Got It? · family gifts, sorted</div>
</div></body></html>`;
}

/** Birthday reminders: from 6 weeks out, once per person per birthday, to the family on their side(s). */
export function planBirthdayEmails({ people, personSides, itemCounts = {}, today, siteUrl }) {
  const sidesOf = (id) => personSides.filter((s) => s.person_id === id).map((s) => s.side_id);
  const out = [];
  for (const p of people) {
    if (!p.active) continue;
    const b = nextBirthday(p, today);
    if (!b || b.days < 1 || b.days > BIRTHDAY_LEAD_DAYS) continue;
    const mine = sidesOf(p.id);
    const when = `${fmtBirthday(p)}${b.turning ? `, turning ${b.turning}` : ''}`;
    const inDays = b.days === 1 ? 'tomorrow' : `in ${b.days} days`;
    const n = itemCounts[p.id] || 0;

    for (const r of people) {
      if (!r.active || r.is_child || !r.email || r.id === p.id) continue;
      const shared = sidesOf(r.id).find((s) => mine.includes(s));
      if (!shared) continue;
      out.push({
        kind: 'birthday', to_email: r.email,
        subject: `${first(p)}’s birthday is ${inDays} 🎁`,
        text_body: `${first(p)}’s birthday is ${inDays} (${when}). There ${n === 1 ? 'is 1 idea' : `are ${n} ideas`} on their list.\n${siteUrl}/${shared}/#/p/${p.id}`,
        html: wrap(`${first(p)}’s birthday is ${inDays}`,
          `${when}.<br>${n ? `${n} idea${n > 1 ? 's' : ''} on their list.` : 'Nothing on their list yet.'} Have a look, and mark what you’re getting so nobody doubles up.`,
          `See ${first(p)}’s list`, `${siteUrl}/${shared}/#/p/${p.id}`),
        dedupe_key: `bday:${p.id}:${b.iso}:${r.id}`,
      });
    }
    // gentle nudge to the birthday person if their own list is thin
    if (!p.is_child && p.email && n < 3 && mine.length) {
      out.push({
        kind: 'birthday', to_email: p.email,
        subject: `Your birthday is ${inDays} — add some ideas`,
        text_body: `Your birthday is ${inDays}. Your list has ${n} idea${n === 1 ? '' : 's'}. Add a few so people know what you’d love.\n${siteUrl}/${mine[0]}/#/mine`,
        html: wrap(`Your birthday is ${inDays} 🎂`, `Your list has ${n} idea${n === 1 ? '' : 's'}. Add a few so the family knows what you’d love.`, 'Add ideas', `${siteUrl}/${mine[0]}/#/mine`),
        dedupe_key: `bday-self:${p.id}:${b.iso}`,
      });
    }
  }
  return out;
}

/** "Your Secret Santa is ready" — deliberately no names in the email. */
export function planSantaEmails({ draw, sideName, givers, people, siteUrl }) {
  const url = `${siteUrl}/${draw.side_id}/#/santa`;
  return givers
    .filter((g) => !g.is_child && g.email)
    .map((g) => {
      const kids = people.filter((k) => k.is_child && k.household_id && k.household_id === g.household_id && givers.some((x) => x.id === k.id));
      const kidLine = kids.length ? ` ${kids.map(first).join(' and ')} ${kids.length > 1 ? 'have' : 'has'} a pick too — you’ll see ${kids.length > 1 ? 'them' : 'it'} on the same page.` : '';
      return {
        kind: 'santa', to_email: g.email,
        subject: 'Your Secret Santa is ready 🎅',
        text_body: `The ${sideName} Secret Santa draw is done. Open the app to unwrap who you’ve got. Budget $100.${kidLine}\n${url}`,
        html: wrap('Your Secret Santa is ready 🎅', `The ${sideName} draw is done. Open the app to unwrap who you’ve got. Budget is $100.${kidLine}`, 'Unwrap', url),
        dedupe_key: `santa:${draw.id}:${g.id}`,
      };
    });
}

export function planAlert({ admins, key, subject, text }) {
  return admins.filter((a) => a.email).map((a) => ({
    kind: 'alert', to_email: a.email, subject, text_body: text,
    html: wrap(subject, text.replace(/\n/g, '<br>'), 'Open the app', ''),
    dedupe_key: `alert:${key}:${a.id}`,
  }));
}
