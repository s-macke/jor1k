// -------------------------------------------------
// -------------------- RAM ------------------------
// -------------------------------------------------

// consider that the data is saved in 32-Bit little endian format

// For faster access to the devices we limit the offset to 
// 0xyy000000 where yy is a number between 0x0 and 0xFF

// constructor
function RAM(heap, ramoffset) {
    //use typed arrays
    this.mem = heap;
    this.int32mem = new Int32Array(this.mem, ramoffset);
    this.uint8mem = new Uint8Array(this.mem, ramoffset);
    this.sint8mem = new Int8Array(this.mem, ramoffset);
    this.devices = new Array(0x100);
}

RAM.prototype.AddDevice = function(device, devaddr, devsize)
{
    if (devaddr & 0xFFFFFF) {
        DebugMessage("Error: The device address not in the allowed memory region");
        abort();
    }
    this.devices[(devaddr>>24)&0xFF] = device;
}

RAM.prototype.ReadMemory32 = function(addr) {
    if (addr >= 0) {
        return this.int32mem[addr >> 2];
    }
    return this.devices[(addr>>24)&0xFF].ReadReg32(addr & 0xFFFFFF);
    //DebugMessage("Error in ReadMemory32: RAM region " + hex8(addr) + " is not accessible");
    //abort();
    return 0x0;
};

RAM.prototype.WriteMemory32 = function(addr, x) {
    if (addr >= 0) {
        this.int32mem[addr >> 2] = x;
        return;
    }
    this.devices[(addr>>24)&0xFF].WriteReg32(addr & 0xFFFFFF, x);
    //DebugMessage("Error in WriteMemory32: RAM region " + hex8(addr) + " is not accessible");
    //abort();
};

RAM.prototype.ReadMemory8 = function(addr) {
    if (addr >= 0) {
        return this.uint8mem[addr ^ 3];
    }
    return this.devices[(addr>>24)&0xFF].ReadReg8(addr & 0xFFFFFF);
    //DebugMessage("Error in ReadMemory8: RAM region " + hex8(addr) + " is not accessible");
    //abort();
    return 0x0;
};


RAM.prototype.WriteMemory8 = function(addr, x) {
    if (addr >= 0) {
        this.uint8mem[addr ^ 3] = x;
        return;
    }
    this.devices[(addr>>24)&0xFF].WriteReg8(addr & 0xFFFFFF, x);
    //DebugMessage("Error in WriteMemory8: RAM region " + hex8(addr) + " is not accessible");
    //abort();
    // Exception(EXCEPT_BUSERR, addr);
};

RAM.prototype.ReadMemory16 = function(addr) {

    if (addr >= 0) {
        return (this.uint8mem[(addr ^ 2)+1] << 8) | this.uint8mem[(addr ^ 2)];
    }
    return this.devices[(addr>>24)&0xFF].ReadReg16(addr & 0xFFFFFF);
    //DebugMessage("Error in ReadMemory16: RAM region " + hex8(addr) + " is not accessible");
    //abort();
    return 0x0;
};

RAM.prototype.WriteMemory16 = function(addr, x) {
    if (addr >= 0) {
        this.uint8mem[(addr ^ 2)+1] = (x >> 8) & 0xFF;
        this.uint8mem[(addr ^ 2)  ] = x & 0xFF;
        return;
    }
    this.devices[(addr>>24)&0xFF].WriteReg16(addr & 0xFFFFFF, x);
    //DebugMessage("Error in WriteMemory16: RAM region " + hex8(addr) + " is not accessible");
    //abort();
};
