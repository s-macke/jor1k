// -------------------------------------------------
// ------------------- SYSTEM ----------------------
// -------------------------------------------------

function System(termid, fbid, statsid) {
    this.term = new Terminal(25, 80, termid);
    DebugMessage("Terminal initialized");

    this.ram = new RAM(0x2000000);
    DebugMessage("RAM initialized");

    this.cpu = new CPU(this.ram);
    DebugMessage("CPU initialized");

    this.uartdev = new UARTDev(this.term, this.cpu);
    this.ethdev = new EthDev();
    this.fbdev = new FBDev(fbid, this.ram);
    this.atadev = new ATADev(this.cpu);
    DebugMessage("Devices initialized");

    this.ram.AddDevice(this.atadev, 0x9e000000, 0x1000);
    this.ram.AddDevice(this.uartdev, 0x90000000, 0x7);
    this.ram.AddDevice(this.ethdev, 0x92000000, 0x1000);
    this.ram.AddDevice(this.fbdev, 0x91000000, 0x1000);
    DebugMessage("Devices added");    

    var terminput = new TerminalInput(this.uartdev);
    DebugMessage("Terminal input initialized");
    
    this.stats = document.getElementById(statsid);
    this.ips = 0x0; // number of instructions executed in a second
    window.setTimeout(this.StatsLoop.bind(this), 1000);

    sys = this; // one global variable used by the abort() function
}

System.prototype.PrintState = function() {
    DebugMessage("Current state of the machine")
    //DebugMessage("clock: " + hex8(cpu.clock));
    DebugMessage("PC: " + hex8(this.cpu.pc));
    DebugMessage("next PC: " + hex8(this.cpu.nextpc));
    //DebugMessage("ins: " + hex8(cpu.ins));
    //DebugMessage("main opcode: " + hex8(cpu.ins>>>26));
    //DebugMessage("sf... opcode: " + hex8((cpu.ins>>>21)&0x1F));
    //DebugMessage("op38. opcode: " + hex8((cpu.ins>>>0)&0x3CF));

    for (var i = 0; i < 32; i += 4) {
        DebugMessage("   r" + (i + 0) + ": " +
            hex8(this.cpu.r[i + 0]) + "   r" + (i + 1) + ": " +
            hex8(this.cpu.r[i + 1]) + "   r" + (i + 2) + ": " +
            hex8(this.cpu.r[i + 2]) + "   r" + (i + 3) + ": " +
            hex8(this.cpu.r[i + 3]));
    }
    
    if (this.cpu.delayedins) {
        DebugMessage("delayed instruction");
    }
    if (this.cpu.SR_SM) {
        DebugMessage("Supervisor mode");
    }
    else {
        DebugMessage("User mode");
    }
    if (this.cpu.SR_TEE) {
        DebugMessage("tick timer exception enabled");
    }
    if (this.cpu.SR_IEE) {
        DebugMessage("interrupt exception enabled");
    }
    if (this.cpu.SR_DME) {
        DebugMessage("data mmu enabled");
    }
    if (this.cpu.SR_IME) {
        DebugMessage("instruction mmu enabled");
    }
    if (this.cpu.SR_LEE) {
        DebugMessage("little endian enabled");
    }
    if (this.cpu.SR_CID) {
        DebugMessage("context id enabled");
    }
    if (this.cpu.SR_F) {
        DebugMessage("flag set");
    }
    if (this.cpu.SR_CY) {
        DebugMessage("carry set");
    }
    if (this.cpu.SR_OV) {
        DebugMessage("overflow set");
    }
}

System.prototype.LoadImageAndStart = function(filename) {
    DebugMessage("Loading Image");
    var str = "Loading Image from Web Server (5 MB). Please wait ..."
    for (var i = 0; i < str.length; i++) {
        this.term.PutChar(str.charCodeAt(i));
    }
    LoadBinaryResource(filename, this.ImageFinished.bind(this));
}

System.prototype.ImageFinished = function(buffer) {
    var buffer8 = new Uint8Array(buffer);
    DebugMessage("Image loaded: " + buffer8.length + " bytes");
    for (var i = 0; i < buffer8.length; i++) this.ram.uint8mem[i] = buffer8[i];
    for (var i = 0; i < buffer8.length >>> 2; i++) this.ram.int32mem[i] = Swap32(this.ram.int32mem[i]); // big endian to little endian
    DebugMessage("Starting emulation");
    this.MainLoop();
}

System.prototype.StatsLoop = function()
{
    this.stats.innerHTML = Math.floor(this.ips) + " ips";
    this.ips = 0;
    window.setTimeout(this.StatsLoop.bind(this), 1000);
}

System.prototype.MainLoop = function() {
    this.cpu.Step(0x10000);
    this.ips += 0x10000;
    window.setTimeout(this.MainLoop.bind(this), 0);
}
