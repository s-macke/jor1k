// -------------------------------------------------
// -------------------- Master ---------------------
// -------------------------------------------------

function DebugMessage(message) {
    console.log(message);
}

// small uart device
function UARTDev(worker) {
    this.ReceiveChar = function(c) {
        if (!worker.fbfocus) { // check if framebuffer has focus
            worker.SendToWorker("tty0", c);
        }
    };
}

function jor1kGUI(termid, fbid, statsid, imageurls, relayURL)
{
    this.urls = imageurls;
    this.fbfocus = false; // true: keyboard command are not send to tty
    
    this.worker = new Worker('js/worker/worker.js');
    this.worker.onmessage = this.OnMessage.bind(this);   
    this.worker.onerror = function(e) {
        console.log("Error at " + e.filename + ":" + e.lineno + ": " + e.message);
    }
    
    this.SendToWorker = function(command, data) {
        this.worker.postMessage(
        {
            "command": command,
            "data": data
        });
    }

    this.ChangeCore = function(core) {
        this.SendToWorker("ChangeCore", core);
    };

    this.ChangeImage = function(newurl) {
        this.urls[1] = newurl;
        this.SendToWorker("Reset");
        this.SendToWorker("LoadAndStart", this.urls);
    };

    this.terminalcanvas = document.getElementById(termid);
    this.stats = document.getElementById(statsid);

    this.term = new Terminal(24, 80, termid);
    this.terminput = new TerminalInput(new UARTDev(this));

    // Init Framebuffer
    this.fbcanvas = document.getElementById(fbid);
    this.fbctx = this.fbcanvas.getContext("2d");
    this.fbimageData = this.fbctx.createImageData(this.fbcanvas.width, this.fbcanvas.height);

    document.onkeypress = function(event) {
        this.SendToWorker("keypress", {keyCode:event.keyCode, charCode:event.charCode});
        return this.terminput.OnKeyPress(event);      
    }.bind(this);

    document.onkeydown = function(event) {
        this.SendToWorker("keydown", {keyCode:event.keyCode, charCode:event.charCode});
        return this.terminput.OnKeyDown(event);
    }.bind(this);

    document.onkeyup = function(event) {
        this.SendToWorker("keyup", {keyCode:event.keyCode, charCode:event.charCode});
        return this.terminput.OnKeyUp(event);
    }.bind(this);

    this.terminalcanvas.onmousedown = function(event) {
        this.fbfocus = false;
        this.fbcanvas.style.border = "2px solid #000000";
    }.bind(this);

    this.fbcanvas.onmousedown = function(event) {
        this.fbcanvas.style.border = "2px solid #FF0000";
        this.fbfocus = true;
        var rect = this.fbcanvas.getBoundingClientRect();
        var x = event.clientX - rect.left;
        var y = event.clientY - rect.top;
        this.SendToWorker("tsmousedown", {x:x, y:y});
    }.bind(this);

    this.fbcanvas.onmouseup = function(event) {
        var rect = this.fbcanvas.getBoundingClientRect();
        var x = event.clientX - rect.left;
        var y = event.clientY - rect.top;
        this.SendToWorker("tsmouseup", {x:x, y:y});
    }.bind(this);

    this.fbcanvas.onmousemove = function(event) {
        var rect = this.fbcanvas.getBoundingClientRect();
        var x = event.clientX - rect.left;
        var y = event.clientY - rect.top;
        this.SendToWorker("tsmousemove", {x:x, y:y});
    }.bind(this);

    this.ethernet = new Ethernet(relayURL);
    this.ethernet.onmessage = function(e) {
        this.SendToWorker("ethmac", e.data);
    }.bind(this);

    this.stop = false;
    this.SendToWorker("LoadAndStart", this.urls);
    window.setInterval(function(){this.SendToWorker("GetIPS", 0)}.bind(this), 1000);
    window.setInterval(function(){this.SendToWorker("GetFB", 0)}.bind(this), 100);
}

jor1kGUI.prototype.OnMessage = function(e) {
    if (this.stop) return;
    switch(e.data.command)
    {
        case "execute":
            this.SendToWorker("execute", 0);
            break;
        case "ethmac":
            this.ethernet.SendFrame(e.data.data);
            break;
        case "tty0":
            this.term.PutChar(e.data.data);
            break;
        case "GetFB":
            this.UpdateFramebuffer(e.data.data);
            break;
        case "Stop":
            console.log("Received stop signal"); 
            this.stop = true;
            break;
        case "GetIPS":
            this.stats.innerHTML = (Math.floor(e.data.data/100000)/10.) + " MIPS";
            break;
        case "Debug":
            console.log(e.data.data);
            break;
    }
}

jor1kGUI.prototype.UpdateFramebuffer = function(buffer) {
    var i=0, n = buffer.length;
    var data = this.fbimageData.data;
    
    for (i = 0; i < n; ++i) {
        var x = buffer[i];
        data[(i<<2)+0] = (x>>16)&0xFF;
        data[(i<<2)+1] = (x>>8)&0xFF;
        data[(i<<2)+2] = (x)&0xFF;
        data[(i<<2)+3] = 0xFF;
    }

    //data.set(buffer);
    this.fbctx.putImageData(this.fbimageData, 0, 0); // at coords 0,0
}

