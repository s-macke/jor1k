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
