// -------------------------------------------------
// ------------------- VIRTIO ----------------------
// -------------------------------------------------
// Implementation of the virtio mmio device and virtio ring
//
// the following documentation were used
// http://wiki.osdev.org/Virtio
// http://lxr.free-electrons.com/source/Documentation/virtual/virtio-spec.txt?v=3.4
// http://swtch.com/plan9port/man/man9/
// http://lxr.free-electrons.com/source/net/9p/error.c?v=3.1
// https://lists.gnu.org/archive/html/qemu-devel/2011-12/msg02712.html
// http://www-numi.fnal.gov/offline_software/srt_public_context/WebDocs/Errors/unix_system_errors.html
// https://github.com/ozaki-r/arm-js/tree/master/js
// the memory layout can be found here: include/uapi/linux/virtio_ring.h

"use strict";

var utils = require('../utils');
var marshall = require('./virtio/marshall');
var message = require('../messagehandler');

var VIRTIO_MAGIC_REG = 0x0;
var VIRTIO_VERSION_REG = 0x4;
var VIRTIO_DEVICE_REG = 0x8;
var VIRTIO_VENDOR_REG = 0xC;
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
var VIRTIO_QUEUE_READY = 0x44;
var VIRTIO_QUEUENOTIFY_REG = 0x50;
var VIRTIO_INTERRUPTSTATUS_REG = 0x60;
var VIRTIO_INTERRUPTACK_REG = 0x64;
var VIRTIO_STATUS_REG = 0x70;
var VIRTIO_QUEUE_DESC_LOW = 0x80;
var VIRTIO_QUEUE_DESC_HIGH = 0x84;
var VIRTIO_QUEUE_AVAIL_LOW = 0x90;
var VIRTIO_QUEUE_AVAIL_HIGH = 0x94;
var VIRTIO_QUEUE_USED_LOW = 0xA0;
var VIRTIO_QUEUE_USED_HIGH = 0xA4;
var VIRTIO_CONFIG_GENERATION = 0xFC;

var VRING_DESC_F_NEXT =      1; /* This marks a buffer as continuing via the next field. */
var VRING_DESC_F_WRITE =     2; /* This marks a buffer as write-only (otherwise read-only). */
var VRING_DESC_F_INDIRECT =  4; /* This means the buffer contains a list of buffer descriptors. */


// non aligned copy
function CopyMemoryToBuffer(from, to, offset, size) {
    for(var i=0; i<size; i++)
        to[i] = from.Read8(offset+i);
}

function CopyBufferToMemory(from, to, offset, size) {
    for(var i=0; i<size; i++)
        to.Write8(offset+i, from[i]);
}

function VirtIODev(intdev, intno, ramdev, device) {
    this.dev = device;
    this.dev.SendReply = this.SendReply.bind(this);
    this.intdev = intdev;
    this.intno = intno;
    this.ramdev = ramdev;

    this.queuenum = new Uint32Array(0x10);
    this.queueready = new Uint32Array(0x10);
    this.queuepfn = new Uint32Array(0x10);
    this.descaddr = new Uint32Array(0x10);
    this.usedaddr = new Uint32Array(0x10);
    this.availaddr = new Uint32Array(0x10);
    this.lastavailidx = new Uint32Array(0x10);

    //this.version = 1;
    this.version = 2; // for Linux > 4.0

    this.Reset();
}

VirtIODev.prototype.Reset = function() {
    this.status = 0x0;
    this.intstatus = 0x0;
    this.pagesize = 0x2000;
    this.align = 0x2000;
    this.availidx = 0x0;
    this.hostfeaturewordselect = 0x0;

    this.queuesel = 0x0;

    for(var i=0; i<0x10; i++) {
        this.queueready[i] = 0x0;
        this.queuenum[i] = 0x10;
        this.queuepfn[i] = 0x0;
        this.descaddr[i] = 0x0;
        this.usedaddr[i] = 0x0;
        this.availaddr[i] = 0x0;
        this.lastavailidx[i] = 0x0;
    }
}

// Ring buffer addresses
VirtIODev.prototype.UpdateAddr = function() {
    if (this.version != 1) return;
    var i = this.queuesel;
    this.descaddr[i] = this.queuepfn[i] * this.pagesize;
    this.availaddr[i] = this.descaddr[i] + this.queuenum[i]*16;
    this.usedaddr[i] = this.availaddr[i] + 2 + 2 + this.queuenum[i]*2 + 2;
    if (this.usedaddr[i] & (this.align-1)) { // padding to next align boundary
        var mask = ~(this.align - 1);
        this.usedaddr[i] = (this.usedaddr[i] & mask) + this.align;
    }
    this.lastavailidx[i] = this.ramdev.Read16Little(this.availaddr[i] + 2);
}

