import { describe, expect, it } from "vitest";
import { databasePoolMax } from "./pool";

describe("databasePoolMax", () => {
  it("uses one connection on serverless so a page burst cannot exhaust the pool", () => {
    expect(databasePoolMax({ serverless: true, configured: 10 })).toBe(1);
  });

  it("keeps a small local pool", () => {
    expect(databasePoolMax({ serverless: false, configured: 10 })).toBe(10);
    expect(databasePoolMax({ serverless: false, configured: 40 })).toBe(10);
    expect(databasePoolMax({ serverless: false, configured: 0 })).toBe(1);
  });
});
