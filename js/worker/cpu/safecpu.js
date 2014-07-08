// -------------------------------------------------
// -------------------- CPU ------------------------
// -------------------------------------------------

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

// constructor
function SafeCPU(ram) {
    this.ram = ram;

    // registers
    // r[32] and r[33] are used to calculate the virtual address and physical address
    // to make sure that they are not transformed accidently into a floating point number
    var array = new ArrayBuffer(34 << 2);
    this.r = new Int32Array(array);
    this.f = new Float32Array(array);

    // special purpose registers
    array = new ArrayBuffer(1024 << 2);
    this.group0 = new Int32Array(array);

    // data tlb
    array = new ArrayBuffer(1024 << 2);
    this.group1 = new Int32Array(array);

    // instruction tlb
    array = new ArrayBuffer(1024 << 2);
    this.group2 = new Int32Array(array);

    // define variables and initialize
    this.pc = 0x0; // instruction pointer in multiples of four
    this.nextpc = 0x0; // pointer to next instruction in multiples of four
    //this.ins=0x0; // current instruction to handle

    this.delayedins = false; // the current instruction is an delayed instruction, one cycle before a jump

    this.clock = 0x0;

    this.TTMR = 0x0; // Tick timer mode register
    this.TTCR = 0x0; // Tick timer count register

    this.PICMR = 0x3; // interrupt controller mode register (use nmi)
    this.PICSR = 0x0; // interrupt controller set register

    // flags
    this.SR_SM = true; // supervisor mode
    this.SR_TEE = false; // tick timer Exception Enabled
    this.SR_IEE = false; // interrupt Exception Enabled
    this.SR_DCE = false; // Data Cache Enabled
    this.SR_ICE = false; // Instruction Cache Enabled
    this.SR_DME = false; // Data MMU Enabled
    this.SR_IME = false; // Instruction MMU Enabled
    this.SR_LEE = false; // Little Endian Enabled
    this.SR_CE = false; // CID Enabled ?
    this.SR_F = false; // Flag for l.sf... instructions 
    this.SR_CY = false; // Carry Flag
    this.SR_OV = false; // Overflow Flag
    this.SR_OVE = false; // Overflow Flag Exception
    this.SR_DSX = false; // Delay Slot Exception
    this.SR_EPH = false; // Exception Prefix High
    this.SR_FO = true; // Fixed One, always set
    this.SR_SUMRA = false; // SPRS User Mode Read Access, or TRAP exception disable?
    this.SR_CID = 0x0; //Context ID

    
    this.Reset();
}

SafeCPU.prototype.Reset = function() {
    this.TTMR = 0x0;
    this.TTCR = 0x0;
    this.PICMR = 0x3;
    this.PICSR = 0x0;

    this.group0[SPR_IMMUCFGR] = 0x18; // 0 ITLB has one way and 64 sets
    this.group0[SPR_DMMUCFGR] = 0x18; // 0 DTLB has one way and 64 sets

    this.Exception(EXCEPT_RESET, 0x0); // set pc values
    this.pc = this.nextpc;
    this.nextpc++;
}

SafeCPU.prototype.InvalidateTLB = function() {
}

SafeCPU.prototype.GetTimeToNextInterrupt = function () {

    if ((this.TTMR >> 30) == 0) return -1;
    var delta = (this.TTMR & 0xFFFFFFF) - (this.TTCR & 0xFFFFFFF);
    delta += delta<0?0xFFFFFFF:0x0;
    return delta;
}

SafeCPU.prototype.ProgressTime = function (delta) {
    this.TTCR = (this.TTCR + delta) & 0xFFFFFFFF;
}


SafeCPU.prototype.AnalyzeImage = function() // we haveto define these to copy the cpus
{
    this.boot_dtlb_misshandler_address = 0x0;
    this.boot_itlb_misshandler_address = 0x0;
    this.current_pgd = 0x0;

}

