// -------------------------------------------------
// -------------------- CPU ------------------------
// -------------------------------------------------

// TODO mideleg

"use strict";
var message = require('../messagehandler');
var utils = require('../utils');
var DebugIns = require('./disassemble');

var PRV_U = 0x00;  // user mode
var PRV_S = 0x01;  // supervisor mode
var PRV_H = 0x02;  // hypervisor mode
var PRV_M = 0x03;  // machine mode

var VM_READ  = 0;
var VM_WRITE = 1;
var VM_FETCH = 2;

var CAUSE_MISALIGNED_FETCH    = 0x0;
var CAUSE_FAULT_FETCH         = 0x1;
var CAUSE_ILLEGAL_INSTRUCTION = 0x2;
var CAUSE_BREAKPOINT          = 0x3;
var CAUSE_MISALIGNED_LOAD     = 0x4;
var CAUSE_FAULT_LOAD          = 0x5;
var CAUSE_MISALIGNED_STORE    = 0x6;
var CAUSE_FAULT_STORE         = 0x7;
var CAUSE_USER_ECALL          = 0x8;
var CAUSE_SUPERVISOR_ECALL    = 0x9;
var CAUSE_HYPERVISOR_ECALL    = 0xa;
var CAUSE_MACHINE_ECALL       = 0xb;
/*
var CAUSE_SOFTWARE_INTERRUPT  = 0xc; // interprocess interrupts (ipi)
var CAUSE_TIMER_INTERRUPT     = 0xd;
var CAUSE_HOST_INTERRUPT      = 0xe; // trap from machine mode
*/

/*
var CAUSE_TIMER_INTERRUPT          = (1<<31) | 0x01;
var CAUSE_HOST_INTERRUPT           = (1<<31) | 0x02;
var CAUSE_SOFTWARE_INTERRUPT       = (1<<31) | 0x00;
*/

var MSTATUS_UIE     = 0x00000001; // interrupt enable bits
var MSTATUS_SIE     = 0x00000002;
var MSTATUS_HIE     = 0x00000004;
var MSTATUS_MIE     = 0x00000008; // machine
var MSTATUS_UPIE    = 0x00000010; // interrupt-enable bit active prior to the trap
var MSTATUS_SPIE    = 0x00000020;
var MSTATUS_HPIE    = 0x00000040;
var MSTATUS_MPIE    = 0x00000080;
var MSTATUS_SPP     = 0x00000100; // previous privilege  mode
var MSTATUS_HPP     = 0x00000600;
var MSTATUS_MPP     = 0x00001800; // privilege mode
var MSTATUS_FS      = 0x00006000; // tracking current state of floating point unit
var MSTATUS_XS      = 0x00018000; // status of user-mode extensions
var MSTATUS_MPRV    = 0x00020000; // priviege level at which loads and stores execute
var MSTATUS_PUM     = 0x00040000; // protect user memory
var MSTATUS_MXR     = 0x00080000; // make executable readable
var MSTATUS_VM      = 0x1F000000; // mode of virtual memory (MMU)
var MSTATUS_SD      = 0x80000000;

var VM_MBARE = 0;
var VM_MBB   = 1;
var VM_MBBID = 2;
var VM_SV32  = 8;
var VM_SV39  = 9;
var VM_SV48  = 10;

// page table entry (PTE) fields
var PTE_V     = 0x001 // Valid
var PTE_R     = 0x002 // Read
var PTE_W     = 0x004 // Write
var PTE_X     = 0x008 // Execute
var PTE_U     = 0x010 // User
var PTE_G     = 0x020 // Global
var PTE_A     = 0x040 // Accessed
var PTE_D     = 0x080 // Dirty
var PTE_SOFT  = 0x300 // Reserved for Software

var IRQ_S_SOFT  = 1;
var IRQ_H_SOFT  = 2;
var IRQ_M_SOFT  = 3;
var IRQ_S_TIMER = 5;
var IRQ_H_TIMER = 6;
var IRQ_M_TIMER = 7;
var IRQ_S_EXT   = 9;
var IRQ_H_EXT   = 10;
var IRQ_M_EXT   = 11;
var IRQ_COP     = 12; // computer operating properly
var IRQ_HOST    = 13;

var MIP_SSIP = (1 << IRQ_S_SOFT);
var MIP_HSIP = (1 << IRQ_H_SOFT);
var MIP_MSIP = (1 << IRQ_M_SOFT);
var MIP_STIP = (1 << IRQ_S_TIMER);
var MIP_HTIP = (1 << IRQ_H_TIMER);
var MIP_MTIP = (1 << IRQ_M_TIMER);
var MIP_SEIP = (1 << IRQ_S_EXT);
var MIP_HEIP = (1 << IRQ_H_EXT);
var MIP_MEIP = (1 << IRQ_M_EXT);

// User CSRs standard read/write
var CSR_FFLAGS    = 0x001; // Floating-Point Accrued Exceptions
var CSR_FRM       = 0x002; // Floating-Point Dynamic Rounding Mode
var CSR_FCSR      = 0x003; // Floating-Point Control and Status Register

