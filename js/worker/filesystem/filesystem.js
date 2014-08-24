// -------------------------------------------------
// ----------------- FILESYSTEM---------------------
// -------------------------------------------------
// Implementation of a unix filesystem in memory.

"use strict";


var S_IFMT = 0xF000;
//var S_IFSOCK = 0140000
var S_IFLNK = 0xA000;
var S_IFREG = 0x8000;
var S_IFBLK = 0x6000;
var S_IFDIR = 0x4000;
var S_IFCHR = 0x2000;
//var S_IFIFO  0010000
//var S_ISUID  0004000
//var S_ISGID  0002000
//var S_ISVTX  0001000

var O_RDONLY = 0x0000; // open for reading only 
var O_WRONLY = 0x0001; // open for writing only
var O_RDWR = 0x0002; // open for reading and writing
var O_ACCMODE = 0x0003; // mask for above modes

var STATUS_INVALID = -0x1;
var STATUS_OK = 0x0;
var STATUS_OPEN = 0x1;
var STATUS_ON_SERVER = 0x2;
var STATUS_LOADING = 0x3;


function FS() {
    this.inodes = [];
    this.events = [];

    this.qidnumber = 0x0;
    this.filesinloadingqueue = 0;
    this.OnLoaded = function() {};

    this.tar = new TAR(this);

    // root entry
    this.CreateDirectory("", -1);
}

// -----------------------------------------------------

FS.prototype.AddEvent = function(id, OnEvent) {
    var inode = this.inodes[id];
    if (inode.status == STATUS_OK) {
        OnEvent();
        return;
    }
    this.events.push({id: id, OnEvent: OnEvent});    
}

FS.prototype.HandleEvent = function(id) {
    if (this.filesinloadingqueue == 0) {
        this.OnLoaded();
        this.OnLoad = function() {}
    }
    //DebugMessage("number of events: " + this.events.length);
    for(var i = this.events.length - 1; i >= 0; i--) {
        if (this.events[i].id != id) continue;
        this.events[i].OnEvent();
        this.events.splice(i, 1);
    }
}


// -----------------------------------------------------
FS.prototype.LoadImage = function(url)
{
    if (!url) return;
    //DebugMessage("Load Image " + url);
    if (typeof Worker !== 'undefined') {
        LoadBZIP2Resource(url, 
            function(m){ for(var i=0; i<m.size; i++) this.tar.Unpack(m.data[i]); }.bind(this), 
            function(e){DebugMessage("Error: Could not load " + url + ". Skipping.");});
    } else {
        LoadBinaryResource(url, 
        function(buffer){
            var buffer8 = new Uint8Array(buffer);
            bzip2.simple(buffer8, this.tar.Unpack.bind(this.tar));
        }.bind(this), 
        function(error){DebugMessage("Error: Could not load " + url + ". Skipping.");});
    }
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
    tag.uid = 0x0;
    tag.gid = 0x0;
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
        if (variable.name == "uid") tag.uid = parseInt(variable.value, 10);
        if (variable.name == "gid") tag.gid = parseInt(variable.value, 10);
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
        var id = this.Search(parentid, tag.name);
        if (id != -1) continue;

        var inode = this.CreateInode();
        inode.name = tag.name;
        inode.uid = tag.uid;
        inode.gid = tag.gid;
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
        this.PushInode(inode);
        break;

    case "/Dir":
        parentid = this.inodes[parentid].parentid;
        break;

    case "File":
        inode.mode |= S_IFREG;
        var idx = this.inodes.length;
        inode.status = STATUS_ON_SERVER;
        inode.compressed = tag.compressed;
        inode.size = size;
        this.PushInode(inode);
        var url = sysrootdir + (tag.src.length==0?this.GetFullPath(idx):tag.src);
        inode.url = url;
        //DebugMessage("Load id=" + (idx) + " " + url);
        this.LoadFile(idx);
        break;

    case "Link":
        inode.mode |= S_IFLNK;
        inode.symlink = tag.path;
        this.PushInode(inode);
        break;
        }
    }
    DebugMessage("processed " + this.inodes.length + " inodes");
}