SafeCPU.prototype.SetFlags = function (x) {
    this.SR_SM = (x & (1 << 0)) ? true : false;
    this.SR_TEE = (x & (1 << 1)) ? true : false;
    var old_SR_IEE = this.SR_IEE;
    this.SR_IEE = (x & (1 << 2)) ? true : false;
    this.SR_DCE = (x & (1 << 3)) ? true : false;
    this.SR_ICE = (x & (1 << 4)) ? true : false;
    var old_SR_DME = this.SR_DME;
    this.SR_DME = (x & (1 << 5)) ? true : false;
    var old_SR_IME = this.SR_IME;
    this.SR_IME = (x & (1 << 6)) ? true : false;
    this.SR_LEE = (x & (1 << 7)) ? true : false;
    this.SR_CE = (x & (1 << 8)) ? true : false;
    this.SR_F = (x & (1 << 9)) ? true : false;
    this.SR_CY = (x & (1 << 10)) ? true : false;
    this.SR_OV = (x & (1 << 11)) ? true : false;
    this.SR_OVE = (x & (1 << 12)) ? true : false;
    this.SR_DSX = (x & (1 << 13)) ? true : false;
    this.SR_EPH = (x & (1 << 14)) ? true : false;
    this.SR_FO = true;
    this.SR_SUMRA = (x & (1 << 16)) ? true : false;
    this.SR_CID = (x >> 28) & 0xF;
    if (this.SR_LEE) {
        DebugMessage("little endian not supported");
        abort();
    }
    if (this.SR_CID) {
        DebugMessage("context id not supported");
        abort();
    }
    if (this.SR_EPH) {
        DebugMessage("exception prefix not supported");
        abort();
    }
    if (this.SR_DSX) {
        DebugMessage("delay slot exception not supported");
        abort();
    }
    if (this.SR_IEE && !old_SR_IEE) {
        this.CheckForInterrupt();
    }
};

SafeCPU.prototype.GetFlags = function () {
    var x = 0x0;
    x |= this.SR_SM ? (1 << 0) : 0;
    x |= this.SR_TEE ? (1 << 1) : 0;
    x |= this.SR_IEE ? (1 << 2) : 0;
    x |= this.SR_DCE ? (1 << 3) : 0;
    x |= this.SR_ICE ? (1 << 4) : 0;
    x |= this.SR_DME ? (1 << 5) : 0;
    x |= this.SR_IME ? (1 << 6) : 0;
    x |= this.SR_LEE ? (1 << 7) : 0;
    x |= this.SR_CE ? (1 << 8) : 0;
    x |= this.SR_F ? (1 << 9) : 0;
    x |= this.SR_CY ? (1 << 10) : 0;
    x |= this.SR_OV ? (1 << 11) : 0;
    x |= this.SR_OVE ? (1 << 12) : 0;
    x |= this.SR_DSX ? (1 << 13) : 0;
    x |= this.SR_EPH ? (1 << 14) : 0;
    x |= this.SR_FO ? (1 << 15) : 0;
    x |= this.SR_SUMRA ? (1 << 16) : 0;
    x |= (this.SR_CID << 28);
    return x;
};

SafeCPU.prototype.CheckForInterrupt = function () {
    if (!this.SR_IEE) {
        return;
    }
    if (this.PICMR & this.PICSR) {
        this.Exception(EXCEPT_INT, this.group0[SPR_EEAR_BASE]);
        this.pc = this.nextpc++;
    }
};

SafeCPU.prototype.RaiseInterrupt = function (line) {
    var lmask = 1 << line;
/*
    if (this.PICSR & lmask) {
        // Interrupt already signaled and pending
        // DebugMessage("Warning: Int pending, ignored");
    }
*/
    this.PICSR |= lmask;
    this.CheckForInterrupt();
};

SafeCPU.prototype.ClearInterrupt = function (line) {
    this.PICSR &= ~(1 << line);
};

