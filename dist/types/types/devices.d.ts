export interface Device {
    Reset(): void;
    ReadReg32?(addr: number): number;
    WriteReg32?(addr: number, value: number): void;
    Step?(): void;
}
export interface MemoryMappedDevice extends Device {
    GetBaseAddress(): number;
    GetSize(): number;
}
export interface InterruptController {
    RaiseInterrupt(line: number, cpuid?: number): void;
    ClearInterrupt(line: number, cpuid?: number): void;
    GetInterruptStatus?(cpuid: number): number;
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
    ReadMemory8(addr: number): number;
    WriteMemory8(addr: number, value: number): void;
    ReadMemory16(addr: number): number;
    WriteMemory16(addr: number, value: number): void;
    ReadMemory32(addr: number): number;
    WriteMemory32(addr: number, value: number): void;
    Read8(addr: number): number;
    Write8(addr: number, value: number): void;
    Read16(addr: number): number;
    Write16(addr: number, value: number): void;
    Read32(addr: number): number;
    Write32(addr: number, value: number): void;
    Little2Big(length: number): void;
}
export interface MemoryRegion {
    base: number;
    size: number;
    readable: boolean;
    writable: boolean;
    executable: boolean;
}
export interface UARTDevice extends Device {
    id: number;
    ReceiveChar(chars: number[]): void;
    Step(): void;
}
export interface FramebufferDevice extends Device {
    width: number;
    height: number;
    buffer: Int32Array;
    OnGetFB(): void;
    GetBuffer(): ArrayBuffer;
}
export interface EthernetDevice extends Device {
    Receive(frame: ArrayBuffer): void;
    TransmitCallback?: (data: ArrayBuffer) => void;
}
export interface SoundDevice extends Device {
    AddBuffer(buffer: ArrayBuffer): void;
    SetRate(rate: number): void;
}
export interface KeyboardDevice extends Device {
    OnKeyDown(event: KeyboardEvent): void;
    OnKeyUp(event: KeyboardEvent): void;
}
export interface TouchscreenDevice extends Device {
    onmousedown(event: MouseEvent): void;
    onmouseup(event: MouseEvent): void;
    onmousemove(event: MouseEvent): void;
}
export interface VirtIODevice extends Device {
    deviceid: number;
    hostfeatures: number;
    guestfeatures: number;
    configspace: Uint8Array;
    queue: VirtQueue[];
    queuesel: number;
    queuenotify: number;
    status: number;
    intdev: InterruptController;
}
export interface VirtQueue {
    size: number;
    ready: boolean;
    desc_addr: number;
    avail_addr: number;
    used_addr: number;
    last_avail_idx: number;
}
export interface FilesystemDevice extends Device {
    LoadFromJSON(data: any): Promise<void>;
    GetNode(path: string): FileSystemNode | null;
    CreateFile(path: string, data: Uint8Array): boolean;
    DeleteFile(path: string): boolean;
    TAR(path: string): void;
    Sync(path: string): void;
}
export interface FileSystemNode {
    name: string;
    size: number;
    uid: number;
    gid: number;
    mode: number;
    atime: number;
    mtime: number;
    ctime: number;
    data?: Uint8Array;
    children?: Map<string, FileSystemNode>;
}
export interface TimerDevice extends Device {
    ticksperms: number;
    loopspersecond: number;
    instructionsperloop: number;
    timercyclesperinstruction: number;
    correction: number;
    Update(totalsteps: number, ticks: number, gotoidle: boolean): void;
}
export interface ATADevice extends Device {
    cylinder: number;
    head: number;
    sector: number;
    sectors_per_track: number;
    heads: number;
    cylinders: number;
    buffer: Uint8Array;
    identify: Uint8Array;
}
export interface RTCDevice extends Device {
    GetTime(): number;
    SetTime(time: number): void;
}
//# sourceMappingURL=devices.d.ts.map