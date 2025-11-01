export default FBDev;
declare function FBDev(ram: any): void;
declare class FBDev {
    constructor(ram: any);
    ram: any;
    width: number;
    height: number;
    addr: number;
    n: number;
    buffer: Int32Array<ArrayBuffer>;
    Reset(): void;
    ReadReg32(addr: any): number;
    WriteReg32(addr: any, value: any): void;
    OnGetFB(): void;
    GetBuffer(): Int32Array<ArrayBuffer>;
}
//# sourceMappingURL=framebuffer.d.ts.map