// Loads the data from a url for a specific inode
FS.prototype.LoadFile = function(idx) {
    var inode = this.inodes[idx];
    if (inode.status != STATUS_ON_SERVER) {
        return;
    }
    inode.status = STATUS_LOADING;
    this.filesinloadingqueue++;

    if (inode.compressed) {
        inode.data = new Uint8Array(inode.size);
        LoadBinaryResource(inode.url + ".bz2",
        function(buffer){
            var buffer8 = new Uint8Array(buffer);
            var ofs = 0;
            bzip2.simple(buffer8, function(x){inode.data[ofs++] = x;}.bind(this) );    
            inode.status = STATUS_OK;
            this.filesinloadingqueue--;
            this.HandleEvent(idx);            
        }.bind(this), 
        function(error){throw error;});

        return;
    }

    LoadBinaryResource(inode.url, 
        function(buffer){
            inode.data = new Uint8Array(buffer);
            inode.size = this.inodes[idx].data.length; // correct size if the previous was wrong. 
            inode.status = STATUS_OK;
            this.filesinloadingqueue--;
            this.HandleEvent(idx);            
        }.bind(this), 
        function(error){throw error;});

}

// -----------------------------------------------------

FS.prototype.PushInode = function(inode) {
    this.inodes.push(inode);
    if (inode.parentid != -1) {
        this.inodes[inode.parentid].updatedir = true;
    }
}

FS.prototype.CreateInode = function() {
    this.qidnumber++;
    return {
        updatedir : false, // did the directory listing changed?
        parentid: -1,
        status : 0,
        name : "",
        size : 0x0,
        uid : 0x0,
        gid : 0x0,
        data : new Uint8Array(0),
        symlink : "",
        mode : 0x01ED,
        qid: {type: 0, version: 0, path: this.qidnumber},
        url: "", // url to download the file
        compressed: false
    };
}



FS.prototype.CreateDirectory = function(name, parentid) {
    var x = this.CreateInode();
    x.name = name;
    x.parentid = parentid;
    x.mode = 0x01FF | S_IFDIR;
    if (parentid >= 0) {
        x.uid = this.inodes[parentid].uid;
        x.gid = this.inodes[parentid].gid;
        x.mode = (this.inodes[parentid].mode & 0x1FF) | S_IFDIR;
    }
    x.qid.type = S_IFDIR >> 8;
    this.PushInode(x);
    return this.inodes.length-1;
}

FS.prototype.CreateFile = function(filename, parentid) {
    var x = this.CreateInode();
    x.name = filename;
    x.parentid = parentid;
    x.uid = this.inodes[parentid].uid;
    x.gid = this.inodes[parentid].gid;
    x.qid.type = S_IFREG >> 8;
    x.mode = (this.inodes[parentid].mode & 0x1B6) | S_IFREG;
    this.PushInode(x);
    return this.inodes.length-1;
}
     
FS.prototype.CreateSymlink = function(filename, parentid, symlink) {
    var x = this.CreateInode();
    x.name = filename;
    x.parentid = parentid;
    x.uid = this.inodes[parentid].uid;
    x.gid = this.inodes[parentid].gid;
    x.qid.type = S_IFLNK >> 8;
    x.symlink = symlink;
    x.mode = S_IFLNK;
    this.PushInode(x);
    return this.inodes.length-1;
}

FS.prototype.CreateTextFile = function(filename, parentid, str) {
    var id = this.CreateFile(filename, parentid);
    var x = this.inodes[id];
    x.data = new Uint8Array(str.length);
    x.size = str.length;
    for (var j in str) {
        x.data[j] = str.charCodeAt(j);
    }
    return id;
}

FS.prototype.OpenInode = function(id, mode) {
    var inode = this.inodes[id];
    var type = "";
    switch(inode.mode) {
        case S_IFREG: type = "File"; break;
        case S_IFBLK: type = "Block Device"; break;
        case S_IFDIR: type = "Directory"; break;
        case S_IFCHR: type = "Character Device"; break;
    }
    DebugMessage("open:" + this.GetFullPath(id) +  " type: " + type + " status:" + inode.status);
    if (inode.status == STATUS_ON_SERVER) {
        this.LoadFile(id);
        return false;
    }
    return true;
}

FS.prototype.CloseInode = function(id) {
    if (id < 0) return;
    //DebugMessage("close: " + this.GetFullPath(id));
    //this.inodes[id].status = 0;
}

FS.prototype.Rename = function(olddirid, oldname, newdirid, newname) {

    if ((olddirid == newdirid) && (oldname == newname)) {
        return true;
    }
    var oldid = this.Search(olddirid, oldname);
    if (oldid == -1) {
        return false;
    }
    var newid = this.Search(newdirid, newname);
    if (newid != -1) {
        this.Unlink(newid);
    }           
    var inode = this.inodes[oldid];
    inode.parentid = newdirid;
    inode.name = newname;
    inode.qid.version++;

    this.inodes[olddirid].updatedir = true;
    this.inodes[newdirid].updatedir = true;
    return true;
}

