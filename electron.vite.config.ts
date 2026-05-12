import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

const projectRoot = resolve(__dirname)

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    define: {
      'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development')
    },
    build: {
      outDir: 'dist-electron/main',
      rollupOptions: {
        external: ['gifencoder', 'pdfkit'],
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
    /** 从仓库根目录加载 .env / .env.development，使 VITE_* 在开发联调时生效 */
    envDir: projectRoot,
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
    },
    define: {
      'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development'),
    },
    esbuild: {
      charset: 'utf8'
    }
  }
})

