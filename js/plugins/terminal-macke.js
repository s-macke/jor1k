var Terminal = require("../master/dev/terminal");

function MackeTerm(termid) {
    this.termid = termid;
}

MackeTerm.prototype.Init = function(jor1kGUI) {
    this.term = new Terminal(24, 80, this.termid);
    jor1kGUI.message.Register("tty0", function(d) {
       d.forEach(function(c) {
           this.term.PutChar(c&0xFF);
       }.bind(this));
    }.bind(this));

    this.terminalcanvas = document.getElementById(this.termid);
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

module.exports = MackeTerm;
