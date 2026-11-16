import { Router } from "express";
import { z } from "zod";
import { Client, PlanVersion } from "../../database/models";
import { requireAuth } from "../../middleware/auth";
import { loadClientFor } from "../access";
import { audit } from "../audit";
import { HttpError } from "../../utils/errors";
import { renderPlanHtml, displayName } from "./report";
import { htmlToPdf } from "./pdf";
import { notify, staffIds } from "../notifications";

export const plansRouter = Router();
plansRouter.use(requireAuth);
const REVIEW_THRESHOLD = 50_000_000; // net worth above this needs a second reviewer (configurable in Phase 4)

async function plan(req: any, write = false) {
  const p = await PlanVersion.findById(req.params.id).catch(() => null);
  if (!p) throw new HttpError(404, "Plan not found");
  const c = await loadClientFor(req.auth, String(p.clientId), write);
  if (req.auth.role === "client" && p.status !== "released") throw new HttpError(404, "Plan not found"); // drafts never visible to clients
  return { p, c };
}
plansRouter.get("/:id", async (req, res, next) => { try { const { p } = await plan(req); res.json({ plan: p }); } catch (e) { next(e); } });
plansRouter.get("/:id/report", async (req, res, next) => { try { const { p, c } = await plan(req); res.type("html").send(renderPlanHtml(p as any, c as any, { summary: req.query.summary === "1" })); } catch (e) { next(e); } });
plansRouter.get("/:id/pdf", async (req, res, next) => {
  try {
    const { p, c } = await plan(req); const summary = req.query.summary === "1";
    const pdf = await htmlToPdf(renderPlanHtml(p as any, c as any, { summary, pdf: true }), displayName(p, c));
    await audit(req, "plan.pdf", "PlanVersion", String(p._id));
    res.type("application/pdf").set("Content-Disposition", `attachment; filename="MetaWealth-${summary ? "summary" : "plan"}-v${p.version}.pdf"`).send(pdf);
  } catch (e) { next(e); }
});

plansRouter.post("/:id/submit-review", async (req, res, next) => {
  try {
    const { p } = await plan(req, true); if (req.auth!.role === "client") throw new HttpError(403, "Forbidden");
    if (p.status !== "draft" && p.status !== "rejected") throw new HttpError(409, "Only drafts can be submitted");
    p.status = "in_review"; await p.save(); await audit(req, "plan.submit_review", "PlanVersion", String(p._id));
    const { c } = await plan(req, true); await notify(await staffIds(["reviewer", "admin", "super_admin"]), { kind: "review", title: `Plan awaiting review: ${c.name}`, body: `Version ${p.version} was submitted for review.`, link: `/advisor/clients/${c._id}`, email: false });
    res.json({ status: p.status });
  } catch (e) { next(e); }
});
plansRouter.post("/:id/approve", async (req, res, next) => {
  try {
    if (!["reviewer", "admin", "super_admin", "advisor"].includes(req.auth!.role)) throw new HttpError(403, "Forbidden");
    const { p } = await plan(req, req.auth!.role !== "reviewer");
    if (p.status !== "in_review") throw new HttpError(409, "Plan is not in review");
    const nw = (p.result as any)?.netWorth?.total ?? 0; const needsSecond = nw > REVIEW_THRESHOLD;
    const isReviewer = ["reviewer", "admin", "super_admin"].includes(req.auth!.role);
    if (needsSecond && !isReviewer) throw new HttpError(403, "A second reviewer must approve plans above the net-worth threshold", "SECOND_REVIEW_REQUIRED");
    p.approvals.push({ by: req.auth!.userId as any, role: req.auth!.role, decision: "approved", note: req.body?.note, at: new Date() } as any);
    p.status = "approved"; await p.save(); await audit(req, "plan.approve", "PlanVersion", String(p._id)); res.json({ status: p.status });
  } catch (e) { next(e); }
});
plansRouter.post("/:id/reject", async (req, res, next) => {
  try {
    const { note } = z.object({ note: z.string().min(3) }).parse(req.body);
    const { p } = await plan(req, true); if (p.status !== "in_review") throw new HttpError(409, "Plan is not in review");
    p.approvals.push({ by: req.auth!.userId as any, role: req.auth!.role, decision: "rejected", note, at: new Date() } as any); p.status = "rejected"; await p.save();
    await audit(req, "plan.reject", "PlanVersion", String(p._id), undefined, undefined, note); res.json({ status: p.status });
  } catch (e) { next(e); }
});
plansRouter.post("/:id/release", async (req, res, next) => {
  try {
    const { p, c } = await plan(req, true); if (req.auth!.role === "client") throw new HttpError(403, "Forbidden");
    if (p.status !== "approved") throw new HttpError(409, "Only approved plans can be released");
    p.status = "released"; p.releasedAt = new Date(); await p.save();
    await Client.updateOne({ _id: c._id }, { status: "released" });
    await audit(req, "plan.release", "PlanVersion", String(p._id));
    await notify([c.userId], { kind: "plan", title: "Your financial plan is ready", body: `Version ${p.version} has been released by your advisor.`, link: "/client/plan" });
    res.json({ status: p.status });
  } catch (e) { next(e); }
});
plansRouter.get("/:id/compare/:otherId", async (req, res, next) => {
  try {
    const { p } = await plan(req); const o = await PlanVersion.findById(req.params.otherId); if (!o || String(o.clientId) !== String(p.clientId)) throw new HttpError(404, "Plan not found");
    const k = (x: any) => ({ version: x.version, netWorth: x.result.netWorth.total, goalsMet: x.result.summary.goalsMet, retirementReadiness: x.result.retirement.readinessPct, monthlySurplus: x.result.summary.monthlySurplusNextYear, healthScore: x.result.healthScore });
    res.json({ a: k(p), b: k(o) });
  } catch (e) { next(e); }
});
