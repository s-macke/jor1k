typedef signed int int32;
typedef signed short int int16;
typedef signed char int8;
typedef unsigned int uint32;
typedef unsigned short int uint16;
typedef unsigned char uint8;

// exports

extern void  abort();
extern void  DebugMessage(int32 messageid);
extern int32 Read32(int32 p);
extern uint16 Read16(int32 p);
extern uint8 Read8(int32 p);
extern void  Write32(int32 p, int32 x);
extern void  Write16(int32 p, uint16 x);
extern void  Write8(int32 p, uint8 x);

// imports
void  AnalyzeImage();
void  Reset();
void  Init();
void  Reset();
void  InvalidateTLB();
int32 GetStat();
int32 GetTimeToNextInterrupt();
void  ProgressTime(int32 delta);
int32 GetTicks();
void  AnalyzeImage();
void  SetFlags(int32 x);
int32 GetFlags();
void  RaiseInterrupt(int32 line, int32 cpuid);
void  ClearInterrupt(int32 line, int32 cpuid);
int32 Step(int32 steps, int32 clockspeed);

// constants
#define ERROR_SETFLAGS_LITTLE_ENDIAN            0 // "Little endian is not supported"
#define ERROR_SETFLAGS_CONTEXT_ID               1 // "Context ID is not supported"
#define ERROR_SETFLAGS_PREFIX                   2 // "exception prefix not supported"
#define ERROR_SETFLAGS_DELAY_SLOT               3 // "delay slot exception not supported"
#define ERROR_SETSPR_DIRECT_INTERRUPT_EXCEPTION 4 // Error in SetSPR: Direct triggering of interrupt exception not supported?
#define ERROR_SETSPR_INTERRUPT_ADDRESS          5 // Error in SetSPR: interrupt address not supported
#define ERROR_SETSPR_TIMER_MODE_NOT_CONTINUOUS  6 // "Error in SetSPR: Timer mode other than continuous not supported"
#define ERROR_EXCEPTION_UNKNOWN                 7 // "Error in Exception: exception type not supported"
#define ERROR_UNKNOWN                           8

// special purpose register index
#define SPR_UPR        1 // unit present register
#define SPR_SR        17 // supervision register
#define SPR_EEAR_BASE 48 // exception ea register
#define SPR_EPCR_BASE 32 // exception pc register
#define SPR_ESR_BASE  64 // exception sr register
#define SPR_IMMUCFGR   4 // Instruction MMU Configuration register
#define SPR_DMMUCFGR   3 // Data MMU Configuration register
#define SPR_ICCFGR     6 // Instruction Cache configuration register
#define SPR_DCCFGR     5 // Data Cache Configuration register
#define SPR_VR         0 // Version register

// exception types and addresses
#define EXCEPT_ITLBMISS 0xA00 // instruction translation lookaside buffer miss
#define EXCEPT_IPF      0x400 // instruction page fault
#define EXCEPT_RESET    0x100 // reset the processor
#define EXCEPT_DTLBMISS 0x900 // data translation lookaside buffer miss
#define EXCEPT_DPF      0x300 // instruction page fault
#define EXCEPT_BUSERR   0x200 // wrong memory access
#define EXCEPT_TICK     0x500 // tick counter interrupt
#define EXCEPT_INT      0x800 // interrupt of external devices
#define EXCEPT_SYSCALL  0xC00 // syscall, jump into supervisor mode
#define EXCEPT_TRAP     0xE00 // trap

static int32 *r = (int32*)0;
static float *f = (float*)0;

// memory
static int8*  ramb = (int8*)0x100000;
static int16* ramh = (int16*)0x100000;
static int32* ramw = (int32*)0x100000;

static int32 *group0p = (int32*)0x2000; // special purpose registers
static int32 *group1p = (int32*)0x4000; // data tlb registers
static int32 *group2p = (int32*)0x6000; // instruction tlb registers

// define global variables
typedef struct
{
    int32 pc;
    int32 ppc;
    int32 ppcorigin;
    int32 pcbase; // helper variable to calculate the real pc
    int32 fence; // the ppc pointer to the next jump or page boundary
    int32 delayedins; // the current instruction is an delayed instruction, one cycle before a jump

    int32 delayedins_at_page_boundary; //flag

    int32 nextpc; // pointer to the next instruction after the fence
    int32 jump; // in principle the jump variable should contain the same as nextpc.
                    // But for delayed ins at page boundaries, this is taken as temporary
                    // storage for nextpc

    // fast tlb lookup tables, invalidate
    int32 instlblookup;
    int32 read32tlblookup;
    int32 read8stlblookup;
    int32 read8utlblookup;
    int32 read16stlblookup;
    int32 read16utlblookup;
    int32 write32tlblookup;
    int32 write8tlblookup;
    int32 write16tlblookup;

    int32 instlbcheck;
    int32 read32tlbcheck;
    int32 read8stlbcheck;
    int32 read8utlbcheck;
    int32 read16stlbcheck;
    int32 read16utlbcheck;
    int32 write32tlbcheck;
    int32 write8tlbcheck;
    int32 write16tlbcheck;

    int32 EA; // hidden register for atomic lwa and swa operation

    uint32 TTMR; // Tick timer mode register
    uint32 TTCR; // Tick timer count register

    uint32 PICMR; // interrupt controller mode register (use nmi)
    uint32 PICSR; // interrupt controller set register

    // flags
    int32 SR_SM; // supervisor mode
    int32 SR_TEE; // tick timer Exception Enabled
    int32 SR_IEE; // interrupt Exception Enabled
    int32 SR_DCE; // Data Cache Enabled
    int32 SR_ICE; // Instruction Cache Enabled
    int32 SR_DME; // Data MMU Enabled
    int32 SR_IME; // Instruction MMU Enabled
    int32 SR_LEE; // Little Endian Enabled
    int32 SR_CE; // CID Enabled ?
    int32 SR_F; // Flag for l.sf... instructions
    int32 SR_CY; // Carry Flag
    int32 SR_OV; // Overflow Flag
    int32 SR_OVE; // Overflow Flag Exception
    int32 SR_DSX; // Delay Slot Exception
    int32 SR_EPH; // Exception Prefix High
    int32 SR_FO; // Fixed One, always set
    int32 SR_SUMRA; // SPRS User Mode Read Access, or TRAP exception disable?
    int32 SR_CID; // Context ID

    int32 boot_dtlb_misshandler_address;
    int32 boot_itlb_misshandler_address;
    int32 current_pgd;

    int32 raise_interrupt;
    int32 doze;
} global;
static global *g = (global*)0x1000;

void Exception(int32 excepttype, int32 addr);

void Init()
{
    AnalyzeImage();
    Reset();
}

