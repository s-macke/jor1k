// -------------------------------------------------
// ---------------------- RTC ----------------------
// -------------------------------------------------
// Real Time Clock emulating the nxp,lpc3220-rtc

"use strict";
var message = require('../messagehandler');
var utils = require('../utils');

/*
 * Clock and Power control register offsets
 */
var LPC32XX_RTC_UCOUNT            = 0x00;
var LPC32XX_RTC_DCOUNT            = 0x04;
var LPC32XX_RTC_MATCH0            = 0x08;
var LPC32XX_RTC_MATCH1            = 0x0C;
var LPC32XX_RTC_CTRL              = 0x10;
var LPC32XX_RTC_INTSTAT           = 0x14;
var LPC32XX_RTC_KEY               = 0x18;
var LPC32XX_RTC_SRAM              = 0x80;

function RTCDev(intdev) {
    this.intdev = intdev;
    this.Reset();
}

RTCDev.prototype.Reset = function() {
    this.ctrl = 0x0;
}


RTCDev.prototype.ReadReg32 = function (addr) {
    switch(addr)
    {
        case LPC32XX_RTC_UCOUNT:
            return Math.floor(new Date().getTime()/1000);
            break;

        case LPC32XX_RTC_CTRL:
            return this.ctrl;
            break;

        case LPC32XX_RTC_KEY: 
            return 0xB5C13F27; // the clock is already running
            break;

        case LPC32XX_RTC_MATCH0:
            return 0x0;
            break;

        case  LPC32XX_RTC_INTSTAT:
            return 0x0;
            break;


        default:
            message.Debug("RTC: unknown ReadReg32: " + utils.ToHex(addr));
            return 0x0;
            break;
    }
    return 0x0;
}

RTCDev.prototype.WriteReg32 = function (addr, value) {
    switch(addr)
    {
        case LPC32XX_RTC_CTRL:
            this.ctrl = value;
            break;

        default:
            message.Debug("RTC: unknown  WriteReg32: " + utils.ToHex(addr) + ": " + utils.ToHex(value));
            return;
            break;
    }
}


module.exports = RTCDev;
