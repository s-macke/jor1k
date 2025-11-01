export default SoundDev;
declare function SoundDev(intdev: any, ramdev: any): void;
declare class SoundDev {
    constructor(intdev: any, ramdev: any);
    intdev: any;
    ramdev: any;
    Reset(): void;
    addr: any;
    status: number;
    periods: any;
    period_size: any;
    rate: any;
    channels: any;
    offset: number;
    playing: boolean;
    nextperiod: any;
    starttime: number;
    lasttotalframe: number;
    GetTimeToNextInterrupt(): number;
    Progress(): void;
    Elapsed(): void;
    ReadReg32(addr: any): number;
    WriteReg32(addr: any, value: any): void;
    format: any;
}
//# sourceMappingURL=sound.d.ts.map