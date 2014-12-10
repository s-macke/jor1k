// -------------------------------------------------
// -------------------- RAM ------------------------
// -------------------------------------------------

// consider that the data is saved in 32-Bit little endian format

// For faster access for the devices we limit the offset of the device to 
// 0xyy000000 where yy is a number between 0x0 and 0xFF

var message = require('./messagehandler');
var utils = require('./utils');

// constructor
function RAM(heap, ramoffset) {
    //use typed arrays
    this.heap = heap;
    this.int32mem = new Int32Array(this.heap, ramoffset);
    this.uint8mem = new Uint8Array(this.heap, ramoffset);
    this.sint8mem = new Int8Array(this.heap, ramoffset);
    this.devices = new Array(0x100);
}

RAM.prototype.AddDevice = function(device, devaddr, devsize)
{
    if (devaddr & 0xFFFFFF) {
        message.Debug("Error: The device address not in the allowed memory region");
        message.Abort();
    }
    this.devices[(devaddr>>24)&0xFF] = device;
}

RAM.prototype.ReadMemory32 = function(addr) {
    if (addr >= 0) {
        return this.int32mem[addr >> 2];
    }
    return this.devices[(addr>>24)&0xFF].ReadReg32(addr & 0xFFFFFF);
    //message.Debug("Error in ReadMemory32: RAM region " + utils.ToHex(addr) + " is not accessible");
    //message.Abort();
    return 0x0;
};

RAM.prototype.WriteMemory32 = function(addr, x) {
    if (addr >= 0) {
        this.int32mem[addr >> 2] = x;
        return;
    }
    this.devices[(addr>>24)&0xFF].WriteReg32(addr & 0xFFFFFF, x);
    //message.Debug("Error in WriteMemory32: RAM region " + utils.ToHex(addr) + " is not accessible");
    //message.Abort();
};

RAM.prototype.ReadMemory8 = function(addr) {
    if (addr >= 0) {
        return this.uint8mem[addr ^ 3];
    }
    return this.devices[(addr>>24)&0xFF].ReadReg8(addr & 0xFFFFFF);
    //message.Debug("Error in ReadMemory8: RAM region " + utils.ToHex(addr) + " is not accessible");
    //message.Abort();
    return 0x0;
};


RAM.prototype.WriteMemory8 = function(addr, x) {
    if (addr >= 0) {
        this.uint8mem[addr ^ 3] = x;
        return;
    }
    this.devices[(addr>>24)&0xFF].WriteReg8(addr & 0xFFFFFF, x);
    //message.Debug("Error in WriteMemory8: RAM region " + utils.ToHex(addr) + " is not accessible");
    //message.Abort();
    // Exception(EXCEPT_BUSERR, addr);
};

RAM.prototype.ReadMemory16 = function(addr) {

    if (addr >= 0) {
        return (this.uint8mem[(addr ^ 2)+1] << 8) | this.uint8mem[(addr ^ 2)];
    }
    return this.devices[(addr>>24)&0xFF].ReadReg16(addr & 0xFFFFFF);
    //message.Debug("Error in ReadMemory16: RAM region " + utils.ToHex(addr) + " is not accessible");
    //message.Abort();
    return 0x0;
};

RAM.prototype.WriteMemory16 = function(addr, x) {
    if (addr >= 0) {
        this.uint8mem[(addr ^ 2)+1] = (x >> 8) & 0xFF;
        this.uint8mem[(addr ^ 2)  ] = x & 0xFF;
        return;
    }
    this.devices[(addr>>24)&0xFF].WriteReg16(addr & 0xFFFFFF, x);
    //message.Debug("Error in WriteMemory16: RAM region " + utils.ToHex(addr) + " is not accessible");
    //message.Abort();
};

module.exports = RAM;