// Supervisor CSRs standard read/write
var CSR_SSTATUS   = 0x100; // Supervisor status register
var CSR_SIE       = 0x104; // Supervisor interrupt-enable register
var CSR_STVEC     = 0x105; // Supervisor trap handler base address.
var CSR_SSCRATCH  = 0x140; // Scratch register for supervisor trap handlers.
var CSR_SEPC      = 0x141; // Supervisor exception program counter
var CSR_SCAUSE    = 0x142; // Supervisor trap cause
var CSR_SIP       = 0x144; // Supervisor interrupt pending
var CSR_SPTBR     = 0x180; // Page-table base register
var CSR_SBADADDR  = 0x143; // Supervisor bad address

// Hypervisor CSR standard read/write
var CSR_HEPC      = 0x241; // Hypervisor exception program counte

// Machine CSRs standard read/write
var CSR_MSTATUS   = 0x300; // Machine status register
var CSR_MISA      = 0x301; // ISA and extensions supported
var CSR_MEDELEG   = 0x302; // Machine exception delegation register.
var CSR_MIDELEG   = 0x303; // Machine interrupt delegation register.
var CSR_MIE       = 0x304; // Machine interrupt-enable registe
var CSR_MTVEC     = 0x305; // Machine trap-handler base address.

var CSR_MUCOUNTEREN = 0x320; // machine counter enable register (user)
var CSR_MSCOUNTEREN = 0x321; // machine counter enable register (supervisor)

var CSR_MSCRATCH  = 0x340; // Scratch register for machine trap handlers
var CSR_MEPC      = 0x341; // Machine exception program counter
var CSR_MCAUSE    = 0x342; // Machine trap cause
var CSR_MBADADDR  = 0x343; // Machine bad address
var CSR_MIP       = 0x344; // Machine interrupt pending

// Machine CSRs standard read/write and unknown
var CSR_MRESET    = 0x782;
var CSR_SEND_IPI  = 0x783;

// unknown
var CSR_SASID     = 0x181;

// Supervisor CSRs standard read/write and unknown
var CSR_CYCLEW    = 0x900;
var CSR_TIMEW     = 0x901;
var CSR_INSTRETW  = 0x902;
var CSR_CYCLEHW   = 0x980;
var CSR_TIMEHW    = 0x981;
var CSR_INSTRETHW = 0x982;

// user CSRs standard read only
var CSR_CYCLE     = 0xC00; // Cycle counter for RDCYCLE instruction
var CSR_TIME      = 0xC01; // Timer for RDTIME instruction
var CSR_INSTRET   = 0xC02; // Instructions-retired counter for RDINSTRET instruction
var CSR_CYCLEH    = 0xC80; // Upper 32 bits of cycle, RV32I only
var CSR_TIMEH     = 0xC81; // Upper 32 bits of time, RV32I only
var CSR_INSTRETH  = 0xC82; // Upper 32 bits of instret, RV32I only

// machine CSRs non-standard read-only
//var CSR_MCPUID    = 0xF00;
//var CSR_MIMPID    = 0xF01;
var CSR_MHARTID   = 0xF14;

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

    this.Reset();
}

function get_field(reg, mask) {
    var reg = reg|0;
    var mask = mask|0;
    return ((reg & mask) / (mask & ~(mask << 1)));
}

function set_field(reg, mask, val) {
    var reg = reg|0;
    var mask = mask|0;
    var val = val|0;
    return ((reg & ~mask) | ((val * (mask & ~(mask << 1))) & mask));
}

SafeCPU.prototype.Reset = function() {
    this.ticks = 0;
    this.prv = PRV_M;
    this.csr[CSR_MSTATUS]  = (0x0 << 24); // mbare vm mode, no mie, noe mprv
    this.csr[CSR_MHARTID]  = 0x00; // hardware thread id is fixed to zero (= cpu id)
    this.csr[CSR_MISA]     = (1<<8) | (1<<12) | (1<<0) | (1<<30) | (1<<5) | (1<<3); // base ISA, multiply mul/div, atomic instructions, 32-Bit, single precision, double precision
    this.csr[CSR_MCAUSE]   = 0x00; // cause of the reset, hard reset

    // for atomic load & store instructions
    this.amoaddr = 0x00;
    this.amovalue = 0x00;

    this.pc = 0x1000; // implementation defined start address, boot in ROM
}

SafeCPU.prototype.InvalidateTLB = function() {
}

SafeCPU.prototype.GetTimeToNextInterrupt = function () {
    var delta = (this.csr[CSR_CMP]>>>0) - (this.ticks & 0xFFFFFFFF);
    delta = delta + (delta<0?0xFFFFFFFF:0x0) | 0;
    return delta;
}

SafeCPU.prototype.GetTicks = function () {
    return this.ticks;
}

SafeCPU.prototype.ProgressTime = function (delta) {
    this.ticks = this.ticks + delta | 0;
}

// we haveto define these to copy the cpus
SafeCPU.prototype.AnalyzeImage = function() {
}

// Count number of contiguous 0 bits starting from the LSB.
function ctz(val)
{
    var res = 0;
    val = val | 0;
    if (val) {
        while ((val & 1) == 0) {
            val >>= 1;
            res++;
        }
    }
    return res;
}

