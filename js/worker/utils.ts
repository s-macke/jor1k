// -------------------------------------------------
// ------------------ Utils ------------------------
// -------------------------------------------------

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
export function GetMilliseconds(): number {
    return (new Date()).getTime();
}

/**
 * Swap byte order of a 32-bit value (big endian to little endian and vice versa)
 * @param val - The 32-bit value to swap
 * @returns The byte-swapped value
 */
export function Swap32(val: number): number {
    return ((val & 0xFF) << 24) | ((val & 0xFF00) << 8) | ((val >>> 8) & 0xFF00) | ((val >>> 24) & 0xFF);
}

/**
 * Swap byte order of a 16-bit value (big endian to little endian and vice versa)
 * @param val - The 16-bit value to swap
 * @returns The byte-swapped value
 */
export function Swap16(val: number): number {
    return ((val & 0xFF) << 8) | ((val >> 8) & 0xFF);
}

/**
 * Cast an integer to a signed 32-bit integer
 * @param val - The value to cast
 * @returns The signed 32-bit integer
 */
export function int32(val: number): number {
    return (val >> 0);
}

/**
 * Cast an integer to an unsigned 32-bit integer
 * @param val - The value to cast
 * @returns The unsigned 32-bit integer
 */
export function uint32(val: number): number {
    return (val >>> 0);
}

/**
 * Convert a number to hexadecimal string representation
 * @param x - The number to convert
 * @returns Hexadecimal string with 0x prefix and 8 digits
 */
export function ToHex(x: number): string {
    const val = uint32(x);
    return ("0x" + ("00000000" + val.toString(16)).substr(-8).toUpperCase());
}

/**
 * Convert a number to binary string representation with spacing
 * @param x - The number to convert
 * @returns Binary string with spaces every 4 bits and 'b' suffix
 */
export function ToBin(x: number): string {
    const val = uint32(x);
    const s = ("00000000000000000000000000000000" + val.toString(2)).substr(-32) + "b";
    return s.replace(/./g, function (v, i) {return ((i&3)==3)?v + " ": v;});
}

/**
 * Copy binary data between typed arrays
 * @param to - Destination offset
 * @param from - Source offset
 * @param size - Number of bytes to copy
 * @param buffersrc - Source buffer
 * @param bufferdest - Destination buffer
 */
export function CopyBinary(
    to: number, 
    from: number, 
    size: number, 
    buffersrc: Uint8Array, 
    bufferdest: Uint8Array
): void {
    for (let i = 0; i < size; i++) {
        bufferdest[to + i] = buffersrc[from + i];
    }
}

/**
 * Load a binary resource from a URL
 * @param url - The URL to load from
 * @param OnSuccess - Callback function called with the loaded ArrayBuffer
 * @param OnError - Callback function called on error
 */
export function LoadBinaryResource(
    url: string, 
    OnSuccess: LoadSuccessCallback<ArrayBuffer>, 
    OnError: LoadErrorCallback
): void {
    const req = new XMLHttpRequest();
    
    try {
        req.open('GET', url, true);
    } catch(err) {
        OnError(err as Error);
        return;
    }
    
    req.responseType = "arraybuffer";
    req.onreadystatechange = function () {
        if (req.readyState !== 4) {
            return;
        }
        if ((req.status !== 200) && (req.status !== 0)) {
            OnError("Error: Could not load file " + url);
            return;
        }
        const arrayBuffer = req.response;
        if (arrayBuffer) {
            OnSuccess(arrayBuffer);
        } else {
            OnError("Error: No data received from: " + url);
        }
    };
    req.send(null);
}

/**
 * Load a binary resource from a URL with blocking/non-blocking option
 * @param url - The URL to load from
 * @param OnSuccess - Callback function called with the loaded ArrayBuffer
 * @param NonBlocking - Whether to make the request asynchronously
 * @param OnError - Callback function called on error
 */
export function LoadBinaryResourceII(
    url: string, 
    OnSuccess: LoadSuccessCallback<ArrayBuffer>, 
    NonBlocking: boolean, 
    OnError: LoadErrorCallback
): void {
    const req = new XMLHttpRequest();
    
    try {
        req.open('GET', url, NonBlocking);
    } catch(err) {
        OnError(err as Error);
        return;
    }
    
    req.responseType = "arraybuffer";
    req.onreadystatechange = function () {
        if (req.readyState !== 4) {
            return;
        }
        if ((req.status !== 200) && (req.status !== 0)) {
            OnError("Error: Could not load file " + url);
            return;
        }
        const arrayBuffer = req.response;
        if (arrayBuffer) {
            OnSuccess(arrayBuffer);
        } else {
            OnError("Error: No data received from: " + url);
        }
    };
    req.send(null);
}

/**
 * Load a text resource from a URL
 * @param url - The URL to load from
 * @param OnSuccess - Callback function called with the loaded text
 * @param OnError - Callback function called on error
 */
export function LoadTextResource(
    url: string, 
    OnSuccess: LoadSuccessCallback<string>, 
    OnError: LoadErrorCallback
): void {
    const req = new XMLHttpRequest();
    req.open('GET', url, true);
    
    req.onreadystatechange = function () {
        if (req.readyState !== 4) {
            return;
        }
        if ((req.status !== 200) && (req.status !== 0)) {
            OnError("Error: Could not load text file " + url);
            return;
        }
        OnSuccess(req.responseText);
    };
    req.send(null);
}

/**
 * Download multiple URLs asynchronously and return results in order
 * @param urls - Array of URLs to download
 * @param OnSuccess - Callback function called with array of ArrayBuffers
 * @param OnError - Callback function called on error
 */
export function DownloadAllAsync(
    urls: string[], 
    OnSuccess: LoadSuccessCallback<ArrayBuffer[]>, 
    OnError: LoadErrorCallback
): void {
    let pending = urls.length;
    let result: (ArrayBuffer | null)[] = [];
    
    if (pending === 0) {
        setTimeout(() => OnSuccess([]), 0);
        return;
    }
    
    urls.forEach(function(url, i) {
        LoadBinaryResource(
            url, 
            function(buffer) {
                if (result) {
                    result[i] = buffer;
                    pending--;
                    if (pending === 0) {
                        OnSuccess(result as ArrayBuffer[]);
                    }
                }
            }, 
            function(error) {
                if (result) {
                    result = [];
                    OnError(error);
                }
            }
        );
    });
}

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
    OnError: LoadErrorCallback
): void {
    const boundary = "xxxxxxxxx";

    const xhr = new XMLHttpRequest();
    xhr.open('post', url, true);
    xhr.setRequestHeader("Content-Type", "multipart/form-data, boundary=" + boundary);
    xhr.setRequestHeader("Content-Length", data.length.toString());
    
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