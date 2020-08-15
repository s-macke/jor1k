// -------------------------------------------------
// --------------- Terminal Emulator ---------------
// -------------------------------------------------
// http://lxr.free-electrons.com/source/drivers/tty/vt/vt.c

"use strict";

let UTF8 = require('../../lib/utf8');
let message = require('../messagehandler');

const Colors = ["#000000", "#BB0000", "#00BB00", "#BBBB00",
    "#0000BB", "#BB00BB", "#00BBBB", "#BBBBBB",
    // brighter colors
    "#555555", "#FF5555", "#55FF55", "#FFFF55",
    "#5555FF", "#FF55FF", "#55FFFF", "#FFFFFF",
    // dimmed colors
    "#000000", "#770000", "#007700", "#777700",
    "#000077", "#770077", "#007777", "#777777"];


// constructor
function Terminal(nrows, ncolumns, elemId) {
    let i;
    this.nrows = nrows;
    this.ncolumns = ncolumns;

    let ele = document.getElementById(elemId);
    if (ele.tagName === "CANVAS") {
        this.canvas = ele;
        this.context = this.canvas.getContext("2d");
        this.context.font = "13px courier,fixed,swiss,monospace,sans-serif";
    } else {
        this.Table = ele;
        this.rowelements = new Array(this.nrows);
        for (i = 0; i < nrows; i++) {
            let TR = this.Table.insertRow(0);
            let TD = document.createElement("td");
            this.rowelements[i] = TD;
            TR.appendChild(TD);
        }
        // after appending new elements, Firefox needs some form of reset of the root class.
        this.Table.className = this.Table.className;
    }

    this.cursorvisible = false;
    this.escapetype = 0;
    this.escapestring = "";
    this.cursorx = 0;
    this.cursory = 0;
    this.scrolltop = 0;
    this.cursortype = 1;
    this.scrollbottom = this.nrows - 1;

    this.attr_color = 0x7;
    this.attr_reverse = false;
    this.attr_italic = false;
    this.attr_intensity = 0x1;

    this.pauseblink = false;
    this.OnCharReceived = function () {
    };

    this.framerequested = false;
    this.timeout = 30; // the time in ms when the next frame is drawn

    this.updaterow = new Uint8Array(this.nrows);

    this.utf8converter = new UTF8.UTF8StreamToUnicode();

    this.screen = new Array(this.nrows);
    this.color = new Array(this.nrows);
    for (i = 0; i < this.nrows; i++) {
        this.updaterow[i] = 1;
        this.screen[i] = new Uint16Array(this.ncolumns);
        this.color[i] = new Uint16Array(this.ncolumns);

        for (let j = 0; j < this.ncolumns; j++) {
            this.screen[i][j] = 0x20;
            this.color[i][j] = this.attr_color;
        }
    }
    this.UpdateScreen();
    this.Blink();
}

// Stop blinking cursor when the VM is paused
Terminal.prototype.PauseBlink = function (pause) {
    pause = !!pause;
    this.pauseblink = pause;
    if (this.cursortype) {
        this.cursorvisible = !pause;
    }
    this.PrepareUpdateRow(this.cursory, this.cursorx);
}

Terminal.prototype.GetColor = function () {
    let c = this.attr_color;
    if (this.attr_reverse) {
        c = ((c & 0x7) << 8) | ((c >> 8)) & 0x7;
    }
    if (this.attr_intensity === 2) {
        c = c | 0x8;
    } else if (this.attr_intensity === 0) {
        c = c | 0x10;
    }
    return c;
}

Terminal.prototype.Blink = function () {
    this.cursorvisible = !this.cursorvisible;
    if (!this.pauseblink) this.PrepareUpdateRow(this.cursory, this.cursorx);
    window.setTimeout(this.Blink.bind(this), 500); // update every half second
};

Terminal.prototype.DeleteRow = function (row) {
    for (let j = 0; j < this.ncolumns; j++) {
        this.screen[row][j] = 0x20;
        this.color[row][j] = this.attr_color;
    }
    this.PrepareUpdateRow(row);
};

Terminal.prototype.DeleteArea = function (row, column, row2, column2) {
    for (let i = row; i <= row2; i++) {
        for (let j = column; j <= column2; j++) {
            this.screen[i][j] = 0x20;
            this.color[i][j] = this.attr_color;
        }
        this.PrepareUpdateRow(i);
    }
};


