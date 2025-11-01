// -------------------------------------------------
// --------------- Terminal Emulator ---------------
// -------------------------------------------------
// http://lxr.free-electrons.com/source/drivers/tty/vt/vt.c

"use strict";

import * as UTF8 from '../../lib/utf8.js';
import message from '../messagehandler.js';

const Colors: string[] = ["#000000", "#BB0000", "#00BB00", "#BBBB00",
    "#0000BB", "#BB00BB", "#00BBBB", "#BBBBBB",
    // brighter colors
    "#555555", "#FF5555", "#55FF55", "#FFFF55",
    "#5555FF", "#FF55FF", "#55FFFF", "#FFFFFF",
    // dimmed colors
    "#000000", "#770000", "#007700", "#777700",
    "#000077", "#770077", "#007777", "#777777"];

// Terminal device class
class Terminal {
    nrows: number;
    ncolumns: number;
    canvas?: HTMLCanvasElement;
    context?: CanvasRenderingContext2D;
    Table?: HTMLElement;
    rowelements?: HTMLTableCellElement[];
    
    cursorvisible: boolean;
    escapetype: number;
    escapestring: string;
    cursorx: number;
    cursory: number;
    scrolltop: number;
    cursortype: number;
    scrollbottom: number;
    
    attr_color: number;
    attr_reverse: boolean;
    attr_italic: boolean;
    attr_intensity: number;
    
    pauseblink: boolean;
    OnCharReceived: (char: string) => void;
    
    framerequested: boolean;
    timeout: number;
    
    updaterow: Uint8Array;
    utf8converter: UTF8.UTF8StreamToUnicode;
    
    screen: Uint16Array[];
    color: Uint16Array[];

