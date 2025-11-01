export default CPU;
declare function CPU(cpuname: any, ram: any, htif: any, heap: any, ncores: any): this;
declare class CPU {
    constructor(cpuname: any, ram: any, htif: any, heap: any, ncores: any);
    name: any;
    ncores: any;
    ram: any;
    heap: any;
    htif: any;
    littleendian: boolean;
    Init(): Promise<void>;
    cpu: SafeCPU | (import("../../../types/cpu.js").FastCPUCore & {
        Init(): void;
        GetPC(): number;
        InvalidateTLB(): void;
        PushPrivilegeStack(): void;
        PopPrivilegeStack(): void;
    }) | {
        AnalyzeImage: WebAssembly.ExportValue;
        ClearInterrupt: WebAssembly.ExportValue;
        GetFlags: WebAssembly.ExportValue;
        GetStat: WebAssembly.ExportValue;
        GetTicks: WebAssembly.ExportValue;
        GetTimeToNextInterrupt: WebAssembly.ExportValue;
        GetPC: WebAssembly.ExportValue;
        Init: WebAssembly.ExportValue;
        InvalidateTLB: WebAssembly.ExportValue;
        ProgressTime: WebAssembly.ExportValue;
        RaiseInterrupt: WebAssembly.ExportValue;
        Reset: WebAssembly.ExportValue;
        SetFlags: WebAssembly.ExportValue;
        Step: WebAssembly.ExportValue;
    };
    switchImplementation(cpuname: any): void;
    toString(): string;
}
import SafeCPU from './safecpu.js';
//# sourceMappingURL=index.d.ts.map