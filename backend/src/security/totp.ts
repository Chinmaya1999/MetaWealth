import crypto from "node:crypto";
// RFC 6238 TOTP (SHA-1, 6 digits, 30 s) compatible with Google/Microsoft Authenticator.
const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
export const newSecret = () => { const b = crypto.randomBytes(20); let bits = "", out = ""; for (const x of b) bits += x.toString(2).padStart(8, "0"); for (let i = 0; i < bits.length; i += 5) out += B32[parseInt(bits.slice(i, i + 5), 2)]; return out; };
const decode = (s: string) => { let bits = ""; for (const c of s.replace(/=+$/, "")) bits += B32.indexOf(c).toString(2).padStart(5, "0"); const out: number[] = []; for (let i = 0; i + 8 <= bits.length; i += 8) out.push(parseInt(bits.slice(i, i + 8), 2)); return Buffer.from(out); };
export const hotp = (secret: string, counter: number) => { const m = Buffer.alloc(8); m.writeBigUInt64BE(BigInt(counter)); const h = crypto.createHmac("sha1", decode(secret)).update(m).digest(); const o = h[19] & 15; return String(((h[o] & 127) << 24 | h[o + 1] << 16 | h[o + 2] << 8 | h[o + 3]) % 1_000_000).padStart(6, "0"); };
export const verifyTotp = (secret: string, code: string, now = Date.now()) => { const c = Math.floor(now / 30000); return /^\d{6}$/.test(code) && [-1, 0, 1].some((d) => crypto.timingSafeEqual(Buffer.from(hotp(secret, c + d)), Buffer.from(code))); };
export const otpauthUri = (email: string, secret: string) => `otpauth://totp/MetaWealth%20Capital:${encodeURIComponent(email)}?secret=${secret}&issuer=MetaWealth%20Capital&digits=6&period=30`;
