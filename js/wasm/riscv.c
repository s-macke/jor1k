typedef signed long long int int64;
typedef signed int int32;
typedef signed short int int16;
typedef signed char int8;
typedef unsigned long long int uint64;
typedef unsigned int uint32;
typedef unsigned short int uint16;
typedef unsigned char uint8;

#define fabs(x) ((x)<0 ? -(x) : (x))

// exports
extern void abort();
extern void DebugMessage(int32 messageid);
extern int32 Read32(int32 p);
extern int16 Read16(int32 p);
extern int8 Read8(int32 p);
extern void Write32(int32 p, int32 x);
extern void Write16(int32 p, uint16 x);
extern void Write8(int32 p, uint8 x);

// imports
void  AnalyzeImage();
void  Reset();
void  Init();
void  InvalidateTLB();
int32 GetTimeToNextInterrupt();
int32 GetTicks();
void  ProgressTime(int32 delta);
void  RaiseInterrupt(int32 line, int32 cpuid);
void  ClearInterrupt(int32 line, int32 cpuid);
int32 Step(int32 steps, int32 clockspeed);

// constants
const int32 PRV_U = 0x00;  // user mode
const int32 PRV_S = 0x01;  // supervisor mode
const int32 PRV_H = 0x02;  // hypervisor mode
const int32 PRV_M = 0x03;  // machine mode

const int32 VM_READ  = 0;
const int32 VM_WRITE = 1;
const int32 VM_FETCH = 2;

const int32 CAUSE_MISALIGNED_FETCH    = 0x0;
const int32 CAUSE_FETCH_ACCESS        = 0x1;
const int32 CAUSE_ILLEGAL_INSTRUCTION = 0x2;
const int32 CAUSE_BREAKPOINT          = 0x3;
const int32 CAUSE_MISALIGNED_LOAD     = 0x4;
const int32 CAUSE_LOAD_ACCESS         = 0x5;
const int32 CAUSE_MISALIGNED_STORE    = 0x6;
const int32 CAUSE_STORE_ACCESS        = 0x7;
const int32 CAUSE_USER_ECALL          = 0x8;
const int32 CAUSE_SUPERVISOR_ECALL    = 0x9;
const int32 CAUSE_HYPERVISOR_ECALL    = 0xa;
const int32 CAUSE_MACHINE_ECALL       = 0xb;
const int32 CAUSE_FETCH_PAGE_FAULT    = 0xc;
const int32 CAUSE_LOAD_PAGE_FAULT     = 0xd;
const int32 CAUSE_STORE_PAGE_FAULT    = 0xf;

const int32 MSTATUS_UIE     = 0x00000001; // interrupt enable bits
const int32 MSTATUS_SIE     = 0x00000002;
const int32 MSTATUS_HIE     = 0x00000004;
const int32 MSTATUS_MIE     = 0x00000008; // machine
const int32 MSTATUS_UPIE    = 0x00000010; // interrupt-enable bit active prior to the trap
const int32 MSTATUS_SPIE    = 0x00000020;
const int32 MSTATUS_HPIE    = 0x00000040;
const int32 MSTATUS_MPIE    = 0x00000080;
const int32 MSTATUS_SPP     = 0x00000100; // previous privilege  mode
const int32 MSTATUS_HPP     = 0x00000600;
const int32 MSTATUS_MPP     = 0x00001800; // privilege mode
const int32 MSTATUS_FS      = 0x00006000; // tracking current state of floating point unit
const int32 MSTATUS_XS      = 0x00018000; // status of user-mode extensions
const int32 MSTATUS_MPRV    = 0x00020000; // priviege level at which loads and stores execute
const int32 MSTATUS_SUM     = 0x00040000; // supervisor may access user memory
const int32 MSTATUS_MXR     = 0x00080000; // make executable readable
const int32 MSTATUS_TVM     = 0x00100000;
const int32 MSTATUS_TW      = 0x00200000;
const int32 MSTATUS_TSR     = 0x00400000;
const int32 MSTATUS_SD      = 0x80000000;

const int32 SPTBR_MODE_OFF  = 0;
const int32 SPTBR_MODE_SV32 = 1;
const int32 SPTBR32_MODE = 0x80000000;
const int32 SPTBR32_ASID = 0x7FC00000;
const int32 SPTBR32_PPN  = 0x003FFFFF;

// page table entry (PTE) fields
const int32 PTE_V     = 0x001; // Valid
const int32 PTE_R     = 0x002; // Read
const int32 PTE_W     = 0x004; // Write
const int32 PTE_X     = 0x008; // Execute
const int32 PTE_U     = 0x010; // User
const int32 PTE_G     = 0x020; // Global
const int32 PTE_A     = 0x040; // Accessed
const int32 PTE_D     = 0x080; // Dirty
const int32 PTE_SOFT  = 0x300; // Reserved for Software

const int32 IRQ_S_SOFT  = 1;
const int32 IRQ_H_SOFT  = 2;
const int32 IRQ_M_SOFT  = 3;
const int32 IRQ_S_TIMER = 5;
const int32 IRQ_H_TIMER = 6;
const int32 IRQ_M_TIMER = 7;
const int32 IRQ_S_EXT   = 9;
const int32 IRQ_H_EXT   = 10;
const int32 IRQ_M_EXT   = 11;
const int32 IRQ_COP     = 12; // computer operating properly
const int32 IRQ_HOST    = 13;

const int32 MIP_SSIP = (1 << IRQ_S_SOFT);
const int32 MIP_HSIP = (1 << IRQ_H_SOFT);
const int32 MIP_MSIP = (1 << IRQ_M_SOFT);
const int32 MIP_STIP = (1 << IRQ_S_TIMER);
const int32 MIP_HTIP = (1 << IRQ_H_TIMER);
const int32 MIP_MTIP = (1 << IRQ_M_TIMER);
const int32 MIP_SEIP = (1 << IRQ_S_EXT);
const int32 MIP_HEIP = (1 << IRQ_H_EXT);
const int32 MIP_MEIP = (1 << IRQ_M_EXT);

// User CSRs standard read/write
const int32 CSR_FFLAGS    = 0x001; // Floating-Point Accrued Exceptions
const int32 CSR_FRM       = 0x002; // Floating-Point Dynamic Rounding Mode
const int32 CSR_FCSR      = 0x003; // Floating-Point Control and Status Register

