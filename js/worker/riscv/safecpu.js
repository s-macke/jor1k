// -------------------------------------------------
// -------------------- CPU ------------------------
// -------------------------------------------------

"use strict";
var message = require('../messagehandler');
var utils = require('../utils');
var DebugIns = require('./disassemble');

var PRV_U = 0x00;
var PRV_S = 0x01;
var PRV_H = 0x02;
var PRV_M = 0x03;

var VM_READ  = 0;
var VM_WRITE = 1;
var VM_FETCH = 2;

var CAUSE_TIMER_INTERRUPT          = (1<<31) | 0x01;
var CAUSE_HOST_INTERRUPT           = (1<<31) | 0x02;
var CAUSE_SOFTWARE_INTERRUPT       = (1<<31) | 0x00;
var CAUSE_INSTRUCTION_ACCESS_FAULT = 0x01;
var CAUSE_ILLEGAL_INSTRUCTION      = 0x02;
var CAUSE_BREAKPOINT               = 0x03;
var CAUSE_LOAD_ACCESS_FAULT        = 0x05;
var CAUSE_STORE_ACCESS_FAULT       = 0x07;
var CAUSE_ENVCALL_UMODE            = 0x08;
var CAUSE_ENVCALL_SMODE            = 0x09;
var CAUSE_ENVCALL_HMODE            = 0x0A;
var CAUSE_ENVCALL_MMODE            = 0x0B;


var CSR_CYCLES = 0xC00;
var CSR_CYCLEW = 0x900;


var CSR_FFLAGS    = 0x1;
var CSR_FRM       = 0x2;
var CSR_FCSR      = 0x3;

var CSR_SSTATUS   = 0x100;
var CSR_STVEC     = 0x101;
var CSR_SIE       = 0x104;
var CSR_STIMECMP  = 0x121;
var CSR_SSCRATCH  = 0x140;
var CSR_SEPC      = 0x141;
var CSR_SIP       = 0x144;
var CSR_SPTBR     = 0x180;
var CSR_SASID     = 0x181;

var CSR_HEPC      = 0x241;

var CSR_MSTATUS   = 0x300;
var CSR_MTVEC     = 0x301;
var CSR_MTDELEG   = 0x302;
var CSR_MIE       = 0x304;
var CSR_MTIMECMP  = 0x321;
var CSR_MTIMECMPH = 0x361;
var CSR_MEPC      = 0x341;
var CSR_MSCRATCH  = 0x340;
var CSR_MCAUSE    = 0x342;
var CSR_MBADADDR  = 0x343;
var CSR_MIP       = 0x344;
var CSR_MTOHOST_TEMP = 0x345; // terminal output, temporary for the patched pk.

var CSR_MTIME     = 0x701;
var CSR_MTIMEH    = 0x741;
var CSR_MRESET    = 0x782;
var CSR_SEND_IPI  = 0x783;

var CSR_MTOHOST         = 0x780;
var CSR_MFROMHOST       = 0x781;
var CSR_MDEVCMDTOHOST   = 0x790; // special
var CSR_MDEVCMDFROMHOST = 0x791; // special

var CSR_TIMEW     = 0x901;
var CSR_INSTRETW  = 0x902;
var CSR_CYCLEHW   = 0x980;
var CSR_TIMEHW    = 0x981;
var CSR_INSTRETHW = 0x982;

var CSR_STIMEW    = 0xA01;
var CSR_STIMEH    = 0xD81;
var CSR_STIMEHW   = 0xA81;
var CSR_STIME     = 0xD01;
var CSR_SCAUSE    = 0xD42;
var CSR_SBADADDR  = 0xD43;
var CSR_MCPUID    = 0xF00;
var CSR_MIMPID    = 0xF01;
var CSR_MHARTID   = 0xF10;
var CSR_CYCLEH    = 0xC80;
var CSR_TIMEH     = 0xC81;
var CSR_INSTRETH  = 0xC82;

var CSR_MCPUID    = 0xF00;
var CSR_MIMPID    = 0xF01;
var CSR_MHARTID   = 0xF10;

var CSR_TIME      = 0xC01;
var CSR_INSTRET   = 0xC02;
var CSR_STATS     = 0xC0;
var CSR_UARCH0    = 0xCC0;
var CSR_UARCH1    = 0xCC1;
var CSR_UARCH2    = 0xCC2;
var CSR_UARCH3    = 0xCC3;
var CSR_UARCH4    = 0xCC4;
var CSR_UARCH5    = 0xCC5;
var CSR_UARCH6    = 0xCC6;
var CSR_UARCH7    = 0xCC7;
var CSR_UARCH8    = 0xCC8;
var CSR_UARCH9    = 0xCC9;
var CSR_UARCH10   = 0xCCA;
var CSR_UARCH11   = 0xCCB;
var CSR_UARCH12   = 0xCCC;
var CSR_UARCH13   = 0xCCCD;
var CSR_UARCH14   = 0xCCCE;
var CSR_UARCH15   = 0xCCCF;

var QUIET_NAN = 0xFFFFFFFF;
var SIGNALLING_NAN = 0x7FFFFFFF;

// constructor
function SafeCPU(ram, htif) {
    message.Debug("Initialize RISCV CPU");

    this.ram = ram;

    this.htif = htif;

    // registers
    this.r = new Int32Array(this.ram.heap, 0, 32);

    this.f = new Float64Array(this.ram.heap, 32<<2, 32); 

    this.fi = new Int32Array(this.ram.heap, 32<<2, 64); // for copying operations
    this.ff = new Float32Array(this.ram.heap, 0, 1); // the zero register is used to convert to single precision

    this.csr = new Int32Array(this.ram.heap, 0x2000, 4096);
    this.pc = 0x200;

    this.Reset();
}

SafeCPU.prototype.Reset = function() {
    this.ticks = 0;
    this.csr[CSR_MSTATUS]  = 0x96; // 1001 0110 - All Interrupts Disabled, FPU disabled 
    this.csr[CSR_MTOHOST]  =  0x780;
    this.csr[CSR_MCPUID]   = 0x4112D;
    this.csr[CSR_MIMPID]   = 0x01;
    this.csr[CSR_MHARTID]  = 0x00;
    this.csr[CSR_MTVEC]    = 0x100;
    this.csr[CSR_MIE]      = 0x00;
    this.csr[CSR_MEPC]     = 0x00;
    this.csr[CSR_MCAUSE]   = 0x00;
    this.csr[CSR_MBADADDR] = 0x00;
    this.csr[CSR_SSTATUS]  = 0x3010;
    this.csr[CSR_STVEC]    = 0x00;
    this.csr[CSR_SIE]      = 0x00;
    this.csr[CSR_TIME]     = 0x0;
    this.csr[CSR_SPTBR]    = 0x40000;

    // for atomic load & store instructions
    this.amoaddr = 0x00; 
    this.amovalue = 0x00;
}

SafeCPU.prototype.InvalidateTLB = function() {
}

