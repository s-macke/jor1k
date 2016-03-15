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
var HTIF = require('./riscv/htif');

// CPU
var OR1KCPU = require('./or1k');
var RISCVCPU = require('./riscv');

// Devices
var UARTDev = require('./dev/uart');
var IRQDev = require('./dev/irq');
var TimerDev = require('./dev/timer');
var FBDev = require('./dev/framebuffer');
var EthDev = require('./dev/ethmac');
var ATADev = require('./dev/ata');
var RTCDev = require('./dev/rtc');
var TouchscreenDev = require('./dev/touchscreen');
var KeyboardDev = require('./dev/keyboard');
var SoundDev = require('./dev/sound');
var VirtIODev = require('./dev/virtio');
var Virtio9p = require('./dev/virtio/9p');
var VirtioDummy = require('./dev/virtio/dummy');
var VirtioInput = require('./dev/virtio/input');
var VirtioNET = require('./dev/virtio/net');
var VirtioBlock = require('./dev/virtio/block');
var VirtioGPU = require('./dev/virtio/gpu');
var VirtioConsole = require('./dev/virtio/console');
var FS = require('./filesystem/filesystem');

/* 
    Heap Layout
    ===========
    The heap is needed by the asm.js CPU. 
    For compatibility all CPUs use the same layout
    by using the different views of typed arrays

    ------ Core 1 ------
    0x0     -  0x7F     32 CPU registers 
    0x80    -  0x1FFF   CPU specific, usually unused or temporary data
    0x2000  -  0x3FFF   group 0 (system control and status)
    0x4000  -  0x5FFF   group 1 (data MMU)
    0x6000  -  0x7FFF   group 2 (instruction MMU)
    ------ Core 2 ------
    0x8000  -  0x807F   32 CPU registers
    0x8080  -  0x9FFF   CPU specific, usually unused or temporary data
    0xA000  -  0xBFFF   group 0 (system control and status)
    0xC000  -  0xDFFF   group 1 (data MMU)
    0xE000  -  0xFFFF   group 2 (instruction MMU)
    ------ Core 3 ------
    ...
    ------- RAM --------
    0x100000 -  ...     RAM
*/


var SYSTEM_RUN = 0x1;
var SYSTEM_STOP = 0x2;
var SYSTEM_HALT = 0x3; // Idle

function System() {
    // the Init function is called by the master thread.
    message.Register("LoadAndStart", this.LoadImageAndStart.bind(this) );
    message.Register("execute", this.MainLoop.bind(this));
    message.Register("Init", this.Init.bind(this) );
    message.Register("Reset", this.Reset.bind(this) );
    message.Register("ChangeCore", this.ChangeCPU.bind(this) );
    message.Register("PrintOnAbort", this.PrintState.bind(this) );

    message.Register("GetIPS", function(data) {
        message.Send("GetIPS", this.ips);
        this.ips=0;
    }.bind(this));
}

System.prototype.CreateCPU = function(cpuname, arch) {
    try {
        if (arch == "or1k") {
            this.cpu = new OR1KCPU(cpuname, this.ram, this.heap, this.ncores);
        } else
        if (arch == "riscv") {
            this.cpu = new RISCVCPU(cpuname, this.ram, this.htif, this.heap, this.ncores);
        } else
            throw "Architecture " + arch + " not supported";
    } catch (e) {
        message.Debug("Error: failed to create CPU:" + e);
    }
};


System.prototype.ChangeCPU = function(cpuname) {
    this.cpu.switchImplementation(cpuname);
};

System.prototype.Reset = function() {
    this.status = SYSTEM_STOP;
    
    for(var i=0; i<this.devices.length; i++) {
        this.devices[i].Reset();
    }

    this.ips = 0;
};

