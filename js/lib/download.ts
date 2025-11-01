//download.js v3.1, by dandavis; 2008-2014. [CCBY2] see http://danml.com/download.html for tests/usage
// v1 landed a FF+Chrome compat way of downloading strings to local un-named files, upgraded to use a hidden frame and optional mime
// v2 added named files via a[download], msSaveBlob, IE (10+) support, and window.URL support for larger+faster saves than dataURLs
// v3 added dataURL and Blob Input, bind-toggle arity, and legacy dataURL fallback was improved with force-download mime and base64 support. 3.1 improved safari handling.

// https://github.com/rndme/download

/**
 * Type for data that can be downloaded
 */
export type DownloadableData = string | Blob | File;

/**
 * Extended Navigator interface to include msSaveBlob for IE compatibility
 */
interface ExtendedNavigator extends Navigator {
    msSaveBlob?: (blob: Blob, filename: string) => boolean;
}

/**
 * Extended Window interface for browser compatibility
 */
interface ExtendedWindow extends Window {
    Blob?: typeof Blob;
    MozBlob?: typeof Blob;
    WebKitBlob?: typeof Blob;
    URL?: typeof URL;
}

/**
 * Download data as a file to the user's device
 * @param data - The data to download (string, Blob, File, or dataURL)
 * @param strFileName - The filename for the downloaded file
 * @param strMimeType - The MIME type of the file
 * @returns True if download was initiated successfully
 */
function download(data: DownloadableData, strFileName?: string, strMimeType?: string): boolean {
    const self = window as ExtendedWindow;
    const u = "application/octet-stream"; // default mime that triggers iframe downloads
    const m = strMimeType || u;
    let x = data;
    const D = document;
    const a = D.createElement("a");
    const z = function(a: unknown): string { return String(a); };
    
    // Get the appropriate Blob constructor
    let B = (self.Blob || (self as any).MozBlob || (self as any).WebKitBlob || z) as typeof Blob;
    B = (B as any).call ? (B as any).bind(self) : Blob;
    
    const fn = strFileName || "download";
    let blob: Blob;
    let fr: FileReader;

    // Handle reverse arguments for bind usage
    if (String((this as any)) === "true") {
        const temp = [x, m];
        x = temp[1] as DownloadableData;
    }

    // Handle dataURLs directly
    if (typeof x === 'string' && x.match(/^data\:[\w+\-]+\/[\w+\-]+[,;]/)) {
        const nav = navigator as ExtendedNavigator;
        return nav.msSaveBlob ? 
            nav.msSaveBlob(d2b(x), fn) : 
            saver(x);
    }

    // Create blob from data
    blob = x instanceof B ? 
        x : 
        new B([x], { type: m });

    /**
     * Convert dataURL to Blob
     * @param u - The dataURL string
     * @returns Blob representation of the dataURL
     */
    function d2b(u: string): Blob {
        const p = u.split(/[:;,]/);
        const t = p[1];
        const dec = p[2] === "base64" ? atob : decodeURIComponent;
        const bin = dec(p.pop() || '');
        const mx = bin.length;
        const uia = new Uint8Array(mx);

        for (let i = 0; i < mx; ++i) {
            uia[i] = bin.charCodeAt(i);
        }

        return new B([uia], { type: t });
    }

    /**
     * Save the file using various browser-specific methods
     * @param url - The URL or dataURL to save
     * @param winMode - Whether to use window mode for URL cleanup
     * @returns True if save was initiated
     */
    function saver(url: string, winMode?: boolean): boolean {
        // HTML5 download attribute support
        if ('download' in a) {
            a.href = url;
            a.setAttribute("download", fn);
            a.innerHTML = "downloading...";
            D.body.appendChild(a);
            setTimeout(function() {
                a.click();
                D.body.removeChild(a);
                if (winMode === true) {
                    setTimeout(function() { 
                        if (self.URL) {
                            self.URL.revokeObjectURL(a.href);
                        }
                    }, 250);
                }
            }, 66);
            return true;
        }

        // Safari fallback
        if (typeof (window as any).safari !== "undefined") {
            url = "data:" + url.replace(/^data:([\w\/\-\+]+)/, u);
            if (!window.open(url)) {
                if (confirm("Displaying New Document\n\nUse Save As... to download, then click back to return to this page.")) {
                    location.href = url;
                }
            }
            return true;
        }

        // Iframe dataURL download (old Chrome + Firefox)
        const f = D.createElement("iframe");
        D.body.appendChild(f);

        if (!winMode) {
            url = "data:" + url.replace(/^data:([\w\/\-\+]+)/, u);
        }
        f.src = url;
        setTimeout(function() { 
            D.body.removeChild(f); 
        }, 333);

        return true;
    }

    // IE10+ support
    const nav = navigator as ExtendedNavigator;
    if (nav.msSaveBlob) {
        return nav.msSaveBlob(blob, fn);
    }

    // Modern browsers with URL support
    if (self.URL) {
        saver(self.URL.createObjectURL(blob), true);
    } else {
        // Fallback for browsers without URL support
        if (typeof blob === "string" || blob.constructor === z) {
            try {
                return saver("data:" + m + ";base64," + self.btoa(blob as unknown as string));
            } catch (y) {
                return saver("data:" + m + "," + encodeURIComponent(blob as unknown as string));
            }
        }

        // Blob but no URL support
        fr = new FileReader();
        fr.onload = function(e) {
            if (e.target && typeof e.target.result === 'string') {
                saver(e.target.result);
            }
        };
        fr.readAsDataURL(blob);
    }
    
    return true;
}

export default download;