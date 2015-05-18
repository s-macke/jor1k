// -------------------------------------------------
// -------------------- RAM ------------------------
// -------------------------------------------------


// The access is assumed to be aligned. A check is neither performed on the alignment nor on the
// memory boundary, which would usually lead to a bus error. These checks have to be performed elsewere.
// Consider that the data in Javascript is saved in 32-Bit little endian format
// for big endian emulations we flip each 32-Bit for faster access

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

RAM.prototype.AddDevice = function(device, devaddr, devsize) {
    if (devaddr & 0xFFFFFF) {
        message.Debug("Error: The device address not in the allowed memory region");
        message.Abort();
    }
    this.devices[(devaddr>>24)&0xFF] = device;
}

RAM.prototype.Little2Big = function(length) {
    for (var i = 0; i < length >> 2; i++) {
        this.int32mem[i] = utils.Swap32(this.int32mem[i]);
    }
}

RAM.prototype.Read32Big = function(addr) {
    addr = addr | 0;
    if (addr >= 0) {
        return this.int32mem[addr >> 2];
    }
    return this.devices[(addr>>24)&0xFF].ReadReg32(addr & 0xFFFFFF);
};

RAM.prototype.Read32Little = function(addr) {
    addr = addr | 0;
    if (addr >= 0) {
        return this.int32mem[addr >> 2];
    }
    return this.devices[(addr>>24)&0xFF].ReadReg32(addr & 0xFFFFFF);
};

RAM.prototype.Write32Big = function(addr, x) {
    addr = addr | 0;
    if (addr >= 0) {
        this.int32mem[addr >> 2] = x|0;
        return;
    }
    this.devices[(addr>>24)&0xFF].WriteReg32(addr & 0xFFFFFF, x|0);
};

RAM.prototype.Write32Little = function(addr, x) {
    addr = addr | 0;
    if (addr >= 0) {
        this.int32mem[addr >> 2] = x|0;
        return;
    }
    this.devices[(addr>>24)&0xFF].WriteReg32(addr & 0xFFFFFF, x|0);
};

RAM.prototype.Read8Big = function(addr) {
    addr = addr | 0;
    if (addr >= 0) {
        return this.uint8mem[addr ^ 3];
    }
    return this.devices[(addr>>24)&0xFF].ReadReg8(addr & 0xFFFFFF);
};

RAM.prototype.Read8Little = function(addr) {
    addr = addr | 0;
    if (addr >= 0) {
        return this.uint8mem[addr];
    }
    return this.devices[(addr>>24)&0xFF].ReadReg8(addr & 0xFFFFFF);
};

RAM.prototype.Write8Big = function(addr, x) {
    addr = addr | 0;
    if (addr >= 0) {
        this.uint8mem[addr ^ 3] = x|0;
        return;
    }
    this.devices[(addr>>24)&0xFF].WriteReg8(addr & 0xFFFFFF, x|0);
};

RAM.prototype.Write8Little = function(addr, x) {
    addr = addr | 0;
    if (addr >= 0) {
        this.uint8mem[addr] = x|0;
        return;
    }
    this.devices[(addr>>24)&0xFF].WriteReg8(addr & 0xFFFFFF, x|0);
};

RAM.prototype.Read16Big = function(addr) {
    addr = addr | 0;
    if (addr >= 0) {
        return (this.uint8mem[(addr ^ 2)+1] << 8) | this.uint8mem[(addr ^ 2)];
    }
    return this.devices[(addr>>24)&0xFF].ReadReg16(addr & 0xFFFFFF);
};

RAM.prototype.Read16Little = function(addr) {
    addr = addr | 0;
    if (addr >= 0) {
        return (this.uint8mem[addr+1] << 8) | this.uint8mem[addr];
    }
    return this.devices[(addr>>24)&0xFF].ReadReg16(addr & 0xFFFFFF);
};

RAM.prototype.Write16Big = function(addr, x) {
    addr = addr | 0;
    if (addr >= 0) {
        this.uint8mem[(addr ^ 2)+1] = (x >> 8) & 0xFF;
        this.uint8mem[(addr ^ 2)  ] = x & 0xFF;
        return;
    }
    this.devices[(addr>>24)&0xFF].WriteReg16(addr & 0xFFFFFF, x|0);
};

RAM.prototype.Write16Little = function(addr, x) {
    addr = addr | 0;
    if (addr >= 0) {
        this.uint8mem[addr+1] = (x >> 8) & 0xFF;
        this.uint8mem[addr  ] =  x & 0xFF;
        return;
    }
    this.devices[(addr>>24)&0xFF].WriteReg16(addr & 0xFFFFFF, x|0);
};

module.exports = RAM;
