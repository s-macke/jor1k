// -------------------------------------------------
// -------------------- UART -----------------------
// -------------------------------------------------
// uart16550 compatible
// the driver source is spread in drivers/tty/serial/8250/

// See
// http://www.tldp.org/HOWTO/Serial-HOWTO-18.html
// http://www.lammertbies.nl/comm/info/serial-uart.html
// http://www.freebsd.org/doc/en/articles/serial-uart/

"use strict";

var message = require('../messagehandler');
var utils = require('../utils');

// Register offsets
var UART_RXBUF = 0; /* R: Rx buffer, DLAB=0 */
var UART_TXBUF = 0; /* W: Tx buffer, DLAB=0 (also called transmitter hoilding register */
var UART_DLL   = 0; /* R/W: Divisor Latch Low, DLAB=1 */
var UART_DLH   = 1; /* R/W: Divisor Latch High, DLAB=1 */
var UART_IER   = 1; /* R/W: Interrupt Enable Register */
var UART_IIR   = 2; /* R: Interrupt ID Register */
var UART_FCR   = 2; /* W: FIFO Control Register */
var UART_LCR   = 3; /* R/W: Line Control Register */
var UART_MCR   = 4; /* W: Modem Control Register */
var UART_LSR   = 5; /* R: Line Status Register */
var UART_MSR   = 6; /* R: Modem Status Register */
var UART_SCR   = 7; /* R/W: Scratch Register*/

// Line Status register bits
var UART_LSR_DATA_READY        = 0x1;  // data available
var UART_LSR_TX_EMPTY        = 0x20; // TX (THR) buffer is empty
var UART_LSR_TRANSMITTER_EMPTY = 0x40; // TX empty and line is idle

// Interrupt enable register bits
var UART_IER_MSI  = 0x08; /* Modem Status Changed int. */
var UART_IER_BRK  = 0x04; /* Enable Break int. */
var UART_IER_THRI = 0x02; /* Enable Transmitter holding register int. */
var UART_IER_RDI  = 0x01; /* Enable receiver data interrupt */

// Interrupt identification register bits
var UART_IIR_MSI    = 0x00; /* Modem status interrupt (Low priority). Reset by MSR read */
var UART_IIR_NO_INT = 0x01;
var UART_IIR_THRI   = 0x02; /* Transmitter holding register empty. Reset by IIR read or THR write */
var UART_IIR_RDI    = 0x04; /* Receiver data interrupt. Reset by RBR read */
var UART_IIR_RLSI   = 0x06; /* Receiver line status interrupt (High p.). Reset by LSR read */
var UART_IIR_CTI    = 0x0c; /* Character timeout. Reset by RBR read */

// Line control register bits
var UART_LCR_DLAB   = 0x80; /* Divisor latch access bit */

// Modem control register bits
var UART_MCR_DTR = 0x01; /* Data Terminal Ready - Kernel ready to receive */
var UART_MCR_RTS = 0x02; /* Request To Send - Kernel ready to receive */

// Modem status register bits
var UART_MSR_DCD       = 0x80; /* Data Carrier Detect */
var UART_MSR_DSR       = 0x20; /* Data set Ready */
var UART_MSR_DELTA_DSR = 0x2;
var UART_MSR_CTS       = 0x10; /* Clear to Send */
var UART_MSR_DELTA_CTS = 0x1;

// register descriptions for debug mode
var MCR_BIT_DESC = ["DataTerminalReady", "RTS", "AuxOut1", "AuxOut2", "Loopback", "Autoflow"/*16750*/];
var FCR_BIT_DESC = ["FIFO enable", "Reset", "XMIT-FIFO-Reset", "DMA-Mode", "Reserved", "Reserved", "RecrTrig(LSB)", "RecrTrig(MSB)"];
var LCR_BIT_DESC = ["WordLen", "WordLen", "StopBits", "Parity", "EvenParity", "StickParity", "Break", "DivisorLatch"];
var MSR_BIT_DESC = ["DeltaCTS", "DeltaDataSetReady", "DeltaRingIndicator", "DeltaCarrierDetect", "ClearToSend", "DataSetReady", "RingIndicator", "CarrierDetect"];
var LSR_BIT_DESC = ["RxDataAvail", "OverrunErr", "ParityErr", "FrameErr", "BreakSignal", "TxEmpty", "TxEmptyLine", "BadRxFifoData"];
var IER_BIT_DESC = ["RxAvailableI", "TxEmptyI", "BreakI", "MSI"];