void Reset()
{
    g->TTMR = 0x0;
    g->TTCR = 0x0;
    g->PICMR = 0x3;
    g->PICSR = 0x0;
    g->raise_interrupt = 0;
    g->doze = 0;

    group0p[SPR_IMMUCFGR] = 0x18; // 0 ITLB has one way and 64 sets
    group0p[SPR_DMMUCFGR] = 0x18; // 0 DTLB has one way and 64 sets
    group0p[SPR_ICCFGR] = 0x48;
    group0p[SPR_DCCFGR] = 0x48;
    group0p[SPR_VR] = 0x12000001;

    // UPR present
    // data mmu present
    // instruction mmu present
    // PIC present (architecture manual seems to be wrong here)
    // Tick timer present
    group0p[SPR_UPR] = 0x619;

    g->ppc = 0;
    g->ppcorigin = 0;
    g->pcbase = -4;

    Exception(EXCEPT_RESET, 0x0);
}

void InvalidateTLB()
{
    g->instlblookup     = -1;
    g->read32tlblookup  = -1;
    g->read8stlblookup  = -1;
    g->read8utlblookup  = -1;
    g->read16stlblookup = -1;
    g->read16utlblookup = -1;
    g->write32tlblookup = -1;
    g->write8tlblookup  = -1;
    g->write16tlblookup = -1;
    g->instlbcheck      = -1;
    g->read32tlbcheck   = -1;
    g->read8stlbcheck   = -1;
    g->read8utlbcheck   = -1;
    g->read16stlbcheck  = -1;
    g->read16utlbcheck  = -1;
    g->write32tlbcheck  = -1;
    g->write8tlbcheck   = -1;
    g->write16tlbcheck  = -1;
}

int32 GetStat()
{
    return (uint32)g->pc >> 2;
}

int32 GetTimeToNextInterrupt()
{
    int32 delta = 0x0;
    if ((g->TTMR >> 30) == 0) return -1;
    delta = (g->TTMR & 0xFFFFFFF) - (g->TTCR & 0xFFFFFFF);
    return delta;
}

void ProgressTime(int32 delta)
{
    g->TTCR += delta;
}

int32 GetTicks()
{
    if ((g->TTMR >> 30) == 0) return -1;
    return g->TTCR & 0xFFFFFFF;
}

// get addresses for fast refill
void AnalyzeImage()
{
    g->boot_dtlb_misshandler_address = ramw[0x900 >> 2];
    g->boot_itlb_misshandler_address = ramw[0xA00 >> 2];
    g->current_pgd = ((ramw[0x2010 >> 2]&0xFFF)<<16) | (ramw[0x2014 >> 2] & 0xFFFF);
}


void SetFlags(int32 x)
{
    g->SR_SM = (x & (1 << 0));
    g->SR_TEE = (x & (1 << 1));
    g->SR_IEE = (x & (1 << 2));
    g->SR_DCE = (x & (1 << 3));
    g->SR_ICE = (x & (1 << 4));
    g->SR_DME = (x & (1 << 5));
    g->SR_IME = (x & (1 << 6));
    g->SR_LEE = (x & (1 << 7));
    g->SR_CE = (x & (1 << 8));
    g->SR_F = (x & (1 << 9));
    g->SR_CY = (x & (1 << 10));
    g->SR_OV = (x & (1 << 11));
    g->SR_OVE = (x & (1 << 12));
    g->SR_DSX = (x & (1 << 13));
    g->SR_EPH = (x & (1 << 14));
    g->SR_FO = 1;
    g->SR_SUMRA = (x & (1 << 16));
    g->SR_CID = (x >> 28) & 0xF;

    if (g->SR_LEE)
    {
        DebugMessage(ERROR_SETFLAGS_LITTLE_ENDIAN|0);
        abort();
    }
    if (g->SR_CID)
    {
        DebugMessage(ERROR_SETFLAGS_CONTEXT_ID|0);
        abort();
    }
    if (g->SR_EPH)
    {
        DebugMessage(ERROR_SETFLAGS_PREFIX|0);
        abort();
    }
    if (g->SR_DSX)
    {
        DebugMessage(ERROR_SETFLAGS_DELAY_SLOT|0);
        abort();
    }
}


int32 GetFlags()
{
    int32 x = 0x0;
    x = x | (g->SR_SM ? (1 << 0) : 0);
    x = x | (g->SR_TEE ? (1 << 1) : 0);
    x = x | (g->SR_IEE ? (1 << 2) : 0);
    x = x | (g->SR_DCE ? (1 << 3) : 0);
    x = x | (g->SR_ICE ? (1 << 4) : 0);
    x = x | (g->SR_DME ? (1 << 5) : 0);
    x = x | (g->SR_IME ? (1 << 6) : 0);
    x = x | (g->SR_LEE ? (1 << 7) : 0);
    x = x | (g->SR_CE ? (1 << 8) : 0);
    x = x | (g->SR_F ? (1 << 9) : 0);
    x = x | (g->SR_CY ? (1 << 10) : 0);
    x = x | (g->SR_OV ? (1 << 11) : 0);
    x = x | (g->SR_OVE ? (1 << 12) : 0);
    x = x | (g->SR_DSX ? (1 << 13) : 0);
    x = x | (g->SR_EPH ? (1 << 14) : 0);
    x = x | (g->SR_FO ? (1 << 15) : 0);
    x = x | (g->SR_SUMRA ? (1 << 16) : 0);
    x = x | (g->SR_CID << 28);
    return x;
}

void CheckForInterrupt()
{
    g->raise_interrupt = g->PICMR & g->PICSR;
}

void RaiseInterrupt(int32 line, int32 cpuid)
{
    int32 lmask = 1 << line;
    g->PICSR = g->PICSR | lmask;
    CheckForInterrupt();
}

void ClearInterrupt(int32 line, int32 cpuid)
{
    g->PICSR &= ~(1 << line);
    g->raise_interrupt = g->PICMR & g->PICSR;
}

