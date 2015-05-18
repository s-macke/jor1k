// -------------------------------------------------
// ------------- DYNAMIC RECOMPILER ----------------
// -------------------------------------------------
"use strict";

var message = require('../../messagehandler');
var utils = require('../../utils');

var PAGESIZE = 8192;
var PAGE_STATUS_OK = 0x0;
var PAGE_STATUS_EMPTY = 0x1;
var PAGE_STATUS_TAINTED = 0x2;

function RecompileCPU(ram, cpu) {
    this.ram = ram;
    this.cpu = cpu;

    this.m = ram.int32mem;
    this.r = new Int32Array(this.ram.heap, 0, 34 << 2);
    this.f = new Float32Array(this.ram.heap, 0, 32 << 2);

    this.npages = this.m.buffer.byteLength >> 13;
    this.fns = new Array(this.npages);
    this.fnsshort = [];
    this.fnsshort2 = [];
    this.pagestatus = new Uint8Array(this.ram.heap, 0x8000, 0x8000);
    
    this.PIC = false; // generate position independent code

    this.heuristic = new Int16Array(this.m.buffer.byteLength>>2);

    this.genopcodes = {
        0x3: this.Gen_lbf,
        0x4: this.Gen_lbf,
        0x5: function(ins){return "";},
        0x6: this.Gen_lmovhi,
        0x1B: this.Gen_lload,
        0x21: this.Gen_lload,
        0x23: this.Gen_lload,
        0x24: this.Gen_lload,
        0x25: this.Gen_lload,
        0x26: this.Gen_lload,
        0x27: this.Gen_laddi,
        0x29: this.Gen_landi,
        0x2A: this.Gen_lori,
        0x2B: this.Gen_lxori,
        0x2E: this.Gen_shifti,
        0x2F: this.Gen_lsfi,
        0x33: this.Gen_lstore,
        0x35: this.Gen_lstore,
        0x36: this.Gen_lstore,
        0x37: this.Gen_lstore,
        0x38: this.Gen_3OPs,
        0x39: this.Gen_lsf,
    }

    // Used globally by the gen functions. Set by the "Recompile" function
    this.pc = 0x0; // current real pc of recompiled code
    this.n = 0x0; // the current instruction number
    this.error = false;
    this.supervisor = false;

    this.Reset();
}

RecompileCPU.prototype.Reset = function() {
    for(var i=0; i<this.npages; i++) {
        this.fns[i] = [];
        this.pagestatus[i] = PAGE_STATUS_EMPTY;
    }
}

RecompileCPU.prototype.Gen_laddi = function(ins) {
    var rA = (ins >> 21) & 0x1F;
    var rB = (ins >> 16) & 0x1F;
    var imm = (ins << 16) >> 16;
    if (rB == 0) {
        return "r[" + rA + "]=" + imm + ";";
    } else {
        if (imm == 0) {
            return "r[" + rA + "]=" + "r[" + rB + "]|0;";
        } else {
            if (imm < 0) {
                return "r[" + rA + "]=" + "(r[" + rB + "]|0)" + imm + "|0;";
            } else {
                return "r[" + rA + "]=" + "(r[" + rB + "]|0)" + "+" + imm + "|0;";
            }
        }
    }
}

RecompileCPU.prototype.Gen_landi = function(ins) {
    var rA = (ins >> 21) & 0x1F;
    var rB = (ins >> 16) & 0x1F;

    if (rB == 0) {
        return "r[" + rA + "]=0x0;";
    } else {
        return "r[" + rA + "]=" + "r[" + rB + "]" + "&0x" + (ins & 0xFFFF).toString(16) + ";";
    }
}

RecompileCPU.prototype.Gen_lori = function(ins) {
    var rA = (ins >> 21) & 0x1F;
    var rB = (ins >> 16) & 0x1F;

    if (rB == 0) {
        return "r[" + rA + "]|=0x" + (ins & 0xFFFF).toString(16) + ";";
    } else {
        return "r[" + rA + "]=" + "r[" + rB + "]" + "|0x" + (ins & 0xFFFF).toString(16) + ";";
    }
}

RecompileCPU.prototype.Gen_lxori = function(ins) {
    var rA = (ins >> 21) & 0x1F;
    var rB = (ins >> 16) & 0x1F;
    return "r[" + rA + "]=" + "r[" + rB + "]" + "^0x" + (((ins<<16)>>16)>>>0).toString(16) + ";";
}

