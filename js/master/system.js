// -------------------------------------------------
// -------------------- Master ---------------------
// -------------------------------------------------

var Terminal = require('./dev/terminal');
var TerminalInput = require('./dev/terminal-input');
var Framebuffer = require('./dev/framebuffer');
var Ethernet = require('./dev/ethernet');
var LoopSoundBuffer = require('./dev/sound');
var download = require('../lib/download');
var utils = require('./utils');
var message = require('./messagehandler');

"use strict";


function jor1kGUI(parameters)
{
    this.params = parameters;
    this.message = message;

    this.worker = new Worker('jor1k-worker-min.js');
    message.SetWorker(this.worker);
    
    this.terminalcanvas = document.getElementById(this.params.termid);
    this.clipboard = document.getElementById(this.params.clipboardid);
    this.stats = document.getElementById(this.params.statsid);

    this.terminput = new TerminalInput(this.SendChars.bind(this));

    this.term = new Terminal(24, 80, this.params.termid);
    message.Register("tty0", function(d) {
       d.forEach(function(c) {
            this.term.PutChar(c&0xFF);
       }.bind(this));
    }.bind(this));


    this.framebuffer = new Framebuffer(this.params.fbid, this.params.fps);
    message.Register("GetFB", this.framebuffer.Update.bind(this.framebuffer));

    //this.sound = new LoopSoundBuffer(22050);
    //message.Register("sound",      this.sound.AddBuffer.bind(this.sound));
    //message.Register("sound.rate", this.sound.SetRate.bind(this.sound));

    this.terminalcanvas.onmousedown = function(event) {
        if (!this.framebuffer.fbcanvas) return;
        this.framebuffer.fbcanvas.style.border = "2px solid #000000";
    }.bind(this);

   if (this.clipboard) {
   this.clipboard.onpaste = function(event) {
       this.clipboard.value = "";
       setTimeout(this.SendClipboard.bind(this), 4);    
   }.bind(this);
   

   this.SendClipboard = function() {
       var chars = [];
       var v = this.clipboard.value;

       for(var i=0; i<v.length; i++) {
           chars.push(v.charCodeAt(i));
       }

       this.SendChars(chars);
       this.clipboard.value = "";
   }.bind(this);
   }
    this.IgnoreKeys = function() {
      return (
          (this.lastMouseDownTarget != this.terminalcanvas) &&
          (this.lastMouseDownTarget != this.framebuffer.fbcanvas) &&
          (this.lastMouseDownTarget != this.clipboard)
      );
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
        if ((this.lastMouseDownTarget == this.terminalcanvas) || (this.lastMouseDownTarget == this.clipboard)) {
            return this.terminput.OnKeyPress(event);
        }
        message.Send("keypress", {keyCode:event.keyCode, charCode:event.charCode});
        return false;
    }.bind(this);

    document.onkeydown = function(event) {
        if(this.IgnoreKeys()) return true;
        if ((this.lastMouseDownTarget == this.terminalcanvas) || (this.lastMouseDownTarget == this.clipboard)) {
            return this.terminput.OnKeyDown(event);
        }
        message.Send("keydown", {keyCode:event.keyCode, charCode:event.charCode});
        return false;
    }.bind(this);

    document.onkeyup = function(event) {
        if(this.IgnoreKeys()) return true;
        if ((this.lastMouseDownTarget == this.terminalcanvas) || (this.lastMouseDownTarget == this.clipboard)) {
            return this.terminput.OnKeyUp(event);
        }
        message.Send("keyup", {keyCode:event.keyCode, charCode:event.charCode});
        return false;
    }.bind(this);

    this.ethernet = new Ethernet(this.params.relayURL);
    this.ethernet.onmessage = function(e) {
        message.Send("ethmac", e.data);
    }.bind(this);
    message.Register("ethmac", this.ethernet.SendFrame.bind(this.ethernet));


    message.Register("Stop", function(){message.Debug("Received stop signal"); this.stop = true}.bind(this));
    message.Register("GetIPS", this.ShowIPS.bind(this));
    message.Register("execute", this.Execute.bind(this));


    this.Reset();
    
   
    window.setInterval(function(){message.Send("GetIPS", 0)}.bind(this), 1000);
}


// this command is send back and forth to be responsive
jor1kGUI.prototype.Execute = function() {
    if (this.stop) return;
    if(this.userpaused) {
        this.executepending = true;
    } else {
        this.executepending = false; 
        message.Send("execute", 0);
    }
};

jor1kGUI.prototype.ShowIPS = function(ips) {
    if (this.userpaused) {
        this.stats.innerHTML = "Paused"; 
    } else {
        this.stats.innerHTML = ips<1000000?
        Math.floor(ips/1000) + " KIPS" 
        :
        (Math.floor(ips/100000)/10.) + " MIPS";
   }
};


jor1kGUI.prototype.ChangeCore = function(core) {
    message.Send("ChangeCore", core);
};


jor1kGUI.prototype.Reset = function () {
    this.stop = false; // VM Stopped/Aborted
    this.userpaused = false;
    this.executepending = false; // if we rec an execute message while paused      
    message.Send("Init", this.params.system);
    message.Send("Reset");
      
    message.Send("LoadAndStart", this.params.system.kernelURL);
    message.Send("LoadFilesystem", this.params.fs);
    this.term.PauseBlink(false);
    message.lastMouseDownTarget = this.terminalcanvas;
}

jor1kGUI.prototype.Pause = function(pause) {
    pause = !! pause; // coerce to boolean
    if(pause == this.userpaused) return; 
    this.userpaused = pause;
    if(! this.userpaused && this.executepending) {
      this.executepending = false;
       message.Send("execute", 0);
    }
    this.term.PauseBlink(pause);
}

// sends the input characters for the terminal
jor1kGUI.prototype.SendChars = function(chars) {
    if (this.lastMouseDownTarget == this.fbcanvas) return;
    message.Send("tty0", chars);
}


jor1kGUI.prototype.TAR = function(path) {
    message.Register("tar", function(d){download(d, "user.tar", "application/x-tar");} );
    message.Send("tar", path);
}

jor1kGUI.prototype.Sync = function(path) {
    message.Register("sync", this.OnSync.bind(this));
    message.Send("sync", path);
}

jor1kGUI.prototype.OnSync = function(d) {
    utils.UploadBinaryResource(this.params.syncURL, this.params.userid + ".tar", d, 
        function(response) {
            alert(
                "Message from Server:" + response + "\n" +
                "The home folder '/home/user' has been synced with the server\n" +
                "In order to access the data at a later date,\n" +
                "start the next session with the current url with the user id\n" +
                "The folder size is currently limited to 1MB. Note that the feature is experimental.\n" +
                "The content can be downloaded under http://jor1k.com/sync/tarballs/" + this.params.userid+".tar.bz2"
            );
            }.bind(this),
        function(msg) {alert(msg);}
    );
}



jor1kGUI.prototype.UploadExternalFile = function(f) {
    var reader = new FileReader();
    reader.onload = function(e) {
        message.Send("MergeFile", 
        {name: "home/user/"+f.name, data: new Uint8Array(reader.result)});
    }.bind(this);
    reader.readAsArrayBuffer(f);
}


module.exports = jor1kGUI;
