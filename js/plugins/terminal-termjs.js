var TermJS = require("./term");
var UTF8 = require("../lib/utf8");

function TermJSTerm(termElement) {
    this.termElement = termElement;
    this.utf8converter = new UTF8.UTF8StreamToUnicode();
    this.onCharReceived = function (){};
}

TermJSTerm.prototype.Init = function(jor1kGUI, tty) {
    this.term = new TermJS({ cols: 80, rows: 24, screenKeys: true, useStyle: true, cursorBlink: false });
    this.term.on("keypress", function(key, ev) {
        if (ev)
            jor1kGUI.terminput.OnKeyPress(ev);
    });
    this.term.on("keydown", function(key, ev) {
        if (ev)
            jor1kGUI.terminput.OnKeyDown(ev);
    });
    this.term.open(this.termElement);
    jor1kGUI.message.Register(tty, function(d) {
        //this.term.write(String.fromCharCode.apply(null, d)); // TODO Unicode
        for (var i in d) {
            var c = this.utf8converter.Put(d[i]);
            if (c != -1) {
                c = String.fromCharCode(c);
                this.term.write(c);
                this.onCharReceived(c);
            }
        }
    }.bind(this));
}

TermJSTerm.prototype.WasHitByEvent = function(evt) {
    return this.termElement.contains(evt.target);
}

TermJSTerm.prototype.PauseBlink = function(pause) {
    this.term.cursorBlink = !pause;
    if (!pause) {
         this.term.startBlink();
    }
}

TermJSTerm.prototype.SetCharReceiveListener = function (callback) {
    this.onCharReceived = callback;
}

TermJSTerm.prototype.RemoveCharReceiveListener = function () {
    this.onCharReceived = function (){};
}

module.exports = TermJSTerm;
