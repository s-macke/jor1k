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