SafeCPU.prototype.RaiseInterrupt = function (line, cpuid) {
    //message.Debug("raise int " + line);
    //this.csr[CSR_MIP] |= MIP_MSIP;
    //this.csr[CSR_MIP] |= MIP_MEIP; // EXT
    //this.csr[CSR_MIP] |= MIP_MTIP; // Timer
    //this.csr[CSR_MIP] |= MIP_MSIP; // Soft
};

SafeCPU.prototype.ClearInterrupt = function (line, cpuid) {
    // message.Debug("clear int " + line);
    //this.csr[CSR_MIP] &= ~line;
    //this.csr[CSR_MIP] &= ~MIP_MSIP;
};

SafeCPU.prototype.CheckForInterrupt = function () {
    var pending_interrupts = this.csr[CSR_MIP] & this.csr[CSR_MIE];
/*
    var mie = (this.csr[CSR_MSTATUS] >> 3) & 1;
    var m_enabled = this.prv < PRV_M || (this.prv == PRV_M && mie);
    var enabled_interrupts = pending_interrupts & ~this.csr[CSR_MIDELEG] & -m_enabled;

    var sie = (this.csr[CSR_MSTATUS] >> 1) & 1;
    var s_enabled = (this.prv < PRV_S) || ((this.prv == PRV_S) && sie);
    enabled_interrupts |= pending_interrupts & this.csr[CSR_MIDELEG] & -s_enabled;
*/
    var mie = get_field(this.csr[CSR_MSTATUS], MSTATUS_MIE);
    var m_enabled = (this.prv < PRV_M) || ((this.prv == PRV_M) && mie);
    var enabled_interrupts = pending_interrupts & ~this.csr[CSR_MIDELEG] & -m_enabled;

    var sie = get_field(this.csr[CSR_MSTATUS], MSTATUS_SIE);
    var s_enabled = this.prv < PRV_S || (this.prv == PRV_S && sie);
    enabled_interrupts |= pending_interrupts & this.csr[CSR_MIDELEG] & -s_enabled;

    if (enabled_interrupts) {
        this.Trap(0x80000000 | ctz(enabled_interrupts), this.pc);
    }
};


SafeCPU.prototype.Trap = function (cause, epc) {
    cause = cause|0;

    //message.Debug("Trap cause=" + utils.ToHex(cause) + " " + utils.ToHex(epc));
    //message.Abort();

    // by default, trap to M-mode, unless delegated to S-mode
    var bit = cause;
    var deleg = this.csr[CSR_MEDELEG];
    if (bit & (1<<31)) {
        deleg = this.csr[CSR_MIDELEG];
        bit &= ~(1<<31);
    }
    if (this.prv <= PRV_S && bit < 32 && ((deleg >> bit) & 1)) {
        // handle the trap in S-mode
        this.pc = this.csr[CSR_STVEC];
        this.csr[CSR_SCAUSE] = cause;
        this.csr[CSR_SEPC] = epc;

        var s = this.csr[CSR_MSTATUS] | 0;
/*
        s &= ~(MSTATUS_SIE | MSTATUS_SPP | MSTATUS_SPIE);
        s |= this.prv << 8; // to SPP bit
        s |= (this.csr[CSR_MSTATUS] & (MSTATUS_UIE << this.prv))?1<<5:0; // set MSTATUS_SPIE
*/
        s = set_field(s, MSTATUS_SPIE, get_field(s, MSTATUS_UIE << this.prv));
        s = set_field(s, MSTATUS_SPP, this.prv);
        s = set_field(s, MSTATUS_SIE, 0);
        this.csr[CSR_MSTATUS] = s;

        this.prv = PRV_S;
    } else {
        this.pc = this.csr[CSR_MTVEC];
        this.csr[CSR_MEPC] = epc;
        this.csr[CSR_MCAUSE] = cause;

        var s = this.csr[CSR_MSTATUS] | 0;
/*
        s &= ~(MSTATUS_MIE | MSTATUS_MPP | MSTATUS_MPIE);
        s |= this.prv << 11; // to MPP bit
        s |= (this.csr[CSR_MSTATUS] & (MSTATUS_UIE << this.prv))?1<<7:0; // set MPIE
*/
        //s |= ((this.csr[CSR_MSTATUS] >> this.prv)&1) << 7; // set MPIE
        //s = set_field(s, MSTATUS_MPIE, get_field(s, MSTATUS_UIE << this.prv));

        s = set_field(s, MSTATUS_MPIE, get_field(s, MSTATUS_UIE << this.prv));
        s = set_field(s, MSTATUS_MPP, this.prv);
        s = set_field(s, MSTATUS_MIE, 0);
        this.csr[CSR_MSTATUS] = s;

        this.prv = PRV_M;
    }

    this.amoaddr = 0x00;
    this.amovalue = 0x00;
};

