// -------------------------------------------------
// ------------------- SYSTEM ----------------------
// -------------------------------------------------

function System() {
    sys = this; // one global variable used by the abort() function
    this.running = false;
    this.Init();
}

System.prototype.Init = function(cputype) {
    this.running = false;
    DebugMessage("Init Terminal");    
    this.term = new Terminal();
    
    DebugMessage("Init Heap");
    var ramoffset = 0x10000;
    // this must be a power of two. TODO: Give or1k only 31MB instead of 32MB
    if (typeof this.heap == "undefined") {
        this.heap = new ArrayBuffer(0x2000000); 
    }
    DebugMessage("Init RAM");
    this.ram = new RAM(this.heap, ramoffset);

    DebugMessage("Init CPU");
    
    if (!cputype) {
        this.cpu = new CPU(this.ram);
    } else
    {
        var stdlib = {
            Int32Array : Int32Array,
            Uint8Array : Uint8Array,
            Math : Math
        };
        var foreign = 
        {
            DebugMessage: DebugMessage,
            abort : abort,
            ReadMemory32 : this.ram.ReadMemory32.bind(this.ram),
            WriteMemory32 : this.ram.WriteMemory32.bind(this.ram),
            ReadMemory16 : this.ram.ReadMemory16.bind(this.ram),
            WriteMemory16 : this.ram.WriteMemory16.bind(this.ram),
            ReadMemory8 : this.ram.ReadMemory8.bind(this.ram),
            WriteMemory8 : this.ram.WriteMemory8.bind(this.ram)
        };
        this.cpu = FastCPU(stdlib, foreign, this.heap);
        this.cpu.Init();
    }
    DebugMessage("Init Devices");
    this.uartdev = new UARTDev(this.term, this.cpu);
    this.ethdev = new EthDev();
    this.fbdev = new FBDev(this.ram);
    this.atadev = new ATADev(this.cpu);
    this.tsdev = new TouchscreenDev(this.cpu);

    DebugMessage("Add Devices");  
    this.ram.AddDevice(this.atadev, 0x9e000000, 0x1000);
    this.ram.AddDevice(this.uartdev, 0x90000000, 0x7);
    this.ram.AddDevice(this.ethdev, 0x92000000, 0x1000);
    this.ram.AddDevice(this.fbdev, 0x91000000, 0x1000);
    this.ram.AddDevice(this.tsdev, 0x93000000, 0x1000);

    this.ips = 0; // inctruction per second counter
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
    this.cpu.AnalyzeImage();
    DebugMessage("Starting emulation");
    SendToMaster("execute", 0);
    this.running = true;
    this.MainLoop();
}

System.prototype.MainLoop = function() {
    if (!this.running) return;
    SendToMaster("execute", 0);
    this.cpu.Step(0x20000);
    this.ips += 0x20000;
    // go to idle state that onmessage is executed    
}
