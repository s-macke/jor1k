// -------------------------------------------------
// --------------------- ATA -----------------------
// -------------------------------------------------

"use strict";

var utils = require('../utils');
var message = require('../messagehandler');

// ata-generic implementation (according to Linux)
// simulation of a hard disk loaded on demand from the webserver in small chunks.
// specification
// ftp://ftp.seagate.com/pub/acrobat/reference/111-1c.pdf

/* use this dts lines
 ata@9e000000  {
                compatible = "ata-generic";
                reg = <0x9e000000 0x100
                       0x9e000100 0xf00>;
                pio-mode = <4>;
                reg-shift = <2>;
                interrupts = <15>;
        };
*/

// ATA command block registers
// 2 is the reg_shift
var ATA_REG_DATA            = 0x00<<2; // data register
var ATA_REG_ERR             = 0x01<<2; // error register, feature register
var ATA_REG_NSECT           = 0x02<<2; // sector count register
var ATA_REG_LBAL            = 0x03<<2; // sector number register
var ATA_REG_LBAM            = 0x04<<2; // cylinder low register
var ATA_REG_LBAH            = 0x05<<2; // cylinder high register
var ATA_REG_DEVICE          = 0x06<<2; // drive/head register
var ATA_REG_STATUS          = 0x07<<2; // status register // command register

var ATA_REG_FEATURE         = ATA_REG_ERR; // and their aliases (writing)
var ATA_REG_CMD             = ATA_REG_STATUS;
var ATA_REG_BYTEL           = ATA_REG_LBAM;
var ATA_REG_BYTEH           = ATA_REG_LBAH;
var ATA_REG_DEVSEL          = ATA_REG_DEVICE;
var ATA_REG_IRQ             = ATA_REG_NSECT;

// device control register
var ATA_DCR_RST = 0x04;	// Software reset   (RST=1, reset)
var ATA_DCR_IEN = 0x02;	// Interrupt Enable (IEN=0, enabled)

// ----- ATA (Alternate) Status Register
var ATA_SR_BSY  = 0x80;  // Busy
var ATA_SR_DRDY = 0x40;  // Device Ready
var ATA_SR_DF   = 0x20;  // Device Fault
var ATA_SR_DSC  = 0x10;  // Device Seek Complete
var ATA_SR_DRQ  = 0x08;  // Data Request
var ATA_SR_COR  = 0x04;  // Corrected data (obsolete)
var ATA_SR_IDX  = 0x02;  //                (obsolete)
var ATA_SR_ERR  = 0x01;  // Error

// constructor
function ATADev(intdev) {
    this.intdev = intdev;
    var buffer = new ArrayBuffer(512);
    this.identifybuffer = new Uint16Array(buffer);

    this.Reset();

    var buffer = new ArrayBuffer(64*1024); // 64 kB
    this.SetBuffer(buffer);    
    
}
ATADev.prototype.Reset = function() {
    this.DCR = 0x8; // fourth bis is always set
    this.DR = 0xA0; // some bits are always set to one
    this.SCR = 0x1;
    this.SNR = 0x1;
    this.SR = ATA_SR_DRDY; // status register
    this.FR = 0x0; // Feature register
    this.ER = 0x1; // Error register
    this.CR = 0x0; // Command register

//this.error = 0x1;
    this.lcyl = 0x0;
    this.hcyl = 0x0;
    this.select = 0xA0;
    this.driveselected = true; // drive no 0

    this.readbuffer = this.identifybuffer;
    this.readbufferindex = 0;
    this.readbuffermax = 256;
}

ATADev.prototype.SetBuffer = function(buffer) {
    this.diskbuffer = new Uint16Array(buffer);
    this.heads = 16;
    this.sectors = 64;
    this.cylinders = buffer.byteLength/(this.heads*this.sectors*512);
    this.nsectors = this.heads*this.sectors*this.cylinders;
    this.BuildIdentifyBuffer(this.identifybuffer);   
}

