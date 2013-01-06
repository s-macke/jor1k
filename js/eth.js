// -------------------------------------------------
// ----------------- Ethernet ----------------------
// -------------------------------------------------

// Emulation of the basics of the non-exsistent ethernet controller.

function EthDev() {
    this.ethreg0 = 0xa000;
    this.ethreg38 = 0x22;	
    this.ReadReg32 = function(r) {
    switch(r)
        {
            case 0x0:
                return this.ethreg0;
                break;
            case 0x38:
                var ret = this.ethreg38;
                if (this.ethreg38 == 0x1613) {
                    this.ethreg38 = 0xffff;
                }
                if (this.ethreg38 == 0x22) {
                    this.ethreg38 = 0x1613;
                }
                return ret;
                break;
            default:
                return 0x0;
                break;			
        }
    }
	
	this.WriteReg32 = function(r, x) {
        switch(r)
        {
            case 0x0:
                ethreg0 = x;
                break;
        }	
	}
}
