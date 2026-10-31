// Provider is chosen with MAIL_PROVIDER: "resend" (default) or "smtp" (e.g. Gmail app password).
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

export interface Mail { to: string; subject: string; html: string; text: string }

const env = (k: string) => Deno.env.get(k) ?? "";

export async function sendMail(mail: Mail): Promise<void> {
  const fromName = env("MAIL_FROM_NAME") || "Teenfresh";
  const fromAddr = env("MAIL_FROM");
  const replyTo = env("MAIL_REPLY_TO") || undefined;
  if (!fromAddr) throw new Error("MAIL_FROM is not set");
  const provider = (env("MAIL_PROVIDER") || "resend").toLowerCase();

  if (provider === "resend") {
    const key = env("RESEND_API_KEY");
    if (!key) throw new Error("RESEND_API_KEY is not set");
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: `${fromName} <${fromAddr}>`, to: [mail.to], subject: mail.subject,
        html: mail.html, text: mail.text, ...(replyTo ? { reply_to: replyTo } : {}),
      }),
    });
    if (!res.ok) throw new Error(`Resend ${res.status}: ${(await res.text()).slice(0, 300)}`);
    return;
  }

  if (provider === "smtp") {
    const port = Number(env("SMTP_PORT") || 465);
    const client = new SMTPClient({
      connection: { hostname: env("SMTP_HOST"), port, tls: port === 465, auth: { username: env("SMTP_USER"), password: env("SMTP_PASS") } },
    });
    try {
      await client.send({ from: `${fromName} <${fromAddr}>`, to: mail.to, replyTo, subject: mail.subject, content: mail.text, html: mail.html });
    } finally {
      await client.close();
    }
    return;
  }
  throw new Error(`Unknown MAIL_PROVIDER "${provider}"`);
}
