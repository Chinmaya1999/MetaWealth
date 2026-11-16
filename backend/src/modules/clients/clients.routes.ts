import { Router } from "express";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import multer from "multer";
import fs from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import mongoose from "mongoose";
import { Client, DocumentRec, CalculationResult, PlanVersion } from "../../database/models";
import { User } from "../../database/models/User";
import { requireAuth, requirePermission } from "../../middleware/auth";
import { loadClientFor } from "../access";
import { audit } from "../audit";
import { HttpError } from "../../utils/errors";
import { activeAssumptions } from "../assumptions.service";
import { notify } from "../notifications";
import { nriPlan, NRI_GUIDE } from "../../financial-engine/nri";
import { runEngine, ENGINE_VERSION } from "../../financial-engine/engine";
import { MockOCRProvider } from "../../ocr/provider";
import { logger } from "../../utils/logger";
import { encrypt, decrypt, mask, SENSITIVE_FIELDS, isEncrypted } from "../../security/crypto";

// Sensitive identifiers are encrypted at rest. While a document awaits confirmation the owner sees the value to check it; after confirmation it is masked.
const sealFields = (fs: any[]) => fs.map((e) => (SENSITIVE_FIELDS.includes(e.field) && e.value ? { ...e, value: encrypt(String(e.value)) } : e));
const docOut = (d: any) => { const o = d.toObject ? d.toObject() : d; delete o.storageKey; o.extracted = (o.extracted ?? []).map((e: any) => SENSITIVE_FIELDS.includes(e.field) && isEncrypted(e.value) ? { ...e, value: o.status === "confirmed" ? mask(decrypt(e.value)) : decrypt(e.value) } : e); return o; };

export const clientsRouter = Router();
clientsRouter.use(requireAuth);
const STORAGE = path.resolve(process.cwd(), "storage"); // private; never served statically
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 }, fileFilter: (_r, f, cb) => cb(null, /pdf|jpeg|png|webp|text\/(plain|csv)/.test(f.mimetype)) });

