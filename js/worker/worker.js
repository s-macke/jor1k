// -------------------------------------------------
// -------------------- Worker ---------------------
// -------------------------------------------------

importScripts('utils.js', 'framebuffer.js', 'eth.js', 'ata.js', 'uart.js', 'touchscreen.js', 'ram.js', 'cpu.js', 'system.js', 'bzip2.js', 'fastcpu.js');

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
        sys.MainLoop();
        return;
    } else
    if (e.data.command == "init") {
        sys.Init(e.data.data);
        return;
    } else
    if (e.data.command == "tty") {
        if (typeof sys.uartdev != "undefined") {
            sys.uartdev.ReceiveChar(e.data.data);
        }
        return;
    } else
    if (e.data.command == "LoadAndStart") {
        sys.LoadImageAndStart(e.data.data);
        return;
    } else
    if (e.data.command == "getips") {
        SendToMaster("getips", sys.ips);
        sys.ips = 0;
        return;
    } else
    if (e.data.command == "getfb") {
        if (typeof sys.fbdev != "undefined") {
            SendToMaster("getfb", sys.fbdev.GetBuffer());
        }
        return;
    } else
    if (e.data.command == "tsmousedown") {
        sys.tsdev.onmousedown(e.data.data);
        return;
    } else
    if (e.data.command == "tsmouseup") {
        sys.tsdev.onmouseup(e.data.data);
        return;
    } else
    if (e.data.command == "tsmousemove") {
        sys.tsdev.onmousemove(e.data.data);
        return;
    }
}