// Supervisor CSRs standard read/write
const int32 CSR_SSTATUS    = 0x100; // Supervisor status register
const int32 CSR_SIE        = 0x104; // Supervisor interrupt-enable register
const int32 CSR_STVEC      = 0x105; // Supervisor trap handler base address.
const int32 CSR_SCOUNTEREN = 0x106; // machine counter enable register (supervisor)
const int32 CSR_SSCRATCH   = 0x140; // Scratch register for supervisor trap handlers.
const int32 CSR_SEPC       = 0x141; // Supervisor exception program counter
const int32 CSR_SCAUSE     = 0x142; // Supervisor trap cause
const int32 CSR_SBADADDR   = 0x143; // Supervisor bad address
const int32 CSR_SIP        = 0x144; // Supervisor interrupt pending
const int32 CSR_SPTBR      = 0x180; // Page-table base register

// Hypervisor CSR standard read/write
const int32 CSR_HEPC      = 0x241; // Hypervisor exception program counte

// Machine CSRs standard read/write
const int32 CSR_MSTATUS   = 0x300; // Machine status register
const int32 CSR_MISA      = 0x301; // ISA and extensions supported
const int32 CSR_MEDELEG   = 0x302; // Machine exception delegation register.
const int32 CSR_MIDELEG   = 0x303; // Machine interrupt delegation register.
const int32 CSR_MIE       = 0x304; // Machine interrupt-enable register
const int32 CSR_MTVEC     = 0x305; // Machine trap-handler base address.

const int32 CSR_MCOUNTEREN = 0x306; // machine counter enable register (user)

const int32 CSR_MSCRATCH  = 0x340; // Scratch register for machine trap handlers
const int32 CSR_MEPC      = 0x341; // Machine exception program counter
const int32 CSR_MCAUSE    = 0x342; // Machine trap cause
const int32 CSR_MBADADDR  = 0x343; // Machine bad address
const int32 CSR_MIP       = 0x344; // Machine interrupt pending

const int32 CSR_PMPCFG0   = 0x3a0;
const int32 CSR_PMPADDR0  = 0x3b0;

// Machine CSRs standard read/write and unknown
const int32 CSR_MRESET    = 0x782;
const int32 CSR_SEND_IPI  = 0x783;

// debug tdata1
const int32 CSR_TDATA1  = 0x7A1;

// user CSRs standard read only
const int32 CSR_CYCLE     = 0xC00; // Cycle counter for RDCYCLE instruction
const int32 CSR_TIME      = 0xC01; // Timer for RDTIME instruction
const int32 CSR_INSTRET   = 0xC02; // Instructions-retired counter for RDINSTRET instruction
const int32 CSR_CYCLEH    = 0xC80; // Upper 32 bits of cycle, RV32I only
const int32 CSR_TIMEH     = 0xC81; // Upper 32 bits of time, RV32I only
const int32 CSR_INSTRETH  = 0xC82; // Upper 32 bits of instret, RV32I only

// This is a special CSR just for this emulator to connect the CLINT to the CPU
// because the timer is handled in the CPU part
const int32 CSR_TIMECMP   = 0xC41;

// machine CSRs non-standard read-only
//const int32 CSR_MCPUID    = 0xF00;
//const int32 CSR_MIMPID    = 0xF01;
const int32 CSR_MHARTID   = 0xF14;

const int32 QUIET_NAN = 0xFFFFFFFF;
const int32 SIGNALLING_NAN = 0x7FFFFFFF;

static int32  *r = (int32*)0;
static double *f = (double*)(32<<2);
static int32  *fi = (int32*)(32<<2); // for copying operations
static float *ff = (float*)(0); // the zero register is used to convert to single precision

// memory
static int8*  ramb = (int8*)0x100000;
static int16* ramh = (int16*)0x100000;
static int32* ramw = (int32*)0x100000;

static int32 *csr = (int32*)0x2000; // special purpose registers


// define global variables
typedef struct
{
  int32 amoaddr; // for atomic load & store instructions
  int32 amovalue; // for atomic load & store instructions

  int32 pc;
  int32 prv;

  int32 ticks;

} global;
static global *g = (global*)0x1000;



int32 get_field(int32 reg, int32 mask)
{
    return ((reg & mask) / (mask & ~(mask << 1)));
}

int32 set_field(int32 reg, int32 mask, int32 val)
{
    return (reg & ~mask) | ((val * (mask & ~(mask << 1))) & mask);
}

void CheckForInterrupt();
void Trap(int32 cause, int32 epc, int32 addr);

void Init()
{
    Reset();
}

void Reset()
{
    g->ticks = 0;
    g->prv = PRV_M;
    csr[CSR_MSTATUS]  = (0x0 << 24); // mbare vm mode, no mie, noe mprv
    csr[CSR_MHARTID]  = 0x00; // hardware thread id is fixed to zero (= cpu id)
    csr[CSR_MISA]     = (1<<8) | (1<<12) | (1<<0) | (1<<30) | (1<<5) | (1<<3); // base ISA, multiply mul/div, atomic instructions, 32-Bit, single precision, double precision
    csr[CSR_MCAUSE]   = 0x00; // cause of the reset, hard reset

    // for atomic load & store instructions
    g->amoaddr = 0x00;
    g->amovalue = 0x00;

    g->pc = 0x1000; // implementation defined start address, boot into ROM
}

void InvalidateTLB()
{
    // No TLB
}

int32 GetTimeToNextInterrupt()
{
    return csr[CSR_TIMECMP] - g->ticks;
}

int32 GetTicks()
{
    return g->ticks;
}

void ProgressTime(int32 delta)
{
    g->ticks += delta;
    csr[CSR_TIME] = g->ticks;

    delta = csr[CSR_TIMECMP] - g->ticks;
    if (delta <= 1)
    {
        csr[CSR_MIP] = csr[CSR_MIP] | MIP_STIP;
    }
    CheckForInterrupt();
}

// we haveto define these to copy the cpus
void AnalyzeImage()
{
  // no reason
}

// Count number of contiguous 0 bits starting from the LSB.
int32 ctz(int32 val)
{
    int32 res = 0;
    if (val)
    {
        while ((val & 1) == 0)
        {
            val >>= 1;
            res++;
        }
    }
    return res;
}