VirtIODev.prototype.ReadReg8 = function (addr) {
    //message.Debug("read8 configspace of int " + this.intno + " : " + (addr-0x100));
    return this.dev.configspace[addr-0x100];
}

VirtIODev.prototype.ReadReg16 = function (addr) {
    //message.Debug("read16 configspace16 of int " + this.intno + " : " + (addr-0x100));
    if (this.ramdev.nativeendian == "little") {
        return (this.dev.configspace[addr-0x100+1]<<8) | (this.dev.configspace[addr-0x100  ]);
    } else
        return (this.dev.configspace[addr-0x100  ]<<8) | (this.dev.configspace[addr-0x100+1]);
}

VirtIODev.prototype.WriteReg8 = function (addr, value) {
    //message.Debug("write8 configspace of int " + this.intno + " : " + (addr-0x100) + " " + value);
    this.dev.WriteConfig(addr-0x100, value);
}

VirtIODev.prototype.ReadReg32 = function (addr) {
    var val = 0x0;
    //message.Debug("VirtIODev: read register of int "  + this.intno + " : " + utils.ToHex(addr));
    if (addr >= 0x100) {
        //message.Debug("read32 configspace of int " + this.intno + " : " + (addr-0x100));
        return (
            (this.dev.configspace[addr-0x100+0]<<24) | 
            (this.dev.configspace[addr-0x100+1]<<16) |
            (this.dev.configspace[addr-0x100+2]<<8) |
            (this.dev.configspace[addr-0x100+3]<<0) );
    }

    switch(addr)
    {
        case VIRTIO_MAGIC_REG:
            val = 0x74726976; // "virt"
            break;

        case VIRTIO_VERSION_REG:
            val = this.version;
            break;

        case VIRTIO_DEVICE_REG:
            val = this.dev.deviceid;
            break;

        case VIRTIO_VENDOR_REG:
            val = 0xFFFFFFFF;
            break;

        case VIRTIO_HOSTFEATURES_REG:
            //message.Debug("virtio: Read hostfeatures register");
            val = 0x0;
            if (this.hostfeaturewordselect == 0) {
                val = this.dev.hostfeature;
            } else
            if (this.hostfeaturewordselect == 1) {
                val = 0x1; // VIRTIO_F_VERSION_1
            }
            break;

        case VIRTIO_QUEUENUMMAX_REG:
            val = this.queuenum[this.queuesel];
            break;

        case VIRTIO_QUEUEPFN_REG:
            val = this.queuepfn[this.queuesel];
            break;

        case VIRTIO_QUEUE_READY:
            val = this.queueready[this.queuesel];
            break;

        case VIRTIO_INTERRUPTSTATUS_REG:
            val = this.intstatus;
            break;

        case VIRTIO_STATUS_REG:
            val = this.status;
            break;

        case VIRTIO_CONFIG_GENERATION:
            val = 0x0;
            break;

        default:
            message.Debug("Error in VirtIODev: Attempt to read register " + utils.ToHex(addr));
            message.Abort();
            break;
    }
    if (this.ramdev.nativeendian == "little") {
        return val;
    } else {
        return utils.Swap32(val);
    }
};

VirtIODev.prototype.GetDescriptor = function(queueidx, index) {

    var addr = this.descaddr[queueidx] + index * 16;
    var buffer = new Uint8Array(16);
    CopyMemoryToBuffer(this.ramdev, buffer, addr, 16);

    var desc = marshall.Unmarshall(["d", "w", "h", "h"], buffer, 0);
    //message.Debug("GetDescriptor: index=" + index + " addr=" + utils.ToHex(desc[1]) + " len=" + desc[2] + " flags=" + desc[3]  + " next=" + desc[4]);

    return {
        addr: desc[0],
        len: desc[1],
        flags: desc[2],
        next: desc[3]
    };
}


