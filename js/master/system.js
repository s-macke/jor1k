// -------------------------------------------------
// -------------------- Master ---------------------
// -------------------------------------------------

var Terminal = require('./dev/terminal');
var TerminalInput = require('./dev/terminal-input');
var Framebuffer = require('./dev/framebuffer');
var Ethernet = require('./dev/ethernet');
var LoopSoundBuffer = require('./dev/sound');
var Filesystem = require('./dev/filesystem');
var utils = require('./utils');
var message = require('./messagehandler');

var TERMINAL = 0xDEADBEEF;

"use strict";


function jor1kGUI(parameters)
{
    this.params = parameters;
    this.message = message;

    // --- parameters parsing ---
    this.params.system = this.params.system  || {};

    this.params.path = this.params.path || "";

    console.log("kernel URL: " + this.params.system.kernelURL);
    this.params.system.memorysize = this.params.system.memorysize || 32;
    this.params.system.arch = this.params.system.arch || "or1k";
    this.params.system.cpu = this.params.system.cpu || "asm";
    this.params.system.ncores = this.params.system.ncores || 1;
    this.params.syncURL = this.params.syncURL || "";

    if (typeof this.params.fs !== "undefined") {
        this.params.fs.path = this.params.fs.path || this.params.path;
        this.params.fs.basefsURL = this.params.fs.basefsURL || "basefs.json";
        this.params.fs.basefsURL = this.params.fs.path + this.params.fs.basefsURL;
        if (this.params.fs.extendedfsURL) {
            this.params.fs.extendedfsURL = this.params.fs.path + this.params.fs.extendedfsURL;
        }
        this.params.fs.earlyload = this.params.fs.earlyload  || [];
        this.params.fs.lazyloadimages = this.params.fs.lazyloadimages  || [];
    }

    // add path to every URL
    this.params.system.kernelURL = this.params.path + this.params.system.kernelURL;
    this.params.system.dtbURL = this.params.path + this.params.system.dtbURL;

    this.params.userid = this.params.userid || "";

    // ----------------------

    this.worker = (this.params.worker instanceof Worker) ?
        this.params.worker : new Worker("jor1k-worker-min.js");

    message.SetWorker(this.worker);
    message.Send("WorkingPath", this.params.path);

    // ----

    if (this.params.clipboardid) {
        this.clipboard = document.getElementById(this.params.clipboardid);
    }

    if (this.params.statsid) {
        this.stats = document.getElementById(this.params.statsid);
    }

    if (this.params.fbid) {
        this.framebuffer = new Framebuffer(this.params.fbid, this.params.fps);
        message.Register("GetFB", this.framebuffer.Update.bind(this.framebuffer));
    }

    this.terms = [];
    if (this.params.term) {
        this.terms = [this.params.term];
    } else if (this.params.terms) {
        this.terms = this.params.terms.slice(0, 2); // support up to 2 terminals
    }
    for (var i = 0; i < this.terms.length; i++) {
        this.terms[i].Init(this, "tty" + i);
    }

    this.activeTTY = "tty0";
    this.terminput = new TerminalInput(this.SendChars.bind(this));

    this.fs = new Filesystem(this.params.syncURL, this.params.userid);

    this.sound = new LoopSoundBuffer(22050);
    message.Register("sound",      this.sound.AddBuffer.bind(this.sound));
    message.Register("sound.rate", this.sound.SetRate.bind(this.sound));

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
          (this.lastMouseDownTarget != TERMINAL) &&
          (this.framebuffer ? this.lastMouseDownTarget != this.framebuffer.fbcanvas : true) &&
          (this.lastMouseDownTarget != this.clipboard)
      );
    }

    var recordTarget = function(event) {
        var termHitByEvent = false;
        for (var i = 0; i < this.terms.length; i++) {
            if (this.terms[i].WasHitByEvent(event)) {
                termHitByEvent = true;
                this.activeTTY = "tty" + i;
                break;
            }
        }
        if (termHitByEvent)
            this.lastMouseDownTarget = TERMINAL;
        else
            this.lastMouseDownTarget = event.target;
    }.bind(this);

    if(document.addEventListener)
      document.addEventListener('mousedown', recordTarget, false);
    else
      Window.onmousedown = recordTarget; // IE 10 support (untested)

    document.onkeypress = function(event) {
        if(this.IgnoreKeys()) return true;
        if ((this.lastMouseDownTarget == TERMINAL) || (this.lastMouseDownTarget == this.clipboard)) {
            return this.terminput.OnKeyPress(event);
        }
        message.Send("keypress", {keyCode:event.keyCode, charCode:event.charCode});
        return false;
    }.bind(this);

    document.onkeydown = function(event) {
        if(this.IgnoreKeys()) return true;
        if ((this.lastMouseDownTarget == TERMINAL) || (this.lastMouseDownTarget == this.clipboard)) {
            return this.terminput.OnKeyDown(event);
        }
        message.Send("keydown", {keyCode:event.keyCode, charCode:event.charCode});
        return false;
    }.bind(this);

    document.onkeyup = function(event) {
        if(this.IgnoreKeys()) return true;
        if ((this.lastMouseDownTarget == TERMINAL) || (this.lastMouseDownTarget == this.clipboard)) {
            return this.terminput.OnKeyUp(event);
        }
        message.Send("keyup", {keyCode:event.keyCode, charCode:event.charCode});
        return false;
    }.bind(this);

    if (this.params.relayURL) {
        this.ethernet = new Ethernet(this.params.relayURL);
        this.ethernet.onmessage = function(e) {
            message.Send("ethmac", e.data);
        }.bind(this);
        message.Register("ethmac", this.ethernet.SendFrame.bind(this.ethernet));
    }

    message.Register("GetIPS", this.ShowIPS.bind(this));
    message.Register("execute", this.Execute.bind(this));
    message.Register("WorkerReady", this.OnWorkerReady.bind(this));
}

