// -------------------------------------------------
// -------------------- Worker ---------------------
// -------------------------------------------------

importScripts('utils.js', 'dev/framebuffer.js', 'dev/ethmac.js', 'dev/ata.js',
    'dev/uart.js', 'dev/touchscreen.js', 'dev/keyboard.js', 'dev/sound.js', 'dev/virtio.js', 'ram.js',
    'system.js', 'bzip2.js', 'cpu/cpu.js', 'cpu/fastcpu.js', 'cpu/safecpu.js',
    'dev/virtio/9p.js', 'filesystem/filesystem.js', 'filesystem/tar.js');

DebugMessage("Starting web worker");

var sys = new System(); // one global variable for the abort function

fbupdatecount = 0;

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
            SendToMaster("GetFB", sys.fbdev.GetBuffer());
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
        case "MergeFile":
            sys.filesystem.MergeFile(e.data.data);
            break;
        case "tar":
            SendToMaster("tar", sys.filesystem.tar.Pack(e.data.data));
            break;
        case "sync":
            SendToMaster("sync", sys.filesystem.tar.Pack(e.data.data));
            break;
        case "Init":
            sys.Init(e.data.data);
            break;
    }
}
