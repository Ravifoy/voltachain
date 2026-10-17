import type { Config } from "tailwindcss";

// Battery theme palette: near-black bg, electric green accent, yellow "energy" highlight.
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#0a0f0d",
        panel: "#101814",
        panel2: "#15201a",
        line: "#1f3328",
        volt: "#22ff88",
        volt2: "#00e676",
        bolt: "#ffd60a",
        lime: "#a3e635",
        amberx: "#fb923c",
        redx: "#ef4444",
        mute: "#8fa89a",
      },
      fontFamily: {
        display: ["Orbitron", "Space Grotesk", "sans-serif"],
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      boxShadow: {
        glow: "0 0 18px rgba(34,255,136,0.35)",
        glowSm: "0 0 10px rgba(34,255,136,0.3)",
        bolt: "0 0 16px rgba(255,214,10,0.4)",
      },
    },
  },
  plugins: [],
};
export default config;
