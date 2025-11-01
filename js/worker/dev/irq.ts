// -------------------------------------------------
// ---------------------- IRQ ----------------------
// -------------------------------------------------
// Stefan Kristianssons ompic suitable for smp systems
// Just the ipi part

"use strict";

import message from '../messagehandler.js';
import * as utils from '../utils.js';

// Control register
// +---------+---------+----------+---------+
// | 31      | 30      | 29 .. 16 | 15 .. 0 |
// ----------+---------+----------+----------
// | IRQ ACK | IRQ GEN | DST CORE | DATA    |
// +---------+---------+----------+---------+

// Status register
// +----------+-------------+----------+---------+
// | 31       | 30          | 29 .. 16 | 15 .. 0 |
// -----------+-------------+----------+---------+
// | Reserved | IRQ Pending | SRC CORE | DATA    |
// +----------+-------------+----------+---------+

const OMPIC_IPI_CTRL_IRQ_ACK = (1 << 31);
const OMPIC_IPI_CTRL_IRQ_GEN = (1 << 30);
const OMPIC_IPI_STAT_IRQ_PENDING = (1 << 30);

interface SMPInterruptController {
    heap: ArrayBuffer;
    RaiseSoftInterrupt(line: number, cpuid: number): void;
    ClearSoftInterrupt(line: number, cpuid: number): void;
}

class IRQDev {
    intdev: SMPInterruptController;
    regs: Uint32Array;

    constructor(intdev: SMPInterruptController) {
        this.intdev = intdev;
        this.regs = new Uint32Array(32*2); // maximum 32 cpus
        this.Reset();
    }

    Reset(): void {
        for(let i=0; i<32*2; i++) {
            this.regs[i] = 0x0;
        }
    }

    ReadReg32(addr: number): number {
        addr >>= 2;
        if (addr > 32*2) {
            message.Debug("IRQDev: Unknown ReadReg32: " + utils.ToHex(addr));
            return 0x0;
        }
        /*
        var cpuid = addr >> 1;    
        if (addr&1) {
            message.Debug("IRQDev: Read STAT of CPU " + cpuid);
        } else {
            message.Debug("IRQDev: Read CTRL of CPU " + cpuid);
        }
        */
        return this.regs[addr];
    }

    WriteReg32(addr: number, value: number): void {
        addr >>= 2;
        if (addr > 32*2) {
            message.Debug("IRQDev: unknown  WriteReg32: " + utils.ToHex(addr) + ": " + utils.ToHex(value));
            return;
        }

        const cpuid = addr >> 1;
        if (addr&1) {
            message.Debug("Error in IRQDev: Write STAT of CPU " + cpuid +" : " + utils.ToHex(value));
        } else {
            this.regs[addr] = value;
            const irqno = value & 0xFFFF;
            const dstcpu = (value >> 16) & 0x3fff;
            const flags = (value >> 30) & 3;
            /*
            message.Debug("IRQDev: Write CTRL of CPU " + cpuid + " : " +
                " dstcpu=" + dstcpu  +
                " irqno=" + irqno +
                " flags=" + flags
                );
            */

            if (flags & 1) { // irq gen
                if (dstcpu == cpuid) {
                    message.Debug("Warning in IRQDev: Try to raise its own IRQ");
                }
                if (this.regs[(dstcpu<<1)+1] & OMPIC_IPI_STAT_IRQ_PENDING) {
                    message.Debug("Warning in IRQDev: CPU " + cpuid + " raised irq on cpu " + dstcpu + " without previous acknowledge");
                    const h = new Int32Array(this.intdev.heap);
                    message.Debug("The pc of cpu " + dstcpu + " is " + utils.ToHex(h[(dstcpu<<15) + 0x124 >> 2]));
                    message.Debug("The IEE flag of cpu " + dstcpu + " is " + ( h[(dstcpu<<15) + 0x120 >> 2] & (1<<2)) );
                    message.Debug("r9 of cpu " + dstcpu + " is " + utils.ToHex(h[(dstcpu<<15) + (0x9<<2) >> 2]));
                }
                this.regs[(dstcpu<<1)+1] = OMPIC_IPI_STAT_IRQ_PENDING | ((cpuid & 0x3fff) << 16) | irqno;
                this.intdev.RaiseSoftInterrupt(0x1, dstcpu);
            }
            if (flags & 2) { // irq ack
                this.regs[addr+1] &= ~OMPIC_IPI_STAT_IRQ_PENDING;
                this.intdev.ClearSoftInterrupt(0x1, cpuid);
            }

        }
    }
}

export default IRQDev;
