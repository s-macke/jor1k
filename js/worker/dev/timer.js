// -------------------------------------------------
// -------------------- Timer ----------------------
// -------------------------------------------------
// Simple Timer running with the CPU frequency (20MHz) used to synchronize the cpu timers
// the syncing is done directly in the cpu, so we can return zero here.

"use strict";

function TimerDev(message) {
    this.message = message;
    this.Reset();
}

TimerDev.prototype.Reset = function() {
    this.sync = 0x0;
}

TimerDev.prototype.ReadReg32 = function (addr) {
    //this.message.Debug("Timer: Read reg " + addr);
    return this.sync;    
}

TimerDev.prototype.WriteReg32 = function (addr, value) {
    this.message.Debug("Error in Timer: Write reg " + addr + " : " + value);
}

module.exports = TimerDev;
