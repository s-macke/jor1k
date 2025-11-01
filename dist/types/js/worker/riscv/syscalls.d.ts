export default SysCalls;
declare function SysCalls(ram: any): void;
declare class SysCalls {
    constructor(ram: any);
    ram: any;
    elf8mem: any[];
    file_descriptor_table: any[];
    file_size: any[];
    file_pointer: any[];
    file_descriptor_offset: number;
    elf8mem_offset: number;
    HandleSysCall(addr: any): void;
    OnFileLoaded(buffer: any): void;
}
//# sourceMappingURL=syscalls.d.ts.map