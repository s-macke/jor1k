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

/* background function for optimization only */
RAM.prototype.ReadMemory32ToSlice8 = function(addr, length) {
    
    if (addr >= 0) {
        var arr = new Uint8Array(length);
        var start = addr >> 2;
        var end = start + (length >> 2);
        if(end & 0x3){
            end++;
        }

        for(var i=start, j=0;i<end;i++,j+=4){
            //ugly, sorry, but hoping unrolled is faster
            arr[j] = this.int32mem[i] >> 24;
            if((j + 1) < arr.length){
                arr[j + 1] = (this.int32mem[i] >> 16) & 0xFF;
            }
            if((j + 2) < arr.length){
                arr[j + 2] = (this.int32mem[i] >> 8) & 0xFF;
            }
            if((j + 3) < arr.length){
                arr[j + 3] = (this.int32mem[i]) & 0xFF;
            }
        }
        return arr;
    }
    DebugMessage("Error in ReadMemorySlice32: RAM region " + hex8(addr) + " is not accessible");
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
