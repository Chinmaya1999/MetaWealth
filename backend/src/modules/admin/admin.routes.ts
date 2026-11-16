import { Router } from "express";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import { z } from "zod";
import mongoose from "mongoose";
import { requireAuth, requirePermission, forgetUser } from "../../middleware/auth";
import { AssumptionSet, Client, PlanVersion } from "../../database/models";
import { AuditLog } from "../../database/models/AuditLog";
import { User } from "../../database/models/User";
import { activeAssumptions } from "../assumptions.service";
import { audit } from "../audit";
import { HttpError } from "../../utils/errors";

export const adminRouter = Router();
adminRouter.use(requireAuth);
adminRouter.get("/assumptions", requirePermission("config:write"), async (_q, res, next) => { try { res.json(await activeAssumptions()); } catch (e) { next(e); } });
// New version each time; plans keep the version they were produced with.
adminRouter.put("/assumptions", requirePermission("config:write"), async (req, res, next) => {
  try {
    const { values, reason } = z.object({ values: z.record(z.any()), reason: z.string().min(5) }).parse(req.body);
    const cur = await activeAssumptions(); const merged = { ...cur.values, ...values };
    await AssumptionSet.updateMany({ active: true }, { active: false });
    const a = await AssumptionSet.create({ version: cur.version + 1, active: true, values: merged, reason, createdBy: req.auth!.userId });
    await audit(req, "assumptions.update", "AssumptionSet", String(a._id), cur.values, merged, reason); res.json({ version: a.version, values: merged });
  } catch (e) { next(e); }
});
adminRouter.get("/audit", requirePermission("audit:read"), async (_q, res, next) => { try { res.json({ items: await AuditLog.find().sort({ createdAt: -1 }).limit(200) }); } catch (e) { next(e); } });
adminRouter.get("/users", requirePermission("user:manage"), async (_q, res, next) => {
  try {
    const [users, counts] = await Promise.all([User.find({ deletedAt: null }).select("email name role isActive lockedUntil createdAt").sort({ createdAt: 1 }), Client.aggregate([{ $match: { deletedAt: null } }, { $group: { _id: "$advisorId", n: { $sum: 1 } } }])]);
    const cm = new Map(counts.map((x: any) => [String(x._id), x.n]));
    res.json({ items: users.map((u) => ({ ...u.toObject(), clientCount: ["advisor", "reviewer", "admin", "super_admin"].includes(u.role) ? cm.get(String(u._id)) ?? 0 : undefined })) });
  } catch (e) { next(e); }
});
// edit a user: name, role (staff only), active flag. Admins cannot lock themselves out.
adminRouter.patch("/users/:id", requirePermission("user:manage"), async (req, res, next) => {
  try {
    const b = z.object({ name: z.string().min(2).optional(), role: z.enum(["advisor", "reviewer", "admin"]).optional(), isActive: z.boolean().optional() }).parse(req.body);
    const u = await User.findOne({ _id: req.params.id, deletedAt: null }); if (!u) throw new HttpError(404, "User not found", "NOT_FOUND");
    const self = String(u._id) === req.auth!.userId;
    if (u.role === "super_admin" && req.auth!.role !== "super_admin") throw new HttpError(403, "Only a super admin can change a super admin", "FORBIDDEN");
    if (b.role && u.role === "client") throw new HttpError(400, "A client account cannot be given a staff role", "VALIDATION");
    if (b.role && (b.role === "admin" || u.role === "admin") && req.auth!.role !== "super_admin") throw new HttpError(403, "Only a super admin can grant or remove the admin role", "FORBIDDEN");
    if (self && (b.isActive === false || (b.role && b.role !== u.role))) throw new HttpError(400, "You cannot deactivate or change your own account", "VALIDATION");
    const before = { name: u.name, role: u.role, isActive: u.isActive };
    if (b.name) u.name = b.name; if (b.role) u.role = b.role; if (b.isActive !== undefined) { u.isActive = b.isActive; if (!b.isActive) (u as any).refreshTokens = []; }
    await u.save(); forgetUser(String(u._id)); await audit(req, "user.update", "User", String(u._id), before, { name: u.name, role: u.role, isActive: u.isActive });
    res.json({ user: { _id: u._id, name: u.name, email: u.email, role: u.role, isActive: u.isActive } });
  } catch (e) { next(e); }
});
adminRouter.post("/users/:id/reset-password", requirePermission("user:manage"), async (req, res, next) => {
  try {
    const u = await User.findOne({ _id: req.params.id, deletedAt: null }); if (!u) throw new HttpError(404, "User not found", "NOT_FOUND");
    if (u.role === "super_admin" && req.auth!.role !== "super_admin") throw new HttpError(403, "Only a super admin can reset a super admin", "FORBIDDEN");
    const pw = crypto.randomBytes(9).toString("base64url");
    u.passwordHash = await bcrypt.hash(pw, 12); u.failedLogins = 0; u.lockedUntil = undefined; (u as any).refreshTokens = []; await u.save();
    await audit(req, "user.reset_password", "User", String(u._id)); res.json({ email: u.email, temporaryPassword: pw });
  } catch (e) { next(e); }
});
// reassign a client to another advisor
adminRouter.patch("/clients/:id/advisor", requirePermission("user:manage"), async (req, res, next) => {
  try {
    const { advisorId } = z.object({ advisorId: z.string().min(1) }).parse(req.body);
    const adv = await User.findOne({ _id: advisorId, isActive: true, deletedAt: null, role: mongoose.trusted({ $in: ["advisor", "reviewer", "admin", "super_admin"] }) as any });
    if (!adv) throw new HttpError(400, "Choose an active staff member", "VALIDATION");
    const c = await Client.findOne({ _id: req.params.id, deletedAt: null }); if (!c) throw new HttpError(404, "Client not found", "NOT_FOUND");
    const before = String(c.advisorId); c.advisorId = adv._id as any; await c.save();
    await audit(req, "client.reassign", "Client", String(c._id), { advisorId: before }, { advisorId: String(adv._id) });
    res.json({ client: { _id: c._id, advisorId: c.advisorId }, advisor: { name: adv.name, email: adv.email } });
  } catch (e) { next(e); }
});
// archive a client (soft delete; data is kept and the login is disabled)
adminRouter.delete("/clients/:id", requirePermission("user:manage"), async (req, res, next) => {
  try {
    const c = await Client.findOne({ _id: req.params.id, deletedAt: null }); if (!c) throw new HttpError(404, "Client not found", "NOT_FOUND");
    c.deletedAt = new Date(); await c.save(); await User.updateOne({ _id: c.userId }, { isActive: false, refreshTokens: [] }); forgetUser(String(c.userId));
    await audit(req, "client.archive", "Client", String(c._id)); res.json({ ok: true });
  } catch (e) { next(e); }
});
adminRouter.post("/advisors", requirePermission("user:manage"), async (req, res, next) => {
  try {
    const b = z.object({ name: z.string().min(2), email: z.string().email(), role: z.enum(["advisor", "reviewer"]).default("advisor") }).parse(req.body);
    if (await User.exists({ email: b.email })) throw new HttpError(409, "Email already exists", "DUPLICATE");
    const pw = crypto.randomBytes(9).toString("base64url");
    const u = await User.create({ ...b, passwordHash: await bcrypt.hash(pw, 12) }); await audit(req, "user.create", "User", String(u._id));
    res.status(201).json({ user: { id: u._id, email: u.email, role: u.role }, temporaryPassword: pw });
  } catch (e) { next(e); }
});
adminRouter.get("/stats", requirePermission("client:read:assigned"), async (req, res, next) => {
  try {
    const f: any = { deletedAt: null }; if (req.auth!.role === "advisor") f.advisorId = req.auth!.userId;
    const clients = await Client.find(f).select("_id status"); const ids = clients.map((c) => c._id);
    const by = (s: string) => clients.filter((c) => c.status === s).length;
    res.json({ clients: clients.length, pendingQuestionnaires: by("invited") + by("data_gathering"), readyForReview: by("ready_for_review"), draft: by("draft"), released: by("released"), plansAwaitingReview: await PlanVersion.countDocuments({ clientId: mongoose.trusted({ $in: ids }), status: "in_review" }) });
  } catch (e) { next(e); }
});

