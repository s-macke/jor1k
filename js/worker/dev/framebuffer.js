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
