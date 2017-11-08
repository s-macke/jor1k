// -------------------------------------------------
// ----------------- FILESYSTEM---------------------
// -------------------------------------------------
// Implementation of a unix filesystem in memory.

"use strict";

var TAR = require('./tar');
var FSLoader = require('./fsloader');
var utils = require('../utils');
var bzip2 = require('../bzip2');
var marshall = require('../dev/virtio/marshall');
var UTF8 = require('../../lib/utf8');
var message = require('../messagehandler');
var LazyUint8Array = require("./lazyUint8Array");

var S_IRWXUGO = 0x1FF;
var S_IFMT = 0xF000;
var S_IFSOCK = 0xC000;
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
var STATUS_UNLINKED = 0x4;


function FS() {
    this.inodes = [];
    this.events = [];

    this.qidnumber = 0x0;
    this.filesinloadingqueue = 0;
    this.OnLoaded = function() {};

    this.tar = new TAR(this);
    this.fsloader = new FSLoader(this);
    this.userinfo = [];

    this.watchFiles = {};
    this.watchDirectories = {};

    message.Register("LoadFilesystem", this.LoadFilesystem.bind(this) );
    message.Register("MergeFile", this.MergeFile.bind(this) );
    message.Register("DeleteNode", this.DeleteNode.bind(this) );
    message.Register("DeleteDirContents", this.RecursiveDelete.bind(this) );
    message.Register("CreateDirectory", 
        function(newDirPath){
            var ids = this.SearchPath(newDirPath);
            if(ids.id == -1 && ids.parentid != -1)
                this.CreateDirectory(ids.name, ids.parentid);
        }.bind(this)
    );
    message.Register("Rename",
        function(info) {
            var oldNodeInfo = this.SearchPath(info.oldPath);
            var newNodeInfo = this.SearchPath(info.newPath);
            
            // old node DNE or new node has invalid directory path
            if(oldNodeInfo.id == -1 || newNodeInfo.parentid == -1) 
                return;
               
            if(newNodeInfo.id==-1){ //create
                //parent must be directory
                if(((this.inodes[newNodeInfo.parentid].mode)&S_IFMT) != S_IFDIR)
                    return;
                    
                this.Rename(this.inodes[oldNodeInfo.id].parentid, this.inodes[oldNodeInfo.id].name, 
                                newNodeInfo.parentid, newNodeInfo.name);
            }
            else { //overwrite 
                this.Rename(this.inodes[oldNodeInfo.id].parentid, this.inodes[oldNodeInfo.id].name, 
                                this.inodes[newNodeInfo.id].parentid, this.inodes[newNodeInfo.id].name);
            }                
        }.bind(this)
    );
    message.Register("WatchFile",
        function(file) {
            //message.Debug("watching file: " + file.name);
            this.watchFiles[file.name] = true;
        }.bind(this)
    );

    message.Register("WatchDirectory",
        function(file) {
            this.watchDirectories[file.name] = true;
        }.bind(this)
    );

    message.Register("ReadFile",
        function(file) {
            message.Send("ReadFile", (this.ReadFile.bind(this))(file));
        }.bind(this)
    );

    message.Register("tar",
        function(data) {
            message.Send("tar", this.tar.Pack(data));
        }.bind(this)
    );

    message.Register("sync",
        function(data) {
            message.Send("sync", this.tar.Pack(data));
        }.bind(this)
    );

    // root entry
    this.CreateDirectory("", -1);
}


// -----------------------------------------------------
FS.prototype.LoadFilesystem = function(userinfo)
{
    this.userinfo = userinfo;
    this.fsloader.LoadJSON(this.userinfo.basefsURL);
    this.OnLoaded = function() { // the basic filesystem is loaded, so download the rest
        if (this.userinfo.extendedfsURL) {
            this.fsloader.LoadJSON(this.userinfo.extendedfsURL);
        }
        for(var i=0; i<this.userinfo.lazyloadimages.length; i++) {
            this.LoadImage(this.userinfo.lazyloadimages[i]);
        }
    }.bind(this);

}

// -----------------------------------------------------

