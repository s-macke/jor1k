var tracebufferindex = 0;
var tracebuffer;
var ntrace = 0;

function TraceFinish(buffer) {
    tracebuffer = new Uint32Array(buffer);
    DebugMessage("Trace loaded: " + (tracebuffer.length << 2) + " bytes");
    LoadBinaryResource("vmlinux", ImageFinished);
}

function TraceFinish2(buffer) {
    tracebuffer = new Uint32Array(buffer);
    //DebugMessage("Trace loaded: " + (tracebuffer.length<<2) + " bytes");
    MainLoop();
}

function CopyBinary(to, from, size, buffersrc, bufferdest) {
    for (var i = 0; i < size; i++) bufferdest[to + i] = buffersrc[from + i];
}

function ImageFinished(buffer) {
    var buffer8 = new Uint8Array(buffer);
    DebugMessage("Image loaded: " + buffer8.length + " bytes");
    for (var i = 0; i < buffer8.length; i++) ram.uint8mem[i] = buffer8[i];
    for (var i = 0; i < buffer8.length >>> 2; i++) ram.uint32mem[i] = Swap32(ram.uint32mem[i]); // big endian to little endian

    DebugMessage("Starting emulation");
    MainLoop();
}

function MainLoop() {
    //for(var i=0; i<0x4000; i++) {
        /*
        if (cpu.clock >= 1100001-1) {
            DebugMessage(tracebufferindex);
        }
        */
        cpu.Step(0x10000);
        //fb.Update();
        //continue;
        /*
    	if (tracebuffer[tracebufferindex] == undefined) {
            DebugMessage("tracebuffer undefined "+tracebufferindex);
            abort();
        }
		if (tracebuffer[tracebufferindex] != cpu.pc) {
			DebugMessage("Error: pc does not match " +
                hex8(tracebuffer[tracebufferindex]) + " " +
                hex8(cpu.pc));
			abort();
		}

		tracebufferindex++;
		tracebufferindex++;
		tracebufferindex++;
		for(var j=0; j<32; j++) {
			if (tracebuffer[tracebufferindex] == undefined) {
                DebugMessage("tracebuffer undefined "+tracebufferindex);
                abort();
            }
			if (tracebuffer[tracebufferindex] != cpu.r[j]) {
				DebugMessage("Error: r"+j+" does not match " +
                    hex8(tracebuffer[tracebufferindex]) + " " +
                    hex8(cpu.r[j]));
				abort();
			}
			
			tracebufferindex++;
		}	
		if (tracebuffer[tracebufferindex] == undefined) {
            DebugMessage("tracebuffer undefined "+tracebufferindex);
            abort();
        }
		if (tracebuffer[tracebufferindex] != cpu.GetFlags()) {
			DebugMessage("Error: flags does not match " +
                hex8(tracebuffer[tracebufferindex]) + " " +
                hex8(cpu.GetFlags()));
			abort();
		}
		tracebufferindex += 4;
		*/
    //}
    window.setTimeout(MainLoop, 0);
    /*
	ntrace++;
	tracebufferindex=0;
    //DebugMessage("Loading " + "trace"+ntrace+".dat");
	LoadBinaryResource("trace"+ntrace+".dat", TraceFinish2);
    */
}

var term = new Terminal(25, 80, "tty");
DebugMessage("Terminal initialized");
new TerminalInput();
DebugMessage("Terminal input initialized");
var fb = new Framebuffer("fb");
DebugMessage("Framebuffer initialized");
var ram = new RAM(0x2000000);
DebugMessage("RAM initialized");
var uart = new UART();
DebugMessage("UART initialized");
var cpu = new CPU();
DebugMessage("CPU initialized");

DebugMessage("Loading Image");
var str = "Loading Image from Web Server (5 MB). Please wait ..."
for (var i = 0; i < str.length; i++) {
    term.PutChar(str.charCodeAt(i));
}

//LoadBinaryResource("trace"+ntrace+".dat", TraceFinish);
LoadBinaryResource("bin/vmlinux.bin", ImageFinished);