jor1kGUI.prototype.OnWorkerReady = function() {
    this.Reset();
    window.setInterval(function() {
        message.Send("GetIPS", 0);
    }, 1000);
};

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
    if (!this.stats) return;
    if (this.userpaused) {
        this.stats.innerHTML = "Paused";
    } else {
        this.stats.innerHTML = ips<1000000?
        Math.floor(ips/1000) + " KIPS"
        :
        (Math.floor(ips/100000)/10.) + " MIPS";
   }
};

jor1kGUI.prototype.Reset = function () {
    this.stop = false; // VM Stopped/Aborted
    this.userpaused = false;
    this.executepending = false; // if we rec an execute message while paused

    message.Register("InitDone", this.OnInit.bind(this));
    message.Send("Init", this.params.system);
}

jor1kGUI.prototype.OnInit = function () {
    message.Send("Reset");
    message.Send("LoadAndStart", this.params.system.kernelURL);

    if (this.params.fs) message.Send("LoadFilesystem", this.params.fs);

    if (this.terms.length > 0) {
        this.terms.forEach(function (term) {
            term.PauseBlink(false);
        });
        this.lastMouseDownTarget = TERMINAL;
        // activeTTY remains the same, so the user can start typing into the terminal last used
        // or the default terminal initialized in the constructor
    }
}

jor1kGUI.prototype.Pause = function(pause) {
    pause = !! pause; // coerce to boolean
    if(pause == this.userpaused) return;
    this.userpaused = pause;
    if(! this.userpaused && this.executepending) {
      this.executepending = false;
       message.Send("execute", 0);
    }
    this.terms.forEach(function (term) {
        term.PauseBlink(pause);
    });
}

// sends the input characters for the terminal
jor1kGUI.prototype.SendChars = function(chars) {
    if (this.lastMouseDownTarget == this.fbcanvas) return;
    message.Send(this.activeTTY, chars);
    message.Send("htif.term0.Transfer", chars);
}

// Returns the terminal attached to tty
// tty is the tty string, for example, tty0
jor1kGUI.prototype.GetTerm = function(tty) {
    var index = parseInt(tty.slice(3));
    return this.terms[index];
}

jor1kGUI.prototype.FocusTerm = function(tty) {
    this.activeTTY = tty;
    this.lastMouseDownTarget = TERMINAL;
}

module.exports = jor1kGUI;
