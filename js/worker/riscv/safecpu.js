// -------------------------------------------------
// -------------------- CPU ------------------------
// -------------------------------------------------

"use strict";
var message = require('../messagehandler');
var utils = require('../utils');

var CSR_MSTATUS = 0x300;
var CSR_CYCLES = 0xC00;
var CSR_MTOHOST =  0x780;
var CSR_MCPUID = 0xF00;
var CSR_MIMPID = 0xF01;
var CSR_MHARTID = 0xF10;
var CSR_MTVEC = 0x301;
var CSR_MIE = 0x304;
var CSR_MEPC = 0x341;
var CSR_MCAUSE = 0x342;
var CSR_MBADADDR = 0x343;
var CSR_SSTATUS = 0x100;
var CSR_STVEC = 0x101;
var CSR_SIE = 0x104;
var CSR_TIME = 0xC01;

// constructor
function SafeCPU(ram) {
    message.Debug("Initialize RISCV CPU");

    this.ram = ram;
    // registers
    // r[32] and r[33] are used to calculate the virtual address and physical address
    // to make sure that they are not transformed accidently into a floating point number
    this.r = new Int32Array(this.ram.heap, 0, 34 << 2);
    this.f = new Float64Array(this.ram.heap, 32<<2, 32); 
    this.fi = new Int32Array(this.ram.heap, 32<<2, 32<<1); // for copying operations
    this.ff = new Float32Array(this.ram.heap, 0, 1); // the zero register is used to convert to single precision
    this.csr = new Int32Array(this.ram.heap, 0x2000, 4096 << 2);
    this.pc = 0x200;
    this.Reset();
}

SafeCPU.prototype.Reset = function() {
    this.ticks = 0;
    this.csr[CSR_MSTATUS] = 0x96; // 1001 0110 - All Interrupts Disabled, FPU disabled 
    this.csr[CSR_MTOHOST] =  0x780;
    this.csr[CSR_MCPUID] = 0x4112D;
    this.csr[CSR_MIMPID] = 0x01;
    this.csr[CSR_MHARTID] = 0x00;
    this.csr[CSR_MTVEC] = 0x100;
    this.csr[CSR_MIE] = 0x00;
    this.csr[CSR_MEPC] = 0x00;
    this.csr[CSR_MCAUSE] = 0x00;
    this.csr[CSR_MBADADDR] = 0x00;
    this.csr[CSR_SSTATUS] = 0x3010;
    this.csr[CSR_STVEC] = 0x00;
    this.csr[CSR_SIE] = 0x00;
    this.csr[CSR_TIME] = 0X64;

}

SafeCPU.prototype.InvalidateTLB = function() {
}

SafeCPU.prototype.GetTimeToNextInterrupt = function () {
    return 10;
}

SafeCPU.prototype.GetTicks = function () {
    return this.ticks;
}

SafeCPU.prototype.ProgressTime = function (delta) {
    this.ticks += delta;
}


SafeCPU.prototype.AnalyzeImage = function() // we haveto define these to copy the cpus
{
}

SafeCPU.prototype.CheckForInterrupt = function () {
};

SafeCPU.prototype.RaiseInterrupt = function (line, cpuid) {
};

SafeCPU.prototype.ClearInterrupt = function (line, cpuid) {
};

SafeCPU.prototype.SetCSR = function (addr,value) {

    var csr = this.csr;

    switch(addr)
    {
        case CSR_MTOHOST:
            this.ram.Write8Little(0x90000000 >> 0, value);
            break;

        case CSR_MSTATUS:
            csr[addr] = value;
            break;
            
        default:
            csr[addr] = value;
            message.Debug("Error in SetCSR: Address " + utils.ToHex(addr) + " unkown");
            //message.Abort();
            break;
    }
};

SafeCPU.prototype.GetCSR = function (addr) {

    var csr = this.csr;

    switch(addr)
    {
        case CSR_MTOHOST:
            return 0x0;
            break;

        case CSR_MSTATUS:
            return csr[addr];
            break;

        case CSR_CYCLES:
            return this.ticks;
            break;
            
        default:
             message.Debug("Error in GetCSR: PC "+this.pc+" Address " + utils.ToHex(addr) + " unkown");
            //message.Abort();
            return csr[addr];
            break;
    }
   
};