void SetSPR(int32 idx, int32 x)
{
    int32 address = 0;
    int32 group = 0;
    address = (idx & 0x7FF);
    group = (idx >> 11) & 0x1F;

    switch (group|0)
    {
    case 0:
        if ((address|0) == (SPR_SR|0)) {
            SetFlags(x);
        }
        group0p[address] = x;
        break;
    case 1:
        // Data MMU
        group1p[address] = x;
        break;
    case 2:
        // ins MMU
        group2p[address] = x;
        break;
    case 3:
        // data cache, not supported
    case 4:
        // ins cache, not supported
        break;
    case 8:
        g->doze = 0x1; // doze mode
        break;
    case 9:
        // pic
        switch (address) {
        case 0:
            g->PICMR = x | 0x3; // we use non maskable interrupt here
            // check immediate for interrupt
            CheckForInterrupt();
            if (g->SR_IEE) {
                if (g->raise_interrupt) {
                    DebugMessage(ERROR_SETSPR_DIRECT_INTERRUPT_EXCEPTION);
                    abort();
                }
            }
            break;
        case 2: // PICSR
            break;
        default:
            DebugMessage(ERROR_SETSPR_INTERRUPT_ADDRESS);
            abort();
        }
        break;
    case 10:
        //tick timer
        switch (address) {
        case 0:
            g->TTMR = x;
            if (((g->TTMR >> 30)&3) != 0x3) {
                DebugMessage(ERROR_SETSPR_TIMER_MODE_NOT_CONTINUOUS);
                abort();
            }
            break;
        case 1:
            g->TTCR = x;
            break;
        default:
            //DebugMessage("Error in SetSPR: Tick timer address not supported");
            DebugMessage(ERROR_UNKNOWN);
            abort();
            break;
        }
        break;

    default:
        DebugMessage(ERROR_UNKNOWN);
        abort();
        break;
    }
}

int32 GetSPR(int32 idx)
{
    int32 address = idx & 0x7FF;
    int32 group = (idx >> 11) & 0x1F;
    switch (group)
    {
    case 0:
        if (address == SPR_SR) return GetFlags();
        return group0p[address];
    case 1:
        return group1p[address];
    case 2:
        return group2p[address];
    case 8:
        return 0x0;
    case 9:
        // pic
        switch (address)
        {
        case 0:
            return g->PICMR;
        case 2:
            return g->PICSR;
        default:
            //DebugMessage("Error in GetSPR: PIC address unknown");
            DebugMessage(ERROR_UNKNOWN);
            abort();
            break;
        }
        break;

    case 10:
        // tick Timer
        switch (address)
        {
        case 0:
            return g->TTMR;
        case 1:
            return g->TTCR; // or clock
        default:
            DebugMessage(ERROR_UNKNOWN);
            //DebugMessage("Error in GetSPR: Tick timer address unknown");
            abort();
            break;
        }
        break;
    default:
        DebugMessage(ERROR_UNKNOWN);
        //DebugMessage("Error in GetSPR: group unknown");
        abort();
        break;
    }
    return 0;
}

void Exception(int32 excepttype, int32 addr)
{
    int32 except_vector = excepttype | (g->SR_EPH ? 0xf0000000 : 0x0);

    SetSPR(SPR_EEAR_BASE, addr);
    SetSPR(SPR_ESR_BASE, GetFlags());

    g->EA = -1;
    g->SR_OVE = 0;
    g->SR_SM = 1;
    g->SR_IEE = 0;
    g->SR_TEE = 0;
    g->SR_DME = 0;

    g->instlblookup = 0;
    g->read32tlblookup = 0;
    g->read8stlblookup = 0;
    g->read8utlblookup = 0;
    g->read16stlblookup = 0;
    g->read16utlblookup = 0;
    g->write32tlblookup = 0;
    g->write8tlblookup = 0;
    g->write16tlblookup = 0;
    g->instlbcheck = 0;
    g->read32tlbcheck = 0;
    g->read8utlbcheck = 0;
    g->read8stlbcheck = 0;
    g->read16utlbcheck = 0;
    g->read16stlbcheck = 0;
    g->write32tlbcheck = 0;
    g->write8tlbcheck = 0;
    g->write16tlbcheck = 0;

    g->fence = g->ppc;
    g->nextpc = except_vector;

    switch (excepttype) {

    case 0x100: // EXCEPT_RESET
        break;

    case 0x300: // EXCEPT_DPF
    case 0x900: // EXCEPT_DTLBMISS
    case 0xE00: // EXCEPT_TRAP
    case 0x200: // EXCEPT_BUSERR
        g->pc = g->pcbase + g->ppc;
        SetSPR(SPR_EPCR_BASE, g->pc - (g->delayedins ? 4 : 0));
        break;

    case 0xA00: // EXCEPT_ITLBMISS
    case 0x400: // EXCEPT_IPF
    case 0x500: // EXCEPT_TICK
    case 0x800: // EXCEPT_INT
        // per definition, the pc must be valid here
        SetSPR(SPR_EPCR_BASE, g->pc - (g->delayedins ? 4 : 0));
        break;

    case 0xC00: // EXCEPT_SYSCALL
        g->pc = g->pcbase + g->ppc;
        SetSPR(SPR_EPCR_BASE, g->pc + 4 - (g->delayedins ? 4 : 0));
        break;

    default:
        DebugMessage(ERROR_EXCEPTION_UNKNOWN);
        abort();
    }
    g->delayedins = 0;
    g->delayedins_at_page_boundary = 0;
    g->SR_IME = 0;
}


// disassembled dtlb miss exception handler arch/openrisc/kernel/head.S, kernel dependent
int32 DTLBRefill(int32 addr, int32 nsets)
{
    addr = addr;
    nsets = nsets;
    int32 r2 = 0;
    int32 r3 = 0;
    int32 r4 = 0;
    int32 r5 = 0;
    if (ramw[0x900 >> 2] == g->boot_dtlb_misshandler_address)
    {
        Exception(EXCEPT_DTLBMISS, addr);
        return 0;
    }
    r2 = addr;
    // get_current_PGD  using r3 and r5
    r3 = ramw[g->current_pgd >> 2]; // current pgd
    r4 = ((uint32)r2 >> 0x18) << 2;
    r5 = r4 + r3;

    r4 = (0x40000000 + r5) & 0xFFFFFFFF; //r4 = phys(r5)

    r3 = ramw[r4 >> 2];

    if (r3 == 0)
    {
        Exception(EXCEPT_DPF, addr);
        return 0;
        // abort();
        // d_pmd_none:
        // page fault
    }

    //r3 = r3 & ~PAGE_MASK // 0x1fff // sense? delayed jump???
    r3 = 0xffffe000;
    // d_pmd_good:

    r4 = ramw[r4 >> 2]; // get pmd value
    r4 = r4 & r3; // & PAGE_MASK
    r5 = (uint32)r2 >> 0xD;
    r3 = r5 & 0x7FF;
    r3 = r3 << 0x2;
    r3 = r3 + r4|0;
    r2 = ramw[r3 >> 2];

    if ((r2 & 1) == 0)
    {
        Exception(EXCEPT_DPF, addr);
        return 0;
        //d_pmd_none:
        //page fault
    }
    //r3 = 0xFFFFe3fa; // PAGE_MASK | DTLB_UP_CONVERT_MASK

    // fill dtlb tr register
    r4 = r2 & 0xFFFFe3fa;
    //r6 = (group0[SPR_DMMUCFGR] & 0x1C) >>> 0x2;
    //r3 = 1 << r6; // number of DMMU sets
    //r6 = r3 - 1; // mask register
    //r5 &= r6;
    r5 = r5 & (nsets - 1);
    group1p[0x280 | r5] = r4;
    //SPR_DTLBTR_BASE(0)|r5 = r4 // SPR_DTLBTR_BASE = 0x280 * (WAY*0x100)

    // fill DTLBMR register
    r2 = addr;
    r4 = r2 & 0xFFFFE000;
    r4 = r4 | 0x1;
    group1p[0x200 | r5] = r4;
    // SPR_DTLBMR_BASE(0)|r5 = r4  // SPR_DTLBMR_BASE = 0x200 * (WAY*0x100)
    return 1;
}

