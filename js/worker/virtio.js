// -------------------------------------------------
// ------------------- VIRTIO ----------------------
// -------------------------------------------------

function VirtIODev(intdev) {
    "use strict";
    this.intdev = intdev;
}
   
VirtIODev.prototype.ReadReg32 = function (addr) {
    DebugMessage("Attempt to read virtio register " + hex8(addr));
    return 0x0;
};

VirtIODev.prototype.WriteReg32 = function (addr, val) {
    DebugMessage("Attempt to write virtio register " + hex8(addr));
};