RecompileCPU.prototype.Gen_lmovhi = function(ins) {
    var rA = (ins >> 21) & 0x1F;
    return "r[" + rA + "]=0x"+((ins & 0xFFFF) << 16 >>>0).toString(16)+";";
}

RecompileCPU.prototype.Gen_lbf = function(ins) {
    var s = "";
    if (this.PIC) {
        var imm = ((ins << 6) >> 4);
        if (((ins >> 26)&0x3F) == 0x3) { // l.bnf
            s += "if(SR_F)jump=(pcbase+" + ((this.n<<2)+8) + ">>>0); else jump=(pcbase+" + ((this.n<<2) + imm) + ">>>0);";
        } else {
            s += "if(!SR_F)jump=(pcbase+" + ((this.n<<2)+8) + ">>>0); else jump=(pcbase+" + ((this.n<<2) + imm) + ">>>0);";
        }
        s += "delayedins=1;";
        return s;
    }

    var imm = this.pc + ((ins << 6) >> 4);
    if (((ins >> 26)&0x3F) == 0x3) { // l.bnf
        s += "if(SR_F)jump=0x"+(this.pc+8 >>>0).toString(16)+"; else jump=0x" + (imm>>>0).toString(16) + ";";
    } else {
        s += "if(!SR_F)jump=0x"+(this.pc+8 >>>0).toString(16)+"; else jump=0x" + (imm>>>0).toString(16) + ";";
    }
    s += "delayedins=1;";
    return s;
}

RecompileCPU.prototype.Gen_shifti = function(ins) {
    var s = "";
    var rA = (ins >> 21) & 0x1F;
    var rB = (ins >> 16) & 0x1F;
    var imm = (ins & 0x1F);
    s += "r[" + rA + "]=" + "r[" + rB + "]";
    switch ((ins >> 6) & 0x3) {
        case 0: // l.slli
            s += "<<" + imm + ";";
            break;
        case 1: // l.rori
            s += ">>>" + imm + ";";
            break;
        case 2: // l.srai
            s += ">>" + imm + ";";
            break;
    }
    return s;
}

RecompileCPU.prototype.Gen_lsfi = function(ins) {
    var imm = (ins << 16) >> 16;
    var rA = (ins >> 16) & 0x1F;
    switch ((ins >> 21) & 0x1F) {
        case 0x0: // l.sfeqi
            return "SR_F=(r[" + rA + "]|0)==" + imm + ";";
            break;
        case 0x1: // l.sfnei
            return "SR_F=(r[" + rA + "]|0)!=" + imm + ";";
            break;
        case 0x2: // l.sfgtui
            return "SR_F=(r[" + rA + "]>>>0)>" + (imm>>>0) + ";";
            break;
        case 0x3: // l.sfgeui
            return "SR_F=(r[" + rA + "]>>>0)>=" + (imm>>>0) + ";";
            break;
        case 0x4: // l.sfltui
            return "SR_F=(r[" + rA + "]>>>0)<" + (imm>>>0) + ";";
            break;
        case 0x5: // l.sfleui
            return "SR_F=(r[" + rA + "]>>>0)<=" + (imm>>>0) + ";";
            break;
        case 0xa: // l.sfgtsi
            return "SR_F=(r[" + rA + "]|0)>" + imm + ";";
            break;
        case 0xb: // l.sfgesi
            return "SR_F=(r[" + rA + "]|0)>=" + imm + ";";
            break;
        case 0xc: // l.sfltsi
            return "SR_F=(r[" + rA + "]|0)<" + imm + ";";
            break;
        case 0xd: // l.sflesi
            return "SR_F=(r[" + rA + "]|0)<=" + imm + ";";
            break;
        default:
            message.Debug("Error in dynamic CPU: l.sf..i instruction with id " +
            utils.ToHex((ins >> 21) & 0x1F) + " not found");
            this.error = true;
            break;
        }
    return "";
}

