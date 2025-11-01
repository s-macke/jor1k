export default SMPCPU;
declare function SMPCPU(stdlib: any, foreign: any, heap: any): {
    Init: (_ncores: any) => void;
    Reset: () => void;
    InvalidateTLB: () => void;
    Step: (steps: any, clockspeed: any) => number;
    GetFlags: () => number;
    SetFlags: (x: any) => void;
    GetTimeToNextInterrupt: () => number;
    ProgressTime: (delta: any) => void;
    GetTicks: () => number;
    RaiseInterrupt: (line: any, coreid: any) => void;
    ClearInterrupt: (line: any, coreid: any) => void;
    AnalyzeImage: () => void;
};
//# sourceMappingURL=smpcpu.d.ts.map