Terminal.prototype.UpdateRowCanvas = function (row) {
    let i;
    let x;
    let column;
    let y = row << 4;
    let line = this.screen[row];
    let c = this.color[row][0] | 0;
    let n = 0;

    for (column = 0; column < this.ncolumns; column++) {

        let cnew = this.color[row][column] | 0;

        if (this.cursorvisible)
            if (row === this.cursory)
                if (column === this.cursorx) {
                    cnew |= 0x600;
                }

        if (c !== cnew) {
            x = (column - n) << 3;
            this.context.fillStyle = Colors[(c >>> 8) & 0x1F];
            this.context.fillRect(x, y, n * 8, 16);
            this.context.fillStyle = Colors[c & 0x1F];
            for (i = 0; i < n; i++) {
                this.context.fillText(String.fromCharCode(line[column - n + i]), x + (i << 3), y + 12);
            }
            c = cnew;
            n = 0;
        }

        n++;
    }

    x = (column - n) << 3;
    this.context.fillStyle = Colors[(c >>> 8) & 0x1F];
    this.context.fillRect(x, y, n * 8, 16);
    this.context.fillStyle = Colors[c & 0x1F];
    for (i = 0; i < n; i++) {
        this.context.fillText(String.fromCharCode(line[column - n + i]), x + (i << 3), y + 12);
    }

};

Terminal.prototype.GetSpan = function (c, line, idx, n) {
    let html = "<span style=\"color:" + Colors[c & 0x1F] + ";background-color:" + Colors[(c >> 8) & 0x1F] + "\">";
    for (let i = 0; i < n; i++) {
        switch (line[idx + i]) {
            case 0x20:
                html += "&nbsp;";
                break;

            case 0x26: // '&'
                html += "&amp;";
                break;

            case 0x3C: // '<'
                html += "&lt;";
                break;

            case 0x3E: // '>'
                html += "&gt;";
                break;

            default:
                html += String.fromCharCode(line[idx + i]);
                break;
        }
    }
    html += "</span>";
    return html;
}


Terminal.prototype.UpdateRowTable = function (row) {
    let column;
    let line = this.screen[row];
    let c = this.color[row][0] | 0;
    let n = 0;
    let html = "";

    for (column = 0; column < this.ncolumns; column++) {

        let cnew = this.color[row][column] | 0;

        if (this.cursorvisible)
            if (row === this.cursory)
                if (column === this.cursorx) {
                    cnew |= 0x600;
                }

        if (c !== cnew) {
            html += this.GetSpan(c, line, column - n, n);
            c = cnew;
            n = 0;
        }
        n++;
    }
    html += this.GetSpan(c, line, column - n, n);
    this.rowelements[this.nrows - row - 1].innerHTML = html;

};

Terminal.prototype.UpdateScreen = function () {
    let nupdated = 0;
    for (let i = 0; i < this.nrows; i++) {
        if (!this.updaterow[i]) continue;
        if (this.canvas) {
            this.UpdateRowCanvas(i);
        } else {
            this.UpdateRowTable(i);
        }
        nupdated++;
        this.updaterow[i] = 0;
    }
    this.framerequested = false;
    if (nupdated >= (this.nrows - 1)) {
        this.timeout = 100;
    } else {
        this.timeout = 30;
    }
}

Terminal.prototype.PrepareUpdateRow = function (row) {
    this.updaterow[row] = 1;
    if (this.framerequested) return;
    window.setTimeout(this.UpdateScreen.bind(this), this.timeout);
    this.framerequested = true;
}

Terminal.prototype.ScrollDown = function (draw) {
    let tempscreen = this.screen[this.scrollbottom];
    let tempcolor = this.color[this.scrollbottom];

    for (let i = this.scrollbottom - 1; i >= this.scrolltop; i--) {
        if (i === this.nrows - 1) continue;
        this.screen[i + 1] = this.screen[i];
        this.color[i + 1] = this.color[i];
        if (draw) this.PrepareUpdateRow(i + 1);
    }
    this.screen[this.scrolltop] = tempscreen;
    this.color[this.scrolltop] = tempcolor;
    this.DeleteRow(this.scrolltop);
    if (draw) this.PrepareUpdateRow(this.scrolltop);
}

Terminal.prototype.ScrollUp = function (draw) {
    let tempscreen = this.screen[this.scrolltop];
    let tempcolor = this.color[this.scrolltop];

    for (let i = this.scrolltop + 1; i <= this.scrollbottom; i++) {
        if (i === 0) continue;
        this.screen[i - 1] = this.screen[i];
        this.color[i - 1] = this.color[i];
        if (draw) this.PrepareUpdateRow(i - 1);
    }

    this.screen[this.scrollbottom] = tempscreen;
    this.color[this.scrollbottom] = tempcolor;
    this.DeleteRow(this.scrollbottom);
    if (draw) this.PrepareUpdateRow(this.scrollbottom);
};

