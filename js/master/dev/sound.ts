// Provides a loop sound buffer.

import message from '../messagehandler.js';

"use strict";

class LoopSoundBuffer {
    enabled: boolean;
    nperiods: number;
    source: (AudioBufferSourceNode | null)[];
    soundbuffer: AudioBuffer[];
    period: number;
    periodsize: number;
    bufferpos: number;
    context?: AudioContext;
    samplerate?: number;
    sampleslen?: number;
    buffer?: Float32Array;
    basetime?: number;

    constructor(samplerate: number) {
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

    SetRate(rate: number): void {
        if (this.samplerate == rate) return;
        if (typeof this.context === "undefined") return;
        this.samplerate = rate;
        this.periodsize = Math.floor(this.samplerate / 4); // 250ms
        this.sampleslen = this.periodsize * this.nperiods;
        this.buffer = new Float32Array(this.sampleslen);

        for (let i = 0; i < this.nperiods; i++) {
            this.soundbuffer[i] = this.context.createBuffer(1, this.periodsize, this.samplerate);
        }
    }

    OnEnded(): void {
        if (!this.enabled) return;
        this.PlayBuffer(this.period);
        this.period++;
    }

    Enabled(e: boolean): void {
        this.enabled = e;
        if (typeof this.context === "undefined") return;
        if (!e) return;
        this.period = 0;
        this.basetime = this.context.currentTime;
        this.PlayBuffer(0);
        this.PlayBuffer(1);
        this.period = 2;
        this.bufferpos = this.periodsize * (this.period + 4);
    }

    PlayBuffer(period: number): void {
        if (!this.enabled) return;
        if (!this.context) return;
        if (!this.buffer) return;
        if (!this.samplerate) return;
        if (!this.basetime) return;

        const idx = period % this.nperiods;
        const buffer = this.soundbuffer[idx].getChannelData(0);
        const offset = idx * this.periodsize;
        for (let i = 0; i < this.periodsize; i++) {
            buffer[i] = this.buffer[i + offset];
            this.buffer[i + offset] = 0;
        }
        const source = this.context.createBufferSource(); // creates a sound source
        source.buffer = this.soundbuffer[idx];
        source.connect(this.context.destination);
        source.onended = this.OnEnded.bind(this);
        source.start(this.basetime + period * (this.periodsize) / this.samplerate);

        // save the source. Otherwise the garbage collector might take them and the function OnEnded is not executed
        this.source[idx] = source;
    }

    AddBuffer(addbuffer: Int8Array): void {
        if (!this.enabled) return;
        if (!this.buffer) return;
        if (!this.sampleslen) return;

        let currentperiod = (this.bufferpos / this.periodsize);
        if ((currentperiod) < (this.period + 2)) {
            this.bufferpos = this.periodsize * (this.period + 4);
            //message.Debug("Warning: Sound buffer underrun, resetting");
        }
        if (currentperiod > (this.period + 5)) {
            this.bufferpos = this.periodsize * (this.period + 4);
            //message.Debug("Warning: Sound buffer overrun, resetting");
        }

        for (let i = 0; i < addbuffer.length; i++) {
            this.buffer[this.bufferpos % this.sampleslen] = addbuffer[i] / 128.;
            this.bufferpos++;
        }
    }
}

export default LoopSoundBuffer;
