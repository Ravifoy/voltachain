import "@testing-library/jest-dom/vitest";
import { afterEach, vi } from "vitest";
import { cleanup } from "@testing-library/react";
import React from "react";

afterEach(() => cleanup());

// jsdom does not implement these browser APIs; framer-motion uses them for animations.
class IO { observe() {} unobserve() {} disconnect() {} takeRecords() { return []; } }
(globalThis as any).IntersectionObserver = IO;
if (!window.matchMedia) {
  (window as any).matchMedia = (q: string) => ({ matches: false, media: q, onchange: null, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent: () => false });
}

// Next.js router pieces are replaced with simple stand-ins so components render outside a Next app.
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: any) => React.createElement("a", { href: typeof href === "string" ? href : String(href), ...rest }, children),
}));
vi.mock("next/navigation", () => ({
  usePathname: () => (globalThis as any).__pathname ?? "/",
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));
