export type MessageType = 'WorkerReady' | 'LoadAndStart' | 'execute' | 'Init' | 'InitDone' | 'Reset' | 'GetIPS' | 'GetFB' | 'sound' | 'sound.rate' | 'Debug' | 'Abort' | 'PrintOnAbort' | 'WorkingPath' | 'LoadFilesystem' | 'MergeFile' | 'ReadFile' | 'WatchFile' | 'WatchFileEvent' | 'WatchDirectory' | 'WatchDirectoryEvent' | 'DeleteNode' | 'DeleteDirContents' | 'CreateDirectory' | 'Rename' | 'tar' | 'sync' | 'tty0' | 'tty1' | 'htif.term0.Transfer' | 'ethmac' | 'keydown' | 'keyup' | 'keypress' | 'tsmousedown' | 'tsmouseup' | 'tsmousemove' | 'virtio.kbd.keydown' | 'virtio.kbd.keyup';
export interface MessageHandler {
    Send(command: MessageType, data: any): void;
    Register(command: MessageType, handler: (data: any) => void): void;
    SetWorker?(worker: Worker): void;
    Debug(message: string): void;
    Warning(message: string): void;
    Error(message: string): void;
    Abort(): void;
    GetWorkingPath?(): string;
}
export interface WorkerMessage {
    command: MessageType;
    data: any;
}
export interface KeyboardEventData {
    keyCode: number;
    charCode: number;
}
export interface MouseEventData {
    x: number;
    y: number;
    button: number;
}
export interface SystemInitData {
    arch: 'or1k' | 'riscv';
    cpu: 'asm' | 'safe' | 'dynamic' | 'wasm' | 'smp';
    memorysize: number;
    ncores: number;
    kernelURL: string;
    dtbURL?: string;
}
export interface FilesystemLoadData {
    path?: string;
    basefsURL: string;
    extendedfsURL?: string;
    earlyload: string[];
    lazyloadimages: string[];
}
export interface TypedMessageHandler {
    Send<T extends MessageType>(command: T, data: MessageDataMap[T]): void;
    Register<T extends MessageType>(command: T, handler: (data: MessageDataMap[T]) => void): void;
}
export interface FileData {
    name: string;
    data?: Uint8Array;
}
export interface DirectoryData {
    path: string;
}
export interface RenameData {
    oldPath: string;
    newPath: string;
}
export interface MessageDataMap {
    'WorkerReady': null;
    'LoadAndStart': string | ArrayBuffer;
    'execute': number;
    'Init': SystemInitData;
    'InitDone': null;
    'Reset': null;
    'GetIPS': number;
    'GetFB': ArrayBuffer;
    'sound': ArrayBuffer;
    'sound.rate': number;
    'Debug': string;
    'Abort': object;
    'PrintOnAbort': null;
    'WorkingPath': string;
    'LoadFilesystem': FilesystemLoadData;
    'MergeFile': FileData;
    'ReadFile': FileData;
    'WatchFile': FileData;
    'WatchFileEvent': string;
    'WatchDirectory': FileData;
    'WatchDirectoryEvent': string;
    'DeleteNode': string;
    'DeleteDirContents': string;
    'CreateDirectory': DirectoryData | string;
    'Rename': RenameData;
    'tar': string | ArrayBuffer;
    'sync': string | ArrayBuffer;
    'tty0': number[];
    'tty1': number[];
    'htif.term0.Transfer': number[];
    'ethmac': ArrayBuffer;
    'keydown': KeyboardEventData;
    'keyup': KeyboardEventData;
    'keypress': KeyboardEventData;
    'tsmousedown': MouseEventData;
    'tsmouseup': MouseEventData;
    'tsmousemove': MouseEventData;
    'virtio.kbd.keydown': KeyboardEventData;
    'virtio.kbd.keyup': KeyboardEventData;
}
//# sourceMappingURL=messages.d.ts.map