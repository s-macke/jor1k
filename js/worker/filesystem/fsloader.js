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

FSLoader.prototype.HandleDirContents = function(list, parentid) {
    for (var i in list) {
         var tag = list[i];

         var id = this.fs.Search(parentid, tag.name);
         if (id != -1) {
             if (!tag.path && !tag.size) {
                 if (tag.child) this.HandleDirContents(tag.child, id);
                 continue;
             } else {
                 message.Debug("Overwriting non-directory!");
             }
         }

         var inode = this.fs.CreateInode();
         inode.name = tag.name;
         inode.uid = tag.uid|0;
         inode.gid = tag.gid|0;
         inode.parentid = parentid;
         inode.mode = parseInt(tag.mode, 8);

         if (tag.path) { // link
             inode.mode = S_IFLNK | S_IRWXUGO;
             inode.symlink = tag.path;
             this.fs.PushInode(inode);
         } else if (!tag.size) { // dir
             inode.mode |= S_IFDIR;
             inode.updatedir = true;
             this.fs.PushInode(inode);
             if (tag.child)
                 this.HandleDirContents(tag.child, id != -1 ? id : this.fs.inodes.length-1);
         } else { // file
             if (tag.lazy) inode.lazy = tag.lazy;
             inode.mode |= S_IFREG;
             var idx = this.fs.inodes.length;
             inode.status = STATUS_ON_SERVER;
             inode.compressed = !!tag.c;
             inode.size = tag.size|0;
             this.fs.PushInode(inode);
             var url = this.sysrootdir + (!tag.src?this.fs.GetFullPath(idx):tag.src);
             inode.url = url;
             //message.Debug("Load id=" + (idx) + " " + url);
             if (tag.load || this.fs.CheckEarlyload(this.fs.GetFullPath(idx)) ) {
                 this.fs.LoadFile(idx);
             }
         }
    }
}

FSLoader.prototype.OnJSONLoaded = function(fsxml)
{
    var t = JSON.parse(fsxml);

    this.sysrootdir = t.src;
    if (String(this.sysrootdir) !== this.sysrootdir) message.Debug("No sysroot (src tag)!");
    this.sysrootdir += "/";

    this.HandleDirContents(t.fs, 0);

    message.Debug("processed " + this.fs.inodes.length + " inodes");
    this.fs.Check();
}

FSLoader.prototype.LoadJSON = function(url)
{
    message.Debug("Load filesystem information from " + url);
    utils.LoadTextResource(url, this.OnJSONLoaded.bind(this), function(error){throw error;});
}

module.exports = FSLoader;
