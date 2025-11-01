interface SMPInterruptController {
    heap: ArrayBuffer;
    RaiseSoftInterrupt(line: number, cpuid: number): void;
    ClearSoftInterrupt(line: number, cpuid: number): void;
}
declare class IRQDev {
    intdev: SMPInterruptController;
    regs: Uint32Array;
    constructor(intdev: SMPInterruptController);
    Reset(): void;
    ReadReg32(addr: number): number;
    WriteReg32(addr: number, value: number): void;
}
export default IRQDev;
//# sourceMappingURL=irq.d.ts.map