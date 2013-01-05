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
function CPU() {
    //registers
    var array = new ArrayBuffer(32 << 2);
    this.r = new Uint32Array(array);

    // special purpose registers
    var array = new ArrayBuffer(1024 << 2);
    this.group0 = new Uint32Array(array);

    // data tlb
    var array = new ArrayBuffer(1024 << 2);
    this.group1 = new Uint32Array(array);

    // instruction tlb
    var array = new ArrayBuffer(1024 << 2);
    this.group2 = new Uint32Array(array);

    // define variables and initialize
    this.pc = 0x0; // instruction pointer
    this.nextpc = 0x0; // pointer to next instruction
    //this.ins=0x0; // current instruction to handle

    this.jump = 0x0; // jump address
    this.jumpdelayed = false; // if true then: the jump is delayed by one instruction. This is used for saving in the step function

    this.delayedins = false; // the current instruction is an delayed instruction, ine cycle before a jump
    this.interrupt_pending = false;

    // current instruction tlb, needed for fast lookup
    this.instlb = 0x0;

    //this.clock = 0x0;

    this.TTMR = 0x0; // Tick timer mode register
    this.TTCR = 0x0; // Tick timer count register

    this.PICMR = 0x3; // interrupt controller mode register??? (use nmi)
    this.PICSR = 0x0; // interrupt controller set register???

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

    this.group0[SPR_IMMUCFGR] = 0x18; // 0 ITLB has one way and 64 sets
    this.group0[SPR_DMMUCFGR] = 0x18; // 0 DTLB has one way and 64 sets

    this.Exception(EXCEPT_RESET, 0x0); // set pc values
}

