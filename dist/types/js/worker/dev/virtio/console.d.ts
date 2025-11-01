export default VirtioConsole;
declare function VirtioConsole(ramdev: any): void;
declare class VirtioConsole {
    constructor(ramdev: any);
    configspace: number[];
    deviceid: number;
    hostfeature: number;
    replybuffersize: number;
    replybuffer: Uint8Array<ArrayBuffer>;
    Receive(chars: any): void;
    Reset(): void;
    ReceiveRequest(queueidx: any, index: any, GetByte: any, size: any): void;
}
//# sourceMappingURL=console.d.ts.map