SafeCPU.prototype.SetSPR = function (idx, x) {
    var address = idx & 0x7FF;
    var group = (idx >> 11) & 0x1F;

    switch (group) {
    case 1:
        // Data MMU
        this.group1[address] = x;
        return;
    case 2:
        // ins MMU
        this.group2[address] = x;
        return;
    case 3:
        // data cache, not supported
    case 4:
        // ins cache, not supported
        return;
    case 9:
        // pic
        switch (address) {
        case 0:
            this.PICMR = x | 0x3; // we use non maskable interrupt here
            // check immediate for interrupt
            if (this.SR_IEE) {
                if (this.PICMR & this.PICSR) {
                    DebugMessage("Error in SetSPR: Direct triggering of interrupt exception not supported?");
                    abort();
                }
            }
            break;
        case 2:
            this.PICSR = x;
            break;
        default:
            DebugMessage("Error in SetSPR: interrupt address not supported");
            abort();
        }
        return;
    case 10:
        //tick timer
        switch (address) {
        case 0:
            this.TTMR = x;
            if (((this.TTMR >> 30)&3) != 0x3) {
                DebugMessage("Error in SetSPR: Timer mode other than continuous not supported");
                abort();
            }
            break;
        default:
            DebugMessage("Error in SetSPR: Tick timer address not supported");
            abort();
            break;
        }
        return;

    default:
        break;
    }

    if (group != 0) {
        DebugMessage("Error in SetSPR: group " + group + " not found");
        abort();
    }

    switch (address) {
    case SPR_SR:
        this.SetFlags(x);
        break;
    case SPR_EEAR_BASE:
        this.group0[SPR_EEAR_BASE] = x;
        break;
    case SPR_EPCR_BASE:
        this.group0[SPR_EPCR_BASE] = x;
        break;
    case SPR_ESR_BASE:
        this.group0[SPR_ESR_BASE] = x;
        break;
    default:
        DebugMessage("Error in SetSPR: address " + hex8(address) + " not found");
        abort();
    }
};

SafeCPU.prototype.GetSPR = function (idx) {
    var address = idx & 0x7FF;
    var group = (idx >> 11) & 0x1F;

    switch (group) {
    case 1:
        return this.group1[address];
    case 2:
        return this.group2[address];

    case 9:
        // pic
        switch (address) {
        case 0:
            return this.PICMR;
        case 2:
            return this.PICSR;
        default:
            DebugMessage("Error in GetSPR: PIC address unknown");
            abort();
            break;
        }
        break;

    case 10:
        // tick Timer
        switch (address) {
        case 0:
            return this.TTMR;
        case 1:
            return this.TTCR; // or clock
        default:
            DebugMessage("Error in GetSPR: Tick timer address unknown");
            abort();
            break;
        }
        break;
    default:
        break;
    }

    if (group != 0) {
        DebugMessage("Error in GetSPR: group " + group +  " unknown");
        abort();
    }

    switch (idx) {
    case SPR_SR:
        return this.GetFlags();

    case SPR_UPR:
        // UPR present
        // data mmu present
        // instruction mmu present
        // PIC present (architecture manual seems to be wrong here)
        // Tick timer present
        return 0x619;

    case SPR_IMMUCFGR:
    case SPR_DMMUCFGR:
    case SPR_EEAR_BASE:
    case SPR_EPCR_BASE:
    case SPR_ESR_BASE:
        return this.group0[idx];
    case SPR_ICCFGR:
        return 0x48;
    case SPR_DCCFGR:
        return 0x48;
    case SPR_VR:
        return 0x12000001;
    default:
        DebugMessage("Error in GetSPR: address unknown");
        abort();
    }
};

SafeCPU.prototype.Exception = function (excepttype, addr) {
    var except_vector = excepttype | (this.SR_EPH ? 0xf0000000 : 0x0);
    //DebugMessage("Info: Raising Exception " + hex8(excepttype));

    this.SetSPR(SPR_EEAR_BASE, addr);
    this.SetSPR(SPR_ESR_BASE, this.GetFlags());

    this.SR_OVE = false;
    this.SR_SM = true;
    this.SR_IEE = false;
    this.SR_TEE = false;
    this.SR_DME = false;

    this.nextpc = except_vector>>2;

    switch (excepttype) {
    case EXCEPT_RESET:
        break;

    case EXCEPT_ITLBMISS:
    case EXCEPT_IPF:
    case EXCEPT_DTLBMISS:
    case EXCEPT_DPF:
    case EXCEPT_BUSERR:
    case EXCEPT_TICK:
    case EXCEPT_INT:
        this.SetSPR(SPR_EPCR_BASE, (this.pc<<2) - (this.delayedins ? 4 : 0));
        break;

    case EXCEPT_SYSCALL:
        this.SetSPR(SPR_EPCR_BASE, (this.pc<<2) + 4 - (this.delayedins ? 4 : 0));
        break;
    default:
        DebugMessage("Error in Exception: exception type not supported");
        abort();
    }
    this.delayedins = false;
    this.SR_IME = false;
};


