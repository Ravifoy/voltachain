import { describe, expect, it } from "vitest";
import { hashReport } from "@/lib/report";
import { friendlyError } from "@/lib/chain";

const report = {
  serialNumber: "NMC-2024-00123", batteryType: "Li-ion 18650 cell", tokenId: 1,
  readings: { cycle_count: 320, age_months: 18, internal_resistance: 45, avg_temperature: 31, measured_capacity: 2600, nominal_capacity: 3000 },
  ml: { soh_percent: 86.7, grade: "A", remaining_life_months: 61, suggested_price_inr: 1350, explanation: "Healthy cell." },
  inspector: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8", timestamp: "2026-01-01T00:00:00.000Z",
};

describe("report fingerprint used by the Verify page (lib/report)", () => {
  it("gives the same hash for the same report, even if it was pretty-printed", () => {
    const pretty = JSON.parse(JSON.stringify(report, null, 2));
    expect(hashReport(pretty)).toBe(hashReport(report));
    expect(hashReport(report)).toMatch(/^0x[0-9a-f]{64}$/);
  });

  it("gives a completely different hash when one value is tampered with", () => {
    const tampered = { ...report, ml: { ...report.ml, soh_percent: 95 } };
    expect(hashReport(tampered)).not.toBe(hashReport(report));
  });
});

describe("error messages shown to users (lib/chain)", () => {
  it("explains a cancelled MetaMask request in plain words", () => {
    expect(friendlyError({ code: "ACTION_REJECTED", message: "user rejected action" })).toBe("You cancelled the request in MetaMask.");
  });

  it("pulls the contract's reason out of a failed transaction", () => {
    expect(friendlyError({ message: "execution reverted: Only verified inspectors can add reports" })).toBe("Only verified inspectors can add reports");
  });
});
