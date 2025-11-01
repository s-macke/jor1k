export default CLINTDev;
declare function CLINTDev(csr: any): void;
declare class CLINTDev {
    constructor(csr: any);
    csr: any;
    Reset(): void;
    regs: Uint32Array<ArrayBuffer>;
    ReadReg32(addr: any): number;
    WriteReg32(addr: any, value: any): void;
}
//# sourceMappingURL=clint.d.ts.map