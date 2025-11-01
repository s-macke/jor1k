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
      root: '.',
      server: {
        port: 3000,
        open: '/demos/main.html',
        fs: {
          allow: ['..'],
          strict: false
        },
        watch: {
          ignored: ['**/openrisc-sys/**', '**/riscv-sys/**', '**/utils/**']
        },
        middlewareMode: false
      },
      
      publicDir: 'demos',
      
      // TypeScript support with optimizations
      esbuild: {
        target: 'es2020',
        keepNames: true,
        // Optimize TypeScript compilation for development
        tsconfigRaw: {
          compilerOptions: {
            moduleResolution: 'bundler',
            incremental: true,
            sourceMap: true
          }
        }
      },
      
      resolve: {
        alias: {
          '@': resolve(__dirname, 'js'),
          '@js': resolve(__dirname, 'js')
        },
        extensions: ['.ts', '.js', '.mjs']
      },
      
      define: {
        'process.env.NODE_ENV': JSON.stringify(mode),
        'global': 'globalThis'
      },
      
      optimizeDeps: {
        include: [],
        force: true,
        exclude: ['openrisc-sys/**', 'riscv-sys/**', 'utils/**']
      },
      
      // Configure which files should be treated as assets vs source
      assetsInclude: ['**/*.bin', '**/*.bz2', '**/*.wasm'],
      
      // Add plugin to handle system directories as static assets
      plugins: [
        {
          name: 'static-system-dirs',
          configureServer(server) {
            server.middlewares.use('/openrisc-sys', (req, res, next) => {
              res.statusCode = 404;
              res.end('Not found');
            });
            server.middlewares.use('/riscv-sys', (req, res, next) => {
              res.statusCode = 404;
              res.end('Not found');
            });
            server.middlewares.use('/utils', (req, res, next) => {
              res.statusCode = 404;
              res.end('Not found');
            });
          }
        }
      ]
    };
  }
  
  // For production builds - single entry at a time
  // Use TypeScript entry points
  const entryFile = buildTarget === 'worker' ? 'src/worker.ts' : 'src/master.ts';
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
      
      sourcemap: true,
      minify: isProduction ? 'esbuild' : false,
      
      target: 'es2020'
    },
    
    // TypeScript support with optimizations
    esbuild: {
      target: 'es2020',
      keepNames: true,
      // Optimize TypeScript compilation
      tsconfigRaw: {
        compilerOptions: {
          // Use bundler module resolution for better tree shaking
          moduleResolution: 'bundler',
          // Enable incremental compilation for faster builds
          incremental: true,
          // Preserve source maps for debugging
          sourceMap: true,
          // Remove comments in production
          removeComments: isProduction
        }
      }
    },
    
    resolve: {
      alias: {
        '@': resolve(__dirname, 'js'),
        '@js': resolve(__dirname, 'js')
      },
      extensions: ['.ts', '.js', '.mjs']
    },
    
    define: {
      'process.env.NODE_ENV': JSON.stringify(mode),
      'global': 'globalThis'
    },
    
    optimizeDeps: {
      include: [],
      force: true,
      exclude: ['openrisc-sys', 'riscv-sys', 'utils']
    }
  };
});