SafeCPU.prototype.MemAccessTrap = function(addr, op) {
    // TODO: decide which register, see trap
    this.csr[CSR_MBADADDR] = addr;
    this.csr[CSR_SBADADDR] = addr;
    switch(op) {
        case VM_READ:
            this.Trap(CAUSE_FAULT_LOAD, this.pc - 4|0);
            break;

        case VM_WRITE:
            this.Trap(CAUSE_FAULT_STORE, this.pc - 4|0);
            break;

        case VM_FETCH:
            this.Trap(CAUSE_FAULT_FETCH, this.pc);
            break;
    }
}


SafeCPU.prototype.CheckVMPrivilege = function (pte, op) {
    var type = (pte >> 1) & 0xF;
    var supervisor = this.prv == PRV_S;
    var pum = this.csr[CSR_MSTATUS] & MSTATUS_PUM; // protect user memory
    var mxr = this.csr[CSR_MSTATUS] & MSTATUS_MXR; // make executable readable

    if ((pte & PTE_U) ? supervisor && pum : !supervisor) {
      return false;
    } else
    if (!(pte & PTE_V) || (!(pte & PTE_R) && (pte & PTE_W))) {
      return false;
    } else
    if (op == VM_FETCH ? !(pte & PTE_X) :
               op == VM_READ ?  !(pte & PTE_R) && !(mxr && (pte & PTE_X)) :
                                !((pte & PTE_R) && (pte & PTE_W))) {
        return false;
    }
    return true;
}


/* Translates a virtual address to a physical by walking through
 * the page table and checking  the rights
 */
SafeCPU.prototype.TranslateVM = function (addr, op) {
    var vm = (this.csr[CSR_MSTATUS] >> 24) & 0x1F;
    var PGSIZE = 4096;
    var PGMASK = ~(PGSIZE-1);
    var PGSHIFT = 12;
    var ptidxbits = 10;
    var ptesize = 4;

    // vm bare mode
    if (vm == VM_MBARE || this.prv == PRV_M) return addr;

    // only RV32 supported
    if(vm != VM_SV32) {
        message.Debug("unkown VM Mode " + vm + " at PC " + utils.ToHex(this.pc));
        message.Abort();
    }

    // LEVEL 1
    // get first entry in page table
    var base = this.csr[CSR_SPTBR] << PGSHIFT;
    var pte = this.ram.Read32(base + ((addr >>> 22) << 2)) | 0;

    //message.Debug("VM Start " + utils.ToHex(addr) + " " + utils.ToHex(base) + " " + utils.ToHex(pte));
    /* check if pagetable is finished here */
    if ((pte & 0xF) != 0x1) {
        if (!this.CheckVMPrivilege(pte, op)) {
            this.MemAccessTrap(addr, op);
            return -1;
        }
    //message.Debug("VM L1 " + utils.ToHex(addr) + " " + utils.ToHex(base) + " " + utils.ToHex(((pte >> 10) << 12) | (addr&0x3FFFFF)));
    //message.Abort();
        return ((pte >> 10) << 12) | (addr&0x3FFFFF);
    }
    // LEVEL 2
    base = (pte & 0xFFFFFC00) << 2;
    var new_page_num = (addr >> 12) & 0x3FF;
    pte = this.ram.Read32(base + (new_page_num << 2)) | 0;

    //message.Debug("Level 2 " + utils.ToHex(addr) + " " + utils.ToHex(base) + " " + utils.ToHex(pte));
    //message.Abort();

    /* only 2 levels are allowed in 32-Bit mode */
    if ((pte & 0xF) == 0x1) {
        this.MemAccessTrap(addr, op);
        return -1;
    }

    if (!this.CheckVMPrivilege(pte, op)) {
        this.MemAccessTrap(addr, op);
        return -1;
    }
    //message.Debug("VM L2 " + utils.ToHex(addr) + " " + utils.ToHex(base) + " " + utils.ToHex( ((pte >> 10) << 12) | (addr & 0xFFF) ));
    //message.Abort();
    return ((pte >> 10) << 12) | (addr & 0xFFF);
};


