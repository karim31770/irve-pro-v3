/** @type {import("tailwindcss").Config} */
module.exports = {
  content: [
    "./pages/**/*.{js,jsx}",
    "./components/**/*.{js,jsx}",
    "./lib/**/*.{js,jsx}"
  ],
  theme: {
    extend: {
      boxShadow: {
        soft: "0 10px 30px rgba(0,0,0,.08)"
      }
    }
  },
  plugins: [require("daisyui")],
  daisyui: {
    themes: [
      {
        irve: {
          primary: "#2563EB",      // blue-600
          "primary-content": "#ffffff",
          secondary: "#7C3AED",    // violet-600
          accent: "#06B6D4",       // cyan-500
          neutral: "#0B1220",
          "base-100": "#0B1220",
          "base-200": "#0A1020",
          "base-300": "#111A2E",
          "base-content": "#E5E7EB",
          info: "#38BDF8",
          success: "#22C55E",
          warning: "#F59E0B",
          error: "#EF4444"
        }
      },
      "corporate",
      "business",
      "dark"
    ]
  }
};
