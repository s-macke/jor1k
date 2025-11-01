import RAM from './ram.js';
import Timer from './timer.js';
import FS from './filesystem/filesystem.js';
import Virtio9p from './dev/virtio/9p.js';
import type { Device, CPUCore, FastCPUCore, InterruptController, UARTDevice, SystemInitData } from '../../types/index.js';
export declare class SystemError extends Error {
    readonly code: string;
    readonly context?: any;
    constructor(message: string, code: string, context?: any);
}
export declare class SystemInitializationError extends SystemError {
    constructor(message: string, context?: any);
}
export declare class KernelLoadError extends SystemError {
    constructor(message: string, context?: any);
}
declare class System {
    status: number;
    arch: 'or1k' | 'riscv';
    memorysize: number;
    ncores: number;
    ips: number;
    idletime: number;
    idlemaxwait: number;
    ticksperms: number;
    loopspersecond: number;
    timer: Timer;
    memory?: WebAssembly.Memory;
    heap: ArrayBuffer;
    ram: RAM;
    csr: Int32Array;
    devices: Device[];
    filesystem: FS;
    virtio9pdev: Virtio9p;
    cpu: CPUCore | FastCPUCore;
    idletimeouthandle?: number;
    irqdev?: Device & InterruptController;
    timerdev?: Device;
    uartdev0?: UARTDevice;
    uartdev1?: UARTDevice;
    ethdev?: Device;
    fbdev?: Device;
    atadev?: Device;
    tsdev?: Device;
    kbddev?: Device;
    snddev?: Device;
    rtcdev?: Device;
    plicdev?: Device & InterruptController;
    clintdev?: Device;
    romdev?: Device;
    htif?: any;
    virtiodev1?: Device;
    virtiodev2?: Device;
    virtiodev3?: Device;
    virtiodev4?: Device;
    virtiodev5?: Device;
    virtiodummydev?: Device;
    virtionetdev?: Device;
    constructor();
    Reset(): void;
    Init(system: SystemInitData): Promise<void>;
    RaiseInterrupt(line: number): void;
    ClearInterrupt(line: number): void;
    RaiseSoftInterrupt(line: number, cpuid: number): void;
    ClearSoftInterrupt(line: number, cpuid: number): void;
    PrintState(): void;
    SendStringToTerminal(str: string): void;
    LoadImageAndStart(url: string | ArrayBuffer): void;
    PatchKernel(length: number): void;
    OnKernelLoaded(buffer: ArrayBuffer): void;
    HandleHalt(): void;
    MainLoop(): void;
}
export default System;
//# sourceMappingURL=system.d.ts.map