import type { MessageType, MessageHandler, MessageDataMap } from '../../types/messages.js';
/**
 * Send a message to the main thread
 * @param command - The message command type
 * @param data - The data to send with the message
 */
declare function Send(command: MessageType, data: any): void;
/**
 * Log a debug message by sending it to the main thread
 * @param message - The message to log
 */
declare function Debug(message: string): void;
/**
 * Abort execution and terminate the worker
 */
declare function Abort(): void;
/**
 * Handle an error by logging it and aborting
 * @param message - The error message
 */
declare function DoError(message: string): void;
/**
 * Log a warning message
 * @param message - The warning message
 */
declare function Warning(message: string): void;
/**
 * Register a message handler for a specific message type
 * @param message - The message type to handle
 * @param OnReceive - The callback function to handle the message
 */
declare function Register(message: MessageType, OnReceive: (data: any) => void): void;
/**
 * Type-safe message registration
 * @param message - The message type to handle
 * @param OnReceive - The callback function with typed data parameter
 */
declare function RegisterTyped<T extends MessageType>(message: T, OnReceive: (data: MessageDataMap[T]) => void): void;
/**
 * Type-safe message sending
 * @param command - The message command type
 * @param data - The typed data to send
 */
declare function SendTyped<T extends MessageType>(command: T, data: MessageDataMap[T]): void;
/**
 * Get the current working path
 * @returns The current working path
 */
declare function GetWorkingPath(): string;
/**
 * Set the working path
 * @param path - The new working path
 */
declare function SetWorkingPath(path: string): void;
/**
 * Check if the message handler is currently running
 * @returns True if running, false if aborted
 */
declare function IsRunning(): boolean;
export { Register, RegisterTyped, Debug, DoError as Error, Warning, Abort, Send, SendTyped, GetWorkingPath, SetWorkingPath, IsRunning };
declare const messageHandler: MessageHandler;
export default messageHandler;
//# sourceMappingURL=messagehandler.d.ts.map