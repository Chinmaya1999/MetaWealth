import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import rateLimit from "express-rate-limit";
import { User } from "../../database/models/User";
import { AuditLog } from "../../database/models/AuditLog";
import { signAccess, newRefresh, verifyRefresh, hashToken } from "../../security/tokens";
import { requireAuth } from "../../middleware/auth";
import { HttpError } from "../../utils/errors";
import { env } from "../../config/env";
import crypto from "node:crypto";
import mongoose from "mongoose";
import { encrypt, decrypt } from "../../security/crypto";
import { newSecret, verifyTotp, otpauthUri } from "../../security/totp";
import { sendMail } from "../../utils/mailer";

export const authRouter = Router();
const COOKIE = "mwc_rt";
const cookieOpts = { httpOnly: true, secure: env.NODE_ENV === "production", sameSite: "strict" as const, path: "/api/v1/auth", maxAge: env.REFRESH_TTL_DAYS * 86400_000 };
const limiter = rateLimit({ windowMs: 15 * 60_000, limit: 30, standardHeaders: true, legacyHeaders: false });
const MAX_FAILS = 5;

async function issue(user: any, res: any) {
  const rt = newRefresh(String(user._id));
  const keep = (user.refreshTokens ?? []).filter((t: any) => t.expiresAt > new Date()).slice(-4);
  user.refreshTokens = [...keep, { jti: rt.jti, hash: rt.hash, expiresAt: rt.expiresAt }];
  await user.save();
  res.cookie(COOKIE, rt.token, cookieOpts);
  return signAccess({ sub: String(user._id), role: user.role });
}
const publicUser = (u: any) => ({ id: String(u._id), email: u.email, name: u.name, role: u.role, mfa: !!u.totpEnabled });
const pwSchema = z.string().min(10, "At least 10 characters").regex(/[A-Za-z]/, "Include a letter").regex(/\d/, "Include a digit");

authRouter.post("/login", limiter, async (req, res, next) => {
  try {
    const { email, password, code } = z.object({ email: z.string().email(), password: z.string().min(1), code: z.string().optional() }).parse(req.body);
    const user = await User.findOne({ email, isActive: true, deletedAt: null }).select("+passwordHash +refreshTokens +totpSecret");
    const generic = new HttpError(401, "Invalid email or password", "BAD_CREDENTIALS");
    if (!user) { await bcrypt.compare(password, "$2a$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidi"); throw generic; }
    if (user.lockedUntil && user.lockedUntil > new Date()) throw new HttpError(423, "Account temporarily locked. Try again later.", "LOCKED");
    if (!(await bcrypt.compare(password, user.passwordHash))) {
      user.failedLogins += 1;
      if (user.failedLogins >= MAX_FAILS) { user.lockedUntil = new Date(Date.now() + 15 * 60_000); user.failedLogins = 0; }
      await user.save();
      await AuditLog.create({ userId: user._id, action: "auth.login_failed", entity: "User", entityId: String(user._id), requestId: req.id });
      throw generic;
    }
    if (user.totpEnabled) {
      if (!code) return void res.status(200).json({ mfaRequired: true });
      if (!verifyTotp(decrypt(user.totpSecret!), code.replace(/\s/g, ""))) {
        user.failedLogins += 1; if (user.failedLogins >= MAX_FAILS) { user.lockedUntil = new Date(Date.now() + 15 * 60_000); user.failedLogins = 0; } await user.save();
        await AuditLog.create({ userId: user._id, action: "auth.mfa_failed", entity: "User", entityId: String(user._id), requestId: req.id });
        throw new HttpError(401, "Invalid verification code", "BAD_CODE");
      }
    }
    user.failedLogins = 0; user.lockedUntil = undefined;
    const accessToken = await issue(user, res);
    await AuditLog.create({ userId: user._id, action: "auth.login", entity: "User", entityId: String(user._id), requestId: req.id, ip: req.ip });
    res.json({ accessToken, user: publicUser(user) });
  } catch (e) { next(e); }
});

// Refresh-token rotation: each token is single-use; reuse revokes every session.
authRouter.post("/refresh", limiter, async (req, res, next) => {
  try {
    const token = req.cookies?.[COOKIE];
    if (!token) return void res.json({ accessToken: null, user: null }); // signed out: a normal answer, not an error
    let payload; try { payload = verifyRefresh(token); } catch { throw new HttpError(401, "Invalid session", "UNAUTHENTICATED"); }
    const user = await User.findById(payload.sub).select("+refreshTokens");
    if (!user || !user.isActive) throw new HttpError(401, "Invalid session", "UNAUTHENTICATED");
    const match = user.refreshTokens.find((t: any) => t.jti === payload.jti && t.hash === hashToken(token));
    if (!match) { user.refreshTokens = [] as any; await user.save(); throw new HttpError(401, "Session revoked", "UNAUTHENTICATED"); }
    user.refreshTokens = user.refreshTokens.filter((t: any) => t.jti !== payload.jti) as any;
    const accessToken = await issue(user, res);
    res.json({ accessToken, user: publicUser(user) });
  } catch (e) { next(e); }
});

authRouter.post("/logout", async (req, res, next) => {
  try {
    const token = req.cookies?.[COOKIE];
    if (token) { try { const p = verifyRefresh(token); await User.updateOne({ _id: p.sub }, { $pull: { refreshTokens: { jti: p.jti } } }); } catch {} }
    res.clearCookie(COOKIE, { path: cookieOpts.path });
    res.status(204).end();
  } catch (e) { next(e); }
});

