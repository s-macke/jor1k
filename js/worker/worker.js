// -------------------------------------------------
// -------------------- Worker ---------------------
// -------------------------------------------------

importScripts('utils.js', 'framebuffer.js', 'ethmac.js', 'ata.js',
    'uart.js', 'touchscreen.js', 'keyboard.js', 'virtio.js', 'ram.js',
    'system.js', 'bzip2.js', 'cpu/cpu.js', 'cpu/fastcpu.js', 'cpu/safecpu.js'
    );

var sys = new System();
DebugMessage("System initialized");

onmessage = function(e) {
    switch(e.data.command)
    {
        case "execute":
            sys.MainLoop();
            break;
        case "ethmac":
            sys.ethdev.Receive(new Uint8Array(e.data.data));
            break;
        case "GetFB":
            if (sys.status == SYSTEM_RUN) {
                SendToMaster("GetFB", sys.fbdev.GetBuffer());
            }
            break;
        case "tty0":
            sys.uartdev0.ReceiveChar(e.data.data);
            break;
        case "tty1":
            sys.uartdev1.ReceiveChar(e.data.data);
            break;
        case "GetIPS":
            SendToMaster("GetIPS", sys.GetIPS());        
            break;
        case "keydown":
            sys.kbddev.OnKeyDown(e.data.data);
            break;
        case "keyup":
            sys.kbddev.OnKeyUp(e.data.data);
            break;
        case "tsmousedown":
            sys.tsdev.onmousedown(e.data.data);
            break;
        case "tsmouseup":
            sys.tsdev.onmouseup(e.data.data);
            break;
        case "tsmousemove":
            sys.tsdev.onmousemove(e.data.data);
            break;
        case "Reset":
            sys.Reset(e.data.data);
            break;
        case "ChangeCore":
            sys.ChangeCore(e.data.data, true);
            break;
        case "LoadAndStart":
            sys.LoadImageAndStart(e.data.data);
            break;
    }

}
