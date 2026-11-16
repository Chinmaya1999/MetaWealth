import { logger } from "./logger";
import { env } from "../config/env";
export interface Mail { to: string; subject: string; text: string }
/** Mail adapter. Set SMTP_URL (e.g. smtp://user:pass@host:587) to send for real; otherwise the message is written to the server log (development). */
export async function sendMail(m: Mail) {
  if (process.env.SMTP_URL) {
    try {
      const nodemailer: any = await import("nodemailer".toString());
      await nodemailer.createTransport(process.env.SMTP_URL).sendMail({ from: process.env.MAIL_FROM ?? "MetaWealth Capital <no-reply@metawealth.example>", ...m }); return;
    } catch (e) { logger.error({ err: String(e) }, "mail send failed"); return; }
  }
  logger.info({ to: m.to, subject: m.subject, body: env.NODE_ENV === "production" ? undefined : m.text }, "MOCK EMAIL");
}
