export interface SystemConfig {
    arch: 'or1k' | 'riscv';
    cpu: 'asm' | 'safe' | 'dynamic' | 'wasm' | 'smp';
    memorysize: number;
    ncores: number;
    kernelURL: string;
    dtbURL?: string;
}
export interface FilesystemConfig {
    path?: string;
    basefsURL: string;
    extendedfsURL?: string;
    earlyload: string[];
    lazyloadimages: string[];
}
export interface Terminal {
    Init(jor1kGUI: any, tty: string): void;
    WasHitByEvent(evt: Event): boolean;
    PauseBlink(pause: boolean): void;
    SetCharReceiveListener?(callback: (char: number) => void): void;
    RemoveCharReceiveListener?(): void;
}
export interface EmulatorParameters {
    system: SystemConfig;
    fs?: FilesystemConfig;
    path?: string;
    syncURL?: string;
    userid?: string;
    worker?: Worker;
    fbid?: string;
    fps?: number;
    term?: Terminal;
    terms?: Terminal[];
    clipboardid?: string;
    statsid?: string;
    relayURL?: string;
}
export type CPUImplementation = 'asm' | 'safe' | 'dynamic' | 'wasm' | 'smp';
export interface CPUFactory {
    createCPU(type: CPUImplementation, ram: RAM, heap: ArrayBuffer): CPUCore | FastCPUCore;
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
export interface CPUCore {
    Reset(): void;
    Step(instructions: number, cycles: number): number;
    GetTicks(): number;
    GetTimeToNextInterrupt(): number;
    ProgressTime(delta: number): void;
}
export interface FastCPUCore {
    Reset(): void;
    Step(instructions: number, cycles: number): number;
    GetTicks(): number;
}
//# sourceMappingURL=system.d.ts.map