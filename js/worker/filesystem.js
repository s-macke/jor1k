// -------------------------------------------------
// ----------------- FILESYSTEM---------------------
// -------------------------------------------------
// Implementation of a unix filesystem in memory.


//var S_IFMT  00170000
//var S_IFSOCK 0140000
var S_IFLNK = 0xA000;
var S_IFREG = 0x8000;
var S_IFBLK = 0x6000;
var S_IFDIR = 0x4000;
var S_IFCHR = 0x2000;
//var S_IFIFO  0010000
//var S_ISUID  0004000
//var S_ISGID  0002000
//var S_ISVTX  0001000

var O_RDONLY = 0x0000 // open for reading only 
var O_WRONLY = 0x0001 // open for writing only
var	O_RDWR = 0x0002 // open for reading and writing
var	O_ACCMODE = 0x0003 // mask for above modes


function FS() {
    this.inodes = [];
    this.fid2inode = [];

    this.qidnumber = 0x1;

    // root entry
    var inode = this.CreateInode(0x0);
    inode.qid.type = S_IFDIR >> 8;
    //inode.fid = 0x0;
    inode.permission = 0x01ED | S_IFDIR;
    this.inodes.push(inode);

    inode = this.CreateFile("hello");
    //inode.fid = 0x1;
    inode.data = new Uint8Array(4);
    inode.data[0] = 32;
    inode.data[1] = 32;
    inode.data[2] = 32;
    inode.data[3] = 32;
    inode.permission = 0x01ED | S_IFREG;
    inode.parent = 0; // root directory
    this.inodes.push(inode);
}

FS.prototype.CreateInode = function(_fid) {
    this.qidnumber++;
    return {
        name : "",
        uid : 0x0,
        gid : 0x0,
        data : new Uint8Array(0),
        //fid : _fid,
        permission : 0x0,
        qid: {type: 0, version: 0, path: this.qidnumber},
        parentid: -1
    };
}

FS.prototype.GetRoot = function() {
    return this.inodes[0];
}

FS.prototype.AttachRoot = function(fid) {
    this.fid2inode[fid] = 0;
}

FS.prototype.Addfid = function(newfid, oldfid) {
    this.fid2inode[newfid] = this.fid2inode[oldfid];
}

FS.prototype.GetInode = function(fid)
{
    return this.inodes[this.fid2inode[fid]];
}

FS.prototype.FillDirectory = function(fid) {
    var inode = this.GetInode(fid);
    var dirid = this.fid2inode[fid];    
    
    // first get size
    var size = 0;
    for(var i=0; i<this.inodes.length; i++) {
        if (this.inodes[i].parent != dirid) continue;
        size += 13 + 8 + 1 + 2 + this.inodes[i].name.length;
    }
    DebugMessage("size of dir entry: " + size);
    inode.data = new Uint8Array(size);

    var offset = 0x0;
    for(var i=0; i<this.inodes.length; i++) {
        if (this.inodes[i].parent != dirid) continue;
        offset += ArrayToStruct(["Q", "d", "b", "s"], [this.inodes[i].qid, 0x0, this.inodes[i].type, this.inodes[i].name], inode.data, offset);
    }
    DebugMessage("size of dir entry: " + offset);
    /*
    len = pdu_marshal(pdu, 11 + count, "Qqbs",
                          &qid, dent->d_off,
                          dent->d_type, &name);
	*/
}


FS.prototype.CreateFile = function(filename) {
    var x = this.CreateInode(0x0);
    x.name = filename;
    return x;
}

