// -------------------------------------------------
// ---------------------- PLIC ---------------------
// -------------------------------------------------
// PLIC (Platform-Level Interrupt Controller) device for RISC-V

"use strict";
var message = require('../messagehandler');
var utils = require('../utils');

/*
 * 0x0000   Priority Device 0
 * 0x0004   Priority Device 1
 * ....
 * 0x2000   enable bitmask 32-bit * 32 entries for handler 0
 * 0x2080   enable for handler 1
 * 0x200000 hart threshold
 * 0x200004 hart claim
 * 0x201000 hart threshold
 * ...
 */

var IRQ_S_EXT = 9;

function PLICDev(cpuirqhandler) {
    this.cpuirqhandler = cpuirqhandler
    this.Reset();
}

PLICDev.prototype.Reset = function() {
    // 32-Bit registers
    this.regs = new Uint32Array(0x3000);
    this.mask = 0x0;
}

PLICDev.prototype.ReadReg32 = function (addr) {
    //message.Debug("PLIC: unknown ReadReg32: " + utils.ToHex(addr));
    var i = 0;
    if (addr == 0x00200004) {
        for(i=0; i<32; i++)
            if (this.mask & (1<<i)) return i;
    }
    return 0x0;
}

PLICDev.prototype.WriteReg32 = function (addr, value) {
    //message.Debug("PLIC: unknown WriteReg32: " + utils.ToHex(addr) + ": " + utils.ToHex(value));
}

PLICDev.prototype.RaiseInterrupt = function (line) {
    line = line | 0;
    if (line == 0x1) return; // HTIF
    //message.Debug("PLIC: Raise line " + line);
    this.mask |= 1 << line;
    this.cpuirqhandler.RaiseInterrupt(IRQ_S_EXT, -1);
}

PLICDev.prototype.ClearInterrupt = function (line) {
    line = line | 0;
    //message.Debug("PLIC: Clear line " + line);
    this.mask &= ~(1 << line);
    if (this.mask == 0x0) {
        this.cpuirqhandler.ClearInterrupt(IRQ_S_EXT, -1);
    }
}

module.exports = PLICDev;
