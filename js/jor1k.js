"use strict";

// -------------------------------------------------
// --------------- Terminal Emulator ---------------
// -------------------------------------------------

var Colors = new Array(
    "000000", "BB0000", "00BB00", "BBBB00",
    "0000BB", "BB00BB", "00BBBB", "BBBBBB",
    "555555", "FF5555", "55FF55", "FFFF55",
    "5555FF", "FF55FF", "55FFFF", "55FFFF");

// constructor
function Terminal(rows, columns, elemId) {
    this.nrows = rows;
    this.ncolumns = columns;
    this.Table = document.getElementById(elemId);
    this.rowelements = new Array(this.nrows);
    this.cursorvisible = false;
    this.line = "";
    this.cursor = 0;
    this.escapetype = 0;
    this.escapestring = "";
    this.cursorx = 0;
    this.cursory = 0;
    this.currentcolor = 0x7;

    this.screen = new Array(this.nrows);
    this.color = new Array(this.nrows);
    for (var i = 0; i < this.nrows; i++) {
        this.screen[i] = new Array(this.ncolumns);
        this.color[i] = new Array(this.ncolumns);

        for (var j = 0; j < this.ncolumns; j++) {
            this.screen[i][j] = 0x0;
            this.color[i][j] = this.currentcolor;
        }
    }
    for (i = 0; i < rows; i++) {
        var TR = this.Table.insertRow(0);
        var TD = document.createElement("td");
        this.rowelements[i] = TD;
        TR.appendChild(TD);
    }
    this.ScreenUpdate();
    this.Blink();
}

Terminal.prototype.Blink = function() {
    // DebugMessage("Blink");
    this.cursorvisible = !this.cursorvisible;
    var colortemp = this.color[this.cursory][this.cursorx];

    if (this.cursorvisible) {
        this.color[this.cursory][this.cursorx] |= 0x600;
    }
    this.PlotRow(this.cursory);
    this.color[this.cursory][this.cursorx] = colortemp;

    /*
    if ((this.cursorblink) && (this.cursory == row) && (this.cursory == row)) {
        this.Blink does not seems to work. Hack but works
    }
    */
    window.setTimeout(function() {
        term.Blink();
    }, 1000); // update every second
};

Terminal.prototype.DeleteRow = function(row) {
    for (var j = 0; j < this.ncolumns; j++) {
        this.screen[row][j] = 0x0;
        this.color[row][j] = 0x7;
    }
    this.PlotRow(row);
};

Terminal.prototype.DeleteArea = function(row, column, row2, column2) {
    for (var i = row; i <= row2; i++) {
        for (var j = column; j <= column2; j++) {
            this.screen[i][j] = 0x0;
            this.color[i][j] = 0x7;
        }
        this.PlotRow(i);
    }
};

Terminal.prototype.PlotRow = function(row) {
    var ccolor = 0x7;
    var spanactive = false;
    var line = "";
    for (var i = 0; i < this.ncolumns; i++) {
        if (ccolor != this.color[row][i]) {
            if (spanactive) {
                line += "</span>";
            }
            ccolor = this.color[row][i];
            if (ccolor != 0x7) {
                line += "<span style=\"color:#" + Colors[ccolor & 0x1F] + ";background-color:#" + Colors[(ccolor >>> 8) & 0x1F] + "\">";
                spanactive = true;
                //line += "<span style=\"color:#" + Colors[ccolor&0x1F] + "\">";				
            }
        }
        if (this.screen[row][i] == 0x0) {
            line += "&nbsp;";
        }
        else if (this.screen[row][i] == 0x20) {
            line += "&nbsp;";
        }
        else {
            line += String.fromCharCode(this.screen[row][i]);
        }
    }
    if (spanactive) {
        line += "</span>";
        spanactive = false;
    }
    this.rowelements[this.nrows - row - 1].innerHTML = line;
};

Terminal.prototype.ScreenUpdate = function() {
    for (var i = 0; i < this.nrows; i++) {
        this.PlotRow(i);
    }
};

Terminal.prototype.LineFeed = function() {
    /*
	for(var i=this.cursorx;i<this.ncolumns;i++) 
	{
		this.screen[this.nrows-1][i] = 0x0;
		this.color[this.nrows-1][i] = this.currentcolor;
	}
    */
    //this.cursorx = 0;
    if (this.cursory != this.nrows - 1) {
        this.cursory++;
        return;
    }
    for (var i = 1; i < this.nrows; i++) {
        for (var j = 0; j < this.ncolumns; j++) {
            this.screen[i - 1][j] = this.screen[i][j];
            this.color[i - 1][j] = this.color[i][j];
        }
    }
    this.DeleteRow(this.nrows - 1);
    this.ScreenUpdate();
};

Terminal.prototype.ChangeCursor = function(Numbers) {
    switch (Numbers.length) {
    case 0:
        this.cursorx = 0;
        this.cursory = 0;
        break;
    case 1:
        this.cursory = Numbers[0];
        break;
    case 2:
    default:
        // TODO check for boundaries
        this.cursory = Numbers[0];
        this.cursorx = Numbers[1];

        break;
    }
};

Terminal.prototype.ChangeColor = function(Numbers) {
    for (var i = 0; i < Numbers.length; i++) {
        switch (Number(Numbers[i])) {
        case 30: case 31: case 32: case 33: case 34: case 35: case 36: case 37:
            this.currentcolor = this.currentcolor & (~0x7) | (Numbers[i] - 30) & 0x7;
            break;
        case 40: case 41: case 42: case 43: case 44: case 45: case 46: case 47:
            this.currentcolor = this.currentcolor & (0xFF) | (((Numbers[i] - 40) & 0x7) << 8);
            break;
        case 0:
            this.currentcolor = 0x7; // reset
            break;
        case 1:
            this.currentcolor |= 10; // brighter foreground colors
            break;
        case 7:
            this.currentcolor = ((this.currentcolor & 0xF) << 8) | ((this.currentcolor >> 8)) & 0xF; // change foreground and background, no brighter colors
            break;
        case 39:
            this.currentcolor = this.currentcolor & (~0x7) | 0x7; // set standard foreground color
            break;
        case 49:
            this.currentcolor = this.currentcolor & 0xFF; // set standard background color
            break;
        case 10:
            // reset mapping ?
            break;
        default:
            DebugMessage("Color " + Numbers[i] + " not found");
            break;
        }
    }
};

Terminal.prototype.HandleEscapeSequence = function() {
    //DebugMessage("Escape sequence:'" + this.escapestring+"'");

    if (this.escapestring == "[J") {
        this.DeleteArea(this.cursory, this.cursorx, this.cursory, this.ncolumns - 1);
        this.DeleteArea(this.cursory + 1, 0., this.nrows - 1, this.ncolumns - 1);
        return;
    }
    // erase from start till cursor
    else if (this.escapestring == "[1K") {
        this.DeleteArea(this.cursory, 0., this.cursory, this.cursorx);
        return;
    }
    // erase from cursor till end
    else if (this.escapestring == "[K") {
        this.DeleteArea(this.cursory, this.cursorx, this.cursory, this.ncolumns - 1);
        return;
    }

    // Testing for [x;y;z
    var s = this.escapestring;
    if (s.charAt(0) != "[") {
        return; // the short escape sequences must be handled earlier
    }
    s = s.substr(1); // delete first sign
    var lastsign = s.substr(s.length - 1); // extract command
    s = s.substr(0, s.length - 1); // remove command
    var numbers = s.split(";"); // if there are multiple numbers, split them
    if (numbers[0].length == 0) {
        numbers = [];
    }

    // colors
    if (lastsign == "m") {
        this.ChangeColor(numbers);
    }
    // cursor
    else if ((lastsign == "H") || (lastsign == "d")) {
        this.ChangeCursor(numbers);
    }
    // change cursor column
    else if ((lastsign == "G")) {
        this.cursorx = numbers[0];
    }
    // move cursor up
    else if (lastsign == "A") {
        if (numbers.length == 0) {
            this.cursory--;
        }
        else this.cursory -= numbers[0];
    }
    // move cursor down
    else if (lastsign == "E") {
        if (numbers.length == 0) {
            this.cursory++;
        }
        else this.cursory += numbers[0];
    }
    // move cursor right
    else if (lastsign == "C") {
        if (numbers.length == 0) {
            this.cursorx++;
        }
        else this.cursorx += numbers[0];
    }
    // move cursor left
    else if (lastsign == "D") {
        if (numbers.length == 0) {
            this.cursorx--;
        }
        else this.cursorx -= numbers[0];
    }
    // erase only number of characters in current line
    else if (lastsign == "X") {
        for (var j = this.cursorx; j < this.cursorx + numbers[0]; j++) {
            this.screen[this.cursory][j] = 0x0;
        }
        //this.DeleteArea(this.cursory, this.cursorx, this.cursory, this.cursorx+numbers[0]);
        //this.DeleteArea(this.cursory, 0, this.cursory, numbers[0]);
    }
    // set scrolling region
    else if (lastsign == "r") {
        // ignore
    }
    else {
        DebugMessage("Escape sequence unknown:'" + this.escapestring + "'");
    }
};

