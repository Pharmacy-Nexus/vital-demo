import type { Config } from "tailwindcss";
export default {
  content: ["./app/**/*.{js,ts,jsx,tsx,mdx}", "./components/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        bone: "#F5F5F7",
        ink: "#1D1D1F",
        coral: "#D92D20",
        lime: "#0071E3",
        aubergine: "#0066CC",
        surface: "#F4F8FB",
        muted: "#707070"
      }
    }
  },
  plugins: []
} satisfies Config;
