// -------------------------------------------------
// -------------------- Master ---------------------
// -------------------------------------------------

"use strict";

function DebugMessage(message) {
    console.log(message);
}

function jor1kGUI(parameters)
{
    this.params = parameters;

    this.worker = new Worker('js/worker/worker.js');
    this.worker.onmessage = this.OnMessage.bind(this);   
    this.worker.onerror = function(e) {
        console.log("Error at " + e.filename + ":" + e.lineno + ": " + e.message);
        this.stop = true;
    }

    //this.sound = new LoopSoundBuffer(22050);
    
    this.terminalcanvas = document.getElementById(this.params.termid);
    this.stats = document.getElementById(this.params.statsid);
    this.term = new Terminal(24, 80, this.params.termid);
    this.terminput = new TerminalInput(this.SendChars.bind(this));
    this.framebuffer = new Framebuffer(this.params.fbid, this.params.fps, this.SendToWorker.bind(this));


    this.terminalcanvas.onmousedown = function(event) {
        this.framebuffer.fbcanvas.style.border = "2px solid #000000";
    }.bind(this);



    this.IgnoreKeys = function() {
      //Simpler but not as general, return( document.activeElement.type==="textarea" || document.activeElement.type==='input');
      return ((this.lastMouseDownTarget != this.terminalcanvas) && (this.lastMouseDownTarget != this.framebuffer.fbcanvas));
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
        if (this.lastMouseDownTarget == this.terminalcanvas) {
            return this.terminput.OnKeyPress(event);
        }
        this.SendToWorker("keypress", {keyCode:event.keyCode, charCode:event.charCode});
        return false;
    }.bind(this);

    document.onkeydown = function(event) {
        if(this.IgnoreKeys()) return true;
        if (this.lastMouseDownTarget == this.terminalcanvas) {
            return this.terminput.OnKeyDown(event);
        }
        this.SendToWorker("keydown", {keyCode:event.keyCode, charCode:event.charCode});
        return false;
    }.bind(this);

    document.onkeyup = function(event) {
        if(this.IgnoreKeys()) return true;
        if (this.lastMouseDownTarget == this.terminalcanvas) {
            return this.terminput.OnKeyUp(event);
        }
        this.SendToWorker("keyup", {keyCode:event.keyCode, charCode:event.charCode});
        return false;
    }.bind(this);

    this.ethernet = new Ethernet(this.params.relayURL);
    this.ethernet.onmessage = function(e) {
        this.SendToWorker("ethmac", e.data);
    }.bind(this);

    this.Reset();
    
   
    window.setInterval(function(){this.SendToWorker("GetIPS", 0)}.bind(this), 1000);
}

jor1kGUI.prototype.SendToWorker = function(command, data) {
    this.worker.postMessage(
    {
        "command": command,
        "data": data
    });
}

jor1kGUI.prototype.ChangeCore = function(core) {
    this.SendToWorker("ChangeCore", core);
};


jor1kGUI.prototype.Reset = function () {
    this.stop = false; // VM Stopped/Aborted
    this.userpaused = false;
    this.executepending=false; // if we rec an execute message while paused      
    this.SendToWorker("Init", this.params.system);
    this.SendToWorker("Reset");
      
    this.SendToWorker("LoadAndStart", this.params.system.kernelURL);
    this.SendToWorker("LoadFilesystem", this.params.fs);
    this.term.PauseBlink(false);
}

jor1kGUI.prototype.Pause = function(pause) {
    pause = !! pause; // coerce to boolean
    if(pause == this.userpaused) return; 
    this.userpaused = pause;
    if(! this.userpaused && this.executepending) {
      this.executepending = false;
       this.SendToWorker("execute", 0);
    }
    this.term.PauseBlink(pause);
}

// sends the input characters for the terminal
jor1kGUI.prototype.SendChars = function(chars) {
    if (this.lastMouseDownTarget == this.fbcanvas) return;
    this.SendToWorker("tty0", chars);
}


jor1kGUI.prototype.TAR = function(path) {
    this.SendToWorker("tar", path);
}

jor1kGUI.prototype.Sync = function(path) {
    this.SendToWorker("sync", path);
}

jor1kGUI.prototype.UploadExternalFile = function(f) {
    var reader = new FileReader();
    reader.onload = function(e) {
        this.SendToWorker("MergeFile", 
        {name: "home/user/"+f.name, data: new Uint8Array(reader.result)});
    }.bind(this);
    reader.readAsArrayBuffer(f);
}

jor1kGUI.prototype.OnMessage = function(e) {
    // print debug messages even if emulator is stopped
    if (e.data.command == "Debug") console.log(e.data.data);

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

        case "sound":
            //this.sound.AddBuffer(e.data.data);
            break;

        case "ethmac":
            this.ethernet.SendFrame(e.data.data);
            break;

        case "tty0":
            this.term.PutChar(e.data.data);
            break;

        case "GetFB":
            this.framebuffer.Update(e.data.data);
            break;

        case "Stop":
            console.log("Received stop signal");
            this.stop = true;
            break;

        case "GetIPS":
            if (this.userpaused) {
                this.stats.innerHTML = "Paused"; 
            } else {
                this.stats.innerHTML = e.data.data<1000000?
                    Math.floor(e.data.data/1000) + " KIPS" 
                    :
                    (Math.floor(e.data.data/100000)/10.) + " MIPS";
            }
            break;

        case "tar":
            download(e.data.data, "user.tar", "application/x-tar");
            break;

        case "sync":
            UploadBinaryResource(this.params.syncURL, this.params.userid + ".tar", e.data.data, 
            function(response) {
            // alert(response);
            alert(
                "Message from Server:" + response + "\n" +
                "The home folder '/home/user' has been synced with the server\n" +
                "In order to access the data at a later date,\n" +
                "start the next session with the current url with the user id\n" +
                "The folder size is currently limited to 1MB. Note that the feature is experimental.\n" +
                "The content can be downloaded under http://jor1k.com/sync/tarballs/" + this.params.userid+".tar.bz2");
            }.bind(this)
           , function(msg) {alert(msg);}
           );
            
            break;

        }
}