SafeCPU.prototype.GetTimeToNextInterrupt = function () {
    var delta = (this.csr[CSR_MTIMECMP]>>>0) - (this.ticks & 0xFFFFFFFF);
    delta = delta + (delta<0?0xFFFFFFFF:0x0) | 0;
    return delta;
}

SafeCPU.prototype.GetTicks = function () {
    return this.ticks;
}

SafeCPU.prototype.ProgressTime = function (delta) {
    this.ticks = this.ticks + delta | 0;
}


SafeCPU.prototype.AnalyzeImage = function() // we haveto define these to copy the cpus
{
}

SafeCPU.prototype.CheckForInterrupt = function () {
};

SafeCPU.prototype.RaiseInterrupt = function (line, cpuid) {
    //message.Debug("raise int " + line);
};

SafeCPU.prototype.ClearInterrupt = function (line, cpuid) {
};

SafeCPU.prototype.Trap = function (cause, current_pc) {

    var current_privilege_level = (this.csr[CSR_MSTATUS] & 0x06) >> 1;
    this.PushPrivilegeStack();
    this.csr[CSR_MEPC] = current_pc;
    this.csr[CSR_MCAUSE] = cause;
    this.pc = (0x100 + 0x40*current_privilege_level)|0;  
};

SafeCPU.prototype.MemTrap = function(addr, op) {
    this.csr[CSR_MBADADDR] = addr;
    switch(op) {
        case VM_READ:
            this.Trap(CAUSE_LOAD_ACCESS_FAULT, this.pc - 4|0);
            break;

        case VM_WRITE:
            this.Trap(CAUSE_STORE_ACCESS_FAULT, this.pc - 4|0);
            break;

        case VM_FETCH:
            this.Trap(CAUSE_INSTRUCTION_ACCESS_FAULT, this.pc);
            break;
    }
}



SafeCPU.prototype.CheckVMPrivilege = function (type, op) {

    var priv = (this.csr[CSR_MSTATUS] & 0x06) >> 1;

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

        case 11:
            if (priv == PRV_S) return true;
            return false;
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

    message.Debug("Inside CheckVMPrivilege for PC "+utils.ToHex(this.pc) + " and type " + type + " and op " + op);
    message.Abort();
    return false;
}


SafeCPU.prototype.TranslateVM = function (addr, op) {
    var vm = (this.csr[CSR_MSTATUS] >> 17) & 0x1F;
    var current_privilege_level = (this.csr[CSR_MSTATUS] & 0x06) >> 1;
    var i = 1; //i = LEVELS -1 and LEVELS = 2 in a 32 bit System

    // vm bare mode
    if (vm == 0 || current_privilege_level == PRV_M) return addr;

    // hack, open mmio by direct mapping
    //if ((addr>>>28) == 0x9) return addr;

    // only RV32 supported
    if(vm != 8) {
        message.Debug("unkown VM Mode " + vm + " at PC " + utils.ToHex(this.pc));
        message.Abort();
    }

    // LEVEL 1
    var offset = addr & 0xFFF;

    var frame_num = this.ram.Read32(this.csr[CSR_SPTBR] + ((addr >>> 22) << 2));
    var type = ((frame_num >> 1) & 0xF);
    var valid = (frame_num & 0x01);

    if (valid == 0) {
        //message.Debug("Unsupported valid field " + valid + " or invalid entry in PTE at PC "+utils.ToHex(this.pc) + " pl:" + current_privilege_level + " addr:" + utils.ToHex(addr) + " op:"+op);
        //message.Abort();
        this.MemTrap(addr, op);
        return -1;
    }

    if (type >= 2) {

        if (!this.CheckVMPrivilege(type,op)) {
            this.MemTrap(addr, op);
            return -1;
            //message.Debug("Error in TranslateVM: Unhandled trap");
            //message.Abort();
        }
/*
        var updated_frame_num = frame_num;
        if(op == VM_READ)
            updated_frame_num = (frame_num | 0x20);
        else if(op == VM_WRITE)
            updated_frame_num = (frame_num | 0x60);
        this.ram.Write32(this.csr[CSR_SPTBR] + (page_num << 2),updated_frame_num);
*/
        return ((frame_num >> 10) << 12) | (addr&0x3FFFFF);
    }

    // LEVEL 2
    //message.Debug("Second level MMU");
    i = i - 1;
    var offset = addr & 0xFFF;
    var new_sptbr = (frame_num & 0xFFFFFC00) << 2;
    var new_page_num = (addr >> 12) & 0x3FF;
    var new_frame_num = this.ram.Read32(new_sptbr + (new_page_num << 2));
    var new_type = ((new_frame_num >> 1) & 0xF);
    var new_valid = (new_frame_num & 0x01);

    if (new_valid == 0) {
        this.MemTrap(addr, op);
        return -1;
    }

    if (!this.CheckVMPrivilege(new_type, op)) {
        //message.Debug("Error in TranslateVM: Unhandled trap");
        //message.Abort();
        this.MemTrap(addr, op);
        return -1;
    }

/*
    var updated_frame_num = new_frame_num;
    if(op == VM_READ)
        updated_frame_num = (new_frame_num | 0x20);
    else if(op == VM_WRITE)
        updated_frame_num = (new_frame_num | 0x60);
    this.ram.Write32(new_sptbr + (new_page_num << 2),updated_frame_num);
*/

    return ((new_frame_num >> 10) << 12) | offset;
};


