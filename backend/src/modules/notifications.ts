import { Router } from "express";
import mongoose from "mongoose";
import { Notification } from "../database/models/Notification";
import { User } from "../database/models/User";
import { Client, PlanVersion } from "../database/models";
import { requireAuth, requirePermission } from "../middleware/auth";
import { sendMail } from "../utils/mailer";
import { logger } from "../utils/logger";

/** Create an in-app notification (and an email through the mail adapter). A dedupeKey makes it safe to call repeatedly. */
export async function notify(userIds: unknown[], n: { kind: string; title: string; body?: string; link?: string; dedupeKey?: string; email?: boolean }) {
  for (const uid of userIds) {
    if (!uid) continue;
    if (n.dedupeKey && (await Notification.exists({ userId: uid, dedupeKey: n.dedupeKey }))) continue;
    await Notification.create({ userId: uid, kind: n.kind, title: n.title, body: n.body, link: n.link, dedupeKey: n.dedupeKey });
    if (n.email !== false) { const u = await User.findById(uid).select("email"); if (u) await sendMail({ to: u.email, subject: n.title, text: `${n.body ?? ""}\n${n.link ?? ""}`.trim() }); }
  }
}
export const staffIds = async (roles = ["reviewer", "admin", "super_admin"]) => (await User.find({ role: mongoose.trusted({ $in: roles }) as any, isActive: true, deletedAt: null }).select("_id")).map((u) => u._id);

const RENEW_AFTER_DAYS = 330; // about 11 months: renewal is suggested at 12
/** Flags clients whose released plan is about a year old and tells the client and advisor. Idempotent. */
export async function runRenewalCheck(now = new Date()) {
  const cutoff = new Date(now.getTime() - RENEW_AFTER_DAYS * 86400000);
  const due = await PlanVersion.aggregate([{ $match: { status: "released" } }, { $sort: { releasedAt: -1 } }, { $group: { _id: "$clientId", releasedAt: { $first: "$releasedAt" }, version: { $first: "$version" } } }, { $match: { releasedAt: { $lte: cutoff } } }]);
  let flagged = 0;
  for (const d of due) {
    const c = await Client.findOne({ _id: d._id, deletedAt: null }); if (!c) continue;
    if (c.status === "released") { c.status = "renewal_due"; await c.save(); flagged++; }
    const key = `renewal:${c._id}:v${d.version}`;
    await notify([c.userId], { kind: "renewal", title: "Time to review your financial plan", body: "Your plan is about a year old. Update your details so your advisor can refresh it.", link: "/client/questionnaire", dedupeKey: key });
    await notify([c.advisorId], { kind: "renewal", title: `Plan renewal due: ${c.name}`, body: `Version ${d.version} was released over 11 months ago.`, link: `/advisor/clients/${c._id}`, dedupeKey: key });
  }
  return { checked: due.length, flagged };
}
export function startScheduler() { // daily; first run shortly after boot
  const tick = () => runRenewalCheck().then((r) => logger.info(r, "renewal check")).catch((e) => logger.error({ err: String(e) }, "renewal check failed"));
  setTimeout(tick, 15_000); setInterval(tick, 24 * 3600_000).unref();
}

export const notificationsRouter = Router();
notificationsRouter.use(requireAuth);
notificationsRouter.get("/", async (req, res, next) => { try { const items = await Notification.find({ userId: req.auth!.userId }).sort({ createdAt: -1 }).limit(30); res.json({ items, unread: items.filter((i) => !i.readAt).length }); } catch (e) { next(e); } });
notificationsRouter.post("/read-all", async (req, res, next) => { try { await Notification.updateMany({ userId: req.auth!.userId, readAt: null }, { readAt: new Date() }); res.json({ ok: true }); } catch (e) { next(e); } });
notificationsRouter.post("/:id/read", async (req, res, next) => { try { await Notification.updateOne({ _id: req.params.id, userId: req.auth!.userId }, { readAt: new Date() }); res.json({ ok: true }); } catch (e) { next(e); } });
notificationsRouter.post("/run-renewal-check", requirePermission("config:write"), async (_req, res, next) => { try { res.json(await runRenewalCheck()); } catch (e) { next(e); } });