authRouter.get("/me", requireAuth, async (req, res, next) => {
  try {
    const user = await User.findById(req.auth!.userId);
    if (!user) throw new HttpError(401, "Unknown user", "UNAUTHENTICATED");
    res.json({ user: publicUser(user) });
  } catch (e) { next(e); }
});

// ---- password reset (single-use token, 30 minutes, stored hashed). The response is always the same so accounts cannot be enumerated.
authRouter.post("/forgot-password", limiter, async (req, res, next) => {
  try {
    const { email } = z.object({ email: z.string().email() }).parse(req.body);
    const u = await User.findOne({ email, isActive: true, deletedAt: null });
    if (u) {
      const token = crypto.randomBytes(32).toString("base64url");
      await User.updateOne({ _id: u._id }, { resetTokenHash: hashToken(token), resetExpires: new Date(Date.now() + 30 * 60_000) });
      await sendMail({ to: u.email, subject: "Reset your MetaWealth Capital password", text: `Use this link within 30 minutes:\n${env.WEB_ORIGIN}/reset-password?token=${token}\nIf you did not ask for this, ignore this email.` });
      await AuditLog.create({ userId: u._id, action: "auth.reset_requested", entity: "User", entityId: String(u._id), requestId: req.id });
    }
    res.json({ ok: true, message: "If that email is registered, a reset link has been sent." });
  } catch (e) { next(e); }
});
authRouter.post("/reset-password", limiter, async (req, res, next) => {
  try {
    const { token, password } = z.object({ token: z.string().min(20), password: pwSchema }).parse(req.body);
    const u = await User.findOne({ resetTokenHash: hashToken(token), resetExpires: mongoose.trusted({ $gt: new Date() }) }).select("+resetTokenHash +resetExpires +refreshTokens");
    if (!u) throw new HttpError(400, "This reset link is invalid or has expired", "BAD_TOKEN");
    u.passwordHash = await bcrypt.hash(password, 12); u.resetTokenHash = undefined; u.resetExpires = undefined; u.failedLogins = 0; u.lockedUntil = undefined; u.refreshTokens = [] as any; await u.save();
    await AuditLog.create({ userId: u._id, action: "auth.password_reset", entity: "User", entityId: String(u._id), requestId: req.id });
    res.json({ ok: true });
  } catch (e) { next(e); }
});
authRouter.post("/change-password", requireAuth, limiter, async (req, res, next) => {
  try {
    const { current, password } = z.object({ current: z.string().min(1), password: pwSchema }).parse(req.body);
    const u = await User.findById(req.auth!.userId).select("+passwordHash +refreshTokens"); if (!u || !(await bcrypt.compare(current, u.passwordHash))) throw new HttpError(400, "Current password is incorrect", "BAD_CREDENTIALS");
    u.passwordHash = await bcrypt.hash(password, 12); u.refreshTokens = [] as any; await u.save();
    await AuditLog.create({ userId: u._id, action: "auth.password_changed", entity: "User", entityId: String(u._id), requestId: req.id });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// ---- two-factor (authenticator app)
authRouter.post("/mfa/setup", requireAuth, async (req, res, next) => {
  try {
    const u = await User.findById(req.auth!.userId); if (!u) throw new HttpError(401, "Unknown user", "UNAUTHENTICATED");
    if (u.totpEnabled) throw new HttpError(409, "Two-factor is already on", "CONFLICT");
    const secret = newSecret(); await User.updateOne({ _id: u._id }, { totpSecret: encrypt(secret) });
    res.json({ secret, otpauth: otpauthUri(u.email, secret) });
  } catch (e) { next(e); }
});
authRouter.post("/mfa/enable", requireAuth, async (req, res, next) => {
  try {
    const { code } = z.object({ code: z.string().length(6) }).parse(req.body);
    const u = await User.findById(req.auth!.userId).select("+totpSecret"); if (!u?.totpSecret) throw new HttpError(400, "Start setup first", "VALIDATION");
    if (!verifyTotp(decrypt(u.totpSecret), code)) throw new HttpError(400, "That code is not correct", "BAD_CODE");
    u.totpEnabled = true; await u.save(); await AuditLog.create({ userId: u._id, action: "auth.mfa_enabled", entity: "User", entityId: String(u._id), requestId: req.id }); res.json({ ok: true });
  } catch (e) { next(e); }
});
authRouter.post("/mfa/disable", requireAuth, async (req, res, next) => {
  try {
    const { password, code } = z.object({ password: z.string().min(1), code: z.string().length(6) }).parse(req.body);
    const u = await User.findById(req.auth!.userId).select("+passwordHash +totpSecret"); if (!u || !(await bcrypt.compare(password, u.passwordHash))) throw new HttpError(400, "Password is incorrect", "BAD_CREDENTIALS");
    if (!u.totpSecret || !verifyTotp(decrypt(u.totpSecret), code)) throw new HttpError(400, "That code is not correct", "BAD_CODE");
    u.totpEnabled = false; u.totpSecret = undefined; await u.save(); await AuditLog.create({ userId: u._id, action: "auth.mfa_disabled", entity: "User", entityId: String(u._id), requestId: req.id }); res.json({ ok: true });
  } catch (e) { next(e); }
});
