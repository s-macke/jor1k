// -------------------------------------------------
// -------------------- RAM ------------------------
// -------------------------------------------------

// constructor
function RAM(memsize) {
    //use typed arrays
    this.memsize = memsize;
    this.mem = new ArrayBuffer(memsize);
    this.uint32mem = new Uint32Array(this.mem);
    this.uint8mem = new Uint8Array(this.mem);
	this.devices = [];
}

RAM.prototype.AddDevice = function(device, devaddr, devsize)
{
    device.deviceaddr = devaddr;
    device.devicesize = devsize;
    this.devices.push(device);
}

RAM.prototype.ReadMemory32 = function(addr) {
    if (addr <= this.memsize - 4) {
        return this.uint32mem[addr >>> 2];
	}
    for(var i=0; i<this.devices.length; i++) {
        if ((addr >= this.devices[i].deviceaddr) && (addr < (this.devices[i].deviceaddr+this.devices[i].devicesize))) {
            return this.devices[i].ReadReg32(addr - this.devices[i].deviceaddr);
        }
    }
    DebugMessage("Error in ReadMemory32: RAM region " + hex8(addr) + " is not accessible");
    abort();
};

RAM.prototype.WriteMemory32 = function(addr, x) {
    if (addr <= this.memsize - 4) {
        this.uint32mem[addr >>> 2] = x;
        return;
    }
    for(var i=0; i<this.devices.length; i++) {
        if ((addr >= this.devices[i].deviceaddr) && (addr < (this.devices[i].deviceaddr+this.devices[i].devicesize))) {
            return this.devices[i].WriteReg32(addr - this.devices[i].deviceaddr);
        }
    }

    //fb
    if ((addr >= 0x91000000) && (addr <= 0x91101000 - 4)) {
        if (addr == 0x91000014) {
            fb.SetAddr(Swap32(x));
        }
        return;
    }
    DebugMessage("Error in WriteMemory32: RAM region " + hex8(addr) + " is not accessible");
    abort();
    
};


RAM.prototype.ReadMemory8 = function(addr) {
    if (addr > this.memsize - 1) {
        if ((addr >= 0x90000000) && (addr <= 0x90000006)) {
            return uart.ReadRegister(addr - 0x90000000);
        }
        else {
            DebugMessage("Error in ReadMemory8: RAM region is not accessible");
            abort();
        }
    }
    // consider that the data is saved in little endian
    switch (addr & 3) {
    case 0:
        return this.uint8mem[(addr & ~3) | 3];
    case 1:
        return this.uint8mem[(addr & ~3) | 2];
    case 2:
        return this.uint8mem[(addr & ~3) | 1];
    case 3:
        return this.uint8mem[(addr & ~3) | 0];
    }
    //return this.uint8mem[addr];
};

RAM.prototype.WriteMemory8 = function(addr, x) {
    if (addr > this.memsize - 1) {
        if ((addr >= 0x90000000) && (addr <= 0x90000006)) {
            uart.WriteRegister(addr - 0x90000000, x);
            return;
        }
        else {
            DebugMessage("Error in WriteMemory8: RAM region is not accessible");
            abort();
        }
        //Exception(EXCEPT_BUSERR, addr);		
    }
    // consider that the data is saved in little endian	
    switch (addr & 3) {
    case 0:
        this.uint8mem[(addr & ~3) | 3] = x & 0xFF;
        break;
    case 1:
        this.uint8mem[(addr & ~3) | 2] = x & 0xFF;
        break;
    case 2:
        this.uint8mem[(addr & ~3) | 1] = x & 0xFF;
        break;
    case 3:
        this.uint8mem[(addr & ~3) | 0] = x & 0xFF;
        break;
    }
};

RAM.prototype.ReadMemory16 = function(addr) {
    if (addr > this.memsize - 2) {
        DebugMessage("Error in ReadMemory16: RAM region is not accessible");
        abort();
    }
    // consider that the data is saved in little endian	
    if (addr & 2) {
        return (this.uint8mem[(addr & ~3) | 1] << 8) | this.uint8mem[(addr & ~3)];
    }
    else {
        return (this.uint8mem[(addr & ~3) | 3] << 8) | this.uint8mem[(addr & ~3) | 2];
    }
};

RAM.prototype.WriteMemory16 = function(addr, x) {
    if (addr > this.memsize - 2) {
        DebugMessage("Error in WriteMemory16: RAM region is not accessible");
        abort();
    }
    // consider that the data is saved in little endian	
    if (addr & 2) {
        this.uint8mem[(addr & ~3) | 1] = (x >>> 8) & 0xFF;
        this.uint8mem[(addr & ~3)] = x & 0xFF;
    }
    else {
        this.uint8mem[(addr & ~3) | 3] = (x >>> 8) & 0xFF;
        this.uint8mem[(addr & ~3) | 2] = x & 0xFF;
    }
};
