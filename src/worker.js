// Worker bundle entry point for Vite build
// Maintains compatibility with existing worker functionality

// Import and execute the worker script - side effects are important!
import '../js/worker/worker.js';

// Export something to prevent Vite from optimizing away the bundle
// This ensures the worker initialization code runs
export const workerInitialized = true;