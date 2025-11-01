export default VirtioNET;
declare function VirtioNET(ramdev: any): void;
declare class VirtioNET {
    constructor(ramdev: any);
    configspace: number[];
    deviceid: number;
    hostfeature: number;
    replybuffer: Uint8Array<ArrayBuffer>;
    replybuffersize: number;
    Reset(): void;
    receivebufferdesc: any[];
    receivebuffer: any[];
    Receive(buffer: any): void;
    HandleReceive(): void;
    ReceiveRequest(queueidx: any, index: any, GetByte: any, size: any): void;
}
//# sourceMappingURL=net.d.ts.map