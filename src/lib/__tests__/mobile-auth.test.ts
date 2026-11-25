import { beforeEach, describe, expect, it } from "vitest";
import { extractBearerToken, signMobileToken, verifyMobileToken } from "../mobile-auth";

describe("mobile-auth", () => {
  beforeEach(() => {
    process.env.NEXTAUTH_SECRET = "test-secret-key-for-studyhub-mobile-auth-1234";
  });

  it("signs and verifies a valid mobile token", () => {
    const now = 1_700_000_000;
    const { token, expiresAt } = signMobileToken("user_123", now);
    expect(token.split(".")).toHaveLength(3);
    expect(verifyMobileToken(token, now + 60)).toBe("user_123");
    expect(new Date(expiresAt).getTime()).toBe((now + 60 * 60 * 24 * 30) * 1000);
  });

  it("rejects expired tokens", () => {
    const now = 1_700_000_000;
    const { token } = signMobileToken("user_123", now);
    expect(verifyMobileToken(token, now + 60 * 60 * 24 * 31)).toBeNull();
  });

  it("rejects tampered tokens", () => {
    const now = 1_700_000_000;
    const { token } = signMobileToken("user_123", now);
    const parts = token.split(".");
    const tampered = `${parts[0]}.${parts[1]}.${parts[2].slice(0, -2)}AA`;
    expect(verifyMobileToken(tampered, now + 10)).toBeNull();
  });

  it("extracts Bearer token from Authorization header", () => {
    const req = new Request("https://example.com/api/mobile/sync", {
      headers: { Authorization: "Bearer abc.def.ghi" },
    });
    expect(extractBearerToken(req)).toBe("abc.def.ghi");
    expect(extractBearerToken(new Request("https://example.com"))).toBeNull();
  });
});
