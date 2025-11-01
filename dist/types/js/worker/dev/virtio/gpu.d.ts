export default VirtioGPU;
declare function VirtioGPU(ramdev: any): void;
declare class VirtioGPU {
    constructor(ramdev: any);
    configspace: number[];
    deviceid: number;
    hostfeature: number;
    replybuffersize: number;
    replybuffer: Uint8Array<ArrayBuffer>;
    Reset(): void;
    resource: any[];
    ReplyOk(index: any): void;
    ReceiveRequest(queueidx: any, index: any, GetByte: any, size: any): void;
}
//# sourceMappingURL=gpu.d.ts.map