FS.prototype.AddEvent = function(id, OnEvent) {
    var inode = this.GetInode(id);
    if (inode.status == STATUS_OK) {
        OnEvent();
        return;
    }
    this.events.push({id: id, OnEvent: OnEvent});    
}

FS.prototype.HandleEvent = function(id) {

    if (this.filesinloadingqueue == 0) {
        this.OnLoaded();
        this.OnLoaded = function() {}
    }
    //message.Debug("number of events: " + this.events.length);
    var newevents = [];
    for(var i=0; i<this.events.length; i++) {
        if (this.events[i].id == id) {
            this.events[i].OnEvent();
        } else {
            newevents.push(this.events[i]);
        }
    }
    this.events = newevents;
}


// -----------------------------------------------------
FS.prototype.LoadImage = function(url)
{
    if (!url) return;
    //message.Debug("Load Image " + url);
/*
    if (typeof Worker !== 'undefined') {
        LoadBZIP2Resource(url, 
            function(m){ for(var i=0; i<m.size; i++) this.tar.Unpack(m.data[i]); }.bind(this), 
            function(e){message.Debug("Error: Could not load " + url + ". Skipping.");});
        return;
    }
*/
    utils.LoadBinaryResource(url,
    function(buffer){
        var buffer8 = new Uint8Array(buffer);
        if (buffer.byteLength == 0) return;
        bzip2.simple(buffer8, this.tar.Unpack.bind(this.tar));
    }.bind(this),
    function(error){
        message.Debug("Error: Could not load " + url + ". Skipping.");
    }.bind(this)
    );
}
// -----------------------------------------------------

FS.prototype.CheckEarlyload = function(path)
{
    for(var i=0; i<this.userinfo.earlyload.length; i++) {
        if (this.userinfo.earlyload[i] == path) {
            return true;
        }
    }
    return false;
}


// The filesystem is responsible to add the correct time. This is a hack
// Have to find a better solution.
FS.prototype.AppendDateHack = function(idx) {
    if (this.GetFullPath(idx) != "home/user/.profile") return;
    var inode = this.inodes[idx];
    var date = new Date();
    var datestring = 
        "\ndate -s \"" + 
        date.getUTCFullYear() + 
        "-" + 
        (date.getUTCMonth()+1) + 
        "-" + 
        date.getUTCDate() + 
        " " + 
        date.getUTCHours() +
        ":" + 
        date.getUTCMinutes() +
        ":" + 
        date.getUTCSeconds() +
        "\" &>/dev/null\n";
    var size = inode.size;
    this.ChangeSize(idx, size+datestring.length);
    for(var i=0; i<datestring.length; i++) {
        inode.data[i+size] = datestring.charCodeAt(i); 
    }
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

        var succfunction = 
        (function(idx){
            return function(buffer){
                var inode = this.GetInode(idx);
                var buffer8 = new Uint8Array(buffer);
                var ofs = 0;
                bzip2.simple(buffer8, function(x){inode.data[ofs++] = x;}.bind(this) );
                inode.status = STATUS_OK;
                this.filesinloadingqueue--;
                this.HandleEvent(idx);
            }.bind(this) 
        }.bind(this))(idx);

        utils.LoadBinaryResource(inode.url + ".bz2", 
        succfunction,
        function(error){throw error;});
        return;
    }

    if (inode.lazy) {
        message.Debug("Using lazy file for " + inode.url);
        inode.data = new LazyUint8Array(inode.url, inode.size);
        var old = inode.size;
        inode.size = inode.data.length;
        if (old != inode.size) message.Warning("Size wrong for lazy loaded file: " + inode.name);
        inode.status = STATUS_OK;
        this.filesinloadingqueue--;
        this.HandleEvent(idx);
        return;
    }

    var succfunction = 
    (function(idx){
        return function(buffer){
            var inode = this.GetInode(idx);
            inode.data = new Uint8Array(buffer);
            if (inode.size != inode.data.length) message.Warning("Size wrong for uncompressed non-lazily loaded file: " + inode.name);
            inode.size = inode.data.length; // correct size if the previous was wrong. 
            inode.status = STATUS_OK;            
            this.filesinloadingqueue--;
            this.HandleEvent(idx);            
        }.bind(this);
    }.bind(this))(idx);

    utils.LoadBinaryResource(inode.url, 
        succfunction,
        function(error){throw error;});

}