ATADev.prototype.BuildIdentifyBuffer = function(buffer16)
{
    for(var i=0; i<256; i++) {
        buffer16[i] = 0x0000;
    }

    buffer16[0] = 0x0040;
    buffer16[1] = this.cylinders; // cylinders
    buffer16[3] = this.heads; // heads
    buffer16[4] = 512*this.sectors; // Number of unformatted bytes per track (sectors*512)
    buffer16[5] = 512; // Number of unformatted bytes per sector
    buffer16[6] = this.sectors; // sectors per track

    buffer16[20] = 0x0003; // buffer type
    buffer16[21] = 512; // buffer size in 512 bytes increment
    buffer16[22] = 4; // number of ECC bytes available

    buffer16[27] = 0x6A6F; // jo (model string)
    buffer16[28] = 0x7231; // r1
    buffer16[29] = 0x6B2D; // k-
    buffer16[30] = 0x6469; // di
    buffer16[31] = 0x736B; // sk
    for(var i=32; i<=46; i++) {
        buffer16[i] = 0x2020; // (model string)
    }
    
    buffer16[47] = 0x8000 | 128;
    buffer16[48] = 0x0000;
    buffer16[49] = 1<<9;
    buffer16[51] = 0x200; // PIO data transfer cycle timing mode
    buffer16[52] = 0x200; // DMA data transfer cycle timing mode

    buffer16[54] = this.cylinders;
    buffer16[55] = this.heads;
    buffer16[56] = this.sectors; // sectors per track

    buffer16[57] = (this.nsectors >> 0)&0xFFFF; // number of sectors
    buffer16[58] = (this.nsectors >>16)&0xFFFF;

    buffer16[59] = 0x0000; // multiple sector settings
    //buffer16[59]  = 0x100 | 128;

    buffer16[60] = (this.nsectors >> 0)&0xFFFF; // Total number of user-addressable sectors low
    buffer16[61] = (this.nsectors >>16)&0xFFFF; // Total number of user-addressable sectors high

    buffer16[80] = (1<<1)|(1<<2); // version, support ATA-1 and ATA-2
    buffer16[82] = (1<<14); // Command sets supported. (NOP supported)
    buffer16[83] = (1<<14); // this bit should be set to one
    buffer16[84] = (1<<14); // this bit should be set to one
    buffer16[85] = (1<<14); // Command set/feature enabled (NOP)
    buffer16[86] = 0; // Command set/feature enabled
    buffer16[87] = (1<<14); // Shall be set to one

}

ATADev.prototype.ReadReg8 = function(addr) {
    if (!this.driveselected) {
        return 0xFF;
    }
    switch(addr)
    {
        case ATA_REG_ERR:
            //message.Debug("ATADev: read error register");
            return this.ER;

        case ATA_REG_NSECT:
            //message.Debug("ATADev: read sector count register");
            return this.SNR;

        case ATA_REG_LBAL:
            //message.Debug("ATADev: read sector number register");
            return this.SCR;

        case ATA_REG_LBAM:
            //message.Debug("ATADev: read cylinder low register");
            return this.lcyl;
        
        case ATA_REG_LBAH:
            //message.Debug("ATADev: read cylinder high register");
            return this.hcyl;

        case ATA_REG_DEVICE:
            //message.Debug("ATADev: read drive/head register");
            return this.DR;

        case ATA_REG_STATUS:
            //message.Debug("ATADev: read status register");			
            this.intdev.ClearInterrupt(15);
            return this.SR;

        case 0x100: // device control register, but read as status register
            //message.Debug("ATADev: read alternate status register")
            return this.SR;
            break;

        default:
            message.Debug("ATADev: Error in ReadRegister8: register " + utils.ToHex(addr) + " not supported");
            message.Abort();
            break;
    }    
    return 0x0;
};

ATADev.prototype.GetSector = function()
{
    if (!(this.DR & 0x40)) {
        message.Debug("ATADev: CHS mode not supported");
        message.Abort();
    }
    return ((this.DR&0x0F) << 24) | (this.hcyl << 16) | (this.lcyl << 8) | this.SCR;
}