    constructor(nrows: number, ncolumns: number, elemId: string) {
        this.nrows = nrows;
        this.ncolumns = ncolumns;

        const ele = document.getElementById(elemId);
        if (!ele) {
            throw new Error(`Terminal element with id '${elemId}' not found`);
        }

        if (ele.tagName === "CANVAS") {
            this.canvas = ele as HTMLCanvasElement;
            const ctx = this.canvas.getContext("2d");
            if (!ctx) {
                throw new Error("Failed to get 2D context from canvas");
            }
            this.context = ctx;
            this.context.font = "13px courier,fixed,swiss,monospace,sans-serif";
        } else {
            this.Table = ele;
            this.rowelements = new Array(this.nrows);
            for (let i = 0; i < nrows; i++) {
                const TR = (this.Table as HTMLTableElement).insertRow(0);
                const TD = document.createElement("td");
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
        for (let i = 0; i < this.nrows; i++) {
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
    PauseBlink(pause: boolean): void {
        pause = !!pause;
        this.pauseblink = pause;
        if (this.cursortype) {
            this.cursorvisible = !pause;
        }
        this.PrepareUpdateRow(this.cursory, this.cursorx);
    }

    GetColor(): number {
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

    Blink(): void {
        this.cursorvisible = !this.cursorvisible;
        if (!this.pauseblink) this.PrepareUpdateRow(this.cursory, this.cursorx);
        window.setTimeout(this.Blink.bind(this), 500); // update every half second
    }

    DeleteRow(row: number): void {
        for (let j = 0; j < this.ncolumns; j++) {
            this.screen[row][j] = 0x20;
            this.color[row][j] = this.attr_color;
        }
        this.PrepareUpdateRow(row);
    }

    DeleteArea(row: number, column: number, row2: number, column2: number): void {
        for (let i = row; i <= row2; i++) {
            for (let j = column; j <= column2; j++) {
                this.screen[i][j] = 0x20;
                this.color[i][j] = this.attr_color;
            }
            this.PrepareUpdateRow(i);
        }
    }

    UpdateRowCanvas(row: number): void {
        let i: number;
        let x: number;
        let column: number;
        const y = row << 4;
        const line = this.screen[row];
        let c = this.color[row][0] | 0;
        let n = 0;

        if (!this.context) return;

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
    }

    GetSpan(c: number, line: Uint16Array, idx: number, n: number): string {
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

    UpdateRowTable(row: number): void {
        let column: number;
        const line = this.screen[row];
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
        if (this.rowelements) {
            this.rowelements[this.nrows - row - 1].innerHTML = html;
        }
    }

    UpdateScreen(): void {
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

    PrepareUpdateRow(row: number, _column?: number): void {
        this.updaterow[row] = 1;
        if (this.framerequested) return;
        window.setTimeout(this.UpdateScreen.bind(this), this.timeout);
        this.framerequested = true;
    }

    ScrollDown(draw: boolean): void {
        const tempscreen = this.screen[this.scrollbottom];
        const tempcolor = this.color[this.scrollbottom];

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

    ScrollUp(draw: boolean): void {
        const tempscreen = this.screen[this.scrolltop];
        const tempcolor = this.color[this.scrolltop];

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
    }

    LineFeed(): void {
        if (this.cursory !== this.scrollbottom) {
            this.cursory++;
            if (this.cursorvisible) {
                this.PrepareUpdateRow(this.cursory - 1); // delete old cursor position
                this.PrepareUpdateRow(this.cursory); // show new cursor position
            }
            return;
        }
        this.ScrollUp(true);
    }

    ChangeCursor(Numbers: number[]): void {
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
    }

    ChangeColor(Numbers: number[]): void {

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
    }

    ChangeMode(numbers: number[], _question: boolean, onoff: boolean): void {

        for (let i = 0; i < numbers.length; i++) {
            switch (numbers[i]) {
                case 4: // insert mode
                    break;

                case 7: // auto wrap on off
                    break;

                case 25: // cursor on/off
                    this.cursortype = onoff ? 1 : 0;
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

    ChangeCursorType(numbers: number[], question: boolean): void {
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

    HandleEscapeSequence(): void {
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

        const lastsign = s.substr(s.length - 1); // extract command
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
        const numberArray: number[] = [];
        for (i = 0; i < numbers.length; i++) {
            numberArray[i] = Number(numbers[i]);
        }

        const oldcursory = this.cursory; // save current cursor position
        let count = 0;
        switch (lastsign) {

            case 'l':
                this.ChangeMode(numberArray, question, true);
                return;

            case 'h':
                this.ChangeMode(numberArray, question, false);
                return;

            case 'c':
                this.ChangeCursorType(numberArray, question);
                return;
        }

        if (question) {
            message.Warning("Escape sequence unknown:'" + this.escapestring + "'");
            return;
        }

        let j: number;
        let top = 0;
        switch (lastsign) {
            case 'm': // colors
                this.ChangeColor(numberArray);
                return;

            case 'A': // move cursor up
                count = numberArray.length ? numberArray[0] : 1;
                if (count === 0) count = 1;
                this.cursory -= count;
                break;

            case 'B': // move cursor down
                count = numberArray.length ? numberArray[0] : 1;
                if (count === 0) count = 1;
                this.cursory += count;
                break;

            case 'C': // move cursor right
                count = numberArray.length ? numberArray[0] : 1;
                if (count === 0) count = 1;
                this.cursorx += count;
                break;

            case 'D': // move cursor left
                count = numberArray.length ? numberArray[0] : 1;
                if (count === 0) count = 1;
                this.cursorx -= count;
                if (this.cursorx < 0) this.cursorx = 0;
                break;

            case 'E': // move cursor down
                count = numberArray.length ? numberArray[0] : 1;
                this.cursory += count;
                this.cursorx = 0;
                break;

            case 'F': // move cursor up
                count = numberArray.length ? numberArray[0] : 1;
                this.cursory -= count;
                if (this.cursory < 0) this.cursory = 0;
                this.cursorx = 0;
                break;

            case 'G': // change cursor column
                count = numberArray.length ? numberArray[0] : 1;
                this.cursorx = count;
                if (this.cursorx) this.cursorx--;
                break;

            case 'H': // cursor position
            case 'd':
            case 'f':
                this.ChangeCursor(numberArray);
                break;

            case 'K': // erase
                count = numberArray.length ? numberArray[0] : 1;
                if (!numberArray.length) {
                    this.DeleteArea(this.cursory, this.cursorx, this.cursory, this.ncolumns - 1);
                } else if (numberArray[0] == 1) {
                    this.DeleteArea(this.cursory, 0., this.cursory, this.cursorx);
                } else if (numberArray[0] == 2) {
                    this.DeleteRow(this.cursory);
                }
                break;

            case 'L': // scroll down
                count = numberArray.length ? numberArray[0] : 1;
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
                count = numberArray.length ? numberArray[0] : 1;
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
                count = numberArray.length ? numberArray[0] : 1;
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
                if (numberArray.length === 0) {
                    this.scrolltop = 0;
                    this.scrollbottom = this.nrows - 1;
                } else {
                    this.scrolltop = numberArray[0];
                    this.scrollbottom = numberArray[1];
                    if (this.scrolltop) this.scrolltop--;
                    if (this.scrollbottom) this.scrollbottom--;
                }
                return;

            case 'X': // erase only number of characters in current line    
                count = numberArray.length ? numberArray[0] : 1;
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
    }

    PutChar(c: number): void {
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

        const charCode = this.utf8converter.Put(c);
        if (charCode === -1) return;
        const cx = this.cursorx;
        const cy = this.cursory;
        this.screen[cy][cx] = charCode;

        this.color[cy][cx] = this.GetColor();
        this.cursorx++;
        //message.Debug("Write: " + String.fromCharCode(c));
        this.PrepareUpdateRow(cy);

        this.OnCharReceived(String.fromCharCode(charCode));
    }
}

export default Terminal;