Terminal.prototype.PutChar = function(c) {
    //DebugMessage("Char:" + c + " " +  String.fromCharCode(c));
    // escape sequence (CS)
    if (this.escapetype == 2) {
        this.escapestring += String.fromCharCode(c);
        if ((c >= 64) && (c <= 126)) {
            this.HandleEscapeSequence();
            this.escapetype = 0;
        }
        return;
    }

    // escape sequence
    if ((this.escapetype == 0) && (c == 0x1B)) {
        this.escapetype = 1;
        this.escapestring = "";
        return;
    }

    // starting escape sequence
    if (this.escapetype == 1) {
        this.escapestring += String.fromCharCode(c);
        // Control Sequence Introducer ([)
        if (c == 0x5B) {
            this.escapetype = 2;
            return;
        }
        this.HandleEscapeSequence();
        this.escapetype = 0;
        return;
    }
    switch (c) {
    case 0xA:
        // line feed
        this.LineFeed();
        return;
        break;
    case 0xD:
        // carriage return
        this.cursorx = 0;
        return;
        break;
    case 0x7:
        // beep
        return;
        break;

    case 0x8:
        // back space
        this.cursorx--;
        if (this.cursorx < 0) {
            this.cursorx = 0;
        }
        this.PlotRow(this.cursory);
        return;
        break;

    case 0x00:  case 0x01:  case 0x02:  case 0x03:
	case 0x04:  case 0x05:  case 0x06:
                case 0x09:              case 0x0B:
	case 0x0C:  case 0x0E:  case 0x0F:
	case 0x10:  case 0x11:  case 0x12:  case 0x13:
	case 0x14:  case 0x15:  case 0x16:  case 0x17:
	case 0x18:  case 0x19:  case 0x1A:  case 0x1B:
	case 0x1C:  case 0x1D:  case 0x1E:  case 0x1F:
        DebugMessage("unknown command " + hex8(c));
        return;
        break;
    }

    if (this.cursorx >= this.ncolumns) {
        this.LineFeed();
        this.cursorx = 0;
    }

    //this.screen[this.cursorx][this.cursory] = Number(c);
    var cx = this.cursorx;
    var cy = this.cursory;
    this.screen[cy][cx] = c;
    this.color[cy][cx] = this.currentcolor;
    this.PlotRow(this.cursory);
    this.cursorx++;
};


// -------------------------------------------------
// -------------- Terminal Input -------------------
// -------------------------------------------------

function TerminalInput() {
    this.CTRLpressed = false;
    document.onkeypress = this.KeyPress;
    document.onkeydown = this.KeyDown;
    document.onkeyup = this.KeyUp;
}

TerminalInput.prototype.KeyPress = function(e) {
    //DebugMessage("Keypress: keyCode = " + e.keyCode);
    //DebugMessage("Keypress: charCode = " + e.charCode);
    var key = 0;
    key = e.charCode;
    if (key == 0) {
        return false;
    }
    // Define that the control key has this effect only if special keys have been pressed A..Z a..z. Otherwise some foreign keyboards will not work
    if ((this.CTRLpressed) && (((key >= 0x41) && (key <= 0x5A)) || ((key >= 0x61) && (key <= 0x7A)))) {
        key &= 0x1F;
    }
    uart.ReceiveChar(key);
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
        uart.ReceiveChar(0x10);
        e.preventDefault();
        return false;
        break;
    case 37:
        // left
        uart.ReceiveChar(0x2);
        e.preventDefault();
        return false;
        break;
    case 40:
        // down
        uart.ReceiveChar(0x0E);
        e.preventDefault();
        return false;
        break;
    case 39:
        // right
        uart.ReceiveChar(0x6);
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
            uart.ReceiveChar(99 & 0x1F);
            e.preventDefault();
            return false;
        }
        break;
    }

    if ((keycode != 0) && (keycode <= 0x1F)) {
        uart.ReceiveChar(keycode);
        e.preventDefault();
        return false;
    }
    return;
};


// -------------------------------------------------
// ---------------- Framebuffer --------------------
// -------------------------------------------------

// constructor
function Framebuffer(elemId) {
    var element = document.getElementById(elemId);
    this.c = element.getContext("2d");
    // read the width and height of the canvas
    this.width = element.width;
    this.height = element.height;
    // create a new batch of pixels with the same
    // dimensions as the image:
    this.imageData = this.c.createImageData(this.width, this.height);
}

Framebuffer.prototype.SetAddr = function(addr) {
    this.buf8 = new Uint8ClampedArray(ram.mem, addr, this.imageData.data.length);
    this.Update();
};

Framebuffer.prototype.Update = function() {
    if (!this.buf8) {
        return;
    }
    // copy the image data back onto the canvas
    for (var i = 3; i < this.width * this.height * 4; i += 4) {
        this.buf8[i] = 0xFF;
    }

    this.imageData.data.set(this.buf8);
    this.c.putImageData(this.imageData, 0, 0); // at coords 0,0
    // hack, because this.Update does not work
    window.setTimeout(function() {
        fb.Update();
    }, 500); // update every half a second
};


// -------------------------------------------------
// ------------------ Utils ------------------------
// -------------------------------------------------

function DebugMessage(message) {
    /*
	var Table = document.getElementById("Debug");
	var TR = Table.insertRow(-1);
	var TD = document.createElement("td");
	var TDtext = document.createTextNode(message);
	TD.appendChild(TDtext);
	TR.appendChild(TD);
	*/
    console.log(message);
}

function abort() {
    DebugMessage("Aborting execution.")
    PrintState();
    throw new Error('Abort javascript');
}

// big endian to little endian and vice versa
function Swap32(val) {
    return ((val & 0xFF) << 24) | ((val & 0xFF00) << 8) | ((val >>> 8) & 0xFF00) | ((val >>> 24) & 0xFF);
}

function int32(val) {
    return (val >> 0);
}

function uint32(val) {
    return (val >>> 0);
}

function hex8(x) {
    return ("0x" + ("00000000" + x.toString(16)).substr(-8).toUpperCase());
}

function PrintState() {
    DebugMessage("Current state of the machine")
    //DebugMessage("clock: " + hex8(cpu.clock));
    DebugMessage("PC: " + hex8(cpu.pc));
    DebugMessage("next PC: " + hex8(cpu.nextpc));
    //DebugMessage("ins: " + hex8(cpu.ins));
    //DebugMessage("main opcode: " + hex8(cpu.ins>>>26));
    //DebugMessage("sf... opcode: " + hex8((cpu.ins>>>21)&0x1F));
    //DebugMessage("op38. opcode: " + hex8((cpu.ins>>>0)&0x3CF));

    for (var i = 0; i < 32; i += 4) {
        DebugMessage("   r" + (i + 0) + ": " +
            hex8(cpu.r[i + 0]) + "   r" + (i + 1) + ": " +
            hex8(cpu.r[i + 1]) + "   r" + (i + 2) + ": " +
            hex8(cpu.r[i + 2]) + "   r" + (i + 3) + ": " +
            hex8(cpu.r[i + 3]));
    }
    /*
    if (cpu.jumpdelayed) {
        DebugMessage("delayed jump");
    }
    */
    if (cpu.delayedins) {
        DebugMessage("delayed instruction");
    }

    if (cpu.SR_SM) {
        DebugMessage("Supervisor mode");
    }
    else {
        DebugMessage("User mode");
    }
    if (cpu.SR_TEE) {
        DebugMessage("tick timer exception enabled");
    }
    if (cpu.SR_IEE) {
        DebugMessage("interrupt exception enabled");
    }
    if (cpu.SR_DME) {
        DebugMessage("data mmu enabled");
    }
    if (cpu.SR_IME) {
        DebugMessage("instruction mmu enabled");
    }
    if (cpu.SR_LEE) {
        DebugMessage("little endian enabled");
    }
    if (cpu.SR_CID) {
        DebugMessage("context id enabled");
    }
    if (cpu.SR_F) {
        DebugMessage("flag set");
    }
    if (cpu.SR_CY) {
        DebugMessage("carry set");
    }
    if (cpu.SR_OV) {
        DebugMessage("overflow set");
    }
}

function LoadBinaryResource(url, OnLoadFunction) {
    var req = new XMLHttpRequest();
    req.open('GET', url, true);
    req.responseType = "arraybuffer";
    req.onreadystatechange = function() {
        if (req.readyState != 4) {
            return;
        }
        if ((req.status != 200) && (req.status != 0)) {
            DebugMessage("Error: Could not load file " + url);
            return;
        };
        var arrayBuffer = req.response;
        if (arrayBuffer) {
            OnLoadFunction(arrayBuffer);
        }
    }
    /*
	req.onload = function(e)
	{
		var arrayBuffer = req.response;
		if (arrayBuffer)
		{	
			OnLoadFunction(arrayBuffer);
		}
	} 
    */
    req.send(null);
}


// -------------------------------------------------
// -------------------- UART -----------------------
// -------------------------------------------------

var UART_LSR_DATA_READY = 0x1;
var UART_LSR_FIFO_EMPTY = 0x20;
var UART_LSR_TRANSMITTER_EMPTY = 0x40;

var UART_IER_THRI = 0x02; /* Enable Transmitter holding register int. */
var UART_IER_RDI = 0x01; /* Enable receiver data interrupt */

var UART_IIR_MSI = 0x00; /* Modem status interrupt (Low priority) */
var UART_IIR_NO_INT = 0x01;
var UART_IIR_THRI = 0x02; /* Transmitter holding register empty */
var UART_IIR_RDI = 0x04; /* Receiver data interrupt */
var UART_IIR_RLSI = 0x06; /* Receiver line status interrupt (High p.) */
var UART_IIR_CTI = 0x0c; /* Character timeout */

var UART_LCR_DLAB = 0x80; /* Divisor latch access bit */

var UART_DLL = 0; /* R/W: Divisor Latch Low, DLAB=1 */
var UART_DLH = 1; /* R/W: Divisor Latch High, DLAB=1 */

var UART_IER = 1; /* R/W: Interrupt Enable Register */
var UART_IIR = 2; /* R: Interrupt ID Register */
var UART_FCR = 2; /* W: FIFO Control Register */
var UART_LCR = 3; /* R/W: Line Control Register */
var UART_MCR = 4; /* W: Modem Control Register */
var UART_LSR = 5; /* R: Line Status Register */
var UART_MSR = 6; /* R: Modem Status Register */


