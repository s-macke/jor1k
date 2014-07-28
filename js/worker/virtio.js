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

var ENOENT = 2;       /* No such file or directory */
var EINVAL = 22;      /* Invalid argument */
var ENOTSUPP = 524;     /* Operation is not supported */

var P9_SETATTR_MODE = 0x00000001;
var P9_SETATTR_UID = 0x00000002;
var P9_SETATTR_GID = 0x00000004;
var P9_SETATTR_SIZE = 0x00000008;
var P9_SETATTR_ATIME = 0x00000010;
var P9_SETATTR_MTIME = 0x00000020;
var P9_SETATTR_CTIME = 0x00000040;
var P9_SETATTR_ATIME_SET = 0x00000080;
var P9_SETATTR_MTIME_SET = 0x00000100;

// small 9p device
function Virtio9p(ramdev, filesystem) {
    this.fs = filesystem;
    
    this.ramdev = ramdev; // uint8 array
    this.deviceid = 0x9; // 9p filesystem
    this.hostfeature = 0x1; // mountpoint
    this.configspace = [0x0, 0x4, 0x68, 0x6F, 0x73, 0x74]; // length of string and "host" string
    this.VERSION = "9P2000.L";
    this.replybuffer = new Uint8Array(0x2000);
    this.replybuffersize = 0;
    
    this.fid2inode = [];
}

Virtio9p.prototype.BuildReply = function(id, tag, payloadsize) {
    ArrayToStruct(["w", "b", "h"], [payloadsize+7, id+1, tag], this.replybuffer, 0);
    //for(var i=0; i<payload.length; i++)
    //    this.replybuffer[7+i] = payload[i];
    this.replybuffersize = payloadsize+7;
    return;
}

Virtio9p.prototype.SendError = function (tag, errormsg, errorcode) {
    var size = ArrayToStruct(["s", "w"], [errormsg, errorcode], this.replybuffer, 7);
    this.BuildReply(6, tag, size);
}

