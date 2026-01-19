import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      outDir: 'dist-electron/main',
      rollupOptions: {
        input: resolve(__dirname, './electron/main/main.ts')
      }
    },
    resolve: {
      alias: {
        '@': resolve(__dirname, './src')
      }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      outDir: 'dist-electron/preload',
      rollupOptions: {
        input: resolve(__dirname, './electron/preload/preload.ts')
      }
    },
    resolve: {
      alias: {
        '@': resolve(__dirname, './src')
      }
    }
  },
  renderer: {
    root: './src',
    plugins: [react()],
    build: {
      outDir: 'dist',
      rollupOptions: {
        input: resolve(__dirname, './src/index.html')
      }
    },
    resolve: {
      alias: {
        '@': resolve(__dirname, './src')
      }
    },
    css: {
      modules: {
        localsConvention: 'camelCase'
      }
    }
  }
})

