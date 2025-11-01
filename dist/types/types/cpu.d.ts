export interface CPUState {
    pc: number;
    nextpc: number;
    delayedpc: number;
    SR: number;
    group0: Int32Array;
    group1: Int32Array;
    group2: Int32Array;
}
export interface CPUCore {
    Reset(): void;
    Step(instructions: number, cycles: number): number;
    GetTicks(): number;
    GetTimeToNextInterrupt(): number;
    ProgressTime(delta: number): void;
    RaiseInterrupt(line: number, cpuid: number): void;
    ClearInterrupt(line: number, cpuid: number): void;
    AnalyzeImage(): void;
    toString(): string;
    littleendian?: boolean;
}
export interface FastCPUCore {
    Reset(): void;
    Step(instructions: number, cycles: number): number;
    GetTicks(): number;
    GetTimeToNextInterrupt(): number;
    ProgressTime(delta: number): void;
    RaiseInterrupt(line: number, cpuid: number): void;
    ClearInterrupt(line: number, cpuid: number): void;
    AnalyzeImage(): void;
    littleendian?: boolean;
}
export interface OR1KCPUCore extends CPUCore {
    r: Int32Array;
    f: Float32Array;
    group0: Int32Array;
    group1: Int32Array;
    group2: Int32Array;
    pc: number;
    nextpc: number;
    delayedpc: number;
    SR: number;
    TTMR: number;
    TTCR: number;
    PICMR: number;
    PICSR: number;
}
export interface RISCVCPUCore extends CPUCore {
    x: Int32Array;
    f: Float64Array;
    pc: number;
    fence: number;
    csr: Int32Array;
    prv: number;
    mstatus: number;
    mtvec: number;
    medeleg: number;
    mideleg: number;
    mie: number;
    mip: number;
    mcause: number;
    mepc: number;
    mtval: number;
}
export interface InstructionSet {
    [opcode: number]: (instruction: number) => void;
}
export interface CPUException {
    type: number;
    addr: number;
    pc: number;
}
export type CPUImplementation = 'asm' | 'safe' | 'dynamic' | 'wasm' | 'smp';
export interface CPUFactory {
    createCPU(type: CPUImplementation, ram: RAM, heap: ArrayBuffer): CPUCore | FastCPUCore;
}
export interface ASMJSForeignInterface {
    imul(a: number, b: number): number;
    DebugMessage(message: string): void;
    abort(): void;
    Read32(addr: number): number;
    Write32(addr: number, value: number): void;
    Read16(addr: number): number;
    Write16(addr: number, value: number): void;
    Read8(addr: number): number;
    Write8(addr: number, value: number): void;
}
export interface RAM {
    heap: ArrayBuffer;
    memory?: WebAssembly.Memory;
    int8mem: Int8Array;
    uint8mem: Uint8Array;
    int16mem: Int16Array;
    uint16mem: Uint16Array;
    int32mem: Int32Array;
    uint32mem: Uint32Array;
}
//# sourceMappingURL=cpu.d.ts.map