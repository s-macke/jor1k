// -------------------------------------------------
// -------------------- UART -----------------------
// -------------------------------------------------
// See http://www.tldp.org/HOWTO/Serial-HOWTO-18.html#ss18.3

var UART_LSR_DATA_READY = 0x1;
var UART_LSR_FIFO_EMPTY = 0x20;
var UART_LSR_TRANSMITTER_EMPTY = 0x40;

var UART_IER_THRI = 0x02; /* Enable Transmitter holding register int. */
var UART_IER_RDI = 0x01; /* Enable receiver data interrupt */

var UART_IIR_MSI = 0x00; /* Modem status interrupt (Low priority) */
var UART_IIR_NO_INT = 0x01;
var UART_IIR_THRI = 0x02; /* Transmitter holding register empty */
var UART_IIR_RDI = 0x04; /* Receiver data interrupt */
var UART_IIR_RLSI = 0x06; /* Receiver line status interrupt (High p.) */
var UART_IIR_CTI = 0x0c; /* Character timeout */

var UART_LCR_DLAB = 0x80; /* Divisor latch access bit */

var UART_RXBUF = 0; /* R: Rx buffer, DLAB=0 */
var UART_TXBUF = 0; /* W: Tx buffer, DLAB=0 */
var UART_DLL = 0; /* R/W: Divisor Latch Low, DLAB=1 */
var UART_DLH = 1; /* R/W: Divisor Latch High, DLAB=1 */
var UART_IER = 1; /* R/W: Interrupt Enable Register */
var UART_IIR = 2; /* R: Interrupt ID Register */
var UART_FCR = 2; /* W: FIFO Control Register */
var UART_LCR = 3; /* R/W: Line Control Register */
var UART_MCR = 4; /* W: Modem Control Register */
var UART_LSR = 5; /* R: Line Status Register */
var UART_MSR = 6; /* R: Modem Status Register */
var UART_SCR = 7; /* R/W: Scratch Register*/


// constructor
function UARTDev(intdev, intno) {
    this.intno = intno;
    this.intdev = intdev;
    this.TransmitCallback = function(data){}; // Should call handler to send data asynchronously.
    this.Reset();  
}
UARTDev.prototype.Reset = function() {
    this.LCR = 0x3; // Line Control, reset, character has 8 bits
    this.LSR = UART_LSR_TRANSMITTER_EMPTY | UART_LSR_FIFO_EMPTY; // Line Status register, Transmitter serial register empty and Transmitter buffer register empty
    this.MSR = 0; // modem status register
    this.IIR = UART_IIR_NO_INT; // Interrupt Identification, no interrupt
    this.ints = 0x0; // no interrupt pending
    this.IER = 0x0; //Interrupt Enable
    this.DLL = 0;
    this.DLH = 0;
    this.FCR = 0x0; // FIFO Control;
    this.MCR = 0x0; // Modem Control
    this.rxbuf = new Array(); // receive fifo buffer. Simple JS push/shift O(N) implementation 
}

// To prevent the character from being overwritten we use a javascript array-based fifo and immediately request a character timeout. 
UARTDev.prototype.ReceiveChar = function(x) {
    this.rxbuf.push(x&0xFF);
    this.LSR |= UART_LSR_DATA_READY;
    this.ThrowCTI();

};

UARTDev.prototype.ThrowCTI = function() {
    this.ints |= 1 << UART_IIR_CTI;
    if (!(this.IER & UART_IER_RDI)) {
        return;
    }
    if ((this.IIR != UART_IIR_RLSI) && (this.IIR != UART_IIR_RDI)) {
        this.IIR = UART_IIR_CTI;
        this.intdev.RaiseInterrupt(this.intno);
    }
};

UARTDev.prototype.ThrowTHRI = function() {
    this.ints |= 1 << UART_IIR_THRI;
    if (!(this.IER & UART_IER_THRI)) {
        return;
    }
    if ((this.IIR & UART_IIR_NO_INT) || (this.IIR == UART_IIR_MSI) || (this.IIR == UART_IIR_THRI)) {
        this.IIR = UART_IIR_THRI;
        this.intdev.RaiseInterrupt(this.intno);
    }
};

UARTDev.prototype.NextInterrupt = function() {
    if ((this.ints & (1 << UART_IIR_CTI)) && (this.IER & UART_IER_RDI)) {
        this.ThrowCTI();
    }
    else if ((this.ints & (1 << UART_IIR_THRI)) && (this.IER & UART_IER_THRI)) {
        this.ThrowTHRI();
    }
    else {
        this.IIR = UART_IIR_NO_INT;
        this.intdev.ClearInterrupt(this.intno);
    }
};

UARTDev.prototype.ClearInterrupt = function(line) {
    this.ints &= ~ (1 << line);
    if (line != this.IIR) {
        return;
    }
    this.NextInterrupt();
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
        {
            var ret = 0x21; // !
            this.ClearInterrupt(UART_IIR_RDI);
            this.ClearInterrupt(UART_IIR_CTI);
            var rxbuf_len = this.rxbuf.length;
            if (rxbuf_len >= 1) {
                ret = this.rxbuf.shift();
            }
            // Due to shift(), the fifo buffer is now smaller. Perhaps we shifted the last byte?
            if(rxbuf_len > 1) { // Still more bytes to read - immediately timeout
                this.LSR |= UART_LSR_DATA_READY;
                this.ThrowCTI(); // Immediately timeout - we're ready to transfer
            }
            else { // No more bytes after this one
                this.LSR &= ~UART_LSR_DATA_READY;
            }
            return ret;
        }
        break;
    case UART_IER:
        return this.IER & 0x0F;
        break;
    case UART_MSR:
        return this.MSR;
        break;
    case UART_IIR:
        {
            var ret = (this.IIR & 0x0f) | 0xC0; // the two top bits are always set
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
        return this.LSR;
        break;

    default:
        DebugMessage("Error in ReadRegister: not supported");
        abort();
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
        this.LSR &= ~UART_LSR_FIFO_EMPTY;
        this.TransmitCallback(x); // Data is send with a latency of zero!
        this.LSR |= UART_LSR_FIFO_EMPTY; // txbuffer is empty
        this.ThrowTHRI();
        break;
    case UART_IER:
        // 2 = 10b ,5=101b, 7=111b
        this.IER = x & 0x0F; // only the first four bits are valid
        // Ok, check immediately if there is a interrupt pending
        this.NextInterrupt();
        break;
    case UART_FCR:
        this.FCR = x;
        if (this.FCR & 2) {
            this.fifo = new Array(); // clear receive fifo buffer
        }
        break;
    case UART_LCR:
        this.LCR = x;
        break;
    case UART_MCR:
        this.MCR = x;
        break;
    default:
        DebugMessage("Error in WriteRegister: not supported");
        abort();
        break;
    }
};
