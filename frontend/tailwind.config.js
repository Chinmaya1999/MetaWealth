/** Brand tokens from the master prompt; admin-configurable tokens arrive via CSS variables in Phase 2. */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        navy: { DEFAULT: "#101D35", deep: "#172945" },
        gold: "#C7A45B", ivory: "#F7F5EF", ink: "#182338", muted: "#728096",
        peach: "#F0B38A", sage: "#9CC27A", success: "#21865B", warning: "#D69B38", danger: "#C44D4D", line: "#E5E8EE",
      },
      fontFamily: { serif: ["Fraunces", "Georgia", "serif"], sans: ["Inter", "system-ui", "sans-serif"] },
      boxShadow: {
        card: "0 1px 2px rgba(16,29,53,.05), 0 4px 16px rgba(16,29,53,.04)",
        clay: "0 18px 40px -18px rgba(16,29,53,.28), 0 4px 10px -4px rgba(16,29,53,.08), inset 0 1px 0 rgba(255,255,255,.95), inset 0 -2px 6px rgba(16,29,53,.04)",
        clayPress: "inset 0 3px 8px rgba(16,29,53,.12), inset 0 -1px 0 rgba(255,255,255,.8)",
      },
      borderRadius: { xl2: "24px", xl3: "32px" },
    },
  },
};