ATADev.prototype.SetSector = function(sector)
{
    if (!(this.DR & 0x40)) {
        message.Debug("ATADev: CHS mode not supported");
        message.Abort();
    }
    this.SCR = sector & 0xFF;
    this.lcyl = (sector >> 8) & 0xFF;
    this.hcyl = (sector >> 16) & 0xFF;
    this.DR = (this.DR & 0xF0) | ((sector >> 24) & 0x0F);
}

ATADev.prototype.ExecuteCommand = function()
{
    switch(this.CR)
    {
        case 0xEC: // identify device
            this.readbuffer = this.identifybuffer;
            this.readbufferindex = 0;
            this.readbuffermax = 256;
            this.SR = ATA_SR_DRDY | ATA_SR_DSC | ATA_SR_DRQ;
            if (!(this.DCR & ATA_DCR_IEN)) {
                this.intdev.RaiseInterrupt(15);
            }
            break;

        case 0x91: // initialize drive parameters
            this.SR = ATA_SR_DRDY | ATA_SR_DSC;
            this.ER = 0x0;
            if (!(this.DCR & ATA_DCR_IEN)) {
                this.intdev.RaiseInterrupt(15);
            }
            break;

        case 0x20: // load sector
        case 0x30: // save sector

            var sector = this.GetSector();
            if (this.SNR == 0) {
                this.SNR = 256;
            }
            //message.Debug("ATADev: Load sector " + utils.ToHex(sector) + ". number of sectors " + utils.ToHex(this.SNR));
            this.readbuffer = this.diskbuffer;
            this.readbufferindex = sector*256;
            this.readbuffermax = this.readbufferindex+256;
            this.SR = ATA_SR_DRDY | ATA_SR_DSC | ATA_SR_DRQ;
            this.ER = 0x0;
            if (this.CR == 0x20) {
                if (!(this.DCR & ATA_DCR_IEN)) {
                    this.intdev.RaiseInterrupt(15);
                }
            }
            break;

        case 0xC4: // read multiple sectors
        case 0xC5: // write multiple sectors
            var sector = this.GetSector();
            if (this.SNR == 0) {
                this.SNR = 256;
            }
            //message.Debug("ATADev: Load multiple sector " + utils.ToHex(sector) + ". number of sectors " + utils.ToHex(this.SNR));
            this.readbuffer = this.diskbuffer;
            this.readbufferindex = sector*256;
            this.readbuffermax = this.readbufferindex + 256*this.SNR;
            this.SR = ATA_SR_DRDY | ATA_SR_DSC | ATA_SR_DRQ;
            this.ER = 0x0;
            if (this.CR == 0xC4) {
                if (!(this.DCR & ATA_DCR_IEN)) {
                    this.intdev.RaiseInterrupt(15);
                }
            }

            break;

        default:
            message.Debug("ATADev: Command " + utils.ToHex(this.CR) + " not supported");
            message.Abort();
            break;
    }
}


