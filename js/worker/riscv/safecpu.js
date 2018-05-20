// -------------------------------------------------
// -------------------- CPU ------------------------
// -------------------------------------------------

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
var CAUSE_FETCH_ACCESS        = 0x1;
var CAUSE_ILLEGAL_INSTRUCTION = 0x2;
var CAUSE_BREAKPOINT          = 0x3;
var CAUSE_MISALIGNED_LOAD     = 0x4;
var CAUSE_LOAD_ACCESS         = 0x5;
var CAUSE_MISALIGNED_STORE    = 0x6;
var CAUSE_STORE_ACCESS        = 0x7;
var CAUSE_USER_ECALL          = 0x8;
var CAUSE_SUPERVISOR_ECALL    = 0x9;
var CAUSE_HYPERVISOR_ECALL    = 0xa;
var CAUSE_MACHINE_ECALL       = 0xb;
var CAUSE_FETCH_PAGE_FAULT    = 0xc;
var CAUSE_LOAD_PAGE_FAULT     = 0xd;
var CAUSE_STORE_PAGE_FAULT    = 0xf;

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
var MSTATUS_SUM     = 0x00040000; // supervisor may access user memory
var MSTATUS_MXR     = 0x00080000; // make executable readable
var MSTATUS_TVM     = 0x00100000;
var MSTATUS_TW      = 0x00200000;
var MSTATUS_TSR     = 0x00400000;
var MSTATUS_SD      = 0x80000000;

var SPTBR_MODE_OFF  = 0;
var SPTBR_MODE_SV32 = 1;
var SPTBR32_MODE = 0x80000000;
var SPTBR32_ASID = 0x7FC00000;
var SPTBR32_PPN  = 0x003FFFFF;

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
var CSR_SSTATUS    = 0x100; // Supervisor status register
var CSR_SIE        = 0x104; // Supervisor interrupt-enable register
var CSR_STVEC      = 0x105; // Supervisor trap handler base address.
var CSR_SCOUNTEREN = 0x106; // machine counter enable register (supervisor)
var CSR_SSCRATCH   = 0x140; // Scratch register for supervisor trap handlers.
var CSR_SEPC       = 0x141; // Supervisor exception program counter
var CSR_SCAUSE     = 0x142; // Supervisor trap cause
var CSR_SBADADDR   = 0x143; // Supervisor bad address
var CSR_SIP        = 0x144; // Supervisor interrupt pending
var CSR_SPTBR      = 0x180; // Page-table base register

// Hypervisor CSR standard read/write
var CSR_HEPC      = 0x241; // Hypervisor exception program counte

// Machine CSRs standard read/write
var CSR_MSTATUS   = 0x300; // Machine status register
var CSR_MISA      = 0x301; // ISA and extensions supported
var CSR_MEDELEG   = 0x302; // Machine exception delegation register.
var CSR_MIDELEG   = 0x303; // Machine interrupt delegation register.
var CSR_MIE       = 0x304; // Machine interrupt-enable register
var CSR_MTVEC     = 0x305; // Machine trap-handler base address.

var CSR_MCOUNTEREN = 0x306; // machine counter enable register (user)

var CSR_MSCRATCH  = 0x340; // Scratch register for machine trap handlers
var CSR_MEPC      = 0x341; // Machine exception program counter
var CSR_MCAUSE    = 0x342; // Machine trap cause
var CSR_MBADADDR  = 0x343; // Machine bad address
var CSR_MIP       = 0x344; // Machine interrupt pending

var CSR_PMPCFG0   = 0x3a0;
var CSR_PMPADDR0  = 0x3b0;

// Machine CSRs standard read/write and unknown
var CSR_MRESET    = 0x782;
var CSR_SEND_IPI  = 0x783;

// debug tdata1
var CSR_TDATA1  = 0x7A1;

// user CSRs standard read only
var CSR_CYCLE     = 0xC00; // Cycle counter for RDCYCLE instruction
var CSR_TIME      = 0xC01; // Timer for RDTIME instruction
var CSR_INSTRET   = 0xC02; // Instructions-retired counter for RDINSTRET instruction
var CSR_CYCLEH    = 0xC80; // Upper 32 bits of cycle, RV32I only
var CSR_TIMEH     = 0xC81; // Upper 32 bits of time, RV32I only
var CSR_INSTRETH  = 0xC82; // Upper 32 bits of instret, RV32I only

