
function FastCPU(stdlib, foreign, heap) {
"use asm";

//var imul = stdlib.Math.imul;
var imul = foreign.imul;
var floor = stdlib.Math.floor;
var DebugMessage = foreign.DebugMessage;
var abort = foreign.abort;
var ReadMemory32 = foreign.ReadMemory32;
var WriteMemory32 = foreign.WriteMemory32;
var ReadMemory16 = foreign.ReadMemory16;
var WriteMemory16 = foreign.WriteMemory16;
var ReadMemory8 = foreign.ReadMemory8;
var WriteMemory8 = foreign.WriteMemory8;

var ERROR_SETFLAGS_LITTLE_ENDIAN = 0; // "Little endian is not supported"
var ERROR_SETFLAGS_CONTEXT_ID = 1; // "Context ID is not supported"
var ERROR_SETFLAGS_PREFIX = 2; // "exception prefix not supported"
var ERROR_SETFLAGS_DELAY_SLOT = 3; // "delay slot exception not supported"
var ERROR_SETSPR_DIRECT_INTERRUPT_EXCEPTION = 4; //Error in SetSPR: Direct triggering of interrupt exception not supported?
var ERROR_SETSPR_INTERRUPT_ADDRESS = 5; //Error in SetSPR: interrupt address not supported
var ERROR_SETSPR_TIMER_MODE_NOT_CONTINUOUS = 6; //"Error in SetSPR: Timer mode other than continuous not supported"
var ERROR_EXCEPTION_UNKNOWN = 7;        // "Error in Exception: exception type not supported"
var ERROR_UNKNOWN = 8;
// special purpose register index

var SPR_UPR = 1; // unit present register
var SPR_SR = 17; // supervision register
var SPR_EEAR_BASE = 48; // exception ea register
var SPR_EPCR_BASE = 32; // exception pc register
var SPR_ESR_BASE = 64; // exception sr register
var SPR_IMMUCFGR = 4; // Instruction MMU Configuration register
var SPR_DMMUCFGR = 3; // Data MMU Configuration register
var SPR_ICCFGR = 6; // Instruction Cache configuration register
var SPR_DCCFGR = 5; // Data Cache Configuration register
var SPR_VR = 0; // Version register

// exception types and addresses
var EXCEPT_ITLBMISS = 0xA00; // instruction translation lookaside buffer miss
var EXCEPT_IPF = 0x400; // instruction page fault
var EXCEPT_RESET = 0x100; // reset the processor
var EXCEPT_DTLBMISS = 0x900; // data translation lookaside buffer miss
var EXCEPT_DPF = 0x300; // instruction page fault
var EXCEPT_BUSERR = 0x200; // wrong memory access
var EXCEPT_TICK = 0x500; // tick counter interrupt
var EXCEPT_INT = 0x800; // interrupt of external devices
var EXCEPT_SYSCALL = 0xc00; // syscall, jump into supervisor mode


var r = new stdlib.Int32Array(heap); // registers
var f = new stdlib.Float32Array(heap); // registers
var h = new stdlib.Int32Array(heap);
var b = new stdlib.Uint8Array(heap);


var rp = 0x0; // pointer to registers, not used
var ramp = 0x10000;

var group0p = 0x2000; // special purpose registers
var group1p = 0x6000; // data tlb registers
var group2p = 0xA000; // instruction tlb registers

// define variables and initialize
var pc = 0x0; // instruction pointer in multiples of four
var nextpc = 0x0; // pointer to next instruction in multiples of four
var delayedins = 0; // the current instruction is an delayed instruction, one cycle before a jump

// fast tlb lookup tables, invalidate
var instlblookup = -1;
var read32tlblookup = -1;
var read8stlblookup = -1;
var read8utlblookup = -1;
var write32tlblookup = -1;
var write8tlblookup = -1;

var instlbcheck = -1;
var read32tlbcheck = -1;
var read8stlbcheck = -1;
var read8utlbcheck = -1;
var write32tlbcheck = -1;
var write8tlbcheck = -1;


var TTMR = 0x0; // Tick timer mode register
var TTCR = 0x0; // Tick timer count register

var PICMR = 0x3; // interrupt controller mode register (use nmi)
var PICSR = 0x0; // interrupt controller set register

// flags
var SR_SM = 1; // supervisor mode
var SR_TEE = 0; // tick timer Exception Enabled
var SR_IEE = 0; // interrupt Exception Enabled
var SR_DCE = 0; // Data Cache Enabled
var SR_ICE = 0; // Instruction Cache Enabled
var SR_DME = 0; // Data MMU Enabled
var SR_IME = 0; // Instruction MMU Enabled
var SR_LEE = 0; // Little Endian Enabled
var SR_CE = 0; // CID Enabled ?
var SR_F = 0; // Flag for l.sf... instructions 
var SR_CY = 0; // Carry Flag
var SR_OV = 0; // Overflow Flag
var SR_OVE = 0; // Overflow Flag Exception
var SR_DSX = 0; // Delay Slot Exception
var SR_EPH = 0; // Exception Prefix High
var SR_FO = 1; // Fixed One, always set
var SR_SUMRA = 0; // SPRS User Mode Read Access, or TRAP exception disable?
var SR_CID = 0x0; //Context ID

var boot_dtlb_misshandler_address = 0x0;
var boot_itlb_misshandler_address = 0x0;
var current_pgd = 0x0;

function Init() {
    AnalyzeImage();
    Reset();
}

function Reset() {
    TTMR = 0x0;
    TTCR = 0x0;
    PICMR = 0x3;
    PICSR = 0x0;

    h[group0p+(SPR_IMMUCFGR<<2) >> 2] = 0x18|0; // 0 ITLB has one way and 64 sets
    h[group0p+(SPR_DMMUCFGR<<2) >> 2] = 0x18|0; // 0 DTLB has one way and 64 sets
    Exception(EXCEPT_RESET, 0x0); // set pc values
    pc = nextpc|0;
    nextpc = nextpc + 1|0;
}

function InvalidateTLB() {
    instlblookup = -1;
    read32tlblookup = -1;
    read8stlblookup = -1;
    read8utlblookup = -1;
    write32tlblookup = -1;
    write8tlblookup = -1;
    instlbcheck = -1;
    read32tlbcheck = -1;
    read8stlbcheck = -1;
    read8utlbcheck = -1;
    write32tlbcheck = -1;
    write8tlbcheck = -1;
}


function GetStat() {
    return pc|0;
}

function PutState() {
    pc = h[(0x100 + 0) >> 2]|0;
    nextpc = h[(0x100 + 4) >> 2]|0;
    delayedins = h[(0x100 + 8) >> 2]|0;
    TTMR = h[(0x100 + 16) >> 2]|0;
    TTCR = h[(0x100 + 20) >> 2]|0;
    PICMR = h[(0x100 + 24) >> 2]|0;
    PICSR = h[(0x100 + 28) >> 2]|0;
    boot_dtlb_misshandler_address = h[(0x100 + 32) >> 2]|0;
    boot_itlb_misshandler_address = h[(0x100 + 36) >> 2]|0;
    current_pgd = h[(0x100 + 40) >> 2]|0;
}

function GetState() {
    h[(0x100 + 0) >> 2] = pc|0;
    h[(0x100 + 4) >> 2] = nextpc|0;
    h[(0x100 + 8) >> 2] = delayedins|0;
    h[(0x100 + 12) >> 2] = 0;
    h[(0x100 + 16) >> 2] = TTMR|0;
    h[(0x100 + 20) >> 2] = TTCR|0;
    h[(0x100 + 24) >> 2] = PICMR|0;
    h[(0x100 + 28) >> 2] = PICSR|0;
    h[(0x100 + 32) >> 2] = boot_dtlb_misshandler_address|0;
    h[(0x100 + 36) >> 2] = boot_itlb_misshandler_address|0;
    h[(0x100 + 40) >> 2] = current_pgd|0;
}

function GetTimeToNextInterrupt() {
    var delta = 0x0;
    if ((TTMR >> 30) == 0) return -1;    
    delta = (TTMR & 0xFFFFFFF) - (TTCR & 0xFFFFFFF) |0;
    if ((delta|0) < 0) {
        delta = delta + 0xFFFFFFF | 0;
    }    
    return delta|0;
}

function ProgressTime(delta) {
    delta = delta|0;
    TTCR = (TTCR + delta)|0;
}

function AnalyzeImage() { // get addresses for fast refill
    boot_dtlb_misshandler_address = h[ramp+0x900 >> 2]|0;
    boot_itlb_misshandler_address = h[ramp+0xA00 >> 2]|0;
    current_pgd = ((h[ramp+0x2010 >> 2]&0xFFF)<<16) | (h[ramp+0x2014 >> 2] & 0xFFFF)|0;
}


function SetFlags(x) {
    x = x|0;
    var old_SR_IEE = 0;
    old_SR_IEE = SR_IEE;
    SR_SM = (x & (1 << 0));
    SR_TEE = (x & (1 << 1));
    SR_IEE = (x & (1 << 2));
    SR_DCE = (x & (1 << 3));
    SR_ICE = (x & (1 << 4));
    SR_DME = (x & (1 << 5));
    SR_IME = (x & (1 << 6));
    SR_LEE = (x & (1 << 7));
    SR_CE = (x & (1 << 8));
    SR_F = (x & (1 << 9));
    SR_CY = (x & (1 << 10));
    SR_OV = (x & (1 << 11));
    SR_OVE = (x & (1 << 12));
    SR_DSX = (x & (1 << 13));
    SR_EPH = (x & (1 << 14));
    SR_FO = 1;
    SR_SUMRA = (x & (1 << 16));
    SR_CID = (x >> 28) & 0xF;

    if (SR_LEE) {
        DebugMessage(ERROR_SETFLAGS_LITTLE_ENDIAN|0);
        abort();
    }
    if (SR_CID) {
        DebugMessage(ERROR_SETFLAGS_CONTEXT_ID|0);
        abort();
    }
    if (SR_EPH) {
        DebugMessage(ERROR_SETFLAGS_PREFIX|0);
        abort();
    }
    if (SR_DSX) {
        DebugMessage(ERROR_SETFLAGS_DELAY_SLOT|0);
        abort();
    }
    if (SR_IEE) {
        if ((old_SR_IEE|0) == (0|0)) {
            CheckForInterrupt();
        }
    }
}

function GetFlags() {
    var x = 0x0;
    x = x | (SR_SM ? (1 << 0) : 0);
    x = x | (SR_TEE ? (1 << 1) : 0);
    x = x | (SR_IEE ? (1 << 2) : 0);
    x = x | (SR_DCE ? (1 << 3) : 0);
    x = x | (SR_ICE ? (1 << 4) : 0);
    x = x | (SR_DME ? (1 << 5) : 0);
    x = x | (SR_IME ? (1 << 6) : 0);
    x = x | (SR_LEE ? (1 << 7) : 0);
    x = x | (SR_CE ? (1 << 8) : 0);
    x = x | (SR_F ? (1 << 9) : 0);
    x = x | (SR_CY ? (1 << 10) : 0);
    x = x | (SR_OV ? (1 << 11) : 0);
    x = x | (SR_OVE ? (1 << 12) : 0);
    x = x | (SR_DSX ? (1 << 13) : 0);
    x = x | (SR_EPH ? (1 << 14) : 0);
    x = x | (SR_FO ? (1 << 15) : 0);
    x = x | (SR_SUMRA ? (1 << 16) : 0);
    x = x | (SR_CID << 28);
    return x|0;
}

function CheckForInterrupt() {
    if (!SR_IEE) {
        return;
    }
    if (PICMR & PICSR) {
        // DebugMessage("raise interrupt " + hex8(PICMR & PICSR));
        Exception(EXCEPT_INT, h[group0p + (SPR_EEAR_BASE<<2)>>2]|0);
        pc = nextpc;
        nextpc = nextpc + 1|0;
    }
}

function RaiseInterrupt(line) {

    line = line|0;
    var lmask = 0;
    lmask = (1 << (line))|0;
/*
    if (this.PICSR & lmask) {
        // Interrupt already signaled and pending
        // DebugMessage("Warning: Int pending, ignored");
    }
*/
    PICSR = PICSR | lmask;
    CheckForInterrupt();
}

function ClearInterrupt(line) {
    line = line|0;
    PICSR = PICSR & (~(1 << line));
}


function SetSPR(idx, x) {
    idx = idx|0;
    x = x|0;
    var address = 0;
    var group = 0;
    address = (idx & 0x7FF);
    group = (idx >> 11) & 0x1F;

    switch (group|0) {
    case 1:
        // Data MMU
        h[group1p+(address<<2) >> 2] = x;
        return;
    case 2:
        // ins MMU
        h[group2p+(address<<2) >> 2] = x;
        return;
    case 3:
        // data cache, not supported
    case 4:
        // ins cache, not supported
        return;
    case 9:
        // pic
        switch (address|0) {
        case 0:
            PICMR = x | 0x3; // we use non maskable interrupt here
            // check immediate for interrupt
            if (SR_IEE) {
                if (PICMR & PICSR) {
                    DebugMessage(ERROR_SETSPR_DIRECT_INTERRUPT_EXCEPTION|0);
                    abort();
                }
            }
            break;
        case 2:
            PICSR = x;
            break;
        default:
            DebugMessage(ERROR_SETSPR_INTERRUPT_ADDRESS|0);
            abort();
        }
        return;
    case 10:
        //tick timer
        switch (address|0) {
        case 0:
            TTMR = x|0;
            if (((TTMR >> 30)&3) != 0x3) {
                DebugMessage(ERROR_SETSPR_TIMER_MODE_NOT_CONTINUOUS|0);
                abort();
            }
            break;
        default:
            //DebugMessage("Error in SetSPR: Tick timer address not supported");
            DebugMessage(ERROR_UNKNOWN|0);
            abort();
            break;
        }
        return;

    default:
        break;
    }

    if ((group|0) != 0) {
        //DebugMessage("Error in SetSPR: group " + group + " not found");
        DebugMessage(ERROR_UNKNOWN|0);
        abort();
    }

    switch (address|0) {
    case 17: // SPR_SR
        SetFlags(x);
        break;
    case 48: // SPR_EEAR_BASE
    case 32: // SPR_EPCR_BASE
    case 64: // SPR_ESR_BASE
        h[group0p+(address<<2)>>2] = x;
        break;
    default:
        DebugMessage(ERROR_UNKNOWN|0);
        //DebugMessage("Error in SetSPR: address " + hex8(address) + " not found");
        abort();
    }
};

function GetSPR(idx) {
    idx = idx|0;
    var address = 0;
    var group = 0;
    address = idx & 0x7FF;
    group = (idx >> 11) & 0x1F;
    switch (group|0) {
    case 1:
        return h[group1p+(address<<2) >> 2]|0;

    case 2:
        return h[group2p+(address<<2) >> 2]|0;

    case 9:
        // pic
        switch (address|0) {
        case 0:
            return PICMR|0;
        case 2:
            return PICSR|0;
        default:
            //DebugMessage("Error in GetSPR: PIC address unknown");
            DebugMessage(ERROR_UNKNOWN|0);
            abort();
            break;
        }
        break;

    case 10:
        // tick Timer
        switch (address|0) {
        case 0:
            return TTMR|0;
        case 1:
            return TTCR|0; // or clock
        default:
            DebugMessage(ERROR_UNKNOWN|0);
            //DebugMessage("Error in GetSPR: Tick timer address unknown");
            abort();
            break;
        }
        break;
    default:
        break;

    }

    if ((group|0) != 0) {
        DebugMessage(ERROR_UNKNOWN|0);
        //DebugMessage("Error in GetSPR: group unknown");
        abort();
    }

    switch (idx|0) {
    case 17: // SPR_SR
        return GetFlags()|0;

    case 1: // SPR_UPR
        // UPR present
        // data mmu present
        // instruction mmu present
        // PIC present (architecture manual seems to be wrong here)
        // Tick timer present
        return 0x619|0;

    case 4: // SPR_IMMUCFGR
    case 3: // SPR_DMMUCFGR
    case 48: // SPR_EEAR_BASE
    case 32: // SPR_EEPCR_BASE
    case 64:  // SPR_ESR_BASE
        return h[group0p+(idx<<2) >> 2]|0;
    case 6: // SPR_ICCFGR
        return 0x48|0;
    case 5: // SPR_DCCFGR
        return 0x48|0;
    case 0: // SPR_VR
        return 0x12000001|0;
    default:
        DebugMessage(ERROR_UNKNOWN|0);
        //DebugMessage("Error in GetSPR: address unknown");
        abort();
    }
    return 0|0;
}

function Exception(excepttype, addr) {
    excepttype = excepttype|0;
    addr = addr|0;
    var except_vector = 0;
    except_vector = excepttype | (SR_EPH ? 0xf0000000 : 0x0);

    SetSPR(SPR_EEAR_BASE, addr);
    SetSPR(SPR_ESR_BASE, GetFlags()|0);

    SR_OVE = 0;
    SR_SM = 1;
    SR_IEE = 0;
    SR_TEE = 0;
    SR_DME = 0;

    instlblookup = 0;
    read32tlblookup = 0;
    read8stlblookup = 0;
    read8utlblookup = 0;
    write32tlblookup = 0;
    write8tlblookup = 0;
    instlbcheck = 0;
    read32tlbcheck = 0;
    read8utlbcheck = 0;
    read8stlbcheck = 0;
    write32tlbcheck = 0;
    write8tlbcheck = 0;

    nextpc = except_vector>>2;

    switch (excepttype|0) {
    case 0x100: // EXCEPT_RESET
        break;

    case 0xA00: // EXCEPT_ITLBMISS
    case 0x400: // EXCEPT_IPF
    case 0x900: // EXCEPT_DTLBMISS
    case 0x300: // EXCEPT_DPF
    case 0x200: // EXCEPT_BUSERR
    case 0x500: // EXCEPT_TICK
    case 0x800: // EXCEPT_INT
        SetSPR(SPR_EPCR_BASE, (pc<<2) - (delayedins ? 4 : 0)|0);
        break;

    case 0xC00: // EXCEPT_SYSCALL
        SetSPR(SPR_EPCR_BASE, (pc<<2) + 4 - (delayedins ? 4 : 0)|0);
        break;
    default:
        DebugMessage(ERROR_EXCEPTION_UNKNOWN|0);
        abort();
    }
    delayedins = 0;
    SR_IME = 0;
}


// disassembled dtlb miss exception handler arch/openrisc/kernel/head.S, kernel dependent
function DTLBRefill(addr, nsets) {
    addr = addr|0;
    nsets = nsets|0;
    var r2 = 0;
    var r3 = 0;
    var r4 = 0;
    var r5 = 0;
    if ((h[ramp+0x900 >> 2]|0) == (boot_dtlb_misshandler_address|0)) {
        Exception(EXCEPT_DTLBMISS, addr);
        return 0|0;
    }
    r2 = addr;
    // get_current_PGD  using r3 and r5 
    r3 = h[ramp+current_pgd >> 2]|0; // current pgd
    r4 = (r2 >>> 0x18) << 2;
    r5 = r4 + r3|0;

    r4 = (0x40000000 + r5) & 0xFFFFFFFF; //r4 = phys(r5)

    r3 = h[ramp+r4 >> 2]|0;

    if ((r3|0) == 0) {
        Exception(EXCEPT_DPF, addr);
        return 0|0;
        // abort();
        // d_pmd_none:
        // page fault
    }

    //r3 = r3 & ~PAGE_MASK // 0x1fff // sense? delayed jump???
    r3 = 0xffffe000;
    // d_pmd_good:

    r4 = h[ramp+r4 >> 2]|0; // get pmd value
    r4 = r4 & r3; // & PAGE_MASK
    r5 = r2 >>> 0xD;
    r3 = r5 & 0x7FF;
    r3 = r3 << 0x2;
    r3 = r3 + r4|0;
    r2 = h[ramp+r3 >> 2]|0;

    if ((r2 & 1) == 0) {
        Exception(EXCEPT_DPF, addr);
        return 0|0;
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
    h[group1p+((0x280 | r5)<<2) >> 2] = r4;
    //SPR_DTLBTR_BASE(0)|r5 = r4 // SPR_DTLBTR_BASE = 0x280 * (WAY*0x100)

    // fill DTLBMR register
    r2 = addr;
    r4 = r2 & 0xFFFFE000;
    r4 = r4 | 0x1;
    h[group1p+((0x200 | r5)<<2) >> 2] = r4;
    // SPR_DTLBMR_BASE(0)|r5 = r4  // SPR_DTLBMR_BASE = 0x200 * (WAY*0x100)
    return 1|0;
}

// disassembled itlb miss exception handler arch/openrisc/kernel/head.S, kernel dependent
function ITLBRefill(addr, nsets) {
    addr = addr|0;
    nsets = nsets|0;
    var r2 = 0;
    var r3 = 0;
    var r4 = 0;
    var r5 = 0;
    if ((h[ramp+0xA00 >> 2]|0) == (boot_itlb_misshandler_address|0)) {
        Exception(EXCEPT_ITLBMISS, addr);
        return 0|0;
    }

    r2 = addr;
    // get_current_PGD  using r3 and r5
    r3 = h[ramp+current_pgd >> 2]|0; // current pgd
    r4 = (r2 >>> 0x18) << 2;
    r5 = r4 + r3|0;

    r4 = (0x40000000 + r5) & 0xFFFFFFFF; //r4 = phys(r5)
    r3 = h[ramp+r4 >> 2]|0;

    if ((r3|0) == 0) {
        Exception(EXCEPT_IPF, addr);
        return 0|0;
        // d_pmd_none:
        // page fault
    }

    //r3 = r3 & ~PAGE_MASK // 0x1fff // sense? delayed jump???
    r3 = 0xffffe000; // or 0xffffe3fa ??? PAGE_MASK
    //i_pmd_good:

    r4 = h[ramp+r4 >> 2]|0; // get pmd value
    r4 = r4 & r3; // & PAGE_MASK
    r5 = r2 >>> 0xD;
    r3 = r5 & 0x7FF;
    r3 = r3 << 0x2;
    r3 = r3 + r4|0;
    r2 = h[ramp+r3 >> 2]|0;

    if ((r2 & 1) == 0) {
        Exception(EXCEPT_IPF, addr);
        return 0|0;
        //d_pmd_none:
        //page fault
    }
    //r3 = 0xFFFFe03a; // PAGE_MASK | ITLB_UP_CONVERT_MASK

    // fill dtlb tr register
    r4 = r2 & 0xFFFFe03a; // apply the mask
    r3 = r2 & 0x7c0; // PAGE_EXEC, Page_SRE, PAGE_SWE, PAGE_URE, PAGE_UWE

    if ((r3|0) != 0x0) {
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

    h[group2p + ((0x280 | r5)<<2) >> 2] = r4; // SPR_ITLBTR_BASE(0)|r5 = r4 // SPR_ITLBTR_BASE = 0x280 * (WAY*0x100)

    //fill ITLBMR register
    r2 = addr;
    // r3 = 
    r4 = r2 & 0xFFFFE000;
    r4 = r4 | 0x1;
    h[group2p + ((0x200 | r5)<<2) >> 2] = r4; // SPR_DTLBMR_BASE(0)|r5 = r4  // SPR_DTLBMR_BASE = 0x200 * (WAY*0x100)
    return 1|0;
}

function DTLBLookup(addr, write) {
    addr = addr|0;
    write = write|0;
    var setindex = 0;
    var tlmbr = 0;
    var tlbtr = 0;
    if (!SR_DME) {
        return addr|0;
    }
    // pagesize is 8192 bytes
    // nways are 1
    // nsets are 64

    setindex = (addr >> 13) & 63; // check these values
    tlmbr = h[group1p + ((0x200 | setindex) << 2) >> 2]|0; // match register
     
    if ((tlmbr & 1) == 0) {
        // use tlb refill to fasten up
        if (DTLBRefill(addr, 64)|0) {
            tlmbr = h[group1p + (0x200 + setindex << 2) >> 2]|0;
        } else {
            return -1|0;
        }
        // slow version
        // Exception(EXCEPT_DTLBMISS, addr);
        // return -1;
    }
    if ((tlmbr >> 19) != (addr >> 19)) {
        // use tlb refill to fasten up
        if (DTLBRefill(addr, 64)|0) {
            tlmbr = h[group1p + (0x200 + setindex << 2) >> 2]|0;
        } else {
            return -1|0;
        }
        // slow version
        // Exception(EXCEPT_DTLBMISS, addr);
        // return -1;
    }

    /* skipped this check
        // set lru 
        if (tlmbr & 0xC0) {
            DebugMessage("Error: LRU ist not supported");
            abort();
        }
    */
    tlbtr = h[group1p + ((0x280 | setindex)<<2) >> 2]|0; // translate register

    // Test for page fault
    // Skip this to be faster

    // check if supervisor mode
    if (SR_SM) {
        if (!write) {
            if (!(tlbtr & 0x100)) {
                Exception(EXCEPT_DPF, addr);
                return -1|0;
            }
        } else {
            if (!(tlbtr & 0x200))
            {
                Exception(EXCEPT_DPF, addr);
                return -1|0;
            }
        }
    } else {
        if (!write) {
            if (!(tlbtr & 0x40)) {
                Exception(EXCEPT_DPF, addr);
                return -1|0;
            }
        } else {
            if (!(tlbtr & 0x80))
            {
                Exception(EXCEPT_DPF, addr);
                return -1|0;
            }
        }
    }
    return ((tlbtr & 0xFFFFE000) | (addr & 0x1FFF))|0;
}

// the slow and safe version
function GetInstruction(addr) {
    addr = addr|0;
    var setindex = 0;
    var tlmbr = 0;
    var tlbtr = 0;
    if (!SR_IME) {
        return h[ramp+addr>>2]|0;
    }

    // pagesize is 8192 bytes
    // nways are 1
    // nsets are 64

    setindex = (addr & 0xFFFFE000) >>> 13; // check this values
    // at the moment we have only 64 entries in immu. Look in group0
    setindex = setindex & 63; // number of sets
    tlmbr = h[group2p + ((0x200 | setindex) << 2) >> 2]|0;

    // test if tlmbr is valid
    if ((tlmbr & 1) == 0) {
        if (ITLBRefill(addr, 64)|0) {
            tlmbr = h[group2p+((0x200 | setindex) << 2) >> 2]|0;
        } else {
            return -1|0;
        }
        //Exception(EXCEPT_ITLBMISS, pc<<2);
        //return -1;
    }

    if ((tlmbr & 0xFFF80000) != (addr & 0xFFF80000)) {
        if (ITLBRefill(addr, 64)|0) {
            tlmbr = h[group2p+((0x200 | setindex) << 2) >> 2]|0;
        } else {
            return -1|0;
        }
        //Exception(EXCEPT_ITLBMISS, pc<<2);
        //return -1;
    }

    // set lru
    if (tlmbr & 0xC0) {
        //DebugMessage("Error: LRU ist not supported");
        DebugMessage(ERROR_UNKNOWN|0);
        abort();
    }

    tlbtr = h[group2p + ((0x280 | setindex) << 2) >> 2]|0;
    //Test for page fault
    // check if supervisor mode
    if (SR_SM) {
        // check if user read enable is not set(URE)
        if (!(tlbtr & 0x40)) {
            Exception(EXCEPT_IPF, pc<<2);
            return -1|0;
        }
    } else {
        // check if supervisor read enable is not set (SRE)
        if (!(tlbtr & 0x80)) {
            Exception(EXCEPT_IPF, pc<<2);
            return -1|0;
        }
    }
    return h[ramp+((tlbtr & 0xFFFFE000) | (addr & 0x1FFF)) >> 2]  |0;
}

function Step(steps, clockspeed) {
    steps = steps|0;
    clockspeed = clockspeed|0;
    var ins = 0x0;
    var imm = 0x0;
    var i = 0;
    var rindex = 0x0;
    var rA = 0x0,
        rB = 0x0,
        rD = 0x0;
    var vaddr = 0x0; // virtual address
    var paddr = 0x0; // physical address
    
    // local variables could be faster
    //var r = r;
    //var ram = ram;
    //var int32mem = ram.int32mem;
    //var group2 = group2;

    // to get the instruction
    var setindex = 0x0;
    var tlmbr = 0x0;
    var tlbtr = 0x0;
    var jump = 0x0;
    var delta = 0x0;

    do {
        // do this not so often
        if (!(steps & 63)) {
            // ---------- TICK ----------
            // timer enabled
            if ((TTMR >> 30) != 0) {
                delta = (TTMR & 0xFFFFFFF) - (TTCR & 0xFFFFFFF) |0;
                if ((delta|0) < 0) {
                    delta = delta + 0xFFFFFFF | 0;
                }
                TTCR = (TTCR + clockspeed|0);
                if ((delta|0) < (clockspeed|0)) {
                    // if interrupt enabled
                    if (TTMR & (1 << 29)) {
                        TTMR = TTMR | (1 << 28); // set pending interrupt
                    }
                }
            }

            // check if pending and check if interrupt must be triggered
            if (TTMR & (1 << 28)) {
                if (SR_TEE) {
                    Exception(EXCEPT_TICK, h[group0p + (SPR_EEAR_BASE<<2) >> 2]|0);
                    pc = nextpc;
                    nextpc = nextpc + 1|0;
                }
            }
        }

        // Get Instruction Fast version        
        if ((instlbcheck ^ pc) >> 11) // short check if it is still the correct page
        {
            instlbcheck = pc; // save the new page, lower 11 bits are ignored
            if (!SR_IME) {
                instlblookup = 0x0;
            } else {
                setindex = (pc >> 11) & 63; // check this values
                tlmbr = h[group2p + ((0x200 | setindex) << 2) >> 2]|0;
                // test if tlmbr is valid
                if ((tlmbr & 1) == 0) {
                    if (ITLBRefill(pc<<2, 64)|0) {
                        tlmbr = h[group2p + ((0x200 | setindex)<<2) >> 2]|0; // reload the new value
                    } else {
                        pc = nextpc;
                        nextpc = nextpc + 1|0;
                        continue;
                    }
                }
                if ((tlmbr >> 19) != (pc >> 17)) {
                    if (ITLBRefill(pc<<2, 64)|0) {
                        tlmbr = h[group2p + ((0x200 | setindex)<<2) >> 2]|0; // reload the new value
                    } else {
                        pc = nextpc;
                        nextpc = nextpc + 1|0;
                        continue;
                    }
                }


                tlbtr = h[group2p + ((0x280 | setindex) << 2) >> 2]|0;
                instlblookup = ((tlbtr ^ tlmbr) >> 13) << 11;
            }
        }        
        ins = h[ramp + ((instlblookup ^ pc)<<2) >> 2]|0;
/*
        // for the slow variant
        ins = GetInstruction(pc<<2);
        if ((ins|0) == -1) {
            pc = nextpc;
            nextpc = nextpc + 1|0;
            steps = steps - 1|0;
            continue;
        }
*/

        switch ((ins >> 26)&0x3F) {
        case 0x0:
            // j
            jump = pc + ((ins << 6) >> 6)|0;
            pc = nextpc;
            nextpc = jump;
            delayedins = 1;
            steps = steps - 1|0;
            continue;

        case 0x1:
            // jal
            jump = pc + ((ins << 6) >> 6)|0;
            r[9] = (nextpc<<2) + 4;
            pc = nextpc;
            nextpc = jump;
            delayedins = 1;
            steps = steps - 1|0;
            continue;

        case 0x3:
            // bnf
            if (SR_F) {
                break;
            }
            jump = pc + ((ins << 6) >> 6)|0;
            pc = nextpc;
            nextpc = jump;
            delayedins = 1;
            steps = steps - 1|0;
            continue;
        case 0x4:
            // bf
            if (!SR_F) {
                break;
            }
            jump = pc + ((ins << 6) >> 6)|0;
            pc = nextpc;
            nextpc = jump;
            delayedins = 1;
            steps = steps - 1|0;
            continue;
        case 0x5:
            // nop
            break;
        case 0x6:
            // movhi
            rindex = (ins >> 21) & 0x1F;
            r[rindex << 2 >> 2] = ((ins & 0xFFFF) << 16); // movhi
            break;
        case 0x7:
            // halt emulator specific
            if (TTMR & (1 << 28)) break; // don't go idle if a timer interrupt is pending
            pc = nextpc;
            nextpc = nextpc + 1|0;
            delayedins = 0;
            return steps|0;
            
        break;

        case 0x8:
            //sys
            Exception(EXCEPT_SYSCALL, h[group0p+SPR_EEAR_BASE >> 2]|0);
            break;

        case 0x9:
            // rfe
            nextpc = (GetSPR(SPR_EPCR_BASE)|0)>>2;
            InvalidateTLB();
            pc = nextpc;
            nextpc = nextpc + 1|0;
            delayedins = 0;
            SetFlags(GetSPR(SPR_ESR_BASE)|0); // could raise an exception
            steps = steps - 1|0;
            continue;

        case 0x11:
            // jr
            jump = r[((ins >> 9) & 0x7C)>>2]>>2;
            pc = nextpc;
            nextpc = jump;
            delayedins = 1;
            steps = steps - 1|0;
            continue;
        case 0x12:
            // jalr
            jump = r[((ins >> 9) & 0x7C)>>2]>>2;
            r[9] = (nextpc<<2) + 4;
            pc = nextpc;
            nextpc = jump;
            delayedins = 1;
            steps = steps - 1|0;
            continue;

        case 0x1B:
        case 0x21:
            // lwa and lwz
            vaddr = (r[((ins >> 14) & 0x7C) >> 2]|0) + ((ins << 16) >> 16)|0;
            if ((read32tlbcheck ^ vaddr) >> 13) {
                paddr = DTLBLookup(vaddr, 0)|0;
                if ((paddr|0) == -1) {
                    break;
                }
                read32tlbcheck = vaddr;
                read32tlblookup = ((paddr^vaddr) >> 13) << 13;
            }
            paddr = read32tlblookup ^ vaddr;
            r[((ins >> 19) & 0x7C)>>2] = (paddr|0)>0?h[ramp+paddr >> 2]|0:ReadMemory32(paddr|0)|0;
            break;

        case 0x23:
            // lbz
            vaddr = (r[((ins >> 14) & 0x7C)>>2]|0) + ((ins << 16) >> 16)|0;
            if ((read8utlbcheck ^ vaddr) >> 13) {
                paddr = DTLBLookup(vaddr, 0)|0;
                if ((paddr|0) == -1) {
                    break;
                }
                read8utlbcheck = vaddr;
                read8utlblookup = ((paddr^vaddr) >> 13) << 13;
            }
            paddr = read8utlblookup ^ vaddr;
            if ((paddr|0) >= 0) {
                r[((ins >> 19) & 0x7C)>>2] = b[ramp + (paddr ^ 3)|0]|0;
            } else {
                r[((ins >> 19) & 0x7C)>>2] = ReadMemory8(paddr|0)|0;
            }
            break;

        case 0x24:
            // lbs 
            vaddr = (r[((ins >> 14) & 0x7C)>>2]|0) + ((ins << 16) >> 16)|0;
            if ((read8stlbcheck ^ vaddr) >> 13) {
                paddr = DTLBLookup(vaddr, 0)|0;
                if ((paddr|0) == -1) {
                    break;
                }
                read8stlbcheck = vaddr;
                read8stlblookup = ((paddr^vaddr) >> 13) << 13;
            }
            paddr = read8stlblookup ^ vaddr;
            if ((paddr|0) >= 0) {
                r[((ins >> 19) & 0x7C)>>2] = (b[ramp + (paddr ^ 3)|0] << 24) >> 24;
            } else {
                r[((ins >> 19) & 0x7C)>>2] = ((ReadMemory8(paddr|0)|0) << 24) >> 24;
            }
            break;

        case 0x25:
            // lhz 
            vaddr = (r[((ins >> 14) & 0x7C)>>2]|0) + ((ins << 16) >> 16)|0;
            paddr = DTLBLookup(vaddr, 0)|0;
            if ((paddr|0) == -1) {
                break;
            }
            if ((paddr|0) >= 0) {
                r[((ins >> 19) & 0x7C)>>2] = ((b[ramp + ((paddr ^ 2)+1)|0] << 8) | b[ramp + (paddr ^ 2)|0]);
            } else {
                r[((ins >> 19) & 0x7C)>>2] = (ReadMemory16(paddr|0)|0);
            }
            break;

        case 0x26:
            // lhs
            vaddr = (r[((ins >> 14) & 0x7C)>>2]|0) + ((ins << 16) >> 16)|0;
            paddr = DTLBLookup(vaddr, 0)|0;
            if ((paddr|0) == -1) {
                break;
            }
            if ((paddr|0) >= 0) {
                r[((ins >> 19) & 0x7C)>>2] = (((b[ramp + ((paddr ^ 2)+1)|0] << 8) | b[ramp + (paddr ^ 2)|0]) << 16) >> 16;
            } else {
                r[((ins >> 19) & 0x7C)>>2] = ((ReadMemory16(paddr|0)|0) << 16) >> 16;
            }
            break;


        case 0x27:
            // addi signed 
            imm = (ins << 16) >> 16;
            rA = r[((ins >> 14) & 0x7C)>>2]|0;
            r[((ins >> 19) & 0x7C) >> 2] = rA + imm|0;
            //rindex = ((ins >> 19) & 0x7C);
            //SR_CY = r[rindex] < rA;
            //SR_OV = (((rA ^ imm ^ -1) & (rA ^ r[rindex])) & 0x80000000)?true:false;
            //TODO overflow and carry
            // maybe wrong
            break;

        case 0x29:
            // andi
            r[((ins >> 19) & 0x7C)>>2] = r[((ins >> 14) & 0x7C)>>2] & (ins & 0xFFFF);
            break;


        case 0x2A:
            // ori
            r[((ins >> 19) & 0x7C)>>2] = r[((ins >> 14) & 0x7C)>>2] | (ins & 0xFFFF);
            break;

        case 0x2B:
            // xori            
            rA = r[((ins >> 14) & 0x7C)>>2]|0;
            r[((ins >> 19) & 0x7C)>>2] = rA ^ ((ins << 16) >> 16);
            break;

        case 0x2D:
            // mfspr
            r[((ins >> 19) & 0x7C)>>2] = GetSPR(r[((ins >> 14) & 0x7C)>>2] | (ins & 0xFFFF))|0;
            break;

        case 0x2E:
            switch ((ins >> 6) & 0x3) {
            case 0:
                // slli
                r[((ins >> 19) & 0x7C)>>2] = r[((ins >> 14) & 0x7C)>>2] << (ins & 0x1F);
                break;
            case 1:
                // rori
                r[((ins >> 19) & 0x7C)>>2] = r[((ins >> 14) & 0x7C)>>2] >>> (ins & 0x1F);
                break;
            case 2:
                // srai
                r[((ins >> 19) & 0x7C)>>2] = r[((ins >> 14) & 0x7C)>>2] >> (ins & 0x1F);
                break;
            default:
                DebugMessage(ERROR_UNKNOWN|0);
                //DebugMessage("Error: opcode 2E function not implemented");
                abort();
                break;
            }
            break;

        case 0x2F:
            // sf...i
            imm = (ins << 16) >> 16;
            switch ((ins >> 21) & 0x1F) {
            case 0x0:
                // sfnei
                SR_F = (r[((ins >> 14) & 0x7C)>>2]|0) == (imm|0);
                break;
            case 0x1:
                // sfnei
                SR_F = (r[((ins >> 14) & 0x7C)>>2]|0) != (imm|0);
                break;
            case 0x2:
                // sfgtui
                SR_F = (r[((ins >> 14) & 0x7C)>>2]>>>0) > (imm >>> 0);
                break;
            case 0x3:
                // sfgeui
                SR_F = (r[((ins >> 14) & 0x7C)>>2]>>>0) >= (imm >>> 0);
                break;
            case 0x4:
                // sfltui
                SR_F = (r[((ins >> 14) & 0x7C)>>2]>>>0) < (imm >>> 0);
                break;
            case 0x5:
                // sfleui
                SR_F = (r[((ins >> 14) & 0x7C)>>2]>>>0) <= (imm >>> 0);
                break;
            case 0xa:
                // sfgtsi
                SR_F = (r[((ins >> 14) & 0x7C)>>2]|0) > (imm|0);
                break;
            case 0xb:
                // sfgesi
                SR_F = (r[((ins >> 14) & 0x7C)>>2]|0) >= (imm|0);
                break;
            case 0xc:
                // sfltsi
                SR_F = (r[((ins >> 14) & 0x7C)>>2]|0) < (imm|0);
                break;
            case 0xd:
                // sflesi
                SR_F = (r[((ins >> 14) & 0x7C)>>2]|0) <= (imm|0);
                break;
            default:
                //DebugMessage("Error: sf...i not supported yet");
                DebugMessage(ERROR_UNKNOWN|0);
                abort();
                break;
            }
            break;

        case 0x30:
            // mtspr
            imm = (ins & 0x7FF) | ((ins >> 10) & 0xF800);
            pc = nextpc;
            nextpc = nextpc + 1|0;
            delayedins = 0;
            steps = steps - 1|0;
            SetSPR(r[((ins >> 14) & 0x7C)>>2] | imm, r[((ins >> 9) & 0x7C)>>2]|0);
            continue;

       case 0x32:
            // floating point
            rA = (ins >> 14) & 0x7C;
            rB = (ins >> 9) & 0x7C;
            rD = (ins >> 19) & 0x7C;

            switch (ins & 0xFF) {
            case 0x0:
                // lf.add.s
                f[rD >> 2] = (+f[rA >> 2]) + (+f[rB >> 2]);
                break;
            case 0x1:
                // lf.sub.s
                f[rD >> 2] = (+f[rA >> 2]) - (+f[rB >> 2]);
                break;
            case 0x2:
                // lf.mul.s
                f[rD >> 2] = (+f[rA >> 2]) * (+f[rB >> 2]);
                break;
            case 0x3:
                // lf.div.s
                f[rD >> 2] = (+f[rA >> 2]) / (+f[rB >> 2]);
                break;
            case 0x4:
                // lf.itof.s
                f[rD >> 2] = +(r[rA >> 2]|0);
                break;
            case 0x5:
                // lf.ftoi.s
                r[rD >> 2] = ~~(+floor(+f[rA >> 2]));
                break;
            case 0x7:
                // lf.madd.s
                f[rD >> 2] = (+f[rD >> 2]) + (+f[rA >> 2]) * (+f[rB >> 2]);
                break;
            case 0x8:
                // lf.sfeq.s
                SR_F = (+f[rA >> 2]) == (+f[rB >> 2]);
                break;
            case 0x9:
                // lf.sfne.s
                SR_F = (+f[rA >> 2]) != (+f[rB >> 2]);
                break;
            case 0xa:
                // lf.sfgt.s
                SR_F = (+f[rA >> 2]) > (+f[rB >> 2]);
                break;
            case 0xb:
                // lf.sfge.s
                SR_F = (+f[rA >> 2]) >= (+f[rB >> 2]);
                break;
            case 0xc:
                // lf.sflt.s
                SR_F = (+f[rA >> 2]) < (+f[rB >> 2]);
                break;
            case 0xd:
                // lf.sfle.s
                SR_F = (+f[rA >> 2]) <= (+f[rB >> 2]);
                break;
            default:
                DebugMessage(ERROR_UNKNOWN|0);
                abort();
                break;
            }
            break;

        case 0x33:
            // swa
            imm = ((((ins >> 10) & 0xF800) | (ins & 0x7FF)) << 16) >> 16;
            vaddr = (r[((ins >> 14) & 0x7C)>>2]|0) + imm|0;
            if ((write32tlbcheck ^ vaddr) >> 13) {
                paddr = DTLBLookup(vaddr, 1)|0;
                if ((paddr|0) == -1) {
                    break;
                }
                write32tlbcheck = vaddr;
                write32tlblookup = ((paddr^vaddr) >> 13) << 13;
            }
            paddr = write32tlblookup ^ vaddr;
            if ((paddr|0) > 0) {
                h[ramp + paddr >> 2] = r[((ins >> 9) & 0x7C)>>2]|0;
            } else {
                WriteMemory32(paddr|0, r[((ins >> 9) & 0x7C)>>2]|0);
            }
            SR_F = 1|0;
            break;

        case 0x35:
            // sw
            imm = ((((ins >> 10) & 0xF800) | (ins & 0x7FF)) << 16) >> 16;
            vaddr = (r[((ins >> 14) & 0x7C)>>2]|0) + imm|0;
            if ((write32tlbcheck ^ vaddr) >> 13) {
                paddr = DTLBLookup(vaddr, 1)|0;
                if ((paddr|0) == -1) {
                    break;
                }
                write32tlbcheck = vaddr;
                write32tlblookup = ((paddr^vaddr) >> 13) << 13;
            }
            paddr = write32tlblookup ^ vaddr;
            if ((paddr|0) > 0) {
                h[ramp + paddr >> 2] = r[((ins >> 9) & 0x7C)>>2]|0;
            } else {
                WriteMemory32(paddr|0, r[((ins >> 9) & 0x7C)>>2]|0);
            }
            break;

        case 0x36:
            // sb
            imm = ((((ins >> 10) & 0xF800) | (ins & 0x7FF)) << 16) >> 16;
            vaddr = (r[((ins >> 14) & 0x7C)>>2]|0) + imm|0;
            if ((write8tlbcheck ^ vaddr) >> 13) {
                paddr = DTLBLookup(vaddr, 1)|0;
                if ((paddr|0) == -1) {
                    break;
                }
                write8tlbcheck = vaddr;
                write8tlblookup = ((paddr^vaddr) >> 13) << 13;
            }
            paddr = write8tlblookup ^ vaddr;
            if ((paddr|0) > 0) {
                // consider that the data is saved in little endian
                b[ramp + (paddr ^ 3)|0] = r[((ins >> 9) & 0x7C)>>2]|0;
            } else {
                WriteMemory8(paddr|0, r[((ins >> 9) & 0x7C)>>2]|0);
            }
            break;

        case 0x37:
            // sh
            imm = ((((ins >> 10) & 0xF800) | (ins & 0x7FF)) << 16) >> 16;
            vaddr = (r[((ins >> 14) & 0x7C)>>2]|0) + imm|0;
            paddr = DTLBLookup(vaddr|0, 1)|0;
            if ((paddr|0) == -1) {
                break;
            }
            if ((paddr|0) >= 0) {
                b[ramp + ((paddr ^ 2)+1)|0] = r[((ins >> 9) & 0x7C)>>2] >> 8;
                b[ramp + (paddr ^ 2)|0] = r[((ins >> 9) & 0x7C)>>2] & 0xFF;
            } else {
                WriteMemory16(paddr|0, r[((ins >> 9) & 0x7C)>>2]|0);
            }
            break;

        case 0x38:
            // three operands commands
            rA = r[((ins >> 14) & 0x7C)>>2]|0;
            rB = r[((ins >> 9) & 0x7C)>>2]|0;
            rindex = (ins >> 19) & 0x7C;
            switch (ins & 0x3CF) {
            case 0x0:
                // add signed 
                r[rindex>>2] = rA + rB;
                //SR_CY = r[rindex] < rA;
                //SR_OV = (((rA ^ rB ^ -1) & (rA ^ r[rindex])) & 0x80000000)?true:false;
                //TODO overflow and carry
                break;
            case 0x2:
                // sub signed
                r[rindex>>2] = rA - rB;
                //TODO overflow and carry
                //SR_CY = (rB > rA);
                //SR_OV = (((rA ^ rB) & (rA ^ r[rindex])) & 0x80000000)?true:false;                
                break;
            case 0x3:
                // and
                r[rindex>>2] = rA & rB;
                break;
            case 0x4:
                // or
                r[rindex>>2] = rA | rB;
                break;
            case 0x5:
                // or
                r[rindex>>2] = rA ^ rB;
                break;
            case 0x8:
                // sll
                r[rindex>>2] = rA << (rB & 0x1F);
                break;
            case 0x48:
                // srl not signed
                r[rindex>>2] = rA >>> (rB & 0x1F);
                break;
            case 0xf:
                // ff1
                r[rindex>>2] = 0;
                for (i = 0; (i|0) < 32; i=i+1|0) {
                    if (rA & (1 << i)) {
                        r[rindex>>2] = i + 1;
                        break;
                    }
                }
                break;
            case 0x88:
                // sra signed
                r[rindex>>2] = rA >> (rB & 0x1F);
                // be carefull here and check
                break;
            case 0x10f:
                // fl1
                r[rindex>>2] = 0;
                for (i = 31; (i|0) >= 0; i=i-1|0) {
                    if (rA & (1 << i)) {
                        r[rindex>>2] = i + 1;
                        break;
                    }
                }
                break;
            case 0x306:
                // mul signed (specification seems to be wrong)
                {                    
                    // this is a hack to do 32 bit signed multiply. Seems to work but needs to be tested. 
                    //r[rindex<<2>>2] = (rA >> 0) * (rB >> 0);
                    r[rindex>>2] = imul(rA|0, rB|0)|0;
                    /*
                    var rAl = rA & 0xFFFF;
                    var rBl = rB & 0xFFFF;
                    r[rindex<<2>>2] = r[rindex<<2>>2] & 0xFFFF0000 | ((rAl * rBl) & 0xFFFF);
                    var result = Number(int32(rA)) * Number(int32(rB));
                    SR_OV = (result < (-2147483647 - 1)) || (result > (2147483647));
                    var uresult = uint32(rA) * uint32(rB);
                    SR_CY = (uresult > (4294967295));
                    */
                    
                }
                break;
            case 0x30a:
                // divu (specification seems to be wrong)
                SR_CY = (rB|0) == 0;
                SR_OV = 0;
                if (!SR_CY) {
                    r[rindex>>2] = /*Math.floor*/((rA>>>0) / (rB>>>0));
                }
                break;
            case 0x309:
                // div (specification seems to be wrong)
                SR_CY = (rB|0) == 0;
                SR_OV = 0;
                if (!SR_CY) {
                    r[rindex>>2] = (rA|0) / (rB|0);
                }

                break;
            default:
                //DebugMessage("Error: op38 opcode not supported yet");
                DebugMessage(ERROR_UNKNOWN|0);
                abort();
                break;
            }
            break;

        case 0x39:
            // sf....
            switch ((ins >> 21) & 0x1F) {
            case 0x0:
                // sfeq
                SR_F = (r[((ins >> 14) & 0x7C)>>2]|0) == (r[((ins >> 9) & 0x7C)>>2]|0);
                break;
            case 0x1:
                // sfne
                SR_F = (r[((ins >> 14) & 0x7C)>>2]|0) != (r[((ins >> 9) & 0x7C)>>2]|0);
                break;
            case 0x2:
                // sfgtu
                SR_F = ((r[((ins >> 14) & 0x7C)>>2]>>>0) > (r[((ins >> 9) & 0x7C)>>2]>>>0));
                break;
            case 0x3:
                // sfgeu
                SR_F = ((r[((ins >> 14) & 0x7C)>>2]>>>0) >= (r[((ins >> 9) & 0x7C)>>2]>>>0));
                break;
            case 0x4:
                // sfltu
                SR_F = ((r[((ins >> 14) & 0x7C)>>2]>>>0) < (r[((ins >> 9) & 0x7C)>>2]>>>0));
                break;
            case 0x5:
                // sfleu
                SR_F = ((r[((ins >> 14) & 0x7C)>>2]>>>0) <= (r[((ins >> 9) & 0x7C)>>2]>>>0));
                break;
            case 0xa:
                // sfgts
                SR_F = (r[((ins >> 14) & 0x7C)>>2]|0) > (r[((ins >> 9) & 0x7C)>>2]|0);
                break;
            case 0xb:
                // sfges
                SR_F = (r[((ins >> 14) & 0x7C)>>2]|0) >= (r[((ins >> 9) & 0x7C)>>2]|0);
                break;
            case 0xc:
                // sflts
                SR_F = (r[((ins >> 14) & 0x7C)>>2]|0) < (r[((ins >> 9) & 0x7C)>>2]|0);
                break;
            case 0xd:
                // sfles
                SR_F = (r[((ins >> 14) & 0x7C)>>2]|0) <= (r[((ins >> 9) & 0x7C)>>2]|0);
                break;
            default:
                //DebugMessage("Error: sf.... function supported yet");
                DebugMessage(ERROR_UNKNOWN|0);
                abort();
            }
            break;

        default:
            //DebugMessage("Error: Instruction with opcode " + hex8(ins >>> 26) + " not supported");
            DebugMessage(ERROR_UNKNOWN|0);
            abort();
            break;
        }
        pc = nextpc;
        nextpc = nextpc + 1|0;
        delayedins = 0;
        steps = steps - 1|0;
    } while (steps); // main loop
    return steps|0;
}

return {
    Init: Init,
    Reset: Reset,
    InvalidateTLB: InvalidateTLB,
    Step: Step,
    GetFlags: GetFlags,
    SetFlags: SetFlags,
    PutState: PutState,
    GetState: GetState,    
    GetTimeToNextInterrupt: GetTimeToNextInterrupt,
    ProgressTime: ProgressTime,
    RaiseInterrupt: RaiseInterrupt,
    ClearInterrupt: ClearInterrupt,
    AnalyzeImage: AnalyzeImage,
    GetStat : GetStat
};

}