SafeCPU.prototype.SetCSR = function (addr, value) {

    //message.Debug("SetCSR: Address:" + utils.ToHex(addr) + ", value " + utils.ToHex(value));
    var csr = this.csr;

    switch(addr)
    {
        case CSR_MSTATUS:
            if ((value ^ csr[CSR_MSTATUS]) & (MSTATUS_VM | MSTATUS_MPP | MSTATUS_MPRV | MSTATUS_PUM | MSTATUS_MXR)) {
                this.InvalidateTLB();
            }
            var mask = MSTATUS_SIE | MSTATUS_SPIE | MSTATUS_MIE | MSTATUS_MPIE
                     | MSTATUS_SPP | MSTATUS_FS | MSTATUS_MPRV | MSTATUS_PUM
                     | MSTATUS_MPP | MSTATUS_MXR | MSTATUS_XS;
            mask |= MSTATUS_VM;
            csr[addr] = (value & ~mask) | (value & mask);
            var dirty = (csr[CSR_MSTATUS] & MSTATUS_FS) == MSTATUS_FS;
            dirty |= (csr[CSR_MSTATUS] & MSTATUS_XS) == MSTATUS_XS;
            csr[CSR_MSTATUS] = (csr[CSR_MSTATUS] & ~MSTATUS_SD) | (dirty?1<<MSTATUS_SD:0);
            //message.Debug("MSTATUS VM: " + ((csr[CSR_MSTATUS] & MSTATUS_VM) >> 24));
            break;

        case CSR_SSTATUS:
            csr[addr] = value;
            var mask = MSTATUS_SIE | MSTATUS_SPIE | MSTATUS_SPP | MSTATUS_FS | MSTATUS_XS | MSTATUS_PUM;
            this.SetCSR(CSR_MSTATUS, (csr[CSR_MSTATUS] & ~mask) | (value & mask));
            break;

        case CSR_MIE:
            var mask = MIP_SSIP | MIP_STIP | MIP_SEIP | (1 << IRQ_COP) | MIP_MSIP | MIP_MTIP;
            csr[CSR_MIE] = (csr[CSR_MIE] & ~mask) | (value & mask);
            message.Debug("Write MIE: " + utils.ToHex(csr[CSR_MIE]));
            break;

        case CSR_SIE:
            csr[CSR_MIE] = (csr[CSR_MIE] & ~csr[CSR_MIDELEG]) | (value & csr[CSR_MIDELEG]);
            break;
/*
        case CSR_MCPUID:
            //csr[addr] = value;
            break;

        case CSR_MIMPID:
            csr[addr] = value;
            break;

        case CSR_MHARTID:
            csr[addr] = value;
            break;
*/
        case CSR_MISA:
            // TODO: only a few bits can be changed
            csr[CSR_MISA] = value;
            break;

        case CSR_MIP:
            var mask = MIP_SSIP | MIP_STIP;
            csr[CSR_MIP] = (csr[CSR_MIP] & ~mask) | (value & mask);
            message.Debug("Write MIP: " + utils.ToHex(csr[CSR_MIP]));
            break;

        case CSR_SEPC:
        case CSR_MEPC:
            csr[addr] = value;
            break;

/*

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

        case CSR_SIP:
            var mask = 0x2; // mask = MIP_SSIP
            csr[CSR_MIP] = (csr[CSR_MIP] & ~mask) | (value & mask);
            break;
*/

        case CSR_FCSR:
        case CSR_MEDELEG:
        case CSR_MIDELEG:
        case CSR_MSCRATCH:
        case CSR_SSCRATCH:
        case CSR_SPTBR:
            csr[addr] = value;
            break;

        case CSR_STVEC:
        case CSR_MTVEC:
            csr[addr] = value >> 2 << 2;
            break;

        case CSR_MUCOUNTEREN:
        case CSR_MSCOUNTEREN:
            csr[addr] = value;
            break;

        case CSR_TIME:
        case CSR_TIMEH:
            csr[addr] = value;
            break;

/*
        case CSR_CYCLEW:
            csr[addr] = value;
            break;

        case CSR_CYCLE:
            this.ticks = value;
            csr[addr] = value;
            break;

        case CSR_TIMEW:
            csr[addr] = value;
            break;

        case CSR_FRM:
            csr[addr] = value;
            break;

        case CSR_FFLAGS:
            csr[addr] = value;
            break;

*/
        default:
            csr[addr] = value;
            message.Debug("Error in SetCSR: PC "+utils.ToHex(this.pc)+" Address " + utils.ToHex(addr) + " unkown");
            message.Abort();
            break;
    }
};

