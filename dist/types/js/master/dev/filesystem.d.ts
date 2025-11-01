declare class Filesystem {
    syncURL: string;
    userid: string;
    constructor(syncURL: string, userid: string);
    TAR(path: string): void;
    Sync(path: string): void;
    OnSync(d: ArrayBuffer): void;
    UploadExternalFile(path: string, f: File): void;
    MergeFile(fileName: string, data: string): void;
    MergeBinaryFile(fileName: string, data: Uint8Array): void;
    CreateDirectory(directoryName: string): void;
    ReadFile(fileName: string, callback: (data: any) => void): void;
    DeleteDirContents(dirPath: string): void;
    DeleteNode(nodeName: string): void;
    Rename(oldPath: string, newPath: string): void;
    WatchFile(fileName: string, callback: (data: any) => void): void;
    WatchDirectory(directoryPath: string, callback: (data: any) => void): void;
}
export default Filesystem;
//# sourceMappingURL=filesystem.d.ts.map