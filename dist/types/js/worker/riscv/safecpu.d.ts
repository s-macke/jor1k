import type { RAM } from '../ram.js';
import type { RISCVCPUCore } from '../../../types/cpu.js';
declare class SafeCPU implements RISCVCPUCore {
    ram: RAM;
    htif: any;
    r: Int32Array;
    f: Float64Array;
    fi: Int32Array;
    ff: Float32Array;
    csr: Int32Array;
    ticks: number;
    prv: number;
    amoaddr: number;
    amovalue: number;
    pc: number;
    fence: number;
    x: Int32Array;
    mstatus: number;
    mtvec: number;
    medeleg: number;
    mideleg: number;
    mie: number;
    mip: number;
    mcause: number;
    mepc: number;
    mtval: number;
    constructor(ram: RAM, htif: any);
    Reset(): void;
    InvalidateTLB(): void;
    GetTimeToNextInterrupt(): number;
    GetTicks(): number;
    ProgressTime(delta: number): void;
    AnalyzeImage: () => void;
}
export default SafeCPU;
//# sourceMappingURL=safecpu.d.ts.map