RecompileCPU.prototype.Gen_3OPs = function(ins) {
    var rA = (ins >> 16) & 0x1F;
    var rB = (ins >> 11) & 0x1F;
    var rC = (ins >> 21) & 0x1F;
    var s = "r[" + rC + "]=" + "(r[" + rA + "]|0)";
    switch (ins & 0x3CF) {
        case 0x0: // l.add signed
            s += "+" + "(r[" + rB + "]|0)|0;";
            break;
        case 0x2: // l.sub signed
            s += "-" + "(r[" + rB + "]|0)|0;";
            break;
        case 0x3: // l.and
            s += "&" + "r[" + rB + "];";
            break;
        case 0x4: // l.or
            s += "|" + "r[" + rB + "];";
            break;
        case 0x5: // l.xor
            s += "^" + "r[" + rB + "];";
            break;
        case 0x8: // l.sll
            s += "<<" + "(r[" + rB + "]&0x1F);";
            break;
        case 0x48: // l.srl
            s += ">>>" + "(r[" + rB + "]&0x1F);";
            break;
        case 0x88: // l.sra
            s += ">>" + "(r[" + rB + "]&0x1F);";
            break;
        case 0x306: // l.mul signed
            s = "{";
            s += "var ah=(r[" + rA + "]>>>16)&0xFFFF;";
            s += "var al=r[" + rA + "]&0xFFFF;";
            s += "var bh=(r[" + rB + "]>>>16)&0xFFFF;";
            s += "var bl=r[" + rB + "]&0xFFFF;";
            s += "r[" + rC + "]=((al * bl) + (((ah * bl + al * bh) << 16) >>> 0)|0);";
            s += "}";
            break;
        default:
            message.Debug("Error in dynamic CPU: Three operand instruction with id " +
            utils.ToHex(ins & 0x3CF) + " not found");
            this.error = true;
            break;
        }
    return s;
}

RecompileCPU.prototype.Gen_lsf = function(ins) {
    var rA = (ins >> 16) & 0x1F;
    var rB = (ins >> 11) & 0x1F;
    switch ((ins >> 21) & 0x1F) {
        case 0x0: // l.sfeq
            return "SR_F=(r[" + rA + "]|0)==(r[" + rB + "]|0);";
            break;
        case 0x1: // l.sfne
            return "SR_F=(r[" + rA + "]|0)!=(r[" + rB + "]|0);";
            break;
        case 0x2: // l.sfgtu
            return "SR_F=(r[" + rA + "]>>>0)>(r[" + rB + "]>>>0);";
            break;
        case 0x3: // l.sfgeu
            return "SR_F=(r[" + rA + "]>>>0)>=(r[" + rB + "]>>>0);";
            break;
        case 0x4: // l.sfltu
            return "SR_F=(r[" + rA + "]>>>0)<(r[" + rB + "]>>>0);";
            break;
        case 0x5: // l.sfleu
            return "SR_F=(r[" + rA + "]>>>0)<=(r[" + rB + "]>>>0);";
            break;
        case 0xa: // l.sfgts
            return "SR_F=(r[" + rA + "]|0)>(r[" + rB + "]|0);";
            break;
        case 0xb: // l.sfges
            return "SR_F=(r[" + rA + "]|0)>=(r[" + rB + "]|0);";
            break;
        case 0xc: // l.sflts
            return "SR_F=(r[" + rA + "]|0)<(r[" + rB + "]|0);";
            break;
        case 0xd: // l.sfles
            return "SR_F=(r[" + rA + "]|0)<=(r[" + rB + "]|0);";
            break;

        default:
            message.Debug("Error in dynamic CPU: sf.... opcode " + ((ins >> 21) & 0x1F) + " unknown");
            this.error = true;
    }
    return "";
}

