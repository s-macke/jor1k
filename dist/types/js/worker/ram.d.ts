interface MemoryDevice {
    ReadReg8?(addr: number): number;
    WriteReg8?(addr: number, value: number): void;
    ReadReg16?(addr: number): number;
    WriteReg16?(addr: number, value: number): void;
    ReadReg32?(addr: number): number;
    WriteReg32?(addr: number, value: number): void;
}
type Endianness = "little" | "big";
declare class RAM {
    heap: ArrayBuffer;
    memory?: WebAssembly.Memory;
    int32mem: Int32Array;
    uint8mem: Uint8Array;
    sint8mem: Int8Array;
    devices: (MemoryDevice | undefined)[];
    nativeendian: Endianness;
    Read32Little: (addr: number) => number;
    Write32Little: (addr: number, x: number) => void;
    Read16Little: (addr: number) => number;
    Write16Little: (addr: number, x: number) => void;
    Read8Little: (addr: number) => number;
    Write8Little: (addr: number, x: number) => void;
    Read32: (addr: number) => number;
    Write32: (addr: number, x: number) => void;
    Read16: (addr: number) => number;
    Write16: (addr: number, x: number) => void;
    Read8: (addr: number) => number;
    Write8: (addr: number, x: number) => void;
    Read32Big: (addr: number) => number;
    Write32Big: (addr: number, x: number) => void;
    Read16Big: (addr: number) => number;
    Write16Big: (addr: number, x: number) => void;
    Read8Big: (addr: number) => number;
    Write8Big: (addr: number, x: number) => void;
    constructor(heap: ArrayBuffer, ramoffset: number);
    AddDevice(device: MemoryDevice, devaddr: number, _devsize: number): void;
    Little2Big(length: number): void;
    Read32BigTemplate(addr: number): number;
    Read32LittleTemplate(addr: number): number;
    Write32BigTemplate(addr: number, x: number): void;
    Write32LittleTemplate(addr: number, x: number): void;
    Read8BigTemplate(addr: number): number;
    Read8LittleTemplate(addr: number): number;
    Write8BigTemplate(addr: number, x: number): void;
    Write8LittleTemplate(addr: number, x: number): void;
    Read16BigTemplate(addr: number): number;
    Read16LittleTemplate(addr: number): number;
    Write16BigTemplate(addr: number, x: number): void;
    Write16LittleTemplate(addr: number, x: number): void;
}
export default RAM;
//# sourceMappingURL=ram.d.ts.map