FS.prototype.Write = function(id, offset, count, GetByte) {
    var inode = this.inodes[id];

    if (inode.data.length < (offset+count)) {
        this.ChangeSize(id, Math.floor(((offset+count)*3)/2) );
        inode.size = offset + count;
    } else
    if (inode.size < (offset+count)) {
        inode.size = offset + count;
    }
    for(var i=0; i<count; i++)
        inode.data[offset+i] = GetByte();
}


FS.prototype.GetRoot = function() {
    return this.inodes[0];
}


FS.prototype.Search = function(idx, name) {
    for(var i=0; i<this.inodes.length; i++) {
        if (this.inodes[i].status == STATUS_INVALID) continue;
        if (this.inodes[i].parentid != idx) continue;
        if (this.inodes[i].name != name) continue;
        return i;
    }
    return -1;
}

FS.prototype.GetTotalSize = function() {
    var size = 0;
    for(var i=0; i<this.inodes.length; i++) {
        if (this.inodes[i].status == STATUS_INVALID) continue;
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



FS.prototype.Unlink = function(idx) {

    if ((this.inodes[idx].mode&S_IFMT) == S_IFDIR) {
        for(var i=0; i<this.inodes.length; i++) {
            if (this.inodes[i].status == STATUS_INVALID) continue;
            if (this.inodes[i].parentid == idx) return false;
        }
    }

    this.inodes[idx].data = new Uint8Array(0);
    this.inodes[idx].size = 0;
    this.inodes[idx].status = STATUS_INVALID;
    this.inodes[this.inodes[idx].parentid].updatedir = true;
    return true;
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
    if (newsize == inode.size) return;
    inode.data = new Uint8Array(newsize);
    inode.size = newsize;
    var size = Math.min(temp.length, inode.size);
    for(var i=0; i<size; i++) {
        inode.data[i] = temp[i];
    }
}

FS.prototype.SearchPath = function(path) {
    //path = path.replace(/\/\//g, "/");
    path = path.replace("//", "/");
    var walk = path.split("/");
    var n = walk.length;
    if (walk[n-1].length == 0) walk.pop();
    if (walk[0].length == 0) walk.shift();
    var n = walk.length;

    var parentid = 0;
    var id = -1;
    for(var i=0; i<n; i++) {
        id = this.Search(parentid, walk[i]);        
        if (id == -1) {
            if (i < n-1) return {id: -1, parentid: -1, name: walk[i]}; // one name of the path cannot be found
            return {id: -1, parentid: parentid, name: walk[i]}; // the last element in the path does not exist, but the parent
        }
        parentid = id;
    }
    return {id: id, parentid: parentid, name: walk[i]};
}
// -----------------------------------------------------

FS.prototype.GetRecursiveList = function(dirid, list) {

    for(var i=0; i<this.inodes.length; i++) {
        if (this.inodes[i].status == STATUS_INVALID) continue;
        if (this.inodes[i].parentid != dirid) continue;
        list.push(i);
        if ((this.inodes[i].mode&S_IFMT) == S_IFDIR) {
            this.GetRecursiveList(i, list);
        }
    }
}

FS.prototype.MergeFile = function(file) {
    DebugMessage("Merge path:" + file.name);
    var ids = this.SearchPath(file.name);
    if (ids.parentid == -1) return; // not even the path seems to exist
    if (ids.id == -1) {
        ids.id = this.CreateFile(ids.name, ids.parentid); 
    }
    this.inodes[ids.id].data = file.data;
    this.inodes[ids.id].size = file.data.length;
}


FS.prototype.FillDirectory = function(dirid) {
    var inode = this.inodes[dirid];
    if (!inode.updatedir) return;
    var parentid = this.inodes[dirid].parentid;
    if (parentid == -1) parentid = 0; // if root directory point to the root directory
    
    // first get size
    var size = 0;
    for(var i=0; i<this.inodes.length; i++) {
        if (this.inodes[i].status == STATUS_INVALID) continue;
        if (this.inodes[i].parentid != dirid) continue;
        size += 13 + 8 + 1 + 2 + this.inodes[i].name.length;
    }

    size += 13 + 8 + 1 + 2 + 1; // "." entry
    size += 13 + 8 + 1 + 2 + 2; // ".." entry
    //DebugMessage("size of dir entry: " + size);
    inode.data = new Uint8Array(size);
    inode.size = size;

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
        if (this.inodes[i].status == STATUS_INVALID) continue;
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
    inode.updatedir = false;
}


// -----------------------------------------------------


