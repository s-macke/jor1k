// -------------------------------------------------
// -------------------- TAR ------------------------
// -------------------------------------------------
// TAR file support for the filesystem

"use strict";

var message = require('../messagehandler');

var S_IRWXUGO = 0x1FF;
var S_IFMT = 0xF000;
var S_IFSOCK = 0xC000;
var S_IFLNK = 0xA000;
var S_IFREG = 0x8000;
var S_IFBLK = 0x6000;
var S_IFDIR = 0x4000;
var S_IFCHR = 0x2000;

function TAR(filesystem) {
    this.fs = filesystem;
    this.tarbuffer = new Uint8Array(512);
    this.tarbufferofs = 0;
    this.tarmode = 0; // mode = 0: header, mode!=0: file
    this.tarfileoffset = 0;
}

function ReadStringFromBinary(buffer, offset, numBytes) {
    var str = "";
    for(var i=0; i<numBytes; i++) {
        if (buffer[offset+i] < 32) return str; // no special signs
        str = str + String.fromCharCode(buffer[offset+i]); 
    }
    return str;
};

function WriteStringToBinary(str, buffer, offset, numBytes) {
    var n = Math.min(numBytes, str.length+1);
    for(var i=0; i<n; i++) {
        buffer[offset+i] = str.charCodeAt(i);
    }
    buffer[offset+n-1] = 0;
};

// Receives a stream of bytes
TAR.prototype.Unpack = function(x) {
    this.tarbuffer[this.tarbufferofs++] = x;
    if (this.tarbufferofs != 512) return;
    this.tarbufferofs = 0;
 
    if (this.tarmode == 1) {
        var n = Math.min(512, this.tarfilebuffer.length - this.tarfileoffset);
        for(var i=0; i<n; i++) {
            this.tarfilebuffer[this.tarfileoffset++] = this.tarbuffer[i];
        }
        if (this.tarfileoffset >= this.tarfilebuffer.length) this.tarmode = 0; // file finished loading, change mode
        return;
    }

    // tarmode = 0
    var magic = ReadStringFromBinary(this.tarbuffer, 257, 5);
    if (magic != "ustar") return;

    var typeflag = String.fromCharCode(this.tarbuffer[156]);
    var name = ReadStringFromBinary(this.tarbuffer, 0, 100);    
    //message.Debug("name:" + name);
    //TODO: use searchpath function
    var walk = name.split("/");
    var n = walk.length;
    if (walk[n-1].length == 0) walk.pop();
    var n = walk.length;
    //message.Debug("walk:" + walk);

    var parentid = 0;
    var id = -1;
    for(var i=0; i<n-1; i++) {
        id = this.fs.Search(parentid, walk[i]);
        if (id == -1) throw "Error in untar: Could not find inode.";
        parentid = id;
    }
    id = this.fs.Search(parentid, walk[walk.length-1]);

    if (id != -1) return;

    if ((id != -1) && (typeflag != '5')) {
        //throw "Warning: File already exists";
        return; // do not overwrite
    }
    if ((id != -1) && (typeflag == '5')) {
        return;
    }

    var inode = this.fs.CreateInode();
    inode.name = walk[n-1];
    inode.parentid = parentid;
    inode.mode = parseInt(ReadStringFromBinary(this.tarbuffer, 100, 8), 8);
    inode.uid = parseInt(ReadStringFromBinary(this.tarbuffer, 108, 8), 8);
    inode.gid = parseInt(ReadStringFromBinary(this.tarbuffer, 116, 8), 8);
    inode.atime = parseInt(ReadStringFromBinary(this.tarbuffer, 136, 12), 8);
    inode.ctime = this.atime;
    inode.mtime = this.atime;
    var size = parseInt(ReadStringFromBinary(this.tarbuffer, 124, 12), 8);

    switch(typeflag) {
    case "5":
        inode.mode |= S_IFDIR;
        break;

    case "0":
        inode.mode |= S_IFREG;
        inode.data = new Uint8Array(size);
        inode.size = size;
        if (size == 0) break;
        this.tarmode = 1;
        this.tarfileoffset = 0;
        this.tarfilebuffer = inode.data;
        break;

    case "1":
        inode.mode |= S_IFLNK;
        inode.symlink = "/"+ReadStringFromBinary(this.tarbuffer, 157, 100);
        break;

    case "2":
        inode.mode |= S_IFLNK;
        inode.symlink = ReadStringFromBinary(this.tarbuffer, 157, 100);
        break;
    }
    this.fs.PushInode(inode);
}

