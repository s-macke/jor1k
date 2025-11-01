export default TouchscreenDev;
declare function TouchscreenDev(intdev: any): void;
declare class TouchscreenDev {
    constructor(intdev: any);
    intdev: any;
    Reset(): void;
    control: any;
    status: number;
    ispressed: boolean;
    mousemovecount: number;
    fifo: number;
    fifosize: number;
    onmousedown(event: any): void;
    onmousemove(event: any): void;
    onmouseup(event: any): void;
    ReadReg32(addr: any): any;
    WriteReg32(addr: any, value: any): void;
}
//# sourceMappingURL=touchscreen.d.ts.map