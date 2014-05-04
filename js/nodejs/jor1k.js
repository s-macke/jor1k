var fs = require('fs');

eval(fs.readFileSync("utils.js") + '');
eval(fs.readFileSync("../worker/framebuffer.js") + '');
eval(fs.readFileSync("../worker/ethmac.js") + '');
eval(fs.readFileSync("../worker/ata.js") + '');
eval(fs.readFileSync("../worker/uart.js") + '');
eval(fs.readFileSync("../worker/touchscreen.js") + '');
eval(fs.readFileSync("../worker/keyboard.js") + '');
eval(fs.readFileSync("../worker/ram.js") + '');
eval(fs.readFileSync("../worker/system.js") + '');
eval(fs.readFileSync("../worker/bzip2.js") + '');
eval(fs.readFileSync("../worker/cpu/cpu.js") + '');
eval(fs.readFileSync("../worker/cpu/fastcpu.js") + '');
eval(fs.readFileSync("../worker/cpu/safecpu.js") + '');

function postMessage(x) {
    switch(x.command)
    {
    case "Debug":
        console.log("log: " + x.data);
        break;
    case "execute":
        break;
    case "GetIPS":
        console.log(/*sys.GetIPS() + " " +*/ sys.stepsperloop); 
        break;
    default:
        console.log("Unknown command: " + x.command);
        break;
    }
}


function Terminal() {
    this.PutChar = function(c) {
        process.stdout.write(String.fromCharCode(c));
    };
}

var sys = new System();
sys.LoadImageAndStart(["../../bin/vmlinux.bin.bz2", "../../bin/hdgcc.bz2"]);
sys.internalips = 8000000;
sys.GetIPS();
sys.stepsperloop = 4000000;

process.stdin.setRawMode(true);
process.stdin.resume();
process.stdin.setEncoding('utf8');

process.stdin.on('data', function (chunk) {
    sys.uartdev.ReceiveChar(chunk.charCodeAt(0));
});

function Loop() {
    sys.MainLoop();
    setTimeout(function() {Loop();}, 0);
}

Loop();

