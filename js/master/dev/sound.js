// Provides a loop sound buffer.

var message = require('../messagehandler');

"use strict";

function LoopSoundBuffer(samplerate) {
    this.enabled = false;
    this.nperiods = 8; // number of periods

    this.source = new Array(this.nperiods);
    this.soundbuffer = new Array(this.nperiods);

    this.period = 0;
    this.periodsize = 0;
    this.bufferpos = 0;

    if (typeof AudioContext == "undefined") return;

    this.context = new AudioContext();
    this.SetRate(samplerate);
}

LoopSoundBuffer.prototype.SetRate = function(rate) {
    if (this.samplerate == rate) return;
    if (typeof this.context === "undefined") return;
    this.samplerate = rate;
    this.periodsize = Math.floor(this.samplerate/4); // 250ms
    this.sampleslen = this.periodsize*this.nperiods;
    this.buffer = new Float32Array(this.sampleslen);

    for(var i=0; i<this.nperiods; i++) {
        this.soundbuffer[i] = this.context.createBuffer(1, this.periodsize, this.samplerate);
    }
}

LoopSoundBuffer.prototype.OnEnded = function()
{
    if (!this.enabled) return;
    this.PlayBuffer(this.period);
    this.period++;
}

LoopSoundBuffer.prototype.Enabled = function(e)
{
    this.enabled = e;
    if (typeof this.context === "undefined") return;
    if (!e) return;
    this.period = 0;
    this.basetime = this.context.currentTime;
    this.PlayBuffer(0);
    this.PlayBuffer(1);
    this.period = 2;
    this.bufferpos = this.periodsize*(this.period+4);
}

LoopSoundBuffer.prototype.PlayBuffer = function(period)
{
    if (!this.enabled) return;
    var idx = period % this.nperiods;
    var buffer = this.soundbuffer[idx].getChannelData(0);
    var offset = idx * this.periodsize;
    for(var i=0; i<this.periodsize; i++) {
        buffer[i] = this.buffer[i + offset];
        this.buffer[i+offset] = 0;
    }
    var source = this.context.createBufferSource(); // creates a sound source
    source.buffer = this.soundbuffer[idx];
    source.connect(this.context.destination);
    source.onended = this.OnEnded.bind(this);
    source.start(this.basetime + period*(this.periodsize)/this.samplerate);

    // save the source. Otherwise the garbage collector might take them and the function OnEnded is not executed
    this.source[idx] = source;
}

LoopSoundBuffer.prototype.AddBuffer = function(addbuffer)
{
    if (!this.enabled) return;

    var currentperiod = (this.bufferpos / this.periodsize);
    if ((currentperiod) < (this.period+2)) {
        this.bufferpos = this.periodsize*(this.period+4);
        //message.Debug("Warning: Sound buffer underrun, resetting");
    }
    if (currentperiod > (this.period+5)) {
        this.bufferpos = this.periodsize*(this.period+4);
        //message.Debug("Warning: Sound buffer overrun, resetting");
    }

    for(var i=0; i<addbuffer.length; i++) {
        this.buffer[this.bufferpos%this.sampleslen] = addbuffer[i]/128.;
        this.bufferpos++;
    }
}

module.exports = LoopSoundBuffer;
