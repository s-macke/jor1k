// -------------------------------------------------
// -------------------- RAM ------------------------
// -------------------------------------------------

// consider that the data is saved in 32-Bit little endian format

// constructor
function RAM(heap, ramoffset) {
    //use typed arrays
    this.mem = heap;
    this.int32mem = new Int32Array(this.mem, ramoffset);
    this.uint8mem = new Uint8Array(this.mem, ramoffset);
    this.devices = [];
}

RAM.prototype.AddDevice = function(device, devaddr, devsize)
{
    device.deviceaddr = devaddr;
    device.devicesize = devsize;
    this.devices.push(device);
}

RAM.prototype.ReadMemory32 = function(addr) {
    if (addr >= 0) {
        return this.int32mem[addr >> 2];
    }
    var uaddr = uint32(addr);
    for(var i=0; i<this.devices.length; i++) {
        if ((uaddr >= this.devices[i].deviceaddr) && (uaddr < (this.devices[i].deviceaddr+this.devices[i].devicesize))) {
            return this.devices[i].ReadReg32(uaddr - this.devices[i].deviceaddr);
        }
    }
    DebugMessage("Error in ReadMemory32: RAM region " + hex8(addr) + " is not accessible");
    abort();
};

RAM.prototype.WriteMemory32 = function(addr, x) {
    if (addr >= 0) {
        this.int32mem[addr >> 2] = x;
        return;
    }
    var uaddr = uint32(addr);
    for(var i=0; i<this.devices.length; i++) {
        if ((uaddr >= this.devices[i].deviceaddr) && (uaddr < (this.devices[i].deviceaddr+this.devices[i].devicesize))) {
            this.devices[i].WriteReg32(uaddr - this.devices[i].deviceaddr, x);
            return;
        }
    }    
    DebugMessage("Error in WriteMemory32: RAM region " + hex8(addr) + " is not accessible");
    abort();
    
};

RAM.prototype.ReadMemory8 = function(addr) {
    if (addr >= 0) {
        return this.uint8mem[addr ^ 3];
    }
    var uaddr = uint32(addr);
    for(var i=0; i<this.devices.length; i++) {
        if ((uaddr >= this.devices[i].deviceaddr) && (uaddr < (this.devices[i].deviceaddr+this.devices[i].devicesize))) {
            return this.devices[i].ReadReg8(uaddr - this.devices[i].deviceaddr);
        }
    }
    DebugMessage("Error in ReadMemory8: RAM region " + hex8(addr) + " is not accessible");
    abort();    
};

RAM.prototype.WriteMemory8 = function(addr, x) {
    if (addr >= 0) {
        this.uint8mem[addr ^ 3] = x;
        return;
    }
    var uaddr = uint32(addr);
    for(var i=0; i<this.devices.length; i++) {
        if ((uaddr >= this.devices[i].deviceaddr) && (uaddr < (this.devices[i].deviceaddr+this.devices[i].devicesize))) {
            this.devices[i].WriteReg8(uaddr - this.devices[i].deviceaddr, x);
            return;
        }
    }
    DebugMessage("Error in WriteMemory8: RAM region " + hex8(addr) + " is not accessible");
    abort();
    // Exception(EXCEPT_BUSERR, addr);
};

RAM.prototype.ReadMemory16 = function(addr) {

    if (addr >= 0) {
        return (this.uint8mem[(addr ^ 2)+1] << 8) | this.uint8mem[(addr ^ 2)];
    }
    var uaddr = uint32(addr);
    for(var i=0; i<this.devices.length; i++) {
        if ((uaddr >= this.devices[i].deviceaddr) && (uaddr < (this.devices[i].deviceaddr+this.devices[i].devicesize))) {
            return this.devices[i].ReadReg16(uaddr - this.devices[i].deviceaddr);
        }
    }
    DebugMessage("Error in ReadMemory16: RAM region " + hex8(addr) + " is not accessible");
    abort();
};

RAM.prototype.WriteMemory16 = function(addr, x) {
    if (addr >= 0) {
        this.uint8mem[(addr ^ 2)+1] = (x >> 8) & 0xFF;
        this.uint8mem[(addr ^ 2)  ] = x & 0xFF;
        return;
    }
    var uaddr = uint32(addr);
    for(var i=0; i<this.devices.length; i++) {
        if ((uaddr >= this.devices[i].deviceaddr) && (uaddr < (this.devices[i].deviceaddr+this.devices[i].devicesize))) {
            this.devices[i].WriteReg16(uaddr - this.devices[i].deviceaddr, x);
            return;
        }
    }
    DebugMessage("Error in WriteMemory16: RAM region " + hex8(addr) + " is not accessible");
    abort();

};
