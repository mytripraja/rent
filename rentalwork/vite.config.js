import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    target: 'es2020',
    cssCodeSplit: true,
    // Split large, rarely-changing libraries into dedicated chunks so the
    // browser can cache them across deploys and download them in parallel.
    // This meaningfully reduces the size of the initial app chunk.
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined
          if (id.includes('firebase') || id.includes('@firebase')) return 'firebase'
          if (id.includes('framer-motion') || id.includes('motion-dom') || id.includes('motion-utils')) return 'motion'
          if (id.includes('lucide-react')) return 'icons'
          if (id.includes('react-router')) return 'router'
          if (id.includes('react-dom') || id.includes('/react/')) return 'react'
          return 'vendor'
        },
      },
    },
    chunkSizeWarningLimit: 900,
  },
  // Vitest reads this block. Tests run in jsdom with a small setup file that
  // polyfills the browser APIs jsdom lacks (matchMedia, ResizeObserver).
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.js',
    css: false,
    restoreMocks: true,
    include: ['src/**/*.test.{js,jsx}'],
  },
})
