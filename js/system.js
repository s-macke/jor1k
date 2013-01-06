
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
	cpu.Step(0x10000);
    window.setTimeout(MainLoop, 0);
}

var term = new Terminal(25, 80, "tty");
DebugMessage("Terminal initialized");
new TerminalInput();
DebugMessage("Terminal input initialized");
var ram = new RAM(0x2000000);
DebugMessage("RAM initialized");
var uart = new UART();
DebugMessage("UART initialized");
var cpu = new CPU();
DebugMessage("CPU initialized");

ram.AddDevice(new EthDev(), 0x92000000, 0x1000);
ram.AddDevice(new FBDev("fb"), 0x91000000, 0x1000);



DebugMessage("Loading Image");
var str = "Loading Image from Web Server (5 MB). Please wait ..."
for (var i = 0; i < str.length; i++) {
    term.PutChar(str.charCodeAt(i));
}

LoadBinaryResource("bin/vmlinux.bin", ImageFinished);