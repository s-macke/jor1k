declare class TimerDev {
    sync: number;
    constructor();
    Reset(): void;
    ReadReg32(_addr: number): number;
    WriteReg32(addr: number, value: number): void;
}
export default TimerDev;
//# sourceMappingURL=timer.d.ts.map