Terminal.prototype.LineFeed = function () {
    if (this.cursory !== this.scrollbottom) {
        this.cursory++;
        if (this.cursorvisible) {
            this.PrepareUpdateRow(this.cursory - 1); // delete old cursor position
            this.PrepareUpdateRow(this.cursory); // show new cursor position
        }
        return;
    }
    this.ScrollUp(true);
};

Terminal.prototype.ChangeCursor = function (Numbers) {
    switch (Numbers.length) {
        case 0:
            this.cursorx = 0;
            this.cursory = 0;
            break;
        case 1:
            this.cursory = Numbers[0];
            if (this.cursory) this.cursory--;
            break;
        case 2:
        default:
            // TODO check for boundaries
            this.cursory = Numbers[0];
            this.cursorx = Numbers[1];
            if (this.cursorx) this.cursorx--;
            if (this.cursory) this.cursory--;
            break;
    }
    if (this.cursorx >= this.ncolumns) this.cursorx = this.ncolumns - 1;
    if (this.cursory >= this.nrows) this.cursory = this.nrows - 1;
};

Terminal.prototype.ChangeColor = function (Numbers) {

    if (Numbers.length === 0) { // reset;
        this.attr_color = 0x7;
        this.attr_reverse = false;
        this.attr_italic = false;
        this.attr_intensity = 1;
        return;
    }

    let c = this.attr_color;

    for (let i = 0; i < Numbers.length; i++) {
        switch (Number(Numbers[i])) {

            case 0: // reset
                c = 0x7;
                this.attr_reverse = false;
                this.attr_italic = false;
                this.attr_intensity = 1;
                break;
            case 1: // brighter foreground color
                this.attr_intensity = 2;
                break;
            case 2: // dimmed foreground color
                this.attr_intensity = 0;
                break;
            case 3: // italic
                this.attr_italic = true;
                break;
            case 4: // underline ignored
                break;
            case 5: // extended colors or blink ignored
                //i++;
                break;
            case 7: // reversed
                this.attr_reverse = true;
                break;
            case 8: // hidden ignored
                break;
            case 10: // reset mapping ?
                break;
            case 21:
            case 22:
                this.attr_intensity = 1;
                break;
            case 23:
                this.attr_italic = false;
                break;
            case 27: // no reverse
                this.attr_reverse = false;
                break;

            case 30:
            case 31:
            case 32:
            case 33:
            case 34:
            case 35:
            case 36:
            case 37:
                c = c & (0xFFF8) | (Numbers[i] - 30) & 0x7;
                break;
            case 40:
            case 41:
            case 42:
            case 43:
            case 44:
            case 45:
            case 46:
            case 47:
                c = c & (0x00FF) | (((Numbers[i] - 40) & 0x7) << 8);
                break;
            case 39:
                c = c & (0xFF00) | 0x7; // set standard foreground color
                break;
            case 49:
                c = c & 0x00FF; // set standard background color
                break;
            default:
                message.Warning("Color " + Numbers[i] + " not found");
                break;
        }
    }
    this.attr_color = c | 0;
};

Terminal.prototype.ChangeMode = function (numbers, question, onoff) {

    for (let i = 0; i < numbers.length; i++) {
        switch (numbers[i]) {
            case 4: // insert mode
                break;

            case 7: // auto wrap on off
                break;

            case 25: // cursor on/off
                this.cursortype = onoff;
                break;

            case 1000: // 
                break;

            case 1006: // 
                break;

            case 1005: // 
                break;

            default:
                message.Warning("Mode term parameter " + this.escapestring + " unknown");
                break;
        }
    }
}

Terminal.prototype.ChangeCursorType = function (numbers, question) {
    if (!question) {
        message.Warning("cursor parameter unknown");
        return;
    }

    for (let i = 0; i < numbers.length; i++) {
        switch (numbers[i]) {
            case 0:
                //this.cursorvisible = false;
                //this.cursortype = 0;
                break;
            case 1:
                //this.cursortype = 1;
                break;
            default:
                message.Warning("Term parameter " + this.escapestring + " unknown");
                break;
        }
    }
}


