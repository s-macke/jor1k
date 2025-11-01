// Master bundle entry point for Vite build
// Maintains compatibility with existing browserify exports

// Import the modules that were exposed by browserify
import LinuxTerm from '../js/plugins/terminal-linux.js';
import Jor1k from '../js/master/system.js';

// Import types for public API
import type { EmulatorParameters, Terminal } from '../types/index.js';

// Export modules for UMD bundle
export { LinuxTerm, Jor1k };

// Export types for TypeScript consumers
export type { 
  EmulatorParameters, 
  Terminal,
  SystemConfig,
  FilesystemConfig,
  CPUImplementation,
  MessageType,
  MessageHandler
} from '../types/index.js';

// Type declaration for global window object
declare global {
  interface Window {
    LinuxTerm: typeof LinuxTerm;
    Jor1k: typeof Jor1k;
  }
}

// Also assign to global variables for browser compatibility
if (typeof window !== 'undefined') {
  window.LinuxTerm = LinuxTerm;
  window.Jor1k = Jor1k;
}