// organisation-wide overview for admins
adminRouter.get("/overview", requirePermission("user:manage"), async (_req, res, next) => {
  try {
    const [users, clients, plans, calls] = await Promise.all([
      User.find({ deletedAt: null }).select("role isActive"),
      Client.find({ deletedAt: null }).select("advisorId status residency"),
      PlanVersion.aggregate([{ $group: { _id: "$status", n: { $sum: 1 } } }]),
      AuditLog.countDocuments({ createdAt: mongoose.trusted({ $gte: new Date(Date.now() - 86400000) }) }),
    ]);
    const roleN = (r: string) => users.filter((u) => u.role === r && u.isActive).length;
    const statusN: Record<string, number> = {}; clients.forEach((c) => { statusN[c.status] = (statusN[c.status] ?? 0) + 1; });
    res.json({ users: { total: users.length, advisors: roleN("advisor"), reviewers: roleN("reviewer"), admins: roleN("admin") + roleN("super_admin"), clients: roleN("client"), inactive: users.filter((u) => !u.isActive).length },
      clients: { total: clients.length, nri: clients.filter((c) => /NRI/.test(c.residency)).length, unassigned: clients.filter((c) => !c.advisorId).length, byStatus: statusN },
      plans: Object.fromEntries(plans.map((p: any) => [p._id, p.n])), auditLast24h: calls });
  } catch (e) { next(e); }
});
