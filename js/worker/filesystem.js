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
    this.CreateDirectory("", -1);

    this.CreateTextFile("hello", 0, "Hello World");

    this.tarbuffer = new Uint8Array(512);
    this.tarbufferofs = 0;
    this.tarmode = 0; // mode = 0: header, mode!=0: file
    this.tarfileoffset = 0;
}

// -----------------------------------------------------

function ReadVariable(buffer, offset) {
    var variable = [];
    variable.name = "";
    variable.value = "";

    // read blanks
    for(var i=offset; i<buffer.length; i++) {
        if (buffer[i] == '>') return variable;
        if (buffer[i] == '/') return variable;
        if (buffer[i] != ' ') break;
    }
    offset = i;
    if (buffer[i] == '>') return variable;

    // read variable name
    for(var i=offset; i<buffer.length; i++) {
        if (buffer[i] == '>') break;
        if (buffer[i] == '=') break;
        variable.name = variable.name + buffer[i]; 
    }
    offset = i+1;
    if (variable.name.length == 0) return variable;
    // read variable value
    for(var i=offset+1; i<buffer.length; i++) {
        if (buffer[i] == '>') break;
        if (buffer[i] == '\'') break;
        variable.value = variable.value + buffer[i]; 
    }
    offset = i+1;
    variable.offset = offset;
    //DebugMessage("read " + variable.name + "=" + variable.value);
    return variable;
}

function ReadTag(buffer, offset) {
    var tag = [];
    tag.type = "";
    tag.name = "";
    tag.mode = 0x0;
    tag.path = "";
    tag.src = "";
    tag.compressed = 0;

    if (buffer[offset] != '<') return tag;
    for(var i=offset+1; i<buffer.length; i++) {
        if (buffer[i] ==  ' ') break;
        if (buffer[i] == '\n') break;
        if (buffer[i] == '>') break;
        tag.type = tag.type + buffer[i]; 
    }
    offset = i;
    // read variables
    do {
        var variable = ReadVariable(buffer, offset);
        if (variable.name == "name") tag.name = variable.value;
        if (variable.name == "mode") tag.mode = parseInt(variable.value, 8);
        if (variable.name == "path") tag.path = variable.value;
        if (variable.name == "size") tag.size = parseInt(variable.value, 10);
        if (variable.name == "src") tag.src = variable.value;
        if (variable.name == "compressed") tag.compressed = true;
        offset = variable.offset;
    } while(variable.name.length != 0);
    return tag;
};


FS.prototype.LoadFSXML = function(urls)
{
    DebugMessage("Load filesystem information from " + urls[0]);
    LoadXMLResource("../../" + urls[0], this.OnXMLLoaded.bind(this), function(error){throw error;});
}

FS.prototype.OnXMLLoaded = function(fs)
{
    // At this point I realized, that the dom is not available in worker threads and that I cannot get the xml information directly.
    // So let's analyze ourself
    var sysrootdir = "../../";

    var parentid = 0;
    for(var i=0; i<fs.length; i++)
    {
        if (fs[i] != '<') continue;
        var tag = ReadTag(fs, i, ' '); 
        //DebugMessage("Found " + tag.type + " " + tag.name);
        var id = this.Search(parentid, tag.name);
        if (id != -1) continue;

        var inode = this.CreateInode();
        inode.name = tag.name;
        inode.parentid = parentid;
        inode.mode = tag.mode;
        var size = tag.size;


    switch(tag.type) {
    case "FS":
        sysrootdir = "../../" + tag.src + "/";
        break;

    case "Dir":
        inode.mode |= S_IFDIR;
        parentid = this.inodes.length;
        this.inodes.push(inode);
        break;

    case "/Dir":
        parentid = this.inodes[parentid].parentid;
        break;

    case "File":
        inode.mode |= S_IFREG;
        //inode.data = new Uint8Array(size);
        var idx = this.inodes.length;
        this.inodes.push(inode);        
        var url = sysrootdir + (tag.src.length==0?this.GetFullPath(idx):tag.src);
        DebugMessage("Load id=" + (idx) + " " + url);
        this.LoadFile(idx, url, size, tag.compressed);
        break;

    case "Link":
        inode.mode |= S_IFLNK;
        inode.symlink = tag.path;
        this.inodes.push(inode);
        break;
        }
    }
    DebugMessage("processed " + this.inodes.length + " inodes");
}

// Loads the data from a url for a specific inode
FS.prototype.LoadFile = function(idx, url, size, compressed) {

    if (compressed) {
        url = url + ".bz2";
        this.inodes[idx].data = new Uint8Array(size);
    LoadBinaryResource(url, 
        function(buffer){
        var buffer8 = new Uint8Array(buffer);
        var ofs = 0;
        bzip2.simple(buffer8, function(x){this.inodes[idx].data[ofs++] = x;}.bind(this) );    
        }.bind(this), 
        function(error){throw error;});

        return;
    }

    LoadBinaryResource(url, 
        function(buffer){ this.inodes[idx].data = new Uint8Array(buffer); }.bind(this), 
        function(error){throw error;});
}

// -----------------------------------------------------

function ReadStringFromBinary(buffer, offset, numBytes) {
    var str = "";
    for(var i=0; i<numBytes; i++) {
        if (buffer[offset+i] < 32) return str; // no special signs
        str = str + String.fromCharCode(buffer[offset+i]); 
    }
    return str;
};

