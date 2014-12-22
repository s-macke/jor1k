// -------------------------------------------------
// ------------- FILESYSTEM LOADER -----------------
// -------------------------------------------------

"use strict";

var message = require('../messagehandler');
var utils = require('../utils');

var S_IRWXUGO = 0x1FF;
var S_IFMT = 0xF000;
var S_IFSOCK = 0xC000;
var S_IFLNK = 0xA000;
var S_IFREG = 0x8000;
var S_IFBLK = 0x6000;
var S_IFDIR = 0x4000;
var S_IFCHR = 0x2000;

var STATUS_INVALID = -0x1;
var STATUS_OK = 0x0;
var STATUS_OPEN = 0x1;
var STATUS_ON_SERVER = 0x2;
var STATUS_LOADING = 0x3;
var STATUS_UNLINKED = 0x4;

function FSLoader(filesystem) {
    this.fs = filesystem;
}

FSLoader.prototype.ReadVariable = function(buffer, offset) {
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
    //message.Debug("read " + variable.name + "=" + variable.value);
    return variable;
}

FSLoader.prototype.ReadTag = function(buffer, offset) {
    var tag = [];
    tag.type = "";
    tag.name = "";
    tag.mode = 0x0;
    tag.uid = 0x0;
    tag.gid = 0x0;
    tag.path = "";
    tag.src = "";
    tag.compressed = false;
    tag.load = false;

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
        var variable = this.ReadVariable(buffer, offset);
        if (variable.name == "name") tag.name = variable.value;
        if (variable.name == "mode") tag.mode = parseInt(variable.value, 8);
        if (variable.name == "uid") tag.uid = parseInt(variable.value, 10);
        if (variable.name == "gid") tag.gid = parseInt(variable.value, 10);
        if (variable.name == "path") tag.path = variable.value;
        if (variable.name == "size") tag.size = parseInt(variable.value, 10);
        if (variable.name == "src") tag.src = variable.value;
        if (variable.name == "compressed") tag.compressed = true;
        if (variable.name == "load") tag.load = true;
        offset = variable.offset;
    } while(variable.name.length != 0);
    return tag;
};


FSLoader.prototype.OnXMLLoaded = function(fsxml)
{
    // At this point I realized, that the dom is not available in worker threads and that I cannot get the xml information directly.
    // So let's analyze ourself
    var sysrootdir = "";

    var parentid = 0;
    for(var i=0; i<fsxml.length; i++)
    {
        if (fsxml[i] != '<') continue;
        var tag = this.ReadTag(fsxml, i, ' ');
        var id = this.fs.Search(parentid, tag.name);
        if (id != -1) {
            if (tag.type == "Dir") parentid = id;             
            continue;
        }
        var inode = this.fs.CreateInode();
        inode.name = tag.name;
        inode.uid = tag.uid;
        inode.gid = tag.gid;
        inode.parentid = parentid;
        inode.mode = tag.mode;
        
        var size = tag.size;

    switch(tag.type) {
    case "FS":
        sysrootdir = "" + tag.src + "/";
        break;

    case "Dir":
        inode.mode |= S_IFDIR;
        inode.updatedir = true;
        parentid = this.fs.inodes.length;
        this.fs.PushInode(inode);
        break;

   case "/Dir":
        parentid = this.fs.inodes[parentid].parentid;
        break;

   case "File":
        inode.mode |= S_IFREG;
        var idx = this.fs.inodes.length;
        inode.status = STATUS_ON_SERVER;
        inode.compressed = tag.compressed;
        inode.size = size;
        this.fs.PushInode(inode);
        var url = sysrootdir + (tag.src.length==0?this.fs.GetFullPath(idx):tag.src);
        inode.url = url;
        //message.Debug("Load id=" + (idx) + " " + url);
        if (tag.load || this.fs.CheckEarlyload(this.fs.GetFullPath(idx)) ) {
            this.fs.LoadFile(idx);
        }
        break;

    case "Link":
        inode.mode = S_IFLNK | S_IRWXUGO;
        inode.symlink = tag.path;
        this.fs.PushInode(inode);
        break;
        }
    }
    message.Debug("processed " + this.fs.inodes.length + " inodes");
    this.fs.Check();
}

FSLoader.prototype.LoadXML = function(url)
{
    message.Debug("Load filesystem information from " + url);
    utils.LoadXMLResource(url, this.OnXMLLoaded.bind(this), function(error){throw error;});
}


module.exports = FSLoader;
