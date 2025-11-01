/**
 * Callback function type for successful resource loading operations
 */
export type LoadSuccessCallback<T> = (data: T) => void;
/**
 * Callback function type for resource loading error operations
 */
export type LoadErrorCallback = (error: string | Error) => void;
/**
 * Callback function type for upload success operations
 */
export type UploadSuccessCallback = (responseText: string) => void;
/**
 * Get current timestamp in milliseconds
 * @returns Current time in milliseconds since epoch
 */
export declare function GetMilliseconds(): number;
/**
 * Swap byte order of a 32-bit value (big endian to little endian and vice versa)
 * @param val - The 32-bit value to swap
 * @returns The byte-swapped value
 */
export declare function Swap32(val: number): number;
/**
 * Swap byte order of a 16-bit value (big endian to little endian and vice versa)
 * @param val - The 16-bit value to swap
 * @returns The byte-swapped value
 */
export declare function Swap16(val: number): number;
/**
 * Cast an integer to a signed 32-bit integer
 * @param val - The value to cast
 * @returns The signed 32-bit integer
 */
export declare function int32(val: number): number;
/**
 * Cast an integer to an unsigned 32-bit integer
 * @param val - The value to cast
 * @returns The unsigned 32-bit integer
 */
export declare function uint32(val: number): number;
/**
 * Convert a number to hexadecimal string representation
 * @param x - The number to convert
 * @returns Hexadecimal string with 0x prefix and 8 digits
 */
export declare function ToHex(x: number): string;
/**
 * Convert a number to binary string representation with spacing
 * @param x - The number to convert
 * @returns Binary string with spaces every 4 bits and 'b' suffix
 */
export declare function ToBin(x: number): string;
/**
 * Copy binary data between typed arrays
 * @param to - Destination offset
 * @param from - Source offset
 * @param size - Number of bytes to copy
 * @param buffersrc - Source buffer
 * @param bufferdest - Destination buffer
 */
export declare function CopyBinary(to: number, from: number, size: number, buffersrc: Uint8Array, bufferdest: Uint8Array): void;
/**
 * Load a binary resource from a URL
 * @param url - The URL to load from
 * @param OnSuccess - Callback function called with the loaded ArrayBuffer
 * @param OnError - Callback function called on error
 */
export declare function LoadBinaryResource(url: string, OnSuccess: LoadSuccessCallback<ArrayBuffer>, OnError: LoadErrorCallback): void;
/**
 * Load a binary resource from a URL with blocking/non-blocking option
 * @param url - The URL to load from
 * @param OnSuccess - Callback function called with the loaded ArrayBuffer
 * @param NonBlocking - Whether to make the request asynchronously
 * @param OnError - Callback function called on error
 */
export declare function LoadBinaryResourceII(url: string, OnSuccess: LoadSuccessCallback<ArrayBuffer>, NonBlocking: boolean, OnError: LoadErrorCallback): void;
/**
 * Load a text resource from a URL
 * @param url - The URL to load from
 * @param OnSuccess - Callback function called with the loaded text
 * @param OnError - Callback function called on error
 */
export declare function LoadTextResource(url: string, OnSuccess: LoadSuccessCallback<string>, OnError: LoadErrorCallback): void;
/**
 * Download multiple URLs asynchronously and return results in order
 * @param urls - Array of URLs to download
 * @param OnSuccess - Callback function called with array of ArrayBuffers
 * @param OnError - Callback function called on error
 */
export declare function DownloadAllAsync(urls: string[], OnSuccess: LoadSuccessCallback<ArrayBuffer[]>, OnError: LoadErrorCallback): void;
/**
 * Upload binary data to a server endpoint using multipart form data
 * @param url - The server endpoint URL
 * @param filename - The name of the file being uploaded
 * @param data - The binary data to upload
 * @param OnSuccess - Callback function called on successful upload
 * @param OnError - Callback function called on upload error
 */
export declare function UploadBinaryResource(url: string, filename: string, data: Uint8Array, OnSuccess: UploadSuccessCallback, OnError: LoadErrorCallback): void;
//# sourceMappingURL=utils.d.ts.map