Terminal.prototype.HandleEscapeSequence = function () {
    //message.Debug("Escape sequence:'" + this.escapestring+"'");
    let i = 0;
    if (this.escapestring === "[J") {
        this.DeleteArea(this.cursory, this.cursorx, this.cursory, this.ncolumns - 1);
        this.DeleteArea(this.cursory + 1, 0., this.nrows - 1, this.ncolumns - 1);
        return;
    } else if (this.escapestring === "M") {
        this.ScrollDown(true);
        return;
    }
    // Testing for [x;y;z
    let s = this.escapestring;

    if (s.charAt(0) !== "[") {
        message.Warning("Short escape sequence unknown:'" + this.escapestring + "'");
        return; // the short escape sequences must be handled earlier
    }

    s = s.substr(1); // delete first sign

    let lastsign = s.substr(s.length - 1); // extract command
    s = s.substr(0, s.length - 1); // remove command

    let question = false;
    if (s.charAt(0) === '?') {
        question = true;
        s = s.substr(1); // delete question mark
    }

    let numbers = s.split(";"); // if there are multiple numbers, split them
    if (numbers[0].length === 0) {
        numbers = [];
    }


    // the array must contain of numbers and not strings. Make this sure
    for (i = 0; i < numbers.length; i++) {
        numbers[i] = Number(numbers[i]);
    }

    let oldcursory = this.cursory; // save current cursor position
    let count = 0;
    switch (lastsign) {

        case 'l':
            this.ChangeMode(numbers, question, true);
            return;

        case 'h':
            this.ChangeMode(numbers, question, false);
            return;

        case 'c':
            this.ChangeCursorType(numbers, question);
            return;
    }

    if (question) {
        message.Warning("Escape sequence unknown:'" + this.escapestring + "'");
        return;
    }

    let j;
    let top = 0;
    switch (lastsign) {
        case 'm': // colors
            this.ChangeColor(numbers);
            return;

        case 'A': // move cursor up
            count = numbers.length ? numbers[0] : 1;
            if (count === 0) count = 1;
            this.cursory -= count;
            break;

        case 'B': // move cursor down
            count = numbers.length ? numbers[0] : 1;
            if (count === 0) count = 1;
            this.cursory += count;
            break;

        case 'C': // move cursor right
            count = numbers.length ? numbers[0] : 1;
            if (count === 0) count = 1;
            this.cursorx += count;
            break;

        case 'D': // move cursor left
            count = numbers.length ? numbers[0] : 1;
            if (count === 0) count = 1;
            this.cursorx -= count;
            if (this.cursorx < 0) this.cursorx = 0;
            break;

        case 'E': // move cursor down
            count = numbers.length ? numbers[0] : 1;
            this.cursory += count;
            this.cursorx = 0;
            break;

        case 'F': // move cursor up
            count = numbers.length ? numbers[0] : 1;
            this.cursory -= count;
            if (this.cursory < 0) this.cursory = 0;
            this.cursorx = 0;
            break;

        case 'G': // change cursor column
            count = numbers.length ? numbers[0] : 1;
            this.cursorx = count;
            if (this.cursorx) this.cursorx--;
            break;

        case 'H': // cursor position
        case 'd':
        case 'f':
            this.ChangeCursor(numbers);
            break;

        case 'K': // erase
            count = numbers.length ? numbers[0] : 1;
            if (!numbers.length) {
                this.DeleteArea(this.cursory, this.cursorx, this.cursory, this.ncolumns - 1);
            } else if (numbers[0] == 1) {
                this.DeleteArea(this.cursory, 0., this.cursory, this.cursorx);
            } else if (numbers[0] == 2) {
                this.DeleteRow(this.cursory);
            }
            break;

        case 'L': // scroll down
            count = numbers.length ? numbers[0] : 1;
            if (count === 0) count = 1;
            top = this.scrolltop;
            this.scrolltop = this.cursory;
            if (count === 1) {
                this.ScrollDown(true);
            } else {
                for (j = 0; j < count - 1; j++) {
                    this.ScrollDown(false);
                }
                this.ScrollDown(true);
            }
            this.scrolltop = top;
            break;

        case 'M': // scroll up
            count = numbers.length ? numbers[0] : 1;
            if (count === 0) count = 1;
            top = this.scrolltop;
            this.scrolltop = this.cursory;
            if (count === 1) {
                this.ScrollUp(true);
            } else {
                for (j = 0; j < count - 1; j++) {
                    this.ScrollUp(false);
                }
                this.ScrollUp(true);
            }
            this.scrolltop = top;
            break;

        case 'P': /* shift left from cursor and fill with zero */
            count = numbers.length ? numbers[0] : 1;
            if (count === 0) count = 1;
            let n = 0;
            for (j = this.cursorx + count; j < this.ncolumns; j++) {
                this.screen[this.cursory][this.cursorx + n] = this.screen[this.cursory][j];
                this.color[this.cursory][this.cursorx + n] = this.color[this.cursory][j];
                n++;
            }
            this.DeleteArea(this.cursory, this.ncolumns - count, this.cursory, this.ncolumns - 1);
            this.PrepareUpdateRow(this.cursory);
            break;

        case 'r': // set scrolling region
            if (numbers.length === 0) {
                this.scrolltop = 0;
                this.scrollbottom = this.nrows - 1;
            } else {
                this.scrolltop = numbers[0];
                this.scrollbottom = numbers[1];
                if (this.scrolltop) this.scrolltop--;
                if (this.scrollbottom) this.scrollbottom--;
            }
            return;

        case 'X': // erase only number of characters in current line    
            count = numbers.length ? numbers[0] : 1;
            if (count === 0) count = 1;
            for (j = 0; j < count; j++) {
                this.screen[this.cursory][this.cursorx + j] = 0x20;
                this.color[this.cursory][this.cursorx + j] = this.GetColor();
            }
            this.PrepareUpdateRow(this.cursory);
            break;

        default:
            message.Warning("Escape sequence unknown:'" + this.escapestring + "'");
            break;
    }

    if (this.cursorvisible) {
        this.PrepareUpdateRow(this.cursory);
        if (this.cursory !== oldcursory) {
            this.PrepareUpdateRow(oldcursory);
        }
    }
};