void RaiseInterrupt(int32 line, int32 cpuid)
{
    //DebugMessage("raise int " + line);
    if (line == IRQ_S_EXT)
    {
        csr[CSR_MIP] |= MIP_SEIP; // EXT
    }
}

void ClearInterrupt(int32 line, int32 cpuid)
{
    //DebugMessage("clear int " + line);
    if (line == IRQ_S_EXT)
    {
        csr[CSR_MIP] &= ~MIP_SEIP; // EXT
    }
}


void CheckForInterrupt()
{
    int32 pending_interrupts = csr[CSR_MIP] & csr[CSR_MIE];

    int32 mie = get_field(csr[CSR_MSTATUS], MSTATUS_MIE);
    int32 m_enabled = ((g->prv < PRV_M) || ((g->prv == PRV_M) && mie))?1:0;
    int32 enabled_interrupts = pending_interrupts & ~csr[CSR_MIDELEG] & -m_enabled;

    if (enabled_interrupts == 0)
    {
        int32 sie = get_field(csr[CSR_MSTATUS], MSTATUS_SIE);
        int32 s_enabled = ((g->prv < PRV_S) || ((g->prv == PRV_S) && sie))?1:0;
        enabled_interrupts |= pending_interrupts & csr[CSR_MIDELEG] & -s_enabled;
    }

    if (enabled_interrupts)
    {
        //DebugMessage("Take interrupt: " + ctz(enabled_interrupts));
        Trap(0x80000000 | ctz(enabled_interrupts), g->pc, -1);
    }
};

void Trap(int32 cause, int32 epc, int32 addr)
{
    //DebugMessage("Trap cause=" + utils.ToHex(cause) + " at epc=" + utils.ToHex(epc));
    //abort();

    // by default, trap to M-mode, unless delegated to S-mode
    int32 bit = cause;
    int32 deleg = csr[CSR_MEDELEG];
    int32 interrupt = (bit & (1<<31)) != 0;
    if (interrupt)
    {
        deleg = csr[CSR_MIDELEG];
        bit &= ~(1<<31);
    }
    if (g->prv <= PRV_S && bit < 32 && ((deleg >> bit) & 1))
    {
        // handle the trap in S-mode
        g->pc = csr[CSR_STVEC];
        csr[CSR_SCAUSE] = cause;
        csr[CSR_SEPC] = epc;
        csr[CSR_SBADADDR] = addr;

        int32 s = csr[CSR_MSTATUS] | 0;
        s = set_field(s, MSTATUS_SPIE, get_field(s, MSTATUS_SIE))|0;
        s = set_field(s, MSTATUS_SPP, g->prv)|0;
        s = set_field(s, MSTATUS_SIE, 0)|0;
        csr[CSR_MSTATUS] = s;

        g->prv = PRV_S;
    } else {
        int32 vector = ((csr[CSR_MTVEC] & 1) && interrupt) ? bit*4 : 0;
        g->pc = (csr[CSR_MTVEC]&(~1)) + vector;
        csr[CSR_MEPC] = epc;
        csr[CSR_MCAUSE] = cause;
        csr[CSR_MBADADDR] = addr;

        int32 s = csr[CSR_MSTATUS] | 0;
        s = set_field(s, MSTATUS_MPIE, get_field(s, MSTATUS_MIE))|0;
        s = set_field(s, MSTATUS_MPP, g->prv)|0;
        s = set_field(s, MSTATUS_MIE, 0)|0;
        csr[CSR_MSTATUS] = s;

        g->prv = PRV_M;
    }

    g->amoaddr = 0x00;
    g->amovalue = 0x00;
};

void MemAccessTrap(int32 addr, int32 op)
{
    switch(op)
    {
        case VM_READ:
            Trap(CAUSE_LOAD_PAGE_FAULT, g->pc - 4, addr);
            break;

        case VM_WRITE:
            Trap(CAUSE_STORE_PAGE_FAULT, g->pc - 4, addr);
            break;

        case VM_FETCH:
            Trap(CAUSE_FETCH_PAGE_FAULT, g->pc, addr);
            break;
    }
}

int32 CheckVMPrivilege(int32 pte, int32 op)
{
    //var type = (pte >> 1) & 0xF;
    int32 supervisor = g->prv == PRV_S;
    int32 sum = csr[CSR_MSTATUS] & MSTATUS_SUM; // protect user memory
    int32 mxr = csr[CSR_MSTATUS] & MSTATUS_MXR; // make executable readable

    if (pte & PTE_U)
    {
        if (supervisor && !sum)
        {
            //DebugMessage("Illegal access from privilege mode at pc=" + utils.ToHex(this.pc) + " " + op);
            DebugMessage(1);
            abort();
            return 0;
        }
    } else
    {
        if (!supervisor) return 0;
    }

    // not valid or reserved for future use
    if (!(pte & PTE_V) || (!(pte & PTE_R) && (pte & PTE_W))) {
        // DebugMessage("Unknown access from privilege mode at pc=" + utils.ToHex(this.pc) + " " + op);
        // abort();
        DebugMessage(2);
        return 0;
    }

    switch(op|0)
    {
        case VM_FETCH:
            return pte & PTE_X;

        case VM_READ:
            return (pte & PTE_R) || (mxr && (pte & PTE_X));

        case VM_WRITE:
            return (pte & PTE_R) && (pte & PTE_W);
    }
    //DebugMessage("Error in CheckVMPRivilege: unknown operation");
    DebugMessage(3);
    abort();
}

