export default ROMDev;
declare function ROMDev(rom: any): void;
declare class ROMDev {
    constructor(rom: any);
    rom: any;
    buffer32view: Int32Array<any>;
    buffer16view: Int16Array<any>;
    buffer8view: Int8Array<any>;
    Reset(): void;
    ReadReg32(addr: any): number;
    ReadReg16(addr: any): number;
    ReadReg8(addr: any): number;
}
//# sourceMappingURL=rom.d.ts.map