ATADev.prototype.WriteReg8 = function(addr, x) {
    
    if (addr == ATA_REG_DEVICE) {
        //message.Debug("ATADev: Write drive/head register value: " + utils.ToHex(x));
        this.DR = x;
        //message.Debug("Head " + (x&0xF));
        //message.Debug("Drive No. " + ((x>>4)&1));
        //message.Debug("LBA Mode " + ((x>>6)&1));
        this.driveselected = ((x>>4)&1)?false:true;
        return;
    }

    if (addr == 0x100) { //device control register
        //message.Debug("ATADev: Write CTL register" + " value: " + utils.ToHex(x));

        if (!(x&ATA_DCR_RST) && (this.DCR&ATA_DCR_RST)) { // reset done
            //message.Debug("ATADev: drive reset done");
            this.DR &= 0xF0; // reset head
            this.SR = ATA_SR_DRDY | ATA_SR_DSC;
            this.SCR = 0x1;
            this.SNR = 0x1;
            this.lcyl = 0x0;
            this.hcyl = 0x0;
            this.ER = 0x1;
            this.CR = 0x0;
        } else
        if ((x&ATA_DCR_RST) && !(this.DCR&ATA_DCR_RST)) { // reset
            //message.Debug("ATADev: drive reset");
            this.ER = 0x1; // set diagnostics message
            this.SR = ATA_SR_BSY | ATA_SR_DSC;
        }

        this.DCR = x;
        return;
    }

    if (!this.driveselected) {
        return;
    }

    switch(addr)
    {
        case ATA_REG_FEATURE:
            //message.Debug("ATADev: Write feature register value: " + utils.ToHex(x));
            this.FR = x;
            break;

        case ATA_REG_NSECT:
            //message.Debug("ATADev: Write sector count register value: " + utils.ToHex(x));
            this.SNR = x;
            break;

        case ATA_REG_LBAL:
            //message.Debug("ATADev: Write sector number register value: " + utils.ToHex(x));
            this.SCR = x;
            break;

        case ATA_REG_LBAM:
            //message.Debug("ATADev: Write cylinder low register value: " + utils.ToHex(x));
            this.lcyl = x;
            break;

        case ATA_REG_LBAH:
            //message.Debug("ATADev: Write cylinder high number register value: " + utils.ToHex(x));
            this.hcyl = x;
            break;

        case ATA_REG_CMD:
            //message.Debug("ATADev: Write Command register " + utils.ToHex(x));
            this.CR = x;
            this.ExecuteCommand();
            break;

        default:
            message.Debug("ATADev: Error in WriteRegister8: register " + utils.ToHex(addr) + " not supported (value: " + utils.ToHex(x) + ")");
            message.Abort();    
            break;
    }
};

ATADev.prototype.ReadReg16 = function(addr) {
    if (addr != 0) { // data register
        message.Debug("ATADev: Error in ReadRegister16: register " + utils.ToHex(addr) + " not supported");
        message.Abort();
    }

    var val = utils.Swap16(this.readbuffer[this.readbufferindex]);
    //message.Debug("ATADev: read data register");
    this.readbufferindex++;
    if (this.readbufferindex >= this.readbuffermax) {
        this.SR = ATA_SR_DRDY | ATA_SR_DSC; // maybe no DSC for identify command but it works
        
        if ((this.CR == 0x20) && (this.SNR > 1)) {
            this.SNR--;
            this.SetSector(this.GetSector() + 1);
            this.readbuffermax += 256;
            this.SR = ATA_SR_DRDY | ATA_SR_DSC | ATA_SR_DRQ;
            if (!(this.DCR & ATA_DCR_IEN)) {
                this.intdev.RaiseInterrupt(15);
            }
        }

    }
    return val;
};

ATADev.prototype.WriteReg16 = function(addr, x) {
    if (addr != 0) { // data register
        message.Debug("ATADev: Error in WriteRegister16: register " + utils.ToHex(addr) + " not supported");
        message.Abort();
    }
    this.readbuffer[this.readbufferindex] = utils.Swap16(x);
    //message.Debug("ATADev: write data register");
    this.readbufferindex++;
    if (this.readbufferindex >= this.readbuffermax) {
        this.SR = ATA_SR_DRDY | ATA_SR_DSC;
        if (!(this.DCR & ATA_DCR_IEN)) {
            this.intdev.RaiseInterrupt(15);
        }
        if ((this.CR == 0x30) && (this.SNR > 1)) {
            this.SNR--;
            this.SetSector(this.GetSector() + 1);
            this.readbuffermax += 256;
            this.SR = ATA_SR_DRDY | ATA_SR_DSC | ATA_SR_DRQ;
        }
    }
};

ATADev.prototype.ReadReg32 = function(addr) {
    message.Debug("ATADev: Error in ReadRegister32: register " + utils.ToHex(addr) + " not supported");
    this.mesage.Abort();
};

ATADev.prototype.WriteReg32 = function(addr, x) {
    message.Debug("ATADev: Error in WriteRegister32: register " + utils.ToHex(addr) + " not supported");
    message.Abort()
};


module.exports = ATADev;