SafeCPU.prototype.Step = function (steps, clockspeed) {

    var r = this.r;
    var fi = this.fi;
    var ff = this.ff;
    var f = this.f;
    var csr = this.csr;
    r[0] = 0x00;
    var rindex = 0x00;
    var findex = 0x00;
    var imm = 0x00;
    var imm1 = 0x00;
    var imm2 = 0x00;
    var imm3 = 0x00;
    var imm4 = 0x00;
    var zimm = 0x00;
    var mul=0x00;
    var quo=0x00;
    var rem=0x00;
    var rs1 = 0x00;
    var rs2 = 0x00;
    var fs1 = 0x00;
    var fs2 = 0x00;
    // this is the way to write to the terminal
    //this.ram.Write8Little(0x90000000 >> 0, (this.ticks&63)+32);
       
    var ins = this.ram.Read32(this.pc);

    switch(ins&0x7F) {

        case 0x03:
            //lb,lh,lw,lbu,lhu
            switch((ins >> 12)&0x7) {
                
                case 0x00:
                    //lb
                    imm = (ins >> 20);
                    rs1 = r[(ins >> 15) & 0x1F];
                    rindex = (ins >> 7) & 0x1F;
                    r[rindex] = (this.ram.Read8(rs1 + imm) << 24) >> 24;
                    message.Debug("lb - "+ utils.ToHex(ins)+" register " + r[rindex]);
                    break;

                case 0x01:
                    //lh
                    imm = (ins >> 20);
                    rs1 = r[(ins >> 15) & 0x1F];
                    rindex = (ins >> 7) & 0x1F;
                    r[rindex] = (this.ram.Read16(rs1 + imm) << 16) >> 16;
                    message.Debug("lh - "+ utils.ToHex(ins)+" register " + r[rindex]);
                    break;

                case 0x02:
                    //lw
                    imm = (ins >> 20);
                    rs1 = r[(ins >> 15) & 0x1F];
                    rindex = (ins >> 7) & 0x1F;
                    r[rindex] = this.ram.Read32(rs1 + imm);
                    message.Debug("lw - "+ utils.ToHex(ins)+" register " + r[rindex]);
                    break;

                case 0x04:
                    //lbu
                    imm = (ins >> 20);
                    rs1 = r[(ins >> 15) & 0x1F];
                    rindex = (ins >> 7) & 0x1F;
                    r[rindex] = (this.ram.Read8(rs1 + imm) >>> 0);
                    message.Debug("lbu - "+ utils.ToHex(ins)+" register " + r[rindex]);
                    //if(rs1 + imm > 0x8b75) message.Abort();
                    break;

                case 0x05:
                    //lhu
                    imm = (ins >> 20);
                    rs1 = r[(ins >> 15) & 0x1F];
                    rindex = (ins >> 7) & 0x1F;
                    r[rindex] = (this.ram.Read16(rs1 + imm) >>> 0);
                    message.Debug("lhu - "+ utils.ToHex(ins)+" register " + r[rindex]);
                    break;

                default:
                    message.Debug("Error in safecpu: Instruction " + utils.ToHex(ins) + "not found");
                    break;

            }
            break;

        case 0x23:
            //sb,sh,sw
            switch((ins >> 12)&0x7) {
                
                case 0x00:
                    //sb
                    imm1 = (ins >> 25);
                    imm2 = (ins >> 7) & 0x1F;
                    imm = (imm1 << 5) + imm2;
                    rs1 = r[(ins >> 15) & 0x1F];
                    rindex = (ins >> 20) & 0x1F;
                    this.ram.Write8(rs1 + imm,(r[rindex] & 0xFF));
                    message.Debug("sb - "+ utils.ToHex(ins)+" register " + r[rindex]);
                    break;

                case 0x01:
                    //sh
                    imm1 = (ins >> 25);
                    imm2 = (ins >> 7) & 0x1F;
                    imm = (imm1 << 5) + imm2;
                    rs1 = r[(ins >> 15) & 0x1F];
                    rindex = (ins >> 20) & 0x1F;
                    this.ram.Write16(rs1 + imm,(r[rindex] & 0xFFFF));
                    message.Debug("sh - "+ utils.ToHex(ins)+" register " + r[rindex]);
                    break;

                case 0x02:
                    //sw
                    imm1 = (ins >> 25);
                    imm2 = (ins >> 7) & 0x1F;
                    imm = (imm1 << 5) + imm2;
                    rs1 = r[(ins >> 15) & 0x1F];
                    rindex = (ins >> 20) & 0x1F;
                    this.ram.Write32(rs1 + imm,r[rindex]);
                    message.Debug("sw - "+ utils.ToHex(ins)+" register " + r[rindex]);
                    break;

                default:
                    message.Debug("Error in safecpu: Instruction " + utils.ToHex(ins) + "not found");
                    break;

            }
            break;

        case 0x13:
            //addi,slti,sltiu,xori,ori,andi,slli,srli,srai
            switch((ins >> 12)&0x7) {
                
                case 0x00:
                    //addi
                    imm = (ins >> 20);
                    rs1 = r[(ins >> 15) & 0x1F];
                    rindex = (ins >> 7) & 0x1F;
                    r[rindex] = rs1 + imm;
                    message.Debug("addi - "+ utils.ToHex(ins)+" register " + r[rindex]);
                    break;

                case 0x02:
                    //slti
                    imm = (ins >> 20);
                    rs1 = r[(ins >> 15) & 0x1F];
                    rindex = (ins >> 7) & 0x1F;
                    if(rs1 < imm) r[rindex] = 0x01;
                    else r[rindex] = 0x00;
                    message.Debug("slti - "+ utils.ToHex(ins)+" register " + r[rindex]);
                    break;

                case 0x03:
                    //sltiu
                    imm = (ins >>> 20) >>> 0;
                    rs1 = r[(ins >> 15) & 0x1F] >>> 0;
                    rindex = (ins >> 7) & 0x1F;
                    if(rs1 < imm) r[rindex] = 0x01;
                    else r[rindex] = 0x00;
                    message.Debug("sltiu - "+ utils.ToHex(ins)+" register " + r[rindex]);
                    break;

                case 0x04:
                    //xori
                    imm = (ins >> 20);
                    rs1 = r[(ins >> 15) & 0x1F];
                    rindex = (ins >> 7) & 0x1F;
                    r[rindex] = rs1 ^ imm;
                    message.Debug("xori - "+ utils.ToHex(ins)+" register " + r[rindex]);
                    break;

                case 0x06:
                    //ori
                    imm = (ins >> 20);
                    rs1 = r[(ins >> 15) & 0x1F];
                    rindex = (ins >> 7) & 0x1F;
                    r[rindex] = rs1 | imm;
                    message.Debug("ori - "+ utils.ToHex(ins)+" register " + r[rindex]);
                    break;

                case 0x07:
                    //andi
                    imm = (ins >> 20);
                    rs1 = r[(ins >> 15) & 0x1F];
                    rindex = (ins >> 7) & 0x1F;
                    r[rindex] = rs1 & imm;
                    message.Debug("andi - "+ utils.ToHex(ins)+" register " + r[rindex]);
                    break;

                case 0x01:
                    //slli
                    imm = (ins >> 20) & 0x1F;
                    rs1 = r[(ins >> 15) & 0x1F];
                    rindex = (ins >> 7) & 0x1F;
                    r[rindex] = rs1 << imm;
                    message.Debug("slli - "+ utils.ToHex(ins)+" register " + r[rindex]);
                    break;

                case 0x05:
                    if(((ins >> 25) & 0x7F) == 0x00){
                        //srli
                        imm = (ins >> 20) & 0x1F;
                        rs1 = r[(ins >> 15) & 0x1F];
                        rindex = (ins >> 7) & 0x1F;
                        r[rindex] = rs1 >>> imm;
                        message.Debug("srli - "+ utils.ToHex(ins)+" register " + r[rindex]);
                    }
                    else if(((ins >> 25) & 0x7F) == 0x20){
                        //srai
                        imm = (ins >> 20) & 0x1F;
                        rs1 = r[(ins >> 15) & 0x1F];
                        rindex = (ins >> 7) & 0x1F;
                        r[rindex] = rs1 >> imm;
                        message.Debug("srai - "+ utils.ToHex(ins)+" register " + r[rindex]);  
                    }
                    break;

                default:
                    message.Debug("Error in safecpu: Instruction " + utils.ToHex(ins) + "not found");
                    break;

            }
            break;

        case 0x33:
            //add,sub,sll,slt,sltu,xor,srl,sra,or,and
            switch((ins >> 25)&0x7F) {
                
                case 0x00:
                    //add,slt,sltu,add,or,xor,sll,srl
                    switch((ins >> 12)&0x7) {
                        case 0x00:
                            //add
                            rs1 = r[(ins >> 15) & 0x1F];
                            rs2 = r[(ins >> 20) & 0x1F];
                            rindex = (ins >> 7) & 0x1F;
                            r[rindex] = rs1 + rs2;
                            message.Debug("add - "+ utils.ToHex(ins)+" register " + r[rindex]);
                            break;

                        case 0x02:
                            //slt
                            rs1 = r[(ins >> 15) & 0x1F];
                            rs2 = r[(ins >> 20) & 0x1F];
                            if(rs1 < rs2) r[rindex] = 0x01;
                            else r[rindex] = 0x00;
                            message.Debug("slt - "+ utils.ToHex(ins)+" register " + r[rindex]);
                            break;

                        case 0x03:
                            //sltu
                            rs1 = r[(ins >> 15) & 0x1F] >>> 0;
                            rs2 = r[(ins >> 20) & 0x1F] >>> 0;
                            rindex = (ins >> 7) & 0x1F;
                            if(rs1 < rs2) r[rindex] = 0x01;
                            else r[rindex] = 0x00;
                            message.Debug("sltu - "+ utils.ToHex(ins)+" register " + r[rindex]);
                            break;

                        case 0x07:
                            //and
                            rs1 = r[(ins >> 15) & 0x1F];
                            rs2 = r[(ins >> 20) & 0x1F];
                            rindex = (ins >> 7) & 0x1F;
                            r[rindex] = rs1 & rs2;
                            message.Debug("and - "+ utils.ToHex(ins)+" register " + r[rindex]);
                            break;

                        case 0x06:
                            //or
                            rs1 = r[(ins >> 15) & 0x1F];
                            rs2 = r[(ins >> 20) & 0x1F];
                            rindex = (ins >> 7) & 0x1F;
                            r[rindex] = rs1 | rs2;
                            message.Debug("or - "+ utils.ToHex(ins)+" register " + r[rindex]);
                            break;

                        case 0x04:
                            //xor
                            rs1 = r[(ins >> 15) & 0x1F];
                            rs2 = r[(ins >> 20) & 0x1F];
                            rindex = (ins >> 7) & 0x1F;
                            r[rindex] = rs1 ^ rs2;
                            message.Debug("xor - "+ utils.ToHex(ins)+" register " + r[rindex]);
                            break;

                        case 0x01:
                            //sll
                            rs1 = r[(ins >> 15) & 0x1F];
                            rs2 = r[(ins >> 20) & 0x1F];
                            rindex = (ins >> 7) & 0x1F;
                            r[rindex] = rs1 << (rs2 & 0x1F);
                            message.Debug("sll - "+ utils.ToHex(ins)+" register " + r[rindex]);
                            break;

                        case 0x05:
                            //srl
                            rs1 = r[(ins >> 15) & 0x1F];
                            rs2 = r[(ins >> 20) & 0x1F];
                            rindex = (ins >> 7) & 0x1F;
                            r[rindex] = rs1 >>> (rs2 & 0x1F);
                            message.Debug("srl - "+ utils.ToHex(ins)+" register " + r[rindex]);
                            break;
                    }
                    break;

                case 0x20:
                    //sub
                    switch((ins >> 12)&0x7) {
                        case 0x00:
                            //sub
                            rs1 = r[(ins >> 15) & 0x1F];
                            rs2 = r[(ins >> 20) & 0x1F];
                            rindex = (ins >> 7) & 0x1F;
                            r[rindex] = rs1 - rs2;
                            message.Debug("sub - "+ utils.ToHex(ins)+" register " + r[rindex]);
                            break;

                        case 0x05:
                            //sra
                            rs1 = r[(ins >> 15) & 0x1F];
                            rs2 = r[(ins >> 20) & 0x1F];
                            rindex = (ins >> 7) & 0x1F;
                            r[rindex] = rs1 >> (rs2 & 0x1F);
                            message.Debug("sra - "+ utils.ToHex(ins)+" register " + r[rindex]);
                            break;
                    }
                    break;

                case 0x01:
                    //mul,mulh,mulhsu,mulhu,div,divu,rem,remu
                    switch((ins >> 12)&0x7) {
                        case 0x00:
                            //mul
                            rs1 = r[(ins >> 15) & 0x1F];
                            rs2 = r[(ins >> 20) & 0x1F];
                            rindex = (ins >> 7) & 0x1F;
                            mul = rs1 * rs2;
                            r[rindex] = mul & 0xFFFFFFFF;
                            message.Debug("mul - "+ utils.ToHex(ins)+" register " + r[rindex]);
                            break;

                        case 0x01:
                            //mulh
                            rs1 = r[(ins >> 15) & 0x1F];
                            rs2 = r[(ins >> 20) & 0x1F];
                            rindex = (ins >> 7) & 0x1F;
                            r[rindex] = (rs1 >> 0) * (rs2);
                            var rAl = rs1 & 0xFFFF;
                            var rBl = rs2 & 0xFFFF;
                            r[rindex] = r[rindex] & 0xFFFF0000 | ((rAl * rBl) & 0xFFFF);
                            message.Debug("mulh - "+ utils.ToHex(ins)+" register " + r[rindex]);
                            break;

                        case 0x02:
                            //mulhsu
                            rs1 = r[(ins >> 15) & 0x1F];
                            rs2 = r[(ins >> 20) & 0x1F];
                            rindex = (ins >> 7) & 0x1F;
                            r[rindex] = (rs1 >>> 0) * (rs2 >>> 0);
                            var rAl = (rs1 >>> 0) & 0xFFFF;
                            var rBl = (rs2 >>> 0) & 0xFFFF;
                            r[rindex] = r[rindex] & 0xFFFF0000 | ((rAl * rBl) & 0xFFFF);
                            message.Debug("mulhsu - "+ utils.ToHex(ins)+" register " + r[rindex]);
                            break;

                        case 0x03:
                            //mulhu
                            rs1 = r[(ins >> 15) & 0x1F];
                            rs2 = r[(ins >> 20) & 0x1F];
                            rindex = (ins >> 7) & 0x1F;
                            r[rindex] = (rs1 >> 0) * (rs2);
                            var rAl = rs1 & 0xFFFF;
                            var rBl = (rs2 >>> 0) & 0xFFFF;
                            r[rindex] = r[rindex] & 0xFFFF0000 | ((rAl * rBl) & 0xFFFF);
                            message.Debug("mulhu - "+ utils.ToHex(ins)+" register " + r[rindex]);
                            break;

                        case 0x04:
                            //div
                            rs1 = r[(ins >> 15) & 0x1F];
                            rs2 = r[(ins >> 20) & 0x1F];
                            rindex = (ins >> 7) & 0x1F;
                            quo = rs1 / rs2;
                            r[rindex] = quo;
                            message.Debug("div - "+ utils.ToHex(ins)+" register " + r[rindex]);
                            break;

                        case 0x05:
                            //divu
                            rs1 = r[(ins >> 15) & 0x1F];
                            rs2 = r[(ins >> 20) & 0x1F];
                            rindex = (ins >> 7) & 0x1F;
                            quo = (rs1 >>> 0) / (rs2 >>> 0);
                            r[rindex] = quo;
                            message.Debug("divu - "+ utils.ToHex(ins)+" register " + r[rindex]);
                            break;

                        case 0x06:
                            //rem
                            rs1 = r[(ins >> 15) & 0x1F];
                            rs2 = r[(ins >> 20) & 0x1F];
                            rindex = (ins >> 7) & 0x1F;
                            rem = rs1 % rs2;
                            r[rindex] = rem;
                            message.Debug("rem - "+ utils.ToHex(ins)+" register " + r[rindex]);
                            break;

                        case 0x07:
                            //remu
                            rs1 = r[(ins >> 15) & 0x1F];
                            rs2 = r[(ins >> 20) & 0x1F];
                            rindex = (ins >> 7) & 0x1F;
                            rem = (rs1 >>> 0) % (rs2 >>> 0);
                            r[rindex] = rem;
                            message.Debug("remu - "+ utils.ToHex(ins)+" register " + r[rindex]);
                            break;
                    }
                    break;

                

                default:
                    message.Debug("Error in safecpu: Instruction " + utils.ToHex(ins) + "not found");
                    break;

            }
            break;

        case 0x37:
            //lui
            rindex = (ins >> 7) & 0x1F;
            r[rindex] = (ins & 0xFFFFF000);
            message.Debug("Lui - "+ utils.ToHex(ins)+" register " + r[rindex]);
            break;

        case 0x17:
            //auipc
            imm = (ins & 0xFFFFF000);
            rindex = (ins >> 7) & 0x1F;
            r[rindex] = (imm + this.pc);
            message.Debug("auipc - "+ utils.ToHex(ins)+" register " + r[rindex]);
            break;

        case 0x6F:
            //jal
            imm1 = (ins >> 21) & 0x3FF;
            imm2 = ((ins >> 20) & 0x01) << 10;
            imm3 = ((ins >> 12) & 0xFF) << 11;
            imm4 = ((ins >> 31) & 0x01) << 19;
            imm = (((imm1 + imm2 + imm3 +imm4) << 1) << 11) >> 11; 
            rindex = (ins >> 7) & 0x1F;
            r[rindex] = this.pc + 4;
            this.pc = this.pc + imm - 4|0;//-4 is a temp hack
            message.Debug("jal - "+ utils.ToHex(ins)+" register " + r[rindex]);
            break; 

        case 0x67:
            //jalr
            imm = (ins >> 20);
            rs1 = r[(ins >> 15) & 0x1F];
            rindex = (ins >> 7) & 0x1F;
            r[rindex] = this.pc + 4;
            this.pc = ((rs1 + imm) & 0xFFFFFFFE) - 4|0;//-4 is a temp hack
            message.Debug("jalr - "+ utils.ToHex(ins)+" register " + r[rindex]);
            break;

        case 0x63:
            //beq,bne,blt,bge,bltu,bgeu
            switch((ins >> 12)&0x7) {
                
                case 0x00:
                    //beq
                    imm1 = (ins >> 31) << 11;
                    imm2 = ((ins >> 25) & 0x3F) << 4;
                    imm3 = (ins >> 8) & 0x0F;
                    imm4 = ((ins >> 7) & 0x01) << 10;
                    imm = (((imm1 + imm2 + imm3 + imm4) << 1 ) << 19) >> 19;
                    rs1 = r[(ins >> 15) & 0x1F];
                    rs2 = r[(ins >> 20) & 0x1F];
                    if(rs1 == rs2) this.pc = this.pc + imm - 4|0;//-4 temporary hack
                    message.Debug("beq - "+ utils.ToHex(ins)+" register " + utils.ToHex(rs1));
                    break;

                case 0x01:
                    //bne
                    imm1 = (ins >> 31) << 11;
                    imm2 = ((ins >> 25) & 0x3F) << 4;
                    imm3 = (ins >> 8) & 0x0F;
                    imm4 = ((ins >> 7) & 0x01) << 10;
                    imm = (((imm1 + imm2 + imm3 + imm4) << 1 ) << 19) >> 19;
                    rs1 = r[(ins >> 15) & 0x1F];
                    rs2 = r[(ins >> 20) & 0x1F];
                    if(rs1 != rs2) this.pc = this.pc + imm - 4|0;//-4 temporary hack
                    message.Debug("bne - "+ utils.ToHex(rs2)+" register " + utils.ToHex((ins >> 20) & 0x1F));
                    break;

                case 0x04:
                    //blt
                    imm1 = (ins >> 31) << 11;
                    imm2 = ((ins >> 25) & 0x3F) << 4;
                    imm3 = (ins >> 8) & 0x0F;
                    imm4 = ((ins >> 7) & 0x01) << 10;
                    imm = (((imm1 + imm2 + imm3 + imm4) << 1 ) << 19) >> 19;
                    rs1 = r[(ins >> 15) & 0x1F];
                    rs2 = r[(ins >> 20) & 0x1F];
                    if(rs1 < rs2) this.pc = this.pc + imm - 4|0;//-4 temporary hack
                    message.Debug("blt - "+ utils.ToHex(ins)+" register " + r[rindex]);
                    break;

                case 0x05:
                    //bge
                    imm1 = (ins >> 31) << 11;
                    imm2 = ((ins >> 25) & 0x3F) << 4;
                    imm3 = (ins >> 8) & 0x0F;
                    imm4 = ((ins >> 7) & 0x01) << 10;
                    imm = (((imm1 + imm2 + imm3 + imm4) << 1 ) << 19) >> 19;
                    rs1 = r[(ins >> 15) & 0x1F];
                    rs2 = r[(ins >> 20) & 0x1F];
                    if(rs1 >= rs2) this.pc = this.pc + imm - 4|0;//-4 temporary hack
                    message.Debug("bge - "+ utils.ToHex(ins)+" register " + r[rindex]);
                    break;

                case 0x06:
                    //bltu
                    imm1 = (ins >> 31) << 11;
                    imm2 = ((ins >> 25) & 0x3F) << 4;
                    imm3 = (ins >> 8) & 0x0F;
                    imm4 = ((ins >> 7) & 0x01) << 10;
                    imm = (((imm1 + imm2 + imm3 + imm4) << 1 ) << 19) >> 19;
                    rs1 = r[(ins >> 15) & 0x1F] >>> 0;
                    rs2 = r[(ins >> 20) & 0x1F] >>> 0;
                    if(rs1 < rs2) this.pc = this.pc + imm - 4|0;//-4 temporary hack
                    message.Debug("bltu - "+ utils.ToHex(ins)+" register " + r[rindex]);
                    break;

                case 0x07:
                    //bgeu
                    imm1 = (ins >> 31) << 11;
                    imm2 = ((ins >> 25) & 0x3F) << 4;
                    imm3 = (ins >> 8) & 0x0F;
                    imm4 = ((ins >> 7) & 0x01) << 10;
                    imm = (((imm1 + imm2 + imm3 + imm4) << 1 ) << 19) >> 19;
                    rs1 = r[(ins >> 15) & 0x1F] >>> 0;
                    rs2 = r[(ins >> 20) & 0x1F] >>> 0;
                    if(rs1 >= rs2) this.pc = this.pc + imm - 4|0;//-4 temporary hack
                    message.Debug("bgeu - "+ utils.ToHex(ins)+" register " + r[rindex]);
                    break;

                default:
                    message.Debug("Error in safecpu: Instruction " + utils.ToHex(ins) + "not found");
                    break;

            }
            break;

        case 0x73:
            //csrrw,csrrs,csrrc,csrrwi,csrrsi,csrrci
            switch((ins >> 12)&0x7) {
                
                case 0x01:
                    //csrrw
                    imm = (ins >>> 20);
                    rs1 = r[(ins >> 15) & 0x1F];
                    rindex = (ins >> 7) & 0x1F;
                    r[rindex] = this.GetCSR(imm);
                    this.SetCSR(imm, rs1);
                    message.Debug("csrrw - "+ utils.ToHex(ins)+" rs1 "+utils.ToHex(rs1)+" imm " + csr[imm]);
                    break;

                case 0x02:
                    //csrrs
                    imm = (ins >>> 20);
                    rs1 = r[(ins >> 15) & 0x1F];
                    rindex = (ins >> 7) & 0x1F;
                    r[rindex] = this.GetCSR(imm);
                    this.SetCSR(imm, this.GetCSR(imm) | rs1);
                    message.Debug("csrrs - "+ utils.ToHex(ins)+" rs1 "+utils.ToHex(rs1)+" imm " + csr[imm]);
                    break;

                case 0x03:
                    //csrrc
                    imm = (ins >>> 20);
                    rs1 = r[(ins >> 15) & 0x1F];
                    rindex = (ins >> 7) & 0x1F;
                    r[rindex] = this.GetCSR(imm);
                    this.SetCSR(imm, this.GetCSR(imm) & (~rs1));
                    message.Debug("csrrc - "+ utils.ToHex(ins)+" register " + r[rindex]);
                    break;

                case 0x05:
                    //csrrwi
                    imm = (ins >>> 20);
                    zimm = (ins >> 15) & 0x1F;
                    rindex = (ins >> 7) & 0x1F;
                    r[rindex] = this.GetCSR(imm);
                    if(zimm != 0) this.SetCSR(imm, (zimm >> 0));
                    message.Debug("csrrwi - "+ utils.ToHex(ins)+" register " + r[rindex]);
                    break;
                    

                case 0x06:
                    //csrrsi
                    imm = (ins >>> 20);
                    zimm = (ins >> 15) & 0x1F;
                    rindex = (ins >> 7) & 0x1F;
                    r[rindex] = this.GetCSR(imm);
                    if(zimm != 0) this.SetCSR(imm, this.GetCSR(imm) | (zimm >> 0));
                    message.Debug("csrrsi - "+ utils.ToHex(ins)+" register " + r[rindex]);
                    break;

                case 0x07:
                    //csrrci
                    imm = (ins >>> 20);
                    zimm = (ins >> 15) & 0x1F;
                    rindex = (ins >> 7) & 0x1F;
                    r[rindex] = this.GetCSR(imm);
                    if(zimm != 0) this.SetCSR(imm, this.GetCSR(imm) & ~(zimm >> 0));
                    message.Debug("csrrci - "+ utils.ToHex(ins)+" register " + r[rindex]);
                    break;

                default:
                    message.Debug("Error in safecpu: Instruction " + utils.ToHex(ins) + "not found");
                    break;

            }
            break;

        case 0x07:
            //flw,fld
            switch((ins >> 12)&0x7) {
                
                case 0x02:
                    //flw
                    imm = (ins >> 20);
                    fs1 = r[(ins >> 15) & 0x1F];
                    findex = ((ins >> 7) & 0x1F);
                    r[0] = this.ram.Read32(fs1 + imm);
                    f[findex] = ff[0];
                    message.Debug("flw - "+ utils.ToHex(ins)+" register " + f[findex]);
                    break;

                case 0x03:
                    //fld
                    imm = (ins >> 20);
                    fs1 = r[(ins >> 15) & 0x1F];
                    findex = ((ins >> 7) & 0x1F) << 1;
                    fi[findex + 0] = this.ram.Read32(fs1 + imm + 0);
                    fi[findex + 1] = this.ram.Read32(fs1 + imm + 4);
                    message.Debug("fld - "+ utils.ToHex(ins)+" register " + fi[findex]);
                    break;

                default:
                    message.Debug("Error in safecpu: Instruction " + utils.ToHex(ins) + "not found");
                    message.Abort();
                    break;

            }
            break;

        case 0x27:
            //fsw,fsd
            switch((ins >> 12)&0x7) {

                case 0x02:
                    //fsw
                    imm1 = (ins >> 25);
                    imm2 = (ins >> 7) & 0x1F;
                    imm = (imm1 << 5) + imm2;
                    fs1 = r[(ins >> 15) & 0x1F];
                    findex = (ins >> 20) & 0x1F;
                    ff[0] = f[findex];
                    this.ram.Write32(fs1 + imm,r[0]);
                    message.Debug("fsw - "+ utils.ToHex(ins)+" register " + f[findex]);
                    break;

                case 0x03:
                    //fsd
                    imm1 = (ins >> 25);
                    imm2 = (ins >> 7) & 0x1F;
                    imm = (imm1 << 5) + imm2;
                    fs1 = r[(ins >> 15) & 0x1F];
                    findex = ((ins >> 20) & 0x1F) << 1;
                    this.ram.Write32(fs1 + imm + 0,fi[findex + 0]);
                    this.ram.Write32(fs1 + imm + 4,fi[findex + 1]);
                    message.Debug("fsw - "+ utils.ToHex(ins)+" register " + fi[findex]);
                    break;

                default:
                    message.Debug("Error in safecpu: Instruction " + utils.ToHex(ins) + "not found");
                    message.Abort();
                    break;

            }
            break;

        case 0x53:
            //fadd.s,fsub.s
            switch((ins >> 25)&0x7F) {
                
                case 0x00 :
                    //fadd.s
                    rs1 = f[(ins >> 15) & 0x1F];
                    rs2 = f[(ins >> 20) & 0x1F];
                    rindex = (ins >> 7) & 0x1F;
                    f[rindex] = rs1 + rs2;
                    message.Debug("fadd.s - "+ utils.ToHex(ins)+" register " + f[rindex]);
                    break;

                case 0x04:
                    //fsub.s
                    rs1 = f[(ins >> 15) & 0x1F];
                    rs2 = f[(ins >> 20) & 0x1F];
                    rindex = (ins >> 7) & 0x1F;
                    f[rindex] = rs1 - rs2;
                    message.Debug("fsub.s - "+ utils.ToHex(ins)+" register " + f[rindex]);
                    break;

                case 0x60:
                    //fcvt.w.s
                    rindex = (ins >> 7) & 0x1F;
                    r[rindex] = f[(ins >> 15) & 0x1F];
                    message.Debug("fcvt.w.s - "+ utils.ToHex(ins)+" register " + r[rindex]);
                    break;

                case 0x01 :
                    //fadd.d
                    rs1 = f[(ins >> 15) & 0x1F];
                    rs2 = f[(ins >> 20) & 0x1F];
                    rindex = (ins >> 7) & 0x1F;
                    f[rindex] = rs1 + rs2;
                    message.Debug("fadd.d - "+ utils.ToHex(ins)+" register " + f[rindex]);
                    break;

                case 0x05:
                    //fsub.d
                    rs1 = f[(ins >> 15) & 0x1F];
                    rs2 = f[(ins >> 20) & 0x1F];
                    rindex = (ins >> 7) & 0x1F;
                    f[rindex] = rs1 - rs2;
                    message.Debug("fsub.d - "+ utils.ToHex(ins)+" register " + f[rindex]);
                    break;

                case 0x61:
                    //fcvt.w.d
                    rindex = (ins >> 7) & 0x1F;
                    r[rindex] = f[(ins >> 15) & 0x1F];
                    message.Debug("fcvt.w.s - "+ utils.ToHex(ins)+" register " + r[rindex]);
                    break;


                default:
                    message.Debug("Error in safecpu: Instruction " + utils.ToHex(ins) + "not found");
                    message.Abort();
                    break;
            }
            break;

        default:
            message.Debug("Error in safecpu: Instruction " + utils.ToHex(ins) + "not found");
            message.Abort();
            break;
        }

    message.Debug(utils.ToHex(this.pc));
    this.pc = this.pc + 4|0;
    this.ticks++;
    return 0;
};

module.exports = SafeCPU;