SafeCPU.prototype.SetCSR = function (addr,value) {

    var csr = this.csr;

    switch(addr)
    {
        case CSR_FCSR:
            csr[addr] = value;
            break;

        case CSR_MDEVCMDTOHOST:
            csr[addr] = value;
            this.htif.WriteDEVCMDToHost(value);
            break;

        case CSR_MDEVCMDFROMHOST:
            csr[addr] = value;
            this.htif.WriteDEVCMDFromHost(value);
            break;

        case CSR_MTOHOST:
            csr[addr] =  value;
            this.htif.WriteToHost(value);
            break;

        case CSR_MTOHOST_TEMP: //only temporary for the patched pk.
            this.ram.Write8(0x90000000 >> 0, value);
            if (value == 0xA) this.ram.Write8(0x90000000 >> 0, 0xD);
            break;

        case CSR_MFROMHOST:
            csr[addr] = value;
            this.htif.WriteFromHost(value);
            break;

        case CSR_MSTATUS:
            csr[addr] = value;
            break;

        case CSR_MCPUID:
            //csr[addr] = value;
            break;

        case CSR_MIMPID:
            csr[addr] = value;
            break;

        case CSR_MHARTID:
            csr[addr] = value;
            break;

        case CSR_MTVEC:
            csr[addr] = value;
            break;

        case CSR_MIP:
            //csr[addr] = value;
            var mask = 0x2 | 0x08; //mask = MIP_SSIP | MIP_MSIP
            csr[CSR_MIP] = (csr[CSR_MIP] & ~mask) | (value & mask);
            break;

        case CSR_MIE:
            //csr[addr] = value;
            var mask = 0x2 | 0x08 | 0x20; //mask = MIP_SSIP | MIP_MSIP | MIP_STIP
            csr[CSR_MIE] = (csr[CSR_MIE] & ~mask) | (value & mask);
            break;

        case CSR_SEPC:
        case CSR_MEPC:
            csr[addr] = value;
            break;

        case CSR_MCAUSE:
            csr[addr] = value;
            break;

        case CSR_SCAUSE:
            csr[addr] = value;
            break;

        case CSR_MBADADDR:
            csr[addr] = value;
            break;

        case CSR_SBADADDR:
            csr[addr] = value;
            break;

        case CSR_SSTATUS:
            csr[addr] = value;
            csr[CSR_MSTATUS] &= ~0x1F039; 
            csr[CSR_MSTATUS] |= (csr[CSR_SSTATUS] & 0x01); //IE0
            csr[CSR_MSTATUS] |= (csr[CSR_SSTATUS] & 0x08); //IE1
            csr[CSR_MSTATUS] |= (csr[CSR_SSTATUS] & 0x10); //PRV1
            csr[CSR_MSTATUS] |= (csr[CSR_SSTATUS] & 0xF000); //FS,XS
            csr[CSR_MSTATUS] |= (csr[CSR_SSTATUS] & 0x10000); //MPRV
            break; 

        case CSR_STVEC:
            csr[addr] = value;
            break;

        case CSR_SIP:
            //csr[addr] = value;
            var mask = 0x2; //mask = MIP_SSIP
            csr[CSR_MIP] = (csr[CSR_MIP] & ~mask) | (value & mask);
            break;

        case CSR_SIE:
            //csr[addr] = value;
            var mask = 0x2 | 0x20; //mask = MIP_SSIP | MIP_STIP
            csr[CSR_MIE] = (csr[CSR_MIE] & ~mask) | (value & mask);
            break;

        case CSR_MSCRATCH:
            csr[addr] = value;
            break;

        case CSR_SSCRATCH:
            csr[addr] = value;
            break;

        case CSR_CYCLEW:
            csr[addr] = value;
            break;

        case CSR_CYCLES:
            this.ticks = value;
            csr[addr] = value;
            break;

        case CSR_MTIME:
        case CSR_STIME:
        case CSR_STIMEW:
            csr[addr] = value;
            break;

        case CSR_MTIMEH:
        case CSR_STIMEH:
        case CSR_STIMEHW:
            csr[addr] = value;
            break;

        case CSR_TIME:
        case CSR_TIMEW:
            csr[addr] = value;
            break;

        case CSR_MTIMECMP:
        case CSR_STIMECMP:
            csr[CSR_MIP] &= ~(0x20); //csr[CSR_MIP] &= ~MIP_STIP
            csr[addr] = value;
            break;

        case CSR_MTIMECMPH:
            csr[addr] = value;
            break;

        case CSR_SPTBR:
            csr[addr] = value;
            break;

        case CSR_FRM:
            csr[addr] = value;
            break;

        case CSR_FFLAGS:
            csr[addr] = value;
            break;

        case CSR_FCSR:
            csr[addr] = value;
            break;

        default:
            csr[addr] = value;
            message.Debug("Error in SetCSR: PC "+utils.ToHex(this.pc)+" Address " + utils.ToHex(addr) + " unkown");
            message.Abort();
            break;
    }
};

SafeCPU.prototype.GetCSR = function (addr) {

    var csr = this.csr;
    var current_privilege_level = (csr[CSR_MSTATUS] & 0x06) >> 1;

    switch(addr)
    {
        case CSR_FCSR:
            return 0x0;
            break;

        case CSR_MDEVCMDTOHOST:
            return this.htif.ReadDEVCMDToHost();
            break;

        case CSR_MDEVCMDFROMHOST:
            return this.htif.ReadDEVCMDFromHost();
            break;

        case CSR_MTOHOST:
            return this.htif.ReadToHost();
            break;

        case CSR_MTOHOST_TEMP: //only temporary for the patched pk.
            return 0x0;
            break;

        case CSR_MFROMHOST:
            return this.htif.ReadFromHost();
            break;

        case CSR_MSTATUS:
            return csr[addr];
            break;

        case CSR_MCPUID:
            return csr[addr];
            break;

        case CSR_MIMPID:
            return csr[addr];
            break;

        case CSR_MHARTID:
            return csr[addr];
            break;

        case CSR_MTVEC:
            return csr[addr];
            break;

        case CSR_MIE:
            return csr[addr];
            break;

        case CSR_SEPC:
        case CSR_MEPC:
            return csr[addr];
            break;

        case CSR_MCAUSE:
            return csr[addr];
            break;

        case CSR_SCAUSE:
            return csr[addr];
            break;

        case CSR_MBADADDR:
            return csr[addr];
            break;

        case CSR_SBADADDR:
            return csr[addr];
            break;

        case CSR_SSTATUS:
            //if (current_privilege_level == 0) this.Trap(CAUSE_ILLEGAL_INSTRUCTION);
            csr[CSR_SSTATUS] = 0x00; 
            csr[CSR_SSTATUS] |= (csr[CSR_MSTATUS] & 0x01); //IE0
            csr[CSR_SSTATUS] |= (csr[CSR_MSTATUS] & 0x08); //IE1
            csr[CSR_SSTATUS] |= (csr[CSR_MSTATUS] & 0x10); //PRV1
            csr[CSR_SSTATUS] |= (csr[CSR_MSTATUS] & 0xF000); //FS,XS
            csr[CSR_SSTATUS] |= (csr[CSR_MSTATUS] & 0x10000); //MPRV
            return csr[CSR_SSTATUS];
            break;

        case CSR_STVEC:
            return csr[addr];
            break;

        case CSR_MIP:
            return csr[addr];
            break;

        case CSR_MIE:
            return csr[addr];
            break;

        case CSR_SIP: 
            return csr[CSR_MIP] & (0x2 | 0x20);//(MIP_SSIP | MIP_STIP)
            break;

        case CSR_SIE: 
            return csr[CSR_MIE] & (0x2 | 0x20);//(MIP_SSIP | MIP_STIP)
            break;

        case CSR_MSCRATCH:
            return csr[addr];
            break;

        case CSR_SSCRATCH:
            return csr[addr];
            break;

        case CSR_CYCLEW:
            return this.ticks;
            break;

        case CSR_CYCLES:
            return this.ticks;
            break;

        case CSR_MTIME:
        case CSR_STIME:
        case CSR_STIMEW:
            return this.ticks;
            break;

        case CSR_MTIMEH:
        case CSR_STIMEH:
        case CSR_STIMEHW:
            return (this.ticks) >> 32;
            break;

        case CSR_TIME:
        case CSR_TIMEW:
            return this.ticks;
            break;

        case CSR_MTIMECMP:
        case CSR_STIMECMP:
        case CSR_MTIMECMPH:
            return csr[addr];
            break;

        case CSR_SPTBR:
            return csr[addr];
            break;

        case CSR_FRM:
            return csr[addr];
            break;

        case CSR_FFLAGS:
            return csr[addr];
            break;

        case CSR_FCSR:
            return csr[addr];
            break;

        default:
            message.Debug("Error in GetCSR: PC "+utils.ToHex(this.pc)+" Address " + utils.ToHex(addr) + " unkown");
            message.Abort();
            return csr[addr];
            break;
    }
   
};

