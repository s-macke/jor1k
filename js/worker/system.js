// -------------------------------------------------
// ------------------- SYSTEM ----------------------
// -------------------------------------------------

"use strict";
// common
var message = require('./messagehandler'); // global variable
var utils = require('./utils');
var RAM = require('./ram');
var bzip2 = require('./bzip2');
var elf = require('./elf');
var Timer = require('./timer');
var InitOpenRISC = require('./init_openrisc');
var InitRISCV = require('./init_riscv');
var FS = require('./filesystem/filesystem');

// Devices
var Virtio9p = require('./dev/virtio/9p');

var SYSTEM_RUN = 0x1;
var SYSTEM_STOP = 0x2;
var SYSTEM_HALT = 0x3; // Idle

function System() {
    // the Init function is called by the master thread.
    message.Register("LoadAndStart", this.LoadImageAndStart.bind(this) );
    message.Register("execute", this.MainLoop.bind(this));
    message.Register("Init", this.Init.bind(this) );
    message.Register("Reset", this.Reset.bind(this) );
    message.Register("PrintOnAbort", this.PrintState.bind(this) );

    message.Register("GetIPS", function(data) {
        message.Send("GetIPS", this.ips);
        this.ips=0;
    }.bind(this));
}

System.prototype.Reset = function() {
    this.status = SYSTEM_STOP;
    for(var i=0; i<this.devices.length; i++) {
        this.devices[i].Reset();
    }
    this.ips = 0;
};

System.prototype.Init = async function(system) {
    message.Debug("Init with following JSON structure: ");
    message.Debug(system);

    this.status = SYSTEM_STOP;

    this.arch = system.arch;
    this.memorysize = system.memorysize;
    this.ncores = system.ncores;
    if (!system.ncores) system.ncores = 1;

    this.ips = 0; // external instruction per second counter
    this.idletime = 0; // start time of the idle routine
    this.idlemaxwait = 0; // maximum waiting time in cycles

    // constants
    this.ticksperms = 20000; // 20 MHz
    this.loopspersecond = 100; // main loops per second, to keep the system responsive

    this.timer = new Timer(this.ticksperms, this.loopspersecond);

    message.Debug("Allocate " + this.memorysize + " MB");
    // this must be a power of two.
    if (((system.cpu == "dynamic") || (system.cpu == "wasm")) && (typeof WebAssembly !== "undefined")) {
        message.Debug("Use webassembly memory");
        this.memory = new WebAssembly.Memory({initial: this.memorysize*16, maximum: this.memorysize*16});
        this.heap = this.memory.buffer;
    } else {
        message.Debug("Use arraybuffer memory");
        this.heap = new ArrayBuffer(this.memorysize*0x100000);
    }
    var ramoffset = 0x100000;
    this.memorysize--; // - the lower 1 MB are used for the cpu cores
    this.ram = new RAM(this.heap, ramoffset);
    if (this.memory) this.ram.memory = this.memory;
    this.csr = new Int32Array(this.heap, 0x2000, 4096);

    this.devices = [];
    this.filesystem = new FS();
    this.virtio9pdev = new Virtio9p(this.ram, this.filesystem);

    try {
        if (system.arch == "or1k") {
            await InitOpenRISC(this, system);
        } else
        if (system.arch == "riscv") {
            await InitRISCV(this, system);
        } else {
            throw "Architecture " + system.arch + " not supported";
        }
    } catch (e) {
        message.Debug("Error: failed to create SoC: " + e);
        message.Abort();
    }
    message.Debug("Init Done");
    message.Send("InitDone", null);
};

System.prototype.RaiseInterrupt = function(line) {
    //message.Debug("Raise " + line);
    if (this.arch == "riscv") {
        this.plicdev.RaiseInterrupt(line);
    } else {
        this.cpu.RaiseInterrupt(line, -1); // raise all cores
    }
    if (this.status == SYSTEM_HALT)
    {
        this.status = SYSTEM_RUN;
        clearTimeout(this.idletimeouthandle);
        var delta = (utils.GetMilliseconds() - this.idletime) * this.ticksperms;
        if (delta > this.idlemaxwait) delta = this.idlemaxwait;
        this.cpu.ProgressTime(delta);
        this.MainLoop();
    }
};

System.prototype.ClearInterrupt = function (line) {
    if (this.arch == "riscv") {
        this.plicdev.ClearInterrupt(line);
    } else {
        this.cpu.ClearInterrupt(line, -1); // clear all cores
    }
};

System.prototype.RaiseSoftInterrupt = function(line, cpuid) {
    // the cpu cannot be halted when this function is called, so skip this check
    this.cpu.RaiseInterrupt(line, cpuid);
};

System.prototype.ClearSoftInterrupt = function (line, cpuid) {
    this.cpu.ClearInterrupt(line, cpuid);
};

System.prototype.PrintState = function() {
    // Flush the buffer of the terminal
    this.uartdev0 && this.uartdev0.Step();
    this.uartdev1 && this.uartdev1.Step();
    this.cpu && message.Debug(this.cpu.toString());
};

