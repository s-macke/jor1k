// -------------------------------------------------
// -------------------- UART -----------------------
// -------------------------------------------------
// See http://www.tldp.org/HOWTO/Serial-HOWTO-18.html#ss18.3
// http://www.lammertbies.nl/comm/info/serial-uart.html#IIR

var UART_LSR_DATA_READY = 0x1;
var UART_LSR_FIFO_EMPTY = 0x20;
var UART_LSR_TRANSMITTER_EMPTY = 0x40;

var UART_IER_MSI = 0x08; /* Modem Status Changed int. */
var UART_IER_BRK = 0x04; /* Enable Break int. */
var UART_IER_THRI = 0x02; /* Enable Transmitter holding register int. */
var UART_IER_RDI = 0x01; /* Enable receiver data interrupt */

var UART_IIR_MSI = 0x00; /* Modem status interrupt (Low priority). Reset by MSR read */
var UART_IIR_NO_INT = 0x01;
var UART_IIR_THRI = 0x02; /* Transmitter holding register empty. Reset by IIR read or THR write */
var UART_IIR_RDI = 0x04; /* Receiver data interrupt. Reset by RBR read */
var UART_IIR_RLSI = 0x06; /* Receiver line status interrupt (High p.). Reset by LSR read */
var UART_IIR_CTI = 0x0c; /* Character timeout. Reset by RBR read */


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

var UART_MCR_DTR = 0x01; /* Data Terminal Ready - Kernel ready to receive */
var UART_MSR_DSR= 0x20; 
var UART_MSR_DELTA_DSR= 0x2; 

var UART_VERBOSE = true;
var MCR_BIT_DESC=["DataTerminalReady", "RTS", "AuxOut1", "AuxOut2", "Loopback","Autoflow"/*16750*/]; 
var FCR_BIT_DESC=["FIFO enable", "Reset", "XMIT-FIFO-Reset", "DMA-Mode", "Reserved", "Reserved", "RecrTrig(LSB)", "RecrTrig(MSB)"];
var LCR_BIT_DESC=["WordLen", "WordLen", "StopBits", "Parity", "EvenParity", "StickParity", "Break", "DivisorLatch"];    
var MSR_BIT_DESC=["DeltaCTS","DeltaDataSetReady","DeltaRingIndicator",  "DeltaCarrierDetect",  "CTS",  "DataSetReady",  "RingIndicator","CarrierDetect"];
var LSR_BIT_DESC=["RxDataAvail","OverrunErr","ParityErr","FrameErr","BreakSignal","TxEmpty","TxEmptyLine","BadRxFifoData"];
var IER_BIT_DESC=["RxAvailableI","TxEmptyI","BreakI","MSI"];

// Non-spec UART rx implementation to prevent incoming infinite bandwidth from overflowing kernel FLIP buffer:
var UART_RXMODE_NONE = 0; /* No flow control Immediately send incoming chars to the kernel */
var UART_RXMODE_DTR = 1; /* Don't send unless MCR_DataTerminalReady bit is set */
// Other protocols (e.g. RTS-CTS; wait for char echo; interval timer) are possible


// constructor
function UARTDev(intdev, intno) {
    this.intno = intno;
    this.intdev = intdev;
    this.TransmitCallback = function(data){}; // Should call handler to send data asynchronously.
    this.Reset();  
}

UARTDev.prototype.ToBitDescription = function(val, desc) {
    val &= 0xff;
    var result= ("00000000" + val.toString(2)).substr(-8)+ ":"
    for(var i=0; i < desc.length; i++) {
       result  += " "+desc[i]+":"+ ((val>>i)&1); 
    }
    return result;
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
    this.rxon = true; 
    this.rxmode = UART_RXMODE_NONE;
}