RecompileCPU.prototype.Gen_lstore = function(ins) {
    var imm = ((((ins >> 10) & 0xF800) | (ins & 0x7FF)) << 16) >> 16;
    var rA = (ins >> 16) & 0x1F;
    var rB = (ins >> 11) & 0x1F;
    var s = "";
/*
    if (this.PIC) {
        s += "SetPC((pcbase>>>2)+" + this.n + ")|0;";
    } else {
        s += "SetPC(0x" + (this.pc>>>2).toString(16) + ")|0;";
    }
*/
    s += "r[33]=DTLBLookup((r[" + rA + "]|0)+" + imm + "|0, 1)|0;"
    s += "if((r[33]|0)==-1){CorrectDTLBException(0x" + (this.pc>>>2).toString(16) + ",delayedins|0);return 0|0;}"

    if (this.supervisor) {
        switch ((ins >> 26)&0x3F) {
            case 0x33: // l.swa
                s += "SR_F=r[33]==this.EA;this.EA=-1;if(!SR_F) break;";
                s += "int32mem[0x100000+(r[33]|0)>>2]=r[" + rB + "]|0;";
                break;
            case 0x35: // l.sw
                s += "if(r[33]>0)int32mem[0x100000+(r[33]|0)>>2]=r[" + rB + "];else;this.ram.Write32Big(r[33],r["+rB+"]|0);";
                break;
            case 0x36: // l.sb
                s += "if(r[33]>0)this.ram.uint8mem[r[33]^3]=r[" + rB + "]&0xFF;else;this.ram.Write8Big(r[33],r["+rB+"]|0);";
                break;
            case 0x37: // l.sh
                s += "this.ram.Write16Big(r[33],r["+rB+"]|0);";
                break;
        }

    } else { // user mode
        switch ((ins >> 26)&0x3F) {
            case 0x33: // l.swa
                s += "SR_F=r[33]==this.EA;this.EA=-1;if(!SR_F) break;";
                s += "int32mem[0x100000+(r[33]|0)>>2]=r[" + rB + "]|0;";
                break;
            case 0x35: // l.sw
                s += "int32mem[0x100000+(r[33]|0)>>2]=r[" + rB + "]|0;";
                break;
            case 0x36: // l.sb
                s += "this.ram.uint8mem[r[33]^3]=r[" + rB + "]&0xFF;";
                break;
            case 0x37: // l.sh
                s += "this.ram.Write16Big(r[33],r[" + rB + "]|0);";
                break;
        }
    }
    return s;    
}


RecompileCPU.prototype.Gen_lload = function(ins) {
    var imm = (ins << 16) >> 16;
    var rA = (ins >> 16) & 0x1F;
    var rB = (ins >> 21) & 0x1F;
    var s = "";
    s += "r[33]=DTLBLookup((r[" + rA + "]|0)+" + imm + "|0, 0)|0;"
/*
    if (this.PIC) {
        s += "SetPC((pcbase>>>2)+" + this.n + ")|0;";
    } else {
        s += "SetPC(0x" + (this.pc>>>2).toString(16) + ")|0;";
    }
*/
//    s += "r[33]=DTLBLookup(r[32]|0, 0)|0;"
//    s += "if((r[33]|0)==-1)return 0|0;"
    s += "if((r[33]|0)==-1){CorrectDTLBException(0x" + (this.pc>>>2).toString(16) + ",delayedins|0);return 0|0;}"

    if (this.supervisor) {

    switch ((ins >> 26)&0x3F) {
        case 0x1B: // l.lwa
            s += "this.EA=r[33];"
            s += "r[" + rB +"] = int32mem[0x100000+r[33] >> 2];";
            break;
        case 0x21: // l.lwz
            s += "r[" + rB +"] = r[33]>0?int32mem[0x100000+r[33] >> 2]:this.ram.Read32Big(r[33]);";
            break;

        case 0x23: // l.lbz
            s += "r[" + rB +"] = r[33]>0?this.ram.uint8mem[r[33]^3]:this.ram.Read8Big(r[33]);";
            break;

        case 0x24: // l.lbs
            s += "r[" + rB +"] = r[33]>0?((this.ram.uint8mem[r[33]^3]<<24)>>24):((this.ram.Read8Big(r[33])<<24)>>24);";
            break;

        case 0x25: // l.lhz
            s += "r[" + rB +"] = this.ram.Read16Big(r[33]);";
            break;

        case 0x26: // l.lhs
            s += "r[" + rB +"] = ((this.ram.Read16Big(r[33])<<16)>>16);";
            break;
    }
    } else { //user mode
    switch ((ins >> 26)&0x3F) {
        case 0x1B: // l.lwa
            s += "this.EA=r[33];"
            s += "r[" + rB +"] = int32mem[0x100000+r[33]>>2]);";
            break;
        case 0x21: // l.lwz
            s += "r[" + rB +"] = int32mem[0x100000+r[33]>>2];";
            break;

        case 0x23: // l.lbz
            s += "r[" + rB +"] = this.ram.uint8mem[r[33]^3];";
            break;

        case 0x24: // l.lbs
            s += "r[" + rB +"] = ((this.ram.uint8mem[r[33]^3]<<24)>>24);";
            break;

        case 0x25: // l.lhz
            s += "r[" + rB +"] = this.ram.Read16Big(r[33]);";
            break;

        case 0x26: // l.lhs
            s += "r[" + rB +"] = ((this.ram.Read16Big(r[33])<<16)>>16);";
            break;
    }

    }

    return s;
}