// constructor
function UARTDev(id, intdev, intno) {
    this.intno = intno;
    this.intdev = intdev;
    this.id = id;
    //this.verboseuart = true;
    message.Register("tty" + id, this.ReceiveChar.bind(this) );
    this.Reset();
}

UARTDev.prototype.ToBitDescription = function(val, desc) {
    val &= 0xff;
    var result= ("00000000" + val.toString(2)).substr(-8)+ ":"
    for(var i=0; i < desc.length; i++) {
        result += " " + desc[i] + ":" + ((val>>i)&1);
    }
    return result;
}

UARTDev.prototype.Reset = function() {

    this.LCR = 0x3; // Line Control, reset, character has 8 bits
    this.LSR = UART_LSR_TRANSMITTER_EMPTY | UART_LSR_TX_EMPTY; // Transmitter serial register empty and Transmitter buffer register empty
    this.MSR = UART_MSR_DCD | UART_MSR_DSR | UART_MSR_CTS; // modem status register
    this.ints = 0x0; // internal interrupt pending register
    this.IIR = UART_IIR_NO_INT; // Interrupt Identification, no interrupt
    this.IER = 0x0; //Interrupt Enable
    this.DLL = 0x0;
    this.DLH = 0x0;
    this.FCR = 0x0; // FIFO Control;
    this.MCR = 0x0; // Modem Control

    this.rxbuf = new Array(); // receive fifo buffer.
    this.txbuf = new Array(); // transmit fifo buffer.
}

UARTDev.prototype.Step = function() {
    if(this.txbuf.length != 0) {
        message.Send("tty"+this.id, this.txbuf);
        this.txbuf = new Array();
    }
}

// To prevent the character from being overwritten we use a javascript array-based fifo and request a character timeout. 
UARTDev.prototype.ReceiveChar = function(data) {
    data.forEach(function(c) {
        this.rxbuf.push(c&0xFF);
    }.bind(this));
    if (this.rxbuf.length > 0) {
        this.LSR |= UART_LSR_DATA_READY;
        this.ThrowInterrupt(UART_IIR_CTI);
    }
}

UARTDev.prototype.CheckInterrupt = function() {
    if ((this.ints & (1 << UART_IIR_CTI))  && (this.IER & UART_IER_RDI)) {
        this.IIR = UART_IIR_CTI;
        this.intdev.RaiseInterrupt(this.intno);
    } else
    if ((this.ints & (1 << UART_IIR_THRI)) && (this.IER & UART_IER_THRI)) {
        this.IIR = UART_IIR_THRI;
        this.intdev.RaiseInterrupt(this.intno);
    } else
    if ((this.ints & (1 << UART_IIR_MSI))  && (this.IER & UART_IER_MSI)) {
        this.IIR = UART_IIR_MSI;
        this.intdev.RaiseInterrupt(this.intno);
    } else {
        this.IIR = UART_IIR_NO_INT;
        this.intdev.ClearInterrupt(this.intno);
    }
};

UARTDev.prototype.ThrowInterrupt = function(line) {
    this.ints |= (1 << line);
    this.CheckInterrupt();
}

UARTDev.prototype.ClearInterrupt = function(line) {
    this.ints &= ~(1 << line);
    this.CheckInterrupt();
};