// Translates a virtual address to a physical by walking through
// the page table and checking  the rights
int32 TranslateVM(int32 addr, int32 op)
{
    int32 vm = (csr[CSR_SPTBR] >> 31) & 1;
    int32 PGSIZE = 4096;
    int32 PGMASK = ~(PGSIZE-1);
    int32 PGSHIFT = 12;
    int32 ptidxbits = 10;
    int32 ptesize = 4;

    // vm bare mode
    if (vm == SPTBR_MODE_OFF || g->prv == PRV_M) return addr;

    // LEVEL 1
    // get first entry in page table
    int32 base = (csr[CSR_SPTBR] & SPTBR32_PPN) << PGSHIFT;
    int32 pteaddr = base + ((((uint32)addr) >> 22) << 2);
    int32 pte = ramw[pteaddr>>2];

    //message.Debug("VM Start " + utils.ToHex(addr) + " " + utils.ToHex(base) + " " + utils.ToHex(pte));
    //check if pagetable is finished here
    if ((pte & 0xF) != 0x1)
    {
        if (!CheckVMPrivilege(pte, op))
        {
            MemAccessTrap(addr, op);
            return -1;
        }
        //this.ram.Write32(pteaddr, pte | PTE_A | ((op==VM_WRITE)?PTE_D:0));
        //message.Debug("VM L1 " + utils.ToHex(addr) + " " + utils.ToHex(base) + " " + utils.ToHex(((pte >> 10) << 12) | (addr&0x3FFFFF)));
        //message.Abort();
        return ((pte >> 10) << 12) | (addr&0x3FFFFF);
    }

    // LEVEL 2
    base = (pte & 0xFFFFFC00) << 2;
    int32 new_page_num = (addr >> 12) & 0x3FF;
    pteaddr = base + (new_page_num << 2);

    pte = ramw[pteaddr>>2];
    //message.Debug("Level 2 " + utils.ToHex(addr) + " " + utils.ToHex(base) + " " + utils.ToHex(pte));
    //message.Abort();

    // only 2 levels are allowed in 32-Bit mode
    if ((pte & 0xF) == 0x1)
    {
        MemAccessTrap(addr, op);
        return -1;
    }

    if (!CheckVMPrivilege(pte, op))
    {
        MemAccessTrap(addr, op);
        return -1;
    }
    //this.ram.Write32(pteaddr, pte | PTE_A | ((op==VM_WRITE)?PTE_D:0));
    //message.Debug("VM L2 " + utils.ToHex(addr) + " " + utils.ToHex(base) + " " + utils.ToHex( ((pte >> 10) << 12) | (addr & 0xFFF) ));
    //message.Abort();
    return ((pte >> 10) << 12) | (addr & 0xFFF);
};


void SetCSR(int32 addr, int32 value)
{
    //DebugMessage("SetCSR: Address:" + utils.ToHex(addr) + ", value " + utils.ToHex(value));
    switch(addr)
    {
        case CSR_MSTATUS:
            if ((value ^ csr[CSR_MSTATUS]) & (MSTATUS_MPP | MSTATUS_MPRV | MSTATUS_SUM | MSTATUS_MXR))
            {
                InvalidateTLB();
            }
            int32 mask = MSTATUS_SIE | MSTATUS_SPIE | MSTATUS_MIE | MSTATUS_MPIE
                     | MSTATUS_SPP | MSTATUS_FS | MSTATUS_MPRV | MSTATUS_SUM
                     | MSTATUS_MPP | MSTATUS_MXR | MSTATUS_TW | MSTATUS_TVM
                     | MSTATUS_TSR | MSTATUS_XS;
            csr[addr] = (value & ~mask) | (value & mask);
            int32 dirty = (csr[CSR_MSTATUS] & MSTATUS_FS) == MSTATUS_FS;
            dirty |= (csr[CSR_MSTATUS] & MSTATUS_XS) == MSTATUS_XS;
            // TODO this seems wrong
            //csr[CSR_MSTATUS] = (csr[CSR_MSTATUS] & ~MSTATUS_SD) | (dirty?1<<MSTATUS_SD:0);
            csr[CSR_MSTATUS] = (csr[CSR_MSTATUS] & ~MSTATUS_SD) | (dirty?0:0);
            break;

        case CSR_SSTATUS:
        {
            csr[addr] = value;
            int32 mask = MSTATUS_SIE | MSTATUS_SPIE | MSTATUS_SPP | MSTATUS_FS | MSTATUS_XS | MSTATUS_SUM | MSTATUS_MXR;
            SetCSR(CSR_MSTATUS, (csr[CSR_MSTATUS] & ~mask) | (value & mask));
        }
            break;

        case CSR_MIE:
        {
            int32 mask = MIP_SSIP | MIP_STIP | MIP_SEIP | (1 << IRQ_COP) | MIP_MSIP | MIP_MTIP;
            csr[CSR_MIE] = (csr[CSR_MIE] & ~mask) | (value & mask);
            //message.Debug("Write MIE: " + utils.ToHex(csr[CSR_MIE]) + " at pc=" + utils.ToHex(this.pc));
        }
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
        {
            int32 mask = MIP_SSIP | MIP_STIP;
            csr[CSR_MIP] = (csr[CSR_MIP] & ~mask) | (value & mask);
            //message.Debug("Write MIP: " + utils.ToHex(csr[CSR_MIP]));
        }
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
            InvalidateTLB();
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

        case CSR_PMPCFG0:
        case CSR_PMPADDR0:
            csr[addr] = value;
            break;

        default:
            csr[addr] = value;
            //DebugMessage("Error in SetCSR: PC "+utils.ToHex(this.pc)+" Address " + utils.ToHex(addr) + " unkown");
            DebugMessage(4);
            abort();
            break;
    }
}

int32 GetCSR(int32 addr)
{
    //DebugMessage("GetCSR: Address:" + utils.ToHex(addr));
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
        {
            int32 mask = MSTATUS_SIE | MSTATUS_SPIE | MSTATUS_SPP | MSTATUS_FS
                       | MSTATUS_XS | MSTATUS_SUM;
            int32 sstatus = csr[CSR_MSTATUS] & mask;
            if ((sstatus & MSTATUS_FS) == MSTATUS_FS ||
                (sstatus & MSTATUS_XS) == MSTATUS_XS)
                sstatus |= MSTATUS_SD;
            return sstatus;
        }
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
            return g->ticks;
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

        default:
            //DebugMessage("Error in GetCSR: PC "+utils.ToHex(this.pc)+" Address " + utils.ToHex(addr) + " unkown");
            DebugMessage(5);
            abort();
            return csr[addr];
            break;
    }

}