// constructor
function UART() {
    this.LCR = 0x3; // Line Control, reset, character has 8 bits
    this.LSR = UART_LSR_TRANSMITTER_EMPTY | UART_LSR_FIFO_EMPTY; // Line Status register, Transmitter serial register empty and Transmitter buffer register empty
    this.MSR = 0; // modem status register
    this.IIR = UART_IIR_NO_INT; // // Interrupt Identification, no interrupt
    this.ints = 0x0; // no interrupt pending
    this.IER = 0x0; //Interrupt Enable
    this.DLL = 0;
    this.DLH = 0;
    this.FCR = 0x0; // FIFO Control;
    this.MCR = 0x0; // Modem Control
    this.input = 0;
    this.fifo = new Array(); // receive fifo buffer
}

// this function is maybe too simple. No buffer. The char will be overwritten
// but if the code some cycles to process. So the FIFO is done by the operating system
UART.prototype.ReceiveChar = function(x) {
    this.fifo.push(x);
    if (this.fifo.length >= 1) {
        this.input = this.fifo.shift()
        this.ClearInterrupt(UART_IIR_CTI);
        this.LSR |= UART_LSR_DATA_READY;
        this.ThrowCTI();
    }
};

UART.prototype.ThrowCTI = function() {
    this.ints |= 1 << UART_IIR_CTI;
    if (!(this.IER & UART_IER_RDI)) {
        return;
    }
    if ((this.IIR != UART_IIR_RLSI) && (this.IIR != UART_IIR_RDI)) {
        this.IIR = UART_IIR_CTI;
        cpu.RaiseInterrupt(0x2);
    }
};

UART.prototype.ThrowTHRI = function() {
    this.ints |= 1 << UART_IIR_THRI;
    if (!(this.IER & UART_IER_THRI)) {
        return;
    }
    if ((this.IIR & UART_IIR_NO_INT) || (this.IIR == UART_IIR_MSI) || (this.IIR == UART_IIR_THRI)) {
        this.IIR = UART_IIR_THRI;
        cpu.RaiseInterrupt(0x2);
    }
};

UART.prototype.NextInterrupt = function() {
    if ((this.ints & (1 << UART_IIR_CTI)) && (this.IER & UART_IER_RDI)) {
        this.ThrowCTI();
    }
    else if ((this.ints & (1 << UART_IIR_THRI)) && (this.IER & UART_IER_THRI)) {
        this.ThrowTHRI();
    }
    else {
        this.IIR = UART_IIR_NO_INT;
        cpu.ClearInterrupt(0x2);
    }
};

UART.prototype.ClearInterrupt = function(line) {
    this.ints &= ~ (1 << line);
    this.IIR = UART_IIR_NO_INT;
    if (line != this.IIR) {
        return;
    }
    this.NextInterrupt();
};

UART.prototype.ReadRegister = function(addr) {
    if (this.LCR & UART_LCR_DLAB) {
        switch (addr) {
        case UART_DLL:
            return this.DLL;
            break;
        case UART_DLH:
            return this.DLH;
            break;
        }
    }
    switch (addr) {
    case 0:
        {
            var ret = this.input;
            this.input = 0;
            this.ClearInterrupt(UART_IIR_RDI);
            this.ClearInterrupt(UART_IIR_CTI);
            if (this.fifo.length >= 1) {
                // not sure if this is right, probably not
                this.input = this.fifo.shift();
                this.LSR |= UART_LSR_DATA_READY;
                //this.ThrowCTI();
            }
            else {
                this.LSR &= ~UART_LSR_DATA_READY;
            }
            return ret;
        }
        break;
    case UART_IER:
        return this.IER & 0x0F;
        break;
    case UART_MSR:
        return this.MSR;
        break;
    case UART_IIR:
        {
            var ret = (this.IIR & 0x0f) | 0xC0; // the two top bits are always set
            if (this.IIR == UART_IIR_THRI) {
                this.ClearInterrupt(UART_IIR_THRI);
            }
            return ret;
            break;
        }
    case UART_LCR:
        return this.LCR;
        break;
    case UART_LSR:
        return this.LSR;
        break;

    default:
        DebugMessage("Error in ReadRegister: not supported");
        abort();
        break;
    }
};

UART.prototype.WriteRegister = function(addr, x) {
    x &= 0xFF;
    if (this.LCR & UART_LCR_DLAB) {
        switch (addr) {
        case UART_DLL:
            this.DLL = x;
            return;
            break;
        case UART_DLH:
            this.DLH = x;
            return;
            break;
        }
    }

    switch (addr) {
    case 0:
        this.LSR &= ~UART_LSR_FIFO_EMPTY;
        term.PutChar(x);
        // Data is send with a latency of zero!
        this.LSR |= UART_LSR_FIFO_EMPTY; // send buffer is empty					
        this.ThrowTHRI();
        break;
    case UART_IER:
        // 2 = 10b ,5=101b, 7=111b
        this.IER = x & 0x0F; // only the first four bits are valid
        // Ok, check immediately if there is a interrupt pending
        this.NextInterrupt();
        break;
    case UART_FCR:

        this.FCR = x;
        if (this.FCR & 2) {
            this.fifo = new Array(); // clear receive fifo buffer
        }
        break;
    case UART_LCR:
        this.LCR = x;
        break;
    case UART_MCR:
        this.MCR = x;
        break;
    default:
        DebugMessage("Error in WriteRegister: not supported");
        abort();
        break;
    }
};


// -------------------------------------------------
// -------------------- RAM ------------------------
// -------------------------------------------------

// constructor
function RAM(memsize) {
    //use typed arrays
    this.memsize = memsize;
    this.mem = new ArrayBuffer(memsize);
    this.uint32mem = new Uint32Array(this.mem);
    this.uint8mem = new Uint8Array(this.mem);
}

var ethreg0 = 0xa000;
var ethreg38 = 0x22;

RAM.prototype.ReadMemory32 = function(addr) {
    if (addr > this.memsize - 4) {
        if ((addr >= 0x92000000) && (addr <= 0x92001000 - 4)) //eth
        {
            if (addr == 0x92000000) {
                return ethreg0;
            }
            if (addr == 0x92000038) {
                var ret = ethreg38;
                if (ethreg38 == 0x1613) {
                    ethreg38 = 0xffff;
                }
                if (ethreg38 == 0x22) {
                    ethreg38 = 0x1613;
                }
                return ret;
            }
            return 0x0;
        }
        else {
            DebugMessage("Error in ReadMemory32: RAM region " + hex8(addr) + " is not accessible");
            abort();
        }
    }
    return this.uint32mem[addr >>> 2];
};

RAM.prototype.WriteMemory32 = function(addr, x) {
    /*
	if ((addr >= 0x900) && (addr <= 0xAFF))  {
	    DebugMessage("Write at " + hex8(addr) + ": " + hex8(x) + " clock: " + cpu.clock);
	    //abort();
	}
    */
    if (addr > this.memsize - 4) {
        //eth
        if ((addr >= 0x92000000) && (addr <= 0x92001000 - 4)) {
            if (addr == 0x92000000) {
                ethreg0 = x;
            }
            return;
        }
        //fb
        else if ((addr >= 0x91000000) && (addr <= 0x91101000 - 4)) {
            if (addr == 0x91000014) {
                fb.SetAddr(Swap32(x));
            }
            //fb.addr = Swap32(x);
            //	fb.Update();
            //DebugMessage("WriteMemory32: FB addr " + hex8(addr) + ": " + hex8(x));
            return;
        }
        else {
            DebugMessage("Error in WriteMemory32: RAM region " + hex8(addr) + " is not accessible");
            abort();
        }
    }
    this.uint32mem[addr >>> 2] = x;
};


RAM.prototype.ReadMemory8 = function(addr) {
    /*
    if (cpu.clock >= 0x001C6CB0) {
        DebugMessage(hex8(addr) + " " + addr);
    }
    */
    if (addr > this.memsize - 1) {
        if ((addr >= 0x90000000) && (addr <= 0x90000006)) {
            return uart.ReadRegister(addr - 0x90000000);
        }
        else {
            DebugMessage("Error in ReadMemory8: RAM region is not accessible");
            abort();
        }
    }
    // consider that the data is saved in little endian
    switch (addr & 3) {
    case 0:
        return this.uint8mem[(addr & ~3) | 3];
    case 1:
        return this.uint8mem[(addr & ~3) | 2];
    case 2:
        return this.uint8mem[(addr & ~3) | 1];
    case 3:
        return this.uint8mem[(addr & ~3) | 0];
    }
    //return this.uint8mem[addr];
};

RAM.prototype.WriteMemory8 = function(addr, x) {
    if (addr > this.memsize - 1) {
        //Exception(EXCEPT_BUSERR, addr);
        if ((addr >= 0x90000000) && (addr <= 0x90000006)) {
            uart.WriteRegister(addr - 0x90000000, x);
            return;
        }
        else {
            DebugMessage("Error in WriteMemory8: RAM region is not accessible");
            abort();
        }
    }
    // consider that the data is saved in little endian	
    switch (addr & 3) {
    case 0:
        this.uint8mem[(addr & ~3) | 3] = x & 0xFF;
        break;
    case 1:
        this.uint8mem[(addr & ~3) | 2] = x & 0xFF;
        break;
    case 2:
        this.uint8mem[(addr & ~3) | 1] = x & 0xFF;
        break;
    case 3:
        this.uint8mem[(addr & ~3) | 0] = x & 0xFF;
        break;
    }
    //this.uint8mem[addr] = x&0xFF;	
};

RAM.prototype.ReadMemory16 = function(addr) {
    if (addr > this.memsize - 2) {
        DebugMessage("Error in ReadMemory16: RAM region is not accessible");
        abort();
    }
    // consider that the data is saved in little endian	
    if (addr & 2) {
        return (this.uint8mem[(addr & ~3) | 1] << 8) | this.uint8mem[(addr & ~3)];
    }
    else {
        return (this.uint8mem[(addr & ~3) | 3] << 8) | this.uint8mem[(addr & ~3) | 2];
    }

    //return (this.uint8mem[addr]<<8) | this.uint8mem[addr+1];
};

