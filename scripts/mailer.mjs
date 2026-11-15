// Sends mail through the family Gmail account using an App Password (free, 500/day limit).
export function createMailer({ dry = false } = {}) {
  if (dry) return { async send(m) { console.log(`[dry] email to ${m.to_email}: ${m.subject}`); } };
  const user = process.env.GMAIL_USER, pass = process.env.GMAIL_APP_PASSWORD;
  if (!user || !pass) throw new Error('GMAIL_USER / GMAIL_APP_PASSWORD secrets are not set.');
  let transport;
  return {
    async send(m) {
      if (!transport) {
        const nodemailer = (await import('nodemailer')).default;
        transport = nodemailer.createTransport({ service: 'gmail', auth: { user, pass } });
      }
      await transport.sendMail({ from: `"Who’s Got It?" <${user}>`, to: m.to_email, subject: m.subject, text: m.text_body, html: m.html });
    },
  };
}
