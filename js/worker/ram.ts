// -------------------------------------------------
// -------------------- RAM ------------------------
// -------------------------------------------------

// The access is assumed to be aligned. The check have to be performed elsewhere.
// Consider that the data in Javascript is saved in 32-Bit little endian format
// for big endian emulations we flip each 32-Bit for faster access

// For faster access for the devices we limit the offset of the device to 
// 0xyy000000 where yy is a number between 0x0 and 0xFF

import message from './messagehandler.js';
import { Swap32, Swap16 } from './utils.js';

// Device interface for memory-mapped devices
interface MemoryDevice {
    ReadReg8?(addr: number): number;
    WriteReg8?(addr: number, value: number): void;
    ReadReg16?(addr: number): number;
    WriteReg16?(addr: number, value: number): void;
    ReadReg32?(addr: number): number;
    WriteReg32?(addr: number, value: number): void;
}

type Endianness = "little" | "big";

class RAM {
    heap: ArrayBuffer;
    memory?: WebAssembly.Memory;
    int32mem: Int32Array;
    uint8mem: Uint8Array;
    sint8mem: Int8Array;
    devices: (MemoryDevice | undefined)[];
    nativeendian: Endianness;
    
    // Function pointers for endian-specific operations
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

    constructor(heap: ArrayBuffer, ramoffset: number) {
        //use typed arrays
        this.heap = heap;
        this.int32mem = new Int32Array(this.heap, ramoffset);
        this.uint8mem = new Uint8Array(this.heap, ramoffset);
        this.sint8mem = new Int8Array(this.heap, ramoffset);

        this.devices = new Array(0x100);

        // generic functions assume little endian
        this.nativeendian = "little";

        // little endian machine independent
        this.Read32Little = this.Read32LittleTemplate.bind(this);
        this.Write32Little = this.Write32LittleTemplate.bind(this);
        this.Read16Little = this.Read16LittleTemplate.bind(this);
        this.Write16Little = this.Write16LittleTemplate.bind(this);
        this.Read8Little = this.Read8LittleTemplate.bind(this);
        this.Write8Little = this.Write8LittleTemplate.bind(this);

        // machine dependent functions
        this.Read32 = this.Read32LittleTemplate.bind(this);
        this.Write32 = this.Write32LittleTemplate.bind(this);
        this.Read16 = this.Read16LittleTemplate.bind(this);
        this.Write16 = this.Write16LittleTemplate.bind(this);
        this.Read8 = this.Read8LittleTemplate.bind(this);
        this.Write8 = this.Write8LittleTemplate.bind(this);

        // big endian machine independent only used by big endian machines
        this.Read32Big = this.Read32BigTemplate.bind(this);
        this.Write32Big = this.Write32BigTemplate.bind(this);
        this.Read16Big = this.Read16BigTemplate.bind(this);
        this.Write16Big = this.Write16BigTemplate.bind(this);
        this.Read8Big = this.Read8BigTemplate.bind(this);
        this.Write8Big = this.Write8BigTemplate.bind(this);
    }

    AddDevice(device: MemoryDevice, devaddr: number, _devsize: number): void {
        if (devaddr & 0xFFFFFF) {
            message.Debug("Error: The device address not in the allowed memory region");
            message.Abort();
        }
        this.devices[(devaddr>>24)&0xFF] = device;
    }

    Little2Big(length: number): void {
        for (let i = 0; i < length >> 2; i++) {
            this.int32mem[i] = Swap32(this.int32mem[i]);
        }
        this.Read32 = this.Read32BigTemplate.bind(this);
        this.Write32 = this.Write32BigTemplate.bind(this);
        this.Read16 = this.Read16BigTemplate.bind(this);
        this.Write16 = this.Write16BigTemplate.bind(this);
        this.Read8 = this.Read8BigTemplate.bind(this);
        this.Write8 = this.Write8BigTemplate.bind(this);

        this.Read32Little = (addr: number) => Swap32(this.Read32BigTemplate(addr));
        this.Write32Little = (addr: number, x: number) => this.Write32BigTemplate(addr, Swap32(x));
        this.Read16Little = (addr: number) => Swap16(this.Read16BigTemplate(addr));
        this.Write16Little = (addr: number, x: number) => this.Write16BigTemplate(addr, Swap16(x));
        this.Read8Little = this.Read8BigTemplate.bind(this);
        this.Write8Little = this.Write8BigTemplate.bind(this);

        this.nativeendian = "big";
    }

