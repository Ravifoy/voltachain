import { describe, expect, it, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Navbar from "@/components/Navbar";
import { WalletProvider } from "@/lib/wallet";

const renderNav = (path: string) => {
  (globalThis as any).__pathname = path;
  return render(<WalletProvider><Navbar /></WalletProvider>);
};

describe("navigation bar", () => {
  beforeEach(() => { delete (window as any).ethereum; });

  it("links to every page and highlights the current one", () => {
    renderNav("/sell");
    const desktop = screen.getAllByRole("navigation")[0];
    for (const name of ["Marketplace", "Sell", "Inspector", "Explorer", "Verify"]) {
      expect(within(desktop).getByRole("link", { name })).toBeInTheDocument();
    }
    expect(within(desktop).getByRole("link", { name: "Sell" })).toHaveAttribute("href", "/sell");
    expect(within(desktop).getByRole("link", { name: "Sell" }).className).toContain("bg-volt/15");
    expect(within(desktop).getByRole("link", { name: "Marketplace" }).className).not.toContain("bg-volt/15");
  });

  it("opens the mobile menu from the menu button", async () => {
    renderNav("/");
    expect(screen.getAllByRole("navigation")).toHaveLength(1);
    await userEvent.click(screen.getByRole("button", { name: "Menu" }));
    expect(screen.getAllByRole("navigation")).toHaveLength(2);
  });

  it("tells the user to install MetaMask when no wallet is available", async () => {
    renderNav("/");
    await userEvent.click(screen.getByRole("button", { name: /connect wallet/i }));
    expect(await screen.findByText("MetaMask not found. Install the MetaMask extension.")).toBeInTheDocument();
  });
});
