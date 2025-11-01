// -------------------------------------------------
// --------------------- Utils ---------------------
// -------------------------------------------------

"use strict";

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
export function UploadBinaryResource(
    url: string, 
    filename: string, 
    data: Uint8Array, 
    OnSuccess: UploadSuccessCallback, 
    OnError: UploadErrorCallback
): void {
    const boundary = "xxxxxxxxx";

    const xhr = new XMLHttpRequest();
    xhr.open('post', url, true);
    xhr.setRequestHeader("Content-Type", "multipart/form-data, boundary=" + boundary);
    
    xhr.onreadystatechange = function () {
        if (xhr.readyState !== 4) {
            return;
        }
        if ((xhr.status !== 200) && (xhr.status !== 0)) {
            OnError("Error: Could not upload file " + filename);
            return;
        }
        OnSuccess(xhr.responseText);
    };

    const bodyheader = "--" + boundary + "\r\n" +
        'Content-Disposition: form-data; name="uploaded"; filename="' + filename + '"\r\n' +
        "Content-Type: application/octet-stream\r\n\r\n";

    const bodyfooter = "\r\n--" + boundary + "--";

    const newdata = new Uint8Array(data.length + bodyheader.length + bodyfooter.length);
    let offset = 0;
    
    for (let i = 0; i < bodyheader.length; i++) {
        newdata[offset++] = bodyheader.charCodeAt(i);
    }

    for (let i = 0; i < data.length; i++) {
        newdata[offset++] = data[i];
    }

    for (let i = 0; i < bodyfooter.length; i++) {
        newdata[offset++] = bodyfooter.charCodeAt(i);
    }

    xhr.send(newdata.buffer);
}