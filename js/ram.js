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
}

var ethreg0 = 0xa000;
var ethreg38 = 0x22;

RAM.prototype.ReadMemory32 = function(addr) {
    if (addr > this.memsize - 4) {
        if ((addr >= 0x92000000) && (addr <= 0x92001000 - 4)) //eth
        {
            if (addr == 0x92000000) {
                return ethreg0;
            }
            if (addr == 0x92000038) {
                var ret = ethreg38;
                if (ethreg38 == 0x1613) {
                    ethreg38 = 0xffff;
                }
                if (ethreg38 == 0x22) {
                    ethreg38 = 0x1613;
                }
                return ret;
            }
            return 0x0;
        }
        else {
            DebugMessage("Error in ReadMemory32: RAM region " + hex8(addr) + " is not accessible");
            abort();
        }
    }
    return this.uint32mem[addr >>> 2];
};

RAM.prototype.WriteMemory32 = function(addr, x) {
    /*
	if ((addr >= 0x900) && (addr <= 0xAFF))  {
	    DebugMessage("Write at " + hex8(addr) + ": " + hex8(x) + " clock: " + cpu.clock);
	    //abort();
	}
    */
    if (addr > this.memsize - 4) {
        //eth
        if ((addr >= 0x92000000) && (addr <= 0x92001000 - 4)) {
            if (addr == 0x92000000) {
                ethreg0 = x;
            }
            return;
        }
        //fb
        else if ((addr >= 0x91000000) && (addr <= 0x91101000 - 4)) {
            if (addr == 0x91000014) {
                fb.SetAddr(Swap32(x));
            }
            //fb.addr = Swap32(x);
            //	fb.Update();
            //DebugMessage("WriteMemory32: FB addr " + hex8(addr) + ": " + hex8(x));
            return;
        }
        else {
            DebugMessage("Error in WriteMemory32: RAM region " + hex8(addr) + " is not accessible");
            abort();
        }
    }
    this.uint32mem[addr >>> 2] = x;
};


RAM.prototype.ReadMemory8 = function(addr) {
    /*
    if (cpu.clock >= 0x001C6CB0) {
        DebugMessage(hex8(addr) + " " + addr);
    }
    */
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
        //Exception(EXCEPT_BUSERR, addr);
        if ((addr >= 0x90000000) && (addr <= 0x90000006)) {
            uart.WriteRegister(addr - 0x90000000, x);
            return;
        }
        else {
            DebugMessage("Error in WriteMemory8: RAM region is not accessible");
            abort();
        }
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
    //this.uint8mem[addr] = x&0xFF;	
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

    //return (this.uint8mem[addr]<<8) | this.uint8mem[addr+1];
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
    //this.uint8mem[addr] = (x>>>8)&0xFF;
    //this.uint8mem[addr+1] = x&0xFF;
};
