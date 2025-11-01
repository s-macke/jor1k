export default VirtioBlock;
declare function VirtioBlock(ramdev: any): void;
declare class VirtioBlock {
    constructor(ramdev: any);
    blocks: number;
    configspace: number[];
    deviceid: number;
    hostfeature: number;
    replybuffer: Uint8Array<ArrayBuffer>;
    replybuffersize: number;
    buffer: Uint8Array<ArrayBuffer>;
    Reset(): void;
    ReceiveRequest(queueidx: any, index: any, GetByte: any, size: any): void;
}
//# sourceMappingURL=block.d.ts.map