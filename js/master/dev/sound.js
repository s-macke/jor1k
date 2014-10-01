// Provides a loop sound buffer.

"use strict";

function LoopSoundBuffer(samplerate) {
    this.samplerate = samplerate;
    this.sampleslen = samplerate;
    this.periods = 6;
    this.periodsize = Math.floor(this.sampleslen/4);
    this.sampleslen = this.periodsize*this.periods;

    this.initialized = false;
    this.buffer = new Float32Array(this.sampleslen);
    this.source = new Array(this.periods);
    this.soundbuffer = new Array(this.periods);
    this.period = 0;
    this.bufferpos = 0;

    if (typeof AudioContext == "undefined") return;

    this.context = new AudioContext();
    for(var i=0; i<this.periods; i++) {
        this.soundbuffer[i] = this.context.createBuffer(1, this.periodsize, this.samplerate);
    }
    this.initialized = true;
    this.PlayBuffer(0);
    this.PlayBuffer(1);
    this.period = 2;
}

LoopSoundBuffer.prototype.OnEnded = function()
{
        this.PlayBuffer(this.period);
        this.period++;
}

LoopSoundBuffer.prototype.PlayBuffer = function(period)
{
        var idx = period % this.periods;
        var buffer = this.soundbuffer[idx].getChannelData(0);
        var offset = idx * this.periodsize;
        for(var i=0; i<this.periodsize; i++)
        {
                buffer[i] = this.buffer[i + offset];
                this.buffer[i+offset] = 0;
        }
        var source = this.context.createBufferSource(); // creates a sound source
        source.buffer = this.soundbuffer[idx];
        source.connect(this.context.destination);
        source.onended = this.OnEnded.bind(this);
        source.start(period*(this.periodsize)/this.samplerate);

        // save the source. Otherwise the garbage collector might take them and the function OnEnded is not executed
        this.source[idx] = source;
}

LoopSoundBuffer.prototype.AddBuffer = function(addbuffer)
{
    var currentperiod = (this.bufferpos / this.periodsize);
    if ((currentperiod) < (this.period+2)) {
        this.bufferpos = this.periodsize*(this.period+3);
        console.log("Warning: Sound buffer underrun, resetting");
    }
    if (currentperiod > (this.period+4)) {
        this.bufferpos = this.periodsize*(this.period+3);
        console.log("Warning: Sound buffer overrun, resetting");
    }

    for(var i=0; i<addbuffer.length; i++) {
        this.buffer[this.bufferpos%this.sampleslen] = addbuffer[i]/128.;
        this.bufferpos++;
    }
}
