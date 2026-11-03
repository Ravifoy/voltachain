import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import BatteryIndicator from "@/components/BatteryIndicator";
import GradeBadge from "@/components/GradeBadge";
import TxPanel from "@/components/TxPanel";
import { remainingMonths } from "@/components/BatteryCard";

describe("battery health indicator", () => {
  it("shows the percentage and an accessible label", () => {
    render(<BatteryIndicator percent={72.4} />);
    expect(screen.getByRole("img", { name: "Battery health 72 percent" })).toBeInTheDocument();
    expect(screen.getByText("72%")).toBeInTheDocument();
  });

  it("keeps out-of-range values between 0 and 100", () => {
    render(<><BatteryIndicator percent={130} /><BatteryIndicator percent={-5} /></>);
    expect(screen.getByRole("img", { name: "Battery health 100 percent" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Battery health 0 percent" })).toBeInTheDocument();
  });
});

describe("grade badge and remaining life", () => {
  it("shows the grade letter with a tooltip", () => {
    render(<GradeBadge grade="B" />);
    expect(screen.getByTitle("Grade B")).toHaveTextContent("B");
  });

  it("estimates months left and caps it between 0 and 120", () => {
    expect(remainingMonths(86)).toBe(60);
    expect(remainingMonths(40)).toBe(0);
    expect(remainingMonths(200)).toBe(120);
  });
});

describe("transaction status panel", () => {
  it("shows nothing before a transaction starts", () => {
    const { container } = render(<TxPanel state={{ status: "idle" }} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("shows a loading status while the transaction is pending", () => {
    render(<TxPanel state={{ status: "pending", label: "Charging transaction…" }} />);
    expect(screen.getByRole("status")).toHaveTextContent("Charging transaction…");
  });

  it("announces a failed transaction as an alert", () => {
    render(<TxPanel state={{ status: "error", message: "Only verified inspectors can add reports" }} />);
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("Transaction failed");
    expect(alert).toHaveTextContent("Only verified inspectors can add reports");
  });
});
