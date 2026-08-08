import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eff6ff",
          500: "#2563eb",
          600: "#1d4ed8"
        }
      },
      keyframes: {
        "fade-in-up": {
          "0%": { opacity: "0", transform: "translateY(6px)" },
          "100%": { opacity: "1", transform: "translateY(0)" }
        },
        "scale-in": {
          "0%": { opacity: "0", transform: "scale(0.85)" },
          "100%": { opacity: "1", transform: "scale(1)" }
        },
        "fade-in": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" }
        }
      },
      animation: {
        "fade-in-up": "fade-in-up 0.35s ease-out both",
        "scale-in": "scale-in 0.2s ease-out both",
        // transform (used by fade-in-up) doesn't apply to table-row elements in most browsers -
        // <tr> entrance animation needs an opacity-only variant.
        "fade-in": "fade-in 0.35s ease-out both"
      }
    }
  }
};

export default config;
