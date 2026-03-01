import type { Config } from 'tailwindcss'
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'orange-fire': '#F05A25',
        'sky-blue': '#3FA9F6',
        'cream': '#EFE1CF',
      }
    },
  },
  plugins: [],
} satisfies Config
