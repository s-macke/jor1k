// -------------------------------------------------
// -------------------- CPU ------------------------
// -------------------------------------------------
var message = require('../messagehandler');
var utils = require('../utils');
var DebugIns = require('./disassemble.js');


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
var IsQueueEmpty = foreign.IsQueueEmpty;


var PRV_U = 0x00;
var PRV_S = 0x01;
var PRV_H = 0x02;
var PRV_M = 0x03;

var VM_READ  = 0;
var VM_WRITE = 1;
var VM_FETCH = 2;

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


var CSR_CYCLES = 0x3000;
var CSR_CYCLEW = 0x2400;


var CSR_FFLAGS    = 0x1;
var CSR_FRM       = 0x2;
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

var r = new stdlib.Int32Array(heap); // registers
var rp = 0x00; //Never used

var f = new stdlib.Float64Array(heap); // registers
var fp = 0x10;

var fi = new stdlib.Int32Array(heap); // for copying operations
var fip = 0x20;

var ff = new stdlib.Float32Array(heap); // the zero register is used to convert to single precision
var ffp = 0x00; //Never used

var csr = new stdlib.Int32Array(heap);
var csrp = 0x2000;

var pc = 0x200;
var ticks = 0;
var amoaddr = 0,amovalue = 0;

var fence = 0x01;
var ppc = 0x200;

function Init() {
    Reset();
}