CPU.prototype.SetFlags = function(x) {
    /*
    if (this.SR_SM != ((x&1)?true:false)) {
        DebugMessage("Supervisor: " + this.SR_SM);
    }
    */
    this.SR_SM = (x & (1 << 0)) ? true : false;
    this.SR_TEE = (x & (1 << 1)) ? true : false;
    var old_SR_IEE = this.SR_IEE;
    this.SR_IEE = (x & (1 << 2)) ? true : false;
    this.SR_DCE = (x & (1 << 3)) ? true : false;
    this.SR_ICE = (x & (1 << 4)) ? true : false;
    this.SR_DME = (x & (1 << 5)) ? true : false;
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
    this.SR_CID = (x >>> 28) & 0xF;
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

CPU.prototype.GetFlags = function() {
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

CPU.prototype.CheckForInterrupt = function() {
    if (!this.SR_IEE) {
        return;
    }
    if (this.PICMR & this.PICSR) {
        if (this.PICSR) {
            this.interrupt_pending = true;
            /*
		    // Do it here. Save one comparison in the main loop
		    this.Exception(EXCEPT_INT, this.group0[SPR_EEAR_BASE]);
		    this.delayedins = false;		
		    */
        }
    }
};

CPU.prototype.RaiseInterrupt = function(line) {
    var lmask = 1 << line;
    if (this.PICSR & lmask) {
        // Interrupt already signaled and pending
        //		DebugMessage("Warning: Int pending, ignored");
    }
    this.PICSR |= lmask;
    this.CheckForInterrupt();
};

CPU.prototype.ClearInterrupt = function(line) {
    this.PICSR &= ~ (1 << line);
};

CPU.prototype.SetSPR = function(idx, x) {
    var address = idx & 0x7FF;
    var group = (idx >>> 11) & 0x1F;

    switch (group) {
    case 1:
        // Data MMU
        this.group1[address] = x;
        return;
        break;
    case 2:
        // ins MMU
        this.group2[address] = x;
        return;
        break;
    case 3:
        // data cache, not supported
    case 4:
        // ins cache, not supported
        return;
        break;
    case 9:
        // pic
        switch (address) {
        case 0:
            this.PICMR = x | 0x3; // we use non maskable interrupt here
            // check immediate for interrupt
            if (this.SR_IEE) {
                if (this.PICMR & this.PICSR) {
                    DebugMessage("Error in SetSPR: Direct triggering interrupt exception not supported? What the hell?");
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
        break;
    case 10:
        //tick timer
        switch (address) {
        case 0:
            this.TTMR = x;
            if ((this.TTMR >>> 30) != 0x3) {
                DebugMessage("Error in SetSPR: Timer mode other than continuous not supported");
                abort();
            }
            // for compatbility with or1ksim. Strange. Disable TTMR when in continous mode and cycles match. 
            // we solve it by totally disable the timer. Seems to work with Linux
            if ((this.TTMR & 0xFFFFFF) == (this.TTCR & 0xFFFFFF)) {
                this.TTMR &= 0x3FFFFFFF;
            }
            break;
        case 1:
        default:
            DebugMessage("Error in SetSPR: Tick timer address not supported");
            abort();
            break;
        }
        return;
        break;

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
        DebugMessage("Error in SetSPR: address not found");
        abort();
    }
};

CPU.prototype.GetSPR = function(idx) {
    var address = idx & 0x7FF;
    var group = (idx >>> 11) & 0x1F;

    switch (group) {
    case 9:
        // pic		
        switch (address) {
        case 0:
            return this.PICMR;
            break;
        case 2:
            return this.PICSR;
            break;
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
            break;
        case 1:
            return this.TTCR; // or clock
            break;
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
        DebugMessage("Error in GetSPR: group unknown");
        abort();
    }

    switch (idx) {
    case SPR_SR:
        return this.GetFlags();
        break;

    case SPR_UPR:
        return 0x619;
        // UPR present
        // data mmu present
        // instruction mmu present
        // PIC present (architecture manual seems to be wrong here)
        // Tick timer present
        break;

    case SPR_IMMUCFGR:
    case SPR_DMMUCFGR:
    case SPR_EEAR_BASE:
    case SPR_EPCR_BASE:
    case SPR_ESR_BASE:
        return this.group0[idx];
        break;
    case SPR_ICCFGR:
        return 0x48;
        break;
    case SPR_DCCFGR:
        return 0x48;
        break;
    case SPR_VR:
        return 0x12000001;
        break;
    default:
        DebugMessage("Error in GetSPR: address unknown");
        abort();
    }
};

CPU.prototype.Exception = function(excepttype, addr) {
    var except_vector = excepttype | (this.SR_EPH ? 0xf0000000 : 0x00000000);
    //DebugMessage("Info: Raising Exception " + hex8(excepttype));

    this.SetSPR(SPR_EEAR_BASE, addr);
    this.SetSPR(SPR_ESR_BASE, this.GetFlags());

    this.SR_OVE = false;
    this.SR_SM = true;
    this.SR_IEE = false;
    this.SR_TEE = false;
    this.SR_DME = false;

    this.instlb = 0x0;

    this.nextpc = except_vector;

    switch (excepttype) {
    case EXCEPT_RESET:
        break;

    case EXCEPT_ITLBMISS:
    case EXCEPT_IPF:
        this.SetSPR(SPR_EPCR_BASE, addr - (this.delayedins ? 4 : 0));
        break;
    case EXCEPT_DTLBMISS:
    case EXCEPT_DPF:
    case EXCEPT_BUSERR:
        this.SetSPR(SPR_EPCR_BASE, this.pc - (this.delayedins ? 4 : 0));
        break;

    case EXCEPT_TICK:
    case EXCEPT_INT:
        this.SetSPR(SPR_EPCR_BASE, this.pc - (this.delayedins ? 4 : 0));
        this.pc = this.nextpc;
        this.nextpc = this.pc + 4;
        break;
    case EXCEPT_SYSCALL:
        this.SetSPR(SPR_EPCR_BASE, this.pc + 4 - (this.delayedins ? 4 : 0));
        break;
    default:
        DebugMessage("Error in Exception: exception type not supported");
        abort();
    }
    this.SR_IME = false;
};

CPU.prototype.DTLBRefill = function(addr, nsets) {

    if (ram.uint32mem[0x900 >>> 2] != 0x000005C0) {
        cpu.Exception(EXCEPT_DTLBMISS, addr);
        return false;
    }
    var r2, r3, r5, r4;
    r2 = addr;
    // get_current_PGD  using r3 and r5 // it is saved in 0xc03c80a4
    r3 = ram.uint32mem[0x004aa0a4 >>> 2]; // current pgd
    r4 = (r2 >>> 0x18) << 2;
    r5 = r4 + r3;

    r4 = (0x40000000 + r5) & 0xFFFFFFFF; //r4 = phys(r5)

    r3 = ram.uint32mem[r4 >>> 2];

    if (r3 == 0) {
        //DebugMessage("Error in DTLBRefill: Page fault 1\n");
        this.Exception(EXCEPT_DPF, addr);
        return false;
        //abort();
        //	d_pmd_none:
        //	page fault
    }

    //r3 = r3 & ~PAGE_MASK // 0x1fff // sense? delayed jump???
    r3 = 0xffffe000;
    //d_pmd_good:

    r4 = ram.uint32mem[r4 >>> 2]; // get pmd value
    r4 = r4 & r3; // & PAGE_MASK
    r5 = r2 >>> 0xD;
    r3 = r5 & 0x7FF;
    r3 = r3 << 0x2;
    r3 = r3 + r4;
    r2 = ram.uint32mem[r3 >>> 2];

    if ((r2 & 1) == 0) {
        //DebugMessage("Error in DTLBRefill: pte not pressent\n");
        this.Exception(EXCEPT_DPF, addr);
        return false;
        //d_pmd_none:
        //page fault
    }
    //r3 = 0xFFFFe3fa; // PAGE_MASK | DTLB_UP_CONVERT_MASK

    // fill dtlb tr register
    r4 = r2 & 0xFFFFe3fa;
    //r6 = (this.group0[SPR_DMMUCFGR] & 0x1C) >>> 0x2;
    //r3 = 1 << r6; // number of DMMU sets
    //r6 = r3 - 1; // mask register
    //r5 &= r6;
    r5 &= nsets - 1;
    this.group1[0x280 | r5] = r4;
    //SPR_DTLBTR_BASE(0)|r5 = r4 // SPR_DTLBTR_BASE = 0x280 * (WAY*0x100)

    //fill DTLBMR register
    r2 = addr;
    r4 = r2 & 0xFFFFE000;
    r4 = r4 | 0x1;
    this.group1[0x200 | r5] = r4;
    // SPR_DTLBMR_BASE(0)|r5 = r4  // SPR_DTLBMR_BASE = 0x200 * (WAY*0x100)
    return true;
};

CPU.prototype.ITLBRefill = function(addr, nsets) {

    if (ram.uint32mem[0xA00 >>> 2] != 0x000005C2) {
        cpu.Exception(EXCEPT_ITLBMISS, addr);
        return false;
    }
    var r2 = 0x0,
        r3 = 0x0,
        r5 = 0x0,
        r4 = 0x0;

    r2 = addr;
    // get_current_PGD  using r3 and r5
    r3 = ram.uint32mem[0x004aa0a4 >>> 2]; // current pgd
    r4 = (r2 >>> 0x18) << 2;
    r5 = r4 + r3;

    r4 = (0x40000000 + r5) & 0xFFFFFFFF; //r4 = phys(r5)
    r3 = ram.uint32mem[r4 >>> 2];

    if (r3 == 0) {
        this.Exception(EXCEPT_DPF, addr);
        return false;
        //	d_pmd_none:
        //	page fault
    }

    //r3 = r3 & ~PAGE_MASK // 0x1fff // sense? delayed jump???
    r3 = 0xffffe000; // or 0xffffe3fa ??? PAGE_MASK
    //i_pmd_good:

    r4 = ram.uint32mem[r4 >>> 2]; // get pmd value
    r4 = r4 & r3; // & PAGE_MASK
    r5 = r2 >>> 0xD;
    r3 = r5 & 0x7FF;
    r3 = r3 << 0x2;
    r3 = r3 + r4;
    r2 = ram.uint32mem[r3 >>> 2];

    if ((r2 & 1) == 0) {
        this.Exception(EXCEPT_IPF, addr);
        return false;
        //d_pmd_none:
        //page fault
    }
    //r3 = 0xFFFFe03a; // PAGE_MASK | ITLB_UP_CONVERT_MASK

    // fill dtlb tr register
    r4 = r2 & 0xFFFFe03a; // apply the mask
    r3 = r2 & 0x7c0; // PAGE_EXEC, Page_SRE, PAGE_SWE, PAGE_URE, PAGE_UWE

    if (r3 != 0x0) {
        //not itlb_tr_fill....
        //r6 = (this.group0[SPR_IMMUCFGR] & 0x1C) >>> 0x2;
        //r3 = 1 << r6; // number of DMMU sets
        //r6 = r3 - 1; // mask register
        //r5 &= r6;	
        r5 &= nsets - 1;
        //itlb_tr_fill_workaround:
        r4 |= 0xc0; // SPR_ITLBTR_UXE | ITLBTR_SXE
    }
    // itlb_tr_fill:

    this.group2[0x280 | r5] = r4; // SPR_ITLBTR_BASE(0)|r5 = r4 // SPR_ITLBTR_BASE = 0x280 * (WAY*0x100)

    //fill ITLBMR register
    r2 = addr;
    // r3 = 
    r4 = r2 & 0xFFFFE000;
    r4 = r4 | 0x1;
    this.group2[0x200 | r5] = r4; // SPR_DTLBMR_BASE(0)|r5 = r4  // SPR_DTLBMR_BASE = 0x200 * (WAY*0x100)
    return true;
};

CPU.prototype.DTLBLookup = function(addr, write) {
    if (!this.SR_DME) {
        return addr >>> 0;
    }

    // pagesize is 8192 bytes
    // nways are 1
    // nsets are 64

    var setindex = (addr >>> 13) & 63; // check this values
    var tlmbr = this.group1[0x200 | setindex]; // match register
    if (((tlmbr & 1) == 0) || ((tlmbr & 0xFFF80000) != (addr & 0xFFF80000))) {
        // use tlb refill to fasten up
        // return ((cpu_state.sprs[SPR_ITLBTR_BASE(minway) + set] & SPR_ITLBTR_PPN) >> 12) * immu->pagesize + (virtaddr % immu->pagesize); 
        //define SPR_ITLBTR_BASE(WAY)        (SPRGROUP_IMMU + 0x280 + (WAY) * 0x100) 
        //return (((this.group1[0x280 + setindex] & 0xffffe000) >>> 12) << 13) + (addr & 0x1FFF); 

        if (cpu.DTLBRefill(addr, 64)) {
            tlmbr = this.group1[0x200 + setindex];
        }
        else {
            return 0xFFFFFFFF;
        }

        //cpu.Exception(EXCEPT_DTLBMISS, addr); // if you don't use hardware
        //return 0xFFFFFFFF;
    }
    /*	
	// set lru 
	if (tlmbr & 0xC0) {
		DebugMessage("Error: LRU ist nor supported");
		abort();		
	}
    */
    var tlbtr = this.group1[0x280 | setindex]; // translate register

    // Test for page fault
    // Skip this to be faster

    // check if supervisor mode
    if (this.SR_SM) {
        if (
            ((!write) && (!(tlbtr & 0x100))) || // check if SRE
            ((write) && (!(tlbtr & 0x200))) // check if SWE
        ) {
            this.Exception(EXCEPT_DPF, addr);
            return 0xFFFFFFFF;
        }
    }
    else {
        if (
            ((!write) && (!(tlbtr & 0x40))) || // check if URE
            ((write) && (!(tlbtr & 0x80))) // check if UWE
        ) {
            this.Exception(EXCEPT_DPF, addr);
            return 0xFFFFFFFF;
        }
    }
    return ((tlbtr & 0xFFFFE000) | (addr & 0x1FFF)) >>> 0;
};

// the slow version
CPU.prototype.GetInstruction = function(addr) {
    if (!this.SR_IME) {
        return ram.ReadMemory32(uint32(addr));
    }

    // pagesize is 8192 bytes
    // nways are 1
    // nsets are 64

    var setindex = (addr & 0xFFFFE000) >>> 13; // check this values
    // at the moment we have only 64 entries in immu. Look in group0
    setindex &= 63; // number of sets
    var tlmbr = this.group2[0x200 | setindex];

    // test if tlmbr is valid
    if (
        ((tlmbr & 1) == 0) || //test if valid
        ((tlmbr & 0xFFF80000) != (addr & 0xFFF80000))) {
        /*
		if (cpu.ITLBRefill(addr, 64)) {
			tlmbr = this.group2[0x200 | setindex];
		}
        else {
            return 0xFFFFFFFF;
		}
        */
        this.Exception(EXCEPT_ITLBMISS, this.pc);
        return 0xFFFFFFFF;
    }
    // set lru
    if (tlmbr & 0xC0) {
        DebugMessage("Error: LRU ist nor supported");
        abort();
    }

    var tlbtr = this.group2[0x280 | setindex];
    //Test for page fault
    // check if supervisor mode
    if (this.SR_SM) {
        // check if user read enable is not set(URE)
        if (!(tlbtr & 0x40)) {
            this.Exception(EXCEPT_IPF, this.pc);
            return 0xFFFFFFFF;
        }
    }
    else {
        // check if supervisor read enable is not set (SRE)
        if (!(tlbtr & 0x80)) {
            this.Exception(EXCEPT_IPF, this.pc);
            return 0xFFFFFFFF;
        }
    }

    return ram.ReadMemory32(uint32((tlbtr & 0xFFFFE000) | (addr & 0x1FFF)));
};

CPU.prototype.Step = function(steps) {
    var ins = 0x0;
    var imm = 0x0;
    var rD = 0x0,
        rA = 0x0,
        rB = 0x0;

    // local variables could be faster
    var r = this.r;
    var uint32mem = ram.uint32mem;
    var group2 = this.group2;

    // to get the instruction
    var setindex = 0x0;
    var tlmbr = 0x0;
    var tlbtr = 0x0;
    var pc = 0x0;

    // fast tlb, contains only the current page
    //var instlb = 0x0;

    do {
        //this.clock++;
        this.pc = this.nextpc;

        if (this.jumpdelayed) {
            this.nextpc = this.jump;
            this.jumpdelayed = false;
            this.delayedins = true;
        }
        else {
            this.nextpc += 4;
            this.delayedins = false;
        }

        // do this not so often
        if ((steps & 7) == 0) {

            // ---------- TICK ----------
            // timer enabled
            if ((this.TTMR >>> 30) != 0) {
                this.TTCR += 16;
                //this.TTCR++;
                //if ((this.TTCR & 0xFFFFFFF) >= (this.TTMR & 0xFFFFFFF)) {
                if ((this.TTCR & 0xFFFFFF0) == (this.TTMR & 0xFFFFFF0)) {
                    if ((this.TTMR >>> 30) != 0x3) {
                        DebugMessage("Error: Timer mode other than continuous not supported");
                        abort();
                    }
                    // if interrupt enabled
                    if (this.TTMR & (1 << 29)) {
                        this.TTMR |= (1 << 28); // set pending interrupt
                    }
                }
            }

            // check if pending and check if interrupt must be triggered
            if ((this.SR_TEE) && (this.TTMR & (1 << 28))) {
                this.Exception(EXCEPT_TICK, this.group0[SPR_EEAR_BASE]);
                this.delayedins = false;
            }
            else {
                // the interrupt is executed immediately. Saves one comparison
                // test it here instead every time,
                if (this.interrupt_pending) {
                    this.interrupt_pending = false;
                    // check again because there could be another exception during this one cycle
                    if ((this.PICSR) && (this.SR_IEE)) {
                        this.Exception(EXCEPT_INT, this.group0[SPR_EEAR_BASE]);
                        this.delayedins = false;
                    }
                }
            }
        }

        // Get Instruction Fast version	
        // short check if it is still the correct page
        if (!((pc ^ this.pc) & 0xFFFFE000)) {
            pc = this.pc;
            ins = uint32mem[(this.instlb ^ pc) >>> 2];
        }
        else {
            pc = this.pc;
            if (!this.SR_IME) {
                ins = uint32mem[pc >>> 2];
                this.instlb = 0x0;
            }
            else {
                setindex = (pc >>> 13) & 63; // check this values
                tlmbr = group2[0x200 | setindex];
                // test if tlmbr is valid
                if (
                    ((tlmbr & 1) == 0) || //test if valid
                    ((tlmbr & 0xFFF80000) != (pc & 0xFFF80000))) {
                    if (this.ITLBRefill(pc, 64)) {
                        tlmbr = group2[0x200 | setindex]; // reload the new value
                    }
                    else {
                        this.delayedins = false;
                        this.jumpdelayed = false;
                        continue;
                    }
                }
                tlbtr = group2[0x280 | setindex];
                this.instlb = (tlbtr ^ tlmbr) & 0xFFFFE000;
                //ins = uint32mem[((tlbtr&0xFFFFE000) | (pc & 0x1FFF))>>>2];
                ins = uint32mem[(this.instlb ^ pc) >>> 2];
            }
        }

        /*	
        // for the slow variant
	    pc = this.pc;
	    ins = this.GetInstruction(this.pc)
	    if (ins == 0xFFFFFFFF) {
		    this.delayedins = false;
		    this.jumpdelayed = false;
		    continue;
	    }
	    this.ins = ins; // copy for Status of cpu
        */

        switch (ins >>> 26) {
        case 0x0:
            // j
            //imm |= (imm&0x8000000)?0xF0000000:0;
            this.jump = pc + (((ins & 0x3FFFFFF) << 6) >> 4);
            this.jumpdelayed = true;
            break;

        case 0x1:
            // jal
            //imm |= (imm&0x8000000)?0xF0000000:0;
            this.jump = pc + (((ins & 0x3FFFFFF) << 6) >> 4);
            r[9] = this.nextpc + 4;
            this.jumpdelayed = true;
            break;

        case 0x3:
            // bnf
            if (this.SR_F) {
                break;
            }
            //imm |= (imm&0x8000000)?0xF0000000:0;
            this.jump = pc + (((ins & 0x3FFFFFF) << 6) >> 4);
            this.jumpdelayed = true;
            break;

        case 0x4:
            // bf
            if (!this.SR_F) {
                break;
            }
            //imm |= (imm&0x8000000)?0xF0000000:0;
            this.jump = pc + (((ins & 0x3FFFFFF) << 6) >> 4);
            this.jumpdelayed = true;
            break;

        case 0x5:
            // nop
            break;


        case 0x6:
            // movhi or macrc
            rD = (ins >>> 21) & 0x1F;
            // if 16th bit is set
            if (ins & 0x10000) {
                DebugMessage("Error: macrc not supported\n");
                abort();
            }
            else r[rD] = ((ins & 0xFFFF) << 16); // movhi
            break;

        case 0x8:
            //sys
            cpu.Exception(EXCEPT_SYSCALL, this.group0[SPR_EEAR_BASE]);
            break;

        case 0x9:
            // rfe
            this.nextpc = this.GetSPR(SPR_EPCR_BASE);
            this.SetFlags(this.GetSPR(SPR_ESR_BASE));
            break;

        case 0x11:
            // jr
            this.jump = r[(ins >>> 11) & 0x1F];
            this.jumpdelayed = true;
            break;

        case 0x12:
            // jalr
            this.jump = r[(ins >>> 11) & 0x1F];
            r[9] = this.nextpc + 4;
            this.jumpdelayed = true;
            break;


        case 0x11:
            // jr
            this.jump = r[(ins >>> 11) & 0x1F];
            this.jumpdelayed = true;
            break;

        case 0x21:
            // lwz 
            //imm |= (imm&0x8000)?0xFFFF0000:0;
            rA = r[(ins >>> 16) & 0x1F] + (((ins & 0xFFFF) << 16) >> 16);
            if ((rA & 3) != 0) {
                DebugMessage("Error: no unaligned access allowed");
                abort();
            }
            imm = this.DTLBLookup(rA, false);
            if (imm == 0xFFFFFFFF) {
                break;
            }
            r[(ins >>> 21) & 0x1F] = ram.ReadMemory32(imm);
            break;

        case 0x23:
            // lbz
            //imm |= (imm&0x8000)?0xFFFF0000:0;
            rA = r[(ins >>> 16) & 0x1F] + (((ins & 0xFFFF) << 16) >> 16);
            imm = this.DTLBLookup(rA, false);
            if (imm == 0xFFFFFFFF) {
                break;
            }
            r[(ins >>> 21) & 0x1F] = ram.ReadMemory8(imm);
            break;

        case 0x24:
            // lbs 
            //			imm |= (imm&0x8000)?0xFFFF0000:0;
            rA = r[(ins >>> 16) & 0x1F] + (((ins & 0xFFFF) << 16) >> 16);
            imm = this.DTLBLookup(rA, false);
            if (imm == 0xFFFFFFFF) {
                break;
            }
            rD = (ins >>> 21) & 0x1F;
            r[rD] = ((ram.ReadMemory8(imm)) << 24) >> 24;
            //r[rD] |= (r[rD]&0x80)?0xFFFFFF00:0;
            break;

        case 0x25:
            // lhz 
            //			imm |= (imm&0x8000)?0xFFFF0000:0;
            rA = r[(ins >>> 16) & 0x1F] + (((ins & 0xFFFF) << 16) >> 16);
            imm = this.DTLBLookup(rA, false);
            if (imm == 0xFFFFFFFF) {
                break;
            }
            r[(ins >>> 21) & 0x1F] = ram.ReadMemory16(imm);
            break;

        case 0x26:
            // lhs 
            //			imm |= (imm&0x8000)?0xFFFF0000:0;
            rA = r[(ins >>> 16) & 0x1F] + (((ins & 0xFFFF) << 16) >> 16);
            imm = this.DTLBLookup(rA, false);
            if (imm == 0xFFFFFFFF) {
                break;
            }
            rD = (ins >>> 21) & 0x1F;
            r[rD] = (ram.ReadMemory16(imm) << 16) >> 16;
            //r[rD] |= (r[rD]&0x8000)?0xFFFF0000:0;
            break;


        case 0x27:
            // addi signed 
            imm = ((ins & 0xFFFF) << 16) >> 16;
            //			imm |= (imm&0x8000)?0xFFFF0000:0;
            //			imm = (imm>>0);
            rA = r[(ins >>> 16) & 0x1F];
            rD = (ins >>> 21) & 0x1F;
            r[rD] = rA + imm;
            this.SR_CY = r[rD] < rA;
            this.SR_OV = ((rA ^ imm ^ -1) & (rA ^ r[rD])) & 0x80000000;
            //TODO overflow and carry
            // maybe wrong
            break;

        case 0x29:
            // andi
            r[(ins >>> 21) & 0x1F] = r[(ins >>> 16) & 0x1F] & (ins & 0xFFFF);
            break;


        case 0x2A:
            // ori
            r[(ins >>> 21) & 0x1F] = r[(ins >>> 16) & 0x1F] | (ins & 0xFFFF);
            break;

        case 0x2B:
            // xori
            imm = ((ins & 0xFFFF) << 16) >> 16;
            //			imm |= (imm&0x8000)?0xFFFF0000:0;
            rA = r[(ins >>> 16) & 0x1F];
            r[(ins >>> 21) & 0x1F] = rA ^ (((ins & 0xFFFF) << 16) >> 16);
            break;

        case 0x2D:
            // mfspr
            r[(ins >>> 21) & 0x1F] = this.GetSPR(r[(ins >>> 16) & 0x1F] | (ins & 0xFFFF));
            break;

        case 0x2E:
            switch ((ins >>> 6) & 0x3) {
            case 0:
                // slli
                r[(ins >>> 21) & 0x1F] = r[(ins >>> 16) & 0x1F] << (ins & 0x1F);
                break;
            case 1:
                // rori
                r[(ins >>> 21) & 0x1F] = r[(ins >>> 16) & 0x1F] >>> (ins & 0x1F);
                break;
            case 2:
                // srai
                r[(ins >>> 21) & 0x1F] = (r[(ins >>> 16) & 0x1F] >> 0) >> (ins & 0x1F);
                break;
            default:
                DebugMessage("Error: opcode 2E function not implemented");
                abort();
                break;
            }
            break;

        case 0x2F:
            // sf...i
            //imm = ins&0xFFFF;
            //imm |= (ins&0x8000)?0xFFFF0000:0;			
            imm = ((ins & 0xFFFF) << 16) >> 16;
            switch ((ins >>> 21) & 0x1F) {
            case 0x0:
                // sfnei
                this.SR_F = (r[(ins >>> 16) & 0x1F] == (imm >>> 0)) ? true : false;
                break;
            case 0x1:
                // sfnei					
                this.SR_F = (r[(ins >>> 16) & 0x1F] != (imm >>> 0)) ? true : false;
                break;
            case 0x2:
                // sfgtui
                this.SR_F = (r[(ins >>> 16) & 0x1F] > (imm >>> 0)) ? true : false;
                break;
            case 0x3:
                // sfgeui
                this.SR_F = (r[(ins >>> 16) & 0x1F] >= (imm >>> 0)) ? true : false;
                break;
            case 0x4:
                // sfltui
                this.SR_F = (r[(ins >>> 16) & 0x1F] < (imm >>> 0)) ? true : false;
                break;
            case 0x5:
                // sfleui
                this.SR_F = (r[(ins >>> 16) & 0x1F] <= (imm >>> 0)) ? true : false;
                break;
            case 0xa:
                // sfgtsi
                this.SR_F = ((r[(ins >>> 16) & 0x1F] >> 0) > (imm >> 0)) ? true : false;
                break;
            case 0xb:
                // sfgesi
                this.SR_F = ((r[(ins >>> 16) & 0x1F] >> 0) >= (imm >> 0)) ? true : false;
                break;
            case 0xc:
                // sfltsi
                this.SR_F = ((r[(ins >>> 16) & 0x1F] >> 0) < (imm >> 0)) ? true : false;
                break;
            case 0xd:
                // sflesi
                this.SR_F = ((r[(ins >>> 16) & 0x1F] >> 0) <= (imm >> 0)) ? true : false;
                break;
            default:
                DebugMessage("Error: sf...i not supported yet");
                abort();
                break;
            }
            break;

        case 0x30:
            // mtspr
            imm = (ins & 0x7FF) | ((ins >>> 10) & 0xF800);
            this.SetSPR(r[(ins >>> 16) & 0x1F] | imm, r[(ins >>> 11) & 0x1F]);
            break;

        case 0x35:
            // sw
            imm = ((((ins >>> 10) & 0xF800) | (ins & 0x7FF)) << 16) >> 16;
            //imm |= (imm&0x8000)?0xFFFF0000:0;
            rA = r[(ins >>> 16) & 0x1F] + imm;
            if (rA & 0x3) {
                DebugMessage("Error: not aligned memory access");
                abort();
            }
            imm = this.DTLBLookup(rA, true);
            if (imm == 0xFFFFFFFF) {
                break;
            }
            ram.WriteMemory32(imm, r[(ins >>> 11) & 0x1F]);
            break;

        case 0x36:
            // sb
            imm = ((((ins >>> 10) & 0xF800) | (ins & 0x7FF)) << 16) >> 16;
            //imm |= (imm&0x8000)?0xFFFF0000:0;
            rA = r[(ins >>> 16) & 0x1F] + imm;
            imm = this.DTLBLookup(rA, true);
            if (imm == 0xFFFFFFFF) {
                break;
            }
            ram.WriteMemory8(imm, r[(ins >>> 11) & 0x1F]);
            break;

        case 0x37:
            // sh
            imm = ((((ins >>> 10) & 0xF800) | (ins & 0x7FF)) << 16) >> 16;
            //imm |= (imm&0x8000)?0xFFFF0000:0;
            rA = r[(ins >>> 16) & 0x1F] + imm;
            imm = this.DTLBLookup(rA, true);
            if (imm == 0xFFFFFFFF) {
                break;
            }
            ram.WriteMemory16(imm, r[(ins >>> 11) & 0x1F]);
            break;

        case 0x38:
            // three operands commands
            rA = cpu.r[(ins >>> 16) & 0x1F];
            rB = cpu.r[(ins >>> 11) & 0x1F];
            rD = (ins >>> 21) & 0x1F;
            switch ((ins >>> 0) & 0x3CF) {
            case 0x0:
                // add signed 
                if ((ins & 0x300) != 0) {
                    break;
                }
                r[rD] = rA + rB;
                this.SR_CY = r[rD] < rA;
                this.SR_OV = ((rA ^ rB ^ -1) & (rA ^ r[rD])) & 0x80000000;
                //TODO overflow and carry
                break;
            case 0x2:
                // sub signed
                if ((ins & 0x300) != 0) {
                    break;
                }
                r[rD] = rA - rB;
                this.SR_CY = (rB > rA);
                this.SR_OV = ((rA ^ rB) & (rA ^ r[rD])) & 0x80000000;
                //TODO overflow and carry
                break;
            case 0x3:
                // and
                if ((ins & 0x300) != 0) {
                    break;
                }
                r[rD] = rA & rB;
                break;
            case 0x4:
                // or
                if ((ins & 0x300) != 0) {
                    break;
                }
                r[rD] = rA | rB;
                break;
            case 0x5:
                // or
                if ((ins & 0x300) != 0) {
                    break;
                }
                r[rD] = rA ^ rB;
                break;
            case 0x8:
                // sll
                r[rD] = rA << (rB & 0x1F);
                break;
            case 0x48:
                // srl not signed
                r[rD] = rA >>> (rB & 0x1F);
                break;
            case 0xf:
                // ff1
                r[rD] = 0;
                for (var i = 0; i < 32; i++)
                if (rA & (1 << i)) {
                    r[rD] = i + 1;
                    break;
                }
                break;
            case 0x88:
                // sra signed
                r[rD] = rA >> (rB & 0x1F);
                // be carefull here and check
                break;
            case 0x10f:
                // fl1
                r[rD] = 0;
                for (var i = 31; i >= 0; i--)
                if (rA & (1 << i)) {
                    r[rD] = i + 1;
                    break;
                }
                break;
            case 0x306:
                // mul signed (specification seems to be wrong)
                {
                    // this is a hack to do 32 bit signed multiply. Seems to work but needs to be tested. 
                    r[rD] = int32(rA >> 0) * int32(rB);
                    var rAl = rA & 0xFFFF;
                    var rBl = rB & 0xFFFF;
                    r[rD] = r[rD] & 0xFFFF0000 | ((rAl * rBl) & 0xFFFF);
                    //DebugMessage("Multiplying " +int32(rA) + " " + int32(rB)+ " " + r[rD]);
                    var result = Number(int32(rA)) * Number(int32(rB));
                    //r[rD] = result;
                    this.SR_OV = (result < (-2147483647 - 1)) || (result > (2147483647));
                    var uresult = uint32(rA) * uint32(rB);
                    this.SR_CY = (uresult > (4294967295));
                    /*
					int64_t result = int64_t(int32(rA)) * int64_t(int32(rB));
					//cpu->r[rD] =  int32(rA) * int32(rB);
					cpu->r[rD] =  uint32(result&0xFFFFFFFFLL);
			        cpu->SR_OV = ((result < (int64_t)INT32_MIN) || (result > (int64_t)INT32_MAX));
					uint64_t uresult = uint64_t(rA) * uint64_t(rB);
					cpu->SR_CY = (uresult > (uint64_t)UINT32_MAX);
					//warning TODO overflow and carry
					*/
                    //DebugMessage("mul signed not supported");
                    //abort();
                }
                break;
            case 0x30a:
                // divu (specification seems to be wrong)
                //DebugMessage("divu signed not supported");
                //abort();				
                this.SR_CY = rB == 0;
                this.SR_OV = 0;
                if (!this.SR_CY) {
                    r[rD] = /*Math.floor*/(rA / rB);
                }
                break;
            case 0x309:
                // div (specification seems to be wrong)
                //DebugMessage("div not supported");
                //abort();					
                this.SR_CY = rB == 0;
                this.SR_OV = 0;
                if (!this.SR_CY) {
                    r[rD] = int32(rA) / int32(rB);
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
            switch ((ins >>> 21) & 0x1F) {
            case 0x0:
                // sfeq
                this.SR_F = (r[(ins >>> 16) & 0x1F] == r[(ins >>> 11) & 0x1F]) ? true : false;
                break;
            case 0x1:
                // sfne
                this.SR_F = (r[(ins >>> 16) & 0x1F] != r[(ins >>> 11) & 0x1F]) ? true : false;
                break;
            case 0x2:
                // sfgtu
                this.SR_F = (r[(ins >>> 16) & 0x1F] > r[(ins >>> 11) & 0x1F]) ? true : false;
                break;
            case 0x3:
                // sfgeu
                this.SR_F = (r[(ins >>> 16) & 0x1F] >= r[(ins >>> 11) & 0x1F]) ? true : false;
                break;
            case 0x4:
                // sfltu
                this.SR_F = (r[(ins >>> 16) & 0x1F] < r[(ins >>> 11) & 0x1F]) ? true : false;
                break;
            case 0x5:
                // sfleu
                this.SR_F = (r[(ins >>> 16) & 0x1F] <= r[(ins >>> 11) & 0x1F]) ? true : false;
                break;
            case 0xa:
                // sfgts
                this.SR_F = ((r[(ins >>> 16) & 0x1F] >> 0) > (r[(ins >>> 11) & 0x1F]) >> 0) ? true : false;
                break;
            case 0xb:
                // sfges
                this.SR_F = ((r[(ins >>> 16) & 0x1F] >> 0) >= (r[(ins >>> 11) & 0x1F]) >> 0) ? true : false;
                break;
            case 0xc:
                // sflts
                this.SR_F = ((r[(ins >>> 16) & 0x1F] >> 0) < (r[(ins >>> 11) & 0x1F]) >> 0) ? true : false;
                break;
            case 0xd:
                // sfles
                this.SR_F = ((r[(ins >>> 16) & 0x1F] >> 0) <= (r[(ins >>> 11) & 0x1F]) >> 0) ? true : false;
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

    } while (steps--); // main loop	
};

