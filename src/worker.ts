// Worker bundle entry point for Vite build
// Maintains compatibility with existing worker functionality

// Import and execute the worker script - side effects are important!
// The worker initialization creates a System instance and sends WorkerReady message
import '../js/worker/worker.js';

// Import types for type-safe worker communication
import type { 
  WorkerMessage, 
  MessageType, 
  MessageHandler,
  MessageDataMap 
} from '../types/index.js';

// Export types for TypeScript consumers of the worker
export type { 
  WorkerMessage, 
  MessageType, 
  MessageHandler,
  MessageDataMap,
  SystemConfig,
  CPUImplementation
} from '../types/index.js';

// Export something to prevent Vite from optimizing away the bundle
// This ensures the worker initialization code runs
export const workerInitialized = true;

// Type declaration for worker global scope
declare global {
  interface WorkerGlobalScope {
    onmessage: ((this: WorkerGlobalScope, ev: MessageEvent<WorkerMessage>) => any) | null;
    postMessage(message: WorkerMessage, transfer?: Transferable[]): void;
  }
}
