// -------------------------------------------------
// -------------------- Master ---------------------
// -------------------------------------------------

function DebugMessage(message) {
    console.log(message);
}

// small uart device
function UARTDev(worker) {
    this.ReceiveChar = function(c) {
        if (worker.lastMouseDownTarget != worker.fbcanvas) {
            worker.SendToWorker("tty0", c);
        }
    };
}

function jor1kGUI(termid, fbid, statsid, imageurls, relayURL)
{
    this.urls = imageurls;
    
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
        this.Reset();
    };
    this.Reset= function () {
      this.stop = false; // VM Stopped/Aborted
      this.userpaused = false;
      this.executepending=false; // if we rec an execute message while paused      
      this.SendToWorker("Reset");
      this.SendToWorker("LoadAndStart", this.urls);
      this.term.PauseBlink(false);
    }
    this.Pause = function(pause) {
      pause = !! pause; // coerce to boolean
      if(pause == this.userpaused) return; 
      this.userpaused = pause;
      if(! this.userpaused && this.executepending) {
        this.executepending = false;
         this.SendToWorker("execute", 0);
      }
      this.term.PauseBlink(pause);
    }

    this.terminalcanvas = document.getElementById(termid);
    this.stats = document.getElementById(statsid);

    this.term = new Terminal(24, 80, termid);
    this.terminput = new TerminalInput(new UARTDev(this));

    this.IgnoreKeys = function() {
      //Simpler but not as general, return( document.activeElement.type==="textarea" || document.activeElement.type==='input');
      return ((this.lastMouseDownTarget != this.terminalcanvas) && (this.lastMouseDownTarget != this.fbcanvas));
    }
    var recordTarget = function(event) {
            this.lastMouseDownTarget = event.target;
        }.bind(this);
      
    if(document.addEventListener)
      document.addEventListener('mousedown', recordTarget, false);
    else
      Window.onmousedown = recordTarget; // IE 10 support (untested)
        
    
    document.onkeypress = function(event) {
        if(this.IgnoreKeys()) return true;
        this.SendToWorker("keypress", {keyCode:event.keyCode, charCode:event.charCode});
        return this.terminput.OnKeyPress(event);
    }.bind(this);

    document.onkeydown = function(event) {
        if(this.IgnoreKeys()) return true;
        this.SendToWorker("keydown", {keyCode:event.keyCode, charCode:event.charCode});
        return this.terminput.OnKeyDown(event);
    }.bind(this);

    document.onkeyup = function(event) {
        if(this.IgnoreKeys()) return true;
        this.SendToWorker("keyup", {keyCode:event.keyCode, charCode:event.charCode});
        return this.terminput.OnKeyUp(event);
    }.bind(this);

    this.ethernet = new Ethernet(relayURL);
    this.ethernet.onmessage = function(e) {
        this.SendToWorker("ethmac", e.data);
    }.bind(this);

    this.InitFramebuffer(fbid);
    
    this.Reset();
    
    window.setInterval(function(){this.SendToWorker("GetIPS", 0)}.bind(this), 1000);
}

jor1kGUI.prototype.OnMessage = function(e) {
    if (this.stop) return;
    switch(e.data.command)
    {
        case "execute":  // this command is send back and forth to be responsive
            if(this.userpaused) {
              this.executepending = true;
            } else {
              this.executepending = false; 
              this.SendToWorker("execute", 0);
            }
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
            this.stats.innerHTML = this.userpaused ? "Paused" : (Math.floor(e.data.data/100000)/10.) + " MIPS";
            break;
        case "Debug":
            console.log(e.data.data);
            break;
    }
}

// Init Framebuffer if it exists
jor1kGUI.prototype.InitFramebuffer = function(fbid) {
    this.fbcanvas = document.getElementById(fbid);
    if(!this.fbcanvas) return;

    this.fbctx = this.fbcanvas.getContext("2d");
    this.fbimageData = this.fbctx.createImageData(this.fbcanvas.width, this.fbcanvas.height);

    this.terminalcanvas.onmousedown = function(event) {
        this.fbcanvas.style.border = "2px solid #000000";
    }.bind(this);

    this.fbcanvas.onmousedown = function(event) {
        this.fbcanvas.style.border = "2px solid #FF0000";
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
    
    // receive the contents of the framebuffer every 100ms
    window.setInterval(function(){this.SendToWorker("GetFB", 0)}.bind(this), 100);
}

jor1kGUI.prototype.UpdateFramebuffer = function(buffer) {
    if(this.userpaused) return;
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

