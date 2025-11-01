export default Timer;
declare function Timer(_ticksperms: any, _loopspersecond: any): void;
declare class Timer {
    constructor(_ticksperms: any, _loopspersecond: any);
    ticksperms: any;
    loopspersecond: any;
    baserealtime: number;
    realtime: number;
    lastsystemticks: number;
    systemtime: number;
    correction: number;
    oldcorrection: number;
    steps: number;
    nins: number;
    lastlooptime: number;
    ipms: number;
    instructionsperloop: number;
    timercyclesperinstruction: number;
    Update(nins: any, ticks: any, gotoidle: any): void;
    UpdateTimings(_nins: any, gotoidle: any): void;
    LocalUpdate(_nins: any, gotoidle: any): void;
    GlobalUpdate(ticks: any): void;
}
//# sourceMappingURL=timer.d.ts.map