int32 Step(int32 steps, int32 clockspeed)
{
    int32 rindex = 0x00;
    int32 imm = 0x00;
    int32 imm1 = 0x00;
    int32 imm2 = 0x00;
    int32 imm3 = 0x00;
    int32 imm4 = 0x00;
    int32 zimm = 0x00;
    int32 quo = 0x00;
    int32 rem = 0x00;
    int32 rs1 = 0x0;
    int32 rs2 = 0x0;
    double fs1 = 0.0;
    double fs2 = 0.0;
    double fs3 = 0.0;
    int32 interrupts = 0x0;
    int32 ie = 0x0;
    int32 ins = 0x0;
    int32 paddr = 0x0;

    int32 delta = 0;
    int32 n = 0;

    do {
        r[0] = 0x00;

        if (!(steps & 63))
        {
            // ---------- TICK ----------
            delta = csr[CSR_TIMECMP] - g->ticks;
            g->ticks += clockspeed;
            csr[CSR_TIME] = g->ticks;
            if (delta < clockspeed)
            {
                csr[CSR_MIP] = csr[CSR_MIP] | MIP_STIP;
            }
            CheckForInterrupt();
        }

        paddr = TranslateVM(g->pc, VM_FETCH);
        if(paddr == -1)
        {
            continue;
        }

        ins = ramw[paddr >> 2];
        //DebugIns.Disassemble(ins, r, csr, this.pc);
        g->pc += 4;

        switch(ins&0x7F)
        {
            case 0x03:
                // lb, lh, lw, lbu, lhu
                imm = (ins >> 20);
                rs1 = r[(ins >> 15) & 0x1F];
                rindex = (ins >> 7) & 0x1F;
                switch((ins >> 12)&0x7) {

                    case 0x00:
                        // lb
                        paddr = TranslateVM(rs1 + imm, VM_READ);
                        if (paddr == -1) break;
                        r[rindex] = (Read8(paddr) << 24) >> 24;
                        break;

                    case 0x01:
                        // lh
                        if (rs1+imm & 1)
                        {
                             Trap(CAUSE_MISALIGNED_LOAD, g->pc - 4, rs1 + imm);
                             //message.Debug("Error in lh: unaligned address");
                             //message.Abort();
                             break;
                        }
                        paddr = TranslateVM(rs1 + imm, VM_READ);
                        if (paddr == -1) break;
                        r[rindex] = (Read16(paddr) << 16) >> 16;
                        break;

                    case 0x02:
                        // lw
                        if (rs1+imm & 3)
                        {
                             Trap(CAUSE_MISALIGNED_LOAD, g->pc - 4, rs1+imm);
                             //message.Debug("Error in lw: unaligned address");
                             //message.Abort();
                             break;
                        }
                        paddr = TranslateVM(rs1 + imm, VM_READ);
                        if (paddr == -1) break;
                        /* TODO HTIF
                        if ((paddr>>>0) == 0x8000a008)
                        {
                            Write32(paddr+0, htif.ReadToHost());
                            Write32(paddr+4, htif.ReadDEVCMDToHost());
                        }
                        if ((paddr>>>0) == 0x8000a000) {
                            Write32(paddr+0, htif.ReadFromHost());
                            Write32(paddr+4, htif.ReadDEVCMDFromHost());
                        }
                        */
                        r[rindex] = Read32(paddr);
                        break;

                    case 0x04:
                        // lbu
                        paddr = TranslateVM(rs1 + imm, VM_READ);
                        if (paddr == -1) break;
                        r[rindex] = Read8(paddr) & 0xFF;
                        break;

                    case 0x05:
                        // lhu
                        if (rs1+imm & 1)
                        {
                             //DebugMessage("Error in lhu: unaligned address");
                             DebugMessage(6);
                             abort();
                        }
                        paddr = TranslateVM(rs1 + imm, VM_READ);
                        if (paddr == -1) break;
                        r[rindex] = Read16(paddr) & 0xFFFF;
                        break;

                    default:
                        //DebugMessage("Error in safecpu: Instruction " + utils.ToHex(ins) + " not found");
                        DebugMessage(7);
                        abort();
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
                switch((ins >> 12)&0x7)
                {

                    case 0x00:
                        // sb
                        paddr = TranslateVM(rs1 + imm, VM_WRITE);
                        if(paddr == -1) break;
                        Write8(paddr, (r[rindex] & 0xFF));
                        break;

                    case 0x01:
                        // sh
                        if (rs1+imm & 1) {
                             Trap(CAUSE_MISALIGNED_STORE, g->pc - 4, rs1 + imm);
                             //message.Debug("Error in sh: unaligned address");
                             //message.Abort();
                             break;
                        }
                        paddr = TranslateVM(rs1 + imm, VM_WRITE);
                        if (paddr == -1) break;
                        Write16(paddr, r[rindex] & 0xFFFF);
                        break;

                    case 0x02:
                        // sw
                        if (rs1+imm & 3)
                        {
                             Trap(CAUSE_MISALIGNED_STORE, g->pc - 4, rs1 + imm);
                             //message.Debug("Error in sw: unaligned address");
                             //message.Abort();
                             break;
                        }
                        paddr = TranslateVM(rs1 + imm, VM_WRITE);
                        if (paddr == -1) break;
                        Write32(paddr, r[rindex]);
                        /* TODO HTIF
                        if ((paddr>>>0) == 0x8000a00c)
                        {
                            //message.Debug("Write tohost at " + utils.ToHex(this.pc));
                            this.htif.WriteDEVCMDToHost(this.ram.Read32(paddr));
                            this.htif.WriteToHost(this.ram.Read32(paddr-4));
                        }
                        if ((paddr>>>0) == 0x8000a004) {
                            this.htif.WriteDEVCMDFromHost(this.ram.Read32(paddr));
                            this.htif.WriteFromHost(this.ram.Read32(paddr-4));
                        }
                        */
                        break;

                    default:
                        //message.Debug("Error in safecpu: Instruction " + utils.ToHex(ins) + " not found");
                        //message.Abort();
                        abort();
                        break;

                }
                break;

            case 0x13:
                // addi, slti, sltiu, xori, ori, andi, slli, srli, srai
                rindex = (ins >> 7) & 0x1F;
                rs1 = r[(ins >> 15) & 0x1F];
                imm = (ins >> 20);
                switch((ins >> 12)&0x7)
                {

                    case 0x00:
                        // addi
                        r[rindex] = rs1 + imm;
                        break;

                    case 0x02:
                        // slti
                        if (rs1 < imm) r[rindex] = 0x01; else r[rindex] = 0x00;
                        break;

                    case 0x03:
                        // sltiu
                        if (((uint32)rs1) < ((uint32)imm)) r[rindex] = 0x01; else r[rindex] = 0x00;
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
                        if(((ins >> 25) & 0x7F) == 0x00)
                        {
                            // srli
                            r[rindex] = ((uint32)rs1) >> imm;
                        }
                        else if(((ins >> 25) & 0x7F) == 0x20)
                        {
                            // srai
                            r[rindex] = rs1 >> imm;
                        } else
                        {
                            abort();
                            //message.Debug("Error in safecpu: Instruction (sra, srl)" + utils.ToHex(ins) + " not found");
                            //message.Abort();
                        }
                        break;

                    default:
                        abort();
                        //message.Debug("Error in safecpu: Instruction " + utils.ToHex(ins) + " not found");
                        //message.Abort();
                        break;

                }
                break;

            case 0x33:
                // add, sub, sll, slt, sltu, xor, srl, sra, or, and
                switch ((ins >> 25)&0x7F)
                {
                    case 0x00:
                        // add, slt, sltu, or, xor, sll, srl
                        rs1 = r[(ins >> 15) & 0x1F];
                        rs2 = r[(ins >> 20) & 0x1F];
                        rindex = (ins >> 7) & 0x1F;
                        switch ((ins >> 12)&0x7)
                        {
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
                                if(rs1 < rs2) r[rindex] = 0x01; else r[rindex] = 0x00;
                                break;

                            case 0x03:
                                // sltu
                                if (((uint32)rs1) < ((uint32)rs2)) r[rindex] = 0x01; else r[rindex] = 0x00;
                                break;

                            case 0x04:
                                // xor
                                r[rindex] = rs1 ^ rs2;
                                break;

                            case 0x05:
                                // srl
                                r[rindex] = ((uint32)rs1) >> (rs2 & 0x1F);
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
                        switch((ins >> 12)&0x7)
                        {
                            case 0x00:
                                // sub
                                r[rindex] = rs1 - rs2;
                                break;

                            case 0x05:
                                // sra
                                r[rindex] = rs1 >> (rs2 & 0x1F);
                                break;

                            default:
                                abort();
                                //message.Debug("Error in safecpu: Instruction (sub,sra) " + utils.ToHex(ins) + " not found");
                                //message.Abort();
                        }
                        break;

                    case 0x01:
                        // mul, mulh, mulhsu, mulhu, div, divu, rem, remu
                        rs1 = r[(ins >> 15) & 0x1F];
                        rs2 = r[(ins >> 20) & 0x1F];
                        rindex = (ins >> 7) & 0x1F;
                        switch((ins >> 12)&0x7)
                        {
                            case 0x00:
                                // mul
                                r[rindex] = ((int64)rs1 * (int64)rs2)&0xFFFFFFFF;
                                break;

                            case 0x01:
                                // mulh
                                r[rindex] = ((int64)rs1 * (int64)rs2)>>32;
                                break;

                            case 0x02:
                                // mulhsu
                                r[rindex] = ((int64)rs1 * (uint64)rs2)>>32;
                                break;

                            case 0x03:
                                // mulhu
                                r[rindex] = ((uint64)rs1 * (uint64)rs2)>>32;
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
                                    quo = (((uint32)rs1) / ((uint32)rs2));
                                r[rindex] = quo;
                                break;

                            case 0x06:
                                // rem
                                if(rs2 == 0)
                                    rem = rs1;
                                else
                                    rem = (rs1 % rs2);
                                r[rindex] = rem;
                                break;

                            case 0x07:
                                // remu
                                if(rs2 == 0)
                                    rem = rs1;
                                else
                                    rem = ((uint32)rs1) % ((uint32)rs2);
                                r[rindex] = rem;
                                break;
                        }
                        break;

                    default:
                        //message.Debug("Error in safecpu: Instruction " + utils.ToHex(ins) + " not found");
                        //message.Abort();
                        abort();
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
                r[rindex] = g->pc + imm - 4|0;
                break;

            case 0x6F:
                // jal
                imm1 = (ins >> 21) & 0x3FF;
                imm2 = ((ins >> 20) & 0x1) << 10;
                imm3 = ((ins >> 12) & 0xFF) << 11;
                imm4 = (ins >> 31) << 19;
                imm =  (imm1 | imm2 | imm3 | imm4 ) << 1;
                rindex = (ins >> 7) & 0x1F;
                r[rindex] = g->pc;
                g->pc += imm - 4;
                break;

            case 0x67:
                // jalr
                //if ((this.pc>>>0) >= 0xC0000000)
	        //        message.Debug("jump from " + utils.ToHex(this.pc));
                imm = ins >> 20;
                rs1 = r[(ins >> 15) & 0x1F];
                rindex = (ins >> 7) & 0x1F;
                r[rindex] = g->pc;
                g->pc = (rs1 + imm) & 0xFFFFFFFE;
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
                        if (rs1 == rs2) g->pc += imm - 4;
                        break;

                    case 0x01:
                        // bne
                        if (rs1 != rs2) g->pc += imm - 4;
                        break;

                    case 0x04:
                        // blt
                        if (rs1 < rs2) g->pc += imm - 4;
                        break;

                    case 0x05:
                        // bge
                        if (rs1 >= rs2) g->pc += imm - 4;
                        break;

                    case 0x06:
                        // bltu
                        if (((uint32)rs1) < ((uint32)rs2)) g->pc += imm - 4;
                        break;

                    case 0x07:
                        // bgeu
                        if (((uint32)rs1) >= ((uint32)rs2)) g->pc += imm - 4;
                        break;

                    default:
                        abort();
                        //message.Debug("Error in safecpu: Instruction " + utils.ToHex(ins) + " not found");
                        //message.Abort();
                        break;

                }
                break;

            case 0x73:
                // csrrw, csrrs, csrrc, csrrwi, csrrsi, csrrci, ecall, eret, ebreak, mrts, wfi
                imm = ((uint32)ins >> 20);
                rs1 = r[(ins >> 15) & 0x1F];
                rindex = (ins >> 7) & 0x1F;
                switch((ins >> 12)&0x7)
                {
                    case 0x01:
                        // csrrw
                        r[rindex] = GetCSR(imm);
                        SetCSR(imm, rs1);
                        break;

                    case 0x02:
                        // csrrs
                        r[rindex] = GetCSR(imm);
                        if (rs1 != 0)
                        {
                            SetCSR(imm, GetCSR(imm) | rs1);
                        }
                        break;

                    case 0x03:
                        // csrrc
                        r[rindex] = GetCSR(imm);
                        if (rs1 != 0)
                        {
                            SetCSR(imm, GetCSR(imm) & (~rs1));
                        }
                        break;

                    case 0x05:
                        // csrrwi
                        r[rindex] = GetCSR(imm);
                        zimm = (ins >> 15) & 0x1F;
                        SetCSR(imm, (zimm >> 0));
                        break;


                    case 0x06:
                        // csrrsi
                        r[rindex] = GetCSR(imm);
                        zimm = (ins >> 15) & 0x1F;
                        if (zimm != 0)
                        {
                            SetCSR(imm, GetCSR(imm) | (zimm >> 0));
                        }
                        break;

                    case 0x07:
                        // csrrci
                        r[rindex] = GetCSR(imm);
                        zimm = (ins >> 15) & 0x1F;
                        if (zimm != 0)
                        {
                            SetCSR(imm, GetCSR(imm) & ~(zimm >> 0));
                        }
                        break;

                    case 0x00:
                        // ecall, sret, ebreak, mret, wfi
                        switch((ins >> 20)&0xFFF)
                        {
                            case 0x00:
                                // ecall
                                switch(g->prv)
                                {
                                    case PRV_U:
                                        Trap(CAUSE_USER_ECALL, g->pc - 4, -1);
                                        break;

                                    case PRV_S:
                                        Trap(CAUSE_SUPERVISOR_ECALL, g->pc - 4, -1);
                                        break;

                                    case PRV_H:
                                        Trap(CAUSE_HYPERVISOR_ECALL, g->pc - 4, -1);
                                        abort();
                                        break;

                                    case PRV_M:
                                        Trap(CAUSE_MACHINE_ECALL, g->pc - 4, -1);
                                        break;

                                    default:
                                        //message.Debug("Error in ecall: Don't know how to handle privilege level " + privilege_mode);
                                        //message.Abort();
                                        abort();
                                        break;
                                }
                                break;

                            case 0x001:
                                // ebreak
                                Trap(CAUSE_BREAKPOINT, g->pc - 4, -1);
                                break;

                            case 0x102:
                                // sret
                                if (g->prv != PRV_S)
                                {
                                    //message.Debug("Error in sret: privilege_mode isn't allowed access");
                                    //message.Abort();
                                    abort();
                                    break;
                                }
                                {
                                    g->pc = csr[CSR_SEPC];
                                    int32 s = csr[CSR_MSTATUS];
                                    int32 prev_prv = get_field(s, MSTATUS_SPP);
                                    s = set_field(s, MSTATUS_SIE, get_field(s, MSTATUS_SPIE));
                                    s = set_field(s, MSTATUS_SPIE, 1);
                                    s = set_field(s, MSTATUS_SPP, PRV_U);
                                    csr[CSR_MSTATUS] = s;
                                    g->prv = prev_prv;
                                    InvalidateTLB();
                                }
                                break;

                            case 0x105:
                                // wfi
                                //message.Debug("wfi");
                                if ((csr[CSR_MIE] & csr[CSR_MIP]) == 0)
                                    return steps;
                                break;

                            case 0x302:
                                // mret
                                if (g->prv != PRV_M)
                                {
                                    //message.Debug("Error in mret: privilege_mode isn't allowed access");
                                    //message.Abort();
                                    abort();
                                    break;
                                }
                                g->pc = csr[CSR_MEPC];
                                int32 s = csr[CSR_MSTATUS];
                                int32 prev_prv = get_field(s, MSTATUS_MPP);
                                s = set_field(s, MSTATUS_MIE, get_field(s, MSTATUS_MPIE));
                                s = set_field(s, MSTATUS_MPIE, 1);
                                s = set_field(s, MSTATUS_MPP, PRV_U);
                                csr[CSR_MSTATUS] = s;
                                g->prv = prev_prv;
                                InvalidateTLB();
                                break;

                            case 0x120:
                                // sfence.vma
                                break;

                            default:
                                //message.Debug("Error in safecpu: Instruction " + utils.ToHex(ins) + " not found");
                                //message.Abort();
                                abort();
                                break;

                        }
                        break;

                    default:
                        //message.Debug("Error in safecpu: Instruction " + utils.ToHex(ins) + " not found");
                        //message.Abort();
                        abort();
                        break;

                }
                break;

            case 0x07:
                // flw, fld
                imm = (ins >> 20);
                rs1 = r[(ins >> 15) & 0x1F];
                rindex = ((ins >> 7) & 0x1F);
                switch((ins >> 12)&0x7)
                {
                    case 0x02:
                        // flw
                        if (rs1+imm & 3)
                        {
                             //message.Debug("Error in flw: unaligned address");
                             //message.Abort();
                             abort();
                        }
                        paddr = TranslateVM(rs1 + imm, VM_READ);
                        if (paddr == -1) break;
                        r[0] = Read32(paddr);
                        f[rindex] = ff[0];
                        break;

                    case 0x03:
                        // fld
                        if (rs1+imm & 7)
                        {
                             //message.Debug("Error in flw: unaligned address");
                             //message.Abort();
                             abort();
                        }
                        paddr = TranslateVM(rs1 + imm, VM_READ);
                        if (paddr == -1) break;
                        fi[(rindex<<1) + 0] = Read32(paddr + 0);
                        fi[(rindex<<1) + 1] = Read32(paddr + 4);
                        break;

                    default:
                        //message.Debug("Error in safecpu: Instruction " + utils.ToHex(ins) + " not found");
                        //message.Abort();
                        abort();
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
                switch ((ins >> 12)&0x7)
                {
                    case 0x02:
                        // fsw
                        ff[0] = f[rindex];
                        if (rs1+imm & 3)
                        {
                            abort();
                            //message.Debug("Error in fsw: unaligned address");
                            //message.Abort();
                        }
                        paddr = TranslateVM(rs1 + imm, VM_WRITE);
                        if (paddr == -1) break;
                        Write32(paddr, r[0]);
                        break;

                    case 0x03:
                        // fsd
                        if (rs1+imm & 7)
                        {
                            abort();
                            //message.Debug("Error in fsd: unaligned address");
                            //message.Abort();
                        }
                        paddr = TranslateVM(rs1 + imm, VM_WRITE);
                        if (paddr == -1) break;
                        Write32(paddr+0, fi[(rindex<<1) + 0]);
                        Write32(paddr+4, fi[(rindex<<1) + 1]);
                        break;

                    default:
                        //message.Debug("Error in safecpu: Instruction " + utils.ToHex(ins) + " not found");
                        //message.Abort();
                        abort();
                        break;

                }
                break;

            case 0x53:
                // fadd, fsub, fcmp
                rindex = (ins >> 7) & 0x1F;
                switch((ins >> 25)&0x7F)
                {
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
                        switch((ins >> 12) & 0x7)
                        {
                            case 0x0:
                                if (fs1 <= fs2) r[rindex] = 1; else r[rindex] = 0;
                                break;

                            case 0x1:
                                if (fs1 < fs2) r[rindex] = 1; else r[rindex] = 0;
                                break;

                            case 0x2:
                                if (fs1 == fs2) r[rindex] = 1; else r[rindex] = 0;
                                break;

                            default:
                                //message.Debug("Error in safecpu: Instruction (fcmp) " + utils.ToHex(ins) + " not found");
                                //message.Abort();
                                abort();
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
                        switch((ins >> 12) & 7)
                        {
                            case 0:
                                // fsgnj.d, also used for fmv.d
                                f[rindex] = (fs2<0)?-fabs(fs1):fabs(fs1);
                                break;

                            case 1:
                                // fsgnjn.d
                                f[rindex] = (fs2<0)?fabs(fs1):-fabs(fs1);
                                break;

                            case 2:
                                // fsgnjx.d
                                f[rindex] = ((fs2<0 && fs1<0) || (fs2>0 && fs1>0))?fabs(fs1):-fabs(fs1);
                                break;

                            default:
                                //message.Debug("Error in safecpu: Instruction (fsgn) " + utils.ToHex(ins) + " not found");
                                //message.Abort();
                                abort();
                        }
                        break;

                    case 0x78:
                        // fmv.s.x
                        rs1 = r[(ins >> 15) & 0x1F];
                        r[0] = rs1;
                        f[rindex] = ff[0];
                        break;


                    default:
                        //message.Debug("Error in safecpu: Instruction " + utils.ToHex(ins) + " not found");
                        //message.Abort();
                        abort();
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
                paddr = TranslateVM(rs1, VM_READ);
                if (paddr == -1) break;

                switch((ins >> 27) & 0x1F)
                {

                    case 0x01:
                        // amoswap
                        r[rindex] = Read32(paddr);
                        paddr = TranslateVM(rs1, VM_WRITE);
                        if(paddr == -1) break;
                        Write32(paddr, rs2);
                        break;

                    case 0x00:
                        // amoadd
                        r[rindex] = Read32(paddr);
                        paddr = TranslateVM(rs1, VM_WRITE);
                        if(paddr == -1) break;
                        Write32(paddr, r[rindex] + rs2);
                        break;

                    case 0x04:
                        // amoxor
                        r[rindex] = Read32(paddr);
                        paddr = TranslateVM(rs1, VM_WRITE);
                        if(paddr == -1) break;
                        Write32(paddr, r[rindex] ^ rs2);
                        break;

                    case 0x0C:
                        // amoand
                        r[rindex] = Read32(paddr);
                        paddr = TranslateVM(rs1, VM_WRITE);
                        if(paddr == -1) break;
                        Write32(paddr, r[rindex] & rs2);
                        break;

                    case 0x08:
                        // amoor
                        r[rindex] = Read32(paddr);
                        paddr = TranslateVM(rs1, VM_WRITE);
                        if (paddr == -1) break;
                        Write32(paddr, r[rindex] | rs2);
                        break;

                    case 0x10:
                        // amomin
                        r[rindex] = Read32(paddr);
                        if ((rs2 >> 0) > (r[rindex] >> 0)) r[0] = r[rindex];
                        else r[0] = rs2;
                        paddr = TranslateVM(rs1, VM_WRITE);
                        if (paddr == -1) break;
                        Write32(paddr, r[0]);
                        break;

                   case 0x14:
                        // amomax
                        r[rindex] = Read32(paddr);
                        if (rs2 < r[rindex]) r[0] = r[rindex];
                        else r[0] = rs2;
                        paddr = TranslateVM(rs1, VM_WRITE);
                        if(paddr == -1) break;
                        Write32(paddr, r[0]);
                        break;

                    case 0x18:
                        // amominu
                        r[rindex] = Read32(paddr);
                        if (((uint32)rs2) > ((uint32)r[rindex])) r[0] = r[rindex];
                        else r[0] = rs2;
                        paddr = TranslateVM(rs1, VM_WRITE);
                        if(paddr == -1) break;
                        Write32(paddr, r[0]);
                        break;

                    case 0x1C:
                        // amomaxu
                        r[rindex] = Read32(paddr);
                        if (((uint32)rs2) < ((uint32)r[rindex])) r[0] = r[rindex]; else r[0] = rs2;
                        paddr = TranslateVM(rs1, VM_WRITE);
                        if (paddr == -1) break;
                        Write32(paddr, r[0]);
                        break;

                    case 0x02:
                        // lr.d
                        r[rindex] = Read32(paddr);
                        g->amoaddr = rs1;
                        g->amovalue = r[rindex];
                        break;

                    case 0x03:
                        // sc.d
                        if (rs1 != g->amoaddr)
                        {
                            r[rindex] = 0x01;
                            break;
                        }
                        if (Read32(paddr) != g->amovalue)
                        {
                            r[rindex] = 0x01;
                            break;
                        }
                        r[rindex] = 0x00;
                        paddr = TranslateVM(rs1, VM_WRITE);
                        if (paddr == -1) break;
                        Write32(paddr, rs2);
                        break;

                    default:
                        //message.Debug("Error in Atomic Memory Instruction " + utils.ToHex(ins) + " not found");
                        //message.Abort();
                        abort();
                        break;

                }
                break;

            case 0x0F:
                // fence
                break;

            default:
                if ((ins&3) != 3)
                {
                    //DebugMessage("Error in safecpu: Compressed Instruction " + utils.ToHex(ins&0xFFFF) + " not supported at "+utils.ToHex(this.pc-4));
                    DebugMessage(8);
                } else
                {
                    //DebugMessage("Error in safecpu: Instruction " + utils.ToHex(ins) + " not found at "+utils.ToHex(this.pc-4));
                    DebugMessage(9);
                }
                abort();
                break;

        }

      } while(steps--);

    return 0;
}
