// -------------------------------------------------
// -------------------- Master ---------------------
// -------------------------------------------------

function DebugMessage(message) {
    console.log(message);
}

// small uart device
function UARTDev(worker)
{
    this.ReceiveChar = function(c) {
        worker.SendToWorker("tty", c);
    };
}

function jor1kGUI(termid, fbid, statsid, imageurl)
{
    this.worker = new Worker('js/worker/worker.js');
    
    this.SendToWorker = function(command, data)
    {
        this.worker.postMessage(
        {
            "command": command,
            "data": data
        });
    }

    this.term = new Terminal(25, 80, termid);
    this.terminput = new TerminalInput(new UARTDev(this));
    this.worker.onmessage = this.OnMessage.bind(this);   
    this.worker.onerror = function(e) {
        console.log("Error at " + e.filename + ":" + e.lineno + ": " + e.message);
    }

    // Init Framebuffer
    this.fbcanvas = document.getElementById(fbid);
    this.fbctx = this.fbcanvas.getContext("2d");
    this.fbimageData = this.fbctx.createImageData(this.fbcanvas.width, this.fbcanvas.height);
    
    // Init Statsline 
	this.stats = document.getElementById(statsid);

    this.SendToWorker("LoadAndStart", imageurl);
    window.setInterval(function(){this.SendToWorker("getips", 0)}.bind(this), 1000);
    window.setInterval(function(){this.SendToWorker("getfb", 0)}.bind(this), 100);
}

jor1kGUI.prototype.OnMessage = function(e) {    
    if (e.data.command == "execute") this.SendToWorker("execute", 0); else
    if (e.data.command == "tty") this.term.PutChar(e.data.data); else
    if (e.data.command == "getfb") this.UpdateFramebuffer(e.data.data); else
    if (e.data.command == "getips") {        
        this.stats.innerHTML = Math.floor(e.data.data) + " ips";
    } else
    if (e.data.command == "debug") console.log(e.data.data);
}

jor1kGUI.prototype.UpdateFramebuffer = function(buffer) {
	var i=0, n = buffer.length;
    var data = this.fbimageData.data;
   	for (i = 0; i < n; ++i) {
        data[i] = buffer[i];
    }
    // remove alpha channel.
  	for (i = 3; i < n; i += 4) {
        data[i] = 0xFF;
    }
    this.fbctx.putImageData(this.fbimageData, 0, 0); // at coords 0,0
}