TAR.prototype.Pack = function(path) {
    message.Debug("tar: " + path);
    var id = this.fs.SearchPath(path).id;
    if (id == -1) return new Uint8Array(0);
    var filelist = [];
    this.fs.GetRecursiveList(id, filelist);
    var size = 0;
    for(var i=0; i<filelist.length; i++) {
        switch(this.fs.inodes[filelist[i]].mode&S_IFMT)
        {
            case S_IFLNK:
            case S_IFDIR:
                size += 512;
               break;
            case S_IFREG:
                size += 512;
                size += this.fs.inodes[filelist[i]].size;
                if (size & 511) {size = size & (~0x1FF); size += 512;}
                break;
        }
    }    
    message.Debug("tar: " + this.fs.GetFullPath(id) + " size: " + size + " files: " + filelist.length);
    message.Debug(filelist);
    
    var buffer = new Uint8Array(size);
    var offset = 0;
    for(var i=0; i<filelist.length; i++) {
        var inode = this.fs.inodes[filelist[i]];
        var type = inode.mode&S_IFMT;
        if ((type != S_IFLNK) && (type != S_IFDIR) && (type != S_IFREG)) continue;
        WriteStringToBinary("ustar  ", buffer, offset+257, 8);
        WriteStringToBinary(this.fs.GetFullPath(filelist[i]), buffer, offset+0, 100);
        WriteStringToBinary("00000000000", buffer, offset+124, 12); // size
        WriteStringToBinary((inode.mode&0xFFF).toString(8), buffer, offset+100, 8); // mode
        WriteStringToBinary(inode.uid.toString(8), buffer, offset+108, 8); // uid
        WriteStringToBinary(inode.gid.toString(8), buffer, offset+116, 8); // gid
        WriteStringToBinary((inode.mtime).toString(8), buffer, offset+136, 12); // mtime        
        //WriteStringToBinary("root", buffer, offset+265, 7);
        //WriteStringToBinary("root", buffer, offset+297, 7); // chksum blank to calculate the checksum
        
        buffer[offset+148+0] = 32; // chksum
        buffer[offset+148+1] = 32;
        buffer[offset+148+2] = 32;
        buffer[offset+148+3] = 32;
        buffer[offset+148+4] = 32;
        buffer[offset+148+5] = 32;
        buffer[offset+148+6] = 32;
        buffer[offset+148+7] = 32;

        switch(type)
        {
            case S_IFLNK:
                buffer[offset+156] = "2".charCodeAt(0);
                WriteStringToBinary(inode.symlink, buffer, offset+157, 100);
                break;

            case S_IFDIR:
                buffer[offset+156] = "5".charCodeAt(0);
                break;

            case S_IFREG:
                buffer[offset+156] = "0".charCodeAt(0);
                WriteStringToBinary(inode.size.toString(8), buffer, offset+124, 12);
                break;
        }
        var chksum = 0;
        for(var j=0; j<512; j++) {
            chksum += buffer[offset + j];
        }
        WriteStringToBinary(chksum.toString(8), buffer, offset+148, 7);
        offset += 512;
        
        if (type == S_IFREG) { // copy the file
            for(var j=0; j<inode.size; j++) {
                buffer[offset++] = inode.data[j];
            }
            if (offset & 511) {offset = offset & (~0x1FF); offset += 512;}
        }
    }
    return buffer;
}

module.exports = TAR;
