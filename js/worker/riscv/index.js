/* this is a unified, abstract interface (a facade) to the different
 * CPU implementations
 */

"use strict";
var message = require('../messagehandler'); // global variable
var utils = require('../utils');
var imul = require('../imul');

// CPUs
var SafeCPU = require('./safecpu');
var FastCPU = require('./fastcpu');

var stdlib = {
    Int32Array : Int32Array,
    Int8Array : Int8Array,
    Int16Array : Int16Array,
    Float32Array : Float32Array,
    Float64Array : Float64Array,
    Uint8Array : Uint8Array,
    Uint16Array : Uint16Array,
    Math : Math
};

async function createCPU(cpuname, ram, htif, heap, ncores) {
    var cpu = null;
    var foreign = {
        DebugMessage: message.Debug,
        abort : message.Abort,
        imul : Math.imul || imul,
        MathAbs : Math.abs,
        Read32 : ram.Read32Little.bind(ram),
        Write32 : ram.Write32Little.bind(ram),
        Read16 : ram.Read16Little.bind(ram),
        Write16 : ram.Write16Little.bind(ram),
        Read8 : ram.Read8Little.bind(ram),
        Write8 : ram.Write8Little.bind(ram),
        ReadDEVCMDToHost : htif.ReadDEVCMDToHost.bind(htif),
        ReadDEVCMDFromHost : htif.ReadDEVCMDFromHost.bind(htif),
        WriteDEVCMDToHost : htif.WriteDEVCMDToHost.bind(htif),
        WriteDEVCMDFromHost : htif.WriteDEVCMDFromHost.bind(htif),
        ReadToHost : htif.ReadToHost.bind(htif),
        ReadFromHost : htif.ReadFromHost.bind(htif),
        WriteToHost : htif.WriteToHost.bind(htif),
        WriteFromHost : htif.WriteFromHost.bind(htif),
    };

    if (cpuname === "safe") {
        return new SafeCPU(ram, htif);
    }
    if (cpuname === "asm") {
        cpu = FastCPU(stdlib, foreign, heap);
        cpu.Init();
        return cpu;
    }
    if (cpuname === "wasm") {
        cpu = await createCPUWasm(cpuname, ram, htif, heap, ncores);
        cpu.Init();
        return cpu;
    }
    throw new Error("invalid CPU name:" + cpuname);
}

function CPU(cpuname, ram, htif, heap, ncores) {
    this.name = cpuname;
    this.ncores = ncores;
    this.ram = ram;
    this.heap = heap;
    this.htif = htif;
    this.littleendian = true;
    return this;
}

async function createCPUWasm(cpuname, ram, htif, heap, ncores) {
    let importObj = {
        env: {
            memory : ram.memory,
            DebugMessage: message.Debug,
            abort : message.Abort,
            Read32 : ram.Read32Little.bind(ram),
            Write32 : ram.Write32Little.bind(ram),
            Read16 : ram.Read16Little.bind(ram),
            Write16 : ram.Write16Little.bind(ram),
            Read8 : ram.Read8Little.bind(ram),
            Write8 : ram.Write8Little.bind(ram),
            HtifReadDEVCMDToHost : htif.ReadDEVCMDToHost.bind(htif),
            HtifReadDEVCMDFromHost : htif.ReadDEVCMDFromHost.bind(htif),
            HtifWriteDEVCMDToHost : htif.WriteDEVCMDToHost.bind(htif),
            HtifWriteDEVCMDFromHost : htif.WriteDEVCMDFromHost.bind(htif),
            HtifReadToHost : htif.ReadToHost.bind(htif),
            HtifReadFromHost : htif.ReadFromHost.bind(htif),
            HtifWriteToHost : htif.WriteToHost.bind(htif),
            HtifWriteFromHost : htif.WriteFromHost.bind(htif),
        }
    };
    let response = await fetch('riscv.wasm');
    let obj = await WebAssembly.instantiate(await response.arrayBuffer(), importObj);
    let exports = obj.instance.exports;
    return {
      AnalyzeImage : exports.AnalyzeImage,
      ClearInterrupt : exports.ClearInterrupt,
      GetFlags : exports.GetFlags,
      GetStat : exports.GetStat,
      GetTicks : exports.GetTicks,
      GetTimeToNextInterrupt : exports.GetTimeToNextInterrupt,
      GetPC : exports.GetPC,
      Init : exports.Init,
      InvalidateTLB : exports.InvalidateTLB,
      ProgressTime : exports.ProgressTime,
      RaiseInterrupt : exports.RaiseInterrupt,
      Reset : exports.Reset,
      SetFlags : exports.SetFlags,
      Step : exports.Step
    };
}

CPU.prototype.Init = async function() {
    this.cpu = await createCPU(this.name, this.ram, this.htif, this.heap, this.ncores);
};


CPU.prototype.switchImplementation = function(cpuname) {
};

CPU.prototype.toString = function() {
    var r = new Int32Array(this.heap, 0x0);
    var csr = new Uint32Array(this.heap, 0x2000);
    var str = '';
    str += "Current state of the machine\n";

    if (typeof this.cpu.pc != 'undefined') {
        str += "PC: " + utils.ToHex(this.cpu.pc) + "\n";
    } else {
        str += "PC: " + utils.ToHex(this.cpu.GetPC()) + "\n";
    }

    for (var i = 0; i < 32; i += 4) {
        str += "   r" + (i + 0) + ": " +
            utils.ToHex(r[i + 0]) + "   r" + (i + 1) + ": " +
            utils.ToHex(r[i + 1]) + "   r" + (i + 2) + ": " +
            utils.ToHex(r[i + 2]) + "   r" + (i + 3) + ": " +
            utils.ToHex(r[i + 3]) + "\n";
    }
    str += "mstatus: " + utils.ToBin(csr[0x300]) + "\n";
    str +=
        "mcause: " + utils.ToHex(csr[0x342]) +
        " mbadaddress: " + utils.ToHex(csr[0x343]) +
        " mepc: " + utils.ToHex(csr[0x341]) + "\n";
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
