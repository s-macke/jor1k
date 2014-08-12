// -------------------------------------------------
// --------------------- 9P ------------------------
// -------------------------------------------------
// Implementation of the 9p filesystem device following the 
// 9P2000.L protocol ( https://code.google.com/p/diod/wiki/protocol )


// TODO
// mknod
// flush
// lock?

var EPERM = 1;       /* Operation not permitted */
var ENOENT = 2;      /* No such file or directory */
var EINVAL = 22;     /* Invalid argument */
var ENOTSUPP = 524;  /* Operation is not supported */
var ENOTEMPTY = 39;  /* Directory not empty */

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
    //this.configspace = [0x0, 0x4, 0x68, 0x6F, 0x73, 0x74]; // length of string and "host" string
    this.configspace = [0x0, 0x9, 0x2F, 0x64, 0x65, 0x76, 0x2F, 0x72, 0x6F, 0x6F, 0x74 ]; // length of string and "/dev/root" string
    this.VERSION = "9P2000.L";
    this.IOUNIT = 4096;
    this.replybuffer = new Uint8Array(0x2000);
    this.replybuffersize = 0;
    
    this.fid2inode = [];
}

Virtio9p.prototype.Reset = function() {
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
    //var size = ArrayToStruct(["s", "w"], [errormsg, errorcode], this.replybuffer, 7);
    var size = ArrayToStruct(["w"], [errorcode], this.replybuffer, 7);
    this.BuildReply(6, tag, size);
}

