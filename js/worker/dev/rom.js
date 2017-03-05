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