RAM.prototype.WriteMemory16 = function(addr, x) {
    if (addr > this.memsize - 2) {
        DebugMessage("Error in WriteMemory16: RAM region is not accessible");
        abort();
    }
    // consider that the data is saved in little endian	
    if (addr & 2) {
        this.uint8mem[(addr & ~3) | 1] = (x >>> 8) & 0xFF;
        this.uint8mem[(addr & ~3)] = x & 0xFF;
    }
    else {
        this.uint8mem[(addr & ~3) | 3] = (x >>> 8) & 0xFF;
        this.uint8mem[(addr & ~3) | 2] = x & 0xFF;
    }
    //this.uint8mem[addr] = (x>>>8)&0xFF;
    //this.uint8mem[addr+1] = x&0xFF;
};


// -------------------------------------------------
// -------------------- CPU ------------------------
// -------------------------------------------------

// special purpose register index
var SPR_UPR = 1; // unit present register
var SPR_SR = 17; // supervision register
var SPR_EEAR_BASE = 48; // exception ea register
var SPR_EPCR_BASE = 32; // exception pc register
var SPR_ESR_BASE = 64; // exception sr register
var SPR_IMMUCFGR = 4; // Instruction MMU Configuration register
var SPR_DMMUCFGR = 3; // Data MMU Configuration register
var SPR_ICCFGR = 6; // Instruction Cache configuration register	
var SPR_DCCFGR = 5; // Data Cache Configuration register	
var SPR_VR = 0; // Version register

// exception types and addresses
var EXCEPT_ITLBMISS = 0xA00; // instruction translation lookaside buffer miss
var EXCEPT_IPF = 0x400; // instruction page fault
var EXCEPT_RESET = 0x100; // reset the processor
var EXCEPT_DTLBMISS = 0x900; // data translation lookaside buffer miss
var EXCEPT_DPF = 0x300; // instruction page fault
var EXCEPT_BUSERR = 0x200; // wrong memory access
var EXCEPT_TICK = 0x500; // tick counter interrupt
var EXCEPT_INT = 0x800; // interrupt of external devices
var EXCEPT_SYSCALL = 0xc00; // syscall, jump into supervisor mode


// constructor
function CPU() {
    //registers
    var array = new ArrayBuffer(32 << 2);
    this.r = new Uint32Array(array);

    // special purpose registers
    var array = new ArrayBuffer(1024 << 2);
    this.group0 = new Uint32Array(array);

    // data tlb
    var array = new ArrayBuffer(1024 << 2);
    this.group1 = new Uint32Array(array);

    // instruction tlb
    var array = new ArrayBuffer(1024 << 2);
    this.group2 = new Uint32Array(array);

    // define variables and initialize
    this.pc = 0x0; // instruction pointer
    this.nextpc = 0x0; // pointer to next instruction
    //this.ins=0x0; // current instruction to handle

    this.jump = 0x0; // jump address
    this.jumpdelayed = false; // if true then: the jump is delayed by one instruction. This is used for saving in the step function

    this.delayedins = false; // the current instruction is an delayed instruction, ine cycle before a jump
    this.interrupt_pending = false;

    // current instruction tlb, needed for fast lookup
    this.instlb = 0x0;

    //this.clock = 0x0;

    this.TTMR = 0x0; // Tick timer mode register
    this.TTCR = 0x0; // Tick timer count register

    this.PICMR = 0x3; // interrupt controller mode register??? (use nmi)
    this.PICSR = 0x0; // interrupt controller set register???

    // flags
    this.SR_SM = true; // supervisor mode
    this.SR_TEE = false; // tick timer Exception Enabled
    this.SR_IEE = false; // interrupt Exception Enabled
    this.SR_DCE = false; // Data Cache Enabled
    this.SR_ICE = false; // Instruction Cache Enabled
    this.SR_DME = false; // Data MMU Enabled
    this.SR_IME = false; // Instruction MMU Enabled
    this.SR_LEE = false; // Little Endian Enabled
    this.SR_CE = false; // CID Enabled ?
    this.SR_F = false; // Flag for l.sf... instructions 
    this.SR_CY = false; // Carry Flag
    this.SR_OV = false; // Overflow Flag
    this.SR_OVE = false; // Overflow Flag Exception
    this.SR_DSX = false; // Delay Slot Exception
    this.SR_EPH = false; // Exception Prefix High
    this.SR_FO = true; // Fixed One, always set
    this.SR_SUMRA = false; // SPRS User Mode Read Access, or TRAP exception disable?
    this.SR_CID = 0x0; //Context ID

    this.group0[SPR_IMMUCFGR] = 0x18; // 0 ITLB has one way and 64 sets
    this.group0[SPR_DMMUCFGR] = 0x18; // 0 DTLB has one way and 64 sets

    this.Exception(EXCEPT_RESET, 0x0); // set pc values
}

CPU.prototype.SetFlags = function(x) {
    /*
    if (this.SR_SM != ((x&1)?true:false)) {
        DebugMessage("Supervisor: " + this.SR_SM);
    }
    */
    this.SR_SM = (x & (1 << 0)) ? true : false;
    this.SR_TEE = (x & (1 << 1)) ? true : false;
    var old_SR_IEE = this.SR_IEE;
    this.SR_IEE = (x & (1 << 2)) ? true : false;
    this.SR_DCE = (x & (1 << 3)) ? true : false;
    this.SR_ICE = (x & (1 << 4)) ? true : false;
    this.SR_DME = (x & (1 << 5)) ? true : false;
    this.SR_IME = (x & (1 << 6)) ? true : false;
    this.SR_LEE = (x & (1 << 7)) ? true : false;
    this.SR_CE = (x & (1 << 8)) ? true : false;
    this.SR_F = (x & (1 << 9)) ? true : false;
    this.SR_CY = (x & (1 << 10)) ? true : false;
    this.SR_OV = (x & (1 << 11)) ? true : false;
    this.SR_OVE = (x & (1 << 12)) ? true : false;
    this.SR_DSX = (x & (1 << 13)) ? true : false;
    this.SR_EPH = (x & (1 << 14)) ? true : false;
    this.SR_FO = true;
    this.SR_SUMRA = (x & (1 << 16)) ? true : false;
    this.SR_CID = (x >>> 28) & 0xF;
    if (this.SR_LEE) {
        DebugMessage("little endian not supported");
        abort();
    }
    if (this.SR_CID) {
        DebugMessage("context id not supported");
        abort();
    }
    if (this.SR_EPH) {
        DebugMessage("exception prefix not supported");
        abort();
    }
    if (this.SR_DSX) {
        DebugMessage("delay slot exception not supported");
        abort();
    }
    if (this.SR_IEE && !old_SR_IEE) {
        this.CheckForInterrupt();
    }
};

CPU.prototype.GetFlags = function() {
    var x = 0x0;
    x |= this.SR_SM ? (1 << 0) : 0;
    x |= this.SR_TEE ? (1 << 1) : 0;
    x |= this.SR_IEE ? (1 << 2) : 0;
    x |= this.SR_DCE ? (1 << 3) : 0;
    x |= this.SR_ICE ? (1 << 4) : 0;
    x |= this.SR_DME ? (1 << 5) : 0;
    x |= this.SR_IME ? (1 << 6) : 0;
    x |= this.SR_LEE ? (1 << 7) : 0;
    x |= this.SR_CE ? (1 << 8) : 0;
    x |= this.SR_F ? (1 << 9) : 0;
    x |= this.SR_CY ? (1 << 10) : 0;
    x |= this.SR_OV ? (1 << 11) : 0;
    x |= this.SR_OVE ? (1 << 12) : 0;
    x |= this.SR_DSX ? (1 << 13) : 0;
    x |= this.SR_EPH ? (1 << 14) : 0;
    x |= this.SR_FO ? (1 << 15) : 0;
    x |= this.SR_SUMRA ? (1 << 16) : 0;
    x |= (this.SR_CID << 28);
    return x;
};

CPU.prototype.CheckForInterrupt = function() {
    if (!this.SR_IEE) {
        return;
    }
    if (this.PICMR & this.PICSR) {
        if (this.PICSR) {
            this.interrupt_pending = true;
            /*
		    // Do it here. Save one comparison in the main loop
		    this.Exception(EXCEPT_INT, this.group0[SPR_EEAR_BASE]);
		    this.delayedins = false;		
		    */
        }
    }
};

CPU.prototype.RaiseInterrupt = function(line) {
    var lmask = 1 << line;
    if (this.PICSR & lmask) {
        // Interrupt already signaled and pending
        //		DebugMessage("Warning: Int pending, ignored");
    }
    this.PICSR |= lmask;
    this.CheckForInterrupt();
};

CPU.prototype.ClearInterrupt = function(line) {
    this.PICSR &= ~ (1 << line);
};

