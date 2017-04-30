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

function PLICDev() {
    this.Reset();
}

PLICDev.prototype.Reset = function() {
    // 32-Bit registers
    this.regs = new Uint32Array(0x3000);
}

PLICDev.prototype.ReadReg32 = function (addr) {
    message.Debug("PLIC: unknown ReadReg32: " + utils.ToHex(addr));
    return 0x0;
}

PLICDev.prototype.WriteReg32 = function (addr, value) {
    message.Debug("PLIC: unknown WriteReg32: " + utils.ToHex(addr) + ": " + utils.ToHex(value));
}

module.exports = PLICDev;
