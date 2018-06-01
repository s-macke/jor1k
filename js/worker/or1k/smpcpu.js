var message = require('../messagehandler');

function SMPCPU(stdlib, foreign, heap) {

"use asm";

var floor = stdlib.Math.floor;
var imul = foreign.imul;
var DebugMessage = foreign.DebugMessage;
var abort = foreign.abort;
var Read32 = foreign.Read32;
var Write32 = foreign.Write32;
var Read16 = foreign.Read16;
var Write16 = foreign.Write16;
var Read8 = foreign.Read8;
var Write8 = foreign.Write8;

var ERROR_SETFLAGS_LITTLE_ENDIAN = 0; // "Little endian is not supported"
var ERROR_SETFLAGS_CONTEXT_ID = 1; // "Context ID is not supported"
var ERROR_SETFLAGS_PREFIX = 2; // "exception prefix not supported"
var ERROR_SETFLAGS_DELAY_SLOT = 3; // "delay slot exception not supported"
var ERROR_SETSPR_DIRECT_INTERRUPT_EXCEPTION = 4; //Error in SetSPR: Direct triggering of interrupt exception not supported?
var ERROR_SETSPR_INTERRUPT_ADDRESS = 5; //Error in SetSPR: interrupt address not supported
var ERROR_SETSPR_TIMER_MODE_NOT_CONTINUOUS = 6; //"Error in SetSPR: Timer mode other than continuous not supported"
var ERROR_EXCEPTION_UNKNOWN = 7;        // "Error in Exception: exception type not supported"
var ERROR_UNKNOWN = 8;
var ERROR_ALL_CORES_IDLE = 9;

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
var SPR_COREID = 128; // Core ID
var SPR_NUMCORES = 129; // Number of Cores

// exception types and addresses
var EXCEPT_ITLBMISS = 0xA00; // instruction translation lookaside buffer miss
var EXCEPT_IPF = 0x400; // instruction page fault
var EXCEPT_RESET = 0x100; // reset the processor
var EXCEPT_DTLBMISS = 0x900; // data translation lookaside buffer miss
var EXCEPT_DPF = 0x300; // instruction page fault
var EXCEPT_BUSERR = 0x200; // wrong memory access
var EXCEPT_TICK = 0x500; // tick counter interrupt
var EXCEPT_INT = 0x800; // interrupt of external devices
var EXCEPT_SYSCALL = 0xC00; // syscall, jump into supervisor mode
var EXCEPT_TRAP = 0xE00; // trap


var r = new stdlib.Int32Array(heap); // registers
var f = new stdlib.Float32Array(heap); // registers

var h = new stdlib.Int32Array(heap);
var b = new stdlib.Uint8Array(heap);
var w = new stdlib.Uint16Array(heap);

var ncores = 4; // the total number of cores
var ncoresmask = 0xF; // bitfield of actives cores mask
var activebitfield = 0xF; // 1 bit for each core defines if it is active or not

var coreid = 0; // the currently active core.
var corep = 0x0; // the memory pointer to the core related structures

var rp = 0x0; // pointer to registers, not used
var ramp = 0x100000;

var group0p = 0x2000; // special purpose registers
var group1p = 0x4000; // data tlb registers
var group2p = 0x6000; // instruction tlb registers

// define variables and initialize

var pc = 0x0;
var ppc = 0;
var ppcorigin = 0;
var pcbase = -4; // helper variable to calculate the real pc
var fence = 0; // the ppc pointer to the next jump or page boundary

var delayedins = 0; // the current instruction is an delayed instruction, one cycle before a jump

var nextpc = 0x0; // pointer to the next instruction after the fence
var jump = 0x0; // in principle the jump variable should contain the same as nextpc.
                // But for delayed ins at page boundaries, this is taken as temporary
                // storage for nextpc
var delayedins_at_page_boundary = 0; //flag


// fast tlb lookup tables, invalidate
var instlblookup = -1;
var read32tlblookup = -1;
var read8stlblookup = -1;
var read8utlblookup = -1;
var read16stlblookup = -1;
var read16utlblookup = -1;
var write32tlblookup = -1;
var write8tlblookup = -1;
var write16tlblookup = -1;

var instlbcheck = -1;
var read32tlbcheck = -1;
var read8stlbcheck = -1;
var read8utlbcheck = -1;
var read16stlbcheck = -1;
var read16utlbcheck = -1;
var write32tlbcheck = -1;
var write8tlbcheck = -1;
var write16tlbcheck = -1;

var TTMRp = 0x100; // Tick timer mode register
var TTCRp = 0x104; // Tick timer count register

var PICMRp = 0x108; // interrupt controller mode register (use nmi)
var PICSRp = 0x10C; // interrupt controller set register
var raise_interruptp = 0x110;

var linkedaddrp = 0x114; // hidden register for atomic lwa and swa operation (linked address)


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

var snoopbitfield = 0x0; // fot atomic instructions

function Init(_ncores) {
    _ncores = _ncores|0;
    ncores = _ncores|0;
    if ((ncores|0) == 32)
        ncoresmask = 0xFFFFFFFF;
    else
        ncoresmask =  (1 << ncores)-1|0;
    AnalyzeImage();
    Reset();
}

function Reset() {
    var i = 0;
    activebitfield = ncoresmask; // all cores are active
    snoopbitfield = 0x0;

    for(i=0; (i|0)<(ncores|0); i=i+1|0) {
        h[corep + TTMRp >>2] = 0x0;
        h[corep + TTCRp >>2] = 0x0;
        h[corep + PICMRp >>2] = 0x3;
        h[corep + PICSRp >>2] = 0x0;

        h[corep + group0p+(SPR_IMMUCFGR<<2) >> 2] = 0x18; // 0 ITLB has one way and 64 sets
        h[corep + group0p+(SPR_DMMUCFGR<<2) >> 2] = 0x18; // 0 DTLB has one way and 64 sets
        h[corep + group0p+(SPR_ICCFGR<<2) >> 2] = 0x0//0x48;
        h[corep + group0p+(SPR_DCCFGR<<2) >> 2] = 0x0//0x48;
        h[corep + group0p+(SPR_VR<<2) >> 2] = 0x12000001;
        h[corep + group0p+(SPR_COREID<<2) >> 2] = coreid|0;
        h[corep + group0p+(SPR_NUMCORES<<2) >> 2] = 2|0;

        // UPR present
        // data mmu present
        // instruction mmu present
        // PIC present (architecture manual seems to be wrong here)
        // Tick timer present
        h[corep + group0p+(SPR_UPR<<2) >> 2] = 0x619;

        ppc = 0;
        ppcorigin = 0;
        pcbase = -4;
        Exception(EXCEPT_RESET, 0x0);

        ChangeCore();
    }
}

function ChangeCore()
{
    var newcoreid = 0;
    var i = 0;
    if ((ncores|0) == 1) return;

    newcoreid = coreid|0;
    if ((activebitfield|0) == 0) {   
         // All cpu are idle. This should never happen in this function.
         DebugMessage(ERROR_ALL_CORES_IDLE|0);
         abort();
     }

    // check if only one bit is set in bitfield
    if ((activebitfield & activebitfield-1) == 0) 
    if (activebitfield & (1<<coreid)) { // ceck if this one bit is the current core
        return; // nothing changed, so just return back
    }

    // find next core
    do {
        newcoreid = newcoreid + 1 | 0;
        if ((newcoreid|0) >= (ncores|0)) newcoreid = 0;
    } while(((activebitfield & (1<<newcoreid))) == 0)

    if ((newcoreid|0) == (coreid|0)) return; // nothing changed, so just return back

    h[corep + 0x120 >>2] = GetFlags()|0;
    h[corep + 0x124 >>2] = pc;
    h[corep + 0x128 >>2] = ppc;
    h[corep + 0x12C >>2] = ppcorigin;
    h[corep + 0x130 >>2] = pcbase;
    h[corep + 0x134 >>2] = fence;
    h[corep + 0x138 >>2] = nextpc;
    h[corep + 0x13C >>2] = jump;
    h[corep + 0x190 >>2] = delayedins;
    h[corep + 0x194 >>2] = delayedins_at_page_boundary;


    h[corep + 0x140 >>2] = instlblookup;
    h[corep + 0x144 >>2] = read32tlblookup;
    h[corep + 0x148 >>2] = read8stlblookup;
    h[corep + 0x14C >>2] = read8utlblookup;
    h[corep + 0x150 >>2] = read16stlblookup;
    h[corep + 0x154 >>2] = read16utlblookup;
    h[corep + 0x158 >>2] = write32tlblookup;
    h[corep + 0x15C >>2] = write8tlblookup;
    h[corep + 0x160 >>2] = write16tlblookup;
    h[corep + 0x164 >>2] = instlbcheck;
    h[corep + 0x168 >>2] = read32tlbcheck;
    h[corep + 0x16C >>2] = read8stlbcheck;
    h[corep + 0x170 >>2] = read8utlbcheck;
    h[corep + 0x174 >>2] = read16stlbcheck;
    h[corep + 0x178 >>2] = read16utlbcheck;
    h[corep + 0x17C >>2] = write32tlbcheck;
    h[corep + 0x180 >>2] = write8tlbcheck;
    h[corep + 0x184 >>2] = write16tlbcheck;

    coreid = newcoreid|0;
    corep = coreid << 15;

    SetFlagsQuiet(h[corep + 0x120 >>2]|0);
    pc          = h[corep + 0x124 >>2]|0;
    ppc         = h[corep + 0x128 >>2]|0;
    ppcorigin   = h[corep + 0x12C >>2]|0;
    pcbase      = h[corep + 0x130 >>2]|0;
    fence       = h[corep + 0x134 >>2]|0;
    nextpc      = h[corep + 0x138 >>2]|0;
    jump        = h[corep + 0x13C >>2]|0;
    delayedins  = h[corep + 0x190 >>2]|0;
    delayedins_at_page_boundary  = h[corep + 0x194 >>2]|0;

    instlblookup     = h[corep + 0x140 >>2]|0;
    read32tlblookup  = h[corep + 0x144 >>2]|0;
    read8stlblookup  = h[corep + 0x148 >>2]|0;
    read8utlblookup  = h[corep + 0x14C >>2]|0;
    read16stlblookup = h[corep + 0x150 >>2]|0;
    read16utlblookup = h[corep + 0x154 >>2]|0;
    write32tlblookup = h[corep + 0x158 >>2]|0;
    write8tlblookup  = h[corep + 0x15C >>2]|0;
    write16tlblookup = h[corep + 0x160 >>2]|0;
    instlbcheck      = h[corep + 0x164 >>2]|0;
    read32tlbcheck   = h[corep + 0x168 >>2]|0;
    read8stlbcheck   = h[corep + 0x16C >>2]|0;
    read8utlbcheck   = h[corep + 0x170 >>2]|0;
    read16stlbcheck  = h[corep + 0x174 >>2]|0;
    read16utlbcheck  = h[corep + 0x178 >>2]|0;
    write32tlbcheck  = h[corep + 0x17C >>2]|0;
    write8tlbcheck   = h[corep + 0x180 >>2]|0;
    write16tlbcheck  = h[corep + 0x184 >>2]|0;
}

function InvalidateTLB() {
    instlblookup = -1;
    read32tlblookup = -1;
    read8stlblookup = -1;
    read8utlblookup = -1;
    read16stlblookup = -1;
    read16utlblookup = -1;
    write32tlblookup = -1;
    write8tlblookup = -1;
    write16tlblookup = -1;
    instlbcheck = -1;
    read32tlbcheck = -1;
    read8stlbcheck = -1;
    read8utlbcheck = -1;
    read16stlbcheck = -1;
    read16utlbcheck = -1;
    write32tlbcheck = -1;
    write8tlbcheck = -1;
    write16tlbcheck = -1;
}

// ------------------------------------------

// Timer functions

function TimerSetInterruptFlag(coreid) {
    coreid = coreid|0;
    activebitfield = activebitfield | (1 << coreid);
    h[(coreid<<15) + TTMRp >>2] = (h[(coreid<<15) + TTMRp >>2]|0) | (1 << 28);
}

// this function checks also if the interrupt is on. Otherwise the check is useless.
// the timer is running anyhow on smp machines all the time
function TimerIsRunning(coreid) {
    coreid = coreid|0;
    var ret = 0;
    ret = (h[(coreid<<15) + TTMRp >> 2] >> 29)?1:0;
    return ret|0;
}

function TimerGetTicksToNextInterrupt(coreid) {
    coreid = coreid|0;
    var delta = 0;
    delta = (h[(coreid<<15) + TTMRp >>2] & 0xFFFFFFF) - (h[TTCRp >>2] & 0xFFFFFFF) |0;
    return delta|0;
}

function GetTimeToNextInterrupt() {
    var wait = 0xFFFFFFF;
    var delta = 0x0;
    var i = 0;
    for(i=0; (i|0)<(ncores|0); i = i+1|0) {
        if (!(TimerIsRunning(i)|0)) continue;
        delta = TimerGetTicksToNextInterrupt(i)|0;
        if ((delta|0) < (wait|0)) wait = delta|0;
    }
    return wait|0;
}

function ProgressTime(delta) {
    delta = delta|0;
    var i = 0;
    h[TTCRp >>2] = (h[TTCRp >>2]|0) + delta|0;
/*
    // wake up at least one core
    activebitfield = activebitfield | (1<<coreid);
    // wake up the cores closest to zero
    for(i=0; (i|0)<(ncores|0); i = i+1|0) {
        delta = TimerGetTicksToNextInterrupt(i)|0;
        if ((delta|0) <= 64) {
            activebitfield = activebitfield | (1<<i);
        }
    }
*/
    // wake up all cores
    activebitfield = ncoresmask;
}

function GetTicks() {
    return (h[TTCRp >>2] & 0xFFFFFFF)|0;
}


// ------------------------------------------

function AnalyzeImage() { // get addresses for fast refill
    boot_dtlb_misshandler_address = h[ramp+0x900 >> 2]|0;
    boot_itlb_misshandler_address = h[ramp+0xA00 >> 2]|0;
    current_pgd = ((h[ramp+0x2010 >> 2]&0xFFF)<<16) | (h[ramp+0x2014 >> 2] & 0xFFFF)|0;
}

function SetFlagsQuiet(x) {
    x = x|0;
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
}

function SetFlags(x) {
    x = x|0;
    var old_SR_IEE = 0;
    old_SR_IEE = SR_IEE;
    SetFlagsQuiet(x);

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
            CheckForInterrupt(coreid);
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

function CheckForInterrupt(coreid) {
    coreid = coreid|0;
    var flags = 0;
    // save current flags
    h[corep + 0x120 >> 2] = GetFlags()|0;

    flags = h[(coreid<<15) + 0x120 >> 2]|0;
    if (flags & (1<<2)) { // check for SR_IEE
        if (h[(coreid<<15) + PICMRp >> 2] & h[(coreid<<15) + PICSRp >>2]) {
            activebitfield = activebitfield | (1 << coreid);
            h[(coreid<<15) + raise_interruptp >> 2] = 1;
        }
    }
}

function RaiseInterrupt(line, coreid) {
    line = line|0;
    coreid = coreid|0;
    var i = 0;
    var lmask = 0;
    var picp = 0;
    lmask = (1 << line)|0;

    if ((coreid|0) == -1) { // raise all interrupt lines
        for(i=0; (i|0)<(ncores|0); i=i+1|0) {
            picp = (i<<15) + PICSRp | 0;
            h[picp >> 2] = (h[picp >> 2]|0) | lmask;
            CheckForInterrupt(i);
        }
    } else {
        picp = (coreid<<15) + PICSRp | 0;
        h[picp >> 2] = (h[picp >> 2]|0) | lmask;
        CheckForInterrupt(coreid);
    }
}

function ClearInterrupt(line, coreid) {
    line = line|0;
    coreid = coreid|0;
    var i = 0;
    var lmask = 0;
    var picp = 0;
    lmask = (1 << line)|0;
    if ((coreid|0) == -1) { // clear all interrupt lines
        for(i=0; (i|0)<(ncores|0); i=i+1|0) {
            picp = (i<<15) + PICSRp | 0;
            h[picp >> 2] = h[picp >> 2] & (~lmask);
        }
    } else {
        picp = (coreid<<15) + PICSRp | 0;
        h[picp >> 2] = h[picp >> 2] & (~lmask);
    }



}

function SetSPR(idx, x) {
    idx = idx|0;
    x = x|0;
    var address = 0;
    var group = 0;
    address = (idx & 0x7FF);
    group = (idx >> 11) & 0x1F;

    switch (group|0) {
    case 0:
        if ((address|0) == (SPR_SR|0)) {
            SetFlags(x);
        }
        h[corep + group0p+(address<<2) >> 2] = x;
        break;
    case 1:
        // Data MMU
        h[corep + group1p+(address<<2) >> 2] = x;
        break;
    case 2:
        // ins MMU
        h[corep + group2p+(address<<2) >> 2] = x;
        break;
    case 3:
        // data cache, not supported
    case 4:
        // ins cache, not supported
        break;
    case 8:
        activebitfield = activebitfield & (~(1 << coreid));
        break;
    case 9:
        // pic
        switch (address|0) {
        case 0:
            h[corep + PICMRp >>2] = x | 0x3; // the first two interrupts are non maskable
            // check immediately for interrupt
            if (SR_IEE) {
                if (h[corep + PICMRp >>2] & h[corep + PICSRp >>2]) {
                    DebugMessage(ERROR_SETSPR_DIRECT_INTERRUPT_EXCEPTION|0);
                    abort();
                }
            }
            break;
        case 2: // PICSR
            break;
        default:
            DebugMessage(ERROR_SETSPR_INTERRUPT_ADDRESS|0);
            abort();
        }
        break;
    case 10:
        //tick timer
        switch (address|0) {
        case 0:
            h[corep + TTMRp >> 2] = x|0;
            if (((h[corep + TTMRp >> 2] >> 30)&3) != 0x3) {
                DebugMessage(ERROR_SETSPR_TIMER_MODE_NOT_CONTINUOUS|0);
                abort();
            }
            break;
        case 1:
            //h[TTCRp >>2] = x|0; // already in sync. Don't allow to change
            break;
        default:
            //DebugMessage("Error in SetSPR: Tick timer address not supported");
            DebugMessage(ERROR_UNKNOWN|0);
            abort();
            break;
        }
        break;

    default:
        DebugMessage(ERROR_UNKNOWN|0);
        abort();
        break;
    }
};

function GetSPR(idx) {
    idx = idx|0;
    var address = 0;
    var group = 0;
    address = idx & 0x7FF;
    group = (idx >> 11) & 0x1F;
    switch (group|0) {
    case 0:
        if ((address|0) == (SPR_SR|0)) {
            return GetFlags()|0;
        }
        return h[corep + group0p+(address<<2) >> 2]|0;
    case 1:
        return h[corep + group1p+(address<<2) >> 2]|0;
    case 2:
        return h[corep + group2p+(address<<2) >> 2]|0;
    case 8:
        return 0x0;
    case 9:
        // pic
        switch (address|0) {
        case 0:
            return h[corep + PICMRp >>2]|0;
        case 2:
            return h[corep + PICSRp >>2]|0;
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
            return h[corep + TTMRp >>2]|0;
        case 1:
            return h[TTCRp >>2]|0;
        default:
            DebugMessage(ERROR_UNKNOWN|0);
            //DebugMessage("Error in GetSPR: Tick timer address unknown");
            abort();
            break;
        }
        break;
    default:
        DebugMessage(ERROR_UNKNOWN|0);
        //DebugMessage("Error in GetSPR: group unknown");
        abort();
        break;
    }
    return 0|0;
}

function Exception(excepttype, addr) {
    excepttype = excepttype|0;
    addr = addr|0;
    var except_vector = 0;
    except_vector = excepttype | (SR_EPH ? 0xf0000000 : 0x0);

    activebitfield = activebitfield | (1 << coreid);

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
    read16stlblookup = 0;
    read16utlblookup = 0;
    write32tlblookup = 0;
    write8tlblookup = 0;
    write16tlblookup = 0;
    instlbcheck = 0;
    read32tlbcheck = 0;
    read8utlbcheck = 0;
    read8stlbcheck = 0;
    read16utlbcheck = 0;
    read16stlbcheck = 0;
    write32tlbcheck = 0;
    write8tlbcheck = 0;
    write16tlbcheck = 0;

    fence = ppc|0;
    nextpc = except_vector;

    switch (excepttype|0) {

    case 0x100: // EXCEPT_RESET
        break;

    case 0x300: // EXCEPT_DPF
    case 0x900: // EXCEPT_DTLBMISS
    case 0xE00: // EXCEPT_TRAP
    case 0x200: // EXCEPT_BUSERR
        pc = pcbase + ppc|0;
        SetSPR(SPR_EPCR_BASE, pc - (delayedins ? 4 : 0)|0);
        break;

    case 0xA00: // EXCEPT_ITLBMISS
    case 0x400: // EXCEPT_IPF
    case 0x500: // EXCEPT_TICK
    case 0x800: // EXCEPT_INT
        // per definition, the pc must be valid here
        SetSPR(SPR_EPCR_BASE, pc - (delayedins ? 4 : 0)|0);
        break;

    case 0xC00: // EXCEPT_SYSCALL
        pc = pcbase + ppc|0;
        SetSPR(SPR_EPCR_BASE, pc + 4 - (delayedins ? 4 : 0)|0);
        break;

    default:
        DebugMessage(ERROR_EXCEPTION_UNKNOWN|0);
        abort();
    }
    delayedins = 0;
    SR_IME = 0;
    h[corep + linkedaddrp >> 2] = -1;
    snoopbitfield = snoopbitfield & (~(1<<coreid));
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
    r3 = h[ramp + current_pgd + (coreid<<2) >> 2]|0; // current pgd
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
    h[corep + group1p+((0x280 | r5)<<2) >> 2] = r4;
    //SPR_DTLBTR_BASE(0)|r5 = r4 // SPR_DTLBTR_BASE = 0x280 * (WAY*0x100)

    // fill DTLBMR register
    r2 = addr;
    r4 = r2 & 0xFFFFE000;
    r4 = r4 | 0x1;
    h[corep + group1p+((0x200 | r5)<<2) >> 2] = r4;
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
    r3 = h[ramp+current_pgd + (coreid<<2) >> 2]|0; // current pgd
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

    h[corep + group2p + ((0x280 | r5)<<2) >> 2] = r4; // SPR_ITLBTR_BASE(0)|r5 = r4 // SPR_ITLBTR_BASE = 0x280 * (WAY*0x100)

    //fill ITLBMR register
    r2 = addr;
    // r3 = 
    r4 = r2 & 0xFFFFE000;
    r4 = r4 | 0x1;
    h[corep + group2p + ((0x200 | r5)<<2) >> 2] = r4; // SPR_DTLBMR_BASE(0)|r5 = r4  // SPR_DTLBMR_BASE = 0x200 * (WAY*0x100)
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
    tlmbr = h[corep + group1p + ((0x200 | setindex) << 2) >> 2]|0; // match register

    if ((tlmbr & 1) == 0) {
        // use tlb refill to fasten up
        if (DTLBRefill(addr, 64)|0) {
            tlmbr = h[corep + group1p + (0x200 + setindex << 2) >> 2]|0;
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
            tlmbr = h[corep + group1p + (0x200 + setindex << 2) >> 2]|0;
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
    tlbtr = h[corep + group1p + ((0x280 | setindex)<<2) >> 2]|0; // translate register

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

    var changecorecounter = 0;

    // to get the instruction
    var setindex = 0x0;
    var tlmbr = 0x0;
    var tlbtr = 0x0;
    var delta = 0x0;

    var dsteps = 0; // small counter

// -----------------------------------------------------
    for(;;) {

        // --------- START FENCE ---------
        if ((ppc|0) == (fence|0)) {
            pc = nextpc;

            if ((!delayedins_at_page_boundary|0)) {
                delayedins = 0;
            }

            dsteps = dsteps - ((ppc - ppcorigin) >> 2)|0;

            // do this not so often
            if ((dsteps|0) <= 0)
            if (!(delayedins_at_page_boundary|0)) { // for now. Not sure if we need this check
                dsteps = dsteps + 64|0;
                steps = steps - 64|0;

                // --------- START TICK ---------
                for(i=0; (i|0)<(ncores|0); i = i + 1|0) {
                    if (!(TimerIsRunning(i)|0)) continue;
                    delta = TimerGetTicksToNextInterrupt(i)|0;
                    if ((delta|0) < (clockspeed|0)) {
                        TimerSetInterruptFlag(i);
                    }
                }

                // the timer is always enabled on smp systems
                h[TTCRp >> 2] = ((h[TTCRp >> 2]|0) + clockspeed|0);
                // ---------- END TICK ----------

                if ((steps|0) < 0) return 0x0; // return to main loop
            }

            // check for any interrupts
            // SR_TEE is set or cleared at the same time as SR_IEE in Linux, so skip this check
            if (SR_IEE|0) {
                if (h[corep + raise_interruptp >> 2]|0) {
                    h[corep + raise_interruptp >> 2] = 0;
                    Exception(EXCEPT_INT, h[corep + group0p + (SPR_EEAR_BASE<<2) >> 2]|0);
                    // treat exception directly here
                    pc = nextpc;
                } else
                if (h[corep + TTMRp >> 2] & (1 << 28)) {
                    Exception(EXCEPT_TICK, h[corep + group0p + (SPR_EEAR_BASE<<2) >> 2]|0);
                    // treat exception directly here
                    pc = nextpc;
                }
            }

            // Get instruction pointer
            if ((instlbcheck ^ pc) & 0xFFFFE000) // short check if it is still the correct page
            {
                instlbcheck = pc; // save the new page, lower 11 bits are ignored
                if (!SR_IME) {
                    instlblookup = 0x0;
                } else {
                    setindex = (pc >> 13) & 63; // check this values
                    tlmbr = h[corep + group2p + ((0x200 | setindex) << 2) >> 2]|0;
                    // test if tlmbr is valid
                    if ((tlmbr & 1) == 0) {
                        if (ITLBRefill(pc, 64)|0) {
                            tlmbr = h[corep + group2p + ((0x200 | setindex)<<2) >> 2]|0; // reload the new value
                        } else {
                            // just make sure he doesn't count this 'continue' as steps
                            ppcorigin = ppc;
                            delayedins_at_page_boundary = 0;
                            continue;
                        }
                    }
                    if ((tlmbr >> 19) != (pc >> 19)) {
                        if (ITLBRefill(pc, 64)|0) {
                            tlmbr = h[corep + group2p + ((0x200 | setindex)<<2) >> 2]|0; // reload the new value
                        } else {
                            // just make sure he doesn't count this 'continue' as steps
                            ppcorigin = ppc;
                            delayedins_at_page_boundary = 0;
                            continue;
                        }
                    }
                    tlbtr = h[corep + group2p + ((0x280 | setindex) << 2) >> 2]|0;
                    instlblookup = ((tlbtr ^ tlmbr) >> 13) << 13;
                }
            }

            // set pc and set the correcponding physical pc pointer
            //pc = pc;
            ppc = ramp + (instlblookup ^ pc)|0;
            ppcorigin = ppc;
            pcbase = pc - 4 - ppcorigin|0;

           if (delayedins_at_page_boundary|0) {
               delayedins_at_page_boundary = 0;
               fence = ppc + 4|0;
               nextpc = jump;
           } else {
               fence  = ((ppc >> 13) + 1) << 13; // next page
               nextpc = ((pc  >> 13) + 1) << 13;
           }

           changecorecounter = changecorecounter + 1|0;
           if ((changecorecounter&7) == 0) {
               ChangeCore();
               continue;
           }

        } 
        // ---------- END FENCE ----------

        ins = h[ppc >> 2]|0;
        ppc = ppc + 4|0;

// --------------------------------------------

        switch ((ins >> 26)&0x3F) {
        case 0x0:
            // j
            pc = pcbase + ppc|0;
            jump = pc + ((ins << 6) >> 4)|0;
            if ((fence|0) == (ppc|0)) { // delayed instruction directly at page boundary
                delayedins_at_page_boundary = 1;
            } else {
                fence = ppc + 4|0;
                nextpc = jump|0;
            }
            delayedins = 1;
            break;

        case 0x1:
            // jal
            pc = pcbase + ppc|0;
            jump = pc + ((ins << 6) >> 4)|0;
            r[corep + (9<<2) >> 2] = pc + 8|0;
            if ((fence|0) == (ppc|0)) { // delayed instruction directly at page boundary
                delayedins_at_page_boundary = 1;
            } else {
                fence = ppc + 4|0;
                nextpc = jump|0;
            }
            delayedins = 1;
            break;

        case 0x3:
            // bnf
            if (SR_F) {
                break;
            }
            pc = pcbase + ppc|0;
            jump = pc + ((ins << 6) >> 4)|0;
            if ((fence|0) == (ppc|0)) { // delayed instruction directly at page boundary
                delayedins_at_page_boundary = 1;
            } else {
                fence = ppc + 4|0;
                nextpc = jump|0;
            }
            delayedins = 1;
            break;

        case 0x4:
            // bf
            if (!SR_F) {
                break;
            }
            pc = pcbase + ppc|0;
            jump = pc + ((ins << 6) >> 4)|0;
            if ((fence|0) == (ppc|0)) { // delayed instruction directly at page boundary
                delayedins_at_page_boundary = 1;
            } else {
                fence = ppc + 4|0;
                nextpc = jump|0;
            }
            delayedins = 1;
            break;

        case 0x5:
            // nop
            break;

        case 0x6:
            // movhi
            rindex = (ins >> 21) & 0x1F;
            r[corep + (rindex << 2) >> 2] = ((ins & 0xFFFF) << 16); // movhi
            break;

        case 0x8:
            //sys and trap
            if ((ins&0xFFFF0000) == 0x21000000) {
                Exception(EXCEPT_TRAP, h[corep + group0p+SPR_EEAR_BASE >> 2]|0);
            } else {
                Exception(EXCEPT_SYSCALL, h[corep + group0p+SPR_EEAR_BASE >> 2]|0);
            }
            break;

        case 0x9:
            // rfe
            jump = GetSPR(SPR_EPCR_BASE)|0;
            InvalidateTLB();
            fence = ppc;
            nextpc = jump;
            //pc = jump; // set the correct pc in case of an EXCEPT_INT
            //delayedins = 0;
            SetFlags(GetSPR(SPR_ESR_BASE)|0); // could raise an exception
            break;

        case 0x11:
            // jr
            jump = r[corep + ((ins >> 9) & 0x7C)>>2]|0;
            if ((fence|0) == (ppc|0)) { // delayed instruction directly at page boundary
                delayedins_at_page_boundary = 1;
            } else {
                fence = ppc + 4|0;
                nextpc = jump|0;
            }
            delayedins = 1;
            break;

        case 0x12:
            // jalr
            pc = pcbase + ppc|0;
            jump = r[corep + ((ins >> 9) & 0x7C)>>2]|0;
            r[corep + (9<<2) >> 2] = pc + 8|0;
            if ((fence|0) == (ppc|0)) { // delayed instruction directly at page boundary
                delayedins_at_page_boundary = 1;
            } else {
                fence = ppc + 4|0;
                nextpc = jump|0;
            }
            delayedins = 1;
            break;

        case 0x1B: 
            // lwa
            vaddr = (r[corep + ((ins >> 14) & 0x7C) >> 2]|0) + ((ins << 16) >> 16)|0;
            if ((read32tlbcheck ^ vaddr) >> 13) {
                paddr = DTLBLookup(vaddr, 0)|0;
                if ((paddr|0) == -1) {
                    break;
                }
                read32tlbcheck = vaddr;
                read32tlblookup = ((paddr^vaddr) >> 13) << 13;
            }
            paddr = read32tlblookup ^ vaddr;
            snoopbitfield = snoopbitfield | (1<<coreid);
            h[corep + linkedaddrp >>2] = paddr;
            r[corep + ((ins >> 19) & 0x7C)>>2] = (paddr|0)>0?h[ramp+paddr >> 2]|0:Read32(paddr|0)|0;
            break;

        case 0x21:
            // lwz
            vaddr = (r[corep + ((ins >> 14) & 0x7C) >> 2]|0) + ((ins << 16) >> 16)|0;
            if ((read32tlbcheck ^ vaddr) >> 13) {
                paddr = DTLBLookup(vaddr, 0)|0;
                if ((paddr|0) == -1) {
                    break;
                }
                read32tlbcheck = vaddr;
                read32tlblookup = ((paddr^vaddr) >> 13) << 13;
            }
            paddr = read32tlblookup ^ vaddr;
            r[corep + ((ins >> 19) & 0x7C)>>2] = (paddr|0)>0?h[ramp+paddr >> 2]|0:Read32(paddr|0)|0;
            break;

        case 0x23:
            // lbz
            vaddr = (r[corep + ((ins >> 14) & 0x7C)>>2]|0) + ((ins << 16) >> 16)|0;
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
                r[corep + ((ins >> 19) & 0x7C)>>2] = b[ramp + (paddr ^ 3)|0]|0;
            } else {
                r[corep + ((ins >> 19) & 0x7C)>>2] = Read8(paddr|0)|0;
            }
            break;

        case 0x24:
            // lbs 
            vaddr = (r[corep + ((ins >> 14) & 0x7C)>>2]|0) + ((ins << 16) >> 16)|0;
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
                r[corep + ((ins >> 19) & 0x7C)>>2] = (b[ramp + (paddr ^ 3)|0] << 24) >> 24;
            } else {
                r[corep + ((ins >> 19) & 0x7C)>>2] = ((Read8(paddr|0)|0) << 24) >> 24;
            }
            break;

        case 0x25:
            // lhz 
            vaddr = (r[corep + ((ins >> 14) & 0x7C)>>2]|0) + ((ins << 16) >> 16)|0;
            if ((read16utlbcheck ^ vaddr) >> 13) {
                paddr = DTLBLookup(vaddr, 0)|0;
                if ((paddr|0) == -1) {
                    break;
                }
                read16utlbcheck = vaddr;
                read16utlblookup = ((paddr^vaddr) >> 13) << 13;
            }
            paddr = read16utlblookup ^ vaddr;
            if ((paddr|0) >= 0) {
                r[corep + ((ins >> 19) & 0x7C)>>2] = w[ramp + (paddr ^ 2) >> 1];
            } else {
                r[corep + ((ins >> 19) & 0x7C)>>2] = (Read16(paddr|0)|0);
            }
            break;

        case 0x26:
            // lhs
            vaddr = (r[corep + ((ins >> 14) & 0x7C)>>2]|0) + ((ins << 16) >> 16)|0;
            if ((read16stlbcheck ^ vaddr) >> 13) {
                paddr = DTLBLookup(vaddr, 0)|0;
                if ((paddr|0) == -1) {
                    break;
                }
                read16stlbcheck = vaddr;
                read16stlblookup = ((paddr^vaddr) >> 13) << 13;
            }
            paddr = read16stlblookup ^ vaddr;
            if ((paddr|0) >= 0) {
                r[corep + ((ins >> 19) & 0x7C)>>2] =  (w[ramp + (paddr ^ 2) >> 1] << 16) >> 16;
            } else {
                r[corep + ((ins >> 19) & 0x7C)>>2] = ((Read16(paddr|0)|0) << 16) >> 16;
            }
            break;

        case 0x27:
            // addi signed
            imm = (ins << 16) >> 16;
            rA = r[corep + ((ins >> 14) & 0x7C)>>2]|0;
            rindex = corep + ((ins >> 19) & 0x7C)|0;
            r[rindex >> 2] = rA + imm|0;
            SR_CY = (r[rindex>>2]>>>0) < (rA>>>0);
            break;

        case 0x28:
            // addi signed with carry
            imm = (ins << 16) >> 16;
            rA = r[corep + ((ins >> 14) & 0x7C)>>2]|0;
            rindex = corep + ((ins >> 19) & 0x7C)|0;
            r[rindex >> 2] = (rA + imm|0) + (SR_CY?1:0)|0;
            if (SR_CY|0) {
                SR_CY = (r[rindex>>2]>>>0) <= (rA>>>0);
            } else {
                SR_CY = (r[rindex>>2]>>>0) < (rA>>>0);
            }
            break;

        case 0x29:
            // andi
            r[corep + ((ins >> 19) & 0x7C)>>2] = r[corep + ((ins >> 14) & 0x7C)>>2] & (ins & 0xFFFF);
            break;


        case 0x2A:
            // ori
            r[corep + ((ins >> 19) & 0x7C)>>2] = r[corep + ((ins >> 14) & 0x7C)>>2] | (ins & 0xFFFF);
            break;

        case 0x2B:
            // xori
            rA = r[corep + ((ins >> 14) & 0x7C)>>2]|0;
            r[corep + ((ins >> 19) & 0x7C)>>2] = rA ^ ((ins << 16) >> 16);
            break;

        case 0x2C:
            // muli
            rA = r[corep + ((ins >> 14) & 0x7C)>>2]|0;
            r[corep + ((ins >> 19) & 0x7C)>>2] = imul(rA|0, (ins << 16) >> 16)|0;
            break;

        case 0x2D:
            // mfspr
            r[corep + ((ins >> 19) & 0x7C)>>2] = GetSPR(r[corep + ((ins >> 14) & 0x7C)>>2] | (ins & 0xFFFF))|0;
            break;

        case 0x2E:
            switch ((ins >> 6) & 0x3) {
            case 0:
                // slli
                r[corep + ((ins >> 19) & 0x7C)>>2] = r[corep + ((ins >> 14) & 0x7C)>>2] << (ins & 0x1F);
                break;
            case 1:
                // rori
                r[corep + ((ins >> 19) & 0x7C)>>2] = r[corep + ((ins >> 14) & 0x7C)>>2] >>> (ins & 0x1F);
                break;
            case 2:
                // srai
                r[corep + ((ins >> 19) & 0x7C)>>2] = r[corep + ((ins >> 14) & 0x7C)>>2] >> (ins & 0x1F);
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
                SR_F = (r[corep + ((ins >> 14) & 0x7C)>>2]|0) == (imm|0);
                break;
            case 0x1:
                // sfnei
                SR_F = (r[corep + ((ins >> 14) & 0x7C)>>2]|0) != (imm|0);
                break;
            case 0x2:
                // sfgtui
                SR_F = (r[corep + ((ins >> 14) & 0x7C)>>2]>>>0) > (imm >>> 0);
                break;
            case 0x3:
                // sfgeui
                SR_F = (r[corep + ((ins >> 14) & 0x7C)>>2]>>>0) >= (imm >>> 0);
                break;
            case 0x4:
                // sfltui
                SR_F = (r[corep + ((ins >> 14) & 0x7C)>>2]>>>0) < (imm >>> 0);
                break;
            case 0x5:
                // sfleui
                SR_F = (r[corep + ((ins >> 14) & 0x7C)>>2]>>>0) <= (imm >>> 0);
                break;
            case 0xa:
                // sfgtsi
                SR_F = (r[corep + ((ins >> 14) & 0x7C)>>2]|0) > (imm|0);
                break;
            case 0xb:
                // sfgesi
                SR_F = (r[corep + ((ins >> 14) & 0x7C)>>2]|0) >= (imm|0);
                break;
            case 0xc:
                // sfltsi
                SR_F = (r[corep + ((ins >> 14) & 0x7C)>>2]|0) < (imm|0);
                break;
            case 0xd:
                // sflesi
                SR_F = (r[corep + ((ins >> 14) & 0x7C)>>2]|0) <= (imm|0);
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
            //pc = pcbase + ppc|0;
            SetSPR(r[corep + ((ins >> 14) & 0x7C)>>2] | imm, r[corep + ((ins >> 9) & 0x7C)>>2]|0); // can raise an interrupt

            if ((activebitfield|0) == 0) { // all cpus are idle
                activebitfield = ncoresmask;
                // first check if there is a timer interrupt pending
                //for(i=0; (i|0)<(ncores|0); i = i+1|0) {
                    if ((h[(coreid<<15) + TTMRp >>2] & (1 << 28))) break;
                //}
                return steps|0;
            } else
            if ((activebitfield & (1<<coreid)) == 0) {  // check if this cpu gone idle and change the core
                ChangeCore();
            }
            break;

       case 0x32:
            // floating point
            rA = (ins >> 14) & 0x7C;
            rB = (ins >> 9) & 0x7C;
            rD = (ins >> 19) & 0x7C;

            switch (ins & 0xFF) {
            case 0x0:
                // lf.add.s
                f[corep + rD >> 2] = (+f[corep + rA >> 2]) + (+f[corep + rB >> 2]);
                break;
            case 0x1:
                // lf.sub.s
                f[corep + rD >> 2] = (+f[corep + rA >> 2]) - (+f[corep + rB >> 2]);
                break;
            case 0x2:
                // lf.mul.s
                f[corep + rD >> 2] = (+f[corep + rA >> 2]) * (+f[corep + rB >> 2]);
                break;
            case 0x3:
                // lf.div.s
                f[corep + rD >> 2] = (+f[corep + rA >> 2]) / (+f[corep + rB >> 2]);
                break;
            case 0x4:
                // lf.itof.s
                f[corep + rD >> 2] = +(r[corep + rA >> 2]|0);
                break;
            case 0x5:
                // lf.ftoi.s
                r[corep + rD >> 2] = ~~(+floor(+f[corep + rA >> 2]));
                break;
            case 0x7:
                // lf.madd.s
                f[corep + rD >> 2] = (+f[corep + rD >> 2]) + (+f[corep + rA >> 2]) * (+f[corep + rB >> 2]);
                break;
            case 0x8:
                // lf.sfeq.s
                SR_F = (+f[corep + rA >> 2]) == (+f[corep + rB >> 2]);
                break;
            case 0x9:
                // lf.sfne.s
                SR_F = (+f[corep + rA >> 2]) != (+f[corep + rB >> 2]);
                break;
            case 0xa:
                // lf.sfgt.s
                SR_F = (+f[corep + rA >> 2]) > (+f[corep + rB >> 2]);
                break;
            case 0xb:
                // lf.sfge.s
                SR_F = (+f[corep + rA >> 2]) >= (+f[corep + rB >> 2]);
                break;
            case 0xc:
                // lf.sflt.s
                SR_F = (+f[corep + rA >> 2]) < (+f[corep + rB >> 2]);
                break;
            case 0xd:
                // lf.sfle.s
                SR_F = (+f[corep + rA >> 2]) <= (+f[corep + rB >> 2]);
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
            vaddr = (r[corep + ((ins >> 14) & 0x7C)>>2]|0) + imm|0;
            if ((write32tlbcheck ^ vaddr) >> 13) {
                paddr = DTLBLookup(vaddr, 1)|0;
                if ((paddr|0) == -1) {
                    break;
                }
                write32tlbcheck = vaddr;
                write32tlblookup = ((paddr^vaddr) >> 13) << 13;
            }
            paddr = write32tlblookup ^ vaddr;
            SR_F = ((paddr|0) == (h[corep + linkedaddrp >>2]|0))?(1|0):(0|0);
            h[corep + linkedaddrp >>2] = -1;
            snoopbitfield = snoopbitfield & (~(1<<coreid));
            if (snoopbitfield)
            for(i=0; (i|0)<(ncores|0); i = i + 1|0) {
                if ((h[(i<<15) + linkedaddrp >>2]|0) == (paddr|0)) {
                    h[(i<<15) + linkedaddrp >>2] = -1;
                    snoopbitfield = snoopbitfield & (~(1<<i));
                }
            }
            if ((SR_F|0) == 0) {
                break;
            }
            if ((paddr|0) > 0) {
                h[ramp + paddr >> 2] = r[corep + ((ins >> 9) & 0x7C)>>2]|0;
            } else {
                Write32(paddr|0, r[corep + ((ins >> 9) & 0x7C)>>2]|0);
            }
            break;

        case 0x35:
            // sw
            imm = ((((ins >> 10) & 0xF800) | (ins & 0x7FF)) << 16) >> 16;
            vaddr = (r[corep + ((ins >> 14) & 0x7C)>>2]|0) + imm|0;
            if ((write32tlbcheck ^ vaddr) >> 13) {
                paddr = DTLBLookup(vaddr, 1)|0;
                if ((paddr|0) == -1) {
                    break;
                }
                write32tlbcheck = vaddr;
                write32tlblookup = ((paddr^vaddr) >> 13) << 13;
            }
            paddr = write32tlblookup ^ vaddr;
            if (snoopbitfield)
            for(i=0; (i|0)<(ncores|0); i = i + 1|0) {
                if ((h[(i<<15) + linkedaddrp >>2]|0) == (paddr|0)) {
                    h[(i<<15) + linkedaddrp >>2] = -1;
                    snoopbitfield = snoopbitfield & (~(1<<i));
                }
            }
            if ((paddr|0) > 0) {
                h[ramp + paddr >> 2] = r[corep + ((ins >> 9) & 0x7C)>>2]|0;
            } else {
                Write32(paddr|0, r[corep + ((ins >> 9) & 0x7C)>>2]|0);
            }
            break;

        case 0x36:
            // sb
            imm = ((((ins >> 10) & 0xF800) | (ins & 0x7FF)) << 16) >> 16;
            vaddr = (r[corep + ((ins >> 14) & 0x7C)>>2]|0) + imm|0;
            if ((write8tlbcheck ^ vaddr) >> 13) {
                paddr = DTLBLookup(vaddr, 1)|0;
                if ((paddr|0) == -1) {
                    break;
                }
                write8tlbcheck = vaddr;
                write8tlblookup = ((paddr^vaddr) >> 13) << 13;
            }
            paddr = write8tlblookup ^ vaddr;
            if (snoopbitfield)
            for(i=0; (i|0)<(ncores|0); i = i + 1|0) {
                if ((h[(i<<15) + linkedaddrp >>2]|0) == (paddr&(~3))) {
                    h[(i<<15) + linkedaddrp >>2] = -1;
                    snoopbitfield = snoopbitfield & (~(1<<i));
                }
            }
            if ((paddr|0) > 0) {
                // consider that the data is saved in little endian
                b[ramp + (paddr ^ 3)|0] = r[corep + ((ins >> 9) & 0x7C)>>2]|0;
            } else {
                Write8(paddr|0, r[corep + ((ins >> 9) & 0x7C)>>2]|0);
            }
            break;

        case 0x37:
            // sh
            imm = ((((ins >> 10) & 0xF800) | (ins & 0x7FF)) << 16) >> 16;
            vaddr = (r[corep + ((ins >> 14) & 0x7C)>>2]|0) + imm|0;
            if ((write16tlbcheck ^ vaddr) >> 13) {
                paddr = DTLBLookup(vaddr, 1)|0;
                if ((paddr|0) == -1) {
                    break;
                }
                write16tlbcheck = vaddr;
                write16tlblookup = ((paddr^vaddr) >> 13) << 13;
            }
            paddr = write16tlblookup ^ vaddr;
            if (snoopbitfield)
            for(i=0; (i|0)<(ncores|0); i = i + 1|0) {
                if ((h[(i<<15) + linkedaddrp >>2]|0) == (paddr&(~3))) {
                    h[(i<<15) + linkedaddrp >>2] = -1;
                    snoopbitfield = snoopbitfield & (~(1<<i));
                }
            }
            if ((paddr|0) >= 0) {
                w[ramp + (paddr ^ 2) >> 1] = r[corep + ((ins >> 9) & 0x7C)>>2];
            } else {
                Write16(paddr|0, r[corep + ((ins >> 9) & 0x7C)>>2]|0);
            }
            break;

        case 0x38:
            // three operands commands
            rA = r[corep + ((ins >> 14) & 0x7C)>>2]|0;
            rB = r[corep + ((ins >> 9) & 0x7C)>>2]|0;
            rindex = (ins >> 19) & 0x7C;
            switch (ins & 0x3CF) {
            case 0x0:
                // add
                r[corep + rindex>>2] = rA + rB|0;
                SR_CY = (r[corep + rindex>>2]>>>0) < (rA>>>0);
                break;
            case 0x1:
                // add with carry
                r[corep + rindex>>2] = (rA + rB|0) + (SR_CY?1:0)|0;
                if (SR_CY|0) {
                    SR_CY = (r[corep + rindex>>2]>>>0) <= (rA>>>0);
                } else {
                    SR_CY = (r[corep + rindex>>2]>>>0) < (rA>>>0);
                }
                break;
            case 0x2:
                // sub signed
                r[corep + rindex>>2] = rA - rB;
                SR_CY = (rB>>>0) > (rA>>>0);
                break;
            case 0x3:
                // and
                r[corep + rindex>>2] = rA & rB;
                break;
            case 0x4:
                // or
                r[corep + rindex>>2] = rA | rB;
                break;
            case 0x5:
                // or
                r[corep + rindex>>2] = rA ^ rB;
                break;
            case 0x8:
                // sll
                r[corep + rindex>>2] = rA << (rB & 0x1F);
                break;
            case 0xc:
                // exths
                r[corep + rindex>>2] = (rA << 16) >> 16;
                continue;
            case 0xe:
                // cmov
                r[corep + rindex>>2] = SR_F?rA:rB;
                break;
            case 0x48:
                // srl not signed
                r[corep + rindex>>2] = rA >>> (rB & 0x1F);
                break;
            case 0x4c:
                // extbs
                r[corep + rindex>>2] = (rA << 24) >> 24;
                break;
            case 0xf:
                // ff1
                r[corep + rindex>>2] = 0;
                for (i = 0; (i|0) < 32; i=i+1|0) {
                    if (rA & (1 << i)) {
                        r[corep + rindex>>2] = i + 1;
                        break;
                    }
                }
                break;
            case 0x88:
                // sra signed
                r[corep + rindex>>2] = rA >> (rB & 0x1F);
                // be carefull here and check
                break;
            case 0x10f:
                // fl1
                r[corep + rindex>>2] = 0;
                for (i = 31; (i|0) >= 0; i=i-1|0) {
                    if (rA & (1 << i)) {
                        r[corep + rindex>>2] = i + 1;
                        break;
                    }
                }
                break;
            case 0x306:
                // mul signed (specification seems to be wrong)
                {
                    // this is a hack to do 32 bit signed multiply. Seems to work but needs to be tested.
                    r[corep + rindex>>2] = imul(rA|0, rB|0)|0;
                }
                break;
            case 0x30a:
                // divu (specification seems to be wrong)
                SR_OV = (rB|0) == 0;
                if (!SR_OV) {
                    r[corep + rindex>>2] = (rA>>>0) / (rB>>>0);
                }
                break;
            case 0x309:
                // div (specification seems to be wrong)
                SR_OV = (rB|0) == 0;
                if (!SR_OV) {
                    r[corep + rindex>>2] = (rA|0) / (rB|0);
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
                SR_F = (r[corep + ((ins >> 14) & 0x7C)>>2]|0) == (r[corep + ((ins >> 9) & 0x7C)>>2]|0);
                break;
            case 0x1:
                // sfne
                SR_F = (r[corep + ((ins >> 14) & 0x7C)>>2]|0) != (r[corep + ((ins >> 9) & 0x7C)>>2]|0);
                break;
            case 0x2:
                // sfgtu
                SR_F = ((r[corep + ((ins >> 14) & 0x7C)>>2]>>>0) > (r[corep + ((ins >> 9) & 0x7C)>>2]>>>0));
                break;
            case 0x3:
                // sfgeu
                SR_F = ((r[corep + ((ins >> 14) & 0x7C)>>2]>>>0) >= (r[corep + ((ins >> 9) & 0x7C)>>2]>>>0));
                break;
            case 0x4:
                // sfltu
                SR_F = ((r[corep + ((ins >> 14) & 0x7C)>>2]>>>0) < (r[corep + ((ins >> 9) & 0x7C)>>2]>>>0));
                break;
            case 0x5:
                // sfleu
                SR_F = ((r[corep + ((ins >> 14) & 0x7C)>>2]>>>0) <= (r[corep + ((ins >> 9) & 0x7C)>>2]>>>0));
                break;
            case 0xa:
                // sfgts
                SR_F = (r[corep + ((ins >> 14) & 0x7C)>>2]|0) > (r[corep + ((ins >> 9) & 0x7C)>>2]|0);
                break;
            case 0xb:
                // sfges
                SR_F = (r[corep + ((ins >> 14) & 0x7C)>>2]|0) >= (r[corep + ((ins >> 9) & 0x7C)>>2]|0);
                break;
            case 0xc:
                // sflts
                SR_F = (r[corep + ((ins >> 14) & 0x7C)>>2]|0) < (r[corep + ((ins >> 9) & 0x7C)>>2]|0);
                break;
            case 0xd:
                // sfles
                SR_F = (r[corep + ((ins >> 14) & 0x7C)>>2]|0) <= (r[corep + ((ins >> 9) & 0x7C)>>2]|0);
                break;
            default:
                //DebugMessage("Error: sf.... function supported yet");
                DebugMessage(ERROR_UNKNOWN|0);
                abort();
            }
            break;

        default:
            //DebugMessage("Error: Instruction with opcode " + utils.ToHex(ins >>> 26) + " not supported");
            DebugMessage(ERROR_UNKNOWN|0);
            abort();
            break;
        }

    }; // main loop

    return steps|0;
}

return {
    Init: Init,
    Reset: Reset,
    InvalidateTLB: InvalidateTLB,
    Step: Step,
    GetFlags: GetFlags,
    SetFlags: SetFlags,
    GetTimeToNextInterrupt: GetTimeToNextInterrupt,
    ProgressTime: ProgressTime,
    GetTicks: GetTicks,
    RaiseInterrupt: RaiseInterrupt,
    ClearInterrupt: ClearInterrupt,
    AnalyzeImage: AnalyzeImage
};

}

module.exports = SMPCPU;