FS.prototype.Untar = function(x) {
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
    //DebugMessage("name:" + name);
    var walk = name.split("/");
    var n = walk.length;
    if (walk[n-1].length == 0) walk.pop();
    var n = walk.length;
    DebugMessage("walk:" + walk);

    var parentid = 0;
    var id = -1;
    for(var i=0; i<n-1; i++) {
        id = this.Search(parentid, walk[i]);
        if (id == -1) throw "Error in untar: Could not find inode.";
        parentid = id;
    }
    id = this.Search(parentid, walk[walk.length-1]);

    if (id != -1) return;

    if ((id != -1) && (typeflag != '5')) {
        //throw "Warning: File already exists";
        return; // do not overwrite
    }
    if ((id != -1) && (typeflag == '5')) {
        return;
    }

    var inode = this.CreateInode();
    inode.name = walk[n-1];
    inode.parentid = parentid;
    inode.mode = parseInt(ReadStringFromBinary(this.tarbuffer, 100, 8), 8);
    var size = parseInt(ReadStringFromBinary(this.tarbuffer, 124, 12), 8);
    //DebugMessage(size);

    switch(typeflag) {
    case "5":
        inode.mode |= S_IFDIR;
        break;

    case "0":
        inode.mode |= S_IFREG;
        inode.data = new Uint8Array(size);
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
    this.inodes.push(inode);
}

// -----------------------------------------------------

FS.prototype.CreateInode = function() {
    this.qidnumber++;
    return {
        valid : true,
        name : "",
        uid : 0x0,
        gid : 0x0,
        data : new Uint8Array(0),
        symlink : "",
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
    this.inodes.push(x);
    return this.inodes.length-1;
}

FS.prototype.CreateFile = function(filename, parentid) {
    var x = this.CreateInode();
    x.name = filename;
    x.parentid = parentid;
    x.qid.type = S_IFREG >> 8;
    x.mode = 0x01ED | S_IFREG;
    this.inodes.push(x);
    return this.inodes.length-1;
}
     
FS.prototype.CreateSymlink = function(filename, parentid, symlink) {
    var x = this.CreateInode();
    x.name = filename;
    x.parentid = parentid;
    x.qid.type = S_IFLNK >> 8;
    x.symlink = symlink;
    x.mode = S_IFLNK;
    this.inodes.push(x);
    return this.inodes.length-1;
}

FS.prototype.CreateTextFile = function(filename, parentid, str) {
    var id = this.CreateFile(filename, parentid);
    var x = this.inodes[id];
    x.data = new Uint8Array(str.length);
    for (var j in str) {
        x.data[j] = str.charCodeAt(j);
    }
    return id;
}



FS.prototype.GetRoot = function() {
    return this.inodes[0];
}


FS.prototype.Search = function(idx, name) {
    for(var i=0; i<this.inodes.length; i++) {
        if (!this.inodes[i].valid) continue;
        if (this.inodes[i].parentid != idx) continue;
        if (this.inodes[i].name != name) continue;
        return i;
    }
    return -1;
}

FS.prototype.GetTotalSize = function() {
    var size = 0;
    for(var i=0; i<this.inodes.length; i++) {
        if (!this.inodes[i].valid) continue;
        size += this.inodes[i].data.length;
    }
    return size;
}

FS.prototype.GetFullPath = function(idx) {
    var path = "";

    while(idx != 0) {
        path = "/" + this.inodes[idx].name + path;
        idx = this.inodes[idx].parentid;
    }
    return path.substring(1);
}

FS.prototype.Rename = function(srcdir, srcname, destdir, destname) {


}


FS.prototype.Unlink = function(idx) {
    this.inodes[idx].data = new Uint8Array(0);
    this.inodes[idx].valid = false;
}


FS.prototype.GetInode = function(idx)
{
    return this.inodes[idx];
}

FS.prototype.ChangeSize = function(idx, newsize)
{
    var inode = this.inodes[idx];
    var temp = inode.data;
    //DebugMessage("change size to: " + newsize);
    inode.data = new Uint8Array(newsize);
    var size = temp.length;
    if (size > inode.data.length) size = inode.data.length;
    for(var i=0; i<size; i++) {
        inode.data[i] = temp[i];
    }

}


FS.prototype.FillDirectory = function(dirid) {
    var inode = this.inodes[dirid];
    var parentid = this.inodes[dirid].parentid;
    if (parentid == -1) parentid = 0; // if root directory point to the root directory
    
    // first get size
    var size = 0;
    for(var i=0; i<this.inodes.length; i++) {
        if (!this.inodes[i].valid) continue;
        if (this.inodes[i].parentid != dirid) continue;
        size += 13 + 8 + 1 + 2 + this.inodes[i].name.length;
    }

    size += 13 + 8 + 1 + 2 + 1; // "." entry
    size += 13 + 8 + 1 + 2 + 2; // ".." entry
    //DebugMessage("size of dir entry: " + size);
    inode.data = new Uint8Array(size);

    var offset = 0x0;
    offset += ArrayToStruct(
        ["Q", "d", "b", "s"],
        [this.inodes[dirid].qid, 
        offset+13+8+1+2+1, 
        this.inodes[dirid].qid.mode>>8, 
        "."],
        inode.data, offset);

    offset += ArrayToStruct(
        ["Q", "d", "b", "s"],
        [this.inodes[parentid].qid,
        offset+13+8+1+2+2, 
        this.inodes[dirid].qid.mode>>8, 
        ".."],
        inode.data, offset);


    
    for(var i=0; i<this.inodes.length; i++) {
        if (!this.inodes[i].valid) continue;
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

}




