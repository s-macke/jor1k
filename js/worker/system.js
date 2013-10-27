// -------------------------------------------------
// ------------------- SYSTEM ----------------------
// -------------------------------------------------

function System() {
    sys = this; // one global variable used by the abort() function
    this.running = false;
    this.Init();
}

System.prototype.ChangeCore = function(coretype, change) {

if (change) {
    var oldcpu = this.cpu;
}

    if (coretype == "std") {
        this.cpu = new CPU(this.ram);
    } else 
    if (coretype == "safe") {
        this.cpu = new SafeCPU(this.ram);
    } else 
    if (coretype == "asm") {
        this.cpu = this.fastcpu;
        this.cpu.Init();
    } else {
        DebugMessage("Error: Core type unknown");
    }

    if (change) {
        DebugMessage("Change Core");
        this.cpu.InvalidateTLB(); // reset TLB
        var f = oldcpu.GetFlags();
        this.cpu.SetFlags(f|0);

        if (this.currentcore == "asm") {
            var h = new Int32Array(this.heap);
            for(var i=0; i<32; i++) {
                this.cpu.r[i] = h[0x0+i];
            }
            for(var i=0; i<1024; i++) {
                this.cpu.group0[i] = h[0x800+i];
                this.cpu.group1[i] = h[0x1800+i];
                this.cpu.group2[i] = h[0x2800+i];
            }
            oldcpu.GetState();
            this.cpu.pc = h[(0x40 + 0)];
            this.cpu.nextpc = h[(0x40 + 1)];
            this.cpu.delayedins = h[(0x40 + 2)]?true:false;
            this.cpu.interrupt_pending = h[(0x40 + 3)]?true:false;
            this.cpu.TTMR = h[(0x40 + 4)];
            this.cpu.TTCR = h[(0x40 + 5)];
            this.cpu.PICMR = h[(0x40 + 6)];
            this.cpu.PICSR = h[(0x40 + 7)];
            this.cpu.boot_dtlb_misshandler_address = h[(0x40 + 8)];
            this.cpu.boot_itlb_misshandler_address = h[(0x40 + 9)];
            this.cpu.current_pgd = h[(0x40 + 10)];
        } else 
        if (coretype == "asm") {
            var h = new Int32Array(this.heap);
            for(var i=0; i<32; i++) {
                h[0x0+i] = oldcpu.r[i];
            }
            for(var i=0; i<1024; i++) {
                h[0x800+i] = oldcpu.group0[i];
                h[0x1800+i] = oldcpu.group1[i];
                h[0x2800+i] = oldcpu.group2[i];
            }
            h[(0x40 + 0)] = oldcpu.pc;
            h[(0x40 + 1)] = oldcpu.nextpc;
            h[(0x40 + 2)] = oldcpu.delayedins;
            h[(0x40 + 3)] = oldcpu.interrupt_pending;
            h[(0x40 + 4)] = oldcpu.TTMR;
            h[(0x40 + 5)] = oldcpu.TTCR;
            h[(0x40 + 6)] = oldcpu.PICMR;
            h[(0x40 + 7)] = oldcpu.PICSR;
            h[(0x40 + 8)] = oldcpu.boot_dtlb_misshandler_address;
            h[(0x40 + 9)] = oldcpu.boot_itlb_misshandler_address;
            h[(0x40 + 10)] = oldcpu.current_pgd;
            this.cpu.PutState();
        } else {
            for(var i=0; i<32; i++) {
                this.cpu.r[i] = oldcpu.r[i];
            }
            for(var i=0; i<1024; i++) {
                this.cpu.group0[i] = oldcpu.group0[i];
                this.cpu.group1[i] = oldcpu.group1[i];
                this.cpu.group2[i] = oldcpu.group2[i];
            }

            this.cpu.pc = oldcpu.pc;
            this.cpu.nextpc = oldcpu.nextpc;
            this.cpu.delayedins = oldcpu.delayedins;
            this.cpu.interrupt_pending = oldcpu.interrupt_pending;
            this.cpu.TTMR = oldcpu.TTMR;
            this.cpu.TTCR = oldcpu.TTCR;
            this.cpu.PICMR = oldcpu.PICMR;
            this.cpu.PICSR = oldcpu.PICSR;
            this.cpu.boot_dtlb_misshandler_address = oldcpu.boot_dtlb_misshandler_address;
            this.cpu.boot_itlb_misshandler_address = oldcpu.itlb_misshandler_address;
            this.cpu.current_pgd = oldcpu.current_pgd;
        }
    }
    this.currentcore = coretype;
}

System.prototype.Reset = function() {
    this.running = false;
    this.uartdev.Reset();
    this.ethdev.Reset();
    this.fbdev.Reset();
    this.atadev.Reset();
    this.tsdev.Reset();
    this.kbddev.Reset();
    this.cpu.Reset();
    this.ips = 0;
}

