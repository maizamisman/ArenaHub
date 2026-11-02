import { describe, it, expect } from "vitest";
import { canControlMatch } from "@/domain/access";
import { match } from "./fixtures";

const pic = { id: "u1", name: "Aina", email: "a@x", role: "pic" as const, active: true };
const admin = { id: "u0", name: "Admin", email: "admin@x", role: "admin" as const, active: true };

describe("access", () => {
  it("PIC assigned by court can control any match on that court", () => {
    const m = match({ court_id: "takraw" });
    expect(canControlMatch(pic, m, [{ user_id: "u1", match_id: null, court_id: "takraw" }])).toBe(true);
    expect(canControlMatch(pic, m, [{ user_id: "u1", match_id: null, court_id: "field" }])).toBe(false);
    expect(canControlMatch(pic, m, [{ user_id: "u2", match_id: m.id, court_id: null }])).toBe(false);
    expect(canControlMatch(pic, m, [{ user_id: "u1", match_id: m.id, court_id: null }])).toBe(true);
    expect(canControlMatch(admin, m, [])).toBe(true);
  });

  it("inactive PIC cannot control", () => {
    const m = match({});
    expect(canControlMatch({ ...pic, active: false }, m, [{ user_id: "u1", match_id: m.id, court_id: null }])).toBe(false);
    expect(canControlMatch({ ...admin, active: false }, m, [])).toBe(false);
  });
});
