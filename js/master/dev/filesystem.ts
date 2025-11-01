import message from '../messagehandler.js';
import download from '../../lib/download.js';
import * as utils from '../utils.js';

"use strict";

class Filesystem {
    syncURL: string;
    userid: string;

    constructor(syncURL: string, userid: string) {
        this.syncURL = syncURL;
        this.userid = userid;
    }

    TAR(path: string): void {
        if (path == "") {
            path = "/home/user";
        }
        const arrayPath = path.split('/');
        message.Register("tar", (d: unknown) => {
            // Type guard: ensure d is ArrayBuffer
            if (!(d instanceof ArrayBuffer)) {
                console.error("Expected ArrayBuffer for tar data");
                return;
            }
            // Convert ArrayBuffer to Blob for download
            const blob = new Blob([d], { type: "application/x-tar" });
            download(blob, arrayPath[arrayPath.length - 1] + ".tar", "application/x-tar");
        });
        message.Send("tar", path);
    }

    Sync(path: string): void {
        message.Register("sync", (d: unknown) => {
            if (!(d instanceof ArrayBuffer)) {
                console.error("Expected ArrayBuffer for sync data");
                return;
            }
            this.OnSync(d);
        });
        message.Send("sync", path);
    }

    OnSync(d: ArrayBuffer): void {
        const data = new Uint8Array(d);
        utils.UploadBinaryResource(this.syncURL, this.userid + ".tar", data,
            (response: string) => {
                alert(
                    "Message from Server:" + response + "\n" +
                    "The home folder '/home/user' has been synced with the server\n" +
                    "In order to access the data at a later date,\n" +
                    "start the next session with the current url with the user id\n" +
                    "The folder size is currently limited to 1MB. Note that the feature is experimental.\n" +
                    "The content can be downloaded under http://jor1k.com/sync/tarballs/" + this.userid + ".tar.bz2"
                );
            },
            (msg: string) => { alert(msg); }
        );
    }

    UploadExternalFile(path: string, f: File): void {
        const reader = new FileReader();
        if (path.slice(-1) != '/') {
            path += '/';
        }
        reader.onload = (_e: ProgressEvent<FileReader>) => {
            message.Send("MergeFile",
                { name: path + f.name, data: new Uint8Array(reader.result as ArrayBuffer) });
        };
        reader.readAsArrayBuffer(f);
    }

    MergeFile(fileName: string, data: string): void {
        function stringToUint(string: string): Uint8Array {
            const charList = string.split('');
            const uintArray: number[] = [];
            for (let i = 0; i < charList.length; i++) {
                uintArray.push(charList[i].charCodeAt(0));
            }
            return new Uint8Array(uintArray);
        }
        message.Send("MergeFile", { name: fileName, data: stringToUint(data) });
    }

    MergeBinaryFile(fileName: string, data: Uint8Array): void {
        message.Send("MergeFile", { name: fileName, data: data });
    }

    CreateDirectory(directoryName: string): void {
        message.Send("CreateDirectory", directoryName);
    }

    ReadFile(fileName: string, callback: (data: any) => void): void {
        message.Register("ReadFile", callback);
        message.Send("ReadFile", { name: fileName });
    }

    //deletes contents of specified directory.
    DeleteDirContents(dirPath: string): void {
        message.Send("DeleteDirContents", dirPath);
    }

    //deletes file, recursively deletes dir
    DeleteNode(nodeName: string): void {
        message.Send("DeleteNode", nodeName);
    }

    Rename(oldPath: string, newPath: string): void {
        message.Send("Rename", { oldPath: oldPath, newPath: newPath });
    }

    WatchFile(fileName: string, callback: (data: any) => void): void {
        message.Register("WatchFileEvent", callback);
        message.Send("WatchFile", { name: fileName });
    }

    WatchDirectory(directoryPath: string, callback: (data: any) => void): void {
        message.Register("WatchDirectoryEvent", callback);
        message.Send("WatchDirectory", { name: directoryPath });
    }
}

export default Filesystem;
