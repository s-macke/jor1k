// -------------------------------------------------
// ---------------------- RTC ----------------------
// -------------------------------------------------
// Real Time Clock for RISC-V

"use strict";
var message = require('../messagehandler');
var utils = require('../utils');

function RISCV_RTCDev() {
    this.Reset();
}

RISCV_RTCDev.prototype.Reset = function() {
    // 64-Bit registers
    this.regs = new Uint32Array(4);
}

RISCV_RTCDev.prototype.ReadReg32 = function (addr) {
    message.Debug("RISCV RTC: unknown ReadReg32: " + utils.ToHex(addr));
    message.Abort();
    return 0x0;
}

RISCV_RTCDev.prototype.WriteReg32 = function (addr, value) {
    if (addr == 0x1000) return; // ignore ipi
    if (addr < 0 || addr > 12) {
        message.Debug("RISCV RTC: unknown  WriteReg32: " + utils.ToHex(addr) + ": " + utils.ToHex(value));
        message.Abort();
    }
    this.regs[addr >> 2] = value;
}

RISCV_RTCDev.prototype.Step = function (inc) {
    this.regs[0] += inc;
    /*
        procs[0]->state.mip &= ~MIP_MTIP;
        if (regs[0] >= regs[1])
            procs[i]->state.mip |= MIP_MTIP;
    */
}



module.exports = RISCV_RTCDev;
