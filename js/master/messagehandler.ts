// -------------------------------------------------
// ------------- MessageHandler --------------------
// -------------------------------------------------

"use strict";

import type { MessageType, WorkerMessage, MessageHandler, MessageDataMap } from '../../types/messages.js';

let worker: Worker | null = null;
let run = true;

/**
 * Send a message to the worker thread
 * @param command - The message command type
 * @param data - The data to send with the message
 */
function Send(command: MessageType, data: unknown): void {
    if (!worker) {
        throw new Error('Worker not initialized. Call SetWorker first.');
    }
    
    worker.postMessage({
        command: command,
        data: data
    } as WorkerMessage);
}

/**
 * Log a debug message
 * @param message - The message to log
 */
function Debug(message: string): void {
    console.log(message);
}

/**
 * Abort execution and terminate the worker
 */
function Abort(): void {
    Debug("Master: Abort execution.");
    run = false;
    if (worker) {
        Send("Abort", {});
    }
    throw new Error('Kill master');
}

/**
 * Handle an error by logging it and aborting
 * @param message - The error message
 */
function DoError(message: string): void {
    Send("Debug", "Error: " + message);
    Abort();
}

/**
 * Log a warning message
 * @param message - The warning message
 */
function Warning(message: string): void {
    Send("Debug", "Warning: " + message);
}

// Message handler registry
const messagemap = new Map<MessageType, (data: unknown) => void>();

/**
 * Register a message handler for a specific message type
 * @param message - The message type to handle
 * @param OnReceive - The callback function to handle the message
 */
function Register(message: MessageType, OnReceive: (data: unknown) => void): void {
    messagemap.set(message, OnReceive);
}

/**
 * Type-safe message registration
 * @param message - The message type to handle
 * @param OnReceive - The callback function with typed data parameter
 */
function RegisterTyped<T extends MessageType>(
    message: T, 
    OnReceive: (data: MessageDataMap[T]) => void
): void {
    messagemap.set(message, OnReceive as (data: unknown) => void);
}

/**
 * Type-safe message sending
 * @param command - The message command type
 * @param data - The typed data to send
 */
function SendTyped<T extends MessageType>(command: T, data: MessageDataMap[T]): void {
    Send(command, data);
}

/**
 * Handle incoming messages from the worker
 * @param e - The message event from the worker
 */
function OnMessage(e: MessageEvent<WorkerMessage>): void {
    const command = e.data.command;

    // Debug Messages are always allowed
    if (command === "Debug") {
        const handler = messagemap.get(command);
        if (handler) {
            handler(e.data.data);
        }
        return;
    }

    if (!run) return;
    
    const handler = messagemap.get(command);
    if (handler) {
        try {
            handler(e.data.data);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            Debug("Master: Unhandled exception in command \"" + command + "\": " + errorMessage);
            run = false;
        }
    }
}

/**
 * Set the worker instance and configure message handling
 * @param _worker - The worker instance to use for communication
 */
function SetWorker(_worker: Worker): void {
    worker = _worker;
    worker.onmessage = OnMessage;
    worker.onerror = function(e: ErrorEvent) {
        Debug("Error at " + e.filename + ":" + e.lineno + ": " + e.message);
        Abort();
    };
    
    // Register default handlers
    Register("Abort", function() {
        Debug("Master: Received abort signal from worker");
        run = false;
    });
    Register("Debug", function(d: unknown) {
        if (typeof d === 'string') {
            Debug(d);
        }
    });
}

/**
 * Check if the message handler is currently running
 * @returns True if running, false if aborted
 */
function IsRunning(): boolean {
    return run;
}

/**
 * Get the current worker instance
 * @returns The worker instance or null if not set
 */
function GetWorker(): Worker | null {
    return worker;
}

// Export individual functions
export { 
    SetWorker, 
    Register, 
    RegisterTyped,
    Debug, 
    Warning, 
    DoError as Error, 
    Abort, 
    Send,
    SendTyped,
    IsRunning,
    GetWorker
};

// Default export for backward compatibility
const messageHandler: MessageHandler = {
    SetWorker,
    Register,
    Debug,
    Warning,
    Error: DoError,
    Abort,
    Send
};

export default messageHandler;