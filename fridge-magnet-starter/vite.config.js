import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// This file tells Vite (the tool that turns our code into files Netlify can
// serve) that we are building a React app.
export default defineConfig({
  plugins: [react()],
})
