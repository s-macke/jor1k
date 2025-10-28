// Master bundle entry point for Vite build
// Maintains compatibility with existing browserify exports

// Import the modules that were exposed by browserify
import LinuxTerm from '../js/plugins/terminal-linux.js';
import Jor1k from '../js/master/master.js';

// Export modules for UMD bundle
export { LinuxTerm, Jor1k };

// Also assign to global variables for browser compatibility
if (typeof window !== 'undefined') {
  window.LinuxTerm = LinuxTerm;
  window.Jor1k = Jor1k;
}