// disassembled itlb miss exception handler arch/openrisc/kernel/head.S, kernel dependent
int32 ITLBRefill(int32 addr, int32 nsets)
{
    int32 r2 = 0;
    int32 r3 = 0;
    int32 r4 = 0;
    int32 r5 = 0;
    if (ramw[0xA00 >> 2] == g->boot_itlb_misshandler_address) {
        Exception(EXCEPT_ITLBMISS, addr);
        return 0;
    }

    r2 = addr;
    // get_current_PGD  using r3 and r5
    r3 = ramw[g->current_pgd >> 2]; // current pgd
    r4 = ((uint32)r2 >> 0x18) << 2;
    r5 = r4 + r3;

    r4 = (0x40000000 + r5) & 0xFFFFFFFF; //r4 = phys(r5)
    r3 = ramw[r4 >> 2];

    if ((r3|0) == 0) {
        Exception(EXCEPT_IPF, addr);
        return 0;
        // d_pmd_none:
        // page fault
    }

    //r3 = r3 & ~PAGE_MASK // 0x1fff // sense? delayed jump???
    r3 = 0xffffe000; // or 0xffffe3fa ??? PAGE_MASK
    //i_pmd_good:

    r4 = ramw[r4 >> 2]; // get pmd value
    r4 = r4 & r3; // & PAGE_MASK
    r5 = (uint32)r2 >> 0xD;
    r3 = r5 & 0x7FF;
    r3 = r3 << 0x2;
    r3 = r3 + r4;
    r2 = ramw[r3 >> 2];

    if ((r2 & 1) == 0)
    {
        Exception(EXCEPT_IPF, addr);
        return 0;
        //d_pmd_none:
        //page fault
    }
    //r3 = 0xFFFFe03a; // PAGE_MASK | ITLB_UP_CONVERT_MASK

    // fill dtlb tr register
    r4 = r2 & 0xFFFFe03a; // apply the mask
    r3 = r2 & 0x7c0; // PAGE_EXEC, Page_SRE, PAGE_SWE, PAGE_URE, PAGE_UWE

    if (r3 != 0x0)
    {
        //not itlb_tr_fill....
        //r6 = (group0[SPR_IMMUCFGR] & 0x1C) >>> 0x2;
        //r3 = 1 << r6; // number of DMMU sets
        //r6 = r3 - 1; // mask register
        //r5 &= r6;
        r5 = r5 & (nsets - 1);
        //itlb_tr_fill_workaround:
        r4 = r4 | 0xc0; // SPR_ITLBTR_UXE | ITLBTR_SXE
    }
    // itlb_tr_fill:

    group2p[0x280 | r5] = r4; // SPR_ITLBTR_BASE(0)|r5 = r4 // SPR_ITLBTR_BASE = 0x280 * (WAY*0x100)

    //fill ITLBMR register
    r2 = addr;
    // r3 =
    r4 = r2 & 0xFFFFE000;
    r4 = r4 | 0x1;
    group2p[0x200 | r5] = r4; // SPR_DTLBMR_BASE(0)|r5 = r4  // SPR_DTLBMR_BASE = 0x200 * (WAY*0x100)
    return 1;
}


int32 DTLBLookup(int32 addr, int32 write)
{
    int32 setindex = 0;
    int32 tlmbr = 0;
    int32 tlbtr = 0;
    if (!g->SR_DME)
    {
        return addr;
    }
    // pagesize is 8192 bytes
    // nways are 1
    // nsets are 64

    setindex = (addr >> 13) & 63; // check these values
    tlmbr = group1p[0x200 | setindex]; // match register

    if ((tlmbr & 1) == 0)
    {
        // use tlb refill to fasten up
        if (DTLBRefill(addr, 64))
        {
            tlmbr = group1p[0x200 + setindex];
        } else
        {
            return -1;
        }
        // slow version
        // Exception(EXCEPT_DTLBMISS, addr);
        // return -1;
    }
    if ((tlmbr >> 19) != (addr >> 19))
    {
        // use tlb refill to fasten up
        if (DTLBRefill(addr, 64))
        {
            tlmbr = group1p[0x200 + setindex];
        } else
        {
            return -1;
        }
        // slow version
        // Exception(EXCEPT_DTLBMISS, addr);
        // return -1;
    }

    // skipped this check
        // set lru
    //    if (tlmbr & 0xC0) {
    //        DebugMessage("Error: LRU ist not supported");
    //        abort();
    //    }

    tlbtr = group1p[0x280 | setindex]; // translate register

    // Test for page fault
    // Skip this to be faster

    // check if supervisor mode
    if (g->SR_SM)
    {
        if (!write)
        {
            if (!(tlbtr & 0x100))
            {
                Exception(EXCEPT_DPF, addr);
                return -1;
            }
        } else
        {
            if (!(tlbtr & 0x200))
            {
                Exception(EXCEPT_DPF, addr);
                return -1;
            }
        }
    } else
    {
        if (!write)
        {
            if (!(tlbtr & 0x40))
            {
                Exception(EXCEPT_DPF, addr);
                return -1;
            }
        } else
        {
            if (!(tlbtr & 0x80))
            {
                Exception(EXCEPT_DPF, addr);
                return -1;
            }
        }
    }
    return (tlbtr & 0xFFFFE000) | (addr & 0x1FFF);
}