SafeCPU.prototype.UMul64 = function (a,b) {

    var result = [0, 0];

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

SafeCPU.prototype.IMul64 = function (a,b) {

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

    result = this.UMul64(Math.abs(a), Math.abs(b));

    if (doNegate) {
        result[0] = ~result[0];
        result[1] = ~result[1];
        result[0] = (result[0] + 1) | 0;
        if (result[0] == 0) result[1] = (result[1] + 1) | 0;
    }

    return result;
};

SafeCPU.prototype.SUMul64 = function (a,b) {

    var result = [0,0];

    if (a == 0) return result[0] = result[1] = 0, result;
    if (b == 0) return result[0] = result[1] = 0, result;

    a |= 0;
    b >>>= 0;

    if ((a >= -32768 && a <= 32767) && (b < 65536)) {
        result[0] = a * b;
        result[1] = (result[0] < 0) ? -1 : 0;
        return result;
    }

    var doNegate = a < 0;

    result = this.UMul64(Math.abs(a), Math.abs(b));

    if (doNegate) {
        result[0] = ~result[0];
        result[1] = ~result[1];
        result[0] = (result[0] + 1) | 0;
        if (result[0] == 0) result[1] = (result[1] + 1) | 0;
    }

    return result;
};


SafeCPU.prototype.PushPrivilegeStack = function () {

    var csr = this.csr;
    var mstatus = csr[CSR_MSTATUS];
    var privilege_level_stack = mstatus & 0x1FF;
    var new_privilege_level_stack = (((privilege_level_stack << 2) | PRV_M) << 1) & 0x1FF;
    csr[CSR_MSTATUS] = ((mstatus & (~0xFFF)) + new_privilege_level_stack) & 0xFFFEFFFF; //Last "and" to set mprv(bit 16) to zero
};

SafeCPU.prototype.PopPrivilegeStack = function () {

    var csr = this.csr;
    var mstatus = csr[CSR_MSTATUS];
    var privilege_level_stack =  (mstatus & 0x1FF);
    var new_privilege_level_stack = ((privilege_level_stack >>> 3) | ((PRV_U << 1) | 0x1) << 6);
    csr[CSR_MSTATUS] = (mstatus & (~0xFFF)) + new_privilege_level_stack;
};

SafeCPU.prototype.Step = function (steps, clockspeed) {
    var r = this.r;
    var fi = this.fi;
    var ff = this.ff;
    var f = this.f;
    var csr = this.csr;
    var rindex = 0x00;
    var imm = 0x00;
    var imm1 = 0x00;
    var imm2 = 0x00;
    var imm3 = 0x00;
    var imm4 = 0x00;
    var zimm = 0x00;
    var quo = 0x00;
    var rem = 0x00;
    var rs1 = 0x0;
    var rs2 = 0x0;
    var fs1 = 0.0;
    var fs2 = 0.0;
    var fs3 = 0.0;
    var interrupts = 0x0;
    var ie = 0x0;
    var ins = 0x0;
    var paddr = 0x0;

    steps = steps | 0;
    clockspeed = clockspeed | 0;
    var delta = 0;
    
    do {
        r[0] = 0x00;

        var current_privilege_level = (this.csr[CSR_MSTATUS] & 0x06) >> 1;
        
        if (!(steps & 63)) {
            // ---------- TICK ----------
            var delta = csr[CSR_MTIMECMP] - this.ticks | 0;
            delta = delta + (delta<0?0xFFFFFFFF:0x0) | 0;
            this.ticks = this.ticks + clockspeed | 0;
            if (delta < clockspeed) {
                csr[CSR_MIP] = csr[CSR_MIP] | 0x20;
            }

            interrupts = csr[CSR_MIE] & csr[CSR_MIP];
            ie = csr[CSR_MSTATUS] & 0x01;

            if ((current_privilege_level < 3) || ((current_privilege_level == 3) && ie)) {
                if (interrupts & 0x8) {
                    this.Trap(CAUSE_SOFTWARE_INTERRUPT, this.pc);
                    continue;
                } else
                if (!this.htif.IsQueueEmpty()) {
                    this.Trap(CAUSE_HOST_INTERRUPT, this.pc);
                    continue;
                }
            }
            if ((current_privilege_level < 1) || ((current_privilege_level == 1) && ie)) {
                if (interrupts & 0x2) {
                    this.Trap(CAUSE_SOFTWARE_INTERRUPT, this.pc);
                    continue;
                } else
                if (interrupts & 0x20) {
                     this.Trap(CAUSE_TIMER_INTERRUPT, this.pc);
                     continue;
                }
            }
        }


        paddr = this.TranslateVM(this.pc, VM_FETCH);
        if(paddr == -1) {
            continue;
        }

        ins = this.ram.Read32(paddr);
        this.pc = this.pc + 4|0;
        //DebugIns.Disassemble(ins,r,csr,this.pc);

        switch(ins&0x7F) {

            case 0x03:
                // lb, lh, lw, lbu, lhu
                imm = (ins >> 20);
                rs1 = r[(ins >> 15) & 0x1F];
                rindex = (ins >> 7) & 0x1F;
                switch((ins >> 12)&0x7) {
                    
                    case 0x00:
                        // lb
                        paddr = this.TranslateVM(rs1 + imm|0, VM_READ);
                        if(paddr == -1) break;
                        r[rindex] = (this.ram.Read8(paddr) << 24) >> 24;
                        break;

                    case 0x01:
                        // lh
                        if (rs1+imm & 1) {
                             message.Debug("Error in lh: unaligned address");
                             message.Abort();
                        }
                        paddr = this.TranslateVM(rs1 + imm|0, VM_READ);
                        if(paddr == -1) break;
                        r[rindex] = (this.ram.Read16(paddr) << 16) >> 16;
                        break;

                    case 0x02:
                        // lw
                        if (rs1+imm & 3) {
                             message.Debug("Error in lw: unaligned address");
                             message.Abort();
                        }
                        paddr = this.TranslateVM(rs1 + imm|0, VM_READ);
                        if(paddr == -1) break;
                        r[rindex] = this.ram.Read32(paddr);
                        break;

                    case 0x04:
                        // lbu
                        paddr = this.TranslateVM(rs1 + imm|0, VM_READ);
                        if(paddr == -1) break;
                        r[rindex] = this.ram.Read8(paddr) & 0xFF;
                        break;

                    case 0x05:
                        // lhu
                        if (rs1+imm & 1) {
                             message.Debug("Error in lhu: unaligned address");
                             message.Abort();
                        }
                        paddr = this.TranslateVM(rs1 + imm|0 ,VM_READ);
                        if(paddr == -1) break;
                        r[rindex] = this.ram.Read16(paddr) & 0xFFFF;
                        break;

                    default:
                        message.Debug("Error in safecpu: Instruction " + utils.ToHex(ins) + " not found");
                        message.Abort();
                        break;

                }
                break;

            case 0x23:
                // sb, sh, sw
                imm1 = (ins >> 25);
                imm2 = (ins >> 7) & 0x1F;
                imm = (imm1 << 5) | imm2;
                rs1 = r[(ins >> 15) & 0x1F];
                rindex = (ins >> 20) & 0x1F;
                switch((ins >> 12)&0x7) {
                    
                    case 0x00:
                        // sb
                        paddr = this.TranslateVM(rs1 + imm|0,VM_WRITE);
                        if(paddr == -1) break;
                        this.ram.Write8(paddr,(r[rindex] & 0xFF));
                        break;

                    case 0x01:
                        // sh
                        if (rs1+imm & 1) {
                             message.Debug("Error in sh: unaligned address");
                             message.Abort();
                        }
                        paddr = this.TranslateVM(rs1 + imm|0,VM_WRITE);
                        if(paddr == -1) break;
                        this.ram.Write16(paddr,(r[rindex] & 0xFFFF));
                        break;

                    case 0x02:
                        // sw
                        if (rs1+imm & 3) {
                             message.Debug("Error in sw: unaligned address");
                             message.Abort();
                        }
                        paddr = this.TranslateVM(rs1 + imm|0,VM_WRITE);
                        if(paddr == -1) break;
                        this.ram.Write32(paddr,r[rindex]);
                        break;

                    default:
                        message.Debug("Error in safecpu: Instruction " + utils.ToHex(ins) + " not found");
                        message.Abort();
                        break;

                }
                break;

            case 0x13:
                // addi, slti, sltiu, xori, ori, andi, slli, srli, srai
                rindex = (ins >> 7) & 0x1F;
                rs1 = r[(ins >> 15) & 0x1F];
                imm = (ins >> 20);
                switch((ins >> 12)&0x7) {
                    
                    case 0x00:
                        // addi
                        r[rindex] = rs1 + imm;
                        break;

                    case 0x02:
                        // slti
                        if(rs1 < imm) r[rindex] = 0x01;
                        else r[rindex] = 0x00;
                        break;

                    case 0x03:
                        // sltiu
                        if((rs1>>>0) < (imm>>>0)) r[rindex] = 0x01;
                        else r[rindex] = 0x00;
                        break;

                    case 0x04:
                        // xori
                        r[rindex] = rs1 ^ imm;
                        break;

                    case 0x06:
                        // ori
                        r[rindex] = rs1 | imm;
                        break;

                    case 0x07:
                        // andi
                        r[rindex] = rs1 & imm;
                        break;

                    case 0x01:
                        // slli
                        r[rindex] = rs1 << imm;
                        break;

                    case 0x05:
                        if(((ins >> 25) & 0x7F) == 0x00){
                            // srli
                            r[rindex] = rs1 >>> imm;
                        }
                        else if(((ins >> 25) & 0x7F) == 0x20){
                            // srai
                            r[rindex] = rs1 >> imm;
                        } else {
                            message.Debug("Error in safecpu: Instruction (sra, srl)" + utils.ToHex(ins) + " not found");
                            message.Abort();
                        }
                        break;

                    default:
                        message.Debug("Error in safecpu: Instruction " + utils.ToHex(ins) + " not found");
                        message.Abort();
                        break;

                }
                break;

            case 0x33:
                // add, sub, sll, slt, sltu, xor, srl, sra, or, and
                switch((ins >> 25)&0x7F) {
                    
                    case 0x00:
                        // add, slt, sltu, or, xor, sll, srl
                        rs1 = r[(ins >> 15) & 0x1F];
                        rs2 = r[(ins >> 20) & 0x1F];
                        rindex = (ins >> 7) & 0x1F;
                        switch((ins >> 12)&0x7) {
                            case 0x00:
                                // add
                                r[rindex] = rs1 + rs2;
                                break;

                            case 0x02:
                                // slt
                                if(rs1 < rs2) r[rindex] = 0x01;
                                else r[rindex] = 0x00;
                                break;

                            case 0x03:
                                // sltu
                                if((rs1>>>0) < (rs2>>>0)) r[rindex] = 0x01;
                                else r[rindex] = 0x00;
                                break;

                            case 0x07:
                                // and
                                r[rindex] = rs1 & rs2;
                                break;

                            case 0x06:
                                // or
                                r[rindex] = rs1 | rs2;
                                break;

                            case 0x04:
                                // xor
                                r[rindex] = rs1 ^ rs2;
                                break;

                            case 0x01:
                                // sll
                                r[rindex] = rs1 << (rs2 & 0x1F);
                                break;

                            case 0x05:
                                // srl
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
                                // sub
                                r[rindex] = rs1 - rs2;
                                break;

                            case 0x05:
                                // sra
                                r[rindex] = rs1 >> (rs2 & 0x1F);
                                break;

                            default:
                                message.Debug("Error in safecpu: Instruction (sub,sra) " + utils.ToHex(ins) + " not found");
                                message.Abort();
                        }
                        break;

                    case 0x01:
                        // mul, mulh, mulhsu, mulhu, div, divu, rem, remu
                        rs1 = r[(ins >> 15) & 0x1F];
                        rs2 = r[(ins >> 20) & 0x1F];
                        rindex = (ins >> 7) & 0x1F;
                        switch((ins >> 12)&0x7) {
                            case 0x00:
                                // mul
                                var result = this.IMul64(rs1, rs2);
                                r[rindex] = result[0];
                                break;

                            case 0x01:
                                // mulh
                                var result = this.IMul64(rs1, rs2);
                                r[rindex] = result[1];
                                break;

                            case 0x02:
                                // mulhsu
                                var result = this.SUMul64(rs1, rs2>>>0);
                                r[rindex] = result[1];
                                break;

                            case 0x03:
                                // mulhu
                                var result = this.UMul64(rs1>>>0, rs2>>>0);
                                r[rindex] = result[1];
                                break;

                            case 0x04:
                                // div
                                if(rs2 == 0)
                                    quo = -1;
                                else
                                    quo = rs1 / rs2;
                                r[rindex] = quo;
                                break;

                            case 0x05:
                                // divu
                                if(rs2 == 0)
                                    quo = 0xFFFFFFFF;
                                else
                                    quo = (rs1 >>> 0) / (rs2 >>> 0);
                                r[rindex] = quo;
                                break;

                            case 0x06:
                                // rem
                                if(rs2 == 0)
                                    rem = rs1;
                                else
                                    rem = rs1 % rs2;
                                r[rindex] = rem;
                                break;

                            case 0x07:
                                // remu
                                if(rs2 == 0)
                                    rem = (rs1 >>> 0);
                                else
                                    rem = (rs1 >>> 0) % (rs2 >>> 0);
                                r[rindex] = rem;
                                break;
                        }
                        break;

                    default:
                        message.Debug("Error in safecpu: Instruction " + utils.ToHex(ins) + " not found");
                        message.Abort();
                        break;

                }
                break;

            case 0x37:
                // lui
                rindex = (ins >> 7) & 0x1F;
                r[rindex] = ins & 0xFFFFF000;
                break;

            case 0x17:
                // auipc
                imm = ins & 0xFFFFF000;
                rindex = (ins >> 7) & 0x1F;
                r[rindex] = this.pc + imm - 4|0;
                break;

            case 0x6F:
                // jal
                imm1 = (ins >> 21) & 0x3FF;
                imm2 = ((ins >> 20) & 0x1) << 10;
                imm3 = ((ins >> 12) & 0xFF) << 11;
                imm4 = (ins >> 31) << 19;
                imm =  (imm1 | imm2 | imm3 | imm4 ) << 1; 
                rindex = (ins >> 7) & 0x1F;
                r[rindex] = this.pc;
                this.pc = this.pc + imm - 4|0;
                break; 

            case 0x67:
                // jalr
                imm = ins >> 20;
                rs1 = r[(ins >> 15) & 0x1F];
                rindex = (ins >> 7) & 0x1F;
                r[rindex] = this.pc;
                this.pc = (rs1 + imm) & 0xFFFFFFFE;
                break;

            case 0x63:
                // beq, bne, blt, bge, bltu, bgeu
                imm1 = (ins >> 31) << 11;
                imm2 = ((ins >> 25) & 0x3F) << 4;
                imm3 = (ins >> 8) & 0x0F;
                imm4 = ((ins >> 7) & 0x01) << 10;
                imm =  ((imm1 | imm2 | imm3 | imm4) << 1 );
                rs1 = r[(ins >> 15) & 0x1F];
                rs2 = r[(ins >> 20) & 0x1F];

                switch((ins >> 12)&0x7) {
                    
                    case 0x00:
                        // beq
                        if(rs1 == rs2) this.pc = this.pc + imm - 4|0;
                        break;

                    case 0x01:
                        // bne
                        if(rs1 != rs2) this.pc = this.pc + imm - 4|0;
                        break;

                    case 0x04:
                        // blt
                        if(rs1 < rs2) this.pc = this.pc + imm - 4|0;
                        break;

                    case 0x05:
                        // bge
                        if(rs1 >= rs2) this.pc = this.pc + imm - 4|0;
                        break;

                    case 0x06:
                        // bltu
                        if((rs1>>>0) < (rs2>>>0)) this.pc = this.pc + imm - 4|0;
                        break;

                    case 0x07:
                        // bgeu
                        if((rs1>>>0) >= (rs2>>>0)) this.pc = this.pc + imm - 4|0;
                        break;

                    default:
                        message.Debug("Error in safecpu: Instruction " + utils.ToHex(ins) + " not found");
                        message.Abort();
                        break;

                }
                break;

            case 0x73:
                // csrrw, csrrs, csrrc, csrrwi, csrrsi, csrrci, ecall, eret, ebreak, mrts, wfi
                imm = (ins >>> 20);
                rs1 = r[(ins >> 15) & 0x1F];
                rindex = (ins >> 7) & 0x1F;
                switch((ins >> 12)&0x7) {
                    
                    case 0x01:
                        // csrrw
                        r[rindex] = this.GetCSR(imm);
                        //if (rindex != ((ins >> 15) & 0x1F))
                        this.SetCSR(imm, rs1);
                        break;

                    case 0x02:
                        // csrrs
                        r[rindex] = this.GetCSR(imm);
                        this.SetCSR(imm, this.GetCSR(imm) | rs1);
                        break;

                    case 0x03:
                        // csrrc
                        r[rindex] = this.GetCSR(imm);
                        this.SetCSR(imm, this.GetCSR(imm) & (~rs1));
                        break;

                    case 0x05:
                        // csrrwi
                        r[rindex] = this.GetCSR(imm);
                        zimm = (ins >> 15) & 0x1F;
                        if(zimm != 0) this.SetCSR(imm, (zimm >> 0));
                        break;
                        

                    case 0x06:
                        // csrrsi
                        r[rindex] = this.GetCSR(imm);
                        zimm = (ins >> 15) & 0x1F;
                        if(zimm != 0) this.SetCSR(imm, this.GetCSR(imm) | (zimm >> 0));
                        break;

                    case 0x07:
                        // csrrci
                        r[rindex] = this.GetCSR(imm);
                        zimm = (ins >> 15) & 0x1F;
                        if(zimm != 0) this.SetCSR(imm, this.GetCSR(imm) & ~(zimm >> 0));
                        break;
                    
                    case 0x00:
                        // ecall, eret, ebreak, mrts, wfi
                        switch((ins >> 20)&0xFFF) {
                            case 0x00:
                                // ecall
                                switch(current_privilege_level)
                                {
                                    case PRV_U:
                                        this.Trap(CAUSE_ENVCALL_UMODE, this.pc - 4|0);
                                        break;

                                    case PRV_S:
                                        this.Trap(CAUSE_ENVCALL_SMODE, this.pc - 4|0);
                                        break;

                                    case PRV_H:
                                        this.Trap(CAUSE_ENVCALL_HMODE, this.pc - 4|0);
                                        this.Abort();
                                        break;

                                    case PRV_M:
                                        this.Trap(CAUSE_ENVCALL_MMODE, this.pc - 4|0);
                                        break;
                                    
                                    default:
                                        message.Debug("Error in ecall: Don't know how to handle privilege level " + current_privilege_level);
                                        message.Abort();
                                        break;
                                }
                                break;

                            case 0x001:
                                // ebreak
                                this.Trap(CAUSE_BREAKPOINT, this.pc - 4|0);
                                break;

                            case 0x100:
                                // eret
                                var current_privilege_level = (csr[CSR_MSTATUS] & 0x06) >> 1;
                                if(current_privilege_level < PRV_S) {
                                    message.Debug("Error in eret: current_privilege_level isn't allowed access");
                                    message.Abort();
                                    break;   
                                }
                                this.PopPrivilegeStack();

                                switch(current_privilege_level)
                                {
                                    case PRV_S:
                                        this.pc = csr[CSR_SEPC]|0;
                                        break;

                                    case PRV_H:
                                        this.pc = csr[CSR_HEPC]|0;
                                        break;

                                    case PRV_M:
                                        this.pc = csr[CSR_MEPC]|0;
                                        break;
                                    
                                    default:
                                        message.Debug("Error in eret: Don't know how to handle privilege level " + current_privilege_level);
                                        message.Abort();
                                        break;
                                }
                                break;

                            case 0x102:
                                // wfi
                                /*
                                interrupts = csr[CSR_MIE] & csr[CSR_MIP];
                                if ((!interrupts) && (this.htif.IsQueueEmpty()))
                                    return steps;
                                */
                                break;

                            case 0x305:
                                // mrts
                                if (current_privilege_level != PRV_M) {
                                    message.Debug("Error in mrts: current_privilege_level isn't allowed access");
                                    message.Abort();
                                    break;   
                                }
                                csr[CSR_MSTATUS] = (csr[CSR_MSTATUS] & ~0x6) | 0x02; //Setting the Privilage level to Supervisor
                                csr[CSR_SBADADDR] = csr[CSR_MBADADDR];
                                csr[CSR_SCAUSE] = csr[CSR_MCAUSE];
                                csr[CSR_SEPC] = csr[CSR_MEPC];
                                this.pc = csr[CSR_STVEC]|0;
                                break;

                            case 0x101:
                                // sfence.vm
                                break;

                            default:
                                message.Debug("Error in safecpu: Instruction " + utils.ToHex(ins) + " not found");
                                message.Abort();
                                break;

                        }
                        break; 

                    default:
                        message.Debug("Error in safecpu: Instruction " + utils.ToHex(ins) + " not found");
                        message.Abort();
                        break;

                }
                break;

            case 0x07:
                // flw, fld
                imm = (ins >> 20);
                rs1 = r[(ins >> 15) & 0x1F];
                rindex = ((ins >> 7) & 0x1F);
                switch((ins >> 12)&0x7) {
                    
                    case 0x02:
                        // flw
                        if (rs1+imm & 3) {
                             message.Debug("Error in flw: unaligned address");
                             message.Abort();
                        }
                        paddr = this.TranslateVM(rs1 + imm|0,VM_READ);
                        if(paddr == -1) break;
                        r[0] = this.ram.Read32(paddr);
                        f[rindex] = ff[0];
                        break;

                    case 0x03:
                        // fld
                        if (rs1+imm & 7) {
                             message.Debug("Error in flw: unaligned address");
                             message.Abort();
                        }
                        paddr = this.TranslateVM(rs1 + imm|0,VM_READ);
                        if(paddr == -1) break;
                        fi[(rindex<<1) + 0] = this.ram.Read32(paddr+0);
                        fi[(rindex<<1) + 1] = this.ram.Read32(paddr+4);
                        break;

                    default:
                        message.Debug("Error in safecpu: Instruction " + utils.ToHex(ins) + " not found");
                        message.Abort();
                        break;

                }
                break;

            case 0x27:
                // fsw, fsd
                imm1 = (ins >> 25);
                imm2 = (ins >> 7) & 0x1F;
                imm = (imm1 << 5) + imm2;
                rs1 = r[(ins >> 15) & 0x1F];
                rindex = (ins >> 20) & 0x1F;
                switch((ins >> 12)&0x7) {

                    case 0x02:
                        // fsw
                        ff[0] = f[rindex];
                        if (rs1+imm & 3) {
                             message.Debug("Error in fsw: unaligned address");
                             message.Abort();
                        }
                        paddr = this.TranslateVM(rs1 + imm|0, VM_WRITE);
                        if(paddr == -1) break;
                        this.ram.Write32(paddr, r[0]);
                        break;

                    case 0x03:
                        // fsd
                        if (rs1+imm & 7) {
                             message.Debug("Error in fsd: unaligned address");
                             message.Abort();
                        }
                        paddr = this.TranslateVM(rs1 + imm|0, VM_WRITE);
                        if (paddr == -1) break;
                        this.ram.Write32(paddr+0, fi[(rindex<<1) + 0]);
                        this.ram.Write32(paddr+4, fi[(rindex<<1) + 1]);
                        break;

                    default:
                        message.Debug("Error in safecpu: Instruction " + utils.ToHex(ins) + " not found");
                        message.Abort();
                        break;

                }
                break;

            case 0x53:
                // fadd, fsub
                rindex = (ins >> 7) & 0x1F;
                switch((ins >> 25)&0x7F) {
                    
                    case 0x00:
                    case 0x01:
                        // fadd.s, fadd.d
                        fs1 = f[(ins >> 15) & 0x1F];
                        fs2 = f[(ins >> 20) & 0x1F];
                        f[rindex] = fs1 + fs2;
                        break;

                    case 0x04:
                    case 0x05:
                        // fsub.s, fsub.d
                        fs1 = f[(ins >> 15) & 0x1F];
                        fs2 = f[(ins >> 20) & 0x1F];
                        f[rindex] = fs1 - fs2;
                        break;

                    case 0x50:
                    case 0x51:
                        // fcmp.s, fcmp.d
                        fs1 = f[(ins >> 15) & 0x1F];
                        fs2 = f[(ins >> 20) & 0x1F];
                        switch((ins >> 12) & 0x7) {
                            case 0x0:
                                if (fs1 <= fs2) r[rindex] = 1;
                                else r[rindex] = 0;
                                break;

                            case 0x1:
                                if (fs1 < fs2) r[rindex] = 1;
                                else r[rindex] = 0;
                                break;

                            case 0x2:
                                if (fs1 == fs2) r[rindex] = 1;
                                else r[rindex] = 0;
                                break;

                            default:
                                message.Debug("Error in safecpu: Instruction (fcmp) " + utils.ToHex(ins) + " not found");
                                message.Abort();
                                break;
                        }
                        break;

                    case 0x20: // fcvt.s.d
                    case 0x21: // fcvt.d.s
                        fs1 = f[(ins >> 15) & 0x1F];
                        f[rindex] = fs1;
                        break;

                    case 0x60:
                        //fcvt.w.s
                        r[rindex] = f[(ins >> 15) & 0x1F];
                        break;

                    case 0x61:
                        //fcvt.w.d
                        r[rindex] = f[(ins >> 15) & 0x1F];
                        break;

                    case 0x68:
                        //fcvt.s.w
                        f[rindex] = r[(ins >> 15) & 0x1F];
                        break;

                    case 0x69:
                        //fcvt.d.w
                        f[rindex] = r[(ins >> 15) & 0x1F];
                        break;


                    case 0x08:
                    case 0x09:
                        //fmul.s, fmul.d
                        fs1 = f[(ins >> 15) & 0x1F];
                        fs2 = f[(ins >> 20) & 0x1F];
                        f[rindex] = fs1 * fs2;
                        break;

                    case 0x10: // single precision
                    case 0x11: // double precision
                        // fsgnj
                        fs1 = f[(ins >> 15) & 0x1F];
                        fs2 = f[(ins >> 20) & 0x1F];
                        switch((ins >> 12) & 7) {
                            case 0:
                                // fsgnj.d, also used for fmv.d
                                f[rindex] = (fs2<0)?-Math.abs(fs1):Math.abs(fs1);
                                break;

                            case 1:
                                // fsgnjn.d
                                f[rindex] = (fs2<0)?Math.abs(fs1):-Math.abs(fs1);
                                break;

                            case 2:
                                // fsgnjx.d
                                f[rindex] = ((fs2<0 && fs1<0) || (fs2>0 && fs1>0))?Math.abs(fs1):-Math.abs(fs1);
                                break;

                            default:
                                message.Debug("Error in safecpu: Instruction (fsgn) " + utils.ToHex(ins) + " not found");
                                message.Abort();
                        }
                        break;

                    case 0x78:
                        // fmv.s.x
                        rs1 = r[(ins >> 15) & 0x1F];
                        r[0] = rs1;
                        f[rindex] = ff[0]; 
                        break;


                    default:
                        message.Debug("Error in safecpu: Instruction " + utils.ToHex(ins) + " not found");
                        message.Abort();
                        break;
                }
                break;

            case 0x43:
                // fmadd.d, fmadd.s
                fs1 = f[(ins >> 15) & 0x1F];
                fs2 = f[(ins >> 20) & 0x1F];
                fs3 = f[(ins >> 27) & 0x1F];
                rindex = (ins >> 7) & 0x1F;
                f[rindex] = fs1 * fs2 + fs3;
                break;

            case 0x47:
                // fmsub.d, fmsub.s
                fs1 = f[(ins >> 15) & 0x1F];
                fs2 = f[(ins >> 20) & 0x1F];
                fs3 = f[(ins >> 27) & 0x1F];
                rindex = (ins >> 7) & 0x1F;
                f[rindex] = fs1 * fs2 - fs3;
                break;

            case 0x4B:
                // fnmadd.d, fnmadd.s
                fs1 = f[(ins >> 15) & 0x1F];
                fs2 = f[(ins >> 20) & 0x1F];
                fs3 = f[(ins >> 27) & 0x1F];
                rindex = (ins >> 7) & 0x1F;
                f[rindex] = -(fs1 * fs2 + fs3);
                break;

            case 0x4F:
                // fnmsub.d, fnmsub.s
                fs1 = f[(ins >> 15) & 0x1F];
                fs2 = f[(ins >> 20) & 0x1F];
                fs3 = f[(ins >> 27) & 0x1F];
                rindex = (ins >> 7) & 0x1F;
                f[rindex] = -(fs1 * fs2 - fs3);
                break;

            case 0x2F:
                // amoswap, amoadd, amoxor, amoand, amoor, amomin, amomax, amominu, amomaxu
                rs1 = r[(ins >> 15) & 0x1F];
                rs2 = r[(ins >> 20) & 0x1F];
                rindex = (ins >> 7) & 0x1F;
                paddr = this.TranslateVM(rs1|0, VM_READ);
                if (paddr == -1) break;

                switch((ins >> 27)&0x1F) {
                    
                    case 0x01:
                        // amoswap
                        r[rindex] = this.ram.Read32(paddr);
                        paddr = this.TranslateVM(rs1|0, VM_WRITE);
                        if(paddr == -1) break;
                        this.ram.Write32(paddr, rs2);
                        break;

                    case 0x00:
                        // amoadd
                        r[rindex] = this.ram.Read32(paddr);
                        paddr = this.TranslateVM(rs1|0, VM_WRITE);
                        if(paddr == -1) break;
                        this.ram.Write32(paddr,r[rindex] + rs2);
                        break;

                    case 0x04:
                        // amoxor
                        r[rindex] = this.ram.Read32(paddr);
                        paddr = this.TranslateVM(rs1|0, VM_WRITE);
                        if(paddr == -1) break;
                        this.ram.Write32(paddr,r[rindex] ^ rs2);
                        break;

                    case 0x0C:
                        // amoand
                        r[rindex] = this.ram.Read32(paddr);
                        paddr = this.TranslateVM(rs1|0, VM_WRITE);
                        if(paddr == -1) break;
                        this.ram.Write32(paddr, r[rindex] & rs2);
                        break;

                    case 0x08:
                        // amoor
                        r[rindex] = this.ram.Read32(paddr);
                        paddr = this.TranslateVM(rs1|0, VM_WRITE);
                        if(paddr == -1) break;
                        this.ram.Write32(paddr, r[rindex] | rs2);
                        break;

                    case 0x10:
                        // amomin
                        r[rindex] = this.ram.Read32(paddr);
                        if((rs2 >> 0) > (r[rindex] >> 0)) r[0] = r[rindex];
                        else r[0] = rs2;
                        paddr = this.TranslateVM(rs1|0, VM_WRITE);
                        if(paddr == -1) break;
                        this.ram.Write32(paddr, r[0]);
                        break;

                   case 0x14:
                        // amomax
                        r[rindex] = this.ram.Read32(paddr);
                        if(rs2 < r[rindex]) r[0] = r[rindex];
                        else r[0] = rs2;
                        paddr = this.TranslateVM(rs1, VM_WRITE);
                        if(paddr == -1) break;
                        this.ram.Write32(paddr, r[0]);
                        break;

                    case 0x18:
                        // amominu
                        r[rindex] = this.ram.Read32(paddr);
                        if((rs2 >>> 0) > (r[rindex] >>> 0)) r[0] = r[rindex];
                        else r[0] = rs2;
                        paddr = this.TranslateVM(rs1, VM_WRITE);
                        if(paddr == -1) break;
                        this.ram.Write32(paddr, r[0]);
                        break;

                    case 0x1C:
                        // amomaxu
                        r[rindex] = this.ram.Read32(paddr);
                        if((rs2 >>> 0) < (r[rindex] >>> 0)) r[0] = r[rindex];
                        else r[0] = rs2;
                        paddr = this.TranslateVM(rs1, VM_WRITE);
                        if(paddr == -1) break;
                        this.ram.Write32(paddr, r[0]);
                        break;

                    case 0x02:
                        // lr.d
                        r[rindex] = this.ram.Read32(paddr);
                        this.amoaddr = rs1;
                        this.amovalue = r[rindex];
                        break;

                    case 0x03:
                        // sc.d
                        if(rs1 != this.amoaddr) {
                            r[rindex] = 0x01;
                            break;
                        }
                        if(this.ram.Read32(paddr) != this.amovalue) {
                            r[rindex] = 0x01;
                            break;
                        }
                        r[rindex] = 0x00;
                        paddr = this.TranslateVM(rs1, VM_WRITE);
                        if (paddr == -1) break;
                        this.ram.Write32(paddr, rs2);
                        break;

                    default:
                        message.Debug("Error in Atomic Memory Instruction " + utils.ToHex(ins) + " not found");
                        message.Abort();
                        break;

                }
                break;

            case 0x0F:
                // fence
                break;

            default:
                message.Debug("Error in safecpu: Instruction " + utils.ToHex(ins) + " not found at "+utils.ToHex(this.pc));
                message.Abort();
                break;
        }

    } while(steps=steps-1|0);

    return 0;
};

module.exports = SafeCPU;
