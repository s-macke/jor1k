// -------------------------------------------------
// --------------------- ATA -----------------------
// -------------------------------------------------

// ata-generic implementation (according to Linux)
// simulation of a hard disk loaded on demand from the webserver in small chunks.

// important Linux files
// drivers/ata/pata_of_platform.c
// drivers/ata/pata_platform.c
// drivers/ata/ata_generic.c
// include/linux/ata.h

// maybe a nice old but easy introduction into ata 
// http://www.controllersandpcs.de/ataio/code_snippets.pdf

/* use this dts lines
 ata@9e000000  {
                compatible = "ata-generic";
                reg = <0x9e000000 0x40
                       0x9e000040 0x40>;
                pio-mode = <4>;
                reg-shift = <2>;
                interrupts = <15>;
        };

reg-shift: distance between registers, should be set to 2, then we can maybe use reg32 instead of reg8. Let's see
use interrupt: 15
pio-mode: start with slow PIO 0 

size for regs: 0x100, then 0xf00 ???
reg: 
     0x9e000000: IO BASE (io_res) (IORESOURCE_MEM I think)
     0x9e000040: CTL Base (ctl_res) (IORESOURCE_MEM I think)
*/

// ATA command block registers
var ATA_REG_DATA            = 0x00<<2; // 2 is the reg_shift
var ATA_REG_ERR             = 0x01<<2;
var ATA_REG_NSECT           = 0x02<<2;
var ATA_REG_LBAL            = 0x03<<2;
var ATA_REG_LBAM            = 0x04<<2;
var ATA_REG_LBAH            = 0x05<<2;
var ATA_REG_DEVICE          = 0x06<<2;
var ATA_REG_STATUS          = 0x07<<2;

var ATA_REG_FEATURE         = ATA_REG_ERR; // and their aliases
var ATA_REG_CMD             = ATA_REG_STATUS;
var ATA_REG_BYTEL           = ATA_REG_LBAM;
var ATA_REG_BYTEH           = ATA_REG_LBAH;
var ATA_REG_DEVSEL          = ATA_REG_DEVICE;
var ATA_REG_IRQ             = ATA_REG_NSECT;


// constructor
function ATADev(outputdev, intdev) {
}

ATADev.prototype.ReadReg8 = function(addr) {
        DebugMessage("Error in ReadRegister8: not supported");
        abort();    
};

ATADev.prototype.ReadReg32 = function(addr) {
        DebugMessage("Error in ReadRegister32: not supported");
        abort();    
};


ATADev.prototype.WriteReg32 = function(addr, x) {
        DebugMessage("Error in WriteRegister32: not supported");
        abort()
};