VirtIODev.prototype.ConsumeDescriptor = function(queueidx, descindex, desclen) {

    // update used index
    var usedidxaddr = this.usedaddr[queueidx] + 2;
    var index = this.ramdev.Read16Little(usedidxaddr);
    this.ramdev.Write16Little(usedidxaddr, index+1 );

    //message.Debug("used index:" + index + " descindex=" + descindex);

    var usedaddr = this.usedaddr[queueidx] + 4 + (index & (this.queuenum[queueidx]-1)) * 8;
    this.ramdev.Write32Little(usedaddr+0, descindex);
    this.ramdev.Write32Little(usedaddr+4, desclen);
}

VirtIODev.prototype.SendReply = function (queueidx, index) {
    //message.Debug("Send Reply index="+index + " size=" + this.dev.replybuffersize);
    this.ConsumeDescriptor(queueidx, index, this.dev.replybuffersize);

    var availflag = this.ramdev.Read16Little(this.availaddr[queueidx]);

    // no data? So skip the rest
    if (this.dev.replybuffersize == 0) {
        // interrupts disabled?
        //if ((availflag&1) == 0) {
            this.intstatus = 1;
            this.intdev.RaiseInterrupt(this.intno);
        //}
        return;
    }

    var desc = this.GetDescriptor(queueidx, index);
    while ((desc.flags & VRING_DESC_F_WRITE) == 0) {
        if (desc.flags & 1) { // continuing buffer
            desc = this.GetDescriptor(queueidx, desc.next);
        } else {
            message.Debug("Error in virtiodev: Descriptor is not continuing");
            message.Abort();
        }
    }
    
    if ((desc.flags & VRING_DESC_F_WRITE) == 0) {
        message.Debug("Error in virtiodev: Descriptor is not allowed to write");
        message.Abort();
    }

    var offset = 0;
    for(var i=0; i<this.dev.replybuffersize; i++) {
        if (offset >= desc.len) {
            desc = this.GetDescriptor(0, desc.next);
            offset = 0;            
            if ((desc.flags & VRING_DESC_F_WRITE) == 0) {
                message.Debug("Error in virtiodev: Descriptor is not allowed to write");
                message.Abort();
            }
        }
        this.ramdev.Write8(desc.addr+offset, this.dev.replybuffer[i]);
        offset++;
    }

    // interrupts disabled?
    //if ((availflag&1) == 0) {
        this.intstatus = 1;
        this.intdev.RaiseInterrupt(this.intno);
    //}
}


VirtIODev.prototype.GetDescriptorBufferSize = function (queueidx, index) {
    
    var wsize = 0x0;
    var rsize = 0x0;

    var desc = this.GetDescriptor(queueidx, index);

    for(;;) {
        if (desc.flags & VRING_DESC_F_INDIRECT) {
            message.Debug("Error in VirtIO: Indirect descriptors not supported");
            message.Abort();
        }
        if (desc.flags & VRING_DESC_F_WRITE) {
            wsize += desc.len;
        } else {
            rsize += desc.len;
        }
        if ((desc.flags&1) == 0) { // continue?
            break;
        }
        var desc = this.GetDescriptor(queueidx, desc.next);
    }

    return {write: wsize, read: rsize};
}


