import { describe, expect, it } from "vitest";
import { parseEther } from "ethers";
import { inr, inrToEth, weiToInr, priceLabel, short, gradeColor, sohColor, roleOf } from "@/lib/config";

describe("price and text helpers (lib/config)", () => {
  it("formats rupees with Indian digit grouping", () => {
    expect(inr(150000)).toBe("₹1,50,000");
    expect(inr(1399.6)).toBe("₹1,400");
  });

  it("converts between INR and ETH at the fixed display rate", () => {
    expect(inrToEth(200000)).toBe("1.000000");
    expect(inrToEth(1400)).toBe("0.007000");
    expect(weiToInr(parseEther("0.5"))).toBe(100000);
  });

  it("builds the price label shown on battery cards", () => {
    expect(priceLabel(parseEther("0.007"))).toBe("0.007 ETH ≈ ₹1,400");
  });

  it("shortens long wallet addresses but leaves short text alone", () => {
    expect(short("0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266")).toBe("0xf39F…2266");
    expect(short("0x1234")).toBe("0x1234");
  });

  it("colours health and grades at the A/B/C/D boundaries", () => {
    expect(sohColor(85)).toBe("#22ff88");
    expect(sohColor(84)).toBe("#a3e635");
    expect(sohColor(50)).toBe("#fb923c");
    expect(sohColor(49)).toBe("#ef4444");
    expect(gradeColor("A")).toBe("#22ff88");
    expect(gradeColor("Z")).toBe("#8fa89a");
  });

  it("labels known test accounts regardless of letter case", () => {
    expect(roleOf("0xF39FD6E51AAD88F6F4CE6AB8827279CFFFB92266")).toBe("Admin");
    expect(roleOf("0x0000000000000000000000000000000000000000")).toBeUndefined();
    expect(roleOf(null)).toBeUndefined();
  });
});
