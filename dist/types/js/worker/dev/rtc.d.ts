export default RTCDev;
declare function RTCDev(intdev: any): void;
declare class RTCDev {
    constructor(intdev: any);
    intdev: any;
    Reset(): void;
    ctrl: any;
    ReadReg32(addr: any): any;
    WriteReg32(addr: any, value: any): void;
}
//# sourceMappingURL=rtc.d.ts.map