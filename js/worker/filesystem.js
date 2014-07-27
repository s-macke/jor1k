// -------------------------------------------------
// ----------------- FILESYSTEM---------------------
// -------------------------------------------------
// Implementation of a unix filesystem in memory.

"use strict";

var P9_STAT_MODE_DIR = 0x80000000;
var P9_STAT_MODE_APPEND = 0x40000000;
var P9_STAT_MODE_EXCL = 0x20000000;
var P9_STAT_MODE_MOUNT = 0x10000000;
var P9_STAT_MODE_AUTH = 0x08000000;
var P9_STAT_MODE_TMP = 0x04000000;
var P9_STAT_MODE_SYMLINK = 0x02000000;
var P9_STAT_MODE_LINK = 0x01000000;
var P9_STAT_MODE_DEVICE = 0x00800000;
var P9_STAT_MODE_NAMED_PIPE = 0x00200000;
var P9_STAT_MODE_SOCKET = 0x00100000;
var P9_STAT_MODE_SETUID = 0x00080000;
var P9_STAT_MODE_SETGID = 0x00040000;
var P9_STAT_MODE_SETVTX = 0x00010000;



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

    this.qidnumber = 0x0;

    // root entry
    var inode = this.CreateDirectory("", -1);
    this.inodes.push(inode);
/*
    inode = this.CreateDirectory(".", 0);
    inode.qid = this.inodes[0].qid;
    this.inodes.push(inode);

    inode = this.CreateDirectory("..", 0);
    this.inodes.push(inode);
*/
    inode = this.CreateTextFile("hello", 0, "Hello World");
    this.inodes.push(inode);
}

FS.prototype.CreateInode = function() {
    this.qidnumber++;
    return {
        name : "",
        uid : 0x0,
        gid : 0x0,
        data : new Uint8Array(0),
        mode : 0x01ED,
        qid: {type: 0, version: 0, path: this.qidnumber},
        parentid: -1
    };
}

FS.prototype.CreateDirectory = function(name, parentid) {
    var x = this.CreateInode();
    x.name = name;
    x.parentid = parentid;
    x.qid.type = S_IFDIR >> 8;
    x.mode = 0x01ED | S_IFDIR;
    return x;
}

FS.prototype.CreateFile = function(filename, parentid) {
    var x = this.CreateInode();
    x.name = filename;
    x.parentid = parentid;
    x.qid.type = S_IFREG >> 8;
    x.mode = 0x01ED | S_IFREG;
    return x;
}

FS.prototype.CreateTextFile = function(filename, parentid, str) {
    var x = this.CreateFile(filename, parentid);
    x.data = new Uint8Array(str.length);
    for (var j in str) {
        x.data[j] = str.charCodeAt(j);
    }
    return x;
}



FS.prototype.GetRoot = function() {
    return this.inodes[0];
}


FS.prototype.Walk = function(idx, name) {
    for(var i=0; i<this.inodes.length; i++) {
        if (this.inodes[i].parentid != idx) continue;
        if (this.inodes[i].name != name) continue;
        return i;
    }    
}


FS.prototype.GetInode = function(idx)
{
    return this.inodes[idx];
}



FS.prototype.FillDirectory = function(idx) {
    var inode = this.inodes[idx];
    var dirid = idx;
    
    // first get size
    var size = 0;
    for(var i=0; i<this.inodes.length; i++) {
        if (this.inodes[i].parentid != dirid) continue;
        size += 13 + 8 + 1 + 2 + this.inodes[i].name.length;
    }
    //DebugMessage("size of dir entry: " + size);
    inode.data = new Uint8Array(size);

    var offset = 0x0;
    for(var i=0; i<this.inodes.length; i++) {
        if (this.inodes[i].parentid != dirid) continue;
        offset += ArrayToStruct(
        ["Q", "d", "b", "s"],
        [this.inodes[i].qid, 
        offset+13+8+1+2+this.inodes[i].name.length, 
        this.inodes[i].qid.mode>>8, 
        this.inodes[i].name], 
        inode.data, offset);
        //DebugMessage("Add file " + this.inodes[i].name);
    }
    //DebugMessage("size of dir entry: " + offset);
    /*
    len = pdu_marshal(pdu, 11 + count, "Qqbs",
                          &qid, dent->d_off,
                          dent->d_type, &name);
	*/
}




