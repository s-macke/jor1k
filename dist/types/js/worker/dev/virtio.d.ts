export default VirtIODev;
declare function VirtIODev(intdev: any, intno: any, ramdev: any, device: any): void;
declare class VirtIODev {
    constructor(intdev: any, intno: any, ramdev: any, device: any);
    dev: any;
    intdev: any;
    intno: any;
    ramdev: any;
    queuenum: Uint32Array<ArrayBuffer>;
    queueready: Uint32Array<ArrayBuffer>;
    queuepfn: Uint32Array<ArrayBuffer>;
    descaddr: Uint32Array<ArrayBuffer>;
    usedaddr: Uint32Array<ArrayBuffer>;
    availaddr: Uint32Array<ArrayBuffer>;
    lastavailidx: Uint32Array<ArrayBuffer>;
    version: number;
    Reset(): void;
    status: any;
    intstatus: number;
    pagesize: any;
    align: any;
    availidx: number;
    hostfeaturewordselect: any;
    queuesel: any;
    UpdateAddr(): void;
    ReadReg8(addr: any): any;
    ReadReg16(addr: any): number;
    WriteReg8(addr: any, value: any): void;
    ReadReg32(addr: any): number;
    GetDescriptor(queueidx: any, index: any): {
        addr: any;
        len: any;
        flags: any;
        next: any;
    };
    ConsumeDescriptor(queueidx: any, descindex: any, desclen: any): void;
    SendReply(queueidx: any, index: any): void;
    GetDescriptorBufferSize(queueidx: any, index: any): {
        write: number;
        read: number;
    };
    WriteReg32(addr: any, val: any): void;
}
//# sourceMappingURL=virtio.d.ts.map