// This is a special CSR just for this emulator to connect the CLINT to the CPU
// because the timer is handled in the CPU part
var CSR_TIMECMP   = 0xC41;

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
    var reg  = reg|0;
    var mask = mask|0;
    return ((reg & mask) / (mask & ~(mask << 1)))|0;
}

function set_field(reg, mask, val) {
    var reg  = reg | 0;
    var mask = mask | 0;
    var val  = val | 0;
    return (reg & ~mask) | ((val * (mask & ~(mask << 1))) & mask);
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

    this.pc = 0x1000; // implementation defined start address, boot into ROM
}

SafeCPU.prototype.InvalidateTLB = function() {
    // No TLB
}

SafeCPU.prototype.GetTimeToNextInterrupt = function () {
    var delta = ((this.csr[CSR_TIMECMP]|0) - (this.ticks|0))|0;
    return delta|0;
}

SafeCPU.prototype.GetTicks = function () {
    return this.ticks | 0;
}

SafeCPU.prototype.ProgressTime = function (delta) {
    delta = delta | 0;
    this.ticks = this.ticks + delta | 0;
    this.csr[CSR_TIME] = this.ticks | 0;

    delta = this.csr[CSR_TIMECMP] - this.ticks | 0;
    if (delta <= 1) {
        this.csr[CSR_MIP] = this.csr[CSR_MIP] | MIP_STIP;
    }
    this.CheckForInterrupt();
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
    if (line == IRQ_S_EXT) {
        this.csr[CSR_MIP] |= MIP_SEIP; // EXT
    }
};

SafeCPU.prototype.ClearInterrupt = function (line, cpuid) {
    //message.Debug("clear int " + line);
    if (line == IRQ_S_EXT) {
        this.csr[CSR_MIP] &= ~MIP_SEIP; // EXT
    }
};

SafeCPU.prototype.CheckForInterrupt = function () {
    var pending_interrupts = this.csr[CSR_MIP] & this.csr[CSR_MIE];
/*
    var mie = (this.csr[CSR_MSTATUS] & MSTATUS_MIE) != 0;
    var m_enabled = this.prv < PRV_M || (this.prv == PRV_M && mie);
    var enabled_interrupts = pending_interrupts & ~this.csr[CSR_MIDELEG] & -m_enabled;

    var sie = (this.csr[CSR_MSTATUS] >> 1) & 1;
    var s_enabled = (this.prv < PRV_S) || ((this.prv == PRV_S) && sie);
    enabled_interrupts |= pending_interrupts & this.csr[CSR_MIDELEG] & -s_enabled;
*/

    var mie = get_field(this.csr[CSR_MSTATUS], MSTATUS_MIE);
    var m_enabled = ((this.prv < PRV_M) || ((this.prv == PRV_M) && mie))?1:0;
    var enabled_interrupts = pending_interrupts & ~this.csr[CSR_MIDELEG] & -m_enabled;

    if (enabled_interrupts == 0) {
        var sie = get_field(this.csr[CSR_MSTATUS], MSTATUS_SIE);
        var s_enabled = ((this.prv < PRV_S) || ((this.prv == PRV_S) && sie))?1:0;
        enabled_interrupts |= pending_interrupts & this.csr[CSR_MIDELEG] & -s_enabled;
    }

    if (enabled_interrupts) {
        //message.Debug("Take interrupt: " + ctz(enabled_interrupts));
        this.Trap(0x80000000 | ctz(enabled_interrupts), this.pc, -1);
    }
};


