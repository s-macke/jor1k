/* this is a unified, abstract interface (a facade) to the different
 * CPU implementations
 */

"use strict";
var message = require('../messagehandler'); // global variable
var utils = require('../utils');
var imul = require('../imul');

// CPUs
var SafeCPU = require('./safecpu.js');

function createCPU(cpuname, ram, heap, ncores) {
    var cpu = null;

    if (cpuname === "safe") {
        return new SafeCPU(ram);
    }
    throw new Error("invalid CPU name:" + cpuname);
}

function CPU(cpuname, ram, heap, ncores) {
    this.cpu = createCPU(cpuname, ram, heap, ncores);
    this.name = cpuname;
    this.ncores = ncores;
    this.ram = ram;
    this.heap = heap;
    this.littleendian = true;

    return this;
}

CPU.prototype.switchImplementation = function(cpuname) {
};

CPU.prototype.toString = function() {
    var r = new Uint32Array(this.heap);
    var str = '';
    str += "Current state of the machine\n";
    str += "PC: " + utils.ToHex(this.cpu.pc) + "\n";

    for (var i = 0; i < 32; i += 4) {
        str += "   r" + (i + 0) + ": " +
            utils.ToHex(r[i + 0]) + "   r" + (i + 1) + ": " +
            utils.ToHex(r[i + 1]) + "   r" + (i + 2) + ": " +
            utils.ToHex(r[i + 2]) + "   r" + (i + 3) + ": " +
            utils.ToHex(r[i + 3]) + "\n";
    }
    str += "mstatus: " + utils.ToBin(this.cpu.csr[0x300]) + "\n";
    return str;
};

// forward a couple of methods to the CPU implementation
var forwardedMethods = [
    "Reset", 
    "Step",
    "RaiseInterrupt", 
    "Step",
    "AnalyzeImage",
    "GetTicks",
    "GetTimeToNextInterrupt",
    "ProgressTime", 
    "ClearInterrupt"];
forwardedMethods.forEach(function(m) {
    CPU.prototype[m] = function() {
        return this.cpu[m].apply(this.cpu, arguments);        
    };
});

module.exports = CPU;