function Reset() {
    ticks = 0;
    csr[(csrp + CSR_MSTATUS)>>2]  = 0x96; // 1001 0110 - All Interrupts Disabled, FPU disabled 
    csr[(csrp + CSR_MTOHOST)>>2]  =  0x780;
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

function InvalidateTLB() {
}

function GetTimeToNextInterrupt() {
    return 10;
}

function GetTicks() {
    return ticks;
}

function ProgressTime(delta) {
    ticks += delta;
}


function AnalyzeImage() // we haveto define these to copy the cpus
{
}

function CheckForInterrupt() {
};

function RaiseInterrupt(line, cpuid) {
    DebugMessage("raise int " + line);
};

function ClearInterrupt(line, cpuid) {
};

function Trap(cause, current_pc) {

    var current_privilege_level = (csr[(csrp + CSR_MSTATUS)>>2] & 0x06) >> 1;
    PushPrivilegeStack();
    csr[(csrp + CSR_MEPC)>>2] = current_pc;
    csr[(csrp + CSR_MCAUSE)>>2] = cause;
    pc = (0x100 + 0x40*current_privilege_level)|0;
    fence = 1;  
};

function MemTrap(addr, op) {
    csr[(csrp + CSR_MBADADDR)>>2] = addr;
    switch(op) {
        case VM_READ:
            Trap(CAUSE_LOAD_ACCESS_FAULT, pc - 4|0);
            break;

        case VM_WRITE:
            Trap(CAUSE_STORE_ACCESS_FAULT, pc - 4|0);
            break;

        case VM_FETCH:
            Trap(CAUSE_INSTRUCTION_ACCESS_FAULT, pc);
            break;
    }
}



function CheckVMPrivilege(type, op) {

    var priv = (csr[(csrp + CSR_MSTATUS)>>2] & 0x06) >> 1;

    switch(type) {

        case 2: 
            if (op == VM_READ) return true;
            if ((priv == PRV_U) && (op == VM_FETCH)) return true;
            return false;
            break;

        case 3: 
            if (!( (priv == PRV_S) && (op == VM_FETCH) ) ) return true;
            break;

        case 4:
            if (op == VM_READ) return true;
            return false;
            break;

        case 5:
            if (op != VM_FETCH) return true;
            break;

        case 6:
            if (op != VM_WRITE) return true;
            break;

        case 7:
            return true;
            break;

        case 13:
            if ((priv == PRV_S) && (op != VM_FETCH)) return true;
            break;

        case 14:
            if ((priv == PRV_S) && (op != VM_WRITE)) return true;
            break;

        case 15: 
            if (priv == PRV_S) return true;
            break;

    }

    DebugMessage("Inside CheckVMPrivilege for PC "+utils.ToHex(pc) + " and type " + type + " and op " + op);
    abort();
    return false;
}


function TranslateVM(addr, op) {
    var vm = (csr[(csrp + CSR_MSTATUS)>>2] >> 17) & 0x1F;
    var current_privilege_level = (csr[(csrp + CSR_MSTATUS)>>2] & 0x06) >> 1;
    var i = 1; //i = LEVELS -1 and LEVELS = 2 in a 32 bit System

    // vm bare mode
    if(vm == 0 || current_privilege_level == PRV_M) return addr;

    // hack, open mmio by direct mapping
    //if ((addr>>>28) == 0x9) return addr;

    // only RV32 supported
    if(vm != 8) {
        DebugMessage("unkown VM Mode " + vm + " at PC " + utils.ToHex(pc));
        abort();
    }

    // LEVEL 1
    var offset = addr & 0xFFF;
    var page_num = (addr >>> 22);

    var frame_num = Read32(csr[(csrp + CSR_SPTBR)>>2] + (page_num << 2));
    var type = ((frame_num >> 1) & 0xF);
    var valid = (frame_num & 0x01);

    if (valid == 0) {
        //DebugMessage("Unsupported valid field " + valid + " or invalid entry in PTE at PC "+utils.ToHex(pc) + " pl:" + current_privilege_level + " addr:" + utils.ToHex(addr) + " op:"+op);
        //abort();
        MemTrap(addr, op);
        return -1;
    }
    if (type >= 2) {

        if (!CheckVMPrivilege(type,op)) {
            DebugMessage("Error in TranslateVM: Unhandled trap");
            abort();
        }
/*
        var updated_frame_num = frame_num;
        if(op == VM_READ)
            updated_frame_num = (frame_num | 0x20);
        else if(op == VM_WRITE)
            updated_frame_num = (frame_num | 0x60);
        Write32(csr[CSR_SPTBR] + (page_num << 2),updated_frame_num);
*/
        return (((frame_num >> 10) | ((addr >> 12) & 0x3FF)) << 12) | offset;
    }

    // LEVEL 2
    //DebugMessage("Second level MMU");
    i = i - 1;
    var offset = addr & 0xFFF;
    var new_sptbr = (frame_num & 0xFFFFFC00) << 2;
    var new_page_num = (addr >> 12) & 0x3FF;
    var new_frame_num = Read32(new_sptbr + (new_page_num << 2));
    var new_type = ((new_frame_num >> 1) & 0xF);
    var new_valid = (new_frame_num & 0x01);

    if (new_valid == 0) {
        MemTrap(addr, op);
        return -1;
    }

    if (!CheckVMPrivilege(new_type, op)) {
        //DebugMessage("Error in TranslateVM: Unhandled trap");
        //abort();
        MemTrap(addr, op);
        return -1;
    }

/*
    var updated_frame_num = new_frame_num;
    if(op == VM_READ)
        updated_frame_num = (new_frame_num | 0x20);
    else if(op == VM_WRITE)
        updated_frame_num = (new_frame_num | 0x60);
    Write32(new_sptbr + (new_page_num << 2),updated_frame_num);
*/

    return ((new_frame_num >> 10) << 12) | offset;
};


function SetCSR(addr,value) {

    addr = addr << 2;
    switch(addr)
    {
        case CSR_FCSR:
            csr[(csrp + addr)>>2] = value;
            break;

        case CSR_MDEVCMDTOHOST:
            csr[(csrp + addr)>>2] = value;
            WriteDEVCMDToHost(value);
            break;

        case CSR_MDEVCMDFROMHOST:
            csr[(csrp + addr)>>2] = value;
            WriteDEVCMDFromHost(value);
            break;

        case CSR_MTOHOST:
            csr[(csrp + addr)>>2] =  value;
            WriteToHost(value);
            break;

        case CSR_MTOHOST_TEMP: //only temporary for the patched pk.
            Write8(0x90000000 >> 0, value);
            if (value == 0xA) Write8(0x90000000 >> 0, 0xD);
            break;

        case CSR_MFROMHOST:
            csr[(csrp + addr)>>2] = value;
            WriteFromHost(value);
            break;

        case CSR_MSTATUS:
            csr[(csrp + addr)>>2] = value;
            break;

        case CSR_MCPUID:
            //csr[addr] = value;
            break;

        case CSR_MIMPID:
            csr[(csrp + addr)>>2] = value;
            break;

        case CSR_MHARTID:
            csr[(csrp + addr)>>2] = value;
            break;

        case CSR_MTVEC:
            csr[(csrp + addr)>>2] = value;
            break;

        case CSR_MIP:
            //csr[addr] = value;
            var mask = 0x2 | 0x08; //mask = MIP_SSIP | MIP_MSIP
            csr[(csrp + addr)>>2] = (csr[(csrp + addr)>>2] & ~mask) | (value & mask);
            break;

        case CSR_MIE:
            //csr[addr] = value;
            var mask = 0x2 | 0x08 | 0x20; //mask = MIP_SSIP | MIP_MSIP | MIP_STIP
            csr[(csrp + addr)>>2] = (csr[(csrp + addr)>>2] & ~mask) | (value & mask);
            break;

        case CSR_SEPC:
        case CSR_MEPC:
            csr[(csrp + addr)>>2] = value;
            break;

        case CSR_MCAUSE:
            csr[(csrp + addr)>>2] = value;
            break;

        case CSR_SCAUSE:
            csr[(csrp + addr)>>2] = value;
            break;

        case CSR_MBADADDR:
            csr[(csrp + addr)>>2] = value;
            break;

        case CSR_SBADADDR:
            csr[(csrp + addr)>>2] = value;
            break;

        case CSR_SSTATUS:
            csr[(csrp + CSR_SSTATUS)>>2] = value;
            csr[(csrp + CSR_MSTATUS)>>2] &= ~0x1F039; 
            csr[(csrp + CSR_MSTATUS)>>2] |= (csr[(csrp + CSR_SSTATUS)>>2] & 0x01); //IE0
            csr[(csrp + CSR_MSTATUS)>>2] |= (csr[(csrp + CSR_SSTATUS)>>2] & 0x08); //IE1
            csr[(csrp + CSR_MSTATUS)>>2] |= (csr[(csrp + CSR_SSTATUS)>>2] & 0x10); //PRV1
            csr[(csrp + CSR_MSTATUS)>>2] |= (csr[(csrp + CSR_SSTATUS)>>2] & 0xF000); //FS,XS
            csr[(csrp + CSR_MSTATUS)>>2] |= (csr[(csrp + CSR_SSTATUS)>>2] & 0x10000); //MPRV
            break; 

        case CSR_STVEC:
            csr[(csrp + addr)>>2] = value;
            break;

        case CSR_SIP:
            //csr[addr] = value;
            var mask = 0x2; //mask = MIP_SSIP
            csr[(csrp + CSR_MIP)>>2] = (csr[(csrp + CSR_MIP)>>2] & ~mask) | (value & mask);
            break;

        case CSR_SIE:
            //csr[addr] = value;
            var mask = 0x2 | 0x20; //mask = MIP_SSIP | MIP_STIP
            csr[(csrp + CSR_MIE)>>2] = (csr[(csrp + CSR_MIE)>>2] & ~mask) | (value & mask);
            break;

        case CSR_MSCRATCH:
            csr[(csrp + addr)>>2] = value;
            break;

        case CSR_SSCRATCH:
            csr[(csrp + addr)>>2] = value;
            break;

        case CSR_CYCLEW:
            csr[(csrp + addr)>>2] = value;
            break;

        case CSR_CYCLES:
            ticks = value;
            csr[(csrp + addr)>>2] = value;
            break;

        case CSR_MTIME:
        case CSR_STIME:
        case CSR_STIMEW:
            csr[(csrp + addr)>>2] = value;
            break;

        case CSR_MTIMEH:
        case CSR_STIMEH:
        case CSR_STIMEHW:
            csr[(csrp + addr)>>2] = value;
            break;

        case CSR_TIME:
        case CSR_TIMEW:
            csr[(csrp + addr)>>2] = value;
            break;

        case CSR_MTIMECMP:
        case CSR_STIMECMP:
            csr[(csrp + CSR_MIP)>>2] &= ~(0x20); //csr[CSR_MIP] &= ~MIP_STIP
            csr[(csrp + addr)>>2] = value;
            break;

        case CSR_SPTBR:
            csr[(csrp + addr)>>2] = value;
            break;

        default:
            csr[(csrp + addr)>>2] = value;
            DebugMessage("Error in SetCSR: PC "+utils.ToHex(pc)+" Address " + utils.ToHex(addr) + " unkown");
            abort();
            break;
    }
};

function GetCSR(addr) {

    var current_privilege_level = (csr[(csrp + CSR_MSTATUS)>>2] & 0x06) >> 1;
    addr = addr << 2;
    switch(addr)
    {
        case CSR_FCSR:
            return 0x0;
            break;

        case CSR_MDEVCMDTOHOST:
            return ReadDEVCMDToHost();
            break;

        case CSR_MDEVCMDFROMHOST:
            return ReadDEVCMDFromHost();
            break;

        case CSR_MTOHOST:
            return ReadToHost();
            break;

        case CSR_MTOHOST_TEMP: //only temporary for the patched pk.
            return 0x0;
            break;

        case CSR_MFROMHOST:
            return ReadFromHost();
            break;

        case CSR_MSTATUS:
            return csr[(csrp + addr)>>2];
            break;

        case CSR_MCPUID:
            return csr[(csrp + addr)>>2];
            break;

        case CSR_MIMPID:
            return csr[(csrp + addr)>>2];
            break;

        case CSR_MHARTID:
            return csr[(csrp + addr)>>2];
            break;

        case CSR_MTVEC:
            return csr[(csrp + addr)>>2];
            break;

        case CSR_MIE:
            return csr[(csrp + addr)>>2];
            break;

        case CSR_SEPC:
        case CSR_MEPC:
            return csr[(csrp + addr)>>2];
            break;

        case CSR_MCAUSE:
            return csr[(csrp + addr)>>2];
            break;

        case CSR_SCAUSE:
            return csr[(csrp + addr)>>2];
            break;

        case CSR_MBADADDR:
            return csr[(csrp + addr)>>2];
            break;

        case CSR_SBADADDR:
            return csr[(csrp + addr)>>2];
            break;

        case CSR_SSTATUS:
            //if (current_privilege_level == 0) Trap(CAUSE_ILLEGAL_INSTRUCTION);
            csr[(csrp + CSR_SSTATUS)>>2] = 0x00; 
            csr[(csrp + CSR_SSTATUS)>>2] |= (csr[(csrp + CSR_MSTATUS)>>2] & 0x01); //IE0
            csr[(csrp + CSR_SSTATUS)>>2] |= (csr[(csrp + CSR_MSTATUS)>>2] & 0x08); //IE1
            csr[(csrp + CSR_SSTATUS)>>2] |= (csr[(csrp + CSR_MSTATUS)>>2] & 0x10); //PRV1
            csr[(csrp + CSR_SSTATUS)>>2] |= (csr[(csrp + CSR_MSTATUS)>>2] & 0xF000); //FS,XS
            csr[(csrp + CSR_SSTATUS)>>2] |= (csr[(csrp + CSR_MSTATUS)>>2] & 0x10000); //MPRV
            return csr[(csrp + CSR_SSTATUS)>>2];
            break;

        case CSR_STVEC:
            return csr[(csrp + addr)>>2];
            break;

        case CSR_MIP:
            return csr[(csrp + addr)>>2];
            break;

        case CSR_MIE:
            return csr[(csrp + addr)>>2];
            break;

        case CSR_SIP: 
            return csr[(csrp + CSR_MIP)>>2] & (0x2 | 0x20);//(MIP_SSIP | MIP_STIP)
            break;

        case CSR_SIE: 
            return csr[(csrp + CSR_MIE)>>2] & (0x2 | 0x20);//(MIP_SSIP | MIP_STIP)
            break;

        case CSR_MSCRATCH:
            return csr[(csrp + addr)>>2];
            break;

        case CSR_SSCRATCH:
            return csr[(csrp + addr)>>2];
            break;

        case CSR_CYCLEW:
            return ticks;
            break;

        case CSR_CYCLES:
            return ticks;
            break;

        case CSR_MTIME:
        case CSR_STIME:
        case CSR_STIMEW:
            return ticks;
            break;

        case CSR_MTIMEH:
        case CSR_STIMEH:
        case CSR_STIMEHW:
            return (ticks) >> 32;
            break;

        case CSR_TIME:
        case CSR_TIMEW:
            return ticks;
            break;

        case CSR_MTIMECMP:
        case CSR_STIMECMP:
            return csr[(csrp + addr)>>2];
            break;
        
        case CSR_SPTBR:
            return csr[(csrp + addr)>>2];
            break;

        default:
            DebugMessage("Error in GetCSR: PC "+utils.ToHex(pc)+" Address " + utils.ToHex(addr) + " unkown");
            abort();
            return csr[(csrp + addr)>>2];
            break;
    }
   
};

function IMul(a,b) {

    var result = [0,0];

    a >>>= 0;
    b >>>= 0;

    if (a < 32767 && b < 65536) {
        result[0] = a * b;
        result[1] = (result[0] < 0) ? -1 : 0;
        return result;
    }

    var a00 = a & 0xFFFF, a16 = a >>> 16;
    var b00 = b & 0xFFFF, b16 = b >>> 16;

    var c00 = a00 * b00;
    var c16 = (c00 >>> 16) + (a16 * b00);
    var c32 = c16 >>> 16;
    c16 = (c16 & 0xFFFF) + (a00 * b16);
    c32 += c16 >>> 16;
    var c48 = c32 >>> 16;
    c32 = (c32 & 0xFFFF) + (a16 * b16);
    c48 += c32 >>> 16;

    result[0] = ((c16 & 0xFFFF) << 16) | (c00 & 0xFFFF);
    result[1] = ((c48 & 0xFFFF) << 16) | (c32 & 0xFFFF);
    return result;
};

function UMul(a,b) {

    var result = [0,0];

    if (a == 0) return result[0] = result[1] = 0, result;
    if (b == 0) return result[0] = result[1] = 0, result;

    a |= 0;
    b |= 0;

    if ((a >= -32768 && a <= 32767) && (b >= -32768 && b <= 32767)) {
        result[0] = a * b;
        result[1] = (result[0] < 0) ? -1 : 0;
        return result;
    }

    var doNegate = (a < 0) ^ (b < 0);

    result = IMul(Math.abs(a), Math.abs(b));

    if (doNegate) {
        result[0] = ~result[0];
        result[1] = ~result[1];
        result[0] = (result[0] + 1) | 0;
        if (result[0] == 0) result[1] = (result[1] + 1) | 0;
    }

    return result;
};

function SUMul(a,b) {

    var result = [0,0];

    if (a == 0) return result[0] = result[1] = 0, result;
    if (b == 0) return result[0] = result[1] = 0, result;

    a |= 0;
    b >>>= 0;

    if ((a >= -32768 && a <= 32767) && (b >= -32768 && b <= 32767)) {
        result[0] = a * b;
        result[1] = (result[0] < 0) ? -1 : 0;
        return result;
    }

    var doNegate = (a < 0) ^ (b < 0);

    result = IMul(Math.abs(a), Math.abs(b));

    if (doNegate) {
        result[0] = ~result[0];
        result[1] = ~result[1];
        result[0] = (result[0] + 1) | 0;
        if (result[0] == 0) result[1] = (result[1] + 1) | 0;
    }

    return result;
};


function PushPrivilegeStack(){

    var mstatus = csr[(csrp + CSR_MSTATUS)>>2];
    var privilege_level_stack =  (mstatus & 0xFFF);
    var new_privilege_level_stack = (((privilege_level_stack << 2) | PRV_M) << 1) & 0xFFF;
    csr[(csrp + CSR_MSTATUS)>>2] = (((mstatus >> 12) << 12) + new_privilege_level_stack) & 0xFFFEFFFF; //Last "and" to set mprv(bit 16) to zero
};

function PopPrivilegeStack(){

    var mstatus = csr[(csrp + CSR_MSTATUS)>>2];
    var privilege_level_stack =  (mstatus & 0xFFF);
    var new_privilege_level_stack = ((privilege_level_stack >>> 3) | ((PRV_U << 1) | 0x1) << 9);
    csr[(csrp + CSR_MSTATUS)>>2] = ((mstatus >> 12) << 12) + new_privilege_level_stack;
};

function Step(steps, clockspeed) {

    var rindex = 0x00;
    var findex = 0x00;
    var imm = 0x00;
    var imm1 = 0x00;
    var imm2 = 0x00;
    var imm3 = 0x00;
    var imm4 = 0x00;
    var zimm = 0x00;
    var mul=0x00;
    var quo=0x00;
    var rem=0x00;
    var rs1 = 0x0;
    var rs2 = 0x0;
    var fs1 = 0.0;
    var fs2 = 0.0;
    var paddr;
    
    do {
        r[0] = 0x00;

        var current_privilege_level = (csr[(csrp + CSR_MSTATUS)>>2] & 0x06) >> 1;

        ticks = ticks + 1|0;
        if (ticks == csr[(csrp + CSR_STIMECMP)>>2]) {
            csr[(csrp + CSR_MIP)>>2] = csr[(csrp + CSR_MIP)>>2] | 0x20;
        }
        var interrupts = csr[(csrp + CSR_MIE)>>2] & csr[(csrp + CSR_MIP)>>2];
        var ie = csr[(csrp + CSR_MSTATUS)>>2] & 0x01;
        if (interrupts) {

            if ((current_privilege_level < 3) || ((current_privilege_level == 3) && ie)) {
                if (interrupts & 0x8) {
                    Trap(CAUSE_SOFTWARE_INTERRUPT, pc);
                    continue;
                } else
                if (!IsQueueEmpty()) {
                    Trap(CAUSE_HOST_INTERRUPT, pc);
                    continue;
                }
            }
            if ((current_privilege_level < 1) || ((current_privilege_level == 1) && ie)) {
                if (interrupts & 0x2) {
                    Trap(CAUSE_SOFTWARE_INTERRUPT, pc);
                    continue;
                } else
                if (interrupts & 0x20) {
                     Trap(CAUSE_TIMER_INTERRUPT, pc);
                     continue;
                }
            }
        }

        if((pc & 0xFFF) == 0) fence = 1; //Checking if the physical pc has reached a page boundary
 
        if(fence == 1){
            ppc = TranslateVM(pc,VM_FETCH);
            if(ppc == -1)
                continue;
            fence = 0;
        }
        var ins = Read32(ppc);
        //DebugIns.Disassemble(ins,r,csr,pc);
        pc = pc + 4|0;
        ppc = ppc + 4|0;

        switch(ins&0x7F) {

            case 0x03:
                //lb, lh, lw, lbu, lhu
                switch((ins >> 12)&0x7) {
                    
                    case 0x00:
                        //lb
                        imm = (ins >> 20);
                        rs1 = r[(ins >> 15) & 0x1F];
                        rindex = (ins >> 7) & 0x1F;
                        paddr = TranslateVM(rs1 + imm|0, VM_READ);
                        if(paddr == -1) break;
                        r[rindex] = (Read8(paddr) << 24) >> 24;
                        break;

                    case 0x01:
                        //lh
                        imm = (ins >> 20);
                        rs1 = r[(ins >> 15) & 0x1F];
                        rindex = (ins >> 7) & 0x1F;
                        paddr = TranslateVM(rs1 + imm|0, VM_READ);
                        if(paddr == -1) break;
                        r[rindex] = (Read16(paddr) << 16) >> 16;
                        break;

                    case 0x02:
                        //lw
                        imm = (ins >> 20);
                        rs1 = r[(ins >> 15) & 0x1F];
                        rindex = (ins >> 7) & 0x1F;
                        if ((rs1+imm) & 3) {
                             DebugMessage("Error in lw: unaligned address");
                             abort();
                        }
                        paddr = TranslateVM(rs1 + imm|0, VM_READ);
                        if(paddr == -1) break;
                        r[rindex] = Read32(paddr);
                        break;

                    case 0x04:
                        //lbu
                        imm = (ins >> 20);
                        rs1 = r[(ins >> 15) & 0x1F];
                        rindex = (ins >> 7) & 0x1F;
                        paddr = TranslateVM(rs1 + imm|0, VM_READ);
                        if(paddr == -1) break;
                        r[rindex] = Read8(paddr) & 0xFF;
                        break;

                    case 0x05:
                        //lhu
                        imm = (ins >> 20);
                        rs1 = r[(ins >> 15) & 0x1F];
                        rindex = (ins >> 7) & 0x1F;
                        paddr = TranslateVM(rs1 + imm|0 ,VM_READ);
                        if(paddr == -1) break;
                        r[rindex] = Read16(paddr) & 0xFFFF;
                        break;

                    default:
                        DebugMessage("Error in safecpu: Instruction " + utils.ToHex(ins) + "not found");
                        abort();
                        break;

                }
                break;

            case 0x23:
                //sb, sh, sw
                imm1 = (ins >> 25);
                imm2 = (ins >> 7) & 0x1F;
                imm = (imm1 << 5) | imm2;
                switch((ins >> 12)&0x7) {
                    
                    case 0x00:
                        //sb
                        rs1 = r[(ins >> 15) & 0x1F];
                        rindex = (ins >> 20) & 0x1F;
                        paddr = TranslateVM(rs1 + imm|0,VM_WRITE);
                        if(paddr == -1) break;
                        Write8(paddr,(r[rindex] & 0xFF));
                        break;

                    case 0x01:
                        //sh
                        rs1 = r[(ins >> 15) & 0x1F];
                        rindex = (ins >> 20) & 0x1F;
                        paddr = TranslateVM(rs1 + imm|0,VM_WRITE);
                        if(paddr == -1) break;
                        Write16(paddr,(r[rindex] & 0xFFFF));
                        break;

                    case 0x02:
                        //sw
                        rs1 = r[(ins >> 15) & 0x1F];
                        rindex = (ins >> 20) & 0x1F;
                        if ((rs1+imm) & 3) {
                             DebugMessage("Error in sw: unaligned address");
                             abort();
                        }
                        paddr = TranslateVM(rs1 + imm|0,VM_WRITE);
                        if(paddr == -1) break;
                        Write32(paddr,r[rindex]);
                        break;

                    default:
                        DebugMessage("Error in safecpu: Instruction " + utils.ToHex(ins) + "not found");
                        abort();
                        break;

                }
                break;

            case 0x13:
                //addi,slti,sltiu,xori,ori,andi,slli,srli,srai
                switch((ins >> 12)&0x7) {
                    
                    case 0x00:
                        //addi
                        imm = (ins >> 20);
                        rs1 = r[(ins >> 15) & 0x1F];
                        rindex = (ins >> 7) & 0x1F;
                        r[rindex] = rs1 + imm;
                        break;

                    case 0x02:
                        //slti
                        imm = (ins >> 20);
                        rs1 = r[(ins >> 15) & 0x1F];
                        rindex = (ins >> 7) & 0x1F;
                        if(rs1 < imm) r[rindex] = 0x01;
                        else r[rindex] = 0x00;
                        break;

                    case 0x03:
                        //sltiu
                        imm = (ins >> 20) >>> 0;
                        rs1 = r[(ins >> 15) & 0x1F] >>> 0;
                        rindex = (ins >> 7) & 0x1F;
                        if(rs1 < imm) r[rindex] = 0x01;
                        else r[rindex] = 0x00;
                        break;

                    case 0x04:
                        //xori
                        imm = (ins >> 20);
                        rs1 = r[(ins >> 15) & 0x1F];
                        rindex = (ins >> 7) & 0x1F;
                        r[rindex] = rs1 ^ imm;
                        break;

                    case 0x06:
                        //ori
                        imm = (ins >> 20);
                        rs1 = r[(ins >> 15) & 0x1F];
                        rindex = (ins >> 7) & 0x1F;
                        r[rindex] = rs1 | imm;
                        break;

                    case 0x07:
                        //andi
                        imm = (ins >> 20);
                        rs1 = r[(ins >> 15) & 0x1F];
                        rindex = (ins >> 7) & 0x1F;
                        r[rindex] = rs1 & imm;
                        break;

                    case 0x01:
                        //slli
                        imm = (ins >> 20) & 0x1F;
                        rs1 = r[(ins >> 15) & 0x1F];
                        rindex = (ins >> 7) & 0x1F;
                        r[rindex] = rs1 << imm;
                        break;

                    case 0x05:
                        if(((ins >> 25) & 0x7F) == 0x00){
                            //srli
                            imm = (ins >> 20) & 0x1F;
                            rs1 = r[(ins >> 15) & 0x1F];
                            rindex = (ins >> 7) & 0x1F;
                            r[rindex] = rs1 >>> imm;
                        }
                        else if(((ins >> 25) & 0x7F) == 0x20){
                            //srai
                            imm = (ins >> 20) & 0x1F;
                            rs1 = r[(ins >> 15) & 0x1F];
                            rindex = (ins >> 7) & 0x1F;
                            r[rindex] = rs1 >> imm;
                        }
                        break;

                    default:
                        DebugMessage("Error in safecpu: Instruction " + utils.ToHex(ins) + "not found");
                        abort();
                        break;

                }
                break;

            case 0x33:
                //add,sub,sll,slt,sltu,xor,srl,sra,or,and
                switch((ins >> 25)&0x7F) {
                    
                    case 0x00:
                        //add,slt,sltu,add,or,xor,sll,srl
                        rs1 = r[(ins >> 15) & 0x1F];
                        rs2 = r[(ins >> 20) & 0x1F];
                        switch((ins >> 12)&0x7) {
                            case 0x00:
                                //add
                                rindex = (ins >> 7) & 0x1F;
                                r[rindex] = rs1 + rs2;
                                break;

                            case 0x02:
                                //slt
                                rindex = (ins >> 7) & 0x1F;
                                if(rs1 < rs2) r[rindex] = 0x01;
                                else r[rindex] = 0x00;
                                break;

                            case 0x03:
                                //sltu
                                rindex = (ins >> 7) & 0x1F;
                                if((rs1>>>0) < (rs2>>>0)) r[rindex] = 0x01;
                                else r[rindex] = 0x00;
                                break;

                            case 0x07:
                                //and
                                rindex = (ins >> 7) & 0x1F;
                                r[rindex] = rs1 & rs2;
                                break;

                            case 0x06:
                                //or
                                rindex = (ins >> 7) & 0x1F;
                                r[rindex] = rs1 | rs2;
                                break;

                            case 0x04:
                                //xor
                                rindex = (ins >> 7) & 0x1F;
                                r[rindex] = rs1 ^ rs2;
                                break;

                            case 0x01:
                                //sll
                                rindex = (ins >> 7) & 0x1F;
                                r[rindex] = rs1 << (rs2 & 0x1F);
                                break;

                            case 0x05:
                                //srl
                                rindex = (ins >> 7) & 0x1F;
                                r[rindex] = rs1 >>> (rs2 & 0x1F);
                                break;
                        }
                        break;

                    case 0x20:
                        //sub
                        rs1 = r[(ins >> 15) & 0x1F];
                        rs2 = r[(ins >> 20) & 0x1F];
                        rindex = (ins >> 7) & 0x1F;
                        switch((ins >> 12)&0x7) {
                            case 0x00:
                                //sub
                                r[rindex] = rs1 - rs2;
                                break;

                            case 0x05:
                                //sra
                                r[rindex] = rs1 >> (rs2 & 0x1F);
                                break;
                        }
                        break;

                    case 0x01:
                        //mul,mulh,mulhsu,mulhu,div,divu,rem,remu
                        rs1 = r[(ins >> 15) & 0x1F];
                        rs2 = r[(ins >> 20) & 0x1F];
                        switch((ins >> 12)&0x7) {
                            case 0x00:
                                //mul
                                rindex = (ins >> 7) & 0x1F;
                                mul = rs1 * rs2;
                                r[rindex] = mul & 0xFFFFFFFF;
                                break;

                            case 0x01:
                                //mulh
                                rindex = (ins >> 7) & 0x1F;
                                var result = UMul(rs1,rs2);
                                r[rindex] = result[1];
                                break;

                            case 0x02:
                                //mulhsu
                                rindex = (ins >> 7) & 0x1F;
                                var result = SUMul(rs1,rs2>>>0);
                                r[rindex] = result[1];
                                break;

                            case 0x03:
                                //mulhu
                                rindex = (ins >> 7) & 0x1F;
                                var result = IMul(rs1>>>0, rs2>>>0);
                                r[rindex] = result[1];
                                break;

                            case 0x04:
                                //div
                                rindex = (ins >> 7) & 0x1F;
                                if(rs2 == 0)
                                    quo = -1;
                                else
                                    quo = rs1 / rs2;
                                r[rindex] = quo;
                                break;

                            case 0x05:
                                //divu
                                rindex = (ins >> 7) & 0x1F;
                                if(rs2 == 0)
                                    quo = 0xFFFFFFFF;
                                else
                                    quo = (rs1 >>> 0) / (rs2 >>> 0);
                                r[rindex] = quo;
                                break;

                            case 0x06:
                                //rem
                                rindex = (ins >> 7) & 0x1F;
                                if(rs2 == 0)
                                    rem = rs1;
                                else
                                    rem = rs1 % rs2;
                                r[rindex] = rem;
                                break;

                            case 0x07:
                                //remu
                                rindex = (ins >> 7) & 0x1F;
                                if(rs2 == 0)
                                    rem = (rs1 >>> 0);
                                else
                                    rem = (rs1 >>> 0) % (rs2 >>> 0);
                                r[rindex] = rem;
                                break;
                        }
                        break;

                    

                    default:
                        DebugMessage("Error in safecpu: Instruction " + utils.ToHex(ins) + "not found");
                        abort();
                        break;

                }
                break;

            case 0x37:
                //lui
                rindex = (ins >> 7) & 0x1F;
                r[rindex] = (ins & 0xFFFFF000);
                break;

            case 0x17:
                //auipc
                imm = (ins & 0xFFFFF000);
                rindex = (ins >> 7) & 0x1F;
                r[rindex] = (imm + pc - 4)|0;
                break;

            case 0x6F:
                //jal
                imm1 = (ins >> 21) & 0x3FF;
                imm2 = ((ins >> 20) & 0x1) << 10;
                imm3 = ((ins >> 12) & 0xFF) << 11;
                imm4 = (ins >> 31) << 19;
                imm =  (imm1 | imm2 | imm3 | imm4 ) << 1; 
                rindex = (ins >> 7) & 0x1F;
                r[rindex] = pc;
                pc = pc + imm - 4|0;
                fence = 1;
                break; 

            case 0x67:
                //jalr
                imm = (ins >> 20);
                rs1 = r[(ins >> 15) & 0x1F];
                rindex = (ins >> 7) & 0x1F;
                r[rindex] = pc;
                pc = ((rs1 + imm) & 0xFFFFFFFE)|0;
                fence = 1;
                break;

            case 0x63:
                //beq, bne, blt, bge, bltu, bgeu
                imm1 = (ins >> 31) << 11;
                imm2 = ((ins >> 25) & 0x3F) << 4;
                imm3 = (ins >> 8) & 0x0F;
                imm4 = ((ins >> 7) & 0x01) << 10;
                imm =  ((imm1 | imm2 | imm3 | imm4) << 1 );

                switch((ins >> 12)&0x7) {
                    
                    case 0x00:
                        //beq
                        rs1 = r[(ins >> 15) & 0x1F];
                        rs2 = r[(ins >> 20) & 0x1F];
                        if(rs1 == rs2) pc = pc + imm - 4|0;//-4 temporary hack
                        break;

                    case 0x01:
                        //bne
                        rs1 = r[(ins >> 15) & 0x1F];
                        rs2 = r[(ins >> 20) & 0x1F];
                        if(rs1 != rs2) pc = pc + imm - 4|0;//-4 temporary hack
                        break;

                    case 0x04:
                        //blt
                        rs1 = r[(ins >> 15) & 0x1F];
                        rs2 = r[(ins >> 20) & 0x1F];
                        if(rs1 < rs2) pc = pc + imm - 4|0;//-4 temporary hack
                        break;

                    case 0x05:
                        //bge
                        rs1 = r[(ins >> 15) & 0x1F];
                        rs2 = r[(ins >> 20) & 0x1F];
                        if(rs1 >= rs2) pc = pc + imm - 4|0;//-4 temporary hack
                        break;

                    case 0x06:
                        //bltu
                        rs1 = r[(ins >> 15) & 0x1F] >>> 0;
                        rs2 = r[(ins >> 20) & 0x1F] >>> 0;
                        if(rs1 < rs2) pc = pc + imm - 4|0;//-4 temporary hack
                        break;

                    case 0x07:
                        //bgeu
                        rs1 = r[(ins >> 15) & 0x1F] >>> 0;
                        rs2 = r[(ins >> 20) & 0x1F] >>> 0;
                        if(rs1 >= rs2) pc = pc + imm - 4|0;//-4 temporary hack
                        break;

                    default:
                        DebugMessage("Error in safecpu: Instruction " + utils.ToHex(ins) + "not found");
                        abort();
                        break;

                }
                fence = 1;
                break;

            case 0x73:
                //csrrw, csrrs, csrrc, csrrwi, csrrsi, csrrci, ecall, eret, ebreak, mrts, wfi
                imm = (ins >>> 20);
                rs1 = r[(ins >> 15) & 0x1F];
                rindex = (ins >> 7) & 0x1F;
                switch((ins >> 12)&0x7) {
                    
                    case 0x01:
                        //csrrw
                        r[rindex] = GetCSR(imm);
                        //if (rindex != ((ins >> 15) & 0x1F))
                        SetCSR(imm, rs1);
                        break;

                    case 0x02:
                        //csrrs
                        r[rindex] = GetCSR(imm);
                        SetCSR(imm, GetCSR(imm) | rs1);
                        break;

                    case 0x03:
                        //csrrc
                        r[rindex] = GetCSR(imm);
                        SetCSR(imm, GetCSR(imm) & (~rs1));
                        break;

                    case 0x05:
                        //csrrwi
                        r[rindex] = GetCSR(imm);
                        zimm = (ins >> 15) & 0x1F;
                        if(zimm != 0) SetCSR(imm, (zimm >> 0));
                        break;
                        

                    case 0x06:
                        //csrrsi
                        r[rindex] = GetCSR(imm);
                        zimm = (ins >> 15) & 0x1F;
                        if(zimm != 0) SetCSR(imm, GetCSR(imm) | (zimm >> 0));
                        break;

                    case 0x07:
                        //csrrci
                        r[rindex] = GetCSR(imm);
                        zimm = (ins >> 15) & 0x1F;
                        if(zimm != 0) SetCSR(imm, GetCSR(imm) & ~(zimm >> 0));
                        break;
                    
                    case 0x00:
                        //ecall, eret, ebreak, mrts, wfi
                        switch((ins >> 20)&0xFFF) {
                            case 0x00:
                                //ecall
                                switch(current_privilege_level)
                                {
                                    case PRV_U:
                                        Trap(CAUSE_ENVCALL_UMODE, pc - 4|0);
                                        break;

                                    case PRV_S:
                                        Trap(CAUSE_ENVCALL_SMODE, pc - 4|0);
                                        break;

                                    case PRV_H:
                                        Trap(CAUSE_ENVCALL_HMODE, pc - 4|0);
                                        abort();
                                        break;

                                    case PRV_M:
                                        Trap(CAUSE_ENVCALL_MMODE, pc - 4|0);
                                        break;
                                    
                                    default:
                                        DebugMessage("Error in ecall: Don't know how to handle privilege level " + current_privilege_level);
                                        abort();
                                        break;
                                }
                                break;

                            case 0x001:
                                //ebreak
                                Trap(CAUSE_BREAKPOINT, pc - 4|0);
                                break;

                            case 0x100:
                                //eret
                                var current_privilege_level = (csr[(csrp + CSR_MSTATUS)>>2] & 0x06) >> 1;
                                if(current_privilege_level < PRV_S) {
                                    DebugMessage("Error in eret: current_privilege_level isn't allowed access");
                                    abort();
                                    break;   
                                }
                                PopPrivilegeStack();

                                switch(current_privilege_level)
                                {
                                    
                                    case PRV_S:
                                        //DebugMessage("eret PRV_S -"+ utils.ToHex(ins));
                                        pc = csr[(csrp + CSR_SEPC)>>2]|0;
                                        break;

                                    case PRV_H:
                                        //DebugMessage("Not supported eret PRV_H -"+ utils.ToHex(ins));
                                        pc = csr[(csrp + CSR_HEPC)>>2]|0;
                                        abort();
                                        break;

                                    case PRV_M:
                                        //DebugMessage("eret PRV_M -"+ utils.ToHex(ins));
                                        pc = csr[(csrp + CSR_MEPC)>>2]|0;
                                        break;
                                    
                                    default:
                                        DebugMessage("Error in eret: Don't know how to handle privilege level " + current_privilege_level);
                                        abort();
                                        break;
                                }
                                fence = 1;
                                break;

                            case 0x102:
                                // wfi
                                break;

                            case 0x305:
                                //mrts     
                                if(current_privilege_level != PRV_M) {
                                    DebugMessage("Error in mrts: current_privilege_level isn't allowed access");
                                    abort();
                                    break;   
                                }
                                csr[(csrp + CSR_MSTATUS)>>2] = (csr[(csrp + CSR_MSTATUS)>>2] & ~0x6) | 0x02; //Setting the Privilage level to Supervisor
                                csr[(csrp + CSR_SBADADDR)>>2] = csr[(csrp + CSR_MBADADDR)>>2];
                                csr[(csrp + CSR_SCAUSE)>>2] = csr[(csrp + CSR_MCAUSE)>>2];
                                csr[(csrp + CSR_SEPC)>>2] = csr[(csrp + CSR_MEPC)>>2];
                                pc = csr[(csrp + CSR_STVEC)>>2]|0;
                                fence = 1;
                                break;

                            case 0x101:
                                //sfence.vm
                                break;

                            default:
                                DebugMessage("Error in safecpu: Instruction " + utils.ToHex(ins) + "not found");
                                abort();
                                break;

                        }
                        break; 

                    default:
                        DebugMessage("Error in safecpu: Instruction " + utils.ToHex(ins) + "not found");
                        abort();
                        break;

                }
                break;

            case 0x07:
                //flw,fld
                switch((ins >> 12)&0x7) {
                    
                    case 0x02:
                        //flw
                        imm = (ins >> 20);
                        rs1 = r[(ins >> 15) & 0x1F];
                        findex = ((ins >> 7) & 0x1F);
                        paddr = TranslateVM(rs1 + imm|0,VM_READ);
                        if(paddr == -1) break;
                        r[0] = Read32(paddr);
                        f[fp + findex|0] = ff[0];
                        break;

                    case 0x03:
                        //fld
                        imm = (ins >> 20);
                        rs1 = r[(ins >> 15) & 0x1F];
                        findex = ((ins >> 7) & 0x1F) << 1;
                        paddr = TranslateVM(rs1 + imm|0,VM_READ);
                        if(paddr == -1) break;
                        fi[fip + findex + 0|0] = Read32(paddr+0);
                        fi[fip + findex + 1|0] = Read32(paddr+4);
                        break;

                    default:
                        DebugMessage("Error in safecpu: Instruction " + utils.ToHex(ins) + "not found");
                        abort();
                        break;

                }
                break;

            case 0x27:
                //fsw, fsd
                switch((ins >> 12)&0x7) {

                    case 0x02:
                        //fsw
                        imm1 = (ins >> 25);
                        imm2 = (ins >> 7) & 0x1F;
                        imm = (imm1 << 5) + imm2;
                        rs1 = r[(ins >> 15) & 0x1F];
                        findex = (ins >> 20) & 0x1F;
                        ff[0] = f[fp + findex|0];
                        paddr = TranslateVM(rs1 + imm|0, VM_WRITE);
                        if(paddr == -1) break;
                        Write32(paddr, r[0]);
                        break;

                    case 0x03:
                        //fsd
                        imm1 = (ins >> 25);
                        imm2 = (ins >> 7) & 0x1F;
                        imm = (imm1 << 5) + imm2;
                        rs1 = r[(ins >> 15) & 0x1F];
                        findex = ((ins >> 20) & 0x1F) << 1;
                        paddr = TranslateVM(rs1 + imm + 0|0, VM_WRITE);
                        if (paddr == -1) break;
                        Write32(paddr+0, fi[fip + findex + 0|0]);
                        Write32(paddr+4, fi[fip + findex + 1|0]);
                        break;

                    default:
                        DebugMessage("Error in safecpu: Instruction " + utils.ToHex(ins) + "not found");
                        abort();
                        break;

                }
                break;

            case 0x53:
                //fadd.s, fsub.s
                switch((ins >> 25)&0x7F) {
                    
                    case 0x00 :
                        //fadd.s
                        fs1 = f[fp + ((ins >> 15) & 0x1F)|0];
                        fs2 = f[fp + ((ins >> 20) & 0x1F)|0];
                        rindex = (ins >> 7) & 0x1F;
                        f[fp + rindex|0] = fs1 + fs2;
                        break;

                    case 0x04:
                        //fsub.s
                        fs1 = f[fp + ((ins >> 15) & 0x1F)|0];
                        fs2 = f[fp + ((ins >> 20) & 0x1F)|0];
                        rindex = (ins >> 7) & 0x1F;
                        f[fp + rindex|0] = fs1 - fs2;
                        break;

                    case 0x60:
                        //fcvt.w.s
                        rindex = (ins >> 7) & 0x1F;
                        r[rindex] = f[fp + ((ins >> 15) & 0x1F)|0];
                        break;

                    case 0x01 :
                        //fadd.d
                        fs1 = f[fp + ((ins >> 15) & 0x1F)|0];
                        fs2 = f[fp + ((ins >> 20) & 0x1F)|0];
                        rindex = (ins >> 7) & 0x1F;
                        f[fp + rindex|0] = fs1 + fs2;
                        break;

                    case 0x05:
                        //fsub.d
                        fs1 = f[fp + ((ins >> 15) & 0x1F)|0];
                        fs2 = f[fp + ((ins >> 20) & 0x1F)|0];
                        rindex = (ins >> 7) & 0x1F;
                        f[fp + rindex|0] = fs1 - fs2;
                        break;

                    case 0x61:
                        //fcvt.w.d
                        rindex = (ins >> 7) & 0x1F;
                        r[rindex] = f[fp + ((ins >> 15) & 0x1F)|0];
                        break;

                    case 0x78:
                        //fmv.s.x
                        rs1 = r[(ins >> 15) & 0x1F];
                        findex = (ins >> 7) & 0x1F;
                        f[fp + rindex|0] = rs1; 
                        break;


                    default:
                        DebugMessage("Error in safecpu: Instruction " + utils.ToHex(ins) + "not found");
                        abort();
                        break;
                }
                break;

            case 0x2F:
                //amoswap, amoadd, amoxor, amoand, amoor, amomin, amomax, amominu, amomaxu
                rs1 = r[(ins >> 15) & 0x1F];
                rs2 = r[(ins >> 20) & 0x1F];
                rindex = (ins >> 7) & 0x1F;
                switch((ins >> 27)&0x1F) {
                    
                    case 0x01:
                        //amoswap
                        paddr = TranslateVM(rs1|0, VM_READ);
                        if(paddr == -1) break;
                        r[rindex] = Read32(paddr);
                        paddr = TranslateVM(rs1|0, VM_WRITE);
                        if(paddr == -1) break;
                        Write32(paddr, rs2);
                        break;

                    case 0x00:
                        //amoadd
                        paddr = TranslateVM(rs1|0,VM_READ);
                        if(paddr == -1) break;
                        r[rindex] = Read32(paddr);
                        paddr = TranslateVM(rs1|0,VM_WRITE);
                        if(paddr == -1) break;
                        Write32(paddr,r[rindex] + rs2);
                        break;

                    case 0x04:
                        //amoxor
                        paddr = TranslateVM(rs1|0,VM_READ);
                        if(paddr == -1) break;
                        r[rindex] = Read32(paddr);
                        paddr = TranslateVM(rs1|0,VM_WRITE);
                        if(paddr == -1) break;
                        Write32(paddr,r[rindex] ^ rs2);
                        break;

                    case 0x0C:
                        //amoand
                        paddr = TranslateVM(rs1|0,VM_READ);
                        if(paddr == -1) break;
                        r[rindex] = Read32(paddr);
                        paddr = TranslateVM(rs1|0,VM_WRITE);
                        if(paddr == -1) break;
                        Write32(paddr,r[rindex] & rs2);
                        break;

                    case 0x08:
                        //amoor
                        paddr = TranslateVM(rs1|0,VM_READ);
                        if(paddr == -1) break;
                        r[rindex] = Read32(paddr);
                        paddr = TranslateVM(rs1|0,VM_WRITE);
                        if(paddr == -1) break;
                        Write32(paddr,r[rindex] | rs2);
                        break;

                    case 0x10:
                        //amomin
                        paddr = TranslateVM(rs1|0,VM_READ);
                        if(paddr == -1) break;
                        r[rindex] = Read32(paddr);
                        if((rs2 >> 0) > (r[rindex] >> 0)) r[0] = r[rindex];
                        else r[0] = rs2;
                        paddr = TranslateVM(rs1|0,VM_WRITE);
                        if(paddr == -1) break;
                        Write32(paddr,r[0]);
                        break;

                   case 0x14:
                        //amomax
                        paddr = TranslateVM(rs1,VM_READ);
                        if(paddr == -1) break;
                        r[rindex] = Read32(paddr);
                        if((rs2 >> 0) < (r[rindex] >> 0)) r[0] = r[rindex];
                        else r[0] = rs2;
                        paddr = TranslateVM(rs1,VM_WRITE);
                        if(paddr == -1) break;
                        Write32(paddr,r[0]);
                        break;

                    case 0x18:
                        //amominu
                        r[rindex] = Read32(paddr);
                        if((rs2 >>> 0) > (r[rindex] >>> 0)) r[0] = r[rindex];
                        else r[0] = rs2;
                        paddr = TranslateVM(rs1,VM_WRITE);
                        if(paddr == -1) break;
                        Write32(paddr,r[0]);
                        break;

                    case 0x1C:
                        //amomaxu
                        paddr = TranslateVM(rs1,VM_READ);
                        if(paddr == -1) break;
                        r[rindex] = Read32(paddr);
                        if((rs2 >>> 0) < (r[rindex] >>> 0)) r[0] = r[rindex];
                        else r[0] = rs2;
                        paddr = TranslateVM(rs1,VM_WRITE);
                        if(paddr == -1) break;
                        Write32(paddr,r[0]);
                        break;

                    case 0x02:
                        //lr.d
                        rs1 = r[(ins >> 15) & 0x1F];
                        paddr = TranslateVM(rs1,VM_READ);
                        if(paddr == -1) break;
                        r[rindex] = Read32(paddr);
                        amoaddr = rs1;
                        amovalue = r[rindex];
                        break;

                    case 0x03:
                        //sc.d
                        rs1 = r[(ins >> 15) & 0x1F];
                        rs2 = r[(ins >> 20) & 0x1F];
                        if(rs1 != amoaddr) {
                            r[rindex] = 0x01;
                            break;
                        }
                        paddr = TranslateVM(rs1, VM_READ);
                        if(paddr == -1) break;
                        if(Read32(paddr) != amovalue) {
                            r[rindex] = 0x01;
                            break;
                        }
                        r[rindex] = 0x00;
                        paddr = TranslateVM(rs1, VM_WRITE);
                        if (paddr == -1) break;
                        Write32(paddr, rs2);
                        break;

                    default:
                        DebugMessage("Error in Atomic Memory Instruction " + utils.ToHex(ins) + "not found");
                        abort();
                        break;

                }
                break;

            case 0x0F:
                //fence
                break;

            default:
                DebugMessage("Error in safecpu: Instruction " + utils.ToHex(ins) + " not found at "+utils.ToHex(pc));
                abort();
                break;
        }

    } while(--steps);
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
    Trap: Trap,
    MemTrap: MemTrap,
    PopPrivilegeStack: PopPrivilegeStack,
    PushPrivilegeStack: PushPrivilegeStack,
    IMul: IMul,
    UMul: UMul,
    SUMul: SUMul,
    CheckVMPrivilege: CheckVMPrivilege,  
    GetTimeToNextInterrupt: GetTimeToNextInterrupt,
    ProgressTime: ProgressTime,
    GetTicks: GetTicks,
    AnalyzeImage: AnalyzeImage,
    CheckForInterrupt: CheckForInterrupt,
    RaiseInterrupt: RaiseInterrupt,
    ClearInterrupt: ClearInterrupt
};

}

module.exports = FastCPU;
