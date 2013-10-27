// -------------------------------------------------
// -------------------- Worker ---------------------
// -------------------------------------------------

importScripts('utils.js', 'framebuffer.js', 'ethmac.js', 'ata.js',
    'uart.js', 'touchscreen.js', 'keyboard.js', 'ram.js', 'cpu/cpu.js',
    'system.js', 'bzip2.js', 'cpu/fastcpu.js', 'cpu/safecpu.js'
    );

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
    //TODO: make ethmac its own worker
    if (e.data.command == "ethmac") {
        sys.ethdev.Receive(new Uint8Array(e.data.data));
        return;
    } else 
    if (e.data.command == "execute") {
        sys.MainLoop();
        return;
    } else 
    if (e.data.command == "GetFB") {
        SendToMaster("GetFB", sys.fbdev.GetBuffer());
        return;
    } else
    if (e.data.command == "tty") {
        sys.uartdev.ReceiveChar(e.data.data);
        return;
    } else
    if (e.data.command == "GetIPS") {
        SendToMaster("GetIPS", sys.GetIPS());
        
        return;
    } else
    if (e.data.command == "keydown") {
            sys.kbddev.OnKeyDown(e.data.data);
        return;
    } else
    if (e.data.command == "keyup") {
            sys.kbddev.OnKeyUp(e.data.data);
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
    } else
    if (e.data.command == "Reset") {
        sys.Reset(e.data.data);
        return;
    } else
    if (e.data.command == "ChangeCore") {
        sys.ChangeCore(e.data.data, true);
        return;
    } else
    if (e.data.command == "LoadAndStart") {
        sys.LoadImageAndStart(e.data.data);
        return;
    }


}
