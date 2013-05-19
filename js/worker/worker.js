// -------------------------------------------------
// -------------------- Worker ---------------------
// -------------------------------------------------

importScripts('utils.js', 'framebuffer.js', 'eth.js', 'ata.js', 'uart.js', 'ram.js', 'cpu.js', 'system.js', 'bzip2.js');

// The normal Terminal Device cannot be used here because it needs a canvas element
// Therefore a small terminal device is emulated here which sends all characters received to the master.
function Terminal() {
    this.PutChar = function(c) {
        SendToMaster("tty", c);
    };
}

var sys = new System();
DebugMessage("System initialized");

onmessage = function(e) {
    if (e.data.command == "execute") {
        SendToMaster("execute", 0);
        sys.MainLoop();
        return;
    }
    if (e.data.command == "tty") {
        sys.uartdev.ReceiveChar(e.data.data);
        return;
    }
    if (e.data.command == "LoadAndStart") {
        sys.LoadImageAndStart(e.data.data);
        return;
    }
    if (e.data.command == "getips") {
        SendToMaster("getips", sys.ips);
        sys.ips = 0;
        return;
    }
    if (e.data.command == "getfb") {
        SendToMaster("getfb", sys.fbdev.GetBuffer());
        return;
    }
}