Virtio9p.prototype.ReceiveRequest = function (desc, GetByte) {

    var buffer = new Uint8Array(desc.len);
    CopyMemoryToBuffer(this.ramdev, buffer, desc.addr, desc.len);

    var header = StructToArray2(["w", "b", "h"], GetByte);
    var size = header[0];
    var id = header[1];
    var tag = header[2];
    // DebugMessage("size:" + size + " id:" + id + " tag:" + tag);

    switch(id)
    {
        case 8: // statfs
            var size = this.fs.GetTotalSize();
            var req = [];
            req[0] = 0x01021997;
            req[1] = 4096; // optimal transfer block size
            req[2] = 1000*1000*1024/req[1]; // free blocks, let's say 1GB
            req[3] = req[2] - size/req[1]; // free blocks in fs
            req[4] = req[2] - size/req[1]; // free blocks avail to non-superuser
            req[5] = this.fs.inodes.length; // total number of inodes
            req[6] = 1024*1024;
            req[7] = 0; // file system id?
            req[8] = 256; // maximum length of filenames

            var size = ArrayToStruct(["w", "w", "d", "d", "d", "d", "d", "d", "w"], req, this.replybuffer, 7);
            this.BuildReply(id, tag, size);
            return true;
            break;

        case 112: // topen
        case 12: // tlopen
            var req = StructToArray2(["w", "w"], GetByte);
            var fid = req[0];
            var mode = req[1];
            var inode = this.fs.GetInode(this.fid2inode[fid]);
            
            //DebugMessage("[open] fid=" + fid + ", mode=" + mode);
            req[0] = inode.qid;
            req[1] = this.IOUNIT;
            ArrayToStruct(["Q", "w"], req, this.replybuffer, 7);
            this.BuildReply(id, tag, 13+4);
            return true;
            break;

        case 70: // link
                this.SendError(tag, "Operation not permitted", EPERM);                   
                return true;
            break;

        case 16: // symlink
            var req = StructToArray2(["w", "s", "s", "w"], GetByte);
            var fid = req[0];
            var name = req[1];
            var symgt = req[2];
            var gid = req[3];
            //DebugMessage("[symlink] fid=" + fid + ", name=" + name + ", symgt=" + symgt + ", gid=" + gid); 
            var idx = this.fs.CreateSymlink(name, this.fid2inode[fid], symgt);
            var inode = this.fs.GetInode(idx);
            ArrayToStruct(["Q"], [inode.qid], this.replybuffer, 7);
            this.BuildReply(id, tag, 13);
            return true;
            break;

        case 22: // TREADLINK
            var req = StructToArray2(["w"], GetByte);
            var fid = req[0];
            //DebugMessage("[readlink] fid=" + fid);
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
            //DebugMessage("[mkdir] fid=" + fid + ", name=" + name + ", mode=" + mode + ", gid=" + gid); 
            var idx = this.fs.CreateDirectory(name, this.fid2inode[fid]);
            var inode = this.fs.GetInode(idx);
            inode.mode = mode;
            inode.gid = gid;
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
            //DebugMessage("[create] fid=" + fid + ", name=" + name + ", flags=" + flags + ", mode=" + mode + ", gid=" + gid); 
            var idx = this.fs.CreateFile(name, this.fid2inode[fid]);
            this.fid2inode[fid] = idx;
            var inode = this.fs.GetInode(idx);
            inode.gid = gid;
            ArrayToStruct(["Q", "w"], [inode.qid, this.IOUNIT], this.replybuffer, 7);
            this.BuildReply(id, tag, 13+4);
            return true;            
            break;

        case 52: // lock always suceed
            ArrayToStruct(["w"], [0], this.replybuffer, 7);
            this.BuildReply(id, tag, 4);
            return true;            
            break;
        
        
        case 24: // getattr
            var req = StructToArray2(["w", "d"], GetByte);
            var fid = req[0];
            //DebugMessage("[getattr]: fid=" + fid + " request mask=" + req[1]);
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
            //DebugMessage("[setattr]: fid=" + fid + " request mask=" + req[1]);
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
                this.fs.ChangeSize(this.fid2inode[fid], req[5]);
            }
            this.BuildReply(id, tag, 0);
            return true;
            break;

        case 50: // fsync
            var req = StructToArray2(["w", "d"], GetByte);
            var fid = req[0];
            this.BuildReply(id, tag, 0);
            return true;
            break;

        case 40: // TREADDIR
        case 116: // read
            var req = StructToArray2(["w", "d", "w"], GetByte);
            var fid = req[0];
            var offset = req[1];
            var count = req[2];
            //if (id == 40) DebugMessage("[treaddir]: fid=" + fid + " offset=" + offset + " count=" + count);
            //if (id == 116) DebugMessage("[read]: fid=" + fid + " offset=" + offset + " count=" + count);
            if (id == 40) this.fs.FillDirectory(this.fid2inode[fid]);
            var inode = this.fs.GetInode(this.fid2inode[fid]);
            if (inode.data.length < offset+count) count = inode.data.length-offset;
            for(var i=0; i<count; i++)
                this.replybuffer[7+4+i] = inode.data[offset+i];
            ArrayToStruct(["w"], [count], this.replybuffer, 7);
            this.BuildReply(id, tag, 4 + count);
            return true;
            break;

        case 118: // write
            var req = StructToArray2(["w", "d", "w"], GetByte);
            var fid = req[0];
            var offset = req[1];
            var count = req[2];
            //DebugMessage("[write]: fid=" + fid + " offset=" + offset + " count=" + count);
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
            //DebugMessage("[renameat]: oldname=" + oldname + " newname=" + newname);
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

            inode = this.fs.GetInode(this.fid2inode[olddirfid]);
            inode.updatedir = true;
            inode = this.fs.GetInode(this.fid2inode[newdirfid]);
            inode.updatedir = true;
           
            this.BuildReply(id, tag, 0);
            return true;
            break;

        case 76: // TUNLINKAT
            var req = StructToArray2(["w", "s", "w"], GetByte);
            var dirfd = req[0];
            var name = req[1];
            var flags = req[2];
            //DebugMessage("[unlink]: dirfd=" + dirfd + " name=" + name + " flags=" + flags);
            var id = this.fs.Search(this.fid2inode[dirfd], name);
            if (id == -1) {
                   this.SendError(tag, "No such file or directory", ENOENT);
                   this.fid2inode[nwfid] = -1;
                   return true;
            }
            var ret = this.fs.Unlink(id);
            if (!ret) {
                this.SendError(tag, "Directory not empty", ENOTEMPTY);
                return true;
            }
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
            //DebugMessage("[attach]: fid=" + fid + " afid=" + hex8(req[1]) + " uname=" + req[2] + " aname=" + req[3]);
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
            //DebugMessage("[walk]: fid=" + req[0] + " nwfid=" + req[1] + " nwname=" + nwname);
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
            //DebugMessage("walk to :" + walk.toString());
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
            //DebugMessage("[clunk]: fid=" + req[0]);
            this.fid2inode[req[0]] = -1;
            this.BuildReply(id, tag, 0);
            return true;

        default:
            DebugMessage("Error in Virtio9p: Unknown id " + id + " received");
            abort();
            //this.SendError(tag, "Operation i not supported",  ENOTSUPP);
            //return true;
            break;
    }
    return false;
}