SafeCPU.prototype.Trap = function (cause, epc, addr) {
    cause = cause|0;
    epc = epc|0;
    addr = addr|0;

    //message.Debug("Trap cause=" + utils.ToHex(cause) + " at epc=" + utils.ToHex(epc));
    //message.Abort();

    // by default, trap to M-mode, unless delegated to S-mode
    var bit = cause;
    var deleg = this.csr[CSR_MEDELEG];
    var interrupt = (bit & (1<<31)) != 0;
    if (interrupt) {
        deleg = this.csr[CSR_MIDELEG];
        bit &= ~(1<<31);
    }
    if (this.prv <= PRV_S && bit < 32 && ((deleg >> bit) & 1)) {
        // handle the trap in S-mode
        this.pc = this.csr[CSR_STVEC];
        this.csr[CSR_SCAUSE] = cause;
        this.csr[CSR_SEPC] = epc;
        this.csr[CSR_SBADADDR] = addr;

        var s = this.csr[CSR_MSTATUS] | 0;
        s = set_field(s, MSTATUS_SPIE, get_field(s, MSTATUS_SIE))|0;
        s = set_field(s, MSTATUS_SPP, this.prv)|0;
        s = set_field(s, MSTATUS_SIE, 0)|0;
        this.csr[CSR_MSTATUS] = s;

        this.prv = PRV_S;
    } else {
        var vector = ((this.csr[CSR_MTVEC] & 1) && interrupt) ? bit*4 : 0;
        this.pc = (this.csr[CSR_MTVEC]&(~1)) + vector;
        this.csr[CSR_MEPC] = epc;
        this.csr[CSR_MCAUSE] = cause;
        this.csr[CSR_MBADADDR] = addr;

        var s = this.csr[CSR_MSTATUS] | 0;
        s = set_field(s, MSTATUS_MPIE, get_field(s, MSTATUS_MIE))|0;
        s = set_field(s, MSTATUS_MPP, this.prv)|0;
        s = set_field(s, MSTATUS_MIE, 0)|0;
        this.csr[CSR_MSTATUS] = s;

        this.prv = PRV_M;
    }

    this.amoaddr = 0x00;
    this.amovalue = 0x00;
};

SafeCPU.prototype.MemAccessTrap = function(addr, op) {
    switch(op) {
        case VM_READ:
            this.Trap(CAUSE_LOAD_PAGE_FAULT, this.pc - 4|0, addr);
            break;

        case VM_WRITE:
            this.Trap(CAUSE_STORE_PAGE_FAULT, this.pc - 4|0, addr);
            break;

        case VM_FETCH:
            this.Trap(CAUSE_FETCH_PAGE_FAULT, this.pc, addr);
            break;
    }
}


SafeCPU.prototype.CheckVMPrivilege = function (pte, op) {
    pte = pte | 0;
    op = op | 0;
    //var type = (pte >> 1) & 0xF;
    var supervisor = this.prv == PRV_S;
    var sum = this.csr[CSR_MSTATUS] & MSTATUS_SUM; // protect user memory
    var mxr = this.csr[CSR_MSTATUS] & MSTATUS_MXR; // make executable readable

    if (pte & PTE_U) {
        if (supervisor && !sum) {
            message.Debug("Illegal access from privilege mode at pc=" + utils.ToHex(this.pc) + " " + op);
            message.Abort();
            return false;
        }
    } else {
        if (!supervisor) return false;
    }

    // not valid or reserved for future use
    if (!(pte & PTE_V) || (!(pte & PTE_R) && (pte & PTE_W))) {
        //message.Debug("Unknown access from privilege mode at pc=" + utils.ToHex(this.pc) + " " + op);
        //message.Abort();
        return false;
    } 

    switch(op|0) {
        case VM_FETCH:
            return pte & PTE_X;

        case VM_READ:
            return (pte & PTE_R) || (mxr && (pte & PTE_X));

        case VM_WRITE:
            return (pte & PTE_R) && (pte & PTE_W);
    }
    message.Debug("Error in CheckVMPRivilege: unknown operation");
    message.Abort();
}


/* 
 * Translates a virtual address to a physical by walking through
 * the page table and checking  the rights
 */
