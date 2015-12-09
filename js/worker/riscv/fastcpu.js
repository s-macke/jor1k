// -------------------------------------------------
// -------------------- CPU ------------------------
// -------------------------------------------------
var message = require('../messagehandler');
var utils = require('../utils');
var DebugIns = require('./disassemble');


// constructor
function FastCPU(stdlib, foreign, heap) {
"use asm";

var DebugMessage = foreign.DebugMessage;
var abort = foreign.abort;
var Read32 = foreign.Read32;
var Write32 = foreign.Write32;
var Read16 = foreign.Read16;
var Write16 = foreign.Write16;
var Read8 = foreign.Read8;
var Write8 = foreign.Write8;
var ReadDEVCMDToHost = foreign.ReadDEVCMDToHost;
var ReadDEVCMDFromHost = foreign.ReadDEVCMDFromHost;
var WriteDEVCMDToHost = foreign.WriteDEVCMDToHost;
var WriteDEVCMDFromHost = foreign.WriteDEVCMDFromHost;
var ReadToHost = foreign.ReadToHost;
var ReadFromHost = foreign.ReadFromHost;
var WriteToHost = foreign.WriteToHost;
var WriteFromHost = foreign.WriteFromHost;
var imul = foreign.imul;
var MathAbs = stdlib.Math.abs;
var floor = stdlib.Math.floor;

//One of the following error ids are printed to the console in case of an abort()
var ERROR_INCOMPLETE_VMPRIVILEGE = 0;
var ERROR_VMPRIVILEGE            = 1;
var ERROR_VMMODE                 = 2;
var ERROR_SETCSR                 = 3;
var ERROR_GETCSR                 = 4;
var ERROR_LOAD_WORD              = 5;
var ERROR_STORE_WORD             = 6;
var ERROR_INSTRUCTION_NOT_FOUND  = 7;
var ERROR_ECALL                  = 8;
var ERROR_ERET                   = 9;
var ERROR_ERET_PRIV              = 10;
var ERROR_MRTS                   = 11;
var ERROR_ATOMIC_INSTRUCTION     = 12;

//Privilege Modes
var PRV_U = 0x00;
var PRV_S = 0x01;
var PRV_H = 0x02;
var PRV_M = 0x03;

//Various operations on the page table
var VM_READ  = 0;
var VM_WRITE = 1;
var VM_FETCH = 2;

//Various Causes which need to be written to MCAUSE Register in case of a Trap
var CAUSE_TIMER_INTERRUPT          = 0x80000001;
var CAUSE_HOST_INTERRUPT           = 0x80000002;
var CAUSE_SOFTWARE_INTERRUPT       = 0x80000000;
var CAUSE_INSTRUCTION_ACCESS_FAULT = 0x01;
var CAUSE_ILLEGAL_INSTRUCTION      = 0x02;
var CAUSE_BREAKPOINT               = 0x03;
var CAUSE_LOAD_ACCESS_FAULT        = 0x05;
var CAUSE_STORE_ACCESS_FAULT       = 0x07;
var CAUSE_ENVCALL_UMODE            = 0x08;
var CAUSE_ENVCALL_SMODE            = 0x09;
var CAUSE_ENVCALL_HMODE            = 0x0A;
var CAUSE_ENVCALL_MMODE            = 0x0B;

//All CSR addresses have been multiplied for implementing in the asm.js way
var CSR_CYCLES = 0x3000;
var CSR_CYCLEW = 0x2400;


var CSR_FFLAGS    = 0x4;
var CSR_FRM       = 0x8;
var CSR_FCSR      = 0xC;

var CSR_SSTATUS   = 0x400;
var CSR_STVEC     = 0x404;
var CSR_SIE       = 0x410;
var CSR_STIMECMP  = 0x484;
var CSR_SSCRATCH  = 0x500;
var CSR_SEPC      = 0x504;
var CSR_SIP       = 0x510;
var CSR_SPTBR     = 0x600;
var CSR_SASID     = 0x604;

var CSR_HEPC      = 0x904;

var CSR_MSTATUS   = 0xC00;
var CSR_MTVEC     = 0xC04;
var CSR_MTDELEG   = 0xC08;
var CSR_MIE       = 0xC10;
var CSR_MTIMECMP  = 0xC84;
var CSR_MTIMECMPH = 0xD84;
var CSR_MEPC      = 0xD04;
var CSR_MSCRATCH  = 0xD00;
var CSR_MCAUSE    = 0xD08;
var CSR_MBADADDR  = 0xD0C;
var CSR_MIP       = 0xD10;
var CSR_MTOHOST_TEMP = 0xD14; // terminal output, temporary for the patched pk.

var CSR_MTIME     = 0x1C04;
var CSR_MTIMEH    = 0x1D04;
var CSR_MRESET    = 0x1E08;
var CSR_SEND_IPI  = 0x1E0C;

var CSR_MTOHOST         = 0x1E00;
var CSR_MFROMHOST       = 0x1E04;
var CSR_MDEVCMDTOHOST   = 0x1E40; // special
var CSR_MDEVCMDFROMHOST = 0x1E44; // special

var CSR_TIMEW     = 0x2404;
var CSR_INSTRETW  = 0x2408;
var CSR_CYCLEHW   = 0x2600;
var CSR_TIMEHW    = 0x2604;
var CSR_INSTRETHW = 0x2608;

var CSR_STIMEW    = 0x2804;
var CSR_STIMEH    = 0x3604;
var CSR_STIMEHW   = 0x2A04;
var CSR_STIME     = 0x3404;
var CSR_SCAUSE    = 0x3508;
var CSR_SBADADDR  = 0x350C;
var CSR_MCPUID    = 0x3C00;
var CSR_MIMPID    = 0x3C04;
var CSR_MHARTID   = 0x3C40;
var CSR_CYCLEH    = 0x3200;
var CSR_TIMEH     = 0x3204;
var CSR_INSTRETH  = 0x3208;

var CSR_TIME      = 0x3004;
var CSR_INSTRET   = 0x3008;
var CSR_STATS     = 0x300;
var CSR_UARCH0    = 0x3300;
var CSR_UARCH1    = 0x3304;
var CSR_UARCH2    = 0x3008;
var CSR_UARCH3    = 0x330C;
var CSR_UARCH4    = 0x3310;
var CSR_UARCH5    = 0x3314;
var CSR_UARCH6    = 0x3318;
var CSR_UARCH7    = 0x331C;
var CSR_UARCH8    = 0x3320;
var CSR_UARCH9    = 0x3324;
var CSR_UARCH10   = 0x3328;
var CSR_UARCH11   = 0x332C;
var CSR_UARCH12   = 0x3330;
var CSR_UARCH13   = 0x33334;
var CSR_UARCH14   = 0x33338;
var CSR_UARCH15   = 0x3333C;

/*
    Heap Layout
    ===========
    The heap is needed by the asm.js CPU.

    0x0       32 CPU registers
    0x80      Floating Point Registers
    0x2000    CSR Registers
    ------- RAM --------
    0x100000  RAM
*/


var r = new stdlib.Int32Array(heap); // Registers
var rp = 0x00; // Never used

var f = new stdlib.Float64Array(heap); // Registers
var fp = 0x80; // Offset to floating point registers in the Heap

var fi = new stdlib.Int32Array(heap); // For copying operations
var fip = 0x80;

var ff = new stdlib.Float32Array(heap); // The zero register is used to convert to single precision
var ffp = 0x00; // Never used

var csr = new stdlib.Int32Array(heap);
var csrp = 0x2000; // Offset to CSRs in the Heap

var ram = new stdlib.Int32Array(heap);
var ramp = 0x100000; // Offset to Ram in the Heap

var ram8 = new stdlib.Int8Array(heap); // 8 bit view of heap
var ram16 = new stdlib.Int16Array(heap); // 16 bit view of heap

var pc = 0x200; // Virtual PC
var pcorigin = 0x200;
var pc_change = 1; // 1 implies pc has been changed by an instruction
var ticks = 0;
var amoaddr = 0, amovalue = 0;

var fence = 0x200; // Has the next page address in case of normal operation, it is made equal to ppc in insts like branch, jump etc
var ppc = 0x200; // Physical PC
var ppcorigin = 0x200;


// tlb_index contains the virutal address and tlb_entry will have the correponding Phsysical Address
// If the page number of vaddr matches with the tlb_index then we directly read the tlb_entry to get the Physical Frame Number
var instlb_index     = -0x8000; // tlb index for pc
var instlb_entry     = -0x8000;
var read8tlb_index   = -1; // tlb index for lb ins
var read8tlb_entry   = -1;
var read8utlb_index  = -1; // tlb index for lbu ins
var read8utlb_entry  = -1;
var read16tlb_index  = -1; // tlb index for lh ins
var read16tlb_entry  = -1;
var read16utlb_index = -1; // tlb index for lhu ins
var read16utlb_entry = -1;
var read32tlb_index  = -1; // tlb index for lw ins
var read32tlb_entry  = -1;
var store8tlb_index  = -1; // tlb index for sb ins
var store8tlb_entry  = -1;
var store16tlb_index = -1; // tlb index for sh ins
var store16tlb_entry = -1;
var store32tlb_index = -1; // tlb index for sw ins
var store32tlb_entry = -1;

var float_read32tlb_index  = -1; // tlb index for flw ins
var float_read32tlb_entry  = -1;
var float_read64tlb_index  = -1; // tlb index for fld ins
var float_read64tlb_entry  = -1;
var float_store32tlb_index = -1; // tlb index for fsw ins
var float_store32tlb_entry = -1;
var float_store64tlb_index = -1; // tlb index for fsd ins
var float_store64tlb_entry = -1;

var queue_status = 0; // 1 means queue is full

function Init() {
    Reset();
}

function Reset() {
    ticks = 0;
    csr[(csrp + CSR_MSTATUS)>>2]  = 0x96; // 1001 0110 - All Interrupts Disabled, FPU disabled
    csr[(csrp + CSR_MTOHOST)>>2]  = 0x780;
    csr[(csrp + CSR_MCPUID)>>2]   = 0x4112D;
    csr[(csrp + CSR_MIMPID)>>2]   = 0x01;
    csr[(csrp + CSR_MHARTID)>>2]  = 0x00;
    csr[(csrp + CSR_MTVEC)>>2]    = 0x100;
    csr[(csrp + CSR_MIE)>>2]      = 0x00;
    csr[(csrp + CSR_MEPC)>>2]     = 0x00;
    csr[(csrp + CSR_MCAUSE)>>2]   = 0x00;
    csr[(csrp + CSR_MBADADDR)>>2] = 0x00;
    csr[(csrp + CSR_SSTATUS)>>2]  = 0x3010;
    csr[(csrp + CSR_STVEC)>>2]    = 0x00;
    csr[(csrp + CSR_SIE)>>2]      = 0x00;
    csr[(csrp + CSR_TIME)>>2]     = 0x0;
    csr[(csrp + CSR_SPTBR)>>2]    = 0x40000;

    // for atomic load & store instructions
    amoaddr = 0x00;
    amovalue = 0x00;
}

function GetPC() {
    pc = pcorigin + (ppc-ppcorigin)|0;
    return pc|0;
}

function GetTimeToNextInterrupt() {
    var delta = 0x0;
    delta = (csr[(csrp + 0xC84)>> 2]>>>0) - (ticks & 0xFFFFFFFF) |0;
    delta = delta + ((delta|0)<0?0xFFFFFFFF:0x0) | 0;
    return delta|0;
}

function GetTicks() {
    return ticks|0;
}

function ProgressTime(delta) {
    delta = delta|0;
    ticks = ticks + delta|0;
}


function AnalyzeImage() // we haveto define these to copy the cpus
{
}

function CheckForInterrupt() {
};

function RaiseInterrupt(line, cpuid) {
    line = line|0;
    cpuid = cpuid|0;
    //DebugMessage("raise int " + line);
    queue_status = 1;
};

function ClearInterrupt(line, cpuid) {
    line = line|0;
    cpuid = cpuid|0;
};

function Trap(cause, current_pc) {

    //Store the current_pc, set the mcause register and point PC to the Trap Handler
    cause = cause|0;
    current_pc = current_pc|0;
    var current_privilege_level = 0;
    var offset = 0x100;

    current_privilege_level = (csr[(csrp + CSR_MSTATUS)>>2] & 0x06) >> 1;
    PushPrivilegeStack();
    csr[(csrp + CSR_MEPC)>>2] = current_pc;
    csr[(csrp + CSR_MCAUSE)>>2] = cause;
    pc = (offset + (current_privilege_level << 6))|0;
    fence = ppc;
    pc_change = 1;
    InvalidateTLB();
};

function MemTrap(addr, op) {

    addr = addr|0;
    op = op|0;
    if ((op|0) != (VM_FETCH|0)) pc = pcorigin + (ppc-ppcorigin)|0;
    csr[(csrp + CSR_MBADADDR)>>2] = addr;
    switch (op|0) {
        case 0: //VM_READ
            Trap(CAUSE_LOAD_ACCESS_FAULT, pc - 4|0);
            break;

        case 1: //VM_WRITE
            Trap(CAUSE_STORE_ACCESS_FAULT, pc - 4|0);
            break;

        case 2: //VM_FETCH
            Trap(CAUSE_INSTRUCTION_ACCESS_FAULT, pc);
            break;
    }
}


function CheckVMPrivilege(type, op) {

    //Checks if the Privilages of a Page Table Entry are being violated
    type = type|0;
    op = op|0;
    var priv = 0;
    priv = (csr[(csrp + CSR_MSTATUS)>>2] & 0x06) >> 1;

    switch (type|0) {

        case 2:
            if ((op|0) == (VM_READ|0)) return 1;
            if (((priv|0) == (PRV_U|0)) & ((op|0) == (VM_FETCH|0))) return 1;
            return 0;
            break;

        case 3:
            if (!( ((priv|0) == (PRV_S|0)) & ((op|0) == (VM_FETCH|0)) ) ) return 1;
            break;

        case 4:
            if ((op|0) == (VM_READ|0)) return 1;
            return 0;
            break;

        case 5:
            if ((op|0) != (VM_FETCH|0)) return 1;
            break;

        case 6:
            if ((op|0) != (VM_WRITE|0)) return 1;
            break;

        case 7:
            return 1;
            break;

       case 11:
            if ((priv|0) == (PRV_S|0)) return 1;
            break;

        case 13:
            if (((priv|0) == (PRV_S|0)) & ((op|0) != (VM_FETCH|0))) return 1;
            break;

        case 14:
            if (((priv|0) == (PRV_S|0)) & ((op|0) != (VM_WRITE|0))) return 1;
            break;

        case 15:
            if ((priv|0) == (PRV_S|0)) return 1;
            break;

    }

    DebugMessage(ERROR_INCOMPLETE_VMPRIVILEGE|0);
    abort();
    return 0;
}


function TranslateVM(addr, op) {

    //Converts Virtual Address to Physical Address
    addr = addr|0;
    op = op|0;
    var vm = 0;
    var current_privilege_level = 0;
    var i = 1; //i = LEVELS -1 and LEVELS = 2 in a 32 bit System

    var offset = 0;
    var page_num = 0;
    var frame_num = 0;
    var type = 0;
    var valid = 0;

    //For Level 2
    var new_sptbr = 0;
    var new_page_num = 0;
    var new_frame_num = 0;
    var new_type = 0;
    var new_valid = 0;
    var ram_index = 0;


    vm = (csr[(csrp + CSR_MSTATUS)>>2] >> 17) & 0x1F;
    current_privilege_level = (csr[(csrp + CSR_MSTATUS)>>2] & 0x06) >> 1;

    // vm bare mode
    if (((vm|0) == 0) | ((current_privilege_level|0) == (PRV_M|0))) return addr|0;

    // hack, open mmio by direct mapping
    //if ((addr>>>28) == 0x9) return addr;

    // only RV32 supported
    if ((vm|0) != 8) {
        DebugMessage(ERROR_VMMODE|0);
        abort();
    }

    // LEVEL 1
    offset = addr & 0xFFF;
    page_num = (addr >>> 22)|0;

    ram_index = (csr[(csrp + CSR_SPTBR)>>2]|0) + (page_num << 2)|0
    frame_num = ram[(ramp + ram_index) >> 2]|0;
    type = ((frame_num >> 1) & 0xF);
    valid = (frame_num & 0x01);

    if ((valid|0) == 0) {
        //DebugMessage("Unsupported valid field " + valid + " or invalid entry in PTE at PC "+utils.ToHex(pc) + " pl:" + current_privilege_level + " addr:" + utils.ToHex(addr) + " op:"+op);
        //abort();
        MemTrap(addr, op);
        return -1;
    }
    if ((type|0) >= 2) {

        if (!(CheckVMPrivilege(type,op)|0)) {
            DebugMessage(ERROR_VMPRIVILEGE|0);
            abort();
        }
/*
        var updated_frame_num = frame_num;
        if (op == VM_READ)
            updated_frame_num = (frame_num | 0x20);
        else if (op == VM_WRITE)
            updated_frame_num = (frame_num | 0x60);
        Write32(csr[CSR_SPTBR] + (page_num << 2),updated_frame_num);
*/
        return (((frame_num >> 10) | ((addr >> 12) & 0x3FF)) << 12) | offset;
    }

    // LEVEL 2
    // DebugMessage("Second level MMU");

    offset = addr & 0xFFF;
    new_sptbr = (frame_num & 0xFFFFFC00) << 2;
    new_page_num = (addr >> 12) & 0x3FF;
    ram_index = (new_sptbr|0) + (new_page_num << 2)|0;
    new_frame_num = ram[(ramp + ram_index) >> 2]|0;
    new_type = ((new_frame_num >> 1) & 0xF);
    new_valid = (new_frame_num & 0x01);
    i = (i - 1)|0;

    if ((new_valid|0) == 0) {
        MemTrap(addr, op);
        return -1;
    }

    if (!(CheckVMPrivilege(new_type, op)|0)) {
        //DebugMessage("Error in TranslateVM: Unhandled trap");
        //abort();
        MemTrap(addr, op);
        return -1;
    }

/*
    var updated_frame_num = new_frame_num;
    if (op == VM_READ)
        updated_frame_num = (new_frame_num | 0x20);
    else if (op == VM_WRITE)
        updated_frame_num = (new_frame_num | 0x60);
    Write32(new_sptbr + (new_page_num << 2),updated_frame_num);
*/

    return ((new_frame_num >> 10) << 12) | offset | 0;
};


function SetCSR(addr,value) {

    // Handles write to CSR Registers appropriately
    addr = addr|0;
    value = value|0;
    var mask = 0;
    var ram_index = 0;
    addr = addr << 2;
    switch (addr|0) {
        case 0xC: // CSR_FCSR
            csr[(csrp + addr)>>2] = value;
            break;

        case 0x1E40: // CSR_MDEVCMDTOHOST
            csr[(csrp + addr)>>2] = value;
            WriteDEVCMDToHost(value|0);
            break;

        case 0x1E44: // CSR_MDEVCMDFROMHOST
            csr[(csrp + addr)>>2] = value;
            WriteDEVCMDFromHost(value|0);
            break;

        case 0x1E00: // CSR_MTOHOST
            csr[(csrp + addr)>>2] =  value;
            WriteToHost(value|0);
            break;

        case 0xD14: // CSR_MTOHOST_TEMP only temporary for the patched pk.
            ram_index = 0x90000000 >> 0;
            ram8[(ramp + ram_index) >> 0] = value|0;
            if ((value|0) == 0xA) ram8[(ramp + ram_index) >> 0] = 0xD;
            break;

        case 0x1E04: // CSR_MFROMHOST
            csr[(csrp + addr)>>2] = value;
            WriteFromHost(value|0);
            break;

        case 0xC00: // CSR_MSTATUS
            csr[(csrp + addr)>>2] = value;
            InvalidateTLB();
            break;

        case 0x3C00: // CSR_MCPUID
            //csr[addr] = value;
            break;

        case 0x3C04: // CSR_MIMPID
            csr[(csrp + addr)>>2] = value;
            break;

        case 0x3C40: // CSR_MHARTID
            csr[(csrp + addr)>>2] = value;
            break;

        case 0xC04: // CSR_MTVEC
            csr[(csrp + addr)>>2] = value;
            break;

        case 0xD10: // CSR_MIP
            //csr[addr] = value;
            mask = 0x2 | 0x08; //mask = MIP_SSIP | MIP_MSIP
            csr[(csrp + addr)>>2] = (csr[(csrp + addr)>>2] & ~mask) | (value & mask);
            break;

        case 0xC10: // CSR_MIE
            //csr[addr] = value;
            mask = 0x2 | 0x08 | 0x20; //mask = MIP_SSIP | MIP_MSIP | MIP_STIP
            csr[(csrp + addr)>>2] = (csr[(csrp + addr)>>2] & ~mask) | (value & mask);
            break;

        case 0x504: // CSR_SEPC
        case 0xD04: // CSR_MEPC
            csr[(csrp + addr)>>2] = value;
            break;

        case 0xD08: // CSR_MCAUSE
            csr[(csrp + addr)>>2] = value;
            break;

        case 0x3508: // CSR_SCAUSE
            csr[(csrp + addr)>>2] = value;
            break;

        case 0xD0C: // CSR_MBADADDR
            csr[(csrp + addr)>>2] = value;
            break;

        case 0x350C: // CSR_SBADADDR
            csr[(csrp + addr)>>2] = value;
            break;

        case 0x400: // CSR_SSTATUS
            csr[(csrp + CSR_SSTATUS)>>2] = value;
            csr[(csrp + CSR_MSTATUS)>>2] = csr[(csrp + CSR_MSTATUS)>>2] & (~0x1F039);
            csr[(csrp + CSR_MSTATUS)>>2] = csr[(csrp + CSR_MSTATUS)>>2] | (csr[(csrp + CSR_SSTATUS)>>2] & 0x01); //IE0
            csr[(csrp + CSR_MSTATUS)>>2] = csr[(csrp + CSR_MSTATUS)>>2] | (csr[(csrp + CSR_SSTATUS)>>2] & 0x08); //IE1
            csr[(csrp + CSR_MSTATUS)>>2] = csr[(csrp + CSR_MSTATUS)>>2] | (csr[(csrp + CSR_SSTATUS)>>2] & 0x10); //PRV1
            csr[(csrp + CSR_MSTATUS)>>2] = csr[(csrp + CSR_MSTATUS)>>2] | (csr[(csrp + CSR_SSTATUS)>>2] & 0xF000); //FS,XS
            csr[(csrp + CSR_MSTATUS)>>2] = csr[(csrp + CSR_MSTATUS)>>2] | (csr[(csrp + CSR_SSTATUS)>>2] & 0x10000); //MPRV
            break;

        case 0x404: // CSR_STVEC
            csr[(csrp + addr)>>2] = value;
            break;

        case 0x510: // CSR_SIP
            //csr[addr] = value;
            mask = 0x2; //mask = MIP_SSIP
            csr[(csrp + CSR_MIP)>>2] = (csr[(csrp + CSR_MIP)>>2] & ~mask) | (value & mask);
            break;

        case 0x410: // CSR_SIE
            //csr[addr] = value;
            mask = 0x2 | 0x20; //mask = MIP_SSIP | MIP_STIP
            csr[(csrp + CSR_MIE)>>2] = (csr[(csrp + CSR_MIE)>>2] & ~mask) | (value & mask);
            break;

        case 0xD00: // CSR_MSCRATCH
            csr[(csrp + addr)>>2] = value;
            break;

        case 0x500: // CSR_SSCRATCH
            csr[(csrp + addr)>>2] = value;
            break;

        case 0x2400: // CSR_CYCLEW
            csr[(csrp + addr)>>2] = value;
            break;

        case 0x3000: // CSR_CYCLES
            ticks = value;
            csr[(csrp + addr)>>2] = value;
            break;

        case 0x1C04: // CSR_MTIME
        case 0x3404: // CSR_STIME
        case 0x2804: // CSR_STIMEW
            csr[(csrp + addr)>>2] = value;
            break;

        case 0x1D04: // CSR_MTIMEH
        case 0x3604: // CSR_STIMEH
        case 0x2A04: // CSR_STIMEHW
            csr[(csrp + addr)>>2] = value;
            break;

        case 0x3004: // CSR_TIME
        case 0x2404: // CSR_TIMEW
            csr[(csrp + addr)>>2] = value;
            break;

        case 0xC84: // CSR_MTIMECMP
        case 0x484: // CSR_STIMECMP
            csr[(csrp + CSR_MIP)>>2] = csr[(csrp + CSR_MIP)>>2] & (~(0x20)); //csr[CSR_MIP] &= ~MIP_STIP
            csr[(csrp + addr)>>2] = value;
            break;

        case 0xD84: // CSR_MTIMECMPH
        case 0x600: // CSR_SPTBR
            csr[(csrp + addr)>>2] = value;
            break;

        case 0x04: // CSR_FRM
        case 0x08: // CSR_FFLAGS
            csr[(csrp + addr)>>2] = value;
            break;

        default:
            csr[(csrp + addr)>>2] = value;
            DebugMessage(ERROR_SETCSR|0);
            abort();
            break;
    }
};

function GetCSR(addr) {

    // Handles Read operation on CSR Registers appropriately
    addr = addr|0;
    var current_privilege_level = 0;
    current_privilege_level = (csr[(csrp + CSR_MSTATUS)>>2] & 0x06) >> 1;
    addr = (addr << 2)|0;
    switch (addr|0) {
        case 0xC: // CSR_FCSR
            return 0x0;
            break;

        case 0x1E40: // CSR_MDEVCMDTOHOST
            return ReadDEVCMDToHost()|0;
            break;

        case 0x1E44: // CSR_MDEVCMDFROMHOST
            return ReadDEVCMDFromHost()|0;
            break;

        case 0x1E00: // CSR_MTOHOST
            return ReadToHost()|0;
            break;

        case 0xD14: // CSR_MTOHOST_TEMP only temporary for the patched pk.
            return 0x0;
            break;

        case 0x1E04: // CSR_MFROMHOST
            return ReadFromHost()|0;
            break;

        case 0xC00: // CSR_MSTATUS
            return csr[(csrp + addr)>>2]|0;
            break;

        case 0x3C00: // CSR_MCPUID
            return csr[(csrp + addr)>>2]|0;
            break;

        case 0x3C04: // CSR_MIMPID
            return csr[(csrp + addr)>>2]|0;
            break;

        case 0x3C40: // CSR_MHARTID
            return csr[(csrp + addr)>>2]|0;
            break;

        case 0xC04: // CSR_MTVEC
            return csr[(csrp + addr)>>2]|0;
            break;

        case 0xC10: // CSR_MIE
            return csr[(csrp + addr)>>2]|0;
            break;

        case 0x504: // CSR_SEPC
        case 0xD04: // CSR_MEPC
            return csr[(csrp + addr)>>2]|0;
            break;

        case 0xD08: // CSR_MCAUSE
            return csr[(csrp + addr)>>2]|0;
            break;

        case 0x3508: // CSR_SCAUSE
            return csr[(csrp + addr)>>2]|0;
            break;

        case 0xD0C: // CSR_MBADADDR
            return csr[(csrp + addr)>>2]|0;
            break;

        case 0x350C: // CSR_SBADADDR
            return csr[(csrp + addr)>>2]|0;
            break;

        case 0x400: // CSR_SSTATUS
            //if (current_privilege_level == 0) Trap(CAUSE_ILLEGAL_INSTRUCTION);
            csr[(csrp + CSR_SSTATUS)>>2] = 0x00;
            csr[(csrp + CSR_SSTATUS)>>2] = csr[(csrp + CSR_SSTATUS)>>2] | (csr[(csrp + CSR_MSTATUS)>>2] & 0x01); //IE0
            csr[(csrp + CSR_SSTATUS)>>2] = csr[(csrp + CSR_SSTATUS)>>2] | (csr[(csrp + CSR_MSTATUS)>>2] & 0x08); //IE1
            csr[(csrp + CSR_SSTATUS)>>2] = csr[(csrp + CSR_SSTATUS)>>2] | (csr[(csrp + CSR_MSTATUS)>>2] & 0x10); //PRV1
            csr[(csrp + CSR_SSTATUS)>>2] = csr[(csrp + CSR_SSTATUS)>>2] | (csr[(csrp + CSR_MSTATUS)>>2] & 0xF000); //FS,XS
            csr[(csrp + CSR_SSTATUS)>>2] = csr[(csrp + CSR_SSTATUS)>>2] | (csr[(csrp + CSR_MSTATUS)>>2] & 0x10000); //MPRV
            return csr[(csrp + CSR_SSTATUS)>>2]|0;
            break;

        case 0x404: // CSR_STVEC
            return csr[(csrp + addr)>>2]|0;
            break;

        case 0xD10: // CSR_MIP
            return csr[(csrp + addr)>>2]|0;
            break;

        case 0x510: // CSR_SIP
            return (csr[(csrp + CSR_MIP)>>2] & (0x2 | 0x20))|0;//(MIP_SSIP | MIP_STIP)
            break;

        case 0x410: // CSR_SIE
            return (csr[(csrp + CSR_MIE)>>2] & (0x2 | 0x20))|0;//(MIP_SSIP | MIP_STIP)
            break;

        case 0xD00: // CSR_MSCRATCH
            return csr[(csrp + addr)>>2]|0;
            break;

        case 0x500: // CSR_SSCRATCH
            return csr[(csrp + addr)>>2]|0;
            break;

        case 0x2400: // CSR_CYCLEW
            return ticks|0;
            break;

        case 0x3000: // CSR_CYCLES
            return ticks|0;
            break;

        case 0x1C04: // CSR_MTIME
        case 0x3404: // CSR_STIME
        case 0x2804: // CSR_STIMEW
            return ticks|0;
            break;

        case 0x1D04: // CSR_MTIMEH
        case 0x3604: // CSR_STIMEH
        case 0x2A04: // CSR_STIMEHW
            return ((ticks) >> 32)|0;
            break;

        case 0x3004: // CSR_TIME
        case 0x2404: // CSR_TIMEW
            return ticks|0;
            break;

        case 0xC84: // CSR_MTIMECMP
        case 0x484: // CSR_STIMECMP
            return csr[(csrp + addr)>>2]|0;
            break;

        case 0xD84: // CSR_MTIMECMPH
        case 0x600: // CSR_SPTBR
            return csr[(csrp + addr)>>2]|0;
            break;

        case 0x04: // CSR_FRM
        case 0x08: // CSR_FFLAGS
            return csr[(csrp + addr)>>2]|0;
            break;

        default:
            DebugMessage(ERROR_GETCSR|0);
            abort();
            return csr[(csrp + addr)>>2]|0;
            break;
    }

    return 0;

};

function UMul64(a, b, index) {

    // Special Method for 64 Bit Multiplication for Unsigned*Unsigned
    a = a|0;
    b = b|0;
    index = index|0;
    var result0 = 0, result1 = 0;

    var a00 = 0, a16 = 0;
    var b00 = 0, b16 = 0;

    var c00 = 0;
    var c16 = 0;
    var c32 = 0;
    var c48 = 0;

    if ((a >>> 0) < 32767)
    if ((b >>> 0) < 65536) {
        result0 = imul((a|0),(b|0))|0;
        result1 = ((result0|0) < 0) ? -1 : 0;
        if ((index|0) == 0) return result0|0;
        return result1|0;
    }

    a00 = a & 0xFFFF;
    a16 = a >>> 16;
    b00 = b & 0xFFFF;
    b16 = b >>> 16;

    c00 = imul((a00|0), (b00|0))|0;
    c16 = (c00 >>> 16) + (imul((a16|0),(b00|0))|0)|0;
    c32 = c16 >>> 16;
    c16 = (c16 & 0xFFFF) + (imul((a00|0),(b16|0))|0)|0;
    c32 = (c32 + (c16 >>> 16))|0;
    c48 = c32 >>> 16;
    c32 = (c32 & 0xFFFF) + (imul((a16|0),(b16|0))|0)|0;
    c48 = (c48 + (c32 >>> 16))|0;

    result0 = ((c16 & 0xFFFF) << 16) | (c00 & 0xFFFF);
    result1 = ((c48 & 0xFFFF) << 16) | (c32 & 0xFFFF);
    if ((index|0) == 0) return result0|0;
    return result1|0;
};

function IMul64(a,b,index) {

    // Special Method for 64 Bit Multiplication for Signed*Signed
    a = a|0;
    b = b|0;
    index = index|0;
    var result0 = 0, result1 = 0;
    var doNegate = 0;

    if ((a|0) == 0) return 0;
    if ((b|0) == 0) return 0;

    if ((a|0) >= -32768) 
    if ((a|0) <=  32767)  
    if ((b|0) >= -32768)  
    if ((b|0) <=  32767) {
        result0 = imul((a|0),(b|0))|0;
        result1 = ((result0|0) < 0) ? -1 : 0;
        if ((index|0) == 0) return result0|0;
        return result1|0;
    }

    doNegate = ((a|0) < 0) ^ ((b|0) < 0);

    a = MathAbs(a|0)|0;
    b = MathAbs(b|0)|0;
    result0 = UMul64(a, b, 0)|0;
    result1 = UMul64(a, b, 1)|0;

    if (doNegate) {
        result0 = ~result0;
        result1 = ~result1;
        result0 = (result0 + 1) | 0;
        if ((result0|0) == 0) result1 = (result1 + 1) | 0;
    }

    if ((index|0) == 0) return result0|0;
    return result1|0;
};

function SUMul64(a,b,index) {

    // Special Method for 64 Bit Multiplication for Signed*Unsigned
    a = a|0;
    b = b|0;
    index = index|0;
    var result0 = 0, result1 = 0;
    var doNegate = 0;

    if ((a|0) == 0) return 0;
    if ((b|0) == 0) return 0;

    if ((a|0) >= -32768)
    if ((a|0) <= 32767) 
    if ((b>>>0) < 65536)  {
        result0 = imul((a|0),(b|0))|0;
        result1 = ((result0|0) < 0) ? -1 : 0;
        if ((index|0) == 0) return result0|0;
        return result1|0;
    }

    doNegate = ((a|0) < 0);

    a = MathAbs(a|0)|0;
    result0 = UMul64(a, b, 0)|0;
    result1 = UMul64(a, b, 1)|0;

    if (doNegate) {
        result0 = ~result0;
        result1 = ~result1;
        result0 = (result0 + 1) | 0;
        if ((result0|0) == 0) result1 = (result1 + 1) | 0;
    }

    if ((index|0) == 0) return result0|0;
    return result1|0;
};

function InvalidateTLB(){

    // The highest address migh be used by the sbi
    instlb_index     = 0xFFFF0000;
    instlb_entry     = -1;
    read8tlb_index   = 0xFFFF0000;
    read8tlb_entry   = -1;
    read8utlb_index  = 0xFFFF0000;
    read8utlb_entry  = -1;
    read16tlb_index  = 0xFFFF0000;
    read16tlb_entry  = -1;
    read16utlb_index = 0xFFFF0000;
    read16utlb_entry = -1;
    read32tlb_index  = 0xFFFF0000;
    read32tlb_entry  = -1;
    store8tlb_index  = 0xFFFF0000;
    store8tlb_entry  = -1;
    store16tlb_index = 0xFFFF0000;
    store16tlb_entry = -1;
    store32tlb_index = 0xFFFF0000;
    store32tlb_entry = -1;

    float_read32tlb_index  = 0xFFFF0000;
    float_read32tlb_entry  = -1;
    float_read64tlb_index  = 0xFFFF0000;
    float_read64tlb_entry  = -1;
    float_store32tlb_index = 0xFFFF0000;
    float_store32tlb_entry = -1;
    float_store64tlb_index = 0xFFFF0000;
    float_store64tlb_entry = -1;

}

function PushPrivilegeStack(){

    // 0 to 11 bits of mstatus register is considered as the stack.
    // Pushing implies just right shifting the 0 to 11 bits by 3 and then setting PRV[1:0] to Machine
    // Also set MPRV bit in mstatus register to zero
    var mstatus = 0,privilege_level_stack = 0, new_privilege_level_stack = 0;
    mstatus = csr[(csrp + CSR_MSTATUS)>>2]|0;
    privilege_level_stack =  (mstatus & 0xFFF);
    new_privilege_level_stack = (((privilege_level_stack << 2) | PRV_M) << 1) & 0xFFF;
    csr[(csrp + CSR_MSTATUS)>>2] = (((mstatus >> 12) << 12) + new_privilege_level_stack) & 0xFFFEFFFF; //Last "and" to set mprv(bit 16) to zero
};

function PopPrivilegeStack(){

    // 0 to 11 bits of mstatus register is considered as the stack.
    // Pop implies just left shifting the 0 to 11 bits by 3 and then setting PRV3[1:0] to lowest supported privilege mode(User in this case) with IE3 = 1
    // Also set MPRV bit in mstatus register to zero
    var mstatus = 0,privilege_level_stack = 0, new_privilege_level_stack = 0;
    mstatus = csr[(csrp + CSR_MSTATUS)>>2]|0;
    privilege_level_stack =  (mstatus & 0xFFF);
    new_privilege_level_stack = ((privilege_level_stack >>> 3) | ((PRV_U << 1) | 0x1) << 9);
    csr[(csrp + CSR_MSTATUS)>>2] = ((mstatus >> 12) << 12) + new_privilege_level_stack;
    InvalidateTLB();
};

function Step(steps, clockspeed) {

    steps = steps|0;
    clockspeed = clockspeed|0;

    var imm = 0x00;
    var zimm = 0x00;
    var mult = 0x00;
    var quo = 0x00;
    var rem = 0x00;
    var result = 0x00;
    var rs1 = 0x0;
    var rs2 = 0x0;
    var fs1 = 0.0;
    var fs2 = 0.0;
    var fs3 = 0.0;

    var delta = 0;
    var vaddr = 0;
    var paddr = 0;
    var current_privilege_level = 0;
    var interrupts = 0;
    var ie = 0;
    var ins = 0;
    var dsteps = 64;

    for(;;) {

    if ((fence|0) != (ppc|0)) {

        ins = ram[ppc >> 2]|0;
        ppc = ppc + 4|0;

        switch (ins&0x7F) {

            case 0x03:
                // lb, lh, lw, lbu, lhu
                vaddr = (r[((ins >> 13) & 0x7C) >> 2]|0) + (ins >> 20)|0;
                switch ((ins >> 12)&0x7) {

                    case 0x00:
                        // lb
                        if ((read8tlb_index ^ vaddr) & 0xFFFFF000) {
                            paddr = TranslateVM(vaddr|0, VM_READ)|0;
                            if ((paddr|0) == -1) continue;
                            read8tlb_index = vaddr|0;
                            read8tlb_entry = (paddr ^ vaddr) & 0xFFFFF000;
                        }
                        paddr = read8tlb_entry ^ vaddr;
                        r[((ins >> 5) & 0x7C) >> 2] = ((ram8[(ramp + paddr) >> 0]) << 24) >> 24;
                        continue;

                    case 0x01:
                        // lh
                        if ((read16tlb_index ^ vaddr) & 0xFFFFF000) {
                            paddr = TranslateVM(vaddr|0, VM_READ)|0;
                            if ((paddr|0) == -1) continue;
                            read16tlb_index = vaddr|0;
                            read16tlb_entry = (paddr ^ vaddr) & 0xFFFFF000;
                        }
                        paddr = read16tlb_entry ^ vaddr;
                        r[((ins >> 5) & 0x7C) >> 2] = ((ram16[(ramp + paddr) >> 1]) << 16) >> 16;
                        continue;

                    case 0x02:
                        // lw
                        if (vaddr & 3) {
                             DebugMessage(ERROR_LOAD_WORD|0);
                             abort();
                        }
                        if ((read32tlb_index ^ vaddr) & 0xFFFFF000) {
                            paddr = TranslateVM(vaddr|0, VM_READ)|0;
                            if ((paddr|0) == -1) continue;
                            read32tlb_index = vaddr|0;
                            read32tlb_entry = (paddr ^ vaddr) & 0xFFFFF000;
                        }
                        paddr = read32tlb_entry ^ vaddr;
                        r[((ins >> 5) & 0x7C) >> 2] = ram[(ramp + paddr) >> 2]|0;
                        continue;

                    case 0x04:
                        // lbu
                        if ((read8utlb_index ^ vaddr) & 0xFFFFF000) {
                            paddr = TranslateVM(vaddr|0, VM_READ)|0;
                            if ((paddr|0) == -1) continue;
                            read8utlb_index = vaddr|0;
                            read8utlb_entry = (paddr ^ vaddr) & 0xFFFFF000;
                        }
                        paddr = read8utlb_entry ^ vaddr;
                        r[((ins >> 5) & 0x7C) >> 2] = (ram8[(ramp + paddr) >> 0]) & 0xFF;
                        continue;

                    case 0x05:
                        // lhu
                        if ((read16utlb_index ^ vaddr) & 0xFFFFF000) {
                            paddr = TranslateVM(vaddr|0, VM_READ)|0;
                            if ((paddr|0) == -1) continue;
                            read16utlb_index = vaddr|0;
                            read16utlb_entry = (paddr ^ vaddr) & 0xFFFFF000;
                        }
                        paddr = read16utlb_entry ^ vaddr;
                        r[((ins >> 5) & 0x7C) >> 2] = (ram16[(ramp + paddr) >> 1]) & 0xFFFF;
                        continue;

                    default:
                        DebugMessage(ERROR_INSTRUCTION_NOT_FOUND|0);
                        abort();
                        break;

                }
                continue;

            case 0x23:
                // sb, sh, sw
                vaddr = 
                    (r[((ins >> 13) & 0x7C) >> 2]|0) + 
                    (
                     ((ins >> 25) << 5) | 
                     ((ins >> 7) & 0x1F)
                    )|0;
                switch ((ins >> 12)&0x7) {

                    case 0x00:
                        // sb
                        if ((store8tlb_index ^ vaddr) & 0xFFFFF000) {
                            paddr = TranslateVM(vaddr|0, VM_WRITE)|0;
                            if ((paddr|0) == -1) continue;
                            store8tlb_index = vaddr|0;
                            store8tlb_entry = (paddr ^ vaddr) & 0xFFFFF000;
                        }
                        paddr = store8tlb_entry ^ vaddr;
                        ram8[(ramp + paddr) >> 0] = (r[((ins >> 18) & 0x7C) >> 2] & 0xFF);
                        continue;

                    case 0x01:
                        // sh
                        if ((store16tlb_index ^ vaddr) & 0xFFFFF000) {
                            paddr = TranslateVM(vaddr|0, VM_WRITE)|0;
                            if ((paddr|0) == -1) continue;
                            store16tlb_index = vaddr|0;
                            store16tlb_entry = (paddr ^ vaddr) & 0xFFFFF000;
                        }
                        paddr = store16tlb_entry ^ vaddr;
                        ram16[(ramp + paddr) >> 1] = (r[((ins >> 18) & 0x7C) >> 2] & 0xFFFF);
                        continue;

                    case 0x02:
                        // sw
                        if (vaddr & 3) {
                             DebugMessage(ERROR_STORE_WORD|0);
                             abort();
                        }
                        if ((store32tlb_index ^ vaddr) & 0xFFFFF000) {
                            paddr = TranslateVM(vaddr|0, VM_WRITE)|0;
                            if ((paddr|0) == -1) continue;
                            store32tlb_index = vaddr|0;
                            store32tlb_entry = (paddr ^ vaddr) & 0xFFFFF000;
                        }
                        paddr = store32tlb_entry ^ vaddr;
                        ram[(ramp + paddr) >> 2] = r[((ins >> 18) & 0x7C) >> 2]|0;
                        continue;

                    default:
                        DebugMessage(ERROR_INSTRUCTION_NOT_FOUND|0);
                        abort();
                        break;

                }
                continue;

            case 0x13:
                // addi, slti, sltiu, xori, ori, andi, slli, srli, srai
                rs1 = r[((ins >> 13) & 0x7C) >> 2]|0;
                switch ((ins >> 12)&0x7) {

                    case 0x00:
                        // addi
                        r[((ins >> 5) & 0x7C) >> 2] = rs1 + (ins >> 20)|0;
                        continue;

                    case 0x02:
                        // slti
                        if ((rs1|0) < (ins >> 20))
                            r[((ins >> 5) & 0x7C) >> 2] = 0x01;
                        else
                            r[((ins >> 5) & 0x7C) >> 2] = 0x00;
                        continue;

                    case 0x03:
                        // sltiu
                        if ((rs1 >>> 0) < ((ins >> 20) >>> 0))
                            r[((ins >> 5) & 0x7C) >> 2] = 0x01;
                        else
                            r[((ins >> 5) & 0x7C) >> 2] = 0x00;
                        continue;

                    case 0x04:
                        // xori
                        r[((ins >> 5) & 0x7C) >> 2] = rs1 ^ (ins >> 20);
                        continue;

                    case 0x06:
                        // ori
                        r[((ins >> 5) & 0x7C) >> 2] = rs1 | (ins >> 20);
                        continue;

                    case 0x07:
                        // andi
                        r[((ins >> 5) & 0x7C) >> 2] = rs1 & (ins >> 20);
                        continue;

                    case 0x01:
                        // slli
                        r[((ins >> 5) & 0x7C) >> 2] = rs1 << ((ins >> 20) & 0x1F);
                        continue;

                    case 0x05:
                        if (((ins >> 25) & 0x7F) == 0x00) {
                            // srli
                            r[((ins >> 5) & 0x7C) >> 2] = rs1 >>> ((ins >> 20) & 0x1F);
                        }
                        else if (((ins >> 25) & 0x7F) == 0x20) {
                            // srai
                            r[((ins >> 5) & 0x7C) >> 2] = rs1 >> ((ins >> 20) & 0x1F);
                        }
                        continue;

                    default:
                        DebugMessage(ERROR_INSTRUCTION_NOT_FOUND|0);
                        abort();
                        break;

                }
                continue;

            case 0x33:
                // add, sub, sll, slt, sltu, xor, srl, sra, or, and
                switch ((ins >> 25)&0x7F) {

                    case 0x00:
                        rs1 = r[((ins >> 13) & 0x7C) >> 2]|0;
                        rs2 = r[((ins >> 18) & 0x7C) >> 2]|0;
                        switch ((ins >> 12)&0x7) {
                            case 0x00:
                                // add
                                r[((ins >> 5) & 0x7C) >> 2] = rs1 + rs2;
                                continue;

                            case 0x02:
                                // slt
                                if ((rs1|0) < (rs2|0))
                                    r[((ins >> 5) & 0x7C) >> 2] = 0x01;
                                else
                                    r[((ins >> 5) & 0x7C) >> 2] = 0x00;
                                continue;

                            case 0x03:
                                // sltu
                                if ((rs1 >>> 0) < (rs2 >>> 0))
                                    r[((ins >> 5) & 0x7C) >> 2] = 0x01;
                                else
                                    r[((ins >> 5) & 0x7C) >> 2] = 0x00;
                                continue;

                            case 0x07:
                                // and
                                r[((ins >> 5) & 0x7C) >> 2] = rs1 & rs2;
                                continue;

                            case 0x06:
                                // or
                                r[((ins >> 5) & 0x7C) >> 2] = rs1 | rs2;
                                continue;

                            case 0x04:
                                // xor
                                r[((ins >> 5) & 0x7C) >> 2] = rs1 ^ rs2;
                                continue;

                            case 0x01:
                                // sll
                                r[((ins >> 5) & 0x7C) >> 2] = rs1 << (rs2 & 0x1F);
                                continue;

                            case 0x05:
                                // srl
                                r[((ins >> 5) & 0x7C) >> 2] = rs1 >>> (rs2 & 0x1F);
                                continue;
                        }
                        continue;

                    case 0x20:
                        // sub, sra
                        rs1 = r[((ins >> 13) & 0x7C) >> 2]|0;
                        rs2 = r[((ins >> 18) & 0x7C) >> 2]|0;
                        switch ((ins >> 12)&0x7) {
                            case 0x00:
                                // sub
                                r[((ins >> 5) & 0x7C) >> 2] = rs1 - rs2;
                                continue;

                            case 0x05:
                                // sra
                                r[((ins >> 5) & 0x7C) >> 2] = rs1 >> (rs2 & 0x1F);
                                continue;
                        }
                        continue;

                    case 0x01:
                        // mul, mulh, mulhsu, mulhu, div, divu, rem, remu
                        rs1 = r[((ins >> 13) & 0x7C) >> 2]|0;
                        rs2 = r[((ins >> 18) & 0x7C) >> 2]|0;
                        switch ((ins >> 12)&0x7) {
                            case 0x00:
                                // mul
                                result = imul(rs1|0, rs2|0)|0;
                                r[((ins >> 5) & 0x7C) >> 2] = result;
                                continue;

                            case 0x01:
                                // mulh
                                result = IMul64(rs1, rs2, 1)|0;
                                r[((ins >> 5) & 0x7C) >> 2] = result;
                                continue;

                            case 0x02:
                                // mulhsu
                                result = SUMul64(rs1, rs2>>>0, 1)|0;
                                r[((ins >> 5) & 0x7C) >> 2] = result;
                                continue;

                            case 0x03:
                                // mulhu
                                result = UMul64(rs1>>>0, rs2>>>0, 1)|0;
                                r[((ins >> 5) & 0x7C) >> 2] = result;
                                continue;

                            case 0x04:
                                // div
                                if ((rs2|0) == 0)
                                    quo = -1;
                                else
                                    quo = ((rs1|0) / (rs2|0))|0;
                                r[((ins >> 5) & 0x7C) >> 2] = quo;
                                continue;

                            case 0x05:
                                //divu
                                if ((rs2|0) == 0)
                                    quo = 0xFFFFFFFF;
                                else
                                    quo = ((rs1 >>> 0) / (rs2 >>> 0))|0;
                                r[((ins >> 5) & 0x7C) >> 2] = quo;
                                continue;

                            case 0x06:
                                // rem
                                if ((rs2|0) == 0)
                                    rem = rs1;
                                else
                                    rem = ((rs1|0) % (rs2|0))|0;
                                r[((ins >> 5) & 0x7C) >> 2] = rem;
                                continue;

                            case 0x07:
                                // remu
                                if ((rs2|0) == 0)
                                    rem = (rs1 >>> 0);
                                else
                                    rem = ((rs1 >>> 0) % (rs2 >>> 0))|0;
                                r[((ins >> 5) & 0x7C) >> 2] = rem;
                                continue;
                        }
                        continue;

                    default:
                        DebugMessage(ERROR_INSTRUCTION_NOT_FOUND|0);
                        abort();
                        break;

                }
                continue;

            case 0x37:
                // lui
                r[((ins >> 5) & 0x7C) >> 2] = ins & 0xFFFFF000;
                continue;

            case 0x17:
                // auipc
                pc = pcorigin + (ppc-ppcorigin)|0;
                r[((ins >> 5) & 0x7C) >> 2] = (pc + (ins & 0xFFFFF000) - 4)|0;
                continue;

            case 0x6F:
                // jal
                pc = pcorigin + (ppc-ppcorigin)|0;
                r[((ins >> 5) & 0x7C) >> 2] = pc;
                imm =  (
                    ((ins >> 21) & 0x3FF) | 
                    (((ins >> 20) & 0x1) << 10) | 
                    (((ins >> 12) & 0xFF) << 11) | 
                    ((ins >> 31) << 19) ) << 1;
                pc = pc + imm - 4|0;
                fence = ppc;
                pc_change = 1;
                r[0] = 0;
                continue;

            case 0x67:
                // jalr
                pc = pcorigin + (ppc-ppcorigin)|0;
                rs1 = r[((ins >> 13) & 0x7C) >> 2]|0;
                r[((ins >> 5) & 0x7C) >> 2] = pc;
                pc = ((rs1 + (ins >> 20)) & 0xFFFFFFFE)|0;
                fence = ppc;
                pc_change = 1;
                r[0] = 0;
                continue;

            case 0x63:
                // beq, bne, blt, bge, bltu, bgeu
                rs1 = r[((ins >> 13) & 0x7C) >> 2]|0;
                rs2 = r[((ins >> 18) & 0x7C) >> 2]|0;
                switch ((ins >> 12)&0x7) {

                    case 0x00:
                        // beq
                        if ((rs1|0) != (rs2|0)) continue;
                        fence = ppc;
                        pc_change = 1;
                        imm = ((((ins >> 31) << 11) | (((ins >> 25) & 0x3F) << 4) | ((ins >> 8) & 0x0F) | (((ins >> 7) & 0x01) << 10)) << 1 );
                        pc = pcorigin + (ppc-ppcorigin)|0;
                        pc = pc + imm - 4|0;
                        continue;

                    case 0x01:
                        // bne
                        if ((rs1|0) == (rs2|0)) continue;
                        fence = ppc;
                        pc_change = 1;
                        imm = ((((ins >> 31) << 11) | (((ins >> 25) & 0x3F) << 4) | ((ins >> 8) & 0x0F) | (((ins >> 7) & 0x01) << 10)) << 1 );
                        pc = pcorigin + (ppc-ppcorigin)|0;
                        pc = pc + imm - 4|0;
                        continue;

                    case 0x04:
                        // blt
                        if ((rs1|0) >= (rs2|0)) continue;
                        fence = ppc;
                        pc_change = 1;
                        imm = ((((ins >> 31) << 11) | (((ins >> 25) & 0x3F) << 4) | ((ins >> 8) & 0x0F) | (((ins >> 7) & 0x01) << 10)) << 1 );
                        pc = pcorigin + (ppc-ppcorigin)|0;
                        pc = pc + imm - 4|0;
                        continue;

                    case 0x05:
                        // bge
                        if ((rs1|0) < (rs2|0)) continue;
                        fence = ppc;
                        pc_change = 1;
                        imm = ((((ins >> 31) << 11) | (((ins >> 25) & 0x3F) << 4) | ((ins >> 8) & 0x0F) | (((ins >> 7) & 0x01) << 10)) << 1 );
                        pc = pcorigin + (ppc-ppcorigin)|0;
                        pc = pc + imm - 4|0;
                        continue;

                    case 0x06:
                        // bltu
                        if ((rs1 >>> 0) >= (rs2 >>> 0)) continue;
                        fence = ppc;
                        pc_change = 1;
                        imm = ((((ins >> 31) << 11) | (((ins >> 25) & 0x3F) << 4) | ((ins >> 8) & 0x0F) | (((ins >> 7) & 0x01) << 10)) << 1 );
                        pc = pcorigin + (ppc-ppcorigin)|0;
                        pc = pc + imm - 4|0;
                        continue;

                    case 0x07:
                        // bgeu
                        if ((rs1 >>> 0) < (rs2 >>> 0)) continue;
                        fence = ppc;
                        pc_change = 1;
                        imm = ((((ins >> 31) << 11) | (((ins >> 25) & 0x3F) << 4) | ((ins >> 8) & 0x0F) | (((ins >> 7) & 0x01) << 10)) << 1 );
                        pc = pcorigin + (ppc-ppcorigin)|0;
                        pc = pc + imm - 4|0;
                        continue;

                    default:
                        DebugMessage(ERROR_INSTRUCTION_NOT_FOUND|0);
                        abort();
                        break;

                }
                continue;

            case 0x73:
                // csrrw, csrrs, csrrc, csrrwi, csrrsi, csrrci, ecall, eret, ebreak, mrts, wfi
                imm = (ins >>> 20);
                rs1 = r[((ins >> 13) & 0x7C) >> 2]|0;
                switch ((ins >> 12)&0x7) {

                    case 0x01:
                        // csrrw
                        r[((ins >> 5) & 0x7C) >> 2] = GetCSR(imm)|0;
                        SetCSR(imm, rs1);
                        r[0] = 0;
                        continue;

                    case 0x02:
                        // csrrs
                        r[((ins >> 5) & 0x7C) >> 2] = GetCSR(imm)|0;
                        SetCSR(imm, (GetCSR(imm)|0) | rs1);
                        r[0] = 0;
                        continue;

                    case 0x03:
                        // csrrc
                        r[((ins >> 5) & 0x7C) >> 2] = GetCSR(imm)|0;
                        SetCSR(imm, (GetCSR(imm)|0) & (~rs1));
                        r[0] = 0;
                        continue;

                    case 0x05:
                        // csrrwi
                        r[((ins >> 5) & 0x7C) >> 2] = GetCSR(imm)|0;
                        zimm = (ins >> 15) & 0x1F;
                        if ((zimm|0) != 0) SetCSR(imm, (zimm >> 0));
                        r[0] = 0;
                        continue;

                    case 0x06:
                        // csrrsi
                        r[((ins >> 5) & 0x7C) >> 2] = GetCSR(imm)|0;
                        zimm = (ins >> 15) & 0x1F;
                        if ((zimm|0) != 0) SetCSR(imm, (GetCSR(imm)|0) | (zimm >> 0));
                        r[0] = 0;
                        continue;

                    case 0x07:
                        // csrrci
                        r[((ins >> 5) & 0x7C) >> 2] = GetCSR(imm)|0;
                        zimm = (ins >> 15) & 0x1F;
                        if ((zimm|0) != 0) SetCSR(imm, (GetCSR(imm)|0) & ~(zimm >> 0));
                        r[0] = 0;
                        continue;

                    case 0x00:
                        // ecall, eret, ebreak, mrts, wfi
                        current_privilege_level = (csr[(csrp + CSR_MSTATUS)>>2] & 0x06) >> 1;
                        fence = ppc;
                        switch ((ins >> 20)&0xFFF) {
                            case 0x00:
                                // ecall
                                pc = pcorigin + (ppc-ppcorigin)|0;
                                switch (current_privilege_level|0) {
                                    case 0x00: // PRV_U
                                        Trap(CAUSE_ENVCALL_UMODE, pc - 4|0);
                                        break;

                                    case 0x01: // PRV_S
                                        Trap(CAUSE_ENVCALL_SMODE, pc - 4|0);
                                        break;

                                    case 0x02: // PRV_H
                                        Trap(CAUSE_ENVCALL_HMODE, pc - 4|0);
                                        abort();
                                        break;

                                    case 0x03: // PRV_M
                                        Trap(CAUSE_ENVCALL_MMODE, pc - 4|0);
                                        break;

                                    default:
                                        DebugMessage(ERROR_ECALL|0);
                                        abort();
                                        break;
                                }
                                continue;

                            case 0x001:
                                // ebreak
                                pc = pcorigin + (ppc-ppcorigin)|0;
                                Trap(CAUSE_BREAKPOINT, pc - 4|0);
                                continue;

                            case 0x100:
                                // eret
                                current_privilege_level = (csr[(csrp + CSR_MSTATUS)>>2] & 0x06) >> 1;
                                pc = pcorigin + (ppc-ppcorigin)|0;
                                if ((current_privilege_level|0) < (PRV_S|0)) {
                                    DebugMessage(ERROR_ERET_PRIV|0);
                                    abort();
                                    break;
                                }
                                PopPrivilegeStack();

                                switch (current_privilege_level|0) {

                                    case 0x01: //PRV_S
                                        //DebugMessage("eret PRV_S -"+ utils.ToHex(ins));
                                        pc = csr[(csrp + CSR_SEPC)>>2]|0;
                                        break;

                                    case 0x02: //PRV_H
                                        //DebugMessage("Not supported eret PRV_H -"+ utils.ToHex(ins));
                                        pc = csr[(csrp + CSR_HEPC)>>2]|0;
                                        abort();
                                        break;

                                    case 0x03: //PRV_M
                                        //DebugMessage("eret PRV_M -"+ utils.ToHex(ins));
                                        pc = csr[(csrp + CSR_MEPC)>>2]|0;
                                        break;

                                    default:
                                        DebugMessage(ERROR_ERET|0);
                                        abort();
                                        break;
                                }
                                pc_change = 1;
                                InvalidateTLB();
                                continue;

                            case 0x102:
                                // wfi
                                interrupts = csr[(csrp + CSR_MIE)>>2] & csr[(csrp + CSR_MIP)>>2];
/*
                                if (!interrupts)
                                if ((queue_status|0) == 0)
                                    return steps|0;
                                break;
*/
                                continue;

                            case 0x305:
                                // mrts
                                pc = pcorigin + (ppc-ppcorigin)|0;
                                if ((current_privilege_level|0) != (PRV_M|0)) {
                                    DebugMessage(ERROR_MRTS|0);
                                    abort();
                                    break;
                                }
                                csr[(csrp + CSR_MSTATUS)>>2] = (csr[(csrp + CSR_MSTATUS)>>2] & ~0x6) | 0x02; //Setting the Privilage level to Supervisor
                                csr[(csrp + CSR_SBADADDR)>>2] = csr[(csrp + CSR_MBADADDR)>>2];
                                csr[(csrp + CSR_SCAUSE)>>2] = csr[(csrp + CSR_MCAUSE)>>2];
                                csr[(csrp + CSR_SEPC)>>2] = csr[(csrp + CSR_MEPC)>>2];
                                pc = csr[(csrp + CSR_STVEC)>>2]|0;
                                InvalidateTLB();
                                pc_change = 1;
                                continue;

                            case 0x101:
                                // sfence.vm
                                InvalidateTLB();
                                continue;

                            default:
                                DebugMessage(ERROR_INSTRUCTION_NOT_FOUND|0);
                                abort();
                                break;

                        }
                        continue;

                    default:
                        DebugMessage(ERROR_INSTRUCTION_NOT_FOUND|0);
                        abort();
                        break;

                }
                continue;

            case 0x07:
                // flw, fld
                vaddr = (r[((ins >> 13) & 0x7C) >> 2]|0) + (ins >> 20)|0;
                switch ((ins >> 12)&0x7) {

                    case 0x02:
                        // flw
                        if ((float_read32tlb_index ^ vaddr) & 0xFFFFF000) {
                            paddr = TranslateVM(vaddr|0, VM_READ)|0;
                            if ((paddr|0) == -1) break;
                            float_read32tlb_index = vaddr|0;
                            float_read32tlb_entry = (paddr ^ vaddr) & 0xFFFFF000;
                        }
                        paddr = float_read32tlb_entry ^ vaddr;
                        r[0] = ram[(ramp + paddr) >> 2]|0;
                        f[(fp + (((ins >> 7) & 0x1F) << 3)) >> 3] = +ff[0];
                        r[0] = 0;
                        continue;

                    case 0x03:
                        // fld
                        if ((float_read64tlb_index ^ vaddr) & 0xFFFFF000) {
                            paddr = TranslateVM(vaddr|0, VM_READ)|0;
                            if ((paddr|0) == -1) continue;
                            float_read64tlb_index = vaddr|0;
                            float_read64tlb_entry = (paddr ^ vaddr) & 0xFFFFF000;
                        }
                        paddr = float_read64tlb_entry ^ vaddr;
                        fi[(fip + (((ins >> 7) & 0x1F) << 3) + 0) >> 2] = ram[(ramp + paddr + 0) >> 2]|0;
                        fi[(fip + (((ins >> 7) & 0x1F) << 3) + 4) >> 2] = ram[(ramp + paddr + 4) >> 2]|0;
                        continue;

                    default:
                        DebugMessage(ERROR_INSTRUCTION_NOT_FOUND|0);
                        DebugMessage(ins|0);
                        abort();
                        break;

                }
                continue;

            case 0x27:
                // fsw, fsd
                vaddr = (r[((ins >> 13) & 0x7C) >> 2]|0) + ((((ins >> 25) << 5) | ((ins >> 7) & 0x1F)))|0;
                switch ((ins >> 12)&0x7) {

                    case 0x02:
                        // fsw
                        ff[0] = +f[(fp + (((ins >> 20) & 0x1F) << 3)) >> 3];
                        if ((float_store32tlb_index ^ vaddr) & 0xFFFFF000) {
                            paddr = TranslateVM(vaddr|0, VM_READ)|0;
                            if ((paddr|0) == -1) continue;
                            float_store32tlb_index = vaddr|0;
                            float_store32tlb_entry = (paddr ^ vaddr) & 0xFFFFF000;
                        }
                        paddr = float_store32tlb_entry ^ vaddr;
                        ram[(ramp + paddr) >> 2] = r[0]|0;
                        r[0] = 0;
                        continue;

                    case 0x03:
                        // fsd
                        if ((float_store64tlb_index ^ vaddr) & 0xFFFFF000) {
                            paddr = TranslateVM(vaddr|0, VM_READ)|0;
                            if ((paddr|0) == -1) continue;
                            float_store64tlb_index = vaddr|0;
                            float_store64tlb_entry = (paddr ^ vaddr) & 0xFFFFF000;
                        }
                        paddr = float_store64tlb_entry ^ vaddr;
                        ram[(ramp + paddr + 0) >> 2] = fi[(fip + (((ins >> 20) & 0x1F) << 3) + 0) >> 2]|0;
                        ram[(ramp + paddr + 4) >> 2] = fi[(fip + (((ins >> 20) & 0x1F) << 3) + 4) >> 2]|0;
                        continue;

                    default:
                        DebugMessage(ERROR_INSTRUCTION_NOT_FOUND|0);
                        DebugMessage(ins|0);
                        abort();
                        break;

                }
                continue;

            case 0x53:
                // fadd.s, fsub.s
                switch ((ins >> 25)&0x7F) {

                    case 0x00:  //fadd.s
                    case 0x01:  //fadd.d
                        fs1 = (+f[(fp + (((ins >> 15) & 0x1F) << 3)) >> 3]);
                        fs2 = (+f[(fp + (((ins >> 20) & 0x1F) << 3)) >> 3]);
                        f[(fp + (((ins >> 7) & 0x1F) << 3)) >> 3] = (+fs1) + (+fs2);
                        continue;

                    case 0x04: //fsub.s
                    case 0x05: //fsub.d
                        fs1 = (+f[(fp + (((ins >> 15) & 0x1F) << 3)) >> 3]);
                        fs2 = (+f[(fp + (((ins >> 20) & 0x1F) << 3)) >> 3]);
                        f[(fp + (((ins >> 7) & 0x1F) << 3)) >> 3] = (+fs1) - (+fs2);
                        continue;

                    case 0x50:
                    case 0x51:
                        //fcmp.s, fcmp.d
                        fs1 = (+f[(fp + (((ins >> 15) & 0x1F) << 3)) >> 3]);
                        fs2 = (+f[(fp + (((ins >> 20) & 0x1F) << 3)) >> 3]);
                        switch ((ins >> 12) & 0x7) {
                            case 0x0:
                                // fle
                                if ((+fs1) <= (+fs2))
                                    r[((ins >> 5) & 0x7C) >> 2] = 1;
                                else
                                    r[((ins >> 5) & 0x7C) >> 2] = 0;
                                continue;

                            case 0x1:
                                // flt
                                if ((+fs1) < (+fs2))
                                    r[((ins >> 5) & 0x7C) >> 2] = 1;
                                else
                                    r[((ins >> 5) & 0x7C) >> 2] = 0;
                                continue;

                            case 0x2:
                                // feq
                                if ((+fs1) == (+fs2))
                                    r[((ins >> 5) & 0x7C) >> 2] = 1;
                                else
                                    r[((ins >> 5) & 0x7C) >> 2] = 0;
                                continue;

                            default:
                                DebugMessage(ERROR_INSTRUCTION_NOT_FOUND|0);
                                DebugMessage(ins|0);
                                abort();
                                break;
                        }
                        continue;

                    case 0x20: // fcvt.s.d
                    case 0x21: // fcvt.d.s
                        f[(fp + (((ins >> 7) & 0x1F) << 3)) >> 3] = 
                            (+f[(fp + (((ins >> 15) & 0x1F) << 3)) >> 3]);
                        continue;

                    case 0x60:
                        // fcvt.w.s
                        r[((ins >> 5) & 0x7C) >> 2] = ~~floor(+f[(fp + (((ins >> 15) & 0x1F) << 3)) >> 3]);
                        continue;

                    case 0x68:
                    case 0x69:
                        // fcvt.s.w, fcvt.d.w
                        f[(fp + (((ins >> 7) & 0x1F) << 3)) >> 3] = +(r[((ins >> 13) & 0x7C) >> 2]|0);
                        continue;

                    case 0x08: //fmul.s
                    case 0x09: //fmul.d
                        fs1 = (+f[(fp + (((ins >> 15) & 0x1F) << 3)) >> 3]);
                        fs2 = (+f[(fp + (((ins >> 20) & 0x1F) << 3)) >> 3]);
                        f[(fp + (((ins >> 7) & 0x1F) << 3)) >> 3] = +(+fs1)*(+fs2);
                        continue;

                    case 0x10: // single precision
                    case 0x11: // double precision
                        // fsgnj
                        fs1 = (+f[(fp + (((ins >> 15) & 0x1F) << 3)) >> 3]);
                        fs2 = (+f[(fp + (((ins >> 20) & 0x1F) << 3)) >> 3]);
                        switch ((ins >> 12) & 7) {
                            case 0:
                                // fsgnj.d, also used for fmv.d
                                f[(fp + (((ins >> 7) & 0x1F) << 3)) >> 3] = ((+fs2)<(+0))?-(+MathAbs(+fs1)):(+MathAbs(+fs1));
                                continue;

                            case 1:
                                // fsgnjn.d
                                f[(fp + (((ins >> 7) & 0x1F) << 3)) >> 3] = ((+fs2)<(+0))?+MathAbs(+fs1):-(+MathAbs(+fs1));
                                continue;

                            case 2:
                                // fsgnjx.d

                                if (((+fs1)*(+fs2)) < (+0)) {
                                    f[(fp + (((ins >> 7) & 0x1F) << 3)) >> 3] = -(+MathAbs(+fs1));
                                } else {
                                    f[(fp + (((ins >> 7) & 0x1F) << 3)) >> 3] = +(+MathAbs(+fs1));
                                }
                                continue;

                            default:
                                DebugMessage(ERROR_INSTRUCTION_NOT_FOUND|0);
                                DebugMessage(ins|0);
                                abort();
                        }
                        continue;

                    case 0x61:
                        // fcvt.w.d
                        r[((ins >> 5) & 0x7C) >> 2] = (~~+f[(fp + (((ins >> 15) & 0x1F) << 3)) >> 3]);
                        continue;

                    case 0x78:
                        // fmv.s.x
                        rs1 = r[((ins >> 13) & 0x7C) >> 2]|0;
                        r[0] = rs1;
                        f[(fp + (((ins >> 7) & 0x1F) << 3)) >> 3] = +ff[0];
                        r[0] = 0;
                        continue;


                    default:
                        DebugMessage(ERROR_INSTRUCTION_NOT_FOUND|0);
                        DebugMessage(ins|0);
                        abort();
                        break;
                }
                continue;

            case 0x43:
                // fmadd.d, fmadd.s
                fs1 = (+f[(fp + (((ins >> 15) & 0x1F) << 3)) >> 3]);
                fs2 = (+f[(fp + (((ins >> 20) & 0x1F) << 3)) >> 3]);
                fs3 = (+f[(fp + (((ins >> 27) & 0x1F) << 3)) >> 3]);
                f[(fp + (((ins >> 7) & 0x1F) << 3)) >> 3] = fs1 * fs2 + fs3;
                continue;

            case 0x47:
                // fmsub.d, fmsub.s
                fs1 = (+f[(fp + (((ins >> 15) & 0x1F) << 3)) >> 3]);
                fs2 = (+f[(fp + (((ins >> 20) & 0x1F) << 3)) >> 3]);
                fs3 = (+f[(fp + (((ins >> 27) & 0x1F) << 3)) >> 3]);
                f[(fp + (((ins >> 7) & 0x1F) << 3)) >> 3] = fs1 * fs2 - fs3;
                continue;

            case 0x4B:
                // fnmadd.d, fnmadd.s
                fs1 = (+f[(fp + (((ins >> 15) & 0x1F) << 3)) >> 3]);
                fs2 = (+f[(fp + (((ins >> 20) & 0x1F) << 3)) >> 3]);
                fs3 = (+f[(fp + (((ins >> 27) & 0x1F) << 3)) >> 3]);
                f[(fp + (((ins >> 7) & 0x1F) << 3)) >> 3] = -(fs1 * fs2 + fs3);
                continue;

            case 0x4F:
                // fnmsub.d, fnmsub.s
                fs1 = (+f[(fp + (((ins >> 15) & 0x1F) << 3)) >> 3]);
                fs2 = (+f[(fp + (((ins >> 20) & 0x1F) << 3)) >> 3]);
                fs3 = (+f[(fp + (((ins >> 27) & 0x1F) << 3)) >> 3]);
                f[(fp + (((ins >> 7) & 0x1F) << 3)) >> 3] = -(fs1 * fs2 - fs3);
                continue;

            case 0x2F:
                // amoswap, amoadd, amoxor, amoand, amoor, amomin, amomax, amominu, amomaxu
                rs1 = r[((ins >> 13) & 0x7C) >> 2]|0;
                rs2 = r[((ins >> 18) & 0x7C) >> 2]|0;
                paddr = TranslateVM(rs1|0, VM_READ)|0;
                if ((paddr|0) == -1) continue;
                switch ((ins >> 27)&0x1F) {

                    case 0x01:
                        // amoswap
                        r[((ins >> 5) & 0x7C) >> 2] = ram[(ramp + paddr) >> 2]|0;
                        ram[(ramp + paddr) >> 2] = rs2|0;
                        paddr = TranslateVM(rs1|0, VM_WRITE)|0;
                        if ((paddr|0) == -1) continue;
                        r[0] = 0;
                        continue;

                    case 0x00:
                        // amoadd
                        r[((ins >> 5) & 0x7C) >> 2] = ram[(ramp + paddr) >> 2]|0;
                        paddr = TranslateVM(rs1|0, VM_WRITE)|0;
                        if ((paddr|0) == -1) continue;
                        ram[(ramp + paddr) >> 2] = ((r[((ins >> 5) & 0x7C) >> 2]|0) + (rs2|0))|0;
                        r[0] = 0;
                        continue;

                    case 0x04:
                        // amoxor
                        r[((ins >> 5) & 0x7C) >> 2] = ram[(ramp + paddr) >> 2]|0;
                        paddr = TranslateVM(rs1|0, VM_WRITE)|0;
                        if ((paddr|0) == -1) continue;
                        ram[(ramp + paddr) >> 2] = ((r[((ins >> 5) & 0x7C) >> 2]|0) ^ (rs2|0))|0;
                        r[0] = 0;
                        continue;

                    case 0x0C:
                        // amoand
                        r[((ins >> 5) & 0x7C) >> 2] = ram[(ramp + paddr) >> 2]|0;
                        paddr = TranslateVM(rs1|0, VM_WRITE)|0;
                        if ((paddr|0) == -1) continue;
                        ram[(ramp + paddr) >> 2] = ((r[((ins >> 5) & 0x7C) >> 2]|0) & (rs2|0))|0;
                        r[0] = 0;
                        continue;

                    case 0x08:
                        // amoor
                        r[((ins >> 5) & 0x7C) >> 2] = ram[(ramp + paddr) >> 2]|0;
                        paddr = TranslateVM(rs1|0, VM_WRITE)|0;
                        if ((paddr|0) == -1) continue;
                        ram[(ramp + paddr) >> 2] = ((r[((ins >> 5) & 0x7C) >> 2]|0) | (rs2|0))|0;
                        r[0] = 0;
                        continue;

                    case 0x10:
                        // amomin
                        r[((ins >> 5) & 0x7C) >> 2] = ram[(ramp + paddr) >> 2]|0;
                        if ((rs2 >> 0) > (r[((ins >> 5) & 0x7C) >> 2] >> 0))
                            r[0] = r[((ins >> 5) & 0x7C) >> 2];
                        else
                            r[0] = rs2;
                        paddr = TranslateVM(rs1|0, VM_WRITE)|0;
                        if ((paddr|0) == -1) continue;
                        ram[(ramp + paddr) >> 2] = r[0]|0;
                        r[0] = 0;
                        continue;

                   case 0x14:
                        // amomax
                        r[((ins >> 5) & 0x7C) >> 2] = ram[(ramp + paddr) >> 2]|0;
                        if ((rs2 >> 0) < (r[((ins >> 5) & 0x7C) >> 2] >> 0))
                            r[0] = r[((ins >> 5) & 0x7C) >> 2];
                        else
                            r[0] = rs2;
                        paddr = TranslateVM(rs1|0, VM_WRITE)|0;
                        if ((paddr|0) == -1) continue;
                        ram[(ramp + paddr) >> 2] = r[0]|0;
                        r[0] = 0;
                        continue;

                    case 0x18:
                        // amominu
                        r[((ins >> 5) & 0x7C) >> 2] = ram[(ramp + paddr) >> 2]|0;
                        if ((rs2 >>> 0) > (r[((ins >> 5) & 0x7C) >> 2] >>> 0))
                            r[0] = r[((ins >> 5) & 0x7C) >> 2];
                        else
                            r[0] = rs2;
                        paddr = TranslateVM(rs1|0, VM_WRITE)|0;
                        if ((paddr|0) == -1) continue;
                        ram[(ramp + paddr) >> 2] = r[0]|0;
                        r[0] = 0;
                        continue;

                    case 0x1C:
                        // amomaxu
                        r[((ins >> 5) & 0x7C) >> 2] = ram[(ramp + paddr) >> 2]|0;
                        if ((rs2 >>> 0) < (r[((ins >> 5) & 0x7C) >> 2] >>> 0))
                            r[0] = r[((ins >> 5) & 0x7C) >> 2];
                        else
                            r[0] = rs2;
                        paddr = TranslateVM(rs1|0, VM_WRITE)|0;
                        if ((paddr|0) == -1) continue;
                        ram[(ramp + paddr) >> 2] = r[0]|0;
                        r[0] = 0;
                        continue;

                    case 0x02:
                        // lr.d
                        r[((ins >> 5) & 0x7C) >> 2] = ram[(ramp + paddr) >> 2]|0;
                        amoaddr = rs1;
                        amovalue = r[((ins >> 5) & 0x7C) >> 2]|0;
                        r[0] = 0;
                        continue;

                    case 0x03:
                        // sc.d
                        if ((rs1|0) != (amoaddr|0)) {
                            r[((ins >> 5) & 0x7C) >> 2] = 0x01;
                            continue;
                        }
                        if ((ram[(ramp + paddr) >> 2]|0) != (amovalue|0)) {
                            r[((ins >> 5) & 0x7C) >> 2] = 0x01;
                            continue;
                        }
                        r[((ins >> 5) & 0x7C) >> 2] = 0x00;
                        paddr = TranslateVM(rs1, VM_WRITE)|0;
                        if ((paddr|0) == -1) continue;
                        ram[(ramp + paddr) >> 2] = rs2|0;
                        r[0] = 0;
                        continue;

                    default:
                        DebugMessage(ERROR_ATOMIC_INSTRUCTION|0);
                        abort();
                        break;

                }
                continue;

            case 0x0F:
                //fence
                continue;

            case 0x0: // this line removes one assembler instruction (sub) from the main loop
            default:
                DebugMessage(ERROR_INSTRUCTION_NOT_FOUND|0);
                DebugMessage(ins|0);
                abort();
                break;
        } // end of switch

    } else { // fence

        // pc_change is set to one when pc is calculated in instrctions like branch, jump etc
        if (!(pc_change|0)) pc = pcorigin + (ppc-ppcorigin)|0;

        dsteps = dsteps - ((ppc-ppcorigin) >> 2)|0;
        if ((dsteps|0) < 0) {

            dsteps = dsteps + 64|0;
            steps = steps - 64|0;

            // fence == ppc still valid, so this part will be executed automatically next time
            if ((steps|0) < 0) return 0;

            delta = (csr[(csrp + CSR_MTIMECMP)>>2]|0) - ticks | 0;
            delta = delta + ((delta|0)<0?0xFFFFFFFF:0x0) | 0;
            ticks = ticks + clockspeed|0;

            if ((delta|0) < (clockspeed|0)) {
                csr[(csrp + CSR_MIP)>>2] = csr[(csrp + CSR_MIP)>>2] | 0x20;
            }

            // check for interrupts
            current_privilege_level = (csr[(csrp + CSR_MSTATUS)>>2] & 0x06) >> 1;

            interrupts = csr[(csrp + CSR_MIE)>>2] & csr[(csrp + CSR_MIP)>>2];
            ie = csr[(csrp + CSR_MSTATUS)>>2] & 0x01;

            if (((current_privilege_level|0) < 3) | (((current_privilege_level|0) == 3) & (ie|0))) {
                if (((interrupts|0) & 0x8)) {
                    Trap(CAUSE_SOFTWARE_INTERRUPT, pc);
                    continue;
                } else
                if (queue_status|0) {
                    Trap(CAUSE_HOST_INTERRUPT, pc);
                    queue_status = 0;
                    continue;
                }
            }
            if (((current_privilege_level|0) < 1) | (((current_privilege_level|0) == 1) & (ie|0))) {
                if (((interrupts|0) & 0x2)) {
                    Trap(CAUSE_SOFTWARE_INTERRUPT, pc);
                    continue;
                } else
                if (((interrupts|0) & 0x20)) {
                     Trap(CAUSE_TIMER_INTERRUPT, pc);
                     continue;
                }
            }
        } // dsteps

        // get new instruction pointer
        if ((instlb_index ^ pc) & 0xFFFFF000) {
            ppc = TranslateVM(pc|0, VM_FETCH)|0;
            if ((ppc|0) == -1) {
                ppc = fence;
                continue;
            }
            instlb_index = pc;
            instlb_entry = (ppc ^ pc) & 0xFFFFF000;
        }

        ppc = ramp + (instlb_entry ^ pc)| 0;
        ppcorigin = ppc;
        pcorigin = pc;
        fence  = ((ppc >> 12) + 1) << 12; // next page
        pc_change = 0;

    } // end of fence
    } // main loop

    return 0;
};

return {
    Reset: Reset,
    Init: Init,
    InvalidateTLB: InvalidateTLB,
    Step: Step,
    TranslateVM: TranslateVM,
    GetCSR: GetCSR,
    SetCSR: SetCSR,
    GetTimeToNextInterrupt: GetTimeToNextInterrupt,
    ProgressTime: ProgressTime,
    GetTicks: GetTicks,
    GetPC: GetPC,
    AnalyzeImage: AnalyzeImage,
    RaiseInterrupt: RaiseInterrupt,
    ClearInterrupt: ClearInterrupt
};

}

module.exports = FastCPU;