// -----------------------------------------------------

FS.prototype.PushInode = function(inode) {
    if (inode.parentid != -1) {
        this.inodes.push(inode);
        this.inodes[inode.parentid].updatedir = true;
        inode.nextid = this.inodes[inode.parentid].firstid;
        this.inodes[inode.parentid].firstid = this.inodes.length-1;
        return;
    } else {
        if (this.inodes.length == 0) { // if root directory
            this.inodes.push(inode);
            return;
        }
    }

    message.Debug("Error in Filesystem: Pushed inode with name = "+ inode.name + " has no parent");
    message.Abort();

}


FS.prototype.CreateInode = function() {
    this.qidnumber++;
    return {
        updatedir : false, // did the directory listing changed?
        parentid: -1,
        firstid : -1, // first file id in directory
        nextid : -1, // next id in directory
        status : 0,
        name : "",
        size : 0x0,
        uid : 0x0,
        gid : 0x0,
        ctime : Math.floor((new Date()).getTime()/1000),
        atime : Math.floor((new Date()).getTime()/1000),
        mtime : Math.floor((new Date()).getTime()/1000),
        major : 0x0,
        minor : 0x0,
        data : new Uint8Array(0),
        symlink : "",
        nlinks : 1,
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
    x.updatedir = true;
    x.nlinks = 2; // . and ..
    if (parentid >= 0) {
        x.uid = this.inodes[parentid].uid;
        x.gid = this.inodes[parentid].gid;
        x.mode = (this.inodes[parentid].mode & 0x1FF) | S_IFDIR;
        this.inodes[parentid].nlinks++;
    }
    x.qid.type = S_IFDIR >> 8;
    this.PushInode(x);
    this.NotifyListeners(this.inodes.length-1, 'newdir');
    return this.inodes.length-1;
}

FS.prototype.CreateFile = function(filename, parentid) {
    var x = this.CreateInode();
    x.name = filename;
    x.parentid = parentid;
    x.uid = this.inodes[parentid].uid;
    x.gid = this.inodes[parentid].gid;
    this.inodes[parentid].nlinks++;
    x.qid.type = S_IFREG >> 8;
    x.mode = (this.inodes[parentid].mode & 0x1B6) | S_IFREG;
    this.PushInode(x);
    this.NotifyListeners(this.inodes.length-1, 'newfile');
    return this.inodes.length-1;
}


FS.prototype.CreateNode = function(filename, parentid, major, minor) {
    var x = this.CreateInode();
    x.name = filename;
    x.parentid = parentid;
    x.major = major;
    x.minor = minor;
    x.uid = this.inodes[parentid].uid;
    x.gid = this.inodes[parentid].gid;
    this.inodes[parentid].nlinks++;
    x.qid.type = S_IFSOCK >> 8;
    x.mode = (this.inodes[parentid].mode & 0x1B6);
    this.PushInode(x);
    return this.inodes.length-1;
}
     
FS.prototype.CreateSymlink = function(filename, parentid, symlink) {
    var x = this.CreateInode();
    x.name = filename;
    x.parentid = parentid;
    x.uid = this.inodes[parentid].uid;
    x.gid = this.inodes[parentid].gid;
    this.inodes[parentid].nlinks++;
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
    var inode = this.GetInode(id);
    if ((inode.mode&S_IFMT) == S_IFDIR) {
        this.FillDirectory(id);
    }
    /*
    var type = "";
    switch(inode.mode&S_IFMT) {
        case S_IFREG: type = "File"; break;
        case S_IFBLK: type = "Block Device"; break;
        case S_IFDIR: type = "Directory"; break;
        case S_IFCHR: type = "Character Device"; break;
    }
    */
    //message.Debug("open:" + this.GetFullPath(id) +  " type: " + inode.mode + " status:" + inode.status);
    if (inode.status == STATUS_ON_SERVER) {
        this.LoadFile(id);
        return false;
    }

    if (inode.name == ".profile") {
        this.AppendDateHack(id);
    }

    return true;
}

FS.prototype.CloseInode = function(id) {
    //message.Debug("close: " + this.GetFullPath(id));
    var inode = this.GetInode(id);
    if (inode.status == STATUS_UNLINKED) {
        //message.Debug("Filesystem: Delete unlinked file");
        inode.status = STATUS_INVALID;
        inode.data = new Uint8Array(0);
        inode.size = 0;
    }
}

FS.prototype.Rename = function(olddirid, oldname, newdirid, newname) {
    // message.Debug("Rename " + oldname + " to " + newname);
    if ((olddirid == newdirid) && (oldname == newname)) {
        return true;
    }
    var oldid = this.Search(olddirid, oldname);
    var oldpath = this.GetFullPath(oldid);
    if (oldid == -1) {
        return false;
    }
    var newid = this.Search(newdirid, newname);
    if (newid != -1) {
        this.Unlink(newid);
    }

    var idx = oldid; // idx contains the id which we want to rename
    var inode = this.inodes[idx];

    // remove inode ids
    if (this.inodes[inode.parentid].firstid == idx) {
        this.inodes[inode.parentid].firstid = inode.nextid;
    } else {
        var id = this.FindPreviousID(idx);
        if (id == -1) {
            message.Debug("Error in Filesystem: Cannot find previous id of inode");
            message.Abort();
        }
        this.inodes[id].nextid = inode.nextid;
    }

    inode.parentid = newdirid;
    inode.name = newname;
    inode.qid.version++;

    inode.nextid = this.inodes[inode.parentid].firstid;
    this.inodes[inode.parentid].firstid = idx;

    this.inodes[olddirid].updatedir = true;
    this.inodes[newdirid].updatedir = true;
    this.inodes[olddirid].nlinks--;
    this.inodes[newdirid].nlinks++;

    this.NotifyListeners(idx, "rename", {oldpath: oldpath});
    
    return true;
}

FS.prototype.Write = function(id, offset, count, GetByte) {
    this.NotifyListeners(id, 'write');
    var inode = this.inodes[id];

    if (inode.data.length < (offset+count)) {
        this.ChangeSize(id, Math.floor(((offset+count)*3)/2) );
        inode.size = offset + count;
    } else
    if (inode.size < (offset+count)) {
        inode.size = offset + count;
    }
    if (inode.data instanceof Uint8Array)
        for(var i=0; i<count; i++)
            inode.data[offset+i] = GetByte();
    else
        for(var i=0; i<count; i++)
            inode.data.Set(offset+i, GetByte());
}

FS.prototype.Search = function(parentid, name) {
    var id = this.inodes[parentid].firstid;
    while(id != -1) {
        if (this.inodes[id].parentid != parentid) { // consistency check
            message.Debug("Error in Filesystem: Found inode with wrong parent id");
        }
        if (this.inodes[id].name == name) return id;
        id = this.inodes[id].nextid;
    }
    return -1;
}

FS.prototype.GetTotalSize = function() {
    var size = 0;
    for(var i=0; i<this.inodes.length; i++) {
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

// no double linked list. So, we need this
FS.prototype.FindPreviousID = function(idx) {
    var inode = this.GetInode(idx);
    var id = this.inodes[inode.parentid].firstid;
    while(id != -1) {
        if (this.inodes[id].nextid == idx) return id;
        id = this.inodes[id].nextid;
    }
    return id;
}

FS.prototype.Unlink = function(idx) {
    this.NotifyListeners(idx, 'delete');
    if (idx == 0) return false; // root node cannot be deleted
    var inode = this.GetInode(idx);
    //message.Debug("Unlink " + inode.name);

    // check if directory is not empty
    if ((inode.mode&S_IFMT) == S_IFDIR) {
       if (inode.firstid != -1) return false;
    }

    // update ids
    if (this.inodes[inode.parentid].firstid == idx) {
        this.inodes[inode.parentid].firstid = inode.nextid;
    } else {
        var id = this.FindPreviousID(idx);
        if (id == -1) {
            message.Debug("Error in Filesystem: Cannot find previous id of inode");
            message.Abort();
        }
        this.inodes[id].nextid = inode.nextid;
    }
    // don't delete the content. The file is still accessible
    this.inodes[inode.parentid].updatedir = true;
    this.inodes[inode.parentid].nlinks--;
    inode.status = STATUS_UNLINKED;
    inode.nextid = -1;
    inode.firstid = -1;
    inode.parentid = -1;
    inode.nlinks--;
    return true;
}

FS.prototype.GetInode = function(idx)
{
    if (isNaN(idx)) {
        message.Debug("Error in filesystem: id is not a number ");
        return 0;
    }

    if ((idx < 0) || (idx > this.inodes.length)) {
        message.Debug("Error in filesystem: Attempt to get inode with id " + idx);
        return 0;
    }
    return this.inodes[idx];
}

FS.prototype.ChangeSize = function(idx, newsize)
{
    var inode = this.GetInode(idx);
    //message.Debug("change size to: " + newsize);
    if (newsize == inode.size) return;
    var temp = new Uint8Array(newsize);
    inode.size = newsize;
    var size = Math.min(inode.data.length, inode.size);
    for(var i=0; i<size; i++) {
        temp[i] = this.ReadByte(inode, i);
    }
    inode.data = temp;
}

FS.prototype.ReadByte = function(inode, idx) {
    if (inode.data instanceof Uint8Array) {
        return inode.data[idx];
    } else {
        return inode.data.Get(idx);
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
    var id = this.inodes[dirid].firstid;
    while(id != -1) {
        list.push(id);
        if ((this.inodes[id].mode&S_IFMT) == S_IFDIR) {
            this.GetRecursiveList(id, list);
        }
        id = this.inodes[id].nextid;
    }
}

FS.prototype.ReadFile = function(file) {
    //message.Debug("Read path:" + file.name);
    var ids = this.SearchPath(file.name);
    if (ids.parentid == -1) return; // not even the path seems to exist
    if (ids.id == -1) {
      return null;
    }
    file.data = this.inodes[ids.id].data;
    file.size = this.inodes[ids.id].size;
    return file;
}

FS.prototype.MergeFile = function(file) {
    message.Debug("Merge path:" + file.name);
    var ids = this.SearchPath(file.name);
    if (ids.parentid == -1) return; // not even the path seems to exist
    if (ids.id == -1) {
        ids.id = this.CreateFile(ids.name, ids.parentid); 
    }
    this.inodes[ids.id].data = file.data;
    this.inodes[ids.id].size = file.data.length;
    // Don't forget to update the timestamps !
    this.inodes[ids.id].mtime = Math.floor((new Date()).getTime()/1000);
    this.inodes[ids.id].atime = this.inodes[ids.id].mtime;
    this.inodes[ids.id].ctime = this.inodes[ids.id].mtime;
}


FS.prototype.RecursiveDelete = function(path) {
    var toDelete = []
    var ids = this.SearchPath(path);
    if (ids.parentid == -1 || ids.id == -1) return;
    
    this.GetRecursiveList(ids.id, toDelete);

    for(var i=toDelete.length-1; i>=0; i--)
        this.Unlink(toDelete[i]);

}

FS.prototype.DeleteNode = function(path) {
    var ids = this.SearchPath(path);
    if (ids.parentid == -1 || ids.id == -1) return;
    
    if ((this.inodes[ids.id].mode&S_IFMT) == S_IFREG){
        this.Unlink(ids.id);
        return;
    }
    if ((this.inodes[ids.id].mode&S_IFMT) == S_IFDIR){
        var toDelete = []
        this.GetRecursiveList(ids.id, toDelete);
        for(var i=toDelete.length-1; i>=0; i--)
            this.Unlink(toDelete[i]);
        this.Unlink(ids.id);
        return;
    }
}

FS.prototype.NotifyListeners = function(id, action, info) {
    if(info==undefined)
        info = {};

    var path = this.GetFullPath(id);
    if (this.watchFiles[path] == true && action=='write') {
      message.Send("WatchFileEvent", path);
    }
    for (var directory in this.watchDirectories) {
        if (this.watchDirectories.hasOwnProperty(directory)) {
            var indexOf = path.indexOf(directory)
            if(indexOf == 0 || indexOf == 1)
                message.Send("WatchDirectoryEvent", {path: path, event: action, info: info});         
        }
    }
}

FS.prototype.Check = function() {
    for(var i=1; i<this.inodes.length; i++)
    {
        if (this.inodes[i].status == STATUS_INVALID) continue;
        if (this.inodes[i].nextid == i) {
            message.Debug("Error in filesystem: file points to itself");
            message.Abort();
        }

        var inode = this.GetInode(i);
        if (inode.parentid < 0) {
            message.Debug("Error in filesystem: negative parent id " + i);
        }
        var n = inode.name.length;
        if (n == 0) {
            message.Debug("Error in filesystem: inode with no name and id " + i);
        }

        for (var j in inode.name) {
            var c = inode.name.charCodeAt(j);
            if (c < 32) {
                message.Debug("Error in filesystem: Unallowed char in filename");
            } 
        }
    }
}

FS.prototype.FillDirectory = function(dirid) {
    var inode = this.GetInode(dirid);
    if (!inode.updatedir) return;
    var parentid = inode.parentid;
    if (parentid == -1) parentid = 0; // if root directory point to the root directory

    // first get size
    var size = 0;
    var id = this.inodes[dirid].firstid;
    while(id != -1) {
        size += 13 + 8 + 1 + 2 + UTF8.UTF8Length(this.inodes[id].name);
        id = this.inodes[id].nextid;
    }

    size += 13 + 8 + 1 + 2 + 1; // "." entry
    size += 13 + 8 + 1 + 2 + 2; // ".." entry
    //message.Debug("size of dir entry: " + size);
    inode.data = new Uint8Array(size);
    inode.size = size;

    var offset = 0x0;
    offset += marshall.Marshall(
        ["Q", "d", "b", "s"],
        [this.inodes[dirid].qid, 
        offset+13+8+1+2+1, 
        this.inodes[dirid].mode >> 12, 
        "."],
        inode.data, offset);

    offset += marshall.Marshall(
        ["Q", "d", "b", "s"],
        [this.inodes[parentid].qid,
        offset+13+8+1+2+2, 
        this.inodes[parentid].mode >> 12, 
        ".."],
        inode.data, offset);

    var id = this.inodes[dirid].firstid;
    while(id != -1) {
        offset += marshall.Marshall(
        ["Q", "d", "b", "s"],
        [
            this.inodes[id].qid,
            offset+13+8+1+2+UTF8.UTF8Length(this.inodes[id].name),
            this.inodes[id].mode >> 12,
            this.inodes[id].name
        ],
        inode.data, offset);
        id = this.inodes[id].nextid;
    }
    inode.updatedir = false;
}


// -----------------------------------------------------

// only support for security.capabilities
// should return a  "struct vfs_cap_data" defined in
// linux/capability for format
// check also:
//   sys/capability.h
//   http://lxr.free-electrons.com/source/security/commoncap.c#L376
//   http://man7.org/linux/man-pages/man7/capabilities.7.html
//   http://man7.org/linux/man-pages/man8/getcap.8.html
//   http://man7.org/linux/man-pages/man3/libcap.3.html
FS.prototype.PrepareCAPs = function(id) {
    var inode = this.GetInode(id);
    if (inode.caps) return inode.caps.length;
    inode.caps = new Uint8Array(12);
    // format is little endian
    // magic_etc (revision=0x01: 12 bytes)
    inode.caps[0]  = 0x00;
    inode.caps[1]  = 0x00;
    inode.caps[2]  = 0x00;
    inode.caps[3]  = 0x01;
    // permitted (full capabilities)
    inode.caps[4]  = 0xFF;
    inode.caps[5]  = 0xFF;
    inode.caps[6]  = 0xFF;
    inode.caps[7]  = 0xFF;
    // inheritable (full capabilities
    inode.caps[8]  = 0xFF;
    inode.caps[9]  = 0xFF;
    inode.caps[10] = 0xFF;
    inode.caps[11] = 0xFF;

    return inode.caps.length;
}


module.exports = FS;
