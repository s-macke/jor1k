// -------------------------------------------------
// -------------- Terminal Input -------------------
// -------------------------------------------------

function TerminalInput(uartdev) {
    this.CTRLpressed = false;
	this.uart = uartdev;
    document.onkeypress = this.KeyPress.bind(this);
    document.onkeydown = this.KeyDown.bind(this);
    document.onkeyup = this.KeyUp.bind(this);	
}

TerminalInput.prototype.KeyPress = function(e) {
    // DebugMessage("Keypress: keyCode = " + e.keyCode);
    // DebugMessage("Keypress: charCode = " + e.charCode);
    var key = 0;
    key = e.charCode;
    if (key == 0) {
        return false;
    }
    // Define that the control key has this effect only if special keys have been pressed A..Z a..z. Otherwise some foreign keyboards will not work
    if ((this.CTRLpressed) && (((key >= 0x41) && (key <= 0x5A)) || ((key >= 0x61) && (key <= 0x7A)))) {
        key &= 0x1F;
    }
    this.uart.ReceiveChar(key);
    return false;
};

TerminalInput.prototype.KeyUp = function(e) {
    var keycode = e.keyCode;
    var unicode = e.charCode;
    if (keycode == 17) {
        this.CTRLpressed = false;
    }
    //DebugMessage("KeyUp: keyCode = " + e.keyCode);
    //DebugMessage("KeyUp: charCode = " + e.charCode);
    return false;
};

TerminalInput.prototype.KeyDown = function(e) {
    var keycode = e.keyCode;
    var unicode = e.charCode;
    //DebugMessage("KeyDown: keyCode = " + e.keyCode);
    //DebugMessage("KeyDown: charCode = " + e.charCode);
    switch (keycode) {
    case 16:
        // shift
        return;
        break;
    case 38:
        // up
        this.uart.ReceiveChar(0x10);
        e.preventDefault();
        return false;
        break;
    case 37:
        // left
        this.uart.ReceiveChar(0x2);
        e.preventDefault();
        return false;
        break;
    case 40:
        // down
        this.uart.ReceiveChar(0x0E);
        e.preventDefault();
        return false;
        break;
    case 36:
        // pos1
        this.uart.ReceiveChar(0x01);
        e.preventDefault();
        return false;
        break;
    case 35:
        // end
        this.uart.ReceiveChar(0x05);
        e.preventDefault();
        return false;
        break;
    case 33:
        // Page up
        this.uart.ReceiveChar(0x15);
        e.preventDefault();
        return false;
        break;
    case 34:
        // Page down
        this.uart.ReceiveChar(0x16);
        e.preventDefault();
        return false;
        break;
    case 39:
        // right
        this.uart.ReceiveChar(0x6);
        e.preventDefault();
        return false;
        break;
    case 46:
        // del
        this.uart.ReceiveChar(0x4);
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
    case 67:
        // CTRL + c key handling for chrome
        if (this.CTRLpressed == true) {
            this.uart.ReceiveChar(99 & 0x1F);
            e.preventDefault();
            return false;
        }
        break;
    }

    if ((keycode != 0) && (keycode <= 0x1F)) {
        this.uart.ReceiveChar(keycode);
        e.preventDefault();
        return false;
    }
    return;
};
