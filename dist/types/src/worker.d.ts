import '../js/worker/worker.js';
import type { WorkerMessage } from '../types/index.js';
export type { WorkerMessage, MessageType, MessageHandler, MessageDataMap, SystemConfig, CPUImplementation } from '../types/index.js';
export declare const workerInitialized = true;
declare global {
    interface WorkerGlobalScope {
        onmessage: ((this: WorkerGlobalScope, ev: MessageEvent<WorkerMessage>) => any) | null;
        postMessage(message: WorkerMessage, transfer?: Transferable[]): void;
    }
}
//# sourceMappingURL=worker.d.ts.map