// -------------------------------------------------
// -------------------- Master ---------------------
// -------------------------------------------------

// In this version of Master:
// FrameBuffer is disabled/hacked out
// Added "SendKeys" and "RunCode" methods

function DebugMessage(message) {
    console.log(message);
}

// small uart device
function UARTDev(worker) {
    this.ReceiveChar = function(c) {
        if (!worker.fbfocus) { // check if framebuffer has focus
            worker.SendToWorker("tty", c);
        }
    };
}

function jor1kGUI(termid, fbid, statsid, imageurls, proxyurl)
{
    this.proxyurl = proxyurl;
    this.urls = imageurls;
    this.worker = new Worker('js/worker/worker.js');
    this.fbfocus = false; // true: keyboard command are not send to tty
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

    this.term = new Terminal(24, 80, termid);
    this.terminput = new TerminalInput(new UARTDev(this));
    this.worker.onmessage = this.OnMessage.bind(this);   
    this.worker.onerror = function(e) {
        console.log("Error at " + e.filename + ":" + e.lineno + ": " + e.message);
    }
    this.terminalcanvas = document.getElementById(termid);

    this.IgnoreKeys = function() {
      return document.activeElement.type==="textarea";
    }
    
    // Drop key events ; the termainl will generate uart events
    document.onkeypress = function(event) {
        if(this.IgnoreKeys()) return true;
        //this.SendToWorker("keypress", {keyCode:event.keyCode, charCode:event.charCode});
        return this.terminput.OnKeyPress(event);      
    }.bind(this);

    document.onkeydown = function(event) {
        if(this.IgnoreKeys()) return true;
        //DebugMessage("" + event.keyCode);
        //this.SendToWorker("keydown", {keyCode:event.keyCode, charCode:event.charCode});
        return this.terminput.OnKeyDown(event);
    }.bind(this);

    document.onkeyup = function(event) {
        if(this.IgnoreKeys()) return true;
        //this.SendToWorker("keyup", {keyCode:event.keyCode, charCode:event.charCode});
        return this.terminput.OnKeyUp(event);
    }.bind(this);


    // Init Statsline 
    this.stats = document.getElementById(statsid);

    this.stop = false;
    this.SendToWorker("LoadAndStart", this.urls);
    window.setInterval(function(){this.SendToWorker("GetIPS", 0)}.bind(this), 1000);
    
    this.SendKeys("\n"); // activate the console
    
}


jor1kGUI.prototype.OnMessage = function(e) {    
    if (this.stop) return;
    if (e.data.command == "execute") this.SendToWorker("execute", 0); else
    if (e.data.command == "tty") this.term.PutChar(e.data.data); else
    if (e.data.command == "GetFB") this.UpdateFramebuffer(e.data.data); else
    if (e.data.command == "Stop") {console.log("Received stop signal"); this.stop = true;} else
    if (e.data.command == "GetIPS") {        
        this.stats.innerHTML = (Math.floor(e.data.data/100000)/10.) + " MIPS";
    } else
    if (e.data.command == "Debug") console.log(e.data.data);
}

jor1kGUI.prototype.SendKeys = function(text) {
  for(var i=0;i<text.length;i++) {
    this.SendToWorker("tty", text.charCodeAt(i) | 0x0);
  }
}

jor1kGUI.prototype.RunCode = function(code) {
   this.SendKeys("\n"); // activate the console
   // Todo: Sending CTRL-C (0x03) does not work yet
   this.SendKeys('echo -e "');
   code= code .replace(/\\/g,"\\134").replace(/\t/g,"\\t")
              .replace(/\n/g,"\\n").replace(/\r/g,"\\r").replace(/"/g,'\\"');
   this.SendKeys(code);
   this.SendKeys('\"> prog.c\n');
   this.SendKeys("gcc prog.c -o program && ./program\n");

}



