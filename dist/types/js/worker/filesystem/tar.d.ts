export default TAR;
declare function TAR(filesystem: any): void;
declare class TAR {
    constructor(filesystem: any);
    fs: any;
    tarbuffer: Uint8Array<ArrayBuffer>;
    tarbufferofs: number;
    tarmode: number;
    tarfileoffset: number;
    Unpack(x: any): void;
    tarfilebuffer: any;
    Pack(path: any): Uint8Array<ArrayBuffer>;
}
//# sourceMappingURL=tar.d.ts.map