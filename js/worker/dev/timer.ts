// -------------------------------------------------
// -------------------- Timer ----------------------
// -------------------------------------------------
// Simple Timer running with the CPU frequency (20MHz) used to synchronize the cpu timers
// the syncing is done directly in the cpu, so we can return zero here.

"use strict";

import { Debug } from '../messagehandler.js';

class TimerDev {
    sync: number;

    constructor() {
        this.sync = 0;
        this.Reset();
    }

    Reset(): void {
        this.sync = 0x0;
    }

    ReadReg32(_addr: number): number {
        //message.Debug("Timer: Read reg " + addr);
        return this.sync;    
    }

    WriteReg32(addr: number, value: number): void {
        Debug("Error in Timer: Write reg " + addr + " : " + value);
    }
}

export default TimerDev;
