// -------------------------------------------------
// -------------------- CPU ------------------------
// -------------------------------------------------

"use strict";
var message = require('../messagehandler');
var utils = require('../utils');

// constructor
function SafeCPU(ram) {
    message.Debug("Initialize RISCV CPU");

    this.ram = ram;
    // registers
    // r[32] and r[33] are used to calculate the virtual address and physical address
    // to make sure that they are not transformed accidently into a floating point number
    this.r = new Int32Array(this.ram.heap, 0, 34 << 2);
    this.Reset();
}

SafeCPU.prototype.Reset = function() {
    this.ticks = 0;
}

SafeCPU.prototype.InvalidateTLB = function() {
}

SafeCPU.prototype.GetTimeToNextInterrupt = function () {
    return 10;
}

SafeCPU.prototype.GetTicks = function () {
    return this.ticks;
}

SafeCPU.prototype.ProgressTime = function (delta) {
    this.ticks += delta;
}


SafeCPU.prototype.AnalyzeImage = function() // we haveto define these to copy the cpus
{
}

SafeCPU.prototype.CheckForInterrupt = function () {
};

SafeCPU.prototype.RaiseInterrupt = function (line, cpuid) {
};

SafeCPU.prototype.ClearInterrupt = function (line, cpuid) {
};


SafeCPU.prototype.Step = function (steps, clockspeed) {
    // this is the way to write to the terminal
    this.ram.WriteMemory8(0x90000000 >> 0, (this.ticks&63)+32);
    this.ticks++;
    return 0;
};

module.exports = SafeCPU;