    Read32BigTemplate(addr: number): number {
        addr = addr | 0;
        if (addr >= 0) {
            if (this.int32mem.byteLength <= addr) {
                message.Debug("Error in Read32Big: read above upper boundary");
                message.Abort();
            }
            return this.int32mem[addr >> 2];
        }
        const device = this.devices[(addr>>24)&0xFF];
        if (!device || !device.ReadReg32) {
            message.Debug("Error in Read32Big: device not found or doesn't support ReadReg32");
            message.Abort();
            return 0;
        }
        return device.ReadReg32(addr & 0xFFFFFF);
    }

    Read32LittleTemplate(addr: number): number {
        addr = addr | 0;
        if (addr < 0) {
            addr = addr ^ 0x80000000;
            if (this.int32mem.byteLength <= addr) {
                message.Debug("Error in Read32Little: read above upper boundary");
                message.Abort();
            }
            return this.int32mem[addr >> 2];
        }
        const device = this.devices[(addr>>24)&0xFF];
        if (!device || !device.ReadReg32) {
            message.Debug("Error in Read32Little: device not found or doesn't support ReadReg32");
            message.Abort();
            return 0;
        }
        return device.ReadReg32(addr & 0xFFFFFF);
    }

    Write32BigTemplate(addr: number, x: number): void {
        addr = addr | 0;
        if (addr >= 0) {
            if (this.int32mem.byteLength <= addr) {
                message.Debug("Error in Write32Big: write above upper boundary");
                message.Abort();
            }
            this.int32mem[addr >> 2] = x|0;
            return;
        }
        const device = this.devices[(addr>>24)&0xFF];
        if (!device || !device.WriteReg32) {
            message.Debug("Error in Write32Big: device not found or doesn't support WriteReg32");
            message.Abort();
            return;
        }
        device.WriteReg32(addr & 0xFFFFFF, x|0);
    }

    Write32LittleTemplate(addr: number, x: number): void {
        addr = addr | 0;
        if (addr < 0) {
            addr = addr ^ 0x80000000;
            if (this.int32mem.byteLength <= addr) {
                message.Debug("Error in Write32Little: write above upper boundary");
                message.Abort();
            }
            this.int32mem[addr >> 2] = x|0;
            return;
        }
        const device = this.devices[(addr>>24)&0xFF];
        if (!device || !device.WriteReg32) {
            message.Debug("Error in Write32Little: device not found or doesn't support WriteReg32");
            message.Abort();
            return;
        }
        device.WriteReg32(addr & 0xFFFFFF, x|0);
    }

    Read8BigTemplate(addr: number): number {
        addr = addr | 0;
        if (addr >= 0) {
            if (this.uint8mem.byteLength <= addr) {
                message.Debug("Error in Read8Big: read above upper boundary");
                message.Abort();
            }
            return this.uint8mem[addr ^ 3];
        }
        const device = this.devices[(addr>>24)&0xFF];
        if (!device || !device.ReadReg8) {
            message.Debug("Error in Read8Big: device not found or doesn't support ReadReg8");
            message.Abort();
            return 0;
        }
        return device.ReadReg8(addr & 0xFFFFFF);
    }

    Read8LittleTemplate(addr: number): number {
        addr = addr | 0;
        if (addr < 0) {
            addr = addr ^ 0x80000000;
            if (this.uint8mem.byteLength <= addr) {
                message.Debug("Error in Read8Little: read above upper boundary");
                message.Abort();
            }
            return this.uint8mem[addr];
        }
        const device = this.devices[(addr>>24)&0xFF];
        if (!device || !device.ReadReg8) {
            message.Debug("Error in Read8Little: device not found or doesn't support ReadReg8");
            message.Abort();
            return 0;
        }
        return device.ReadReg8(addr & 0xFFFFFF);
    }

