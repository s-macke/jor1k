// -------------------------------------------------
// ------------------ UTF8 Helpers -----------------
// -------------------------------------------------
// http://en.wikipedia.org/wiki/UTF-8
"use strict";

function UTF8StreamToUnicode() {

    this.stream = new Uint8Array(5);
    this.ofs = 0;

    this.Put = function(key) {
        this.stream[this.ofs] = key;
        this.ofs++;
        switch(this.ofs) {
            case 1:
                if (this.stream[0] < 0x80) {
                    this.ofs = 0;
                    return this.stream[0];
                }
                break;

            case 2:
                if ((this.stream[0]&0xE0) == 0xC0)
                if ((this.stream[1]&0xC0) == 0x80) {
                    this.ofs = 0;
                    return ((this.stream[0]&0x1F)<<6) | 
                        ((this.stream[1]&0x3F)<<0);
                }
                break;

            case 3:
                if ((this.stream[0]&0xF0) == 0xE0)
                if ((this.stream[1]&0xC0) == 0x80)
                if ((this.stream[2]&0xC0) == 0x80) {
                    this.ofs = 0;
                    return ((this.stream[0]&0xF ) << 12) | 
                        ((this.stream[1]&0x3F) << 6)  | 
                        ((this.stream[2]&0x3F) << 0);
                }
                break;

            case 4:
                if ((this.stream[0]&0xF8) == 0xF0)
                if ((this.stream[1]&0xC0) == 0x80)
                if ((this.stream[2]&0xC0) == 0x80)
                if ((this.stream[3]&0xC0) == 0x80) {
                    this.ofs = 0;
                    return ((this.stream[0]&0x7 ) << 18) | 
                        ((this.stream[1]&0x3F) << 12) | 
                        ((this.stream[2]&0x3F) << 6)  |
                        ((this.stream[3]&0x3F) << 0);
                }
                this.ofs = 0;
                return -1; //obviously illegal character, so reset
                break;

            default:
                this.ofs = 0;
                return -1;
                break;
        }
        return -1;
    }

}

function UnicodeToUTF8Stream(key) {
    key = key|0;
    if (key < 0x80) {
        return [key];
    } else 
    if (key <= 0x7FF) {
        return [
            (key >> 6) | 0xC0, 
            (key & 0x3F) | 0x80
            ];
    } else 
    if (key <= 0xFFFF) {
        return [
            (key >> 12) | 0xE0,
            ((key >> 6) & 0x3F) | 0x80,
            (key & 0x3F) | 0x80
            ];
    } else 
    if (key <= 0x10FFFF) {
        return [
            (key >> 18) | 0xF0,
            ((key >> 12) & 0x3F) | 0x80,
            ((key >> 6) & 0x3F) | 0x80,
            (key & 0x3F) | 0x80
            ];
    } else {
        //message.Debug("Error in utf-8 encoding: Invalid key");
    }
    return [];
}

function UTF8Length(s)
{
    var length = 0;
    for(var i=0; i<s.length; i++) {
        var key = s.charCodeAt(i);
        if (key < 0x80) {
            length += 1;
        } else
        if (key <= 0x7FF) {
            length += 2;
        } else 
        if (key <= 0xFFFF) {
            length += 3;
        } else 
        if (key <= 0x10FFFF) {
            length += 4;
        } else {
        }
    }
    return length;
}

module.exports.UTF8StreamToUnicode = UTF8StreamToUnicode;
module.exports.UTF8Length = UTF8Length;
module.exports.UnicodeToUTF8Stream = UnicodeToUTF8Stream;