CPU.prototype.SetSPR = function(idx, x) {
    var address = idx & 0x7FF;
    var group = (idx >>> 11) & 0x1F;

    switch (group) {
    case 1:
        // Data MMU
        this.group1[address] = x;
        return;
        break;
    case 2:
        // ins MMU
        this.group2[address] = x;
        return;
        break;
    case 3:
        // data cache, not supported
    case 4:
        // ins cache, not supported
        return;
        break;
    case 9:
        // pic
        switch (address) {
        case 0:
            this.PICMR = x | 0x3; // we use non maskable interrupt here
            // check immediate for interrupt
            if (this.SR_IEE) {
                if (this.PICMR & this.PICSR) {
                    DebugMessage("Error in SetSPR: Direct triggering interrupt exception not supported? What the hell?");
                    abort();
                }
            }
            break;
        case 2:
            this.PICSR = x;
            break;
        default:
            DebugMessage("Error in SetSPR: interrupt address not supported");
            abort();
        }
        return;
        break;
    case 10:
        //tick timer
        switch (address) {
        case 0:
            this.TTMR = x;
            if ((this.TTMR >>> 30) != 0x3) {
                DebugMessage("Error in SetSPR: Timer mode other than continuous not supported");
                abort();
            }
            // for compatbility with or1ksim. Strange. Disable TTMR when in continous mode and cycles match. 
            // we solve it by totally disable the timer. Seems to work with Linux
            if ((this.TTMR & 0xFFFFFF) == (this.TTCR & 0xFFFFFF)) {
                this.TTMR &= 0x3FFFFFFF;
            }
            break;
        case 1:
        default:
            DebugMessage("Error in SetSPR: Tick timer address not supported");
            abort();
            break;
        }
        return;
        break;

    default:
        break;
    }

    if (group != 0) {
        DebugMessage("Error in SetSPR: group " + group + " not found");
        abort();
    }

    switch (address) {
    case SPR_SR:
        this.SetFlags(x);
        break;
    case SPR_EEAR_BASE:
        this.group0[SPR_EEAR_BASE] = x;
        break;
    case SPR_EPCR_BASE:
        this.group0[SPR_EPCR_BASE] = x;
        break;
    case SPR_ESR_BASE:
        this.group0[SPR_ESR_BASE] = x;
        break;
    default:
        DebugMessage("Error in SetSPR: address not found");
        abort();
    }
};

CPU.prototype.GetSPR = function(idx) {
    var address = idx & 0x7FF;
    var group = (idx >>> 11) & 0x1F;

    switch (group) {
    case 9:
        // pic		
        switch (address) {
        case 0:
            return this.PICMR;
            break;
        case 2:
            return this.PICSR;
            break;
        default:
            DebugMessage("Error in GetSPR: PIC address unknown");
            abort();
            break;
        }
        break;

    case 10:
        // tick Timer
        switch (address) {
        case 0:
            return this.TTMR;
            break;
        case 1:
            return this.TTCR; // or clock
            break;
        default:
            DebugMessage("Error in GetSPR: Tick timer address unknown");
            abort();
            break;
        }
        break;
    default:
        break;
    }

    if (group != 0) {
        DebugMessage("Error in GetSPR: group unknown");
        abort();
    }

    switch (idx) {
    case SPR_SR:
        return this.GetFlags();
        break;

    case SPR_UPR:
        return 0x619;
        // UPR present
        // data mmu present
        // instruction mmu present
        // PIC present (architecture manual seems to be wrong here)
        // Tick timer present
        break;

    case SPR_IMMUCFGR:
    case SPR_DMMUCFGR:
    case SPR_EEAR_BASE:
    case SPR_EPCR_BASE:
    case SPR_ESR_BASE:
        return this.group0[idx];
        break;
    case SPR_ICCFGR:
        return 0x48;
        break;
    case SPR_DCCFGR:
        return 0x48;
        break;
    case SPR_VR:
        return 0x12000001;
        break;
    default:
        DebugMessage("Error in GetSPR: address unknown");
        abort();
    }
};

CPU.prototype.Exception = function(excepttype, addr) {
    var except_vector = excepttype | (this.SR_EPH ? 0xf0000000 : 0x00000000);
    //DebugMessage("Info: Raising Exception " + hex8(excepttype));

    this.SetSPR(SPR_EEAR_BASE, addr);
    this.SetSPR(SPR_ESR_BASE, this.GetFlags());

    this.SR_OVE = false;
    this.SR_SM = true;
    this.SR_IEE = false;
    this.SR_TEE = false;
    this.SR_DME = false;

    this.instlb = 0x0;

    this.nextpc = except_vector;

    switch (excepttype) {
    case EXCEPT_RESET:
        break;

    case EXCEPT_ITLBMISS:
    case EXCEPT_IPF:
        this.SetSPR(SPR_EPCR_BASE, addr - (this.delayedins ? 4 : 0));
        break;
    case EXCEPT_DTLBMISS:
    case EXCEPT_DPF:
    case EXCEPT_BUSERR:
        this.SetSPR(SPR_EPCR_BASE, this.pc - (this.delayedins ? 4 : 0));
        break;

    case EXCEPT_TICK:
    case EXCEPT_INT:
        this.SetSPR(SPR_EPCR_BASE, this.pc - (this.delayedins ? 4 : 0));
        this.pc = this.nextpc;
        this.nextpc = this.pc + 4;
        break;
    case EXCEPT_SYSCALL:
        this.SetSPR(SPR_EPCR_BASE, this.pc + 4 - (this.delayedins ? 4 : 0));
        break;
    default:
        DebugMessage("Error in Exception: exception type not supported");
        abort();
    }
    this.SR_IME = false;
};

CPU.prototype.DTLBRefill = function(addr, nsets) {

    if (ram.uint32mem[0x900 >>> 2] != 0x000005C0) {
        cpu.Exception(EXCEPT_DTLBMISS, addr);
        return false;
    }
    var r2, r3, r5, r4;
    r2 = addr;
    // get_current_PGD  using r3 and r5 // it is saved in 0xc03c80a4
    r3 = ram.uint32mem[0x004aa0a4 >>> 2]; // current pgd
    r4 = (r2 >>> 0x18) << 2;
    r5 = r4 + r3;

    r4 = (0x40000000 + r5) & 0xFFFFFFFF; //r4 = phys(r5)

    r3 = ram.uint32mem[r4 >>> 2];

    if (r3 == 0) {
        //DebugMessage("Error in DTLBRefill: Page fault 1\n");
        this.Exception(EXCEPT_DPF, addr);
        return false;
        //abort();
        //	d_pmd_none:
        //	page fault
    }

    //r3 = r3 & ~PAGE_MASK // 0x1fff // sense? delayed jump???
    r3 = 0xffffe000;
    //d_pmd_good:

    r4 = ram.uint32mem[r4 >>> 2]; // get pmd value
    r4 = r4 & r3; // & PAGE_MASK
    r5 = r2 >>> 0xD;
    r3 = r5 & 0x7FF;
    r3 = r3 << 0x2;
    r3 = r3 + r4;
    r2 = ram.uint32mem[r3 >>> 2];

    if ((r2 & 1) == 0) {
        //DebugMessage("Error in DTLBRefill: pte not pressent\n");
        this.Exception(EXCEPT_DPF, addr);
        return false;
        //d_pmd_none:
        //page fault
    }
    //r3 = 0xFFFFe3fa; // PAGE_MASK | DTLB_UP_CONVERT_MASK

    // fill dtlb tr register
    r4 = r2 & 0xFFFFe3fa;
    //r6 = (this.group0[SPR_DMMUCFGR] & 0x1C) >>> 0x2;
    //r3 = 1 << r6; // number of DMMU sets
    //r6 = r3 - 1; // mask register
    //r5 &= r6;
    r5 &= nsets - 1;
    this.group1[0x280 | r5] = r4;
    //SPR_DTLBTR_BASE(0)|r5 = r4 // SPR_DTLBTR_BASE = 0x280 * (WAY*0x100)

    //fill DTLBMR register
    r2 = addr;
    r4 = r2 & 0xFFFFE000;
    r4 = r4 | 0x1;
    this.group1[0x200 | r5] = r4;
    // SPR_DTLBMR_BASE(0)|r5 = r4  // SPR_DTLBMR_BASE = 0x200 * (WAY*0x100)
    return true;
};

CPU.prototype.ITLBRefill = function(addr, nsets) {

    if (ram.uint32mem[0xA00 >>> 2] != 0x000005C2) {
        cpu.Exception(EXCEPT_ITLBMISS, addr);
        return false;
    }
    var r2 = 0x0,
        r3 = 0x0,
        r5 = 0x0,
        r4 = 0x0;

    r2 = addr;
    // get_current_PGD  using r3 and r5
    r3 = ram.uint32mem[0x004aa0a4 >>> 2]; // current pgd
    r4 = (r2 >>> 0x18) << 2;
    r5 = r4 + r3;

    r4 = (0x40000000 + r5) & 0xFFFFFFFF; //r4 = phys(r5)
    r3 = ram.uint32mem[r4 >>> 2];

    if (r3 == 0) {
        this.Exception(EXCEPT_DPF, addr);
        return false;
        //	d_pmd_none:
        //	page fault
    }

    //r3 = r3 & ~PAGE_MASK // 0x1fff // sense? delayed jump???
    r3 = 0xffffe000; // or 0xffffe3fa ??? PAGE_MASK
    //i_pmd_good:

    r4 = ram.uint32mem[r4 >>> 2]; // get pmd value
    r4 = r4 & r3; // & PAGE_MASK
    r5 = r2 >>> 0xD;
    r3 = r5 & 0x7FF;
    r3 = r3 << 0x2;
    r3 = r3 + r4;
    r2 = ram.uint32mem[r3 >>> 2];

    if ((r2 & 1) == 0) {
        this.Exception(EXCEPT_IPF, addr);
        return false;
        //d_pmd_none:
        //page fault
    }
    //r3 = 0xFFFFe03a; // PAGE_MASK | ITLB_UP_CONVERT_MASK

    // fill dtlb tr register
    r4 = r2 & 0xFFFFe03a; // apply the mask
    r3 = r2 & 0x7c0; // PAGE_EXEC, Page_SRE, PAGE_SWE, PAGE_URE, PAGE_UWE

    if (r3 != 0x0) {
        //not itlb_tr_fill....
        //r6 = (this.group0[SPR_IMMUCFGR] & 0x1C) >>> 0x2;
        //r3 = 1 << r6; // number of DMMU sets
        //r6 = r3 - 1; // mask register
        //r5 &= r6;	
        r5 &= nsets - 1;
        //itlb_tr_fill_workaround:
        r4 |= 0xc0; // SPR_ITLBTR_UXE | ITLBTR_SXE
    }
    // itlb_tr_fill:

    this.group2[0x280 | r5] = r4; // SPR_ITLBTR_BASE(0)|r5 = r4 // SPR_ITLBTR_BASE = 0x280 * (WAY*0x100)

    //fill ITLBMR register
    r2 = addr;
    // r3 = 
    r4 = r2 & 0xFFFFE000;
    r4 = r4 | 0x1;
    this.group2[0x200 | r5] = r4; // SPR_DTLBMR_BASE(0)|r5 = r4  // SPR_DTLBMR_BASE = 0x200 * (WAY*0x100)
    return true;
};

