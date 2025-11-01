export default LazyUint8Array;
declare function LazyUint8Array(url: any, fallbackLength: any): void;
declare class LazyUint8Array {
    constructor(url: any, fallbackLength: any);
    fallbackLength: any;
    overlay: any[];
    url: any;
    lengthKnown: boolean;
    chunks: any[];
    Set(idx: any, data: any): any;
    Get(idx: any): any;
    DoXHR(from: any, to: any): Uint8Array<any>;
    GetChunk(chunkNum: any): any;
    CacheLength(): void;
    _length: any;
    _chunkSize: any;
}
//# sourceMappingURL=lazyUint8Array.d.ts.map