Virtio9p.prototype.ReceiveRequest = function (desc, GetByte) {

    var buffer = new Uint8Array(desc.len);
    CopyMemoryToBuffer(this.ramdev, buffer, desc.addr, desc.len);

    var header = StructToArray2(["w", "b", "h"], GetByte);
    var size = header[0];
    var id = header[1];
    var tag = header[2];
    DebugMessage("size:" + size + " id:" + id + " tag:" + tag);

    switch(id)
    {
        case 112: // topen
        case 12: // tlopen
            var req = StructToArray2(["w", "w"], GetByte);
            var fid = req[0];
            var mode = req[1];
            var inode = this.fs.GetInode(this.fid2inode[fid]);
            
            DebugMessage("[open] fid=" + fid + ", mode=" + mode);
            req[0] = inode.qid;
            req[1] = 4096; // iounit
            ArrayToStruct(["Q", "w"], req, this.replybuffer, 7);
            this.BuildReply(id, tag, 13+4);
            return true;
            break;

        case 16: // symlink
            var req = StructToArray2(["w", "s", "s", "w"], GetByte);
            var fid = req[0];
            var name = req[1];
            var symgt = req[2];
            var gid = req[3];
            DebugMessage("[symlink] fid=" + fid + ", name=" + name + ", symgt=" + symgt + ", gid=" + gid); 
            var idx = this.fs.CreateSymlink(name, this.fid2inode[fid], symgt);
            var inode = this.fs.GetInode(idx);
            ArrayToStruct(["Q"], [inode.qid], this.replybuffer, 7);
            this.BuildReply(id, tag, 13);
            return true;
            break;

        case 22: // TREADLINK
            var req = StructToArray2(["w"], GetByte);
            var fid = req[0];
            DebugMessage("[readlink] fid=" + fid);
            var inode = this.fs.GetInode(this.fid2inode[fid]);
            var size = ArrayToStruct(["s"], [inode.symlink], this.replybuffer, 7);
            this.BuildReply(id, tag, size);
            return true;
            break;


        case 72: // tmkdir
            var req = StructToArray2(["w", "s", "w", "w"], GetByte);
            var fid = req[0];
            var name = req[1];
            var mode = req[2];
            var gid = req[3];
            DebugMessage("[mkdir] fid=" + fid + ", name=" + name + ", mode=" + mode + ", gid=" + gid); 
            var idx = this.fs.CreateDirectory(name, this.fid2inode[fid]);
            var inode = this.fs.GetInode(idx);
            inode.mode = mode;
            ArrayToStruct(["Q"], [inode.qid], this.replybuffer, 7);
            this.BuildReply(id, tag, 13);
            return true;            
            break;

        case 14: // tlcreate
            var req = StructToArray2(["w", "s", "w", "w", "w"], GetByte);
            var fid = req[0];
            var name = req[1];
            var flags = req[2];
            var mode = req[3];
            var gid = req[4];
            DebugMessage("[create] fid=" + fid + ", name=" + name + ", flags=" + flags + ", mode=" + mode + ", gid=" + gid); 
            var idx = this.fs.CreateFile(name, this.fid2inode[fid]);
            this.fid2inode[fid] = idx;
            var inode = this.fs.GetInode(idx);
            inode.mode = mode;
            ArrayToStruct(["Q", "w"], [inode.qid, 4096], this.replybuffer, 7);
            this.BuildReply(id, tag, 13+4);
            return true;            
            break;

        case 24: // getattr
            var req = StructToArray2(["w", "d"], GetByte);
            var fid = req[0];
            DebugMessage("[getattr]: fid=" + fid + " request mask=" + req[1]);
            var inode = this.fs.GetInode(this.fid2inode[fid]);
            req[0] |= 0x1000; // P9_STATS_GEN

            req[0] = req[1]; // request mask
            req[1] = inode.qid;

            req[2] = inode.mode; 
            req[3] = inode.uid; // user id
            req[4] = inode.gid; // group id
            
            req[5] = 0x1; // number of hard links
            req[6] = 0x0; // device id low
            req[7] = inode.data.length; // size low
            req[8] = inode.data.length; // blk size low
            req[9] = inode.data.length/512; // number of file system blocks
            req[10] = 0x0; // atime
            req[11] = 0x0;
            req[12] = 0x0; // mtime
            req[13] = 0x0;
            req[14] = 0x0; // ctime
            req[15] = 0x0;
            req[16] = 0x0; // btime
            req[17] = 0x0; 
            req[18] = 0x0; // st_gen
            req[19] = 0x0; // data_version
            ArrayToStruct([
            "d", "Q", 
            "w",  
            "w", "w", 
            "d", "d", 
            "d", "d", "d",
            "d", "d", // atime
            "d", "d", // mtime
            "d", "d", // ctime
            "d", "d", // btime
            "d", "d",
            ], req, this.replybuffer, 7);
            this.BuildReply(id, tag, 8 + 13 + 4 + 4+ 4 + 8*15);
            return true;
            break;

        case 26: // setattr
            var req = StructToArray2(["w", "w", 
                "w", // mode 
                "w", "w", // uid, gid
                "d", // size
                "d", "d", // atime
                "d", "d"] // mtime
            , GetByte);
            var fid = req[0];
            DebugMessage("[setattr]: fid=" + fid + " request mask=" + req[1]);
            var inode = this.fs.GetInode(this.fid2inode[fid]);
            if (req[1] & P9_SETATTR_MODE) {
                inode.mode = req[2];
            }
            if (req[1] & P9_SETATTR_UID) {
                inode.uid = req[3];
            }
            if (req[1] & P9_SETATTR_GID) {
                inode.gid = req[4];
            }
            if (req[1] & P9_SETATTR_SIZE) {
                this.fs.ChangeSize(this.fid2inode[fid]);
            }
            this.BuildReply(id, tag, 0);
            return true;
            break;

        case 40: // TREADDIR
        case 116: // read
            var req = StructToArray2(["w", "d", "w"], GetByte);
            var fid = req[0];
            var offset = req[1];
            var count = req[2];
            if (id == 40) DebugMessage("[treaddir]: fid=" + fid + " offset=" + offset + " count=" + count);
            if (id == 116) DebugMessage("[read]: fid=" + fid + " offset=" + offset + " count=" + count);
            if (id == 40) this.fs.FillDirectory(this.fid2inode[fid]);
            var inode = this.fs.GetInode(this.fid2inode[fid]);
            for(var i=0; i<inode.data.length-offset; i++)
                this.replybuffer[7+4+i] = inode.data[offset+i];
            ArrayToStruct(["w"], [inode.data.length-offset], this.replybuffer, 7);
            this.BuildReply(id, tag, 4 + (inode.data.length-offset));
            return true;
            break;

        case 118: // write
            var req = StructToArray2(["w", "d", "w"], GetByte);
            var fid = req[0];
            var offset = req[1];
            var count = req[2];
            DebugMessage("[write]: fid=" + fid + " offset=" + offset + " count=" + count);
            var inode = this.fs.GetInode(this.fid2inode[fid]);
            if (inode.data.length < (offset+count)) {
                this.fs.ChangeSize(this.fid2inode[fid], offset+count);
            }
            for(var i=0; i<count; i++)
                inode.data[offset+i] = GetByte();
            ArrayToStruct(["w"], [count], this.replybuffer, 7);
            this.BuildReply(id, tag, 4);
            return true;
            break;

        case 74: // RENAMEAT
            var req = StructToArray2(["w", "s", "w", "s"], GetByte);
            var olddirfid = req[0];
            var oldname = req[1];
            var newdirfid = req[2];
            var newname = req[3];
            DebugMessage("[renameat]: oldname=" + oldname + " newname=" + newname);
            if ((olddirfid == newdirfid) && (oldname == newname)) {
                   this.BuildReply(id, tag, 0);
                   return true;
            }
            var oldid = this.fs.Search(this.fid2inode[olddirfid], oldname);
            if (oldid == -1) {
                   this.SendError(tag, "No such file or directory", ENOENT);                   
                   return true;
            }
            var newid = this.fs.Search(this.fid2inode[newdirfid], newname);
            if (newid != -1) {
                this.fs.Unlink(newid);
            }
            var inode = this.fs.GetInode(oldid);
            inode.parentid = this.fid2inode[newdirfid];
            inode.name = newname;
            inode.qid.version++;
            this.BuildReply(id, tag, 0);
            return true;
            break;

        case 76: // TUNLINKAT
            var req = StructToArray2(["w", "s", "w"], GetByte);
            var dirfd = req[0];
            var name = req[1];
            var flags = req[2];
            DebugMessage("[unlink]: dirfd=" + dirfd + " name=" + name + " flags=" + flags);
            var id = this.fs.Search(this.fid2inode[dirfd], name);
            if (id == -1) {
                   this.SendError(tag, "No such file or directory", ENOENT);
                   this.fid2inode[nwfid] = -1;
                   return true;
            }
            this.fs.Unlink(id);
            this.BuildReply(id, tag, 0);
            return true;
            break;

        case 100: // version
            var version = StructToArray2(["w", "s"], GetByte);
            DebugMessage("[version]: msize=" + version[0] + " version=" + version[1]);
            var size = ArrayToStruct(["w", "s"], [version[0], this.VERSION], this.replybuffer, 7);
            this.BuildReply(id, tag, size);
            return true;
            break;

        case 104: // attach
            // return root directorie's QID
            var req = StructToArray2(["w", "w", "s", "s"], GetByte);
            var fid = req[0];
            DebugMessage("[attach]: fid=" + fid + " afid=" + hex8(req[1]) + " uname=" + req[2] + " aname=" + req[3]);
            this.fid2inode[fid] = 0;            
            var inode = this.fs.GetInode(this.fid2inode[fid]);
            ArrayToStruct(["Q"], [inode.qid], this.replybuffer, 7);
            this.BuildReply(id, tag, 13);
            return true;
            break;

        case 110: // walk
            var req = StructToArray2(["w", "w", "h"], GetByte);
            var fid = req[0];
            var nwfid = req[1];
            var nwname = req[2];
            DebugMessage("[walk]: fid=" + req[0] + " nwfid=" + req[1] + " nwname=" + nwname);
            if (nwname == 0) {
                this.fid2inode[nwfid] = this.fid2inode[fid];
                ArrayToStruct(["h"], [0], this.replybuffer, 7);
                this.BuildReply(id, tag, 2);
                return true;
            }
            var wnames = [];
            for(var i=0; i<nwname; i++) {
                wnames.push("s");
            }
            walk = StructToArray2(wnames, GetByte);                        
            DebugMessage("walk to :" + walk.toString());
            var idx = this.fid2inode[fid];
            var offset = 7+2;
            var nwidx = 0;
            for(var i=0; i<nwname; i++) {
                idx = this.fs.Search(idx, walk[i]);
                
                if (idx == -1) {
                   break;
                }
                offset += ArrayToStruct(["Q"], [this.fs.inodes[idx].qid], this.replybuffer, offset);
                nwidx++;
                this.fid2inode[nwfid] = idx;
            }
            ArrayToStruct(["h"], [nwidx], this.replybuffer, 7);
            this.BuildReply(id, tag, offset-7);
            return true;
            break;

        case 120: // clunk
            var req = StructToArray2(["w"], GetByte);
            DebugMessage("[clunk]: fid=" + req[0]);
            this.fid2inode[req[0]] = -1;
            this.BuildReply(id, tag, 0);
            return true;

        default:
            DebugMessage("Error in Virtio9p: Unknown id " + id + " received");
            //this.SendError(tag, "Operation i not supported",  ENOTSUPP);
            //return true;
            break;
    }
    return false;
}