CPU.prototype.DTLBLookup = function(addr, write) {
    if (!this.SR_DME) {
        return addr >>> 0;
    }

    // pagesize is 8192 bytes
    // nways are 1
    // nsets are 64

    var setindex = (addr >>> 13) & 63; // check this values
    var tlmbr = this.group1[0x200 | setindex]; // match register
    if (((tlmbr & 1) == 0) || ((tlmbr & 0xFFF80000) != (addr & 0xFFF80000))) {
        // use tlb refill to fasten up
        // return ((cpu_state.sprs[SPR_ITLBTR_BASE(minway) + set] & SPR_ITLBTR_PPN) >> 12) * immu->pagesize + (virtaddr % immu->pagesize); 
        //define SPR_ITLBTR_BASE(WAY)        (SPRGROUP_IMMU + 0x280 + (WAY) * 0x100) 
        //return (((this.group1[0x280 + setindex] & 0xffffe000) >>> 12) << 13) + (addr & 0x1FFF); 

        if (cpu.DTLBRefill(addr, 64)) {
            tlmbr = this.group1[0x200 + setindex];
        }
        else {
            return 0xFFFFFFFF;
        }

        //cpu.Exception(EXCEPT_DTLBMISS, addr); // if you don't use hardware
        //return 0xFFFFFFFF;
    }
    /*	
	// set lru 
	if (tlmbr & 0xC0) {
		DebugMessage("Error: LRU ist nor supported");
		abort();		
	}
    */
    var tlbtr = this.group1[0x280 | setindex]; // translate register

    // Test for page fault
    // Skip this to be faster

    // check if supervisor mode
    if (this.SR_SM) {
        if (
            ((!write) && (!(tlbtr & 0x100))) || // check if SRE
            ((write) && (!(tlbtr & 0x200))) // check if SWE
        ) {
            this.Exception(EXCEPT_DPF, addr);
            return 0xFFFFFFFF;
        }
    }
    else {
        if (
            ((!write) && (!(tlbtr & 0x40))) || // check if URE
            ((write) && (!(tlbtr & 0x80))) // check if UWE
        ) {
            this.Exception(EXCEPT_DPF, addr);
            return 0xFFFFFFFF;
        }
    }
    return ((tlbtr & 0xFFFFE000) | (addr & 0x1FFF)) >>> 0;
};

// the slow version
CPU.prototype.GetInstruction = function(addr) {
    if (!this.SR_IME) {
        return ram.ReadMemory32(uint32(addr));
    }

    // pagesize is 8192 bytes
    // nways are 1
    // nsets are 64

    var setindex = (addr & 0xFFFFE000) >>> 13; // check this values
    // at the moment we have only 64 entries in immu. Look in group0
    setindex &= 63; // number of sets
    var tlmbr = this.group2[0x200 | setindex];

    // test if tlmbr is valid
    if (
        ((tlmbr & 1) == 0) || //test if valid
        ((tlmbr & 0xFFF80000) != (addr & 0xFFF80000))) {
        /*
		if (cpu.ITLBRefill(addr, 64)) {
			tlmbr = this.group2[0x200 | setindex];
		}
        else {
            return 0xFFFFFFFF;
		}
        */
        this.Exception(EXCEPT_ITLBMISS, this.pc);
        return 0xFFFFFFFF;
    }
    // set lru
    if (tlmbr & 0xC0) {
        DebugMessage("Error: LRU ist nor supported");
        abort();
    }

    var tlbtr = this.group2[0x280 | setindex];
    //Test for page fault
    // check if supervisor mode
    if (this.SR_SM) {
        // check if user read enable is not set(URE)
        if (!(tlbtr & 0x40)) {
            this.Exception(EXCEPT_IPF, this.pc);
            return 0xFFFFFFFF;
        }
    }
    else {
        // check if supervisor read enable is not set (SRE)
        if (!(tlbtr & 0x80)) {
            this.Exception(EXCEPT_IPF, this.pc);
            return 0xFFFFFFFF;
        }
    }

    return ram.ReadMemory32(uint32((tlbtr & 0xFFFFE000) | (addr & 0x1FFF)));
};

