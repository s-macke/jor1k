// -------------------------------------------------
// --------------------- SOUND ---------------------
// -------------------------------------------------

// Emulating the SuperH Renesas fsi2
// http://lxr.free-electrons.com/source/sound/soc/sh/fsi.c
// always two channels

// init:
// function fsi_hw_startup
//    // clock settings
// 	read ckg1
// 	write ckg1 = 0
// 	write ckg2 = 0
//    function fsi_format_bus_setup
//      // bus settings bus = PACKAGE_24BITBUS_BACK
//        write out_dmac = 16 (=VDMD_BACK)
//        write do_fmt 32 (=CR_BWS_24)
//    // irq_clear 
//  function fsi_irq_disable() 
//      read cpu_imsk
//      write cpu_imsk 0
//      read cpu_iemsk
//      write cpu_iemsk 0
//  function fsi_irq_clear_status();
//      read int_st
//      write int_st 0
//  function  fsi_fifo_init();
//      read mst_fifo_sz
//      write doff_ctl=0x100000 (=IRQ_HALF)
//       read doff_ctl
//      write doff_ctl = 0x100001

// fixed parameters after init:
// 24bit bus / package in back
// fifo = 32768 words
// 2 channel 16384 store
// fsi->chan_num = 2;
//  io->fifo_sample_capa = 32768
//  



"use strict";

// controller register offsets

/* PortA/PortB register */

// output
var REG_DO_FMT      = 0x0000; // format
var REG_DOFF_CTL    = 0x0004; // control
var REG_DOFF_ST     = 0x0008; // status

// input
var REG_DI_FMT      = 0x000C; // format
var REG_DIFF_CTL    = 0x0010; // control
var REG_DIFF_ST     = 0x0014; // status

//clock
var REG_CKG1        = 0x0018;
var REG_CKG2        = 0x001C;

var REG_DIDT        = 0x0020;
var REG_DODT        = 0x0024;
var REG_MUTE_ST     = 0x0028;

// dma
var REG_OUT_DMAC    = 0x002C;

var REG_OUT_SEL     = 0x0030;
var REG_IN_DMAC     = 0x0038;

/* master register */
var MST_CLK_RST     = 0x0210;
var MST_SOFT_RST    = 0x0214;
var MST_FIFO_SZ     = 0x0218;
 
/* core register (depend on FSI version) */
var A_MST_CTLR    = 0x0180;
var B_MST_CTLR    = 0x01A0;
var CPU_INT_ST    = 0x01F4; // interrupt status
var CPU_IEMSK     = 0x01F8; // interrupt enable mask
var CPU_IMSK      = 0x01FC; // interrupt mask
var INT_ST        = 0x0200;
var IEMSK         = 0x0204;
var IMSK          = 0x0208;

function SoundDev(intdev) {
    this.intdev = intdev;
    this.Reset();
}

SoundDev.prototype.Reset = function() {
    this.imsk = 0;
    this.iemsk = 0;
    this.doff_ctl = 0x0;
    this.diff_ctl = 0x0;
    this.int_status = 0;
    this.fifo = new Int8Array(256<<7); // 32k words
    this.nframes = 0;
}

SoundDev.prototype.ReadReg32 = function (addr) {
    switch(addr)
    {
        case REG_CKG1:
            DebugMessage("sound: read ckg1 ");
            return 0;
            break;

        case MST_SOFT_RST:
            DebugMessage("sound: read soft_reset");
            return 0x0;
            break; // no errors

        case CPU_INT_ST: // interrupt status
            DebugMessage("sound: read int_st");
            return this.int_status; // ready to receive new data?
            break;

        case CPU_IMSK:
            DebugMessage("sound: read cpu_imsk");
            return 0x0;
            break;

        case CPU_IEMSK:
            DebugMessage("sound: read cpu_iemsk");
            return 0x0;
            break;

        case REG_DOFF_ST:
            DebugMessage("sound: read doff_st");
            // >> 1 because of two channels
            //return ((this.nframes>>1)<<8); // no error
            return 0x1FF<<8; // no error and fifo always empty
            break;

        case REG_DOFF_CTL: // output control
            DebugMessage("sound: read doff_ctl");
            return this.doff_ctl;
            break;

        case REG_DIFF_CTL: // input control
            DebugMessage("sound: read diff_ctl");
            return this.diff_ctl;
            break;

        case REG_DIFF_ST:
            DebugMessage("sound: read diff_st");
            return 0x0; // no error and no frames
            break;

        case MST_FIFO_SZ: // fifo capacity  
            DebugMessage("sound: read mst_fifo_sz");
            // 32k words (256<<shift)
            // maximum ram for output for port a, nothing for the rest
            var shift = (7 << 0) | (0<<4) | (0<<8) | (0<<12);             
            return shift; 
            break;

        default:
            DebugMessage("Sound: unknown ReadReg32: " + hex8(addr));
//            abort();
            return 0x0;
            break;
    }
    return 0x0;
}

SoundDev.prototype.WriteReg32 = function (addr, value) {
    switch(addr)
    {
        case REG_CKG1:
            DebugMessage("sound: write ckg1 " + value);
            break;

        case REG_CKG2:
            DebugMessage("sound: write ckg2 " + value);
            break;

        case REG_OUT_DMAC:
            DebugMessage("sound: write out_dmac " + value);
            break;

        case REG_DO_FMT:
            DebugMessage("sound: write do_fmt " + value);
            break;

        case MST_SOFT_RST:
            DebugMessage("sound: write soft_reset " + value);
            if (value == 16) { // interrupt reset, clear irq status
                this.intdev.ClearInterrupt(0x7);
            }
            break;

        case CPU_INT_ST: // interrupt status
            DebugMessage("sound: write int_st " + value);
            this.int_status = value;
            break;

        case CPU_IMSK:
            DebugMessage("sound: write cpu_imsk " + value);
            this.imsk = value;
            break;

        case CPU_IEMSK: // interrupt enable mask
            DebugMessage("sound: write cpu_iemsk " + value);
            this.iemsk = value;
            if (this.iemsk & this.imsk) {
                DebugMessage("raise interrupt 7");
                SendToMaster("sound", this.fifo);
                this.intdev.RaiseInterrupt(0x7);
            }
            break;

        case REG_DODT: // fill fifo output
            if ((this.nframes&0xFF) == 0)
                DebugMessage("sound: Write fifo nsamnples="+this.nframes/* + hex8(value)*/);

            //DebugMessage("sound: Write fifo nsamnples=" + hex8(Swap32(value)));
            this.fifo[this.nframes] = Swap32(value) >> 16;
            this.nframes++;
            break;

        case REG_DOFF_ST: // output status
            DebugMessage("sound: write doff_st " + value);
            break;

        case REG_DOFF_CTL: // output control
            DebugMessage("sound: write doff_ctl " + value);
            this.doff_ctl = value;
            if (value & 1) {this.nframes=0x0;} // clear fifo
            if (value & 0x100000) {} // IRQ_HALF
            break;

        case REG_DIFF_CTL: // input control
            DebugMessage("sound: write diff_ctl " + value);
            this.diff_ctl = value;
            break;

        case REG_DIFF_ST: // input status
            DebugMessage("sound: write diff_st " + value);
            break;

        default:
            DebugMessage("sound: unknown  WriteReg32: " + hex8(addr) + ": " + hex8(value));
//            abort();
            return;
            break;
    }
}
