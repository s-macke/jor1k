// -------------------------------------------------
// ------------------ UTF8 Helpers -----------------
// -------------------------------------------------
// http://en.wikipedia.org/wiki/UTF-8
"use strict";

/**
 * UTF-8 stream decoder that converts byte sequences to Unicode code points
 */
export class UTF8StreamToUnicode {
    private stream: Uint8Array;
    private ofs: number;

    constructor() {
        this.stream = new Uint8Array(5);
        this.ofs = 0;
    }

    /**
     * Process a single byte and return Unicode code point if sequence is complete
     * @param key - The byte to process
     * @returns Unicode code point if sequence is complete, -1 if incomplete or invalid
     */
    Put(key: number): number {
        this.stream[this.ofs] = key;
        this.ofs++;
        
        switch(this.ofs) {
            case 1:
                // Single byte character (ASCII)
                if (this.stream[0] < 0x80) {
                    this.ofs = 0;
                    return this.stream[0];
                }
                break;

            case 2:
                // Two byte character
                if ((this.stream[0] & 0xE0) === 0xC0 && 
                    (this.stream[1] & 0xC0) === 0x80) {
                    this.ofs = 0;
                    return ((this.stream[0] & 0x1F) << 6) | 
                           ((this.stream[1] & 0x3F) << 0);
                }
                break;

            case 3:
                // Three byte character
                if ((this.stream[0] & 0xF0) === 0xE0 &&
                    (this.stream[1] & 0xC0) === 0x80 &&
                    (this.stream[2] & 0xC0) === 0x80) {
                    this.ofs = 0;
                    return ((this.stream[0] & 0xF) << 12) | 
                           ((this.stream[1] & 0x3F) << 6) | 
                           ((this.stream[2] & 0x3F) << 0);
                }
                break;

            case 4:
                // Four byte character
                if ((this.stream[0] & 0xF8) === 0xF0 &&
                    (this.stream[1] & 0xC0) === 0x80 &&
                    (this.stream[2] & 0xC0) === 0x80 &&
                    (this.stream[3] & 0xC0) === 0x80) {
                    this.ofs = 0;
                    return ((this.stream[0] & 0x7) << 18) | 
                           ((this.stream[1] & 0x3F) << 12) | 
                           ((this.stream[2] & 0x3F) << 6) |
                           ((this.stream[3] & 0x3F) << 0);
                }
                // Invalid 4-byte sequence, reset
                this.ofs = 0;
                return -1;

            default:
                // Invalid state, reset
                this.ofs = 0;
                return -1;
        }
        
        // Incomplete sequence
        return -1;
    }
}

/**
 * Convert a Unicode code point to UTF-8 byte sequence
 * @param key - The Unicode code point to convert
 * @returns Array of bytes representing the UTF-8 encoding
 */
export function UnicodeToUTF8Stream(key: number): number[] {
    key = key | 0; // Ensure integer
    
    if (key < 0x80) {
        return [key];
    } else if (key <= 0x7FF) {
        return [
            (key >> 6) | 0xC0, 
            (key & 0x3F) | 0x80
        ];
    } else if (key <= 0xFFFF) {
        return [
            (key >> 12) | 0xE0,
            ((key >> 6) & 0x3F) | 0x80,
            (key & 0x3F) | 0x80
        ];
    } else if (key <= 0x10FFFF) {
        return [
            (key >> 18) | 0xF0,
            ((key >> 12) & 0x3F) | 0x80,
            ((key >> 6) & 0x3F) | 0x80,
            (key & 0x3F) | 0x80
        ];
    } else {
        // Invalid Unicode code point
        return [];
    }
}

/**
 * Calculate the UTF-8 byte length of a JavaScript string
 * @param s - The string to measure
 * @returns The number of bytes required to encode the string in UTF-8
 */
export function UTF8Length(s: string): number {
    let length = 0;
    
    for (let i = 0; i < s.length; i++) {
        const key = s.charCodeAt(i);
        
        if (key < 0x80) {
            length += 1;
        } else if (key <= 0x7FF) {
            length += 2;
        } else if (key <= 0xFFFF) {
            length += 3;
        } else if (key <= 0x10FFFF) {
            length += 4;
        }
        // Invalid characters are ignored
    }
    
    return length;
}

/**
 * Encode a JavaScript string to UTF-8 bytes
 * @param s - The string to encode
 * @returns Uint8Array containing the UTF-8 encoded bytes
 */
export function StringToUTF8Bytes(s: string): Uint8Array {
    const length = UTF8Length(s);
    const result = new Uint8Array(length);
    let offset = 0;
    
    for (let i = 0; i < s.length; i++) {
        const key = s.charCodeAt(i);
        const bytes = UnicodeToUTF8Stream(key);
        
        for (let j = 0; j < bytes.length; j++) {
            result[offset++] = bytes[j];
        }
    }
    
    return result;
}

/**
 * Decode UTF-8 bytes to a JavaScript string
 * @param bytes - The UTF-8 encoded bytes
 * @returns The decoded string
 */
export function UTF8BytesToString(bytes: Uint8Array): string {
    const decoder = new UTF8StreamToUnicode();
    let result = '';
    
    for (let i = 0; i < bytes.length; i++) {
        const codePoint = decoder.Put(bytes[i]);
        if (codePoint >= 0) {
            result += String.fromCharCode(codePoint);
        }
    }
    
    return result;
}