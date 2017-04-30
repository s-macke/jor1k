// -------------------------------------------------
// --------------------- CLINT ---------------------
// -------------------------------------------------
// CLINT (clock interrupt?) device for RISC-V

"use strict";
var message = require('../messagehandler');
var utils = require('../utils');

/*
 * 0000 msip hart 0
 * 0004 msip hart 1
 * ...
 * 4000 mtimecmp hart 0 lo
 * 4004 mtimecmp hart 0 hi
 * 4008 mtimecmp hart 1 lo
 * 400c mtimecmp hart 1 hi
 * ...
 * bff8 mtime lo
 * bffc mtime hi
 */

function CLINTDev() {
    this.Reset();
}

CLINTDev.prototype.Reset = function() {
    // 64-Bit registers
    this.regs = new Uint32Array(0x3000);
}

CLINTDev.prototype.ReadReg32 = function (addr) {
    //message.Debug("CLINT: unknown ReadReg32: " + utils.ToHex(addr));
    //message.Abort();
    return 0x0;
}

CLINTDev.prototype.WriteReg32 = function (addr, value) {
    //message.Debug("CLINT: unknown WriteReg32: " + utils.ToHex(addr) + ": " + utils.ToHex(value));
/*
    if (addr == 0x1000) return; // ignore ipi
    if (addr < 0 || addr > 12) {
        message.Debug("CLINT: unknown  WriteReg32: " + utils.ToHex(addr) + ": " + utils.ToHex(value));
        message.Abort();
    }
*/
    this.regs[addr >> 2] = value;
}

CLINTDev.prototype.Step = function (inc) {
    this.regs[0] += inc;
    /*
        procs[0]->state.mip &= ~MIP_MTIP;
        if (regs[0] >= regs[1])
            procs[i]->state.mip |= MIP_MTIP;
    */
}

module.exports = CLINTDev;
