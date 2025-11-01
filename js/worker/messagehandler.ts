// -------------------------------------------------
// ------------- MessageHandler --------------------
// -------------------------------------------------

"use strict";

import type { MessageType, WorkerMessage, MessageHandler, MessageDataMap } from '../../types/messages.js';

let run = true;
let workingpath = '';

/**
 * Send a message to the main thread
 * @param command - The message command type
 * @param data - The data to send with the message
 */
function Send(command: MessageType, data: unknown): void {
    postMessage({
        command: command,
        data: data
    } as WorkerMessage);
}

/**
 * Log a debug message by sending it to the main thread
 * @param message - The message to log
 */
function Debug(message: string): void {
    Send("Debug", message);
}

/**
 * Abort execution and terminate the worker
 */
function Abort(): void {
    Debug("Worker: Abort execution.");
    
    // Call PrintOnAbort handler if registered
    const printHandler = messagemap.get("PrintOnAbort");
    if (printHandler) {
        try {
            printHandler(null);
        } catch (error) {
            // Ignore errors in PrintOnAbort handler
        }
    }
    
    Send("Abort", {});
    run = false;
    throw new Error('Kill worker'); // Don't return
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
 * Handle incoming messages from the main thread
 * @param e - The message event from the main thread
 */
function OnMessage(e: MessageEvent<WorkerMessage>): void {
    if (!run) return; // ignore all messages after an error

    const command = e.data.command;
    const handler = messagemap.get(command);
    
    if (handler) {
        try {
            handler(e.data.data);
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            const stack = error instanceof Error ? error.stack : '';
            Debug("Worker: Unhandled exception in command \"" + command + "\": " + errorMessage);
            if (stack) {
                Debug(stack);
            }
            run = false;
        }
        return;
    }
}

/**
 * Get the current working path
 * @returns The current working path
 */
function GetWorkingPath(): string { 
    return workingpath; 
}

/**
 * Set the working path
 * @param path - The new working path
 */
function SetWorkingPath(path: string): void {
    workingpath = path;
}

/**
 * Check if the message handler is currently running
 * @returns True if running, false if aborted
 */
function IsRunning(): boolean {
    return run;
}

// Set up global message handler
if (typeof onmessage !== 'undefined') {
    onmessage = OnMessage;
}

// Register default handlers
Register("Abort", function() { 
    run = false; 
});

Register("WorkingPath", function(data: string) { 
    workingpath = data; 
});

// Export individual functions
export { 
    Register, 
    RegisterTyped,
    Debug, 
    DoError as Error, 
    Warning, 
    Abort, 
    Send,
    SendTyped,
    GetWorkingPath,
    SetWorkingPath,
    IsRunning
};

// Default export for backward compatibility
const messageHandler: MessageHandler = {
    Register,
    Debug,
    Error: DoError,
    Warning,
    Abort,
    Send,
    GetWorkingPath
};

export default messageHandler;