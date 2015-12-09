var message = require('../messagehandler');
var download = require('../../lib/download');
var utils = require('../utils');

"use strict";

function Filesystem(syncURL, userid) {
    this.syncURL = syncURL;
    this.userid = userid;
}

Filesystem.prototype.TAR = function(path) {
    message.Register("tar", function(d){download(d, "user.tar", "application/x-tar");} );
    message.Send("tar", path);
}

Filesystem.prototype.Sync = function(path) {
    message.Register("sync", this.OnSync.bind(this));
    message.Send("sync", path);
}

Filesystem.prototype.OnSync = function(d) {
    utils.UploadBinaryResource(this.syncURL, this.userid + ".tar", d,
        function(response) {
            alert(
                "Message from Server:" + response + "\n" +
                "The home folder '/home/user' has been synced with the server\n" +
                "In order to access the data at a later date,\n" +
                "start the next session with the current url with the user id\n" +
                "The folder size is currently limited to 1MB. Note that the feature is experimental.\n" +
                "The content can be downloaded under http://jor1k.com/sync/tarballs/" + this.userid+".tar.bz2"
            );
            }.bind(this),
        function(msg) {alert(msg);}
    );
}

Filesystem.prototype.UploadExternalFile = function(f) {
    var reader = new FileReader();
    reader.onload = function(e) {
        message.Send("MergeFile",
        {name: "home/user/"+f.name, data: new Uint8Array(reader.result)});
    }.bind(this);
    reader.readAsArrayBuffer(f);
}

Filesystem.prototype.MergeFile = function(fileName, data) {
  function stringToUint(string) {
    var charList = string.split(''),
        uintArray = [];
    for (var i = 0; i < charList.length; i++) {
        uintArray.push(charList[i].charCodeAt(0));
    }
    return new Uint8Array(uintArray);
  }
  message.Send("MergeFile", {name: fileName, data: stringToUint(data)});
}

Filesystem.prototype.MergeBinaryFile = function(fileName, data) {
  message.Send("MergeFile", {name: fileName, data: data});
}

Filesystem.prototype.CreateDirectory = function(dirctoryName) {
    message.Send("CreateDirectory", dirctoryName );
}

Filesystem.prototype.ReadFile = function(fileName, callback) {
  message.Register("ReadFile", callback);
  message.Send("ReadFile", { name: fileName });
}

//deletes contents of specified directory.
Filesystem.prototype.DeleteDirContents = function(dirPath) {
    message.Send("DeleteDirContents", dirPath);
}

//deletes file, recursively deletes dir
Filesystem.prototype.DeleteNode = function(nodeName) {
    message.Send("DeleteNode", nodeName);
}

Filesystem.prototype.Rename = function(oldPath, newPath) {
    message.Send("Rename", {oldPath:oldPath, newPath: newPath});
}

Filesystem.prototype.WatchFile = function(fileName, callback) {
  message.Register("WatchFileEvent", callback);
  message.Send("WatchFile", { name: fileName });
}

Filesystem.prototype.WatchDirectory = function(directoryPath, callback) {
  message.Register("WatchDirectoryEvent", callback);
  message.Send("WatchDirectory", { name: directoryPath });
}

module.exports = Filesystem;
