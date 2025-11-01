export default PLICDev;
declare function PLICDev(cpuirqhandler: any): void;
declare class PLICDev {
    constructor(cpuirqhandler: any);
    cpuirqhandler: any;
    Reset(): void;
    regs: Uint32Array<ArrayBuffer>;
    mask: number;
    ReadReg32(addr: any): number;
    WriteReg32(addr: any, value: any): void;
    RaiseInterrupt(line: any): void;
    ClearInterrupt(line: any): void;
}
//# sourceMappingURL=plic.d.ts.map