System.prototype.Init = function(system) {
    this.status = SYSTEM_STOP;
    this.memorysize = system.memorysize;

    this.ncores = system.ncores;
    if (!system.ncores) system.ncores = 1;

    // this must be a power of two.
    var ramoffset = 0x100000;
    this.heap = new ArrayBuffer(this.memorysize*0x100000); 
    this.memorysize--; // - the lower 1 MB are used for the cpu cores
    this.ram = new RAM(this.heap, ramoffset);

    if (system.arch == "riscv") {
        this.htif = new HTIF(this.ram, this);
    }

    this.CreateCPU(system.cpu, system.arch);

    this.devices = [];
    this.devices.push(this.cpu);

    if (system.arch == "or1k") {

        this.irqdev = new IRQDev(this);
        this.timerdev = new TimerDev();
        this.uartdev0 = new UARTDev(0, this, 0x2);
        this.uartdev1 = new UARTDev(1, this, 0x3);
        this.ethdev = new EthDev(this.ram, this);
        this.ethdev.TransmitCallback = function(data){
            message.Send("ethmac", data);
        };

        this.fbdev = new FBDev(this.ram);
        this.atadev = new ATADev(this);
        this.tsdev = new TouchscreenDev(this);
        this.kbddev = new KeyboardDev(this);
        this.snddev = new SoundDev(this, this.ram);
        this.rtcdev = new RTCDev(this);

        this.filesystem = new FS();
        this.virtio9pdev = new Virtio9p(this.ram, this.filesystem);
        this.virtiodev1 = new VirtIODev(this, 0x6, this.ram, this.virtio9pdev);
        this.virtioinputdev = new VirtioInput(this.ram);
        this.virtionetdev = new VirtioNET(this.ram);
        this.virtioblockdev = new VirtioBlock(this.ram);
        this.virtiodummydev = new VirtioDummy(this.ram);
        this.virtiogpudev = new VirtioGPU(this.ram);
        this.virtioconsoledev = new VirtioConsole(this.ram);
        this.virtiodev2 = new VirtIODev(this, 0xB, this.ram, this.virtiodummydev);
        this.virtiodev3 = new VirtIODev(this, 0xC, this.ram, this.virtiodummydev);

        this.devices.push(this.irqdev);
        this.devices.push(this.timerdev);
        this.devices.push(this.uartdev0);
        this.devices.push(this.uartdev1);
        this.devices.push(this.ethdev);
        this.devices.push(this.fbdev);
        this.devices.push(this.atadev);
        this.devices.push(this.tsdev);
        this.devices.push(this.kbddev);
        this.devices.push(this.snddev);
        this.devices.push(this.rtcdev);
        this.devices.push(this.virtio9pdev);
        this.devices.push(this.virtiodev1);
        this.devices.push(this.virtiodev2);
        this.devices.push(this.virtiodev3);

        this.devices.push(this.virtioinputdev);
        this.devices.push(this.virtionetdev);
        this.devices.push(this.virtioblockdev);
        this.devices.push(this.virtiodummydev);
        this.devices.push(this.virtiogpudev);
        this.devices.push(this.virtioconsoledev);

        this.ram.AddDevice(this.uartdev0,   0x90000000, 0x7);
        this.ram.AddDevice(this.fbdev,      0x91000000, 0x1000);
        this.ram.AddDevice(this.ethdev,     0x92000000, 0x1000);
        this.ram.AddDevice(this.tsdev,      0x93000000, 0x1000);
        this.ram.AddDevice(this.kbddev,     0x94000000, 0x100);
        this.ram.AddDevice(this.uartdev1,   0x96000000, 0x7);
        this.ram.AddDevice(this.virtiodev1, 0x97000000, 0x1000);
        this.ram.AddDevice(this.snddev,     0x98000000, 0x400);
        this.ram.AddDevice(this.rtcdev,     0x99000000, 0x1000);
        this.ram.AddDevice(this.irqdev,     0x9A000000, 0x1000);
        this.ram.AddDevice(this.timerdev,   0x9B000000, 0x1000);
        this.ram.AddDevice(this.virtiodev2, 0x9C000000, 0x1000);
        this.ram.AddDevice(this.virtiodev3, 0x9D000000, 0x1000);
        this.ram.AddDevice(this.atadev,     0x9E000000, 0x1000);
    } else 
    if (system.arch == "riscv") {
        // at the moment the htif interface is part of the CPU initialization.
        // However, it uses uartdev0
        this.uartdev0 = new UARTDev(0, this, 0x2);
        this.devices.push(this.uartdev0);
        this.ram.AddDevice(this.uartdev0,   0x90000000, 0x7);
    }

    this.ips = 0; // external instruction per second counter
    this.idletime = 0; // start time of the idle routine
    this.idlemaxwait = 0; // maximum waiting time in cycles

    // constants
    this.ticksperms = 20000; // 20 MHz
    this.loopspersecond = 100; // main loops per second, to keep the system responsive

    this.timer = new Timer(this.ticksperms, this.loopspersecond);
};

System.prototype.RaiseInterrupt = function(line) {
    //message.Debug("Raise " + line);
    this.cpu.RaiseInterrupt(line, -1); // raise all cores
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
    this.cpu.ClearInterrupt(line, -1); // clear all cores
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
    message.Debug(this.cpu.toString());
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
    var length = 0;

    if (elf.IsELF(buffer8)) {
        elf.Extract(buffer8, this.ram.uint8mem);
    } else 
    if (bzip2.IsBZIP2(buffer8)) {
        bzip2.simple(buffer8, function(x){this.ram.uint8mem[length++] = x;}.bind(this));
        if (elf.IsELF(this.ram.uint8mem)) {
            var temp = new Uint8Array(length);
            for(var i=0; i<length; i++) {
                temp[i] = this.ram.uint8mem[i];
            }
            elf.Extract(temp, this.ram.uint8mem);
        }
    } else {
        length = buffer8.length;
        for(var i=0; i<length; i++) this.ram.uint8mem[i] = buffer8[i];
    }
    this.PatchKernel(length);
    if (this.cpu.littleendian == false) {
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
    //message.Debug(stepsleft);
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
