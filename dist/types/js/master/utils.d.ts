/**
 * Callback function type for successful upload operations
 */
export type UploadSuccessCallback = (responseText: string) => void;
/**
 * Callback function type for upload error operations
 */
export type UploadErrorCallback = (error: string) => void;
/**
 * Upload binary data to a server endpoint using multipart form data
 * @param url - The server endpoint URL
 * @param filename - The name of the file being uploaded
 * @param data - The binary data to upload
 * @param OnSuccess - Callback function called on successful upload
 * @param OnError - Callback function called on upload error
 */
export declare function UploadBinaryResource(url: string, filename: string, data: Uint8Array, OnSuccess: UploadSuccessCallback, OnError: UploadErrorCallback): void;
//# sourceMappingURL=utils.d.ts.map