Terminal.prototype.PutChar = function (c) {
    //message.Debug("Char:" + c + " " +  String.fromCharCode(c));
    // escape sequence (CS)
    if (this.escapetype === 2) {
        this.escapestring += String.fromCharCode(c);
        if ((c >= 64) && (c <= 126)) {
            this.HandleEscapeSequence();
            this.escapetype = 0;
        }
        return;
    }

    // escape sequence
    if ((this.escapetype === 0) && (c === 0x1B)) {
        this.escapetype = 1;
        this.escapestring = "";
        return;
    }

    // starting escape sequence
    if (this.escapetype === 1) {
        this.escapestring += String.fromCharCode(c);
        // Control Sequence Introducer ([)
        if (c === 0x5B) {
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
            this.OnCharReceived("\n");
            return;
        case 0xD:
            // carriage return
            this.cursorx = 0;
            this.PrepareUpdateRow(this.cursory);
            return;
        case 0x7:
            // beep
            return;
        case 0x8:
            // back space
            this.cursorx--;
            if (this.cursorx < 0) {
                this.cursorx = 0;
            }
            this.PrepareUpdateRow(this.cursory);
            return;
        case 0x9:
            // horizontal tab
            let spaces = 8 - (this.cursorx & 7);
            do {
                if (this.cursorx >= this.ncolumns) {
                    this.PrepareUpdateRow(this.cursory);
                    this.LineFeed();
                    this.cursorx = 0;
                }
                this.screen[this.cursory][this.cursorx] = 0x20;
                this.color[this.cursory][this.cursorx] = this.attr_color;
                this.cursorx++;
            } while (spaces--);
            this.PrepareUpdateRow(this.cursory);
            return;

        case 0x00:
        case 0x01:
        case 0x02:
        case 0x03:
        case 0x04:
        case 0x05:
        case 0x06:
        case 0x0B:
        case 0x0C:
        case 0x0E:
        case 0x0F:
        case 0x10:
        case 0x11:
        case 0x12:
        case 0x13:
        case 0x14:
        case 0x15:
        case 0x16:
        case 0x17:
        case 0x18:
        case 0x19:
        case 0x1A:
        case 0x1B:
        case 0x1C:
        case 0x1D:
        case 0x1E:
        case 0x1F:
        case 0x7F:
            message.Warning("unknown character " + c);
            return;
    }

    if (this.cursorx >= this.ncolumns) {
        this.LineFeed();
        this.cursorx = 0;
    }

    c = this.utf8converter.Put(c);
    if (c === -1) return;
    let cx = this.cursorx;
    let cy = this.cursory;
    this.screen[cy][cx] = c;

    this.color[cy][cx] = this.GetColor();
    this.cursorx++;
    //message.Debug("Write: " + String.fromCharCode(c));
    this.PrepareUpdateRow(cy);

    this.OnCharReceived(String.fromCharCode(c));
};

module.exports = Terminal;
