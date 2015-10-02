// -------------------------------------------------
// -------------------- RAM ------------------------
// -------------------------------------------------


// The access is assumed to be aligned. The check have to be performed elsewere.
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

    // generic functions assume little endian
    this.nativeendian = "little";

    // little endian machine independent
    this.Read32Little = this.Read32LittleTemplate;
    this.Write32Little = this.Write32LittleTemplate;
    this.Read16Little = this.Read16LittleTemplate;
    this.Write16Little = this.Write16LittleTemplate;
    this.Read8Little = this.Read8LittleTemplate;
    this.Write8Little = this.Write8LittleTemplate;

    // machine dependent functions
    this.Read32 = this.Read32LittleTemplate;
    this.Write32 = this.Write32LittleTemplate;
    this.Read16 = this.Read16LittleTemplate;
    this.Write16 = this.Write16LittleTemplate;
    this.Read8 = this.Read8LittleTemplate;
    this.Write8 = this.Write8LittleTemplate;

    // big endian machine independent only used by big endian machines
    this.Read32Big = this.Read32BigTemplate;
    this.Write32Big = this.Write32BigTemplate;
    this.Read16Big = this.Read16BigTemplate;
    this.Write16Big = this.Write16BigTemplate;
    this.Read8Big = this.Read8BigTemplate;
    this.Write8Big = this.Write8BigTemplate;
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
    this.Read32 = this.Read32BigTemplate;
    this.Write32 = this.Write32BigTemplate;
    this.Read16 = this.Read16BigTemplate;
    this.Write16 = this.Write16BigTemplate;
    this.Read8 = this.Read8BigTemplate;
    this.Write8 = this.Write8BigTemplate;

    this.Read32Little = function(addr) { return utils.Swap32(this.Read32BigTemplate(addr)); }.bind(this);
    this.Write32Little = function(addr, x) { this.Write32BigTemplate(addr, utils.Swap32(x)); }.bind(this);
    this.Read16Little = function(addr) { return utils.Swap16(this.Read16BigTemplate(addr)); }.bind(this);
    this.Write16Little = function(addr, x) { this.Write16BigTemplate(addr, utils.Swap16(x)); }.bind(this);
    this.Read8Little = this.Read8BigTemplate.bind(this);
    this.Write8Little = this.Write8BigTemplate.bind(this);

    this.nativeendian = "big";
}

RAM.prototype.Read32BigTemplate = function(addr) {
    addr = addr | 0;
    if (addr >= 0) {
        if (this.int32mem.byteLength <= addr) {
            message.Debug("Error in Read32Big: read above upper boundary");
            message.Abort();
        }
        return this.int32mem[addr >> 2];
    }
    return this.devices[(addr>>24)&0xFF].ReadReg32(addr & 0xFFFFFF);
};

RAM.prototype.Read32LittleTemplate = function(addr) {
    addr = addr | 0;
    if (addr >= 0) {
        if (this.int32mem.byteLength <= addr) {
            message.Debug("Error in Read32Little: read above upper boundary");
            message.Abort();
        }
        return this.int32mem[addr >> 2];
    }
    return this.devices[(addr>>24)&0xFF].ReadReg32(addr & 0xFFFFFF);
};

RAM.prototype.Write32BigTemplate = function(addr, x) {
    addr = addr | 0;
    if (addr >= 0) {
        if (this.int32mem.byteLength <= addr) {
            message.Debug("Error in Write32Big: write above upper boundary");
            message.Abort();
        }
        this.int32mem[addr >> 2] = x|0;
        return;
    }
    this.devices[(addr>>24)&0xFF].WriteReg32(addr & 0xFFFFFF, x|0);
};

RAM.prototype.Write32LittleTemplate = function(addr, x) {
    addr = addr | 0;
    if (addr >= 0) {
        if (this.int32mem.byteLength <= addr) {
            message.Debug("Error in Write32Little: write above upper boundary");
            message.Abort();
        }
        this.int32mem[addr >> 2] = x|0;
        return;
    }
    this.devices[(addr>>24)&0xFF].WriteReg32(addr & 0xFFFFFF, x|0);
};

RAM.prototype.Read8BigTemplate = function(addr) {
    addr = addr | 0;
    if (addr >= 0) {
        if (this.uint8mem.byteLength <= addr) {
            message.Debug("Error in Read8Big: read above upper boundary");
            message.Abort();
        }
        return this.uint8mem[addr ^ 3];
    }
    return this.devices[(addr>>24)&0xFF].ReadReg8(addr & 0xFFFFFF);
};

RAM.prototype.Read8LittleTemplate = function(addr) {
    addr = addr | 0;
    if (addr >= 0) {
        if (this.uint8mem.byteLength <= addr) {
            message.Debug("Error in Read8Little: read above upper boundary");
            message.Abort();
        }
        return this.uint8mem[addr];
    }
    return this.devices[(addr>>24)&0xFF].ReadReg8(addr & 0xFFFFFF);
};

RAM.prototype.Write8BigTemplate = function(addr, x) {
    addr = addr | 0;
    if (addr >= 0) {
        if (this.uint8mem.byteLength <= addr) {
            message.Debug("Error in Write8Big: write above upper boundary");
            message.Abort();
        }
        this.uint8mem[addr ^ 3] = x|0;
        return;
    }
    this.devices[(addr>>24)&0xFF].WriteReg8(addr & 0xFFFFFF, x|0);
};

RAM.prototype.Write8LittleTemplate = function(addr, x) {
    addr = addr | 0;
    if (addr >= 0) {
        if (this.uint8mem.byteLength <= addr) {
            message.Debug("Error in Write8Little: write above upper boundary");
            message.Abort();
        }
        this.uint8mem[addr] = x|0;
        return;
    }
    this.devices[(addr>>24)&0xFF].WriteReg8(addr & 0xFFFFFF, x|0);
};

RAM.prototype.Read16BigTemplate = function(addr) {
    addr = addr | 0;
    if (addr >= 0) {
        if (this.uint8mem.byteLength <= addr) {
            message.Debug("Error in Read16Big: read above upper boundary");
            message.Abort();
        }
        return (this.uint8mem[(addr ^ 2)+1] << 8) | this.uint8mem[(addr ^ 2)];
    }
    return this.devices[(addr>>24)&0xFF].ReadReg16(addr & 0xFFFFFF);
};

RAM.prototype.Read16LittleTemplate = function(addr) {
    addr = addr | 0;
    if (addr >= 0) {
        if (this.uint8mem.byteLength <= addr) {
            message.Debug("Error in Read16Little: read above upper boundary");
            message.Abort();
        }
        return (this.uint8mem[addr+1] << 8) | this.uint8mem[addr];
    }
    return this.devices[(addr>>24)&0xFF].ReadReg16(addr & 0xFFFFFF);
};

RAM.prototype.Write16BigTemplate = function(addr, x) {
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
    this.devices[(addr>>24)&0xFF].WriteReg16(addr & 0xFFFFFF, x|0);
};

RAM.prototype.Write16LittleTemplate = function(addr, x) {
    addr = addr | 0;
    if (addr >= 0) {
        if (this.uint8mem.byteLength <= addr) {
            message.Debug("Error in Write16Little: write above upper boundary");
            message.Abort();
        }
        this.uint8mem[addr+1] = (x >> 8) & 0xFF;
        this.uint8mem[addr  ] =  x & 0xFF;
        return;
    }
    this.devices[(addr>>24)&0xFF].WriteReg16(addr & 0xFFFFFF, x|0);
};



module.exports = RAM;
