// -------------------------------------------------
// ---------------------- IRQ ----------------------
// -------------------------------------------------
// Stefan Kristianssons ompic suitable for smp systems
// Just the ipi part

"use strict";

var message = require('../messagehandler');
var utils = require('../utils');

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

var OMPIC_IPI_CTRL_IRQ_ACK = (1 << 31);
var OMPIC_IPI_CTRL_IRQ_GEN = (1 << 30);
var OMPIC_IPI_STAT_IRQ_PENDING = (1 << 30);

function IRQDev(intdev) {
    this.intdev = intdev;
    this.regs = new Uint32Array(32*2); // maximum 32 cpus
    this.Reset();
}

IRQDev.prototype.Reset = function() {
    for(var i=0; i<32*2; i++) {
        this.regs[i] = 0x0;
    }
}

IRQDev.prototype.ReadReg32 = function (addr) {
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

IRQDev.prototype.WriteReg32 = function (addr, value) {
    addr >>= 2;
    if (addr > 32*2) {
        message.Debug("IRQDev: unknown  WriteReg32: " + utils.ToHex(addr) + ": " + utils.ToHex(value));
        return;
    }

    var cpuid = addr >> 1;
    if (addr&1) {
        message.Debug("Error in IRQDev: Write STAT of CPU " + cpuid +" : " + utils.ToHex(value));
    } else {
        this.regs[addr] = value;
        var irqno = value & 0xFFFF;
        var dstcpu = (value >> 16) & 0x3fff;
        var flags = (value >> 30) & 3;
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
                var h = new Int32Array(this.intdev.heap);
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

module.exports = IRQDev;