// To prevent the character from being overwritten we use a javascript array-based fifo and immediately request a character timeout. 
UARTDev.prototype.ReceiveChar = function(x) {
    this.rxbuf.push(x&0xFF);
    this.UpdateRx();
}
// Consider UpdateRx handle status changes upon a fake character that has just arrived
UARTDev.prototype.UpdateRx = function() {
  if(this.rxbuf.length > 0) {
    // Update DSR
    if(this.rxmode == UART_RXMODE_DTR) {
      if((this.MSR & UART_MSR_DSR)==0) {
        this.MSR |= UART_MSR_DELTA_DSR | UART_MSR_DSR; // DataSetReady 
        this.ThrowMSR();
        // is a return necessary at this point? (if so, call updateRX upon MS read)
      }
    }
    // update UART_LSR_DATA_READY if the kernel is ready
    if(this.rxmode == UART_RXMODE_NONE || 
        (this.rxmode == UART_RXMODE_DTR) && (this.MCR & UART_MCR_DTR))
    {
      this.LSR |= UART_LSR_DATA_READY;
      this.ThrowCTI();
    } 
  } 
  else 
  {
    // No characters left, we're not ready to send anymore
    // Note, LSR is handled during read
    if(this.rxmode == UART_RXMODE_DTR) {
      if((this.MSR & UART_MSR_DSR)==0) {
        this.MSR &= ~UART_MSR_DSR; // DataSetReady 
        this.MSR |= UART_MSR_DELTA_DSR;
        this.ThrowMSR();
        // is a return necessary at this point? (if so, call updateRX upon MS read)
      }
    }
  }
};

UARTDev.prototype.ThrowMSI = function() {
    this.ints |= 1 << UART_IIR_MSI;
    if (!(this.IER & UART_IER_MSI)) {
        return;
    }
    if ((this.IIR == UART_IIR_NO_INT)) {
        this.IIR = UART_IIR_MSI;
        this.intdev.RaiseInterrupt(this.intno);
    }
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
    } else  if ((this.ints & (1 << UART_IIR_MSI)) && (this.IER & UART_IER_MSI)) {
        this.ThrowMSI();
    } else {
        this.IIR = UART_IIR_NO_INT;
        this.intdev.ClearInterrupt(this.intno); // on intdev; not the function below
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
            this.LSR &= ~UART_LSR_DATA_READY; 
            var rxbuf_len = this.rxbuf.length;
            if (rxbuf_len >= 1) {
                ret = this.rxbuf.shift();
            }
            // Due to shift(), the fifo buffer is now smaller. Perhaps we shifted the last byte?
            if(rxbuf_len > 1) {
                this.UpdateRx();
            }
            return ret;
        }
        break;
    case UART_IER:
        return this.IER & 0x0F;
        break;
    case UART_MSR:
        var result = this.MSR;
        this.MSR &= 0xf0; // reset lowest 4 "delta" bits
        DebugMessage("Get UART_MSR" + this.ToBitDescription(result,MSR_BIT_DESC))
        return result;
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
        DebugMessage("Get UART_LSR" + this.ToBitDescription(this.LSR,LSR_BIT_DESC))
    
        if (this.IIR == UART_IIR_RLSI) {
          this.ClearInterrupt(UART_IIR_RLSI);
        }
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
         // In theory, reset UART_IIR_THRI here except data is sent with a latency of zero!
        this.LSR &= ~UART_LSR_FIFO_EMPTY;
        this.TransmitCallback(x); 
        this.LSR |= UART_LSR_FIFO_EMPTY; // txbuffer is empty
        this.ThrowTHRI();
        break;
    case UART_IER:
        // 2 = 10b ,5=101b, 7=111b
        this.IER = x & 0x0F; // only the first four bits are valid
         if(this.verboseuart) DebugMessage("Set UART_IER" + this.ToBitDescription(x,IER_BIT_DESC));
        // Ok, check immediately if there is a interrupt pending
        this.NextInterrupt();
        break;
    case UART_FCR:
        if(this.verboseuart) DebugMessage("Set UART_FCR" + this.ToBitDescription(x,FCR_BIT_DESC));
        this.FCR = x;
        if (this.FCR & 2) {
            this.fifo = new Array(); // clear receive fifo buffer
        }
        break;
    case UART_LCR:
         if(this.verboseuart)  DebugMessage("Set UART_LCR" + this.ToBitDescription(x,LCR_BIT_DESC));
        this.LCR = x;
        break;
    case UART_MCR:
         if(this.verboseuart)  DebugMessage("Set UART_MCR" + this.ToBitDescription(x,MCR_BIT_DESC));
        this.MCR = x;
        break;
    default:
        DebugMessage("Error in WriteRegister: not supported");
        abort();
        break;
    }
};