    Write8BigTemplate(addr: number, x: number): void {
        addr = addr | 0;
        if (addr >= 0) {
            if (this.uint8mem.byteLength <= addr) {
                message.Debug("Error in Write8Big: write above upper boundary");
                message.Abort();
            }
            this.uint8mem[addr ^ 3] = x|0;
            return;
        }
        const device = this.devices[(addr>>24)&0xFF];
        if (!device || !device.WriteReg8) {
            message.Debug("Error in Write8Big: device not found or doesn't support WriteReg8");
            message.Abort();
            return;
        }
        device.WriteReg8(addr & 0xFFFFFF, x|0);
    }

    Write8LittleTemplate(addr: number, x: number): void {
        addr = addr | 0;
        if (addr < 0) {
            addr = addr ^ 0x80000000;
            if (this.uint8mem.byteLength <= addr) {
                message.Debug("Error in Write8Little: write above upper boundary");
                message.Abort();
            }
            this.uint8mem[addr] = x|0;
            return;
        }
        const device = this.devices[(addr>>24)&0xFF];
        if (!device || !device.WriteReg8) {
            message.Debug("Error in Write8Little: device not found or doesn't support WriteReg8");
            message.Abort();
            return;
        }
        device.WriteReg8(addr & 0xFFFFFF, x|0);
    }

    Read16BigTemplate(addr: number): number {
        addr = addr | 0;
        if (addr >= 0) {
            if (this.uint8mem.byteLength <= addr) {
                message.Debug("Error in Read16Big: read above upper boundary");
                message.Abort();
            }
            return (this.uint8mem[(addr ^ 2)+1] << 8) | this.uint8mem[(addr ^ 2)];
        }
        const device = this.devices[(addr>>24)&0xFF];
        if (!device || !device.ReadReg16) {
            message.Debug("Error in Read16Big: device not found or doesn't support ReadReg16");
            message.Abort();
            return 0;
        }
        return device.ReadReg16(addr & 0xFFFFFF);
    }

    Read16LittleTemplate(addr: number): number {
        addr = addr | 0;
        if (addr < 0) {
            addr = addr ^ 0x80000000;
            if (this.uint8mem.byteLength <= addr) {
                message.Debug("Error in Read16Little: read above upper boundary");
                message.Abort();
            }
            return (this.uint8mem[addr+1] << 8) | this.uint8mem[addr];
        }
        const device = this.devices[(addr>>24)&0xFF];
        if (!device || !device.ReadReg16) {
            message.Debug("Error in Read16Little: device not found or doesn't support ReadReg16");
            message.Abort();
            return 0;
        }
        return device.ReadReg16(addr & 0xFFFFFF);
    }

    Write16BigTemplate(addr: number, x: number): void {
        addr = addr | 0;
        if (addr >= 0) {
            if (this.uint8mem.byteLength <= addr) {
                message.Debug("Error in Write16Big: write above upper boundary");
                message.Abort();
            }
            this.uint8mem[(addr ^ 2)+1] = (x >> 8) & 0xFF;
            this.uint8mem[(addr ^ 2)  ] = x & 0xFF;
            return;
        }
        const device = this.devices[(addr>>24)&0xFF];
        if (!device || !device.WriteReg16) {
            message.Debug("Error in Write16Big: device not found or doesn't support WriteReg16");
            message.Abort();
            return;
        }
        device.WriteReg16(addr & 0xFFFFFF, x|0);
    }

    Write16LittleTemplate(addr: number, x: number): void {
        addr = addr | 0;
        if (addr < 0) {
            addr = addr ^ 0x80000000;
            if (this.uint8mem.byteLength <= addr) {
                message.Debug("Error in Write16Little: write above upper boundary");
                message.Abort();
            }
            this.uint8mem[addr+1] = (x >> 8) & 0xFF;
            this.uint8mem[addr  ] =  x & 0xFF;
            return;
        }
        const device = this.devices[(addr>>24)&0xFF];
        if (!device || !device.WriteReg16) {
            message.Debug("Error in Write16Little: device not found or doesn't support WriteReg16");
            message.Abort();
            return;
        }
        device.WriteReg16(addr & 0xFFFFFF, x|0);
    }
}

export default RAM;