CPU.prototype.Step = function(steps) {
    var ins = 0x0;
    var imm = 0x0;
    var rD = 0x0,
        rA = 0x0,
        rB = 0x0;

    // local variables could be faster
    var r = this.r;
    var uint32mem = ram.uint32mem;
    var group2 = this.group2;

    // to get the instruction
    var setindex = 0x0;
    var tlmbr = 0x0;
    var tlbtr = 0x0;
    var pc = 0x0;

    // fast tlb, contains only the current page
    //var instlb = 0x0;

    do {
        //this.clock++;
        this.pc = this.nextpc;

        if (this.jumpdelayed) {
            this.nextpc = this.jump;
            this.jumpdelayed = false;
            this.delayedins = true;
        }
        else {
            this.nextpc += 4;
            this.delayedins = false;
        }

        // do this not so often
        if ((steps & 7) == 0) {

            // ---------- TICK ----------
            // timer enabled
            if ((this.TTMR >>> 30) != 0) {
                this.TTCR += 16;
                //this.TTCR++;
                //if ((this.TTCR & 0xFFFFFFF) >= (this.TTMR & 0xFFFFFFF)) {
                if ((this.TTCR & 0xFFFFFF0) == (this.TTMR & 0xFFFFFF0)) {
                    if ((this.TTMR >>> 30) != 0x3) {
                        DebugMessage("Error: Timer mode other than continuous not supported");
                        abort();
                    }
                    // if interrupt enabled
                    if (this.TTMR & (1 << 29)) {
                        this.TTMR |= (1 << 28); // set pending interrupt
                    }
                }
            }

            // check if pending and check if interrupt must be triggered
            if ((this.SR_TEE) && (this.TTMR & (1 << 28))) {
                this.Exception(EXCEPT_TICK, this.group0[SPR_EEAR_BASE]);
                this.delayedins = false;
            }
            else {
                // the interrupt is executed immediately. Saves one comparison
                // test it here instead every time,
                if (this.interrupt_pending) {
                    this.interrupt_pending = false;
                    // check again because there could be another exception during this one cycle
                    if ((this.PICSR) && (this.SR_IEE)) {
                        this.Exception(EXCEPT_INT, this.group0[SPR_EEAR_BASE]);
                        this.delayedins = false;
                    }
                }
            }
        }

        // Get Instruction Fast version	
        // short check if it is still the correct page
        if (!((pc ^ this.pc) & 0xFFFFE000)) {
            pc = this.pc;
            ins = uint32mem[(this.instlb ^ pc) >>> 2];
        }
        else {
            pc = this.pc;
            if (!this.SR_IME) {
                ins = uint32mem[pc >>> 2];
                this.instlb = 0x0;
            }
            else {
                setindex = (pc >>> 13) & 63; // check this values
                tlmbr = group2[0x200 | setindex];
                // test if tlmbr is valid
                if (
                    ((tlmbr & 1) == 0) || //test if valid
                    ((tlmbr & 0xFFF80000) != (pc & 0xFFF80000))) {
                    if (this.ITLBRefill(pc, 64)) {
                        tlmbr = group2[0x200 | setindex]; // reload the new value
                    }
                    else {
                        this.delayedins = false;
                        this.jumpdelayed = false;
                        continue;
                    }
                }
                tlbtr = group2[0x280 | setindex];
                this.instlb = (tlbtr ^ tlmbr) & 0xFFFFE000;
                //ins = uint32mem[((tlbtr&0xFFFFE000) | (pc & 0x1FFF))>>>2];
                ins = uint32mem[(this.instlb ^ pc) >>> 2];
            }
        }

        /*	
        // for the slow variant
	    pc = this.pc;
	    ins = this.GetInstruction(this.pc)
	    if (ins == 0xFFFFFFFF) {
		    this.delayedins = false;
		    this.jumpdelayed = false;
		    continue;
	    }
	    this.ins = ins; // copy for Status of cpu
        */

        switch (ins >>> 26) {
        case 0x0:
            // j
            //imm |= (imm&0x8000000)?0xF0000000:0;
            this.jump = pc + (((ins & 0x3FFFFFF) << 6) >> 4);
            this.jumpdelayed = true;
            break;

        case 0x1:
            // jal
            //imm |= (imm&0x8000000)?0xF0000000:0;
            this.jump = pc + (((ins & 0x3FFFFFF) << 6) >> 4);
            r[9] = this.nextpc + 4;
            this.jumpdelayed = true;
            break;

        case 0x3:
            // bnf
            if (this.SR_F) {
                break;
            }
            //imm |= (imm&0x8000000)?0xF0000000:0;
            this.jump = pc + (((ins & 0x3FFFFFF) << 6) >> 4);
            this.jumpdelayed = true;
            break;

        case 0x4:
            // bf
            if (!this.SR_F) {
                break;
            }
            //imm |= (imm&0x8000000)?0xF0000000:0;
            this.jump = pc + (((ins & 0x3FFFFFF) << 6) >> 4);
            this.jumpdelayed = true;
            break;

        case 0x5:
            // nop
            break;


        case 0x6:
            // movhi or macrc
            rD = (ins >>> 21) & 0x1F;
            // if 16th bit is set
            if (ins & 0x10000) {
                DebugMessage("Error: macrc not supported\n");
                abort();
            }
            else r[rD] = ((ins & 0xFFFF) << 16); // movhi
            break;

        case 0x8:
            //sys
            cpu.Exception(EXCEPT_SYSCALL, this.group0[SPR_EEAR_BASE]);
            break;

        case 0x9:
            // rfe
            this.nextpc = this.GetSPR(SPR_EPCR_BASE);
            this.SetFlags(this.GetSPR(SPR_ESR_BASE));
            break;

        case 0x11:
            // jr
            this.jump = r[(ins >>> 11) & 0x1F];
            this.jumpdelayed = true;
            break;

        case 0x12:
            // jalr
            this.jump = r[(ins >>> 11) & 0x1F];
            r[9] = this.nextpc + 4;
            this.jumpdelayed = true;
            break;


        case 0x11:
            // jr
            this.jump = r[(ins >>> 11) & 0x1F];
            this.jumpdelayed = true;
            break;

        case 0x21:
            // lwz 
            //imm |= (imm&0x8000)?0xFFFF0000:0;
            rA = r[(ins >>> 16) & 0x1F] + (((ins & 0xFFFF) << 16) >> 16);
            if ((rA & 3) != 0) {
                DebugMessage("Error: no unaligned access allowed");
                abort();
            }
            imm = this.DTLBLookup(rA, false);
            if (imm == 0xFFFFFFFF) {
                break;
            }
            r[(ins >>> 21) & 0x1F] = ram.ReadMemory32(imm);
            break;

        case 0x23:
            // lbz
            //imm |= (imm&0x8000)?0xFFFF0000:0;
            rA = r[(ins >>> 16) & 0x1F] + (((ins & 0xFFFF) << 16) >> 16);
            imm = this.DTLBLookup(rA, false);
            if (imm == 0xFFFFFFFF) {
                break;
            }
            r[(ins >>> 21) & 0x1F] = ram.ReadMemory8(imm);
            break;

        case 0x24:
            // lbs 
            //			imm |= (imm&0x8000)?0xFFFF0000:0;
            rA = r[(ins >>> 16) & 0x1F] + (((ins & 0xFFFF) << 16) >> 16);
            imm = this.DTLBLookup(rA, false);
            if (imm == 0xFFFFFFFF) {
                break;
            }
            rD = (ins >>> 21) & 0x1F;
            r[rD] = ((ram.ReadMemory8(imm)) << 24) >> 24;
            //r[rD] |= (r[rD]&0x80)?0xFFFFFF00:0;
            break;

        case 0x25:
            // lhz 
            //			imm |= (imm&0x8000)?0xFFFF0000:0;
            rA = r[(ins >>> 16) & 0x1F] + (((ins & 0xFFFF) << 16) >> 16);
            imm = this.DTLBLookup(rA, false);
            if (imm == 0xFFFFFFFF) {
                break;
            }
            r[(ins >>> 21) & 0x1F] = ram.ReadMemory16(imm);
            break;

        case 0x26:
            // lhs 
            //			imm |= (imm&0x8000)?0xFFFF0000:0;
            rA = r[(ins >>> 16) & 0x1F] + (((ins & 0xFFFF) << 16) >> 16);
            imm = this.DTLBLookup(rA, false);
            if (imm == 0xFFFFFFFF) {
                break;
            }
            rD = (ins >>> 21) & 0x1F;
            r[rD] = (ram.ReadMemory16(imm) << 16) >> 16;
            //r[rD] |= (r[rD]&0x8000)?0xFFFF0000:0;
            break;


        case 0x27:
            // addi signed 
            imm = ((ins & 0xFFFF) << 16) >> 16;
            //			imm |= (imm&0x8000)?0xFFFF0000:0;
            //			imm = (imm>>0);
            rA = r[(ins >>> 16) & 0x1F];
            rD = (ins >>> 21) & 0x1F;
            r[rD] = rA + imm;
            this.SR_CY = r[rD] < rA;
            this.SR_OV = ((rA ^ imm ^ -1) & (rA ^ r[rD])) & 0x80000000;
            //TODO overflow and carry
            // maybe wrong
            break;

        case 0x29:
            // andi
            r[(ins >>> 21) & 0x1F] = r[(ins >>> 16) & 0x1F] & (ins & 0xFFFF);
            break;


        case 0x2A:
            // ori
            r[(ins >>> 21) & 0x1F] = r[(ins >>> 16) & 0x1F] | (ins & 0xFFFF);
            break;

        case 0x2B:
            // xori
            imm = ((ins & 0xFFFF) << 16) >> 16;
            //			imm |= (imm&0x8000)?0xFFFF0000:0;
            rA = r[(ins >>> 16) & 0x1F];
            r[(ins >>> 21) & 0x1F] = rA ^ (((ins & 0xFFFF) << 16) >> 16);
            break;

        case 0x2D:
            // mfspr
            r[(ins >>> 21) & 0x1F] = this.GetSPR(r[(ins >>> 16) & 0x1F] | (ins & 0xFFFF));
            break;

        case 0x2E:
            switch ((ins >>> 6) & 0x3) {
            case 0:
                // slli
                r[(ins >>> 21) & 0x1F] = r[(ins >>> 16) & 0x1F] << (ins & 0x1F);
                break;
            case 1:
                // rori
                r[(ins >>> 21) & 0x1F] = r[(ins >>> 16) & 0x1F] >>> (ins & 0x1F);
                break;
            case 2:
                // srai
                r[(ins >>> 21) & 0x1F] = (r[(ins >>> 16) & 0x1F] >> 0) >> (ins & 0x1F);
                break;
            default:
                DebugMessage("Error: opcode 2E function not implemented");
                abort();
                break;
            }
            break;

        case 0x2F:
            // sf...i
            //imm = ins&0xFFFF;
            //imm |= (ins&0x8000)?0xFFFF0000:0;			
            imm = ((ins & 0xFFFF) << 16) >> 16;
            switch ((ins >>> 21) & 0x1F) {
            case 0x0:
                // sfnei
                this.SR_F = (r[(ins >>> 16) & 0x1F] == (imm >>> 0)) ? true : false;
                break;
            case 0x1:
                // sfnei					
                this.SR_F = (r[(ins >>> 16) & 0x1F] != (imm >>> 0)) ? true : false;
                break;
            case 0x2:
                // sfgtui
                this.SR_F = (r[(ins >>> 16) & 0x1F] > (imm >>> 0)) ? true : false;
                break;
            case 0x3:
                // sfgeui
                this.SR_F = (r[(ins >>> 16) & 0x1F] >= (imm >>> 0)) ? true : false;
                break;
            case 0x4:
                // sfltui
                this.SR_F = (r[(ins >>> 16) & 0x1F] < (imm >>> 0)) ? true : false;
                break;
            case 0x5:
                // sfleui
                this.SR_F = (r[(ins >>> 16) & 0x1F] <= (imm >>> 0)) ? true : false;
                break;
            case 0xa:
                // sfgtsi
                this.SR_F = ((r[(ins >>> 16) & 0x1F] >> 0) > (imm >> 0)) ? true : false;
                break;
            case 0xb:
                // sfgesi
                this.SR_F = ((r[(ins >>> 16) & 0x1F] >> 0) >= (imm >> 0)) ? true : false;
                break;
            case 0xc:
                // sfltsi
                this.SR_F = ((r[(ins >>> 16) & 0x1F] >> 0) < (imm >> 0)) ? true : false;
                break;
            case 0xd:
                // sflesi
                this.SR_F = ((r[(ins >>> 16) & 0x1F] >> 0) <= (imm >> 0)) ? true : false;
                break;
            default:
                DebugMessage("Error: sf...i not supported yet");
                abort();
                break;
            }
            break;

        case 0x30:
            // mtspr
            imm = (ins & 0x7FF) | ((ins >>> 10) & 0xF800);
            this.SetSPR(r[(ins >>> 16) & 0x1F] | imm, r[(ins >>> 11) & 0x1F]);
            break;

        case 0x35:
            // sw
            imm = ((((ins >>> 10) & 0xF800) | (ins & 0x7FF)) << 16) >> 16;
            //imm |= (imm&0x8000)?0xFFFF0000:0;
            rA = r[(ins >>> 16) & 0x1F] + imm;
            if (rA & 0x3) {
                DebugMessage("Error: not aligned memory access");
                abort();
            }
            imm = this.DTLBLookup(rA, true);
            if (imm == 0xFFFFFFFF) {
                break;
            }
            ram.WriteMemory32(imm, r[(ins >>> 11) & 0x1F]);
            break;

        case 0x36:
            // sb
            imm = ((((ins >>> 10) & 0xF800) | (ins & 0x7FF)) << 16) >> 16;
            //imm |= (imm&0x8000)?0xFFFF0000:0;
            rA = r[(ins >>> 16) & 0x1F] + imm;
            imm = this.DTLBLookup(rA, true);
            if (imm == 0xFFFFFFFF) {
                break;
            }
            ram.WriteMemory8(imm, r[(ins >>> 11) & 0x1F]);
            break;

        case 0x37:
            // sh
            imm = ((((ins >>> 10) & 0xF800) | (ins & 0x7FF)) << 16) >> 16;
            //imm |= (imm&0x8000)?0xFFFF0000:0;
            rA = r[(ins >>> 16) & 0x1F] + imm;
            imm = this.DTLBLookup(rA, true);
            if (imm == 0xFFFFFFFF) {
                break;
            }
            ram.WriteMemory16(imm, r[(ins >>> 11) & 0x1F]);
            break;

        case 0x38:
            // three operands commands
            rA = cpu.r[(ins >>> 16) & 0x1F];
            rB = cpu.r[(ins >>> 11) & 0x1F];
            rD = (ins >>> 21) & 0x1F;
            switch ((ins >>> 0) & 0x3CF) {
            case 0x0:
                // add signed 
                if ((ins & 0x300) != 0) {
                    break;
                }
                r[rD] = rA + rB;
                this.SR_CY = r[rD] < rA;
                this.SR_OV = ((rA ^ rB ^ -1) & (rA ^ r[rD])) & 0x80000000;
                //TODO overflow and carry
                break;
            case 0x2:
                // sub signed
                if ((ins & 0x300) != 0) {
                    break;
                }
                r[rD] = rA - rB;
                this.SR_CY = (rB > rA);
                this.SR_OV = ((rA ^ rB) & (rA ^ r[rD])) & 0x80000000;
                //TODO overflow and carry
                break;
            case 0x3:
                // and
                if ((ins & 0x300) != 0) {
                    break;
                }
                r[rD] = rA & rB;
                break;
            case 0x4:
                // or
                if ((ins & 0x300) != 0) {
                    break;
                }
                r[rD] = rA | rB;
                break;
            case 0x5:
                // or
                if ((ins & 0x300) != 0) {
                    break;
                }
                r[rD] = rA ^ rB;
                break;
            case 0x8:
                // sll
                r[rD] = rA << (rB & 0x1F);
                break;
            case 0x48:
                // srl not signed
                r[rD] = rA >>> (rB & 0x1F);
                break;
            case 0xf:
                // ff1
                r[rD] = 0;
                for (var i = 0; i < 32; i++)
                if (rA & (1 << i)) {
                    r[rD] = i + 1;
                    break;
                }
                break;
            case 0x88:
                // sra signed
                r[rD] = rA >> (rB & 0x1F);
                // be carefull here and check
                break;
            case 0x10f:
                // fl1
                r[rD] = 0;
                for (var i = 31; i >= 0; i--)
                if (rA & (1 << i)) {
                    r[rD] = i + 1;
                    break;
                }
                break;
            case 0x306:
                // mul signed (specification seems to be wrong)
                {
                    // this is a hack to do 32 bit signed multiply. Seems to work but needs to be tested. 
                    r[rD] = int32(rA >> 0) * int32(rB);
                    var rAl = rA & 0xFFFF;
                    var rBl = rB & 0xFFFF;
                    r[rD] = r[rD] & 0xFFFF0000 | ((rAl * rBl) & 0xFFFF);
                    //DebugMessage("Multiplying " +int32(rA) + " " + int32(rB)+ " " + r[rD]);
                    var result = Number(int32(rA)) * Number(int32(rB));
                    //r[rD] = result;
                    this.SR_OV = (result < (-2147483647 - 1)) || (result > (2147483647));
                    var uresult = uint32(rA) * uint32(rB);
                    this.SR_CY = (uresult > (4294967295));
                    /*
					int64_t result = int64_t(int32(rA)) * int64_t(int32(rB));
					//cpu->r[rD] =  int32(rA) * int32(rB);
					cpu->r[rD] =  uint32(result&0xFFFFFFFFLL);
			        cpu->SR_OV = ((result < (int64_t)INT32_MIN) || (result > (int64_t)INT32_MAX));
					uint64_t uresult = uint64_t(rA) * uint64_t(rB);
					cpu->SR_CY = (uresult > (uint64_t)UINT32_MAX);
					//warning TODO overflow and carry
					*/
                    //DebugMessage("mul signed not supported");
                    //abort();
                }
                break;
            case 0x30a:
                // divu (specification seems to be wrong)
                //DebugMessage("divu signed not supported");
                //abort();				
                this.SR_CY = rB == 0;
                this.SR_OV = 0;
                if (!this.SR_CY) {
                    r[rD] = /*Math.floor*/(rA / rB);
                }
                break;
            case 0x309:
                // div (specification seems to be wrong)
                //DebugMessage("div not supported");
                //abort();					
                this.SR_CY = rB == 0;
                this.SR_OV = 0;
                if (!this.SR_CY) {
                    r[rD] = int32(rA) / int32(rB);
                }

                break;
            default:
                DebugMessage("Error: op38 opcode not supported yet");
                abort();
                break;
            }
            break;

        case 0x39:
            // sf....
            switch ((ins >>> 21) & 0x1F) {
            case 0x0:
                // sfeq
                this.SR_F = (r[(ins >>> 16) & 0x1F] == r[(ins >>> 11) & 0x1F]) ? true : false;
                break;
            case 0x1:
                // sfne
                this.SR_F = (r[(ins >>> 16) & 0x1F] != r[(ins >>> 11) & 0x1F]) ? true : false;
                break;
            case 0x2:
                // sfgtu
                this.SR_F = (r[(ins >>> 16) & 0x1F] > r[(ins >>> 11) & 0x1F]) ? true : false;
                break;
            case 0x3:
                // sfgeu
                this.SR_F = (r[(ins >>> 16) & 0x1F] >= r[(ins >>> 11) & 0x1F]) ? true : false;
                break;
            case 0x4:
                // sfltu
                this.SR_F = (r[(ins >>> 16) & 0x1F] < r[(ins >>> 11) & 0x1F]) ? true : false;
                break;
            case 0x5:
                // sfleu
                this.SR_F = (r[(ins >>> 16) & 0x1F] <= r[(ins >>> 11) & 0x1F]) ? true : false;
                break;
            case 0xa:
                // sfgts
                this.SR_F = ((r[(ins >>> 16) & 0x1F] >> 0) > (r[(ins >>> 11) & 0x1F]) >> 0) ? true : false;
                break;
            case 0xb:
                // sfges
                this.SR_F = ((r[(ins >>> 16) & 0x1F] >> 0) >= (r[(ins >>> 11) & 0x1F]) >> 0) ? true : false;
                break;
            case 0xc:
                // sflts
                this.SR_F = ((r[(ins >>> 16) & 0x1F] >> 0) < (r[(ins >>> 11) & 0x1F]) >> 0) ? true : false;
                break;
            case 0xd:
                // sfles
                this.SR_F = ((r[(ins >>> 16) & 0x1F] >> 0) <= (r[(ins >>> 11) & 0x1F]) >> 0) ? true : false;
                break;
            default:
                DebugMessage("Error: sf.... function supported yet");
                abort();
            }
            break;

        default:
            DebugMessage("Error: Instruction with opcode " + hex8(ins >>> 26) + " not supported");
            abort();
            break;
        }

    } while (steps--); // main loop	
};

