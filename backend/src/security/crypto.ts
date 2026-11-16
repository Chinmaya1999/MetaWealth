import crypto from "node:crypto";
const env = { DATA_ENCRYPTION_KEY: process.env.DATA_ENCRYPTION_KEY, NODE_ENV: process.env.NODE_ENV, JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET ?? "test-secret" };

/** AES-256-GCM field encryption for sensitive identifiers (PAN, Aadhaar, passport).
 *  Key: DATA_ENCRYPTION_KEY (32 bytes, hex or base64). In development only, a key is derived from the JWT secret. */
const key = (() => {
  const k = env.DATA_ENCRYPTION_KEY;
  if (k) { const b = /^[0-9a-f]{64}$/i.test(k) ? Buffer.from(k, "hex") : Buffer.from(k, "base64"); if (b.length !== 32) throw new Error("DATA_ENCRYPTION_KEY must be 32 bytes (64 hex chars or base64)"); return b; }
  if (env.NODE_ENV === "production") throw new Error("DATA_ENCRYPTION_KEY is required in production");
  return crypto.createHash("sha256").update("dev-only:" + env.JWT_ACCESS_SECRET).digest();
})();

const PREFIX = "enc:v1:";
export const SENSITIVE_FIELDS = ["pan", "aadhaar", "passport"];
export const isEncrypted = (v: unknown) => typeof v === "string" && v.startsWith(PREFIX);
export function encrypt(plain: string): string {
  if (isEncrypted(plain)) return plain;
  const iv = crypto.randomBytes(12); const c = crypto.createCipheriv("aes-256-gcm", key, iv);
  const ct = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return PREFIX + Buffer.concat([iv, c.getAuthTag(), ct]).toString("base64");
}
export function decrypt(s: string): string {
  if (!isEncrypted(s)) return s;
  const b = Buffer.from(s.slice(PREFIX.length), "base64"); const d = crypto.createDecipheriv("aes-256-gcm", key, b.subarray(0, 12));
  d.setAuthTag(b.subarray(12, 28)); return Buffer.concat([d.update(b.subarray(28)), d.final()]).toString("utf8");
}
/** Show only the first and last characters: ABCDE1234F -> A********F. */
export const mask = (v: string) => (v.length <= 4 ? "****" : v[0] + "*".repeat(v.length - 2) + v[v.length - 1]);