// 1 = jump or branch
// 2 = load
// 3 = store
// 4 = other
RecompileCPU.prototype.GetInstructionType = function(ins)
{
    ins = ins | 0;
    switch ((ins >> 26)&0x3F) {
        case 0x0: // l.j
        case 0x1: // l.jal
        case 0x3: // l.bnf
        case 0x4: // l.bf
        case 0x11: // l.jr
        case 0x12: // l.jalr
            return 1;
        case 0x1B: // l.lwa
        case 0x21: // l.lwz
        case 0x23: // l.lbz
        case 0x24: // l.lbs
        case 0x25: // l.lhz
        case 0x26: // l.lhs
            return 2;
        case 0x33: // l.swa
        case 0x35: // l.sw
        case 0x36: // l.sb
        case 0x37: // l.sh
            return 3;
        default:
            return 0;
    }

    return 0;
}


RecompileCPU.prototype.RecompileInstruction = function(ins)
{
    ins = ins | 0;
    var rA = 0x0;
    var rB = 0x0;
    var imm = 0x0;

    if (((ins >> 26)&0x3F) == 0x7) { // retrieve overwritten opcode
        ins = this.fnsshort[ins&0xFFFFFF].ins|0;
    }

    var s = "";
    switch ((ins >> 26)&0x3F) {
        case 0x0: // l.j
            imm = this.pc + ((ins << 6) >> 4);
            s += "jump=0x" + (imm>>>0).toString(16) + ";";
            s += "delayedins=1;";
            break;

        case 0x1: // l.jal
            imm = this.pc + ((ins << 6) >> 4)|0;
            s += "jump=0x" + (imm>>>0).toString(16) + ";";
            s += "r[9]=0x" + (this.pc+8>>>0).toString(16)  + ";";
            s += "delayedins=1;";
            break;

        case 0x3: // l.bnf
        case 0x4: // l.bf
                s = this.Gen_lbf(ins);
                break;

        case 0x5: // l.nop
                break;

        case 0x11: // l.jr
                rA = (ins >> 11) & 0x1F;
                s += "jump=r[" + rA + "]|0;";
                s += "delayedins=1;";
                break;

        case 0x12: // l.jalr
                rA = (ins >> 11) & 0x1F;
                s += "jump=r[" + rA + "]|0;";
                s += "r[9]=0x" + (this.pc+8>>>0).toString(16)  + ";";
                s += "delayedins=1;";
                break;

        case 0x1B: // l.lwa
        case 0x21: // l.lwz
        case 0x23: // l.lbz
        case 0x24: // l.lbs
        case 0x25: // l.lhz
        case 0x26: // l.lhs
                s = this.Gen_lload(ins);
                break;

        case 0x6: // l.movhi
                s = this.Gen_lmovhi(ins);
                break;

        case 0x27: // l.addi
                s = this.Gen_laddi(ins);
                break;

        case 0x29: // l.andi
                s = this.Gen_landi(ins);
                break;
        case 0x2A: // l.ori
                s = this.Gen_lori(ins);
                break;

        case 0x2B: // l.xori
                s = this.Gen_lxori(ins);
                break;

        case 0x2E:
                s = this.Gen_shifti(ins);
                break;

        case 0x2F: // l.sf..i
                s = this.Gen_lsfi(ins);
                break;

        case 0x2D: // l.mfspr
                rA = (ins >> 21) & 0x1F;
                rB = (ins >> 16) & 0x1F;
                s += "r[" + rA + "]=this.GetSPR(r[" + rB + "]|" + (ins&0xFFFF) + ");";
                break;

        case 0x30: // l.mtspr
                imm = (ins & 0x7FF) | ((ins >> 10) & 0xF800);
                rA = (ins >> 16) & 0x1F;
                rB = (ins >> 11) & 0x1F;
                s += "this.SetSPR(r[" + rA + "]|" + imm + ",r[" + rB + "]);";
                break;

        case 0x33: // l.swa
        case 0x35: // l.sw
        case 0x36: // l.sb
        case 0x37: // l.sh
                s = this.Gen_lstore(ins);
                break;

        case 0x38: // three operand commands
                s = this.Gen_3OPs(ins);
                break;

        case 0x39: // l.sf..
                s = this.Gen_lsf(ins);
                break;

        default:
            message.Debug("Error in dynamic CPU: Instruction with id " +
                utils.ToHex(((ins >> 26)&0x3F)) + " not found");
            this.error = true;
            break;
    }

    return s;
}