function VirtIODev(intdev, ramdev, device) {
    "use strict";
    this.dev = device;
    this.intdev = intdev;
    this.ramdev = ramdev;
    this.status = 0x0;
    this.queuepfn = 0x0;
    this.intstatus = 0x0;
    this.pagesize = 0x0;
    this.queuenum = 0x0;
    this.align = 0x0;
}

VirtIODev.prototype.ReadReg8 = function (addr) {
    //DebugMessage("read 8 byte at " + hex8(addr));
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
    DebugMessage("GetDescriptor: index=" + index + " addr=" + hex8(Swap32(desc[1])) + " len=" + Swap32(desc[2]) + " flags=" + Swap16(desc[3])  + " next=" + Swap16(desc[4]));
    // flags:
    /* This marks a buffer as continuing via the next field. */
    //#define VRING_DESC_F_NEXT       1
    /* This marks a buffer as write-only (otherwise read-only). */
    //#define VRING_DESC_F_WRITE      2
    /* This means the buffer contains a list of buffer descriptors. */
    //#define VRING_DESC_F_INDIRECT   4

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
    DebugMessage("avail idx: " + this.ramdev.ReadMemory16(addr + 2) );
    addr = addr + 2 + 2 + this.queuenum*2 + 2; // ring of available descriptors
    if (addr & (this.align-1)) // padding to next align boundary
    {
        var mask = ~(this.align - 1);
        addr = (addr & mask) + this.align;
    }
    
    // addr points to the used_flags
    var index = this.ramdev.ReadMemory16(addr + 2); // get used index
    DebugMessage("used index:" + index + " descindex=" + descindex);
    var usedaddr = addr + 4 + index * 8;
    this.ramdev.WriteMemory32(usedaddr+0, descindex);
    this.ramdev.WriteMemory32(usedaddr+4, desclen);
    this.ramdev.WriteMemory16(addr + 2, index+1);
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
            DebugMessage("write queuenotify reg : " + hex8(val));
            var index = val;
            
            // build stream function
            var offset = 0;            
            desc = this.GetDescriptor(index);
            this.ConsumeDescriptor(index, desc.len);
            this.GetByte = function() {
                if (offset >= desc.len) {
                    offset = 0;
                    index = desc.next;
                    desc = this.GetDescriptor(index);
                    this.ConsumeDescriptor(index, desc.len);
                }
                var x = this.ramdev.ReadMemory8(desc.addr+offset);
                offset++;
                return x;
            }.bind(this);

            if (this.dev.ReceiveRequest(desc, this.GetByte)) {

                var nextdesc = this.GetDescriptor(desc.next);
                var offset = 0;
                for(var i=0; i<this.dev.replybuffersize; i++)
                {
                    if (offset >= nextdesc.len) {
                        nextdesc = this.GetDescriptor(nextdesc.next);
                        offset = 0;
                    }                    
                    this.ramdev.WriteMemory8(nextdesc.addr+offset, this.dev.replybuffer[i]);
                    offset++;
                }
                this.intstatus = desc.next;
                this.intdev.RaiseInterrupt(0x6);
                
            }
            break;

        case VIRTIO_INTERRUPTACK_REG:
            //DebugMessage("write interruptack reg : " + hex8(val));
            this.intstatus = 0x0;
            this.intdev.ClearInterrupt(0x6);
            break;

//        last_used = (vq->last_used_idx & (vq->vring.num - 1));
//        i = vq->vring.used->ring[last_used].id;
//        *len = vq->vring.used->ring[last_used].len;

        default:
            DebugMessage("Error in VirtIODev: Attempt to write register " + hex8(addr) + ":" + hex8(val));
            break;
    }

};
