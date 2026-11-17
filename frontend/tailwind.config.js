/** Brand tokens from the MetaWealth Capital logo (teal-blue #1A5876, green #55B848); admin-configurable tokens arrive via CSS variables in Phase 2. */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        navy: { DEFAULT: "#1A5876", deep: "#154A63" },
        gold: "#55B848", ivory: "#F4F8F6", ink: "#182338", muted: "#728096",
        peach: "#F0B38A", sage: "#9CC27A", success: "#21865B", warning: "#D69B38", danger: "#C44D4D", line: "#E5E8EE",
      },
      fontFamily: { serif: ["Fraunces", "Georgia", "serif"], sans: ["Inter", "system-ui", "sans-serif"] },
      boxShadow: {
        card: "0 1px 2px rgba(26,88,118,.05), 0 4px 16px rgba(26,88,118,.04)",
        clay: "0 18px 40px -18px rgba(26,88,118,.28), 0 4px 10px -4px rgba(26,88,118,.08), inset 0 1px 0 rgba(255,255,255,.95), inset 0 -2px 6px rgba(26,88,118,.04)",
        clayPress: "inset 0 3px 8px rgba(26,88,118,.12), inset 0 -1px 0 rgba(255,255,255,.8)",
      },
      borderRadius: { xl2: "24px", xl3: "32px" },
    },
  },
};
