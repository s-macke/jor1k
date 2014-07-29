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

var VRING_DESC_F_NEXT =      1; /* This marks a buffer as continuing via the next field. */
var VRING_DESC_F_WRITE =     2; /* This marks a buffer as write-only (otherwise read-only). */
var VRING_DESC_F_INDIRECT =  4; /* This means the buffer contains a list of buffer descriptors. */


// non aligned copy
function CopyMemoryToBuffer(from, to, offset, size)
{
    for(var i=0; i<size; i++)
        to[i] = from.ReadMemory8(offset+i);
}

function CopyBufferToMemory(from, to, offset, size)
{
    for(var i=0; i<size; i++)
        to.WriteMemory8(offset+i, from[i]);
}

function VirtIODev(intdev, ramdev, device) {
    "use strict";
    this.dev = device;
    this.intdev = intdev;
    this.ramdev = ramdev;
    this.Reset();
}

VirtIODev.prototype.Reset = function() {
    this.status = 0x0;
    this.queuepfn = 0x0;
    this.intstatus = 0x0;
    this.pagesize = 0x0;
    this.queuenum = 0x100;
    this.align = 0x0;
}


VirtIODev.prototype.ReadReg8 = function (addr) {
    return this.dev.configspace[addr-0x100];
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
            val = this.dev.deviceid;
            break;

        case VIRTIO_HOSTFEATURES_REG:
            val = this.dev.hostfeature;
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
            abort();
            break;
    }
    return Swap32(val);
};

VirtIODev.prototype.GetDescriptor = function(index)
{
    var addr = this.queuepfn * this.pagesize + index * 16;
    var buffer = new Uint8Array(16);
    CopyMemoryToBuffer(this.ramdev, buffer, addr, 16);

    var desc = StructToArray(["w", "w", "w", "h", "h"], buffer, 0);
//    DebugMessage("GetDescriptor: index=" + index + " addr=" + hex8(Swap32(desc[1])) + " len=" + Swap32(desc[2]) + " flags=" + Swap16(desc[3])  + " next=" + Swap16(desc[4]));

    return {
        addrhigh: Swap32(desc[0]),
        addr: Swap32(desc[1]),
        len: Swap32(desc[2]),
        flags: Swap16(desc[3]),
        next: Swap16(desc[4])        
    };
}

VirtIODev.prototype.FillDescriptor = function(index, descaddr, len, next, flags) {
    var addr = this.queuepfn * this.pagesize + index * 16;
    var desc = [];
    desc[0] = 0x0;
    desc[1] = Swap32(descaddr);
    desc[2] = Swap32(len);
    desc[3] = Swap16(flags);
    desc[4] = Swap16(next);
    ArrayToStruct(["w", "w", "w", "h", "h"], desc, this.ramdev.uint8mem, addr);
};

// the memory layout can be found here: include/uapi/linux/virtio_ring.h

VirtIODev.prototype.ConsumeDescriptor = function(descindex, desclen) {
    var addr = this.queuepfn * this.pagesize + this.queuenum*16; // end of descriptors
    // DebugMessage("avail idx: " + this.ramdev.ReadMemory16(addr + 2) );
    addr = addr + 2 + 2 + this.queuenum*2 + 2; // ring of available descriptors
    if (addr & (this.align-1)) // padding to next align boundary
    {
        var mask = ~(this.align - 1);
        addr = (addr & mask) + this.align;
    }
    
    // addr points to the used_flags
    var index = this.ramdev.ReadMemory16(addr + 2); // get used index
    //DebugMessage("used index:" + index + " descindex=" + descindex);
    var usedaddr = addr + 4 + (index & (this.queuenum-1)) * 8;
    this.ramdev.WriteMemory32(usedaddr+0, descindex);
    this.ramdev.WriteMemory32(usedaddr+4, desclen);
    this.ramdev.WriteMemory16(addr + 2, (index+1));
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
            this.align = val;
            break;

        case VIRTIO_QUEUEPFN_REG:
            this.queuepfn = val;
            DebugMessage("write queuepfn reg : " + hex8(val));
            break;

        case VIRTIO_QUEUENOTIFY_REG:
            //DebugMessage("write queuenotify reg : " + hex8(val));
            var currentindex = val;
            
            // build stream function
            var offset = 0;            
            desc = this.GetDescriptor(currentindex);
            this.ConsumeDescriptor(currentindex, desc.len);
            this.GetByte = function() {
                if (offset >= desc.len) {
                    offset = 0;
                    currentindex = desc.next;
                    desc = this.GetDescriptor(currentindex);
                    //this.ConsumeDescriptor(currentindex, desc.len);
                }
                var x = this.ramdev.ReadMemory8(desc.addr+offset);
                offset++;
                return x;
            }.bind(this);

            if (!this.dev.ReceiveRequest(desc, this.GetByte))
                break;

            var nextdesc = this.GetDescriptor(desc.next);
            //this.ConsumeDescriptor(0, desc.len);
            if ((nextdesc.flags & VRING_DESC_F_WRITE) == 0) {
                DebugMessage("Error in virtiodev: Descriptor is not allowed to write");
                abort();
            }

                var offset = 0;
                for(var i=0; i<this.dev.replybuffersize; i++)
                {
                    if (offset >= nextdesc.len) {
                        nextdesc = this.GetDescriptor(nextdesc.next);
                        //this.ConsumeDescriptor(nextdesc.next-2, desc.len);
                        offset = 0;
                        if ((nextdesc.flags & VRING_DESC_F_WRITE) == 0) {
                            DebugMessage("Error in virtiodev: Descriptor is not allowed to write");
                            abort();
                        }
                    }
                    this.ramdev.WriteMemory8(nextdesc.addr+offset, this.dev.replybuffer[i]);
                    offset++;
                }
                this.intstatus = /*desc.next*/1;
                this.intdev.RaiseInterrupt(0x6);
            break;

        case VIRTIO_INTERRUPTACK_REG:
            //DebugMessage("write interruptack reg : " + hex8(val));
            this.intstatus &= ~val;
            this.intdev.ClearInterrupt(0x6);
            break;

        default:
            DebugMessage("Error in VirtIODev: Attempt to write register " + hex8(addr) + ":" + hex8(val));
            abort();
            break;
    }

};
