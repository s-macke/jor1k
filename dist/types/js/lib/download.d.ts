/**
 * Type for data that can be downloaded
 */
export type DownloadableData = string | Blob | File;
/**
 * Download data as a file to the user's device
 * @param data - The data to download (string, Blob, File, or dataURL)
 * @param strFileName - The filename for the downloaded file
 * @param strMimeType - The MIME type of the file
 * @returns True if download was initiated successfully
 */
declare function download(data: DownloadableData, strFileName?: string, strMimeType?: string): boolean;
export default download;
//# sourceMappingURL=download.d.ts.map