// ---- list / create / get
clientsRouter.get("/", requirePermission("client:read:assigned"), async (req, res, next) => {
  try {
    const { q, status, residency } = z.object({ q: z.string().optional(), status: z.string().optional(), residency: z.string().optional() }).parse(req.query);
    const f: any = { deletedAt: null };
    if (req.auth!.role === "advisor") f.advisorId = req.auth!.userId;
    if (status) f.status = status; if (residency) f.residency = residency;
    if (q) f.name = mongoose.trusted({ $regex: q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" });
    const clients = await Client.find(f).select("-data").sort({ updatedAt: -1 }).limit(200);
    const ids = clients.map((c) => c._id);
    // latest calculation and latest plan version per client, so the list shows plan details at a glance
    const [calcs, plans] = await Promise.all([
      CalculationResult.aggregate([{ $match: { clientId: { $in: ids } } }, { $sort: { createdAt: -1 } }, { $group: { _id: "$clientId", at: { $first: "$createdAt" }, goalsMet: { $first: "$result.summary.goalsMet" }, goalsTotal: { $first: "$result.summary.goalsTotal" }, monthlySurplus: { $first: "$result.summary.monthlySurplusNextYear" }, netWorth: { $first: "$result.netWorth.total" }, band: { $first: "$result.risk.band" }, readiness: { $first: "$result.retirement.readinessPct" }, health: { $first: "$result.healthScore" }, coverGap: { $first: "$result.insurance.additionalTermCover" }, urgent: { $first: { $size: { $filter: { input: { $ifNull: ["$result.insights", []] }, cond: { $eq: ["$$this.severity", "Urgent"] } } } } } } }]),
      PlanVersion.aggregate([{ $match: { clientId: { $in: ids } } }, { $sort: { version: -1 } }, { $group: { _id: "$clientId", id: { $first: "$_id" }, version: { $first: "$version" }, status: { $first: "$status" }, releasedAt: { $first: "$releasedAt" }, updatedAt: { $first: "$updatedAt" }, count: { $sum: 1 }, releasedVersion: { $max: { $cond: [{ $eq: ["$status", "released"] }, "$version", null] } } } }]),
    ]);
    const cm = new Map(calcs.map((x: any) => [String(x._id), x])), pm = new Map(plans.map((x: any) => [String(x._id), x]));
    const items = clients.map((c) => ({ ...c.toObject(), calc: cm.get(String(c._id)) ?? null, plan: pm.get(String(c._id)) ?? null }));
    res.json({ items, scope: req.auth!.role === "advisor" ? "mine" : "all" });
  } catch (e) { next(e); }
});

clientsRouter.post("/", requirePermission("client:write"), async (req, res, next) => {
  try {
    const b = z.object({ name: z.string().min(2), email: z.string().email(), residency: z.string().default("Resident Indian"), advisorId: z.string().optional() }).parse(req.body);
    if (await User.exists({ email: b.email })) throw new HttpError(409, "A user with this email already exists", "DUPLICATE");
    const tempPassword = crypto.randomBytes(9).toString("base64url");
    const user = await User.create({ email: b.email, name: b.name, role: "client", passwordHash: await bcrypt.hash(tempPassword, 12) });
    const advisorId = req.auth!.role === "advisor" ? req.auth!.userId : b.advisorId ?? req.auth!.userId;
    const c = await Client.create({ userId: user._id, advisorId, name: b.name, email: b.email, residency: b.residency, data: { profile: { name: b.name, residency: b.residency } } });
    await audit(req, "client.create", "Client", String(c._id), undefined, { name: b.name });
    // Mock email adapter: in production this is an invitation link via the email provider.
    logger.info({ to: b.email }, "MOCK EMAIL: client invitation issued");
    res.status(201).json({ client: c, invitation: { email: b.email, temporaryPassword: tempPassword, note: "Shown once. Production sends a one-time invitation link by email." } });
  } catch (e) { next(e); }
});

// the client's advisor (name and email only), for the "your advisor" card
clientsRouter.get("/:id/advisor", async (req, res, next) => { try { const c = await loadClientFor(req.auth!, req.params.id); const a = await User.findById(c.advisorId).select("name email"); res.json({ advisor: a ? { name: a.name, email: a.email } : null }); } catch (e) { next(e); } });
clientsRouter.get("/:id", async (req, res, next) => { try { res.json({ client: await loadClientFor(req.auth!, req.params.id) }); } catch (e) { next(e); } });

// ---- questionnaire (9 steps, autosave)
const STEP_KEYS: Record<number, string[]> = { 1: ["documents"], 2: ["profile"], 3: ["goals"], 4: ["assets"], 5: ["nonFinancial", "retirement"], 6: ["loans", "insurance"], 7: ["income"], 8: ["expenses"], 9: ["estate", "risk"] };
// step 1 (documents) is optional, so progress is measured over the eight required steps
const progressOf = (done: number[]) => Math.round((done.filter((s) => s !== 1).length / 8) * 100);
const stepSchema = z.object({ data: z.record(z.any()), complete: z.boolean().default(false) });
clientsRouter.put("/:id/questionnaire/:step", async (req, res, next) => {
  try {
    const step = z.coerce.number().int().min(1).max(9).parse(req.params.step);
    const c = await loadClientFor(req.auth!, req.params.id, true);
    const { data, complete } = stepSchema.parse(req.body);
    const allowed = STEP_KEYS[step]; const merged: any = { ...(c.data as any) };
    for (const k of Object.keys(data)) { if (!allowed.includes(k)) throw new HttpError(400, `Field group "${k}" does not belong to step ${step}`, "VALIDATION"); merged[k] = data[k]; }
    c.data = merged; c.markModified("data");
    if (complete && !c.stepsDone.includes(step)) c.stepsDone.push(step);
    if (!complete) c.stepsDone = c.stepsDone.filter((s) => s !== step) as any;
    if (c.status === "invited") c.status = "data_gathering";
    await c.save(); await audit(req, "questionnaire.step", "Client", String(c._id), undefined, { step, complete });
    res.json({ stepsDone: c.stepsDone, progress: progressOf(c.stepsDone) });
  } catch (e) { next(e); }
});
clientsRouter.get("/:id/questionnaire", async (req, res, next) => { try { const c = await loadClientFor(req.auth!, req.params.id); res.json({ data: c.data, stepsDone: c.stepsDone, progress: progressOf(c.stepsDone), status: c.status, id: c._id }); } catch (e) { next(e); } });
clientsRouter.post("/:id/questionnaire/submit", async (req, res, next) => {
  try {
    const c = await loadClientFor(req.auth!, req.params.id, true);
    const missing = [1, 2, 3, 4, 5, 6, 7, 8, 9].filter((s) => ![1].includes(s) && !c.stepsDone.includes(s)); // step 1 (documents) is optional
    if (missing.length) throw new HttpError(422, `Complete steps ${missing.join(", ")} first`, "INCOMPLETE");
    const d: any = c.data;
    if (!d.estate?.consent) throw new HttpError(422, "Consent and engagement declaration are required", "CONSENT_REQUIRED");
    c.consent = { acceptedAt: new Date(), signedName: d.estate.signedName, ip: req.ip } as any; c.status = "ready_for_review"; await c.save();
    await audit(req, "questionnaire.submit", "Client", String(c._id));
    await notify([c.advisorId], { kind: "questionnaire", title: `${c.name} submitted their questionnaire`, body: "Ready for review and a draft plan.", link: `/advisor/clients/${c._id}`, email: false });
    res.json({ status: c.status });
  } catch (e) { next(e); }
});

// ---- risk
clientsRouter.post("/:id/risk-profiler/override", requirePermission("client:write"), async (req, res, next) => {
  try {
    const b = z.object({ band: z.string(), reason: z.string().min(5) }).parse(req.body);
    const c = await loadClientFor(req.auth!, req.params.id, true);
    const d: any = { ...(c.data as any) }; const before = d.risk?.override;
    d.risk = { ...(d.risk ?? {}), override: { ...b, by: req.auth!.userId, at: new Date().toISOString() } }; c.data = d; c.markModified("data"); await c.save();
    await audit(req, "risk.override", "Client", String(c._id), before, d.risk.override, b.reason);
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// ---- calculations
// Staff may run "as of" a given date (used to replay the reference plan); clients always run as of today.
const asOf = (req: any) => { const d = req.auth.role !== "client" && req.body?.planDate ? new Date(req.body.planDate) : null; return d && !Number.isNaN(+d) ? d : new Date(); };
async function calc(req: any, c: any) {
  const A = await activeAssumptions();
  const result = runEngine(c.data as any, A.values, asOf(req));
  await CalculationResult.create({ clientId: c._id, assumptionVersion: A.version, engineVersion: ENGINE_VERSION, input: c.data, result, createdBy: req.auth.userId });
  return { result, assumptionVersion: A.version };
}
clientsRouter.post("/:id/calculations/run", async (req, res, next) => {
  try { const c = await loadClientFor(req.auth!, req.params.id); const out = await calc(req, c); await audit(req, "calc.run", "Client", String(c._id)); res.json(out); } catch (e) { next(e); }
});
clientsRouter.get("/:id/calculations/latest", async (req, res, next) => {
  try { const c = await loadClientFor(req.auth!, req.params.id); let r = await CalculationResult.findOne({ clientId: c._id }).sort({ createdAt: -1 });
    // a result produced by an older engine version is refreshed so every page has the same fields (released plans are never touched)
    if (r && (r.result as any)?.meta?.engineVersion !== ENGINE_VERSION) { try { await calc(req, c); r = await CalculationResult.findOne({ clientId: c._id }).sort({ createdAt: -1 }); } catch { /* keep the stored result */ } }
    res.json(r ? { result: r.result, assumptionVersion: r.assumptionVersion, at: (r as any).createdAt } : { result: null }); } catch (e) { next(e); }
});
clientsRouter.post("/:id/nri-plan", async (req, res, next) => {
  try {
    await loadClientFor(req.auth!, req.params.id);
    const b = z.object({ currency: z.enum(["USD", "AED", "GBP", "SGD", "CAD", "AUD", "EUR"]), fxRate: z.number().positive(), inrDepreciationPct: z.number().min(-10).max(15), monthlyRemittance: z.number().min(0).optional(), targetInr: z.number().min(0).optional(), years: z.number().min(1).max(50), returnPct: z.number().min(0).max(25), existingInr: z.number().min(0).optional() }).parse(req.body);
    res.json({ result: nriPlan(b), guide: NRI_GUIDE });
  } catch (e) { next(e); }
});
clientsRouter.post("/:id/scenarios", async (req, res, next) => {
  try {
    const c = await loadClientFor(req.auth!, req.params.id);
    const b = z.object({ retirementAge: z.number().optional(), savingsBoostPct: z.number().optional(), returnShift: z.number().optional(), salaryGrowth: z.number().optional() }).parse(req.body);
    const A = await activeAssumptions(); const base: any = JSON.parse(JSON.stringify(c.data));
    const sc = JSON.parse(JSON.stringify(base)); sc.profile = { ...sc.profile, ...(b.retirementAge ? { retirementAge: b.retirementAge } : {}) };
    if (b.salaryGrowth !== undefined) sc.income = { ...sc.income, growth: b.salaryGrowth };
    if (b.savingsBoostPct) sc.expenses = { ...sc.expenses, monthly: Number(sc.expenses?.monthly ?? 0) * (1 - b.savingsBoostPct / 100) };
    const a2 = JSON.parse(JSON.stringify(A.values)); if (b.returnShift) for (const k of Object.keys(a2.returns)) if (["large", "diversified", "midsmall", "balanced", "intl"].includes(k)) a2.returns[k] += b.returnShift;
    const t = Date.now(); const baseline = runEngine(base, A.values), scenario = runEngine(sc, a2);
    const pick = (r: any) => ({ goalsMet: r.summary.goalsMet, goalsTotal: r.summary.goalsTotal, retirementReadinessPct: r.retirement.readinessPct, monthlySurplus: r.summary.monthlySurplusNextYear, healthScore: r.healthScore });
    res.json({ baseline: pick(baseline), scenario: pick(scenario), ms: Date.now() - t });
  } catch (e) { next(e); }
});

// ---- documents (private storage + OCR adapter + human confirmation)
clientsRouter.post("/:id/documents", upload.single("file"), async (req, res, next) => {
  try {
    const c = await loadClientFor(req.auth!, req.params.id, true);
    if (!req.file) throw new HttpError(400, "A PDF, image or text file up to 20 MB is required", "VALIDATION");
    const category = z.string().min(2).parse(req.body.category);
    const key = `${c._id}/${crypto.randomUUID()}${path.extname(req.file.originalname).replace(/[^.\w]/g, "")}`;
    await fs.mkdir(path.dirname(path.join(STORAGE, key)), { recursive: true }); await fs.writeFile(path.join(STORAGE, key), req.file.buffer);
    const ocr = await MockOCRProvider.extract(category, req.file.buffer, req.file.mimetype);
    const doc = await DocumentRec.create({ clientId: c._id, category, filename: req.file.originalname, storageKey: key, mime: req.file.mimetype, size: req.file.size, status: ocr.ok ? "processed" : "needs_manual", ocrProvider: MockOCRProvider.name, extracted: sealFields(ocr.fields as any[]), uploadedBy: req.auth!.userId });
    await audit(req, "document.upload", "Document", String(doc._id));
    res.status(201).json({ document: docOut(doc) });
  } catch (e) { next(e); }
});
clientsRouter.get("/:id/documents", async (req, res, next) => { try { const c = await loadClientFor(req.auth!, req.params.id); res.json({ items: (await DocumentRec.find({ clientId: c._id }).select("-storageKey").sort({ createdAt: -1 })).map(docOut) }); } catch (e) { next(e); } });
// Confirmation: user supplies the values they accept; OCR output is never auto-verified.
clientsRouter.post("/:id/documents/:docId/confirm", async (req, res, next) => {
  try {
    const c = await loadClientFor(req.auth!, req.params.id, true);
    const b = z.object({ values: z.record(z.string()), apply: z.record(z.any()).optional() }).parse(req.body);
    const doc = await DocumentRec.findOne({ _id: req.params.docId, clientId: c._id }); if (!doc) throw new HttpError(404, "Document not found");
    const prev = new Map((doc.extracted as any[]).map((e) => [e.field, e.value]));
    doc.extracted = sealFields(Object.entries(b.values).map(([field, value]) => ({ field, value: SENSITIVE_FIELDS.includes(field) && /\*/.test(value) ? decrypt(String(prev.get(field) ?? "")) : value, confidence: doc.extracted.find((e: any) => e.field === field)?.confidence ?? 0, page: 1, verified: true }))) as any;
    doc.status = "confirmed"; doc.verifiedBy = req.auth!.userId as any; doc.verifiedAt = new Date(); await doc.save();
    if (b.apply) { const d: any = { ...(c.data as any) }; for (const [k, v] of Object.entries(b.apply)) d[k] = { ...(d[k] ?? {}), ...(v as object) }; c.data = d; c.markModified("data"); await c.save(); }
    await audit(req, "document.confirm", "Document", String(doc._id), undefined, Object.fromEntries(Object.entries(b.values).map(([k, v]) => [k, SENSITIVE_FIELDS.includes(k) ? mask(v) : v])));
    res.json({ document: docOut(doc) });
  } catch (e) { next(e); }
});

// ---- plans
clientsRouter.get("/:id/plans", async (req, res, next) => {
  try {
    const c = await loadClientFor(req.auth!, req.params.id);
    const f: any = { clientId: c._id }; if (req.auth!.role === "client") f.status = "released";
    res.json({ items: await PlanVersion.find(f).select("-input -result").sort({ version: -1 }) });
  } catch (e) { next(e); }
});
clientsRouter.post("/:id/plans/generate", requirePermission("client:write"), async (req, res, next) => {
  try {
    const c = await loadClientFor(req.auth!, req.params.id, true);
    const A = await activeAssumptions(); const result = runEngine(c.data as any, A.values, asOf(req));
    const last = await PlanVersion.findOne({ clientId: c._id }).sort({ version: -1 });
    const plan = await PlanVersion.create({ clientId: c._id, version: (last?.version ?? 0) + 1, status: "draft", input: c.data, assumptionVersion: A.version, engineVersion: ENGINE_VERSION, result, createdBy: req.auth!.userId });
    if (c.status !== "released") { c.status = "draft"; await c.save(); }
    await audit(req, "plan.generate", "PlanVersion", String(plan._id));
    res.status(201).json({ plan: { _id: plan._id, version: plan.version, status: plan.status } });
  } catch (e) { next(e); }
});
