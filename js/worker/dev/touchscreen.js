// -------------------------------------------------
// ---------------- TOUCHSCREEN --------------------
// -------------------------------------------------
// Emulating the LPC32xx

"use strict";

var message = require('../messagehandler');
var utils = require('../utils');

// controller register offsets
var LPC32XX_TSC_STAT                      = 0x00;
var LPC32XX_TSC_SEL                       = 0x04;
var LPC32XX_TSC_CON                       = 0x08;
var LPC32XX_TSC_FIFO                      = 0x0C;
var LPC32XX_TSC_DTR                       = 0x10;
var LPC32XX_TSC_RTR                       = 0x14;
var LPC32XX_TSC_UTR                       = 0x18;
var LPC32XX_TSC_TTR                       = 0x1C;
var LPC32XX_TSC_DXP                       = 0x20;
var LPC32XX_TSC_MIN_X                     = 0x24;
var LPC32XX_TSC_MAX_X                     = 0x28;
var LPC32XX_TSC_MIN_Y                     = 0x2C;
var LPC32XX_TSC_MAX_Y                     = 0x30;
var LPC32XX_TSC_AUX_UTR                   = 0x34;
var LPC32XX_TSC_AUX_MIN                   = 0x38;
var LPC32XX_TSC_AUX_MAX                   = 0x3C;

var LPC32XX_TSC_ADCCON_AUTO_EN = (1 << 0); // automatic ts event capture
var LPC32XX_TSC_STAT_FIFO_EMPTY = (1 << 7); // fifo is empty; 
var LPC32XX_TSC_FIFO_TS_P_LEVEL = (1 << 31) // touched

function TouchscreenDev(intdev) {
    this.intdev = intdev;
    this.Reset();
    message.Register("tsmousedown", this.onmousedown.bind(this) );
    message.Register("tsmouseup", this.onmouseup.bind(this) );
    message.Register("tsmousemove", this.onmousemove.bind(this) );
}

TouchscreenDev.prototype.Reset = function() {
    this.control = 0x0; // control register
    this.status = LPC32XX_TSC_STAT_FIFO_EMPTY;
    this.ispressed = false;
    this.mousemovecount = 0;
    this.fifo = 0x0;
    this.fifosize = 0x0;
}

TouchscreenDev.prototype.onmousedown = function(event) {
    if (!(this.control & LPC32XX_TSC_ADCCON_AUTO_EN)) return;
    var x = event.x;
    var y = event.y;
    this.status &= ~LPC32XX_TSC_STAT_FIFO_EMPTY;
    this.fifosize = 0x4;
    this.fifo = 0x0;
    this.fifo |= ((0x3FF-x)&0x3FF) << 16;
    this.fifo |= ((0x3FF-y)&0x3FF);
    //this.fifo |= (x) << 16;
    //this.fifo |= (y);
    this.ispressed = true;
    this.intdev.RaiseInterrupt(0x9);
}

TouchscreenDev.prototype.onmousemove = function(event) {
    if (!(this.control & LPC32XX_TSC_ADCCON_AUTO_EN)) return;
    if (!this.ispressed) return;
    this.mousemovecount++;
    if (this.mousemovecount&3) return; // handle mouse move only every fourth time
    var x = event.x;
    var y = event.y;
    this.status &= ~LPC32XX_TSC_STAT_FIFO_EMPTY;
    this.fifosize = 0x4;
    this.fifo = 0x0;
    this.fifo |= ((0x3FF-x)&0x3FF) << 16;
    this.fifo |= ((0x3FF-y)&0x3FF);
    this.intdev.RaiseInterrupt(0x9);
}


TouchscreenDev.prototype.onmouseup = function(event) {
    if (!(this.control & LPC32XX_TSC_ADCCON_AUTO_EN)) return;
    var x = event.x;
    var y = event.y;
    this.status &= ~LPC32XX_TSC_STAT_FIFO_EMPTY;
    this.fifosize = 0x0; // just a button up event
    this.fifo = LPC32XX_TSC_FIFO_TS_P_LEVEL;
    this.ispressed = false;
    this.intdev.RaiseInterrupt(0x9);
}

TouchscreenDev.prototype.ReadReg32 = function (addr) {
    switch(addr)
    {
        case LPC32XX_TSC_CON:
            return this.control;
            break;
        case LPC32XX_TSC_STAT:
            this.intdev.ClearInterrupt(0x9);
            return this.status;
            break;
        case LPC32XX_TSC_FIFO:
            if (this.fifosize <= 0)
                this.status |= LPC32XX_TSC_STAT_FIFO_EMPTY;
            this.fifosize--;
            return this.fifo;
            break;
    }
    // message.Debug("Touchscreen ReadReg32: " + utils.ToHex(addr));
    return 0x0;
}

TouchscreenDev.prototype.WriteReg32 = function (addr, value) {
    switch(addr)
    {
        case LPC32XX_TSC_CON:
            this.control = value;
            return;
            break;
        case LPC32XX_TSC_SEL:
        case LPC32XX_TSC_MIN_X:
        case LPC32XX_TSC_MAX_X:
        case LPC32XX_TSC_MIN_Y:
        case LPC32XX_TSC_MAX_Y:
        case LPC32XX_TSC_AUX_UTR:
        case LPC32XX_TSC_AUX_MIN:
        case LPC32XX_TSC_AUX_MAX:
        case LPC32XX_TSC_RTR:
        case LPC32XX_TSC_DTR:
        case LPC32XX_TSC_TTR:
        case LPC32XX_TSC_DXP:
        case LPC32XX_TSC_UTR:
            return;
        break;

    }
    // message.Debug("Touchscreen WriteReg32: " + utils.ToHex(addr) + ": " + utils.ToHex(value));
    return;
}

module.exports = TouchscreenDev;
