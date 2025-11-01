export default Virtio9p;
declare function Virtio9p(ramdev: any, filesystem: any): void;
declare class Virtio9p {
    constructor(ramdev: any, filesystem: any);
    fs: any;
    SendReply: () => void;
    deviceid: number;
    hostfeature: number;
    configspace: number[];
    VERSION: string;
    BLOCKSIZE: number;
    msize: number;
    replybuffer: Uint8Array<ArrayBuffer>;
    replybuffersize: number;
    Createfid(inode: any, type: any, uid: any): {
        inodeid: any;
        type: any;
        uid: any;
    };
    Reset(): void;
    fids: any[];
    BuildReply(id: any, tag: any, payloadsize: any): void;
    SendError(tag: any, errormsg: any, errorcode: any): void;
    ReceiveRequest(ringidx: any, index: any, GetByte: any): void;
}
//# sourceMappingURL=9p.d.ts.map