SafeCPU.prototype.DTLBLookup = function (addr, write) {
    if (!this.SR_DME) {
        return addr;
    }
    // pagesize is 8192 bytes
    // nways are 1
    // nsets are 64

    var setindex = (addr >> 13) & 63;
    var tlmbr = this.group1[0x200 | setindex]; // match register
    if (((tlmbr & 1) == 0) || ((tlmbr >> 19) != (addr >> 19))) {
        this.Exception(EXCEPT_DTLBMISS, addr);
        return -1;
    }
        // set lru 
        if (tlmbr & 0xC0) {
            DebugMessage("Error: LRU ist not supported");
            abort();
        }
    
    var tlbtr = this.group1[0x280 | setindex]; // translate register

    // check if supervisor mode
    if (this.SR_SM) {
        if (
            ((!write) && (!(tlbtr & 0x100))) || // check if SRE
            ((write) && (!(tlbtr & 0x200)))     // check if SWE
           ) {
            this.Exception(EXCEPT_DPF, addr);
            return -1;
           }
    } else {
        if (
               ((!write) && (!(tlbtr & 0x40))) || // check if URE
               ((write) && (!(tlbtr & 0x80)))     // check if UWE
           ) {
            this.Exception(EXCEPT_DPF, addr);
            return -1;
           }
    }
    return ((tlbtr & 0xFFFFE000) | (addr & 0x1FFF));
};

// the slow and safe version
SafeCPU.prototype.GetInstruction = function (addr) {
    if (!this.SR_IME) {
        return this.ram.ReadMemory32(addr);
    }
    // pagesize is 8192 bytes
    // nways are 1
    // nsets are 64
    
    var setindex = (addr >> 13) & 63;
    setindex &= 63; // number of sets
    var tlmbr = this.group2[0x200 | setindex];

    // test if tlmbr is valid
    if (((tlmbr & 1) == 0) || ((tlmbr >> 19) != (addr >> 19))) {
            this.Exception(EXCEPT_ITLBMISS, this.pc<<2);
            return -1;
    }
    // set lru
    if (tlmbr & 0xC0) {
        DebugMessage("Error: LRU ist not supported");
        abort();
    }

    var tlbtr = this.group2[0x280 | setindex];
    //Test for page fault
    // check if supervisor mode
    if (this.SR_SM) {
        // check if user read enable is not set(URE)
        if (!(tlbtr & 0x40)) {
            this.Exception(EXCEPT_IPF, this.pc<<2);
            return -1;
        }
    } else {
        // check if supervisor read enable is not set (SRE)
        if (!(tlbtr & 0x80)) {
            this.Exception(EXCEPT_IPF, this.pc<<2);
            return -1;
        }
    }
    return this.ram.ReadMemory32((tlbtr & 0xFFFFE000) | (addr & 0x1FFF));
};

