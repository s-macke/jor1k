import { defineConfig } from 'vite';
import { resolve } from 'path';
import commonjs from '@rollup/plugin-commonjs';
import { nodeResolve } from '@rollup/plugin-node-resolve';

export default defineConfig(({ command, mode }) => {
  const isProduction = mode === 'production';
  const isDev = command === 'serve';
  
  // Get the build target from environment variable
  const buildTarget = process.env.BUILD_TARGET || 'master';
  
  // For development server
  if (isDev) {
    return {
      plugins: [
        nodeResolve({
          preferBuiltins: false
        }),
        commonjs()
      ],
      
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
    plugins: [
      nodeResolve({
        preferBuiltins: false
      }),
      commonjs()
    ],
    
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
          globals: {}
        }
      },
      
      sourcemap: !isProduction,
      minify: isProduction ? 'esbuild' : false,
      
      commonjsOptions: {
        include: [/js\/.*\.js$/],
        transformMixedEsModules: true
      }
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