import { describe, it, expect } from "vitest";
import { hashPassword, verifyPassword } from "@/auth/password";
import { base32Encode, base32Decode } from "@/auth/base32";

describe("password", () => {
  it("hash then verify", () => {
    const h = hashPassword("correct horse battery");
    expect(h).not.toContain("correct horse");
    expect(verifyPassword("correct horse battery", h)).toBe(true);
  });

  it("wrong password fails", () => {
    const h = hashPassword("correct horse battery");
    expect(verifyPassword("correct horse batterz", h)).toBe(false);
    expect(verifyPassword("anything", "not-a-hash")).toBe(false);
  });

  it("base32 round-trips the RFC 4648 vector", () => {
    expect(base32Encode(Buffer.from("foobar"))).toBe("MZXW6YTBOI");
    expect(base32Decode("MZXW6YTBOI").toString()).toBe("foobar");
  });
});