SafeCPU.prototype.Step = function (steps, clockspeed) {
    var ins = 0x0;
    var imm = 0x0;
    var i = 0;
    var rindex = 0x0;
    var rA = 0x0,
        rB = 0x0,
        rD = 0x0;

    // local variables could be faster
    var r = this.r;
    var f = this.f;
    var ram = this.ram;
    var int32mem = this.ram.int32mem;
    var group2 = this.group2;

    // to get the instruction
    var setindex = 0x0;
    var tlmbr = 0x0;
    var tlbtr = 0x0;
    var jump = 0x0;
    var delta = 0x0;

   
    do {
        this.clock++;

        // do this not so often
        if (!(steps & 63)) {
            // ---------- TICK ----------
            // timer enabled
            if ((this.TTMR >> 30) != 0) {
                delta = (this.TTMR & 0xFFFFFFF) - (this.TTCR & 0xFFFFFFF);
                delta += delta<0?0xFFFFFFF:0x0;
                this.TTCR = (this.TTCR + clockspeed) & 0xFFFFFFFF;
                if (delta < clockspeed) {
                    // if interrupt enabled
                    if (this.TTMR & (1 << 29)) {
                        this.TTMR |= (1 << 28); // set pending interrupt
                    }
                }
            }

            // check if pending and check if interrupt must be triggered
            if ((this.SR_TEE) && (this.TTMR & (1 << 28))) {
                this.Exception(EXCEPT_TICK, this.group0[SPR_EEAR_BASE]);
                this.pc = this.nextpc++;
            }
        }
        
        ins = this.GetInstruction(this.pc<<2)
        if (ins == -1) {
            this.pc = this.nextpc++;
            continue;
        }

        switch ((ins >> 26)&0x3F) {
        case 0x0:
            // j
            jump = this.pc + ((ins << 6) >> 6);
            this.pc = this.nextpc;
            this.nextpc = jump;
            this.delayedins = true;
            continue;

        case 0x1:
            // jal
            jump = this.pc + ((ins << 6) >> 6);
            r[9] = (this.nextpc<<2) + 4;
            this.pc = this.nextpc;
            this.nextpc = jump;
            this.delayedins = true;
            continue;

        case 0x3:
            // bnf
            if (this.SR_F) {
                break;
            }
            jump = this.pc + ((ins << 6) >> 6);
            this.pc = this.nextpc;
            this.nextpc = jump;
            this.delayedins = true;
            continue;
        case 0x4:
            // bf
            if (!this.SR_F) {
                break;
            }
            jump = this.pc + ((ins << 6) >> 6);
            this.pc = this.nextpc;
            this.nextpc = jump;
            this.delayedins = true;
            continue;
        case 0x5:
            // nop
            break;
        case 0x6:
            // movhi or macrc
            rindex = (ins >> 21) & 0x1F;
            // if 16th bit is set
            if (ins & 0x10000) {
                DebugMessage("Error: macrc not supported\n");
                abort();
            } else {
                r[rindex] = ((ins & 0xFFFF) << 16); // movhi
            }
            break;
        case 0x7: 
            // halt
            // the safe cpu should ignore it for now. 
        break;

        case 0x8:
            //sys
            this.Exception(EXCEPT_SYSCALL, this.group0[SPR_EEAR_BASE]);
            break;

        case 0x9:
            // rfe
            this.nextpc = this.GetSPR(SPR_EPCR_BASE)>>2;
            this.pc = this.nextpc++;
            this.delayedins = false;
            this.SetFlags(this.GetSPR(SPR_ESR_BASE)); // could raise an exception
            continue;

        case 0x11:
            // jr
            jump = r[(ins >> 11) & 0x1F]>>2;
            this.pc = this.nextpc;
            this.nextpc = jump;
            this.delayedins = true;
            continue;
        case 0x12:
            // jalr
            jump = r[(ins >> 11) & 0x1F]>>2;
            r[9] = (this.nextpc<<2) + 4;
            this.pc = this.nextpc;
            this.nextpc = jump;
            this.delayedins = true;
            continue;

        case 0x1B:
        case 0x21:
            // lwa and lwz
            r[32] = r[(ins >> 16) & 0x1F] + ((ins << 16) >> 16);
            if ((r[32] & 3) != 0) {
                DebugMessage("Error in lwz: no unaligned access allowed");
                abort();
            }
            r[33] = this.DTLBLookup(r[32], false);
            if (r[33] == -1) {
                break;
            }
            r[(ins >> 21) & 0x1F] = r[33]>0?ram.int32mem[r[33] >> 2]:ram.ReadMemory32(r[33]);
            break;

        case 0x23:
            // lbz
            r[32] = r[(ins >> 16) & 0x1F] + ((ins << 16) >> 16);
            r[33] = this.DTLBLookup(r[32], false);
            if (r[33] == -1) {
                break;
            }
            r[(ins >> 21) & 0x1F] = ram.ReadMemory8(r[33]);
            break;

        case 0x24:
            // lbs
            r[32] = r[(ins >> 16) & 0x1F] + ((ins << 16) >> 16);
            r[33] = this.DTLBLookup(r[32], false);
            if (r[33] == -1) {
                break;
            }
            r[(ins >> 21) & 0x1F] = ((ram.ReadMemory8(r[33])) << 24) >> 24;
            break;

        case 0x25:
            // lhz 
            r[32] = r[(ins >> 16) & 0x1F] + ((ins << 16) >> 16);
            r[33] = this.DTLBLookup(r[32], false);
            if (r[33] == -1) {
                break;
            }
            r[(ins >> 21) & 0x1F] = ram.ReadMemory16(r[33]);
            break;

        case 0x26:
            // lhs
            r[32] = r[(ins >> 16) & 0x1F] + ((ins << 16) >> 16);
            r[33] = this.DTLBLookup(r[32], false);
            if (r[33] == -1) {
                break;
            }
            r[(ins >> 21) & 0x1F] = (ram.ReadMemory16(r[33]) << 16) >> 16;
            break;

        case 0x27:
            // addi signed 
            imm = (ins << 16) >> 16;
            rA = r[(ins >> 16) & 0x1F];
            rindex = (ins >> 21) & 0x1F;
            r[rindex] = rA + imm;
            this.SR_CY = r[rindex] < rA;
            this.SR_OV = (((rA ^ imm ^ -1) & (rA ^ r[rindex])) & 0x80000000)?true:false;
            //TODO overflow and carry
            // maybe wrong
            break;

        case 0x29:
            // andi
            r[(ins >> 21) & 0x1F] = r[(ins >> 16) & 0x1F] & (ins & 0xFFFF);
            break;


        case 0x2A:
            // ori
            r[(ins >> 21) & 0x1F] = r[(ins >> 16) & 0x1F] | (ins & 0xFFFF);
            break;

        case 0x2B:
            // xori            
            rA = r[(ins >> 16) & 0x1F];
            r[(ins >> 21) & 0x1F] = rA ^ ((ins << 16) >> 16);
            break;

        case 0x2D:
            // mfspr
            r[(ins >> 21) & 0x1F] = this.GetSPR(r[(ins >> 16) & 0x1F] | (ins & 0xFFFF));
            break;

        case 0x2E:
            switch ((ins >> 6) & 0x3) {
            case 0:
                // slli
                r[(ins >> 21) & 0x1F] = r[(ins >> 16) & 0x1F] << (ins & 0x1F);
                break;
            case 1:
                // rori
                r[(ins >> 21) & 0x1F] = r[(ins >> 16) & 0x1F] >>> (ins & 0x1F);
                break;
            case 2:
                // srai
                r[(ins >> 21) & 0x1F] = r[(ins >> 16) & 0x1F] >> (ins & 0x1F);
                break;
            default:
                DebugMessage("Error: opcode 2E function not implemented");
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
                this.SR_F = (r[(ins >> 16) & 0x1F] == imm) ? true : false;
                break;
            case 0x1:
                // sfnei
                this.SR_F = (r[(ins >> 16) & 0x1F] != imm) ? true : false;
                break;
            case 0x2:
                // sfgtui
                this.SR_F = ((r[(ins >> 16) & 0x1F]>>>0) > (imm >>> 0)) ? true : false;
                break;
            case 0x3:
                // sfgeui
                this.SR_F = ((r[(ins >> 16) & 0x1F]>>>0) >= (imm >>> 0)) ? true : false;
                break;
            case 0x4:
                // sfltui
                this.SR_F = ((r[(ins >> 16) & 0x1F]>>>0) < (imm >>> 0)) ? true : false;
                break;
            case 0x5:
                // sfleui
                this.SR_F = ((r[(ins >> 16) & 0x1F]>>>0) <= (imm >>> 0)) ? true : false;
                break;
            case 0xa:
                // sfgtsi
                this.SR_F = (r[(ins >> 16) & 0x1F] > imm) ? true : false;
                break;
            case 0xb:
                // sfgesi
                this.SR_F = (r[(ins >> 16) & 0x1F] >= imm) ? true : false;
                break;
            case 0xc:
                // sfltsi
                this.SR_F = (r[(ins >> 16) & 0x1F] < imm) ? true : false;
                break;
            case 0xd:
                // sflesi
                this.SR_F = (r[(ins >> 16) & 0x1F] <= imm) ? true : false;
                break;
            default:
                DebugMessage("Error: sf...i not supported yet");
                abort();
                break;
            }
            break;

        case 0x30:
            // mtspr
            imm = (ins & 0x7FF) | ((ins >> 10) & 0xF800);
            this.pc = this.nextpc++;
            this.delayedins = false;
            this.SetSPR(r[(ins >> 16) & 0x1F] | imm, r[(ins >> 11) & 0x1F]); // could raise an exception
            continue;

       case 0x32:
            // floating point
            rA = (ins >> 16) & 0x1F;
            rB = (ins >> 11) & 0x1F;
            rD = (ins >> 21) & 0x1F;
            switch (ins & 0xFF) {
            case 0x0:
                // lf.add.s
                f[rD] = f[rA] + f[rB];
                break;
            case 0x1:
                // lf.sub.s
                f[rD] = f[rA] - f[rB];
                break;
            case 0x2:
                // lf.mul.s
                f[rD] = f[rA] * f[rB];
                break;
            case 0x3:
                // lf.div.s
                f[rD] = f[rA] / f[rB];
                break;
            case 0x4:
                // lf.itof.s
                f[rD] = r[rA];
                break;
            case 0x5:
                // lf.ftoi.s
                r[rD] = f[rA];
                break;
            case 0x7:
                // lf.madd.s
                f[rD] += f[rA] * f[rB];
                break;
            case 0x8:
                // lf.sfeq.s
                this.SR_F = (f[rA] == f[rB]) ? true : false;
                break;
            case 0x9:
                // lf.sfne.s
                this.SR_F = (f[rA] != f[rB]) ? true : false;
                break;
            case 0xa:
                // lf.sfgt.s
                this.SR_F = (f[rA] > f[rB]) ? true : false;
                break;
            case 0xb:
                // lf.sfge.s
                this.SR_F = (f[rA] >= f[rB]) ? true : false;
                break;
            case 0xc:
                // lf.sflt.s
                this.SR_F = (f[rA] < f[rB]) ? true : false;
                break;
            case 0xd:
                // lf.sfle.s
                this.SR_F = (f[rA] <= f[rB]) ? true : false;
                break;
            default:
                DebugMessage("Error: lf. function " + hex8(ins & 0xFF) + " not supported yet");
                abort();
                break;
            }
            break;

        case 0x33:
            // swa
            imm = ((((ins >> 10) & 0xF800) | (ins & 0x7FF)) << 16) >> 16;
            r[32] = r[(ins >> 16) & 0x1F] + imm;
            if (r[32] & 0x3) {
                DebugMessage("Error in sw: no aligned memory access");
                abort();
            }
            r[33] = this.DTLBLookup(r[32], true);
            if (r[33] == -1) {
                break;
            }
            if (r[33]>0) {
                int32mem[r[33] >> 2] = r[(ins >> 11) & 0x1F];
            } else {
                ram.WriteMemory32(r[33], r[(ins >> 11) & 0x1F]);
            }
            this.SR_F = true;
            break;
            
        case 0x35:
            // sw
            imm = ((((ins >> 10) & 0xF800) | (ins & 0x7FF)) << 16) >> 16;
            r[32] = r[(ins >> 16) & 0x1F] + imm;
            if (r[32] & 0x3) {
                DebugMessage("Error in sw: no aligned memory access");
                abort();
            }
            r[33] = this.DTLBLookup(r[32], true);
            if (r[33] == -1) {
                break;
            }
            if (r[33]>0) {
                int32mem[r[33] >> 2] = r[(ins >> 11) & 0x1F];
            } else {
                ram.WriteMemory32(r[33], r[(ins >> 11) & 0x1F]);
            }
            break;


        case 0x36:
            // sb
            imm = ((((ins >> 10) & 0xF800) | (ins & 0x7FF)) << 16) >> 16;
            r[32] = r[(ins >> 16) & 0x1F] + imm;
            r[33] = this.DTLBLookup(r[32], true);
            if (r[33] == -1) {
                break;
            }
            ram.WriteMemory8(r[33], r[(ins >> 11) & 0x1F]);
            break;

        case 0x37:
            // sh
            imm = ((((ins >> 10) & 0xF800) | (ins & 0x7FF)) << 16) >> 16;
            r[32] = r[(ins >> 16) & 0x1F] + imm;
            r[33] = this.DTLBLookup(r[32], true);
            if (r[33] == -1) {
                break;
            }
            ram.WriteMemory16(r[33], r[(ins >> 11) & 0x1F]);
            break;

        case 0x38:
            // three operands commands
            rA = r[(ins >> 16) & 0x1F];
            rB = r[(ins >> 11) & 0x1F];
            rindex = (ins >> 21) & 0x1F;
            switch (ins & 0x3CF) {
            case 0x0:
                // add signed 
                r[rindex] = rA + rB;
                this.SR_CY = r[rindex] < rA;
                this.SR_OV = (((rA ^ rB ^ -1) & (rA ^ r[rindex])) & 0x80000000)?true:false;
                //TODO overflow and carry
                break;
            case 0x2:
                // sub signed
                r[rindex] = rA - rB;
                //TODO overflow and carry
                this.SR_CY = (rB > rA);
                this.SR_OV = (((rA ^ rB) & (rA ^ r[rindex])) & 0x80000000)?true:false;                
                break;
            case 0x3:
                // and
                r[rindex] = rA & rB;
                break;
            case 0x4:
                // or
                r[rindex] = rA | rB;
                break;
            case 0x5:
                // or
                r[rindex] = rA ^ rB;
                break;
            case 0x8:
                // sll
                r[rindex] = rA << (rB & 0x1F);
                break;
            case 0x48:
                // srl not signed
                r[rindex] = rA >>> (rB & 0x1F);
                break;
            case 0xf:
                // ff1
                r[rindex] = 0;
                for (i = 0; i < 32; i++) {
                    if (rA & (1 << i)) {
                        r[rindex] = i + 1;
                        break;
                    }
                }
                break;
            case 0x88:
                // sra signed
                r[rindex] = rA >> (rB & 0x1F);
                break;
            case 0x10f:
                // fl1
                r[rindex] = 0;
                for (i = 31; i >= 0; i--) {
                    if (rA & (1 << i)) {
                        r[rindex] = i + 1;
                        break;
                    }
                }
                break;
            case 0x306:
                // mul signed (specification seems to be wrong)
                {
                    // this is a hack to do 32 bit signed multiply. Seems to work but needs to be tested. 
                    r[rindex] = int32(rA >> 0) * int32(rB);
                    var rAl = rA & 0xFFFF;
                    var rBl = rB & 0xFFFF;
                    r[rindex] = r[rindex] & 0xFFFF0000 | ((rAl * rBl) & 0xFFFF);
                    var result = Number(int32(rA)) * Number(int32(rB));
                    this.SR_OV = (result < (-2147483647 - 1)) || (result > (2147483647));
                    var uresult = uint32(rA) * uint32(rB);
                    this.SR_CY = (uresult > (4294967295));
                }
                break;
            case 0x30a:
                // divu (specification seems to be wrong)
                this.SR_CY = rB == 0;
                this.SR_OV = false;
                if (!this.SR_CY) {
                    r[rindex] = /*Math.floor*/((rA>>>0) / (rB>>>0));
                }
                break;
            case 0x309:
                // div (specification seems to be wrong)
                this.SR_CY = rB == 0;
                this.SR_OV = false;
                if (!this.SR_CY) {
                    r[rindex] = rA / rB;
                }

                break;
            default:
                DebugMessage("Error: op38 opcode not supported yet");
                abort();
                break;
            }
            break;

        case 0x39:
            // sf....
            switch ((ins >> 21) & 0x1F) {
            case 0x0:
                // sfeq
                this.SR_F = (r[(ins >> 16) & 0x1F] == r[(ins >> 11) & 0x1F]) ? true : false;
                break;
            case 0x1:
                // sfne
                this.SR_F = (r[(ins >> 16) & 0x1F] != r[(ins >> 11) & 0x1F]) ? true : false;
                break;
            case 0x2:
                // sfgtu
                this.SR_F = ((r[(ins >> 16) & 0x1F]>>>0) > (r[(ins >> 11) & 0x1F]>>>0)) ? true : false;
                break;
            case 0x3:
                // sfgeu
                this.SR_F = ((r[(ins >> 16) & 0x1F]>>>0) >= (r[(ins >> 11) & 0x1F]>>>0)) ? true : false;
                break;
            case 0x4:
                // sfltu
                this.SR_F = ((r[(ins >> 16) & 0x1F]>>>0) < (r[(ins >> 11) & 0x1F]>>>0)) ? true : false;
                break;
            case 0x5:
                // sfleu
                this.SR_F = ((r[(ins >> 16) & 0x1F]>>>0) <= (r[(ins >> 11) & 0x1F]>>>0)) ? true : false;
                break;
            case 0xa:
                // sfgts
                this.SR_F = (r[(ins >> 16) & 0x1F] > r[(ins >> 11) & 0x1F]) ? true : false;
                break;
            case 0xb:
                // sfges
                this.SR_F = (r[(ins >> 16) & 0x1F] >= r[(ins >> 11) & 0x1F]) ? true : false;
                break;
            case 0xc:
                // sflts
                this.SR_F = (r[(ins >> 16) & 0x1F] < r[(ins >> 11) & 0x1F]) ? true : false;
                break;
            case 0xd:
                // sfles
                this.SR_F = (r[(ins >> 16) & 0x1F] <= r[(ins >> 11) & 0x1F]) ? true : false;
                break;
            default:
                DebugMessage("Error: sf.... function supported yet");
                abort();
            }
            break;

        default:
            DebugMessage("Error: Instruction with opcode " + hex8(ins >>> 26) + " not supported");
            abort();
            break;
        }

        this.pc = this.nextpc++;
        this.delayedins = false;

    } while (--steps); // main loop
    return 0;
};