// -------------------------------------------------
// -------------------------------------------------
// -------------------------------------------------

var tracebufferindex = 0;
var tracebuffer;
var ntrace = 0;

function TraceFinish(buffer) {
    tracebuffer = new Uint32Array(buffer);
    DebugMessage("Trace loaded: " + (tracebuffer.length << 2) + " bytes");
    LoadBinaryResource("vmlinux", ImageFinished);
}

function TraceFinish2(buffer) {
    tracebuffer = new Uint32Array(buffer);
    //DebugMessage("Trace loaded: " + (tracebuffer.length<<2) + " bytes");
    MainLoop();
}

function CopyBinary(to, from, size, buffersrc, bufferdest) {
    for (var i = 0; i < size; i++) bufferdest[to + i] = buffersrc[from + i];
}

function ImageFinished(buffer) {
    var buffer8 = new Uint8Array(buffer);
    DebugMessage("Image loaded: " + buffer8.length + " bytes");
    for (var i = 0; i < buffer8.length; i++) ram.uint8mem[i] = buffer8[i];
    for (var i = 0; i < buffer8.length >>> 2; i++) ram.uint32mem[i] = Swap32(ram.uint32mem[i]); // big endian to little endian

    DebugMessage("Starting emulation");
    MainLoop();
}

function MainLoop() {
    //for(var i=0; i<0x4000; i++) {
        /*
        if (cpu.clock >= 1100001-1) {
            DebugMessage(tracebufferindex);
        }
        */
        cpu.Step(0x10000);
        //fb.Update();
        //continue;
        /*
		if (tracebuffer[tracebufferindex] == undefined) {
            DebugMessage("tracebuffer undefined "+tracebufferindex);
            abort();
        }
		if (tracebuffer[tracebufferindex] != cpu.pc) {
			DebugMessage("Error: pc does not match " +
                hex8(tracebuffer[tracebufferindex]) + " " +
                hex8(cpu.pc));
			abort();
		}

		tracebufferindex++;
		tracebufferindex++;
		tracebufferindex++;
		for(var j=0; j<32; j++) {
			if (tracebuffer[tracebufferindex] == undefined) {
                DebugMessage("tracebuffer undefined "+tracebufferindex);
                abort();
            }
			if (tracebuffer[tracebufferindex] != cpu.r[j]) {
				DebugMessage("Error: r"+j+" does not match " +
                    hex8(tracebuffer[tracebufferindex]) + " " +
                    hex8(cpu.r[j]));
				abort();
			}
			
			tracebufferindex++;
		}	
		if (tracebuffer[tracebufferindex] == undefined) {
            DebugMessage("tracebuffer undefined "+tracebufferindex);
            abort();
        }
		if (tracebuffer[tracebufferindex] != cpu.GetFlags()) {
			DebugMessage("Error: flags does not match " +
                hex8(tracebuffer[tracebufferindex]) + " " +
                hex8(cpu.GetFlags()));
			abort();
		}
		tracebufferindex += 4;
		*/
    //}
    window.setTimeout(MainLoop, 0);
    /*
	ntrace++;
	tracebufferindex=0;
    //DebugMessage("Loading " + "trace"+ntrace+".dat");
	LoadBinaryResource("trace"+ntrace+".dat", TraceFinish2);
    */
}

var term = new Terminal(25, 80, "tty");
DebugMessage("Terminal initialized");
new TerminalInput();
DebugMessage("Terminal input initialized");
var fb = new Framebuffer("fb");
DebugMessage("Framebuffer initialized");
var ram = new RAM(0x2000000);
DebugMessage("RAM initialized");
var uart = new UART();
DebugMessage("UART initialized");
var cpu = new CPU();
DebugMessage("CPU initialized");

DebugMessage("Loading Image");
var str = "Loading Image from Web Server (5 MB). Please wait ..."
for (var i = 0; i < str.length; i++) {
    term.PutChar(str.charCodeAt(i));
}

//LoadBinaryResource("trace"+ntrace+".dat", TraceFinish);
LoadBinaryResource("bin/vmlinux.bin", ImageFinished);