UARTDev.prototype.ReadReg8 = function(addr) {

    if (this.LCR & UART_LCR_DLAB) {  // Divisor latch access bit
        switch (addr) {
        case UART_DLL:
            return this.DLL;
            break;

        case UART_DLH:
            return this.DLH;
            break;
        }
    }

    switch (addr) {
    case UART_RXBUF:
        var ret = 0x0; // if the buffer is empty, return 0
        if (this.rxbuf.length > 0) {
            ret = this.rxbuf.shift();
        }
        if (this.rxbuf.length == 0) {
            this.LSR &= ~UART_LSR_DATA_READY;
            this.ClearInterrupt(UART_IIR_CTI);
        }
        return ret & 0xFF;
        break;

    case UART_IER:
        return this.IER & 0x0F;
        break;

    case UART_MSR:
        var ret = this.MSR;
        this.MSR &= 0xF0; // reset lowest 4 "delta" bits
        if (this.verboseuart) message.Debug("Get UART_MSR " + this.ToBitDescription(ret, MSR_BIT_DESC));
        return ret;
        break;

    case UART_IIR:
        {
            // the two top bits (fifo enabled) are always set
            var ret = (this.IIR & 0x0F) | 0xC0;
             
            if (this.IIR == UART_IIR_THRI) {
                this.ClearInterrupt(UART_IIR_THRI);
            }
            
            return ret;
            break;
        }

    case UART_LCR:
        return this.LCR;
        break;

    case UART_LSR:
        // This gets polled many times a second, so logging is commented out
        // if(this.verboseuart) message.Debug("Get UART_LSR " + this.ToBitDescription(this.LSR, LSR_BIT_DESC));
        return this.LSR;
        break;

    default:
        message.Debug("Error in ReadRegister: not supported");
        message.Abort();
        break;
    }
};

UARTDev.prototype.WriteReg8 = function(addr, x) {
    x &= 0xFF;

    if (this.LCR & UART_LCR_DLAB) {
        switch (addr) {
        case UART_DLL:
            this.DLL = x;
            return;
            break;
        case UART_DLH:
            this.DLH = x;
            return;
            break;
        }
    }

    switch (addr) {
    case UART_TXBUF: 
         // we assume here, that the fifo is on

         // In the uart spec we reset UART_IIR_THRI now ...
        this.LSR &= ~UART_LSR_TRANSMITTER_EMPTY;
        //this.LSR &= ~UART_LSR_TX_EMPTY;

        this.txbuf.push(x);
        //message.Debug("send " + x);
        // the data is sent immediately
        this.LSR |= UART_LSR_TRANSMITTER_EMPTY | UART_LSR_TX_EMPTY; // txbuffer is empty immediately
        this.ThrowInterrupt(UART_IIR_THRI);
        break;

    case UART_IER:
        // 2 = 10b ,5=101b, 7=111b
        this.IER = x & 0x0F; // only the first four bits are valid
        //if(this.verboseuart) message.Debug("Set UART_IER " + this.ToBitDescription(x, IER_BIT_DESC));
        // Check immediately if there is a interrupt pending
        this.CheckInterrupt();
        break;

    case UART_FCR:
        if(this.verboseuart) message.Debug("Set UART_FCR " + this.ToBitDescription(x, FCR_BIT_DESC));
        this.FCR = x & 0xC9;
        if (this.FCR & 2) {
            this.ClearInterrupt(UART_IIR_CTI);
            this.rxbuf = new Array(); // clear receive fifo buffer
        }
        if (this.FCR & 4) {
            this.txbuf = new Array(); // clear transmit fifo buffer
        }
        break;

    case UART_LCR:
        if(this.verboseuart)  message.Debug("Set UART_LCR " + this.ToBitDescription(x, LCR_BIT_DESC));
        if ((this.LCR & 3) != 3) {
            message.Debug("Warning in UART: Data word length other than 8 bits are not supported");
        }
        this.LCR = x;
        break;

    case UART_MCR:
        if(this.verboseuart) message.Debug("Set UART_MCR " + this.ToBitDescription(x,MCR_BIT_DESC));
        this.MCR = x;
        break;

    default:
        message.Debug("Error in WriteRegister: not supported");
        message.Abort();
        break;
    }
};


module.exports = UARTDev;