SafeCPU.prototype.TranslateVM = function (addr, op) {
    op = op | 0;
    addr = addr | 0;
    var vm = (this.csr[CSR_SPTBR] >> 31) & 1;
    var PGSIZE = 4096;
    var PGMASK = ~(PGSIZE-1);
    var PGSHIFT = 12;
    var ptidxbits = 10;
    var ptesize = 4;

    // vm bare mode
    if (vm == SPTBR_MODE_OFF || this.prv == PRV_M) return addr;

    // LEVEL 1
    // get first entry in page table
    var base = (this.csr[CSR_SPTBR] & SPTBR32_PPN) << PGSHIFT;
    var pteaddr = base + ((addr >>> 22) << 2);
    var pte = this.ram.Read32(pteaddr) | 0;

    //message.Debug("VM Start " + utils.ToHex(addr) + " " + utils.ToHex(base) + " " + utils.ToHex(pte));
    /* check if pagetable is finished here */
    if ((pte & 0xF) != 0x1) {
        if (!this.CheckVMPrivilege(pte, op)) {
            this.MemAccessTrap(addr, op);
            return -1;
        }
        //this.ram.Write32(pteaddr, pte | PTE_A | ((op==VM_WRITE)?PTE_D:0));
        //message.Debug("VM L1 " + utils.ToHex(addr) + " " + utils.ToHex(base) + " " + utils.ToHex(((pte >> 10) << 12) | (addr&0x3FFFFF)));
        //message.Abort();
        return ((pte >> 10) << 12) | (addr&0x3FFFFF);
    }

    // LEVEL 2
    base = (pte & 0xFFFFFC00) << 2;
    var new_page_num = (addr >> 12) & 0x3FF;
    var pteaddr = base + (new_page_num << 2);

    pte = this.ram.Read32(pteaddr) | 0;
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
    //this.ram.Write32(pteaddr, pte | PTE_A | ((op==VM_WRITE)?PTE_D:0));
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
            if ((value ^ csr[CSR_MSTATUS]) & (MSTATUS_MPP | MSTATUS_MPRV | MSTATUS_SUM | MSTATUS_MXR)) {
                this.InvalidateTLB();
            }
            var mask = MSTATUS_SIE | MSTATUS_SPIE | MSTATUS_MIE | MSTATUS_MPIE
                     | MSTATUS_SPP | MSTATUS_FS | MSTATUS_MPRV | MSTATUS_SUM
                     | MSTATUS_MPP | MSTATUS_MXR | MSTATUS_TW | MSTATUS_TVM
                     | MSTATUS_TSR | MSTATUS_XS;
            csr[addr] = (value & ~mask) | (value & mask);
            var dirty = (csr[CSR_MSTATUS] & MSTATUS_FS) == MSTATUS_FS;
            dirty |= (csr[CSR_MSTATUS] & MSTATUS_XS) == MSTATUS_XS;
            csr[CSR_MSTATUS] = (csr[CSR_MSTATUS] & ~MSTATUS_SD) | (dirty?1<<MSTATUS_SD:0);
            break;

        case CSR_SSTATUS:
            csr[addr] = value;
            var mask = MSTATUS_SIE | MSTATUS_SPIE | MSTATUS_SPP | MSTATUS_FS | MSTATUS_XS | MSTATUS_SUM | MSTATUS_MXR;
            this.SetCSR(CSR_MSTATUS, (csr[CSR_MSTATUS] & ~mask) | (value & mask));
            break;

        case CSR_MIE:
            var mask = MIP_SSIP | MIP_STIP | MIP_SEIP | (1 << IRQ_COP) | MIP_MSIP | MIP_MTIP;
            csr[CSR_MIE] = (csr[CSR_MIE] & ~mask) | (value & mask);
            //message.Debug("Write MIE: " + utils.ToHex(csr[CSR_MIE]) + " at pc=" + utils.ToHex(this.pc));
            break;

        case CSR_SIE:
            csr[CSR_MIE] = (csr[CSR_MIE] & ~csr[CSR_MIDELEG]) | (value & csr[CSR_MIDELEG]);
            //message.Debug("Write SIE: " + utils.ToHex(csr[CSR_MIE]) + " at pc=" + utils.ToHex(this.pc));
            break;

        case CSR_MISA:
            // TODO: only a few bits can be changed
            csr[CSR_MISA] = value;
            break;

        case CSR_MIP:
            var mask = MIP_SSIP | MIP_STIP;
            csr[CSR_MIP] = (csr[CSR_MIP] & ~mask) | (value & mask);
            //message.Debug("Write MIP: " + utils.ToHex(csr[CSR_MIP]));
            break;

        case CSR_SEPC:
        case CSR_MEPC:
            csr[addr] = value;
            break;

        case CSR_SBADADDR:
            csr[addr] = value;
            break;

        case CSR_SCAUSE:
            csr[addr] = value;
            break;

        case CSR_FCSR:
        case CSR_MEDELEG:
        case CSR_MIDELEG:
        case CSR_MSCRATCH:
        case CSR_SSCRATCH:
            csr[addr] = value;
            break;

        case CSR_SPTBR:
            this.InvalidateTLB();
            csr[addr] = value & (SPTBR32_PPN | SPTBR32_MODE);
            break;

        case CSR_STVEC:
        case CSR_MTVEC:
            csr[addr] = value&(~3);
            break;


        case CSR_MCOUNTEREN:
        case CSR_SCOUNTEREN:
            csr[addr] = value;
            break;

        case CSR_TDATA1:
            csr[addr] = value;
            break;

/*
        case CSR_FRM:
            csr[addr] = value;
            break;

        case CSR_FFLAGS:
            csr[addr] = value;
            break;

*/

        case CSR_PMPCFG0:
        case CSR_PMPADDR0:
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

    //message.Debug("GetCSR: Address:" + utils.ToHex(addr));
    var csr = this.csr;
    switch(addr)
    {
        case CSR_FCSR:
            return 0x0;
            break;

        case CSR_MHARTID:
            return csr[addr];
            break;

        case CSR_MISA:
            return csr[addr];
            break;

        case CSR_SIE:
            return csr[CSR_MIE] & csr[CSR_MIDELEG];
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
                       | MSTATUS_XS | MSTATUS_SUM;
            var sstatus = csr[CSR_MSTATUS] & mask;
            if ((sstatus & MSTATUS_FS) == MSTATUS_FS ||
                (sstatus & MSTATUS_XS) == MSTATUS_XS)
                sstatus |= MSTATUS_SD;
            return sstatus;
            break;

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

        case CSR_MCOUNTEREN:
        case CSR_SCOUNTEREN:
            return csr[addr];
            break;

        case CSR_TIME:
            return this.ticks;
            break;

        case CSR_TIMEH:
            return 0x0;
            break;

        case CSR_PMPCFG0:
        case CSR_PMPADDR0:
            return 0x0;
            break;

        case CSR_TDATA1:
            return csr[addr];
            break;

/*
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
this.n = 0;

    do {
        r[0] = 0x00;

        if (!(steps & 63)) {
            // ---------- TICK ----------
            var delta = csr[CSR_TIMECMP] - this.ticks | 0;
            this.ticks = this.ticks + clockspeed | 0;
            csr[CSR_TIME] = this.ticks | 0;
            if (delta < clockspeed) {
                csr[CSR_MIP] = csr[CSR_MIP] | MIP_STIP;
            }
            this.CheckForInterrupt();
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
                             this.Trap(CAUSE_MISALIGNED_LOAD, this.pc - 4|0, rs1+imm|0);
                             //message.Debug("Error in lh: unaligned address");
                             //message.Abort();
                             break;
                        }
                        paddr = this.TranslateVM(rs1 + imm|0, VM_READ)|0;
                        if(paddr == -1) break;
                        r[rindex] = (this.ram.Read16(paddr) << 16) >> 16;
                        break;

                    case 0x02:
                        // lw
                        if (rs1+imm & 3) {
                             this.Trap(CAUSE_MISALIGNED_LOAD, this.pc - 4|0, rs1+imm|0);
                             //message.Debug("Error in lw: unaligned address");
                             //message.Abort();
                             break;
                        }
                        paddr = this.TranslateVM(rs1 + imm|0, VM_READ)|0;
                        if(paddr == -1) break;
                        if ((paddr>>>0) == 0x8000a008) {
                            this.ram.Write32(paddr+0, this.htif.ReadToHost());
                            this.ram.Write32(paddr+4, this.htif.ReadDEVCMDToHost());
                        }
                        if ((paddr>>>0) == 0x8000a000) {
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
                             this.Trap(CAUSE_MISALIGNED_STORE, this.pc - 4|0, rs1+imm|0);
                             //message.Debug("Error in sh: unaligned address");
                             //message.Abort();
                             break;
                        }
                        paddr = this.TranslateVM(rs1 + imm|0, VM_WRITE)|0;
                        if(paddr == -1) break;
                        this.ram.Write16(paddr, (r[rindex] & 0xFFFF));
                        break;

                    case 0x02:
                        // sw
                        if (rs1+imm & 3) {
                             this.Trap(CAUSE_MISALIGNED_STORE, this.pc - 4|0, rs1+imm|0);
                             //message.Debug("Error in sw: unaligned address");
                             //message.Abort();
                             break;
                        }
                        paddr = this.TranslateVM(rs1 + imm|0, VM_WRITE)|0;
                        if(paddr == -1) break;
                        this.ram.Write32(paddr, r[rindex]);
                        if ((paddr>>>0) == 0x8000a00c) {
                            //message.Debug("Write tohost at " + utils.ToHex(this.pc));
                            this.htif.WriteDEVCMDToHost(this.ram.Read32(paddr));
                            this.htif.WriteToHost(this.ram.Read32(paddr-4));
                        }
                        if ((paddr>>>0) == 0x8000a004) {
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
                        rs1 = r[(ins >> 15) & 0x1F]|0;
                        rs2 = r[(ins >> 20) & 0x1F]|0;
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
                                    quo = (rs1 / rs2)|0;
                                r[rindex] = quo;
                                break;

                            case 0x05:
                                // divu
                                if(rs2 == 0)
                                    quo = -1;
                                else
                                    quo = ((rs1 >>> 0) / (rs2 >>> 0))|0;
                                r[rindex] = quo;
                                break;

                            case 0x06:
                                // rem
                                if(rs2 == 0)
                                    rem = rs1|0;
                                else
                                    rem = (rs1 % rs2)|0;
                                r[rindex] = rem;
                                break;

                            case 0x07:
                                // remu
                                if(rs2 == 0)
                                    rem = rs1|0;
                                else
                                    rem = ((rs1 >>> 0) % (rs2 >>> 0))|0;
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
                //if ((this.pc>>>0) >= 0xC0000000)
	        //        message.Debug("jump from " + utils.ToHex(this.pc));
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
                rs1 = r[(ins >> 15) & 0x1F]|0;
                rs2 = r[(ins >> 20) & 0x1F]|0;

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
                                        this.Trap(CAUSE_USER_ECALL, this.pc - 4|0, -1);
                                        break;

                                    case PRV_S:
                                        this.Trap(CAUSE_SUPERVISOR_ECALL, this.pc - 4|0, -1);
                                        break;

                                    case PRV_H:
                                        this.Trap(CAUSE_HYPERVISOR_ECALL, this.pc - 4|0, -1);
                                        this.Abort();
                                        break;

                                    case PRV_M:
                                        this.Trap(CAUSE_MACHINE_ECALL, this.pc - 4|0, -1);
                                        break;
                                    
                                    default:
                                        message.Debug("Error in ecall: Don't know how to handle privilege level " + privilege_mode);
                                        message.Abort();
                                        break;
                                }
                                break;

                            case 0x001:
                                // ebreak
                                this.Trap(CAUSE_BREAKPOINT, this.pc - 4|0, -1);
                                break;

                            case 0x102:
                                // sret
                                if (this.prv != PRV_S) {
                                    message.Debug("Error in sret: privilege_mode isn't allowed access");
                                    message.Abort();
                                    break;
                                }
                                this.pc = csr[CSR_SEPC] | 0;
                                var s = csr[CSR_MSTATUS] | 0;
                                var prev_prv = get_field(s, MSTATUS_SPP);
                                s = set_field(s, MSTATUS_SIE, get_field(s, MSTATUS_SPIE));
                                s = set_field(s, MSTATUS_SPIE, 1);
                                s = set_field(s, MSTATUS_SPP, PRV_U);
                                csr[CSR_MSTATUS] = s;
                                this.prv = prev_prv;
                                this.InvalidateTLB();
                                break;

                            case 0x105:
                                // wfi
                                //message.Debug("wfi");
                                if ((csr[CSR_MIE] & csr[CSR_MIP]) == 0)
                                    return steps;
                                break;


                            case 0x302:
                                // mret
                                if (this.prv != PRV_M) {
                                    message.Debug("Error in mret: privilege_mode isn't allowed access");
                                    message.Abort();
                                    break;
                                }
                                this.pc = csr[CSR_MEPC] | 0;
                                var s = csr[CSR_MSTATUS] | 0;
                                var prev_prv = get_field(s, MSTATUS_MPP);
                                s = set_field(s, MSTATUS_MIE, get_field(s, MSTATUS_MPIE));
                                s = set_field(s, MSTATUS_MPIE, 1);
                                s = set_field(s, MSTATUS_MPP, PRV_U);
                                csr[CSR_MSTATUS] = s;
                                this.prv = prev_prv;
                                this.InvalidateTLB();
                                break;

                            case 0x120:
                                // sfence.vma
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

                    case 0x0C:
                    case 0x0D:
                        //fdiv.s, fdiv.d
                        fs1 = f[(ins >> 15) & 0x1F];
                        fs2 = f[(ins >> 20) & 0x1F];
                        f[rindex] = fs1 / fs2;
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
                if ((ins&3) != 3) {
                    message.Debug("Error in safecpu: Compressed Instruction " + utils.ToHex(ins&0xFFFF) + " not supported at "+utils.ToHex(this.pc-4));
                } else {
                    message.Debug("Error in safecpu: Instruction " + utils.ToHex(ins) + " not found at "+utils.ToHex(this.pc-4));
                }
                message.Abort();
                break;
        }

    } while(steps=steps-1|0);

    return 0;
};

module.exports = SafeCPU;