SafeCPU.prototype.GetCSR = function (addr) {

    //message.Debug("GetCSR: Address:" + utils.ToHex(addr));
    var csr = this.csr;
    switch(addr)
    {
        case CSR_FCSR:
            return 0x0;
            break;
/*
        case CSR_MCPUID:
            return csr[addr];
            break;

        case CSR_MIMPID:
            return csr[addr];
            break;
*/
        case CSR_MHARTID:
            return csr[addr];
            break;

        case CSR_MISA:
            return csr[addr];
            break;

        case CSR_SIE:
            return csr[addr] & csr[CSR_MIDELEG];
            break;

        case CSR_MIE:
            return csr[addr];
            break;

        case CSR_SEPC:
        case CSR_MEPC:
        case CSR_MCAUSE:
        case CSR_SCAUSE:
        case CSR_MEDELEG:
        case CSR_MIDELEG:
        case CSR_MSTATUS:
        case CSR_MIP:
        case CSR_SBADADDR:
        case CSR_MBADADDR:
            return csr[addr];
            break;

        case CSR_SSTATUS:
            var mask = MSTATUS_SIE | MSTATUS_SPIE | MSTATUS_SPP | MSTATUS_FS
                       | MSTATUS_XS | MSTATUS_PUM;
            var sstatus = csr[CSR_MSTATUS] & mask;
            if ((sstatus & MSTATUS_FS) == MSTATUS_FS ||
                (sstatus & MSTATUS_XS) == MSTATUS_XS)
                sstatus |= MSTATUS_SD;
            return sstatus;
            break;


/*
        case CSR_SIP:
            return csr[CSR_MIP] & (0x2 | 0x20); //(MIP_SSIP | MIP_STIP)
            break;

*/
        case CSR_MSCRATCH:
        case CSR_SSCRATCH:
            return csr[addr];
            break;

        case CSR_SPTBR:
            return csr[addr];
            break;

        case CSR_STVEC:
        case CSR_MTVEC:
            return csr[addr];
            break;

        case CSR_MUCOUNTEREN:
        case CSR_MSCOUNTEREN:
            return csr[addr];
            break;

        case CSR_TIME:
            return this.ticks;
            break;

        case CSR_TIMEH:
            return 0x0;
            break;
/*
        case CSR_CYCLEW:
            return this.ticks;
            break;

        case CSR_CYCLE:
            return this.ticks;
            break;

        case CSR_TIME:
        case CSR_TIMEW:
            return this.ticks;
            break;

        case CSR_FRM:
            return csr[addr];
            break;

        case CSR_FFLAGS:
            return csr[addr];
            break;
*/
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
        
        if (!(steps & 63)) {
            this.CheckForInterrupt();
            /*
            // interrupt is state.mip &= ~MIP_MTIP
            // ---------- TICK ----------

            var delta = csr[CSR_MTIMECMP] - this.ticks | 0;
            delta = delta + (delta<0?0xFFFFFFFF:0x0) | 0;
            this.ticks = this.ticks + clockspeed | 0;
            if (delta < clockspeed) {
                csr[CSR_MIP] = csr[CSR_MIP] | 0x20;
            }

            interrupts = csr[CSR_MIE] & csr[CSR_MIP];
            ie = csr[CSR_MSTATUS] & 0x01;

            if ((this.prv < 3) || ((this.prv == 3) && ie)) {
                if (interrupts & 0x8) {
                    this.Trap(CAUSE_SOFTWARE_INTERRUPT, this.pc);
                    continue;
                } else
                if (!this.htif.IsQueueEmpty()) {
                    this.Trap(CAUSE_HOST_INTERRUPT, this.pc);
                    continue;
                }
            }
            if ((this.prv < 1) || ((this.prv == 1) && ie)) {
                if (interrupts & 0x2) {
                    this.Trap(CAUSE_SOFTWARE_INTERRUPT, this.pc);
                    continue;
                } else
                if (interrupts & 0x20) {
                     this.Trap(CAUSE_TIMER_INTERRUPT, this.pc);
                     continue;
                }
            }
            */
        }

        paddr = this.TranslateVM(this.pc, VM_FETCH)|0;
        if(paddr == -1) {
            continue;
        }

        ins = this.ram.Read32(paddr);
        //DebugIns.Disassemble(ins, r, csr, this.pc);
        this.pc = this.pc + 4|0;

        switch(ins&0x7F) {

            case 0x03:
                // lb, lh, lw, lbu, lhu
                imm = (ins >> 20);
                rs1 = r[(ins >> 15) & 0x1F];
                rindex = (ins >> 7) & 0x1F;
                switch((ins >> 12)&0x7) {
                    
                    case 0x00:
                        // lb
                        paddr = this.TranslateVM(rs1 + imm|0, VM_READ)|0;
                        if(paddr == -1) break;
                        r[rindex] = (this.ram.Read8(paddr) << 24) >> 24;
                        break;

                    case 0x01:
                        // lh
                        if (rs1+imm & 1) {
                             message.Debug("Error in lh: unaligned address");
                             message.Abort();
                        }
                        paddr = this.TranslateVM(rs1 + imm|0, VM_READ)|0;
                        if(paddr == -1) break;
                        r[rindex] = (this.ram.Read16(paddr) << 16) >> 16;
                        break;

                    case 0x02:
                        // lw
                        if (rs1+imm & 3) {
                             message.Debug("Error in lw: unaligned address");
                             message.Abort();
                        }
                        paddr = this.TranslateVM(rs1 + imm|0, VM_READ)|0;
                        if(paddr == -1) break;
                        if ((paddr>>>0) == 0x8000a000) {
                            this.ram.Write32(paddr+0, this.htif.ReadToHost());
                            this.ram.Write32(paddr+4, this.htif.ReadDEVCMDToHost());
                        }
                        if ((paddr>>>0) == 0x8000a040) {
                            this.ram.Write32(paddr+0, this.htif.ReadFromHost());
                            this.ram.Write32(paddr+4, this.htif.ReadDEVCMDFromHost());
                        }
                        r[rindex] = this.ram.Read32(paddr);
                        break;

                    case 0x04:
                        // lbu
                        paddr = this.TranslateVM(rs1 + imm|0, VM_READ)|0;
                        if(paddr == -1) break;
                        r[rindex] = this.ram.Read8(paddr) & 0xFF;
                        break;

                    case 0x05:
                        // lhu
                        if (rs1+imm & 1) {
                             message.Debug("Error in lhu: unaligned address");
                             message.Abort();
                        }
                        paddr = this.TranslateVM(rs1 + imm|0, VM_READ)|0;
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
                        paddr = this.TranslateVM(rs1 + imm|0, VM_WRITE)|0;
                        if(paddr == -1) break;
                        this.ram.Write8(paddr, (r[rindex] & 0xFF));
                        break;

                    case 0x01:
                        // sh
                        if (rs1+imm & 1) {
                             message.Debug("Error in sh: unaligned address");
                             message.Abort();
                        }
                        paddr = this.TranslateVM(rs1 + imm|0, VM_WRITE)|0;
                        if(paddr == -1) break;
                        this.ram.Write16(paddr, (r[rindex] & 0xFFFF));
                        break;

                    case 0x02:
                        // sw
                        if (rs1+imm & 3) {
                             message.Debug("Error in sw: unaligned address");
                             message.Abort();
                        }
                        paddr = this.TranslateVM(rs1 + imm|0, VM_WRITE)|0;
                        if(paddr == -1) break;
                        this.ram.Write32(paddr, r[rindex]);
                        if ((paddr>>>0) == 0x8000a004) {
                            this.htif.WriteDEVCMDToHost(this.ram.Read32(paddr));
                            this.htif.WriteToHost(this.ram.Read32(paddr-4));
                        }
                        if ((paddr>>>0) == 0x8000a044) {
                            this.htif.WriteDEVCMDFromHost(this.ram.Read32(paddr));
                            this.htif.WriteFromHost(this.ram.Read32(paddr-4));
                        }
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

                            case 0x01:
                                // sll
                                r[rindex] = rs1 << (rs2 & 0x1F);
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

                            case 0x04:
                                // xor
                                r[rindex] = rs1 ^ rs2;
                                break;

                            case 0x05:
                                // srl
                                r[rindex] = rs1 >>> (rs2 & 0x1F);
                                break;

                            case 0x06:
                                // or
                                r[rindex] = rs1 | rs2;
                                break;

                            case 0x07:
                                // and
                                r[rindex] = rs1 & rs2;
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
                        this.SetCSR(imm, rs1);
                        break;

                    case 0x02:
                        // csrrs
                        r[rindex] = this.GetCSR(imm);
                        if (rs1 != 0) {
                            this.SetCSR(imm, this.GetCSR(imm) | rs1);
                        }
                        break;

                    case 0x03:
                        // csrrc
                        r[rindex] = this.GetCSR(imm);
                        if (rs1 != 0) {
                            this.SetCSR(imm, this.GetCSR(imm) & (~rs1));
                        }
                        break;

                    case 0x05:
                        // csrrwi
                        r[rindex] = this.GetCSR(imm);
                        zimm = (ins >> 15) & 0x1F;
                        this.SetCSR(imm, (zimm >> 0));
                        break;
                        

                    case 0x06:
                        // csrrsi
                        r[rindex] = this.GetCSR(imm);
                        zimm = (ins >> 15) & 0x1F;
                        if (zimm != 0) {
                            this.SetCSR(imm, this.GetCSR(imm) | (zimm >> 0));
                        }
                        break;

                    case 0x07:
                        // csrrci
                        r[rindex] = this.GetCSR(imm);
                        zimm = (ins >> 15) & 0x1F;
                        if (zimm != 0) {
                            this.SetCSR(imm, this.GetCSR(imm) & ~(zimm >> 0));
                        }
                        break;
                    
                    case 0x00:
                        // ecall, sret, ebreak, mret, wfi
                        switch((ins >> 20)&0xFFF) {
                            case 0x00:
                                // ecall
                                switch(this.prv)
                                {
                                    case PRV_U:
                                        this.Trap(CAUSE_USER_ECALL, this.pc - 4|0);
                                        break;

                                    case PRV_S:
                                        this.Trap(CAUSE_SUPERVISOR_ECALL, this.pc - 4|0);
                                        break;

                                    case PRV_H:
                                        this.Trap(CAUSE_HYPERVISOR_ECALL, this.pc - 4|0);
                                        this.Abort();
                                        break;

                                    case PRV_M:
                                        this.Trap(CAUSE_MACHINE_ECALL, this.pc - 4|0);
                                        break;
                                    
                                    default:
                                        message.Debug("Error in ecall: Don't know how to handle privilege level " + privilege_mode);
                                        message.Abort();
                                        break;
                                }
                                break;

                            case 0x001:
                                // ebreak
                                this.Trap(CAUSE_BREAKPOINT, this.pc - 4|0);
                                break;

/*
                            case 0x7b2:
                                // dret
                                message.Debug("Error in safecpu: Instruction " + "dret" + " not implemented");
                                message.Abort();
                              break;
*/

                            case 0x102:
                                // sret
                                if (this.prv != PRV_S) {
                                    message.Debug("Error in sret: privilege_mode isn't allowed access");
                                    message.Abort();
                                    break;
                                }
                                this.pc = csr[CSR_SEPC] | 0;
                                var prev_prv = (csr[CSR_MSTATUS] & MSTATUS_SPP) >> 8;
                                var s = csr[CSR_MSTATUS] | 0;
                                s &= ~((MSTATUS_UIE << prev_prv) | MSTATUS_SPP | MSTATUS_SPIE);
                                s |= PRV_U << 8; // set SPP
                                s |= ((csr[CSR_MSTATUS] & MSTATUS_SPIE)>>5) << (MSTATUS_UIE << prev_prv);
                                csr[CSR_MSTATUS] = s;
                                this.prv = prev_prv;
                                this.InvalidateTLB();
                                break;

                            case 0x105:
                                // wfi
                                /*
                                interrupts = csr[CSR_MIE] & csr[CSR_MIP];
                                if ((!interrupts) && (this.htif.IsQueueEmpty()))
                                    return steps;
                                */
                                break;


                            case 0x302:
                                // mret
                                if (this.prv != PRV_M) {
                                    message.Debug("Error in mret: privilege_mode isn't allowed access");
                                    message.Abort();
                                    break;
                                }
                                this.pc = csr[CSR_MEPC] | 0;
                                var prev_prv = (csr[CSR_MSTATUS] & MSTATUS_MPP) >> 11;
                                var s = csr[CSR_MSTATUS] | 0;
                                s &= ~((MSTATUS_UIE << prev_prv) | MSTATUS_MPP | MSTATUS_MPIE);
                                s |= PRV_U << 11; // set MPP
                                s |= ((csr[CSR_MSTATUS] & MSTATUS_MPIE)>>7) << (MSTATUS_UIE << prev_prv);
                                csr[CSR_MSTATUS] = s;
                                this.prv = prev_prv;
                                this.InvalidateTLB();
                                break;

                            case 0x104:
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
                        paddr = this.TranslateVM(rs1 + imm|0, VM_READ)|0;
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
                        paddr = this.TranslateVM(rs1 + imm|0, VM_READ)|0;
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
                        paddr = this.TranslateVM(rs1 + imm|0, VM_WRITE)|0;
                        if(paddr == -1) break;
                        this.ram.Write32(paddr, r[0]);
                        break;

                    case 0x03:
                        // fsd
                        if (rs1+imm & 7) {
                             message.Debug("Error in fsd: unaligned address");
                             message.Abort();
                        }
                        paddr = this.TranslateVM(rs1 + imm|0, VM_WRITE)|0;
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
                // fadd, fsub, fcmp
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
                paddr = this.TranslateVM(rs1|0, VM_READ)|0;
                if (paddr == -1) break;

                switch((ins >> 27)&0x1F) {
                    
                    case 0x01:
                        // amoswap
                        r[rindex] = this.ram.Read32(paddr);
                        paddr = this.TranslateVM(rs1|0, VM_WRITE)|0;
                        if(paddr == -1) break;
                        this.ram.Write32(paddr, rs2);
                        break;

                    case 0x00:
                        // amoadd
                        r[rindex] = this.ram.Read32(paddr);
                        paddr = this.TranslateVM(rs1|0, VM_WRITE)|0;
                        if(paddr == -1) break;
                        this.ram.Write32(paddr,r[rindex] + rs2);
                        break;

                    case 0x04:
                        // amoxor
                        r[rindex] = this.ram.Read32(paddr);
                        paddr = this.TranslateVM(rs1|0, VM_WRITE)|0;
                        if(paddr == -1) break;
                        this.ram.Write32(paddr,r[rindex] ^ rs2);
                        break;

                    case 0x0C:
                        // amoand
                        r[rindex] = this.ram.Read32(paddr);
                        paddr = this.TranslateVM(rs1|0, VM_WRITE)|0;
                        if(paddr == -1) break;
                        this.ram.Write32(paddr, r[rindex] & rs2);
                        break;

                    case 0x08:
                        // amoor
                        r[rindex] = this.ram.Read32(paddr);
                        paddr = this.TranslateVM(rs1|0, VM_WRITE)|0;
                        if(paddr == -1) break;
                        this.ram.Write32(paddr, r[rindex] | rs2);
                        break;

                    case 0x10:
                        // amomin
                        r[rindex] = this.ram.Read32(paddr);
                        if((rs2 >> 0) > (r[rindex] >> 0)) r[0] = r[rindex];
                        else r[0] = rs2;
                        paddr = this.TranslateVM(rs1|0, VM_WRITE)|0;
                        if(paddr == -1) break;
                        this.ram.Write32(paddr, r[0]);
                        break;

                   case 0x14:
                        // amomax
                        r[rindex] = this.ram.Read32(paddr);
                        if(rs2 < r[rindex]) r[0] = r[rindex];
                        else r[0] = rs2;
                        paddr = this.TranslateVM(rs1, VM_WRITE)|0;
                        if(paddr == -1) break;
                        this.ram.Write32(paddr, r[0]);
                        break;

                    case 0x18:
                        // amominu
                        r[rindex] = this.ram.Read32(paddr);
                        if((rs2 >>> 0) > (r[rindex] >>> 0)) r[0] = r[rindex];
                        else r[0] = rs2;
                        paddr = this.TranslateVM(rs1, VM_WRITE)|0;
                        if(paddr == -1) break;
                        this.ram.Write32(paddr, r[0]);
                        break;

                    case 0x1C:
                        // amomaxu
                        r[rindex] = this.ram.Read32(paddr);
                        if((rs2 >>> 0) < (r[rindex] >>> 0)) r[0] = r[rindex];
                        else r[0] = rs2;
                        paddr = this.TranslateVM(rs1, VM_WRITE)|0;
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
                        paddr = this.TranslateVM(rs1, VM_WRITE)|0;
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
