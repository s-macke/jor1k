// -------------------------------------------------
// -------------------- CPU ------------------------
// -------------------------------------------------

"use strict";
var message = require('../messagehandler');
var utils = require('../utils');

// constructor
function SafeCPU(ram) {
    this.ram = ram;

    // registers
    // r[32] and r[33] are used to calculate the virtual address and physical address
    // to make sure that they are not transformed accidently into a floating point number
    this.r = new Int32Array(this.ram.heap, 0, 34 << 2);
    this.Reset();
}

SafeCPU.prototype.Reset = function() {
}

SafeCPU.prototype.InvalidateTLB = function() {
}

SafeCPU.prototype.GetTimeToNextInterrupt = function () {
    return 0;
}

SafeCPU.prototype.GetTicks = function () {
    return 0;
}

SafeCPU.prototype.ProgressTime = function (delta) {
}


SafeCPU.prototype.AnalyzeImage = function() // we haveto define these to copy the cpus
{
}

SafeCPU.prototype.SetFlags = function (x) {
};

SafeCPU.prototype.GetFlags = function () {
}

SafeCPU.prototype.CheckForInterrupt = function () {
};

SafeCPU.prototype.RaiseInterrupt = function (line, cpuid) {
};

SafeCPU.prototype.ClearInterrupt = function (line, cpuid) {
};

SafeCPU.prototype.Step = function (steps, clockspeed) {
};

module.exports = SafeCPU;
