import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig(({ command, mode }) => {
  const isProduction = mode === 'production';
  const isDev = command === 'serve';
  
  // Get the build target from environment variable
  const buildTarget = process.env.BUILD_TARGET || 'master';
  
  // For development server
  if (isDev) {
    return {
      server: {
        port: 3000,
        open: '/demos/main.html',
        fs: {
          allow: ['..']
        }
      },
      
      publicDir: 'demos',
      
      resolve: {
        alias: {
          '@': resolve(__dirname, 'js')
        }
      },
      
      define: {
        'process.env.NODE_ENV': JSON.stringify(mode),
        'global': 'globalThis'
      },
      
      optimizeDeps: {
        include: [],
        force: true
      }
    };
  }
  
  // For production builds - single entry at a time
  const entryFile = buildTarget === 'worker' ? 'src/worker.js' : 'src/master.js';
  const outputFile = buildTarget === 'worker' ? 'jor1k-worker-min.js' : 'jor1k-master-min.js';
  const globalName = buildTarget === 'worker' ? 'JOR1KWorker' : 'JOR1K';
  
  return {
    build: {
      outDir: 'demos',
      emptyOutDir: false,
      lib: {
        entry: resolve(__dirname, entryFile),
        name: globalName,
        fileName: () => outputFile,
        formats: ['umd']
      },
      
      rollupOptions: {
        external: [],
        output: {
          globals: {},
          // Enable tree shaking for better optimization
          preserveModules: false,
          // Use named exports to avoid warning about mixed exports
          exports: 'named'
        },
        // Enable tree shaking but preserve side effects for worker
        treeshake: buildTarget === 'worker' ? {
          moduleSideEffects: true,
          propertyReadSideEffects: false,
          tryCatchDeoptimization: false
        } : {
          moduleSideEffects: false,
          propertyReadSideEffects: false,
          tryCatchDeoptimization: false
        }
      },
      
      sourcemap: !isProduction,
      minify: isProduction ? 'esbuild' : false,
      
      // Remove CommonJS options since we're using pure ES modules
      target: 'es2015'
    },
    
    resolve: {
      alias: {
        '@': resolve(__dirname, 'js')
      }
    },
    
    define: {
      'process.env.NODE_ENV': JSON.stringify(mode),
      'global': 'globalThis'
    },
    
    optimizeDeps: {
      include: [],
      force: true
    }
  };
});