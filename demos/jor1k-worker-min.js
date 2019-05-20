(function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
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

},{}],2:[function(require,module,exports){
/* 
  bzip2.js - a small bzip2 decompression implementation
  
  Copyright 2011 by antimatter15 (antimatter15@gmail.com)
  
  Based on micro-bunzip by Rob Landley (rob@landley.net).

  Copyright (c) 2011 by antimatter15 (antimatter15@gmail.com).

  Permission is hereby granted, free of charge, to any person obtaining a
  copy of this software and associated documentation files (the "Software"),
  to deal in the Software without restriction, including without limitation
  the rights to use, copy, modify, merge, publish, distribute, sublicense,
  and/or sell copies of the Software, and to permit persons to whom the
  Software is furnished to do so, subject to the following conditions:
  
  The above copyright notice and this permission notice shall be included
  in all copies or substantial portions of the Software.
  
  THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
  EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
  MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
  IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
  DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
  TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH
  THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
*/

var message = require('./messagehandler');

var bzip2 = {};

bzip2.crcTable = 
[
   0x00000000, 0x04c11db7, 0x09823b6e, 0x0d4326d9,
   0x130476dc, 0x17c56b6b, 0x1a864db2, 0x1e475005,
   0x2608edb8, 0x22c9f00f, 0x2f8ad6d6, 0x2b4bcb61,
   0x350c9b64, 0x31cd86d3, 0x3c8ea00a, 0x384fbdbd,
   0x4c11db70, 0x48d0c6c7, 0x4593e01e, 0x4152fda9,
   0x5f15adac, 0x5bd4b01b, 0x569796c2, 0x52568b75,
   0x6a1936c8, 0x6ed82b7f, 0x639b0da6, 0x675a1011,
   0x791d4014, 0x7ddc5da3, 0x709f7b7a, 0x745e66cd,
   0x9823b6e0, 0x9ce2ab57, 0x91a18d8e, 0x95609039,
   0x8b27c03c, 0x8fe6dd8b, 0x82a5fb52, 0x8664e6e5,
   0xbe2b5b58, 0xbaea46ef, 0xb7a96036, 0xb3687d81,
   0xad2f2d84, 0xa9ee3033, 0xa4ad16ea, 0xa06c0b5d,
   0xd4326d90, 0xd0f37027, 0xddb056fe, 0xd9714b49,
   0xc7361b4c, 0xc3f706fb, 0xceb42022, 0xca753d95,
   0xf23a8028, 0xf6fb9d9f, 0xfbb8bb46, 0xff79a6f1,
   0xe13ef6f4, 0xe5ffeb43, 0xe8bccd9a, 0xec7dd02d,
   0x34867077, 0x30476dc0, 0x3d044b19, 0x39c556ae,
   0x278206ab, 0x23431b1c, 0x2e003dc5, 0x2ac12072,
   0x128e9dcf, 0x164f8078, 0x1b0ca6a1, 0x1fcdbb16,
   0x018aeb13, 0x054bf6a4, 0x0808d07d, 0x0cc9cdca,
   0x7897ab07, 0x7c56b6b0, 0x71159069, 0x75d48dde,
   0x6b93dddb, 0x6f52c06c, 0x6211e6b5, 0x66d0fb02,
   0x5e9f46bf, 0x5a5e5b08, 0x571d7dd1, 0x53dc6066,
   0x4d9b3063, 0x495a2dd4, 0x44190b0d, 0x40d816ba,
   0xaca5c697, 0xa864db20, 0xa527fdf9, 0xa1e6e04e,
   0xbfa1b04b, 0xbb60adfc, 0xb6238b25, 0xb2e29692,
   0x8aad2b2f, 0x8e6c3698, 0x832f1041, 0x87ee0df6,
   0x99a95df3, 0x9d684044, 0x902b669d, 0x94ea7b2a,
   0xe0b41de7, 0xe4750050, 0xe9362689, 0xedf73b3e,
   0xf3b06b3b, 0xf771768c, 0xfa325055, 0xfef34de2,
   0xc6bcf05f, 0xc27dede8, 0xcf3ecb31, 0xcbffd686,
   0xd5b88683, 0xd1799b34, 0xdc3abded, 0xd8fba05a,
   0x690ce0ee, 0x6dcdfd59, 0x608edb80, 0x644fc637,
   0x7a089632, 0x7ec98b85, 0x738aad5c, 0x774bb0eb,
   0x4f040d56, 0x4bc510e1, 0x46863638, 0x42472b8f,
   0x5c007b8a, 0x58c1663d, 0x558240e4, 0x51435d53,
   0x251d3b9e, 0x21dc2629, 0x2c9f00f0, 0x285e1d47,
   0x36194d42, 0x32d850f5, 0x3f9b762c, 0x3b5a6b9b,
   0x0315d626, 0x07d4cb91, 0x0a97ed48, 0x0e56f0ff,
   0x1011a0fa, 0x14d0bd4d, 0x19939b94, 0x1d528623,
   0xf12f560e, 0xf5ee4bb9, 0xf8ad6d60, 0xfc6c70d7,
   0xe22b20d2, 0xe6ea3d65, 0xeba91bbc, 0xef68060b,
   0xd727bbb6, 0xd3e6a601, 0xdea580d8, 0xda649d6f,
   0xc423cd6a, 0xc0e2d0dd, 0xcda1f604, 0xc960ebb3,
   0xbd3e8d7e, 0xb9ff90c9, 0xb4bcb610, 0xb07daba7,
   0xae3afba2, 0xaafbe615, 0xa7b8c0cc, 0xa379dd7b,
   0x9b3660c6, 0x9ff77d71, 0x92b45ba8, 0x9675461f,
   0x8832161a, 0x8cf30bad, 0x81b02d74, 0x857130c3,
   0x5d8a9099, 0x594b8d2e, 0x5408abf7, 0x50c9b640,
   0x4e8ee645, 0x4a4ffbf2, 0x470cdd2b, 0x43cdc09c,
   0x7b827d21, 0x7f436096, 0x7200464f, 0x76c15bf8,
   0x68860bfd, 0x6c47164a, 0x61043093, 0x65c52d24,
   0x119b4be9, 0x155a565e, 0x18197087, 0x1cd86d30,
   0x029f3d35, 0x065e2082, 0x0b1d065b, 0x0fdc1bec,
   0x3793a651, 0x3352bbe6, 0x3e119d3f, 0x3ad08088,
   0x2497d08d, 0x2056cd3a, 0x2d15ebe3, 0x29d4f654,
   0xc5a92679, 0xc1683bce, 0xcc2b1d17, 0xc8ea00a0,
   0xd6ad50a5, 0xd26c4d12, 0xdf2f6bcb, 0xdbee767c,
   0xe3a1cbc1, 0xe760d676, 0xea23f0af, 0xeee2ed18,
   0xf0a5bd1d, 0xf464a0aa, 0xf9278673, 0xfde69bc4,
   0x89b8fd09, 0x8d79e0be, 0x803ac667, 0x84fbdbd0,
   0x9abc8bd5, 0x9e7d9662, 0x933eb0bb, 0x97ffad0c,
   0xafb010b1, 0xab710d06, 0xa6322bdf, 0xa2f33668,
   0xbcb4666d, 0xb8757bda, 0xb5365d03, 0xb1f740b4
];

bzip2.array = function(bytes) {
    var bit = 0, byte = 0;
    var BITMASK = [0, 0x01, 0x03, 0x07, 0x0F, 0x1F, 0x3F, 0x7F, 0xFF ];
    return function(n) {
        var result = 0;
        while(n > 0) {
            var left = 8 - bit;
            if (n >= left) {
                result <<= left;
                result |= (BITMASK[left] & bytes[byte++]);
                bit = 0;
                n -= left;
            } else {
                result <<= n;
                result |= ((bytes[byte] & (BITMASK[n] << (8 - n - bit))) >> (8 - n - bit));
                bit += n;
                n = 0;
            }
        }
        return result;
    }
}

bzip2.IsBZIP2 = function(buffer) {
    if ((buffer[0] == 0x42) && (buffer[1] == 0x5A) && (buffer[2] == 0x68)) return true;
    return false;
}

    
bzip2.simple = function(srcbuffer, stream) {
    var bits = bzip2.array(srcbuffer);
    var size = bzip2.header(bits);
    var ret = false;
    var bufsize = 100000 * size;
    var buf = new Int32Array(bufsize);
    
    this.byteCount = new Int32Array(256);
    this.symToByte = new Uint8Array(256);
    this.mtfSymbol = new Int32Array(256);
    this.selectors = new Uint8Array(0x8000);
    
    do {
        ret = bzip2.decompress(bits, stream, buf, bufsize);        
    } while(!ret);
}

bzip2.header = function(bits) {
    if (bits(8*3) != 4348520) message.Error("No magic number found");
    var i = bits(8) - 48;
    if (i < 1 || i > 9) message.Error("Not a BZIP archive");
    return i;
};


//takes a function for reading the block data (starting with 0x314159265359)
//a block size (0-9) (optional, defaults to 9)
//a length at which to stop decompressing and return the output
bzip2.decompress = function(bits, stream, buf, bufsize) {
    var MAX_HUFCODE_BITS = 20;
    var MAX_SYMBOLS = 258;
    var SYMBOL_RUNA = 0;
    var SYMBOL_RUNB = 1;
    var GROUP_SIZE = 50;
    var crc = 0 ^ (-1);
    
    for(var h = '', i = 0; i < 6; i++) h += bits(8).toString(16);
    if (h == "177245385090") return true; //last block
    if (h != "314159265359") message.Error("eek not valid bzip data");
    var crcblock = bits(32)|0; // CRC code
    if (bits(1)) message.Error("unsupported obsolete version");
    var origPtr = bits(24);
    if (origPtr > bufsize) message.Error("Initial position larger than buffer size");
    var t = bits(16);
    var symTotal = 0;
    for (i = 0; i < 16; i++) {
        if (t & (1 << (15 - i))) {
            var k = bits(16);
            for(j = 0; j < 16; j++) {
                if (k & (1 << (15 - j))) {
                    this.symToByte[symTotal++] = (16 * i) + j;
                }
            }
        }
    }

    var groupCount = bits(3);
    if (groupCount < 2 || groupCount > 6) message.Error("another error");
    var nSelectors = bits(15);
    if (nSelectors == 0) message.Error("meh");
    for(var i = 0; i < groupCount; i++) this.mtfSymbol[i] = i;

    for(var i = 0; i < nSelectors; i++) {
        for(var j = 0; bits(1); j++) if (j >= groupCount) message.Error("whoops another error");
        var uc = this.mtfSymbol[j];
        for(var k = j-1; k>=0; k--) {
            this.mtfSymbol[k+1] = this.mtfSymbol[k];
        }
        this.mtfSymbol[0] = uc;
        this.selectors[i] = uc;
    }

    var symCount = symTotal + 2;
    var groups = [];
    var length = new Uint8Array(MAX_SYMBOLS),
    temp = new Uint8Array(MAX_HUFCODE_BITS+1);

    var hufGroup;

    for(var j = 0; j < groupCount; j++) {
        t = bits(5); //lengths
        for(var i = 0; i < symCount; i++) {
            while(true){
                if (t < 1 || t > MAX_HUFCODE_BITS) message.Error("I gave up a while ago on writing error messages");
                if (!bits(1)) break;
                if (!bits(1)) t++;
                else t--;
            }
            length[i] = t;
        }
        var  minLen,  maxLen;
        minLen = maxLen = length[0];
        for(var i = 1; i < symCount; i++) {
            if (length[i] > maxLen) maxLen = length[i];
            else if (length[i] < minLen) minLen = length[i];
        }
        hufGroup = groups[j] = {};
        hufGroup.permute = new Int32Array(MAX_SYMBOLS);
        hufGroup.limit = new Int32Array(MAX_HUFCODE_BITS + 1);
        hufGroup.base = new Int32Array(MAX_HUFCODE_BITS + 1);

        hufGroup.minLen = minLen;
        hufGroup.maxLen = maxLen;
        var base = hufGroup.base.subarray(1);
        var limit = hufGroup.limit.subarray(1);
        var pp = 0;
        for(var i = minLen; i <= maxLen; i++)
        for(var t = 0; t < symCount; t++)
        if (length[t] == i) hufGroup.permute[pp++] = t;
        for(i = minLen; i <= maxLen; i++) temp[i] = limit[i] = 0;
        for(i = 0; i < symCount; i++) temp[length[i]]++;
        pp = t = 0;
        for(i = minLen; i < maxLen; i++) {
            pp += temp[i];
            limit[i] = pp - 1;
            pp <<= 1;
            base[i+1] = pp - (t += temp[i]);
        }
        limit[maxLen] = pp + temp[maxLen] - 1;
        base[minLen] = 0;
    }

    for(var i = 0; i < 256; i++) { 
        this.mtfSymbol[i] = i;
        this.byteCount[i] = 0;
    }
    var runPos, count, symCount, selector;
    runPos = count = symCount = selector = 0;    
    while(true) {
        if (!(symCount--)) {
            symCount = GROUP_SIZE - 1;
            if (selector >= nSelectors) message.Error("meow i'm a kitty, that's an error");
            hufGroup = groups[this.selectors[selector++]];
            base = hufGroup.base.subarray(1);
            limit = hufGroup.limit.subarray(1);
        }
        i = hufGroup.minLen;
        j = bits(i);
        while(true) {
            if (i > hufGroup.maxLen) message.Error("rawr i'm a dinosaur");
            if (j <= limit[i]) break;
            i++;
            j = (j << 1) | bits(1);
        }
        j -= base[i];
        if (j < 0 || j >= MAX_SYMBOLS) message.Error("moo i'm a cow");
        var nextSym = hufGroup.permute[j];
        if (nextSym == SYMBOL_RUNA || nextSym == SYMBOL_RUNB) {
            if (!runPos){
                runPos = 1;
                t = 0;
            }
            if (nextSym == SYMBOL_RUNA) t += runPos;
            else t += 2 * runPos;
            runPos <<= 1;
            continue;
        }
        if (runPos) {
            runPos = 0;
            if (count + t >= bufsize) message.Error("Boom.");
            uc = this.symToByte[this.mtfSymbol[0]];
            this.byteCount[uc] += t;
            while(t--) buf[count++] = uc;
        }
        if (nextSym > symTotal) break;
        if (count >= bufsize) message.Error("I can't think of anything. Error");
        i = nextSym - 1;
        uc = this.mtfSymbol[i];
        for(var k = i-1; k>=0; k--) {
            this.mtfSymbol[k+1] = this.mtfSymbol[k];
        }
        this.mtfSymbol[0] = uc
        uc = this.symToByte[uc];
        this.byteCount[uc]++;
        buf[count++] = uc;
    }
    if (origPtr < 0 || origPtr >= count) message.Error("I'm a monkey and I'm throwing something at someone, namely you");
    var j = 0;
    for(var i = 0; i < 256; i++) {
        k = j + this.byteCount[i];
        this.byteCount[i] = j;
        j = k;
    }
    for(var i = 0; i < count; i++) {
        uc = buf[i] & 0xff;
        buf[this.byteCount[uc]] |= (i << 8);
        this.byteCount[uc]++;
    }
    var pos = 0, current = 0, run = 0;
    if (count) {
        pos = buf[origPtr];
        current = (pos & 0xff);
        pos >>= 8;
        run = -1;
    }
    count = count;
    var copies, previous, outbyte;
    while(count) {
        count--;
        previous = current;
        pos = buf[pos];
        current = pos & 0xff;
        pos >>= 8;
        if (run++ == 3) {
            copies = current;
            outbyte = previous;
            current = -1;
        } else {
            copies = 1;
            outbyte = current;
        }
        while(copies--) {
            crc = ((crc << 8) ^ this.crcTable[((crc>>24) ^ outbyte) & 0xFF])&0xFFFFFFFF; // crc32
            stream(outbyte);
        }
        if (current != previous) run = 0;
    }

    crc = (crc ^ (-1)) >>> 0;
    if ((crc|0) != (crcblock|0)) message.Error("Error in bzip2: crc32 do not match");
    return false;
}

module.exports = bzip2;

},{"./messagehandler":33}],3:[function(require,module,exports){
// -------------------------------------------------
// --------------------- ATA -----------------------
// -------------------------------------------------

"use strict";

var utils = require('../utils');
var message = require('../messagehandler');

// ata-generic implementation (according to Linux)
// simulation of a hard disk loaded on demand from the webserver in small chunks.
// specification
// ftp://ftp.seagate.com/pub/acrobat/reference/111-1c.pdf

/* use this dts lines
 ata@9e000000  {
                compatible = "ata-generic";
                reg = <0x9e000000 0x100
                       0x9e000100 0xf00>;
                pio-mode = <4>;
                reg-shift = <2>;
                interrupts = <15>;
        };
*/

// ATA command block registers
// 2 is the reg_shift
var ATA_REG_DATA            = 0x00<<2; // data register
var ATA_REG_ERR             = 0x01<<2; // error register, feature register
var ATA_REG_NSECT           = 0x02<<2; // sector count register
var ATA_REG_LBAL            = 0x03<<2; // sector number register
var ATA_REG_LBAM            = 0x04<<2; // cylinder low register
var ATA_REG_LBAH            = 0x05<<2; // cylinder high register
var ATA_REG_DEVICE          = 0x06<<2; // drive/head register
var ATA_REG_STATUS          = 0x07<<2; // status register // command register

var ATA_REG_FEATURE         = ATA_REG_ERR; // and their aliases (writing)
var ATA_REG_CMD             = ATA_REG_STATUS;
var ATA_REG_BYTEL           = ATA_REG_LBAM;
var ATA_REG_BYTEH           = ATA_REG_LBAH;
var ATA_REG_DEVSEL          = ATA_REG_DEVICE;
var ATA_REG_IRQ             = ATA_REG_NSECT;

// device control register
var ATA_DCR_RST = 0x04;	// Software reset   (RST=1, reset)
var ATA_DCR_IEN = 0x02;	// Interrupt Enable (IEN=0, enabled)

// ----- ATA (Alternate) Status Register
var ATA_SR_BSY  = 0x80;  // Busy
var ATA_SR_DRDY = 0x40;  // Device Ready
var ATA_SR_DF   = 0x20;  // Device Fault
var ATA_SR_DSC  = 0x10;  // Device Seek Complete
var ATA_SR_DRQ  = 0x08;  // Data Request
var ATA_SR_COR  = 0x04;  // Corrected data (obsolete)
var ATA_SR_IDX  = 0x02;  //                (obsolete)
var ATA_SR_ERR  = 0x01;  // Error

// constructor
function ATADev(intdev) {
    this.intdev = intdev;
    var buffer = new ArrayBuffer(512);
    this.identifybuffer = new Uint16Array(buffer);

    this.Reset();

    var buffer = new ArrayBuffer(64*1024); // 64 kB
    this.SetBuffer(buffer);    
    
}
ATADev.prototype.Reset = function() {
    this.DCR = 0x8; // fourth bis is always set
    this.DR = 0xA0; // some bits are always set to one
    this.SCR = 0x1;
    this.SNR = 0x1;
    this.SR = ATA_SR_DRDY; // status register
    this.FR = 0x0; // Feature register
    this.ER = 0x1; // Error register
    this.CR = 0x0; // Command register

//this.error = 0x1;
    this.lcyl = 0x0;
    this.hcyl = 0x0;
    this.select = 0xA0;
    this.driveselected = true; // drive no 0

    this.readbuffer = this.identifybuffer;
    this.readbufferindex = 0;
    this.readbuffermax = 256;
}

ATADev.prototype.SetBuffer = function(buffer) {
    this.diskbuffer = new Uint16Array(buffer);
    this.heads = 16;
    this.sectors = 64;
    this.cylinders = buffer.byteLength/(this.heads*this.sectors*512);
    this.nsectors = this.heads*this.sectors*this.cylinders;
    this.BuildIdentifyBuffer(this.identifybuffer);   
}

ATADev.prototype.BuildIdentifyBuffer = function(buffer16)
{
    for(var i=0; i<256; i++) {
        buffer16[i] = 0x0000;
    }

    buffer16[0] = 0x0040;
    buffer16[1] = this.cylinders; // cylinders
    buffer16[3] = this.heads; // heads
    buffer16[4] = 512*this.sectors; // Number of unformatted bytes per track (sectors*512)
    buffer16[5] = 512; // Number of unformatted bytes per sector
    buffer16[6] = this.sectors; // sectors per track

    buffer16[20] = 0x0003; // buffer type
    buffer16[21] = 512; // buffer size in 512 bytes increment
    buffer16[22] = 4; // number of ECC bytes available

    buffer16[27] = 0x6A6F; // jo (model string)
    buffer16[28] = 0x7231; // r1
    buffer16[29] = 0x6B2D; // k-
    buffer16[30] = 0x6469; // di
    buffer16[31] = 0x736B; // sk
    for(var i=32; i<=46; i++) {
        buffer16[i] = 0x2020; // (model string)
    }
    
    buffer16[47] = 0x8000 | 128;
    buffer16[48] = 0x0000;
    buffer16[49] = 1<<9;
    buffer16[51] = 0x200; // PIO data transfer cycle timing mode
    buffer16[52] = 0x200; // DMA data transfer cycle timing mode

    buffer16[54] = this.cylinders;
    buffer16[55] = this.heads;
    buffer16[56] = this.sectors; // sectors per track

    buffer16[57] = (this.nsectors >> 0)&0xFFFF; // number of sectors
    buffer16[58] = (this.nsectors >>16)&0xFFFF;

    buffer16[59] = 0x0000; // multiple sector settings
    //buffer16[59]  = 0x100 | 128;

    buffer16[60] = (this.nsectors >> 0)&0xFFFF; // Total number of user-addressable sectors low
    buffer16[61] = (this.nsectors >>16)&0xFFFF; // Total number of user-addressable sectors high

    buffer16[80] = (1<<1)|(1<<2); // version, support ATA-1 and ATA-2
    buffer16[82] = (1<<14); // Command sets supported. (NOP supported)
    buffer16[83] = (1<<14); // this bit should be set to one
    buffer16[84] = (1<<14); // this bit should be set to one
    buffer16[85] = (1<<14); // Command set/feature enabled (NOP)
    buffer16[86] = 0; // Command set/feature enabled
    buffer16[87] = (1<<14); // Shall be set to one

}

ATADev.prototype.ReadReg8 = function(addr) {
    if (!this.driveselected) {
        return 0xFF;
    }
    switch(addr)
    {
        case ATA_REG_ERR:
            //message.Debug("ATADev: read error register");
            return this.ER;

        case ATA_REG_NSECT:
            //message.Debug("ATADev: read sector count register");
            return this.SNR;

        case ATA_REG_LBAL:
            //message.Debug("ATADev: read sector number register");
            return this.SCR;

        case ATA_REG_LBAM:
            //message.Debug("ATADev: read cylinder low register");
            return this.lcyl;
        
        case ATA_REG_LBAH:
            //message.Debug("ATADev: read cylinder high register");
            return this.hcyl;

        case ATA_REG_DEVICE:
            //message.Debug("ATADev: read drive/head register");
            return this.DR;

        case ATA_REG_STATUS:
            //message.Debug("ATADev: read status register");			
            this.intdev.ClearInterrupt(15);
            return this.SR;

        case 0x100: // device control register, but read as status register
            //message.Debug("ATADev: read alternate status register")
            return this.SR;
            break;

        default:
            message.Debug("ATADev: Error in ReadRegister8: register " + utils.ToHex(addr) + " not supported");
            message.Abort();
            break;
    }    
    return 0x0;
};

ATADev.prototype.GetSector = function()
{
    if (!(this.DR & 0x40)) {
        message.Debug("ATADev: CHS mode not supported");
        message.Abort();
    }
    return ((this.DR&0x0F) << 24) | (this.hcyl << 16) | (this.lcyl << 8) | this.SCR;
}

ATADev.prototype.SetSector = function(sector)
{
    if (!(this.DR & 0x40)) {
        message.Debug("ATADev: CHS mode not supported");
        message.Abort();
    }
    this.SCR = sector & 0xFF;
    this.lcyl = (sector >> 8) & 0xFF;
    this.hcyl = (sector >> 16) & 0xFF;
    this.DR = (this.DR & 0xF0) | ((sector >> 24) & 0x0F);
}

ATADev.prototype.ExecuteCommand = function()
{
    switch(this.CR)
    {
        case 0xEC: // identify device
            this.readbuffer = this.identifybuffer;
            this.readbufferindex = 0;
            this.readbuffermax = 256;
            this.SR = ATA_SR_DRDY | ATA_SR_DSC | ATA_SR_DRQ;
            if (!(this.DCR & ATA_DCR_IEN)) {
                this.intdev.RaiseInterrupt(15);
            }
            break;

        case 0x91: // initialize drive parameters
            this.SR = ATA_SR_DRDY | ATA_SR_DSC;
            this.ER = 0x0;
            if (!(this.DCR & ATA_DCR_IEN)) {
                this.intdev.RaiseInterrupt(15);
            }
            break;

        case 0x20: // load sector
        case 0x30: // save sector

            var sector = this.GetSector();
            if (this.SNR == 0) {
                this.SNR = 256;
            }
            //message.Debug("ATADev: Load sector " + utils.ToHex(sector) + ". number of sectors " + utils.ToHex(this.SNR));
            this.readbuffer = this.diskbuffer;
            this.readbufferindex = sector*256;
            this.readbuffermax = this.readbufferindex+256;
            this.SR = ATA_SR_DRDY | ATA_SR_DSC | ATA_SR_DRQ;
            this.ER = 0x0;
            if (this.CR == 0x20) {
                if (!(this.DCR & ATA_DCR_IEN)) {
                    this.intdev.RaiseInterrupt(15);
                }
            }
            break;

        case 0xC4: // read multiple sectors
        case 0xC5: // write multiple sectors
            var sector = this.GetSector();
            if (this.SNR == 0) {
                this.SNR = 256;
            }
            //message.Debug("ATADev: Load multiple sector " + utils.ToHex(sector) + ". number of sectors " + utils.ToHex(this.SNR));
            this.readbuffer = this.diskbuffer;
            this.readbufferindex = sector*256;
            this.readbuffermax = this.readbufferindex + 256*this.SNR;
            this.SR = ATA_SR_DRDY | ATA_SR_DSC | ATA_SR_DRQ;
            this.ER = 0x0;
            if (this.CR == 0xC4) {
                if (!(this.DCR & ATA_DCR_IEN)) {
                    this.intdev.RaiseInterrupt(15);
                }
            }

            break;

        default:
            message.Debug("ATADev: Command " + utils.ToHex(this.CR) + " not supported");
            message.Abort();
            break;
    }
}


ATADev.prototype.WriteReg8 = function(addr, x) {
    
    if (addr == ATA_REG_DEVICE) {
        //message.Debug("ATADev: Write drive/head register value: " + utils.ToHex(x));
        this.DR = x;
        //message.Debug("Head " + (x&0xF));
        //message.Debug("Drive No. " + ((x>>4)&1));
        //message.Debug("LBA Mode " + ((x>>6)&1));
        this.driveselected = ((x>>4)&1)?false:true;
        return;
    }

    if (addr == 0x100) { //device control register
        //message.Debug("ATADev: Write CTL register" + " value: " + utils.ToHex(x));

        if (!(x&ATA_DCR_RST) && (this.DCR&ATA_DCR_RST)) { // reset done
            //message.Debug("ATADev: drive reset done");
            this.DR &= 0xF0; // reset head
            this.SR = ATA_SR_DRDY | ATA_SR_DSC;
            this.SCR = 0x1;
            this.SNR = 0x1;
            this.lcyl = 0x0;
            this.hcyl = 0x0;
            this.ER = 0x1;
            this.CR = 0x0;
        } else
        if ((x&ATA_DCR_RST) && !(this.DCR&ATA_DCR_RST)) { // reset
            //message.Debug("ATADev: drive reset");
            this.ER = 0x1; // set diagnostics message
            this.SR = ATA_SR_BSY | ATA_SR_DSC;
        }

        this.DCR = x;
        return;
    }

    if (!this.driveselected) {
        return;
    }

    switch(addr)
    {
        case ATA_REG_FEATURE:
            //message.Debug("ATADev: Write feature register value: " + utils.ToHex(x));
            this.FR = x;
            break;

        case ATA_REG_NSECT:
            //message.Debug("ATADev: Write sector count register value: " + utils.ToHex(x));
            this.SNR = x;
            break;

        case ATA_REG_LBAL:
            //message.Debug("ATADev: Write sector number register value: " + utils.ToHex(x));
            this.SCR = x;
            break;

        case ATA_REG_LBAM:
            //message.Debug("ATADev: Write cylinder low register value: " + utils.ToHex(x));
            this.lcyl = x;
            break;

        case ATA_REG_LBAH:
            //message.Debug("ATADev: Write cylinder high number register value: " + utils.ToHex(x));
            this.hcyl = x;
            break;

        case ATA_REG_CMD:
            //message.Debug("ATADev: Write Command register " + utils.ToHex(x));
            this.CR = x;
            this.ExecuteCommand();
            break;

        default:
            message.Debug("ATADev: Error in WriteRegister8: register " + utils.ToHex(addr) + " not supported (value: " + utils.ToHex(x) + ")");
            message.Abort();    
            break;
    }
};

ATADev.prototype.ReadReg16 = function(addr) {
    if (addr != 0) { // data register
        message.Debug("ATADev: Error in ReadRegister16: register " + utils.ToHex(addr) + " not supported");
        message.Abort();
    }

    var val = utils.Swap16(this.readbuffer[this.readbufferindex]);
    //message.Debug("ATADev: read data register");
    this.readbufferindex++;
    if (this.readbufferindex >= this.readbuffermax) {
        this.SR = ATA_SR_DRDY | ATA_SR_DSC; // maybe no DSC for identify command but it works
        
        if ((this.CR == 0x20) && (this.SNR > 1)) {
            this.SNR--;
            this.SetSector(this.GetSector() + 1);
            this.readbuffermax += 256;
            this.SR = ATA_SR_DRDY | ATA_SR_DSC | ATA_SR_DRQ;
            if (!(this.DCR & ATA_DCR_IEN)) {
                this.intdev.RaiseInterrupt(15);
            }
        }

    }
    return val;
};

ATADev.prototype.WriteReg16 = function(addr, x) {
    if (addr != 0) { // data register
        message.Debug("ATADev: Error in WriteRegister16: register " + utils.ToHex(addr) + " not supported");
        message.Abort();
    }
    this.readbuffer[this.readbufferindex] = utils.Swap16(x);
    //message.Debug("ATADev: write data register");
    this.readbufferindex++;
    if (this.readbufferindex >= this.readbuffermax) {
        this.SR = ATA_SR_DRDY | ATA_SR_DSC;
        if (!(this.DCR & ATA_DCR_IEN)) {
            this.intdev.RaiseInterrupt(15);
        }
        if ((this.CR == 0x30) && (this.SNR > 1)) {
            this.SNR--;
            this.SetSector(this.GetSector() + 1);
            this.readbuffermax += 256;
            this.SR = ATA_SR_DRDY | ATA_SR_DSC | ATA_SR_DRQ;
        }
    }
};

ATADev.prototype.ReadReg32 = function(addr) {
    message.Debug("ATADev: Error in ReadRegister32: register " + utils.ToHex(addr) + " not supported");
    this.mesage.Abort();
};

ATADev.prototype.WriteReg32 = function(addr, x) {
    message.Debug("ATADev: Error in WriteRegister32: register " + utils.ToHex(addr) + " not supported");
    message.Abort()
};


module.exports = ATADev;

},{"../messagehandler":33,"../utils":48}],4:[function(require,module,exports){
// -------------------------------------------------
// --------------------- CLINT ---------------------
// -------------------------------------------------
// CLINT (clock interrupt?) device for RISC-V

// Actually this is mainly a dummy device as the timer
// logic is managed directly by the CPU

"use strict";
var message = require('../messagehandler');
var utils = require('../utils');

/*
 * 0000 msip hart 0
 * 0004 msip hart 1
 * ...
 * 4000 mtimecmp hart 0 lo
 * 4004 mtimecmp hart 0 hi
 * 4008 mtimecmp hart 1 lo
 * 400c mtimecmp hart 1 hi
 * ...
 * bff8 mtime lo
 * bffc mtime hi
 */

var CSR_TIMECMP   = 0xC41;
var CSR_TIME      = 0xC01;

function CLINTDev(csr) {
    this.csr = csr;
    this.Reset();
}

CLINTDev.prototype.Reset = function() {
    // 64-Bit registers
    this.regs = new Uint32Array(0x3000);
}

CLINTDev.prototype.ReadReg32 = function (addr) {
    // no one ever read it
    message.Debug("CLINT: unknown ReadReg32: " + utils.ToHex(addr));
    message.Abort();
    return 0x0;
}


CLINTDev.prototype.WriteReg32 = function (addr, value) {
    addr = addr | 0;
    //message.Debug("CLINT: unknown WriteReg32: " + utils.ToHex(addr) + ": " + utils.ToHex(value));
    this.regs[addr >> 2] = value;
    if (addr == 0x4000) {
        this.csr[CSR_TIMECMP] = value;
        //message.Debug("delta: " + (this.csr[CSR_TIMECMP] - this.csr[CSR_TIME]));
    }
}

module.exports = CLINTDev;

},{"../messagehandler":33,"../utils":48}],5:[function(require,module,exports){
// -------------------------------------------------
// ----------------- Ethernet ----------------------
// -------------------------------------------------
// Emulation of the OpenCores ethmac ethernet controller.

"use strict";

var message = require('../messagehandler');
var utils = require('../utils');

//REGISTER ADDRESSES
var ETHMAC_ADDR_MODER = 0x0;
var ETHMAC_ADDR_INT_SOURCE = 0x4;
var ETHMAC_ADDR_INT_MASK = 0x8;
var ETHMAC_ADDR_IPGT = 0xC;
var ETHMAC_ADDR_IPGR1 = 0x10;
var ETHMAC_ADDR_IPGR2 = 0x14;
var ETHMAC_ADDR_PACKETLEN = 0x18;
var ETHMAC_ADDR_COLLCONF = 0x1C;
var ETHMAC_ADDR_TX_BD_NUM = 0x20;
var ETHMAC_ADDR_CTRLMODER = 0x24;
var ETHMAC_ADDR_MIIMODER = 0x28;
var ETHMAC_ADDR_MIICOMMAND = 0x2C;
var ETHMAC_ADDR_MIIADDRESS = 0x30;
var ETHMAC_ADDR_MIITX_DATA = 0x34;
var ETHMAC_ADDR_MIIRX_DATA = 0x38;
var ETHMAC_ADDR_MIISTATUS = 0x3C;
var ETHMAC_ADDR_MAC_ADDR0 = 0x40;
var ETHMAC_ADDR_MAC_ADDR1 = 0x44;
var ETHMAC_ADDR_ETH_HASH0_ADR = 0x48;
var ETHMAC_ADDR_ETH_HASH1_ADR = 0x4C;
var ETHMAC_ADDR_ETH_TXCTRL = 0x50;

var ETHMAC_ADDR_BD_START = 0x400;
var ETHMAC_ADDR_BD_END = 0x7FF;


var MII_BMCR =           0x00;        /* Basic mode control register */
var MII_BMSR =           0x01;        /* Basic mode status register  */
var MII_PHYSID1 =        0x02;        /* PHYS ID 1                   */
var MII_PHYSID2 =        0x03;        /* PHYS ID 2                   */
var MII_ADVERTISE =      0x04;        /* Advertisement control reg   */
var MII_LPA =            0x05;        /* Link partner ability reg    */
var MII_EXPANSION =      0x06;        /* Expansion register          */
var MII_CTRL1000 =       0x09;        /* 1000BASE-T control          */
var MII_STAT1000 =       0x0a;        /* 1000BASE-T status           */
var MII_ESTATUS =        0x0f;        /* Extended Status */
var MII_DCOUNTER =       0x12;        /* Disconnect counter          */
var MII_FCSCOUNTER =     0x13;        /* False carrier counter       */
var MII_NWAYTEST =       0x14;        /* N-way auto-neg test reg     */
var MII_RERRCOUNTER =    0x15;        /* Receive error counter       */
var MII_SREVISION =      0x16;        /* Silicon revision            */
var MII_RESV1 =          0x17;        /* Reserved...                 */
var MII_LBRERROR =       0x18;        /* Lpback, rx, bypass error    */
var MII_PHYADDR =        0x19;        /* PHY address                 */
var MII_RESV2 =          0x1a;        /* Reserved...                 */
var MII_TPISTATUS =      0x1b;        /* TPI status for 10mbps       */
var MII_NCONFIG =        0x1c;        /* Network interface config    */



//TODO: MODER.LOOPBCK - loopback support
//TODO: Carrier Sense?
//TODO: Huge frames
//TODO: IAM mode
//TODO: MODER.BRO
function EthDev(ram, intdev, mac) {
    "use strict";
    this.ram = ram;
    this.intdev = intdev;
    this.TransmitCallback = function(data){}; // Should call handler to send data asynchronously.


    this.toTxStat = function(val) {
        return {
            LEN:   val >>> 16,
            RD:   (val >>> 15) & 1,
            IRQ:  (val >>> 14) & 1,
            WR:   (val >>> 13) & 1,
            PAD:  (val >>> 12) & 1,
            CRC:  (val >>> 11) & 1,
            UR:   (val >>> 8)  & 1,
            RTRY: (val >>> 4)  & 0xF,
            RL:   (val >>> 3)  & 1,
            LC:   (val >>> 2)  & 1,
            DF:   (val >>> 1)  & 1,
            CS:    val         & 1
        }
    }

    this.fromTxStat = function(stat) {
        var val = (stat.LEN << 16);
        val |=    ((stat.RD   & 1)   << 15);
        val |=    ((stat.IRQ  & 1)   << 14);
        val |=    ((stat.WR   & 1)   << 13);
        val |=    ((stat.PAD  & 1)   << 12);
        val |=    ((stat.CRC  & 1)   << 11);
        val |=    ((stat.UR   & 1)   << 8);
        val |=    ((stat.RTRY & 0xF) << 4);
        val |=    ((stat.RL   & 1)   << 3);
        val |=    ((stat.LC   & 1)   << 2);
        val |=    ((stat.CDF  & 1)   << 1);
        val |=     (stat.CS   & 1);
        return val;
    }

    this.toRxStat = function(val) {
        return {
            LEN:  val >>> 16,
            E:   (val >>> 15) & 1,
            IRQ: (val >>> 14) & 1,
            WR:  (val >>> 13) & 1,
            CF:  (val >>> 8)  & 1,
            M:   (val >>> 7)  & 1,
            OR:  (val >>> 6)  & 1,
            IS:  (val >>> 5)  & 1,
            DN:  (val >>> 4)  & 1,
            TL:  (val >>> 3)  & 1,
            SF:  (val >>> 2)  & 1,
            CRC: (val >>> 1)  & 1,
            LC:   val         & 1
        }
    }

    this.fromRxStat = function(stat) {
        var val = (stat.LEN << 16);
        val |=    ((stat.E   & 1) << 15);
        val |=    ((stat.IRQ & 1) << 14);
        val |=    ((stat.WR  & 1) << 13);
        val |=    ((stat.CF  & 1) << 8);
        val |=    ((stat.M   & 1) << 7);
        val |=    ((stat.OR  & 1) << 6);
        val |=    ((stat.IS  & 1) << 5);
        val |=    ((stat.DN  & 1) << 4);
        val |=    ((stat.TL  & 1) << 3);
        val |=    ((stat.SF  & 1) << 2);
        val |=    ((stat.CRC & 1) << 1);
        val |=     (stat.LC  & 1) ;
        return val;
    }

    this.makeCRCTable = function() {
        var c;
        var crcTable = [];
        for(var n =0; n < 256; n++) {
            c = n;
            for(var k =0; k < 8; k++) {
                c = ((c&1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1));
            }
            crcTable[n] = c;
        }
        return crcTable;
    }

    this.crcTable = this.makeCRCTable();

    this.crc32 = function(data, offset, length) {
        var crc = 0 ^ (-1);

        var bytelen = 4;
        if (data instanceof Uint16Array || data instanceof Int16Array) {
            bytelen = 2;
        } else if (data instanceof Uint8Array || data instanceof Int8Array) {
            bytelen = 1;
        }

        if (!length) {
            length = data.length;
        }
        if (!offset) {
            offset = 0;
        }

        var val = 0x0;
        for (var i = offset; i < length; i++ ) {
            //first byte
            val = data[i] & 0xFF;
            crc = (crc >>> 8) ^ this.crcTable[(crc ^ val) & 0xFF];

            if (bytelen > 1) {
                //second byte
                val = (data[i] >>> 8) & 0xFF;
                crc = (crc >>> 8) ^ this.crcTable[(crc ^ val) & 0xFF];

                if (bytelen > 2) {
                    //third byte
                    val = (data[i] >>> 16) & 0xFF;
                    crc = (crc >>> 8) ^ this.crcTable[(crc ^ val) & 0xFF];

                    //fourth byte
                    val = (data[i] >>> 24) & 0xFF;
                    crc = (crc >>> 8) ^ this.crcTable[(crc ^ val) & 0xFF];
                }
            }
        }

        return (crc ^ (-1)) >>> 0;
    };

    this.Reset = function () {
        this.MODER = 0xA000;
        this.INT_SOURCE = 0x0;
        this.INT_MASK = 0x0;
        this.IPGT = 0x12;
        this.IPGR1 = 0xC;
        this.IPGR2 = 0x12;
        this.PACKETLEN = 0x400600;
        this.COLLCONF = 0xF003F;
        this.TX_BD_NUM = 0x40;
        this.CTRLMODER = 0x0;
        this.MIIMODER = 0x64;
        this.MIICOMMAND = 0x0;
        this.MIIADDRESS = 0x0;
        this.MIITX_DATA = 0x0;
        this.MIIRX_DATA = 0x22; //default is 0x0
        this.MIISTATUS = 0x0;
        
        this.MAC_ADDR0 |= (Math.floor(Math.random()*256) << 24);
        this.MAC_ADDR0 |= (Math.floor(Math.random()*256) << 16);
        this.MAC_ADDR0 |= (Math.floor(Math.random()*256) << 8);
        this.MAC_ADDR0 |= Math.floor(Math.random()*256);

        this.MAC_ADDR1 |= (((Math.floor(Math.random()*256) << 8) & 0xfe) | 0x02);
        this.MAC_ADDR1 |= Math.floor(Math.random()*256);

        this.ETH_HASH0_ADR = 0x0;
        this.ETH_HASH1_ADR = 0x0;
        this.ETH_TXCTRL = 0x0;

        this.BD = new Uint32Array(256);//128 64bit descriptors
        for(var i=0;i<256;i++) {
            this.BD[i] = 0x0;
        }
         
        this.MIIregs = new Uint16Array(16);
        this.MIIregs[MII_BMCR] = 0x0100; // Full duplex
        // link ok, negotiation complete, 10Mbit and 100Mbit available
        this.MIIregs[MII_BMSR] = 0x4 | 0x20 | 0x800 | 0x1000 | 0x2000 | 0x4000;

        this.MIIregs[MII_PHYSID1] = 0x2000;
        this.MIIregs[MII_PHYSID2] = 0x5c90;
        this.MIIregs[MII_ADVERTISE] = 0x01e1;
	this.MIIregs[MII_PHYADDR] = 0x0;

        // link ok
        // this.MIIregs[MII_LPA] |= 0x01e1;

        this.currRX = (this.TX_BD_NUM << 1);
    };

    this.Receive = function(data_arraybuffer) {
        //check RXEN
        if ((this.MODER & 0x1) == 0) {
            return;
        }
        var data = new Uint8Array(data_arraybuffer);

        //if this is a binary transmission, it's a frame
        var promiscuous = false;
        var match = false;
        var multicast = false;
        
        //MAC detection
        var mac0 = 0x0;
        var mac1 = 0x0;

        mac0 |= (data[2] << 24);
        mac0 |= (data[3] << 16);
        mac0 |= (data[4] << 8);
        mac0 |= data[5];

        mac1 |= (data[0] << 8);
        mac1 |= data[1];

        if (mac0 == this.MAC_ADDR0 && mac1 == this.MAC_ADDR1) {
            match = true;
        }else if (mac1 & (1 << 15)) {
            multicast = true;
        }

        if (this.MODER & (1<<5)) {
            promiscuous = true;
        }

        var i = this.currRX;

        //won't branch if no match/multicast and we're not promiscuous
        if (promiscuous || multicast || match) {
            var err = false;
            //if this BD is ready
            if (this.BD[i] & (1 << 15)) {
                var stat = this.toRxStat(this.BD[i]);

                if (!match && !multicast && promiscuous) {
                    stat.M = 1;
                }
                
                //NOTE: ethoc leaves control frame support disabled
                //leaving these as todo for now.
                //TODO: control frame detection, see pg 31 of SPEC:
                    //TODO: PAUSE frame
                    //TODO: Type/length control frame
                    //TODO: Latch Control Frame
                
                
                //TODO: Dribble Nibble - for now assume frame is proper size
                stat.DN = 0;

                //Too Long, bigger than max packetlen
                if (data.length > (this.PACKETLEN & 0xFFFF)) {
                    //check HUGEN
                    if (this.MODER & (1 << 14)) {
                        //TODO: in this case, how much of the frame do we write?
                        stat.TL = 1;
                    } else {
                        stat.TL = 0;
                        //according to 2.3.5.6 of design doc, we still write
                        //the start of the frame, and don't mark TL bit?
                        //TODO: need to check this behavior
                    }
                } else {
                    stat.TL = 0;
                }
                
                if (stat.DN == 0) {
                    //We don't get a CRC from TAP devices, so just assert this
                    stat.CRC = 0;
                }

                var crc = 0x0;

                crc |= (data[data.length-4] << 24);
                crc |= (data[data.length-3] << 16);
                crc |= (data[data.length-2] << 8);
                crc |= data[data.length-1];

                //write the packet to the memory location
                //TODO: do we want to write on an error, anyway?
                if (!err) {
                    stat.LEN = data.length;

                    var aligned = true;

                    if (stat.LEN > (this.PACKETLEN & 0xFFFF)) {
                        stat.LEN = this.PACKETLEN & 0xFFFF;
                    }

                    var ptr = this.BD[i+1];
                    for(var j=0;j<stat.LEN;j++) {
                        ram.Write8(ptr+j, data[j]);
                    }
                    
                    //add the CRC back into the length field
                    stat.LEN += 4;

                    //mark buffer ready to be read
                    stat.E = 0;
                }

                this.BD[i] = this.fromRxStat(stat);
                //IRQ
                if (stat.IRQ) {
                    if (err) {
                        //RXE interrupt
                        this.INT_SOURCE |= (1 << 3);
                    }
                    //RXB interrupt
                    this.INT_SOURCE |= (1 << 2);

                    if (this.INT_MASK & this.INT_SOURCE) {
                        this.intdev.RaiseInterrupt(0x4);
                    } else {
                        this.intdev.ClearInterrupt(0x4);
                    }

                }
            } else {
                //BUSY interrupt
                this.INT_SOURCE |= (1 << 4);
                if (this.INT_MASK & this.INT_SOURCE) {
                    this.intdev.RaiseInterrupt(0x4);
                } else {
                    this.intdev.ClearInterrupt(0x4);
                }
            }

            //check wrap bit and BD bounds
            if ((this.BD[this.currRX] & (1 << 13)) ||
                (this.currRX + 2) >= this.BD.length) {

                this.currRX = (this.TX_BD_NUM << 1);
            } else {
                this.currRX+=2;
            }
        }
    };

    this.Transmit = function(bd_num) {
        
        //check MODER.TXEN
        if ((this.MODER & (1 << 1)) == 0) {
            return;
        }

        var stat = this.toTxStat(this.BD[bd_num << 1]);
        var ptr = this.BD[(bd_num << 1) + 1];

        //Check RD bit
        if (stat.RD == 0) {
            return;
        }


        //check crc gen for frame size modification
        var frameSize = stat.LEN;
        var crc = false;
        if (stat.CRC || (this.MODER & (1 << 13))) {
            //frameSize += 4;
            //crc = true;
        }

        //check padding for frame size modification
        var pad = false;
        var padlen = 0;
        if (stat.PAD || (this.MODER & (1 << 15))) {
            pad = true;

            if ((this.PACKETLEN >>> 16) > stat.LEN) {
                frameSize = this.PACKETLEN >>> 16;
            }
        }

        //TODO: do we ever need preamble/frame start?
        var frame = new Uint8Array(frameSize);
        
        for(var i=0;i<frame.length;i++) {
            if (i<stat.LEN) {
                frame[i] = ram.Read8(ptr+i);
            } else {
                frame[i] = 0;
            }
        }

        //should only have one 32bit word left to write here
        if (crc) {
            var crcval = 0;
            //if DLYCRCEN
            if (this.MODER & (1 << 12)) {
                crcval = this.crc32(frame, 4, frame.length-4);
            } else {
                crcval = this.crc32(frame, 0, frame.length-4);
            }

            frame[frame.length-1] = (crcval >> 24);
            frame[frame.length-2] = (crcval >> 16) & 0xFF;
            frame[frame.length-3] = (crcval >> 8) & 0xFF;
            frame[frame.length-4] = crcval & 0xFF;
        }

        this.TransmitCallback(frame.buffer);

        //set error bits
        stat.UR = 0;
        stat.RTRY = 0;
        stat.RL = 0;
        stat.LC = 0;
        stat.DF = 0;
        stat.CS = 0;

        stat.RD = 0;

        this.BD[bd_num << 1] = this.fromTxStat(stat);

        this.INT_SOURCE |= 1;

        if (this.INT_MASK & this.INT_SOURCE) {
            this.intdev.RaiseInterrupt(0x4);
        } else {
            this.intdev.ClearInterrupt(0x4);
        }
    };

    this.ReadReg32 = function (addr) {
        var ret = 0x0;
        switch (addr) {
            case ETHMAC_ADDR_MODER:
                ret = this.MODER;
                break;

            case ETHMAC_ADDR_INT_SOURCE:
                ret = this.INT_SOURCE;
                break;

            case ETHMAC_ADDR_INT_MASK:
                ret = this.INT_MASK;
                break;

            case ETHMAC_ADDR_IPGT:
                ret = this.IPGT;
                break;

            case ETHMAC_ADDR_IPGR1:
                ret = this.IPGR1;
                break;

            case ETHMAC_ADDR_IPGR2:
                ret = this.IPGR2;
                break;

            case ETHMAC_ADDR_PACKETLEN:
                ret = this.PACKETLEN;
                break;

            case ETHMAC_ADDR_COLLCONF:
                ret = this.COLLCONF;
                break;

            case ETHMAC_ADDR_TX_BD_NUM:
                ret = this.TX_BD_NUM;
                break;

            case ETHMAC_ADDR_CTRLMODER:
                ret = this.CTRLMODER;
                break;

            case ETHMAC_ADDR_MIIMODER:
                ret = this.MIIMODER;
                break;

            case ETHMAC_ADDR_MIICOMMAND:
                ret = this.MIICOMMAND;
                break;

            case ETHMAC_ADDR_MIIADDRESS:
                ret = this.MIIADDRESS;
                break;

            case ETHMAC_ADDR_MIITX_DATA:
                ret = this.MIITX_DATA;
                break;

            case ETHMAC_ADDR_MIIRX_DATA:
                ret = this.MIIRX_DATA;
                break;

            case ETHMAC_ADDR_MIISTATUS:
                ret = this.MIISTATUS;
                break;

            case ETHMAC_ADDR_MAC_ADDR0:
                ret = this.MAC_ADDR0;
                break;

            case ETHMAC_ADDR_MAC_ADDR1:
                ret = this.MAC_ADDR1;
                break;

            case ETHMAC_ADDR_ETH_HASH0_ADR:
                ret = this.ETH_HASH0_ADR;
                break;

            case ETHMAC_ADDR_ETH_HASH1_ADR:
                ret = this.ETH_HASH1_ADR;
                break;

            case ETHMAC_ADDR_ETH_TXCTRL:
                ret = this.ETH_TXCTRL;
                break;
            default:
                if (addr >= ETHMAC_ADDR_BD_START &&
                    addr <= ETHMAC_ADDR_BD_END) {
                    ret = this.BD[(addr-ETHMAC_ADDR_BD_START)>>>2];
                } else {
                    message.Debug("Attempt to access ethmac register beyond 0x800");
                }
        }
        return ret;
    };

    this.HandleMIICommand = function()
    {
        var fiad = this.MIIADDRESS & 0x1F;
        var rgad = (this.MIIADDRESS >> 8) & 0x1F;
        var phy_addr = 0x0;
        switch(this.MIICOMMAND) {
            case 0:
                break;

            case 1: // scan status
                break;

            case 2: // read status
                if (fiad != phy_addr) {
                    this.MIIRX_DATA = 0xFFFF;
                } else {
                    // message.Debug("MIICOMMAND read" + " " + utils.ToHex(rgad));
                    this.MIIRX_DATA = this.MIIregs[rgad];
                }
                break;

            case 4: // write status
                if (fiad != phy_addr) {
                } else {
                    // message.Debug("MIICOMMAND write" + " " + utils.ToHex(rgad) + " " + utils.ToHex(this.MIITX_DATA));
                    //this.MIIregs[rgad] = this.MIITX_DATA & 0xFFFF;
                }
                break;

            default:
                message.Debug("Error in ethmac: Unknown mii command detected");
                break;
        }

    }



    this.WriteReg32 = function (addr, val) {
        // message.Debug("write ethmac " + utils.ToHex(addr));
        switch (addr) {
            case ETHMAC_ADDR_MODER:
                this.MODER = val;
                break;

            case ETHMAC_ADDR_INT_SOURCE:
                //to clear an interrupt, it must be set in the write
                //otherwise, leave the other bits alone
                this.INT_SOURCE = this.INT_SOURCE & ~val;

                if (this.INT_MASK & this.INT_SOURCE) {
                    this.intdev.RaiseInterrupt(0x4);
                } else {
                    this.intdev.ClearInterrupt(0x4);
                }

                break;

            case ETHMAC_ADDR_INT_MASK:
                this.INT_MASK = val;

                if (this.INT_MASK & this.INT_SOURCE) {
                    this.intdev.RaiseInterrupt(0x4);
                } else {
                    this.intdev.ClearInterrupt(0x4);
                }

                break;

            case ETHMAC_ADDR_IPGT:
                this.IPGT = val;
                break;

            case ETHMAC_ADDR_IPGR1:
                this.IPGR1 = val;
                break;

            case ETHMAC_ADDR_IPGR2:
                this.IPGR2 = val;
                break;

            case ETHMAC_ADDR_PACKETLEN:
                this.PACKETLEN = val;
                break;

            case ETHMAC_ADDR_COLLCONF:
                this.COLLCONF = val;
                break;

            case ETHMAC_ADDR_TX_BD_NUM:
                this.TX_BD_NUM = val;
                this.currRX = (val << 1);
                break;

            case ETHMAC_ADDR_CTRLMODER:
                this.CTRLMODER = val;
                break;

            case ETHMAC_ADDR_MIIMODER:
                this.MIIMODER = val;
                break;

            case ETHMAC_ADDR_MIICOMMAND:
                this.MIICOMMAND = val;
		this.HandleMIICommand();
                break;

            case ETHMAC_ADDR_MIIADDRESS:
                this.MIIADDRESS = val;
                break;

            case ETHMAC_ADDR_MIITX_DATA:
                this.MIITX_DATA = val;
                break;

            case ETHMAC_ADDR_MIIRX_DATA:
                this.MIIRX_DATA = val;
                break;

            case ETHMAC_ADDR_MIISTATUS:
                this.MIISTATUS = val;
                break;

            case ETHMAC_ADDR_MAC_ADDR0:
                this.MAC_ADDR0 = val;
                break;

            case ETHMAC_ADDR_MAC_ADDR1:
                this.MAC_ADDR1 = val;
                break;

            case ETHMAC_ADDR_ETH_HASH0_ADR:
                this.ETH_HASH0_ADR = val;
                break;

            case ETHMAC_ADDR_ETH_HASH1_ADR:
                this.ETH_HASH1_ADR = val;
                break;

            case ETHMAC_ADDR_ETH_TXCTRL:
                this.ETH_TXCTRL = val;
                break;

            default:
                if (addr >= ETHMAC_ADDR_BD_START &&
                    addr <= ETHMAC_ADDR_BD_END) {

                    this.BD[(addr-ETHMAC_ADDR_BD_START)>>>2] = val;

                    //which buffer descriptor?
                    var BD_NUM = (addr - ETHMAC_ADDR_BD_START)>>>3;
                    
                    //make sure this isn't the pointer portion
                    if (((BD_NUM << 3) + ETHMAC_ADDR_BD_START) == addr) {
                        //did we just set the ready/empty bit?
                        if ((val & (1 << 15)) != 0) {
                            //TX, or RX?
                            if (BD_NUM < this.TX_BD_NUM) {
                                //TX BD
                                this.Transmit(BD_NUM);
                            }
                        }
                    }
                } else {
                    message.Debug("Attempt to access ethmac register beyond 0x800");
                }
        }
    };

    this.Reset();
    message.Register("ethmac", this.Receive.bind(this) );

}

module.exports = EthDev;

},{"../messagehandler":33,"../utils":48}],6:[function(require,module,exports){
// -------------------------------------------------
// ---------------- Framebuffer --------------------
// -------------------------------------------------

"use strict";

var utils = require('../utils');
var message = require('../messagehandler');

// constructor
function FBDev(ram) {
    this.ram = ram;
    this.width = 640;
    this.height = 400;
    this.addr = 16000000;
    this.n = (this.width * this.height)>>1;
    this.buffer = new Int32Array(this.n);
    message.Register("GetFB", this.OnGetFB.bind(this) );
    //this.buffer = new Uint8Array(0);
}

FBDev.prototype.Reset = function () {
};


FBDev.prototype.ReadReg32 = function (addr) {
    return 0x0;
};

FBDev.prototype.WriteReg32 = function (addr, value) {

    switch (addr) {
    case 0x14: 
        this.addr = utils.Swap32(value);
        //this.buffer = new Uint8Array(this.ram.mem, this.addr, this.n);
        break;
    default:
        return;
    }
};

FBDev.prototype.OnGetFB = function() {
    message.Send("GetFB", this.GetBuffer() );
}

FBDev.prototype.GetBuffer = function () {
    //return this.buffer;
    var i=0, n = this.buffer.length;
    var data = this.buffer;
    var mem = this.ram.int32mem;
    var addr = this.addr>>2;
   	for (i = 0; i < n; ++i) {
        data[i] = mem[addr+i];
    }
    return this.buffer;
}

module.exports = FBDev;

},{"../messagehandler":33,"../utils":48}],7:[function(require,module,exports){
// -------------------------------------------------
// ---------------------- IRQ ----------------------
// -------------------------------------------------
// Stefan Kristianssons ompic suitable for smp systems
// Just the ipi part

"use strict";

var message = require('../messagehandler');
var utils = require('../utils');

// Control register
// +---------+---------+----------+---------+
// | 31      | 30      | 29 .. 16 | 15 .. 0 |
// ----------+---------+----------+----------
// | IRQ ACK | IRQ GEN | DST CORE | DATA    |
// +---------+---------+----------+---------+

// Status register
// +----------+-------------+----------+---------+
// | 31       | 30          | 29 .. 16 | 15 .. 0 |
// -----------+-------------+----------+---------+
// | Reserved | IRQ Pending | SRC CORE | DATA    |
// +----------+-------------+----------+---------+

var OMPIC_IPI_CTRL_IRQ_ACK = (1 << 31);
var OMPIC_IPI_CTRL_IRQ_GEN = (1 << 30);
var OMPIC_IPI_STAT_IRQ_PENDING = (1 << 30);

function IRQDev(intdev) {
    this.intdev = intdev;
    this.regs = new Uint32Array(32*2); // maximum 32 cpus
    this.Reset();
}

IRQDev.prototype.Reset = function() {
    for(var i=0; i<32*2; i++) {
        this.regs[i] = 0x0;
    }
}

IRQDev.prototype.ReadReg32 = function (addr) {
    addr >>= 2;
    if (addr > 32*2) {
        message.Debug("IRQDev: Unknown ReadReg32: " + utils.ToHex(addr));
        return 0x0;
    }
    /*
    var cpuid = addr >> 1;    
    if (addr&1) {
        message.Debug("IRQDev: Read STAT of CPU " + cpuid);
    } else {
        message.Debug("IRQDev: Read CTRL of CPU " + cpuid);
    }
    */
    return this.regs[addr];
}

IRQDev.prototype.WriteReg32 = function (addr, value) {
    addr >>= 2;
    if (addr > 32*2) {
        message.Debug("IRQDev: unknown  WriteReg32: " + utils.ToHex(addr) + ": " + utils.ToHex(value));
        return;
    }

    var cpuid = addr >> 1;
    if (addr&1) {
        message.Debug("Error in IRQDev: Write STAT of CPU " + cpuid +" : " + utils.ToHex(value));
    } else {
        this.regs[addr] = value;
        var irqno = value & 0xFFFF;
        var dstcpu = (value >> 16) & 0x3fff;
        var flags = (value >> 30) & 3;
        /*
        message.Debug("IRQDev: Write CTRL of CPU " + cpuid + " : " +
            " dstcpu=" + dstcpu  +
            " irqno=" + irqno +
            " flags=" + flags
            );
        */

        if (flags & 1) { // irq gen
            if (dstcpu == cpuid) {
                message.Debug("Warning in IRQDev: Try to raise its own IRQ");
            }
            if (this.regs[(dstcpu<<1)+1] & OMPIC_IPI_STAT_IRQ_PENDING) {
                message.Debug("Warning in IRQDev: CPU " + cpuid + " raised irq on cpu " + dstcpu + " without previous acknowledge");
                var h = new Int32Array(this.intdev.heap);
                message.Debug("The pc of cpu " + dstcpu + " is " + utils.ToHex(h[(dstcpu<<15) + 0x124 >> 2]));
                message.Debug("The IEE flag of cpu " + dstcpu + " is " + ( h[(dstcpu<<15) + 0x120 >> 2] & (1<<2)) );
                message.Debug("r9 of cpu " + dstcpu + " is " + utils.ToHex(h[(dstcpu<<15) + (0x9<<2) >> 2]));
            }
            this.regs[(dstcpu<<1)+1] = OMPIC_IPI_STAT_IRQ_PENDING | ((cpuid & 0x3fff) << 16) | irqno;
            this.intdev.RaiseSoftInterrupt(0x1, dstcpu);
        }
        if (flags & 2) { // irq ack
            this.regs[addr+1] &= ~OMPIC_IPI_STAT_IRQ_PENDING;
            this.intdev.ClearSoftInterrupt(0x1, cpuid);
        }

    }
}

module.exports = IRQDev;

},{"../messagehandler":33,"../utils":48}],8:[function(require,module,exports){
// -------------------------------------------------
// ------------------ KEYBOARD ---------------------
// -------------------------------------------------
// Emulating the Opencores Keyboard Controller

"use strict";
var message = require('../messagehandler');

// translation table from Javascript keycodes to Linux keyboard scancodes
// http://lxr.free-electrons.com/source/include/dt-bindings/input/input.h

var kc2kc =
[
// 0
0,      //
0,      //
0,      //
0,      //
0,      //
0,      //
0,      //
0,      //
14,     // backspace
15,     // tab

// 10
0,      //
0,      //
0,      //
28,     // enter
0,      //
0,      //
42,     // shift
29,     // ctrl
56,     // alt
119,    // pause/break

// 20
58,     // caps lock
0,      //
0,      //
0,      //
0,      //
0,      //
0,      //
1,      // escape
0,      //
0,      //

// 30
0,      //
0,      //
57,     // space
104,    // page up
109,    // page down
107,    // end
102,    // home
105,    // left arrow
103,    // up arrow
106,    // right arrow

// 40
108,    // down arrow
0,      //
0,      //
0,      //
0,      //
110,    // insert
111,    // delete
0,      //
11,     // 0
2,      // 1

// 50
3,      // 2
4,      // 3
5,      // 4
6,      // 5
7,      // 6
8,      // 7
9,      // 8
10,     // 9
0,      // 
39,      // semi colon

// 60
,      // equal sign
13,      // 
0,      // 
0,      // 
0,      // 
30,     // a
48,     // b
46,     // c
32,     // d
18,     // e

// 70
33,     // f
34,     // g
35,     // h
23,     // i
36,     // j
37,     // k
38,     // l
50,     // m
49,     // n
24,     // o

// 80
25,     // p
16,     // q
19,     // r
31,     // s
20,     // t
22,     // u
47,     // v
17,     // w
45,     // x
21,     // y

// 90
44,     // z
0,    // left window key
0,    // right window key
0,    // select key
0,      // 
0,      // 
82,     // numpad 0
79,     // numpad 1
80,     // numpad 2
81,     // numpad 3

// 100
75,     // numpad 4
76,     // numpad 5
77,     // numpad 6
71,     // numpad 7
72,     // numpad 8
73,     // numpad 9
55,     // multiply
77,     // add
0,      // 
12,     // subtract

// 110
83,     // decimal point
181,    // divide
59,     // F1
60,     // F2
61,     // F3
62,     // F4
63,     // F5
64,     // F6
65,     // F7
66,     // F8

// 120
67,     // F9
68,     // F10
87,     // F11
88,     // F12
0,      //
0,      //
0,      //
0,      //
0,      //
0,      //

// 130
0,      // 
0,      // 
0,      // 
0,      // 
0,      // 
0,      // 
0,      // 
0,      // 
0,      // 
0,      //

// 140
0,      // 
0,      // 
0,      // 
0,      // 
69,     // num lock
70,     // scroll lock
0,      // 
0,      // 
0,      // 
0,      //

// 150
0,      // 
0,      // 
0,      // 
0,      // 
0,      // 
0,      // 
0,      // 
0,      // 
0,      // 
0,      //

// 160
0,      // 
0,      // 
0,      // 
0,      // 
0,      // 
0,      // 
0,      // 
0,      // 
0,      // 
0,      //

// 170
0,      // 
0,      // 
0,      // 
12,     // minus
0,      // 
0,      // 
0,      // 
0,      // 
0,      // 
0,      //

// 180
0,      // 
0,      // 
0,      // 
0,      // 
0,      // 
0,      // 
39,     // semi-colon
13,     // equal sign
51,     // comma
12,     // dash

// 190
52,     // period
53,     // forward slash
40,     // grave accent
0,      // 
0,      // 
0,      // 
0,      // 
0,      // 
0,      // 
0,      //

// 200
0,      // 
0,      // 
0,      // 
0,      // 
0,      // 
0,      // 
0,      // 
0,      // 
0,      // 
0,      //

// 210
0,      // 
0,      // 
0,      // 
0,      // 
0,      // 
0,      // 
0,      // 
0,      // 
0,      // 
26,     // open bracket

// 220
43,     // back slash
27,     // close bracket
40,     // single quote
0,      // 
0,      // 
0,      // 
0,      // 
0,      // 
0,      // 
0,      //

];



function KeyboardDev(intdev) {
    this.intdev = intdev;
    message.Register("keydown", this.OnKeyDown.bind(this) );
    message.Register("keyup", this.OnKeyUp.bind(this) );
    this.Reset();
}

KeyboardDev.prototype.Reset = function() {
    this.key = 0x0;
    this.fifo = [];
}

KeyboardDev.prototype.OnKeyDown = function(event) {
    this.key = kc2kc[event.keyCode] | 0x0;
    if (this.key == 0) return;
    this.fifo.push(this.key);
    this.intdev.RaiseInterrupt(0x5);
}

KeyboardDev.prototype.OnKeyUp = function(event) {
    this.key = kc2kc[event.keyCode];
    if (this.key == 0) return;
    this.key = this.key | 0x80;
    this.fifo.push(this.key);
    this.intdev.RaiseInterrupt(0x5);
}

KeyboardDev.prototype.ReadReg8 = function (addr) {
    var key = this.fifo.shift();
    if (this.fifo.length == 0) this.intdev.ClearInterrupt(0x5);
    return key;
}

module.exports = KeyboardDev;

},{"../messagehandler":33}],9:[function(require,module,exports){
// -------------------------------------------------
// ---------------------- PLIC ---------------------
// -------------------------------------------------
// PLIC (Platform-Level Interrupt Controller) device for RISC-V

"use strict";
var message = require('../messagehandler');
var utils = require('../utils');

/*
 * 0x0000   Priority Device 0
 * 0x0004   Priority Device 1
 * ....
 * 0x2000   enable bitmask 32-bit * 32 entries for handler 0
 * 0x2080   enable for handler 1
 * 0x200000 hart threshold
 * 0x200004 hart claim
 * 0x201000 hart threshold
 * ...
 */

var IRQ_S_EXT = 9;

function PLICDev(cpuirqhandler) {
    this.cpuirqhandler = cpuirqhandler
    this.Reset();
}

PLICDev.prototype.Reset = function() {
    // 32-Bit registers
    this.regs = new Uint32Array(0x3000);
    this.mask = 0x0;
}

PLICDev.prototype.ReadReg32 = function (addr) {
    //message.Debug("PLIC: unknown ReadReg32: " + utils.ToHex(addr));
    var i = 0;
    if (addr == 0x00200004) {
        for(i=0; i<32; i++)
            if (this.mask & (1<<i)) return i;
    }
    return 0x0;
}

PLICDev.prototype.WriteReg32 = function (addr, value) {
    //message.Debug("PLIC: unknown WriteReg32: " + utils.ToHex(addr) + ": " + utils.ToHex(value));
}

PLICDev.prototype.RaiseInterrupt = function (line) {
    line = line | 0;
    if (line == 0x1) return; // HTIF
    //message.Debug("PLIC: Raise line " + line);
    this.mask |= 1 << line;
    this.cpuirqhandler.RaiseInterrupt(IRQ_S_EXT, -1);
}

PLICDev.prototype.ClearInterrupt = function (line) {
    line = line | 0;
    //message.Debug("PLIC: Clear line " + line);
    this.mask &= ~(1 << line);
    if (this.mask == 0x0) {
        this.cpuirqhandler.ClearInterrupt(IRQ_S_EXT, -1);
    }
}

module.exports = PLICDev;

},{"../messagehandler":33,"../utils":48}],10:[function(require,module,exports){
// -------------------------------------------------
// --------------------- ROM -----------------------
// -------------------------------------------------

/* Basic Read Only Memory (ROM) device */

var utils = require('../utils');
var message = require('../messagehandler');

// constructor
function ROMDev(rom) {
	this.rom = rom;
	this.buffer32view = new Int32Array(this.rom);
	this.buffer16view = new Int16Array(this.rom);
	this.buffer8view = new Int8Array(this.rom);
}

ROMDev.prototype.Reset = function () {
};

ROMDev.prototype.ReadReg32 = function (addr) {
    return this.buffer32view[addr >> 2];
};

ROMDev.prototype.ReadReg16 = function (addr) {
    return this.buffer16view[addr >> 1];
};

ROMDev.prototype.ReadReg8 = function (addr) {
    return this.buffer8view[addr];
};



module.exports = ROMDev;



},{"../messagehandler":33,"../utils":48}],11:[function(require,module,exports){
// -------------------------------------------------
// ---------------------- RTC ----------------------
// -------------------------------------------------
// Real Time Clock emulating the nxp,lpc3220-rtc

"use strict";
var message = require('../messagehandler');
var utils = require('../utils');

/*
 * Clock and Power control register offsets
 */
var LPC32XX_RTC_UCOUNT            = 0x00;
var LPC32XX_RTC_DCOUNT            = 0x04;
var LPC32XX_RTC_MATCH0            = 0x08;
var LPC32XX_RTC_MATCH1            = 0x0C;
var LPC32XX_RTC_CTRL              = 0x10;
var LPC32XX_RTC_INTSTAT           = 0x14;
var LPC32XX_RTC_KEY               = 0x18;
var LPC32XX_RTC_SRAM              = 0x80;

function RTCDev(intdev) {
    this.intdev = intdev;
    this.Reset();
}

RTCDev.prototype.Reset = function() {
    this.ctrl = 0x0;
}


RTCDev.prototype.ReadReg32 = function (addr) {
    switch(addr)
    {
        case LPC32XX_RTC_UCOUNT:
            return Math.floor(new Date().getTime()/1000);
            break;

        case LPC32XX_RTC_CTRL:
            return this.ctrl;
            break;

        case LPC32XX_RTC_KEY: 
            return 0xB5C13F27; // the clock is already running
            break;

        case LPC32XX_RTC_MATCH0:
            return 0x0;
            break;

        case  LPC32XX_RTC_INTSTAT:
            return 0x0;
            break;


        default:
            message.Debug("RTC: unknown ReadReg32: " + utils.ToHex(addr));
            return 0x0;
            break;
    }
    return 0x0;
}

RTCDev.prototype.WriteReg32 = function (addr, value) {
    switch(addr)
    {
        case LPC32XX_RTC_CTRL:
            this.ctrl = value;
            break;

        default:
            message.Debug("RTC: unknown  WriteReg32: " + utils.ToHex(addr) + ": " + utils.ToHex(value));
            return;
            break;
    }
}


module.exports = RTCDev;

},{"../messagehandler":33,"../utils":48}],12:[function(require,module,exports){
// -------------------------------------------------
// --------------------- SOUND ---------------------
// -------------------------------------------------

// Emulating my own virtual sound card, using the altered dummy sound device

"use strict";

var message = require('../messagehandler');
var utils = require('../utils');

var REG_CTL            = 0x00; // format
var REG_ADDR           = 0x04; // pointer to dma buffer
var REG_PERIODS        = 0x08; // number of perionds
var REG_PERIOD_SIZE    = 0x0C; // size of periods
var REG_OFFSET         = 0x10; // current position in buffer
var REG_RATE           = 0x14; // rate
var REG_CHANNELS       = 0x18; // channels
var REG_FORMAT         = 0x1C; // format

function SoundDev(intdev, ramdev) {
    message.Debug("Start sound");
    this.intdev = intdev;
    this.ramdev = ramdev
    this.Reset();
}

SoundDev.prototype.Reset = function() {
    this.addr = 0x0;
    this.status = 0x0;
    this.periods = 0x0;
    this.period_size = 0x0; // in frames (32 bits)
    this.rate = 22050;
    this.channels = 1;
    this.offset = 0; // frames (32 bits)
    this.playing = false;
    this.nextperiod = 0;
    this.starttime = 0.; // time when the playing started in (in ms)
    this.lasttotalframe = 0; // last (total) frame to which the sound was simulated
}

SoundDev.prototype.GetTimeToNextInterrupt = function() {
    if (!this.playing) return -1;
    return this.nextperiod * 1000. / this.rate;
}

SoundDev.prototype.Progress = function() {
    return;
/*
    if (!this.playing) return;
    var currenttime = utils.GetMilliseconds();

    var totalframes = Math.floor((currenttime - this.starttime) / 1000. * this.rate); // in frames
    var deltaframes = totalframes - this.lasttotalframe;

    if (deltaframes < 16) return; // not worth sending

    var x = new Int8Array(deltaframes);
    var totalperiodbuffer = this.periods*this.period_size;
    for(var i=0; i<deltaframes; i++) {
        x[i] = this.ramdev.sint8mem[this.addr + (((this.offset++)<<1)^3)];
        if (this.offset == totalperiodbuffer) this.offset = 0;
    }

    message.Send("sound", x);

    this.lasttotalframe += deltaframes;
    this.nextperiod -= deltaframes;

    if (this.nextperiod <= 0) { 
        this.intdev.RaiseInterrupt(0x7);
        this.nextperiod += this.period_size;
        //if (this.nextperiod < 0) message.Debug("Error in sound device: Buffer underrun");
    }
*/
}

SoundDev.prototype.Elapsed = function() {
    var x = new Int8Array(this.period_size);
    var totalperiodbuffer = this.periods*this.period_size;
    if (this.format == 1) {
        for(var i=0; i<this.period_size; i++) {
            x[i] = this.ramdev.uint8mem[this.addr + (((this.offset++)<<0)^3)]-128;
            if (this.offset == totalperiodbuffer) this.offset = 0;
        }
    } else {
        for(var i=0; i<this.period_size; i++) {
            x[i] = this.ramdev.sint8mem[this.addr + 1 + (((this.offset++)<<1)^3)];
            if (this.offset == totalperiodbuffer) this.offset = 0;
        }
    }
    message.Send("sound", x);
    
}

SoundDev.prototype.ReadReg32 = function (addr) {
    switch(addr)
    {
        case REG_CTL:
            //if (this.nextperiod > 0)
            this.intdev.ClearInterrupt(0x7);
            this.Elapsed();
            
            return this.playing?1:0;
            break;

        case REG_OFFSET:
            return this.offset; // given in frames
            break; 

        default:
            message.Debug("Sound: unknown ReadReg32: " + utils.ToHex(addr));
            return 0x0;
            break;
    }
    return 0x0;
}

SoundDev.prototype.WriteReg32 = function (addr, value) {
    switch(addr)
    {
        case REG_CTL:
            this.playing = value?true:false;               
            this.nextperiod = this.period_size;
            this.starttime = utils.GetMilliseconds();
            this.lasttotalframe = 0;
            this.offset = 0;
            message.Send("sound.rate", this.rate);
            this.Elapsed();
            /*
            message.Debug("rate: "        + this.rate);
            message.Debug("channels: "    + this.channels);
            message.Debug("periods: "     + this.periods);
            message.Debug("period size: " + this.period_size);
            message.Debug("format: "      + this.format);
            message.Debug("addr: "        + utils.ToHex(this.addr));
            */
            break;

        case REG_ADDR:
            this.addr = value;
            break;

        case REG_PERIODS:
            this.periods = value;
            break;

        case REG_PERIOD_SIZE:
            this.period_size = value; // in frames
            break;

        case REG_RATE:
            this.rate = value; // in frames
            break;

        case REG_CHANNELS:
            this.channels = value;
            break;

        case REG_FORMAT:
            this.format = value;
            break;

        default:
            message.Debug("sound: unknown  WriteReg32: " + utils.ToHex(addr) + ": " + utils.ToHex(value));
            return;
            break;
    }
}

module.exports = SoundDev;

},{"../messagehandler":33,"../utils":48}],13:[function(require,module,exports){
// -------------------------------------------------
// -------------------- Timer ----------------------
// -------------------------------------------------
// Simple Timer running with the CPU frequency (20MHz) used to synchronize the cpu timers
// the syncing is done directly in the cpu, so we can return zero here.

"use strict";

var message = require('../messagehandler');

function TimerDev() {
    this.Reset();
}

TimerDev.prototype.Reset = function() {
    this.sync = 0x0;
}

TimerDev.prototype.ReadReg32 = function (addr) {
    //message.Debug("Timer: Read reg " + addr);
    return this.sync;    
}

TimerDev.prototype.WriteReg32 = function (addr, value) {
    message.Debug("Error in Timer: Write reg " + addr + " : " + value);
}

module.exports = TimerDev;

},{"../messagehandler":33}],14:[function(require,module,exports){
// -------------------------------------------------
// ---------------- TOUCHSCREEN --------------------
// -------------------------------------------------
// Emulating the LPC32xx

"use strict";

var message = require('../messagehandler');
var utils = require('../utils');

// controller register offsets
var LPC32XX_TSC_STAT                      = 0x00;
var LPC32XX_TSC_SEL                       = 0x04;
var LPC32XX_TSC_CON                       = 0x08;
var LPC32XX_TSC_FIFO                      = 0x0C;
var LPC32XX_TSC_DTR                       = 0x10;
var LPC32XX_TSC_RTR                       = 0x14;
var LPC32XX_TSC_UTR                       = 0x18;
var LPC32XX_TSC_TTR                       = 0x1C;
var LPC32XX_TSC_DXP                       = 0x20;
var LPC32XX_TSC_MIN_X                     = 0x24;
var LPC32XX_TSC_MAX_X                     = 0x28;
var LPC32XX_TSC_MIN_Y                     = 0x2C;
var LPC32XX_TSC_MAX_Y                     = 0x30;
var LPC32XX_TSC_AUX_UTR                   = 0x34;
var LPC32XX_TSC_AUX_MIN                   = 0x38;
var LPC32XX_TSC_AUX_MAX                   = 0x3C;

var LPC32XX_TSC_ADCCON_AUTO_EN = (1 << 0); // automatic ts event capture
var LPC32XX_TSC_STAT_FIFO_EMPTY = (1 << 7); // fifo is empty; 
var LPC32XX_TSC_FIFO_TS_P_LEVEL = (1 << 31) // touched

function TouchscreenDev(intdev) {
    this.intdev = intdev;
    this.Reset();
    message.Register("tsmousedown", this.onmousedown.bind(this) );
    message.Register("tsmouseup", this.onmouseup.bind(this) );
    message.Register("tsmousemove", this.onmousemove.bind(this) );
}

TouchscreenDev.prototype.Reset = function() {
    this.control = 0x0; // control register
    this.status = LPC32XX_TSC_STAT_FIFO_EMPTY;
    this.ispressed = false;
    this.mousemovecount = 0;
    this.fifo = 0x0;
    this.fifosize = 0x0;
}

TouchscreenDev.prototype.onmousedown = function(event) {
    if (!(this.control & LPC32XX_TSC_ADCCON_AUTO_EN)) return;
    var x = event.x;
    var y = event.y;
    this.status &= ~LPC32XX_TSC_STAT_FIFO_EMPTY;
    this.fifosize = 0x4;
    this.fifo = 0x0;
    this.fifo |= ((0x3FF-x)&0x3FF) << 16;
    this.fifo |= ((0x3FF-y)&0x3FF);
    //this.fifo |= (x) << 16;
    //this.fifo |= (y);
    this.ispressed = true;
    this.intdev.RaiseInterrupt(0x9);
}

TouchscreenDev.prototype.onmousemove = function(event) {
    if (!(this.control & LPC32XX_TSC_ADCCON_AUTO_EN)) return;
    if (!this.ispressed) return;
    this.mousemovecount++;
    if (this.mousemovecount&3) return; // handle mouse move only every fourth time
    var x = event.x;
    var y = event.y;
    this.status &= ~LPC32XX_TSC_STAT_FIFO_EMPTY;
    this.fifosize = 0x4;
    this.fifo = 0x0;
    this.fifo |= ((0x3FF-x)&0x3FF) << 16;
    this.fifo |= ((0x3FF-y)&0x3FF);
    this.intdev.RaiseInterrupt(0x9);
}


TouchscreenDev.prototype.onmouseup = function(event) {
    if (!(this.control & LPC32XX_TSC_ADCCON_AUTO_EN)) return;
    var x = event.x;
    var y = event.y;
    this.status &= ~LPC32XX_TSC_STAT_FIFO_EMPTY;
    this.fifosize = 0x0; // just a button up event
    this.fifo = LPC32XX_TSC_FIFO_TS_P_LEVEL;
    this.ispressed = false;
    this.intdev.RaiseInterrupt(0x9);
}

TouchscreenDev.prototype.ReadReg32 = function (addr) {
    switch(addr)
    {
        case LPC32XX_TSC_CON:
            return this.control;
            break;
        case LPC32XX_TSC_STAT:
            this.intdev.ClearInterrupt(0x9);
            return this.status;
            break;
        case LPC32XX_TSC_FIFO:
            if (this.fifosize <= 0)
                this.status |= LPC32XX_TSC_STAT_FIFO_EMPTY;
            this.fifosize--;
            return this.fifo;
            break;
    }
    // message.Debug("Touchscreen ReadReg32: " + utils.ToHex(addr));
    return 0x0;
}

TouchscreenDev.prototype.WriteReg32 = function (addr, value) {
    switch(addr)
    {
        case LPC32XX_TSC_CON:
            this.control = value;
            return;
            break;
        case LPC32XX_TSC_SEL:
        case LPC32XX_TSC_MIN_X:
        case LPC32XX_TSC_MAX_X:
        case LPC32XX_TSC_MIN_Y:
        case LPC32XX_TSC_MAX_Y:
        case LPC32XX_TSC_AUX_UTR:
        case LPC32XX_TSC_AUX_MIN:
        case LPC32XX_TSC_AUX_MAX:
        case LPC32XX_TSC_RTR:
        case LPC32XX_TSC_DTR:
        case LPC32XX_TSC_TTR:
        case LPC32XX_TSC_DXP:
        case LPC32XX_TSC_UTR:
            return;
        break;

    }
    // message.Debug("Touchscreen WriteReg32: " + utils.ToHex(addr) + ": " + utils.ToHex(value));
    return;
}

module.exports = TouchscreenDev;

},{"../messagehandler":33,"../utils":48}],15:[function(require,module,exports){
// -------------------------------------------------
// -------------------- UART -----------------------
// -------------------------------------------------
// uart16550 compatible
// the driver source is spread in drivers/tty/serial/8250/

// See
// http://www.tldp.org/HOWTO/Serial-HOWTO-18.html
// http://www.lammertbies.nl/comm/info/serial-uart.html
// http://www.freebsd.org/doc/en/articles/serial-uart/

"use strict";

var message = require('../messagehandler');
var utils = require('../utils');

// Register offsets
var UART_RXBUF = 0; /* R: Rx buffer, DLAB=0 */
var UART_TXBUF = 0; /* W: Tx buffer, DLAB=0 (also called transmitter hoilding register */
var UART_DLL   = 0; /* R/W: Divisor Latch Low, DLAB=1 */
var UART_DLH   = 1; /* R/W: Divisor Latch High, DLAB=1 */
var UART_IER   = 1; /* R/W: Interrupt Enable Register */
var UART_IIR   = 2; /* R: Interrupt ID Register */
var UART_FCR   = 2; /* W: FIFO Control Register */
var UART_LCR   = 3; /* R/W: Line Control Register */
var UART_MCR   = 4; /* W: Modem Control Register */
var UART_LSR   = 5; /* R: Line Status Register */
var UART_MSR   = 6; /* R: Modem Status Register */
var UART_SCR   = 7; /* R/W: Scratch Register*/

// Line Status register bits
var UART_LSR_DATA_READY        = 0x01; // data available
var UART_LSR_TX_EMPTY          = 0x20; // TX (THR) buffer is empty
var UART_LSR_TRANSMITTER_EMPTY = 0x40; // TX empty and line is idle
var UART_LSR_INT_ANY           = 0x1E; // Any of the lsr-interrupt-triggering status bits

// Interrupt enable register bits
var UART_IER_MSI  = 0x08; /* Modem Status Changed int. */
var UART_IER_RLSI = 0x04; /* Enable Break int. Enable receiver line status interrupt */
var UART_IER_THRI = 0x02; /* Enable Transmitter holding register int. */
var UART_IER_RDI  = 0x01; /* Enable receiver data interrupt */

// Interrupt identification register bits
var UART_IIR_MSI    = 0x00; /* Modem status interrupt (Low priority). Reset by MSR read */
var UART_IIR_NO_INT = 0x01;
var UART_IIR_THRI   = 0x02; /* Transmitter holding register empty. Reset by IIR read or THR write */
var UART_IIR_RDI    = 0x04; /* Receiver data interrupt. Reset by RBR read */
var UART_IIR_RLSI   = 0x06; /* Receiver line status interrupt (High p.). Reset by LSR read */
var UART_IIR_CTI    = 0x0c; /* Character timeout. Reset by RBR read */

// Line control register bits
var UART_LCR_DLAB   = 0x80; /* Divisor latch access bit */

// Modem control register bits
var UART_MCR_DTR = 0x01; /* Data Terminal Ready - Kernel ready to receive */
var UART_MCR_RTS = 0x02; /* Request To Send - Kernel ready to receive */

// Modem status register bits
var UART_MSR_DCD       = 0x80; /* Data Carrier Detect */
var UART_MSR_DSR       = 0x20; /* Data set Ready */
var UART_MSR_DELTA_DSR = 0x2;
var UART_MSR_CTS       = 0x10; /* Clear to Send */
var UART_MSR_DELTA_CTS = 0x1;

// register descriptions for debug mode
var MCR_BIT_DESC = ["DataTerminalReady", "RTS", "AuxOut1", "AuxOut2", "Loopback", "Autoflow"/*16750*/];
var FCR_BIT_DESC = ["FIFO enable", "Reset", "XMIT-FIFO-Reset", "DMA-Mode", "Reserved", "Reserved", "RecrTrig(LSB)", "RecrTrig(MSB)"];
var LCR_BIT_DESC = ["WordLen", "WordLen", "StopBits", "Parity", "EvenParity", "StickParity", "Break", "DivisorLatch"];
var MSR_BIT_DESC = ["DeltaCTS", "DeltaDataSetReady", "DeltaRingIndicator", "DeltaCarrierDetect", "ClearToSend", "DataSetReady", "RingIndicator", "CarrierDetect"];
var LSR_BIT_DESC = ["RxDataAvail", "OverrunErr", "ParityErr", "FrameErr", "BreakSignal", "TxEmpty", "TxEmptyLine", "BadRxFifoData"];
var IER_BIT_DESC = ["RxAvailableI", "TxEmptyI", "BreakI", "MSI"];


// constructor
function UARTDev(id, intdev, intno) {
    this.intno = intno;
    this.intdev = intdev;
    this.id = id;
    this.verboseuart = false;
    message.Register("tty" + id, this.ReceiveChar.bind(this) );
    this.Reset();
}

UARTDev.prototype.ToBitDescription = function(val, desc) {
    val &= 0xff;
    var result= ("00000000" + val.toString(2)).substr(-8)+ ":"
    for(var i=0; i < desc.length; i++) {
        result += " " + desc[i] + ":" + ((val>>i)&1);
    }
    return result;
}

UARTDev.prototype.Reset = function() {

    this.LCR = 0x3; // Line Control, reset, character has 8 bits
    this.LSR = UART_LSR_TRANSMITTER_EMPTY | UART_LSR_TX_EMPTY; // Transmitter serial register empty and Transmitter buffer register empty
    this.MSR = UART_MSR_DCD | UART_MSR_DSR | UART_MSR_CTS; // modem status register
    this.ints = 0x0; // internal interrupt pending register
    this.IIR = UART_IIR_NO_INT; // Interrupt Identification, no interrupt
    this.IER = 0x0; //Interrupt Enable
    this.DLL = 0x0;
    this.DLH = 0x0;
    this.FCR = 0x0; // FIFO Control;
    this.MCR = 0x0; // Modem Control

    this.rxbuf = new Array(); // receive fifo buffer.
    this.txbuf = new Array(); // transmit fifo buffer.
}

UARTDev.prototype.Step = function() {
    if(this.txbuf.length != 0) {
        message.Send("tty" + this.id, this.txbuf);
        this.txbuf = new Array();
    }
}

// To prevent the character from being overwritten we use a javascript array-based fifo and request a character timeout. 
UARTDev.prototype.ReceiveChar = function(data) {
    data.forEach(function(c) {
        this.rxbuf.push(c&0xFF);
    }.bind(this));
    if (this.verboseuart) message.Debug("Received bytes: " + this.rxbuf.length);
    if (this.rxbuf.length > 0) {
        this.LSR |= UART_LSR_DATA_READY;
        this.ThrowInterrupt(UART_IIR_CTI);
    }
}

UARTDev.prototype.CheckInterrupt = function() {
    if (this.verboseuart) message.Debug("Check Interrupt " + this.ints);

    if ((this.LSR & UART_LSR_INT_ANY) && (this.IER & UART_IER_RLSI)) {
        this.IIR = UART_IIR_RLSI;
        if (this.verboseuart) message.Debug('IIR_RLSI ' + this.intno);
        this.intdev.RaiseInterrupt(this.intno);
    } else
    if ((this.ints & (1 << UART_IIR_CTI)) && (this.IER & UART_IER_RDI)) {
        this.IIR = UART_IIR_CTI;
        if (this.verboseuart) message.Debug('IIR_CTI ' + this.intno);
        this.intdev.RaiseInterrupt(this.intno);
    } else
    if ((this.ints & (1 << UART_IIR_THRI)) && (this.IER & UART_IER_THRI)) {
        this.IIR = UART_IIR_THRI;
        if (this.verboseuart) message.Debug('IIR_THRI ' + this.intno);
        this.intdev.RaiseInterrupt(this.intno);
    } else
    if ((this.ints & (1 << UART_IIR_MSI))  && (this.IER & UART_IER_MSI)) {
        this.IIR = UART_IIR_MSI;
        if (this.verboseuart) message.Debug('IIR_MSI ' + this.intno);
        this.intdev.RaiseInterrupt(this.intno);
    } else {
        this.IIR = UART_IIR_NO_INT;
        if (this.verboseuart) message.Debug('IIR_NO_INT ' + this.intno);
        this.intdev.ClearInterrupt(this.intno);
    }
};

UARTDev.prototype.ThrowInterrupt = function(line) {
    this.ints |= (1 << line);
    this.CheckInterrupt();
}

UARTDev.prototype.ClearInterrupt = function(line) {
    this.ints &= ~(1 << line);
    this.CheckInterrupt();
};

UARTDev.prototype.ReadReg8 = function(addr) {

    if (this.LCR & UART_LCR_DLAB) {  // Divisor latch access bit
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

    case UART_RXBUF:
        var ret = 0x0; // if the buffer is empty, return 0
        if (this.rxbuf.length > 0) {
            ret = this.rxbuf.shift();
        }
        if (this.verboseuart) message.Debug("Get RXBUF");
        if (this.rxbuf.length == 0) {
            this.LSR &= ~UART_LSR_DATA_READY;
            this.ClearInterrupt(UART_IIR_CTI);
        }
        return ret & 0xFF;
        break;

    case UART_IER:
        return this.IER & 0x0F;
        break;

    case UART_MSR:
        var ret = this.MSR;
        this.MSR &= 0xF0; // reset lowest 4 "delta" bits
        if (this.verboseuart) message.Debug("Get UART_MSR " + this.ToBitDescription(ret, MSR_BIT_DESC));
        return ret;
        break;

    case UART_IIR:
        {
            // the two top bits (fifo enabled) are always set
            var ret = (this.IIR & 0x0F) | 0xC0;

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
        // This gets polled many times a second, so logging is commented out
        if (this.verboseuart) message.Debug("Get UART_LSR " + this.ToBitDescription(this.LSR, LSR_BIT_DESC));
        return this.LSR;
        break;

    default:
        message.Debug("Error in ReadRegister: not supported");
        message.Abort();
        break;
    }
};

UARTDev.prototype.WriteReg8 = function(addr, x) {
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

    case UART_TXBUF: 
         // we assume here, that the fifo is on

         // In the uart spec we reset UART_IIR_THRI now ...
        this.LSR &= ~UART_LSR_TRANSMITTER_EMPTY;
        this.LSR &= ~UART_LSR_TX_EMPTY;

        this.txbuf.push(x);
        if (this.verboseuart) message.Debug("send " + x);
        // the data is sent immediately
        this.LSR |= UART_LSR_TRANSMITTER_EMPTY | UART_LSR_TX_EMPTY; // txbuffer is empty immediately
        this.ThrowInterrupt(UART_IIR_THRI);
        break;

    case UART_IER:
        // 2 = 10b ,5=101b, 7=111b
        this.IER = x & 0x0F; // only the first four bits are valid
        this.ints &= ~(1 << UART_IER_THRI);
        if (this.verboseuart) message.Debug("Set UART_IER " + this.ToBitDescription(x, IER_BIT_DESC));
        // Check immediately if there is a interrupt pending
        this.CheckInterrupt();
        break;

    case UART_FCR:
        if (this.verboseuart) message.Debug("Set UART_FCR " + this.ToBitDescription(x, FCR_BIT_DESC));
        this.FCR = x & 0xC9;
        if (x & 2) {
            this.ClearInterrupt(UART_IIR_CTI);
            this.rxbuf = new Array(); // clear receive fifo buffer
        }
        if (x & 4) {
            this.txbuf = new Array(); // clear transmit fifo buffer
            this.ClearInterrupt(UART_IIR_THRI);
        }
        break;

    case UART_LCR:
        if (this.verboseuart)  message.Debug("Set UART_LCR " + this.ToBitDescription(x, LCR_BIT_DESC));
        if ((this.LCR & 3) != 3) {
            message.Debug("Warning in UART: Data word length other than 8 bits are not supported");
        }
        this.LCR = x;
        break;

    case UART_MCR:
        if (this.verboseuart) message.Debug("Set UART_MCR " + this.ToBitDescription(x,MCR_BIT_DESC));
        this.MCR = x;
        break;

    default:
        message.Debug("Error in WriteRegister: not supported");
        message.Abort();
        break;
    }
};


module.exports = UARTDev;

},{"../messagehandler":33,"../utils":48}],16:[function(require,module,exports){
// -------------------------------------------------
// ------------------- VIRTIO ----------------------
// -------------------------------------------------
// Implementation of the virtio mmio device and virtio ring
//
// the following documentation were used
// http://wiki.osdev.org/Virtio
// http://lxr.free-electrons.com/source/Documentation/virtual/virtio-spec.txt?v=3.4
// http://swtch.com/plan9port/man/man9/
// http://lxr.free-electrons.com/source/net/9p/error.c?v=3.1
// https://lists.gnu.org/archive/html/qemu-devel/2011-12/msg02712.html
// http://www-numi.fnal.gov/offline_software/srt_public_context/WebDocs/Errors/unix_system_errors.html
// https://github.com/ozaki-r/arm-js/tree/master/js
// the memory layout can be found here: include/uapi/linux/virtio_ring.h

"use strict";

var utils = require('../utils');
var marshall = require('./virtio/marshall');
var message = require('../messagehandler');

var VIRTIO_MAGIC_REG = 0x0;
var VIRTIO_VERSION_REG = 0x4;
var VIRTIO_DEVICE_REG = 0x8;
var VIRTIO_VENDOR_REG = 0xC;
var VIRTIO_HOSTFEATURES_REG = 0x10;
var VIRTIO_HOSTFEATURESSEL_REG = 0x14;
var VIRTIO_GUESTFEATURES_REG = 0x20;
var VIRTIO_GUESTFEATURESSEL_REG = 0x24;
var VIRTIO_GUEST_PAGE_SIZE_REG = 0x28;
var VIRTIO_QUEUESEL_REG = 0x30;
var VIRTIO_QUEUENUMMAX_REG = 0x34;
var VIRTIO_QUEUENUM_REG = 0x38;
var VIRTIO_QUEUEALIGN_REG = 0x3C;
var VIRTIO_QUEUEPFN_REG = 0x40;
var VIRTIO_QUEUE_READY = 0x44;
var VIRTIO_QUEUENOTIFY_REG = 0x50;
var VIRTIO_INTERRUPTSTATUS_REG = 0x60;
var VIRTIO_INTERRUPTACK_REG = 0x64;
var VIRTIO_STATUS_REG = 0x70;
var VIRTIO_QUEUE_DESC_LOW = 0x80;
var VIRTIO_QUEUE_DESC_HIGH = 0x84;
var VIRTIO_QUEUE_AVAIL_LOW = 0x90;
var VIRTIO_QUEUE_AVAIL_HIGH = 0x94;
var VIRTIO_QUEUE_USED_LOW = 0xA0;
var VIRTIO_QUEUE_USED_HIGH = 0xA4;
var VIRTIO_CONFIG_GENERATION = 0xFC;

var VRING_DESC_F_NEXT =      1; /* This marks a buffer as continuing via the next field. */
var VRING_DESC_F_WRITE =     2; /* This marks a buffer as write-only (otherwise read-only). */
var VRING_DESC_F_INDIRECT =  4; /* This means the buffer contains a list of buffer descriptors. */


// non aligned copy
function CopyMemoryToBuffer(from, to, offset, size) {
    for(var i=0; i<size; i++)
        to[i] = from.Read8(offset+i);
}

function CopyBufferToMemory(from, to, offset, size) {
    for(var i=0; i<size; i++)
        to.Write8(offset+i, from[i]);
}

function VirtIODev(intdev, intno, ramdev, device) {
    this.dev = device;
    this.dev.SendReply = this.SendReply.bind(this);
    this.intdev = intdev;
    this.intno = intno;
    this.ramdev = ramdev;

    this.queuenum = new Uint32Array(0x10);
    this.queueready = new Uint32Array(0x10);
    this.queuepfn = new Uint32Array(0x10);
    this.descaddr = new Uint32Array(0x10);
    this.usedaddr = new Uint32Array(0x10);
    this.availaddr = new Uint32Array(0x10);
    this.lastavailidx = new Uint32Array(0x10);

    //this.version = 1;
    this.version = 2; // for Linux > 4.0

    this.Reset();
}

VirtIODev.prototype.Reset = function() {
    this.status = 0x0;
    this.intstatus = 0x0;
    this.pagesize = 0x2000;
    this.align = 0x2000;
    this.availidx = 0x0;
    this.hostfeaturewordselect = 0x0;

    this.queuesel = 0x0;

    for(var i=0; i<0x10; i++) {
        this.queueready[i] = 0x0;
        this.queuenum[i] = 0x10;
        this.queuepfn[i] = 0x0;
        this.descaddr[i] = 0x0;
        this.usedaddr[i] = 0x0;
        this.availaddr[i] = 0x0;
        this.lastavailidx[i] = 0x0;
    }
}

// Ring buffer addresses
VirtIODev.prototype.UpdateAddr = function() {
    if (this.version != 1) return;
    var i = this.queuesel;
    this.descaddr[i] = this.queuepfn[i] * this.pagesize;
    this.availaddr[i] = this.descaddr[i] + this.queuenum[i]*16;
    this.usedaddr[i] = this.availaddr[i] + 2 + 2 + this.queuenum[i]*2 + 2;
    if (this.usedaddr[i] & (this.align-1)) { // padding to next align boundary
        var mask = ~(this.align - 1);
        this.usedaddr[i] = (this.usedaddr[i] & mask) + this.align;
    }
    this.lastavailidx[i] = this.ramdev.Read16Little(this.availaddr[i] + 2);
}

VirtIODev.prototype.ReadReg8 = function (addr) {
    //message.Debug("read8 configspace of int " + this.intno + " : " + (addr-0x100));
    return this.dev.configspace[addr-0x100];
}

VirtIODev.prototype.ReadReg16 = function (addr) {
    //message.Debug("read16 configspace16 of int " + this.intno + " : " + (addr-0x100));
    if (this.ramdev.nativeendian == "little") {
        return (this.dev.configspace[addr-0x100+1]<<8) | (this.dev.configspace[addr-0x100  ]);
    } else
        return (this.dev.configspace[addr-0x100  ]<<8) | (this.dev.configspace[addr-0x100+1]);
}

VirtIODev.prototype.WriteReg8 = function (addr, value) {
    //message.Debug("write8 configspace of int " + this.intno + " : " + (addr-0x100) + " " + value);
    this.dev.WriteConfig(addr-0x100, value);
}

VirtIODev.prototype.ReadReg32 = function (addr) {
    var val = 0x0;
    //message.Debug("VirtIODev: read register of int "  + this.intno + " : " + utils.ToHex(addr));
    if (addr >= 0x100) {
        //message.Debug("read32 configspace of int " + this.intno + " : " + (addr-0x100));
        return (
            (this.dev.configspace[addr-0x100+0]<<24) | 
            (this.dev.configspace[addr-0x100+1]<<16) |
            (this.dev.configspace[addr-0x100+2]<<8) |
            (this.dev.configspace[addr-0x100+3]<<0) );
    }

    switch(addr)
    {
        case VIRTIO_MAGIC_REG:
            val = 0x74726976; // "virt"
            break;

        case VIRTIO_VERSION_REG:
            val = this.version;
            break;

        case VIRTIO_DEVICE_REG:
            val = this.dev.deviceid;
            break;

        case VIRTIO_VENDOR_REG:
            val = 0xFFFFFFFF;
            break;

        case VIRTIO_HOSTFEATURES_REG:
            //message.Debug("virtio: Read hostfeatures register");
            val = 0x0;
            if (this.hostfeaturewordselect == 0) {
                val = this.dev.hostfeature;
            } else
            if (this.hostfeaturewordselect == 1) {
                val = 0x1; // VIRTIO_F_VERSION_1
            }
            break;

        case VIRTIO_QUEUENUMMAX_REG:
            val = this.queuenum[this.queuesel];
            break;

        case VIRTIO_QUEUEPFN_REG:
            val = this.queuepfn[this.queuesel];
            break;

        case VIRTIO_QUEUE_READY:
            val = this.queueready[this.queuesel];
            break;

        case VIRTIO_INTERRUPTSTATUS_REG:
            val = this.intstatus;
            break;

        case VIRTIO_STATUS_REG:
            val = this.status;
            break;

        case VIRTIO_CONFIG_GENERATION:
            val = 0x0;
            break;

        default:
            message.Debug("Error in VirtIODev: Attempt to read register " + utils.ToHex(addr));
            message.Abort();
            break;
    }
    if (this.ramdev.nativeendian == "little") {
        return val;
    } else {
        return utils.Swap32(val);
    }
};

VirtIODev.prototype.GetDescriptor = function(queueidx, index) {

    var addr = this.descaddr[queueidx] + index * 16;
    var buffer = new Uint8Array(16);
    CopyMemoryToBuffer(this.ramdev, buffer, addr, 16);

    var desc = marshall.Unmarshall(["d", "w", "h", "h"], buffer, 0);
    //message.Debug("GetDescriptor: index=" + index + " addr=" + utils.ToHex(desc[1]) + " len=" + desc[2] + " flags=" + desc[3]  + " next=" + desc[4]);

    return {
        addr: desc[0],
        len: desc[1],
        flags: desc[2],
        next: desc[3]
    };
}


VirtIODev.prototype.ConsumeDescriptor = function(queueidx, descindex, desclen) {

    // update used index
    var usedidxaddr = this.usedaddr[queueidx] + 2;
    var index = this.ramdev.Read16Little(usedidxaddr);
    this.ramdev.Write16Little(usedidxaddr, index+1 );

    //message.Debug("used index:" + index + " descindex=" + descindex);

    var usedaddr = this.usedaddr[queueidx] + 4 + (index & (this.queuenum[queueidx]-1)) * 8;
    this.ramdev.Write32Little(usedaddr+0, descindex);
    this.ramdev.Write32Little(usedaddr+4, desclen);
}

VirtIODev.prototype.SendReply = function (queueidx, index) {
    //message.Debug("Send Reply index="+index + " size=" + this.dev.replybuffersize);
    this.ConsumeDescriptor(queueidx, index, this.dev.replybuffersize);

    var availflag = this.ramdev.Read16Little(this.availaddr[queueidx]);

    // no data? So skip the rest
    if (this.dev.replybuffersize == 0) {
        // interrupts disabled?
        //if ((availflag&1) == 0) {
            this.intstatus = 1;
            this.intdev.RaiseInterrupt(this.intno);
        //}
        return;
    }

    var desc = this.GetDescriptor(queueidx, index);
    while ((desc.flags & VRING_DESC_F_WRITE) == 0) {
        if (desc.flags & 1) { // continuing buffer
            desc = this.GetDescriptor(queueidx, desc.next);
        } else {
            message.Debug("Error in virtiodev: Descriptor is not continuing");
            message.Abort();
        }
    }
    
    if ((desc.flags & VRING_DESC_F_WRITE) == 0) {
        message.Debug("Error in virtiodev: Descriptor is not allowed to write");
        message.Abort();
    }

    var offset = 0;
    for(var i=0; i<this.dev.replybuffersize; i++) {
        if (offset >= desc.len) {
            desc = this.GetDescriptor(0, desc.next);
            offset = 0;            
            if ((desc.flags & VRING_DESC_F_WRITE) == 0) {
                message.Debug("Error in virtiodev: Descriptor is not allowed to write");
                message.Abort();
            }
        }
        this.ramdev.Write8(desc.addr+offset, this.dev.replybuffer[i]);
        offset++;
    }

    // interrupts disabled?
    //if ((availflag&1) == 0) {
        this.intstatus = 1;
        this.intdev.RaiseInterrupt(this.intno);
    //}
}


VirtIODev.prototype.GetDescriptorBufferSize = function (queueidx, index) {
    
    var wsize = 0x0;
    var rsize = 0x0;

    var desc = this.GetDescriptor(queueidx, index);

    for(;;) {
        if (desc.flags & VRING_DESC_F_INDIRECT) {
            message.Debug("Error in VirtIO: Indirect descriptors not supported");
            message.Abort();
        }
        if (desc.flags & VRING_DESC_F_WRITE) {
            wsize += desc.len;
        } else {
            rsize += desc.len;
        }
        if ((desc.flags&1) == 0) { // continue?
            break;
        }
        var desc = this.GetDescriptor(queueidx, desc.next);
    }

    return {write: wsize, read: rsize};
}


VirtIODev.prototype.WriteReg32 = function (addr, val) {

    if (this.ramdev.nativeendian == "big") {
        val = utils.Swap32(val);
    }

    //message.Debug("VirtIODev: write register of int "  + this.intno + " : " + utils.ToHex(addr) + " = " + val);

    switch(addr)
    {
        case VIRTIO_GUEST_PAGE_SIZE_REG:
            this.pagesize = val;
            this.UpdateAddr();
            //message.Debug("Guest page size : " + utils.ToHex(val));
            break;

        case VIRTIO_HOSTFEATURESSEL_REG:
            this.hostfeaturewordselect = val;
            //message.Debug("write hostfeaturesel reg : " + utils.ToHex(val));
            break;

        case VIRTIO_GUESTFEATURESSEL_REG:
            //message.Debug("write guestfeaturesel reg : " + utils.ToHex(val));
            break;

        case VIRTIO_GUESTFEATURES_REG:
            //message.Debug("write guestfeatures reg : " + utils.ToHex(val));
            break;

        case VIRTIO_QUEUESEL_REG:
            this.queuesel = val;
            //message.Debug("write queuesel reg : " + utils.ToHex(val));
            break;

        case VIRTIO_QUEUENUM_REG:
            this.queuenum[this.queuesel] = val;
            this.UpdateAddr();
            //message.Debug("write queuenum reg : " + utils.ToHex(val));
            break;

        case VIRTIO_QUEUEALIGN_REG:
            //message.Debug("write queuealign reg : " + utils.ToHex(val));
            this.align = val;
            this.pagesize = val;
            this.UpdateAddr();
            break;

        case VIRTIO_QUEUEPFN_REG:
            this.queuepfn[this.queuesel] = val;
            this.UpdateAddr();
            //message.Debug("write queuepfn reg : " + utils.ToHex(val));
            break;

        case VIRTIO_QUEUENOTIFY_REG:
            var queueidx = val;

            var availidx = this.ramdev.Read16Little(this.availaddr[queueidx] + 2);
            //message.Debug("write queuenotify reg : " + utils.ToHex(queueidx) + " " + availidx);
            
            while(this.lastavailidx[queueidx] != availidx)
            {
                var currentavailidx = this.lastavailidx[queueidx] & (this.queuenum[queueidx]-1);
                var currentdescindex = this.ramdev.Read16Little(this.availaddr[val] + 4 + currentavailidx*2);

                //message.Debug("" + queueidx + " " + availidx + " " + currentavailidx + " " + currentdescindex);

                var size = this.GetDescriptorBufferSize(queueidx, currentdescindex);

                // build stream function
                var offset = 0;
                var desc = this.GetDescriptor(queueidx, currentdescindex);

                var GetByte = 
                (function(queueidx, offset, desc) {
                    return function() {
                        if (offset >= desc.len) {
                            offset = 0;
                            if (desc.flags & 1) { // continuing buffer
                                desc = this.GetDescriptor(queueidx, desc.next);
                            } else {
                                message.Debug("Error in virtiodev: Descriptor is not continuing");
                                message.Abort();
                            }
                        }
                        var x = this.ramdev.Read8(desc.addr + offset);
                        offset++;
                        return x;
                    }.bind(this);
                }.bind(this))(queueidx, offset, desc);

                this.dev.ReceiveRequest(queueidx, currentdescindex, GetByte, size);
                this.lastavailidx[queueidx]++;
                this.lastavailidx[queueidx] &= 0xFFFF;
            }

            break;

        case VIRTIO_QUEUE_READY:
            this.queueready[this.queuesel] = val;
            break;


        case VIRTIO_INTERRUPTACK_REG:
            //message.Debug("write interruptack reg : " + utils.ToHex(val));
            this.intstatus &= ~val;
            this.intdev.ClearInterrupt(this.intno);
            break;

        case VIRTIO_STATUS_REG:
            //message.Debug("write status reg : " + utils.ToHex(val));
            this.status = val;
            switch(this.status) {
                case 0: // reset
                    this.intdev.ClearInterrupt(this.intno);
                    this.intstatus = 0;
                    this.Reset();
                    break;
                case 1: // acknowledge (found the device, valid virtio device)
                    break;
                case 3: //acknoledge + driver (driver present)
                    break;
                case 7: // ??
                    break;
                case 11: //acknowledge + driver + features Ok
                    break;
                case 15: //acknowledge + driver + features Ok + driver_ok (Let's start)
                    break;
                case 131: // acknowledge + driver + failed
                    message.Debug("Error: virtio device initialization failed with status " + this.status);
                    message.Abort();
                case 139: // acknowledge + driver + features Ok + failed
                    message.Debug("Error: virtio device initialization failed with status " + this.status);
                    message.Abort();
                    break;
                default:
                    message.Debug("Error in virtio status register: Unknown status " + this.status);
                    message.Abort();
                    break;
            }
            break;

            case VIRTIO_QUEUE_DESC_LOW:
                this.descaddr[this.queuesel] = val;
                break;

            case VIRTIO_QUEUE_DESC_HIGH:
                break;

            case VIRTIO_QUEUE_AVAIL_LOW:
                this.availaddr[this.queuesel] = val;
                this.lastavailidx[this.queuesel] = this.ramdev.Read16Little(this.availaddr[this.queuesel] + 2);
                break;

            case VIRTIO_QUEUE_AVAIL_HIGH:
                break;

            case VIRTIO_QUEUE_USED_LOW:
                this.usedaddr[this.queuesel] = val;
                break;

            case VIRTIO_QUEUE_USED_HIGH:
                break;


        default:
            message.Debug("Error in VirtIODev: Attempt to write register " + utils.ToHex(addr) + ":" + utils.ToHex(val));
            message.Abort();
            break;
    }

};


module.exports = VirtIODev;

},{"../messagehandler":33,"../utils":48,"./virtio/marshall":23}],17:[function(require,module,exports){
// -------------------------------------------------
// --------------------- 9P ------------------------
// -------------------------------------------------
// Implementation of the 9p filesystem device following the 
// 9P2000.L protocol ( https://code.google.com/p/diod/wiki/protocol )

"use strict";

var marshall = require('./marshall');
var message = require('../../messagehandler');
var utils = require('../../utils');

// TODO
// flush
// lock?
// correct hard links

var S_IFDIR = 0x4000;

var EPERM = 1;       /* Operation not permitted */
var ENOENT = 2;      /* No such file or directory */
var EINVAL = 22;     /* Invalid argument */
var ENOTSUPP = 524;  /* Operation is not supported */
var ENOTEMPTY = 39;  /* Directory not empty */
var EPROTO    = 71   /* Protocol error */

var P9_SETATTR_MODE = 0x00000001;
var P9_SETATTR_UID = 0x00000002;
var P9_SETATTR_GID = 0x00000004;
var P9_SETATTR_SIZE = 0x00000008;
var P9_SETATTR_ATIME = 0x00000010;
var P9_SETATTR_MTIME = 0x00000020;
var P9_SETATTR_CTIME = 0x00000040;
var P9_SETATTR_ATIME_SET = 0x00000080;
var P9_SETATTR_MTIME_SET = 0x00000100;

var P9_STAT_MODE_DIR = 0x80000000;
var P9_STAT_MODE_APPEND = 0x40000000;
var P9_STAT_MODE_EXCL = 0x20000000;
var P9_STAT_MODE_MOUNT = 0x10000000;
var P9_STAT_MODE_AUTH = 0x08000000;
var P9_STAT_MODE_TMP = 0x04000000;
var P9_STAT_MODE_SYMLINK = 0x02000000;
var P9_STAT_MODE_LINK = 0x01000000;
var P9_STAT_MODE_DEVICE = 0x00800000;
var P9_STAT_MODE_NAMED_PIPE = 0x00200000;
var P9_STAT_MODE_SOCKET = 0x00100000;
var P9_STAT_MODE_SETUID = 0x00080000;
var P9_STAT_MODE_SETGID = 0x00040000;
var P9_STAT_MODE_SETVTX = 0x00010000;

var FID_NONE = -1;
var FID_INODE = 1;
var FID_XATTR = 2;

// small 9p device
function Virtio9p(ramdev, filesystem) {
    this.fs = filesystem;
    this.SendReply = function() {};
    this.deviceid = 0x9; // 9p filesystem
    this.hostfeature = 0x1; // mountpoint
    this.configspace = [0x9, 0x0, 0x2F, 0x64, 0x65, 0x76, 0x2F, 0x72, 0x6F, 0x6F, 0x74 ]; // length of string and "/dev/root" string
    this.VERSION = "9P2000.L";
    this.BLOCKSIZE = 8192; // Let's define one page.
    this.msize = 8192; // maximum message size
    this.replybuffer = new Uint8Array(this.msize*2); // Twice the msize to stay on the safe site
    this.replybuffersize = 0;
    this.Reset();
}

Virtio9p.prototype.Createfid = function(inode, type, uid) {
    return {inodeid: inode, type: type, uid: uid};
}

Virtio9p.prototype.Reset = function() {
    this.fids = [];
}


Virtio9p.prototype.BuildReply = function(id, tag, payloadsize) {
    marshall.Marshall(["w", "b", "h"], [payloadsize+7, id+1, tag], this.replybuffer, 0);
    if ((payloadsize+7) >= this.replybuffer.length) {
        message.Debug("Error in 9p: payloadsize exceeds maximum length");
    }
    //for(var i=0; i<payload.length; i++)
    //    this.replybuffer[7+i] = payload[i];
    this.replybuffersize = payloadsize+7;
    return;
}

Virtio9p.prototype.SendError = function (tag, errormsg, errorcode) {
    //var size = marshall.Marshall(["s", "w"], [errormsg, errorcode], this.replybuffer, 7);
    var size = marshall.Marshall(["w"], [errorcode], this.replybuffer, 7);
    this.BuildReply(6, tag, size);
}

Virtio9p.prototype.ReceiveRequest = function (ringidx, index, GetByte) {
    var header = marshall.Unmarshall2(["w", "b", "h"], GetByte);
    var size = header[0];
    var id = header[1];
    var tag = header[2];
    //message.Debug("size:" + size + " id:" + id + " tag:" + tag);

    switch(id)
    {
        case 8: // statfs
            var size = this.fs.GetTotalSize();
            var req = [];
            req[0] = 0x01021997;
            req[1] = this.BLOCKSIZE; // optimal transfer block size
            req[2] = Math.floor(1024*1024*1024/req[1]); // free blocks, let's say 1GB
            req[3] = req[2] - Math.floor(size/req[1]); // free blocks in fs
            req[4] = req[2] - Math.floor(size/req[1]); // free blocks avail to non-superuser
            req[5] = this.fs.inodes.length; // total number of inodes
            req[6] = 1024*1024;
            req[7] = 0; // file system id?
            req[8] = 256; // maximum length of filenames

            var size = marshall.Marshall(["w", "w", "d", "d", "d", "d", "d", "d", "w"], req, this.replybuffer, 7);
            this.BuildReply(id, tag, size);
            this.SendReply(0, index);
            break;

        case 112: // topen
        case 12: // tlopen
            var req = marshall.Unmarshall2(["w", "w"], GetByte);
            var fid = req[0];
            var mode = req[1];
            //message.Debug("[open] fid=" + fid + ", mode=" + mode + ", tag=" + tag);
            var idx = this.fids[fid].inodeid;
            var inode = this.fs.GetInode(idx);
            //message.Debug("file open " + inode.name);
            var ret = this.fs.OpenInode(idx, mode);

            var evfunction = 
                (function(idx, id, tag, index){
                    return function() {
                        var inode = this.fs.GetInode(idx);
                        //message.Debug("file opened " + inode.name + " tag:"+tag);
                        req[0] = inode.qid;
                        req[1] = this.msize - 24;
                        marshall.Marshall(["Q", "w"], req, this.replybuffer, 7);
                        this.BuildReply(id, tag, 13+4);
                        this.SendReply(0, index);
                    }.bind(this);
                }.bind(this))(idx, id, tag, index);

            this.fs.AddEvent(idx, evfunction);
            break;

        case 70: // link (just copying)
            var req = marshall.Unmarshall2(["w", "w", "s"], GetByte);
            var dfid = req[0];
            var fid = req[1];
            var name = req[2];
            //message.Debug("[link] dfid=" + dfid + ", name=" + name);
            var inode = this.fs.CreateInode();
            var inodetarget = this.fs.GetInode(this.fids[fid].inodeid);
            //inode = inodetarget;
            inode.mode = inodetarget.mode;
            inode.size = inodetarget.size;
            inode.symlink = inodetarget.symlink;
            inode.data = new Uint8Array(inode.size);
            for(var i=0; i<inode.size; i++) {
                inode.data[i] = this.fs.ReadByte(inodetarget, i);
            }
            inode.name = name;
            inode.parentid = this.fids[dfid].inodeid;
            this.fs.PushInode(inode);
            
            //inode.uid = inodetarget.uid;
            //inode.gid = inodetarget.gid;
            //inode.mode = inodetarget.mode | S_IFLNK;
            this.BuildReply(id, tag, 0);
            this.SendReply(0, index);       
            break;

        case 16: // symlink
            var req = marshall.Unmarshall2(["w", "s", "s", "w"], GetByte);
            var fid = req[0];
            var name = req[1];
            var symgt = req[2];
            var gid = req[3];
            //message.Debug("[symlink] fid=" + fid + ", name=" + name + ", symgt=" + symgt + ", gid=" + gid); 
            var idx = this.fs.CreateSymlink(name, this.fids[fid].inodeid, symgt);
            var inode = this.fs.GetInode(idx);
            inode.uid = this.fids[fid].uid;
            inode.gid = gid;
            marshall.Marshall(["Q"], [inode.qid], this.replybuffer, 7);
            this.BuildReply(id, tag, 13);
            this.SendReply(0, index);
            break;

        case 18: // mknod
            var req = marshall.Unmarshall2(["w", "s", "w", "w", "w", "w"], GetByte);
            var fid = req[0];
            var name = req[1];
            var mode = req[2];
            var major = req[3];
            var minor = req[4];
            var gid = req[5];
            //message.Debug("[mknod] fid=" + fid + ", name=" + name + ", major=" + major + ", minor=" + minor+ "");
            var idx = this.fs.CreateNode(name, this.fids[fid].inodeid, major, minor);
            var inode = this.fs.GetInode(idx);
            inode.mode = mode;
            inode.uid = this.fids[fid].uid;
            inode.gid = gid;
            marshall.Marshall(["Q"], [inode.qid], this.replybuffer, 7);
            this.BuildReply(id, tag, 13);
            this.SendReply(0, index);
            break;


        case 22: // TREADLINK
            var req = marshall.Unmarshall2(["w"], GetByte);
            var fid = req[0];
            //message.Debug("[readlink] fid=" + fid);
            var inode = this.fs.GetInode(this.fids[fid].inodeid);
            var size = marshall.Marshall(["s"], [inode.symlink], this.replybuffer, 7);
            this.BuildReply(id, tag, size);
            this.SendReply(0, index);
            break;


        case 72: // tmkdir
            var req = marshall.Unmarshall2(["w", "s", "w", "w"], GetByte);
            var fid = req[0];
            var name = req[1];
            var mode = req[2];
            var gid = req[3];
            //message.Debug("[mkdir] fid=" + fid + ", name=" + name + ", mode=" + mode + ", gid=" + gid); 
            var idx = this.fs.CreateDirectory(name, this.fids[fid].inodeid);
            var inode = this.fs.GetInode(idx);
            inode.mode = mode | S_IFDIR;
            inode.uid = this.fids[fid].uid;
            inode.gid = gid;
            marshall.Marshall(["Q"], [inode.qid], this.replybuffer, 7);
            this.BuildReply(id, tag, 13);
            this.SendReply(0, index);
            break;

        case 14: // tlcreate
            var req = marshall.Unmarshall2(["w", "s", "w", "w", "w"], GetByte);
            var fid = req[0];
            var name = req[1];
            var flags = req[2];
            var mode = req[3];
            var gid = req[4];
            //message.Debug("[create] fid=" + fid + ", name=" + name + ", flags=" + flags + ", mode=" + mode + ", gid=" + gid); 
            var idx = this.fs.CreateFile(name, this.fids[fid].inodeid);
            this.fids[fid].inodeid = idx;
            this.fids[fid].type = FID_INODE;
            var inode = this.fs.GetInode(idx);
            inode.uid = this.fids[fid].uid;
            inode.gid = gid;
            inode.mode = mode;
            marshall.Marshall(["Q", "w"], [inode.qid, this.msize - 24], this.replybuffer, 7);
            this.BuildReply(id, tag, 13+4);
            this.SendReply(0, index);
            break;

        case 52: // lock always suceed
            //message.Debug("lock file\n");
            marshall.Marshall(["w"], [0], this.replybuffer, 7);
            this.BuildReply(id, tag, 1);
            this.SendReply(0, index);
            break;

        /*
        case 54: // getlock
            break;        
        */

        case 24: // getattr
            var req = marshall.Unmarshall2(["w", "d"], GetByte);
            var fid = req[0];
            var inode = this.fs.GetInode(this.fids[fid].inodeid);
            //message.Debug("[getattr]: fid=" + fid + " name=" + inode.name + " request mask=" + req[1]);
            req[0] |= 0x1000; // P9_STATS_GEN

            req[0] = req[1]; // request mask
            req[1] = inode.qid;

            req[2] = inode.mode; 
            req[3] = inode.uid; // user id
            req[4] = inode.gid; // group id
            
            req[5] = inode.nlinks; // number of hard links
            req[6] = (inode.major<<8) | (inode.minor); // device id low
            req[7] = inode.size; // size low
            req[8] = this.BLOCKSIZE;
            req[9] = Math.floor(inode.size/512+1);; // blk size low
            req[10] = inode.atime; // atime
            req[11] = 0x0;
            req[12] = inode.mtime; // mtime
            req[13] = 0x0;
            req[14] = inode.ctime; // ctime
            req[15] = 0x0;
            req[16] = 0x0; // btime
            req[17] = 0x0; 
            req[18] = 0x0; // st_gen
            req[19] = 0x0; // data_version
            marshall.Marshall([
            "d", "Q", 
            "w",  
            "w", "w", 
            "d", "d", 
            "d", "d", "d",
            "d", "d", // atime
            "d", "d", // mtime
            "d", "d", // ctime
            "d", "d", // btime
            "d", "d",
            ], req, this.replybuffer, 7);
            this.BuildReply(id, tag, 8 + 13 + 4 + 4+ 4 + 8*15);
            this.SendReply(0, index);
            break;

        case 26: // setattr
            var req = marshall.Unmarshall2(["w", "w", 
                "w", // mode 
                "w", "w", // uid, gid
                "d", // size
                "d", "d", // atime
                "d", "d"] // mtime
            , GetByte);
            var fid = req[0];
            var inode = this.fs.GetInode(this.fids[fid].inodeid);
            //message.Debug("[setattr]: fid=" + fid + " request mask=" + req[1] + " name=" +inode.name);
            if (req[1] & P9_SETATTR_MODE) {
                inode.mode = req[2];
            }
            if (req[1] & P9_SETATTR_UID) {
                inode.uid = req[3];
            }
            if (req[1] & P9_SETATTR_GID) {
                inode.gid = req[4];
            }
            if (req[1] & P9_SETATTR_ATIME_SET) {
                inode.atime = req[6];
            }
            if (req[1] & P9_SETATTR_MTIME_SET) {
                inode.atime = req[8];
            }
            if (req[1] & P9_SETATTR_ATIME) {
                inode.atime = Math.floor((new Date()).getTime()/1000);
            }
            if (req[1] & P9_SETATTR_MTIME) {
                inode.mtime = Math.floor((new Date()).getTime()/1000);
            }
            if (req[1] & P9_SETATTR_CTIME) {
                inode.ctime = Math.floor((new Date()).getTime()/1000);
            }
            if (req[1] & P9_SETATTR_SIZE) {
                this.fs.ChangeSize(this.fids[fid].inodeid, req[5]);
            }
            this.BuildReply(id, tag, 0);
            this.SendReply(0, index);
            break;

        case 50: // fsync
            var req = marshall.Unmarshall2(["w", "d"], GetByte);
            var fid = req[0];
            this.BuildReply(id, tag, 0);
            this.SendReply(0, index);
            break;

        case 40: // TREADDIR
        case 116: // read
            var req = marshall.Unmarshall2(["w", "d", "w"], GetByte);
            var fid = req[0];
            var offset = req[1];
            var count = req[2];
            //if (id == 40) message.Debug("[treaddir]: fid=" + fid + " offset=" + offset + " count=" + count);
            //if (id == 116) message.Debug("[read]: fid=" + fid + " offset=" + offset + " count=" + count);
            var inode = this.fs.GetInode(this.fids[fid].inodeid);
            if (this.fids[fid].type == FID_XATTR) {
                if (inode.caps.length < offset+count) count = inode.caps.length - offset;
                for(var i=0; i<count; i++)
                    this.replybuffer[7+4+i] = inode.caps[offset+i];
            } else {
                if (inode.size < offset+count) count = inode.size - offset;
                for(var i=0; i<count; i++)
                    this.replybuffer[7+4+i] = this.fs.ReadByte(inode, offset+i);
            }
            marshall.Marshall(["w"], [count], this.replybuffer, 7);
            this.BuildReply(id, tag, 4 + count);
            this.SendReply(0, index);
            break;

        case 118: // write
            var req = marshall.Unmarshall2(["w", "d", "w"], GetByte);
            var fid = req[0];
            var offset = req[1];
            var count = req[2];
            //message.Debug("[write]: fid=" + fid + " offset=" + offset + " count=" + count);
            this.fs.Write(this.fids[fid].inodeid, offset, count, GetByte);
            marshall.Marshall(["w"], [count], this.replybuffer, 7);
            this.BuildReply(id, tag, 4);
            this.SendReply(0, index);
            break;

        case 74: // RENAMEAT
            var req = marshall.Unmarshall2(["w", "s", "w", "s"], GetByte);
            var olddirfid = req[0];
            var oldname = req[1];
            var newdirfid = req[2];
            var newname = req[3];
            //message.Debug("[renameat]: oldname=" + oldname + " newname=" + newname);
            var ret = this.fs.Rename(this.fids[olddirfid].inodeid, oldname, this.fids[newdirfid].inodeid, newname);
            if (ret == false) {
                this.SendError(tag, "No such file or directory", ENOENT);                   
                this.SendReply(0, index);
                break;
            }
            this.BuildReply(id, tag, 0);
            this.SendReply(0, index);
            break;

        case 76: // TUNLINKAT
            var req = marshall.Unmarshall2(["w", "s", "w"], GetByte);
            var dirfd = req[0];
            var name = req[1];
            var flags = req[2];
            //message.Debug("[unlink]: dirfd=" + dirfd + " name=" + name + " flags=" + flags);
            var id = this.fs.Search(this.fids[dirfd].inodeid, name);
            if (id == -1) {
                   this.SendError(tag, "No such file or directory", ENOENT);
                   this.SendReply(0, index);
                   break;
            }
            var ret = this.fs.Unlink(id);
            if (!ret) {
                this.SendError(tag, "Directory not empty", ENOTEMPTY);
                this.SendReply(0, index);
                break;
            }
            this.BuildReply(id, tag, 0);
            this.SendReply(0, index);
            break;

        case 100: // version
            var version = marshall.Unmarshall2(["w", "s"], GetByte);
            //message.Debug("[version]: msize=" + version[0] + " version=" + version[1]);
            this.msize = version[0];
            var size = marshall.Marshall(["w", "s"], [this.msize, this.VERSION], this.replybuffer, 7);
            this.BuildReply(id, tag, size);
            this.SendReply(0, index);
            break;

        case 104: // attach
            // return root directorie's QID
            var req = marshall.Unmarshall2(["w", "w", "s", "s", "w"], GetByte);
            var fid = req[0];
            var uid = req[4];
            //message.Debug("[attach]: fid=" + fid + " afid=" + utils.ToHex(req[1]) + " uname=" + req[2] + " aname=" + req[3] + " uid=" + req[4]);
            this.fids[fid] = this.Createfid(0, FID_INODE, uid);
            var inode = this.fs.GetInode(this.fids[fid].inodeid);
            marshall.Marshall(["Q"], [inode.qid], this.replybuffer, 7);
            this.BuildReply(id, tag, 13);
            this.SendReply(0, index);
            break;

        case 108: // tflush
            var req = marshall.Unmarshall2(["h"], GetByte);
            var oldtag = req[0];
            //message.Debug("[flush] " + tag);
            //marshall.Marshall(["Q"], [inode.qid], this.replybuffer, 7);
            this.BuildReply(id, tag, 0);
            this.SendReply(0, index);
            break;


        case 110: // walk
            var req = marshall.Unmarshall2(["w", "w", "h"], GetByte);
            var fid = req[0];
            var nwfid = req[1];
            var nwname = req[2];
            //message.Debug("[walk]: fid=" + req[0] + " nwfid=" + req[1] + " nwname=" + nwname);
            if (nwname == 0) {
                this.fids[nwfid] = this.Createfid(this.fids[fid].inodeid, FID_INODE, this.fids[fid].uid);
                this.fids[nwfid].inodeid = this.fids[fid].inodeid;
                marshall.Marshall(["h"], [0], this.replybuffer, 7);
                this.BuildReply(id, tag, 2);
                this.SendReply(0, index);
                break;
            }
            var wnames = [];
            for(var i=0; i<nwname; i++) {
                wnames.push("s");
            }
            var walk = marshall.Unmarshall2(wnames, GetByte);                        
            var idx = this.fids[fid].inodeid;
            var offset = 7+2;
            var nwidx = 0;
            //message.Debug("walk in dir " + this.fs.inodes[idx].name  + " to :" + walk.toString());
            for(var i=0; i<nwname; i++) {
                idx = this.fs.Search(idx, walk[i]);
                
                if (idx == -1) {
                   //message.Debug("Could not find :" + walk[i]);
                   break;
                }
                offset += marshall.Marshall(["Q"], [this.fs.inodes[idx].qid], this.replybuffer, offset);
                nwidx++;
                //message.Debug(this.fids[nwfid].inodeid);
                this.fids[nwfid] = this.Createfid(idx, FID_INODE, this.fids[fid].uid);
            }
            marshall.Marshall(["h"], [nwidx], this.replybuffer, 7);
            this.BuildReply(id, tag, offset-7);
            this.SendReply(0, index);
            break;

        case 120: // clunk
            var req = marshall.Unmarshall2(["w"], GetByte);
            //message.Debug("[clunk]: fid=" + req[0]);
            
            if (this.fids[req[0]]) 
            if (this.fids[req[0]].inodeid >=  0) {
                this.fs.CloseInode(this.fids[req[0]].inodeid);
                this.fids[req[0]].inodeid = -1;
                this.fids[req[0]].type = FID_NONE;
            }
            this.BuildReply(id, tag, 0);
            this.SendReply(0, index);
            break;

        case 30: // xattrwalk
            var req = marshall.Unmarshall2(["w", "w", "s"], GetByte);
            var fid = req[0];
            var newfid = req[1];
            var name = req[2];
            //message.Debug("[xattrwalk]: fid=" + req[0] + " newfid=" + req[1] + " name=" + req[2]);
            this.fids[newfid] = this.Createfid(this.fids[fid].inodeid, FID_NONE, this.fids[fid].uid);
            var length = 0;
            if (name == "security.capability") {
                length = this.fs.PrepareCAPs(this.fids[fid].inodeid);
                this.fids[newfid].type = FID_XATTR;
            }
            marshall.Marshall(["d"], [length], this.replybuffer, 7);
            this.BuildReply(id, tag, 8);
            this.SendReply(0, index);
            break; 

        default:
            message.Debug("Error in Virtio9p: Unknown id " + id + " received");
            message.Abort();
            //this.SendError(tag, "Operation i not supported",  ENOTSUPP);
            //this.SendReply(0, index);
            break;
    }

    //consistency checks if there are problems with the filesystem
    //this.fs.Check();
}


module.exports = Virtio9p;

},{"../../messagehandler":33,"../../utils":48,"./marshall":23}],18:[function(require,module,exports){
// -------------------------------------------------
// ------------- Block Virtio Device ---------------
// -------------------------------------------------

"use strict";

var message = require('../../messagehandler');
var utils = require('../../utils');
var marshall = require('./marshall');

var VIRTIO_BLK_T_IN          = 0;
var VIRTIO_BLK_T_OUT         = 1;
var VIRTIO_BLK_T_FLUSH       = 4;
var VIRTIO_BLK_T_FLUSH_OUT   = 5;

var VIRTIO_BLK_S_OK        = 0; 
var VIRTIO_BLK_S_IOERR     = 1;
var VIRTIO_BLK_S_UNSUPP    = 2;

function VirtioBlock(ramdev) {
    this.blocks = 100;
    this.configspace = [
        (this.blocks >> 0)&0xFF,
        (this.blocks >> 8)&0xFF,
        (this.blocks >> 16)&0xFF,
        0x0, 0x0, 0x0, 0x0, 0x0]; // the size in little endian

    this.deviceid = 0x2;
    this.hostfeature = 0x0;
    this.replybuffer = new Uint8Array(0x10000); // there is no size limit
    this.replybuffersize = 0;
    this.buffer = new Uint8Array(this.blocks*512);
    this.Reset();
}

VirtioBlock.prototype.Reset = function() {
}

VirtioBlock.prototype.ReceiveRequest = function (queueidx, index, GetByte, size) {
    //message.Debug("block device request: " + queueidx + " " + index + " " + size.read + " " + size.write);
    var request  = marshall.Unmarshall2(["w", "w", "d"], GetByte);
    var type = request[0];
    var sector = request[2];
    //message.Debug("type: " + type + " sector: " + sector);

    switch(type) {
        case VIRTIO_BLK_T_IN:
            if (size.write > 0x10000) {
                message.Debug("Error in virtioblock: replybuffer too small");
                message.Abort();
            }
            for(var i=0; i<size.write-1; i++) {
                this.replybuffer[i] = this.buffer[sector*512+i];
            }
            this.replybuffersize = size.write;
            this.replybuffer[size.write-1] = VIRTIO_BLK_S_OK;
            this.SendReply(0, index);
            break;

        case VIRTIO_BLK_T_OUT:
            for(var i=0; i<size.read-16; i++) {
                this.buffer[sector*512+i] = GetByte();
            }
            this.replybuffersize = 1;
            this.replybuffer[0] = VIRTIO_BLK_S_OK;
            this.SendReply(0, index);
            break;

        case VIRTIO_BLK_T_FLUSH:
            break;

        case VIRTIO_BLK_T_FLUSH_OUT:
            break;
        
        default:
            message.Debug("Error in VirtioBlock: Unknown request type " + type);
            message.Abort();
            break;
    }

}

module.exports = VirtioBlock;

},{"../../messagehandler":33,"../../utils":48,"./marshall":23}],19:[function(require,module,exports){
// -------------------------------------------------
// ------------ Console Virtio Device --------------
// -------------------------------------------------
// http://docs.oasis-open.org/virtio/virtio/v1.0/csprd01/virtio-v1.0-csprd01.html#x1-1230003

"use strict";

var message = require('../../messagehandler');
var utils = require('../../utils');
var marshall = require('./marshall');

var VIRTIO_CONSOLE_DEVICE_READY     = 0;
var VIRTIO_CONSOLE_PORT_ADD         = 1;
var VIRTIO_CONSOLE_PORT_REMOVE      = 2;
var VIRTIO_CONSOLE_PORT_READY       = 3;
var VIRTIO_CONSOLE_CONSOLE_PORT     = 4;
var VIRTIO_CONSOLE_RESIZE           = 5;
var VIRTIO_CONSOLE_PORT_OPEN        = 6;
var VIRTIO_CONSOLE_PORT_NAME        = 7;

function VirtioConsole(ramdev) {
    this.configspace = [80, 0, 24, 0, 1, 0, 0, 0]; // cols, rows, max_nr_ports
    this.deviceid = 0x3;
    this.hostfeature = 0x0;
    //this.hostfeature = 3; // VIRTIO_CONSOLE_F_MULTIPORT and VIRTIO_CONSOLE_F_SIZE
    //this.hostfeature = 2; // VIRTIO_CONSOLE_F_MULTIPORT

    this.replybuffersize = 0;
    this.replybuffer = new Uint8Array(8);

    //message.Register("virtio.tty" + id + ".transfer", this.ReceiveChar.bind(this) );

    this.Reset();
}

VirtioConsole.prototype.Receive = function(chars) {

}

VirtioConsole.prototype.Reset = function() {
}

VirtioConsole.prototype.ReceiveRequest = function (queueidx, index, GetByte, size) {
    message.Debug("Virtio console request of ringbuffer " + queueidx + " " + index + " " + size.read + " " + size.write)

    if (queueidx == 1) {
        var s = "";
        for(var i=0; i<size.read; i++)
        {
            s = s + String.fromCharCode(GetByte());
        }
        message.Debug("Write: " + s);
        this.replybuffersize = 0;
        this.SendReply(queueidx, index);
    }

    if (queueidx == 0) {


    }

    if (queueidx == 3) {
    var request = marshall.Unmarshall2(["w", "h", "h"], GetByte);
    var id = request[0]; /* Port number */
    var event = request[1]; /* The kind of control event */
    var value = request[2]; /* Extra information for the event */

    message.Debug("virtio console: " + id + " " + event + " " + value);
    switch(event) {
        case VIRTIO_CONSOLE_DEVICE_READY:
            this.replybuffersize = 0;
            this.SendReply(queueidx, index);
            break;
        default:
            message.Debug("Error in virtio console: Unknown event");
            message.Abort();
            break;
    }

    }


}

module.exports = VirtioConsole;

},{"../../messagehandler":33,"../../utils":48,"./marshall":23}],20:[function(require,module,exports){
// -------------------------------------------------
// ------------- Dummy Virtio Device ---------------
// -------------------------------------------------

"use strict";

var message = require('../../messagehandler');
var utils = require('../../utils');

function VirtioDummy(ramdev) {
    this.configspace = [0x0];
    this.deviceid = 0x0;
    this.hostfeature = 0x0;
    this.Reset();
}

VirtioDummy.prototype.Reset = function() {
}

VirtioDummy.prototype.ReceiveRequest = function (index, GetByte) {
}

module.exports = VirtioDummy;

},{"../../messagehandler":33,"../../utils":48}],21:[function(require,module,exports){
// -------------------------------------------------
// -------------- GPU Virtio Device ----------------
// -------------------------------------------------
//https://github.com/qemu/qemu/blob/master/hw/display/virtio-gpu.c
//https://www.kraxel.org/cgit/linux/commit/?h=virtio-gpu&id=1a9b48b35ab5961488a401276c7c574f7f90763f
//https://www.kraxel.org/blog/
//https://www.kraxel.org/virtio/virtio-v1.0-csprd03-virtio-gpu.html

"use strict";

var message = require('../../messagehandler');
var utils = require('../../utils');
var marshall = require('./marshall');

var VIRTIO_GPU_UNDEFINED = 0;

/* 2d commands */
var VIRTIO_GPU_CMD_GET_DISPLAY_INFO = 0x0100;
var VIRTIO_GPU_CMD_RESOURCE_CREATE_2D = 0x0101;
var VIRTIO_GPU_CMD_RESOURCE_UNREF = 0x0102;
var VIRTIO_GPU_CMD_SET_SCANOUT = 0x0103;
var VIRTIO_GPU_CMD_RESOURCE_FLUSH = 0x0104;
var VIRTIO_GPU_CMD_TRANSFER_TO_HOST_2D = 0x0105;
var VIRTIO_GPU_CMD_RESOURCE_ATTACH_BACKING = 0x0106;
var VIRTIO_GPU_CMD_RESOURCE_DETACH_BACKING = 0x0107;

/* cursor commands */
var VIRTIO_GPU_CMD_UPDATE_CURSOR = 0x0300;
var VIRTIO_GPU_CMD_MOVE_CURSOR = 0x0301;

/* success responses */
var VIRTIO_GPU_RESP_OK_NODATA = 0x1100;
var VIRTIO_GPU_RESP_OK_DISPLAY_INFO = 0x1101;

/* error responses */
var VIRTIO_GPU_RESP_ERR_UNSPEC = 0x1200;
var VIRTIO_GPU_RESP_ERR_OUT_OF_MEMORY = 0x1201;
var VIRTIO_GPU_RESP_ERR_INVALID_SCANOUT_ID = 0x1202;
var VIRTIO_GPU_RESP_ERR_INVALID_RESOURCE_ID = 0x1203;
var VIRTIO_GPU_RESP_ERR_INVALID_CONTEXT_ID = 0x1204;
var VIRTIO_GPU_RESP_ERR_INVALID_PARAMETER = 0x1205;


var VIRTIO_GPU_EVENT_DISPLAY  = (1 << 0);
/*
struct virtio_gpu_config {
	__u32 events_read;
	__u32 events_clear;
	__u32 num_scanouts;
	__u32 reserved;
};
*/

function VirtioGPU(ramdev) {
    // virtio_gpu_config
    this.configspace = [
    0x0, 0x0, 0x0, 0x0, // events_read: signals pending events to the driver. The driver MUST NOT write to this field. 
    0x0, 0x0, 0x0, 0x0, // events_clear: clears pending events in the device. Writing a ’1’ into a bit will clear the corresponding bit in events_read, mimicking write-to-clear behavior.
    0x1, 0x0, 0x0, 0x0, // num_scanouts maximum 16
    0x0, 0x0, 0x0, 0x0, // reserved
    ];

    this.deviceid = 16;
    this.hostfeature = 0x0;

    this.replybuffersize = 0;
    this.replybuffer = new Uint8Array(1024);

    this.Reset();
}

VirtioGPU.prototype.Reset = function() {
    this.resource = new Array();
}

VirtioGPU.prototype.ReplyOk = function(index) {
    marshall.Marshall(["w", "w", "d", "w", "w"], [VIRTIO_GPU_RESP_OK_NODATA, 0,0,0,0], this.replybuffer, 0);
    this.replybuffersize = 24;
    this.SendReply(0, index);
}


VirtioGPU.prototype.ReceiveRequest = function (queueidx, index, GetByte, size) {
    message.Debug("");
    message.Debug("Virtio GPU request of ringbuffer " + queueidx + " " + index + " " + size.read + " " + size.write);

    if (queueidx != 0) {
        message.Debug("Error in virtio gpu: queue no. " + queueidx + " unknown");
        message.Abort();
    }
    
    // virtio_gpu_ctrl_hdr
    var request = marshall.Unmarshall2(["w", "w", "d", "w", "w"], GetByte);
    var type = request[0];
    var ctx_id = request[3]; // not used in 2D mode
    message.Debug(
    "type: " + type + 
    " flags: " + request[1] + 
    " fence: " + request[2] + 
    " ctx_id: " + ctx_id );


    switch(request[0]) {

// --------------------------

        case VIRTIO_GPU_CMD_GET_DISPLAY_INFO:
            // struct virtio_gpu_resp_display_info
            marshall.Marshall(["w", "w", "d", "w", "w"], [VIRTIO_GPU_RESP_OK_DISPLAY_INFO, 0,0,0,0], this.replybuffer, 0);
            for(var i=0; i<24+16*24; i++) {
                this.replybuffersize[i] = 0x0;
            }
            // one display connected with 1024x768 enabled=1
            marshall.Marshall(["w", "w", "w", "w", "w", "w"], [0, 0, 1024, 768, 1, 0], this.replybuffer, 24);
            message.Debug("get display info");
            this.replybuffersize = 24 + 16*(16+8);
            this.SendReply(queueidx, index);
            break;

// --------------------------

        case VIRTIO_GPU_CMD_RESOURCE_CREATE_2D:
            // struct virtio_gpu_resource_create_2d
            var request = marshall.Unmarshall2(["w", "w", "w", "w"], GetByte);
            var resource_id = request[0];
            var width = request[2];
            var height = request[3];
            var format = request[1];
            if (resource_id == 0) {
                message.Debug("Error in virtio gpu: resource_id is 0");
            }
            this.resource[resource_id] = {
                valid: true, 
                width:width, 
                height:height, 
                format:format, 
                addr:0x0, 
                length: 0x0,
                scanout_id: -1};
            message.Debug("create 2d: " + width  + "x" + height + " format: " + format + " resource_id: " + request[0]);
            this.ReplyOk(index);
            break;

        case VIRTIO_GPU_CMD_RESOURCE_UNREF:
            // struct virtio_gpu_resource_unref
            var request = marshall.Unmarshall2(["w"], GetByte);
            var resource_id = request[0];
            
            this.resource[resource_id].valid = false;
            message.Debug("resource unref: resource_id: " + request[0]);
            this.ReplyOk(index);
            break;

// --------------------------

        case VIRTIO_GPU_CMD_RESOURCE_ATTACH_BACKING:
            // struct virtio_gpu_resource_attach_backing
            var request = marshall.Unmarshall2(["w", "w"], GetByte);
            var nr_entries = request[1];
            var resource_id = request[0];
            message.Debug("attach backing: resource_id: " + resource_id + " nr_entries:" + request[1] );
            for(var i=0; i<nr_entries; i++) {
                // struct virtio_gpu_mem_entry
                var request = marshall.Unmarshall2(["d", "w", "w"], GetByte);
                message.Debug("attach backing: addr:" + utils.ToHex(request[0]) + " length: " + request[1]);
                this.resource[resource_id].addr = request[0];
                this.resource[resource_id].length = request[1];
            }
            this.ReplyOk(index);
            break;

        case VIRTIO_GPU_CMD_RESOURCE_DETACH_BACKING:
            // struct virtio_gpu_resource_detach_backing
            var request = marshall.Unmarshall2(["w"], GetByte);
            var resource_id = request[0];
            message.Debug("detach backing: resource_id: " + resource_id);
            this.resource[resource_id].addr = 0x0;
            this.resource[resource_id].length = 0x0;
            this.ReplyOk(index);
            break;

// --------------------------

        case VIRTIO_GPU_CMD_SET_SCANOUT:
            var request = marshall.Unmarshall2(["w", "w", "w", "w", "w", "w"], GetByte);
            var x = request[0];
            var y = request[1];
            var width = request[2];
            var height = request[3];
            var scanout_id = request[4];
            var resource_id = request[5];
            message.Debug("set scanout: x: " + x + " y: " + y + " width: " + width + " height: " + height + " scanout_id: " + scanout_id + " resource_id: " + resource_id);
            if (resource_id != 0)
                this.resource[resource_id].scanout_id = scanout_id;
            this.ReplyOk(index);
            break;

        default:
            message.Debug("Error in virtio gpu: Unknown type " + type);
            message.Abort();
        break;
    }


}

module.exports = VirtioGPU;

},{"../../messagehandler":33,"../../utils":48,"./marshall":23}],22:[function(require,module,exports){
// -------------------------------------------------
// ------------- Input Virtio Device ---------------
// -------------------------------------------------
// https://github.com/torvalds/linux/blob/master/include/uapi/linux/virtio_input.h
// https://github.com/torvalds/linux/blob/master/drivers/virtio/virtio_input.c

// https://lwn.net/Articles/637590/
// http://lxr.free-electrons.com/source/include/uapi/linux/input.h

"use strict";

var message = require('../../messagehandler');
var utils = require('../../utils');
var marshall = require('./marshall');

var VIRTIO_INPUT_CFG_UNSET      = 0x00; 
var VIRTIO_INPUT_CFG_ID_NAME    = 0x01;  
var VIRTIO_INPUT_CFG_ID_SERIAL  = 0x02;  
var VIRTIO_INPUT_CFG_ID_DEVIDS  = 0x03;
var VIRTIO_INPUT_CFG_PROP_BITS  = 0x10;
var VIRTIO_INPUT_CFG_EV_BITS    = 0x11;  
var VIRTIO_INPUT_CFG_ABS_INFO   = 0x12;

var EV_SYN                = 0x00;
var EV_KEY                = 0x01;
var EV_REL                = 0x02;
var EV_ABS                = 0x03;
var EV_MSC                = 0x04;
var EV_SW                 = 0x05;
var EV_LED                = 0x11;
var EV_SND                = 0x12;
var EV_REP                = 0x14;
var EV_FF                 = 0x15;
var EV_PWR                = 0x16;
var EV_FF_STATUS          = 0x17;
var EV_MAX                = 0x1f;
var EV_CNT                = (EV_MAX+1);

function VirtioInput(ramdev) {
    this.configspace = new Uint8Array(256);
    this.deviceid = 18;
    this.hostfeature = 0x0;

    // TODO remove old keyboard driver
    message.Register("virtio.kbd.keydown", this.OnKeyDown.bind(this) );
    message.Register("virtio.kbd.keyup", this.OnKeyUp.bind(this) );
    
    this.replybuffersize = 8;
    this.replybuffer = new Uint8Array(8);

    this.Reset();
}

VirtioInput.prototype.Reset = function() {
    this.receivebufferdesc = new Array();
}


VirtioInput.prototype.OnKeyDown = function(event) {
    if (this.receivebufferdesc.length == 0) return;
    var desc = this.receivebufferdesc[0];
    this.receivebufferdesc.shift();
    this.replybuffersize = 8;
    // type, code and value
    marshall.Marshall(["h", "h", "w"], [EV_KEY, event.keyCode, 1], this.replybuffer, 0);
    this.SendReply(0, desc.idx);

}

VirtioInput.prototype.OnKeyUp = function(event) {
    if (this.receivebufferdesc.length == 0) return;
    var desc = this.receivebufferdesc[0];
    this.receivebufferdesc.shift();
    this.replybuffersize = 8;
    // type, code and value
    marshall.Marshall(["h", "h", "w"], [EV_KEY, event.keyCode, 0], this.replybuffer, 0);
    this.SendReply(0, desc.idx);
}


VirtioInput.prototype.WriteConfig = function (addr, val) {
    this.configspace[addr] = val;
    if (addr != 1) return;
    //message.Debug("virtioinput configtype: " + this.configspace[0x0] + " " + this.configspace[0x1]);
    
    switch(this.configspace[0x0]) {
        case VIRTIO_INPUT_CFG_UNSET:
            break;

        case VIRTIO_INPUT_CFG_ID_NAME:
            this.configspace[2] = 5; // size
            this.configspace[8] = 0x56; // "V"
            this.configspace[9] = 0x4B; // "K"
            this.configspace[10] = 0x42; // "B"
            this.configspace[11] = 0x44; // "D"
            this.configspace[12] = 0;
            break;

        case VIRTIO_INPUT_CFG_ID_SERIAL:
            this.configspace[2] = 0; // size
            this.configspace[8] = 0;
            break;

        case VIRTIO_INPUT_CFG_ID_DEVIDS:
            this.configspace[2] = 0; // size
            break;

        case VIRTIO_INPUT_CFG_PROP_BITS:
            this.configspace[2] = 0;
            break;

        case VIRTIO_INPUT_CFG_EV_BITS:
            switch(this.configspace[1]) {
                case EV_REP:
                    this.configspace[2] = 0;
                    break;

                case EV_KEY:
                    this.configspace[2] = 128/8;
                    this.configspace[8] = 0xFF;
                    this.configspace[9] = 0xFF;
                    this.configspace[10] = 0xFF;
                    this.configspace[11] = 0xFF;
                    this.configspace[12] = 0xFF;
                    this.configspace[13] = 0xFF;
                    this.configspace[14] = 0xFF;
                    this.configspace[15] = 0xFF;
                    this.configspace[16] = 0xFF;
                    this.configspace[17] = 0xFF;
                    this.configspace[18] = 0xFF;
                    this.configspace[19] = 0xFF;
                    this.configspace[20] = 0xFF;
                    this.configspace[21] = 0xFF;
                    this.configspace[22] = 0xFF;
                    this.configspace[22] = 0xFF;
                    break;

                default:
                    this.configspace[2] = 0;
                    break;
            }
            break;

        case VIRTIO_INPUT_CFG_ABS_INFO:
            this.configspace[2] = 0;
            message.Debug("Virtioinput: abs_info not implemented");
            message.Abort();
            break;

        default:
            message.Debug("Error in virtio input: Unknown config");
            message.Abort();
        break;
    }

}

VirtioInput.prototype.ReceiveRequest = function (queueidx, index, GetByte, size) {
    //message.Debug("Virtio input request " + queueidx + " " + index + " " + size.read + " " + size.write);

    if (queueidx >= 1) {
        message.Debug("Error in Virtio input: Unsupported queue index");
        message.Abort();
    }

    if (queueidx == 0) {
        // for some reason, some descriptors are sent multiple times. So check and return.
        for(var i=0; i<this.receivebufferdesc.length; i++) {
            if (this.receivebufferdesc[i].idx == index) {
                return;
            }
        }
        this.receivebufferdesc.push({idx: index, size: size});
        return;
    }

}

module.exports = VirtioInput;

},{"../../messagehandler":33,"../../utils":48,"./marshall":23}],23:[function(require,module,exports){
// -------------------------------------------------
// ------------------ Marshall ---------------------
// -------------------------------------------------
// helper functions for virtio and 9p.

var UTF8 = require('../../../lib/utf8');
var message = require('../../messagehandler');

// Inserts data from an array to a byte aligned struct in memory
function Marshall(typelist, input, struct, offset) {
    var item;
    var size = 0;
    for (var i=0; i < typelist.length; i++) {
        item = input[i];
        switch (typelist[i]) {
            case "w":
                struct[offset++] = item & 0xFF;
                struct[offset++] = (item >> 8) & 0xFF;
                struct[offset++] = (item >> 16) & 0xFF;
                struct[offset++] = (item >> 24) & 0xFF;
                size += 4;
                break;
            case "d": // double word
                struct[offset++] = item & 0xFF;
                struct[offset++] = (item >> 8) & 0xFF;
                struct[offset++] = (item >> 16) & 0xFF;
                struct[offset++] = (item >> 24) & 0xFF;
                struct[offset++] = 0x0;
                struct[offset++] = 0x0;
                struct[offset++] = 0x0;
                struct[offset++] = 0x0;
                size += 8;
                break;
            case "h":
                struct[offset++] = item & 0xFF;
                struct[offset++] = item >> 8;
                size += 2;
                break;
            case "b":
                struct[offset++] = item;
                size += 1;
                break;
            case "s":
                var lengthoffset = offset;
                var length = 0;
                struct[offset++] = 0; // set the length later
                struct[offset++] = 0;
                size += 2;
                for (var j in item) {
                    var utf8 = UTF8.UnicodeToUTF8Stream(item.charCodeAt(j));
                    utf8.forEach( function(c) {
                        struct[offset++] = c;
                        size += 1;
                        length++;
                    });
                }
                struct[lengthoffset+0] = length & 0xFF;
                struct[lengthoffset+1] = (length >> 8) & 0xFF;
                break;
            case "Q":
                Marshall(["b", "w", "d"], [item.type, item.version, item.path], struct, offset)
                offset += 13;
                size += 13;
                break;
            default:
                message.Debug("Marshall: Unknown type=" + type[i]);
                break;
        }
    }
    return size;
};


// Extracts data from a byte aligned struct in memory to an array
function Unmarshall(typelist, struct, offset) {
    var output = [];
    for (var i=0; i < typelist.length; i++) {
        switch (typelist[i]) {
            case "w":
                var val = struct[offset++];
                val += struct[offset++] << 8;
                val += struct[offset++] << 16;
                val += (struct[offset++] << 24) >>> 0;
                output.push(val);
                break;
            case "d":
                var val = struct[offset++];
                val += struct[offset++] << 8;
                val += struct[offset++] << 16;
                val += (struct[offset++] << 24) >>> 0;
                offset += 4;
                output.push(val);
                break;
            case "h":
                var val = struct[offset++];
                output.push(val + (struct[offset++] << 8));
                break;
            case "b":
                output.push(struct[offset++]);
                break;
            case "s":
                var len = struct[offset++];
                len += struct[offset++] << 8;
                var str = '';
                var utf8converter = new UTF8.UTF8StreamToUnicode();
                for (var j=0; j < len; j++) {
                    var c = utf8converter.Put(struct[offset++])
                    if (c == -1) continue;
                    str += String.fromCharCode(c);
                }
                output.push(str);
                break;
            default:
                message.Debug("Error in Unmarshall: Unknown type=" + typelist[i]);
                break;
        }
    }
    return output;
};


// Extracts data from a byte aligned struct in memory to an array
function Unmarshall2(typelist, GetByte) {
    var output = [];
    for (var i=0; i < typelist.length; i++) {
        switch (typelist[i]) {
            case "w":
                var val = GetByte();
                val += GetByte() << 8;
                val += GetByte() << 16;
                val += (GetByte() << 24) >>> 0;
                output.push(val);
                break;
            case "d":
                var val = GetByte();
                val += GetByte() << 8;
                val += GetByte() << 16;
                val += (GetByte() << 24) >>> 0;
                GetByte();GetByte();GetByte();GetByte();
                output.push(val);
                break;
            case "h":
                var val = GetByte();
                output.push(val + (GetByte() << 8));
                break;
            case "b":
                output.push(GetByte());
                break;
            case "s":
                var len = GetByte();
                len += GetByte() << 8;
                var str = '';
                var utf8converter = new UTF8.UTF8StreamToUnicode();
                for (var j=0; j < len; j++) {
                    var c = utf8converter.Put(GetByte())
                    if (c == -1) continue;
                    str += String.fromCharCode(c);
                }
                output.push(str);
                break;
            default:
                message.Debug("Error in Unmarshall2: Unknown type=" + typelist[i]);
                break;
        }
    }
    return output;
};


module.exports.Marshall = Marshall;
module.exports.Unmarshall = Unmarshall;
module.exports.Unmarshall2 = Unmarshall2;

},{"../../../lib/utf8":1,"../../messagehandler":33}],24:[function(require,module,exports){
// -------------------------------------------------
// ------------ Network Virtio Device --------------
// -------------------------------------------------

"use strict";

var message = require('../../messagehandler');
var utils = require('../../utils');
var marshall = require('./marshall');

function VirtioNET(ramdev) {
    this.configspace = [0x00, 0x0, 0x0, 0x0, 0x0, 0x0]; // mac address
    this.deviceid = 1;
    this.hostfeature = (1<<5); // Device has given MAC address

    this.replybuffer = new Uint8Array(65550); // the maximum size of a TCP or UDP packet, plus the 14 byte ethernet header
    this.replybuffersize = 0;

    // TODO: not all networks addresses are valid
    for(var i=1; i<6; i++) {
        this.configspace[i] = Math.floor(Math.random()*256);
    }

    message.Register("ethmac", this.Receive.bind(this) );

    this.Reset();
}

VirtioNET.prototype.Reset = function() {
    this.receivebufferdesc = new Array();
    this.receivebuffer = new Array();
}


VirtioNET.prototype.Receive = function(buffer) {
    //message.Debug("Received packet of size " + buffer.byteLength);
    this.receivebuffer.push(buffer);
    this.HandleReceive();
}

VirtioNET.prototype.HandleReceive = function() {

    if (this.receivebuffer.length == 0) {
        return;
    }

    if (this.receivebufferdesc.length == 0) {
        return;
    }

    var buffer = new Uint8Array(this.receivebuffer[0]);
    var desc = this.receivebufferdesc[0];

    if (buffer.length > desc.size.write) {
        message.Debug("Error in VirtioNET: Received packet is larger than the next receive buffer");
        message.Abort();
    }
    
    this.receivebuffer.shift();
    this.receivebufferdesc.shift();

    // both buffers are valid so copy

    this.replybuffersize = buffer.length + 12;
    marshall.Marshall(["b", "b", "h", "h", "h", "h", "h"], [0, 0, 0, 0, 0, 0, 0], this.replybuffer, 0);
    for(var i=0; i<buffer.length; i++) {
        this.replybuffer[i+12] = buffer[i];
    }
    //this.replybuffersize = desc.size.write;

    //message.Debug("Send packet of size " + buffer.length + " and idx " + desc.idx);
    this.SendReply(0, desc.idx);
}


VirtioNET.prototype.ReceiveRequest = function (queueidx, index, GetByte, size) {
    //message.Debug("Virtio network request of ringbuffer " + queueidx + " " + index + " " + size.read + " " + size.write);

    if (queueidx > 1) {
        message.Debug("Error in VirtioNET: Unsupported ringbuffer");
        message.Abort();
    }

    if (queueidx == 0) {
        // for some reason, some descriptors are sent multiple times. So check and return. 
        for(var i=0; i<this.receivebufferdesc.length; i++) {
            if (this.receivebufferdesc[i].idx == index) {
                return;
            }
        }
        this.receivebufferdesc.push({idx: index, size: size});
        this.HandleReceive();
        return;
    }

    var hdr = marshall.Unmarshall2(["b", "b", "h", "h", "h", "h", "h"], GetByte);
    //message.Debug(hdr);
    var frame = new Uint8Array(size.read - 12);
    for(var i=0; i<size.read-12; i++) {
        frame[i] = GetByte();
    }
    message.Send("ethmac", frame.buffer);

    this.replybuffersize = 0;
    this.SendReply(queueidx, index);
}

module.exports = VirtioNET;

},{"../../messagehandler":33,"../../utils":48,"./marshall":23}],25:[function(require,module,exports){
var message = require('./messagehandler');
var utils = require('./utils');
var marshall = require('./dev/virtio/marshall');

var elf = {};

elf.IsELF = function(buffer) {
    if ((buffer[0] == 0x7F) && 
        (buffer[1] == 0x45) && 
        (buffer[2] == 0x4C) && 
        (buffer[3] == 0x46)) 
        return true;

    return false;
}
    
elf.Extract = function(srcbuffer, ram) {

    var offset = 0;
    var output = [];
    output = marshall.Unmarshall(["w", "b", "b", "b", "b"], srcbuffer, offset);
    var ei_class = output[1];
    if (ei_class != 1) {
        message.Debug("Error reading elf binary: 64-Bit not supported");
        message.Abort();
    }

/*
    output[0] // magic
    output[1] // ei_class  1 -> 32 bit, 2 -> 64 bit
    output[2] // ei_data    1 little end, 2 big end
    output[3] // ei_version  currently always 1
    output[4] // ei_pad      marks beginning of padding
*/

    offset = 0x10;
    output = marshall.Unmarshall(["h", "h", "w", "w", "w", "w"], srcbuffer, offset);
    var e_entry = output[3]; // virtual address of entry point into program
    var e_phoff = output[4]; // offset for program header
    var e_shoff = output[5]; // offset for section header
    //message.Debug("e_entry: " +  utils.ToHex(e_entry));
    //message.Debug("e_phoff: " +  utils.ToHex(e_phoff));
    //message.Debug("e_shoff: " +  utils.ToHex(e_shoff));

    offset = 0x28;
    output = marshall.Unmarshall(["h", "h", "h"], srcbuffer, offset);
    var e_ehsize = output[0]; // size of each individual entry in program header table
    var e_phentsize = output[1]; // Contains the size of a program header table entry.
    var e_phnum = output[2]; // Contains the number of entries in the program header table.

    offset = 0x2E;
    output = marshall.Unmarshall(["h", "h", "h"], srcbuffer, offset);
    var e_shentsize = output[0]; // size of each individual entry in section header table
    var e_shnum = output[1]; // number of entries in section header table
    var e_shstrndx = output[2]; // section header string table index
    //message.Debug("e_shentsize: " +  utils.ToHex(e_shnum));
    //message.Debug("e_shnum: " +  utils.ToHex(e_shnum));
    //message.Debug("e_shstrndx: " +  utils.ToHex(e_shstrndx));

    var program_headers = [];

    for (var i = 0; i < e_phnum; i++) {

        offset = e_phoff + i*e_phentsize;
        output = marshall.Unmarshall(["w", "w", "w", "w", "w", "w", "w", "w"], srcbuffer, offset);

        var section = {};
        section.type = output[0];
        section.offset = output[1];
        section.vaddr = output[2];
        section.paddr = output[3];
        section.filesz = output[4];
        section.memsz = output[5];
        section.flags = output[6];
        section.align = output[7];
/*
        message.Debug("elf program section"
                + " type:" + section.type
		+ " vaddr:" + utils.ToHex(section.vaddr)
		+ " paddr:" + utils.ToHex(section.paddr)
                + " offset:" + utils.ToHex(section.offset)
                + " filesz:" + utils.ToHex(section.filesz)
                + " memsz:" + utils.ToHex(section.memsz)
                + " flags:" + utils.ToHex(section.flags));
*/
        program_headers.push(section);
}

    var section_headers = [];

   for (var i = 0; i < e_shnum; i++) {

        offset = e_shoff + i*e_shentsize;
        output = marshall.Unmarshall(["w", "w", "w", "w", "w", "w"], srcbuffer, offset);

        var section = {};
        section.name = output[0];
        section.type = output[1];
        section.flags = output[2];
        section.addr = output[3];
        section.offset = output[4];
        section.size = output[5];
/*
        message.Debug("elf section name:" + section.name
		+ " addr:" + utils.ToHex(section.addr)
                + " offset:" + utils.ToHex(section.offset)
                + " size:" + utils.ToHex(section.size)
                + " flags:" + utils.ToHex(section.flags)
                + " type:" + utils.ToHex(section.type));
*/
        section_headers.push(section);

    }

    for (var i = 0; i < program_headers.length; i++) {
        if (program_headers[i].type != 1) continue;
        if (program_headers[i].memsz == 0) continue;

        if (program_headers[i].filesz > 0) {
            for (var j = 0; j < program_headers[i].filesz; j++) {
                ram.Write8(program_headers[i].paddr + j, srcbuffer[program_headers[i].offset + j]);
            }
        }
        for (var j = 0; j < program_headers[i].memsz-program_headers[i].filesz; j++) {
            ram.Write8(program_headers[i].paddr+program_headers[i].filesz + j, 0x0);
        }
    }
}

module.exports = elf;

},{"./dev/virtio/marshall":23,"./messagehandler":33,"./utils":48}],26:[function(require,module,exports){
// -------------------------------------------------
// ----------------- FILESYSTEM---------------------
// -------------------------------------------------
// Implementation of a unix filesystem in memory.

"use strict";

var TAR = require('./tar');
var FSLoader = require('./fsloader');
var utils = require('../utils');
var bzip2 = require('../bzip2');
var marshall = require('../dev/virtio/marshall');
var UTF8 = require('../../lib/utf8');
var message = require('../messagehandler');
var LazyUint8Array = require("./lazyUint8Array");

var S_IRWXUGO = 0x1FF;
var S_IFMT = 0xF000;
var S_IFSOCK = 0xC000;
var S_IFLNK = 0xA000;
var S_IFREG = 0x8000;
var S_IFBLK = 0x6000;
var S_IFDIR = 0x4000;
var S_IFCHR = 0x2000;

//var S_IFIFO  0010000
//var S_ISUID  0004000
//var S_ISGID  0002000
//var S_ISVTX  0001000

var O_RDONLY = 0x0000; // open for reading only 
var O_WRONLY = 0x0001; // open for writing only
var O_RDWR = 0x0002; // open for reading and writing
var O_ACCMODE = 0x0003; // mask for above modes

var STATUS_INVALID = -0x1;
var STATUS_OK = 0x0;
var STATUS_OPEN = 0x1;
var STATUS_ON_SERVER = 0x2;
var STATUS_LOADING = 0x3;
var STATUS_UNLINKED = 0x4;


function FS() {
    this.inodes = [];
    this.events = [];

    this.qidnumber = 0x0;
    this.filesinloadingqueue = 0;
    this.OnLoaded = function() {};

    this.tar = new TAR(this);
    this.fsloader = new FSLoader(this);
    this.userinfo = [];

    this.watchFiles = {};
    this.watchDirectories = {};

    message.Register("LoadFilesystem", this.LoadFilesystem.bind(this) );
    message.Register("MergeFile", this.MergeFile.bind(this) );
    message.Register("DeleteNode", this.DeleteNode.bind(this) );
    message.Register("DeleteDirContents", this.RecursiveDelete.bind(this) );
    message.Register("CreateDirectory", 
        function(newDirPath){
            var ids = this.SearchPath(newDirPath);
            if(ids.id == -1 && ids.parentid != -1)
                this.CreateDirectory(ids.name, ids.parentid);
        }.bind(this)
    );
    message.Register("Rename",
        function(info) {
            var oldNodeInfo = this.SearchPath(info.oldPath);
            var newNodeInfo = this.SearchPath(info.newPath);
            
            // old node DNE or new node has invalid directory path
            if(oldNodeInfo.id == -1 || newNodeInfo.parentid == -1) 
                return;
               
            if(newNodeInfo.id==-1){ //create
                //parent must be directory
                if(((this.inodes[newNodeInfo.parentid].mode)&S_IFMT) != S_IFDIR)
                    return;
                    
                this.Rename(this.inodes[oldNodeInfo.id].parentid, this.inodes[oldNodeInfo.id].name, 
                                newNodeInfo.parentid, newNodeInfo.name);
            }
            else { //overwrite 
                this.Rename(this.inodes[oldNodeInfo.id].parentid, this.inodes[oldNodeInfo.id].name, 
                                this.inodes[newNodeInfo.id].parentid, this.inodes[newNodeInfo.id].name);
            }                
        }.bind(this)
    );
    message.Register("WatchFile",
        function(file) {
            //message.Debug("watching file: " + file.name);
            this.watchFiles[file.name] = true;
        }.bind(this)
    );

    message.Register("WatchDirectory",
        function(file) {
            this.watchDirectories[file.name] = true;
        }.bind(this)
    );

    message.Register("ReadFile",
        function(file) {
            message.Send("ReadFile", (this.ReadFile.bind(this))(file));
        }.bind(this)
    );

    message.Register("tar",
        function(data) {
            message.Send("tar", this.tar.Pack(data));
        }.bind(this)
    );

    message.Register("sync",
        function(data) {
            message.Send("sync", this.tar.Pack(data));
        }.bind(this)
    );

    // root entry
    this.CreateDirectory("", -1);
}


// -----------------------------------------------------
FS.prototype.LoadFilesystem = function(userinfo)
{
    this.userinfo = userinfo;
    this.fsloader.LoadJSON(this.userinfo.basefsURL);
    this.OnLoaded = function() { // the basic filesystem is loaded, so download the rest
        if (this.userinfo.extendedfsURL) {
            this.fsloader.LoadJSON(this.userinfo.extendedfsURL);
        }
        for(var i=0; i<this.userinfo.lazyloadimages.length; i++) {
            this.LoadImage(this.userinfo.lazyloadimages[i]);
        }
    }.bind(this);

}

// -----------------------------------------------------

FS.prototype.AddEvent = function(id, OnEvent) {
    var inode = this.GetInode(id);
    if (inode.status == STATUS_OK) {
        OnEvent();
        return;
    }
    this.events.push({id: id, OnEvent: OnEvent});    
}

FS.prototype.HandleEvent = function(id) {

    if (this.filesinloadingqueue == 0) {
        this.OnLoaded();
        this.OnLoaded = function() {}
    }
    //message.Debug("number of events: " + this.events.length);
    var newevents = [];
    for(var i=0; i<this.events.length; i++) {
        if (this.events[i].id == id) {
            this.events[i].OnEvent();
        } else {
            newevents.push(this.events[i]);
        }
    }
    this.events = newevents;
}


// -----------------------------------------------------
FS.prototype.LoadImage = function(url)
{
    if (!url) return;
    //message.Debug("Load Image " + url);
/*
    if (typeof Worker !== 'undefined') {
        LoadBZIP2Resource(url, 
            function(m){ for(var i=0; i<m.size; i++) this.tar.Unpack(m.data[i]); }.bind(this), 
            function(e){message.Debug("Error: Could not load " + url + ". Skipping.");});
        return;
    }
*/
    utils.LoadBinaryResource(url,
    function(buffer){
        var buffer8 = new Uint8Array(buffer);
        if (buffer.byteLength == 0) return;
        bzip2.simple(buffer8, this.tar.Unpack.bind(this.tar));
    }.bind(this),
    function(error){
        message.Debug("Error: Could not load " + url + ". Skipping.");
    }.bind(this)
    );
}
// -----------------------------------------------------

FS.prototype.CheckEarlyload = function(path)
{
    for(var i=0; i<this.userinfo.earlyload.length; i++) {
        if (this.userinfo.earlyload[i] == path) {
            return true;
        }
    }
    return false;
}


// The filesystem is responsible to add the correct time. This is a hack
// Have to find a better solution.
FS.prototype.AppendDateHack = function(idx) {
    if (this.GetFullPath(idx) != "home/user/.profile") return;
    var inode = this.inodes[idx];
    var date = new Date();
    var datestring = 
        "\ndate -s \"" + 
        date.getUTCFullYear() + 
        "-" + 
        (date.getUTCMonth()+1) + 
        "-" + 
        date.getUTCDate() + 
        " " + 
        date.getUTCHours() +
        ":" + 
        date.getUTCMinutes() +
        ":" + 
        date.getUTCSeconds() +
        "\" &>/dev/null\n";
    var size = inode.size;
    this.ChangeSize(idx, size+datestring.length);
    for(var i=0; i<datestring.length; i++) {
        inode.data[i+size] = datestring.charCodeAt(i); 
    }
}


// Loads the data from a url for a specific inode
FS.prototype.LoadFile = function(idx) {
    var inode = this.inodes[idx];
    if (inode.status != STATUS_ON_SERVER) {
        return;
    }
    inode.status = STATUS_LOADING;
    this.filesinloadingqueue++;

    if (inode.compressed) {
        inode.data = new Uint8Array(inode.size);

        var succfunction = 
        (function(idx){
            return function(buffer){
                var inode = this.GetInode(idx);
                var buffer8 = new Uint8Array(buffer);
                var ofs = 0;
                bzip2.simple(buffer8, function(x){inode.data[ofs++] = x;}.bind(this) );
                inode.status = STATUS_OK;
                this.filesinloadingqueue--;
                this.HandleEvent(idx);
            }.bind(this) 
        }.bind(this))(idx);

        utils.LoadBinaryResource(inode.url + ".bz2", 
        succfunction,
        function(error){throw error;});
        return;
    }

    if (inode.lazy) {
        message.Debug("Using lazy file for " + inode.url);
        inode.data = new LazyUint8Array(inode.url, inode.size);
        var old = inode.size;
        inode.size = inode.data.length;
        if (old != inode.size) message.Warning("Size wrong for lazy loaded file: " + inode.name);
        inode.status = STATUS_OK;
        this.filesinloadingqueue--;
        this.HandleEvent(idx);
        return;
    }

    var succfunction = 
    (function(idx){
        return function(buffer){
            var inode = this.GetInode(idx);
            inode.data = new Uint8Array(buffer);
            if (inode.size != inode.data.length) message.Warning("Size wrong for uncompressed non-lazily loaded file: " + inode.name);
            inode.size = inode.data.length; // correct size if the previous was wrong. 
            inode.status = STATUS_OK;            
            this.filesinloadingqueue--;
            this.HandleEvent(idx);            
        }.bind(this);
    }.bind(this))(idx);

    utils.LoadBinaryResource(inode.url, 
        succfunction,
        function(error){throw error;});

}

// -----------------------------------------------------

FS.prototype.PushInode = function(inode) {
    if (inode.parentid != -1) {
        this.inodes.push(inode);
        this.inodes[inode.parentid].updatedir = true;
        inode.nextid = this.inodes[inode.parentid].firstid;
        this.inodes[inode.parentid].firstid = this.inodes.length-1;
        return;
    } else {
        if (this.inodes.length == 0) { // if root directory
            this.inodes.push(inode);
            return;
        }
    }

    message.Debug("Error in Filesystem: Pushed inode with name = "+ inode.name + " has no parent");
    message.Abort();

}


FS.prototype.CreateInode = function() {
    this.qidnumber++;
    return {
        updatedir : false, // did the directory listing changed?
        parentid: -1,
        firstid : -1, // first file id in directory
        nextid : -1, // next id in directory
        status : 0,
        name : "",
        size : 0x0,
        uid : 0x0,
        gid : 0x0,
        ctime : Math.floor((new Date()).getTime()/1000),
        atime : Math.floor((new Date()).getTime()/1000),
        mtime : Math.floor((new Date()).getTime()/1000),
        major : 0x0,
        minor : 0x0,
        data : new Uint8Array(0),
        symlink : "",
        nlinks : 1,
        mode : 0x01ED,
        qid: {type: 0, version: 0, path: this.qidnumber},
        url: "", // url to download the file
        compressed: false
    };
}

FS.prototype.CreateDirectory = function(name, parentid) {
    var x = this.CreateInode();
    x.name = name;
    x.parentid = parentid;
    x.mode = 0x01FF | S_IFDIR;
    x.updatedir = true;
    x.nlinks = 2; // . and ..
    if (parentid >= 0) {
        x.uid = this.inodes[parentid].uid;
        x.gid = this.inodes[parentid].gid;
        x.mode = (this.inodes[parentid].mode & 0x1FF) | S_IFDIR;
        this.inodes[parentid].nlinks++;
    }
    x.qid.type = S_IFDIR >> 8;
    this.PushInode(x);
    this.NotifyListeners(this.inodes.length-1, 'newdir');
    return this.inodes.length-1;
}

FS.prototype.CreateFile = function(filename, parentid) {
    var x = this.CreateInode();
    x.name = filename;
    x.parentid = parentid;
    x.uid = this.inodes[parentid].uid;
    x.gid = this.inodes[parentid].gid;
    this.inodes[parentid].nlinks++;
    x.qid.type = S_IFREG >> 8;
    x.mode = (this.inodes[parentid].mode & 0x1B6) | S_IFREG;
    this.PushInode(x);
    this.NotifyListeners(this.inodes.length-1, 'newfile');
    return this.inodes.length-1;
}


FS.prototype.CreateNode = function(filename, parentid, major, minor) {
    var x = this.CreateInode();
    x.name = filename;
    x.parentid = parentid;
    x.major = major;
    x.minor = minor;
    x.uid = this.inodes[parentid].uid;
    x.gid = this.inodes[parentid].gid;
    this.inodes[parentid].nlinks++;
    x.qid.type = S_IFSOCK >> 8;
    x.mode = (this.inodes[parentid].mode & 0x1B6);
    this.PushInode(x);
    return this.inodes.length-1;
}
     
FS.prototype.CreateSymlink = function(filename, parentid, symlink) {
    var x = this.CreateInode();
    x.name = filename;
    x.parentid = parentid;
    x.uid = this.inodes[parentid].uid;
    x.gid = this.inodes[parentid].gid;
    this.inodes[parentid].nlinks++;
    x.qid.type = S_IFLNK >> 8;
    x.symlink = symlink;
    x.mode = S_IFLNK;
    this.PushInode(x);
    return this.inodes.length-1;
}

FS.prototype.CreateTextFile = function(filename, parentid, str) {
    var id = this.CreateFile(filename, parentid);
    var x = this.inodes[id];
    x.data = new Uint8Array(str.length);
    x.size = str.length;
    for (var j in str) {
        x.data[j] = str.charCodeAt(j);
    }
    return id;
}

FS.prototype.OpenInode = function(id, mode) {
    var inode = this.GetInode(id);
    if ((inode.mode&S_IFMT) == S_IFDIR) {
        this.FillDirectory(id);
    }
    /*
    var type = "";
    switch(inode.mode&S_IFMT) {
        case S_IFREG: type = "File"; break;
        case S_IFBLK: type = "Block Device"; break;
        case S_IFDIR: type = "Directory"; break;
        case S_IFCHR: type = "Character Device"; break;
    }
    */
    //message.Debug("open:" + this.GetFullPath(id) +  " type: " + inode.mode + " status:" + inode.status);
    if (inode.status == STATUS_ON_SERVER) {
        this.LoadFile(id);
        return false;
    }

    if (inode.name == ".profile") {
        this.AppendDateHack(id);
    }

    return true;
}

FS.prototype.CloseInode = function(id) {
    //message.Debug("close: " + this.GetFullPath(id));
    var inode = this.GetInode(id);
    if (inode.status == STATUS_UNLINKED) {
        //message.Debug("Filesystem: Delete unlinked file");
        inode.status = STATUS_INVALID;
        inode.data = new Uint8Array(0);
        inode.size = 0;
    }
}

FS.prototype.Rename = function(olddirid, oldname, newdirid, newname) {
    // message.Debug("Rename " + oldname + " to " + newname);
    if ((olddirid == newdirid) && (oldname == newname)) {
        return true;
    }
    var oldid = this.Search(olddirid, oldname);
    var oldpath = this.GetFullPath(oldid);
    if (oldid == -1) {
        return false;
    }
    var newid = this.Search(newdirid, newname);
    if (newid != -1) {
        this.Unlink(newid);
    }

    var idx = oldid; // idx contains the id which we want to rename
    var inode = this.inodes[idx];

    // remove inode ids
    if (this.inodes[inode.parentid].firstid == idx) {
        this.inodes[inode.parentid].firstid = inode.nextid;
    } else {
        var id = this.FindPreviousID(idx);
        if (id == -1) {
            message.Debug("Error in Filesystem: Cannot find previous id of inode");
            message.Abort();
        }
        this.inodes[id].nextid = inode.nextid;
    }

    inode.parentid = newdirid;
    inode.name = newname;
    inode.qid.version++;

    inode.nextid = this.inodes[inode.parentid].firstid;
    this.inodes[inode.parentid].firstid = idx;

    this.inodes[olddirid].updatedir = true;
    this.inodes[newdirid].updatedir = true;
    this.inodes[olddirid].nlinks--;
    this.inodes[newdirid].nlinks++;

    this.NotifyListeners(idx, "rename", {oldpath: oldpath});
    
    return true;
}

FS.prototype.Write = function(id, offset, count, GetByte) {
    this.NotifyListeners(id, 'write');
    var inode = this.inodes[id];

    if (inode.data.length < (offset+count)) {
        this.ChangeSize(id, Math.floor(((offset+count)*3)/2) );
        inode.size = offset + count;
    } else
    if (inode.size < (offset+count)) {
        inode.size = offset + count;
    }
    if (inode.data instanceof Uint8Array)
        for(var i=0; i<count; i++)
            inode.data[offset+i] = GetByte();
    else
        for(var i=0; i<count; i++)
            inode.data.Set(offset+i, GetByte());
}

FS.prototype.Search = function(parentid, name) {
    var id = this.inodes[parentid].firstid;
    while(id != -1) {
        if (this.inodes[id].parentid != parentid) { // consistency check
            message.Debug("Error in Filesystem: Found inode with wrong parent id");
        }
        if (this.inodes[id].name == name) return id;
        id = this.inodes[id].nextid;
    }
    return -1;
}

FS.prototype.GetTotalSize = function() {
    var size = 0;
    for(var i=0; i<this.inodes.length; i++) {
        size += this.inodes[i].data.length;
    }
    return size;
}

FS.prototype.GetFullPath = function(idx) {
    var path = "";

    while(idx != 0) {
        path = "/" + this.inodes[idx].name + path;
        idx = this.inodes[idx].parentid;
    }
    return path.substring(1);
}

// no double linked list. So, we need this
FS.prototype.FindPreviousID = function(idx) {
    var inode = this.GetInode(idx);
    var id = this.inodes[inode.parentid].firstid;
    while(id != -1) {
        if (this.inodes[id].nextid == idx) return id;
        id = this.inodes[id].nextid;
    }
    return id;
}

FS.prototype.Unlink = function(idx) {
    this.NotifyListeners(idx, 'delete');
    if (idx == 0) return false; // root node cannot be deleted
    var inode = this.GetInode(idx);
    //message.Debug("Unlink " + inode.name);

    // check if directory is not empty
    if ((inode.mode&S_IFMT) == S_IFDIR) {
       if (inode.firstid != -1) return false;
    }

    // update ids
    if (this.inodes[inode.parentid].firstid == idx) {
        this.inodes[inode.parentid].firstid = inode.nextid;
    } else {
        var id = this.FindPreviousID(idx);
        if (id == -1) {
            message.Debug("Error in Filesystem: Cannot find previous id of inode");
            message.Abort();
        }
        this.inodes[id].nextid = inode.nextid;
    }
    // don't delete the content. The file is still accessible
    this.inodes[inode.parentid].updatedir = true;
    this.inodes[inode.parentid].nlinks--;
    inode.status = STATUS_UNLINKED;
    inode.nextid = -1;
    inode.firstid = -1;
    inode.parentid = -1;
    inode.nlinks--;
    return true;
}

FS.prototype.GetInode = function(idx)
{
    if (isNaN(idx)) {
        message.Debug("Error in filesystem: id is not a number ");
        return 0;
    }

    if ((idx < 0) || (idx > this.inodes.length)) {
        message.Debug("Error in filesystem: Attempt to get inode with id " + idx);
        return 0;
    }
    return this.inodes[idx];
}

FS.prototype.ChangeSize = function(idx, newsize)
{
    var inode = this.GetInode(idx);
    //message.Debug("change size to: " + newsize);
    if (newsize == inode.size) return;
    var temp = new Uint8Array(newsize);
    inode.size = newsize;
    var size = Math.min(inode.data.length, inode.size);
    for(var i=0; i<size; i++) {
        temp[i] = this.ReadByte(inode, i);
    }
    inode.data = temp;
}

FS.prototype.ReadByte = function(inode, idx) {
    if (inode.data instanceof Uint8Array) {
        return inode.data[idx];
    } else {
        return inode.data.Get(idx);
    }
}

FS.prototype.SearchPath = function(path) {
    //path = path.replace(/\/\//g, "/");
    path = path.replace("//", "/");
    var walk = path.split("/");
    var n = walk.length;
    if (walk[n-1].length == 0) walk.pop();
    if (walk[0].length == 0) walk.shift();
    var n = walk.length;

    var parentid = 0;
    var id = -1;
    for(var i=0; i<n; i++) {
        id = this.Search(parentid, walk[i]);        
        if (id == -1) {
            if (i < n-1) return {id: -1, parentid: -1, name: walk[i]}; // one name of the path cannot be found
            return {id: -1, parentid: parentid, name: walk[i]}; // the last element in the path does not exist, but the parent
        }
        parentid = id;
    }
    return {id: id, parentid: parentid, name: walk[i]};
}
// -----------------------------------------------------

FS.prototype.GetRecursiveList = function(dirid, list) {
    var id = this.inodes[dirid].firstid;
    while(id != -1) {
        list.push(id);
        if ((this.inodes[id].mode&S_IFMT) == S_IFDIR) {
            this.GetRecursiveList(id, list);
        }
        id = this.inodes[id].nextid;
    }
}

FS.prototype.ReadFile = function(file) {
    //message.Debug("Read path:" + file.name);
    var ids = this.SearchPath(file.name);
    if (ids.parentid == -1) return; // not even the path seems to exist
    if (ids.id == -1) {
      return null;
    }
    file.data = this.inodes[ids.id].data;
    file.size = this.inodes[ids.id].size;
    return file;
}

FS.prototype.MergeFile = function(file) {
    message.Debug("Merge path:" + file.name);
    var ids = this.SearchPath(file.name);
    if (ids.parentid == -1) return; // not even the path seems to exist
    if (ids.id == -1) {
        ids.id = this.CreateFile(ids.name, ids.parentid); 
    }
    this.inodes[ids.id].data = file.data;
    this.inodes[ids.id].size = file.data.length;
    // Don't forget to update the timestamps !
    this.inodes[ids.id].mtime = Math.floor((new Date()).getTime()/1000);
    this.inodes[ids.id].atime = this.inodes[ids.id].mtime;
    this.inodes[ids.id].ctime = this.inodes[ids.id].mtime;
}


FS.prototype.RecursiveDelete = function(path) {
    var toDelete = []
    var ids = this.SearchPath(path);
    if (ids.parentid == -1 || ids.id == -1) return;
    
    this.GetRecursiveList(ids.id, toDelete);

    for(var i=toDelete.length-1; i>=0; i--)
        this.Unlink(toDelete[i]);

}

FS.prototype.DeleteNode = function(path) {
    var ids = this.SearchPath(path);
    if (ids.parentid == -1 || ids.id == -1) return;
    
    if ((this.inodes[ids.id].mode&S_IFMT) == S_IFREG){
        this.Unlink(ids.id);
        return;
    }
    if ((this.inodes[ids.id].mode&S_IFMT) == S_IFDIR){
        var toDelete = []
        this.GetRecursiveList(ids.id, toDelete);
        for(var i=toDelete.length-1; i>=0; i--)
            this.Unlink(toDelete[i]);
        this.Unlink(ids.id);
        return;
    }
}

FS.prototype.NotifyListeners = function(id, action, info) {
    if(info==undefined)
        info = {};

    var path = this.GetFullPath(id);
    if (this.watchFiles[path] == true && action=='write') {
      message.Send("WatchFileEvent", path);
    }
    for (var directory in this.watchDirectories) {
        if (this.watchDirectories.hasOwnProperty(directory)) {
            var indexOf = path.indexOf(directory)
            if(indexOf == 0 || indexOf == 1)
                message.Send("WatchDirectoryEvent", {path: path, event: action, info: info});         
        }
    }
}

FS.prototype.Check = function() {
    for(var i=1; i<this.inodes.length; i++)
    {
        if (this.inodes[i].status == STATUS_INVALID) continue;
        if (this.inodes[i].nextid == i) {
            message.Debug("Error in filesystem: file points to itself");
            message.Abort();
        }

        var inode = this.GetInode(i);
        if (inode.parentid < 0) {
            message.Debug("Error in filesystem: negative parent id " + i);
        }
        var n = inode.name.length;
        if (n == 0) {
            message.Debug("Error in filesystem: inode with no name and id " + i);
        }

        for (var j in inode.name) {
            var c = inode.name.charCodeAt(j);
            if (c < 32) {
                message.Debug("Error in filesystem: Unallowed char in filename");
            } 
        }
    }
}

FS.prototype.FillDirectory = function(dirid) {
    var inode = this.GetInode(dirid);
    if (!inode.updatedir) return;
    var parentid = inode.parentid;
    if (parentid == -1) parentid = 0; // if root directory point to the root directory

    // first get size
    var size = 0;
    var id = this.inodes[dirid].firstid;
    while(id != -1) {
        size += 13 + 8 + 1 + 2 + UTF8.UTF8Length(this.inodes[id].name);
        id = this.inodes[id].nextid;
    }

    size += 13 + 8 + 1 + 2 + 1; // "." entry
    size += 13 + 8 + 1 + 2 + 2; // ".." entry
    //message.Debug("size of dir entry: " + size);
    inode.data = new Uint8Array(size);
    inode.size = size;

    var offset = 0x0;
    offset += marshall.Marshall(
        ["Q", "d", "b", "s"],
        [this.inodes[dirid].qid, 
        offset+13+8+1+2+1, 
        this.inodes[dirid].mode >> 12, 
        "."],
        inode.data, offset);

    offset += marshall.Marshall(
        ["Q", "d", "b", "s"],
        [this.inodes[parentid].qid,
        offset+13+8+1+2+2, 
        this.inodes[parentid].mode >> 12, 
        ".."],
        inode.data, offset);

    var id = this.inodes[dirid].firstid;
    while(id != -1) {
        offset += marshall.Marshall(
        ["Q", "d", "b", "s"],
        [
            this.inodes[id].qid,
            offset+13+8+1+2+UTF8.UTF8Length(this.inodes[id].name),
            this.inodes[id].mode >> 12,
            this.inodes[id].name
        ],
        inode.data, offset);
        id = this.inodes[id].nextid;
    }
    inode.updatedir = false;
}


// -----------------------------------------------------

// only support for security.capabilities
// should return a  "struct vfs_cap_data" defined in
// linux/capability for format
// check also:
//   sys/capability.h
//   http://lxr.free-electrons.com/source/security/commoncap.c#L376
//   http://man7.org/linux/man-pages/man7/capabilities.7.html
//   http://man7.org/linux/man-pages/man8/getcap.8.html
//   http://man7.org/linux/man-pages/man3/libcap.3.html
FS.prototype.PrepareCAPs = function(id) {
    var inode = this.GetInode(id);
    if (inode.caps) return inode.caps.length;
    inode.caps = new Uint8Array(12);
    // format is little endian
    // magic_etc (revision=0x01: 12 bytes)
    inode.caps[0]  = 0x00;
    inode.caps[1]  = 0x00;
    inode.caps[2]  = 0x00;
    inode.caps[3]  = 0x01;
    // permitted (full capabilities)
    inode.caps[4]  = 0xFF;
    inode.caps[5]  = 0xFF;
    inode.caps[6]  = 0xFF;
    inode.caps[7]  = 0xFF;
    // inheritable (full capabilities
    inode.caps[8]  = 0xFF;
    inode.caps[9]  = 0xFF;
    inode.caps[10] = 0xFF;
    inode.caps[11] = 0xFF;

    return inode.caps.length;
}


module.exports = FS;

},{"../../lib/utf8":1,"../bzip2":2,"../dev/virtio/marshall":23,"../messagehandler":33,"../utils":48,"./fsloader":27,"./lazyUint8Array":28,"./tar":29}],27:[function(require,module,exports){
// -------------------------------------------------
// ------------- FILESYSTEM LOADER -----------------
// -------------------------------------------------

"use strict";

var message = require('../messagehandler');
var utils = require('../utils');

var S_IRWXUGO = 0x1FF;
var S_IFMT = 0xF000;
var S_IFSOCK = 0xC000;
var S_IFLNK = 0xA000;
var S_IFREG = 0x8000;
var S_IFBLK = 0x6000;
var S_IFDIR = 0x4000;
var S_IFCHR = 0x2000;

var STATUS_INVALID = -0x1;
var STATUS_OK = 0x0;
var STATUS_OPEN = 0x1;
var STATUS_ON_SERVER = 0x2;
var STATUS_LOADING = 0x3;
var STATUS_UNLINKED = 0x4;

function FSLoader(filesystem) {
    this.fs = filesystem;
}

FSLoader.prototype.HandleDirContents = function(list, parentid) {
    for (var i in list) {
         var tag = list[i];

         var id = this.fs.Search(parentid, tag.name);
         if (id != -1) {
             if (!tag.path && !tag.size) {
                 if (tag.child) this.HandleDirContents(tag.child, id);
                 continue;
             } else {
                 message.Debug("Overwriting non-directory!");
             }
         }

         var inode = this.fs.CreateInode();
         inode.name = tag.name;
         inode.uid = tag.uid|0;
         inode.gid = tag.gid|0;
         inode.parentid = parentid;
         this.fs.inodes[inode.parentid].nlinks++;
         inode.mode = parseInt(tag.mode, 8);

         if (tag.path) { // link
             inode.mode = S_IFLNK | S_IRWXUGO;
             inode.symlink = tag.path;
             this.fs.PushInode(inode);
         } else if (typeof tag.size === "undefined") { // dir
             inode.mode |= S_IFDIR;
             inode.updatedir = true;
             inode.nlinks = 2; // . and ..
             this.fs.PushInode(inode);
             if (tag.child)
                 this.HandleDirContents(tag.child, id != -1 ? id : this.fs.inodes.length-1);
         } else { // file
             if (tag.lazy) inode.lazy = tag.lazy;
             inode.mode |= S_IFREG;
             var idx = this.fs.inodes.length;
             inode.status = STATUS_ON_SERVER;
             inode.compressed = !!tag.c;
             inode.size = tag.size|0;
             this.fs.PushInode(inode);
             var url = this.sysrootdir + (!tag.src?this.fs.GetFullPath(idx):tag.src);
             inode.url = url;
             //message.Debug("Load id=" + (idx) + " " + url);
             if (tag.load || this.fs.CheckEarlyload(this.fs.GetFullPath(idx)) ) {
                 this.fs.LoadFile(idx);
             }
         }
    }
}

FSLoader.prototype.OnJSONLoaded = function(fsxml)
{
    var t = JSON.parse(fsxml);

    this.sysrootdir = t.src;
    if (String(this.sysrootdir) !== this.sysrootdir) message.Debug("No sysroot (src tag)!");
    this.sysrootdir = this.fs.userinfo.path + this.sysrootdir + "/";

    this.HandleDirContents(t.fs, 0);

    message.Debug("processed " + this.fs.inodes.length + " inodes");
    this.fs.Check();
}

FSLoader.prototype.LoadJSON = function(url)
{
    message.Debug("Load filesystem information from " + url);
    utils.LoadTextResource(url, this.OnJSONLoaded.bind(this), function(error){throw error;});
}

module.exports = FSLoader;

},{"../messagehandler":33,"../utils":48}],28:[function(require,module,exports){
"use strict";

var message = require("../messagehandler");

function LazyUint8Array_length_getter() {
    if (!this.lengthKnown) {
        this.CacheLength();
    }
    return this._length;
}

function LazyUint8Array_chunkSize_getter() {
    if (!this.lengthKnown) {
        this.CacheLength();
    }
    return this._chunkSize;
}

function LazyUint8Array(url, fallbackLength) {
    this.fallbackLength = fallbackLength;
    this.overlay = [];
    this.url = url;
    this.lengthKnown = false;
    this.chunks = []; // Loaded chunks. Index is the chunk number
    Object.defineProperty(this, "length", { get: LazyUint8Array_length_getter });
    Object.defineProperty(this, "chunkSize", { get: LazyUint8Array_chunkSize_getter });
}

LazyUint8Array.prototype.Set = function LazyUint8Array_Set(idx, data) {
    if (idx > this.length-1 || idx < 0) {
        return undefined;
    }
    this.overlay[idx] = data;
}

LazyUint8Array.prototype.Get = function LazyUint8Array_Get(idx) {
    if (idx > this.length-1 || idx < 0) {
        return undefined;
    }
    if (typeof(this.overlay[idx]) !== "undefined") return this.overlay[idx];
    var chunkOffset = idx % this.chunkSize;
    var chunkNum = (idx / this.chunkSize)|0;
    return this.GetChunk(chunkNum)[chunkOffset];
}

LazyUint8Array.prototype.DoXHR = function LazyUint8Array_DoXHR(from, to) {
    if (from > to) message.Error("Invalid range (" + from + ", " + to + ") or no bytes requested!");
    if (to > this._length-1) message.Error("Only " + this._length + " bytes available! programmer error!");

    var xhr = new XMLHttpRequest();
    xhr.open('GET', this.url, false);
    if (this._length !== this._chunkSize) xhr.setRequestHeader("Range", "bytes=" + from + "-" + to);

    xhr.responseType = 'arraybuffer';

    xhr.send(null);
    if (!(xhr.status >= 200 && xhr.status < 300 || xhr.status === 304)) throw new Error("Couldn't load " + this.url + ". Status: " + xhr.status);
    return new Uint8Array(xhr.response || []);
}

LazyUint8Array.prototype.GetChunk = function LazyUint8Array_GetChunk(chunkNum) {
    var start = chunkNum * this._chunkSize;
    var end = (chunkNum+1) * this._chunkSize - 1; // including this byte
    end = Math.min(end, this._length-1); // if length-1 is selected, this is the last block
    if (typeof(this.chunks[chunkNum]) === "undefined") {
      this.chunks[chunkNum] = this.DoXHR(start, end);
    }
    return this.chunks[chunkNum];
}

LazyUint8Array.prototype.CacheLength = function LazyUint8Array_CacheLength() {
    // Find length
    var xhr = new XMLHttpRequest();
    xhr.open('HEAD', this.url + "?" + new Date().getTime(), false);
    xhr.send(null);

    if (!(xhr.status >= 200 && xhr.status < 300 || xhr.status === 304)) throw new Error("Couldn't load " + this.url + ". Status: " + xhr.status);
    this._length = Number(xhr.getResponseHeader("Content-length"));
    if (this._length === 0) {
        message.Warning("Server doesn't return Content-length, even though we have a cache defeating URL query-string appended");
        this._length = this.fallbackLength;
    }

    this._chunkSize = 1024*1024; // Chunk size in bytes

    var header;
    var hasByteServing = (header = xhr.getResponseHeader("Accept-Ranges")) && header === "bytes";
    if (!hasByteServing) this._chunkSize = this._length;

    this.lengthKnown = true;
}

module.exports = LazyUint8Array;

},{"../messagehandler":33}],29:[function(require,module,exports){
// -------------------------------------------------
// -------------------- TAR ------------------------
// -------------------------------------------------
// TAR file support for the filesystem

"use strict";

var message = require('../messagehandler');

var S_IRWXUGO = 0x1FF;
var S_IFMT = 0xF000;
var S_IFSOCK = 0xC000;
var S_IFLNK = 0xA000;
var S_IFREG = 0x8000;
var S_IFBLK = 0x6000;
var S_IFDIR = 0x4000;
var S_IFCHR = 0x2000;

function TAR(filesystem) {
    this.fs = filesystem;
    this.tarbuffer = new Uint8Array(512);
    this.tarbufferofs = 0;
    this.tarmode = 0; // mode = 0: header, mode!=0: file
    this.tarfileoffset = 0;
}

function ReadStringFromBinary(buffer, offset, numBytes) {
    var str = "";
    for(var i=0; i<numBytes; i++) {
        if (buffer[offset+i] < 32) return str; // no special signs
        str = str + String.fromCharCode(buffer[offset+i]);
    }
    return str;
};

function WriteStringToBinary(str, buffer, offset, numBytes) {
    var n = Math.min(numBytes, str.length+1);
    for(var i=0; i<n; i++) {
        buffer[offset+i] = str.charCodeAt(i);
    }
    buffer[offset+n-1] = 0;
};

// Receives a stream of bytes
TAR.prototype.Unpack = function(x) {
    this.tarbuffer[this.tarbufferofs++] = x;
    if (this.tarbufferofs != 512) return;
    this.tarbufferofs = 0;

    if (this.tarmode == 1) {
        var n = Math.min(512, this.tarfilebuffer.length - this.tarfileoffset);
        for(var i=0; i<n; i++) {
            this.tarfilebuffer[this.tarfileoffset++] = this.tarbuffer[i];
        }
        if (this.tarfileoffset >= this.tarfilebuffer.length) this.tarmode = 0; // file finished loading, change mode
        return;
    }

    // tarmode = 0
    var magic = ReadStringFromBinary(this.tarbuffer, 257, 5);
    if (magic != "ustar") return;

    var typeflag = String.fromCharCode(this.tarbuffer[156]);
    var name = ReadStringFromBinary(this.tarbuffer, 0, 100);
    //message.Debug("name:" + name);
    //TODO: use searchpath function
    var walk = name.split("/");
    var n = walk.length;
    if (walk[n-1].length == 0) walk.pop();
    var n = walk.length;
    //message.Debug("walk:" + walk);

    var parentid = 0;
    var id = -1;
    for(var i=0; i<n-1; i++) {
        id = this.fs.Search(parentid, walk[i]);
        if (id == -1) throw "Error in untar: Could not find inode.";
        parentid = id;
    }
    id = this.fs.Search(parentid, walk[walk.length-1]);

    if (id != -1) return;

    if ((id != -1) && (typeflag != '5')) {
        //throw "Warning: File already exists";
        return; // do not overwrite
    }
    if ((id != -1) && (typeflag == '5')) {
        return;
    }

    var inode = this.fs.CreateInode();
    inode.name = walk[n-1];
    inode.parentid = parentid;
    inode.mode = parseInt(ReadStringFromBinary(this.tarbuffer, 100, 8), 8);
    inode.uid = parseInt(ReadStringFromBinary(this.tarbuffer, 108, 8), 8);
    inode.gid = parseInt(ReadStringFromBinary(this.tarbuffer, 116, 8), 8);
    inode.atime = parseInt(ReadStringFromBinary(this.tarbuffer, 136, 12), 8);
    inode.ctime = this.atime;
    inode.mtime = this.atime;
    var size = parseInt(ReadStringFromBinary(this.tarbuffer, 124, 12), 8);

    switch(typeflag) {
    case "5":
        inode.mode |= S_IFDIR;
        break;

    case "0":
        inode.mode |= S_IFREG;
        inode.data = new Uint8Array(size);
        inode.size = size;
        if (size == 0) break;
        this.tarmode = 1;
        this.tarfileoffset = 0;
        this.tarfilebuffer = inode.data;
        break;

    case "1":
        inode.mode |= S_IFLNK;
        inode.symlink = "/"+ReadStringFromBinary(this.tarbuffer, 157, 100);
        break;

    case "2":
        inode.mode |= S_IFLNK;
        inode.symlink = ReadStringFromBinary(this.tarbuffer, 157, 100);
        break;
    }
    this.fs.PushInode(inode);
}

TAR.prototype.Pack = function(path) {
    message.Debug("tar: " + path);
    var id = this.fs.SearchPath(path).id;
    if (id == -1) return new Uint8Array(0);
    var filelist = [];
    this.fs.GetRecursiveList(id, filelist);
    var size = 0;
    for(var i=0; i<filelist.length; i++) {
        switch(this.fs.inodes[filelist[i]].mode&S_IFMT)
        {
            case S_IFLNK:
            case S_IFDIR:
                size += 512;
               break;
            case S_IFREG:
                size += 512;
                size += this.fs.inodes[filelist[i]].size;
                if (size & 511) {size = size & (~0x1FF); size += 512;}
                break;
        }
    }
    message.Debug("tar: " + this.fs.GetFullPath(id) + " size: " + size + " files: " + filelist.length);
    message.Debug(filelist);

    var buffer = new Uint8Array(size);
    var offset = 0;
    for(var i=0; i<filelist.length; i++) {
        var inode = this.fs.inodes[filelist[i]];
        var type = inode.mode&S_IFMT;
        if ((type != S_IFLNK) && (type != S_IFDIR) && (type != S_IFREG)) continue;
        WriteStringToBinary("ustar  ", buffer, offset+257, 8);
        WriteStringToBinary(this.fs.GetFullPath(filelist[i]), buffer, offset+0, 100);
        WriteStringToBinary("00000000000", buffer, offset+124, 12); // size
        WriteStringToBinary((inode.mode&0xFFF).toString(8), buffer, offset+100, 8); // mode
        WriteStringToBinary(inode.uid.toString(8), buffer, offset+108, 8); // uid
        WriteStringToBinary(inode.gid.toString(8), buffer, offset+116, 8); // gid
        WriteStringToBinary((inode.mtime).toString(8), buffer, offset+136, 12); // mtime
        if (inode.mtime === undefined) {
            inode.mtime = Math.floor((new Date()).getTime()/1000);
        }
        //WriteStringToBinary("root", buffer, offset+265, 7);
        //WriteStringToBinary("root", buffer, offset+297, 7); // chksum blank to calculate the checksum

        buffer[offset+148+0] = 32; // chksum
        buffer[offset+148+1] = 32;
        buffer[offset+148+2] = 32;
        buffer[offset+148+3] = 32;
        buffer[offset+148+4] = 32;
        buffer[offset+148+5] = 32;
        buffer[offset+148+6] = 32;
        buffer[offset+148+7] = 32;

        switch(type)
        {
            case S_IFLNK:
                buffer[offset+156] = "2".charCodeAt(0);
                WriteStringToBinary(inode.symlink, buffer, offset+157, 100);
                break;

            case S_IFDIR:
                buffer[offset+156] = "5".charCodeAt(0);
                break;

            case S_IFREG:
                buffer[offset+156] = "0".charCodeAt(0);
                WriteStringToBinary(inode.size.toString(8), buffer, offset+124, 12);
                break;
        }
        var chksum = 0;
        for(var j=0; j<512; j++) {
            chksum += buffer[offset + j];
        }
        WriteStringToBinary(chksum.toString(8), buffer, offset+148, 7);
        offset += 512;

        if (type == S_IFREG) { // copy the file
            for(var j=0; j<inode.size; j++) {
                buffer[offset++] = inode.data[j];
            }
            if (offset & 511) {offset = offset & (~0x1FF); offset += 512;}
        }
    }
    return buffer;
}

module.exports = TAR;

},{"../messagehandler":33}],30:[function(require,module,exports){
// In case math.imul doesn't exists: 
// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/imul

module.exports = Math.imul || function(a, b) {
    var ah  = (a >>> 16) & 0xffff;
    var al = a & 0xffff;
    var bh  = (b >>> 16) & 0xffff;
    var bl = b & 0xffff;
    // the shift by 0 fixes the sign on the high part
    // the final |0 converts the unsigned value into a signed value
    return ((al * bl) + (((ah * bl + al * bh) << 16) >>> 0)|0);
};

},{}],31:[function(require,module,exports){
// -------------------------------------------------
// --------------- INIT OPENRISC -------------------
// -------------------------------------------------

"use strict";
// common
var message = require('./messagehandler'); // global variable
var utils = require('./utils');

// CPU
var OR1KCPU = require('./or1k');

var UARTDev = require('./dev/uart');
var IRQDev = require('./dev/irq');
var TimerDev = require('./dev/timer');
var FBDev = require('./dev/framebuffer');
var EthDev = require('./dev/ethmac');
var ATADev = require('./dev/ata');
var RTCDev = require('./dev/rtc');
var TouchscreenDev = require('./dev/touchscreen');
var KeyboardDev = require('./dev/keyboard');
var SoundDev = require('./dev/sound');
var VirtIODev = require('./dev/virtio');
var Virtio9p = require('./dev/virtio/9p');
var VirtioDummy = require('./dev/virtio/dummy');
var VirtioInput = require('./dev/virtio/input');
var VirtioNET = require('./dev/virtio/net');
var VirtioBlock = require('./dev/virtio/block');
var VirtioGPU = require('./dev/virtio/gpu');
var VirtioConsole = require('./dev/virtio/console');

/*
    Heap Layout for OpenRISC emulation
    ==================================
    The heap is needed by the asm.js CPU.
    For compatibility all CPUs use the same layout
    by using the different views of typed arrays

    ------ Core 1 ------
    0x0     -  0x7F     32 CPU registers
    0x80    -  0x1FFF   CPU specific, usually unused or temporary data
    0x2000  -  0x3FFF   group 0 (system control and status)
    0x4000  -  0x5FFF   group 1 (data MMU)
    0x6000  -  0x7FFF   group 2 (instruction MMU)
    ------ Core 2 ------
    0x8000  -  0x807F   32 CPU registers
    0x8080  -  0x9FFF   CPU specific, usually unused or temporary data
    0xA000  -  0xBFFF   group 0 (system control and status)
    0xC000  -  0xDFFF   group 1 (data MMU)
    0xE000  -  0xFFFF   group 2 (instruction MMU)
    ------ Core 3 ------
    ...
    ------- RAM --------
    0x100000 -  ...     RAM
*/

async function InitOpenRISC(system, initdata) {
    message.Debug("Init OpenRISC SoC with CPU type " + initdata.cpu);

    var irqhandler = system;
    system.cpu = new OR1KCPU(initdata.cpu, system.ram, system.heap, system.ncores);

    try {
        await system.cpu.Init();
    } catch (e) {
        message.Debug("Error: failed to create CPU:" + e);
        message.Abort();
    }

    system.devices.push(system.cpu);

    system.irqdev = new IRQDev(irqhandler);
    system.timerdev = new TimerDev();
    system.uartdev0 = new UARTDev(0, irqhandler, 0x2);
    system.uartdev1 = new UARTDev(1, irqhandler, 0x3);
    system.ethdev = new EthDev(system.ram, irqhandler);
    system.ethdev.TransmitCallback = function(data) {
        message.Send("ethmac", data);
    };

    system.fbdev = new FBDev(system.ram);
    system.atadev = new ATADev(irqhandler);
    system.tsdev = new TouchscreenDev(irqhandler);
    system.kbddev = new KeyboardDev(irqhandler);
    system.snddev = new SoundDev(irqhandler, system.ram);
    system.rtcdev = new RTCDev(irqhandler);

    //system.virtioinputdev = new VirtioInput(system.ram);
    //system.virtionetdev = new VirtioNET(system.ram);
    //system.virtioblockdev = new VirtioBlock(system.ram);
    system.virtiodummydev = new VirtioDummy(system.ram);
    //system.virtiogpudev = new VirtioGPU(system.ram);
    //system.virtioconsoledev = new VirtioConsole(system.ram);
    system.virtiodev1 = new VirtIODev(irqhandler, 0x6, system.ram, system.virtio9pdev);
    system.virtiodev2 = new VirtIODev(irqhandler, 0xB, system.ram, system.virtiodummydev);
    system.virtiodev3 = new VirtIODev(irqhandler, 0xC, system.ram, system.virtiodummydev);

    system.devices.push(system.irqdev);
    system.devices.push(system.timerdev);
    system.devices.push(system.uartdev0);
    system.devices.push(system.uartdev1);
    system.devices.push(system.ethdev);
    system.devices.push(system.fbdev);
    system.devices.push(system.atadev);
    system.devices.push(system.tsdev);
    system.devices.push(system.kbddev);
    system.devices.push(system.snddev);
    system.devices.push(system.rtcdev);
    system.devices.push(system.virtio9pdev);
    system.devices.push(system.virtiodev1);
    system.devices.push(system.virtiodev2);
    system.devices.push(system.virtiodev3);

    //system.devices.push(system.virtioinputdev);
    //system.devices.push(system.virtionetdev);
    //system.devices.push(system.virtioblockdev);
    system.devices.push(system.virtiodummydev);
    //system.devices.push(system.virtiogpudev);
    //system.devices.push(system.virtioconsoledev);

    system.ram.AddDevice(system.uartdev0,   0x90000000, 0x7);
    system.ram.AddDevice(system.fbdev,      0x91000000, 0x1000);
    system.ram.AddDevice(system.ethdev,     0x92000000, 0x1000);
    system.ram.AddDevice(system.tsdev,      0x93000000, 0x1000);
    system.ram.AddDevice(system.kbddev,     0x94000000, 0x100);
    system.ram.AddDevice(system.uartdev1,   0x96000000, 0x7);
    system.ram.AddDevice(system.virtiodev1, 0x97000000, 0x1000);
    system.ram.AddDevice(system.snddev,     0x98000000, 0x400);
    system.ram.AddDevice(system.rtcdev,     0x99000000, 0x1000);
    system.ram.AddDevice(system.irqdev,     0x9A000000, 0x1000);
    system.ram.AddDevice(system.timerdev,   0x9B000000, 0x1000);
    system.ram.AddDevice(system.virtiodev2, 0x9C000000, 0x1000);
    system.ram.AddDevice(system.virtiodev3, 0x9D000000, 0x1000);
    system.ram.AddDevice(system.atadev,     0x9E000000, 0x1000);
    message.Debug("Init OpenRISC SoC finished");
}

module.exports = InitOpenRISC;

},{"./dev/ata":3,"./dev/ethmac":5,"./dev/framebuffer":6,"./dev/irq":7,"./dev/keyboard":8,"./dev/rtc":11,"./dev/sound":12,"./dev/timer":13,"./dev/touchscreen":14,"./dev/uart":15,"./dev/virtio":16,"./dev/virtio/9p":17,"./dev/virtio/block":18,"./dev/virtio/console":19,"./dev/virtio/dummy":20,"./dev/virtio/gpu":21,"./dev/virtio/input":22,"./dev/virtio/net":24,"./messagehandler":33,"./or1k":36,"./utils":48}],32:[function(require,module,exports){
// -------------------------------------------------
// ---------------- INIT RISCV ---------------------
// -------------------------------------------------

/*
compile dts file via
dtc -O dtb riscv.dts > riscv.dtb
od -A n -t x1 -v riscv.dtb | sed 's/ /,0x/g'
*/

"use strict";
// common
var message = require('./messagehandler'); // global variable
var utils = require('./utils');

// CPU
var RISCVCPU = require('./riscv');;

// Devices
var HTIF = require('./riscv/htif');
var CLINTDev = require('./dev/clint');
var PLICDev = require('./dev/plic');
var ROMDev = require('./dev/rom');
var UARTDev = require('./dev/uart');

//var IRQDev = require('./dev/irq');
//var TimerDev = require('./dev/timer');
//var FBDev = require('./dev/framebuffer');
//var EthDev = require('./dev/ethmac');
//var ATADev = require('./dev/ata');
//var RTCDev = require('./dev/rtc');
//var TouchscreenDev = require('./dev/touchscreen');
//var KeyboardDev = require('./dev/keyboard');
//var SoundDev = require('./dev/sound');
var VirtIODev = require('./dev/virtio');
var Virtio9p = require('./dev/virtio/9p');
var VirtioDummy = require('./dev/virtio/dummy');
var VirtioNET = require('./dev/virtio/net');
//var VirtioInput = require('./dev/virtio/input');
//var VirtioBlock = require('./dev/virtio/block');
//var VirtioGPU = require('./dev/virtio/gpu');
//var VirtioConsole = require('./dev/virtio/console');

async function InitRISCV(system, initdata) {
    message.Debug("Init RISCV SoC");
    var irqhandler = system;

    // at the moment the htif interface is part of the CPU initialization.
    // However, it uses uartdev0
    system.htif = new HTIF(system.ram, system);
    system.cpu = new RISCVCPU(initdata.cpu, system.ram, system.htif, system.heap, system.ncores);

    try {
        await system.cpu.Init();
    } catch (e) {
        message.Debug("Error: failed to create CPU:" + e);
        message.Abort();
    }

    system.devices.push(system.cpu);

    system.rom = new ArrayBuffer(0x2000);
    var buffer32view = new Int32Array(system.rom);
    var buffer8view = new Uint8Array(system.rom);
    // boot process starts at 0x1000
    buffer32view[0x400] = 0x297 + 0x80000000 - 0x1000; // auipc t0, DRAM_BASE=0x80000000
    buffer32view[0x401] = 0x597; // auipc a1, 0 // a1 = 0x1004
    buffer32view[0x402] = 0x58593 + ((8*4-4)<<20); // addi a1, a1, 0 (pointer to dtb)
    buffer32view[0x403] = 0xf1402573; // csrr a0,mhartid
    buffer32view[0x404] = 0x00028067  // jalr zero, t0, 0 (jump straight to DRAM_BASE)
    buffer32view[0x405] = 0x00000000; // trap vector
    buffer32view[0x406] = 0x00000000; // trap vector
    buffer32view[0x407] = 0x00000000; // trap vector

    message.Debug("Load DTB");
    utils.LoadBinaryResourceII(initdata.dtbURL,
    function(buffer) {
        var configstring = new Uint8Array(buffer);
        for(var i=0; i<configstring.length; i++) buffer8view[0x1020+i] = configstring[i];
    }.bind(this)
    , false, function(error){throw error;});

    system.virtionetdev = new VirtioNET(system.ram);
    system.virtiodummydev = new VirtioDummy(system.ram);
    //system.virtioinputdev = new VirtioInput(system.ram);
    //system.virtioblockdev = new VirtioBlock(system.ram);
    //system.virtiogpudev = new VirtioGPU(system.ram);
    //system.virtioconsoledev = new VirtioConsole(system.ram);

    system.virtiodev1 = new VirtIODev(irqhandler, 0x3, system.ram, system.virtio9pdev);
    system.virtiodev2 = new VirtIODev(irqhandler, 0x4, system.ram, system.virtionetdev);
    system.virtiodev3 = new VirtIODev(irqhandler, 0x5, system.ram, system.virtiodummydev);
    system.virtiodev4 = new VirtIODev(irqhandler, 0x6, system.ram, system.virtiodummydev);
    system.virtiodev5 = new VirtIODev(irqhandler, 0x7, system.ram, system.virtiodummydev);
    system.romdev     = new ROMDev(system.rom);
    system.uartdev0   = new UARTDev(0, irqhandler, 2);
    system.clintdev   = new CLINTDev(system.csr);
    system.plicdev    = new PLICDev(system.cpu);

    system.devices.push(system.romdev);
    system.devices.push(system.uartdev0);
    system.devices.push(system.clintdev);
    system.devices.push(system.plicdev);
    system.devices.push(system.virtiodev1);
    system.devices.push(system.virtiodev2);
    system.devices.push(system.virtiodev3);
    system.devices.push(system.virtiodev4);
    system.devices.push(system.virtiodev5);
    system.devices.push(system.virtio9pdev);

    system.ram.AddDevice(system.romdev,      0x00000000, 0x7);
    system.ram.AddDevice(system.uartdev0,    0x03000000, 0x2000);
    system.ram.AddDevice(system.clintdev,    0x02000000, 0x2000);
    system.ram.AddDevice(system.plicdev,     0x04000000, 0xF00000);
    system.ram.AddDevice(system.virtiodev1,  0x20000000, 0x2000);
    system.ram.AddDevice(system.virtiodev2,  0x30000000, 0x2000);
    system.ram.AddDevice(system.virtiodev3,  0x40000000, 0x2000);
    system.ram.AddDevice(system.virtiodev4,  0x50000000, 0x2000);
    system.ram.AddDevice(system.virtiodev5,  0x60000000, 0x2000);
    message.Debug("Init RISC-V SoC finished");
}

module.exports = InitRISCV;

},{"./dev/clint":4,"./dev/plic":9,"./dev/rom":10,"./dev/uart":15,"./dev/virtio":16,"./dev/virtio/9p":17,"./dev/virtio/dummy":20,"./dev/virtio/net":24,"./messagehandler":33,"./riscv":43,"./riscv/htif":42,"./utils":48}],33:[function(require,module,exports){
// -------------------------------------------------
// ------------- MessageHandler --------------------
// -------------------------------------------------

"use strict";

var run = true;
var workingpath = '';

function Send(command, data) {
    postMessage(
    {
        "command" : command,
        "data" : data
    }
    );
}

function Debug(message) {
    Send("Debug", message);
}

function Abort() {
    Debug("Worker: Abort execution.");
    if (typeof messagemap["PrintOnAbort"] == 'function') {
            messagemap["PrintOnAbort"]();
    }
    Send("Abort", {});
    run = false;
    throw new Error('Kill worker'); // Don't return
}

function DoError(message) {
    Send("Debug", "Error: " + message);
    Abort();
}

function Warning(message) {
    Send("Debug", "Warning: " + message);
}

var messagemap = new Object();

function Register(message, OnReceive) {
    messagemap[message] = OnReceive;
}

// this is a global object of the worker
onmessage = function(e) {
    if (!run) return; // ignore all messages after an error

    var command = e.data.command;
    if (typeof messagemap[command] == 'function') {
        try {
            messagemap[command](e.data.data);
        } catch (error) {
            Debug("Worker: Unhandled exception in command \"" + command + "\": " + error.message);
            Debug(error.stack);
            run = false;
        }
        return;
    }
}

Register("Abort", function(){ run = false; });
Register("WorkingPath", function(data){ workingpath = data; });

module.exports.Register = Register;
module.exports.Debug = Debug;
module.exports.Error = DoError;
module.exports.Warning = Warning;
module.exports.Abort = Abort;
module.exports.Send = Send;
module.exports.GetWorkingPath = function() { return workingpath; };

},{}],34:[function(require,module,exports){
// -------------------------------------------------
// ----------------- Dynamic CPU -------------------
// -------------------------------------------------
"use strict";

var message = require('../../messagehandler');
var utils = require('../../utils');

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
var EXCEPT_SYSCALL = 0xC00; // syscall, jump into supervisor mode
var EXCEPT_TRAP = 0xE00; // syscall, jump into supervisor mode

// constructor
function DynamicCPU(ram) {
    this.ram = ram;

    // registers
    // r[32] and r[33] are used to calculate the virtual address and physical address
    // to make sure that they are not transformed accidently into a floating point number
    this.r = new Int32Array(this.ram.heap, 0, 34 << 2);
    this.f = new Float32Array(this.ram.heap, 0, 32 << 2);

    // special purpose registers
    this.group0 = new Int32Array(this.ram.heap, 0x2000, 0x2000);

    // data tlb
    this.group1 = new Int32Array(this.ram.heap, 0x4000, 0x2000);

    // instruction tlb
    this.group2 = new Int32Array(this.ram.heap, 0x6000, 0x2000);

    // define variables and initialize
    this.pc = 0x0; // instruction pointer in multiples of four
    this.nextpc = 0x0; // pointer to next instruction in multiples of four
    this.fence = 0x0;
    this.ppc = 0x0;
    this.delayedins_at_fence = false;

    this.delayedins = false; // the current instruction is an delayed instruction, one cycle before a jump
    this.raise_interrupt = false;
    this.idle = false;

    this.EA = -1; // hidden register for atomic lwa operation

    this.TTMR = 0x0; // Tick timer mode register
    this.TTCR = 0x0; // Tick timer count register

    this.PICMR = 0x3; // interrupt controller mode register (use nmi)
    this.PICSR = 0x0; // interrupt controller set register

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

    this.recompilepath = '';
    this.recompilepid = -1;

    this.Reset();
}

DynamicCPU.prototype.Reset = function() {
    this.TTMR = 0x0;
    this.TTCR = 0x0;
    this.PICMR = 0x3;
    this.PICSR = 0x0;

    this.group0[SPR_IMMUCFGR] = 0x18; // 0 ITLB has one way and 64 sets
    this.group0[SPR_DMMUCFGR] = 0x18; // 0 DTLB has one way and 64 sets
    this.group0[SPR_ICCFGR] = 0x48;
    this.group0[SPR_DCCFGR] = 0x48;
    this.group0[SPR_VR] = 0x12000001;

    // UPR present
    // data mmu present
    // instruction mmu present
    // PIC present (architecture manual seems to be wrong here)
    // Tick timer present
    this.group0[SPR_UPR] = 0x619;

    this.ppc = 0x0;

    this.Exception(EXCEPT_RESET, 0x0); // set pc values
    this.pc = this.nextpc;
    this.nextpc = this.nextpc + 1|0;
}

DynamicCPU.prototype.InvalidateTLB = function() {
}

DynamicCPU.prototype.GetTimeToNextInterrupt = function () {

    if ((this.TTMR >> 30) == 0) return -1;
    var delta = (this.TTMR & 0xFFFFFFF) - (this.TTCR & 0xFFFFFFF);
    return delta;
}

DynamicCPU.prototype.GetTicks = function () {
    if ((this.TTMR >> 30) == 0) return -1;
    return this.TTCR & 0xFFFFFFF;
}

DynamicCPU.prototype.ProgressTime = function (delta) {
    this.TTCR = (this.TTCR + delta) & 0xFFFFFFFF;
}

DynamicCPU.prototype.AnalyzeImage = function() // we haveto define these to copy the cpus
{
    this.boot_dtlb_misshandler_address = this.ram.int32mem[0x900]|0;
    this.boot_itlb_misshandler_address = this.ram.int32mem[0xA00]|0;;
    this.current_pgd = ((this.ram.int32mem[0x2010 >> 2]&0xFFF)<<16) | (this.ram.int32mem[0x2014 >> 2] & 0xFFFF)|0;;
}

DynamicCPU.prototype.SetFlags = function (x) {
    this.SR_SM = (x & (1 << 0)) ? true : false;
    this.SR_TEE = (x & (1 << 1)) ? true : false;
    var old_SR_IEE = this.SR_IEE;
    this.SR_IEE = (x & (1 << 2)) ? true : false;
    this.SR_DCE = (x & (1 << 3)) ? true : false;
    this.SR_ICE = (x & (1 << 4)) ? true : false;
    var old_SR_DME = this.SR_DME;
    this.SR_DME = (x & (1 << 5)) ? true : false;
    var old_SR_IME = this.SR_IME;
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
    this.SR_CID = (x >> 28) & 0xF;
    if (this.SR_LEE) {
        message.Debug("little endian not supported");
        message.Abort();
    }
    if (this.SR_CID) {
        message.Debug("context id not supported");
        message.Abort();
    }
    if (this.SR_EPH) {
        message.Debug("exception prefix not supported");
        message.Abort();
    }
    if (this.SR_DSX) {
        message.Debug("delay slot exception not supported");
        message.Abort();
    }
    if (this.SR_IEE && !old_SR_IEE) {
        this.CheckForInterrupt();
    }
};

DynamicCPU.prototype.GetFlags = function () {
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

DynamicCPU.prototype.CheckForInterrupt = function () {
    if (!this.SR_IEE) {
        return;
    }
    if (this.PICMR & this.PICSR) {
        this.raise_interrupt = true;
    }
};

DynamicCPU.prototype.RaiseInterrupt = function (line, cpuid) {
    var lmask = 1 << line;
    this.PICSR |= lmask;
    this.CheckForInterrupt();
};

DynamicCPU.prototype.ClearInterrupt = function (line, cpuid) {
    this.PICSR &= ~(1 << line);
};

DynamicCPU.prototype.FetchAndInstantiate = function(url, importObject) {
  return fetch(url).then(response =>
    response.arrayBuffer()
  ).then(bytes =>
    //WebAssembly.compile(bytes)
    WebAssembly.instantiate(bytes, importObject)
  ).then(results => {
    message.Debug('compiled');
    this.instance = results.instance;
    }
  );
}


DynamicCPU.prototype.SetSPR = function (idx, x) {
    var address = idx & 0x7FF;
    var group = (idx >> 11) & 0x1F;

    switch (group) {
    case 0:
        if (address == SPR_SR) {
            this.SetFlags(x);
        }
        if (address == 20) {
            //message.Debug('current pid: ' + x);
        } else
        if (address == 21) {
            this.recompilepid = x;
            if (x == -1) this.recompilepath = '';
            else {
                message.Debug("recompile pid: " + x + " path:" + this.recompilepath);
                var importObject = {
                    env: {
                        Exception: function(excepttype, addr) {
                            //message.Debug("Exception called at " + utils.ToHex(addr));
                            //message.Abort();
                            this.SR_F = !!this.instance.exports.GetSR_F();
                            this.pc = this.instance.exports.GetPC()>>2;
                            this.delayedins = false;
                            this.Exception(excepttype, addr);
                        }.bind(this),
                        ramp: 0x100000,
                        group1p: 0x4000,
                        current_pgd: this.current_pgd,
                        EXCEPT_DPF: 0x300,
                        memory: this.ram.memory,
                        table: new WebAssembly.Table({initial:0, maximum:0, element:"anyfunc"}),
                        memoryBase: 0x0,
                        tableBase: 0x0
                    },
                };
                if (this.recompilepath == "/usr/bin/fbdemo")
                this.FetchAndInstantiate(message.GetWorkingPath()+"/precompiled/fbdemo.wasm", importObject);
            }
        } else
        if (address == 22) {
            this.recompilepath += String.fromCharCode(x);
        }
        this.group0[address] = x;
        break;
    case 1:
        // Data MMU
        this.group1[address] = x;
        break;
    case 2:
        // ins MMU
        this.group2[address] = x;
        break;
    case 3:
        // data cache, not supported
    case 4:
        // ins cache, not supported
        break;
    case 8:
        this.idle = true;
        break;
    case 9:
        // pic
        switch (address) {
        case 0:
            this.PICMR = x | 0x3; // we use non maskable interrupt here
            // check immediate for interrupt
            if (this.SR_IEE) {
                if (this.PICMR & this.PICSR) {
                    message.Debug("Error in SetSPR: Direct triggering of interrupt exception not supported?");
                    message.Abort();
                }
            }
            break;
        case 2: // PICSR
            break;
        default:
            message.Debug("Error in SetSPR: interrupt address not supported");
            message.Abort();
        }
        break;
    case 10:
        //tick timer
        switch (address) {
        case 0:
            this.TTMR = x;
            if (((this.TTMR >> 30)&3) != 0x3) {
                message.Debug("Error in SetSPR: Timer mode other than continuous not supported");
                message.Abort();
            }
            break;
        case 1:
            this.TTCR = x;
            break;
        default:
            message.Debug("Error in SetSPR: Tick timer address not supported");
            message.Abort();
            break;
        }
        break;

    default:
        message.Debug("Error in SetSPR: group " + group + " not found");
        message.Abort();
        break;
    }
};

DynamicCPU.prototype.GetSPR = function (idx) {
    var address = idx & 0x7FF;
    var group = (idx >> 11) & 0x1F;

    switch (group) {
    case 0:
        if (address == SPR_SR) {
            return this.GetFlags();
        }
        return this.group0[address];
    case 1:
        return this.group1[address];
    case 2:
        return this.group2[address];
    case 8:
        return 0x0;

    case 9:
        // pic
        switch (address) {
        case 0:
            return this.PICMR;
        case 2:
            return this.PICSR;
        default:
            message.Debug("Error in GetSPR: PIC address unknown");
            message.Abort();
            break;
        }
        break;

    case 10:
        // tick Timer
        switch (address) {
        case 0:
            return this.TTMR;
        case 1:
            return this.TTCR; // or clock
        default:
            message.Debug("Error in GetSPR: Tick timer address unknown");
            message.Abort();
            break;
        }
        break;
    default:
        message.Debug("Error in GetSPR: group " + group +  " unknown");
        message.Abort();
        break;
    }
};


DynamicCPU.prototype.Exception = function (excepttype, addr) {
    var except_vector = excepttype | (this.SR_EPH ? 0xf0000000 : 0x0);
    //message.Debug("Info: Raising Exception " + utils.ToHex(excepttype));

    this.SetSPR(SPR_EEAR_BASE, addr);
    this.SetSPR(SPR_ESR_BASE, this.GetFlags());

    this.EA = -1;
    this.SR_OVE = false;
    this.SR_SM = true;
    this.SR_IEE = false;
    this.SR_TEE = false;
    this.SR_DME = false;

    this.fence = this.ppc;

    this.nextpc = except_vector>>2;

    switch (excepttype) {
    case EXCEPT_RESET:
        break;

    case EXCEPT_ITLBMISS:
    case EXCEPT_IPF:
    case EXCEPT_DTLBMISS:
    case EXCEPT_DPF:
    case EXCEPT_BUSERR:
    case EXCEPT_TICK:
    case EXCEPT_INT:
    case EXCEPT_TRAP:
        this.SetSPR(SPR_EPCR_BASE, (this.pc<<2) - (this.delayedins ? 4 : 0));
        break;

    case EXCEPT_SYSCALL:
        this.SetSPR(SPR_EPCR_BASE, (this.pc<<2) + 4 - (this.delayedins ? 4 : 0));
        break;
    default:
        message.Debug("Error in Exception: exception type not supported");
        message.Abort();
    }
    this.delayedins = false;
    this.delayedins_at_fence = false;
    this.SR_IME = false;

};


DynamicCPU.prototype.DTLBLookup = function (addr, write) {
    if (!this.SR_DME) {
        return addr;
    }
    // pagesize is 8192 bytes
    // nways are 1
    // nsets are 64

    var setindex = (addr >> 13) & 63;
    var tlmbr = this.group1[0x200 | setindex]; // match register
    if (((tlmbr & 1) == 0) || ((tlmbr >> 19) != (addr >> 19))) {
        this.Exception(EXCEPT_DTLBMISS, addr);
        return -1;
    }
        // set lru
        if (tlmbr & 0xC0) {
            message.Debug("Error: LRU ist not supported");
            message.Abort();
        }

    var tlbtr = this.group1[0x280 | setindex]; // translate register

    // check if supervisor mode
    if (this.SR_SM) {
        if (
            ((!write) && (!(tlbtr & 0x100))) || // check if SRE
            ((write) && (!(tlbtr & 0x200)))     // check if SWE
           ) {
            this.Exception(EXCEPT_DPF, addr);
            return -1;
           }
    } else {
        if (
               ((!write) && (!(tlbtr & 0x40))) || // check if URE
               ((write) && (!(tlbtr & 0x80)))     // check if UWE
           ) {
            this.Exception(EXCEPT_DPF, addr);
            return -1;
           }
    }
    return ((tlbtr & 0xFFFFE000) | (addr & 0x1FFF));
};

// the slow and safe version
DynamicCPU.prototype.GetInstructionPointer = function (addr) {
    if (!this.SR_IME) {
        return addr;
    }
    // pagesize is 8192 bytes
    // nways are 1
    // nsets are 64

    var setindex = (addr >> 13) & 63;
    setindex &= 63; // number of sets
    var tlmbr = this.group2[0x200 | setindex];

    // test if tlmbr is valid
    if (((tlmbr & 1) == 0) || ((tlmbr >> 19) != (addr >> 19))) {
        this.Exception(EXCEPT_ITLBMISS, this.pc<<2);
        return -1;
    }
    // set lru
    if (tlmbr & 0xC0) {
        message.Debug("Error: LRU ist not supported");
        message.Abort();
    }

    var tlbtr = this.group2[0x280 | setindex];
    //Test for page fault
    // check if supervisor mode
    if (this.SR_SM) {
        // check if user read enable is not set(URE)
        if (!(tlbtr & 0x40)) {
            this.Exception(EXCEPT_IPF, this.pc<<2);
            return -1;
        }
    } else {
        // check if supervisor read enable is not set (SRE)
        if (!(tlbtr & 0x80)) {
            this.Exception(EXCEPT_IPF, this.pc<<2);
            return -1;
        }
    }
    return (tlbtr & 0xFFFFE000) | (addr & 0x1FFF);
};

DynamicCPU.prototype.Step = function (steps, clockspeed) {
    steps = steps|0;
    clockspeed = clockspeed|0;
    var ins = 0x0;
    var imm = 0x0;
    var i = 0;
    var rindex = 0x0;
    var rA = 0x0,
        rB = 0x0,
        rD = 0x0;

    // local variables could be faster
    var r = this.r;
    var f = this.f;
    var ram = this.ram;
    var int32mem = this.ram.int32mem;
    var group2 = this.group2;

    // to get the instruction
    var setindex = 0x0;
    var tlmbr = 0x0;
    var tlbtr = 0x0;
    var jump = 0x0;
    var delta = 0x0;

    var dsteps = 0;
    var waitoneblock = 0;

    for(;;) {
        dsteps = dsteps - 1|0;

        if ((this.ppc|0) == (this.fence|0)) {

            if (!this.delayedins_at_fence) {
                this.delayedins = false;
            }

            // do this not so often
            if (dsteps < 0)
            if (!this.delayedins_at_fence) { // Not sure, if we need this check
                dsteps = dsteps + 64|0;
                steps = steps - 64|0;
                if (steps < 0) return 0;

                // ---------- TICK ----------
                // timer enabled
                if ((this.TTMR >> 30) != 0) {
                    delta = (this.TTMR & 0xFFFFFFF) - (this.TTCR & 0xFFFFFFF);
                    this.TTCR = (this.TTCR + clockspeed) & 0xFFFFFFFF;
                    if (delta < clockspeed) {
                        // if interrupt enabled
                        if (this.TTMR & (1 << 29)) {
                            this.TTMR |= (1 << 28); // set pending interrupt
                        }
                    }
                }

                // check if pending and check if interrupt must be triggered
                if (this.SR_TEE) { // SR_IEE and SR_TEE are always set parallel
                    if (this.TTMR & (1 << 28)) {
                        this.Exception(EXCEPT_TICK, this.group0[SPR_EEAR_BASE]);
                        this.pc = this.nextpc|0;
                        this.nextpc = this.nextpc + 1|0;
                    }
                }
            }

            if (this.SR_IEE)
            if (this.raise_interrupt) {
                this.raise_interrupt = false;
                this.Exception(EXCEPT_INT, this.group0[SPR_EEAR_BASE]);
                this.pc = this.nextpc|0;
                this.nextpc = this.nextpc + 1|0;
            }

            var ppc = this.GetInstructionPointer(this.pc<<2)|0;
            if (ppc == -1) {
                this.pc = this.nextpc|0;
                this.nextpc = this.nextpc + 1|0;
                this.delayedins_at_fence = false;
                continue;
            }
            this.ppc = ppc;

            if (this.delayedins_at_fence) {
                this.delayedins_at_fence = false;
                this.fence = this.ppc + 4|0;
            } else {
                this.fence = ((this.ppc >> 13) + 1) << 13; // next page
            } // pc and ppc check


           if  ((!this.SR_SM) && (this.group0[20] == this.recompilepid) && this.instance && !waitoneblock && this.pc < 0x10000000) {
	       //var newppc = this.instance.exports.DTLBLookup(this.pc, 0, this.pc, this.SR_F, 0)|0;
	       //var newpc = this.instance.exports.DTLBRefill(this.pc|0, 64, this.pc|0, this.SR_F|0, 0)|0;
               //message.Debug("" + utils.ToHex(newpc) + " " + utils.ToHex(ppc));
               //message.Debug("" + utils.ToHex(newpc) + " " + utils.ToHex(this.ram.int32mem[this.current_pgd>>2]));

               var oldpc = this.pc;
               var maxsteps = steps;
               //var maxsteps = this.GetTimeToNextInterrupt();
               //if (steps < maxsteps) maxsteps = steps;
               //message.Debug("run recompiled code initalsteps=" + maxsteps + " from pc=" + utils.ToHex(this.pc<<2) + " oldpc=" + utils.ToHex(this.oldpc<<2));

               var retsteps = this.instance.exports.Exec(this.pc<<2, maxsteps, this.SR_F?1:0);
               steps = retsteps;
               // no exception
               if (!this.SR_SM) {
                   this.SR_F = !!this.instance.exports.GetSR_F();
                   this.pc = this.instance.exports.GetPC()>>2;
                   this.nextpc = this.pc + 1|0;
                   this.fence = this.ppc|0;
               }
               dsteps = -1;
/*
               message.Debug(
                    "run done initalsteps=" +
                    maxsteps +
                    " returnedsteps=" +
                    retsteps +
                    " from pc=" + utils.ToHex(oldpc<<2) +
                    " to pc=" + utils.ToHex(this.pc<<2) + " clockspeed=" + clockspeed);
*/
               //if (steps == 0x0) return 0x0;
               waitoneblock = 1;
               continue;
               //if (steps == 3) message.Debug('start recompiled code pc=' + utils.ToHex(this.pc<<2));
           }

        } // end of fence
        waitoneblock = 0;

        // ---------------------------------------
        ins = int32mem[this.ppc >> 2]|0;
        this.ppc = this.ppc + 4|0;

        switch ((ins >> 26)&0x3F) {

        case 0x0:
            // j
            jump = this.pc + ((ins << 6) >> 6);
            this.pc = this.nextpc|0;
            this.nextpc = jump|0;
            if ((this.fence|0) == (this.ppc|0)) {
                this.delayedins_at_fence = true;
            } else {
                this.fence = this.ppc + 4|0;
            }
            this.delayedins = true;
            continue;

        case 0x1:
            // jal
            jump = this.pc + ((ins << 6) >> 6);
            r[9] = (this.nextpc<<2) + 4;
            this.pc = this.nextpc|0;
            this.nextpc = jump|0;
            if ((this.fence|0) == (this.ppc|0)) {
                this.delayedins_at_fence = true;
            } else {
                this.fence = this.ppc + 4|0;
            }
            this.delayedins = true;
            continue;

        case 0x3:
            // bnf
            if (this.SR_F) {
                break;
            }
            jump = this.pc + ((ins << 6) >> 6);
            this.pc = this.nextpc|0;
            this.nextpc = jump|0;
            if ((this.fence|0) == (this.ppc|0)) {
                this.delayedins_at_fence = true;
            } else {
                this.fence = this.ppc + 4|0;
            }
            this.delayedins = true;
            continue;

        case 0x4:
            // bf
            if (!this.SR_F) {
                break;
            }
            jump = this.pc + ((ins << 6) >> 6);
            this.pc = this.nextpc|0;
            this.nextpc = jump|0;
            if ((this.fence|0) == (this.ppc|0)) {
                this.delayedins_at_fence = true;
            } else {
                this.fence = this.ppc + 4|0;
            }
            this.delayedins = true;
            continue;

        case 0x5:
            // nop
            break;

        case 0x6:
            // movhi or macrc
            rindex = (ins >> 21) & 0x1F;
            // if 16th bit is set
            if (ins & 0x10000) {
                message.Debug("Error: macrc not supported\n");
                message.Abort();
            } else {
                r[rindex] = ((ins & 0xFFFF) << 16); // movhi
            }
            break;

        case 0x8:
            // sys and trap
            if ((ins&0xFFFF0000) == 0x21000000) {
                message.Debug("Trap at " + utils.ToHex(this.pc<<2));
                this.Exception(EXCEPT_TRAP, this.group0[SPR_EEAR_BASE]);
            } else {
                this.Exception(EXCEPT_SYSCALL, this.group0[SPR_EEAR_BASE]);
            }
            break;

        case 0x9:
            // rfe
            this.nextpc = this.GetSPR(SPR_EPCR_BASE)>>2;
            this.fence = this.ppc|0;
            this.SetFlags(this.GetSPR(SPR_ESR_BASE)); // could raise an exception
            break;

        case 0x11:
            // jr
            jump = r[(ins >> 11) & 0x1F]>>2;
            this.pc = this.nextpc|0;
            this.nextpc = jump|0;
            if ((this.fence|0) == (this.ppc|0)) {
                this.delayedins_at_fence = true;
            } else {
                this.fence = this.ppc + 4|0;
            }
            this.delayedins = true;
            continue;

        case 0x12:
            // jalr
            jump = r[(ins >> 11) & 0x1F]>>2;
            r[9] = (this.nextpc<<2) + 4|0;
            this.pc = this.nextpc|0;
            this.nextpc = jump|0;
            if ((this.fence|0) == (this.ppc|0)) {
                this.delayedins_at_fence = true;
            } else {
                this.fence = this.ppc + 4|0;
            }
            this.delayedins = true;
            continue;

        case 0x1B:
            // lwa
            r[32] = r[(ins >> 16) & 0x1F] + ((ins << 16) >> 16);
            if ((r[32] & 3) != 0) {
                message.Debug("Error in lwa: no unaligned access allowed");
                message.Abort();
            }
            r[33] = this.DTLBLookup(r[32], false);
            if (r[33] == -1) {
                break;
            }
            this.EA = r[33];
            r[(ins >> 21) & 0x1F] = r[33]>0?int32mem[r[33] >> 2]:ram.Read32Big(r[33]);
            break;


        case 0x21:
            // lwz
            r[32] = r[(ins >> 16) & 0x1F] + ((ins << 16) >> 16);
            if ((r[32] & 3) != 0) {
                message.Debug("Error in lwz: no unaligned access allowed");
                message.Abort();
            }
            r[33] = this.DTLBLookup(r[32], false);
            if (r[33] == -1) {
                break;
            }
            r[(ins >> 21) & 0x1F] = r[33]>0?int32mem[r[33] >> 2]:ram.Read32Big(r[33]);
            break;

        case 0x23:
            // lbz
            r[32] = r[(ins >> 16) & 0x1F] + ((ins << 16) >> 16);
            r[33] = this.DTLBLookup(r[32], false);
            if (r[33] == -1) {
                break;
            }
            r[(ins >> 21) & 0x1F] = ram.Read8Big(r[33]);
            break;

        case 0x24:
            // lbs
            r[32] = r[(ins >> 16) & 0x1F] + ((ins << 16) >> 16);
            r[33] = this.DTLBLookup(r[32], false);
            if (r[33] == -1) {
                break;
            }
            r[(ins >> 21) & 0x1F] = ((ram.Read8Big(r[33])) << 24) >> 24;
            break;

        case 0x25:
            // lhz
            r[32] = r[(ins >> 16) & 0x1F] + ((ins << 16) >> 16);
            r[33] = this.DTLBLookup(r[32], false);
            if (r[33] == -1) {
                break;
            }
            r[(ins >> 21) & 0x1F] = ram.Read16Big(r[33]);
            break;

        case 0x26:
            // lhs
            r[32] = r[(ins >> 16) & 0x1F] + ((ins << 16) >> 16);
            r[33] = this.DTLBLookup(r[32], false);
            if (r[33] == -1) {
                break;
            }
            r[(ins >> 21) & 0x1F] = (ram.Read16Big(r[33]) << 16) >> 16;
            break;

        case 0x27:
            // addi signed
            imm = (ins << 16) >> 16;
            rA = r[(ins >> 16) & 0x1F];
            rindex = (ins >> 21) & 0x1F;
            r[rindex] = rA + imm;
            this.SR_CY = (r[rindex]>>>0) < (rA>>>0);
            break;

        case 0x28:
            // addi signed with carry
            imm = (ins << 16) >> 16;
            rA = r[(ins >> 16) & 0x1F];
            rindex = (ins >> 21) & 0x1F;
            r[rindex] = (rA + imm|0) + (this.SR_CY?1:0)|0;
            if (this.SR_CY) {
                this.SR_CY = (r[rindex]>>>0) <= (rA>>>0);
            } else {
                this.SR_CY = (r[rindex]>>>0) < (rA>>>0);
            }
            break;

        case 0x29:
            // andi
            r[(ins >> 21) & 0x1F] = r[(ins >> 16) & 0x1F] & (ins & 0xFFFF);
            break;

        case 0x2A:
            // ori
            r[(ins >> 21) & 0x1F] = r[(ins >> 16) & 0x1F] | (ins & 0xFFFF);
            break;

        case 0x2B:
            // xori
            rA = r[(ins >> 16) & 0x1F];
            r[(ins >> 21) & 0x1F] = rA ^ ((ins << 16) >> 16);
            break;

        case 0x2C:
            // muli
            {
            rindex = (ins >> 21) & 0x1F;
            rA = r[(ins >> 16) & 0x1F];
            r[rindex] = (rA * ((ins << 16) >> 16))&0xFFFFFFFF;
            var rAl = rA & 0xFFFF;
            var rBl = ins & 0xFFFF;
            r[rindex] = r[rindex] & 0xFFFF0000 | ((rAl * rBl) & 0xFFFF);
            }
            break;

        case 0x2D:
            // mfspr
            r[(ins >> 21) & 0x1F] = this.GetSPR(r[(ins >> 16) & 0x1F] | (ins & 0xFFFF));
            break;

        case 0x2E:
            switch ((ins >> 6) & 0x3) {
            case 0:
                // slli
                r[(ins >> 21) & 0x1F] = r[(ins >> 16) & 0x1F] << (ins & 0x1F);
                break;
            case 1:
                // rori
                r[(ins >> 21) & 0x1F] = r[(ins >> 16) & 0x1F] >>> (ins & 0x1F);
                break;
            case 2:
                // srai
                r[(ins >> 21) & 0x1F] = r[(ins >> 16) & 0x1F] >> (ins & 0x1F);
                break;
            default:
                message.Debug("Error: opcode 2E function not implemented");
                message.Abort();
                break;
            }
            break;

        case 0x2F:
            // sf...i
            imm = (ins << 16) >> 16;
            switch ((ins >> 21) & 0x1F) {
            case 0x0:
                // sfnei
                this.SR_F = (r[(ins >> 16) & 0x1F] == imm) ? true : false;
                break;
            case 0x1:
                // sfnei
                this.SR_F = (r[(ins >> 16) & 0x1F] != imm) ? true : false;
                break;
            case 0x2:
                // sfgtui
                this.SR_F = ((r[(ins >> 16) & 0x1F]>>>0) > (imm >>> 0)) ? true : false;
                break;
            case 0x3:
                // sfgeui
                this.SR_F = ((r[(ins >> 16) & 0x1F]>>>0) >= (imm >>> 0)) ? true : false;
                break;
            case 0x4:
                // sfltui
                this.SR_F = ((r[(ins >> 16) & 0x1F]>>>0) < (imm >>> 0)) ? true : false;
                break;
            case 0x5:
                // sfleui
                this.SR_F = ((r[(ins >> 16) & 0x1F]>>>0) <= (imm >>> 0)) ? true : false;
                break;
            case 0xa:
                // sfgtsi
                this.SR_F = (r[(ins >> 16) & 0x1F] > imm) ? true : false;
                break;
            case 0xb:
                // sfgesi
                this.SR_F = (r[(ins >> 16) & 0x1F] >= imm) ? true : false;
                break;
            case 0xc:
                // sfltsi
                this.SR_F = (r[(ins >> 16) & 0x1F] < imm) ? true : false;
                break;
            case 0xd:
                // sflesi
                this.SR_F = (r[(ins >> 16) & 0x1F] <= imm) ? true : false;
                break;
            default:
                message.Debug("Error: sf...i not supported yet");
                message.Abort();
                break;
            }
            break;

        case 0x30:
            // mtspr
            imm = (ins & 0x7FF) | ((ins >> 10) & 0xF800);
            this.SetSPR(r[(ins >> 16) & 0x1F] | imm, r[(ins >> 11) & 0x1F]);
            if (this.idle) {
                this.idle = false;
                if (this.raise_interrupt == false)
                if (!(this.TTMR & (1 << 28))) {
                    this.pc = this.nextpc|0;
                    this.nextpc = this.nextpc + 1|0;
                    return steps|0;
                }
            }
            break;

       case 0x32:
            // floating point
            rA = (ins >> 16) & 0x1F;
            rB = (ins >> 11) & 0x1F;
            rD = (ins >> 21) & 0x1F;
            switch (ins & 0xFF) {
            case 0x0:
                // lf.add.s
                f[rD] = f[rA] + f[rB];
                break;
            case 0x1:
                // lf.sub.s
                f[rD] = f[rA] - f[rB];
                break;
            case 0x2:
                // lf.mul.s
                f[rD] = f[rA] * f[rB];
                break;
            case 0x3:
                // lf.div.s
                f[rD] = f[rA] / f[rB];
                break;
            case 0x4:
                // lf.itof.s
                f[rD] = r[rA];
                break;
            case 0x5:
                // lf.ftoi.s
                r[rD] = f[rA];
                break;
            case 0x7:
                // lf.madd.s
                f[rD] += f[rA] * f[rB];
                break;
            case 0x8:
                // lf.sfeq.s
                this.SR_F = (f[rA] == f[rB]) ? true : false;
                break;
            case 0x9:
                // lf.sfne.s
                this.SR_F = (f[rA] != f[rB]) ? true : false;
                break;
            case 0xa:
                // lf.sfgt.s
                this.SR_F = (f[rA] > f[rB]) ? true : false;
                break;
            case 0xb:
                // lf.sfge.s
                this.SR_F = (f[rA] >= f[rB]) ? true : false;
                break;
            case 0xc:
                // lf.sflt.s
                this.SR_F = (f[rA] < f[rB]) ? true : false;
                break;
            case 0xd:
                // lf.sfle.s
                this.SR_F = (f[rA] <= f[rB]) ? true : false;
                break;
            default:
                message.Debug("Error: lf. function " + utils.ToHex(ins & 0xFF) + " not supported yet");
                message.Abort();
                break;
            }
            break;

        case 0x33:
            // swa
            imm = ((((ins >> 10) & 0xF800) | (ins & 0x7FF)) << 16) >> 16;
            r[32] = r[(ins >> 16) & 0x1F] + imm;
            if (r[32] & 0x3) {
                message.Debug("Error in swa: no aligned memory access");
                message.Abort();
            }
            r[33] = this.DTLBLookup(r[32], true);
            if (r[33] == -1) {
                break;
            }
            this.SR_F = (r[33] == this.EA)?true:false;
            this.EA = -1;
            if (this.SR_F == false) {
                break;
            }
            if (r[33] > 0) {
                int32mem[r[33] >> 2] = r[(ins >> 11) & 0x1F];
            } else {
                ram.Write32Big(r[33], r[(ins >> 11) & 0x1F]);
            }
            break;

        case 0x35:
            // sw
            imm = ((((ins >> 10) & 0xF800) | (ins & 0x7FF)) << 16) >> 16;
            r[32] = r[(ins >> 16) & 0x1F] + imm;
            if (r[32] & 0x3) {
                message.Debug("Error in sw: no aligned memory access");
                message.Abort();
            }
            r[33] = this.DTLBLookup(r[32], true);
            if (r[33] == -1) {
                break;
            }
            if (r[33]>0) {
                int32mem[r[33] >> 2] = r[(ins >> 11) & 0x1F];
            } else {
                ram.Write32Big(r[33], r[(ins >> 11) & 0x1F]);
            }
            break;


        case 0x36:
            // sb
            imm = ((((ins >> 10) & 0xF800) | (ins & 0x7FF)) << 16) >> 16;
            r[32] = r[(ins >> 16) & 0x1F] + imm;
            r[33] = this.DTLBLookup(r[32], true);
            if (r[33] == -1) {
                break;
            }
            ram.Write8Big(r[33], r[(ins >> 11) & 0x1F]);
            break;

        case 0x37:
            // sh
            imm = ((((ins >> 10) & 0xF800) | (ins & 0x7FF)) << 16) >> 16;
            r[32] = r[(ins >> 16) & 0x1F] + imm;
            r[33] = this.DTLBLookup(r[32], true);
            if (r[33] == -1) {
                break;
            }
            ram.Write16Big(r[33], r[(ins >> 11) & 0x1F]);
            break;

        case 0x38:
            // three operands commands
            rA = r[(ins >> 16) & 0x1F];
            rB = r[(ins >> 11) & 0x1F];
            rindex = (ins >> 21) & 0x1F;
            switch (ins & 0x3CF) {
            case 0x0:
                // add signed
                r[rindex] = rA + rB;
                this.SR_CY = (r[rindex]>>>0) < (rA>>>0);
                break;
            case 0x1:
                // add with carry
                r[rindex] = rA + rB + (this.SR_CY?1:0);
                if (this.SR_CY) {
                    this.SR_CY = (r[rindex]>>>0) <= (rA>>>0);
                } else {
                    this.SR_CY = (r[rindex]>>>0) < (rA>>>0);
                }
                break;
            case 0x2:
                // sub signed
                r[rindex] = rA - rB;
                this.SR_CY = ((rB>>>0) > (rA>>>0));
                break;
            case 0x3:
                // and
                r[rindex] = rA & rB;
                break;
            case 0x4:
                // or
                r[rindex] = rA | rB;
                break;
            case 0x5:
                // or
                r[rindex] = rA ^ rB;
                break;
            case 0x8:
                // sll
                r[rindex] = rA << (rB & 0x1F);
                break;
            case 0xc:
                // exths
                r[rindex] = (rA << 16) >> 16;
                break;
            case 0xe:
                // cmov
                r[rindex] = this.SR_F?rA:rB;
                break;
            case 0x48:
                // srl not signed
                r[rindex] = rA >>> (rB & 0x1F);
                break;
            case 0x4c:
                // extbs
                r[rindex] = (rA << 24) >> 24;
                break;
            case 0xf:
                // ff1
                r[rindex] = 0;
                for (i = 0; i < 32; i++) {
                    if (rA & (1 << i)) {
                        r[rindex] = i + 1;
                        break;
                    }
                }
                break;
            case 0x88:
                // sra signed
                r[rindex] = rA >> (rB & 0x1F);
                break;
            case 0x10f:
                // fl1
                r[rindex] = 0;
                for (i = 31; i >= 0; i--) {
                    if (rA & (1 << i)) {
                        r[rindex] = i + 1;
                        break;
                    }
                }
                break;
            case 0x306:
                // mul signed (specification seems to be wrong)
                {
                    // this is a hack to do 32 bit signed multiply. Seems to work but needs to be tested.
                    r[rindex] = (rA|0) * (rB|0);
                    var rAl = rA & 0xFFFF;
                    var rBl = rB & 0xFFFF;
                    r[rindex] = r[rindex] & 0xFFFF0000 | ((rAl * rBl) & 0xFFFF);
                }
                break;
            case 0x30a:
                // divu (specification seems to be wrong)
                this.SR_OV = rB == 0;
                if (!this.SR_OV) {
                    r[rindex] = (rA>>>0) / (rB>>>0);
                }
                break;
            case 0x309:
                // div (specification seems to be wrong)
                this.SR_OV = rB == 0;
                if (!this.SR_OV) {
                    r[rindex] = rA / rB;
                }
                break;
            default:
                message.Debug("Error: op38 opcode not supported yet");
                message.Abort();
                break;
            }
            break;

        case 0x39:
            // sf....
            switch ((ins >> 21) & 0x1F) {
            case 0x0:
                // sfeq
                this.SR_F = (r[(ins >> 16) & 0x1F] == r[(ins >> 11) & 0x1F]) ? true : false;
                break;
            case 0x1:
                // sfne
                this.SR_F = (r[(ins >> 16) & 0x1F] != r[(ins >> 11) & 0x1F]) ? true : false;
                break;
            case 0x2:
                // sfgtu
                this.SR_F = ((r[(ins >> 16) & 0x1F]>>>0) > (r[(ins >> 11) & 0x1F]>>>0)) ? true : false;
                break;
            case 0x3:
                // sfgeu
                this.SR_F = ((r[(ins >> 16) & 0x1F]>>>0) >= (r[(ins >> 11) & 0x1F]>>>0)) ? true : false;
                break;
            case 0x4:
                // sfltu
                this.SR_F = ((r[(ins >> 16) & 0x1F]>>>0) < (r[(ins >> 11) & 0x1F]>>>0)) ? true : false;
                break;
            case 0x5:
                // sfleu
                this.SR_F = ((r[(ins >> 16) & 0x1F]>>>0) <= (r[(ins >> 11) & 0x1F]>>>0)) ? true : false;
                break;
            case 0xa:
                // sfgts
                this.SR_F = (r[(ins >> 16) & 0x1F] > r[(ins >> 11) & 0x1F]) ? true : false;
                break;
            case 0xb:
                // sfges
                this.SR_F = (r[(ins >> 16) & 0x1F] >= r[(ins >> 11) & 0x1F]) ? true : false;
                break;
            case 0xc:
                // sflts
                this.SR_F = (r[(ins >> 16) & 0x1F] < r[(ins >> 11) & 0x1F]) ? true : false;
                break;
            case 0xd:
                // sfles
                this.SR_F = (r[(ins >> 16) & 0x1F] <= r[(ins >> 11) & 0x1F]) ? true : false;
                break;
            default:
                message.Debug("Error: sf.... function supported yet");
                message.Abort();
            }
            break;

        default:
            message.Debug("Error: Instruction with opcode " + utils.ToHex(ins >>> 26) + " not supported");
            message.Abort();
            break;
        }
        this.oldpc = this.pc|0;
        this.pc = this.nextpc|0;
        this.nextpc = this.nextpc + 1|0;
        //this.delayedins = false;

    }  // main loop
    return 0;
};

module.exports = DynamicCPU;


},{"../../messagehandler":33,"../../utils":48}],35:[function(require,module,exports){
var message = require('../messagehandler');

function FastCPU(stdlib, foreign, heap) {
"use asm";

var floor = stdlib.Math.floor;
var imul = foreign.imul;
var DebugMessage = foreign.DebugMessage;
var abort = foreign.abort;
var Read32 = foreign.Read32;
var Write32 = foreign.Write32;
var Read16 = foreign.Read16;
var Write16 = foreign.Write16;
var Read8 = foreign.Read8;
var Write8 = foreign.Write8;


var ERROR_SETFLAGS_LITTLE_ENDIAN = 0; // "Little endian is not supported"
var ERROR_SETFLAGS_CONTEXT_ID = 1; // "Context ID is not supported"
var ERROR_SETFLAGS_PREFIX = 2; // "exception prefix not supported"
var ERROR_SETFLAGS_DELAY_SLOT = 3; // "delay slot exception not supported"
var ERROR_SETSPR_DIRECT_INTERRUPT_EXCEPTION = 4; //Error in SetSPR: Direct triggering of interrupt exception not supported?
var ERROR_SETSPR_INTERRUPT_ADDRESS = 5; //Error in SetSPR: interrupt address not supported
var ERROR_SETSPR_TIMER_MODE_NOT_CONTINUOUS = 6; //"Error in SetSPR: Timer mode other than continuous not supported"
var ERROR_EXCEPTION_UNKNOWN = 7;        // "Error in Exception: exception type not supported"
var ERROR_UNKNOWN = 8;
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
var EXCEPT_SYSCALL = 0xC00; // syscall, jump into supervisor mode
var EXCEPT_TRAP = 0xE00; // trap


var r = new stdlib.Int32Array(heap); // registers
var f = new stdlib.Float32Array(heap); // registers

var h = new stdlib.Int32Array(heap);
var b = new stdlib.Uint8Array(heap);
var w = new stdlib.Uint16Array(heap);

var rp = 0x0; // pointer to registers, not used
var ramp = 0x100000;

var group0p = 0x2000; // special purpose registers
var group1p = 0x4000; // data tlb registers
var group2p = 0x6000; // instruction tlb registers

// define variables and initialize

var pc = 0x0;
var ppc = 0;
var ppcorigin = 0;
var pcbase = -4; // helper variable to calculate the real pc
var fence = 0; // the ppc pointer to the next jump or page boundary

var delayedins = 0; // the current instruction is an delayed instruction, one cycle before a jump

var nextpc = 0x0; // pointer to the next instruction after the fence
var jump = 0x0; // in principle the jump variable should contain the same as nextpc.
                // But for delayed ins at page boundaries, this is taken as temporary
                // storage for nextpc
var delayedins_at_page_boundary = 0; //flag


// fast tlb lookup tables, invalidate
var instlblookup = -1;
var read32tlblookup = -1;
var read8stlblookup = -1;
var read8utlblookup = -1;
var read16stlblookup = -1;
var read16utlblookup = -1;
var write32tlblookup = -1;
var write8tlblookup = -1;
var write16tlblookup = -1;

var instlbcheck = -1;
var read32tlbcheck = -1;
var read8stlbcheck = -1;
var read8utlbcheck = -1;
var read16stlbcheck = -1;
var read16utlbcheck = -1;
var write32tlbcheck = -1;
var write8tlbcheck = -1;
var write16tlbcheck = -1;

var EA = -1; // hidden register for atomic lwa and swa operation

var TTMR = 0x0; // Tick timer mode register
var TTCR = 0x0; // Tick timer count register

var PICMR = 0x3; // interrupt controller mode register (use nmi)
var PICSR = 0x0; // interrupt controller set register

// flags
var SR_SM = 1; // supervisor mode
var SR_TEE = 0; // tick timer Exception Enabled
var SR_IEE = 0; // interrupt Exception Enabled
var SR_DCE = 0; // Data Cache Enabled
var SR_ICE = 0; // Instruction Cache Enabled
var SR_DME = 0; // Data MMU Enabled
var SR_IME = 0; // Instruction MMU Enabled
var SR_LEE = 0; // Little Endian Enabled
var SR_CE = 0; // CID Enabled ?
var SR_F = 0; // Flag for l.sf... instructions
var SR_CY = 0; // Carry Flag
var SR_OV = 0; // Overflow Flag
var SR_OVE = 0; // Overflow Flag Exception
var SR_DSX = 0; // Delay Slot Exception
var SR_EPH = 0; // Exception Prefix High
var SR_FO = 1; // Fixed One, always set
var SR_SUMRA = 0; // SPRS User Mode Read Access, or TRAP exception disable?
var SR_CID = 0x0; // Context ID

var boot_dtlb_misshandler_address = 0x0;
var boot_itlb_misshandler_address = 0x0;
var current_pgd = 0x0;

var raise_interrupt = 0;

var doze = 0x0;

function Init() {
    AnalyzeImage();
    Reset();
}

function Reset() {
    TTMR = 0x0;
    TTCR = 0x0;
    PICMR = 0x3;
    PICSR = 0x0;

    h[group0p+(SPR_IMMUCFGR<<2) >> 2] = 0x18; // 0 ITLB has one way and 64 sets
    h[group0p+(SPR_DMMUCFGR<<2) >> 2] = 0x18; // 0 DTLB has one way and 64 sets
    h[group0p+(SPR_ICCFGR<<2) >> 2] = 0x48;
    h[group0p+(SPR_DCCFGR<<2) >> 2] = 0x48;
    h[group0p+(SPR_VR<<2) >> 2] = 0x12000001;

    // UPR present
    // data mmu present
    // instruction mmu present
    // PIC present (architecture manual seems to be wrong here)
    // Tick timer present
    h[group0p+(SPR_UPR<<2) >> 2] = 0x619;

    ppc = 0;
    ppcorigin = 0;
    pcbase = -4;

    Exception(EXCEPT_RESET, 0x0);
}

function InvalidateTLB() {
    instlblookup = -1;
    read32tlblookup = -1;
    read8stlblookup = -1;
    read8utlblookup = -1;
    read16stlblookup = -1;
    read16utlblookup = -1;
    write32tlblookup = -1;
    write8tlblookup = -1;
    write16tlblookup = -1;
    instlbcheck = -1;
    read32tlbcheck = -1;
    read8stlbcheck = -1;
    read8utlbcheck = -1;
    read16stlbcheck = -1;
    read16utlbcheck = -1;
    write32tlbcheck = -1;
    write8tlbcheck = -1;
    write16tlbcheck = -1;
}

function GetStat() {
    return (pc>>>2)|0;
}

function GetTimeToNextInterrupt() {
    var delta = 0x0;
    if ((TTMR >> 30) == 0) return -1;
    delta = (TTMR & 0xFFFFFFF) - (TTCR & 0xFFFFFFF) |0;
    return delta|0;
}

function ProgressTime(delta) {
    delta = delta|0;
    TTCR = (TTCR + delta)|0;
}

function GetTicks() {
    if ((TTMR >> 30) == 0) return -1;
    return (TTCR & 0xFFFFFFF)|0;
}


function AnalyzeImage() { // get addresses for fast refill
    boot_dtlb_misshandler_address = h[ramp+0x900 >> 2]|0;
    boot_itlb_misshandler_address = h[ramp+0xA00 >> 2]|0;
    current_pgd = ((h[ramp+0x2010 >> 2]&0xFFF)<<16) | (h[ramp+0x2014 >> 2] & 0xFFFF)|0;
}


function SetFlags(x) {
    x = x|0;

    //if (((x&2) == 0) && SR_TEE) message.Debug('Disable Tee');

    SR_SM = (x & (1 << 0));
    SR_TEE = (x & (1 << 1));
    SR_IEE = (x & (1 << 2));
    SR_DCE = (x & (1 << 3));
    SR_ICE = (x & (1 << 4));
    SR_DME = (x & (1 << 5));
    SR_IME = (x & (1 << 6));
    SR_LEE = (x & (1 << 7));
    SR_CE = (x & (1 << 8));
    SR_F = (x & (1 << 9));
    SR_CY = (x & (1 << 10));
    SR_OV = (x & (1 << 11));
    SR_OVE = (x & (1 << 12));
    SR_DSX = (x & (1 << 13));
    SR_EPH = (x & (1 << 14));
    SR_FO = 1;
    SR_SUMRA = (x & (1 << 16));
    SR_CID = (x >> 28) & 0xF;

    if (SR_LEE) {
        DebugMessage(ERROR_SETFLAGS_LITTLE_ENDIAN|0);
        abort();
    }
    if (SR_CID) {
        DebugMessage(ERROR_SETFLAGS_CONTEXT_ID|0);
        abort();
    }
    if (SR_EPH) {
        DebugMessage(ERROR_SETFLAGS_PREFIX|0);
        abort();
    }
    if (SR_DSX) {
        DebugMessage(ERROR_SETFLAGS_DELAY_SLOT|0);
        abort();
    }
}

function GetFlags() {
    var x = 0x0;
    x = x | (SR_SM ? (1 << 0) : 0);
    x = x | (SR_TEE ? (1 << 1) : 0);
    x = x | (SR_IEE ? (1 << 2) : 0);
    x = x | (SR_DCE ? (1 << 3) : 0);
    x = x | (SR_ICE ? (1 << 4) : 0);
    x = x | (SR_DME ? (1 << 5) : 0);
    x = x | (SR_IME ? (1 << 6) : 0);
    x = x | (SR_LEE ? (1 << 7) : 0);
    x = x | (SR_CE ? (1 << 8) : 0);
    x = x | (SR_F ? (1 << 9) : 0);
    x = x | (SR_CY ? (1 << 10) : 0);
    x = x | (SR_OV ? (1 << 11) : 0);
    x = x | (SR_OVE ? (1 << 12) : 0);
    x = x | (SR_DSX ? (1 << 13) : 0);
    x = x | (SR_EPH ? (1 << 14) : 0);
    x = x | (SR_FO ? (1 << 15) : 0);
    x = x | (SR_SUMRA ? (1 << 16) : 0);
    x = x | (SR_CID << 28);
    return x|0;
}

function CheckForInterrupt() {
    raise_interrupt = PICMR & PICSR;
}

function RaiseInterrupt(line, cpuid) {
    line = line|0;
    cpuid = cpuid|0;
    var lmask = 0;
    lmask = (1 << (line))|0;
    PICSR = PICSR | lmask;
/*
    message.Debug("raise " + line + " " + SR_TEE + " " + SR_IEE);
    if (raise_interrupt|0) {
        message.Debug('two interrupts ' + (PICSR|0) + ' ' + (raise_interrupt|0));
    }
*/
    CheckForInterrupt();
}

function ClearInterrupt(line, cpuid) {
    line = line|0;
    cpuid = cpuid|0;
    PICSR = PICSR & (~(1 << line));
    raise_interrupt = PICMR & PICSR;
}


function SetSPR(idx, x) {
    idx = idx|0;
    x = x|0;
    var address = 0;
    var group = 0;
    address = (idx & 0x7FF);
    group = (idx >> 11) & 0x1F;

    switch (group|0) {
    case 0:
        if ((address|0) == (SPR_SR|0)) {
            SetFlags(x);
        }
        h[group0p+(address<<2) >> 2] = x;
        break;
    case 1:
        // Data MMU
        h[group1p+(address<<2) >> 2] = x;
        break;
    case 2:
        // ins MMU
        h[group2p+(address<<2) >> 2] = x;
        break;
    case 3:
        // data cache, not supported
    case 4:
        // ins cache, not supported
        break;
    case 8:
        doze = 0x1; // doze mode
        break;
    case 9:
        // pic
        switch (address|0) {
        case 0:
            PICMR = x | 0x3; // we use non maskable interrupt here
            // check immediate for interrupt
            CheckForInterrupt();
            if (SR_IEE) {
                if (raise_interrupt) {
                    DebugMessage(ERROR_SETSPR_DIRECT_INTERRUPT_EXCEPTION|0);
                    abort();
                }
            }
            break;
        case 2: // PICSR
            break;
        default:
            DebugMessage(ERROR_SETSPR_INTERRUPT_ADDRESS|0);
            abort();
        }
        break;
    case 10:
        //tick timer
        switch (address|0) {
        case 0:
            TTMR = x|0;
            if (((TTMR >> 30)&3) != 0x3) {
                DebugMessage(ERROR_SETSPR_TIMER_MODE_NOT_CONTINUOUS|0);
                abort();
            }
            break;
        case 1:
            TTCR = x|0;
            break;
        default:
            //DebugMessage("Error in SetSPR: Tick timer address not supported");
            DebugMessage(ERROR_UNKNOWN|0);
            abort();
            break;
        }
        break;

    default:
        DebugMessage(ERROR_UNKNOWN|0);
        abort();
        break;
    }
}

function GetSPR(idx) {
    idx = idx|0;
    var address = 0;
    var group = 0;
    address = idx & 0x7FF;
    group = (idx >> 11) & 0x1F;
    switch (group|0) {
    case 0:
        if ((address|0) == (SPR_SR|0)) {
            return GetFlags()|0;
        }
        return h[group0p+(address<<2) >> 2]|0;
    case 1:
        return h[group1p+(address<<2) >> 2]|0;
    case 2:
        return h[group2p+(address<<2) >> 2]|0;
    case 8:
        return 0x0;
    case 9:
        // pic
        switch (address|0) {
        case 0:
            return PICMR|0;
        case 2:
            return PICSR|0;
        default:
            //DebugMessage("Error in GetSPR: PIC address unknown");
            DebugMessage(ERROR_UNKNOWN|0);
            abort();
            break;
        }
        break;

    case 10:
        // tick Timer
        switch (address|0) {
        case 0:
            return TTMR|0;
        case 1:
            return TTCR|0; // or clock
        default:
            DebugMessage(ERROR_UNKNOWN|0);
            //DebugMessage("Error in GetSPR: Tick timer address unknown");
            abort();
            break;
        }
        break;
    default:
        DebugMessage(ERROR_UNKNOWN|0);
        //DebugMessage("Error in GetSPR: group unknown");
        abort();
        break;
    }
    return 0|0;
}

function Exception(excepttype, addr) {
    excepttype = excepttype|0;
    addr = addr|0;
    var except_vector = 0;
    except_vector = excepttype | (SR_EPH ? 0xf0000000 : 0x0);

    SetSPR(SPR_EEAR_BASE, addr);
    SetSPR(SPR_ESR_BASE, GetFlags()|0);

    EA = -1;
    SR_OVE = 0;
    SR_SM = 1;
    SR_IEE = 0;
    SR_TEE = 0;
    SR_DME = 0;

    instlblookup = 0;
    read32tlblookup = 0;
    read8stlblookup = 0;
    read8utlblookup = 0;
    read16stlblookup = 0;
    read16utlblookup = 0;
    write32tlblookup = 0;
    write8tlblookup = 0;
    write16tlblookup = 0;
    instlbcheck = 0;
    read32tlbcheck = 0;
    read8utlbcheck = 0;
    read8stlbcheck = 0;
    read16utlbcheck = 0;
    read16stlbcheck = 0;
    write32tlbcheck = 0;
    write8tlbcheck = 0;
    write16tlbcheck = 0;

    fence = ppc|0;
    nextpc = except_vector;

    switch (excepttype|0) {

    case 0x100: // EXCEPT_RESET
        break;

    case 0x300: // EXCEPT_DPF
    case 0x900: // EXCEPT_DTLBMISS
    case 0xE00: // EXCEPT_TRAP
    case 0x200: // EXCEPT_BUSERR
        pc = pcbase + ppc|0;
        SetSPR(SPR_EPCR_BASE, pc - (delayedins ? 4 : 0)|0);
        break;

    case 0xA00: // EXCEPT_ITLBMISS
    case 0x400: // EXCEPT_IPF
    case 0x500: // EXCEPT_TICK
    case 0x800: // EXCEPT_INT
        // per definition, the pc must be valid here
        SetSPR(SPR_EPCR_BASE, pc - (delayedins ? 4 : 0)|0);
        break;

    case 0xC00: // EXCEPT_SYSCALL
        pc = pcbase + ppc|0;
        SetSPR(SPR_EPCR_BASE, pc + 4 - (delayedins ? 4 : 0)|0);
        break;

    default:
        DebugMessage(ERROR_EXCEPTION_UNKNOWN|0);
        abort();
    }
    delayedins = 0;
    delayedins_at_page_boundary = 0;
    SR_IME = 0;
}


// disassembled dtlb miss exception handler arch/openrisc/kernel/head.S, kernel dependent
function DTLBRefill(addr, nsets) {
    addr = addr|0;
    nsets = nsets|0;
    var r2 = 0;
    var r3 = 0;
    var r4 = 0;
    var r5 = 0;
    if ((h[ramp+0x900 >> 2]|0) == (boot_dtlb_misshandler_address|0)) {
        Exception(EXCEPT_DTLBMISS, addr);
        return 0|0;
    }
    r2 = addr;
    // get_current_PGD  using r3 and r5
    r3 = h[ramp+current_pgd >> 2]|0; // current pgd
    r4 = (r2 >>> 0x18) << 2;
    r5 = r4 + r3|0;

    r4 = (0x40000000 + r5) & 0xFFFFFFFF; //r4 = phys(r5)

    r3 = h[ramp+r4 >> 2]|0;

    if ((r3|0) == 0) {
        Exception(EXCEPT_DPF, addr);
        return 0|0;
        // abort();
        // d_pmd_none:
        // page fault
    }

    //r3 = r3 & ~PAGE_MASK // 0x1fff // sense? delayed jump???
    r3 = 0xffffe000;
    // d_pmd_good:

    r4 = h[ramp+r4 >> 2]|0; // get pmd value
    r4 = r4 & r3; // & PAGE_MASK
    r5 = r2 >>> 0xD;
    r3 = r5 & 0x7FF;
    r3 = r3 << 0x2;
    r3 = r3 + r4|0;
    r2 = h[ramp+r3 >> 2]|0;

    if ((r2 & 1) == 0) {
        Exception(EXCEPT_DPF, addr);
        return 0|0;
        //d_pmd_none:
        //page fault
    }
    //r3 = 0xFFFFe3fa; // PAGE_MASK | DTLB_UP_CONVERT_MASK

    // fill dtlb tr register
    r4 = r2 & 0xFFFFe3fa;
    //r6 = (group0[SPR_DMMUCFGR] & 0x1C) >>> 0x2;
    //r3 = 1 << r6; // number of DMMU sets
    //r6 = r3 - 1; // mask register
    //r5 &= r6;
    r5 = r5 & (nsets - 1);
    h[group1p+((0x280 | r5)<<2) >> 2] = r4;
    //SPR_DTLBTR_BASE(0)|r5 = r4 // SPR_DTLBTR_BASE = 0x280 * (WAY*0x100)

    // fill DTLBMR register
    r2 = addr;
    r4 = r2 & 0xFFFFE000;
    r4 = r4 | 0x1;
    h[group1p+((0x200 | r5)<<2) >> 2] = r4;
    // SPR_DTLBMR_BASE(0)|r5 = r4  // SPR_DTLBMR_BASE = 0x200 * (WAY*0x100)
    return 1|0;
}

// disassembled itlb miss exception handler arch/openrisc/kernel/head.S, kernel dependent
function ITLBRefill(addr, nsets) {
    addr = addr|0;
    nsets = nsets|0;
    var r2 = 0;
    var r3 = 0;
    var r4 = 0;
    var r5 = 0;
    if ((h[ramp+0xA00 >> 2]|0) == (boot_itlb_misshandler_address|0)) {
        Exception(EXCEPT_ITLBMISS, addr);
        return 0|0;
    }

    r2 = addr;
    // get_current_PGD  using r3 and r5
    r3 = h[ramp+current_pgd >> 2]|0; // current pgd
    r4 = (r2 >>> 0x18) << 2;
    r5 = r4 + r3|0;

    r4 = (0x40000000 + r5) & 0xFFFFFFFF; //r4 = phys(r5)
    r3 = h[ramp+r4 >> 2]|0;

    if ((r3|0) == 0) {
        Exception(EXCEPT_IPF, addr);
        return 0|0;
        // d_pmd_none:
        // page fault
    }

    //r3 = r3 & ~PAGE_MASK // 0x1fff // sense? delayed jump???
    r3 = 0xffffe000; // or 0xffffe3fa ??? PAGE_MASK
    //i_pmd_good:

    r4 = h[ramp+r4 >> 2]|0; // get pmd value
    r4 = r4 & r3; // & PAGE_MASK
    r5 = r2 >>> 0xD;
    r3 = r5 & 0x7FF;
    r3 = r3 << 0x2;
    r3 = r3 + r4|0;
    r2 = h[ramp+r3 >> 2]|0;

    if ((r2 & 1) == 0) {
        Exception(EXCEPT_IPF, addr);
        return 0|0;
        //d_pmd_none:
        //page fault
    }
    //r3 = 0xFFFFe03a; // PAGE_MASK | ITLB_UP_CONVERT_MASK

    // fill dtlb tr register
    r4 = r2 & 0xFFFFe03a; // apply the mask
    r3 = r2 & 0x7c0; // PAGE_EXEC, Page_SRE, PAGE_SWE, PAGE_URE, PAGE_UWE

    if ((r3|0) != 0x0) {
        //not itlb_tr_fill....
        //r6 = (group0[SPR_IMMUCFGR] & 0x1C) >>> 0x2;
        //r3 = 1 << r6; // number of DMMU sets
        //r6 = r3 - 1; // mask register
        //r5 &= r6;
        r5 = r5 & (nsets - 1);
        //itlb_tr_fill_workaround:
        r4 = r4 | 0xc0; // SPR_ITLBTR_UXE | ITLBTR_SXE
    }
    // itlb_tr_fill:

    h[group2p + ((0x280 | r5)<<2) >> 2] = r4; // SPR_ITLBTR_BASE(0)|r5 = r4 // SPR_ITLBTR_BASE = 0x280 * (WAY*0x100)

    //fill ITLBMR register
    r2 = addr;
    // r3 =
    r4 = r2 & 0xFFFFE000;
    r4 = r4 | 0x1;
    h[group2p + ((0x200 | r5)<<2) >> 2] = r4; // SPR_DTLBMR_BASE(0)|r5 = r4  // SPR_DTLBMR_BASE = 0x200 * (WAY*0x100)
    return 1|0;
}

function DTLBLookup(addr, write) {
    addr = addr|0;
    write = write|0;
    var setindex = 0;
    var tlmbr = 0;
    var tlbtr = 0;
    if (!SR_DME) {
        return addr|0;
    }
    // pagesize is 8192 bytes
    // nways are 1
    // nsets are 64

    setindex = (addr >> 13) & 63; // check these values
    tlmbr = h[group1p + ((0x200 | setindex) << 2) >> 2]|0; // match register

    if ((tlmbr & 1) == 0) {
        // use tlb refill to fasten up
        if (DTLBRefill(addr, 64)|0) {
            tlmbr = h[group1p + (0x200 + setindex << 2) >> 2]|0;
        } else {
            return -1|0;
        }
        // slow version
        // Exception(EXCEPT_DTLBMISS, addr);
        // return -1;
    }
    if ((tlmbr >> 19) != (addr >> 19)) {
        // use tlb refill to fasten up
        if (DTLBRefill(addr, 64)|0) {
            tlmbr = h[group1p + (0x200 + setindex << 2) >> 2]|0;
        } else {
            return -1|0;
        }
        // slow version
        // Exception(EXCEPT_DTLBMISS, addr);
        // return -1;
    }

    /* skipped this check
        // set lru
        if (tlmbr & 0xC0) {
            DebugMessage("Error: LRU ist not supported");
            abort();
        }
    */
    tlbtr = h[group1p + ((0x280 | setindex)<<2) >> 2]|0; // translate register

    // Test for page fault
    // Skip this to be faster

    // check if supervisor mode
    if (SR_SM) {
        if (!write) {
            if (!(tlbtr & 0x100)) {
                Exception(EXCEPT_DPF, addr);
                return -1|0;
            }
        } else {
            if (!(tlbtr & 0x200))
            {
                Exception(EXCEPT_DPF, addr);
                return -1|0;
            }
        }
    } else {
        if (!write) {
            if (!(tlbtr & 0x40)) {
                Exception(EXCEPT_DPF, addr);
                return -1|0;
            }
        } else {
            if (!(tlbtr & 0x80))
            {
                Exception(EXCEPT_DPF, addr);
                return -1|0;
            }
        }
    }
    return ((tlbtr & 0xFFFFE000) | (addr & 0x1FFF))|0;
}


function Step(steps, clockspeed) {
    steps = steps|0;
    clockspeed = clockspeed|0;
    var ins = 0x0;
    var imm = 0x0;
    var i = 0;
    var rindex = 0x0;
    var rA = 0x0,
        rB = 0x0,
        rD = 0x0;
    var vaddr = 0x0; // virtual address
    var paddr = 0x0; // physical address

    // to get the instruction
    var setindex = 0x0;
    var tlmbr = 0x0;
    var tlbtr = 0x0;
    var delta = 0x0;

    var dsteps = -1; // small counter
    //fence = ppc|0;

// -----------------------------------------------------

    for(;;) {

        if ((ppc|0) != (fence|0)) {

        ins = h[ppc >> 2]|0;
        ppc = ppc + 4|0;

// --------------------------------------------
        switch ((ins >> 26)&0x3F) {

        case 0x0:
            // j
            pc = pcbase + ppc|0;
            jump = pc + ((ins << 6) >> 4)|0;
            if ((fence|0) == (ppc|0)) { // delayed instruction directly at page boundary
                delayedins_at_page_boundary = 1;
            } else {
                fence = ppc + 4|0;
                nextpc = jump|0;
            }
            delayedins = 1;
            continue;

        case 0x1:
            // jal
            pc = pcbase + ppc|0;
            jump = pc + ((ins << 6) >> 4)|0;
            r[9] = pc + 8|0;
            if ((fence|0) == (ppc|0)) { // delayed instruction directly at page boundary
                delayedins_at_page_boundary = 1;
            } else {
                fence = ppc + 4|0;
                nextpc = jump|0;
            }
            delayedins = 1;
            continue;

        case 0x3:
            // bnf
            if (SR_F) {
                continue;
            }
            pc = pcbase + ppc|0;
            jump = pc + ((ins << 6) >> 4)|0;
            if ((fence|0) == (ppc|0)) { // delayed instruction directly at page boundary
                delayedins_at_page_boundary = 1;
            } else {
                fence = ppc + 4|0;
                nextpc = jump|0;
            }
            delayedins = 1;
            continue;

        case 0x4:
            // bf
            if (!SR_F) {
                continue;
            }
            pc = pcbase + ppc|0;
            jump = pc + ((ins << 6) >> 4)|0;
            if ((fence|0) == (ppc|0)) { // delayed instruction directly at page boundary
                delayedins_at_page_boundary = 1;
            } else {
                fence = ppc + 4|0;
                nextpc = jump|0;
            }
            delayedins = 1;
            continue;

        case 0x5:
            // nop
            continue;

        case 0x6:
            // movhi
            rindex = (ins >> 21) & 0x1F;
            r[rindex << 2 >> 2] = ((ins & 0xFFFF) << 16); // movhi
            continue;

        case 0x8:
            //sys and trap
            if ((ins&0xFFFF0000) == 0x21000000) {
                Exception(EXCEPT_TRAP, h[group0p+SPR_EEAR_BASE >> 2]|0);
            } else {
                Exception(EXCEPT_SYSCALL, h[group0p+SPR_EEAR_BASE >> 2]|0);
            }
            continue;

        case 0x9:
            // rfe
            jump = GetSPR(SPR_EPCR_BASE)|0;
            InvalidateTLB();
            fence = ppc;
            nextpc = jump;
            //pc = jump; // set the correct pc in case of an EXCEPT_INT
            //delayedins = 0;
            SetFlags(GetSPR(SPR_ESR_BASE)|0); // could raise an exception
            continue;

        case 0x11:
            // jr
            jump = r[((ins >> 9) & 0x7C)>>2]|0;
            if ((fence|0) == (ppc|0)) { // delayed instruction directly at page boundary
                delayedins_at_page_boundary = 1;
            } else {
                fence = ppc + 4|0;
                nextpc = jump|0;
            }
            delayedins = 1;
            continue;

        case 0x12:
            // jalr
            pc = pcbase + ppc|0;
            jump = r[((ins >> 9) & 0x7C)>>2]|0;
            r[9] = pc + 8|0;
            if ((fence|0) == (ppc|0)) { // delayed instruction directly at page boundary
                delayedins_at_page_boundary = 1;
            } else {
                fence = ppc + 4|0;
                nextpc = jump|0;
            }
            delayedins = 1;
            continue;

        case 0x1B:
            // lwa
            vaddr = (r[((ins >> 14) & 0x7C) >> 2]|0) + ((ins << 16) >> 16)|0;
            if ((read32tlbcheck ^ vaddr) >> 13) {
                paddr = DTLBLookup(vaddr, 0)|0;
                if ((paddr|0) == -1) {
                    break;
                }
                read32tlbcheck = vaddr;
                read32tlblookup = ((paddr^vaddr) >> 13) << 13;
            }
            paddr = read32tlblookup ^ vaddr;
            EA = paddr;
            r[((ins >> 19) & 0x7C)>>2] = (paddr|0)>0?h[ramp+paddr >> 2]|0:Read32(paddr|0)|0;
            continue;

        case 0x21:
            // lwz
            vaddr = (r[((ins >> 14) & 0x7C) >> 2]|0) + ((ins << 16) >> 16)|0;
            if ((read32tlbcheck ^ vaddr) >> 13) {
                paddr = DTLBLookup(vaddr, 0)|0;
                if ((paddr|0) == -1) {
                    break;
                }
                read32tlbcheck = vaddr;
                read32tlblookup = ((paddr^vaddr) >> 13) << 13;
            }
            paddr = read32tlblookup ^ vaddr;
            r[((ins >> 19) & 0x7C)>>2] = (paddr|0)>0?h[ramp+paddr >> 2]|0:Read32(paddr|0)|0;
            continue;

        case 0x23:
            // lbz
            vaddr = (r[((ins >> 14) & 0x7C)>>2]|0) + ((ins << 16) >> 16)|0;
            if ((read8utlbcheck ^ vaddr) >> 13) {
                paddr = DTLBLookup(vaddr, 0)|0;
                if ((paddr|0) == -1) {
                    break;
                }
                read8utlbcheck = vaddr;
                read8utlblookup = ((paddr^vaddr) >> 13) << 13;
            }
            paddr = read8utlblookup ^ vaddr;
            if ((paddr|0) >= 0) {
                r[((ins >> 19) & 0x7C)>>2] = b[ramp + (paddr ^ 3)|0]|0;
            } else {
                r[((ins >> 19) & 0x7C)>>2] = Read8(paddr|0)|0;
            }
            continue;

        case 0x24:
            // lbs
            vaddr = (r[((ins >> 14) & 0x7C)>>2]|0) + ((ins << 16) >> 16)|0;
            if ((read8stlbcheck ^ vaddr) >> 13) {
                paddr = DTLBLookup(vaddr, 0)|0;
                if ((paddr|0) == -1) {
                    break;
                }
                read8stlbcheck = vaddr;
                read8stlblookup = ((paddr^vaddr) >> 13) << 13;
            }
            paddr = read8stlblookup ^ vaddr;
            if ((paddr|0) >= 0) {
                r[((ins >> 19) & 0x7C)>>2] = (b[ramp + (paddr ^ 3)|0] << 24) >> 24;
            } else {
                r[((ins >> 19) & 0x7C)>>2] = ((Read8(paddr|0)|0) << 24) >> 24;
            }
            continue;

        case 0x25:
            // lhz
            vaddr = (r[((ins >> 14) & 0x7C)>>2]|0) + ((ins << 16) >> 16)|0;
            if ((read16utlbcheck ^ vaddr) >> 13) {
                paddr = DTLBLookup(vaddr, 0)|0;
                if ((paddr|0) == -1) {
                    break;
                }
                read16utlbcheck = vaddr;
                read16utlblookup = ((paddr^vaddr) >> 13) << 13;
            }
            paddr = read16utlblookup ^ vaddr;
            if ((paddr|0) >= 0) {
                r[((ins >> 19) & 0x7C)>>2] = w[ramp + (paddr ^ 2) >> 1];
            } else {
                r[((ins >> 19) & 0x7C)>>2] = (Read16(paddr|0)|0);
            }
            continue;

        case 0x26:
            // lhs
            vaddr = (r[((ins >> 14) & 0x7C)>>2]|0) + ((ins << 16) >> 16)|0;
            if ((read16stlbcheck ^ vaddr) >> 13) {
                paddr = DTLBLookup(vaddr, 0)|0;
                if ((paddr|0) == -1) {
                    break;
                }
                read16stlbcheck = vaddr;
                read16stlblookup = ((paddr^vaddr) >> 13) << 13;
            }
            paddr = read16stlblookup ^ vaddr;
            if ((paddr|0) >= 0) {
                r[((ins >> 19) & 0x7C)>>2] =  (w[ramp + (paddr ^ 2) >> 1] << 16) >> 16;
            } else {
                r[((ins >> 19) & 0x7C)>>2] = ((Read16(paddr|0)|0) << 16) >> 16;
            }
            continue;

        case 0x27:
            // addi signed
            rA = r[((ins >> 14) & 0x7C)>>2]|0;
            rindex = (ins >> 19) & 0x7C;
            r[rindex >> 2] = rA + ((ins << 16) >> 16)|0;
            SR_CY = (r[rindex>>2]>>>0) < (rA>>>0);
            continue;

        case 0x28:
            // addi with carry
            rA = r[((ins >> 14) & 0x7C)>>2]|0;
            rindex = (ins >> 19) & 0x7C;
            r[rindex >> 2] = (rA + ((ins << 16) >> 16)|0) + (SR_CY?1:0)|0;
            if (SR_CY) {
                SR_CY = (r[rindex>>2]>>>0) <= (rA>>>0);
            } else {
                SR_CY = (r[rindex>>2]>>>0) < (rA>>>0);
            }
            continue;

        case 0x29:
            // andi
            r[((ins >> 19) & 0x7C)>>2] = r[((ins >> 14) & 0x7C)>>2] & (ins & 0xFFFF);
            continue;

        case 0x2A:
            // ori
            r[((ins >> 19) & 0x7C)>>2] = r[((ins >> 14) & 0x7C)>>2] | (ins & 0xFFFF);
            continue;

        case 0x2B:
            // xori
            rA = r[((ins >> 14) & 0x7C)>>2]|0;
            r[((ins >> 19) & 0x7C)>>2] = rA ^ ((ins << 16) >> 16);
            continue;

        case 0x2C:
            // muli
            rA = r[((ins >> 14) & 0x7C)>>2]|0;
            r[((ins >> 19) & 0x7C)>>2] = imul(rA|0, (ins << 16) >> 16)|0;
            break;

        case 0x2D:
            // mfspr
            r[((ins >> 19) & 0x7C)>>2] = GetSPR(r[((ins >> 14) & 0x7C)>>2] | (ins & 0xFFFF))|0;
            continue;

        case 0x2E:
            switch ((ins >> 6) & 0x3) {
            case 0:
                // slli
                r[((ins >> 19) & 0x7C)>>2] = r[((ins >> 14) & 0x7C)>>2] << (ins & 0x1F);
                continue;
            case 1:
                // rori
                r[((ins >> 19) & 0x7C)>>2] = r[((ins >> 14) & 0x7C)>>2] >>> (ins & 0x1F);
                continue;
            case 2:
                // srai
                r[((ins >> 19) & 0x7C)>>2] = r[((ins >> 14) & 0x7C)>>2] >> (ins & 0x1F);
                continue;
            default:
                DebugMessage(ERROR_UNKNOWN|0);
                //DebugMessage("Error: opcode 2E function not implemented");
                abort();
                break;
            }
            break;

        case 0x2F:
            // sf...i
            imm = (ins << 16) >> 16;
            switch ((ins >> 21) & 0x1F) {
            case 0x0:
                // sfnei
                SR_F = (r[((ins >> 14) & 0x7C)>>2]|0) == (imm|0);
                continue;
            case 0x1:
                // sfnei
                SR_F = (r[((ins >> 14) & 0x7C)>>2]|0) != (imm|0);
                continue;
            case 0x2:
                // sfgtui
                SR_F = (r[((ins >> 14) & 0x7C)>>2]>>>0) > (imm >>> 0);
                continue;
            case 0x3:
                // sfgeui
                SR_F = (r[((ins >> 14) & 0x7C)>>2]>>>0) >= (imm >>> 0);
                continue;
            case 0x4:
                // sfltui
                SR_F = (r[((ins >> 14) & 0x7C)>>2]>>>0) < (imm >>> 0);
                continue;
            case 0x5:
                // sfleui
                SR_F = (r[((ins >> 14) & 0x7C)>>2]>>>0) <= (imm >>> 0);
                continue;
            case 0xa:
                // sfgtsi
                SR_F = (r[((ins >> 14) & 0x7C)>>2]|0) > (imm|0);
                continue;
            case 0xb:
                // sfgesi
                SR_F = (r[((ins >> 14) & 0x7C)>>2]|0) >= (imm|0);
                continue;
            case 0xc:
                // sfltsi
                SR_F = (r[((ins >> 14) & 0x7C)>>2]|0) < (imm|0);
                continue;
            case 0xd:
                // sflesi
                SR_F = (r[((ins >> 14) & 0x7C)>>2]|0) <= (imm|0);
                continue;
            default:
                //DebugMessage("Error: sf...i not supported yet");
                DebugMessage(ERROR_UNKNOWN|0);
                abort();
                break;
            }
            break;

        case 0x30:
            // mtspr
            imm = (ins & 0x7FF) | ((ins >> 10) & 0xF800);
            //pc = pcbase + ppc|0;
            SetSPR(r[((ins >> 14) & 0x7C)>>2] | imm, r[((ins >> 9) & 0x7C)>>2]|0); // can raise an interrupt

            if (doze|0) { // doze
                doze = 0x0;
                //message.Debug('Doze ' + raise_interrupt);

                if (TTMR & (1 << 28))
                if (SR_TEE|0) {
                    Exception(EXCEPT_TICK, h[group0p + (SPR_EEAR_BASE<<2) >> 2]|0);
                    continue;
                }

                if (SR_IEE|0)
                if (raise_interrupt|0) {
                    Exception(EXCEPT_INT, h[group0p + (SPR_EEAR_BASE<<2)>>2]|0);
                    continue;
                }

                return steps|0;
/*
                if ((raise_interrupt|0) == 0)
                if ((TTMR & (1 << 28)) == 0) {
                    return steps|0;
                }
*/

            }
            continue;

       case 0x32:
            // floating point
            rA = (ins >> 14) & 0x7C;
            rB = (ins >> 9) & 0x7C;
            rD = (ins >> 19) & 0x7C;

            switch (ins & 0xFF) {
            case 0x0:
                // lf.add.s
                f[rD >> 2] = (+f[rA >> 2]) + (+f[rB >> 2]);
                continue;
            case 0x1:
                // lf.sub.s
                f[rD >> 2] = (+f[rA >> 2]) - (+f[rB >> 2]);
                continue;
            case 0x2:
                // lf.mul.s
                f[rD >> 2] = (+f[rA >> 2]) * (+f[rB >> 2]);
                continue;
            case 0x3:
                // lf.div.s
                f[rD >> 2] = (+f[rA >> 2]) / (+f[rB >> 2]);
                continue;
            case 0x4:
                // lf.itof.s
                f[rD >> 2] = +(r[rA >> 2]|0);
                continue;
            case 0x5:
                // lf.ftoi.s
                r[rD >> 2] = ~~(+floor(+f[rA >> 2]));
                continue;
            case 0x7:
                // lf.madd.s
                f[rD >> 2] = (+f[rD >> 2]) + (+f[rA >> 2]) * (+f[rB >> 2]);
                continue;
            case 0x8:
                // lf.sfeq.s
                SR_F = (+f[rA >> 2]) == (+f[rB >> 2]);
                continue;
            case 0x9:
                // lf.sfne.s
                SR_F = (+f[rA >> 2]) != (+f[rB >> 2]);
                continue;
            case 0xa:
                // lf.sfgt.s
                SR_F = (+f[rA >> 2]) > (+f[rB >> 2]);
                continue;
            case 0xb:
                // lf.sfge.s
                SR_F = (+f[rA >> 2]) >= (+f[rB >> 2]);
                continue;
            case 0xc:
                // lf.sflt.s
                SR_F = (+f[rA >> 2]) < (+f[rB >> 2]);
                continue;
            case 0xd:
                // lf.sfle.s
                SR_F = (+f[rA >> 2]) <= (+f[rB >> 2]);
                continue;
            default:
                DebugMessage(ERROR_UNKNOWN|0);
                abort();
                break;
            }
            break;

        case 0x33:
            // swa
            imm = ((((ins >> 10) & 0xF800) | (ins & 0x7FF)) << 16) >> 16;
            vaddr = (r[((ins >> 14) & 0x7C)>>2]|0) + imm|0;
            if ((write32tlbcheck ^ vaddr) >> 13) {
                paddr = DTLBLookup(vaddr, 1)|0;
                if ((paddr|0) == -1) {
                    break;
                }
                write32tlbcheck = vaddr;
                write32tlblookup = ((paddr^vaddr) >> 13) << 13;
            }
            paddr = write32tlblookup ^ vaddr;
            SR_F = ((paddr|0) == (EA|0))?(1|0):(0|0);
            EA = -1;
            if ((SR_F|0) == 0) {
                break;
            }
            if ((paddr|0) > 0) {
                h[ramp + paddr >> 2] = r[((ins >> 9) & 0x7C)>>2]|0;
            } else {
                Write32(paddr|0, r[((ins >> 9) & 0x7C)>>2]|0);
            }
            continue;

        case 0x35:
            // sw
            imm = ((((ins >> 10) & 0xF800) | (ins & 0x7FF)) << 16) >> 16;
            vaddr = (r[((ins >> 14) & 0x7C)>>2]|0) + imm|0;
            if ((write32tlbcheck ^ vaddr) >> 13) {
                paddr = DTLBLookup(vaddr, 1)|0;
                if ((paddr|0) == -1) {
                    break;
                }
                write32tlbcheck = vaddr;
                write32tlblookup = ((paddr^vaddr) >> 13) << 13;
            }
            paddr = write32tlblookup ^ vaddr;
            if ((paddr|0) > 0) {
                h[ramp + paddr >> 2] = r[((ins >> 9) & 0x7C)>>2]|0;
            } else {
                Write32(paddr|0, r[((ins >> 9) & 0x7C)>>2]|0);
            }
            continue;

        case 0x36:
            // sb
            imm = ((((ins >> 10) & 0xF800) | (ins & 0x7FF)) << 16) >> 16;
            vaddr = (r[((ins >> 14) & 0x7C)>>2]|0) + imm|0;
            if ((write8tlbcheck ^ vaddr) >> 13) {
                paddr = DTLBLookup(vaddr, 1)|0;
                if ((paddr|0) == -1) {
                    break;
                }
                write8tlbcheck = vaddr;
                write8tlblookup = ((paddr^vaddr) >> 13) << 13;
            }
            paddr = write8tlblookup ^ vaddr;
            if ((paddr|0) > 0) {
                // consider that the data is saved in little endian
                b[ramp + (paddr ^ 3)|0] = r[((ins >> 9) & 0x7C)>>2]|0;
            } else {
                Write8(paddr|0, r[((ins >> 9) & 0x7C)>>2]|0);
            }
            continue;

        case 0x37:
            // sh
            imm = ((((ins >> 10) & 0xF800) | (ins & 0x7FF)) << 16) >> 16;
            vaddr = (r[((ins >> 14) & 0x7C)>>2]|0) + imm|0;
            if ((write16tlbcheck ^ vaddr) >> 13) {
                paddr = DTLBLookup(vaddr, 1)|0;
                if ((paddr|0) == -1) {
                    break;
                }
                write16tlbcheck = vaddr;
                write16tlblookup = ((paddr^vaddr) >> 13) << 13;
            }
            paddr = write16tlblookup ^ vaddr;
            if ((paddr|0) >= 0) {
                w[ramp + (paddr ^ 2) >> 1] = r[((ins >> 9) & 0x7C)>>2];
            } else {
                Write16(paddr|0, r[((ins >> 9) & 0x7C)>>2]|0);
            }
            continue;

        case 0x38:
            // three operands commands
            rA = r[((ins >> 14) & 0x7C)>>2]|0;
            rB = r[((ins >> 9) & 0x7C)>>2]|0;
            rindex = (ins >> 19) & 0x7C;
            switch (ins & 0x3CF) {

            case 0x0:
                // add
                r[rindex>>2] = rA + rB|0;
                SR_CY = (r[rindex>>2]>>>0) < (rA>>>0);
                continue;

            case 0x1:
                // add with carry
                r[rindex>>2] = (rA + rB|0) + (SR_CY?1:0)|0;
                if (SR_CY) {
                    SR_CY = (r[rindex>>2]>>>0) <= (rA>>>0);
                } else {
                    SR_CY = (r[rindex>>2]>>>0) < (rA>>>0);
                }
                continue;

            case 0x2:
                // sub signed
                r[rindex>>2] = rA - rB|0;
                SR_CY = (rB>>>0) > (rA>>>0);
                continue;
            case 0x3:
                // and
                r[rindex>>2] = rA & rB;
                continue;
            case 0x4:
                // or
                r[rindex>>2] = rA | rB;
                continue;
            case 0x5:
                // or
                r[rindex>>2] = rA ^ rB;
                continue;
            case 0x8:
                // sll
                r[rindex>>2] = rA << (rB & 0x1F);
                continue;
            case 0xc:
                // exths
                r[rindex>>2] = (rA << 16) >> 16;
                continue;
            case 0xe:
                // cmov
                r[rindex>>2] = (SR_F?rA:rB)|0;
                continue;
            case 0x48:
                // srl not signed
                r[rindex>>2] = rA >>> (rB & 0x1F);
                continue;
            case 0x4c:
                // extbs
                r[rindex>>2] = (rA << 24) >> 24;
                continue;
            case 0xf:
                // ff1
                r[rindex>>2] = 0;
                for (i = 0; (i|0) < 32; i=i+1|0) {
                    if (rA & (1 << i)) {
                        r[rindex>>2] = i + 1;
                        break;
                    }
                }
                continue;
            case 0x88:
                // sra signed
                r[rindex>>2] = rA >> (rB & 0x1F);
                // be carefull here and check
                continue;
            case 0x10f:
                // fl1
                r[rindex>>2] = 0;
                for (i = 31; (i|0) >= 0; i=i-1|0) {
                    if (rA & (1 << i)) {
                        r[rindex>>2] = i + 1;
                        break;
                    }
                }
                continue;
            case 0x306:
                // mul signed (specification seems to be wrong)
                r[rindex>>2] = imul(rA|0, rB|0)|0;
                continue;

            case 0x30a:
                // divu (specification seems to be wrong)
                SR_OV = (rB|0) == 0;
                if (!SR_OV) {
                    r[rindex>>2] = (rA>>>0) / (rB>>>0);
                }
                continue;

            case 0x309:
                // div (specification seems to be wrong)
                SR_OV = (rB|0) == 0;
                if (!SR_OV) {
                    r[rindex>>2] = (rA|0) / (rB|0);
                }
                continue;

            default:
                //DebugMessage("Error: op38 opcode not supported yet");
                DebugMessage(ERROR_UNKNOWN|0);
                abort();
                break;
            }
            break;

        case 0x39:
            // sf....
            switch ((ins >> 21) & 0x1F) {
            case 0x0:
                // sfeq
                SR_F = (r[((ins >> 14) & 0x7C)>>2]|0) == (r[((ins >> 9) & 0x7C)>>2]|0);
                continue;
            case 0x1:
                // sfne
                SR_F = (r[((ins >> 14) & 0x7C)>>2]|0) != (r[((ins >> 9) & 0x7C)>>2]|0);
                continue;
            case 0x2:
                // sfgtu
                SR_F = ((r[((ins >> 14) & 0x7C)>>2]>>>0) > (r[((ins >> 9) & 0x7C)>>2]>>>0));
                continue;
            case 0x3:
                // sfgeu
                SR_F = ((r[((ins >> 14) & 0x7C)>>2]>>>0) >= (r[((ins >> 9) & 0x7C)>>2]>>>0));
                continue;
            case 0x4:
                // sfltu
                SR_F = ((r[((ins >> 14) & 0x7C)>>2]>>>0) < (r[((ins >> 9) & 0x7C)>>2]>>>0));
                continue;
            case 0x5:
                // sfleu
                SR_F = ((r[((ins >> 14) & 0x7C)>>2]>>>0) <= (r[((ins >> 9) & 0x7C)>>2]>>>0));
                continue;
            case 0xa:
                // sfgts
                SR_F = (r[((ins >> 14) & 0x7C)>>2]|0) > (r[((ins >> 9) & 0x7C)>>2]|0);
                continue;
            case 0xb:
                // sfges
                SR_F = (r[((ins >> 14) & 0x7C)>>2]|0) >= (r[((ins >> 9) & 0x7C)>>2]|0);
                continue;
            case 0xc:
                // sflts
                SR_F = (r[((ins >> 14) & 0x7C)>>2]|0) < (r[((ins >> 9) & 0x7C)>>2]|0);
                continue;
            case 0xd:
                // sfles
                SR_F = (r[((ins >> 14) & 0x7C)>>2]|0) <= (r[((ins >> 9) & 0x7C)>>2]|0);
                continue;
            default:
                //DebugMessage("Error: sf.... function supported yet");
                DebugMessage(ERROR_UNKNOWN|0);
                abort();
            }
            break;

        default:
            //DebugMessage("Error: Instruction with opcode " + utils.ToHex(ins >>> 26) + " not supported");
            DebugMessage(ERROR_UNKNOWN|0);
            abort();
            break;
        }

        } else { // fence

            pc = nextpc;

            if (!(delayedins_at_page_boundary|0)) {
                delayedins = 0;
            }

            dsteps = dsteps - ((ppc - ppcorigin) >> 2)|0;

            // do this not so often
            if ((dsteps|0) < 0)
            if (!(delayedins_at_page_boundary|0)) { // for now. Not sure if we need this

                dsteps = dsteps + 64|0;
                steps = steps - 64|0;
                if ((steps|0) < 0) return 0x0; // return to main loop

                // ---------- TICK ----------
                // timer enabled
                if ((TTMR >> 30) != 0) {
                    delta = (TTMR & 0xFFFFFFF) - (TTCR & 0xFFFFFFF) |0;
                    //if (delta < 0) message.Debug("" + (TTCR & 0xFFFFFFF) + " " + SR_TEE + " " + (TTMR & 0xFFFFFFF) + " " + (TTMR >> 28));
                    TTCR = TTCR + clockspeed | 0;
                    if ((delta|0) <= (clockspeed|0)) {
                        // if interrupt enabled
                        if (TTMR & (1 << 29)) {
                            TTMR = TTMR | (1 << 28); // set pending interrupt
                        }
                    }
                }

                // check if pending and check if interrupt must be triggered
                if (TTMR & (1 << 28)) {
                    if (SR_TEE|0) {
                        Exception(EXCEPT_TICK, h[group0p + (SPR_EEAR_BASE<<2) >> 2]|0);
                        // treat exception directly here
                        pc = nextpc;
                    }
                }

            } // dsteps

            if (SR_IEE|0)
            if (raise_interrupt|0) {
                Exception(EXCEPT_INT, h[group0p + (SPR_EEAR_BASE<<2)>>2]|0);
                pc = nextpc;
            }

            // Get Instruction Fast version
            if ((instlbcheck ^ pc) & 0xFFFFE000) // short check if it is still the correct page
            {
                instlbcheck = pc; // save the new page, lower 11 bits are ignored
                if (!SR_IME) {
                    instlblookup = 0x0;
                } else {
                    setindex = (pc >> 13) & 63; // check this values
                    tlmbr = h[group2p + ((0x200 | setindex) << 2) >> 2]|0;
                    // test if tlmbr is valid
                    if ((tlmbr & 1) == 0) {
                        if (ITLBRefill(pc, 64)|0) {
                            tlmbr = h[group2p + ((0x200 | setindex)<<2) >> 2]|0; // reload the new value
                        } else {
                            // just make sure he doesn't count this 'continue' as steps
                            ppcorigin = ppc;
                            delayedins_at_page_boundary = 0;
                            continue;
                        }
                    }
                    if ((tlmbr >> 19) != (pc >> 19)) {
                        if (ITLBRefill(pc, 64)|0) {
                            tlmbr = h[group2p + ((0x200 | setindex)<<2) >> 2]|0; // reload the new value
                        } else {
                            // just make sure he doesn't count this 'continue' as steps
                            ppcorigin = ppc;
                            delayedins_at_page_boundary = 0;
                            continue;
                        }
                    }
                    tlbtr = h[group2p + ((0x280 | setindex) << 2) >> 2]|0;
                    instlblookup = ((tlbtr ^ tlmbr) >> 13) << 13;
                }
            }

            // set pc and set the correcponding physical pc pointer
            ppc = ramp + (instlblookup ^ pc)|0;
            ppcorigin = ppc;
            pcbase = pc - 4 - ppcorigin|0;

            if (delayedins_at_page_boundary|0) {
                delayedins_at_page_boundary = 0;
                fence = ppc + 4|0;
                nextpc = jump;
            } else {
                fence  = ((ppc >> 13) + 1) << 13; // next page
                nextpc = ((pc  >> 13) + 1) << 13;
            }

        } // fence

    }; // main loop

    return steps|0;
}

return {
    Init: Init,
    Reset: Reset,
    InvalidateTLB: InvalidateTLB,
    Step: Step,
    GetFlags: GetFlags,
    SetFlags: SetFlags,
    GetTimeToNextInterrupt: GetTimeToNextInterrupt,
    ProgressTime: ProgressTime,
    GetTicks: GetTicks,
    RaiseInterrupt: RaiseInterrupt,
    ClearInterrupt: ClearInterrupt,
    AnalyzeImage: AnalyzeImage,
    GetStat : GetStat
};

}

module.exports = FastCPU;

},{"../messagehandler":33}],36:[function(require,module,exports){
/* this is a unified, abstract interface (a facade) to the different
 * CPU implementations
 */

"use strict";
var message = require('../messagehandler'); // global variable
var toHex = require('../utils').ToHex;
var imul = require('../imul');

// CPUs
var FastCPU = require('./fastcpu');
var SafeCPU = require('./safecpu');
var SMPCPU = require('./smpcpu');
var DynamicCPU = require('./dynamic/dynamiccpu');

// The asm.js ("Fast") and SMP cores must be singletons
// because of Firefox limitations.
var fastcpu = null;
var smpcpu = null;

var stdlib = {
    Int32Array : Int32Array,
    Float32Array : Float32Array,
    Uint8Array : Uint8Array,
    Uint16Array : Uint16Array,
    Math : Math
};

function createCPUAsm(cpuname, ram, heap, ncores) {
    var foreign = {
        DebugMessage: message.Debug,
        abort : message.Abort,
        imul : Math.imul || imul,
        Read32 : ram.Read32Big.bind(ram),
        Write32 : ram.Write32Big.bind(ram),
        Read16 : ram.Read16Big.bind(ram),
        Write16 : ram.Write16Big.bind(ram),
        Read8 : ram.Read8Big.bind(ram),
        Write8 : ram.Write8Big.bind(ram)
    };
    if (cpuname === 'asm') {
        if (fastcpu === null) {
            fastcpu = FastCPU(stdlib, foreign, heap);
            fastcpu.Init();
        }
        return fastcpu;
    }
    if (cpuname === 'smp') {
        if (smpcpu === null) {
            smpcpu = SMPCPU(stdlib, foreign, heap);
            smpcpu.Init(ncores);
        }
        return smpcpu;
    }
}

async function createCPUWasm(cpuname, ram, heap, ncores) {

    let importObj = {
        env: {
            memory : ram.memory,
            DebugMessage: message.Debug,
            abort : message.Abort,
            Read32 : ram.Read32Big.bind(ram),
            Write32 : ram.Write32Big.bind(ram),
            Read16 : ram.Read16Big.bind(ram),
            Write16 : ram.Write16Big.bind(ram),
            Read8 : ram.Read8Big.bind(ram),
            Write8 : ram.Write8Big.bind(ram)
        }
    };
    let response = await fetch('or1k.wasm');
    let obj = await WebAssembly.instantiate(await response.arrayBuffer(), importObj);
    let exports = obj.instance.exports;
    return {
      AnalyzeImage : exports.AnalyzeImage,
      ClearInterrupt : exports.ClearInterrupt,
      GetFlags : exports.GetFlags,
      GetStat : exports.GetStat,
      GetTicks : exports.GetTicks,
      GetTimeToNextInterrupt : exports.GetTimeToNextInterrupt,
      Init : exports.Init,
      InvalidateTLB : exports.InvalidateTLB,
      ProgressTime : exports.ProgressTime,
      RaiseInterrupt : exports.RaiseInterrupt,
      Reset : exports.Reset,
      SetFlags : exports.SetFlags,
      Step : exports.Step
    };
}

async function createCPU(cpuname, ram, heap, ncores) {
    var cpu = null;

    if (cpuname === "safe") {
        return new SafeCPU(ram);
    }
    if (cpuname === "dynamic") {
        return new DynamicCPU(ram);
    }
    if (cpuname === "asm") {
        cpu = createCPUAsm(cpuname, ram, heap, ncores);
        cpu.Init();
        return cpu;
    }
    if (cpuname === "smp") {
        cpu = createCPUAsm(cpuname, ram, heap, ncores);
        cpu.Init(ncores);
        return cpu;
    }
    if (cpuname === "wasm") {
        cpu = await createCPUWasm(cpuname, ram, heap, ncores);
        cpu.Init();
        return cpu;
    }
    throw new Error("invalid CPU name:" + cpuname);
}

function CPU(cpuname, ram, heap, ncores) {
    this.name = cpuname;
    this.ncores = ncores;
    this.ram = ram;
    this.heap = heap;
    this.littleendian = false;
}

CPU.prototype.Init = async function() {
    this.cpu = await createCPU(this.name, this.ram, this.heap, this.ncores);
}

CPU.prototype.toString = function() {
    var r = new Uint32Array(this.heap);
    var str = '';
    str += "Current state of the machine\n";
    //str += "clock: " + toHex(cpu.clock) + "\n";
    str += "PC: " + toHex(this.cpu.pc<<2) + "\n";
    str += "next PC: " + toHex(this.cpu.nextpc<<2) + "\n";
    //str += "ins: " + toHex(cpu.ins) + "\n";
    //str += "main opcode: " + toHex(cpu.ins>>>26) + "\n";
    //str += "sf... opcode: " + toHex((cpu.ins>>>21)&0x1F) + "\n";
    //str += "op38. opcode: " + toHex((cpu.ins>>>0)&0x3CF) + "\n";

    for (var i = 0; i < 32; i += 4) {
        str += "   r" + (i + 0) + ": " +
            toHex(r[i + 0]) + "   r" + (i + 1) + ": " +
            toHex(r[i + 1]) + "   r" + (i + 2) + ": " +
            toHex(r[i + 2]) + "   r" + (i + 3) + ": " +
            toHex(r[i + 3]) + "\n";
    }

    if (this.cpu.delayedins) {
        str += "delayed instruction\n";
    }
    if (this.cpu.SR_SM) {
        str += "Supervisor mode\n";
    }
    else {
        str += "User mode\n";
    }
    if (this.cpu.SR_TEE) {
        str += "tick timer exception enabled\n";
    }
    if (this.cpu.SR_IEE) {
        str += "interrupt exception enabled\n";
    }
    if (this.cpu.SR_DME) {
        str += "data mmu enabled\n";
    }
    if (this.cpu.SR_IME) {
        str += "instruction mmu enabled\n";
    }
    if (this.cpu.SR_LEE) {
        str += "little endian enabled\n";
    }
    if (this.cpu.SR_CID) {
        str += "context id enabled\n";
    }
    if (this.cpu.SR_F) {
        str += "flag set\n";
    }
    if (this.cpu.SR_CY) {
        str += "carry set\n";
    }
    if (this.cpu.SR_OV) {
        str += "overflow set\n";
    }
    return str;
};

// forward a couple of methods to the CPU implementation
var forwardedMethods = [
    "Reset",
    "Step",
    "RaiseInterrupt",
    "Step",
    "AnalyzeImage",
    "GetTicks",
    "GetTimeToNextInterrupt",
    "ProgressTime",
    "ClearInterrupt"];

forwardedMethods.forEach(function(m) {
    CPU.prototype[m] = function() {
        return this.cpu[m].apply(this.cpu, arguments);
    };

});

module.exports = CPU;

},{"../imul":30,"../messagehandler":33,"../utils":48,"./dynamic/dynamiccpu":34,"./fastcpu":35,"./safecpu":37,"./smpcpu":38}],37:[function(require,module,exports){
// -------------------------------------------------
// -------------------- CPU ------------------------
// -------------------------------------------------

"use strict";
var message = require('../messagehandler');
var utils = require('../utils');

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
var EXCEPT_SYSCALL = 0xC00; // syscall, jump into supervisor mode
var EXCEPT_TRAP = 0xE00; // syscall, jump into supervisor mode

// constructor
function SafeCPU(ram) {
    this.ram = ram;

    // registers
    // r[32] and r[33] are used to calculate the virtual address and physical address
    // to make sure that they are not transformed accidently into a floating point number
    this.r = new Int32Array(this.ram.heap, 0, 34 << 2);
    this.f = new Float32Array(this.ram.heap, 0, 32 << 2);

    // special purpose registers
    this.group0 = new Int32Array(this.ram.heap, 0x2000, 0x2000);

    // data tlb
    this.group1 = new Int32Array(this.ram.heap, 0x4000, 0x2000);

    // instruction tlb
    this.group2 = new Int32Array(this.ram.heap, 0x6000, 0x2000);

    // define variables and initialize
    this.pc = 0x0; // instruction pointer in multiples of four
    this.nextpc = 0x0; // pointer to next instruction in multiples of four
    //this.ins=0x0; // current instruction to handle

    this.delayedins = false; // the current instruction is an delayed instruction, one cycle before a jump

    this.clock = 0x0;

    this.EA = -1; // hidden register for atomic lwa operation

    this.TTMR = 0x0; // Tick timer mode register
    this.TTCR = 0x0; // Tick timer count register

    this.PICMR = 0x3; // interrupt controller mode register (use nmi)
    this.PICSR = 0x0; // interrupt controller set register

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

    this.Reset();
}

SafeCPU.prototype.Reset = function() {
    this.TTMR = 0x0;
    this.TTCR = 0x0;
    this.PICMR = 0x3;
    this.PICSR = 0x0;

    this.group0[SPR_IMMUCFGR] = 0x18; // 0 ITLB has one way and 64 sets
    this.group0[SPR_DMMUCFGR] = 0x18; // 0 DTLB has one way and 64 sets
    this.group0[SPR_ICCFGR] = 0x48;
    this.group0[SPR_DCCFGR] = 0x48;
    this.group0[SPR_VR] = 0x12000001;

    // UPR present
    // data mmu present
    // instruction mmu present
    // PIC present (architecture manual seems to be wrong here)
    // Tick timer present
    this.group0[SPR_UPR] = 0x619;

    this.Exception(EXCEPT_RESET, 0x0); // set pc values
    this.pc = this.nextpc;
    this.nextpc++;
}

SafeCPU.prototype.InvalidateTLB = function() {
}

SafeCPU.prototype.GetTimeToNextInterrupt = function () {

    if ((this.TTMR >> 30) == 0) return -1;
    var delta = (this.TTMR & 0xFFFFFFF) - (this.TTCR & 0xFFFFFFF);
    return delta;
}

SafeCPU.prototype.GetTicks = function () {
    if ((this.TTMR >> 30) == 0) return -1;
    return this.TTCR & 0xFFFFFFF;
}

SafeCPU.prototype.ProgressTime = function (delta) {
    this.TTCR = (this.TTCR + delta) & 0xFFFFFFFF;
}


SafeCPU.prototype.AnalyzeImage = function() // we haveto define these to copy the cpus
{
    this.boot_dtlb_misshandler_address = 0x0;
    this.boot_itlb_misshandler_address = 0x0;
    this.current_pgd = 0x0;
}

SafeCPU.prototype.SetFlags = function (x) {
    this.SR_SM = (x & (1 << 0)) ? true : false;
    this.SR_TEE = (x & (1 << 1)) ? true : false;
    var old_SR_IEE = this.SR_IEE;
    this.SR_IEE = (x & (1 << 2)) ? true : false;
    this.SR_DCE = (x & (1 << 3)) ? true : false;
    this.SR_ICE = (x & (1 << 4)) ? true : false;
    var old_SR_DME = this.SR_DME;
    this.SR_DME = (x & (1 << 5)) ? true : false;
    var old_SR_IME = this.SR_IME;
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
    this.SR_CID = (x >> 28) & 0xF;
    if (this.SR_LEE) {
        message.Debug("little endian not supported");
        message.Abort();
    }
    if (this.SR_CID) {
        message.Debug("context id not supported");
        message.Abort();
    }
    if (this.SR_EPH) {
        message.Debug("exception prefix not supported");
        message.Abort();
    }
    if (this.SR_DSX) {
        message.Debug("delay slot exception not supported");
        message.Abort();
    }
    if (this.SR_IEE && !old_SR_IEE) {
        this.CheckForInterrupt();
    }
};

SafeCPU.prototype.GetFlags = function () {
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

SafeCPU.prototype.CheckForInterrupt = function () {
    if (!this.SR_IEE) {
        return;
    }
    if (this.PICMR & this.PICSR) {
        this.Exception(EXCEPT_INT, this.group0[SPR_EEAR_BASE]);
        this.pc = this.nextpc++;
    }
};

SafeCPU.prototype.RaiseInterrupt = function (line, cpuid) {
    this.PICSR |= 1 << line;
    this.CheckForInterrupt();
};

SafeCPU.prototype.ClearInterrupt = function (line, cpuid) {
    this.PICSR &= ~(1 << line);
};

SafeCPU.prototype.SetSPR = function (idx, x) {
    var address = idx & 0x7FF;
    var group = (idx >> 11) & 0x1F;

    switch (group) {
    case 0:
        if (address == SPR_SR) {
            this.SetFlags(x);
        }
        this.group0[address] = x;
        break;
    case 1:
        // Data MMU
        this.group1[address] = x;
        break;
    case 2:
        // ins MMU
        this.group2[address] = x;
        break;
    case 3:
        // data cache, not supported
    case 4:
        // ins cache, not supported
        break;
    case 8:
        break;
    case 9:
        // pic
        switch (address) {
        case 0:
            this.PICMR = x | 0x3; // we use non maskable interrupt here
            // check immediate for interrupt
            if (this.SR_IEE) {
                if (this.PICMR & this.PICSR) {
                    message.Debug("Error in SetSPR: Direct triggering of interrupt exception not supported?");
                    message.Abort();
                }
            }
            break;
        case 2: // PICSR
            break;
        default:
            message.Debug("Error in SetSPR: interrupt address not supported");
            message.Abort();
        }
        break;
    case 10:
        //tick timer
        switch (address) {
        case 0:
            this.TTMR = x;
            if (((this.TTMR >> 30)&3) != 0x3) {
                //message.Debug("Error in SetSPR: Timer mode other than continuous not supported");
                //message.Abort();
            }
            break;
        case 1:
            this.TTCR = x;
            break;
        default:
            message.Debug("Error in SetSPR: Tick timer address not supported");
            message.Abort();
            break;
        }
        break;

    default:
        message.Debug("Error in SetSPR: group " + group + " not found");
        message.Abort();
        break;
    }
};

SafeCPU.prototype.GetSPR = function (idx) {
    var address = idx & 0x7FF;
    var group = (idx >> 11) & 0x1F;

    switch (group) {
    case 0:
        if (address == SPR_SR) {
            return this.GetFlags();
        }
        return this.group0[address];
    case 1:
        return this.group1[address];
    case 2:
        return this.group2[address];
    case 8:
        return 0x0;

    case 9:
        // pic
        switch (address) {
        case 0:
            return this.PICMR;
        case 2:
            return this.PICSR;
        default:
            message.Debug("Error in GetSPR: PIC address unknown");
            message.Abort();
            break;
        }
        break;

    case 10:
        // tick Timer
        switch (address) {
        case 0:
            return this.TTMR;
        case 1:
            return this.TTCR; // or clock
        default:
            message.Debug("Error in GetSPR: Tick timer address unknown");
            message.Abort();
            break;
        }
        break;
    default:
        message.Debug("Error in GetSPR: group " + group +  " unknown");
        message.Abort();
        break;
    }

};

SafeCPU.prototype.Exception = function (excepttype, addr) {
    var except_vector = excepttype | (this.SR_EPH ? 0xf0000000 : 0x0);
    //message.Debug("Info: Raising Exception " + utils.ToHex(excepttype));

    this.SetSPR(SPR_EEAR_BASE, addr);
    this.SetSPR(SPR_ESR_BASE, this.GetFlags());

    this.EA = -1;
    this.SR_OVE = false;
    this.SR_SM = true;
    this.SR_IEE = false;
    this.SR_TEE = false;
    this.SR_DME = false;

    this.nextpc = except_vector>>2;

    switch (excepttype) {
    case EXCEPT_RESET:
        break;

    case EXCEPT_ITLBMISS:
    case EXCEPT_IPF:
    case EXCEPT_DTLBMISS:
    case EXCEPT_DPF:
    case EXCEPT_BUSERR:
    case EXCEPT_TICK:
    case EXCEPT_INT:
    case EXCEPT_TRAP:
        this.SetSPR(SPR_EPCR_BASE, (this.pc<<2) - (this.delayedins ? 4 : 0));
        break;

    case EXCEPT_SYSCALL:
        this.SetSPR(SPR_EPCR_BASE, (this.pc<<2) + 4 - (this.delayedins ? 4 : 0));
        break;
    default:
        message.Debug("Error in Exception: exception type not supported");
        message.Abort();
    }

    // Handle restart mode timer
    if (excepttype == EXCEPT_TICK && (this.TTMR >> 30) == 0x1) {
	this.TTCR = 0;
    }

    this.delayedins = false;
    this.SR_IME = false;
};


SafeCPU.prototype.DTLBLookup = function (addr, write) {
    if (!this.SR_DME) {
        return addr;
    }
    // pagesize is 8192 bytes
    // nways are 1
    // nsets are 64

    var setindex = (addr >> 13) & 63;
    var tlmbr = this.group1[0x200 | setindex]; // match register
    if (((tlmbr & 1) == 0) || ((tlmbr >> 19) != (addr >> 19))) {
        this.Exception(EXCEPT_DTLBMISS, addr);
        return -1;
    }
        // set lru 
        if (tlmbr & 0xC0) {
            message.Debug("Error: LRU ist not supported");
            message.Abort();
        }

    var tlbtr = this.group1[0x280 | setindex]; // translate register

    // check if supervisor mode
    if (this.SR_SM) {
        if (
            ((!write) && (!(tlbtr & 0x100))) || // check if SRE
            ((write) && (!(tlbtr & 0x200)))     // check if SWE
           ) {
            this.Exception(EXCEPT_DPF, addr);
            return -1;
           }
    } else {
        if (
               ((!write) && (!(tlbtr & 0x40))) || // check if URE
               ((write) && (!(tlbtr & 0x80)))     // check if UWE
           ) {
            this.Exception(EXCEPT_DPF, addr);
            return -1;
           }
    }
    return ((tlbtr & 0xFFFFE000) | (addr & 0x1FFF));
};

// the slow and safe version
SafeCPU.prototype.GetInstruction = function (addr) {
    if (!this.SR_IME) {
        return this.ram.Read32Big(addr);
    }
    // pagesize is 8192 bytes
    // nways are 1
    // nsets are 64

    var setindex = (addr >> 13) & 63;
    setindex &= 63; // number of sets
    var tlmbr = this.group2[0x200 | setindex];

    // test if tlmbr is valid
    if (((tlmbr & 1) == 0) || ((tlmbr >> 19) != (addr >> 19))) {
            this.Exception(EXCEPT_ITLBMISS, this.pc<<2);
            return -1;
    }
    // set lru
    if (tlmbr & 0xC0) {
        message.Debug("Error: LRU ist not supported");
        message.Abort();
    }

    var tlbtr = this.group2[0x280 | setindex];
    //Test for page fault
    // check if supervisor mode
    if (this.SR_SM) {
        // check if user read enable is not set(URE)
        if (!(tlbtr & 0x40)) {
            this.Exception(EXCEPT_IPF, this.pc<<2);
            return -1;
        }
    } else {
        // check if supervisor read enable is not set (SRE)
        if (!(tlbtr & 0x80)) {
            this.Exception(EXCEPT_IPF, this.pc<<2);
            return -1;
        }
    }
    return this.ram.Read32Big((tlbtr & 0xFFFFE000) | (addr & 0x1FFF));
};

SafeCPU.prototype.Step = function (steps, clockspeed) {
    var ins = 0x0;
    var imm = 0x0;
    var i = 0;
    var rindex = 0x0;
    var rA = 0x0,
        rB = 0x0,
        rD = 0x0;

    // local variables could be faster
    var r = this.r;
    var f = this.f;
    var ram = this.ram;
    var int32mem = this.ram.int32mem;
    var group2 = this.group2;

    // to get the instruction
    var setindex = 0x0;
    var tlmbr = 0x0;
    var tlbtr = 0x0;
    var jump = 0x0;
    var delta = 0x0;

    do {
        this.clock++;

        // do this not so often
        if (!(steps & 63)) {
            // ---------- TICK ----------
            // timer enabled
            if ((this.TTMR >> 30) != 0) {
                delta = (this.TTMR & 0xFFFFFFF) - (this.TTCR & 0xFFFFFFF);
                this.TTCR = (this.TTCR + clockspeed) & 0xFFFFFFFF;
                if (delta < clockspeed) {
                    // if interrupt enabled
                    if (this.TTMR & (1 << 29)) {
                        this.TTMR |= (1 << 28); // set pending interrupt
                    }
                }
            }

            // check if pending and check if interrupt must be triggered
            if ((this.SR_TEE) && (this.TTMR & (1 << 28))) {
                this.Exception(EXCEPT_TICK, this.group0[SPR_EEAR_BASE]);
                this.pc = this.nextpc++;
            }
        }

        ins = this.GetInstruction(this.pc<<2)
        if (ins == -1) {
            this.pc = this.nextpc++;
            continue;
        }

        switch ((ins >> 26)&0x3F) {
        case 0x0:
            // j
            jump = this.pc + ((ins << 6) >> 6);
            this.pc = this.nextpc;
            this.nextpc = jump;
            this.delayedins = true;
            continue;

        case 0x1:
            // jal
            jump = this.pc + ((ins << 6) >> 6);
            r[9] = (this.nextpc<<2) + 4;
            this.pc = this.nextpc;
            this.nextpc = jump;
            this.delayedins = true;
            continue;

        case 0x3:
            // bnf
            if (this.SR_F) {
                break;
            }
            jump = this.pc + ((ins << 6) >> 6);
            this.pc = this.nextpc;
            this.nextpc = jump;
            this.delayedins = true;
            continue;

        case 0x4:
            // bf
            if (!this.SR_F) {
                break;
            }
            jump = this.pc + ((ins << 6) >> 6);
            this.pc = this.nextpc;
            this.nextpc = jump;
            this.delayedins = true;
            continue;

        case 0x5:
            // nop
            break;

        case 0x6:
            // movhi or macrc
            rindex = (ins >> 21) & 0x1F;
            // if 16th bit is set
            if (ins & 0x10000) {
                message.Debug("Error: macrc not supported\n");
                message.Abort();
            } else {
                r[rindex] = ((ins & 0xFFFF) << 16); // movhi
            }
            break;

        case 0x8:
            // sys and trap
            if ((ins&0xFFFF0000) == 0x21000000) {
                message.Debug("Trap at " + utils.ToHex(this.pc<<2));
                this.Exception(EXCEPT_TRAP, this.group0[SPR_EEAR_BASE]);
            } else {
                this.Exception(EXCEPT_SYSCALL, this.group0[SPR_EEAR_BASE]);
            }
            break;

        case 0x9:
            // rfe
            this.nextpc = this.GetSPR(SPR_EPCR_BASE)>>2;
            this.pc = this.nextpc++;
            this.delayedins = false;
            this.SetFlags(this.GetSPR(SPR_ESR_BASE)); // could raise an exception
            continue;

        case 0x11:
            // jr
            jump = r[(ins >> 11) & 0x1F]>>2;
            this.pc = this.nextpc;
            this.nextpc = jump;
            this.delayedins = true;
            continue;

        case 0x12:
            // jalr
            jump = r[(ins >> 11) & 0x1F]>>2;
            r[9] = (this.nextpc<<2) + 4;
            this.pc = this.nextpc;
            this.nextpc = jump;
            this.delayedins = true;
            continue;

        case 0x1B:
            // lwa
            r[32] = r[(ins >> 16) & 0x1F] + ((ins << 16) >> 16);
            if ((r[32] & 3) != 0) {
                message.Debug("Error in lwz: no unaligned access allowed");
                abort();
            }
            r[33] = this.DTLBLookup(r[32], false);
            if (r[33] == -1) {
                break;
            }
            this.EA = r[33];
            r[(ins >> 21) & 0x1F] = r[33]>0?ram.int32mem[r[33] >> 2]:ram.Read32Big(r[33]);
            break;

        case 0x21:
            // lwz
            r[32] = r[(ins >> 16) & 0x1F] + ((ins << 16) >> 16);
            if ((r[32] & 3) != 0) {
                message.Debug("Error in lwz: no unaligned access allowed");
                abort();
            }
            r[33] = this.DTLBLookup(r[32], false);
            if (r[33] == -1) {
                break;
            }
            r[(ins >> 21) & 0x1F] = r[33]>0?ram.int32mem[r[33] >> 2]:ram.Read32Big(r[33]);
            break;

        case 0x23:
            // lbz
            r[32] = r[(ins >> 16) & 0x1F] + ((ins << 16) >> 16);
            r[33] = this.DTLBLookup(r[32], false);
            if (r[33] == -1) {
                break;
            }
            r[(ins >> 21) & 0x1F] = ram.Read8Big(r[33]);
            break;

        case 0x24:
            // lbs
            r[32] = r[(ins >> 16) & 0x1F] + ((ins << 16) >> 16);
            r[33] = this.DTLBLookup(r[32], false);
            if (r[33] == -1) {
                break;
            }
            r[(ins >> 21) & 0x1F] = ((ram.Read8Big(r[33])) << 24) >> 24;
            break;

        case 0x25:
            // lhz
            r[32] = r[(ins >> 16) & 0x1F] + ((ins << 16) >> 16);
            r[33] = this.DTLBLookup(r[32], false);
            if (r[33] == -1) {
                break;
            }
            r[(ins >> 21) & 0x1F] = ram.Read16Big(r[33]);
            break;

        case 0x26:
            // lhs
            r[32] = r[(ins >> 16) & 0x1F] + ((ins << 16) >> 16);
            r[33] = this.DTLBLookup(r[32], false);
            if (r[33] == -1) {
                break;
            }
            r[(ins >> 21) & 0x1F] = (ram.Read16Big(r[33]) << 16) >> 16;
            break;

        case 0x27:
            // addi signed
            imm = (ins << 16) >> 16;
            rA = r[(ins >> 16) & 0x1F];
            rindex = (ins >> 21) & 0x1F;
            r[rindex] = rA + imm;
            this.SR_CY = (r[rindex]>>>0) < (rA>>>0);
            //this.SR_OV = (((rA ^ imm ^ -1) & (rA ^ r[rindex])) & 0x80000000)?true:false;
            //TODO overflow and carry
            break;

        case 0x28:
            // addi signed with carry
            imm = (ins << 16) >> 16;
            rA = r[(ins >> 16) & 0x1F];
            rindex = (ins >> 21) & 0x1F;
            r[rindex] = rA + imm + (this.SR_CY?1:0);
            if (this.SR_CY) {
                this.SR_CY = (r[rindex]>>>0) <= (rA>>>0);
            } else {
                this.SR_CY = (r[rindex]>>>0) < (rA>>>0);
            }
            //this.SR_OV = (((rA ^ imm ^ -1) & (rA ^ r[rindex])) & 0x80000000)?true:false;
            //TODO overflow and carry
            break;

        case 0x29:
            // andi
            r[(ins >> 21) & 0x1F] = r[(ins >> 16) & 0x1F] & (ins & 0xFFFF);
            break;

        case 0x2A:
            // ori
            r[(ins >> 21) & 0x1F] = r[(ins >> 16) & 0x1F] | (ins & 0xFFFF);
            break;

        case 0x2B:
            // xori
            rA = r[(ins >> 16) & 0x1F];
            r[(ins >> 21) & 0x1F] = rA ^ ((ins << 16) >> 16);
            break;

        case 0x2C:
            // muli
            {
            rindex = (ins >> 21) & 0x1F;
            rA = r[(ins >> 16) & 0x1F];
            r[rindex] = (rA * ((ins << 16) >> 16))&0xFFFFFFFF;
            var rAl = rA & 0xFFFF;
            var rBl = ins & 0xFFFF;
            r[rindex] = r[rindex] & 0xFFFF0000 | ((rAl * rBl) & 0xFFFF);
            }
            // TODO set overflow flag
            break;

        case 0x2D:
            // mfspr
            r[(ins >> 21) & 0x1F] = this.GetSPR(r[(ins >> 16) & 0x1F] | (ins & 0xFFFF));
            break;

        case 0x2E:
            switch ((ins >> 6) & 0x3) {
            case 0:
                // slli
                r[(ins >> 21) & 0x1F] = r[(ins >> 16) & 0x1F] << (ins & 0x1F);
                break;
            case 1:
                // rori
                r[(ins >> 21) & 0x1F] = r[(ins >> 16) & 0x1F] >>> (ins & 0x1F);
                break;
            case 2:
                // srai
                r[(ins >> 21) & 0x1F] = r[(ins >> 16) & 0x1F] >> (ins & 0x1F);
                break;
            default:
                message.Debug("Error: opcode 2E function not implemented");
                abort();
                break;
            }
            break;

        case 0x2F:
            // sf...i
            imm = (ins << 16) >> 16;
            switch ((ins >> 21) & 0x1F) {
            case 0x0:
                // sfnei
                this.SR_F = (r[(ins >> 16) & 0x1F] == imm) ? true : false;
                break;
            case 0x1:
                // sfnei
                this.SR_F = (r[(ins >> 16) & 0x1F] != imm) ? true : false;
                break;
            case 0x2:
                // sfgtui
                this.SR_F = ((r[(ins >> 16) & 0x1F]>>>0) > (imm >>> 0)) ? true : false;
                break;
            case 0x3:
                // sfgeui
                this.SR_F = ((r[(ins >> 16) & 0x1F]>>>0) >= (imm >>> 0)) ? true : false;
                break;
            case 0x4:
                // sfltui
                this.SR_F = ((r[(ins >> 16) & 0x1F]>>>0) < (imm >>> 0)) ? true : false;
                break;
            case 0x5:
                // sfleui
                this.SR_F = ((r[(ins >> 16) & 0x1F]>>>0) <= (imm >>> 0)) ? true : false;
                break;
            case 0xa:
                // sfgtsi
                this.SR_F = (r[(ins >> 16) & 0x1F] > imm) ? true : false;
                break;
            case 0xb:
                // sfgesi
                this.SR_F = (r[(ins >> 16) & 0x1F] >= imm) ? true : false;
                break;
            case 0xc:
                // sfltsi
                this.SR_F = (r[(ins >> 16) & 0x1F] < imm) ? true : false;
                break;
            case 0xd:
                // sflesi
                this.SR_F = (r[(ins >> 16) & 0x1F] <= imm) ? true : false;
                break;
            default:
                message.Debug("Error: sf...i not supported yet");
                abort();
                break;
            }
            break;

        case 0x30:
            // mtspr
            imm = (ins & 0x7FF) | ((ins >> 10) & 0xF800);
            this.pc = this.nextpc++;
            this.delayedins = false;
            this.SetSPR(r[(ins >> 16) & 0x1F] | imm, r[(ins >> 11) & 0x1F]); // could raise an exception
            continue;

       case 0x32:
            // floating point
            rA = (ins >> 16) & 0x1F;
            rB = (ins >> 11) & 0x1F;
            rD = (ins >> 21) & 0x1F;
            switch (ins & 0xFF) {
            case 0x0:
                // lf.add.s
                f[rD] = f[rA] + f[rB];
                break;
            case 0x1:
                // lf.sub.s
                f[rD] = f[rA] - f[rB];
                break;
            case 0x2:
                // lf.mul.s
                f[rD] = f[rA] * f[rB];
                break;
            case 0x3:
                // lf.div.s
                f[rD] = f[rA] / f[rB];
                break;
            case 0x4:
                // lf.itof.s
                f[rD] = r[rA];
                break;
            case 0x5:
                // lf.ftoi.s
                r[rD] = f[rA];
                break;
            case 0x7:
                // lf.madd.s
                f[rD] += f[rA] * f[rB];
                break;
            case 0x8:
                // lf.sfeq.s
                this.SR_F = (f[rA] == f[rB]) ? true : false;
                break;
            case 0x9:
                // lf.sfne.s
                this.SR_F = (f[rA] != f[rB]) ? true : false;
                break;
            case 0xa:
                // lf.sfgt.s
                this.SR_F = (f[rA] > f[rB]) ? true : false;
                break;
            case 0xb:
                // lf.sfge.s
                this.SR_F = (f[rA] >= f[rB]) ? true : false;
                break;
            case 0xc:
                // lf.sflt.s
                this.SR_F = (f[rA] < f[rB]) ? true : false;
                break;
            case 0xd:
                // lf.sfle.s
                this.SR_F = (f[rA] <= f[rB]) ? true : false;
                break;
            default:
                message.Debug("Error: lf. function " + utils.ToHex(ins & 0xFF) + " not supported yet");
                message.Abort();
                break;
            }
            break;

        case 0x33:
            // swa
            imm = ((((ins >> 10) & 0xF800) | (ins & 0x7FF)) << 16) >> 16;
            r[32] = r[(ins >> 16) & 0x1F] + imm;
            if (r[32] & 0x3) {
                message.Debug("Error in sw: no aligned memory access");
                abort();
            }
            r[33] = this.DTLBLookup(r[32], true);
            if (r[33] == -1) {
                break;
            }
            this.SR_F = (r[33] == this.EA)?true:false;
            this.EA = -1;
            if (this.SR_F == false) {
                break;
            }
            if (r[33] > 0) {
                int32mem[r[33] >> 2] = r[(ins >> 11) & 0x1F];
            } else {
                ram.Write32Big(r[33], r[(ins >> 11) & 0x1F]);
            }
            break;

        case 0x35:
            // sw
            imm = ((((ins >> 10) & 0xF800) | (ins & 0x7FF)) << 16) >> 16;
            r[32] = r[(ins >> 16) & 0x1F] + imm;
            if (r[32] & 0x3) {
                message.Debug("Error in sw: no aligned memory access");
                message.Abort();
            }
            r[33] = this.DTLBLookup(r[32], true);
            if (r[33] == -1) {
                break;
            }
            if (r[33]>0) {
                int32mem[r[33] >> 2] = r[(ins >> 11) & 0x1F];
            } else {
                ram.Write32Big(r[33], r[(ins >> 11) & 0x1F]);
            }
            break;


        case 0x36:
            // sb
            imm = ((((ins >> 10) & 0xF800) | (ins & 0x7FF)) << 16) >> 16;
            r[32] = r[(ins >> 16) & 0x1F] + imm;
            r[33] = this.DTLBLookup(r[32], true);
            if (r[33] == -1) {
                break;
            }
            ram.Write8Big(r[33], r[(ins >> 11) & 0x1F]);
            break;

        case 0x37:
            // sh
            imm = ((((ins >> 10) & 0xF800) | (ins & 0x7FF)) << 16) >> 16;
            r[32] = r[(ins >> 16) & 0x1F] + imm;
            r[33] = this.DTLBLookup(r[32], true);
            if (r[33] == -1) {
                break;
            }
            ram.Write16Big(r[33], r[(ins >> 11) & 0x1F]);
            break;

        case 0x38:
            // three operands commands
            rA = r[(ins >> 16) & 0x1F];
            rB = r[(ins >> 11) & 0x1F];
            rindex = (ins >> 21) & 0x1F;
            switch (ins & 0x3CF) {
            case 0x0:
                // add
                r[rindex] = rA + rB;
                this.SR_CY = (r[rindex]>>>0) < (rA>>>0);
                //this.SR_OV = (((rA ^ rB ^ -1) & (rA ^ r[rindex])) & 0x80000000)?true:false;
                //TODO overflow and carry
                break;

            case 0x1:
                // add with carry
                r[rindex] = rA + rB + (this.SR_CY?1:0);
                if (this.SR_CY) {
                    this.SR_CY = (r[rindex]>>>0) <= (rA>>>0);
                } else {
                    this.SR_CY = (r[rindex]>>>0) < (rA>>>0);
                }
                //this.SR_OV = (((rA ^ rB ^ -1) & (rA ^ r[rindex])) & 0x80000000)?true:false;
                //TODO overflow and carry
                break;

            case 0x2:
                // sub signed
                r[rindex] = rA - rB;
                //TODO overflow and carry
                this.SR_CY = ((rB>>>0) > (rA>>>0));
                //this.SR_OV = (((rA ^ rB) & (rA ^ r[rindex])) & 0x80000000)?true:false;
                break;

            case 0x3:
                // and
                r[rindex] = rA & rB;
                break;
            case 0x4:
                // or
                r[rindex] = rA | rB;
                break;
            case 0x5:
                // or
                r[rindex] = rA ^ rB;
                break;
            case 0x8:
                // sll
                r[rindex] = rA << (rB & 0x1F);
                break;
            case 0xc:
                // exths
                r[rindex] = (rA << 16) >> 16;
                break;
            case 0xe:
                // cmov
                r[rindex] = this.SR_F?rA:rB;
                break;
            case 0xf:
                // ff1
                r[rindex] = 0;
                for (i = 0; i < 32; i++) {
                    if (rA & (1 << i)) {
                        r[rindex] = i + 1;
                        break;
                    }
                }
                break;
            case 0x48:
                // srl not signed
                r[rindex] = rA >>> (rB & 0x1F);
                break;
            case 0x4c:
                // extbs
                r[rindex] = (rA << 24) >> 24;
                break;
            case 0x88:
                // sra signed
                r[rindex] = rA >> (rB & 0x1F);
                break;
            case 0x10f:
                // fl1
                r[rindex] = 0;
                for (i = 31; i >= 0; i--) {
                    if (rA & (1 << i)) {
                        r[rindex] = i + 1;
                        break;
                    }
                }
                break;
            case 0x306:
                // mul signed (specification seems to be wrong)
                {
                    // this is a hack to do 32 bit signed multiply. Seems to work but needs to be tested.
                    r[rindex] = utils.int32(rA >> 0) * utils.int32(rB);
                    var rAl = rA & 0xFFFF;
                    var rBl = rB & 0xFFFF;
                    r[rindex] = r[rindex] & 0xFFFF0000 | ((rAl * rBl) & 0xFFFF);
                    //var result = Number(utils.int32(rA)) * Number(utils.int32(rB));
                    //this.SR_OV = (result < (-2147483647 - 1)) || (result > (2147483647));
                    //var uresult = utils.uint32(rA) * utils.uint32(rB);
                    //this.SR_CY = (uresult > (4294967295));
                }
                break;
            case 0x30a:
                // divu (specification seems to be wrong)
                this.SR_OV = rB == 0;
                if (!this.SR_OV) {
                    r[rindex] = (rA>>>0) / (rB>>>0);
                }
                break;
            case 0x309:
                // div (specification seems to be wrong)
                this.SR_OV = rB == 0;
                if (!this.SR_OV) {
                    r[rindex] = rA / rB;
                }
                break;
            default:
                message.Debug("Error: op38 opcode not supported yet");
                message.Abort();
                break;
            }
            break;

        case 0x39:
            // sf....
            switch ((ins >> 21) & 0x1F) {
            case 0x0:
                // sfeq
                this.SR_F = (r[(ins >> 16) & 0x1F] == r[(ins >> 11) & 0x1F]) ? true : false;
                break;
            case 0x1:
                // sfne
                this.SR_F = (r[(ins >> 16) & 0x1F] != r[(ins >> 11) & 0x1F]) ? true : false;
                break;
            case 0x2:
                // sfgtu
                this.SR_F = ((r[(ins >> 16) & 0x1F]>>>0) > (r[(ins >> 11) & 0x1F]>>>0)) ? true : false;
                break;
            case 0x3:
                // sfgeu
                this.SR_F = ((r[(ins >> 16) & 0x1F]>>>0) >= (r[(ins >> 11) & 0x1F]>>>0)) ? true : false;
                break;
            case 0x4:
                // sfltu
                this.SR_F = ((r[(ins >> 16) & 0x1F]>>>0) < (r[(ins >> 11) & 0x1F]>>>0)) ? true : false;
                break;
            case 0x5:
                // sfleu
                this.SR_F = ((r[(ins >> 16) & 0x1F]>>>0) <= (r[(ins >> 11) & 0x1F]>>>0)) ? true : false;
                break;
            case 0xa:
                // sfgts
                this.SR_F = (r[(ins >> 16) & 0x1F] > r[(ins >> 11) & 0x1F]) ? true : false;
                break;
            case 0xb:
                // sfges
                this.SR_F = (r[(ins >> 16) & 0x1F] >= r[(ins >> 11) & 0x1F]) ? true : false;
                break;
            case 0xc:
                // sflts
                this.SR_F = (r[(ins >> 16) & 0x1F] < r[(ins >> 11) & 0x1F]) ? true : false;
                break;
            case 0xd:
                // sfles
                this.SR_F = (r[(ins >> 16) & 0x1F] <= r[(ins >> 11) & 0x1F]) ? true : false;
                break;
            default:
                message.Debug("Error: sf.... function supported yet");
                message.Abort();
            }
            break;

        default:
            message.Debug("Error: Instruction with opcode " + utils.ToHex(ins >>> 26) + " not supported");
            message.Abort();
            break;
        }

        this.pc = this.nextpc++;
        this.delayedins = false;

    } while (--steps); // main loop
    return 0;
};


module.exports = SafeCPU;

},{"../messagehandler":33,"../utils":48}],38:[function(require,module,exports){
var message = require('../messagehandler');

function SMPCPU(stdlib, foreign, heap) {

"use asm";

var floor = stdlib.Math.floor;
var imul = foreign.imul;
var DebugMessage = foreign.DebugMessage;
var abort = foreign.abort;
var Read32 = foreign.Read32;
var Write32 = foreign.Write32;
var Read16 = foreign.Read16;
var Write16 = foreign.Write16;
var Read8 = foreign.Read8;
var Write8 = foreign.Write8;

var ERROR_SETFLAGS_LITTLE_ENDIAN = 0; // "Little endian is not supported"
var ERROR_SETFLAGS_CONTEXT_ID = 1; // "Context ID is not supported"
var ERROR_SETFLAGS_PREFIX = 2; // "exception prefix not supported"
var ERROR_SETFLAGS_DELAY_SLOT = 3; // "delay slot exception not supported"
var ERROR_SETSPR_DIRECT_INTERRUPT_EXCEPTION = 4; //Error in SetSPR: Direct triggering of interrupt exception not supported?
var ERROR_SETSPR_INTERRUPT_ADDRESS = 5; //Error in SetSPR: interrupt address not supported
var ERROR_SETSPR_TIMER_MODE_NOT_CONTINUOUS = 6; //"Error in SetSPR: Timer mode other than continuous not supported"
var ERROR_EXCEPTION_UNKNOWN = 7;        // "Error in Exception: exception type not supported"
var ERROR_UNKNOWN = 8;
var ERROR_ALL_CORES_IDLE = 9;

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
var SPR_COREID = 128; // Core ID
var SPR_NUMCORES = 129; // Number of Cores

// exception types and addresses
var EXCEPT_ITLBMISS = 0xA00; // instruction translation lookaside buffer miss
var EXCEPT_IPF = 0x400; // instruction page fault
var EXCEPT_RESET = 0x100; // reset the processor
var EXCEPT_DTLBMISS = 0x900; // data translation lookaside buffer miss
var EXCEPT_DPF = 0x300; // instruction page fault
var EXCEPT_BUSERR = 0x200; // wrong memory access
var EXCEPT_TICK = 0x500; // tick counter interrupt
var EXCEPT_INT = 0x800; // interrupt of external devices
var EXCEPT_SYSCALL = 0xC00; // syscall, jump into supervisor mode
var EXCEPT_TRAP = 0xE00; // trap


var r = new stdlib.Int32Array(heap); // registers
var f = new stdlib.Float32Array(heap); // registers

var h = new stdlib.Int32Array(heap);
var b = new stdlib.Uint8Array(heap);
var w = new stdlib.Uint16Array(heap);

var ncores = 4; // the total number of cores
var ncoresmask = 0xF; // bitfield of actives cores mask
var activebitfield = 0xF; // 1 bit for each core defines if it is active or not

var coreid = 0; // the currently active core.
var corep = 0x0; // the memory pointer to the core related structures

var rp = 0x0; // pointer to registers, not used
var ramp = 0x100000;

var group0p = 0x2000; // special purpose registers
var group1p = 0x4000; // data tlb registers
var group2p = 0x6000; // instruction tlb registers

// define variables and initialize

var pc = 0x0;
var ppc = 0;
var ppcorigin = 0;
var pcbase = -4; // helper variable to calculate the real pc
var fence = 0; // the ppc pointer to the next jump or page boundary

var delayedins = 0; // the current instruction is an delayed instruction, one cycle before a jump

var nextpc = 0x0; // pointer to the next instruction after the fence
var jump = 0x0; // in principle the jump variable should contain the same as nextpc.
                // But for delayed ins at page boundaries, this is taken as temporary
                // storage for nextpc
var delayedins_at_page_boundary = 0; //flag


// fast tlb lookup tables, invalidate
var instlblookup = -1;
var read32tlblookup = -1;
var read8stlblookup = -1;
var read8utlblookup = -1;
var read16stlblookup = -1;
var read16utlblookup = -1;
var write32tlblookup = -1;
var write8tlblookup = -1;
var write16tlblookup = -1;

var instlbcheck = -1;
var read32tlbcheck = -1;
var read8stlbcheck = -1;
var read8utlbcheck = -1;
var read16stlbcheck = -1;
var read16utlbcheck = -1;
var write32tlbcheck = -1;
var write8tlbcheck = -1;
var write16tlbcheck = -1;

var TTMRp = 0x100; // Tick timer mode register
var TTCRp = 0x104; // Tick timer count register

var PICMRp = 0x108; // interrupt controller mode register (use nmi)
var PICSRp = 0x10C; // interrupt controller set register
var raise_interruptp = 0x110;

var linkedaddrp = 0x114; // hidden register for atomic lwa and swa operation (linked address)


// flags
var SR_SM = 1; // supervisor mode
var SR_TEE = 0; // tick timer Exception Enabled
var SR_IEE = 0; // interrupt Exception Enabled
var SR_DCE = 0; // Data Cache Enabled
var SR_ICE = 0; // Instruction Cache Enabled
var SR_DME = 0; // Data MMU Enabled
var SR_IME = 0; // Instruction MMU Enabled
var SR_LEE = 0; // Little Endian Enabled
var SR_CE = 0; // CID Enabled ?
var SR_F = 0; // Flag for l.sf... instructions
var SR_CY = 0; // Carry Flag
var SR_OV = 0; // Overflow Flag
var SR_OVE = 0; // Overflow Flag Exception
var SR_DSX = 0; // Delay Slot Exception
var SR_EPH = 0; // Exception Prefix High
var SR_FO = 1; // Fixed One, always set
var SR_SUMRA = 0; // SPRS User Mode Read Access, or TRAP exception disable?
var SR_CID = 0x0; //Context ID

var boot_dtlb_misshandler_address = 0x0;
var boot_itlb_misshandler_address = 0x0;
var current_pgd = 0x0;

var snoopbitfield = 0x0; // fot atomic instructions

function Init(_ncores) {
    _ncores = _ncores|0;
    ncores = _ncores|0;
    if ((ncores|0) == 32)
        ncoresmask = 0xFFFFFFFF;
    else
        ncoresmask =  (1 << ncores)-1|0;
    AnalyzeImage();
    Reset();
}

function Reset() {
    var i = 0;
    activebitfield = ncoresmask; // all cores are active
    snoopbitfield = 0x0;

    for(i=0; (i|0)<(ncores|0); i=i+1|0) {
        h[corep + TTMRp >>2] = 0x0;
        h[corep + TTCRp >>2] = 0x0;
        h[corep + PICMRp >>2] = 0x3;
        h[corep + PICSRp >>2] = 0x0;

        h[corep + group0p+(SPR_IMMUCFGR<<2) >> 2] = 0x18; // 0 ITLB has one way and 64 sets
        h[corep + group0p+(SPR_DMMUCFGR<<2) >> 2] = 0x18; // 0 DTLB has one way and 64 sets
        h[corep + group0p+(SPR_ICCFGR<<2) >> 2] = 0x0//0x48;
        h[corep + group0p+(SPR_DCCFGR<<2) >> 2] = 0x0//0x48;
        h[corep + group0p+(SPR_VR<<2) >> 2] = 0x12000001;
        h[corep + group0p+(SPR_COREID<<2) >> 2] = coreid|0;
        h[corep + group0p+(SPR_NUMCORES<<2) >> 2] = 2|0;

        // UPR present
        // data mmu present
        // instruction mmu present
        // PIC present (architecture manual seems to be wrong here)
        // Tick timer present
        h[corep + group0p+(SPR_UPR<<2) >> 2] = 0x619;

        ppc = 0;
        ppcorigin = 0;
        pcbase = -4;
        Exception(EXCEPT_RESET, 0x0);

        ChangeCore();
    }
}

function ChangeCore()
{
    var newcoreid = 0;
    var i = 0;
    if ((ncores|0) == 1) return;

    newcoreid = coreid|0;
    if ((activebitfield|0) == 0) {   
         // All cpu are idle. This should never happen in this function.
         DebugMessage(ERROR_ALL_CORES_IDLE|0);
         abort();
     }

    // check if only one bit is set in bitfield
    if ((activebitfield & activebitfield-1) == 0) 
    if (activebitfield & (1<<coreid)) { // ceck if this one bit is the current core
        return; // nothing changed, so just return back
    }

    // find next core
    do {
        newcoreid = newcoreid + 1 | 0;
        if ((newcoreid|0) >= (ncores|0)) newcoreid = 0;
    } while(((activebitfield & (1<<newcoreid))) == 0)

    if ((newcoreid|0) == (coreid|0)) return; // nothing changed, so just return back

    h[corep + 0x120 >>2] = GetFlags()|0;
    h[corep + 0x124 >>2] = pc;
    h[corep + 0x128 >>2] = ppc;
    h[corep + 0x12C >>2] = ppcorigin;
    h[corep + 0x130 >>2] = pcbase;
    h[corep + 0x134 >>2] = fence;
    h[corep + 0x138 >>2] = nextpc;
    h[corep + 0x13C >>2] = jump;
    h[corep + 0x190 >>2] = delayedins;
    h[corep + 0x194 >>2] = delayedins_at_page_boundary;


    h[corep + 0x140 >>2] = instlblookup;
    h[corep + 0x144 >>2] = read32tlblookup;
    h[corep + 0x148 >>2] = read8stlblookup;
    h[corep + 0x14C >>2] = read8utlblookup;
    h[corep + 0x150 >>2] = read16stlblookup;
    h[corep + 0x154 >>2] = read16utlblookup;
    h[corep + 0x158 >>2] = write32tlblookup;
    h[corep + 0x15C >>2] = write8tlblookup;
    h[corep + 0x160 >>2] = write16tlblookup;
    h[corep + 0x164 >>2] = instlbcheck;
    h[corep + 0x168 >>2] = read32tlbcheck;
    h[corep + 0x16C >>2] = read8stlbcheck;
    h[corep + 0x170 >>2] = read8utlbcheck;
    h[corep + 0x174 >>2] = read16stlbcheck;
    h[corep + 0x178 >>2] = read16utlbcheck;
    h[corep + 0x17C >>2] = write32tlbcheck;
    h[corep + 0x180 >>2] = write8tlbcheck;
    h[corep + 0x184 >>2] = write16tlbcheck;

    coreid = newcoreid|0;
    corep = coreid << 15;

    SetFlagsQuiet(h[corep + 0x120 >>2]|0);
    pc          = h[corep + 0x124 >>2]|0;
    ppc         = h[corep + 0x128 >>2]|0;
    ppcorigin   = h[corep + 0x12C >>2]|0;
    pcbase      = h[corep + 0x130 >>2]|0;
    fence       = h[corep + 0x134 >>2]|0;
    nextpc      = h[corep + 0x138 >>2]|0;
    jump        = h[corep + 0x13C >>2]|0;
    delayedins  = h[corep + 0x190 >>2]|0;
    delayedins_at_page_boundary  = h[corep + 0x194 >>2]|0;

    instlblookup     = h[corep + 0x140 >>2]|0;
    read32tlblookup  = h[corep + 0x144 >>2]|0;
    read8stlblookup  = h[corep + 0x148 >>2]|0;
    read8utlblookup  = h[corep + 0x14C >>2]|0;
    read16stlblookup = h[corep + 0x150 >>2]|0;
    read16utlblookup = h[corep + 0x154 >>2]|0;
    write32tlblookup = h[corep + 0x158 >>2]|0;
    write8tlblookup  = h[corep + 0x15C >>2]|0;
    write16tlblookup = h[corep + 0x160 >>2]|0;
    instlbcheck      = h[corep + 0x164 >>2]|0;
    read32tlbcheck   = h[corep + 0x168 >>2]|0;
    read8stlbcheck   = h[corep + 0x16C >>2]|0;
    read8utlbcheck   = h[corep + 0x170 >>2]|0;
    read16stlbcheck  = h[corep + 0x174 >>2]|0;
    read16utlbcheck  = h[corep + 0x178 >>2]|0;
    write32tlbcheck  = h[corep + 0x17C >>2]|0;
    write8tlbcheck   = h[corep + 0x180 >>2]|0;
    write16tlbcheck  = h[corep + 0x184 >>2]|0;
}

function InvalidateTLB() {
    instlblookup = -1;
    read32tlblookup = -1;
    read8stlblookup = -1;
    read8utlblookup = -1;
    read16stlblookup = -1;
    read16utlblookup = -1;
    write32tlblookup = -1;
    write8tlblookup = -1;
    write16tlblookup = -1;
    instlbcheck = -1;
    read32tlbcheck = -1;
    read8stlbcheck = -1;
    read8utlbcheck = -1;
    read16stlbcheck = -1;
    read16utlbcheck = -1;
    write32tlbcheck = -1;
    write8tlbcheck = -1;
    write16tlbcheck = -1;
}

// ------------------------------------------

// Timer functions

function TimerSetInterruptFlag(coreid) {
    coreid = coreid|0;
    activebitfield = activebitfield | (1 << coreid);
    h[(coreid<<15) + TTMRp >>2] = (h[(coreid<<15) + TTMRp >>2]|0) | (1 << 28);
}

// this function checks also if the interrupt is on. Otherwise the check is useless.
// the timer is running anyhow on smp machines all the time
function TimerIsRunning(coreid) {
    coreid = coreid|0;
    var ret = 0;
    ret = (h[(coreid<<15) + TTMRp >> 2] >> 29)?1:0;
    return ret|0;
}

function TimerGetTicksToNextInterrupt(coreid) {
    coreid = coreid|0;
    var delta = 0;
    delta = (h[(coreid<<15) + TTMRp >>2] & 0xFFFFFFF) - (h[TTCRp >>2] & 0xFFFFFFF) |0;
    return delta|0;
}

function GetTimeToNextInterrupt() {
    var wait = 0xFFFFFFF;
    var delta = 0x0;
    var i = 0;
    for(i=0; (i|0)<(ncores|0); i = i+1|0) {
        if (!(TimerIsRunning(i)|0)) continue;
        delta = TimerGetTicksToNextInterrupt(i)|0;
        if ((delta|0) < (wait|0)) wait = delta|0;
    }
    return wait|0;
}

function ProgressTime(delta) {
    delta = delta|0;
    var i = 0;
    h[TTCRp >>2] = (h[TTCRp >>2]|0) + delta|0;
/*
    // wake up at least one core
    activebitfield = activebitfield | (1<<coreid);
    // wake up the cores closest to zero
    for(i=0; (i|0)<(ncores|0); i = i+1|0) {
        delta = TimerGetTicksToNextInterrupt(i)|0;
        if ((delta|0) <= 64) {
            activebitfield = activebitfield | (1<<i);
        }
    }
*/
    // wake up all cores
    activebitfield = ncoresmask;
}

function GetTicks() {
    return (h[TTCRp >>2] & 0xFFFFFFF)|0;
}


// ------------------------------------------

function AnalyzeImage() { // get addresses for fast refill
    boot_dtlb_misshandler_address = h[ramp+0x900 >> 2]|0;
    boot_itlb_misshandler_address = h[ramp+0xA00 >> 2]|0;
    current_pgd = ((h[ramp+0x2010 >> 2]&0xFFF)<<16) | (h[ramp+0x2014 >> 2] & 0xFFFF)|0;
}

function SetFlagsQuiet(x) {
    x = x|0;
    SR_SM = (x & (1 << 0));
    SR_TEE = (x & (1 << 1));
    SR_IEE = (x & (1 << 2));
    SR_DCE = (x & (1 << 3));
    SR_ICE = (x & (1 << 4));
    SR_DME = (x & (1 << 5));
    SR_IME = (x & (1 << 6));
    SR_LEE = (x & (1 << 7));
    SR_CE = (x & (1 << 8));
    SR_F = (x & (1 << 9));
    SR_CY = (x & (1 << 10));
    SR_OV = (x & (1 << 11));
    SR_OVE = (x & (1 << 12));
    SR_DSX = (x & (1 << 13));
    SR_EPH = (x & (1 << 14));
    SR_FO = 1;
    SR_SUMRA = (x & (1 << 16));
    SR_CID = (x >> 28) & 0xF;
}

function SetFlags(x) {
    x = x|0;
    var old_SR_IEE = 0;
    old_SR_IEE = SR_IEE;
    SetFlagsQuiet(x);

    if (SR_LEE) {
        DebugMessage(ERROR_SETFLAGS_LITTLE_ENDIAN|0);
        abort();
    }
    if (SR_CID) {
        DebugMessage(ERROR_SETFLAGS_CONTEXT_ID|0);
        abort();
    }
    if (SR_EPH) {
        DebugMessage(ERROR_SETFLAGS_PREFIX|0);
        abort();
    }
    if (SR_DSX) {
        DebugMessage(ERROR_SETFLAGS_DELAY_SLOT|0);
        abort();
    }
    if (SR_IEE) {
        if ((old_SR_IEE|0) == (0|0)) {
            CheckForInterrupt(coreid);
        }
    }
}

function GetFlags() {
    var x = 0x0;
    x = x | (SR_SM ? (1 << 0) : 0);
    x = x | (SR_TEE ? (1 << 1) : 0);
    x = x | (SR_IEE ? (1 << 2) : 0);
    x = x | (SR_DCE ? (1 << 3) : 0);
    x = x | (SR_ICE ? (1 << 4) : 0);
    x = x | (SR_DME ? (1 << 5) : 0);
    x = x | (SR_IME ? (1 << 6) : 0);
    x = x | (SR_LEE ? (1 << 7) : 0);
    x = x | (SR_CE ? (1 << 8) : 0);
    x = x | (SR_F ? (1 << 9) : 0);
    x = x | (SR_CY ? (1 << 10) : 0);
    x = x | (SR_OV ? (1 << 11) : 0);
    x = x | (SR_OVE ? (1 << 12) : 0);
    x = x | (SR_DSX ? (1 << 13) : 0);
    x = x | (SR_EPH ? (1 << 14) : 0);
    x = x | (SR_FO ? (1 << 15) : 0);
    x = x | (SR_SUMRA ? (1 << 16) : 0);
    x = x | (SR_CID << 28);
    return x|0;
}

function CheckForInterrupt(coreid) {
    coreid = coreid|0;
    var flags = 0;
    // save current flags
    h[corep + 0x120 >> 2] = GetFlags()|0;

    flags = h[(coreid<<15) + 0x120 >> 2]|0;
    if (flags & (1<<2)) { // check for SR_IEE
        if (h[(coreid<<15) + PICMRp >> 2] & h[(coreid<<15) + PICSRp >>2]) {
            activebitfield = activebitfield | (1 << coreid);
            h[(coreid<<15) + raise_interruptp >> 2] = 1;
        }
    }
}

function RaiseInterrupt(line, coreid) {
    line = line|0;
    coreid = coreid|0;
    var i = 0;
    var lmask = 0;
    var picp = 0;
    lmask = (1 << line)|0;

    if ((coreid|0) == -1) { // raise all interrupt lines
        for(i=0; (i|0)<(ncores|0); i=i+1|0) {
            picp = (i<<15) + PICSRp | 0;
            h[picp >> 2] = (h[picp >> 2]|0) | lmask;
            CheckForInterrupt(i);
        }
    } else {
        picp = (coreid<<15) + PICSRp | 0;
        h[picp >> 2] = (h[picp >> 2]|0) | lmask;
        CheckForInterrupt(coreid);
    }
}

function ClearInterrupt(line, coreid) {
    line = line|0;
    coreid = coreid|0;
    var i = 0;
    var lmask = 0;
    var picp = 0;
    lmask = (1 << line)|0;
    if ((coreid|0) == -1) { // clear all interrupt lines
        for(i=0; (i|0)<(ncores|0); i=i+1|0) {
            picp = (i<<15) + PICSRp | 0;
            h[picp >> 2] = h[picp >> 2] & (~lmask);
        }
    } else {
        picp = (coreid<<15) + PICSRp | 0;
        h[picp >> 2] = h[picp >> 2] & (~lmask);
    }



}

function SetSPR(idx, x) {
    idx = idx|0;
    x = x|0;
    var address = 0;
    var group = 0;
    address = (idx & 0x7FF);
    group = (idx >> 11) & 0x1F;

    switch (group|0) {
    case 0:
        if ((address|0) == (SPR_SR|0)) {
            SetFlags(x);
        }
        h[corep + group0p+(address<<2) >> 2] = x;
        break;
    case 1:
        // Data MMU
        h[corep + group1p+(address<<2) >> 2] = x;
        break;
    case 2:
        // ins MMU
        h[corep + group2p+(address<<2) >> 2] = x;
        break;
    case 3:
        // data cache, not supported
    case 4:
        // ins cache, not supported
        break;
    case 8:
        activebitfield = activebitfield & (~(1 << coreid));
        break;
    case 9:
        // pic
        switch (address|0) {
        case 0:
            h[corep + PICMRp >>2] = x | 0x3; // the first two interrupts are non maskable
            // check immediately for interrupt
            if (SR_IEE) {
                if (h[corep + PICMRp >>2] & h[corep + PICSRp >>2]) {
                    DebugMessage(ERROR_SETSPR_DIRECT_INTERRUPT_EXCEPTION|0);
                    abort();
                }
            }
            break;
        case 2: // PICSR
            break;
        default:
            DebugMessage(ERROR_SETSPR_INTERRUPT_ADDRESS|0);
            abort();
        }
        break;
    case 10:
        //tick timer
        switch (address|0) {
        case 0:
            h[corep + TTMRp >> 2] = x|0;
            if (((h[corep + TTMRp >> 2] >> 30)&3) != 0x3) {
                DebugMessage(ERROR_SETSPR_TIMER_MODE_NOT_CONTINUOUS|0);
                abort();
            }
            break;
        case 1:
            //h[TTCRp >>2] = x|0; // already in sync. Don't allow to change
            break;
        default:
            //DebugMessage("Error in SetSPR: Tick timer address not supported");
            DebugMessage(ERROR_UNKNOWN|0);
            abort();
            break;
        }
        break;

    default:
        DebugMessage(ERROR_UNKNOWN|0);
        abort();
        break;
    }
};

function GetSPR(idx) {
    idx = idx|0;
    var address = 0;
    var group = 0;
    address = idx & 0x7FF;
    group = (idx >> 11) & 0x1F;
    switch (group|0) {
    case 0:
        if ((address|0) == (SPR_SR|0)) {
            return GetFlags()|0;
        }
        return h[corep + group0p+(address<<2) >> 2]|0;
    case 1:
        return h[corep + group1p+(address<<2) >> 2]|0;
    case 2:
        return h[corep + group2p+(address<<2) >> 2]|0;
    case 8:
        return 0x0;
    case 9:
        // pic
        switch (address|0) {
        case 0:
            return h[corep + PICMRp >>2]|0;
        case 2:
            return h[corep + PICSRp >>2]|0;
        default:
            //DebugMessage("Error in GetSPR: PIC address unknown");
            DebugMessage(ERROR_UNKNOWN|0);
            abort();
            break;
        }
        break;

    case 10:
        // tick Timer
        switch (address|0) {
        case 0:
            return h[corep + TTMRp >>2]|0;
        case 1:
            return h[TTCRp >>2]|0;
        default:
            DebugMessage(ERROR_UNKNOWN|0);
            //DebugMessage("Error in GetSPR: Tick timer address unknown");
            abort();
            break;
        }
        break;
    default:
        DebugMessage(ERROR_UNKNOWN|0);
        //DebugMessage("Error in GetSPR: group unknown");
        abort();
        break;
    }
    return 0|0;
}

function Exception(excepttype, addr) {
    excepttype = excepttype|0;
    addr = addr|0;
    var except_vector = 0;
    except_vector = excepttype | (SR_EPH ? 0xf0000000 : 0x0);

    activebitfield = activebitfield | (1 << coreid);

    SetSPR(SPR_EEAR_BASE, addr);
    SetSPR(SPR_ESR_BASE, GetFlags()|0);

    SR_OVE = 0;
    SR_SM = 1;
    SR_IEE = 0;
    SR_TEE = 0;
    SR_DME = 0;

    instlblookup = 0;
    read32tlblookup = 0;
    read8stlblookup = 0;
    read8utlblookup = 0;
    read16stlblookup = 0;
    read16utlblookup = 0;
    write32tlblookup = 0;
    write8tlblookup = 0;
    write16tlblookup = 0;
    instlbcheck = 0;
    read32tlbcheck = 0;
    read8utlbcheck = 0;
    read8stlbcheck = 0;
    read16utlbcheck = 0;
    read16stlbcheck = 0;
    write32tlbcheck = 0;
    write8tlbcheck = 0;
    write16tlbcheck = 0;

    fence = ppc|0;
    nextpc = except_vector;

    switch (excepttype|0) {

    case 0x100: // EXCEPT_RESET
        break;

    case 0x300: // EXCEPT_DPF
    case 0x900: // EXCEPT_DTLBMISS
    case 0xE00: // EXCEPT_TRAP
    case 0x200: // EXCEPT_BUSERR
        pc = pcbase + ppc|0;
        SetSPR(SPR_EPCR_BASE, pc - (delayedins ? 4 : 0)|0);
        break;

    case 0xA00: // EXCEPT_ITLBMISS
    case 0x400: // EXCEPT_IPF
    case 0x500: // EXCEPT_TICK
    case 0x800: // EXCEPT_INT
        // per definition, the pc must be valid here
        SetSPR(SPR_EPCR_BASE, pc - (delayedins ? 4 : 0)|0);
        break;

    case 0xC00: // EXCEPT_SYSCALL
        pc = pcbase + ppc|0;
        SetSPR(SPR_EPCR_BASE, pc + 4 - (delayedins ? 4 : 0)|0);
        break;

    default:
        DebugMessage(ERROR_EXCEPTION_UNKNOWN|0);
        abort();
    }
    delayedins = 0;
    SR_IME = 0;
    h[corep + linkedaddrp >> 2] = -1;
    snoopbitfield = snoopbitfield & (~(1<<coreid));
}


// disassembled dtlb miss exception handler arch/openrisc/kernel/head.S, kernel dependent
function DTLBRefill(addr, nsets) {
    addr = addr|0;
    nsets = nsets|0;
    var r2 = 0;
    var r3 = 0;
    var r4 = 0;
    var r5 = 0;
    if ((h[ramp+0x900 >> 2]|0) == (boot_dtlb_misshandler_address|0)) {
        Exception(EXCEPT_DTLBMISS, addr);
        return 0|0;
    }
    r2 = addr;
    // get_current_PGD  using r3 and r5 
    r3 = h[ramp + current_pgd + (coreid<<2) >> 2]|0; // current pgd
    r4 = (r2 >>> 0x18) << 2;
    r5 = r4 + r3|0;

    r4 = (0x40000000 + r5) & 0xFFFFFFFF; //r4 = phys(r5)

    r3 = h[ramp+r4 >> 2]|0;

    if ((r3|0) == 0) {
        Exception(EXCEPT_DPF, addr);
        return 0|0;
        // abort();
        // d_pmd_none:
        // page fault
    }

    //r3 = r3 & ~PAGE_MASK // 0x1fff // sense? delayed jump???
    r3 = 0xffffe000;
    // d_pmd_good:

    r4 = h[ramp+r4 >> 2]|0; // get pmd value
    r4 = r4 & r3; // & PAGE_MASK
    r5 = r2 >>> 0xD;
    r3 = r5 & 0x7FF;
    r3 = r3 << 0x2;
    r3 = r3 + r4|0;
    r2 = h[ramp+r3 >> 2]|0;

    if ((r2 & 1) == 0) {
        Exception(EXCEPT_DPF, addr);
        return 0|0;
        //d_pmd_none:
        //page fault
    }
    //r3 = 0xFFFFe3fa; // PAGE_MASK | DTLB_UP_CONVERT_MASK

    // fill dtlb tr register
    r4 = r2 & 0xFFFFe3fa;
    //r6 = (group0[SPR_DMMUCFGR] & 0x1C) >>> 0x2;
    //r3 = 1 << r6; // number of DMMU sets
    //r6 = r3 - 1; // mask register
    //r5 &= r6;
    r5 = r5 & (nsets - 1);
    h[corep + group1p+((0x280 | r5)<<2) >> 2] = r4;
    //SPR_DTLBTR_BASE(0)|r5 = r4 // SPR_DTLBTR_BASE = 0x280 * (WAY*0x100)

    // fill DTLBMR register
    r2 = addr;
    r4 = r2 & 0xFFFFE000;
    r4 = r4 | 0x1;
    h[corep + group1p+((0x200 | r5)<<2) >> 2] = r4;
    // SPR_DTLBMR_BASE(0)|r5 = r4  // SPR_DTLBMR_BASE = 0x200 * (WAY*0x100)
    return 1|0;
}

// disassembled itlb miss exception handler arch/openrisc/kernel/head.S, kernel dependent
function ITLBRefill(addr, nsets) {
    addr = addr|0;
    nsets = nsets|0;
    var r2 = 0;
    var r3 = 0;
    var r4 = 0;
    var r5 = 0;
    if ((h[ramp+0xA00 >> 2]|0) == (boot_itlb_misshandler_address|0)) {
        Exception(EXCEPT_ITLBMISS, addr);
        return 0|0;
    }

    r2 = addr;
    // get_current_PGD  using r3 and r5
    r3 = h[ramp+current_pgd + (coreid<<2) >> 2]|0; // current pgd
    r4 = (r2 >>> 0x18) << 2;
    r5 = r4 + r3|0;

    r4 = (0x40000000 + r5) & 0xFFFFFFFF; //r4 = phys(r5)
    r3 = h[ramp+r4 >> 2]|0;

    if ((r3|0) == 0) {
        Exception(EXCEPT_IPF, addr);
        return 0|0;
        // d_pmd_none:
        // page fault
    }

    //r3 = r3 & ~PAGE_MASK // 0x1fff // sense? delayed jump???
    r3 = 0xffffe000; // or 0xffffe3fa ??? PAGE_MASK
    //i_pmd_good:

    r4 = h[ramp+r4 >> 2]|0; // get pmd value
    r4 = r4 & r3; // & PAGE_MASK
    r5 = r2 >>> 0xD;
    r3 = r5 & 0x7FF;
    r3 = r3 << 0x2;
    r3 = r3 + r4|0;
    r2 = h[ramp+r3 >> 2]|0;

    if ((r2 & 1) == 0) {
        Exception(EXCEPT_IPF, addr);
        return 0|0;
        //d_pmd_none:
        //page fault
    }
    //r3 = 0xFFFFe03a; // PAGE_MASK | ITLB_UP_CONVERT_MASK

    // fill dtlb tr register
    r4 = r2 & 0xFFFFe03a; // apply the mask
    r3 = r2 & 0x7c0; // PAGE_EXEC, Page_SRE, PAGE_SWE, PAGE_URE, PAGE_UWE

    if ((r3|0) != 0x0) {
        //not itlb_tr_fill....
        //r6 = (group0[SPR_IMMUCFGR] & 0x1C) >>> 0x2;
        //r3 = 1 << r6; // number of DMMU sets
        //r6 = r3 - 1; // mask register
        //r5 &= r6;
        r5 = r5 & (nsets - 1);
        //itlb_tr_fill_workaround:
        r4 = r4 | 0xc0; // SPR_ITLBTR_UXE | ITLBTR_SXE
    }
    // itlb_tr_fill:

    h[corep + group2p + ((0x280 | r5)<<2) >> 2] = r4; // SPR_ITLBTR_BASE(0)|r5 = r4 // SPR_ITLBTR_BASE = 0x280 * (WAY*0x100)

    //fill ITLBMR register
    r2 = addr;
    // r3 = 
    r4 = r2 & 0xFFFFE000;
    r4 = r4 | 0x1;
    h[corep + group2p + ((0x200 | r5)<<2) >> 2] = r4; // SPR_DTLBMR_BASE(0)|r5 = r4  // SPR_DTLBMR_BASE = 0x200 * (WAY*0x100)
    return 1|0;
}

function DTLBLookup(addr, write) {
    addr = addr|0;
    write = write|0;
    var setindex = 0;
    var tlmbr = 0;
    var tlbtr = 0;
    if (!SR_DME) {
        return addr|0;
    }
    // pagesize is 8192 bytes
    // nways are 1
    // nsets are 64

    setindex = (addr >> 13) & 63; // check these values
    tlmbr = h[corep + group1p + ((0x200 | setindex) << 2) >> 2]|0; // match register

    if ((tlmbr & 1) == 0) {
        // use tlb refill to fasten up
        if (DTLBRefill(addr, 64)|0) {
            tlmbr = h[corep + group1p + (0x200 + setindex << 2) >> 2]|0;
        } else {
            return -1|0;
        }
        // slow version
        // Exception(EXCEPT_DTLBMISS, addr);
        // return -1;
    }
    if ((tlmbr >> 19) != (addr >> 19)) {
        // use tlb refill to fasten up
        if (DTLBRefill(addr, 64)|0) {
            tlmbr = h[corep + group1p + (0x200 + setindex << 2) >> 2]|0;
        } else {
            return -1|0;
        }
        // slow version
        // Exception(EXCEPT_DTLBMISS, addr);
        // return -1;
    }

    /* skipped this check
        // set lru 
        if (tlmbr & 0xC0) {
            DebugMessage("Error: LRU ist not supported");
            abort();
        }
    */
    tlbtr = h[corep + group1p + ((0x280 | setindex)<<2) >> 2]|0; // translate register

    // Test for page fault
    // Skip this to be faster

    // check if supervisor mode
    if (SR_SM) {
        if (!write) {
            if (!(tlbtr & 0x100)) {
                Exception(EXCEPT_DPF, addr);
                return -1|0;
            }
        } else {
            if (!(tlbtr & 0x200))
            {
                Exception(EXCEPT_DPF, addr);
                return -1|0;
            }
        }
    } else {
        if (!write) {
            if (!(tlbtr & 0x40)) {
                Exception(EXCEPT_DPF, addr);
                return -1|0;
            }
        } else {
            if (!(tlbtr & 0x80))
            {
                Exception(EXCEPT_DPF, addr);
                return -1|0;
            }
        }
    }
    return ((tlbtr & 0xFFFFE000) | (addr & 0x1FFF))|0;
}


function Step(steps, clockspeed) {
    steps = steps|0;
    clockspeed = clockspeed|0;
    var ins = 0x0;
    var imm = 0x0;
    var i = 0;
    var rindex = 0x0;
    var rA = 0x0,
        rB = 0x0,
        rD = 0x0;
    var vaddr = 0x0; // virtual address
    var paddr = 0x0; // physical address

    var changecorecounter = 0;

    // to get the instruction
    var setindex = 0x0;
    var tlmbr = 0x0;
    var tlbtr = 0x0;
    var delta = 0x0;

    var dsteps = 0; // small counter

// -----------------------------------------------------
    for(;;) {

        // --------- START FENCE ---------
        if ((ppc|0) == (fence|0)) {
            pc = nextpc;

            if ((!delayedins_at_page_boundary|0)) {
                delayedins = 0;
            }

            dsteps = dsteps - ((ppc - ppcorigin) >> 2)|0;

            // do this not so often
            if ((dsteps|0) <= 0)
            if (!(delayedins_at_page_boundary|0)) { // for now. Not sure if we need this check
                dsteps = dsteps + 64|0;
                steps = steps - 64|0;

                // --------- START TICK ---------
                for(i=0; (i|0)<(ncores|0); i = i + 1|0) {
                    if (!(TimerIsRunning(i)|0)) continue;
                    delta = TimerGetTicksToNextInterrupt(i)|0;
                    if ((delta|0) < (clockspeed|0)) {
                        TimerSetInterruptFlag(i);
                    }
                }

                // the timer is always enabled on smp systems
                h[TTCRp >> 2] = ((h[TTCRp >> 2]|0) + clockspeed|0);
                // ---------- END TICK ----------

                if ((steps|0) < 0) return 0x0; // return to main loop
            }

            // check for any interrupts
            // SR_TEE is set or cleared at the same time as SR_IEE in Linux, so skip this check
            if (SR_IEE|0) {
                if (h[corep + raise_interruptp >> 2]|0) {
                    h[corep + raise_interruptp >> 2] = 0;
                    Exception(EXCEPT_INT, h[corep + group0p + (SPR_EEAR_BASE<<2) >> 2]|0);
                    // treat exception directly here
                    pc = nextpc;
                } else
                if (h[corep + TTMRp >> 2] & (1 << 28)) {
                    Exception(EXCEPT_TICK, h[corep + group0p + (SPR_EEAR_BASE<<2) >> 2]|0);
                    // treat exception directly here
                    pc = nextpc;
                }
            }

            // Get instruction pointer
            if ((instlbcheck ^ pc) & 0xFFFFE000) // short check if it is still the correct page
            {
                instlbcheck = pc; // save the new page, lower 11 bits are ignored
                if (!SR_IME) {
                    instlblookup = 0x0;
                } else {
                    setindex = (pc >> 13) & 63; // check this values
                    tlmbr = h[corep + group2p + ((0x200 | setindex) << 2) >> 2]|0;
                    // test if tlmbr is valid
                    if ((tlmbr & 1) == 0) {
                        if (ITLBRefill(pc, 64)|0) {
                            tlmbr = h[corep + group2p + ((0x200 | setindex)<<2) >> 2]|0; // reload the new value
                        } else {
                            // just make sure he doesn't count this 'continue' as steps
                            ppcorigin = ppc;
                            delayedins_at_page_boundary = 0;
                            continue;
                        }
                    }
                    if ((tlmbr >> 19) != (pc >> 19)) {
                        if (ITLBRefill(pc, 64)|0) {
                            tlmbr = h[corep + group2p + ((0x200 | setindex)<<2) >> 2]|0; // reload the new value
                        } else {
                            // just make sure he doesn't count this 'continue' as steps
                            ppcorigin = ppc;
                            delayedins_at_page_boundary = 0;
                            continue;
                        }
                    }
                    tlbtr = h[corep + group2p + ((0x280 | setindex) << 2) >> 2]|0;
                    instlblookup = ((tlbtr ^ tlmbr) >> 13) << 13;
                }
            }

            // set pc and set the correcponding physical pc pointer
            //pc = pc;
            ppc = ramp + (instlblookup ^ pc)|0;
            ppcorigin = ppc;
            pcbase = pc - 4 - ppcorigin|0;

           if (delayedins_at_page_boundary|0) {
               delayedins_at_page_boundary = 0;
               fence = ppc + 4|0;
               nextpc = jump;
           } else {
               fence  = ((ppc >> 13) + 1) << 13; // next page
               nextpc = ((pc  >> 13) + 1) << 13;
           }

           changecorecounter = changecorecounter + 1|0;
           if ((changecorecounter&7) == 0) {
               ChangeCore();
               continue;
           }

        } 
        // ---------- END FENCE ----------

        ins = h[ppc >> 2]|0;
        ppc = ppc + 4|0;

// --------------------------------------------

        switch ((ins >> 26)&0x3F) {
        case 0x0:
            // j
            pc = pcbase + ppc|0;
            jump = pc + ((ins << 6) >> 4)|0;
            if ((fence|0) == (ppc|0)) { // delayed instruction directly at page boundary
                delayedins_at_page_boundary = 1;
            } else {
                fence = ppc + 4|0;
                nextpc = jump|0;
            }
            delayedins = 1;
            break;

        case 0x1:
            // jal
            pc = pcbase + ppc|0;
            jump = pc + ((ins << 6) >> 4)|0;
            r[corep + (9<<2) >> 2] = pc + 8|0;
            if ((fence|0) == (ppc|0)) { // delayed instruction directly at page boundary
                delayedins_at_page_boundary = 1;
            } else {
                fence = ppc + 4|0;
                nextpc = jump|0;
            }
            delayedins = 1;
            break;

        case 0x3:
            // bnf
            if (SR_F) {
                break;
            }
            pc = pcbase + ppc|0;
            jump = pc + ((ins << 6) >> 4)|0;
            if ((fence|0) == (ppc|0)) { // delayed instruction directly at page boundary
                delayedins_at_page_boundary = 1;
            } else {
                fence = ppc + 4|0;
                nextpc = jump|0;
            }
            delayedins = 1;
            break;

        case 0x4:
            // bf
            if (!SR_F) {
                break;
            }
            pc = pcbase + ppc|0;
            jump = pc + ((ins << 6) >> 4)|0;
            if ((fence|0) == (ppc|0)) { // delayed instruction directly at page boundary
                delayedins_at_page_boundary = 1;
            } else {
                fence = ppc + 4|0;
                nextpc = jump|0;
            }
            delayedins = 1;
            break;

        case 0x5:
            // nop
            break;

        case 0x6:
            // movhi
            rindex = (ins >> 21) & 0x1F;
            r[corep + (rindex << 2) >> 2] = ((ins & 0xFFFF) << 16); // movhi
            break;

        case 0x8:
            //sys and trap
            if ((ins&0xFFFF0000) == 0x21000000) {
                Exception(EXCEPT_TRAP, h[corep + group0p+SPR_EEAR_BASE >> 2]|0);
            } else {
                Exception(EXCEPT_SYSCALL, h[corep + group0p+SPR_EEAR_BASE >> 2]|0);
            }
            break;

        case 0x9:
            // rfe
            jump = GetSPR(SPR_EPCR_BASE)|0;
            InvalidateTLB();
            fence = ppc;
            nextpc = jump;
            //pc = jump; // set the correct pc in case of an EXCEPT_INT
            //delayedins = 0;
            SetFlags(GetSPR(SPR_ESR_BASE)|0); // could raise an exception
            break;

        case 0x11:
            // jr
            jump = r[corep + ((ins >> 9) & 0x7C)>>2]|0;
            if ((fence|0) == (ppc|0)) { // delayed instruction directly at page boundary
                delayedins_at_page_boundary = 1;
            } else {
                fence = ppc + 4|0;
                nextpc = jump|0;
            }
            delayedins = 1;
            break;

        case 0x12:
            // jalr
            pc = pcbase + ppc|0;
            jump = r[corep + ((ins >> 9) & 0x7C)>>2]|0;
            r[corep + (9<<2) >> 2] = pc + 8|0;
            if ((fence|0) == (ppc|0)) { // delayed instruction directly at page boundary
                delayedins_at_page_boundary = 1;
            } else {
                fence = ppc + 4|0;
                nextpc = jump|0;
            }
            delayedins = 1;
            break;

        case 0x1B: 
            // lwa
            vaddr = (r[corep + ((ins >> 14) & 0x7C) >> 2]|0) + ((ins << 16) >> 16)|0;
            if ((read32tlbcheck ^ vaddr) >> 13) {
                paddr = DTLBLookup(vaddr, 0)|0;
                if ((paddr|0) == -1) {
                    break;
                }
                read32tlbcheck = vaddr;
                read32tlblookup = ((paddr^vaddr) >> 13) << 13;
            }
            paddr = read32tlblookup ^ vaddr;
            snoopbitfield = snoopbitfield | (1<<coreid);
            h[corep + linkedaddrp >>2] = paddr;
            r[corep + ((ins >> 19) & 0x7C)>>2] = (paddr|0)>0?h[ramp+paddr >> 2]|0:Read32(paddr|0)|0;
            break;

        case 0x21:
            // lwz
            vaddr = (r[corep + ((ins >> 14) & 0x7C) >> 2]|0) + ((ins << 16) >> 16)|0;
            if ((read32tlbcheck ^ vaddr) >> 13) {
                paddr = DTLBLookup(vaddr, 0)|0;
                if ((paddr|0) == -1) {
                    break;
                }
                read32tlbcheck = vaddr;
                read32tlblookup = ((paddr^vaddr) >> 13) << 13;
            }
            paddr = read32tlblookup ^ vaddr;
            r[corep + ((ins >> 19) & 0x7C)>>2] = (paddr|0)>0?h[ramp+paddr >> 2]|0:Read32(paddr|0)|0;
            break;

        case 0x23:
            // lbz
            vaddr = (r[corep + ((ins >> 14) & 0x7C)>>2]|0) + ((ins << 16) >> 16)|0;
            if ((read8utlbcheck ^ vaddr) >> 13) {
                paddr = DTLBLookup(vaddr, 0)|0;
                if ((paddr|0) == -1) {
                    break;
                }
                read8utlbcheck = vaddr;
                read8utlblookup = ((paddr^vaddr) >> 13) << 13;
            }
            paddr = read8utlblookup ^ vaddr;
            if ((paddr|0) >= 0) {
                r[corep + ((ins >> 19) & 0x7C)>>2] = b[ramp + (paddr ^ 3)|0]|0;
            } else {
                r[corep + ((ins >> 19) & 0x7C)>>2] = Read8(paddr|0)|0;
            }
            break;

        case 0x24:
            // lbs 
            vaddr = (r[corep + ((ins >> 14) & 0x7C)>>2]|0) + ((ins << 16) >> 16)|0;
            if ((read8stlbcheck ^ vaddr) >> 13) {
                paddr = DTLBLookup(vaddr, 0)|0;
                if ((paddr|0) == -1) {
                    break;
                }
                read8stlbcheck = vaddr;
                read8stlblookup = ((paddr^vaddr) >> 13) << 13;
            }
            paddr = read8stlblookup ^ vaddr;
            if ((paddr|0) >= 0) {
                r[corep + ((ins >> 19) & 0x7C)>>2] = (b[ramp + (paddr ^ 3)|0] << 24) >> 24;
            } else {
                r[corep + ((ins >> 19) & 0x7C)>>2] = ((Read8(paddr|0)|0) << 24) >> 24;
            }
            break;

        case 0x25:
            // lhz 
            vaddr = (r[corep + ((ins >> 14) & 0x7C)>>2]|0) + ((ins << 16) >> 16)|0;
            if ((read16utlbcheck ^ vaddr) >> 13) {
                paddr = DTLBLookup(vaddr, 0)|0;
                if ((paddr|0) == -1) {
                    break;
                }
                read16utlbcheck = vaddr;
                read16utlblookup = ((paddr^vaddr) >> 13) << 13;
            }
            paddr = read16utlblookup ^ vaddr;
            if ((paddr|0) >= 0) {
                r[corep + ((ins >> 19) & 0x7C)>>2] = w[ramp + (paddr ^ 2) >> 1];
            } else {
                r[corep + ((ins >> 19) & 0x7C)>>2] = (Read16(paddr|0)|0);
            }
            break;

        case 0x26:
            // lhs
            vaddr = (r[corep + ((ins >> 14) & 0x7C)>>2]|0) + ((ins << 16) >> 16)|0;
            if ((read16stlbcheck ^ vaddr) >> 13) {
                paddr = DTLBLookup(vaddr, 0)|0;
                if ((paddr|0) == -1) {
                    break;
                }
                read16stlbcheck = vaddr;
                read16stlblookup = ((paddr^vaddr) >> 13) << 13;
            }
            paddr = read16stlblookup ^ vaddr;
            if ((paddr|0) >= 0) {
                r[corep + ((ins >> 19) & 0x7C)>>2] =  (w[ramp + (paddr ^ 2) >> 1] << 16) >> 16;
            } else {
                r[corep + ((ins >> 19) & 0x7C)>>2] = ((Read16(paddr|0)|0) << 16) >> 16;
            }
            break;

        case 0x27:
            // addi signed
            imm = (ins << 16) >> 16;
            rA = r[corep + ((ins >> 14) & 0x7C)>>2]|0;
            rindex = corep + ((ins >> 19) & 0x7C)|0;
            r[rindex >> 2] = rA + imm|0;
            SR_CY = (r[rindex>>2]>>>0) < (rA>>>0);
            break;

        case 0x28:
            // addi signed with carry
            imm = (ins << 16) >> 16;
            rA = r[corep + ((ins >> 14) & 0x7C)>>2]|0;
            rindex = corep + ((ins >> 19) & 0x7C)|0;
            r[rindex >> 2] = (rA + imm|0) + (SR_CY?1:0)|0;
            if (SR_CY|0) {
                SR_CY = (r[rindex>>2]>>>0) <= (rA>>>0);
            } else {
                SR_CY = (r[rindex>>2]>>>0) < (rA>>>0);
            }
            break;

        case 0x29:
            // andi
            r[corep + ((ins >> 19) & 0x7C)>>2] = r[corep + ((ins >> 14) & 0x7C)>>2] & (ins & 0xFFFF);
            break;


        case 0x2A:
            // ori
            r[corep + ((ins >> 19) & 0x7C)>>2] = r[corep + ((ins >> 14) & 0x7C)>>2] | (ins & 0xFFFF);
            break;

        case 0x2B:
            // xori
            rA = r[corep + ((ins >> 14) & 0x7C)>>2]|0;
            r[corep + ((ins >> 19) & 0x7C)>>2] = rA ^ ((ins << 16) >> 16);
            break;

        case 0x2C:
            // muli
            rA = r[corep + ((ins >> 14) & 0x7C)>>2]|0;
            r[corep + ((ins >> 19) & 0x7C)>>2] = imul(rA|0, (ins << 16) >> 16)|0;
            break;

        case 0x2D:
            // mfspr
            r[corep + ((ins >> 19) & 0x7C)>>2] = GetSPR(r[corep + ((ins >> 14) & 0x7C)>>2] | (ins & 0xFFFF))|0;
            break;

        case 0x2E:
            switch ((ins >> 6) & 0x3) {
            case 0:
                // slli
                r[corep + ((ins >> 19) & 0x7C)>>2] = r[corep + ((ins >> 14) & 0x7C)>>2] << (ins & 0x1F);
                break;
            case 1:
                // rori
                r[corep + ((ins >> 19) & 0x7C)>>2] = r[corep + ((ins >> 14) & 0x7C)>>2] >>> (ins & 0x1F);
                break;
            case 2:
                // srai
                r[corep + ((ins >> 19) & 0x7C)>>2] = r[corep + ((ins >> 14) & 0x7C)>>2] >> (ins & 0x1F);
                break;
            default:
                DebugMessage(ERROR_UNKNOWN|0);
                //DebugMessage("Error: opcode 2E function not implemented");
                abort();
                break;
            }
            break;

        case 0x2F:
            // sf...i
            imm = (ins << 16) >> 16;
            switch ((ins >> 21) & 0x1F) {
            case 0x0:
                // sfnei
                SR_F = (r[corep + ((ins >> 14) & 0x7C)>>2]|0) == (imm|0);
                break;
            case 0x1:
                // sfnei
                SR_F = (r[corep + ((ins >> 14) & 0x7C)>>2]|0) != (imm|0);
                break;
            case 0x2:
                // sfgtui
                SR_F = (r[corep + ((ins >> 14) & 0x7C)>>2]>>>0) > (imm >>> 0);
                break;
            case 0x3:
                // sfgeui
                SR_F = (r[corep + ((ins >> 14) & 0x7C)>>2]>>>0) >= (imm >>> 0);
                break;
            case 0x4:
                // sfltui
                SR_F = (r[corep + ((ins >> 14) & 0x7C)>>2]>>>0) < (imm >>> 0);
                break;
            case 0x5:
                // sfleui
                SR_F = (r[corep + ((ins >> 14) & 0x7C)>>2]>>>0) <= (imm >>> 0);
                break;
            case 0xa:
                // sfgtsi
                SR_F = (r[corep + ((ins >> 14) & 0x7C)>>2]|0) > (imm|0);
                break;
            case 0xb:
                // sfgesi
                SR_F = (r[corep + ((ins >> 14) & 0x7C)>>2]|0) >= (imm|0);
                break;
            case 0xc:
                // sfltsi
                SR_F = (r[corep + ((ins >> 14) & 0x7C)>>2]|0) < (imm|0);
                break;
            case 0xd:
                // sflesi
                SR_F = (r[corep + ((ins >> 14) & 0x7C)>>2]|0) <= (imm|0);
                break;
            default:
                //DebugMessage("Error: sf...i not supported yet");
                DebugMessage(ERROR_UNKNOWN|0);
                abort();
                break;
            }
            break;

        case 0x30:
            // mtspr
            imm = (ins & 0x7FF) | ((ins >> 10) & 0xF800);
            //pc = pcbase + ppc|0;
            SetSPR(r[corep + ((ins >> 14) & 0x7C)>>2] | imm, r[corep + ((ins >> 9) & 0x7C)>>2]|0); // can raise an interrupt

            if ((activebitfield|0) == 0) { // all cpus are idle
                activebitfield = ncoresmask;
                // first check if there is a timer interrupt pending
                //for(i=0; (i|0)<(ncores|0); i = i+1|0) {
                    if ((h[(coreid<<15) + TTMRp >>2] & (1 << 28))) break;
                //}
                return steps|0;
            } else
            if ((activebitfield & (1<<coreid)) == 0) {  // check if this cpu gone idle and change the core
                ChangeCore();
            }
            break;

       case 0x32:
            // floating point
            rA = (ins >> 14) & 0x7C;
            rB = (ins >> 9) & 0x7C;
            rD = (ins >> 19) & 0x7C;

            switch (ins & 0xFF) {
            case 0x0:
                // lf.add.s
                f[corep + rD >> 2] = (+f[corep + rA >> 2]) + (+f[corep + rB >> 2]);
                break;
            case 0x1:
                // lf.sub.s
                f[corep + rD >> 2] = (+f[corep + rA >> 2]) - (+f[corep + rB >> 2]);
                break;
            case 0x2:
                // lf.mul.s
                f[corep + rD >> 2] = (+f[corep + rA >> 2]) * (+f[corep + rB >> 2]);
                break;
            case 0x3:
                // lf.div.s
                f[corep + rD >> 2] = (+f[corep + rA >> 2]) / (+f[corep + rB >> 2]);
                break;
            case 0x4:
                // lf.itof.s
                f[corep + rD >> 2] = +(r[corep + rA >> 2]|0);
                break;
            case 0x5:
                // lf.ftoi.s
                r[corep + rD >> 2] = ~~(+floor(+f[corep + rA >> 2]));
                break;
            case 0x7:
                // lf.madd.s
                f[corep + rD >> 2] = (+f[corep + rD >> 2]) + (+f[corep + rA >> 2]) * (+f[corep + rB >> 2]);
                break;
            case 0x8:
                // lf.sfeq.s
                SR_F = (+f[corep + rA >> 2]) == (+f[corep + rB >> 2]);
                break;
            case 0x9:
                // lf.sfne.s
                SR_F = (+f[corep + rA >> 2]) != (+f[corep + rB >> 2]);
                break;
            case 0xa:
                // lf.sfgt.s
                SR_F = (+f[corep + rA >> 2]) > (+f[corep + rB >> 2]);
                break;
            case 0xb:
                // lf.sfge.s
                SR_F = (+f[corep + rA >> 2]) >= (+f[corep + rB >> 2]);
                break;
            case 0xc:
                // lf.sflt.s
                SR_F = (+f[corep + rA >> 2]) < (+f[corep + rB >> 2]);
                break;
            case 0xd:
                // lf.sfle.s
                SR_F = (+f[corep + rA >> 2]) <= (+f[corep + rB >> 2]);
                break;
            default:
                DebugMessage(ERROR_UNKNOWN|0);
                abort();
                break;
            }
            break;

        case 0x33:
            // swa
            imm = ((((ins >> 10) & 0xF800) | (ins & 0x7FF)) << 16) >> 16;
            vaddr = (r[corep + ((ins >> 14) & 0x7C)>>2]|0) + imm|0;
            if ((write32tlbcheck ^ vaddr) >> 13) {
                paddr = DTLBLookup(vaddr, 1)|0;
                if ((paddr|0) == -1) {
                    break;
                }
                write32tlbcheck = vaddr;
                write32tlblookup = ((paddr^vaddr) >> 13) << 13;
            }
            paddr = write32tlblookup ^ vaddr;
            SR_F = ((paddr|0) == (h[corep + linkedaddrp >>2]|0))?(1|0):(0|0);
            h[corep + linkedaddrp >>2] = -1;
            snoopbitfield = snoopbitfield & (~(1<<coreid));
            if (snoopbitfield)
            for(i=0; (i|0)<(ncores|0); i = i + 1|0) {
                if ((h[(i<<15) + linkedaddrp >>2]|0) == (paddr|0)) {
                    h[(i<<15) + linkedaddrp >>2] = -1;
                    snoopbitfield = snoopbitfield & (~(1<<i));
                }
            }
            if ((SR_F|0) == 0) {
                break;
            }
            if ((paddr|0) > 0) {
                h[ramp + paddr >> 2] = r[corep + ((ins >> 9) & 0x7C)>>2]|0;
            } else {
                Write32(paddr|0, r[corep + ((ins >> 9) & 0x7C)>>2]|0);
            }
            break;

        case 0x35:
            // sw
            imm = ((((ins >> 10) & 0xF800) | (ins & 0x7FF)) << 16) >> 16;
            vaddr = (r[corep + ((ins >> 14) & 0x7C)>>2]|0) + imm|0;
            if ((write32tlbcheck ^ vaddr) >> 13) {
                paddr = DTLBLookup(vaddr, 1)|0;
                if ((paddr|0) == -1) {
                    break;
                }
                write32tlbcheck = vaddr;
                write32tlblookup = ((paddr^vaddr) >> 13) << 13;
            }
            paddr = write32tlblookup ^ vaddr;
            if (snoopbitfield)
            for(i=0; (i|0)<(ncores|0); i = i + 1|0) {
                if ((h[(i<<15) + linkedaddrp >>2]|0) == (paddr|0)) {
                    h[(i<<15) + linkedaddrp >>2] = -1;
                    snoopbitfield = snoopbitfield & (~(1<<i));
                }
            }
            if ((paddr|0) > 0) {
                h[ramp + paddr >> 2] = r[corep + ((ins >> 9) & 0x7C)>>2]|0;
            } else {
                Write32(paddr|0, r[corep + ((ins >> 9) & 0x7C)>>2]|0);
            }
            break;

        case 0x36:
            // sb
            imm = ((((ins >> 10) & 0xF800) | (ins & 0x7FF)) << 16) >> 16;
            vaddr = (r[corep + ((ins >> 14) & 0x7C)>>2]|0) + imm|0;
            if ((write8tlbcheck ^ vaddr) >> 13) {
                paddr = DTLBLookup(vaddr, 1)|0;
                if ((paddr|0) == -1) {
                    break;
                }
                write8tlbcheck = vaddr;
                write8tlblookup = ((paddr^vaddr) >> 13) << 13;
            }
            paddr = write8tlblookup ^ vaddr;
            if (snoopbitfield)
            for(i=0; (i|0)<(ncores|0); i = i + 1|0) {
                if ((h[(i<<15) + linkedaddrp >>2]|0) == (paddr&(~3))) {
                    h[(i<<15) + linkedaddrp >>2] = -1;
                    snoopbitfield = snoopbitfield & (~(1<<i));
                }
            }
            if ((paddr|0) > 0) {
                // consider that the data is saved in little endian
                b[ramp + (paddr ^ 3)|0] = r[corep + ((ins >> 9) & 0x7C)>>2]|0;
            } else {
                Write8(paddr|0, r[corep + ((ins >> 9) & 0x7C)>>2]|0);
            }
            break;

        case 0x37:
            // sh
            imm = ((((ins >> 10) & 0xF800) | (ins & 0x7FF)) << 16) >> 16;
            vaddr = (r[corep + ((ins >> 14) & 0x7C)>>2]|0) + imm|0;
            if ((write16tlbcheck ^ vaddr) >> 13) {
                paddr = DTLBLookup(vaddr, 1)|0;
                if ((paddr|0) == -1) {
                    break;
                }
                write16tlbcheck = vaddr;
                write16tlblookup = ((paddr^vaddr) >> 13) << 13;
            }
            paddr = write16tlblookup ^ vaddr;
            if (snoopbitfield)
            for(i=0; (i|0)<(ncores|0); i = i + 1|0) {
                if ((h[(i<<15) + linkedaddrp >>2]|0) == (paddr&(~3))) {
                    h[(i<<15) + linkedaddrp >>2] = -1;
                    snoopbitfield = snoopbitfield & (~(1<<i));
                }
            }
            if ((paddr|0) >= 0) {
                w[ramp + (paddr ^ 2) >> 1] = r[corep + ((ins >> 9) & 0x7C)>>2];
            } else {
                Write16(paddr|0, r[corep + ((ins >> 9) & 0x7C)>>2]|0);
            }
            break;

        case 0x38:
            // three operands commands
            rA = r[corep + ((ins >> 14) & 0x7C)>>2]|0;
            rB = r[corep + ((ins >> 9) & 0x7C)>>2]|0;
            rindex = (ins >> 19) & 0x7C;
            switch (ins & 0x3CF) {
            case 0x0:
                // add
                r[corep + rindex>>2] = rA + rB|0;
                SR_CY = (r[corep + rindex>>2]>>>0) < (rA>>>0);
                break;
            case 0x1:
                // add with carry
                r[corep + rindex>>2] = (rA + rB|0) + (SR_CY?1:0)|0;
                if (SR_CY|0) {
                    SR_CY = (r[corep + rindex>>2]>>>0) <= (rA>>>0);
                } else {
                    SR_CY = (r[corep + rindex>>2]>>>0) < (rA>>>0);
                }
                break;
            case 0x2:
                // sub signed
                r[corep + rindex>>2] = rA - rB;
                SR_CY = (rB>>>0) > (rA>>>0);
                break;
            case 0x3:
                // and
                r[corep + rindex>>2] = rA & rB;
                break;
            case 0x4:
                // or
                r[corep + rindex>>2] = rA | rB;
                break;
            case 0x5:
                // or
                r[corep + rindex>>2] = rA ^ rB;
                break;
            case 0x8:
                // sll
                r[corep + rindex>>2] = rA << (rB & 0x1F);
                break;
            case 0xc:
                // exths
                r[corep + rindex>>2] = (rA << 16) >> 16;
                continue;
            case 0xe:
                // cmov
                r[corep + rindex>>2] = SR_F?rA:rB;
                break;
            case 0x48:
                // srl not signed
                r[corep + rindex>>2] = rA >>> (rB & 0x1F);
                break;
            case 0x4c:
                // extbs
                r[corep + rindex>>2] = (rA << 24) >> 24;
                break;
            case 0xf:
                // ff1
                r[corep + rindex>>2] = 0;
                for (i = 0; (i|0) < 32; i=i+1|0) {
                    if (rA & (1 << i)) {
                        r[corep + rindex>>2] = i + 1;
                        break;
                    }
                }
                break;
            case 0x88:
                // sra signed
                r[corep + rindex>>2] = rA >> (rB & 0x1F);
                // be carefull here and check
                break;
            case 0x10f:
                // fl1
                r[corep + rindex>>2] = 0;
                for (i = 31; (i|0) >= 0; i=i-1|0) {
                    if (rA & (1 << i)) {
                        r[corep + rindex>>2] = i + 1;
                        break;
                    }
                }
                break;
            case 0x306:
                // mul signed (specification seems to be wrong)
                {
                    // this is a hack to do 32 bit signed multiply. Seems to work but needs to be tested.
                    r[corep + rindex>>2] = imul(rA|0, rB|0)|0;
                }
                break;
            case 0x30a:
                // divu (specification seems to be wrong)
                SR_OV = (rB|0) == 0;
                if (!SR_OV) {
                    r[corep + rindex>>2] = (rA>>>0) / (rB>>>0);
                }
                break;
            case 0x309:
                // div (specification seems to be wrong)
                SR_OV = (rB|0) == 0;
                if (!SR_OV) {
                    r[corep + rindex>>2] = (rA|0) / (rB|0);
                }
                break;
            default:
                //DebugMessage("Error: op38 opcode not supported yet");
                DebugMessage(ERROR_UNKNOWN|0);
                abort();
                break;
            }
            break;

        case 0x39:
            // sf....
            switch ((ins >> 21) & 0x1F) {
            case 0x0:
                // sfeq
                SR_F = (r[corep + ((ins >> 14) & 0x7C)>>2]|0) == (r[corep + ((ins >> 9) & 0x7C)>>2]|0);
                break;
            case 0x1:
                // sfne
                SR_F = (r[corep + ((ins >> 14) & 0x7C)>>2]|0) != (r[corep + ((ins >> 9) & 0x7C)>>2]|0);
                break;
            case 0x2:
                // sfgtu
                SR_F = ((r[corep + ((ins >> 14) & 0x7C)>>2]>>>0) > (r[corep + ((ins >> 9) & 0x7C)>>2]>>>0));
                break;
            case 0x3:
                // sfgeu
                SR_F = ((r[corep + ((ins >> 14) & 0x7C)>>2]>>>0) >= (r[corep + ((ins >> 9) & 0x7C)>>2]>>>0));
                break;
            case 0x4:
                // sfltu
                SR_F = ((r[corep + ((ins >> 14) & 0x7C)>>2]>>>0) < (r[corep + ((ins >> 9) & 0x7C)>>2]>>>0));
                break;
            case 0x5:
                // sfleu
                SR_F = ((r[corep + ((ins >> 14) & 0x7C)>>2]>>>0) <= (r[corep + ((ins >> 9) & 0x7C)>>2]>>>0));
                break;
            case 0xa:
                // sfgts
                SR_F = (r[corep + ((ins >> 14) & 0x7C)>>2]|0) > (r[corep + ((ins >> 9) & 0x7C)>>2]|0);
                break;
            case 0xb:
                // sfges
                SR_F = (r[corep + ((ins >> 14) & 0x7C)>>2]|0) >= (r[corep + ((ins >> 9) & 0x7C)>>2]|0);
                break;
            case 0xc:
                // sflts
                SR_F = (r[corep + ((ins >> 14) & 0x7C)>>2]|0) < (r[corep + ((ins >> 9) & 0x7C)>>2]|0);
                break;
            case 0xd:
                // sfles
                SR_F = (r[corep + ((ins >> 14) & 0x7C)>>2]|0) <= (r[corep + ((ins >> 9) & 0x7C)>>2]|0);
                break;
            default:
                //DebugMessage("Error: sf.... function supported yet");
                DebugMessage(ERROR_UNKNOWN|0);
                abort();
            }
            break;

        default:
            //DebugMessage("Error: Instruction with opcode " + utils.ToHex(ins >>> 26) + " not supported");
            DebugMessage(ERROR_UNKNOWN|0);
            abort();
            break;
        }

    }; // main loop

    return steps|0;
}

return {
    Init: Init,
    Reset: Reset,
    InvalidateTLB: InvalidateTLB,
    Step: Step,
    GetFlags: GetFlags,
    SetFlags: SetFlags,
    GetTimeToNextInterrupt: GetTimeToNextInterrupt,
    ProgressTime: ProgressTime,
    GetTicks: GetTicks,
    RaiseInterrupt: RaiseInterrupt,
    ClearInterrupt: ClearInterrupt,
    AnalyzeImage: AnalyzeImage
};

}

module.exports = SMPCPU;

},{"../messagehandler":33}],39:[function(require,module,exports){
// -------------------------------------------------
// -------------------- RAM ------------------------
// -------------------------------------------------


// The access is assumed to be aligned. The check have to be performed elsewere.
// Consider that the data in Javascript is saved in 32-Bit little endian format
// for big endian emulations we flip each 32-Bit for faster access

// For faster access for the devices we limit the offset of the device to 
// 0xyy000000 where yy is a number between 0x0 and 0xFF

var message = require('./messagehandler');
var utils = require('./utils');

// constructor
function RAM(heap, ramoffset) {
    //use typed arrays
    this.heap = heap;
    this.int32mem = new Int32Array(this.heap, ramoffset);
    this.uint8mem = new Uint8Array(this.heap, ramoffset);
    this.sint8mem = new Int8Array(this.heap, ramoffset);

    this.devices = new Array(0x100);

    // generic functions assume little endian
    this.nativeendian = "little";

    // little endian machine independent
    this.Read32Little = this.Read32LittleTemplate;
    this.Write32Little = this.Write32LittleTemplate;
    this.Read16Little = this.Read16LittleTemplate;
    this.Write16Little = this.Write16LittleTemplate;
    this.Read8Little = this.Read8LittleTemplate;
    this.Write8Little = this.Write8LittleTemplate;

    // machine dependent functions
    this.Read32 = this.Read32LittleTemplate;
    this.Write32 = this.Write32LittleTemplate;
    this.Read16 = this.Read16LittleTemplate;
    this.Write16 = this.Write16LittleTemplate;
    this.Read8 = this.Read8LittleTemplate;
    this.Write8 = this.Write8LittleTemplate;

    // big endian machine independent only used by big endian machines
    this.Read32Big = this.Read32BigTemplate;
    this.Write32Big = this.Write32BigTemplate;
    this.Read16Big = this.Read16BigTemplate;
    this.Write16Big = this.Write16BigTemplate;
    this.Read8Big = this.Read8BigTemplate;
    this.Write8Big = this.Write8BigTemplate;
}

RAM.prototype.AddDevice = function(device, devaddr, devsize) {
    if (devaddr & 0xFFFFFF) {
        message.Debug("Error: The device address not in the allowed memory region");
        message.Abort();
    }
    this.devices[(devaddr>>24)&0xFF] = device;
}

RAM.prototype.Little2Big = function(length) {
    for (var i = 0; i < length >> 2; i++) {
        this.int32mem[i] = utils.Swap32(this.int32mem[i]);
    }
    this.Read32 = this.Read32BigTemplate;
    this.Write32 = this.Write32BigTemplate;
    this.Read16 = this.Read16BigTemplate;
    this.Write16 = this.Write16BigTemplate;
    this.Read8 = this.Read8BigTemplate;
    this.Write8 = this.Write8BigTemplate;

    this.Read32Little = function(addr) { return utils.Swap32(this.Read32BigTemplate(addr)); }.bind(this);
    this.Write32Little = function(addr, x) { this.Write32BigTemplate(addr, utils.Swap32(x)); }.bind(this);
    this.Read16Little = function(addr) { return utils.Swap16(this.Read16BigTemplate(addr)); }.bind(this);
    this.Write16Little = function(addr, x) { this.Write16BigTemplate(addr, utils.Swap16(x)); }.bind(this);
    this.Read8Little = this.Read8BigTemplate.bind(this);
    this.Write8Little = this.Write8BigTemplate.bind(this);

    this.nativeendian = "big";
}

RAM.prototype.Read32BigTemplate = function(addr) {
    addr = addr | 0;
    if (addr >= 0) {
        if (this.int32mem.byteLength <= addr) {
            message.Debug("Error in Read32Big: read above upper boundary");
            message.Abort();
        }
        return this.int32mem[addr >> 2];
    }
    return this.devices[(addr>>24)&0xFF].ReadReg32(addr & 0xFFFFFF);
};

RAM.prototype.Read32LittleTemplate = function(addr) {
    addr = addr | 0;
    if (addr < 0) {
        addr = addr ^ 0x80000000;
        if (this.int32mem.byteLength <= addr) {
            message.Debug("Error in Read32Little: read above upper boundary");
            message.Abort();
        }
        return this.int32mem[addr >> 2];
    }
    return this.devices[(addr>>24)&0xFF].ReadReg32(addr & 0xFFFFFF);
};

RAM.prototype.Write32BigTemplate = function(addr, x) {
    addr = addr | 0;
    if (addr >= 0) {
        if (this.int32mem.byteLength <= addr) {
            message.Debug("Error in Write32Big: write above upper boundary");
            message.Abort();
        }
        this.int32mem[addr >> 2] = x|0;
        return;
    }
    this.devices[(addr>>24)&0xFF].WriteReg32(addr & 0xFFFFFF, x|0);
};

RAM.prototype.Write32LittleTemplate = function(addr, x) {
    addr = addr | 0;
    if (addr < 0) {
        addr = addr ^ 0x80000000;
        if (this.int32mem.byteLength <= addr) {
            message.Debug("Error in Write32Little: write above upper boundary");
            message.Abort();
        }
        this.int32mem[addr >> 2] = x|0;
        return;
    }
    this.devices[(addr>>24)&0xFF].WriteReg32(addr & 0xFFFFFF, x|0);
};

RAM.prototype.Read8BigTemplate = function(addr) {
    addr = addr | 0;
    if (addr >= 0) {
        if (this.uint8mem.byteLength <= addr) {
            message.Debug("Error in Read8Big: read above upper boundary");
            message.Abort();
        }
        return this.uint8mem[addr ^ 3];
    }
    return this.devices[(addr>>24)&0xFF].ReadReg8(addr & 0xFFFFFF);
};

RAM.prototype.Read8LittleTemplate = function(addr) {
    addr = addr | 0;
    if (addr < 0) {
        addr = addr ^ 0x80000000;
        if (this.uint8mem.byteLength <= addr) {
            message.Debug("Error in Read8Little: read above upper boundary");
            message.Abort();
        }
        return this.uint8mem[addr];
    }
    return this.devices[(addr>>24)&0xFF].ReadReg8(addr & 0xFFFFFF);
};

RAM.prototype.Write8BigTemplate = function(addr, x) {
    addr = addr | 0;
    if (addr >= 0) {
        if (this.uint8mem.byteLength <= addr) {
            message.Debug("Error in Write8Big: write above upper boundary");
            message.Abort();
        }
        this.uint8mem[addr ^ 3] = x|0;
        return;
    }
    this.devices[(addr>>24)&0xFF].WriteReg8(addr & 0xFFFFFF, x|0);
};

RAM.prototype.Write8LittleTemplate = function(addr, x) {
    addr = addr | 0
    if (addr < 0) {
        addr = addr ^ 0x80000000;
        if (this.uint8mem.byteLength <= addr) {
            message.Debug("Error in Write8Little: write above upper boundary");
            message.Abort();
        }
        this.uint8mem[addr] = x|0;
        return;
    }
    this.devices[(addr>>24)&0xFF].WriteReg8(addr & 0xFFFFFF, x|0);
};

RAM.prototype.Read16BigTemplate = function(addr) {
    addr = addr | 0;
    if (addr >= 0) {
        if (this.uint8mem.byteLength <= addr) {
            message.Debug("Error in Read16Big: read above upper boundary");
            message.Abort();
        }
        return (this.uint8mem[(addr ^ 2)+1] << 8) | this.uint8mem[(addr ^ 2)];
    }
    return this.devices[(addr>>24)&0xFF].ReadReg16(addr & 0xFFFFFF);
};

RAM.prototype.Read16LittleTemplate = function(addr) {
    addr = addr | 0;
    if (addr < 0) {
        addr = addr ^ 0x80000000;
        if (this.uint8mem.byteLength <= addr) {
            message.Debug("Error in Read16Little: read above upper boundary");
            message.Abort();
        }
        return (this.uint8mem[addr+1] << 8) | this.uint8mem[addr];
    }
    return this.devices[(addr>>24)&0xFF].ReadReg16(addr & 0xFFFFFF);
};

RAM.prototype.Write16BigTemplate = function(addr, x) {
    addr = addr | 0;
    if (addr >= 0) {
        if (this.uint8mem.byteLength <= addr) {
            message.Debug("Error in Write16Big: write above upper boundary");
            message.Abort();
        }
        this.uint8mem[(addr ^ 2)+1] = (x >> 8) & 0xFF;
        this.uint8mem[(addr ^ 2)  ] = x & 0xFF;
        return;
    }
    this.devices[(addr>>24)&0xFF].WriteReg16(addr & 0xFFFFFF, x|0);
};

RAM.prototype.Write16LittleTemplate = function(addr, x) {
    addr = addr | 0;
    if (addr < 0) {
        addr = addr ^ 0x80000000;
        if (this.uint8mem.byteLength <= addr) {
            message.Debug("Error in Write16Little: write above upper boundary");
            message.Abort();
        }
        this.uint8mem[addr+1] = (x >> 8) & 0xFF;
        this.uint8mem[addr  ] =  x & 0xFF;
        return;
    }
    this.devices[(addr>>24)&0xFF].WriteReg16(addr & 0xFFFFFF, x|0);
};



module.exports = RAM;

},{"./messagehandler":33,"./utils":48}],40:[function(require,module,exports){

"use strict";
var message = require('../messagehandler');
var utils = require('../utils');

var PRV_U = 0x00;
var PRV_S = 0x01;
var PRV_H = 0x02;
var PRV_M = 0x03;

var CSR_MSTATUS   = 0x300;

function Disassemble(ins,r,csr,pc) {
    message.Debug("pc=" + utils.ToHex(pc) + " ins=" + utils.ToHex(ins));

    switch(ins&0x7F) {

        case 0x03:
            //lb,lh,lw,lbu,lhu
            switch((ins >> 12)&0x7) {
                
                case 0x00:
                    //lb
                    message.Debug("lb");
                    break;

                case 0x01:
                    //lh
                    message.Debug("lh");
                    break;

                case 0x02:
                    //lw
                    message.Debug("lw");
                    break;

                case 0x04:
                    //lbu
                    message.Debug("lbu");
                    break;

                case 0x05:
                    //lhu
                    message.Debug("lhu");
                    break;

                default:
                    message.Debug("Error in disassemble: Instruction " + utils.ToHex(ins) + "not found");
                    break;

            }
            break;

        case 0x23:
            //sb,sh,sw
            switch((ins >> 12)&0x7) {
                
                case 0x00:
                    //sb
                    message.Debug("sb");
                    break;

                case 0x01:
                    //sh
                    message.Debug("sh");
                    break;

                case 0x02:
                    //sw
                    message.Debug("sw");
                    break;

                default:
                    message.Debug("Error in disassemble: Instruction " + utils.ToHex(ins) + "not found");
                    break;

            }
            break;

        case 0x13:
            //addi,slti,sltiu,xori,ori,andi,slli,srli,srai
            switch((ins >> 12)&0x7) {
                
                case 0x00:
                    //addi
                    message.Debug("addi");
                    break;

                case 0x02:
                    //slti
                    message.Debug("slti");
                    break;

                case 0x03:
                    //sltiu
                    message.Debug("sltiu");
                    break;

                case 0x04:
                    //xori
                    message.Debug("xori");
                    break;

                case 0x06:
                    //ori
                    message.Debug("ori");
                    break;

                case 0x07:
                    //andi
                    message.Debug("andi");
                    break;

                case 0x01:
                    //slli
                    message.Debug("slli");
                    break;

                case 0x05:
                    if(((ins >> 25) & 0x7F) == 0x00){
                        //srli
                        message.Debug("srli");
                    }
                    else if(((ins >> 25) & 0x7F) == 0x20){
                        //srai
                        message.Debug("srai");
                    }
                    break;

                default:
                    message.Debug("Error in disassemble: Instruction " + utils.ToHex(ins) + "not found");
                    break;

            }
            break;

        case 0x33:
            //add,sub,sll,slt,sltu,xor,srl,sra,or,and
            switch((ins >> 25)&0x7F) {
                
                case 0x00:
                    //add,slt,sltu,add,or,xor,sll,srl
                    switch((ins >> 12)&0x7) {
                        case 0x00:
                            //add
                            message.Debug("add");
                            break;

                        case 0x02:
                            //slt
                            message.Debug("slt");
                            break;

                        case 0x03:
                            //sltu
                            message.Debug("sltu");
                            break;

                        case 0x07:
                            //and
                            message.Debug("and");
                            break;

                        case 0x06:
                            //or
                            message.Debug("or");
                            break;

                        case 0x04:
                            //xor
                            message.Debug("xor");
                            break;

                        case 0x01:
                            //sll
                            message.Debug("sll");
                            break;

                        case 0x05:
                            //srl
                            message.Debug("srl");
                            break;
                    }
                    break;

                case 0x20:
                    //sub
                    switch((ins >> 12)&0x7) {
                        case 0x00:
                            //sub
                            message.Debug("sub");
                            break;

                        case 0x05:
                            //sra
                            message.Debug("sra");
                            break;
                    }
                    break;

                case 0x01:
                    //mul,mulh,mulhsu,mulhu,div,divu,rem,remu
                    switch((ins >> 12)&0x7) {
                        case 0x00:
                            //mul
                            message.Debug("mul");
                            break;

                        case 0x01:
                            //mulh
                            message.Debug("mulh");
                            break;

                        case 0x02:
                            //mulhsu
                            message.Debug("mulhsu");
                            break;

                        case 0x03:
                            //mulhu
                            message.Debug("mulhu");
                            break;

                        case 0x04:
                            //div
                            message.Debug("div");
                            break;

                        case 0x05:
                            //divu
                            message.Debug("divu");
                            break;

                        case 0x06:
                            //rem
                            message.Debug("rem");
                            break;

                        case 0x07:
                            //remu
                            message.Debug("remu");
                            break;
                    }
                    break;
               

                default:
                    message.Debug("Error in disassemble: Instruction " + utils.ToHex(ins) + "not found");
                    break;

            }
            break;

        case 0x37:
            //lui
            message.Debug("Lui");
            break;

        case 0x17:
            //auipc
            message.Debug("auipc");
            break;

        case 0x6F:
            //jal
            message.Debug("jal");
            break; 

        case 0x67:
            //jalr
            message.Debug("jalr");
            break;

        case 0x63:
            //beq,bne,blt,bge,bltu,bgeu
            switch((ins >> 12)&0x7) {
                
                case 0x00:
                    //beq
                    message.Debug("beq");
                    break;

                case 0x01:
                    //bne
                    message.Debug("bne");
                    break;

                case 0x04:
                    //blt
                    message.Debug("blt");
                    break;

                case 0x05:
                    //bge
                    message.Debug("bge");
                    break;

                case 0x06:
                    //bltu
                    message.Debug("bltu");
                    break;

                case 0x07:
                    //bgeu
                    message.Debug("bgeu");
                    break;

                default:
                    message.Debug("Error in disassemble: Instruction " + utils.ToHex(ins) + "not found");
                    break;

            }
            break;

        case 0x73:
            //csrrw,csrrs,csrrc,csrrwi,csrrsi,csrrci,ecall,eret,ebreak,mrts
            switch((ins >> 12)&0x7) {
                
                case 0x01:
                    //csrrw
                    message.Debug("csrrw");
                    break;

                case 0x02:
                    //csrrs
                    message.Debug("csrrs");
                    break;

                case 0x03:
                    //csrrc
                    message.Debug("csrrc - "+ utils.ToHex(ins));
                    break;

                case 0x05:
                    //csrrwi
                    message.Debug("csrrwi - "+ utils.ToHex(ins));
                    break;
                    

                case 0x06:
                    //csrrsi
                    message.Debug("csrrsi - "+ utils.ToHex(ins));
                    break;

                case 0x07:
                    //csrrci
                    message.Debug("csrrci - "+ utils.ToHex(ins));
                    break;
                
                case 0x00:
                    //ecall,eret,ebreak,mrts
                    switch((ins >> 20)&0xFFF) {
                        case 0x00:
                            //ecall
                            var current_privilege_level = (csr[CSR_MSTATUS] & 0x06) >> 1;
                            switch(current_privilege_level)
                            {
                                case PRV_U:
                                    message.Debug("ecall PRV_U -"+ utils.ToHex(ins));
                                    break;

                                case PRV_S:
                                    message.Debug("ecall PRV_S -"+ utils.ToHex(ins));
                                    break;

                                case PRV_H:
                                    message.Debug("Not supported ecall PRV_H -"+ utils.ToHex(ins));
                                    break;

                                case PRV_M:
                                    message.Debug("ecall PRV_M -"+ utils.ToHex(ins));
                                    break;
                                
                                default:
                                    message.Debug("Error in ecall: Don't know how to handle privilege level " + current_privilege_level);
                                    break;
                            }
                            break;

                        case 0x001:
                            //ebreak
                            message.Debug("ebreak - "+ utils.ToHex(ins)+" at PC" + utils.ToHex(this.pc));
                            break;

                        case 0x100:
                            //eret
                            var current_privilege_level = (csr[CSR_MSTATUS] & 0x06) >> 1;
                            if(current_privilege_level < PRV_S) {
                                message.Debug("Error in eret: current_privilege_level isn't allowed access");
                                break;   
                            }
                            switch(current_privilege_level)
                            {
                                
                                case PRV_S:
                                    message.Debug("eret PRV_S -"+ utils.ToHex(ins));
                                    break;

                                case PRV_H:
                                    message.Debug("Not supported eret PRV_H -"+ utils.ToHex(ins));
                                    break;

                                case PRV_M:
                                    message.Debug("eret PRV_M -"+ utils.ToHex(ins));
                                    break;
                                
                                default:
                                    message.Debug("Error in eret: Don't know how to handle privilege level " + current_privilege_level);
                                    break;
                            }
                            break;

                        case 0x305:
                            //mrts     
                            if(current_privilege_level != PRV_M) {
                                message.Debug("Error in mrts: current_privilege_level isn't allowed access");
                                break;   
                            }
                            message.Debug("mrts - "+ utils.ToHex(ins));
                            break;

                        case 0x120:
                            //sfence.vma
                            message.Debug("sfence.vma - "+ utils.ToHex(ins));
                            break;

                        default:
                            message.Debug("Error in disassemble: Instruction " + utils.ToHex(ins) + "not found");
                            break;

                    }
                    break; 

                default:
                    message.Debug("Error in disassemble: Instruction " + utils.ToHex(ins) + "not found");
                    break;

            }
            break;

        case 0x07:
            //flw,fld
            switch((ins >> 12)&0x7) {
                
                case 0x02:
                    //flw
                    message.Debug("flw - "+ utils.ToHex(ins));
                    break;

                case 0x03:
                    //fld
                    message.Debug("fld");
                    break;

                default:
                    message.Debug("Error in disassemble: Instruction " + utils.ToHex(ins) + "not found");
                    break;

            }
            break;

        case 0x27:
            //fsw,fsd
            switch((ins >> 12)&0x7) {

                case 0x02:
                    //fsw
                    message.Debug("fsw");
                    break;

                case 0x03:
                    //fsd
                    message.Debug("fsw");
                    break;

                default:
                    message.Debug("Error in disassemble: Instruction " + utils.ToHex(ins) + "not found");
                    break;

            }
            break;

        case 0x53:
            //fadd.s,fsub.s
            switch((ins >> 25)&0x7F) {
                
                case 0x00 :
                    //fadd.s
                    message.Debug("fadd.s");
                    break;

                case 0x04:
                    //fsub.s
                    message.Debug("fsub.s");
                    break;

                case 0x60:
                    //fcvt.w.s
                    message.Debug("fcvt.w.s");
                    break;

                case 0x01 :
                    //fadd.d
                    message.Debug("fadd.d");
                    break;

                case 0x05:
                    //fsub.d
                    message.Debug("fsub.d");
                    break;

                case 0x61:
                    //fcvt.w.d
                    message.Debug("fcvt.w.s");
                    break;

                case 0x78:
                    //fmv.s.x
                    message.Debug("fmv.s.x");
                    break;


                default:
                    message.Debug("Error in disassemble: Instruction " + utils.ToHex(ins) + "not found");
                    break;
            }
            break;

        case 0x2F:
            //amoswap,amoadd,amoxor,amoand,amoor,amomin,amomax,amominu,amomaxu
            switch((ins >> 27)&0x1F) {
                
                case 0x01:
                    //amoswap
                    message.Debug("amoswap");
                    break;

                case 0x00:
                    //amoadd
                    message.Debug("amoadd");
                    break;

                case 0x04:
                    //amoxor
                    message.Debug("amoxor");
                    break;

                case 0x0C:
                    //amoand
                    message.Debug("amoand");
                    break;

                case 0x08:
                    //amoor
                    message.Debug("amoor");
                    break;

                case 0x10:
                    //amomin
                    message.Debug("amomin");
                    break;

               case 0x14:
                    //amomax
                    message.Debug("amomax");
                    break;

                case 0x18:
                    //amominu
                    message.Debug("amominu");
                    break;

                case 0x1C:
                    //amomaxu
                    message.Debug("amomaxu");
                    break;

                case 0x02:
                    //lr.d
                    message.Debug("lr.d");
                    break;

                case 0x03:
                    //sc.d
                    message.Debug("sc.d");
                    break;

                default:
                    message.Debug("Error in Atomic Memory Instruction " + utils.ToHex(ins) + "not found");
                    break;

            }
            break;

        case 0x0F:
            //fence
            message.Debug("fence");
            break;

        default:
            message.Debug("Error in disassemble: Instruction " + utils.ToHex(ins) + " not found");
            break;
    }

};

module.exports.Disassemble = Disassemble;


},{"../messagehandler":33,"../utils":48}],41:[function(require,module,exports){
// -------------------------------------------------
// -------------------- CPU ------------------------
// -------------------------------------------------
var message = require('../messagehandler');
var utils = require('../utils');
var DebugIns = require('./disassemble');


// constructor
function FastCPU(stdlib, foreign, heap) {
"use asm";

var DebugMessage = foreign.DebugMessage;
var abort = foreign.abort;
var Read32 = foreign.Read32;
var Write32 = foreign.Write32;
var Read16 = foreign.Read16;
var Write16 = foreign.Write16;
var Read8 = foreign.Read8;
var Write8 = foreign.Write8;
var ReadDEVCMDToHost = foreign.ReadDEVCMDToHost;
var ReadDEVCMDFromHost = foreign.ReadDEVCMDFromHost;
var WriteDEVCMDToHost = foreign.WriteDEVCMDToHost;
var WriteDEVCMDFromHost = foreign.WriteDEVCMDFromHost;
var ReadToHost = foreign.ReadToHost;
var ReadFromHost = foreign.ReadFromHost;
var WriteToHost = foreign.WriteToHost;
var WriteFromHost = foreign.WriteFromHost;
var imul = foreign.imul;
var MathAbs = stdlib.Math.abs;
var floor = stdlib.Math.floor;

//One of the following error ids are printed to the console in case of an abort()
var ERROR_INCOMPLETE_VMPRIVILEGE = 0;
var ERROR_VMPRIVILEGE            = 1;
var ERROR_VMMODE                 = 2;
var ERROR_SETCSR                 = 3;
var ERROR_GETCSR                 = 4;
var ERROR_LOAD_WORD              = 5;
var ERROR_STORE_WORD             = 6;
var ERROR_INSTRUCTION_NOT_FOUND  = 7;
var ERROR_ECALL                  = 8;
var ERROR_ERET                   = 9;
var ERROR_ERET_PRIV              = 10;
var ERROR_MRTS                   = 11;
var ERROR_ATOMIC_INSTRUCTION     = 12;

//Privilege Modes
var PRV_U = 0x00;
var PRV_S = 0x01;
var PRV_H = 0x02;
var PRV_M = 0x03;

//Various operations on the page table
var VM_READ  = 0;
var VM_WRITE = 1;
var VM_FETCH = 2;

//Various Causes which need to be written to MCAUSE Register in case of a Trap
var CAUSE_TIMER_INTERRUPT          = 0x80000001;
var CAUSE_HOST_INTERRUPT           = 0x80000002;
var CAUSE_SOFTWARE_INTERRUPT       = 0x80000000;
var CAUSE_INSTRUCTION_ACCESS_FAULT = 0x01;
var CAUSE_ILLEGAL_INSTRUCTION      = 0x02;
var CAUSE_BREAKPOINT               = 0x03;
var CAUSE_LOAD_ACCESS_FAULT        = 0x05;
var CAUSE_STORE_ACCESS_FAULT       = 0x07;
var CAUSE_ENVCALL_UMODE            = 0x08;
var CAUSE_ENVCALL_SMODE            = 0x09;
var CAUSE_ENVCALL_HMODE            = 0x0A;
var CAUSE_ENVCALL_MMODE            = 0x0B;

//All CSR addresses have been multiplied for implementing in the asm.js way
var CSR_CYCLES = 0x3000;
var CSR_CYCLEW = 0x2400;


var CSR_FFLAGS    = 0x4;
var CSR_FRM       = 0x8;
var CSR_FCSR      = 0xC;

var CSR_SSTATUS   = 0x400;
var CSR_STVEC     = 0x404;
var CSR_SIE       = 0x410;
var CSR_STIMECMP  = 0x484;
var CSR_SSCRATCH  = 0x500;
var CSR_SEPC      = 0x504;
var CSR_SIP       = 0x510;
var CSR_SPTBR     = 0x600;
var CSR_SASID     = 0x604;

var CSR_HEPC      = 0x904;

var CSR_MSTATUS   = 0xC00;
var CSR_MTVEC     = 0xC04;
var CSR_MTDELEG   = 0xC08;
var CSR_MIE       = 0xC10;
var CSR_MTIMECMP  = 0xC84;
var CSR_MTIMECMPH = 0xD84;
var CSR_MEPC      = 0xD04;
var CSR_MSCRATCH  = 0xD00;
var CSR_MCAUSE    = 0xD08;
var CSR_MBADADDR  = 0xD0C;
var CSR_MIP       = 0xD10;
var CSR_MTOHOST_TEMP = 0xD14; // terminal output, temporary for the patched pk.

var CSR_MTIME     = 0x1C04;
var CSR_MTIMEH    = 0x1D04;
var CSR_MRESET    = 0x1E08;
var CSR_SEND_IPI  = 0x1E0C;

var CSR_MTOHOST         = 0x1E00;
var CSR_MFROMHOST       = 0x1E04;
var CSR_MDEVCMDTOHOST   = 0x1E40; // special
var CSR_MDEVCMDFROMHOST = 0x1E44; // special

var CSR_TIMEW     = 0x2404;
var CSR_INSTRETW  = 0x2408;
var CSR_CYCLEHW   = 0x2600;
var CSR_TIMEHW    = 0x2604;
var CSR_INSTRETHW = 0x2608;

var CSR_STIMEW    = 0x2804;
var CSR_STIMEH    = 0x3604;
var CSR_STIMEHW   = 0x2A04;
var CSR_STIME     = 0x3404;
var CSR_SCAUSE    = 0x3508;
var CSR_SBADADDR  = 0x350C;
var CSR_MCPUID    = 0x3C00;
var CSR_MIMPID    = 0x3C04;
var CSR_MHARTID   = 0x3C40;
var CSR_CYCLEH    = 0x3200;
var CSR_TIMEH     = 0x3204;
var CSR_INSTRETH  = 0x3208;

var CSR_TIME      = 0x3004;
var CSR_INSTRET   = 0x3008;
var CSR_STATS     = 0x300;
var CSR_UARCH0    = 0x3300;
var CSR_UARCH1    = 0x3304;
var CSR_UARCH2    = 0x3008;
var CSR_UARCH3    = 0x330C;
var CSR_UARCH4    = 0x3310;
var CSR_UARCH5    = 0x3314;
var CSR_UARCH6    = 0x3318;
var CSR_UARCH7    = 0x331C;
var CSR_UARCH8    = 0x3320;
var CSR_UARCH9    = 0x3324;
var CSR_UARCH10   = 0x3328;
var CSR_UARCH11   = 0x332C;
var CSR_UARCH12   = 0x3330;
var CSR_UARCH13   = 0x33334;
var CSR_UARCH14   = 0x33338;
var CSR_UARCH15   = 0x3333C;

/*
    Heap Layout
    ===========
    The heap is needed by the asm.js CPU.

    0x0       32 CPU registers
    0x80      Floating Point Registers
    0x2000    CSR Registers
    ------- RAM --------
    0x100000  RAM
*/


var r = new stdlib.Int32Array(heap); // Registers
var rp = 0x00; // Never used

var f = new stdlib.Float64Array(heap); // Registers
var fp = 0x80; // Offset to floating point registers in the Heap

var fi = new stdlib.Int32Array(heap); // For copying operations
var fip = 0x80;

var ff = new stdlib.Float32Array(heap); // The zero register is used to convert to single precision
var ffp = 0x00; // Never used

var csr = new stdlib.Int32Array(heap);
var csrp = 0x2000; // Offset to CSRs in the Heap

var ram = new stdlib.Int32Array(heap);
var ramp = 0x100000; // Offset to Ram in the Heap

var ram8 = new stdlib.Int8Array(heap); // 8 bit view of heap
var ram16 = new stdlib.Int16Array(heap); // 16 bit view of heap

var pc = 0x200; // Virtual PC
var pcorigin = 0x200;
var pc_change = 1; // 1 implies pc has been changed by an instruction
var ticks = 0;
var amoaddr = 0, amovalue = 0;

var fence = 0x200; // Has the next page address in case of normal operation, it is made equal to ppc in insts like branch, jump etc
var ppc = 0x200; // Physical PC
var ppcorigin = 0x200;


// tlb_index contains the virutal address and tlb_entry will have the correponding Phsysical Address
// If the page number of vaddr matches with the tlb_index then we directly read the tlb_entry to get the Physical Frame Number
var instlb_index     = -0x8000; // tlb index for pc
var instlb_entry     = -0x8000;
var read8tlb_index   = -1; // tlb index for lb ins
var read8tlb_entry   = -1;
var read8utlb_index  = -1; // tlb index for lbu ins
var read8utlb_entry  = -1;
var read16tlb_index  = -1; // tlb index for lh ins
var read16tlb_entry  = -1;
var read16utlb_index = -1; // tlb index for lhu ins
var read16utlb_entry = -1;
var read32tlb_index  = -1; // tlb index for lw ins
var read32tlb_entry  = -1;
var store8tlb_index  = -1; // tlb index for sb ins
var store8tlb_entry  = -1;
var store16tlb_index = -1; // tlb index for sh ins
var store16tlb_entry = -1;
var store32tlb_index = -1; // tlb index for sw ins
var store32tlb_entry = -1;

var float_read32tlb_index  = -1; // tlb index for flw ins
var float_read32tlb_entry  = -1;
var float_read64tlb_index  = -1; // tlb index for fld ins
var float_read64tlb_entry  = -1;
var float_store32tlb_index = -1; // tlb index for fsw ins
var float_store32tlb_entry = -1;
var float_store64tlb_index = -1; // tlb index for fsd ins
var float_store64tlb_entry = -1;

var queue_status = 0; // 1 means queue is full

function Init() {
    Reset();
}

function Reset() {
    ticks = 0;
    csr[(csrp + CSR_MSTATUS)>>2]  = 0x96; // 1001 0110 - All Interrupts Disabled, FPU disabled
    csr[(csrp + CSR_MTOHOST)>>2]  = 0x780;
    csr[(csrp + CSR_MCPUID)>>2]   = 0x4112D;
    csr[(csrp + CSR_MIMPID)>>2]   = 0x01;
    csr[(csrp + CSR_MHARTID)>>2]  = 0x00;
    csr[(csrp + CSR_MTVEC)>>2]    = 0x100;
    csr[(csrp + CSR_MIE)>>2]      = 0x00;
    csr[(csrp + CSR_MEPC)>>2]     = 0x00;
    csr[(csrp + CSR_MCAUSE)>>2]   = 0x00;
    csr[(csrp + CSR_MBADADDR)>>2] = 0x00;
    csr[(csrp + CSR_SSTATUS)>>2]  = 0x3010;
    csr[(csrp + CSR_STVEC)>>2]    = 0x00;
    csr[(csrp + CSR_SIE)>>2]      = 0x00;
    csr[(csrp + CSR_TIME)>>2]     = 0x0;
    csr[(csrp + CSR_SPTBR)>>2]    = 0x40000;

    // for atomic load & store instructions
    amoaddr = 0x00;
    amovalue = 0x00;
}

function GetPC() {
    pc = pcorigin + (ppc-ppcorigin)|0;
    return pc|0;
}

function GetTimeToNextInterrupt() {
    var delta = 0x0;
    delta = (csr[(csrp + 0xC84)>> 2]>>>0) - (ticks & 0xFFFFFFFF) |0;
    delta = delta + ((delta|0)<0?0xFFFFFFFF:0x0) | 0;
    return delta|0;
}

function GetTicks() {
    return ticks|0;
}

function ProgressTime(delta) {
    delta = delta|0;
    ticks = ticks + delta|0;
}


function AnalyzeImage() // we haveto define these to copy the cpus
{
}

function CheckForInterrupt() {
};

function RaiseInterrupt(line, cpuid) {
    line = line|0;
    cpuid = cpuid|0;
    //DebugMessage("raise int " + line);
    queue_status = 1;
};

function ClearInterrupt(line, cpuid) {
    line = line|0;
    cpuid = cpuid|0;
};

function Trap(cause, current_pc) {

    //Store the current_pc, set the mcause register and point PC to the Trap Handler
    cause = cause|0;
    current_pc = current_pc|0;
    var current_privilege_level = 0;
    var offset = 0x100;

    current_privilege_level = (csr[(csrp + CSR_MSTATUS)>>2] & 0x06) >> 1;
    PushPrivilegeStack();
    csr[(csrp + CSR_MEPC)>>2] = current_pc;
    csr[(csrp + CSR_MCAUSE)>>2] = cause;
    pc = (offset + (current_privilege_level << 6))|0;
    fence = ppc;
    pc_change = 1;
    InvalidateTLB();
};

function MemTrap(addr, op) {

    addr = addr|0;
    op = op|0;
    if ((op|0) != (VM_FETCH|0)) pc = pcorigin + (ppc-ppcorigin)|0;
    csr[(csrp + CSR_MBADADDR)>>2] = addr;
    switch (op|0) {
        case 0: //VM_READ
            Trap(CAUSE_LOAD_ACCESS_FAULT, pc - 4|0);
            break;

        case 1: //VM_WRITE
            Trap(CAUSE_STORE_ACCESS_FAULT, pc - 4|0);
            break;

        case 2: //VM_FETCH
            Trap(CAUSE_INSTRUCTION_ACCESS_FAULT, pc);
            break;
    }
}


function CheckVMPrivilege(type, op) {

    //Checks if the Privilages of a Page Table Entry are being violated
    type = type|0;
    op = op|0;
    var priv = 0;
    priv = (csr[(csrp + CSR_MSTATUS)>>2] & 0x06) >> 1;

    switch (type|0) {

        case 2:
            if ((op|0) == (VM_READ|0)) return 1;
            if (((priv|0) == (PRV_U|0)) & ((op|0) == (VM_FETCH|0))) return 1;
            return 0;
            break;

        case 3:
            if (!( ((priv|0) == (PRV_S|0)) & ((op|0) == (VM_FETCH|0)) ) ) return 1;
            break;

        case 4:
            if ((op|0) == (VM_READ|0)) return 1;
            return 0;
            break;

        case 5:
            if ((op|0) != (VM_FETCH|0)) return 1;
            break;

        case 6:
            if ((op|0) != (VM_WRITE|0)) return 1;
            break;

        case 7:
            return 1;
            break;

       case 11:
            if ((priv|0) == (PRV_S|0)) return 1;
            break;

        case 13:
            if (((priv|0) == (PRV_S|0)) & ((op|0) != (VM_FETCH|0))) return 1;
            break;

        case 14:
            if (((priv|0) == (PRV_S|0)) & ((op|0) != (VM_WRITE|0))) return 1;
            break;

        case 15:
            if ((priv|0) == (PRV_S|0)) return 1;
            break;

    }

    DebugMessage(ERROR_INCOMPLETE_VMPRIVILEGE|0);
    abort();
    return 0;
}


function TranslateVM(addr, op) {

    //Converts Virtual Address to Physical Address
    addr = addr|0;
    op = op|0;
    var vm = 0;
    var current_privilege_level = 0;
    var i = 1; //i = LEVELS -1 and LEVELS = 2 in a 32 bit System

    var offset = 0;
    var page_num = 0;
    var frame_num = 0;
    var type = 0;
    var valid = 0;

    //For Level 2
    var new_sptbr = 0;
    var new_page_num = 0;
    var new_frame_num = 0;
    var new_type = 0;
    var new_valid = 0;
    var ram_index = 0;


    vm = (csr[(csrp + CSR_MSTATUS)>>2] >> 17) & 0x1F;
    current_privilege_level = (csr[(csrp + CSR_MSTATUS)>>2] & 0x06) >> 1;

    // vm bare mode
    if (((vm|0) == 0) | ((current_privilege_level|0) == (PRV_M|0))) return addr|0;

    // hack, open mmio by direct mapping
    //if ((addr>>>28) == 0x9) return addr;

    // only RV32 supported
    if ((vm|0) != 8) {
        DebugMessage(ERROR_VMMODE|0);
        abort();
    }

    // LEVEL 1
    offset = addr & 0xFFF;
    page_num = (addr >>> 22)|0;

    ram_index = (csr[(csrp + CSR_SPTBR)>>2]|0) + (page_num << 2)|0
    frame_num = ram[(ramp + ram_index) >> 2]|0;
    type = ((frame_num >> 1) & 0xF);
    valid = (frame_num & 0x01);

    if ((valid|0) == 0) {
        //DebugMessage("Unsupported valid field " + valid + " or invalid entry in PTE at PC "+utils.ToHex(pc) + " pl:" + current_privilege_level + " addr:" + utils.ToHex(addr) + " op:"+op);
        //abort();
        MemTrap(addr, op);
        return -1;
    }
    if ((type|0) >= 2) {

        if (!(CheckVMPrivilege(type,op)|0)) {
            DebugMessage(ERROR_VMPRIVILEGE|0);
            abort();
        }
/*
        var updated_frame_num = frame_num;
        if (op == VM_READ)
            updated_frame_num = (frame_num | 0x20);
        else if (op == VM_WRITE)
            updated_frame_num = (frame_num | 0x60);
        Write32(csr[CSR_SPTBR] + (page_num << 2),updated_frame_num);
*/
        return (((frame_num >> 10) | ((addr >> 12) & 0x3FF)) << 12) | offset;
    }

    // LEVEL 2
    // DebugMessage("Second level MMU");

    offset = addr & 0xFFF;
    new_sptbr = (frame_num & 0xFFFFFC00) << 2;
    new_page_num = (addr >> 12) & 0x3FF;
    ram_index = (new_sptbr|0) + (new_page_num << 2)|0;
    new_frame_num = ram[(ramp + ram_index) >> 2]|0;
    new_type = ((new_frame_num >> 1) & 0xF);
    new_valid = (new_frame_num & 0x01);
    i = (i - 1)|0;

    if ((new_valid|0) == 0) {
        MemTrap(addr, op);
        return -1;
    }

    if (!(CheckVMPrivilege(new_type, op)|0)) {
        //DebugMessage("Error in TranslateVM: Unhandled trap");
        //abort();
        MemTrap(addr, op);
        return -1;
    }

/*
    var updated_frame_num = new_frame_num;
    if (op == VM_READ)
        updated_frame_num = (new_frame_num | 0x20);
    else if (op == VM_WRITE)
        updated_frame_num = (new_frame_num | 0x60);
    Write32(new_sptbr + (new_page_num << 2),updated_frame_num);
*/

    return ((new_frame_num >> 10) << 12) | offset | 0;
};


function SetCSR(addr,value) {

    // Handles write to CSR Registers appropriately
    addr = addr|0;
    value = value|0;
    var mask = 0;
    var ram_index = 0;
    addr = addr << 2;
    switch (addr|0) {
        case 0xC: // CSR_FCSR
            csr[(csrp + addr)>>2] = value;
            break;

        case 0x1E40: // CSR_MDEVCMDTOHOST
            csr[(csrp + addr)>>2] = value;
            WriteDEVCMDToHost(value|0);
            break;

        case 0x1E44: // CSR_MDEVCMDFROMHOST
            csr[(csrp + addr)>>2] = value;
            WriteDEVCMDFromHost(value|0);
            break;

        case 0x1E00: // CSR_MTOHOST
            csr[(csrp + addr)>>2] =  value;
            WriteToHost(value|0);
            break;

        case 0xD14: // CSR_MTOHOST_TEMP only temporary for the patched pk.
            ram_index = 0x90000000 >> 0;
            ram8[(ramp + ram_index) >> 0] = value|0;
            if ((value|0) == 0xA) ram8[(ramp + ram_index) >> 0] = 0xD;
            break;

        case 0x1E04: // CSR_MFROMHOST
            csr[(csrp + addr)>>2] = value;
            WriteFromHost(value|0);
            break;

        case 0xC00: // CSR_MSTATUS
            csr[(csrp + addr)>>2] = value;
            InvalidateTLB();
            break;

        case 0x3C00: // CSR_MCPUID
            //csr[addr] = value;
            break;

        case 0x3C04: // CSR_MIMPID
            csr[(csrp + addr)>>2] = value;
            break;

        case 0x3C40: // CSR_MHARTID
            csr[(csrp + addr)>>2] = value;
            break;

        case 0xC04: // CSR_MTVEC
            csr[(csrp + addr)>>2] = value;
            break;

        case 0xD10: // CSR_MIP
            //csr[addr] = value;
            mask = 0x2 | 0x08; //mask = MIP_SSIP | MIP_MSIP
            csr[(csrp + addr)>>2] = (csr[(csrp + addr)>>2] & ~mask) | (value & mask);
            break;

        case 0xC10: // CSR_MIE
            //csr[addr] = value;
            mask = 0x2 | 0x08 | 0x20; //mask = MIP_SSIP | MIP_MSIP | MIP_STIP
            csr[(csrp + addr)>>2] = (csr[(csrp + addr)>>2] & ~mask) | (value & mask);
            break;

        case 0x504: // CSR_SEPC
        case 0xD04: // CSR_MEPC
            csr[(csrp + addr)>>2] = value;
            break;

        case 0xD08: // CSR_MCAUSE
            csr[(csrp + addr)>>2] = value;
            break;

        case 0x3508: // CSR_SCAUSE
            csr[(csrp + addr)>>2] = value;
            break;

        case 0xD0C: // CSR_MBADADDR
            csr[(csrp + addr)>>2] = value;
            break;

        case 0x350C: // CSR_SBADADDR
            csr[(csrp + addr)>>2] = value;
            break;

        case 0x400: // CSR_SSTATUS
            csr[(csrp + CSR_SSTATUS)>>2] = value;
            csr[(csrp + CSR_MSTATUS)>>2] = csr[(csrp + CSR_MSTATUS)>>2] & (~0x1F039);
            csr[(csrp + CSR_MSTATUS)>>2] = csr[(csrp + CSR_MSTATUS)>>2] | (csr[(csrp + CSR_SSTATUS)>>2] & 0x01); //IE0
            csr[(csrp + CSR_MSTATUS)>>2] = csr[(csrp + CSR_MSTATUS)>>2] | (csr[(csrp + CSR_SSTATUS)>>2] & 0x08); //IE1
            csr[(csrp + CSR_MSTATUS)>>2] = csr[(csrp + CSR_MSTATUS)>>2] | (csr[(csrp + CSR_SSTATUS)>>2] & 0x10); //PRV1
            csr[(csrp + CSR_MSTATUS)>>2] = csr[(csrp + CSR_MSTATUS)>>2] | (csr[(csrp + CSR_SSTATUS)>>2] & 0xF000); //FS,XS
            csr[(csrp + CSR_MSTATUS)>>2] = csr[(csrp + CSR_MSTATUS)>>2] | (csr[(csrp + CSR_SSTATUS)>>2] & 0x10000); //MPRV
            break;

        case 0x404: // CSR_STVEC
            csr[(csrp + addr)>>2] = value;
            break;

        case 0x510: // CSR_SIP
            //csr[addr] = value;
            mask = 0x2; //mask = MIP_SSIP
            csr[(csrp + CSR_MIP)>>2] = (csr[(csrp + CSR_MIP)>>2] & ~mask) | (value & mask);
            break;

        case 0x410: // CSR_SIE
            //csr[addr] = value;
            mask = 0x2 | 0x20; //mask = MIP_SSIP | MIP_STIP
            csr[(csrp + CSR_MIE)>>2] = (csr[(csrp + CSR_MIE)>>2] & ~mask) | (value & mask);
            break;

        case 0xD00: // CSR_MSCRATCH
            csr[(csrp + addr)>>2] = value;
            break;

        case 0x500: // CSR_SSCRATCH
            csr[(csrp + addr)>>2] = value;
            break;

        case 0x2400: // CSR_CYCLEW
            csr[(csrp + addr)>>2] = value;
            break;

        case 0x3000: // CSR_CYCLES
            ticks = value;
            csr[(csrp + addr)>>2] = value;
            break;

        case 0x1C04: // CSR_MTIME
        case 0x3404: // CSR_STIME
        case 0x2804: // CSR_STIMEW
            csr[(csrp + addr)>>2] = value;
            break;

        case 0x1D04: // CSR_MTIMEH
        case 0x3604: // CSR_STIMEH
        case 0x2A04: // CSR_STIMEHW
            csr[(csrp + addr)>>2] = value;
            break;

        case 0x3004: // CSR_TIME
        case 0x2404: // CSR_TIMEW
            csr[(csrp + addr)>>2] = value;
            break;

        case 0xC84: // CSR_MTIMECMP
        case 0x484: // CSR_STIMECMP
            csr[(csrp + CSR_MIP)>>2] = csr[(csrp + CSR_MIP)>>2] & (~(0x20)); //csr[CSR_MIP] &= ~MIP_STIP
            csr[(csrp + addr)>>2] = value;
            break;

        case 0xD84: // CSR_MTIMECMPH
        case 0x600: // CSR_SPTBR
            csr[(csrp + addr)>>2] = value;
            break;

        case 0x04: // CSR_FRM
        case 0x08: // CSR_FFLAGS
            csr[(csrp + addr)>>2] = value;
            break;

        default:
            csr[(csrp + addr)>>2] = value;
            DebugMessage(ERROR_SETCSR|0);
            abort();
            break;
    }
};

function GetCSR(addr) {

    // Handles Read operation on CSR Registers appropriately
    addr = addr|0;
    var current_privilege_level = 0;
    current_privilege_level = (csr[(csrp + CSR_MSTATUS)>>2] & 0x06) >> 1;
    addr = (addr << 2)|0;
    switch (addr|0) {
        case 0xC: // CSR_FCSR
            return 0x0;
            break;

        case 0x1E40: // CSR_MDEVCMDTOHOST
            return ReadDEVCMDToHost()|0;
            break;

        case 0x1E44: // CSR_MDEVCMDFROMHOST
            return ReadDEVCMDFromHost()|0;
            break;

        case 0x1E00: // CSR_MTOHOST
            return ReadToHost()|0;
            break;

        case 0xD14: // CSR_MTOHOST_TEMP only temporary for the patched pk.
            return 0x0;
            break;

        case 0x1E04: // CSR_MFROMHOST
            return ReadFromHost()|0;
            break;

        case 0xC00: // CSR_MSTATUS
            return csr[(csrp + addr)>>2]|0;
            break;

        case 0x3C00: // CSR_MCPUID
            return csr[(csrp + addr)>>2]|0;
            break;

        case 0x3C04: // CSR_MIMPID
            return csr[(csrp + addr)>>2]|0;
            break;

        case 0x3C40: // CSR_MHARTID
            return csr[(csrp + addr)>>2]|0;
            break;

        case 0xC04: // CSR_MTVEC
            return csr[(csrp + addr)>>2]|0;
            break;

        case 0xC10: // CSR_MIE
            return csr[(csrp + addr)>>2]|0;
            break;

        case 0x504: // CSR_SEPC
        case 0xD04: // CSR_MEPC
            return csr[(csrp + addr)>>2]|0;
            break;

        case 0xD08: // CSR_MCAUSE
            return csr[(csrp + addr)>>2]|0;
            break;

        case 0x3508: // CSR_SCAUSE
            return csr[(csrp + addr)>>2]|0;
            break;

        case 0xD0C: // CSR_MBADADDR
            return csr[(csrp + addr)>>2]|0;
            break;

        case 0x350C: // CSR_SBADADDR
            return csr[(csrp + addr)>>2]|0;
            break;

        case 0x400: // CSR_SSTATUS
            //if (current_privilege_level == 0) Trap(CAUSE_ILLEGAL_INSTRUCTION);
            csr[(csrp + CSR_SSTATUS)>>2] = 0x00;
            csr[(csrp + CSR_SSTATUS)>>2] = csr[(csrp + CSR_SSTATUS)>>2] | (csr[(csrp + CSR_MSTATUS)>>2] & 0x01); //IE0
            csr[(csrp + CSR_SSTATUS)>>2] = csr[(csrp + CSR_SSTATUS)>>2] | (csr[(csrp + CSR_MSTATUS)>>2] & 0x08); //IE1
            csr[(csrp + CSR_SSTATUS)>>2] = csr[(csrp + CSR_SSTATUS)>>2] | (csr[(csrp + CSR_MSTATUS)>>2] & 0x10); //PRV1
            csr[(csrp + CSR_SSTATUS)>>2] = csr[(csrp + CSR_SSTATUS)>>2] | (csr[(csrp + CSR_MSTATUS)>>2] & 0xF000); //FS,XS
            csr[(csrp + CSR_SSTATUS)>>2] = csr[(csrp + CSR_SSTATUS)>>2] | (csr[(csrp + CSR_MSTATUS)>>2] & 0x10000); //MPRV
            return csr[(csrp + CSR_SSTATUS)>>2]|0;
            break;

        case 0x404: // CSR_STVEC
            return csr[(csrp + addr)>>2]|0;
            break;

        case 0xD10: // CSR_MIP
            return csr[(csrp + addr)>>2]|0;
            break;

        case 0x510: // CSR_SIP
            return (csr[(csrp + CSR_MIP)>>2] & (0x2 | 0x20))|0;//(MIP_SSIP | MIP_STIP)
            break;

        case 0x410: // CSR_SIE
            return (csr[(csrp + CSR_MIE)>>2] & (0x2 | 0x20))|0;//(MIP_SSIP | MIP_STIP)
            break;

        case 0xD00: // CSR_MSCRATCH
            return csr[(csrp + addr)>>2]|0;
            break;

        case 0x500: // CSR_SSCRATCH
            return csr[(csrp + addr)>>2]|0;
            break;

        case 0x2400: // CSR_CYCLEW
            return ticks|0;
            break;

        case 0x3000: // CSR_CYCLES
            return ticks|0;
            break;

        case 0x1C04: // CSR_MTIME
        case 0x3404: // CSR_STIME
        case 0x2804: // CSR_STIMEW
            return ticks|0;
            break;

        case 0x1D04: // CSR_MTIMEH
        case 0x3604: // CSR_STIMEH
        case 0x2A04: // CSR_STIMEHW
            return ((ticks) >> 32)|0;
            break;

        case 0x3004: // CSR_TIME
        case 0x2404: // CSR_TIMEW
            return ticks|0;
            break;

        case 0xC84: // CSR_MTIMECMP
        case 0x484: // CSR_STIMECMP
            return csr[(csrp + addr)>>2]|0;
            break;

        case 0xD84: // CSR_MTIMECMPH
        case 0x600: // CSR_SPTBR
            return csr[(csrp + addr)>>2]|0;
            break;

        case 0x04: // CSR_FRM
        case 0x08: // CSR_FFLAGS
            return csr[(csrp + addr)>>2]|0;
            break;

        default:
            DebugMessage(ERROR_GETCSR|0);
            abort();
            return csr[(csrp + addr)>>2]|0;
            break;
    }

    return 0;

};

function UMul64(a, b, index) {

    // Special Method for 64 Bit Multiplication for Unsigned*Unsigned
    a = a|0;
    b = b|0;
    index = index|0;
    var result0 = 0, result1 = 0;

    var a00 = 0, a16 = 0;
    var b00 = 0, b16 = 0;

    var c00 = 0;
    var c16 = 0;
    var c32 = 0;
    var c48 = 0;

    if ((a >>> 0) < 32767)
    if ((b >>> 0) < 65536) {
        result0 = imul((a|0),(b|0))|0;
        result1 = ((result0|0) < 0) ? -1 : 0;
        if ((index|0) == 0) return result0|0;
        return result1|0;
    }

    a00 = a & 0xFFFF;
    a16 = a >>> 16;
    b00 = b & 0xFFFF;
    b16 = b >>> 16;

    c00 = imul((a00|0), (b00|0))|0;
    c16 = (c00 >>> 16) + (imul((a16|0),(b00|0))|0)|0;
    c32 = c16 >>> 16;
    c16 = (c16 & 0xFFFF) + (imul((a00|0),(b16|0))|0)|0;
    c32 = (c32 + (c16 >>> 16))|0;
    c48 = c32 >>> 16;
    c32 = (c32 & 0xFFFF) + (imul((a16|0),(b16|0))|0)|0;
    c48 = (c48 + (c32 >>> 16))|0;

    result0 = ((c16 & 0xFFFF) << 16) | (c00 & 0xFFFF);
    result1 = ((c48 & 0xFFFF) << 16) | (c32 & 0xFFFF);
    if ((index|0) == 0) return result0|0;
    return result1|0;
};

function IMul64(a,b,index) {

    // Special Method for 64 Bit Multiplication for Signed*Signed
    a = a|0;
    b = b|0;
    index = index|0;
    var result0 = 0, result1 = 0;
    var doNegate = 0;

    if ((a|0) == 0) return 0;
    if ((b|0) == 0) return 0;

    if ((a|0) >= -32768) 
    if ((a|0) <=  32767)  
    if ((b|0) >= -32768)  
    if ((b|0) <=  32767) {
        result0 = imul((a|0),(b|0))|0;
        result1 = ((result0|0) < 0) ? -1 : 0;
        if ((index|0) == 0) return result0|0;
        return result1|0;
    }

    doNegate = ((a|0) < 0) ^ ((b|0) < 0);

    a = MathAbs(a|0)|0;
    b = MathAbs(b|0)|0;
    result0 = UMul64(a, b, 0)|0;
    result1 = UMul64(a, b, 1)|0;

    if (doNegate) {
        result0 = ~result0;
        result1 = ~result1;
        result0 = (result0 + 1) | 0;
        if ((result0|0) == 0) result1 = (result1 + 1) | 0;
    }

    if ((index|0) == 0) return result0|0;
    return result1|0;
};

function SUMul64(a,b,index) {

    // Special Method for 64 Bit Multiplication for Signed*Unsigned
    a = a|0;
    b = b|0;
    index = index|0;
    var result0 = 0, result1 = 0;
    var doNegate = 0;

    if ((a|0) == 0) return 0;
    if ((b|0) == 0) return 0;

    if ((a|0) >= -32768)
    if ((a|0) <= 32767) 
    if ((b>>>0) < 65536)  {
        result0 = imul((a|0),(b|0))|0;
        result1 = ((result0|0) < 0) ? -1 : 0;
        if ((index|0) == 0) return result0|0;
        return result1|0;
    }

    doNegate = ((a|0) < 0);

    a = MathAbs(a|0)|0;
    result0 = UMul64(a, b, 0)|0;
    result1 = UMul64(a, b, 1)|0;

    if (doNegate) {
        result0 = ~result0;
        result1 = ~result1;
        result0 = (result0 + 1) | 0;
        if ((result0|0) == 0) result1 = (result1 + 1) | 0;
    }

    if ((index|0) == 0) return result0|0;
    return result1|0;
};

function InvalidateTLB(){

    // The highest address migh be used by the sbi
    instlb_index     = 0xFFFF0000;
    instlb_entry     = -1;
    read8tlb_index   = 0xFFFF0000;
    read8tlb_entry   = -1;
    read8utlb_index  = 0xFFFF0000;
    read8utlb_entry  = -1;
    read16tlb_index  = 0xFFFF0000;
    read16tlb_entry  = -1;
    read16utlb_index = 0xFFFF0000;
    read16utlb_entry = -1;
    read32tlb_index  = 0xFFFF0000;
    read32tlb_entry  = -1;
    store8tlb_index  = 0xFFFF0000;
    store8tlb_entry  = -1;
    store16tlb_index = 0xFFFF0000;
    store16tlb_entry = -1;
    store32tlb_index = 0xFFFF0000;
    store32tlb_entry = -1;

    float_read32tlb_index  = 0xFFFF0000;
    float_read32tlb_entry  = -1;
    float_read64tlb_index  = 0xFFFF0000;
    float_read64tlb_entry  = -1;
    float_store32tlb_index = 0xFFFF0000;
    float_store32tlb_entry = -1;
    float_store64tlb_index = 0xFFFF0000;
    float_store64tlb_entry = -1;

}

function PushPrivilegeStack(){

    // 0 to 11 bits of mstatus register is considered as the stack.
    // Pushing implies just right shifting the 0 to 11 bits by 3 and then setting PRV[1:0] to Machine
    // Also set MPRV bit in mstatus register to zero
    var mstatus = 0,privilege_level_stack = 0, new_privilege_level_stack = 0;
    mstatus = csr[(csrp + CSR_MSTATUS)>>2]|0;
    privilege_level_stack =  (mstatus & 0xFFF);
    new_privilege_level_stack = (((privilege_level_stack << 2) | PRV_M) << 1) & 0xFFF;
    csr[(csrp + CSR_MSTATUS)>>2] = (((mstatus >> 12) << 12) + new_privilege_level_stack) & 0xFFFEFFFF; //Last "and" to set mprv(bit 16) to zero
};

function PopPrivilegeStack(){

    // 0 to 11 bits of mstatus register is considered as the stack.
    // Pop implies just left shifting the 0 to 11 bits by 3 and then setting PRV3[1:0] to lowest supported privilege mode(User in this case) with IE3 = 1
    // Also set MPRV bit in mstatus register to zero
    var mstatus = 0,privilege_level_stack = 0, new_privilege_level_stack = 0;
    mstatus = csr[(csrp + CSR_MSTATUS)>>2]|0;
    privilege_level_stack =  (mstatus & 0xFFF);
    new_privilege_level_stack = ((privilege_level_stack >>> 3) | ((PRV_U << 1) | 0x1) << 9);
    csr[(csrp + CSR_MSTATUS)>>2] = ((mstatus >> 12) << 12) + new_privilege_level_stack;
    InvalidateTLB();
};

function Step(steps, clockspeed) {

    steps = steps|0;
    clockspeed = clockspeed|0;

    var imm = 0x00;
    var zimm = 0x00;
    var mult = 0x00;
    var quo = 0x00;
    var rem = 0x00;
    var result = 0x00;
    var rs1 = 0x0;
    var rs2 = 0x0;
    var fs1 = 0.0;
    var fs2 = 0.0;
    var fs3 = 0.0;

    var delta = 0;
    var vaddr = 0;
    var paddr = 0;
    var current_privilege_level = 0;
    var interrupts = 0;
    var ie = 0;
    var ins = 0;
    var dsteps = 64;

    for(;;) {

    if ((fence|0) != (ppc|0)) {

        ins = ram[ppc >> 2]|0;
        ppc = ppc + 4|0;

        switch (ins&0x7F) {

            case 0x03:
                // lb, lh, lw, lbu, lhu
                vaddr = (r[((ins >> 13) & 0x7C) >> 2]|0) + (ins >> 20)|0;
                switch ((ins >> 12)&0x7) {

                    case 0x00:
                        // lb
                        if ((read8tlb_index ^ vaddr) & 0xFFFFF000) {
                            paddr = TranslateVM(vaddr|0, VM_READ)|0;
                            if ((paddr|0) == -1) continue;
                            read8tlb_index = vaddr|0;
                            read8tlb_entry = (paddr ^ vaddr) & 0xFFFFF000;
                        }
                        paddr = read8tlb_entry ^ vaddr;
                        r[((ins >> 5) & 0x7C) >> 2] = ((ram8[(ramp + paddr) >> 0]) << 24) >> 24;
                        continue;

                    case 0x01:
                        // lh
                        if ((read16tlb_index ^ vaddr) & 0xFFFFF000) {
                            paddr = TranslateVM(vaddr|0, VM_READ)|0;
                            if ((paddr|0) == -1) continue;
                            read16tlb_index = vaddr|0;
                            read16tlb_entry = (paddr ^ vaddr) & 0xFFFFF000;
                        }
                        paddr = read16tlb_entry ^ vaddr;
                        r[((ins >> 5) & 0x7C) >> 2] = ((ram16[(ramp + paddr) >> 1]) << 16) >> 16;
                        continue;

                    case 0x02:
                        // lw
                        if (vaddr & 3) {
                             DebugMessage(ERROR_LOAD_WORD|0);
                             abort();
                        }
                        if ((read32tlb_index ^ vaddr) & 0xFFFFF000) {
                            paddr = TranslateVM(vaddr|0, VM_READ)|0;
                            if ((paddr|0) == -1) continue;
                            read32tlb_index = vaddr|0;
                            read32tlb_entry = (paddr ^ vaddr) & 0xFFFFF000;
                        }
                        paddr = read32tlb_entry ^ vaddr;
                        r[((ins >> 5) & 0x7C) >> 2] = ram[(ramp + paddr) >> 2]|0;
                        continue;

                    case 0x04:
                        // lbu
                        if ((read8utlb_index ^ vaddr) & 0xFFFFF000) {
                            paddr = TranslateVM(vaddr|0, VM_READ)|0;
                            if ((paddr|0) == -1) continue;
                            read8utlb_index = vaddr|0;
                            read8utlb_entry = (paddr ^ vaddr) & 0xFFFFF000;
                        }
                        paddr = read8utlb_entry ^ vaddr;
                        r[((ins >> 5) & 0x7C) >> 2] = (ram8[(ramp + paddr) >> 0]) & 0xFF;
                        continue;

                    case 0x05:
                        // lhu
                        if ((read16utlb_index ^ vaddr) & 0xFFFFF000) {
                            paddr = TranslateVM(vaddr|0, VM_READ)|0;
                            if ((paddr|0) == -1) continue;
                            read16utlb_index = vaddr|0;
                            read16utlb_entry = (paddr ^ vaddr) & 0xFFFFF000;
                        }
                        paddr = read16utlb_entry ^ vaddr;
                        r[((ins >> 5) & 0x7C) >> 2] = (ram16[(ramp + paddr) >> 1]) & 0xFFFF;
                        continue;

                    default:
                        DebugMessage(ERROR_INSTRUCTION_NOT_FOUND|0);
                        abort();
                        break;

                }
                continue;

            case 0x23:
                // sb, sh, sw
                vaddr = 
                    (r[((ins >> 13) & 0x7C) >> 2]|0) + 
                    (
                     ((ins >> 25) << 5) | 
                     ((ins >> 7) & 0x1F)
                    )|0;
                switch ((ins >> 12)&0x7) {

                    case 0x00:
                        // sb
                        if ((store8tlb_index ^ vaddr) & 0xFFFFF000) {
                            paddr = TranslateVM(vaddr|0, VM_WRITE)|0;
                            if ((paddr|0) == -1) continue;
                            store8tlb_index = vaddr|0;
                            store8tlb_entry = (paddr ^ vaddr) & 0xFFFFF000;
                        }
                        paddr = store8tlb_entry ^ vaddr;
                        ram8[(ramp + paddr) >> 0] = (r[((ins >> 18) & 0x7C) >> 2] & 0xFF);
                        continue;

                    case 0x01:
                        // sh
                        if ((store16tlb_index ^ vaddr) & 0xFFFFF000) {
                            paddr = TranslateVM(vaddr|0, VM_WRITE)|0;
                            if ((paddr|0) == -1) continue;
                            store16tlb_index = vaddr|0;
                            store16tlb_entry = (paddr ^ vaddr) & 0xFFFFF000;
                        }
                        paddr = store16tlb_entry ^ vaddr;
                        ram16[(ramp + paddr) >> 1] = (r[((ins >> 18) & 0x7C) >> 2] & 0xFFFF);
                        continue;

                    case 0x02:
                        // sw
                        if (vaddr & 3) {
                             DebugMessage(ERROR_STORE_WORD|0);
                             abort();
                        }
                        if ((store32tlb_index ^ vaddr) & 0xFFFFF000) {
                            paddr = TranslateVM(vaddr|0, VM_WRITE)|0;
                            if ((paddr|0) == -1) continue;
                            store32tlb_index = vaddr|0;
                            store32tlb_entry = (paddr ^ vaddr) & 0xFFFFF000;
                        }
                        paddr = store32tlb_entry ^ vaddr;
                        ram[(ramp + paddr) >> 2] = r[((ins >> 18) & 0x7C) >> 2]|0;
                        continue;

                    default:
                        DebugMessage(ERROR_INSTRUCTION_NOT_FOUND|0);
                        abort();
                        break;

                }
                continue;

            case 0x13:
                // addi, slti, sltiu, xori, ori, andi, slli, srli, srai
                rs1 = r[((ins >> 13) & 0x7C) >> 2]|0;
                switch ((ins >> 12)&0x7) {

                    case 0x00:
                        // addi
                        r[((ins >> 5) & 0x7C) >> 2] = rs1 + (ins >> 20)|0;
                        continue;

                    case 0x02:
                        // slti
                        if ((rs1|0) < (ins >> 20))
                            r[((ins >> 5) & 0x7C) >> 2] = 0x01;
                        else
                            r[((ins >> 5) & 0x7C) >> 2] = 0x00;
                        continue;

                    case 0x03:
                        // sltiu
                        if ((rs1 >>> 0) < ((ins >> 20) >>> 0))
                            r[((ins >> 5) & 0x7C) >> 2] = 0x01;
                        else
                            r[((ins >> 5) & 0x7C) >> 2] = 0x00;
                        continue;

                    case 0x04:
                        // xori
                        r[((ins >> 5) & 0x7C) >> 2] = rs1 ^ (ins >> 20);
                        continue;

                    case 0x06:
                        // ori
                        r[((ins >> 5) & 0x7C) >> 2] = rs1 | (ins >> 20);
                        continue;

                    case 0x07:
                        // andi
                        r[((ins >> 5) & 0x7C) >> 2] = rs1 & (ins >> 20);
                        continue;

                    case 0x01:
                        // slli
                        r[((ins >> 5) & 0x7C) >> 2] = rs1 << ((ins >> 20) & 0x1F);
                        continue;

                    case 0x05:
                        if (((ins >> 25) & 0x7F) == 0x00) {
                            // srli
                            r[((ins >> 5) & 0x7C) >> 2] = rs1 >>> ((ins >> 20) & 0x1F);
                        }
                        else if (((ins >> 25) & 0x7F) == 0x20) {
                            // srai
                            r[((ins >> 5) & 0x7C) >> 2] = rs1 >> ((ins >> 20) & 0x1F);
                        }
                        continue;

                    default:
                        DebugMessage(ERROR_INSTRUCTION_NOT_FOUND|0);
                        abort();
                        break;

                }
                continue;

            case 0x33:
                // add, sub, sll, slt, sltu, xor, srl, sra, or, and
                switch ((ins >> 25)&0x7F) {

                    case 0x00:
                        rs1 = r[((ins >> 13) & 0x7C) >> 2]|0;
                        rs2 = r[((ins >> 18) & 0x7C) >> 2]|0;
                        switch ((ins >> 12)&0x7) {
                            case 0x00:
                                // add
                                r[((ins >> 5) & 0x7C) >> 2] = rs1 + rs2;
                                continue;

                            case 0x02:
                                // slt
                                if ((rs1|0) < (rs2|0))
                                    r[((ins >> 5) & 0x7C) >> 2] = 0x01;
                                else
                                    r[((ins >> 5) & 0x7C) >> 2] = 0x00;
                                continue;

                            case 0x03:
                                // sltu
                                if ((rs1 >>> 0) < (rs2 >>> 0))
                                    r[((ins >> 5) & 0x7C) >> 2] = 0x01;
                                else
                                    r[((ins >> 5) & 0x7C) >> 2] = 0x00;
                                continue;

                            case 0x07:
                                // and
                                r[((ins >> 5) & 0x7C) >> 2] = rs1 & rs2;
                                continue;

                            case 0x06:
                                // or
                                r[((ins >> 5) & 0x7C) >> 2] = rs1 | rs2;
                                continue;

                            case 0x04:
                                // xor
                                r[((ins >> 5) & 0x7C) >> 2] = rs1 ^ rs2;
                                continue;

                            case 0x01:
                                // sll
                                r[((ins >> 5) & 0x7C) >> 2] = rs1 << (rs2 & 0x1F);
                                continue;

                            case 0x05:
                                // srl
                                r[((ins >> 5) & 0x7C) >> 2] = rs1 >>> (rs2 & 0x1F);
                                continue;
                        }
                        continue;

                    case 0x20:
                        // sub, sra
                        rs1 = r[((ins >> 13) & 0x7C) >> 2]|0;
                        rs2 = r[((ins >> 18) & 0x7C) >> 2]|0;
                        switch ((ins >> 12)&0x7) {
                            case 0x00:
                                // sub
                                r[((ins >> 5) & 0x7C) >> 2] = rs1 - rs2;
                                continue;

                            case 0x05:
                                // sra
                                r[((ins >> 5) & 0x7C) >> 2] = rs1 >> (rs2 & 0x1F);
                                continue;
                        }
                        continue;

                    case 0x01:
                        // mul, mulh, mulhsu, mulhu, div, divu, rem, remu
                        rs1 = r[((ins >> 13) & 0x7C) >> 2]|0;
                        rs2 = r[((ins >> 18) & 0x7C) >> 2]|0;
                        switch ((ins >> 12)&0x7) {
                            case 0x00:
                                // mul
                                result = imul(rs1|0, rs2|0)|0;
                                r[((ins >> 5) & 0x7C) >> 2] = result;
                                continue;

                            case 0x01:
                                // mulh
                                result = IMul64(rs1, rs2, 1)|0;
                                r[((ins >> 5) & 0x7C) >> 2] = result;
                                continue;

                            case 0x02:
                                // mulhsu
                                result = SUMul64(rs1, rs2>>>0, 1)|0;
                                r[((ins >> 5) & 0x7C) >> 2] = result;
                                continue;

                            case 0x03:
                                // mulhu
                                result = UMul64(rs1>>>0, rs2>>>0, 1)|0;
                                r[((ins >> 5) & 0x7C) >> 2] = result;
                                continue;

                            case 0x04:
                                // div
                                if ((rs2|0) == 0)
                                    quo = -1;
                                else
                                    quo = ((rs1|0) / (rs2|0))|0;
                                r[((ins >> 5) & 0x7C) >> 2] = quo;
                                continue;

                            case 0x05:
                                //divu
                                if ((rs2|0) == 0)
                                    quo = 0xFFFFFFFF;
                                else
                                    quo = ((rs1 >>> 0) / (rs2 >>> 0))|0;
                                r[((ins >> 5) & 0x7C) >> 2] = quo;
                                continue;

                            case 0x06:
                                // rem
                                if ((rs2|0) == 0)
                                    rem = rs1;
                                else
                                    rem = ((rs1|0) % (rs2|0))|0;
                                r[((ins >> 5) & 0x7C) >> 2] = rem;
                                continue;

                            case 0x07:
                                // remu
                                if ((rs2|0) == 0)
                                    rem = (rs1 >>> 0);
                                else
                                    rem = ((rs1 >>> 0) % (rs2 >>> 0))|0;
                                r[((ins >> 5) & 0x7C) >> 2] = rem;
                                continue;
                        }
                        continue;

                    default:
                        DebugMessage(ERROR_INSTRUCTION_NOT_FOUND|0);
                        abort();
                        break;

                }
                continue;

            case 0x37:
                // lui
                r[((ins >> 5) & 0x7C) >> 2] = ins & 0xFFFFF000;
                continue;

            case 0x17:
                // auipc
                pc = pcorigin + (ppc-ppcorigin)|0;
                r[((ins >> 5) & 0x7C) >> 2] = (pc + (ins & 0xFFFFF000) - 4)|0;
                continue;

            case 0x6F:
                // jal
                pc = pcorigin + (ppc-ppcorigin)|0;
                r[((ins >> 5) & 0x7C) >> 2] = pc;
                imm =  (
                    ((ins >> 21) & 0x3FF) | 
                    (((ins >> 20) & 0x1) << 10) | 
                    (((ins >> 12) & 0xFF) << 11) | 
                    ((ins >> 31) << 19) ) << 1;
                pc = pc + imm - 4|0;
                fence = ppc;
                pc_change = 1;
                r[0] = 0;
                continue;

            case 0x67:
                // jalr
                pc = pcorigin + (ppc-ppcorigin)|0;
                rs1 = r[((ins >> 13) & 0x7C) >> 2]|0;
                r[((ins >> 5) & 0x7C) >> 2] = pc;
                pc = ((rs1 + (ins >> 20)) & 0xFFFFFFFE)|0;
                fence = ppc;
                pc_change = 1;
                r[0] = 0;
                continue;

            case 0x63:
                // beq, bne, blt, bge, bltu, bgeu
                rs1 = r[((ins >> 13) & 0x7C) >> 2]|0;
                rs2 = r[((ins >> 18) & 0x7C) >> 2]|0;
                switch ((ins >> 12)&0x7) {

                    case 0x00:
                        // beq
                        if ((rs1|0) != (rs2|0)) continue;
                        fence = ppc;
                        pc_change = 1;
                        imm = ((((ins >> 31) << 11) | (((ins >> 25) & 0x3F) << 4) | ((ins >> 8) & 0x0F) | (((ins >> 7) & 0x01) << 10)) << 1 );
                        pc = pcorigin + (ppc-ppcorigin)|0;
                        pc = pc + imm - 4|0;
                        continue;

                    case 0x01:
                        // bne
                        if ((rs1|0) == (rs2|0)) continue;
                        fence = ppc;
                        pc_change = 1;
                        imm = ((((ins >> 31) << 11) | (((ins >> 25) & 0x3F) << 4) | ((ins >> 8) & 0x0F) | (((ins >> 7) & 0x01) << 10)) << 1 );
                        pc = pcorigin + (ppc-ppcorigin)|0;
                        pc = pc + imm - 4|0;
                        continue;

                    case 0x04:
                        // blt
                        if ((rs1|0) >= (rs2|0)) continue;
                        fence = ppc;
                        pc_change = 1;
                        imm = ((((ins >> 31) << 11) | (((ins >> 25) & 0x3F) << 4) | ((ins >> 8) & 0x0F) | (((ins >> 7) & 0x01) << 10)) << 1 );
                        pc = pcorigin + (ppc-ppcorigin)|0;
                        pc = pc + imm - 4|0;
                        continue;

                    case 0x05:
                        // bge
                        if ((rs1|0) < (rs2|0)) continue;
                        fence = ppc;
                        pc_change = 1;
                        imm = ((((ins >> 31) << 11) | (((ins >> 25) & 0x3F) << 4) | ((ins >> 8) & 0x0F) | (((ins >> 7) & 0x01) << 10)) << 1 );
                        pc = pcorigin + (ppc-ppcorigin)|0;
                        pc = pc + imm - 4|0;
                        continue;

                    case 0x06:
                        // bltu
                        if ((rs1 >>> 0) >= (rs2 >>> 0)) continue;
                        fence = ppc;
                        pc_change = 1;
                        imm = ((((ins >> 31) << 11) | (((ins >> 25) & 0x3F) << 4) | ((ins >> 8) & 0x0F) | (((ins >> 7) & 0x01) << 10)) << 1 );
                        pc = pcorigin + (ppc-ppcorigin)|0;
                        pc = pc + imm - 4|0;
                        continue;

                    case 0x07:
                        // bgeu
                        if ((rs1 >>> 0) < (rs2 >>> 0)) continue;
                        fence = ppc;
                        pc_change = 1;
                        imm = ((((ins >> 31) << 11) | (((ins >> 25) & 0x3F) << 4) | ((ins >> 8) & 0x0F) | (((ins >> 7) & 0x01) << 10)) << 1 );
                        pc = pcorigin + (ppc-ppcorigin)|0;
                        pc = pc + imm - 4|0;
                        continue;

                    default:
                        DebugMessage(ERROR_INSTRUCTION_NOT_FOUND|0);
                        abort();
                        break;

                }
                continue;

            case 0x73:
                // csrrw, csrrs, csrrc, csrrwi, csrrsi, csrrci, ecall, eret, ebreak, mrts, wfi
                imm = (ins >>> 20);
                rs1 = r[((ins >> 13) & 0x7C) >> 2]|0;
                switch ((ins >> 12)&0x7) {

                    case 0x01:
                        // csrrw
                        r[((ins >> 5) & 0x7C) >> 2] = GetCSR(imm)|0;
                        SetCSR(imm, rs1);
                        r[0] = 0;
                        continue;

                    case 0x02:
                        // csrrs
                        r[((ins >> 5) & 0x7C) >> 2] = GetCSR(imm)|0;
                        SetCSR(imm, (GetCSR(imm)|0) | rs1);
                        r[0] = 0;
                        continue;

                    case 0x03:
                        // csrrc
                        r[((ins >> 5) & 0x7C) >> 2] = GetCSR(imm)|0;
                        SetCSR(imm, (GetCSR(imm)|0) & (~rs1));
                        r[0] = 0;
                        continue;

                    case 0x05:
                        // csrrwi
                        r[((ins >> 5) & 0x7C) >> 2] = GetCSR(imm)|0;
                        zimm = (ins >> 15) & 0x1F;
                        if ((zimm|0) != 0) SetCSR(imm, (zimm >> 0));
                        r[0] = 0;
                        continue;

                    case 0x06:
                        // csrrsi
                        r[((ins >> 5) & 0x7C) >> 2] = GetCSR(imm)|0;
                        zimm = (ins >> 15) & 0x1F;
                        if ((zimm|0) != 0) SetCSR(imm, (GetCSR(imm)|0) | (zimm >> 0));
                        r[0] = 0;
                        continue;

                    case 0x07:
                        // csrrci
                        r[((ins >> 5) & 0x7C) >> 2] = GetCSR(imm)|0;
                        zimm = (ins >> 15) & 0x1F;
                        if ((zimm|0) != 0) SetCSR(imm, (GetCSR(imm)|0) & ~(zimm >> 0));
                        r[0] = 0;
                        continue;

                    case 0x00:
                        // ecall, eret, ebreak, mrts, wfi
                        current_privilege_level = (csr[(csrp + CSR_MSTATUS)>>2] & 0x06) >> 1;
                        fence = ppc;
                        switch ((ins >> 20)&0xFFF) {
                            case 0x00:
                                // ecall
                                pc = pcorigin + (ppc-ppcorigin)|0;
                                switch (current_privilege_level|0) {
                                    case 0x00: // PRV_U
                                        Trap(CAUSE_ENVCALL_UMODE, pc - 4|0);
                                        break;

                                    case 0x01: // PRV_S
                                        Trap(CAUSE_ENVCALL_SMODE, pc - 4|0);
                                        break;

                                    case 0x02: // PRV_H
                                        Trap(CAUSE_ENVCALL_HMODE, pc - 4|0);
                                        abort();
                                        break;

                                    case 0x03: // PRV_M
                                        Trap(CAUSE_ENVCALL_MMODE, pc - 4|0);
                                        break;

                                    default:
                                        DebugMessage(ERROR_ECALL|0);
                                        abort();
                                        break;
                                }
                                continue;

                            case 0x001:
                                // ebreak
                                pc = pcorigin + (ppc-ppcorigin)|0;
                                Trap(CAUSE_BREAKPOINT, pc - 4|0);
                                continue;

                            case 0x100:
                                // eret
                                current_privilege_level = (csr[(csrp + CSR_MSTATUS)>>2] & 0x06) >> 1;
                                pc = pcorigin + (ppc-ppcorigin)|0;
                                if ((current_privilege_level|0) < (PRV_S|0)) {
                                    DebugMessage(ERROR_ERET_PRIV|0);
                                    abort();
                                    break;
                                }
                                PopPrivilegeStack();

                                switch (current_privilege_level|0) {

                                    case 0x01: //PRV_S
                                        //DebugMessage("eret PRV_S -"+ utils.ToHex(ins));
                                        pc = csr[(csrp + CSR_SEPC)>>2]|0;
                                        break;

                                    case 0x02: //PRV_H
                                        //DebugMessage("Not supported eret PRV_H -"+ utils.ToHex(ins));
                                        pc = csr[(csrp + CSR_HEPC)>>2]|0;
                                        abort();
                                        break;

                                    case 0x03: //PRV_M
                                        //DebugMessage("eret PRV_M -"+ utils.ToHex(ins));
                                        pc = csr[(csrp + CSR_MEPC)>>2]|0;
                                        break;

                                    default:
                                        DebugMessage(ERROR_ERET|0);
                                        abort();
                                        break;
                                }
                                pc_change = 1;
                                InvalidateTLB();
                                continue;

                            case 0x102:
                                // wfi
                                interrupts = csr[(csrp + CSR_MIE)>>2] & csr[(csrp + CSR_MIP)>>2];
/*
                                if (!interrupts)
                                if ((queue_status|0) == 0)
                                    return steps|0;
                                break;
*/
                                continue;

                            case 0x305:
                                // mrts
                                pc = pcorigin + (ppc-ppcorigin)|0;
                                if ((current_privilege_level|0) != (PRV_M|0)) {
                                    DebugMessage(ERROR_MRTS|0);
                                    abort();
                                    break;
                                }
                                csr[(csrp + CSR_MSTATUS)>>2] = (csr[(csrp + CSR_MSTATUS)>>2] & ~0x6) | 0x02; //Setting the Privilage level to Supervisor
                                csr[(csrp + CSR_SBADADDR)>>2] = csr[(csrp + CSR_MBADADDR)>>2];
                                csr[(csrp + CSR_SCAUSE)>>2] = csr[(csrp + CSR_MCAUSE)>>2];
                                csr[(csrp + CSR_SEPC)>>2] = csr[(csrp + CSR_MEPC)>>2];
                                pc = csr[(csrp + CSR_STVEC)>>2]|0;
                                InvalidateTLB();
                                pc_change = 1;
                                continue;

                            case 0x101:
                                // sfence.vm
                                InvalidateTLB();
                                continue;

                            default:
                                DebugMessage(ERROR_INSTRUCTION_NOT_FOUND|0);
                                abort();
                                break;

                        }
                        continue;

                    default:
                        DebugMessage(ERROR_INSTRUCTION_NOT_FOUND|0);
                        abort();
                        break;

                }
                continue;

            case 0x07:
                // flw, fld
                vaddr = (r[((ins >> 13) & 0x7C) >> 2]|0) + (ins >> 20)|0;
                switch ((ins >> 12)&0x7) {

                    case 0x02:
                        // flw
                        if ((float_read32tlb_index ^ vaddr) & 0xFFFFF000) {
                            paddr = TranslateVM(vaddr|0, VM_READ)|0;
                            if ((paddr|0) == -1) break;
                            float_read32tlb_index = vaddr|0;
                            float_read32tlb_entry = (paddr ^ vaddr) & 0xFFFFF000;
                        }
                        paddr = float_read32tlb_entry ^ vaddr;
                        r[0] = ram[(ramp + paddr) >> 2]|0;
                        f[(fp + (((ins >> 7) & 0x1F) << 3)) >> 3] = +ff[0];
                        r[0] = 0;
                        continue;

                    case 0x03:
                        // fld
                        if ((float_read64tlb_index ^ vaddr) & 0xFFFFF000) {
                            paddr = TranslateVM(vaddr|0, VM_READ)|0;
                            if ((paddr|0) == -1) continue;
                            float_read64tlb_index = vaddr|0;
                            float_read64tlb_entry = (paddr ^ vaddr) & 0xFFFFF000;
                        }
                        paddr = float_read64tlb_entry ^ vaddr;
                        fi[(fip + (((ins >> 7) & 0x1F) << 3) + 0) >> 2] = ram[(ramp + paddr + 0) >> 2]|0;
                        fi[(fip + (((ins >> 7) & 0x1F) << 3) + 4) >> 2] = ram[(ramp + paddr + 4) >> 2]|0;
                        continue;

                    default:
                        DebugMessage(ERROR_INSTRUCTION_NOT_FOUND|0);
                        DebugMessage(ins|0);
                        abort();
                        break;

                }
                continue;

            case 0x27:
                // fsw, fsd
                vaddr = (r[((ins >> 13) & 0x7C) >> 2]|0) + ((((ins >> 25) << 5) | ((ins >> 7) & 0x1F)))|0;
                switch ((ins >> 12)&0x7) {

                    case 0x02:
                        // fsw
                        ff[0] = +f[(fp + (((ins >> 20) & 0x1F) << 3)) >> 3];
                        if ((float_store32tlb_index ^ vaddr) & 0xFFFFF000) {
                            paddr = TranslateVM(vaddr|0, VM_READ)|0;
                            if ((paddr|0) == -1) continue;
                            float_store32tlb_index = vaddr|0;
                            float_store32tlb_entry = (paddr ^ vaddr) & 0xFFFFF000;
                        }
                        paddr = float_store32tlb_entry ^ vaddr;
                        ram[(ramp + paddr) >> 2] = r[0]|0;
                        r[0] = 0;
                        continue;

                    case 0x03:
                        // fsd
                        if ((float_store64tlb_index ^ vaddr) & 0xFFFFF000) {
                            paddr = TranslateVM(vaddr|0, VM_READ)|0;
                            if ((paddr|0) == -1) continue;
                            float_store64tlb_index = vaddr|0;
                            float_store64tlb_entry = (paddr ^ vaddr) & 0xFFFFF000;
                        }
                        paddr = float_store64tlb_entry ^ vaddr;
                        ram[(ramp + paddr + 0) >> 2] = fi[(fip + (((ins >> 20) & 0x1F) << 3) + 0) >> 2]|0;
                        ram[(ramp + paddr + 4) >> 2] = fi[(fip + (((ins >> 20) & 0x1F) << 3) + 4) >> 2]|0;
                        continue;

                    default:
                        DebugMessage(ERROR_INSTRUCTION_NOT_FOUND|0);
                        DebugMessage(ins|0);
                        abort();
                        break;

                }
                continue;

            case 0x53:
                // fadd.s, fsub.s
                switch ((ins >> 25)&0x7F) {

                    case 0x00:  //fadd.s
                    case 0x01:  //fadd.d
                        fs1 = (+f[(fp + (((ins >> 15) & 0x1F) << 3)) >> 3]);
                        fs2 = (+f[(fp + (((ins >> 20) & 0x1F) << 3)) >> 3]);
                        f[(fp + (((ins >> 7) & 0x1F) << 3)) >> 3] = (+fs1) + (+fs2);
                        continue;

                    case 0x04: //fsub.s
                    case 0x05: //fsub.d
                        fs1 = (+f[(fp + (((ins >> 15) & 0x1F) << 3)) >> 3]);
                        fs2 = (+f[(fp + (((ins >> 20) & 0x1F) << 3)) >> 3]);
                        f[(fp + (((ins >> 7) & 0x1F) << 3)) >> 3] = (+fs1) - (+fs2);
                        continue;

                    case 0x50:
                    case 0x51:
                        //fcmp.s, fcmp.d
                        fs1 = (+f[(fp + (((ins >> 15) & 0x1F) << 3)) >> 3]);
                        fs2 = (+f[(fp + (((ins >> 20) & 0x1F) << 3)) >> 3]);
                        switch ((ins >> 12) & 0x7) {
                            case 0x0:
                                // fle
                                if ((+fs1) <= (+fs2))
                                    r[((ins >> 5) & 0x7C) >> 2] = 1;
                                else
                                    r[((ins >> 5) & 0x7C) >> 2] = 0;
                                continue;

                            case 0x1:
                                // flt
                                if ((+fs1) < (+fs2))
                                    r[((ins >> 5) & 0x7C) >> 2] = 1;
                                else
                                    r[((ins >> 5) & 0x7C) >> 2] = 0;
                                continue;

                            case 0x2:
                                // feq
                                if ((+fs1) == (+fs2))
                                    r[((ins >> 5) & 0x7C) >> 2] = 1;
                                else
                                    r[((ins >> 5) & 0x7C) >> 2] = 0;
                                continue;

                            default:
                                DebugMessage(ERROR_INSTRUCTION_NOT_FOUND|0);
                                DebugMessage(ins|0);
                                abort();
                                break;
                        }
                        continue;

                    case 0x20: // fcvt.s.d
                    case 0x21: // fcvt.d.s
                        f[(fp + (((ins >> 7) & 0x1F) << 3)) >> 3] = 
                            (+f[(fp + (((ins >> 15) & 0x1F) << 3)) >> 3]);
                        continue;

                    case 0x60:
                        // fcvt.w.s
                        r[((ins >> 5) & 0x7C) >> 2] = ~~floor(+f[(fp + (((ins >> 15) & 0x1F) << 3)) >> 3]);
                        continue;

                    case 0x68:
                    case 0x69:
                        // fcvt.s.w, fcvt.d.w
                        f[(fp + (((ins >> 7) & 0x1F) << 3)) >> 3] = +(r[((ins >> 13) & 0x7C) >> 2]|0);
                        continue;

                    case 0x08: //fmul.s
                    case 0x09: //fmul.d
                        fs1 = (+f[(fp + (((ins >> 15) & 0x1F) << 3)) >> 3]);
                        fs2 = (+f[(fp + (((ins >> 20) & 0x1F) << 3)) >> 3]);
                        f[(fp + (((ins >> 7) & 0x1F) << 3)) >> 3] = +(+fs1)*(+fs2);
                        continue;

                    case 0x10: // single precision
                    case 0x11: // double precision
                        // fsgnj
                        fs1 = (+f[(fp + (((ins >> 15) & 0x1F) << 3)) >> 3]);
                        fs2 = (+f[(fp + (((ins >> 20) & 0x1F) << 3)) >> 3]);
                        switch ((ins >> 12) & 7) {
                            case 0:
                                // fsgnj.d, also used for fmv.d
                                f[(fp + (((ins >> 7) & 0x1F) << 3)) >> 3] = ((+fs2)<(+0))?-(+MathAbs(+fs1)):(+MathAbs(+fs1));
                                continue;

                            case 1:
                                // fsgnjn.d
                                f[(fp + (((ins >> 7) & 0x1F) << 3)) >> 3] = ((+fs2)<(+0))?+MathAbs(+fs1):-(+MathAbs(+fs1));
                                continue;

                            case 2:
                                // fsgnjx.d

                                if (((+fs1)*(+fs2)) < (+0)) {
                                    f[(fp + (((ins >> 7) & 0x1F) << 3)) >> 3] = -(+MathAbs(+fs1));
                                } else {
                                    f[(fp + (((ins >> 7) & 0x1F) << 3)) >> 3] = +(+MathAbs(+fs1));
                                }
                                continue;

                            default:
                                DebugMessage(ERROR_INSTRUCTION_NOT_FOUND|0);
                                DebugMessage(ins|0);
                                abort();
                        }
                        continue;

                    case 0x61:
                        // fcvt.w.d
                        r[((ins >> 5) & 0x7C) >> 2] = (~~+f[(fp + (((ins >> 15) & 0x1F) << 3)) >> 3]);
                        continue;

                    case 0x78:
                        // fmv.s.x
                        rs1 = r[((ins >> 13) & 0x7C) >> 2]|0;
                        r[0] = rs1;
                        f[(fp + (((ins >> 7) & 0x1F) << 3)) >> 3] = +ff[0];
                        r[0] = 0;
                        continue;


                    default:
                        DebugMessage(ERROR_INSTRUCTION_NOT_FOUND|0);
                        DebugMessage(ins|0);
                        abort();
                        break;
                }
                continue;

            case 0x43:
                // fmadd.d, fmadd.s
                fs1 = (+f[(fp + (((ins >> 15) & 0x1F) << 3)) >> 3]);
                fs2 = (+f[(fp + (((ins >> 20) & 0x1F) << 3)) >> 3]);
                fs3 = (+f[(fp + (((ins >> 27) & 0x1F) << 3)) >> 3]);
                f[(fp + (((ins >> 7) & 0x1F) << 3)) >> 3] = fs1 * fs2 + fs3;
                continue;

            case 0x47:
                // fmsub.d, fmsub.s
                fs1 = (+f[(fp + (((ins >> 15) & 0x1F) << 3)) >> 3]);
                fs2 = (+f[(fp + (((ins >> 20) & 0x1F) << 3)) >> 3]);
                fs3 = (+f[(fp + (((ins >> 27) & 0x1F) << 3)) >> 3]);
                f[(fp + (((ins >> 7) & 0x1F) << 3)) >> 3] = fs1 * fs2 - fs3;
                continue;

            case 0x4B:
                // fnmadd.d, fnmadd.s
                fs1 = (+f[(fp + (((ins >> 15) & 0x1F) << 3)) >> 3]);
                fs2 = (+f[(fp + (((ins >> 20) & 0x1F) << 3)) >> 3]);
                fs3 = (+f[(fp + (((ins >> 27) & 0x1F) << 3)) >> 3]);
                f[(fp + (((ins >> 7) & 0x1F) << 3)) >> 3] = -(fs1 * fs2 + fs3);
                continue;

            case 0x4F:
                // fnmsub.d, fnmsub.s
                fs1 = (+f[(fp + (((ins >> 15) & 0x1F) << 3)) >> 3]);
                fs2 = (+f[(fp + (((ins >> 20) & 0x1F) << 3)) >> 3]);
                fs3 = (+f[(fp + (((ins >> 27) & 0x1F) << 3)) >> 3]);
                f[(fp + (((ins >> 7) & 0x1F) << 3)) >> 3] = -(fs1 * fs2 - fs3);
                continue;

            case 0x2F:
                // amoswap, amoadd, amoxor, amoand, amoor, amomin, amomax, amominu, amomaxu
                rs1 = r[((ins >> 13) & 0x7C) >> 2]|0;
                rs2 = r[((ins >> 18) & 0x7C) >> 2]|0;
                paddr = TranslateVM(rs1|0, VM_READ)|0;
                if ((paddr|0) == -1) continue;
                switch ((ins >> 27)&0x1F) {

                    case 0x01:
                        // amoswap
                        r[((ins >> 5) & 0x7C) >> 2] = ram[(ramp + paddr) >> 2]|0;
                        ram[(ramp + paddr) >> 2] = rs2|0;
                        paddr = TranslateVM(rs1|0, VM_WRITE)|0;
                        if ((paddr|0) == -1) continue;
                        r[0] = 0;
                        continue;

                    case 0x00:
                        // amoadd
                        r[((ins >> 5) & 0x7C) >> 2] = ram[(ramp + paddr) >> 2]|0;
                        paddr = TranslateVM(rs1|0, VM_WRITE)|0;
                        if ((paddr|0) == -1) continue;
                        ram[(ramp + paddr) >> 2] = ((r[((ins >> 5) & 0x7C) >> 2]|0) + (rs2|0))|0;
                        r[0] = 0;
                        continue;

                    case 0x04:
                        // amoxor
                        r[((ins >> 5) & 0x7C) >> 2] = ram[(ramp + paddr) >> 2]|0;
                        paddr = TranslateVM(rs1|0, VM_WRITE)|0;
                        if ((paddr|0) == -1) continue;
                        ram[(ramp + paddr) >> 2] = ((r[((ins >> 5) & 0x7C) >> 2]|0) ^ (rs2|0))|0;
                        r[0] = 0;
                        continue;

                    case 0x0C:
                        // amoand
                        r[((ins >> 5) & 0x7C) >> 2] = ram[(ramp + paddr) >> 2]|0;
                        paddr = TranslateVM(rs1|0, VM_WRITE)|0;
                        if ((paddr|0) == -1) continue;
                        ram[(ramp + paddr) >> 2] = ((r[((ins >> 5) & 0x7C) >> 2]|0) & (rs2|0))|0;
                        r[0] = 0;
                        continue;

                    case 0x08:
                        // amoor
                        r[((ins >> 5) & 0x7C) >> 2] = ram[(ramp + paddr) >> 2]|0;
                        paddr = TranslateVM(rs1|0, VM_WRITE)|0;
                        if ((paddr|0) == -1) continue;
                        ram[(ramp + paddr) >> 2] = ((r[((ins >> 5) & 0x7C) >> 2]|0) | (rs2|0))|0;
                        r[0] = 0;
                        continue;

                    case 0x10:
                        // amomin
                        r[((ins >> 5) & 0x7C) >> 2] = ram[(ramp + paddr) >> 2]|0;
                        if ((rs2 >> 0) > (r[((ins >> 5) & 0x7C) >> 2] >> 0))
                            r[0] = r[((ins >> 5) & 0x7C) >> 2];
                        else
                            r[0] = rs2;
                        paddr = TranslateVM(rs1|0, VM_WRITE)|0;
                        if ((paddr|0) == -1) continue;
                        ram[(ramp + paddr) >> 2] = r[0]|0;
                        r[0] = 0;
                        continue;

                   case 0x14:
                        // amomax
                        r[((ins >> 5) & 0x7C) >> 2] = ram[(ramp + paddr) >> 2]|0;
                        if ((rs2 >> 0) < (r[((ins >> 5) & 0x7C) >> 2] >> 0))
                            r[0] = r[((ins >> 5) & 0x7C) >> 2];
                        else
                            r[0] = rs2;
                        paddr = TranslateVM(rs1|0, VM_WRITE)|0;
                        if ((paddr|0) == -1) continue;
                        ram[(ramp + paddr) >> 2] = r[0]|0;
                        r[0] = 0;
                        continue;

                    case 0x18:
                        // amominu
                        r[((ins >> 5) & 0x7C) >> 2] = ram[(ramp + paddr) >> 2]|0;
                        if ((rs2 >>> 0) > (r[((ins >> 5) & 0x7C) >> 2] >>> 0))
                            r[0] = r[((ins >> 5) & 0x7C) >> 2];
                        else
                            r[0] = rs2;
                        paddr = TranslateVM(rs1|0, VM_WRITE)|0;
                        if ((paddr|0) == -1) continue;
                        ram[(ramp + paddr) >> 2] = r[0]|0;
                        r[0] = 0;
                        continue;

                    case 0x1C:
                        // amomaxu
                        r[((ins >> 5) & 0x7C) >> 2] = ram[(ramp + paddr) >> 2]|0;
                        if ((rs2 >>> 0) < (r[((ins >> 5) & 0x7C) >> 2] >>> 0))
                            r[0] = r[((ins >> 5) & 0x7C) >> 2];
                        else
                            r[0] = rs2;
                        paddr = TranslateVM(rs1|0, VM_WRITE)|0;
                        if ((paddr|0) == -1) continue;
                        ram[(ramp + paddr) >> 2] = r[0]|0;
                        r[0] = 0;
                        continue;

                    case 0x02:
                        // lr.d
                        r[((ins >> 5) & 0x7C) >> 2] = ram[(ramp + paddr) >> 2]|0;
                        amoaddr = rs1;
                        amovalue = r[((ins >> 5) & 0x7C) >> 2]|0;
                        r[0] = 0;
                        continue;

                    case 0x03:
                        // sc.d
                        if ((rs1|0) != (amoaddr|0)) {
                            r[((ins >> 5) & 0x7C) >> 2] = 0x01;
                            continue;
                        }
                        if ((ram[(ramp + paddr) >> 2]|0) != (amovalue|0)) {
                            r[((ins >> 5) & 0x7C) >> 2] = 0x01;
                            continue;
                        }
                        r[((ins >> 5) & 0x7C) >> 2] = 0x00;
                        paddr = TranslateVM(rs1, VM_WRITE)|0;
                        if ((paddr|0) == -1) continue;
                        ram[(ramp + paddr) >> 2] = rs2|0;
                        r[0] = 0;
                        continue;

                    default:
                        DebugMessage(ERROR_ATOMIC_INSTRUCTION|0);
                        abort();
                        break;

                }
                continue;

            case 0x0F:
                //fence
                continue;

            case 0x0: // this line removes one assembler instruction (sub) from the main loop
            default:
                DebugMessage(ERROR_INSTRUCTION_NOT_FOUND|0);
                DebugMessage(ins|0);
                abort();
                break;
        } // end of switch

    } else { // fence

        // pc_change is set to one when pc is calculated in instrctions like branch, jump etc
        if (!(pc_change|0)) pc = pcorigin + (ppc-ppcorigin)|0;

        dsteps = dsteps - ((ppc-ppcorigin) >> 2)|0;
        if ((dsteps|0) < 0) {

            dsteps = dsteps + 64|0;
            steps = steps - 64|0;

            // fence == ppc still valid, so this part will be executed automatically next time
            if ((steps|0) < 0) return 0;

            delta = (csr[(csrp + CSR_MTIMECMP)>>2]|0) - ticks | 0;
            delta = delta + ((delta|0)<0?0xFFFFFFFF:0x0) | 0;
            ticks = ticks + clockspeed|0;

            if ((delta|0) < (clockspeed|0)) {
                csr[(csrp + CSR_MIP)>>2] = csr[(csrp + CSR_MIP)>>2] | 0x20;
            }

            // check for interrupts
            current_privilege_level = (csr[(csrp + CSR_MSTATUS)>>2] & 0x06) >> 1;

            interrupts = csr[(csrp + CSR_MIE)>>2] & csr[(csrp + CSR_MIP)>>2];
            ie = csr[(csrp + CSR_MSTATUS)>>2] & 0x01;

            if (((current_privilege_level|0) < 3) | (((current_privilege_level|0) == 3) & (ie|0))) {
                if (((interrupts|0) & 0x8)) {
                    Trap(CAUSE_SOFTWARE_INTERRUPT, pc);
                    continue;
                } else
                if (queue_status|0) {
                    Trap(CAUSE_HOST_INTERRUPT, pc);
                    queue_status = 0;
                    continue;
                }
            }
            if (((current_privilege_level|0) < 1) | (((current_privilege_level|0) == 1) & (ie|0))) {
                if (((interrupts|0) & 0x2)) {
                    Trap(CAUSE_SOFTWARE_INTERRUPT, pc);
                    continue;
                } else
                if (((interrupts|0) & 0x20)) {
                     Trap(CAUSE_TIMER_INTERRUPT, pc);
                     continue;
                }
            }
        } // dsteps

        // get new instruction pointer
        if ((instlb_index ^ pc) & 0xFFFFF000) {
            ppc = TranslateVM(pc|0, VM_FETCH)|0;
            if ((ppc|0) == -1) {
                ppc = fence;
                continue;
            }
            instlb_index = pc;
            instlb_entry = (ppc ^ pc) & 0xFFFFF000;
        }

        ppc = ramp + (instlb_entry ^ pc)| 0;
        ppcorigin = ppc;
        pcorigin = pc;
        fence  = ((ppc >> 12) + 1) << 12; // next page
        pc_change = 0;

    } // end of fence
    } // main loop

    return 0;
};

return {
    Reset: Reset,
    Init: Init,
    InvalidateTLB: InvalidateTLB,
    Step: Step,
    TranslateVM: TranslateVM,
    GetCSR: GetCSR,
    SetCSR: SetCSR,
    GetTimeToNextInterrupt: GetTimeToNextInterrupt,
    ProgressTime: ProgressTime,
    GetTicks: GetTicks,
    GetPC: GetPC,
    AnalyzeImage: AnalyzeImage,
    RaiseInterrupt: RaiseInterrupt,
    ClearInterrupt: ClearInterrupt
};

}

module.exports = FastCPU;

},{"../messagehandler":33,"../utils":48,"./disassemble":40}],42:[function(require,module,exports){
// -------------------------------------------------
// -------------------- HTIF -----------------------
// -------------------------------------------------

"use strict";
var message = require('../messagehandler');
var utils = require('../utils');
var bzip2 = require('../bzip2');
var syscalls = require('./syscalls');

// -------------------------------------------------

function StringToBytes(str, ram, offset) {
    for(var i=0; i<str.length; i++) {
        ram.Write8(offset+i, str.charCodeAt(i));
    }
    ram.Write8(offset+str.length, 0);
}

// -------------------------------------------------


function HTIFFB(ram, SendFunc) {
    this.ram = ram;
    this.identify = "rfb";
    this.Send = SendFunc;
    this.width = 640;
    this.height = 400;
    this.paddr = 0x0;

    this.Read = function(value) {
        this.width  = (value >>  0)&0xFFFF;
        this.height = (value >> 16)&0xFFFF;
        this.n = (this.width * this.height)>>1;
        this.buffer = new Int32Array(this.n);
        this.Send(3, 0, 1);
    }

    this.Write = function(value) {
        this.paddr = value;
        this.Send(3, 1, 1);
    }

    this.OnGetFB = function() {
        if (this.paddr == 0x0) return;
        //message.Send("GetFB", this.GetBuffer() );
    }

    this.GetBuffer = function () {
        var i=0, n = this.buffer.length;
        var data = this.buffer;
        var mem = this.ram.int32mem;
        var addr = this.paddr>>2;
        for (i = 0; i < n; ++i) {
            data[i] = mem[addr+i];
        }
        return this.buffer;
    }

    message.Register("GetFB", this.OnGetFB.bind(this) );
};


// -------------------------------------------------

function HTIFConsole(ram, SendFunc) {
    this.ram = ram;
    this.identify = "bcd";
    this.Send = SendFunc;
    this.charqueue = [];
    this.readpresent = true;

    this.Read = function(value) {
        //message.Debug("Read char: " + value);
        this.readpresent = true;
        if (this.charqueue.length == 0) return;
        this.Send(1, 0, this.charqueue.shift());
        this.readpresent = false;
    }

    this.Write = function(value) {
        this.ram.Write8(0x03000000 >> 0, value);
        if (value == 0xA) this.ram.Write8(0x03000000 >> 0, 0xD);
        //this.Send(1, 1, 1);
    }

    this.ReceiveChar = function(c) {
        this.charqueue = this.charqueue.concat(c);
        //message.Debug("chars received: " + c);
        if (!this.readpresent) return;
        this.Send(1, 0, this.charqueue.shift());
        this.readpresent = false;

    }

    message.Register("htif.term0.Transfer", this.ReceiveChar.bind(this) );

};

// -------------------------------------------------

function HTIFSyscall(ram, SendFunc) {
    this.ram = ram;
    this.Send = SendFunc;
    this.syscallHandler = new syscalls(this.ram);
    this.identify = "syscall_proxy";

    this.Read = function(value) {
        if((value>>>0) > 0x100) {
            this.syscallHandler.HandleSysCall(value);
        } else {
            this.ram.Write8(0x03000000 >> 0, value+0x30);
            message.Debug("return value: " + value);
            message.Abort();
       }
       this.Send(0, 0, 1);
    }

};

// -------------------------------------------------

function HTIFDisk(ram, SendFunc) {
    this.ram = ram;
    this.Send = SendFunc;
    this.buffer = new Uint8Array(1024*1024);
    this.identify = "disk size="+this.buffer.length;
    
    utils.LoadBinaryResourceII("../riscv-sys/ext2fsimage.bz2", 
    function(buffer) {
        this.buffer = new Uint8Array(20*1024*1024);

        var length = 0;
        var buffer8 = new Uint8Array(buffer);
	bzip2.simple(buffer8, function(x){this.buffer[length++] = x;}.bind(this));

        this.identify = "disk size="+this.buffer.length;   
    }.bind(this)
    , false, function(error){throw error;});

    this.Read = function(value) {
        var addr   = this.ram.Read32(value + 0);
        var offset = this.ram.Read32(value + 8);
        var size   = this.ram.Read32(value + 16);
        var tag    = this.ram.Read32(value + 24);
        //message.Debug("" + utils.ToHex(addr) + " " + utils.ToHex(offset) + " " + size + " " + tag);
        for(var i=0; i<size; i++) {
            this.ram.Write8(addr+i, this.buffer[offset+i]);
        }
        this.Send(2, 0, tag);
    }

    this.Write = function(value) {
        var addr   = this.ram.Read32(value + 0);
        var offset = this.ram.Read32(value + 8);
        var size   = this.ram.Read32(value + 16);
        var tag    = this.ram.Read32(value + 24);
        //message.Debug("" + utils.ToHex(addr) + " " + utils.ToHex(offset) + " " + size + " " + tag);
        for(var i=0; i<size; i++) {
            this.buffer[offset+i] = this.ram.Read8(addr+i);
        }
        this.Send(2, 1, tag);
    }
};

// -------------------------------------------------


// constructor
function HTIF(ram, irqdev) {
    this.ram = ram;
    this.irqdev = irqdev;
    
    this.device = [];

    this.device.push( new HTIFSyscall(this.ram, this.Send.bind(this)) ); // dev 0
    this.device.push( new HTIFConsole(this.ram, this.Send.bind(this)) ); // dev 1
    //this.device.push( new HTIFDisk   (this.ram, this.Send.bind(this)) ); // dev 2
    //this.device.push( new HTIFFB     (this.ram, this.Send.bind(this)) ); // dev 3

    this.devid = 0x0;
    this.cmd = 0x0;

    this.reg_tohost = 0x0;
    this.reg_devcmdfromhost = 0x0;

    this.fromhostqueue = [];
}

HTIF.prototype.Send = function(devid, cmd, data) {
    //message.Debug("Send " + devid + " " + cmd + " " + data);
    this.fromhostqueue.push({
        devid: devid,
        cmd: cmd,
        data: data});

    if (this.fromhostqueue.length == 1)
        this.reg_devcmdfromhost =
            (this.fromhostqueue[0].devid << 24) | (this.fromhostqueue[0].cmd << 16);

    this.irqdev.RaiseInterrupt(0x1);
}

// -------------------------------------------------

HTIF.prototype.ReadDEVCMDToHost = function() {
    //message.Debug("ReadDEVCMDToHost 0x0");
    // ready to receive data
    return 0x0;
}

HTIF.prototype.ReadToHost = function() {
    //message.Debug("ReadToHost 0x0");
    // ready to receive data
    return 0x0;
}

// -------------------------------------------------

HTIF.prototype.WriteDEVCMDToHost = function(value) {
    //message.Debug("WriteDEVCMDToHost " + utils.ToHex(value));
    this.devid = value >>> 24;
    this.cmd = (value >> 16) & 0xFF;
}

HTIF.prototype.WriteToHost = function(value) {
    //message.Debug("WriteToHost dev:" + this.devid + " cmd:" + this.cmd + " data:" + utils.ToHex(value));
    this.reg_tohost = value|0;
    this.HandleRequest();
}

// -------------------------------------------------

HTIF.prototype.ReadDEVCMDFromHost = function() {
    //message.Debug("ReadDEVCMDFromHost");
    if (this.fromhostqueue.length != 0)
        return this.reg_devcmdfromhost;
    else
        return 0x0;
}

HTIF.prototype.ReadFromHost = function() {
    //message.Debug("ReadFromHost " + this.fromhostqueue.length);
   
    if (this.fromhostqueue.length != 0)
        return this.fromhostqueue[0].data; 
    else
        return 0x0;
}

// -------------------------------------------------

HTIF.prototype.WriteDEVCMDFromHost = function(value) {
    //message.Debug("WriteDEVCMDFromHost: " + value);
    this.reg_devcmdfromhost = value;
    return;
}

HTIF.prototype.WriteFromHost = function(value) {
    //message.Debug("WriteFromHost data:" + value);

    if ((value == 0) && (this.reg_devcmdfromhost == 0)) {
        this.fromhostqueue.shift();

        if (this.fromhostqueue.length > 0) {
            this.reg_devcmdfromhost =
                (this.fromhostqueue[0].devid << 24) | (this.fromhostqueue[0].cmd << 16);
            this.irqdev.RaiseInterrupt(0x1);
        } else {
            this.irqdev.ClearInterrupt(0x1);
        }
    }
}

// ------------------------------------------------

HTIF.prototype.IsQueueEmpty = function() {
    return (this.fromhostqueue.length == 0)?true:false;
}


HTIF.prototype.HandleRequest = function() {

    //if (this.devid != 1)
    //    message.Debug("dev:" + this.devid + " cmd:" + this.cmd + " " + utils.ToHex(this.reg_tohost));

    if (this.cmd == 255) { // identify
        var pid = this.reg_tohost;

        if (!this.device[this.devid]) {
            this.ram.Write8(pid+0, 0x00);
        } else {
            StringToBytes(this.device[this.devid].identify, this.ram, pid);
        }
        this.Send(this.devid, 255, 1);
        this.reg_tohost = 0;
        return;
    }

    if (this.cmd == 0) { // read

        if (!this.device[this.devid]) {
            message.Debug("Error in HTIF: unknown read from device");
            message.Abort();
        } else {
            this.device[this.devid].Read(this.reg_tohost);
        }
        this.reg_tohost = 0;
        return;
    }

    if (this.cmd == 1) { // write
        
        if (!this.device[this.devid]) {
            message.Debug("Error in HTIF: unknown write from device");
            message.Abort();
        } else {
            this.device[this.devid].Write(this.reg_tohost);
        }
        this.reg_tohost = 0;
        return;
    }

    message.Debug("Error HTIF: unknown request");
    message.Abort();
}			

module.exports = HTIF;

},{"../bzip2":2,"../messagehandler":33,"../utils":48,"./syscalls":45}],43:[function(require,module,exports){
/* this is a unified, abstract interface (a facade) to the different
 * CPU implementations
 */

"use strict";
var message = require('../messagehandler'); // global variable
var utils = require('../utils');
var imul = require('../imul');

// CPUs
var SafeCPU = require('./safecpu');
var FastCPU = require('./fastcpu');

var stdlib = {
    Int32Array : Int32Array,
    Int8Array : Int8Array,
    Int16Array : Int16Array,
    Float32Array : Float32Array,
    Float64Array : Float64Array,
    Uint8Array : Uint8Array,
    Uint16Array : Uint16Array,
    Math : Math
};

async function createCPU(cpuname, ram, htif, heap, ncores) {
    var cpu = null;
    var foreign = {
        DebugMessage: message.Debug,
        abort : message.Abort,
        imul : Math.imul || imul,
        MathAbs : Math.abs,
        Read32 : ram.Read32Little.bind(ram),
        Write32 : ram.Write32Little.bind(ram),
        Read16 : ram.Read16Little.bind(ram),
        Write16 : ram.Write16Little.bind(ram),
        Read8 : ram.Read8Little.bind(ram),
        Write8 : ram.Write8Little.bind(ram),
        ReadDEVCMDToHost : htif.ReadDEVCMDToHost.bind(htif),
        ReadDEVCMDFromHost : htif.ReadDEVCMDFromHost.bind(htif),
        WriteDEVCMDToHost : htif.WriteDEVCMDToHost.bind(htif),
        WriteDEVCMDFromHost : htif.WriteDEVCMDFromHost.bind(htif),
        ReadToHost : htif.ReadToHost.bind(htif),
        ReadFromHost : htif.ReadFromHost.bind(htif),
        WriteToHost : htif.WriteToHost.bind(htif),
        WriteFromHost : htif.WriteFromHost.bind(htif),
    };

    if (cpuname === "safe") {
        return new SafeCPU(ram, htif);
    }
    if (cpuname === "asm") {
        cpu = FastCPU(stdlib, foreign, heap);
        cpu.Init();
        return cpu;
    }
    if (cpuname === "wasm") {
        cpu = await createCPUWasm(cpuname, ram, htif, heap, ncores);
        cpu.Init();
        return cpu;
    }
    throw new Error("invalid CPU name:" + cpuname);
}

function CPU(cpuname, ram, htif, heap, ncores) {
    this.name = cpuname;
    this.ncores = ncores;
    this.ram = ram;
    this.heap = heap;
    this.htif = htif;
    this.littleendian = true;
    return this;
}

async function createCPUWasm(cpuname, ram, htif, heap, ncores) {
    let importObj = {
        env: {
            memory : ram.memory,
            DebugMessage: message.Debug,
            abort : message.Abort,
            Read32 : ram.Read32Little.bind(ram),
            Write32 : ram.Write32Little.bind(ram),
            Read16 : ram.Read16Little.bind(ram),
            Write16 : ram.Write16Little.bind(ram),
            Read8 : ram.Read8Little.bind(ram),
            Write8 : ram.Write8Little.bind(ram),
            HtifReadDEVCMDToHost : htif.ReadDEVCMDToHost.bind(htif),
            HtifReadDEVCMDFromHost : htif.ReadDEVCMDFromHost.bind(htif),
            HtifWriteDEVCMDToHost : htif.WriteDEVCMDToHost.bind(htif),
            HtifWriteDEVCMDFromHost : htif.WriteDEVCMDFromHost.bind(htif),
            HtifReadToHost : htif.ReadToHost.bind(htif),
            HtifReadFromHost : htif.ReadFromHost.bind(htif),
            HtifWriteToHost : htif.WriteToHost.bind(htif),
            HtifWriteFromHost : htif.WriteFromHost.bind(htif),
        }
    };
    let response = await fetch('riscv.wasm');
    let obj = await WebAssembly.instantiate(await response.arrayBuffer(), importObj);
    let exports = obj.instance.exports;
    return {
      AnalyzeImage : exports.AnalyzeImage,
      ClearInterrupt : exports.ClearInterrupt,
      GetFlags : exports.GetFlags,
      GetStat : exports.GetStat,
      GetTicks : exports.GetTicks,
      GetTimeToNextInterrupt : exports.GetTimeToNextInterrupt,
      GetPC : exports.GetPC,
      Init : exports.Init,
      InvalidateTLB : exports.InvalidateTLB,
      ProgressTime : exports.ProgressTime,
      RaiseInterrupt : exports.RaiseInterrupt,
      Reset : exports.Reset,
      SetFlags : exports.SetFlags,
      Step : exports.Step
    };
}

CPU.prototype.Init = async function() {
    this.cpu = await createCPU(this.name, this.ram, this.htif, this.heap, this.ncores);
};


CPU.prototype.switchImplementation = function(cpuname) {
};

CPU.prototype.toString = function() {
    var r = new Int32Array(this.heap, 0x0);
    var csr = new Uint32Array(this.heap, 0x2000);
    var str = '';
    str += "Current state of the machine\n";

    if (typeof this.cpu.pc != 'undefined') {
        str += "PC: " + utils.ToHex(this.cpu.pc) + "\n";
    } else {
        str += "PC: " + utils.ToHex(this.cpu.GetPC()) + "\n";
    }

    for (var i = 0; i < 32; i += 4) {
        str += "   r" + (i + 0) + ": " +
            utils.ToHex(r[i + 0]) + "   r" + (i + 1) + ": " +
            utils.ToHex(r[i + 1]) + "   r" + (i + 2) + ": " +
            utils.ToHex(r[i + 2]) + "   r" + (i + 3) + ": " +
            utils.ToHex(r[i + 3]) + "\n";
    }
    str += "mstatus: " + utils.ToBin(csr[0x300]) + "\n";
    str +=
        "mcause: " + utils.ToHex(csr[0x342]) +
        " mbadaddress: " + utils.ToHex(csr[0x343]) +
        " mepc: " + utils.ToHex(csr[0x341]) + "\n";
    return str;
};

// forward a couple of methods to the CPU implementation
var forwardedMethods = [
    "Reset",
    "Step",
    "RaiseInterrupt",
    "Step",
    "AnalyzeImage",
    "GetTicks",
    "GetTimeToNextInterrupt",
    "ProgressTime",
    "ClearInterrupt"];
forwardedMethods.forEach(function(m) {
    CPU.prototype[m] = function() {
        return this.cpu[m].apply(this.cpu, arguments);
    };
});

module.exports = CPU;

},{"../imul":30,"../messagehandler":33,"../utils":48,"./fastcpu":41,"./safecpu":44}],44:[function(require,module,exports){
// -------------------------------------------------
// -------------------- CPU ------------------------
// -------------------------------------------------

"use strict";
var message = require('../messagehandler');
var utils = require('../utils');
var DebugIns = require('./disassemble');

var PRV_U = 0x00;  // user mode
var PRV_S = 0x01;  // supervisor mode
var PRV_H = 0x02;  // hypervisor mode
var PRV_M = 0x03;  // machine mode

var VM_READ  = 0;
var VM_WRITE = 1;
var VM_FETCH = 2;

var CAUSE_MISALIGNED_FETCH    = 0x0;
var CAUSE_FETCH_ACCESS        = 0x1;
var CAUSE_ILLEGAL_INSTRUCTION = 0x2;
var CAUSE_BREAKPOINT          = 0x3;
var CAUSE_MISALIGNED_LOAD     = 0x4;
var CAUSE_LOAD_ACCESS         = 0x5;
var CAUSE_MISALIGNED_STORE    = 0x6;
var CAUSE_STORE_ACCESS        = 0x7;
var CAUSE_USER_ECALL          = 0x8;
var CAUSE_SUPERVISOR_ECALL    = 0x9;
var CAUSE_HYPERVISOR_ECALL    = 0xa;
var CAUSE_MACHINE_ECALL       = 0xb;
var CAUSE_FETCH_PAGE_FAULT    = 0xc;
var CAUSE_LOAD_PAGE_FAULT     = 0xd;
var CAUSE_STORE_PAGE_FAULT    = 0xf;

var MSTATUS_UIE     = 0x00000001; // interrupt enable bits
var MSTATUS_SIE     = 0x00000002;
var MSTATUS_HIE     = 0x00000004;
var MSTATUS_MIE     = 0x00000008; // machine
var MSTATUS_UPIE    = 0x00000010; // interrupt-enable bit active prior to the trap
var MSTATUS_SPIE    = 0x00000020;
var MSTATUS_HPIE    = 0x00000040;
var MSTATUS_MPIE    = 0x00000080;
var MSTATUS_SPP     = 0x00000100; // previous privilege  mode
var MSTATUS_HPP     = 0x00000600;
var MSTATUS_MPP     = 0x00001800; // privilege mode
var MSTATUS_FS      = 0x00006000; // tracking current state of floating point unit
var MSTATUS_XS      = 0x00018000; // status of user-mode extensions
var MSTATUS_MPRV    = 0x00020000; // priviege level at which loads and stores execute
var MSTATUS_SUM     = 0x00040000; // supervisor may access user memory
var MSTATUS_MXR     = 0x00080000; // make executable readable
var MSTATUS_TVM     = 0x00100000;
var MSTATUS_TW      = 0x00200000;
var MSTATUS_TSR     = 0x00400000;
var MSTATUS_SD      = 0x80000000;

var SPTBR_MODE_OFF  = 0;
var SPTBR_MODE_SV32 = 1;
var SPTBR32_MODE = 0x80000000;
var SPTBR32_ASID = 0x7FC00000;
var SPTBR32_PPN  = 0x003FFFFF;

// page table entry (PTE) fields
var PTE_V     = 0x001 // Valid
var PTE_R     = 0x002 // Read
var PTE_W     = 0x004 // Write
var PTE_X     = 0x008 // Execute
var PTE_U     = 0x010 // User
var PTE_G     = 0x020 // Global
var PTE_A     = 0x040 // Accessed
var PTE_D     = 0x080 // Dirty
var PTE_SOFT  = 0x300 // Reserved for Software

var IRQ_S_SOFT  = 1;
var IRQ_H_SOFT  = 2;
var IRQ_M_SOFT  = 3;
var IRQ_S_TIMER = 5;
var IRQ_H_TIMER = 6;
var IRQ_M_TIMER = 7;
var IRQ_S_EXT   = 9;
var IRQ_H_EXT   = 10;
var IRQ_M_EXT   = 11;
var IRQ_COP     = 12; // computer operating properly
var IRQ_HOST    = 13;

var MIP_SSIP = (1 << IRQ_S_SOFT);
var MIP_HSIP = (1 << IRQ_H_SOFT);
var MIP_MSIP = (1 << IRQ_M_SOFT);
var MIP_STIP = (1 << IRQ_S_TIMER);
var MIP_HTIP = (1 << IRQ_H_TIMER);
var MIP_MTIP = (1 << IRQ_M_TIMER);
var MIP_SEIP = (1 << IRQ_S_EXT);
var MIP_HEIP = (1 << IRQ_H_EXT);
var MIP_MEIP = (1 << IRQ_M_EXT);

// User CSRs standard read/write
var CSR_FFLAGS    = 0x001; // Floating-Point Accrued Exceptions
var CSR_FRM       = 0x002; // Floating-Point Dynamic Rounding Mode
var CSR_FCSR      = 0x003; // Floating-Point Control and Status Register

// Supervisor CSRs standard read/write
var CSR_SSTATUS    = 0x100; // Supervisor status register
var CSR_SIE        = 0x104; // Supervisor interrupt-enable register
var CSR_STVEC      = 0x105; // Supervisor trap handler base address.
var CSR_SCOUNTEREN = 0x106; // machine counter enable register (supervisor)
var CSR_SSCRATCH   = 0x140; // Scratch register for supervisor trap handlers.
var CSR_SEPC       = 0x141; // Supervisor exception program counter
var CSR_SCAUSE     = 0x142; // Supervisor trap cause
var CSR_SBADADDR   = 0x143; // Supervisor bad address
var CSR_SIP        = 0x144; // Supervisor interrupt pending
var CSR_SPTBR      = 0x180; // Page-table base register

// Hypervisor CSR standard read/write
var CSR_HEPC      = 0x241; // Hypervisor exception program counte

// Machine CSRs standard read/write
var CSR_MSTATUS   = 0x300; // Machine status register
var CSR_MISA      = 0x301; // ISA and extensions supported
var CSR_MEDELEG   = 0x302; // Machine exception delegation register.
var CSR_MIDELEG   = 0x303; // Machine interrupt delegation register.
var CSR_MIE       = 0x304; // Machine interrupt-enable register
var CSR_MTVEC     = 0x305; // Machine trap-handler base address.

var CSR_MCOUNTEREN = 0x306; // machine counter enable register (user)

var CSR_MSCRATCH  = 0x340; // Scratch register for machine trap handlers
var CSR_MEPC      = 0x341; // Machine exception program counter
var CSR_MCAUSE    = 0x342; // Machine trap cause
var CSR_MBADADDR  = 0x343; // Machine bad address
var CSR_MIP       = 0x344; // Machine interrupt pending

var CSR_PMPCFG0   = 0x3a0;
var CSR_PMPADDR0  = 0x3b0;

// Machine CSRs standard read/write and unknown
var CSR_MRESET    = 0x782;
var CSR_SEND_IPI  = 0x783;

// debug tdata1
var CSR_TDATA1  = 0x7A1;

// user CSRs standard read only
var CSR_CYCLE     = 0xC00; // Cycle counter for RDCYCLE instruction
var CSR_TIME      = 0xC01; // Timer for RDTIME instruction
var CSR_INSTRET   = 0xC02; // Instructions-retired counter for RDINSTRET instruction
var CSR_CYCLEH    = 0xC80; // Upper 32 bits of cycle, RV32I only
var CSR_TIMEH     = 0xC81; // Upper 32 bits of time, RV32I only
var CSR_INSTRETH  = 0xC82; // Upper 32 bits of instret, RV32I only

// This is a special CSR just for this emulator to connect the CLINT to the CPU
// because the timer is handled in the CPU part
var CSR_TIMECMP   = 0xC41;

// machine CSRs non-standard read-only
//var CSR_MCPUID    = 0xF00;
//var CSR_MIMPID    = 0xF01;
var CSR_MHARTID   = 0xF14;

var QUIET_NAN = 0xFFFFFFFF;
var SIGNALLING_NAN = 0x7FFFFFFF;

// constructor
function SafeCPU(ram, htif) {
    message.Debug("Initialize RISCV CPU");

    this.ram = ram;

    this.htif = htif;

    // registers
    this.r = new Int32Array(this.ram.heap, 0, 32);
    this.f = new Float64Array(this.ram.heap, 32<<2, 32); 
    this.fi = new Int32Array(this.ram.heap, 32<<2, 64); // for copying operations
    this.ff = new Float32Array(this.ram.heap, 0, 1); // the zero register is used to convert to single precision

    this.csr = new Int32Array(this.ram.heap, 0x2000, 4096);

    this.Reset();
}

function get_field(reg, mask) {
    var reg  = reg|0;
    var mask = mask|0;
    return ((reg & mask) / (mask & ~(mask << 1)))|0;
}

function set_field(reg, mask, val) {
    var reg  = reg | 0;
    var mask = mask | 0;
    var val  = val | 0;
    return (reg & ~mask) | ((val * (mask & ~(mask << 1))) & mask);
}

SafeCPU.prototype.Reset = function() {
    this.ticks = 0;
    this.prv = PRV_M;
    this.csr[CSR_MSTATUS]  = (0x0 << 24); // mbare vm mode, no mie, noe mprv
    this.csr[CSR_MHARTID]  = 0x00; // hardware thread id is fixed to zero (= cpu id)
    this.csr[CSR_MISA]     = (1<<8) | (1<<12) | (1<<0) | (1<<30) | (1<<5) | (1<<3); // base ISA, multiply mul/div, atomic instructions, 32-Bit, single precision, double precision
    this.csr[CSR_MCAUSE]   = 0x00; // cause of the reset, hard reset

    // for atomic load & store instructions
    this.amoaddr = 0x00;
    this.amovalue = 0x00;

    this.pc = 0x1000; // implementation defined start address, boot into ROM
}

SafeCPU.prototype.InvalidateTLB = function() {
    // No TLB
}

SafeCPU.prototype.GetTimeToNextInterrupt = function () {
    var delta = ((this.csr[CSR_TIMECMP]|0) - (this.ticks|0))|0;
    return delta|0;
}

SafeCPU.prototype.GetTicks = function () {
    return this.ticks | 0;
}

SafeCPU.prototype.ProgressTime = function (delta) {
    delta = delta | 0;
    this.ticks = this.ticks + delta | 0;
    this.csr[CSR_TIME] = this.ticks | 0;

    delta = this.csr[CSR_TIMECMP] - this.ticks | 0;
    if (delta <= 1) {
        this.csr[CSR_MIP] = this.csr[CSR_MIP] | MIP_STIP;
    }
    this.CheckForInterrupt();
}

// we haveto define these to copy the cpus
SafeCPU.prototype.AnalyzeImage = function() {
}

// Count number of contiguous 0 bits starting from the LSB.
function ctz(val)
{
    var res = 0;
    val = val | 0;
    if (val) {
        while ((val & 1) == 0) {
            val >>= 1;
            res++;
        }
    }
    return res;
}

SafeCPU.prototype.RaiseInterrupt = function (line, cpuid) {
    //message.Debug("raise int " + line);
    if (line == IRQ_S_EXT) {
        this.csr[CSR_MIP] |= MIP_SEIP; // EXT
    }
};

SafeCPU.prototype.ClearInterrupt = function (line, cpuid) {
    //message.Debug("clear int " + line);
    if (line == IRQ_S_EXT) {
        this.csr[CSR_MIP] &= ~MIP_SEIP; // EXT
    }
};

SafeCPU.prototype.CheckForInterrupt = function () {
    var pending_interrupts = this.csr[CSR_MIP] & this.csr[CSR_MIE];
/*
    var mie = (this.csr[CSR_MSTATUS] & MSTATUS_MIE) != 0;
    var m_enabled = this.prv < PRV_M || (this.prv == PRV_M && mie);
    var enabled_interrupts = pending_interrupts & ~this.csr[CSR_MIDELEG] & -m_enabled;

    var sie = (this.csr[CSR_MSTATUS] >> 1) & 1;
    var s_enabled = (this.prv < PRV_S) || ((this.prv == PRV_S) && sie);
    enabled_interrupts |= pending_interrupts & this.csr[CSR_MIDELEG] & -s_enabled;
*/

    var mie = get_field(this.csr[CSR_MSTATUS], MSTATUS_MIE);
    var m_enabled = ((this.prv < PRV_M) || ((this.prv == PRV_M) && mie))?1:0;
    var enabled_interrupts = pending_interrupts & ~this.csr[CSR_MIDELEG] & -m_enabled;

    if (enabled_interrupts == 0) {
        var sie = get_field(this.csr[CSR_MSTATUS], MSTATUS_SIE);
        var s_enabled = ((this.prv < PRV_S) || ((this.prv == PRV_S) && sie))?1:0;
        enabled_interrupts |= pending_interrupts & this.csr[CSR_MIDELEG] & -s_enabled;
    }

    if (enabled_interrupts) {
        //message.Debug("Take interrupt: " + ctz(enabled_interrupts));
        this.Trap(0x80000000 | ctz(enabled_interrupts), this.pc, -1);
    }
};


SafeCPU.prototype.Trap = function (cause, epc, addr) {
    cause = cause|0;
    epc = epc|0;
    addr = addr|0;

    //message.Debug("Trap cause=" + utils.ToHex(cause) + " at epc=" + utils.ToHex(epc));
    //message.Abort();

    // by default, trap to M-mode, unless delegated to S-mode
    var bit = cause;
    var deleg = this.csr[CSR_MEDELEG];
    var interrupt = (bit & (1<<31)) != 0;
    if (interrupt) {
        deleg = this.csr[CSR_MIDELEG];
        bit &= ~(1<<31);
    }
    if (this.prv <= PRV_S && bit < 32 && ((deleg >> bit) & 1)) {
        // handle the trap in S-mode
        this.pc = this.csr[CSR_STVEC];
        this.csr[CSR_SCAUSE] = cause;
        this.csr[CSR_SEPC] = epc;
        this.csr[CSR_SBADADDR] = addr;

        var s = this.csr[CSR_MSTATUS] | 0;
        s = set_field(s, MSTATUS_SPIE, get_field(s, MSTATUS_SIE))|0;
        s = set_field(s, MSTATUS_SPP, this.prv)|0;
        s = set_field(s, MSTATUS_SIE, 0)|0;
        this.csr[CSR_MSTATUS] = s;

        this.prv = PRV_S;
    } else {
        var vector = ((this.csr[CSR_MTVEC] & 1) && interrupt) ? bit*4 : 0;
        this.pc = (this.csr[CSR_MTVEC]&(~1)) + vector;
        this.csr[CSR_MEPC] = epc;
        this.csr[CSR_MCAUSE] = cause;
        this.csr[CSR_MBADADDR] = addr;

        var s = this.csr[CSR_MSTATUS] | 0;
        s = set_field(s, MSTATUS_MPIE, get_field(s, MSTATUS_MIE))|0;
        s = set_field(s, MSTATUS_MPP, this.prv)|0;
        s = set_field(s, MSTATUS_MIE, 0)|0;
        this.csr[CSR_MSTATUS] = s;

        this.prv = PRV_M;
    }

    this.amoaddr = 0x00;
    this.amovalue = 0x00;
};

SafeCPU.prototype.MemAccessTrap = function(addr, op) {
    switch(op) {
        case VM_READ:
            this.Trap(CAUSE_LOAD_PAGE_FAULT, this.pc - 4|0, addr);
            break;

        case VM_WRITE:
            this.Trap(CAUSE_STORE_PAGE_FAULT, this.pc - 4|0, addr);
            break;

        case VM_FETCH:
            this.Trap(CAUSE_FETCH_PAGE_FAULT, this.pc, addr);
            break;
    }
}


SafeCPU.prototype.CheckVMPrivilege = function (pte, op) {
    pte = pte | 0;
    op = op | 0;
    //var type = (pte >> 1) & 0xF;
    var supervisor = this.prv == PRV_S;
    var sum = this.csr[CSR_MSTATUS] & MSTATUS_SUM; // protect user memory
    var mxr = this.csr[CSR_MSTATUS] & MSTATUS_MXR; // make executable readable

    if (pte & PTE_U) {
        if (supervisor && !sum) {
            message.Debug("Illegal access from privilege mode at pc=" + utils.ToHex(this.pc) + " " + op);
            message.Abort();
            return false;
        }
    } else {
        if (!supervisor) return false;
    }

    // not valid or reserved for future use
    if (!(pte & PTE_V) || (!(pte & PTE_R) && (pte & PTE_W))) {
        //message.Debug("Unknown access from privilege mode at pc=" + utils.ToHex(this.pc) + " " + op);
        //message.Abort();
        return false;
    } 

    switch(op|0) {
        case VM_FETCH:
            return pte & PTE_X;

        case VM_READ:
            return (pte & PTE_R) || (mxr && (pte & PTE_X));

        case VM_WRITE:
            return (pte & PTE_R) && (pte & PTE_W);
    }
    message.Debug("Error in CheckVMPRivilege: unknown operation");
    message.Abort();
}


/* 
 * Translates a virtual address to a physical by walking through
 * the page table and checking  the rights
 */
SafeCPU.prototype.TranslateVM = function (addr, op) {
    op = op | 0;
    addr = addr | 0;
    var vm = (this.csr[CSR_SPTBR] >> 31) & 1;
    var PGSIZE = 4096;
    var PGMASK = ~(PGSIZE-1);
    var PGSHIFT = 12;
    var ptidxbits = 10;
    var ptesize = 4;

    // vm bare mode
    if (vm == SPTBR_MODE_OFF || this.prv == PRV_M) return addr;

    // LEVEL 1
    // get first entry in page table
    var base = (this.csr[CSR_SPTBR] & SPTBR32_PPN) << PGSHIFT;
    var pteaddr = base + ((addr >>> 22) << 2);
    var pte = this.ram.Read32(pteaddr) | 0;

    //message.Debug("VM Start " + utils.ToHex(addr) + " " + utils.ToHex(base) + " " + utils.ToHex(pte));
    /* check if pagetable is finished here */
    if ((pte & 0xF) != 0x1) {
        if (!this.CheckVMPrivilege(pte, op)) {
            this.MemAccessTrap(addr, op);
            return -1;
        }
        //this.ram.Write32(pteaddr, pte | PTE_A | ((op==VM_WRITE)?PTE_D:0));
        //message.Debug("VM L1 " + utils.ToHex(addr) + " " + utils.ToHex(base) + " " + utils.ToHex(((pte >> 10) << 12) | (addr&0x3FFFFF)));
        //message.Abort();
        return ((pte >> 10) << 12) | (addr&0x3FFFFF);
    }

    // LEVEL 2
    base = (pte & 0xFFFFFC00) << 2;
    var new_page_num = (addr >> 12) & 0x3FF;
    var pteaddr = base + (new_page_num << 2);

    pte = this.ram.Read32(pteaddr) | 0;
    //message.Debug("Level 2 " + utils.ToHex(addr) + " " + utils.ToHex(base) + " " + utils.ToHex(pte));
    //message.Abort();

    /* only 2 levels are allowed in 32-Bit mode */
    if ((pte & 0xF) == 0x1) {
        this.MemAccessTrap(addr, op);
        return -1;
    }

    if (!this.CheckVMPrivilege(pte, op)) {
        this.MemAccessTrap(addr, op);
        return -1;
    }
    //this.ram.Write32(pteaddr, pte | PTE_A | ((op==VM_WRITE)?PTE_D:0));
    //message.Debug("VM L2 " + utils.ToHex(addr) + " " + utils.ToHex(base) + " " + utils.ToHex( ((pte >> 10) << 12) | (addr & 0xFFF) ));
    //message.Abort();
    return ((pte >> 10) << 12) | (addr & 0xFFF);
};


SafeCPU.prototype.SetCSR = function (addr, value) {

    //message.Debug("SetCSR: Address:" + utils.ToHex(addr) + ", value " + utils.ToHex(value));
    var csr = this.csr;

    switch(addr)
    {
        case CSR_MSTATUS:
            if ((value ^ csr[CSR_MSTATUS]) & (MSTATUS_MPP | MSTATUS_MPRV | MSTATUS_SUM | MSTATUS_MXR)) {
                this.InvalidateTLB();
            }
            var mask = MSTATUS_SIE | MSTATUS_SPIE | MSTATUS_MIE | MSTATUS_MPIE
                     | MSTATUS_SPP | MSTATUS_FS | MSTATUS_MPRV | MSTATUS_SUM
                     | MSTATUS_MPP | MSTATUS_MXR | MSTATUS_TW | MSTATUS_TVM
                     | MSTATUS_TSR | MSTATUS_XS;
            csr[addr] = (value & ~mask) | (value & mask);
            var dirty = (csr[CSR_MSTATUS] & MSTATUS_FS) == MSTATUS_FS;
            dirty |= (csr[CSR_MSTATUS] & MSTATUS_XS) == MSTATUS_XS;
            csr[CSR_MSTATUS] = (csr[CSR_MSTATUS] & ~MSTATUS_SD) | (dirty?1<<MSTATUS_SD:0);
            break;

        case CSR_SSTATUS:
            csr[addr] = value;
            var mask = MSTATUS_SIE | MSTATUS_SPIE | MSTATUS_SPP | MSTATUS_FS | MSTATUS_XS | MSTATUS_SUM | MSTATUS_MXR;
            this.SetCSR(CSR_MSTATUS, (csr[CSR_MSTATUS] & ~mask) | (value & mask));
            break;

        case CSR_MIE:
            var mask = MIP_SSIP | MIP_STIP | MIP_SEIP | (1 << IRQ_COP) | MIP_MSIP | MIP_MTIP;
            csr[CSR_MIE] = (csr[CSR_MIE] & ~mask) | (value & mask);
            //message.Debug("Write MIE: " + utils.ToHex(csr[CSR_MIE]) + " at pc=" + utils.ToHex(this.pc));
            break;

        case CSR_SIE:
            csr[CSR_MIE] = (csr[CSR_MIE] & ~csr[CSR_MIDELEG]) | (value & csr[CSR_MIDELEG]);
            //message.Debug("Write SIE: " + utils.ToHex(csr[CSR_MIE]) + " at pc=" + utils.ToHex(this.pc));
            break;

        case CSR_MISA:
            // TODO: only a few bits can be changed
            csr[CSR_MISA] = value;
            break;

        case CSR_MIP:
            var mask = MIP_SSIP | MIP_STIP;
            csr[CSR_MIP] = (csr[CSR_MIP] & ~mask) | (value & mask);
            //message.Debug("Write MIP: " + utils.ToHex(csr[CSR_MIP]));
            break;

        case CSR_SEPC:
        case CSR_MEPC:
            csr[addr] = value;
            break;

        case CSR_SBADADDR:
            csr[addr] = value;
            break;

        case CSR_SCAUSE:
            csr[addr] = value;
            break;

        case CSR_FCSR:
        case CSR_MEDELEG:
        case CSR_MIDELEG:
        case CSR_MSCRATCH:
        case CSR_SSCRATCH:
            csr[addr] = value;
            break;

        case CSR_SPTBR:
            this.InvalidateTLB();
            csr[addr] = value & (SPTBR32_PPN | SPTBR32_MODE);
            break;

        case CSR_STVEC:
        case CSR_MTVEC:
            csr[addr] = value&(~3);
            break;


        case CSR_MCOUNTEREN:
        case CSR_SCOUNTEREN:
            csr[addr] = value;
            break;

        case CSR_TDATA1:
            csr[addr] = value;
            break;

/*
        case CSR_FRM:
            csr[addr] = value;
            break;

        case CSR_FFLAGS:
            csr[addr] = value;
            break;

*/

        case CSR_PMPCFG0:
        case CSR_PMPADDR0:
            csr[addr] = value;
            break;

        default:
            csr[addr] = value;
            message.Debug("Error in SetCSR: PC "+utils.ToHex(this.pc)+" Address " + utils.ToHex(addr) + " unkown");
            message.Abort();
            break;
    }
};

SafeCPU.prototype.GetCSR = function (addr) {

    //message.Debug("GetCSR: Address:" + utils.ToHex(addr));
    var csr = this.csr;
    switch(addr)
    {
        case CSR_FCSR:
            return 0x0;
            break;

        case CSR_MHARTID:
            return csr[addr];
            break;

        case CSR_MISA:
            return csr[addr];
            break;

        case CSR_SIE:
            return csr[CSR_MIE] & csr[CSR_MIDELEG];
            break;

        case CSR_MIE:
            return csr[addr];
            break;

        case CSR_SEPC:
        case CSR_MEPC:
        case CSR_MCAUSE:
        case CSR_SCAUSE:
        case CSR_MEDELEG:
        case CSR_MIDELEG:
        case CSR_MSTATUS:
        case CSR_MIP:
        case CSR_SBADADDR:
        case CSR_MBADADDR:
            return csr[addr];
            break;

        case CSR_SSTATUS:
            var mask = MSTATUS_SIE | MSTATUS_SPIE | MSTATUS_SPP | MSTATUS_FS
                       | MSTATUS_XS | MSTATUS_SUM;
            var sstatus = csr[CSR_MSTATUS] & mask;
            if ((sstatus & MSTATUS_FS) == MSTATUS_FS ||
                (sstatus & MSTATUS_XS) == MSTATUS_XS)
                sstatus |= MSTATUS_SD;
            return sstatus;
            break;

        case CSR_MSCRATCH:
        case CSR_SSCRATCH:
            return csr[addr];
            break;

        case CSR_SPTBR:
            return csr[addr];
            break;

        case CSR_STVEC:
        case CSR_MTVEC:
            return csr[addr];
            break;

        case CSR_MCOUNTEREN:
        case CSR_SCOUNTEREN:
            return csr[addr];
            break;

        case CSR_TIME:
            return this.ticks;
            break;

        case CSR_TIMEH:
            return 0x0;
            break;

        case CSR_PMPCFG0:
        case CSR_PMPADDR0:
            return 0x0;
            break;

        case CSR_TDATA1:
            return csr[addr];
            break;

/*
        case CSR_FRM:
            return csr[addr];
            break;

        case CSR_FFLAGS:
            return csr[addr];
            break;
*/
        default:
            message.Debug("Error in GetCSR: PC "+utils.ToHex(this.pc)+" Address " + utils.ToHex(addr) + " unkown");
            message.Abort();
            return csr[addr];
            break;
    }
   
};

SafeCPU.prototype.UMul64 = function (a,b) {

    var result = [0, 0];

    a >>>= 0;
    b >>>= 0;

    if (a < 32767 && b < 65536) {
        result[0] = a * b;
        result[1] = (result[0] < 0) ? -1 : 0;
        return result;
    }

    var a00 = a & 0xFFFF, a16 = a >>> 16;
    var b00 = b & 0xFFFF, b16 = b >>> 16;

    var c00 = a00 * b00;
    var c16 = (c00 >>> 16) + (a16 * b00);
    var c32 = c16 >>> 16;
    c16 = (c16 & 0xFFFF) + (a00 * b16);
    c32 += c16 >>> 16;
    var c48 = c32 >>> 16;
    c32 = (c32 & 0xFFFF) + (a16 * b16);
    c48 += c32 >>> 16;

    result[0] = ((c16 & 0xFFFF) << 16) | (c00 & 0xFFFF);
    result[1] = ((c48 & 0xFFFF) << 16) | (c32 & 0xFFFF);
    return result;
};

SafeCPU.prototype.IMul64 = function (a,b) {

    var result = [0,0];

    if (a == 0) return result[0] = result[1] = 0, result;
    if (b == 0) return result[0] = result[1] = 0, result;

    a |= 0;
    b |= 0;

    if ((a >= -32768 && a <= 32767) && (b >= -32768 && b <= 32767)) {
        result[0] = a * b;
        result[1] = (result[0] < 0) ? -1 : 0;
        return result;
    }

    var doNegate = (a < 0) ^ (b < 0);

    result = this.UMul64(Math.abs(a), Math.abs(b));

    if (doNegate) {
        result[0] = ~result[0];
        result[1] = ~result[1];
        result[0] = (result[0] + 1) | 0;
        if (result[0] == 0) result[1] = (result[1] + 1) | 0;
    }

    return result;
};

SafeCPU.prototype.SUMul64 = function (a,b) {

    var result = [0,0];

    if (a == 0) return result[0] = result[1] = 0, result;
    if (b == 0) return result[0] = result[1] = 0, result;

    a |= 0;
    b >>>= 0;

    if ((a >= -32768 && a <= 32767) && (b < 65536)) {
        result[0] = a * b;
        result[1] = (result[0] < 0) ? -1 : 0;
        return result;
    }

    var doNegate = a < 0;

    result = this.UMul64(Math.abs(a), Math.abs(b));

    if (doNegate) {
        result[0] = ~result[0];
        result[1] = ~result[1];
        result[0] = (result[0] + 1) | 0;
        if (result[0] == 0) result[1] = (result[1] + 1) | 0;
    }

    return result;
};

SafeCPU.prototype.Step = function (steps, clockspeed) {
    var r = this.r;
    var fi = this.fi;
    var ff = this.ff;
    var f = this.f;
    var csr = this.csr;
    var rindex = 0x00;
    var imm = 0x00;
    var imm1 = 0x00;
    var imm2 = 0x00;
    var imm3 = 0x00;
    var imm4 = 0x00;
    var zimm = 0x00;
    var quo = 0x00;
    var rem = 0x00;
    var rs1 = 0x0;
    var rs2 = 0x0;
    var fs1 = 0.0;
    var fs2 = 0.0;
    var fs3 = 0.0;
    var interrupts = 0x0;
    var ie = 0x0;
    var ins = 0x0;
    var paddr = 0x0;

    steps = steps | 0;
    clockspeed = clockspeed | 0;
    var delta = 0;
this.n = 0;

    do {
        r[0] = 0x00;

        if (!(steps & 63)) {
            // ---------- TICK ----------
            var delta = csr[CSR_TIMECMP] - this.ticks | 0;
            this.ticks = this.ticks + clockspeed | 0;
            csr[CSR_TIME] = this.ticks | 0;
            if (delta < clockspeed) {
                csr[CSR_MIP] = csr[CSR_MIP] | MIP_STIP;
            }
            this.CheckForInterrupt();
        }

        paddr = this.TranslateVM(this.pc, VM_FETCH)|0;
        if(paddr == -1) {
            continue;
        }

        ins = this.ram.Read32(paddr);
        //DebugIns.Disassemble(ins, r, csr, this.pc);
        this.pc = this.pc + 4|0;

        switch(ins&0x7F) {

            case 0x03:
                // lb, lh, lw, lbu, lhu
                imm = (ins >> 20);
                rs1 = r[(ins >> 15) & 0x1F];
                rindex = (ins >> 7) & 0x1F;
                switch((ins >> 12)&0x7) {
                    
                    case 0x00:
                        // lb
                        paddr = this.TranslateVM(rs1 + imm|0, VM_READ)|0;
                        if(paddr == -1) break;
                        r[rindex] = (this.ram.Read8(paddr) << 24) >> 24;
                        break;

                    case 0x01:
                        // lh
                        if (rs1+imm & 1) {
                             this.Trap(CAUSE_MISALIGNED_LOAD, this.pc - 4|0, rs1+imm|0);
                             //message.Debug("Error in lh: unaligned address");
                             //message.Abort();
                             break;
                        }
                        paddr = this.TranslateVM(rs1 + imm|0, VM_READ)|0;
                        if(paddr == -1) break;
                        r[rindex] = (this.ram.Read16(paddr) << 16) >> 16;
                        break;

                    case 0x02:
                        // lw
                        if (rs1+imm & 3) {
                             this.Trap(CAUSE_MISALIGNED_LOAD, this.pc - 4|0, rs1+imm|0);
                             //message.Debug("Error in lw: unaligned address");
                             //message.Abort();
                             break;
                        }
                        paddr = this.TranslateVM(rs1 + imm|0, VM_READ)|0;
                        if(paddr == -1) break;
                        if ((paddr>>>0) == 0x8000a008) {
                            this.ram.Write32(paddr+0, this.htif.ReadToHost());
                            this.ram.Write32(paddr+4, this.htif.ReadDEVCMDToHost());
                        }
                        if ((paddr>>>0) == 0x8000a000) {
                            this.ram.Write32(paddr+0, this.htif.ReadFromHost());
                            this.ram.Write32(paddr+4, this.htif.ReadDEVCMDFromHost());
                        }
                        r[rindex] = this.ram.Read32(paddr);
                        break;

                    case 0x04:
                        // lbu
                        paddr = this.TranslateVM(rs1 + imm|0, VM_READ)|0;
                        if(paddr == -1) break;
                        r[rindex] = this.ram.Read8(paddr) & 0xFF;
                        break;

                    case 0x05:
                        // lhu
                        if (rs1+imm & 1) {
                             message.Debug("Error in lhu: unaligned address");
                             message.Abort();
                        }
                        paddr = this.TranslateVM(rs1 + imm|0, VM_READ)|0;
                        if(paddr == -1) break;
                        r[rindex] = this.ram.Read16(paddr) & 0xFFFF;
                        break;

                    default:
                        message.Debug("Error in safecpu: Instruction " + utils.ToHex(ins) + " not found");
                        message.Abort();
                        break;

                }
                break;

            case 0x23:
                // sb, sh, sw
                imm1 = (ins >> 25);
                imm2 = (ins >> 7) & 0x1F;
                imm = (imm1 << 5) | imm2;
                rs1 = r[(ins >> 15) & 0x1F];
                rindex = (ins >> 20) & 0x1F;
                switch((ins >> 12)&0x7) {
                    
                    case 0x00:
                        // sb
                        paddr = this.TranslateVM(rs1 + imm|0, VM_WRITE)|0;
                        if(paddr == -1) break;
                        this.ram.Write8(paddr, (r[rindex] & 0xFF));
                        break;

                    case 0x01:
                        // sh
                        if (rs1+imm & 1) {
                             this.Trap(CAUSE_MISALIGNED_STORE, this.pc - 4|0, rs1+imm|0);
                             //message.Debug("Error in sh: unaligned address");
                             //message.Abort();
                             break;
                        }
                        paddr = this.TranslateVM(rs1 + imm|0, VM_WRITE)|0;
                        if(paddr == -1) break;
                        this.ram.Write16(paddr, (r[rindex] & 0xFFFF));
                        break;

                    case 0x02:
                        // sw
                        if (rs1+imm & 3) {
                             this.Trap(CAUSE_MISALIGNED_STORE, this.pc - 4|0, rs1+imm|0);
                             //message.Debug("Error in sw: unaligned address");
                             //message.Abort();
                             break;
                        }
                        paddr = this.TranslateVM(rs1 + imm|0, VM_WRITE)|0;
                        if(paddr == -1) break;
                        this.ram.Write32(paddr, r[rindex]);
                        if ((paddr>>>0) == 0x8000a00c) {
                            //message.Debug("Write tohost at " + utils.ToHex(this.pc));
                            this.htif.WriteDEVCMDToHost(this.ram.Read32(paddr));
                            this.htif.WriteToHost(this.ram.Read32(paddr-4));
                        }
                        if ((paddr>>>0) == 0x8000a004) {
                            this.htif.WriteDEVCMDFromHost(this.ram.Read32(paddr));
                            this.htif.WriteFromHost(this.ram.Read32(paddr-4));
                        }
                        break;

                    default:
                        message.Debug("Error in safecpu: Instruction " + utils.ToHex(ins) + " not found");
                        message.Abort();
                        break;

                }
                break;

            case 0x13:
                // addi, slti, sltiu, xori, ori, andi, slli, srli, srai
                rindex = (ins >> 7) & 0x1F;
                rs1 = r[(ins >> 15) & 0x1F];
                imm = (ins >> 20);
                switch((ins >> 12)&0x7) {
                    
                    case 0x00:
                        // addi
                        r[rindex] = rs1 + imm;
                        break;

                    case 0x02:
                        // slti
                        if(rs1 < imm) r[rindex] = 0x01;
                        else r[rindex] = 0x00;
                        break;

                    case 0x03:
                        // sltiu
                        if((rs1>>>0) < (imm>>>0)) r[rindex] = 0x01;
                        else r[rindex] = 0x00;
                        break;

                    case 0x04:
                        // xori
                        r[rindex] = rs1 ^ imm;
                        break;

                    case 0x06:
                        // ori
                        r[rindex] = rs1 | imm;
                        break;

                    case 0x07:
                        // andi
                        r[rindex] = rs1 & imm;
                        break;

                    case 0x01:
                        // slli
                        r[rindex] = rs1 << imm;
                        break;

                    case 0x05:
                        if(((ins >> 25) & 0x7F) == 0x00){
                            // srli
                            r[rindex] = rs1 >>> imm;
                        }
                        else if(((ins >> 25) & 0x7F) == 0x20){
                            // srai
                            r[rindex] = rs1 >> imm;
                        } else {
                            message.Debug("Error in safecpu: Instruction (sra, srl)" + utils.ToHex(ins) + " not found");
                            message.Abort();
                        }
                        break;

                    default:
                        message.Debug("Error in safecpu: Instruction " + utils.ToHex(ins) + " not found");
                        message.Abort();
                        break;

                }
                break;

            case 0x33:
                // add, sub, sll, slt, sltu, xor, srl, sra, or, and
                switch((ins >> 25)&0x7F) {
                    
                    case 0x00:
                        // add, slt, sltu, or, xor, sll, srl
                        rs1 = r[(ins >> 15) & 0x1F];
                        rs2 = r[(ins >> 20) & 0x1F];
                        rindex = (ins >> 7) & 0x1F;
                        switch((ins >> 12)&0x7) {
                            case 0x00:
                                // add
                                r[rindex] = rs1 + rs2;
                                break;

                            case 0x01:
                                // sll
                                r[rindex] = rs1 << (rs2 & 0x1F);
                                break;

                            case 0x02:
                                // slt
                                if(rs1 < rs2) r[rindex] = 0x01;
                                else r[rindex] = 0x00;
                                break;

                            case 0x03:
                                // sltu
                                if((rs1>>>0) < (rs2>>>0)) r[rindex] = 0x01;
                                else r[rindex] = 0x00;
                                break;

                            case 0x04:
                                // xor
                                r[rindex] = rs1 ^ rs2;
                                break;

                            case 0x05:
                                // srl
                                r[rindex] = rs1 >>> (rs2 & 0x1F);
                                break;

                            case 0x06:
                                // or
                                r[rindex] = rs1 | rs2;
                                break;

                            case 0x07:
                                // and
                                r[rindex] = rs1 & rs2;
                                break;

                        }
                        break;

                    case 0x20:
                        //sub
                        rs1 = r[(ins >> 15) & 0x1F];
                        rs2 = r[(ins >> 20) & 0x1F];
                        rindex = (ins >> 7) & 0x1F;
                        switch((ins >> 12)&0x7) {
                            case 0x00:
                                // sub
                                r[rindex] = rs1 - rs2;
                                break;

                            case 0x05:
                                // sra
                                r[rindex] = rs1 >> (rs2 & 0x1F);
                                break;

                            default:
                                message.Debug("Error in safecpu: Instruction (sub,sra) " + utils.ToHex(ins) + " not found");
                                message.Abort();
                        }
                        break;

                    case 0x01:
                        // mul, mulh, mulhsu, mulhu, div, divu, rem, remu
                        rs1 = r[(ins >> 15) & 0x1F]|0;
                        rs2 = r[(ins >> 20) & 0x1F]|0;
                        rindex = (ins >> 7) & 0x1F;
                        switch((ins >> 12)&0x7) {
                            case 0x00:
                                // mul
                                var result = this.IMul64(rs1, rs2);
                                r[rindex] = result[0];
                                break;

                            case 0x01:
                                // mulh
                                var result = this.IMul64(rs1, rs2);
                                r[rindex] = result[1];
                                break;

                            case 0x02:
                                // mulhsu
                                var result = this.SUMul64(rs1, rs2>>>0);
                                r[rindex] = result[1];
                                break;

                            case 0x03:
                                // mulhu
                                var result = this.UMul64(rs1>>>0, rs2>>>0);
                                r[rindex] = result[1];
                                break;

                            case 0x04:
                                // div
                                if(rs2 == 0)
                                    quo = -1;
                                else
                                    quo = (rs1 / rs2)|0;
                                r[rindex] = quo;
                                break;

                            case 0x05:
                                // divu
                                if(rs2 == 0)
                                    quo = -1;
                                else
                                    quo = ((rs1 >>> 0) / (rs2 >>> 0))|0;
                                r[rindex] = quo;
                                break;

                            case 0x06:
                                // rem
                                if(rs2 == 0)
                                    rem = rs1|0;
                                else
                                    rem = (rs1 % rs2)|0;
                                r[rindex] = rem;
                                break;

                            case 0x07:
                                // remu
                                if(rs2 == 0)
                                    rem = rs1|0;
                                else
                                    rem = ((rs1 >>> 0) % (rs2 >>> 0))|0;
                                r[rindex] = rem;
                                break;
                        }
                        break;

                    default:
                        message.Debug("Error in safecpu: Instruction " + utils.ToHex(ins) + " not found");
                        message.Abort();
                        break;

                }
                break;

            case 0x37:
                // lui
                rindex = (ins >> 7) & 0x1F;
                r[rindex] = ins & 0xFFFFF000;
                break;

            case 0x17:
                // auipc
                imm = ins & 0xFFFFF000;
                rindex = (ins >> 7) & 0x1F;
                r[rindex] = this.pc + imm - 4|0;
                break;

            case 0x6F:
                // jal
                imm1 = (ins >> 21) & 0x3FF;
                imm2 = ((ins >> 20) & 0x1) << 10;
                imm3 = ((ins >> 12) & 0xFF) << 11;
                imm4 = (ins >> 31) << 19;
                imm =  (imm1 | imm2 | imm3 | imm4 ) << 1; 
                rindex = (ins >> 7) & 0x1F;
                r[rindex] = this.pc;
                this.pc = this.pc + imm - 4|0;
                break; 

            case 0x67:
                // jalr
                //if ((this.pc>>>0) >= 0xC0000000)
	        //        message.Debug("jump from " + utils.ToHex(this.pc));
                imm = ins >> 20;
                rs1 = r[(ins >> 15) & 0x1F];
                rindex = (ins >> 7) & 0x1F;
                r[rindex] = this.pc;
                this.pc = (rs1 + imm) & 0xFFFFFFFE;
                break;

            case 0x63:
                // beq, bne, blt, bge, bltu, bgeu
                imm1 = (ins >> 31) << 11;
                imm2 = ((ins >> 25) & 0x3F) << 4;
                imm3 = (ins >> 8) & 0x0F;
                imm4 = ((ins >> 7) & 0x01) << 10;
                imm =  ((imm1 | imm2 | imm3 | imm4) << 1 );
                rs1 = r[(ins >> 15) & 0x1F]|0;
                rs2 = r[(ins >> 20) & 0x1F]|0;

                switch((ins >> 12)&0x7) {
                    
                    case 0x00:
                        // beq
                        if(rs1 == rs2) this.pc = this.pc + imm - 4|0;
                        break;

                    case 0x01:
                        // bne
                        if(rs1 != rs2) this.pc = this.pc + imm - 4|0;
                        break;

                    case 0x04:
                        // blt
                        if(rs1 < rs2) this.pc = this.pc + imm - 4|0;
                        break;

                    case 0x05:
                        // bge
                        if(rs1 >= rs2) this.pc = this.pc + imm - 4|0;
                        break;

                    case 0x06:
                        // bltu
                        if((rs1>>>0) < (rs2>>>0)) this.pc = this.pc + imm - 4|0;
                        break;

                    case 0x07:
                        // bgeu
                        if((rs1>>>0) >= (rs2>>>0)) this.pc = this.pc + imm - 4|0;
                        break;

                    default:
                        message.Debug("Error in safecpu: Instruction " + utils.ToHex(ins) + " not found");
                        message.Abort();
                        break;

                }
                break;

            case 0x73:
                // csrrw, csrrs, csrrc, csrrwi, csrrsi, csrrci, ecall, eret, ebreak, mrts, wfi
                imm = (ins >>> 20);
                rs1 = r[(ins >> 15) & 0x1F];
                rindex = (ins >> 7) & 0x1F;
                switch((ins >> 12)&0x7) {
                    
                    case 0x01:
                        // csrrw
                        r[rindex] = this.GetCSR(imm);
                        this.SetCSR(imm, rs1);
                        break;

                    case 0x02:
                        // csrrs
                        r[rindex] = this.GetCSR(imm);
                        if (rs1 != 0) {
                            this.SetCSR(imm, this.GetCSR(imm) | rs1);
                        }
                        break;

                    case 0x03:
                        // csrrc
                        r[rindex] = this.GetCSR(imm);
                        if (rs1 != 0) {
                            this.SetCSR(imm, this.GetCSR(imm) & (~rs1));
                        }
                        break;

                    case 0x05:
                        // csrrwi
                        r[rindex] = this.GetCSR(imm);
                        zimm = (ins >> 15) & 0x1F;
                        this.SetCSR(imm, (zimm >> 0));
                        break;
                        

                    case 0x06:
                        // csrrsi
                        r[rindex] = this.GetCSR(imm);
                        zimm = (ins >> 15) & 0x1F;
                        if (zimm != 0) {
                            this.SetCSR(imm, this.GetCSR(imm) | (zimm >> 0));
                        }
                        break;

                    case 0x07:
                        // csrrci
                        r[rindex] = this.GetCSR(imm);
                        zimm = (ins >> 15) & 0x1F;
                        if (zimm != 0) {
                            this.SetCSR(imm, this.GetCSR(imm) & ~(zimm >> 0));
                        }
                        break;
                    
                    case 0x00:
                        // ecall, sret, ebreak, mret, wfi
                        switch((ins >> 20)&0xFFF) {
                            case 0x00:
                                // ecall
                                switch(this.prv)
                                {
                                    case PRV_U:
                                        this.Trap(CAUSE_USER_ECALL, this.pc - 4|0, -1);
                                        break;

                                    case PRV_S:
                                        this.Trap(CAUSE_SUPERVISOR_ECALL, this.pc - 4|0, -1);
                                        break;

                                    case PRV_H:
                                        this.Trap(CAUSE_HYPERVISOR_ECALL, this.pc - 4|0, -1);
                                        this.Abort();
                                        break;

                                    case PRV_M:
                                        this.Trap(CAUSE_MACHINE_ECALL, this.pc - 4|0, -1);
                                        break;
                                    
                                    default:
                                        message.Debug("Error in ecall: Don't know how to handle privilege level " + privilege_mode);
                                        message.Abort();
                                        break;
                                }
                                break;

                            case 0x001:
                                // ebreak
                                this.Trap(CAUSE_BREAKPOINT, this.pc - 4|0, -1);
                                break;

                            case 0x102:
                                // sret
                                if (this.prv != PRV_S) {
                                    message.Debug("Error in sret: privilege_mode isn't allowed access");
                                    message.Abort();
                                    break;
                                }
                                this.pc = csr[CSR_SEPC] | 0;
                                var s = csr[CSR_MSTATUS] | 0;
                                var prev_prv = get_field(s, MSTATUS_SPP);
                                s = set_field(s, MSTATUS_SIE, get_field(s, MSTATUS_SPIE));
                                s = set_field(s, MSTATUS_SPIE, 1);
                                s = set_field(s, MSTATUS_SPP, PRV_U);
                                csr[CSR_MSTATUS] = s;
                                this.prv = prev_prv;
                                this.InvalidateTLB();
                                break;

                            case 0x105:
                                // wfi
                                //message.Debug("wfi");
                                if ((csr[CSR_MIE] & csr[CSR_MIP]) == 0)
                                    return steps;
                                break;


                            case 0x302:
                                // mret
                                if (this.prv != PRV_M) {
                                    message.Debug("Error in mret: privilege_mode isn't allowed access");
                                    message.Abort();
                                    break;
                                }
                                this.pc = csr[CSR_MEPC] | 0;
                                var s = csr[CSR_MSTATUS] | 0;
                                var prev_prv = get_field(s, MSTATUS_MPP);
                                s = set_field(s, MSTATUS_MIE, get_field(s, MSTATUS_MPIE));
                                s = set_field(s, MSTATUS_MPIE, 1);
                                s = set_field(s, MSTATUS_MPP, PRV_U);
                                csr[CSR_MSTATUS] = s;
                                this.prv = prev_prv;
                                this.InvalidateTLB();
                                break;

                            case 0x120:
                                // sfence.vma
                                break;

                            default:
                                message.Debug("Error in safecpu: Instruction " + utils.ToHex(ins) + " not found");
                                message.Abort();
                                break;

                        }
                        break; 

                    default:
                        message.Debug("Error in safecpu: Instruction " + utils.ToHex(ins) + " not found");
                        message.Abort();
                        break;

                }
                break;

            case 0x07:
                // flw, fld
                imm = (ins >> 20);
                rs1 = r[(ins >> 15) & 0x1F];
                rindex = ((ins >> 7) & 0x1F);
                switch((ins >> 12)&0x7) {
                    
                    case 0x02:
                        // flw
                        if (rs1+imm & 3) {
                             message.Debug("Error in flw: unaligned address");
                             message.Abort();
                        }
                        paddr = this.TranslateVM(rs1 + imm|0, VM_READ)|0;
                        if(paddr == -1) break;
                        r[0] = this.ram.Read32(paddr);
                        f[rindex] = ff[0];
                        break;

                    case 0x03:
                        // fld
                        if (rs1+imm & 7) {
                             message.Debug("Error in flw: unaligned address");
                             message.Abort();
                        }
                        paddr = this.TranslateVM(rs1 + imm|0, VM_READ)|0;
                        if(paddr == -1) break;
                        fi[(rindex<<1) + 0] = this.ram.Read32(paddr+0);
                        fi[(rindex<<1) + 1] = this.ram.Read32(paddr+4);
                        break;

                    default:
                        message.Debug("Error in safecpu: Instruction " + utils.ToHex(ins) + " not found");
                        message.Abort();
                        break;

                }
                break;

            case 0x27:
                // fsw, fsd
                imm1 = (ins >> 25);
                imm2 = (ins >> 7) & 0x1F;
                imm = (imm1 << 5) + imm2;
                rs1 = r[(ins >> 15) & 0x1F];
                rindex = (ins >> 20) & 0x1F;
                switch((ins >> 12)&0x7) {

                    case 0x02:
                        // fsw
                        ff[0] = f[rindex];
                        if (rs1+imm & 3) {
                             message.Debug("Error in fsw: unaligned address");
                             message.Abort();
                        }
                        paddr = this.TranslateVM(rs1 + imm|0, VM_WRITE)|0;
                        if(paddr == -1) break;
                        this.ram.Write32(paddr, r[0]);
                        break;

                    case 0x03:
                        // fsd
                        if (rs1+imm & 7) {
                             message.Debug("Error in fsd: unaligned address");
                             message.Abort();
                        }
                        paddr = this.TranslateVM(rs1 + imm|0, VM_WRITE)|0;
                        if (paddr == -1) break;
                        this.ram.Write32(paddr+0, fi[(rindex<<1) + 0]);
                        this.ram.Write32(paddr+4, fi[(rindex<<1) + 1]);
                        break;

                    default:
                        message.Debug("Error in safecpu: Instruction " + utils.ToHex(ins) + " not found");
                        message.Abort();
                        break;

                }
                break;

            case 0x53:
                // fadd, fsub, fcmp
                rindex = (ins >> 7) & 0x1F;
                switch((ins >> 25)&0x7F) {
                    
                    case 0x00:
                    case 0x01:
                        // fadd.s, fadd.d
                        fs1 = f[(ins >> 15) & 0x1F];
                        fs2 = f[(ins >> 20) & 0x1F];
                        f[rindex] = fs1 + fs2;
                        break;

                    case 0x04:
                    case 0x05:
                        // fsub.s, fsub.d
                        fs1 = f[(ins >> 15) & 0x1F];
                        fs2 = f[(ins >> 20) & 0x1F];
                        f[rindex] = fs1 - fs2;
                        break;

                    case 0x50:
                    case 0x51:
                        // fcmp.s, fcmp.d
                        fs1 = f[(ins >> 15) & 0x1F];
                        fs2 = f[(ins >> 20) & 0x1F];
                        switch((ins >> 12) & 0x7) {
                            case 0x0:
                                if (fs1 <= fs2) r[rindex] = 1;
                                else r[rindex] = 0;
                                break;

                            case 0x1:
                                if (fs1 < fs2) r[rindex] = 1;
                                else r[rindex] = 0;
                                break;

                            case 0x2:
                                if (fs1 == fs2) r[rindex] = 1;
                                else r[rindex] = 0;
                                break;

                            default:
                                message.Debug("Error in safecpu: Instruction (fcmp) " + utils.ToHex(ins) + " not found");
                                message.Abort();
                                break;
                        }
                        break;

                    case 0x20: // fcvt.s.d
                    case 0x21: // fcvt.d.s
                        fs1 = f[(ins >> 15) & 0x1F];
                        f[rindex] = fs1;
                        break;

                    case 0x60:
                        //fcvt.w.s
                        r[rindex] = f[(ins >> 15) & 0x1F];
                        break;

                    case 0x61:
                        //fcvt.w.d
                        r[rindex] = f[(ins >> 15) & 0x1F];
                        break;

                    case 0x68:
                        //fcvt.s.w
                        f[rindex] = r[(ins >> 15) & 0x1F];
                        break;

                    case 0x69:
                        //fcvt.d.w
                        f[rindex] = r[(ins >> 15) & 0x1F];
                        break;


                    case 0x08:
                    case 0x09:
                        //fmul.s, fmul.d
                        fs1 = f[(ins >> 15) & 0x1F];
                        fs2 = f[(ins >> 20) & 0x1F];
                        f[rindex] = fs1 * fs2;
                        break;

                    case 0x0C:
                    case 0x0D:
                        //fdiv.s, fdiv.d
                        fs1 = f[(ins >> 15) & 0x1F];
                        fs2 = f[(ins >> 20) & 0x1F];
                        f[rindex] = fs1 / fs2;
                        break;

                    case 0x10: // single precision
                    case 0x11: // double precision
                        // fsgnj
                        fs1 = f[(ins >> 15) & 0x1F];
                        fs2 = f[(ins >> 20) & 0x1F];
                        switch((ins >> 12) & 7) {
                            case 0:
                                // fsgnj.d, also used for fmv.d
                                f[rindex] = (fs2<0)?-Math.abs(fs1):Math.abs(fs1);
                                break;

                            case 1:
                                // fsgnjn.d
                                f[rindex] = (fs2<0)?Math.abs(fs1):-Math.abs(fs1);
                                break;

                            case 2:
                                // fsgnjx.d
                                f[rindex] = ((fs2<0 && fs1<0) || (fs2>0 && fs1>0))?Math.abs(fs1):-Math.abs(fs1);
                                break;

                            default:
                                message.Debug("Error in safecpu: Instruction (fsgn) " + utils.ToHex(ins) + " not found");
                                message.Abort();
                        }
                        break;

                    case 0x78:
                        // fmv.s.x
                        rs1 = r[(ins >> 15) & 0x1F];
                        r[0] = rs1;
                        f[rindex] = ff[0]; 
                        break;


                    default:
                        message.Debug("Error in safecpu: Instruction " + utils.ToHex(ins) + " not found");
                        message.Abort();
                        break;
                }
                break;

            case 0x43:
                // fmadd.d, fmadd.s
                fs1 = f[(ins >> 15) & 0x1F];
                fs2 = f[(ins >> 20) & 0x1F];
                fs3 = f[(ins >> 27) & 0x1F];
                rindex = (ins >> 7) & 0x1F;
                f[rindex] = fs1 * fs2 + fs3;
                break;

            case 0x47:
                // fmsub.d, fmsub.s
                fs1 = f[(ins >> 15) & 0x1F];
                fs2 = f[(ins >> 20) & 0x1F];
                fs3 = f[(ins >> 27) & 0x1F];
                rindex = (ins >> 7) & 0x1F;
                f[rindex] = fs1 * fs2 - fs3;
                break;

            case 0x4B:
                // fnmadd.d, fnmadd.s
                fs1 = f[(ins >> 15) & 0x1F];
                fs2 = f[(ins >> 20) & 0x1F];
                fs3 = f[(ins >> 27) & 0x1F];
                rindex = (ins >> 7) & 0x1F;
                f[rindex] = -(fs1 * fs2 + fs3);
                break;

            case 0x4F:
                // fnmsub.d, fnmsub.s
                fs1 = f[(ins >> 15) & 0x1F];
                fs2 = f[(ins >> 20) & 0x1F];
                fs3 = f[(ins >> 27) & 0x1F];
                rindex = (ins >> 7) & 0x1F;
                f[rindex] = -(fs1 * fs2 - fs3);
                break;

            case 0x2F:
                // amoswap, amoadd, amoxor, amoand, amoor, amomin, amomax, amominu, amomaxu
                rs1 = r[(ins >> 15) & 0x1F];
                rs2 = r[(ins >> 20) & 0x1F];
                rindex = (ins >> 7) & 0x1F;
                paddr = this.TranslateVM(rs1|0, VM_READ)|0;
                if (paddr == -1) break;

                switch((ins >> 27)&0x1F) {
                    
                    case 0x01:
                        // amoswap
                        r[rindex] = this.ram.Read32(paddr);
                        paddr = this.TranslateVM(rs1|0, VM_WRITE)|0;
                        if(paddr == -1) break;
                        this.ram.Write32(paddr, rs2);
                        break;

                    case 0x00:
                        // amoadd
                        r[rindex] = this.ram.Read32(paddr);
                        paddr = this.TranslateVM(rs1|0, VM_WRITE)|0;
                        if(paddr == -1) break;
                        this.ram.Write32(paddr,r[rindex] + rs2);
                        break;

                    case 0x04:
                        // amoxor
                        r[rindex] = this.ram.Read32(paddr);
                        paddr = this.TranslateVM(rs1|0, VM_WRITE)|0;
                        if(paddr == -1) break;
                        this.ram.Write32(paddr,r[rindex] ^ rs2);
                        break;

                    case 0x0C:
                        // amoand
                        r[rindex] = this.ram.Read32(paddr);
                        paddr = this.TranslateVM(rs1|0, VM_WRITE)|0;
                        if(paddr == -1) break;
                        this.ram.Write32(paddr, r[rindex] & rs2);
                        break;

                    case 0x08:
                        // amoor
                        r[rindex] = this.ram.Read32(paddr);
                        paddr = this.TranslateVM(rs1|0, VM_WRITE)|0;
                        if(paddr == -1) break;
                        this.ram.Write32(paddr, r[rindex] | rs2);
                        break;

                    case 0x10:
                        // amomin
                        r[rindex] = this.ram.Read32(paddr);
                        if((rs2 >> 0) > (r[rindex] >> 0)) r[0] = r[rindex];
                        else r[0] = rs2;
                        paddr = this.TranslateVM(rs1|0, VM_WRITE)|0;
                        if(paddr == -1) break;
                        this.ram.Write32(paddr, r[0]);
                        break;

                   case 0x14:
                        // amomax
                        r[rindex] = this.ram.Read32(paddr);
                        if(rs2 < r[rindex]) r[0] = r[rindex];
                        else r[0] = rs2;
                        paddr = this.TranslateVM(rs1, VM_WRITE)|0;
                        if(paddr == -1) break;
                        this.ram.Write32(paddr, r[0]);
                        break;

                    case 0x18:
                        // amominu
                        r[rindex] = this.ram.Read32(paddr);
                        if((rs2 >>> 0) > (r[rindex] >>> 0)) r[0] = r[rindex];
                        else r[0] = rs2;
                        paddr = this.TranslateVM(rs1, VM_WRITE)|0;
                        if(paddr == -1) break;
                        this.ram.Write32(paddr, r[0]);
                        break;

                    case 0x1C:
                        // amomaxu
                        r[rindex] = this.ram.Read32(paddr);
                        if((rs2 >>> 0) < (r[rindex] >>> 0)) r[0] = r[rindex];
                        else r[0] = rs2;
                        paddr = this.TranslateVM(rs1, VM_WRITE)|0;
                        if(paddr == -1) break;
                        this.ram.Write32(paddr, r[0]);
                        break;

                    case 0x02:
                        // lr.d
                        r[rindex] = this.ram.Read32(paddr);
                        this.amoaddr = rs1;
                        this.amovalue = r[rindex];
                        break;

                    case 0x03:
                        // sc.d
                        if(rs1 != this.amoaddr) {
                            r[rindex] = 0x01;
                            break;
                        }
                        if(this.ram.Read32(paddr) != this.amovalue) {
                            r[rindex] = 0x01;
                            break;
                        }
                        r[rindex] = 0x00;
                        paddr = this.TranslateVM(rs1, VM_WRITE)|0;
                        if (paddr == -1) break;
                        this.ram.Write32(paddr, rs2);
                        break;

                    default:
                        message.Debug("Error in Atomic Memory Instruction " + utils.ToHex(ins) + " not found");
                        message.Abort();
                        break;

                }
                break;

            case 0x0F:
                // fence
                break;


            default:
                if ((ins&3) != 3) {
                    message.Debug("Error in safecpu: Compressed Instruction " + utils.ToHex(ins&0xFFFF) + " not supported at "+utils.ToHex(this.pc-4));
                } else {
                    message.Debug("Error in safecpu: Instruction " + utils.ToHex(ins) + " not found at "+utils.ToHex(this.pc-4));
                }
                message.Abort();
                break;
        }

    } while(steps=steps-1|0);

    return 0;
};

module.exports = SafeCPU;

},{"../messagehandler":33,"../utils":48,"./disassemble":40}],45:[function(require,module,exports){
// -------------------------------------------------
// ----------------- SYSCALLS ----------------------
// -------------------------------------------------

"use strict";
var message = require('../messagehandler');
var utils = require('../utils');

var SYS_OPENAT      = 56;
var SYS_CLOSE       = 57;
var SYS_PREAD       = 67;
var SYS_WRITE       = 64;
var SYS_FSTAT       = 80;
var SYS_EXIT        = 93;
var SYS_GETMAINVARS = 2011;

function SysCalls(ram) {

    this.ram = ram;
    this.elf8mem = [];
    this.file_descriptor_table = [];
    this.file_size = []; //file descriptor is the index
    this.file_pointer = []; //file descriptor is the index
    this.file_descriptor_offset = 9;
    this.elf8mem_offset = 0x00;
}

SysCalls.prototype.HandleSysCall = function (addr) {

    addr = addr | 0;
    var ram = this.ram;
    var syscall_id = this.ram.Read32(addr);
    message.Debug("syscall_id " + syscall_id);
    //var argv = ["spike", "pk", "a.out"];
    var argv = ["pk", "a.out"];
    switch(syscall_id) {

        case SYS_OPENAT:
            var filename_pointer = this.ram.Read32(addr + 16);
            var filename = "";
            for(var i=0,c;;i++){
                c = this.ram.Read8(filename_pointer+i);
                if(c == 0)
                    break;
                else
                    filename += String.fromCharCode(c);
            }
            var url = filename;
            //message.Debug("load " + url);
            utils.LoadBinaryResourceII("../riscv-sys/" + url, 
                this.OnFileLoaded.bind(this), 
                false, 
                function(error){throw error;}
            );
            this.ram.Write32(addr, this.file_descriptor_offset);
            break;

        case SYS_PREAD:
            var file_descriptor = this.ram.Read32(addr + 8);
            var file_address = this.file_descriptor_table[file_descriptor];
            var buffer_address = this.ram.Read32(addr + 16);
            var number_bytes = this.ram.Read32(addr + 24);
            //var file_offset = this.file_pointer[file_descriptor];
            var file_offset = this.ram.Read32(addr + 32);
            var file_length = this.file_size[file_descriptor];
            var i = 0;
            for(var b;i < number_bytes;i++){
                if((i + file_offset) >= file_length) break;
                b = this.elf8mem[file_address + i + file_offset];
                this.ram.Write8(buffer_address + i, b);
            }
            this.file_pointer[file_descriptor] += i;
            this.ram.Write32(addr, i);
            break;

        case SYS_CLOSE:
            this.ram.Write32(addr, 0);
            break;

        case SYS_FSTAT:
            var file_descriptor = this.ram.Read32(addr + 8);
            var stat_buffer_address = this.ram.Read32(addr + 16);
            this.ram.Write32(stat_buffer_address, 0); //unsigned long   Device. 
            this.ram.Write32(stat_buffer_address + 4, 0); //unsigned long   File serial number
            this.ram.Write16(stat_buffer_address + 8, 0x81FF); //unsigned int    File mode
            this.ram.Write16(stat_buffer_address +10, 0); //unsigned int    Link count
            this.ram.Write16(stat_buffer_address +12, 0); //unsigned int    User ID of the file's owner
            this.ram.Write16(stat_buffer_address +14, 0); //unsigned int    Group ID of the file's group
            this.ram.Write32(stat_buffer_address +16, 0); //unsigned long   Device number, if device
            this.ram.Write32(stat_buffer_address +20, 0); //unsigned long   __pad1
            this.ram.Write32(stat_buffer_address +24, this.file_size[file_descriptor]); //long Size of file, in bytes
            this.ram.Write16(stat_buffer_address +28, 512); //int           Optimal block size for I/O
            this.ram.Write16(stat_buffer_address +30, 0); //int             __pad2
            this.ram.Write32(stat_buffer_address +32, 0); //long            Number 512-byte blocks allocated
            this.ram.Write32(stat_buffer_address +36, 0); //long            Time of last access
            this.ram.Write32(stat_buffer_address +40, 0); //unsigned long   st_atime_nsec
            this.ram.Write32(stat_buffer_address +44, 0); //long            Time of last modification
            this.ram.Write32(stat_buffer_address +48, 0); //unsigned long   st_mtime_nsec
            this.ram.Write32(stat_buffer_address +52, 0); //long            Time of last status change
            this.ram.Write32(stat_buffer_address +56, 0); //unsigned long   st_ctime_nsec
            this.ram.Write16(stat_buffer_address +60, 0); //unsigned int    __unused4
            this.ram.Write16(stat_buffer_address +62, 0); //unsigned int    __unused5
            this.ram.Write32(addr, 1);
            break;

        case SYS_WRITE:
            var length = this.ram.Read32(addr + 8*3);
            var i = 0;
            var string_address = this.ram.Read32(addr + 8*2);
            while(i < length){
                var c = this.ram.Read8(string_address + (i++));
                this.ram.Write8Little(0x03000000 >> 0, c);
                if (c == 0xA) this.ram.Write8(0x03000000 >> 0, 0xD);
            }
            this.ram.Write32(addr, i);
            break;

        case SYS_EXIT:
            message.Debug("Program exited with sys_exit for inst at PC "+utils.ToHex(this.pc));
            message.Abort();
            break;

        case SYS_GETMAINVARS:
            var address = this.ram.Read32(addr + 8);
            var length = this.ram.Read32(addr + 16);

           // write argc
            this.ram.Write32(address, argv.length);
            // argv[argc] = NULL
            // envp[0] = NULL

            // generate list of pointers to string
            var ofs = argv.length*8 + 8*4; // offset of first string entry
            for(var i=0; i<argv.length; i++) {
                this.ram.Write32(address+8+i*8, address + ofs);
                ofs += argv[i].length+1;
            }

            ofs = argv.length*8 + 8*4;
            for(var i=0; i<argv.length; i++) {
                for (var j=0; j<argv[i].length; j++) {
                    this.ram.Write8(address + ofs, argv[i].charCodeAt(j));
                    ofs++;
                }
                ofs++; // terminating "\0"
            }

            this.ram.Write32(addr, 0);
            break;

        default:
            message.Debug("unkown SysCall "+utils.ToHex(syscall_id)+" at PC "+utils.ToHex(this.pc));
            message.Abort();
           break;
    }

};

SysCalls.prototype.OnFileLoaded = function(buffer) {
    var buffer8 = new Uint8Array(buffer);
    var length = buffer8.length;
    message.Debug("On File Loaded " + length);
    for(var i=0; i<length; i++) this.elf8mem[i+this.elf8mem_offset] = buffer8[i];
    this.file_descriptor_table[++this.file_descriptor_offset] = this.elf8mem_offset;
    this.elf8mem_offset += length;
    this.file_size[this.file_descriptor_offset] = length;
    this.file_pointer[this.file_descriptor_offset] = 0;
    
};

module.exports = SysCalls;

},{"../messagehandler":33,"../utils":48}],46:[function(require,module,exports){
// -------------------------------------------------
// ------------------- SYSTEM ----------------------
// -------------------------------------------------

"use strict";
// common
var message = require('./messagehandler'); // global variable
var utils = require('./utils');
var RAM = require('./ram');
var bzip2 = require('./bzip2');
var elf = require('./elf');
var Timer = require('./timer');
var InitOpenRISC = require('./init_openrisc');
var InitRISCV = require('./init_riscv');
var FS = require('./filesystem/filesystem');

// Devices
var Virtio9p = require('./dev/virtio/9p');

var SYSTEM_RUN = 0x1;
var SYSTEM_STOP = 0x2;
var SYSTEM_HALT = 0x3; // Idle

function System() {
    // the Init function is called by the master thread.
    message.Register("LoadAndStart", this.LoadImageAndStart.bind(this) );
    message.Register("execute", this.MainLoop.bind(this));
    message.Register("Init", this.Init.bind(this) );
    message.Register("Reset", this.Reset.bind(this) );
    message.Register("PrintOnAbort", this.PrintState.bind(this) );

    message.Register("GetIPS", function(data) {
        message.Send("GetIPS", this.ips);
        this.ips=0;
    }.bind(this));
}

System.prototype.Reset = function() {
    this.status = SYSTEM_STOP;
    for(var i=0; i<this.devices.length; i++) {
        this.devices[i].Reset();
    }
    this.ips = 0;
};

System.prototype.Init = async function(system) {
    message.Debug("Init with following JSON structure: ");
    message.Debug(system);

    this.status = SYSTEM_STOP;

    this.arch = system.arch;
    this.memorysize = system.memorysize;
    this.ncores = system.ncores;
    if (!system.ncores) system.ncores = 1;

    this.ips = 0; // external instruction per second counter
    this.idletime = 0; // start time of the idle routine
    this.idlemaxwait = 0; // maximum waiting time in cycles

    // constants
    this.ticksperms = 20000; // 20 MHz
    this.loopspersecond = 100; // main loops per second, to keep the system responsive

    this.timer = new Timer(this.ticksperms, this.loopspersecond);

    message.Debug("Allocate " + this.memorysize + " MB");
    // this must be a power of two.
    if (((system.cpu == "dynamic") || (system.cpu == "wasm")) && (typeof WebAssembly !== "undefined")) {
        message.Debug("Use webassembly memory");
        this.memory = new WebAssembly.Memory({initial: this.memorysize*16, maximum: this.memorysize*16});
        this.heap = this.memory.buffer;
    } else {
        message.Debug("Use arraybuffer memory");
        this.heap = new ArrayBuffer(this.memorysize*0x100000);
    }
    var ramoffset = 0x100000;
    this.memorysize--; // - the lower 1 MB are used for the cpu cores
    this.ram = new RAM(this.heap, ramoffset);
    if (this.memory) this.ram.memory = this.memory;
    this.csr = new Int32Array(this.heap, 0x2000, 4096);

    this.devices = [];
    this.filesystem = new FS();
    this.virtio9pdev = new Virtio9p(this.ram, this.filesystem);

    try {
        if (system.arch == "or1k") {
            await InitOpenRISC(this, system);
        } else
        if (system.arch == "riscv") {
            await InitRISCV(this, system);
        } else {
            throw "Architecture " + system.arch + " not supported";
        }
    } catch (e) {
        message.Debug("Error: failed to create SoC: " + e);
        message.Abort();
    }
    message.Debug("Init Done");
    message.Send("InitDone", null);
};

System.prototype.RaiseInterrupt = function(line) {
    //message.Debug("Raise " + line);
    if (this.arch == "riscv") {
        this.plicdev.RaiseInterrupt(line);
    } else {
        this.cpu.RaiseInterrupt(line, -1); // raise all cores
    }
    if (this.status == SYSTEM_HALT)
    {
        this.status = SYSTEM_RUN;
        clearTimeout(this.idletimeouthandle);
        var delta = (utils.GetMilliseconds() - this.idletime) * this.ticksperms;
        if (delta > this.idlemaxwait) delta = this.idlemaxwait;
        this.cpu.ProgressTime(delta);
        this.MainLoop();
    }
};

System.prototype.ClearInterrupt = function (line) {
    if (this.arch == "riscv") {
        this.plicdev.ClearInterrupt(line);
    } else {
        this.cpu.ClearInterrupt(line, -1); // clear all cores
    }
};

System.prototype.RaiseSoftInterrupt = function(line, cpuid) {
    // the cpu cannot be halted when this function is called, so skip this check
    this.cpu.RaiseInterrupt(line, cpuid);
};

System.prototype.ClearSoftInterrupt = function (line, cpuid) {
    this.cpu.ClearInterrupt(line, cpuid);
};

System.prototype.PrintState = function() {
    // Flush the buffer of the terminal
    this.uartdev0 && this.uartdev0.Step();
    this.uartdev1 && this.uartdev1.Step();
    this.cpu && message.Debug(this.cpu.toString());
};

System.prototype.SendStringToTerminal = function(str)
{
    var chars = [];
    for (var i = 0; i < str.length; i++) {
        chars.push(str.charCodeAt(i));
    }
    message.Send("tty0", chars);
};

System.prototype.LoadImageAndStart = function(url) {
    this.SendStringToTerminal("\r================================================================================");

    if (typeof url == 'string') {
        this.SendStringToTerminal("\r\nLoading kernel and hard and basic file system from web server. Please wait ...\r\n");
        utils.LoadBinaryResource(
            url,
            this.OnKernelLoaded.bind(this),
            function(error){throw error;}
        );
    } else {
        this.OnKernelLoaded(url);
    }

};

System.prototype.PatchKernel = function(length)
{
    var m = this.ram.uint8mem;
    // set the correct memory size
    for(var i=0; i<length; i++) { // search for the compiled dts file in the kernel
        if (m[i+0] === 0x6d) // find "memory\0"
        if (m[i+1] === 0x65)
        if (m[i+2] === 0x6d)
        if (m[i+3] === 0x6f)
        if (m[i+4] === 0x72)
        if (m[i+5] === 0x79)
        if (m[i+6] === 0x00)
        if (m[i+24] === 0x01)
        if (m[i+25] === 0xF0)
        if (m[i+26] === 0x00)
        if (m[i+27] === 0x00) {
            m[i+24] = (this.memorysize*0x100000)>>24;
            m[i+25] = (this.memorysize*0x100000)>>16;
            m[i+26] = 0x00;
            m[i+27] = 0x00;
        }
    }
};

System.prototype.OnKernelLoaded = function(buffer) {
    this.SendStringToTerminal("Decompressing kernel...\r\n");
    var buffer8 = new Uint8Array(buffer);
    var length = buffer.byteLength;

    if (elf.IsELF(buffer8)) {
        elf.Extract(buffer8, this.ram);
    } else
    if (bzip2.IsBZIP2(buffer8)) {
        length = 0;
        bzip2.simple(buffer8, function(x){this.ram.uint8mem[length++] = x;}.bind(this));
        if (elf.IsELF(this.ram.uint8mem)) {
            var temp = new Uint8Array(length);
            for(var i=0; i<length; i++) {
                temp[i] = this.ram.uint8mem[i];
            }
            elf.Extract(temp, this.ram);
        }
    } else {
        for(var i=0; i<length; i++) this.ram.uint8mem[i] = buffer8[i];
    }

    // OpenRISC CPU uses Big Endian
    if (this.cpu.littleendian == false) {
        this.PatchKernel(length);
        this.ram.Little2Big(length);
    }
    message.Debug("Kernel loaded: " + length + " bytes");
    this.SendStringToTerminal("Booting\r\n");
    this.SendStringToTerminal("================================================================================");
    // we can start the boot process already, even if the filesystem is not yet ready

    this.cpu.Reset();
    this.cpu.AnalyzeImage();
    message.Debug("Starting emulation");
    this.status = SYSTEM_RUN;

    message.Send("execute", 0);
};

// the kernel has sent a halt signal, so stop everything until the next interrupt is raised
System.prototype.HandleHalt = function() {
    var delta = this.cpu.GetTimeToNextInterrupt();
    if (delta == -1) return;
        this.idlemaxwait = delta;
        var mswait = Math.floor(delta / this.ticksperms / this.timer.correction + 0.5);
        //message.Debug("wait " + mswait);

        if (mswait <= 1) return;
        if (mswait > 1000) message.Debug("Warning: idle for " + mswait + "ms");
        this.idletime = utils.GetMilliseconds();
        this.status = SYSTEM_HALT;
        this.idletimeouthandle = setTimeout(function() {
            if (this.status == SYSTEM_HALT) {
                this.status = SYSTEM_RUN;
                this.cpu.ProgressTime(delta);
                //this.snddev.Progress();
                this.MainLoop();
            }
        }.bind(this), mswait);
};

System.prototype.MainLoop = function() {
    if (this.status != SYSTEM_RUN) return;
    message.Send("execute", 0);
    // execute the cpu loop for "instructionsperloop" instructions.
    var stepsleft = this.cpu.Step(this.timer.instructionsperloop, this.timer.timercyclesperinstruction);
    var totalsteps = this.timer.instructionsperloop - stepsleft;
    totalsteps++; // at least one instruction
    this.ips += totalsteps;

    this.uartdev0 && this.uartdev0.Step();
    this.uartdev1 && this.uartdev1.Step();
    //this.snddev.Progress();

    // stepsleft != 0 indicates CPU idle
    var gotoidle = stepsleft?true:false;

    this.timer.Update(totalsteps, this.cpu.GetTicks(), gotoidle);

    if (gotoidle) {
        this.HandleHalt();
    }

    // go to worker thread idle state that onmessage is executed
};

module.exports = System;

},{"./bzip2":2,"./dev/virtio/9p":17,"./elf":25,"./filesystem/filesystem":26,"./init_openrisc":31,"./init_riscv":32,"./messagehandler":33,"./ram":39,"./timer":47,"./utils":48}],47:[function(require,module,exports){
// -------------------------------------------------
// ------------------- TIMER -----------------------
// -------------------------------------------------

// helper function for correct timing

"use strict";

var message = require('./messagehandler'); // global variable
var utils = require('./utils');

function Timer(_ticksperms, _loopspersecond) {
    // constants
    this.ticksperms = _ticksperms;
    this.loopspersecond = _loopspersecond;

    // global synchronization variables
    this.baserealtime = 0.; // real time when the timer was started
    this.realtime = 0.; // time passed in real in ms
    this.lastsystemticks = 0.; // temp variable to calculate the correct systemtime
    this.systemtime = 0. // time passed in the system in ms
    this.correction = 1.; // return value
    this.oldcorrection = 1.;
    this.steps = 0;

    // short time synchronization
    this.nins = 0;
    this.lastlooptime = -1; // last time the loop was executed in ms, without idle in between

    this.ipms = 10000; // initial guess for: 10 MIPS
    this.instructionsperloop = 0;  // return value
    this.timercyclesperinstruction = 10; // return value
    this.UpdateTimings();
}


// nins: instructions executed in last loop
// ticks: The current value of the TTCR register
// gotoidle: bool if the cpu is gone to idle mode
Timer.prototype.Update = function(nins, ticks, gotoidle) {

    this.GlobalUpdate(ticks);
    this.LocalUpdate(nins, gotoidle);
}


Timer.prototype.UpdateTimings = function(_nins, gotoidle) {
    this.instructionsperloop = Math.floor(this.ipms*1000. / this.loopspersecond);
    this.instructionsperloop = this.instructionsperloop<2000?2000:this.instructionsperloop;
    this.instructionsperloop = this.instructionsperloop>100000000?100000000:this.instructionsperloop;

    this.timercyclesperinstruction = Math.floor(this.ticksperms * 64 / this.ipms * this.correction);
    this.timercyclesperinstruction = this.timercyclesperinstruction<=1?1:this.timercyclesperinstruction;
    this.timercyclesperinstruction = this.timercyclesperinstruction>=1000?1000:this.timercyclesperinstruction;
}


Timer.prototype.LocalUpdate = function(_nins, gotoidle) {

    this.nins += _nins;
    if (gotoidle) {
        // reset the whole routine
        this.lastlooptime = -1;
        this.nins = 0;
        return;
    }

    // recalibrate timer
    if (this.lastlooptime < 0) {
        this.lastlooptime = utils.GetMilliseconds();
        this.nins = 0;
        return; // don't calibrate, because we don't have the data
    }
    var delta = utils.GetMilliseconds() - this.lastlooptime;
    if (delta > 50 && this.nins > 2000) // we need statistics for calibration
    {
        this.ipms = this.nins / delta; // ipms (per millisecond) of current run
        this.UpdateTimings();

        //reset the integration parameters
        this.lastlooptime = utils.GetMilliseconds();
        this.nins = 0;
    }    
}


Timer.prototype.GlobalUpdate = function(ticks) {

    // global time handling
    if (ticks < 0) return; // timer hasn't started yet
    
    ticks = ticks / this.ticksperms; // ticks in ms

    // ---------------
    // update realtime
    // ---------------
    if (this.baserealtime <= 0) this.baserealtime = utils.GetMilliseconds();
    this.realtime = utils.GetMilliseconds() - this.baserealtime;
        
    // -----------------
    // update systemtime (time in emulator)
    // -----------------
    if (this.lastsystemticks > ticks) {
        this.systemtime += ticks - this.lastsystemticks + (0x10000000/this.ticksperms);
    } else {
        this.systemtime += ticks - this.lastsystemticks;
    }
    this.lastsystemticks = ticks;

    // -----------------

    var deltaabs = Math.abs(this.systemtime-this.realtime);

    if (deltaabs > 500) {
        // we are too far off, so do a reset of the timers
        this.baserealtime = utils.GetMilliseconds();
        this.systemtime = 0.;
        this.lastsystemticks = 0.;
    }

    // calculate a correction value for the timers
    this.correction = 1.;
    if (this.systemtime > (this.realtime+50)) this.correction = 0.9; // too fast
    if (this.realtime > (this.systemtime+50)) this.correction = 1.1; // too slow
    if (deltaabs > 200) this.correction = this.correction*this.correction;
    if (deltaabs > 400) this.correction = this.correction*this.correction;

    if (this.oldcorrection != this.correction) {
        this.UpdateTimings();
        this.oldcorrection = this.correction;
    }

    //this.steps++;
    //if ((this.steps&63) == 0) message.Debug(this.systemtime-this.realtime);
}


module.exports = Timer;

},{"./messagehandler":33,"./utils":48}],48:[function(require,module,exports){
// -------------------------------------------------
// ------------------ Utils ------------------------
// -------------------------------------------------

function GetMilliseconds() {
    return (new Date()).getTime();
}

// big endian to little endian and vice versa
function Swap32(val) {
    return ((val & 0xFF) << 24) | ((val & 0xFF00) << 8) | ((val >>> 8) & 0xFF00) | ((val >>> 24) & 0xFF);
}

function Swap16(val) {
    return ((val & 0xFF) << 8) | ((val >> 8) & 0xFF);
}

// cast an integer to a signed integer
function int32(val) {
    return (val >> 0);
}

// cast an integer to a unsigned integer
function uint32(val) {
    return (val >>> 0);
}

function ToHex(x) {
    var val = uint32(x);
    return ("0x" + ("00000000" + val.toString(16)).substr(-8).toUpperCase());
}

function ToBin(x) {
    var val = uint32(x);
    var s = ("00000000000000000000000000000000" + val.toString(2)).substr(-32) + "b";
    return s.replace(/./g, function (v, i) {return ((i&3)==3)?v + " ": v;});
}

function CopyBinary(to, from, size, buffersrc, bufferdest) {
    var i = 0;
    for (i = 0; i < size; i++) {
        bufferdest[to + i] = buffersrc[from + i];
    }
}

function LoadBinaryResource(url, OnSuccess, OnError) {
    var req = new XMLHttpRequest();
    // open might fail, when we try to open an unsecure address, when the main page is secure
    try {
        req.open('GET', url, true);
    } catch(err) {
        OnError(err);
        return;
    }
    req.responseType = "arraybuffer";
    req.onreadystatechange = function () {
        if (req.readyState != 4) {
            return;
        }
        if ((req.status != 200) && (req.status != 0)) {
            OnError("Error: Could not load file " + url);
            return;
        }
        var arrayBuffer = req.response;
        if (arrayBuffer) {
            OnSuccess(arrayBuffer);
        } else {
            OnError("Error: No data received from: " + url);
        }
    };
    req.send(null);
}

function LoadBinaryResourceII(url, OnSuccess, NonBlocking, OnError) {
    var req = new XMLHttpRequest();
    // open might fail, when we try to open an unsecure address, when the main page is secure
    try {
        req.open('GET', url, NonBlocking);
    } catch(err) {
        OnError(err);
        return;
    }
    req.responseType = "arraybuffer";
    req.onreadystatechange = function () {
        if (req.readyState != 4) {
            return;
        }
        if ((req.status != 200) && (req.status != 0)) {
            OnError("Error: Could not load file " + url);
            return;
        }
        var arrayBuffer = req.response;
        if (arrayBuffer) {
            OnSuccess(arrayBuffer);
        } else {
            OnError("Error: No data received from: " + url);
        }
    };
    req.send(null);
}

function LoadTextResource(url, OnSuccess, OnError) {
    var req = new XMLHttpRequest();
    req.open('GET', url, true);
    //req.overrideMimeType('text/xml');
    req.onreadystatechange = function () {
        if (req.readyState != 4) {
            return;
        }
        if ((req.status != 200) && (req.status != 0)) {
            OnError("Error: Could not load text file " + url);
            return;
        }
        OnSuccess(req.responseText);
    };
    req.send(null);
}

function DownloadAllAsync(urls, OnSuccess, OnError) {
    var pending = urls.length;
    var result = [];
    if (pending === 0) {
        setTimeout(onsuccess.bind(null, result), 0);
        return;
    }
    urls.forEach(function(url, i)  {
        LoadBinaryResource(
            url, 
            function(buffer) {
                if (result) {
                    result[i] = buffer;
                    pending--;
                    if (pending === 0) {
                        OnSuccess(result);
                    }
                }
            }, 
            function(error) {
                if (result) {
                    result = null;
                    OnError(error);
                }
            }
        );
    });
}

function UploadBinaryResource(url, filename, data, OnSuccess, OnError) {

    var boundary = "xxxxxxxxx";

    var xhr = new XMLHttpRequest();
    xhr.open('post', url, true);
    xhr.setRequestHeader("Content-Type", "multipart/form-data, boundary=" + boundary);
    xhr.setRequestHeader("Content-Length", data.length);
    xhr.onreadystatechange = function () {
        if (req.readyState != 4) {
            return;
        }
        if ((req.status != 200) && (xhr.status != 0)) {
            OnError("Error: Could not upload file " + filename);
            return;
        }
        OnSuccess(this.responseText);
    };

    var bodyheader = "--" + boundary + "\r\n";
    bodyheader += 'Content-Disposition: form-data; name="uploaded"; filename="' + filename + '"\r\n';
    bodyheader += "Content-Type: application/octet-stream\r\n\r\n";

    var bodyfooter = "\r\n";
    bodyfooter += "--" + boundary + "--";

    var newdata = new Uint8Array(data.length + bodyheader.length + bodyfooter.length);
    var offset = 0;
    for(var i=0; i<bodyheader.length; i++)
        newdata[offset++] = bodyheader.charCodeAt(i);

    for(var i=0; i<data.length; i++)
        newdata[offset++] = data[i];


    for(var i=0; i<bodyfooter.length; i++)
        newdata[offset++] = bodyfooter.charCodeAt(i);

    xhr.send(newdata.buffer);
}

/*
function LoadBZIP2Resource(url, OnSuccess, OnError)
{
    var worker = new Worker('bzip2.js');
    worker.onmessage = function(e) {
        OnSuccess(e.data);
    }    
    worker.onerror = function(e) {
        OnError("Error at " + e.filename + ":" + e.lineno + ": " + e.message);
    }
    worker.postMessage(url);    
}
*/


module.exports.GetMilliseconds = GetMilliseconds;
module.exports.Swap32 = Swap32;
module.exports.Swap16 = Swap16;
module.exports.int32 = int32;
module.exports.uint32 = uint32;
module.exports.ToHex = ToHex;
module.exports.ToBin = ToBin;
module.exports.LoadBinaryResource = LoadBinaryResource;
module.exports.LoadBinaryResourceII = LoadBinaryResourceII;
module.exports.LoadTextResource = LoadTextResource;


},{}],49:[function(require,module,exports){
// -------------------------------------------------
// -------------------- Worker ---------------------
// -------------------------------------------------

var message = require('./messagehandler');
var System = require('./system');

new System();
message.Send("WorkerReady", 0);

},{"./messagehandler":33,"./system":46}]},{},[49]);
