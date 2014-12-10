// -------------------------------------------------
// -------------- Terminal Input -------------------
// -------------------------------------------------

// for the special keys look at
// http://www2.gar.no/glinkj/help/cmds/ansm.htm
// http://www.comptechdoc.org/os/linux/howlinuxworks/linux_hlkeycodes.html

"use strict";

var UTF8 = require('../../lib/utf8');

function TerminalInput(SendChars) {
    this.CTRLpressed = false;
    this.ALTpressed = false;
    this.SendChars = SendChars;
    this.enabled = true;
}


TerminalInput.prototype.OnKeyPress = function(e) {
    if (!this.enabled) {
        return;
    }
    var key = 0;
    key = e.charCode;
    if (key == 0) {
        return false;
    }
    // Define that the control key has this effect only if special keys have been pressed A..Z a..z. Otherwise some foreign keyboards will not work
    if ((this.CTRLpressed) && (((key >= 0x41) && (key <= 0x5A)) || ((key >= 0x61) && (key <= 0x7A)))) {
        key &= 0x1F;
    }
    this.SendChars(UTF8.UnicodeToUTF8Stream(key));
    return false;
};

TerminalInput.prototype.OnKeyUp = function(e) {
    if (!this.enabled) {
        return;
    }
    var keycode = e.keyCode;
    var unicode = e.charCode;
    if (keycode == 17) {
        this.CTRLpressed = false;
    } else
    if (keycode == 18) {
        this.ALTpressed = false;
    }
    return false;
};

TerminalInput.prototype.OnKeyDown = function(e) {
    if (!this.enabled) {
        return;
    }
    var keycode = e.keyCode;
    var unicode = e.charCode;
 
    // CTRL + x key handling for chrome 
    if ((this.CTRLpressed) && (!this.ALTpressed) && (keycode >= 65) && (keycode <= 90)) {
        this.SendChars([(keycode-32) & 0x1F]);
        e.preventDefault();
        return false;
    }
    // TODO tab?
    switch (keycode) {
    case 8:
        // del
        this.SendChars([0x7F]);
        e.preventDefault();
        return false;
        break;
    case 9: 
        //tab
        break;
    case 16:
        // shift
        return;
        break;
    case 38:
        // up
        this.SendChars([0x1B, 0x5B, 0x41]);
        e.preventDefault();
        return false;
        break;
    case 37:
        // left
        this.SendChars([0x1B, 0x5B, 0x44]);
        e.preventDefault();
        return false;
        break;
    case 39:
        // right
        this.SendChars([0x1B, 0x5B, 0x43]);
        e.preventDefault();
        return false;
        break;
    case 40:
        // down
        this.SendChars([0x1B, 0x5B, 0x42]);
        e.preventDefault();
        return false;
        break;
    case 112:
    case 113:
    case 114:
    case 115:
    case 116:
        // F1 - F5
        this.SendChars([0x1B, 0x5B, 0x5B, keycode-112+0x41]);
        e.preventDefault();
        return false;
        break;
    case 117:
    case 118:
    case 119:
        // F6 - F8
        this.SendChars([0x1B, 0x5B, 0x31, keycode-117+0x37, 0x7E]);
        e.preventDefault();
        return false;
        break;
    case 120:
    case 121:
        // F9 - F10
        this.SendChars([0x1B, 0x5B, 0x32, keycode-120+0x30, 0x7E]);
        e.preventDefault();
        return false;
        break;

    case 36:
        // pos1
        this.SendChars([0x1b, 0x5b, 0x48]);
        e.preventDefault();
        return false;
        break;
    case 35:
        // end
        this.SendChars([0x1b, 0x5b, 0x46]);
        e.preventDefault();
        return false;
        break;
    case 33:
        // Page up
        this.SendChars([0x1b, 0x5b, 0x35, 0x7e]);
        e.preventDefault();
        return false;
        break;
    case 34:
        // Page down
        this.SendChars([0x1b, 0x5b, 0x36, 0x7e]);
        e.preventDefault();
        return false;
        break;
    case 45:
        // ins
        this.SendChars([0x1b, 0x5b, 0x32, 0x7e]);
        e.preventDefault();
        return false;
        break;
    case 46:
        // del
        this.SendChars([0x1b, 0x5b, 0x33, 0x7e]);
        e.preventDefault();
        return false;
        break;
    case 17:
        // CTRL
        this.CTRLpressed = true;
        //e.preventDefault();
        //return false;
        return;
        break;
    case 18:
        // Alt
        this.ALTpressed = true;
        return;
        break;
    }

    if ((keycode != 0) && (keycode <= 0x1F)) {
        this.SendChars([keycode]);
        e.preventDefault();
        return false;
    }
    
    return;
};


module.exports = TerminalInput;