int32 Step(int32 steps, int32 clockspeed)
{
    int32 ins = 0x0;
    int32 imm = 0x0;
    int32 i = 0;
    int32 rindex = 0x0;
    int32 rA = 0x0,
          rB = 0x0,
          rD = 0x0;
    int32 vaddr = 0x0; // virtual address
    int32 paddr = 0x0; // physical address

    // to get the instruction
    int32 setindex = 0x0;
    int32 tlmbr = 0x0;
    int32 tlbtr = 0x0;
    int32 delta = 0x0;

    int32 dsteps = -1; // small counter
// -----------------------------------------------------

    for(;;)
    {
        if (g->ppc != g->fence)
        {

        ins = ramw[g->ppc >> 2];
        g->ppc += 4;

// --------------------------------------------

        switch ((ins >> 26)&0x3F)
        {

        case 0x0:
            // j
            g->pc = g->pcbase + g->ppc;
            g->jump = g->pc + ((ins << 6) >> 4);
            if (g->fence == g->ppc) // delayed instruction directly at page boundary
            {
                g->delayedins_at_page_boundary = 1;
            } else
            {
                g->fence = g->ppc + 4;
                g->nextpc = g->jump;
            }
            g->delayedins = 1;
            continue;

        case 0x1:
            // jal
            g->pc = g->pcbase + g->ppc;
            g->jump = g->pc + ((ins << 6) >> 4);
            r[9] = g->pc + 8;
            if (g->fence == g->ppc) // delayed instruction directly at page boundary
            {
                g->delayedins_at_page_boundary = 1;
            } else
            {
                g->fence = g->ppc + 4;
                g->nextpc = g->jump;
            }
            g->delayedins = 1;
            continue;

        case 0x3:
            // bnf
            if (g->SR_F) continue;
            g->pc = g->pcbase + g->ppc;
            g->jump = g->pc + ((ins << 6) >> 4);
            if (g->fence == g->ppc) // delayed instruction directly at page boundary
            {
                g->delayedins_at_page_boundary = 1;
            } else
            {
                g->fence = g->ppc + 4;
                g->nextpc = g->jump;
            }
            g->delayedins = 1;
            continue;

        case 0x4:
            // bf
            if (!g->SR_F) continue;
            g->pc = g->pcbase + g->ppc;
            g->jump = g->pc + ((ins << 6) >> 4);
            if (g->fence == g->ppc) // delayed instruction directly at page boundary
            {
                g->delayedins_at_page_boundary = 1;
            } else
            {
                g->fence = g->ppc + 4;
                g->nextpc = g->jump;
            }
            g->delayedins = 1;
            continue;

        case 0x5:
            // nop
            continue;

        case 0x6:
            // movhi
            rindex = (ins >> 21) & 0x1F;
            r[rindex] = ((ins & 0xFFFF) << 16); // movhi
            continue;

        case 0x8:
            //sys and trap
            if ((ins&0xFFFF0000) == 0x21000000)
            {
                Exception(EXCEPT_TRAP, group0p[SPR_EEAR_BASE]);
            } else
            {
                Exception(EXCEPT_SYSCALL, group0p[SPR_EEAR_BASE]);
            }
            continue;

        case 0x9:
            // rfe
            g->jump = GetSPR(SPR_EPCR_BASE);
            InvalidateTLB();
            g->fence = g->ppc;
            g->nextpc = g->jump;
            //g->pc = g->jump; // set the correct pc in case of an EXCEPT_INT
            //g->delayedins = 0;
            SetFlags(GetSPR(SPR_ESR_BASE)); // could raise an exception
            continue;

        case 0x11:
            // jr
            g->jump = r[(ins >> 11) & 0x1F];
            if (g->fence == g->ppc) // delayed instruction directly at page boundary
            {
                g->delayedins_at_page_boundary = 1;
            } else
            {
                g->fence = g->ppc + 4;
                g->nextpc = g->jump;
            }
            g->delayedins = 1;
            continue;

        case 0x12:
            // jalr
            g->pc = g->pcbase + g->ppc;
            g->jump = r[(ins >> 11) & 0x1F];
            r[9] = g->pc + 8;
            if (g->fence == g->ppc) // delayed instruction directly at page boundary
            {
                g->delayedins_at_page_boundary = 1;
            } else
            {
                g->fence = g->ppc + 4;
                g->nextpc = g->jump;
            }
            g->delayedins = 1;
            continue;

        case 0x1B:
            // lwa
            vaddr = r[(ins >> 16) & 0x1F] + ((ins << 16) >> 16);
            if ((g->read32tlbcheck ^ vaddr) >> 13)
            {
                paddr = DTLBLookup(vaddr, 0);
                if (paddr == -1)
                {
                    break;
                }
                g->read32tlbcheck = vaddr;
                g->read32tlblookup = ((paddr^vaddr) >> 13) << 13;
            }
            paddr = g->read32tlblookup ^ vaddr;
            g->EA = paddr;
            r[(ins >> 21) & 0x1F] = paddr>0?ramw[paddr >> 2]:Read32(paddr);
            continue;

        case 0x21:
            // lwz
            vaddr = r[(ins >> 16) & 0x1F] + ((ins << 16) >> 16);
            if ((g->read32tlbcheck ^ vaddr) >> 13) {
                paddr = DTLBLookup(vaddr, 0);
                if (paddr == -1) {
                    break;
                }
                g->read32tlbcheck = vaddr;
                g->read32tlblookup = ((paddr^vaddr) >> 13) << 13;
            }
            paddr = g->read32tlblookup ^ vaddr;
            r[(ins >> 21) & 0x1F] = paddr>0?ramw[paddr >> 2]:Read32(paddr);
            continue;

        case 0x23:
            // lbz
            vaddr = r[(ins >> 16) & 0x1F] + ((ins << 16) >> 16);
            if ((g->read8utlbcheck ^ vaddr) >> 13) {
                paddr = DTLBLookup(vaddr, 0);
                if (paddr == -1) {
                    break;
                }
                g->read8utlbcheck = vaddr;
                g->read8utlblookup = ((paddr^vaddr) >> 13) << 13;
            }
            paddr = g->read8utlblookup ^ vaddr;
            if (paddr >= 0) {
                r[(ins >> 21) & 0x1F] = (uint8)ramb[paddr ^ 3];
            } else {
                r[(ins >> 21) & 0x1F] = (uint8)Read8(paddr);
            }
            continue;

        case 0x24:
            // lbs
            vaddr = r[(ins >> 16) & 0x1F] + ((ins << 16) >> 16);
            if ((g->read8stlbcheck ^ vaddr) >> 13)
            {
                paddr = DTLBLookup(vaddr, 0);
                if (paddr == -1)
                {
                    break;
                }
                g->read8stlbcheck = vaddr;
                g->read8stlblookup = ((paddr^vaddr) >> 13) << 13;
            }
            paddr = g->read8stlblookup ^ vaddr;
            if (paddr >= 0)
            {
                r[(ins >> 21) & 0x1F] = (int8)ramb[(paddr ^ 3)];
            } else
            {
                r[(ins >> 21) & 0x1F] = (int8)Read8(paddr);
            }
            continue;

        case 0x25:
            // lhz
            vaddr = r[(ins >> 16) & 0x1F] + ((ins << 16) >> 16);
            if ((g->read16utlbcheck ^ vaddr) >> 13)
            {
                paddr = DTLBLookup(vaddr, 0);
                if (paddr == -1)
                {
                    break;
                }
                g->read16utlbcheck = vaddr;
                g->read16utlblookup = ((paddr^vaddr) >> 13) << 13;
            }
            paddr = g->read16utlblookup ^ vaddr;
            if (paddr >= 0)
            {
                r[(ins >> 21) & 0x1F] = (uint16)ramh[(paddr ^ 2) >> 1];
            } else
            {
                r[(ins >> 21) & 0x1F] = (uint16)Read16(paddr);
            }
            continue;

        case 0x26:
            // lhs
            vaddr = r[(ins >> 16) & 0x1F] + ((ins << 16) >> 16);
            if ((g->read16stlbcheck ^ vaddr) >> 13)
            {
                paddr = DTLBLookup(vaddr, 0);
                if (paddr == -1)
                {
                    break;
                }
                g->read16stlbcheck = vaddr;
                g->read16stlblookup = ((paddr^vaddr) >> 13) << 13;
            }
            paddr = g->read16stlblookup ^ vaddr;
            if (paddr >= 0)
            {
                r[(ins >> 21) & 0x1F] = (int16)ramh[(paddr ^ 2) >> 1];
            } else
            {
                r[(ins >> 21) & 0x1F] = (int16)Read16(paddr);
            }
            continue;

        case 0x27:
            // addi signed
            rA = r[(ins >> 16) & 0x1F];
            rindex = (ins >> 21) & 0x1F;
            r[rindex] = rA + ((ins << 16) >> 16);
            g->SR_CY = (uint32)r[rindex] < (uint32)rA;
            continue;

        case 0x28:
            // addi with carry
            rA = r[(ins >> 16) & 0x1F];
            rindex = (ins >> 21) & 0x1F;
            r[rindex] = (rA + ((ins << 16) >> 16)) + (g->SR_CY?1:0);
            if (g->SR_CY)
            {
                g->SR_CY = ((uint32)r[rindex]) <= ((uint32)rA);
            } else
            {
                g->SR_CY = ((uint32)r[rindex]) < ((uint32)rA);
            }
            continue;

        case 0x29:
            // andi
            r[(ins >> 21) & 0x1F] = r[(ins >> 16) & 0x1F] & (ins & 0xFFFF);
            continue;

        case 0x2A:
            // ori
            r[(ins >> 21) & 0x1F] = r[(ins >> 16) & 0x1F] | (ins & 0xFFFF);
            continue;

        case 0x2B:
            // xori
            rA = r[(ins >> 16) & 0x1F];
            r[(ins >> 21) & 0x1F] = rA ^ ((ins << 16) >> 16);
            continue;

        case 0x2C:
            // muli
            rA = r[(ins >> 16) & 0x1F];
            r[(ins >> 21) & 0x1F] = rA * ((ins << 16) >> 16);
            break;

        case 0x2D:
            // mfspr
            r[(ins >> 21) & 0x1F] = GetSPR(r[(ins >> 16) & 0x1F] | (ins & 0xFFFF));
            continue;

        case 0x2E:
            switch ((ins >> 6) & 0x3)
            {
            case 0:
                // slli
                r[(ins >> 21) & 0x1F] = r[(ins >> 16) & 0x1F] << (ins & 0x1F);
                continue;
            case 1:
                // rori
                r[(ins >> 21) & 0x1F] = (uint32)r[(ins >> 16) & 0x1F] >> (ins & 0x1F);
                continue;
            case 2:
                // srai
                r[(ins >> 21) & 0x1F] = r[(ins >> 16) & 0x1F] >> (ins & 0x1F);
                continue;
            default:
                DebugMessage(ERROR_UNKNOWN);
                //DebugMessage("Error: opcode 2E function not implemented");
                abort();
                break;
            }
            break;

        case 0x2F:
            // sf...i
            imm = (ins << 16) >> 16;
            rindex = (ins >> 16) & 0x1F;
            switch ((ins >> 21) & 0x1F)
            {
            case 0x0:
                // sfnei
                g->SR_F = r[rindex] == imm;
                continue;
            case 0x1:
                // sfnei
                g->SR_F = r[rindex] != imm;
                continue;
            case 0x2:
                // sfgtui
                g->SR_F = ((uint32)r[rindex]) > ((uint32)imm);
                continue;
            case 0x3:
                // sfgeui
                g->SR_F = ((uint32)r[rindex]) >= ((uint32)imm);
                continue;
            case 0x4:
                // sfltui
                g->SR_F = ((uint32)r[rindex]) < ((uint32)imm);
                continue;
            case 0x5:
                // sfleui
                g->SR_F = ((uint32)r[rindex]) <= ((uint32)imm);
                continue;
            case 0xa:
                // sfgtsi
                g->SR_F = r[rindex] > imm;
                continue;
            case 0xb:
                // sfgesi
                g->SR_F = r[rindex] >= imm;
                continue;
            case 0xc:
                // sfltsi
                g->SR_F = r[rindex] < imm;
                continue;
            case 0xd:
                // sflesi
                g->SR_F = r[rindex] <= imm;
                continue;
            default:
                //DebugMessage("Error: sf...i not supported yet");
                DebugMessage(ERROR_UNKNOWN);
                abort();
                break;
            }
            break;

        case 0x30:
            // mtspr
            imm = (ins & 0x7FF) | ((ins >> 10) & 0xF800);
            //pc = g->pcbase + g->ppc|0;
            SetSPR(r[(ins >> 16) & 0x1F] | imm, r[(ins >> 11) & 0x1F]); // can raise an interrupt

            if (g->doze) // doze
            {
                g->doze = 0x0;
                //message.Debug('Doze ' + g->raise_interrupt);

                if (g->TTMR & (1 << 28))
                if (g->SR_TEE)
                {
                    Exception(EXCEPT_TICK, group0p[SPR_EEAR_BASE]);
                    continue;
                }

                if (g->SR_IEE)
                if (g->raise_interrupt)
                {
                    Exception(EXCEPT_INT, group0p[SPR_EEAR_BASE]);
                    continue;
                }

                return steps;

//                if ((g->raise_interrupt|0) == 0)
//                if ((g->TTMR & (1 << 28)) == 0) {
//                    return steps|0;
//                }
            }
            continue;

       case 0x32:
            // floating point
            rA = (ins >> 16) & 0x1F;
            rB = (ins >> 11) & 0x1F;
            rD = (ins >> 21) & 0x1F;

            switch (ins & 0xFF)
            {
            case 0x0:
                // lf.add.s
                f[rD] = f[rA] + f[rB];
                continue;
            case 0x1:
                // lf.sub.s
                f[rD] = f[rA] - f[rB];
                continue;
            case 0x2:
                // lf.mul.s
                f[rD] = f[rA] * f[rB];
                continue;
            case 0x3:
                // lf.div.s
                f[rD] = f[rA] / f[rB];
                continue;
            case 0x4:
                // lf.itof.s
                f[rD] = r[rA];
                continue;
            case 0x5:
                // lf.ftoi.s
                r[rD] = f[rA];
                continue;
            case 0x7:
                // lf.madd.s
                f[rD] = f[rD] + f[rA] * f[rB];
                continue;
            case 0x8:
                // lf.sfeq.s
                g->SR_F = f[rA] == f[rB];
                continue;
            case 0x9:
                // lf.sfne.s
                g->SR_F = f[rA] != f[rB];
                continue;
            case 0xa:
                // lf.sfgt.s
                g->SR_F = f[rA] > f[rB];
                continue;
            case 0xb:
                // lf.sfge.s
                g->SR_F = f[rA] >= f[rB];
                continue;
            case 0xc:
                // lf.sflt.s
                g->SR_F = f[rA] < f[rB];
                continue;
            case 0xd:
                // lf.sfle.s
                g->SR_F = f[rA] <= f[rB];
                continue;
            default:
                DebugMessage(ERROR_UNKNOWN);
                abort();
                break;
            }
            break;

        case 0x33:
            // swa
            imm = ((((ins >> 10) & 0xF800) | (ins & 0x7FF)) << 16) >> 16;
            vaddr = r[(ins >> 16) & 0x1F] + imm;
            if ((g->write32tlbcheck ^ vaddr) >> 13)
            {
                paddr = DTLBLookup(vaddr, 1);
                if (paddr == -1)
                {
                    break;
                }
                g->write32tlbcheck = vaddr;
                g->write32tlblookup = ((paddr^vaddr) >> 13) << 13;
            }
            paddr = g->write32tlblookup ^ vaddr;
            g->SR_F = (paddr == g->EA)?1:0;
            g->EA = -1;
            if (g->SR_F == 0)
            {
                break;
            }
            if (paddr > 0)
            {
                ramw[paddr >> 2] = r[(ins >> 11) & 0x1F];
            } else
            {
                Write32(paddr, r[(ins >> 11) & 0x1F]);
            }
            continue;

        case 0x35:
            // sw
            imm = ((((ins >> 10) & 0xF800) | (ins & 0x7FF)) << 16) >> 16;
            vaddr = r[(ins >> 16) & 0x1F] + imm;
            if ((g->write32tlbcheck ^ vaddr) >> 13)
            {
                paddr = DTLBLookup(vaddr, 1);
                if (paddr == -1)
                {
                    break;
                }
                g->write32tlbcheck = vaddr;
                g->write32tlblookup = ((paddr^vaddr) >> 13) << 13;
            }
            paddr = g->write32tlblookup ^ vaddr;
            if (paddr > 0)
            {
                ramw[paddr >> 2] = r[(ins >> 11) & 0x1F];
            } else
            {
                Write32(paddr, r[(ins >> 11) & 0x1F]);
            }
            continue;

        case 0x36:
            // sb
            imm = ((((ins >> 10) & 0xF800) | (ins & 0x7FF)) << 16) >> 16;
            vaddr = r[(ins >> 16) & 0x1F] + imm;
            if ((g->write8tlbcheck ^ vaddr) >> 13) {
                paddr = DTLBLookup(vaddr, 1);
                if (paddr == -1)
                {
                    break;
                }
                g->write8tlbcheck = vaddr;
                g->write8tlblookup = ((paddr^vaddr) >> 13) << 13;
            }
            paddr = g->write8tlblookup ^ vaddr;
            if (paddr > 0)
            {
                // consider that the data is saved in little endian
                ramb[paddr ^ 3] = r[(ins >> 11) & 0x1F];
            } else
            {
                Write8(paddr, r[(ins >> 11) & 0x1F]&0xFF);
            }
            continue;

        case 0x37:
            // sh
            imm = ((((ins >> 10) & 0xF800) | (ins & 0x7FF)) << 16) >> 16;
            vaddr = r[(ins >> 16) & 0x1F] + imm;
            if ((g->write16tlbcheck ^ vaddr) >> 13)
            {
                paddr = DTLBLookup(vaddr, 1);
                if (paddr == -1)
                {
                    break;
                }
                g->write16tlbcheck = vaddr;
                g->write16tlblookup = ((paddr^vaddr) >> 13) << 13;
            }
            paddr = g->write16tlblookup ^ vaddr;
            if (paddr >= 0)
            {
                ramh[(paddr ^ 2) >> 1] = r[(ins >> 11) & 0x1F];
            } else
            {
                Write16(paddr, r[(ins >> 11) & 0x1F]);
            }
            continue;

        case 0x38:
            // three operands commands
            rA = r[(ins >> 16) & 0x1F];
            rB = r[(ins >> 11) & 0x1F];
            rindex = (ins >> 21) & 0x1F;
            switch (ins & 0x3CF) {

            case 0x0:
                // add
                r[rindex] = rA + rB;
                g->SR_CY = ((uint32)r[rindex]) < ((uint32)rA);
                continue;

            case 0x1:
                // add with carry
                r[rindex] = rA + rB + (g->SR_CY?1:0);
                if (g->SR_CY)
                {
                    g->SR_CY = ((uint32)r[rindex]) <= ((uint32)rA);
                } else
                {
                    g->SR_CY = ((uint32)r[rindex]) < ((uint32)rA);
                }
                continue;

            case 0x2:
                // sub signed
                r[rindex] = rA - rB;
                g->SR_CY = ((uint32)rB) > ((uint32)rA);
                continue;
            case 0x3:
                // and
                r[rindex] = rA & rB;
                continue;
            case 0x4:
                // or
                r[rindex] = rA | rB;
                continue;
            case 0x5:
                // or
                r[rindex] = rA ^ rB;
                continue;
            case 0x8:
                // sll
                r[rindex] = rA << (rB & 0x1F);
                continue;
            case 0xc:
                // exths
                r[rindex] = (rA << 16) >> 16;
                continue;
            case 0xe:
                // cmov
                r[rindex] = g->SR_F?rA:rB;
                continue;
            case 0x48:
                // srl not signed
                r[rindex] = (uint32)rA >> (rB & 0x1F);
                continue;
            case 0x4c:
                // extbs
                r[rindex] = (rA << 24) >> 24;
                continue;
            case 0xf:
                // ff1
                r[rindex] = 0;
                for (i = 0; i < 32; i++)
                {
                    if (rA & (1 << i))
                    {
                        r[rindex] = i + 1;
                        break;
                    }
                }
                continue;
            case 0x88:
                // sra signed
                r[rindex] = rA >> (rB & 0x1F);
                // be carefull here and check
                continue;
            case 0x10f:
                // fl1
                r[rindex] = 0;
                for (i = 31; i >= 0; i--)
                {
                    if (rA & (1 << i))
                    {
                        r[rindex] = i + 1;
                        break;
                    }
                }
                continue;

            case 0x306:
                // mul signed (specification seems to be wrong)
                r[rindex] = rA * rB;
                continue;

            case 0x30a:
                // divu (specification seems to be wrong)
                g->SR_OV = rB == 0;
                if (!g->SR_OV) {
                    r[rindex] = ((uint32)rA) / ((uint32)rB);
                }
                continue;

            case 0x309:
                // div (specification seems to be wrong)
                g->SR_OV = rB == 0;
                if (!g->SR_OV)
                {
                    r[rindex] = rA / rB;
                }
                continue;

            default:
                //DebugMessage("Error: op38 opcode not supported yet");
                DebugMessage(ERROR_UNKNOWN);
                abort();
                break;
            }
            break;

        case 0x39:
            // sf....
            switch ((ins >> 21) & 0x1F)
            {
            case 0x0:
                // sfeq
                g->SR_F = r[(ins >> 16) & 0x1F] == r[(ins >> 11) & 0x1F];
                continue;
            case 0x1:
                // sfne
                g->SR_F = r[(ins >> 16) & 0x1F] != r[(ins >> 11) & 0x1F];
                continue;
            case 0x2:
                // sfgtu
                g->SR_F = ((uint32)r[(ins >> 16) & 0x1F]) > ((uint32)r[(ins >> 11) & 0x1F]);
                continue;
            case 0x3:
                // sfgeu
                g->SR_F = ((uint32)r[(ins >> 16) & 0x1F]) >= ((uint32)r[(ins >> 11) & 0x1F]);
                continue;
            case 0x4:
                // sfltu
                g->SR_F = ((uint32)r[(ins >> 16) & 0x1F]) < ((uint32)r[(ins >> 11) & 0x1F]);
                continue;
            case 0x5:
                // sfleu
                g->SR_F = ((uint32)r[(ins >> 16) & 0x1F]) <= ((uint32)r[(ins >> 11) & 0x1F]);
                continue;
            case 0xa:
                // sfgts
                g->SR_F = r[(ins >> 16) & 0x1F] > r[(ins >> 11) & 0x1F];
                continue;
            case 0xb:
                // sfges
                g->SR_F = r[(ins >> 16) & 0x1F] >= r[(ins >> 11) & 0x1F];
                continue;
            case 0xc:
                // sflts
                g->SR_F = r[(ins >> 16) & 0x1F] < r[(ins >> 11) & 0x1F];
                continue;
            case 0xd:
                // sfles
                g->SR_F = r[(ins >> 16) & 0x1F] <= r[(ins >> 11) & 0x1F];
                continue;
            default:
                //DebugMessage("Error: sf.... function supported yet");
                DebugMessage(ERROR_UNKNOWN);
                abort();
            }
            break;

        default:
            //DebugMessage("Error: Instruction with opcode " + utils.ToHex(ins >>> 26) + " not supported");
            DebugMessage(ERROR_UNKNOWN);
            abort();
            break;
        }

        } else { // fence

            g->pc = g->nextpc;

            if (!g->delayedins_at_page_boundary)
            {
                g->delayedins = 0;
            }

            dsteps = dsteps - ((g->ppc - g->ppcorigin) >> 2);

            // do this not so often
            if (dsteps < 0)
            if (!g->delayedins_at_page_boundary) // for now. Not sure if we need this
            {
                dsteps = dsteps + 64;
                steps = steps - 64;
                if (steps < 0) return 0x0; // return to main loop

                // ---------- TICK ----------
                // timer enabled
                if ((g->TTMR >> 30) != 0)
                {
                    delta = (g->TTMR & 0xFFFFFFF) - (g->TTCR & 0xFFFFFFF);
                    //if (delta < 0) message.Debug("" + (TTCR & 0xFFFFFFF) + " " + SR_TEE + " " + (TTMR & 0xFFFFFFF) + " " + (TTMR >> 28));
                    g->TTCR += clockspeed;
                    if (delta <= clockspeed)
                    {
                        // if interrupt enabled
                        if (g->TTMR & (1 << 29))
                        {
                            g->TTMR = g->TTMR | (1 << 28); // set pending interrupt
                        }
                    }
                }

                // check if pending and check if interrupt must be triggered
                if (g->TTMR & (1 << 28))
                {
                    if (g->SR_TEE)
                    {
                        Exception(EXCEPT_TICK, group0p[SPR_EEAR_BASE]);
                        // treat exception directly here
                        g->pc = g->nextpc;
                    }
                }

            } // dsteps

            if (g->SR_IEE)
            if (g->raise_interrupt) {
                Exception(EXCEPT_INT, group0p[SPR_EEAR_BASE]);
                g->pc = g->nextpc;
            }

            // Get Instruction Fast version
            if ((g->instlbcheck ^ g->pc) & 0xFFFFE000) // short check if it is still the correct page
            {
                g->instlbcheck = g->pc; // save the new page, lower 11 bits are ignored
                if (!g->SR_IME) {
                    g->instlblookup = 0x0;
                } else {
                    setindex = (g->pc >> 13) & 63; // check this values
                    tlmbr = group2p[0x200 | setindex];
                    // test if tlmbr is valid
                    if ((tlmbr & 1) == 0)
                    {
                        if (ITLBRefill(g->pc, 64))
                        {
                            tlmbr = group2p[0x200 | setindex]; // reload the new value
                        } else
                        {
                            // just make sure he doesn't count this 'continue' as steps
                            g->ppcorigin = g->ppc;
                            g->delayedins_at_page_boundary = 0;
                            continue;
                        }
                    }
                    if ((tlmbr >> 19) != (g->pc >> 19))
                    {
                        if (ITLBRefill(g->pc, 64))
                        {
                            tlmbr = group2p[0x200 | setindex]; // reload the new value
                        } else
                        {
                            // just make sure he doesn't count this 'continue' as steps
                            g->ppcorigin = g->ppc;
                            g->delayedins_at_page_boundary = 0;
                            continue;
                        }
                    }
                    tlbtr = group2p[0x280 | setindex];
                    g->instlblookup = ((tlbtr ^ tlmbr) >> 13) << 13;
                }
            }

            // set pc and set the correcponding physical pc pointer
            g->ppc = g->instlblookup ^ g->pc;
            g->ppcorigin = g->ppc;
            g->pcbase = g->pc - 4 - g->ppcorigin;

            if (g->delayedins_at_page_boundary)
            {
                g->delayedins_at_page_boundary = 0;
                g->fence = g->ppc + 4;
                g->nextpc = g->jump;
            } else
            {
                g->fence  = ((g->ppc >> 13) + 1) << 13; // next page
                g->nextpc = ((g->pc  >> 13) + 1) << 13;
            }

        } // fence

    } // main loop

    return steps;
}
