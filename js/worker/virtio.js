// -------------------------------------------------
// ------------------- VIRTIO ----------------------
// -------------------------------------------------


var VIRTIO_MAGIC_REG = 0x0;
var VIRTIO_VERSION_REG = 0x4;
var VIRTIO_DEVICE_REG = 0x8;
var VIRTIO_VENDOR_REG = 0xc;
var VIRTIO_HOSTFEATURES_REG = 0x10;
var VIRTIO_HOSTFEATURESSEL_REG = 0x14;
var VIRTIO_GUESTFEATURES_REG = 0x20;
var VIRTIO_GUESTFEATURESSEL_REG = 0x24;
var VIRTIO_GUEST_PAGE_SIZE_REG = 0x28;
var VIRTIO_QUEUESEL_REG = 0x30;
var VIRTIO_QUEUENUMMAX_REG = 0x34;
var VIRTIO_QUEUENUM_REG = 0x38;
var VIRTIO_QUEUEALIGN_REG = 0x3C;
var VIRTIO_QUEUEPFN_REG = 0x40;
var VIRTIO_QUEUENOTIFY_REG = 0x50;
var VIRTIO_INTERRUPTSTATUS_REG = 0x60;
var VIRTIO_INTERRUPTACK_REG = 0x64;
var VIRTIO_STATUS_REG = 0x70;



function VirtIODev(intdev, ramdev) {
    "use strict";
    this.intdev = intdev;
    this.ramdev = ramdev;
    this.status = 0x0;
    this.queuepfn = 0x0;
    this.intstatus = 0x0;
    this.pagesize = 0x0;
    this.queuenum = 0x0;
}

VirtIODev.prototype.ReadReg8 = function (addr) {
    DebugMessage("read 8 byte at " + hex8(addr));
    switch(addr)
    {
        case 0x100: // configspace length high byte
            return 0x0;
            break;

        case 0x101: // configspace length low byte
            return 0x4;
            break;

        case 0x102:
            return 0x68; 'h'
            break;

        case 0x103:
            return 0x6F; 'o'
            break;

        case 0x104:
            return 0x73; 's'
            break;

        case 0x105:
            return 0x74; 't'
            break;
    }

    return 0x0;
}


VirtIODev.prototype.ReadReg32 = function (addr) {
    var val = 0x0;
    switch(addr)
    {
        case VIRTIO_MAGIC_REG:
            val = 0x74726976; // "virt"
            break;

        case VIRTIO_VERSION_REG:
            val = 0x1;
            break;

        case VIRTIO_VENDOR_REG:
            val = 0xFFFFFFFF;
            break;

        case VIRTIO_DEVICE_REG:
            val = 0x9;
            break;

        case VIRTIO_HOSTFEATURES_REG:
            val = 0x1;
            break;

        case VIRTIO_QUEUENUMMAX_REG:
            val = 0x100;
            break;

        case VIRTIO_QUEUEPFN_REG:
            val = this.queuepfn;
            break;

        case VIRTIO_STATUS_REG:
            val = this.status;
            break;

        case VIRTIO_INTERRUPTSTATUS_REG:
            val = this.intstatus;    
            break;

        default:
            DebugMessage("Error in VirtIODev: Attempt to read register " + hex8(addr));
            break;
    }
    return Swap32(val);
};

VirtIODev.prototype.ReceiveRequest = function (desc) {

    var size = Swap32(this.ramdev.ReadMemory32(desc.addr2+0));
    var id = this.ramdev.ReadMemory8(desc.addr2+4)
    var tag = this.ramdev.ReadMemory16(desc.addr2+5)
    DebugMessage("size:" + size + " id:" + id + " tag:" + tag);
/*
    var msize = Swap32(this.ramdev.ReadMemory32(desc.addr2+7));
    var strlen = this.ramdev.ReadMemory32(desc.addr2+7)
    DebugMessage("msize:" + msize );
*/

    // id = 100: version

}

VirtIODev.prototype.WriteReg32 = function (addr, val) {
    val = Swap32(val);
    switch(addr)
    {
        case VIRTIO_GUEST_PAGE_SIZE_REG:
            this.pagesize = val;
            DebugMessage("Guest page size : " + hex8(val));
            break;

        case VIRTIO_STATUS_REG:
            DebugMessage("write status reg : " + hex8(val));
            this.status = Swap32(val);
            break;

        case VIRTIO_HOSTFEATURESSEL_REG:
            DebugMessage("write hostfeaturesel reg : " + hex8(val));
            break;

        case VIRTIO_GUESTFEATURESSEL_REG:
            DebugMessage("write guestfeaturesel reg : " + hex8(val));
            break;

        case VIRTIO_GUESTFEATURES_REG:
            DebugMessage("write guestfeatures reg : " + hex8(val));
            break;

        case VIRTIO_QUEUESEL_REG:
            DebugMessage("write queuesel reg : " + hex8(val));
            break;

        case VIRTIO_QUEUENUM_REG:
            this.queuenum = val;
            DebugMessage("write queuenum reg : " + hex8(val));
            break;

        case VIRTIO_QUEUEALIGN_REG:
            DebugMessage("write queuealign reg : " + hex8(val));
            break;

        case VIRTIO_QUEUEPFN_REG:
            this.queuepfn = val;
            DebugMessage("write queuepfn reg : " + hex8(val));
            break;

        case VIRTIO_QUEUENOTIFY_REG:
            DebugMessage("write queuenotify reg : " + hex8(val));
            // check if queue is ready
            var addr = this.queuepfn * this.pagesize /*+ this.queuenum*16*/ + val * 16;

            var desc = {
                addr: this.ramdev.ReadMemory32(addr + 0),
                addr2: this.ramdev.ReadMemory32(addr + 4),
                len: this.ramdev.ReadMemory32(addr + 8),
                next: this.ramdev.ReadMemory16(addr + 12),
                flags: this.ramdev.ReadMemory16(addr + 14)
            };
            DebugMessage("" + desc.addr + " " + desc.addr2 + " " + desc.len + " " + desc.next  + " " + desc.flags);
            this.ReceiveRequest(desc);
            this.intstatus = 0x1;
            this.intdev.RaiseInterrupt(0x6);            
            break;

        case VIRTIO_INTERRUPTACK_REG:
            DebugMessage("write interruptack reg : " + hex8(val));
            this.intstatus = 0x0;
            break;


        default:
            DebugMessage("Error in VirtIODev: Attempt to write register " + hex8(addr) + ":" + hex8(val));
            break;
    }

};
