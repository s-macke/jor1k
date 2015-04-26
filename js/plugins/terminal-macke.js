var Terminal = require("../master/dev/terminal");

function MackeTerm(termElementId) {
    this.termElementId = termElementId;
}

MackeTerm.prototype.Init = function(jor1kGUI, tty) {
    this.term = new Terminal(24, 80, this.termElementId);
    jor1kGUI.message.Register(tty, function(d) {
       d.forEach(function(c) {
           this.term.PutChar(c&0xFF);
       }.bind(this));
    }.bind(this));

    this.terminalcanvas = document.getElementById(this.termElementId);
    this.terminalcanvas.onmousedown = function(event) {
        if (!jor1kGUI.framebuffer) return;
        jor1kGUI.framebuffer.fbcanvas.style.border = "2px solid #000000";
    }.bind(this);
}

MackeTerm.prototype.WasHitByEvent = function(evt) {
    return this.terminalcanvas.contains(evt.target);
}

MackeTerm.prototype.PauseBlink = function(pause) {
    this.term.PauseBlink(pause);
}

MackeTerm.prototype.SetCharReceiveListener = function (callback) {
    this.term.OnCharReceived = callback;
}

MackeTerm.prototype.RemoveCharReceiveListener = function () {
    this.term.OnCharReceived = function (){};
}

module.exports = MackeTerm;
