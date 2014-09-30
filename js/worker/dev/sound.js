// -------------------------------------------------
// --------------------- SOUND ---------------------
// -------------------------------------------------

// Emulating my own virtual sound card

"use strict";

var REG_CTL            = 0x0; // format
var REG_ADDR           = 0x0004; // pointer to dma buffer
var REG_PERIODS        = 0x0008; // number of perionds
var REG_PERIOD_SIZE    = 0x000C; // size of periods
var REG_OFFSET         = 0x0010; // current position in buffer

function SoundDev(intdev, ramdev) {
    this.intdev = intdev;
    this.ramdev = ramdev
    this.Reset();
}

SoundDev.prototype.Reset = function() {
    this.addr = 0x0;
    this.status = 0x0;
    this.periods = 0x0;
    this.period_size = 0x0; // in frames (32 bits)
    this.offset = 0; // frames (32 bits)
    this.playing = false;
    this.nextperiod = 0;
    this.oldtime = 0.;
    this.rate = 22050;
}

SoundDev.prototype.Step = function() {
    if (!this.playing) return;
    var currenttime = GetMilliseconds();
    var delta = Math.floor((currenttime-this.oldtime)/1000. * this.rate); // in frames
    this.oldtime = currenttime;

    this.nextperiod -= delta;
    if (delta > 1) {
        var x = new Int8Array(delta);
        for(var i=0; i<delta; i++)
            x[i] = (this.ramdev.sint8mem[this.addr + (((this.offset+i)<<1)^3)]);

        SendToMaster("sound", x);
    }

    this.offset += delta;

    if (this.nextperiod <= 0) { 
        this.intdev.RaiseInterrupt(0x7);
        this.nextperiod += this.period_size;
    }

    if (this.offset >= this.periods*this.period_size)
        this.offset -= this.periods*this.period_size;
}


SoundDev.prototype.ReadReg32 = function (addr) {
    switch(addr)
    {
        case REG_CTL:
            this.intdev.ClearInterrupt(0x7);
            return this.playing?1:0;
            break;

        case REG_OFFSET:
            return this.offset; // given in frames
            break; 

        default:
            DebugMessage("Sound: unknown ReadReg32: " + hex8(addr));
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
            this.oldtime = GetMilliseconds();
            this.offset = 0;
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

        default:
            DebugMessage("sound: unknown  WriteReg32: " + hex8(addr) + ": " + hex8(value));
            return;
            break;
    }
}
