/**
 * UTF-8 stream decoder that converts byte sequences to Unicode code points
 */
export declare class UTF8StreamToUnicode {
    private stream;
    private ofs;
    constructor();
    /**
     * Process a single byte and return Unicode code point if sequence is complete
     * @param key - The byte to process
     * @returns Unicode code point if sequence is complete, -1 if incomplete or invalid
     */
    Put(key: number): number;
}
/**
 * Convert a Unicode code point to UTF-8 byte sequence
 * @param key - The Unicode code point to convert
 * @returns Array of bytes representing the UTF-8 encoding
 */
export declare function UnicodeToUTF8Stream(key: number): number[];
/**
 * Calculate the UTF-8 byte length of a JavaScript string
 * @param s - The string to measure
 * @returns The number of bytes required to encode the string in UTF-8
 */
export declare function UTF8Length(s: string): number;
/**
 * Encode a JavaScript string to UTF-8 bytes
 * @param s - The string to encode
 * @returns Uint8Array containing the UTF-8 encoded bytes
 */
export declare function StringToUTF8Bytes(s: string): Uint8Array;
/**
 * Decode UTF-8 bytes to a JavaScript string
 * @param bytes - The UTF-8 encoded bytes
 * @returns The decoded string
 */
export declare function UTF8BytesToString(bytes: Uint8Array): string;
//# sourceMappingURL=utf8.d.ts.map