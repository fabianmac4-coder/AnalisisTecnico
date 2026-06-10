/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        // Paleta oscura tipo terminal de trading (sin branding de terceros).
        panel: "#131722",
        "panel-2": "#1c2230",
        "panel-3": "#262d3d",
        edge: "#2a3142",
        accent: "#3b82f6",
        up: "#26a69a",
        down: "#ef5350",
        muted: "#8b93a7",
      },
      fontFamily: {
        mono: ["JetBrains Mono", "Consolas", "monospace"],
      },
    },
  },
  plugins: [],
};