System.prototype.Init = function() {
    this.running = false;    
   
    // this must be a power of two.
    DebugMessage("Init Heap");
    var ramoffset = 0x10000;
    this.heap = new ArrayBuffer(0x2000000); 
    DebugMessage("Init RAM");
    this.ram = new RAM(this.heap, ramoffset);


if (typeof Math.imul == "undefined") {
    Math.imul = function(a, b) {
        var ah  = (a >>> 16) & 0xffff;
        var al = a & 0xffff;
        var bh  = (b >>> 16) & 0xffff;
        var bl = b & 0xffff;
        // the shift by 0 fixes the sign on the high part
        // the final |0 converts the unsigned value into a signed value
        return ((al * bl) + (((ah * bl + al * bh) << 16) >>> 0)|0);
    }
}


    // Create the asm.js core. Because of Firefox limitations it can only be created once.
    var stdlib = {
        Int32Array : Int32Array,
        Float32Array : Float32Array,
        Uint8Array : Uint8Array,
        Math : Math
    };
    var foreign = 
    {
        DebugMessage: DebugMessage,
        abort : abort,
        imul : Math.imul,
        ReadMemory32 : this.ram.ReadMemory32.bind(this.ram),
        WriteMemory32 : this.ram.WriteMemory32.bind(this.ram),
        ReadMemory16 : this.ram.ReadMemory16.bind(this.ram),
        WriteMemory16 : this.ram.WriteMemory16.bind(this.ram),
        ReadMemory8 : this.ram.ReadMemory8.bind(this.ram),
        WriteMemory8 : this.ram.WriteMemory8.bind(this.ram)
    };
    this.fastcpu = FastCPU(stdlib, foreign, this.heap);
    this.fastcpu.Init();

    DebugMessage("Init CPU");
    this.ChangeCore("asm", false);

    DebugMessage("Init Terminal");
    this.term = new Terminal();

    DebugMessage("Init Devices");
    this.uartdev = new UARTDev(this.term, this);

    this.ethdev = new EthDev(this.ram, this);
    this.ethdev.TransmitCallback = function(data){
        SendToMaster("ethmac", data);
    }

    this.fbdev = new FBDev(this.ram);
    this.atadev = new ATADev(this);
    this.tsdev = new TouchscreenDev(this);
    this.kbddev = new KeyboardDev(this);

    DebugMessage("Add Devices");  
    this.ram.AddDevice(this.atadev, 0x9e000000, 0x1000);
    this.ram.AddDevice(this.uartdev, 0x90000000, 0x7);
    this.ram.AddDevice(this.ethdev, 0x92000000, 0x1000);
    this.ram.AddDevice(this.fbdev, 0x91000000, 0x1000);
    this.ram.AddDevice(this.tsdev, 0x93000000, 0x1000);
    this.ram.AddDevice(this.kbddev, 0x94000000, 0x100);

    this.stepsperloop = 0x40000;
    this.ips = 0; // external inctruction per second counter
    this.internalips = 0; // internal inctruction counter
    this.clockspeed = 0; // clock cycle per instruction
}

// Timer function. Run every second
System.prototype.GetIPS = function() {
        this.internalips++; // at least one instruction
        this.stepsperloop = Math.floor(this.internalips * (1000/1000) / 200);
        this.stepsperloop  = this.stepsperloop<1000?1000:this.stepsperloop;
        this.stepsperloop  = this.stepsperloop>400000?400000:this.stepsperloop;
        // The clock runs with 20MHz.            
        this.clockspeed = Math.floor(20000000 * 64  / (this.internalips * (1000 / 1000)) );
        this.clockspeed  = this.clockspeed<=1?1:this.clockspeed;
        this.clockspeed  = this.clockspeed>=10000?10000:this.clockspeed;
        this.internalips = 0;
        var ret = this.ips;
        this.ips = 0;
        return ret;
}

System.prototype.RaiseInterrupt = function(line) {
    this.cpu.RaiseInterrupt(line);
}
System.prototype.ClearInterrupt = function (line) {
    this.cpu.ClearInterrupt(line);
}


System.prototype.PrintState = function() {
    DebugMessage("Current state of the machine")
    //DebugMessage("clock: " + hex8(cpu.clock));
    DebugMessage("PC: " + hex8(this.cpu.pc<<2));
    DebugMessage("next PC: " + hex8(this.cpu.nextpc<<2));
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

System.prototype.SendStringToTerminal = function(str)
{
    for (var i = 0; i < str.length; i++) {
        this.term.PutChar(str.charCodeAt(i));
    }
}

System.prototype.LoadImageAndStart = function(urls) {
    DebugMessage("Loading urls " + urls);
    this.SendStringToTerminal("Loading kernel and hard drive image from web server. Please wait ...\r\n");
    DownloadAllAsync(urls, this.ImageFinished.bind(this), function(error){DebugMessage(error);} );
}

System.prototype.ImageFinished = function(result) {
    result.forEach(function(buffer, i) {
        var buffer8 = new Uint8Array(buffer);
        if (i == 0) { // kernel image
            this.SendStringToTerminal("Decompressing kernel...\r\n");
            var length = bzip2.simple(bzip2.array(buffer8), this.ram.uint8mem);
            for (var i = 0; i < length >> 2; i++) this.ram.int32mem[i] = Swap32(this.ram.int32mem[i]); // big endian to little endian
            DebugMessage("File loaded: " + length + " bytes");
        } else { // hard drive
            this.SendStringToTerminal("Decompressing hard drive image...\r\n");
            var drive = new ArrayBuffer(30*1024*1024); // bzip does not know the final size
            var driveimage = new Uint8Array(drive);
            var length = bzip2.simple(bzip2.array(buffer8), driveimage);
            DebugMessage("File loaded: " + length + " bytes");
            this.atadev.SetBuffer(drive);
        }
    }.bind(this));

    this.SendStringToTerminal("Booting Kernel\r\n");
    this.cpu.Reset();
    this.cpu.AnalyzeImage();
    DebugMessage("Starting emulation");
    SendToMaster("execute", 0);
    this.running = true;
    this.MainLoop();
}

System.prototype.MainLoop = function() {
    if (!this.running) return;
    SendToMaster("execute", 0);
    this.cpu.Step(this.stepsperloop, this.clockspeed);
    this.ips += this.stepsperloop;
    this.internalips += this.stepsperloop;
    // go to idle state that onmessage is executed
}