VirtIODev.prototype.WriteReg32 = function (addr, val) {

    if (this.ramdev.nativeendian == "big") {
        val = utils.Swap32(val);
    }

    //message.Debug("VirtIODev: write register of int "  + this.intno + " : " + utils.ToHex(addr) + " = " + val);

    switch(addr)
    {
        case VIRTIO_GUEST_PAGE_SIZE_REG:
            this.pagesize = val;
            this.UpdateAddr();
            //message.Debug("Guest page size : " + utils.ToHex(val));
            break;

        case VIRTIO_HOSTFEATURESSEL_REG:
            this.hostfeaturewordselect = val;
            //message.Debug("write hostfeaturesel reg : " + utils.ToHex(val));
            break;

        case VIRTIO_GUESTFEATURESSEL_REG:
            //message.Debug("write guestfeaturesel reg : " + utils.ToHex(val));
            break;

        case VIRTIO_GUESTFEATURES_REG:
            //message.Debug("write guestfeatures reg : " + utils.ToHex(val));
            break;

        case VIRTIO_QUEUESEL_REG:
            this.queuesel = val;
            //message.Debug("write queuesel reg : " + utils.ToHex(val));
            break;

        case VIRTIO_QUEUENUM_REG:
            this.queuenum[this.queuesel] = val;
            this.UpdateAddr();
            //message.Debug("write queuenum reg : " + utils.ToHex(val));
            break;

        case VIRTIO_QUEUEALIGN_REG:
            //message.Debug("write queuealign reg : " + utils.ToHex(val));
            this.align = val;
            this.pagesize = val;
            this.UpdateAddr();
            break;

        case VIRTIO_QUEUEPFN_REG:
            this.queuepfn[this.queuesel] = val;
            this.UpdateAddr();
            //message.Debug("write queuepfn reg : " + utils.ToHex(val));
            break;

        case VIRTIO_QUEUENOTIFY_REG:
            var queueidx = val;

            var availidx = this.ramdev.Read16Little(this.availaddr[queueidx] + 2);
            //message.Debug("write queuenotify reg : " + utils.ToHex(queueidx) + " " + availidx);
            
            while(this.lastavailidx[queueidx] != availidx)
            {
                var currentavailidx = this.lastavailidx[queueidx] & (this.queuenum[queueidx]-1);
                var currentdescindex = this.ramdev.Read16Little(this.availaddr[val] + 4 + currentavailidx*2);

                //message.Debug("" + queueidx + " " + availidx + " " + currentavailidx + " " + currentdescindex);

                var size = this.GetDescriptorBufferSize(queueidx, currentdescindex);

                // build stream function
                var offset = 0;
                var desc = this.GetDescriptor(queueidx, currentdescindex);

                var GetByte = 
                (function(queueidx, offset, desc) {
                    return function() {
                        if (offset >= desc.len) {
                            offset = 0;
                            if (desc.flags & 1) { // continuing buffer
                                desc = this.GetDescriptor(queueidx, desc.next);
                            } else {
                                message.Debug("Error in virtiodev: Descriptor is not continuing");
                                message.Abort();
                            }
                        }
                        var x = this.ramdev.Read8(desc.addr + offset);
                        offset++;
                        return x;
                    }.bind(this);
                }.bind(this))(queueidx, offset, desc);

                this.dev.ReceiveRequest(queueidx, currentdescindex, GetByte, size);
                this.lastavailidx[queueidx]++;
                this.lastavailidx[queueidx] &= 0xFFFF;
            }

            break;

        case VIRTIO_QUEUE_READY:
            this.queueready[this.queuesel] = val;
            break;


        case VIRTIO_INTERRUPTACK_REG:
            //message.Debug("write interruptack reg : " + utils.ToHex(val));
            this.intstatus &= ~val;
            this.intdev.ClearInterrupt(this.intno);
            break;

        case VIRTIO_STATUS_REG:
            //message.Debug("write status reg : " + utils.ToHex(val));
            this.status = val;
            switch(this.status) {
                case 0: // reset
                    this.intdev.ClearInterrupt(this.intno);
                    this.intstatus = 0;
                    this.Reset();
                    break;
                case 1: // acknowledge (found the device, valid virtio device)
                    break;
                case 3: //acknoledge + driver (driver present)
                    break;
                case 7: // ??
                    break;
                case 11: //acknowledge + driver + features Ok
                    break;
                case 15: //acknowledge + driver + features Ok + driver_ok (Let's start)
                    break;
                case 131: // acknowledge + driver + failed
                    message.Debug("Error: virtio device initialization failed with status " + this.status);
                    message.Abort();
                case 139: // acknowledge + driver + features Ok + failed
                    message.Debug("Error: virtio device initialization failed with status " + this.status);
                    message.Abort();
                    break;
                default:
                    message.Debug("Error in virtio status register: Unknown status " + this.status);
                    message.Abort();
                    break;
            }
            break;

            case VIRTIO_QUEUE_DESC_LOW:
                this.descaddr[this.queuesel] = val;
                break;

            case VIRTIO_QUEUE_DESC_HIGH:
                break;

            case VIRTIO_QUEUE_AVAIL_LOW:
                this.availaddr[this.queuesel] = val;
                this.lastavailidx[this.queuesel] = this.ramdev.Read16Little(this.availaddr[this.queuesel] + 2);
                break;

            case VIRTIO_QUEUE_AVAIL_HIGH:
                break;

            case VIRTIO_QUEUE_USED_LOW:
                this.usedaddr[this.queuesel] = val;
                break;

            case VIRTIO_QUEUE_USED_HIGH:
                break;


        default:
            message.Debug("Error in VirtIODev: Attempt to write register " + utils.ToHex(addr) + ":" + utils.ToHex(val));
            message.Abort();
            break;
    }

};


module.exports = VirtIODev;
