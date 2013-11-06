/*
bzip2.js - a small bzip2 decompression implementation

Copyright 2011 by antimatter15 (antimatter15@gmail.com)

Based on micro-bunzip by Rob Landley (rob@landley.net).

Based on bzip2 decompression code by Julian R Seward (jseward@acm.org),
which also acknowledges contributions by Mike Burrows, David Wheeler,
Peter Fenwick, Alistair Moffat, Radford Neal, Ian H. Witten,
Robert Sedgewick, and Jon L. Bentley.

I hereby release this code under the GNU Library General Public License
(LGPL) version 2, available at http://www.gnu.org/copyleft/lgpl.html
*/

var bzip2 = {};

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

bzip2.simple = function(bits, buffer) {
    var size = bzip2.header(bits);
    var ret = {end:false, offset:0};
    var bufsize = 100000 * size;
    var buf = new Int32Array(bufsize);
    do {
        ret = bzip2.decompress(bits, buffer, ret.offset, buf, bufsize);        
    } while(!ret.end);
    return ret.offset;
}

bzip2.header = function(bits) {
    if (bits(8*3) != 4348520) throw "No magic number found";
    var i = bits(8) - 48;
    if (i < 1 || i > 9) throw "Not a BZIP archive";
    return i;
};


//takes a function for reading the block data (starting with 0x314159265359)
//a block size (0-9) (optional, defaults to 9)
//a length at which to stop decompressing and return the output
bzip2.decompress = function(bits, buffer, offset, buf, bufsize) {
    var MAX_HUFCODE_BITS = 20;
    var MAX_SYMBOLS = 258;
    var SYMBOL_RUNA = 0;
    var SYMBOL_RUNB = 1;
    var GROUP_SIZE = 50;
    
    for(var h = '', i = 0; i < 6; i++) h += bits(8).toString(16);
    if (h == "177245385090") return {end:true, offset:offset}; //last block
    if (h != "314159265359") throw "eek not valid bzip data";
    bits(32); //ignore CRC codes
    if (bits(1)) throw "unsupported obsolete version";
    var origPtr = bits(24);
    if (origPtr > bufsize) throw "Initial position larger than buffer size";
    var t = bits(16);
    var symToByte = new Uint8Array(256),
    symTotal = 0;
    for (i = 0; i < 16; i++) {
        if (t & (1 << (15 - i))) {
            var k = bits(16);
            for(j = 0; j < 16; j++) {
                if (k & (1 << (15 - j))) {
                    symToByte[symTotal++] = (16 * i) + j;
                }
            }
        }
    }

    var groupCount = bits(3);
    if (groupCount < 2 || groupCount > 6) throw "another error";
    var nSelectors = bits(15);
    if (nSelectors == 0) throw "meh";
    var mtfSymbol = new Int32Array(256);
    for(var i = 0; i < groupCount; i++) mtfSymbol[i] = i;
    var selectors = new Uint8Array(0x8000);

    for(var i = 0; i < nSelectors; i++) {
        for(var j = 0; bits(1); j++) if (j >= groupCount) throw "whoops another error";
        var uc = mtfSymbol[j];
        for(var k = j-1; k>=0; k--) {
            mtfSymbol[k+1] = mtfSymbol[k];
        }
        mtfSymbol[0] = uc;
        selectors[i] = uc;
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
                if (t < 1 || t > MAX_HUFCODE_BITS) throw "I gave up a while ago on writing error messages";
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

    var byteCount = new Int32Array(256);
    for(var i = 0; i < 256; i++) mtfSymbol[i] = i;
    var runPos, count, symCount, selector;
    runPos = count = symCount = selector = 0;    
    while(true) {
        if (!(symCount--)) {
            symCount = GROUP_SIZE - 1;
            if (selector >= nSelectors) throw "meow i'm a kitty, that's an error";
            hufGroup = groups[selectors[selector++]];
            base = hufGroup.base.subarray(1);
            limit = hufGroup.limit.subarray(1);
        }
        i = hufGroup.minLen;
        j = bits(i);
        while(true) {
            if (i > hufGroup.maxLen) throw "rawr i'm a dinosaur";
            if (j <= limit[i]) break;
            i++;
            j = (j << 1) | bits(1);
        }
        j -= base[i];
        if (j < 0 || j >= MAX_SYMBOLS) throw "moo i'm a cow";
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
            if (count + t >= bufsize) throw "Boom.";
            uc = symToByte[mtfSymbol[0]];
            byteCount[uc] += t;
            while(t--) buf[count++] = uc;
        }
        if (nextSym > symTotal) break;
        if (count >= bufsize) throw "I can't think of anything. Error";
        i = nextSym - 1;
        uc = mtfSymbol[i];
        for(var k = i-1; k>=0; k--) {
            mtfSymbol[k+1] = mtfSymbol[k];
        }
        mtfSymbol[0] = uc
        uc = symToByte[uc];
        byteCount[uc]++;
        buf[count++] = uc;
    }
    if (origPtr < 0 || origPtr >= count) throw "I'm a monkey and I'm throwing something at someone, namely you";
    var j = 0;
    for(var i = 0; i < 256; i++) {
        k = j + byteCount[i];
        byteCount[i] = j;
        j = k;
    }
    for(var i = 0; i < count; i++) {
        uc = buf[i] & 0xff;
        buf[byteCount[uc]] |= (i << 8);
        byteCount[uc]++;
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
            buffer[offset++] = outbyte;
        }
        if (current != previous) run = 0;
    }
    return {end:false, offset:offset};
}
