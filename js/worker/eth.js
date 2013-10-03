// -------------------------------------------------
// ----------------- Ethernet ----------------------
// -------------------------------------------------

// Emulation of the basics of the dummy ethernet controller.


function EthDev() {
    "use strict";
    this.ethreg0 = 0xA000;
    this.ethreg38 = 0x22;

    this.Reset = function () {
    };

    this.ReadReg32 = function (r) {
        switch (r) {
        case 0x0:
            return this.ethreg0;
        case 0x38:
            var ret = this.ethreg38;
            if (this.ethreg38 === 0x1613) {
                this.ethreg38 = 0xffff;
            }
            if (this.ethreg38 === 0x22) {
                this.ethreg38 = 0x1613;
            }
            return ret;
        default:
            return 0x0;
        }
    };

    this.WriteReg32 = function (r, x) {
        switch (r) {
        case 0x0:
            this.ethreg0 = x;
            break;
        }
    };
}