System.prototype.SendStringToTerminal = function(str)
{
    var chars = [];
    for (var i = 0; i < str.length; i++) {
        chars.push(str.charCodeAt(i));
    }
    message.Send("tty0", chars);
};

System.prototype.LoadImageAndStart = function(url) {
    this.SendStringToTerminal("\r================================================================================");

    if (typeof url == 'string') {
        this.SendStringToTerminal("\r\nLoading kernel and hard and basic file system from web server. Please wait ...\r\n");
        utils.LoadBinaryResource(
            url,
            this.OnKernelLoaded.bind(this),
            function(error){throw error;}
        );
    } else {
        this.OnKernelLoaded(url);
    }

};

System.prototype.PatchKernel = function(length)
{
    var m = this.ram.uint8mem;
    // set the correct memory size
    for(var i=0; i<length; i++) { // search for the compiled dts file in the kernel
        if (m[i+0] === 0x6d) // find "memory\0"
        if (m[i+1] === 0x65)
        if (m[i+2] === 0x6d)
        if (m[i+3] === 0x6f)
        if (m[i+4] === 0x72)
        if (m[i+5] === 0x79)
        if (m[i+6] === 0x00)
        if (m[i+24] === 0x01)
        if (m[i+25] === 0xF0)
        if (m[i+26] === 0x00)
        if (m[i+27] === 0x00) {
            m[i+24] = (this.memorysize*0x100000)>>24;
            m[i+25] = (this.memorysize*0x100000)>>16;
            m[i+26] = 0x00;
            m[i+27] = 0x00;
        }
    }
};

System.prototype.OnKernelLoaded = function(buffer) {
    this.SendStringToTerminal("Decompressing kernel...\r\n");
    var buffer8 = new Uint8Array(buffer);
    var length = buffer.byteLength;

    if (elf.IsELF(buffer8)) {
        elf.Extract(buffer8, this.ram);
    } else
    if (bzip2.IsBZIP2(buffer8)) {
        length = 0;
        bzip2.simple(buffer8, function(x){this.ram.uint8mem[length++] = x;}.bind(this));
        if (elf.IsELF(this.ram.uint8mem)) {
            var temp = new Uint8Array(length);
            for(var i=0; i<length; i++) {
                temp[i] = this.ram.uint8mem[i];
            }
            elf.Extract(temp, this.ram);
        }
    } else {
        for(var i=0; i<length; i++) this.ram.uint8mem[i] = buffer8[i];
    }

    // OpenRISC CPU uses Big Endian
    if (this.cpu.littleendian == false) {
        this.PatchKernel(length);
        this.ram.Little2Big(length);
    }
    message.Debug("Kernel loaded: " + length + " bytes");
    this.SendStringToTerminal("Booting\r\n");
    this.SendStringToTerminal("================================================================================");
    // we can start the boot process already, even if the filesystem is not yet ready

    this.cpu.Reset();
    this.cpu.AnalyzeImage();
    message.Debug("Starting emulation");
    this.status = SYSTEM_RUN;

    message.Send("execute", 0);
};

// the kernel has sent a halt signal, so stop everything until the next interrupt is raised
System.prototype.HandleHalt = function() {
    var delta = this.cpu.GetTimeToNextInterrupt();
    if (delta == -1) return;
        this.idlemaxwait = delta;
        var mswait = Math.floor(delta / this.ticksperms / this.timer.correction + 0.5);
        //message.Debug("wait " + mswait);

        if (mswait <= 1) return;
        if (mswait > 1000) message.Debug("Warning: idle for " + mswait + "ms");
        this.idletime = utils.GetMilliseconds();
        this.status = SYSTEM_HALT;
        this.idletimeouthandle = setTimeout(function() {
            if (this.status == SYSTEM_HALT) {
                this.status = SYSTEM_RUN;
                this.cpu.ProgressTime(delta);
                //this.snddev.Progress();
                this.MainLoop();
            }
        }.bind(this), mswait);
};

System.prototype.MainLoop = function() {
    if (this.status != SYSTEM_RUN) return;
    message.Send("execute", 0);
    // execute the cpu loop for "instructionsperloop" instructions.
    var stepsleft = this.cpu.Step(this.timer.instructionsperloop, this.timer.timercyclesperinstruction);
    var totalsteps = this.timer.instructionsperloop - stepsleft;
    totalsteps++; // at least one instruction
    this.ips += totalsteps;

    this.uartdev0 && this.uartdev0.Step();
    this.uartdev1 && this.uartdev1.Step();
    //this.snddev.Progress();

    // stepsleft != 0 indicates CPU idle
    var gotoidle = stepsleft?true:false;

    this.timer.Update(totalsteps, this.cpu.GetTicks(), gotoidle);

    if (gotoidle) {
        this.HandleHalt();
    }

    // go to worker thread idle state that onmessage is executed
};

module.exports = System;
