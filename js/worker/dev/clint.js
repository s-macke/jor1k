// -------------------------------------------------
// --------------------- CLINT ---------------------
// -------------------------------------------------
// CLINT (clock interrupt?) device for RISC-V

// Actually this is mainly a dummy device as the timer
// logic is managed directly by the CPU

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

var CSR_TIMECMP   = 0xC41;
var CSR_TIME      = 0xC01;

function CLINTDev(csr) {
    this.csr = csr;
    this.Reset();
}

CLINTDev.prototype.Reset = function() {
    // 64-Bit registers
    this.regs = new Uint32Array(0x3000);
}

CLINTDev.prototype.ReadReg32 = function (addr) {
    // no one ever read it
    message.Debug("CLINT: unknown ReadReg32: " + utils.ToHex(addr));
    message.Abort();
    return 0x0;
}


CLINTDev.prototype.WriteReg32 = function (addr, value) {
    addr = addr | 0;
    //message.Debug("CLINT: unknown WriteReg32: " + utils.ToHex(addr) + ": " + utils.ToHex(value));
    this.regs[addr >> 2] = value;
    if (addr == 0x4000) {
        this.csr[CSR_TIMECMP] = value;
        //message.Debug("delta: " + (this.csr[CSR_TIMECMP] - this.csr[CSR_TIME]));
    }
}

module.exports = CLINTDev;