RecompileCPU.prototype.Recompile = function(pcbase, ppc, supervisor) {
    ppc = ppc | 0;
    pcbase = pcbase | 0;
    this.pc = pcbase;
    this.supervisor = supervisor;
    var ppcbase = ppc | 0;

    var page = ppc >> 13;
    var pageoffset = ppc & 8191;
    if (this.pagestatus[page] == PAGE_STATUS_TAINTED) {
        message.Debug("Info: page " + page + "tainted");
        //this.fns[page] = [];
    }
    	
    message.Debug("Recompile at pc="+utils.ToHex(pcbase) + " ppc=" + utils.ToHex(ppcbase));

    var ins = 0x0;
    var i = 0;

    var s = "";
    this.error = false;

    var jump = ((ppc >> 13) + 1) << 13; // next page
    var fence = ((ppc >> 13) + 1) << 13; // next page
    this.n = 0;

    var firstins = true;

    // write preamble
    var codestr = "var jump=0x"+(jump>>>0).toString(16)+";\n";
    if (this.PIC) codestr += "var pcbase=this.pc<<2;\n";

    var stdlib = {
        Int32Array : Int32Array,
        Float32Array : Float32Array,
        Uint8Array : Uint8Array,
        Uint16Array : Uint16Array,
        Math : Math
    };

    var foreign = {
        DTLBLookup: this.cpu.DTLBLookup.bind(this.cpu),
        CorrectDTLBException: this.cpu.CorrectDTLBException.bind(this.cpu)
    };

    for(;;) {

        if (ppc == fence) {
            if (this.n <= 2) return false; // too short
            codestr += "nextpc=jump>>>2;\n";
            codestr += "delayedins=0;\nreturn 1|0;";

//          var fn = Function(codestr).bind(this.cpu);

            var finalcode = /*   "\"use asm\";\n" + */
                "var r = new stdlib.Int32Array(heap);\n" +
                "var int32mem = new stdlib.Int32Array(heap);\n"+
                "var DTLBLookup = foreign.DTLBLookup;\n" +
                "var CorrectDTLBException = foreign.CorrectDTLBException;\n" +
                "var nextpc = 0x0;\n" +
                "var delayedins = 0;\n" +
                "var SR_F = 0;\n" +
                "function Execute(){\n" + codestr + "}\n" +
                "function GetNextPC(){return nextpc|0;}\n" +
                "return {Execute: Execute, GetNextPC: GetNextPC};"


            var fn = Function(
                   "stdlib", 
                   "foreign", 
                   "heap", 
                   finalcode
                )(stdlib, foreign, this.ram.heap);

            var f = {
                fn : fn,
                Execute : fn.Execute,
                GetNextPC : fn.GetNextPC,
                n: this.n,  // the number of instructions
                ins: this.m[ppcbase >> 2]|0, // the instruction at the beginning, which is overwritten
            };

            //this.fns[page][pageoffset>>2] = f;

            this.fnsshort.push(f);
            this.fnsshort2.push(f.fn.Execute);
            this.m[ppcbase >> 2] = (0x7<<26) | (this.fnsshort.length-1);

            this.pagestatus[page] = PAGE_STATUS_OK;
            message.Debug("Generated code with " + this.n + " instructions");
            message.Debug(finalcode);

            return true;
        } // end of fence

        ins = this.m[ppc >> 2];
        var instype = this.GetInstructionType(ins);

        if ((firstins) && (instype)) {
            this.error = true;
        }

        var s = this.RecompileInstruction(ins);

        if (instype == 1) { // jump or branch
            // the end of the block is near
            fence = ppc + 8 | 0;
        }

        codestr += s + "\n";
        ppc += 4;
        this.pc += 4;
        this.n++;
        firstins = false;
        if (this.error) break;
    } // for loop

//    message.Debug("Error in the recompilation process: code so far:");
//    message.Debug(codestr);

    return false;
}


RecompileCPU.prototype.RecompileFunction = function(pcbase, ppc, supervisor) {
    ppc = ppc | 0;
    pcbase = pcbase | 0;
    this.pc = pcbase;
    this.supervisor = supervisor;
    var ppcbase = ppc;




}
