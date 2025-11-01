export default VirtioInput;
declare function VirtioInput(ramdev: any): void;
declare class VirtioInput {
    constructor(ramdev: any);
    configspace: Uint8Array<ArrayBuffer>;
    deviceid: number;
    hostfeature: number;
    replybuffersize: number;
    replybuffer: Uint8Array<ArrayBuffer>;
    Reset(): void;
    receivebufferdesc: any[];
    OnKeyDown(event: any): void;
    OnKeyUp(event: any): void;
    WriteConfig(addr: any, val: any): void;
    ReceiveRequest(queueidx: any, index: any, GetByte: any, size: any): void;
}
//# sourceMappingURL=input.d.ts.map