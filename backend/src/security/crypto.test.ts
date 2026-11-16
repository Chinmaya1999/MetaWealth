import { describe, it, expect } from "vitest";
import { encrypt, decrypt, mask, isEncrypted } from "./crypto";
import { hotp, verifyTotp, newSecret } from "./totp";
describe("field encryption", () => {
  it("round-trips, is randomised, and hides the plaintext", () => { const a = encrypt("ABCDE1234F"), b = encrypt("ABCDE1234F"); expect(a).not.toBe(b); expect(a).not.toContain("ABCDE"); expect(decrypt(a)).toBe("ABCDE1234F"); expect(isEncrypted(a)).toBe(true); expect(encrypt(a)).toBe(a); });
  it("detects tampering", () => { const a = encrypt("secret"); const t = a.slice(0, -3) + (a.endsWith("AAA") ? "BBB" : "AAA"); expect(() => decrypt(t)).toThrow(); });
  it("masks", () => { expect(mask("ABCDE1234F")).toBe("A********F"); expect(mask("123")).toBe("****"); });
});
describe("TOTP", () => {
  it("matches the RFC 6238 test vector (secret 12345678901234567890, T=59 -> 94287082, 6 digits 287082)", () => { expect(hotp("GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ", 1)).toBe("287082"); });
  it("accepts current code and rejects wrong ones", () => { const s = newSecret(); const now = Date.now(); expect(verifyTotp(s, hotp(s, Math.floor(now / 30000)), now)).toBe(true); expect(verifyTotp(s, "000000", now) && verifyTotp(s, "000001", now)).toBe(false); expect(verifyTotp(s, "abc", now)).toBe(false); });
});
