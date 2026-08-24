import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// `base` matches the GitHub Pages subpath (https://jwai324.github.io/TV-Time-2.0/)
// so built asset URLs resolve there; dev and preview are unaffected in practice.
export default defineConfig({
  base: '/TV-Time-2.0/',
  plugins: [react()],
  server: { port: 5173 },
})
