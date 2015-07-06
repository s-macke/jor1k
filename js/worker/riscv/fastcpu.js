// -------------------------------------------------
// -------------------- CPU ------------------------
// -------------------------------------------------
var message = require('../messagehandler');
var utils = require('../utils');
var HTIF = require('./htif.js');


// constructor
function FastCPU(stdlib, foreign, heap, ram) {
"use asm";

var DebugMessage = foreign.DebugMessage;
var abort = foreign.abort;
var Read32 = foreign.Read32;
var Write32 = foreign.Write32;
var Read16 = foreign.Read16;
var Write16 = foreign.Write16;
var Read8 = foreign.Read8;
var Write8 = foreign.Write8;

var PRV_U = 0x00;
var PRV_S = 0x01;
var PRV_H = 0x02;
var PRV_M = 0x03;

var VM_READ  = 0;
var VM_WRITE = 1;
var VM_FETCH = 2;

var CAUSE_TIMER_INTERRUPT          = (1<<31) | 0x01;
var CAUSE_HOST_INTERRUPT           = (1<<31) | 0x02;
var CAUSE_SOFTWARE_INTERRUPT       = (1<<31) | 0x00;
var CAUSE_INSTRUCTION_ACCESS_FAULT = 0x01;
var CAUSE_ILLEGAL_INSTRUCTION      = 0x02;
var CAUSE_BREAKPOINT               = 0x03;
var CAUSE_LOAD_ACCESS_FAULT        = 0x05;
var CAUSE_STORE_ACCESS_FAULT       = 0x07;
var CAUSE_ENVCALL_UMODE            = 0x08;
var CAUSE_ENVCALL_SMODE            = 0x09;
var CAUSE_ENVCALL_HMODE            = 0x0A;
var CAUSE_ENVCALL_MMODE            = 0x0B;


var CSR_CYCLES = 0xC00;
var CSR_CYCLEW = 0x900;


var CSR_FFLAGS    = 0x1;
var CSR_FRM       = 0x2;
var CSR_FCSR      = 0x3;

var CSR_SSTATUS   = 0x100;
var CSR_STVEC     = 0x101;
var CSR_SIE       = 0x104;
var CSR_STIMECMP  = 0x121;
var CSR_SSCRATCH  = 0x140;
var CSR_SEPC      = 0x141;
var CSR_SIP       = 0x144;
var CSR_SPTBR     = 0x180;
var CSR_SASID     = 0x181;

var CSR_HEPC      = 0x241;

var CSR_MSTATUS   = 0x300;
var CSR_MTVEC     = 0x301;
var CSR_MTDELEG   = 0x302;
var CSR_MIE       = 0x304;
var CSR_MTIMECMP  = 0x321;
var CSR_MEPC      = 0x341;
var CSR_MSCRATCH  = 0x340;
var CSR_MCAUSE    = 0x342;
var CSR_MBADADDR  = 0x343;
var CSR_MIP       = 0x344;
var CSR_MTOHOST_TEMP = 0x345; // terminal output, temporary for the patched pk.

var CSR_MTIME     = 0x701;
var CSR_MTIMEH    = 0x741;
var CSR_MRESET    = 0x782;
var CSR_SEND_IPI  = 0x783;

var CSR_MTOHOST         = 0x780;
var CSR_MFROMHOST       = 0x781;
var CSR_MDEVCMDTOHOST   = 0x790; // special
var CSR_MDEVCMDFROMHOST = 0x791; // special

var CSR_TIMEW     = 0x901;
var CSR_INSTRETW  = 0x902;
var CSR_CYCLEHW   = 0x980;
var CSR_TIMEHW    = 0x981;
var CSR_INSTRETHW = 0x982;

var CSR_STIMEW    = 0xA01;
var CSR_STIMEH    = 0xD81;
var CSR_STIMEHW   = 0xA81;
var CSR_STIME     = 0xD01;
var CSR_SCAUSE    = 0xD42;
var CSR_SBADADDR  = 0xD43;
var CSR_MCPUID    = 0xF00;
var CSR_MIMPID    = 0xF01;
var CSR_MHARTID   = 0xF10;
var CSR_CYCLEH    = 0xC80;
var CSR_TIMEH     = 0xC81;
var CSR_INSTRETH  = 0xC82;

var CSR_MCPUID    = 0xF00;
var CSR_MIMPID    = 0xF01;
var CSR_MHARTID   = 0xF10;

var CSR_TIME      = 0xC01;
var CSR_INSTRET   = 0xC02;
var CSR_STATS     = 0xC0;
var CSR_UARCH0    = 0xCC0;
var CSR_UARCH1    = 0xCC1;
var CSR_UARCH2    = 0xCC2;
var CSR_UARCH3    = 0xCC3;
var CSR_UARCH4    = 0xCC4;
var CSR_UARCH5    = 0xCC5;
var CSR_UARCH6    = 0xCC6;
var CSR_UARCH7    = 0xCC7;
var CSR_UARCH8    = 0xCC8;
var CSR_UARCH9    = 0xCC9;
var CSR_UARCH10   = 0xCCA;
var CSR_UARCH11   = 0xCCB;
var CSR_UARCH12   = 0xCCC;
var CSR_UARCH13   = 0xCCCD;
var CSR_UARCH14   = 0xCCCE;
var CSR_UARCH15   = 0xCCCF;

var htif = new HTIF(ram);

var r = new stdlib.Int32Array(heap, 0, 32); // registers
var f = new stdlib.Float64Array(heap, 32<<2, 32); // registers

var fi = new stdlib.Int32Array(heap, 32<<2, 32); // for copying operations
var ff = new stdlib.Float32Array(heap, 0, 1); // the zero register is used to convert to single precision
var csr = new stdlib.Int32Array(heap, 0x2000, 4096);

var pc = 0x200;
var ticks;
var amoaddr,amovalue;

function Init() {
    Reset();
}

function Reset() {
    ticks = 0;
    csr[CSR_MSTATUS]  = 0x96; // 1001 0110 - All Interrupts Disabled, FPU disabled 
    csr[CSR_MTOHOST]  =  0x780;
    csr[CSR_MCPUID]   = 0x4112D;
    csr[CSR_MIMPID]   = 0x01;
    csr[CSR_MHARTID]  = 0x00;
    csr[CSR_MTVEC]    = 0x100;
    csr[CSR_MIE]      = 0x00;
    csr[CSR_MEPC]     = 0x00;
    csr[CSR_MCAUSE]   = 0x00;
    csr[CSR_MBADADDR] = 0x00;
    csr[CSR_SSTATUS]  = 0x3010;
    csr[CSR_STVEC]    = 0x00;
    csr[CSR_SIE]      = 0x00;
    csr[CSR_TIME]     = 0x0;
    csr[CSR_SPTBR]    = 0x40000;

    // for atomic load & store instructions
    amoaddr = 0x00; 
    amovalue = 0x00;
}

function InvalidateTLB() {
}

function GetTimeToNextInterrupt() {
    return 10;
}

function GetTicks() {
    return ticks;
}

function ProgressTime(delta) {
    ticks += delta;
}


function AnalyzeImage() // we haveto define these to copy the cpus
{
}

function CheckForInterrupt() {
};

function RaiseInterrupt(line, cpuid) {
    DebugMessage("raise int " + line);
};

function ClearInterrupt(line, cpuid) {
};

function Disassemble(ins) {

    var rindex = 0x00;
    var findex = 0x00;
    var imm = 0x00;
    var imm1 = 0x00;
    var imm2 = 0x00;
    var imm3 = 0x00;
    var imm4 = 0x00;
    var zimm = 0x00;
    var rs1 = 0x00;
    var rs2 = 0x00;
    var fs1 = 0x00;
    var fs2 = 0x00;

    switch(ins&0x7F) {

        case 0x03:
            //lb,lh,lw,lbu,lhu
            switch((ins >> 12)&0x7) {
                
                case 0x00:
                    //lb
                    DebugMessage("lb - "+ utils.ToHex(ins)+" register " + r[rindex]);
                    break;

                case 0x01:
                    //lh
                    DebugMessage("lh - "+ utils.ToHex(ins)+" register " + r[rindex]);
                    break;

                case 0x02:
                    //lw
                    DebugMessage("lw - "+ utils.ToHex(ins)+" register " + r[rindex]);
                    break;

                case 0x04:
                    //lbu
                    DebugMessage("lbu - "+ utils.ToHex(ins)+" register " + r[rindex]);
                    break;

                case 0x05:
                    //lhu
                    DebugMessage("lhu - "+ utils.ToHex(ins)+" register " + r[rindex]);
                    break;

                default:
                    DebugMessage("Error in safecpu: Instruction " + utils.ToHex(ins) + "not found");
                    break;

            }
            break;

        case 0x23:
            //sb,sh,sw
            switch((ins >> 12)&0x7) {
                
                case 0x00:
                    //sb
                    DebugMessage("sb - "+ utils.ToHex(ins)+" register " + r[rindex]);
                    break;

                case 0x01:
                    //sh
                    DebugMessage("sh - "+ utils.ToHex(ins)+" register " + r[rindex]);
                    break;

                case 0x02:
                    //sw
                    DebugMessage("sw - "+ utils.ToHex(ins)+" register " + r[rindex]);
                    break;

                default:
                    DebugMessage("Error in safecpu: Instruction " + utils.ToHex(ins) + "not found");
                    break;

            }
            break;

        case 0x13:
            //addi,slti,sltiu,xori,ori,andi,slli,srli,srai
            switch((ins >> 12)&0x7) {
                
                case 0x00:
                    //addi
                    DebugMessage("addi - "+ utils.ToHex(ins)+" register " + r[rindex]);
                    break;

                case 0x02:
                    //slti
                    DebugMessage("slti - "+ utils.ToHex(ins)+" register " + r[rindex]);
                    break;

                case 0x03:
                    //sltiu
                    DebugMessage("sltiu - "+ utils.ToHex(ins)+" register " + r[rindex]);
                    break;

                case 0x04:
                    //xori
                    DebugMessage("xori - "+ utils.ToHex(ins)+" register " + r[rindex]);
                    break;

                case 0x06:
                    //ori
                    DebugMessage("ori - "+ utils.ToHex(ins)+" register " + r[rindex]);
                    break;

                case 0x07:
                    //andi
                    DebugMessage("andi - "+ utils.ToHex(ins)+" register " + r[rindex]);
                    break;

                case 0x01:
                    //slli
                    DebugMessage("slli - "+ utils.ToHex(ins)+" register " + r[rindex]);
                    break;

                case 0x05:
                    if(((ins >> 25) & 0x7F) == 0x00){
                        //srli
                        DebugMessage("srli - "+ utils.ToHex(ins)+" register " + r[rindex]);
                    }
                    else if(((ins >> 25) & 0x7F) == 0x20){
                        //srai
                        DebugMessage("srai - "+ utils.ToHex(ins)+" register " + r[rindex]);  
                    }
                    break;

                default:
                    DebugMessage("Error in safecpu: Instruction " + utils.ToHex(ins) + "not found");
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
                            DebugMessage("add - "+ utils.ToHex(ins)+" register " + r[rindex]);
                            break;

                        case 0x02:
                            //slt
                            DebugMessage("slt - "+ utils.ToHex(ins)+" register " + r[rindex]);
                            break;

                        case 0x03:
                            //sltu
                            DebugMessage("sltu - "+ utils.ToHex(ins)+" register " + r[rindex]);
                            break;

                        case 0x07:
                            //and
                            DebugMessage("and - "+ utils.ToHex(ins)+" register " + r[rindex]);
                            break;

                        case 0x06:
                            //or
                            DebugMessage("or - "+ utils.ToHex(ins)+" register " + r[rindex]);
                            break;

                        case 0x04:
                            //xor
                            DebugMessage("xor - "+ utils.ToHex(ins)+" register " + r[rindex]);
                            break;

                        case 0x01:
                            //sll
                            DebugMessage("sll - "+ utils.ToHex(ins)+" register " + r[rindex]);
                            break;

                        case 0x05:
                            //srl
                            DebugMessage("srl - "+ utils.ToHex(ins)+" register " + r[rindex]);
                            break;
                    }
                    break;

                case 0x20:
                    //sub
                    switch((ins >> 12)&0x7) {
                        case 0x00:
                            //sub
                            DebugMessage("sub - "+ utils.ToHex(ins)+" register " + r[rindex]);
                            break;

                        case 0x05:
                            //sra
                            DebugMessage("sra - "+ utils.ToHex(ins)+" register " + r[rindex]);
                            break;
                    }
                    break;

                case 0x01:
                    //mul,mulh,mulhsu,mulhu,div,divu,rem,remu
                    switch((ins >> 12)&0x7) {
                        case 0x00:
                            //mul
                            DebugMessage("mul - "+ utils.ToHex(ins)+" register " + r[rindex]);
                            break;

                        case 0x01:
                            //mulh
                            DebugMessage("mulh - "+ utils.ToHex(ins)+" register " + r[rindex]);
                            break;

                        case 0x02:
                            //mulhsu
                            DebugMessage("mulhsu - "+ utils.ToHex(ins)+" register " + r[rindex]);
                            break;

                        case 0x03:
                            //mulhu
                            DebugMessage("mulhu - "+ utils.ToHex(ins)+" register " + r[rindex]);
                            break;

                        case 0x04:
                            //div
                            DebugMessage("div - "+ utils.ToHex(ins)+" register " + r[rindex]);
                            break;

                        case 0x05:
                            //divu
                            DebugMessage("divu - "+ utils.ToHex(ins)+" register " + r[rindex]);
                            break;

                        case 0x06:
                            //rem
                            DebugMessage("rem - "+ utils.ToHex(ins)+" register " + r[rindex]);
                            break;

                        case 0x07:
                            //remu
                            DebugMessage("remu - "+ utils.ToHex(ins)+" register " + r[rindex]);
                            break;
                    }
                    break;
               

                default:
                    DebugMessage("Error in safecpu: Instruction " + utils.ToHex(ins) + "not found");
                    break;

            }
            break;

        case 0x37:
            //lui
            DebugMessage("Lui - "+ utils.ToHex(ins)+" register " + r[rindex]);
            break;

        case 0x17:
            //auipc
            DebugMessage("auipc - "+ utils.ToHex(ins)+" register " + r[rindex]);
            break;

        case 0x6F:
            //jal
            DebugMessage("jal - "+ utils.ToHex(ins)+" register " + r[rindex]);
            break; 

        case 0x67:
            //jalr
            DebugMessage("jalr - "+ utils.ToHex(ins)+" register " + r[rindex]);
            break;

        case 0x63:
            //beq,bne,blt,bge,bltu,bgeu
            switch((ins >> 12)&0x7) {
                
                case 0x00:
                    //beq
                    DebugMessage("beq - "+ utils.ToHex(ins)+" register " + utils.ToHex(rs1));
                    break;

                case 0x01:
                    //bne
                    DebugMessage("bne - "+ utils.ToHex(rs2)+" register " + utils.ToHex((ins >> 20) & 0x1F));
                    break;

                case 0x04:
                    //blt
                    DebugMessage("blt - "+ utils.ToHex(ins)+" register " + r[rindex]);
                    break;

                case 0x05:
                    //bge
                    DebugMessage("bge - "+ utils.ToHex(ins)+" register " + r[rindex]);
                    break;

                case 0x06:
                    //bltu
                    DebugMessage("bltu - "+ utils.ToHex(ins)+" register " + r[rindex]);
                    break;

                case 0x07:
                    //bgeu
                    DebugMessage("bgeu - "+ utils.ToHex(ins)+" register " + r[rindex]);
                    break;

                default:
                    DebugMessage("Error in safecpu: Instruction " + utils.ToHex(ins) + "not found");
                    break;

            }
            break;

        case 0x73:
            //csrrw,csrrs,csrrc,csrrwi,csrrsi,csrrci,ecall,eret,ebreak,mrts
            switch((ins >> 12)&0x7) {
                
                case 0x01:
                    //csrrw
                    DebugMessage("csrrw - "+ utils.ToHex(ins)+" rs1 "+utils.ToHex(rs1)+" imm " + csr[imm]);
                    break;

                case 0x02:
                    //csrrs
                    DebugMessage("csrrs - "+ utils.ToHex(ins)+" rs1 "+utils.ToHex(rs1)+" imm " + csr[imm]);
                    break;

                case 0x03:
                    //csrrc
                    DebugMessage("csrrc - "+ utils.ToHex(ins)+" register " + r[rindex]);
                    break;

                case 0x05:
                    //csrrwi
                    DebugMessage("csrrwi - "+ utils.ToHex(ins)+" register " + r[rindex]);
                    break;
                    

                case 0x06:
                    //csrrsi
                    DebugMessage("csrrsi - "+ utils.ToHex(ins)+" register " + r[rindex]);
                    break;

                case 0x07:
                    //csrrci
                    DebugMessage("csrrci - "+ utils.ToHex(ins)+" register " + r[rindex]);
                    break;
                
                case 0x00:
                    //ecall,eret,ebreak,mrts
                    switch((ins >> 20)&0xFFF) {
                        case 0x00:
                            //ecall
                            var current_privilege_level = (csr[CSR_MSTATUS] & 0x06) >> 1;
                            switch(current_privilege_level)
                            {
                                case PRV_U:
                                    DebugMessage("ecall PRV_U -"+ utils.ToHex(ins));
                                    break;

                                case PRV_S:
                                    DebugMessage("ecall PRV_S -"+ utils.ToHex(ins));
                                    break;

                                case PRV_H:
                                    DebugMessage("Not supported ecall PRV_H -"+ utils.ToHex(ins));
                                    break;

                                case PRV_M:
                                    DebugMessage("ecall PRV_M -"+ utils.ToHex(ins));
                                    break;
                                
                                default:
                                    DebugMessage("Error in ecall: Don't know how to handle privilege level " + current_privilege_level);
                                    break;
                            }
                            break;

                        case 0x001:
                            //ebreak
                            DebugMessage("ebreak - "+ utils.ToHex(ins)+" at PC" + utils.ToHex(pc));
                            break;

                        case 0x100:
                            //eret
                            var current_privilege_level = (csr[CSR_MSTATUS] & 0x06) >> 1;
                            if(current_privilege_level < PRV_S) {
                                DebugMessage("Error in eret: current_privilege_level isn't allowed access");
                                break;   
                            }
                            switch(current_privilege_level)
                            {
                                
                                case PRV_S:
                                    DebugMessage("eret PRV_S -"+ utils.ToHex(ins));
                                    break;

                                case PRV_H:
                                    DebugMessage("Not supported eret PRV_H -"+ utils.ToHex(ins));
                                    break;

                                case PRV_M:
                                    DebugMessage("eret PRV_M -"+ utils.ToHex(ins));
                                    break;
                                
                                default:
                                    DebugMessage("Error in eret: Don't know how to handle privilege level " + current_privilege_level);
                                    break;
                            }
                            break;

                        case 0x305:
                            //mrts     
                            if(current_privilege_level != PRV_M) {
                                DebugMessage("Error in mrts: current_privilege_level isn't allowed access");
                                break;   
                            }
                            DebugMessage("mrts - "+ utils.ToHex(ins)+" at PC" + utils.ToHex(pc));
                            break;

                        case 0x101:
                            //sfence.vm
                            DebugMessage("sfence.vm - "+ utils.ToHex(ins)+" at PC" + utils.ToHex(pc));
                            break;

                        default:
                            DebugMessage("Error in safecpu: Instruction " + utils.ToHex(ins) + "not found");
                            break;

                    }
                    break; 

                default:
                    DebugMessage("Error in safecpu: Instruction " + utils.ToHex(ins) + "not found");
                    break;

            }
            break;

        case 0x07:
            //flw,fld
            switch((ins >> 12)&0x7) {
                
                case 0x02:
                    //flw
                    DebugMessage("flw - "+ utils.ToHex(ins)+" register " + f[findex]);
                    break;

                case 0x03:
                    //fld
                    DebugMessage("fld - "+ utils.ToHex(ins)+" register " + fi[findex]);
                    break;

                default:
                    DebugMessage("Error in safecpu: Instruction " + utils.ToHex(ins) + "not found");
                    break;

            }
            break;

        case 0x27:
            //fsw,fsd
            switch((ins >> 12)&0x7) {

                case 0x02:
                    //fsw
                    DebugMessage("fsw - "+ utils.ToHex(ins)+" register " + f[findex]);
                    break;

                case 0x03:
                    //fsd
                    DebugMessage("fsw - "+ utils.ToHex(ins)+" register " + fi[findex]);
                    break;

                default:
                    DebugMessage("Error in safecpu: Instruction " + utils.ToHex(ins) + "not found");
                    break;

            }
            break;

        case 0x53:
            //fadd.s,fsub.s
            switch((ins >> 25)&0x7F) {
                
                case 0x00 :
                    //fadd.s
                    DebugMessage("fadd.s - "+ utils.ToHex(ins)+" register " + f[rindex]);
                    break;

                case 0x04:
                    //fsub.s
                    DebugMessage("fsub.s - "+ utils.ToHex(ins)+" register " + f[rindex]);
                    break;

                case 0x60:
                    //fcvt.w.s
                    DebugMessage("fcvt.w.s - "+ utils.ToHex(ins)+" register " + r[rindex]);
                    break;

                case 0x01 :
                    //fadd.d
                    DebugMessage("fadd.d - "+ utils.ToHex(ins)+" register " + f[rindex]);
                    break;

                case 0x05:
                    //fsub.d
                    DebugMessage("fsub.d - "+ utils.ToHex(ins)+" register " + f[rindex]);
                    break;

                case 0x61:
                    //fcvt.w.d
                    DebugMessage("fcvt.w.s - "+ utils.ToHex(ins)+" register " + r[rindex]);
                    break;

                case 0x78:
                    //fmv.s.x
                    DebugMessage("fmv.s.x - "+ utils.ToHex(ins)+" register " + r[rindex]);
                    break;


                default:
                    DebugMessage("Error in safecpu: Instruction " + utils.ToHex(ins) + "not found");
                    break;
            }
            break;

        case 0x2F:
            //amoswap,amoadd,amoxor,amoand,amoor,amomin,amomax,amominu,amomaxu
            switch((ins >> 27)&0x1F) {
                
                case 0x01:
                    //amoswap
                    DebugMessage("amoswap - "+ utils.ToHex(ins)+" register " + r[rindex]);
                    break;

                case 0x00:
                    //amoadd
                    DebugMessage("amoadd - "+ utils.ToHex(ins)+" register " + r[rindex]);
                    break;

                case 0x04:
                    //amoxor
                    DebugMessage("amoxor - "+ utils.ToHex(ins)+" register " + r[rindex]);
                    break;

                case 0x0C:
                    //amoand
                    DebugMessage("amoand - "+ utils.ToHex(ins)+" register " + r[rindex]);
                    break;

                case 0x08:
                    //amoor
                    DebugMessage("amoor - "+ utils.ToHex(ins)+" register " + r[rindex]);
                    break;

                case 0x10:
                    //amomin
                    DebugMessage("amomin - "+ utils.ToHex(ins)+" register " + r[rindex]);
                    break;

               case 0x14:
                    //amomax
                    DebugMessage("amomax - "+ utils.ToHex(ins)+" register " + r[rindex]);
                    break;

                case 0x18:
                    //amominu
                    DebugMessage("amominu - "+ utils.ToHex(ins)+" register " + r[rindex]);
                    break;

                case 0x1C:
                    //amomaxu
                    DebugMessage("amomaxu - "+ utils.ToHex(ins)+" register " + r[rindex]);
                    break;

                case 0x02:
                    //lr.d
                    DebugMessage("lr.d - "+ utils.ToHex(ins)+" register " + r[rindex]);
                    break;

                case 0x03:
                    //sc.d
                    DebugMessage("sc.d - "+ utils.ToHex(ins)+" register " + r[rindex]);
                    break;

                default:
                    DebugMessage("Error in Atomic Memory Instruction " + utils.ToHex(ins) + "not found");
                    break;

            }
            break;

        case 0x0F:
            //fence
            DebugMessage("fence - "+ utils.ToHex(ins)+" at PC" + utils.ToHex(pc));
            break;

        default:
            DebugMessage("Error in safecpu: Instruction " + utils.ToHex(ins) + " not found at "+utils.ToHex(pc));
            break;
    }

    DebugMessage(utils.ToHex(pc));
};

function Trap(cause, current_pc) {

    var current_privilege_level = (csr[CSR_MSTATUS] & 0x06) >> 1;
    PushPrivilegeStack();
    csr[CSR_MEPC] = current_pc;
    csr[CSR_MCAUSE] = cause;
    pc = (0x100 + 0x40*current_privilege_level)|0;  
};

function MemTrap(addr, op) {
    csr[CSR_MBADADDR] = addr;
    switch(op) {
        case VM_READ:
            Trap(CAUSE_LOAD_ACCESS_FAULT, pc - 4|0);
            break;

        case VM_WRITE:
            Trap(CAUSE_STORE_ACCESS_FAULT, pc - 4|0);
            break;

        case VM_FETCH:
            Trap(CAUSE_INSTRUCTION_ACCESS_FAULT, pc);
            break;
    }
}



function CheckVMPrivilege(type, op) {

    var priv = (csr[CSR_MSTATUS] & 0x06) >> 1;

    switch(type) {

        case 2: 
            if (op == VM_READ) return true;
            if ((priv == PRV_U) && (op == VM_FETCH)) return true;
            return false;
            break;

        case 3: 
            if (!( (priv == PRV_S) && (op == VM_FETCH) ) ) return true;
            break;

        case 4:
            if (op == VM_READ) return true;
            return false;
            break;

        case 5:
            if (op != VM_FETCH) return true;
            break;

        case 6:
            if (op != VM_WRITE) return true;
            break;

        case 7:
            return true;
            break;

        case 13:
            if ((priv == PRV_S) && (op != VM_FETCH)) return true;
            break;

        case 14:
            if ((priv == PRV_S) && (op != VM_WRITE)) return true;
            break;

        case 15: 
            if (priv == PRV_S) return true;
            break;

    }

    DebugMessage("Inside CheckVMPrivilege for PC "+utils.ToHex(pc) + " and type " + type + " and op " + op);
    abort();
    return false;
}


function TranslateVM(addr, op) {
    var vm = (csr[CSR_MSTATUS] >> 17) & 0x1F;
    var current_privilege_level = (csr[CSR_MSTATUS] & 0x06) >> 1;
    var i = 1; //i = LEVELS -1 and LEVELS = 2 in a 32 bit System

    // vm bare mode
    if(vm == 0 || current_privilege_level == PRV_M) return addr;

    // hack, open mmio by direct mapping
    //if ((addr>>>28) == 0x9) return addr;

    // only RV32 supported
    if(vm != 8) {
        DebugMessage("unkown VM Mode " + vm + " at PC " + utils.ToHex(pc));
        abort();
    }

    // LEVEL 1
    var offset = addr & 0xFFF;
    var page_num = (addr >>> 22);

    var frame_num = Read32(csr[CSR_SPTBR] + (page_num << 2));
    var type = ((frame_num >> 1) & 0xF);
    var valid = (frame_num & 0x01);

    if (valid == 0) {
        //DebugMessage("Unsupported valid field " + valid + " or invalid entry in PTE at PC "+utils.ToHex(pc) + " pl:" + current_privilege_level + " addr:" + utils.ToHex(addr) + " op:"+op);
        //abort();
        MemTrap(addr, op);
        return -1;
    }
    if (type >= 2) {

        if (!CheckVMPrivilege(type,op)) {
            DebugMessage("Error in TranslateVM: Unhandled trap");
            abort();
        }
/*
        var updated_frame_num = frame_num;
        if(op == VM_READ)
            updated_frame_num = (frame_num | 0x20);
        else if(op == VM_WRITE)
            updated_frame_num = (frame_num | 0x60);
        Write32(csr[CSR_SPTBR] + (page_num << 2),updated_frame_num);
*/
        return (((frame_num >> 10) | ((addr >> 12) & 0x3FF)) << 12) | offset;
    }

    // LEVEL 2
    //DebugMessage("Second level MMU");
    i = i - 1;
    var offset = addr & 0xFFF;
    var new_sptbr = (frame_num & 0xFFFFFC00) << 2;
    var new_page_num = (addr >> 12) & 0x3FF;
    var new_frame_num = Read32(new_sptbr + (new_page_num << 2));
    var new_type = ((new_frame_num >> 1) & 0xF);
    var new_valid = (new_frame_num & 0x01);

    if (new_valid == 0) {
        MemTrap(addr, op);
        return -1;
    }

    if (!CheckVMPrivilege(new_type, op)) {
        //DebugMessage("Error in TranslateVM: Unhandled trap");
        //abort();
        MemTrap(addr, op);
        return -1;
    }

/*
    var updated_frame_num = new_frame_num;
    if(op == VM_READ)
        updated_frame_num = (new_frame_num | 0x20);
    else if(op == VM_WRITE)
        updated_frame_num = (new_frame_num | 0x60);
    Write32(new_sptbr + (new_page_num << 2),updated_frame_num);
*/

    return ((new_frame_num >> 10) << 12) | offset;
};


function SetCSR(addr,value) {


    switch(addr)
    {
        case CSR_FCSR:
            csr[addr] = value;
            break;

        case CSR_MDEVCMDTOHOST:
            csr[addr] = value;
            htif.WriteDEVCMDToHost(value);
            break;

        case CSR_MDEVCMDFROMHOST:
            csr[addr] = value;
            htif.WriteDEVCMDFromHost(value);
            break;

        case CSR_MTOHOST:
            csr[addr] =  value;
            htif.WriteToHost(value);
            break;

        case CSR_MTOHOST_TEMP: //only temporary for the patched pk.
            Write8(0x90000000 >> 0, value);
            if (value == 0xA) Write8(0x90000000 >> 0, 0xD);
            break;

        case CSR_MFROMHOST:
            csr[addr] = value;
            htif.WriteFromHost(value);
            break;

        case CSR_MSTATUS:
            csr[addr] = value;
            break;

        case CSR_MCPUID:
            //csr[addr] = value;
            break;

        case CSR_MIMPID:
            csr[addr] = value;
            break;

        case CSR_MHARTID:
            csr[addr] = value;
            break;

        case CSR_MTVEC:
            csr[addr] = value;
            break;

        case CSR_MIP:
            //csr[addr] = value;
            var mask = 0x2 | 0x08; //mask = MIP_SSIP | MIP_MSIP
            csr[CSR_MIP] = (csr[CSR_MIP] & ~mask) | (value & mask);
            break;

        case CSR_MIE:
            //csr[addr] = value;
            var mask = 0x2 | 0x08 | 0x20; //mask = MIP_SSIP | MIP_MSIP | MIP_STIP
            csr[CSR_MIE] = (csr[CSR_MIE] & ~mask) | (value & mask);
            break;

        case CSR_SEPC:
        case CSR_MEPC:
            csr[addr] = value;
            break;

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

        case CSR_SSTATUS:
            csr[addr] = value;
            csr[CSR_MSTATUS] &= ~0x1F039; 
            csr[CSR_MSTATUS] |= (csr[CSR_SSTATUS] & 0x01); //IE0
            csr[CSR_MSTATUS] |= (csr[CSR_SSTATUS] & 0x08); //IE1
            csr[CSR_MSTATUS] |= (csr[CSR_SSTATUS] & 0x10); //PRV1
            csr[CSR_MSTATUS] |= (csr[CSR_SSTATUS] & 0xF000); //FS,XS
            csr[CSR_MSTATUS] |= (csr[CSR_SSTATUS] & 0x10000); //MPRV
            break; 

        case CSR_STVEC:
            csr[addr] = value;
            break;

        case CSR_SIP:
            //csr[addr] = value;
            var mask = 0x2; //mask = MIP_SSIP
            csr[CSR_MIP] = (csr[CSR_MIP] & ~mask) | (value & mask);
            break;

        case CSR_SIE:
            //csr[addr] = value;
            var mask = 0x2 | 0x20; //mask = MIP_SSIP | MIP_STIP
            csr[CSR_MIE] = (csr[CSR_MIE] & ~mask) | (value & mask);
            break;

        case CSR_MSCRATCH:
            csr[addr] = value;
            break;

        case CSR_SSCRATCH:
            csr[addr] = value;
            break;

        case CSR_CYCLEW:
            csr[addr] = value;
            break;

        case CSR_CYCLES:
            ticks = value;
            csr[addr] = value;
            break;

        case CSR_MTIME:
        case CSR_STIME:
        case CSR_STIMEW:
            csr[addr] = value;
            break;

        case CSR_MTIMEH:
        case CSR_STIMEH:
        case CSR_STIMEHW:
            csr[addr] = value;
            break;

        case CSR_TIME:
        case CSR_TIMEW:
            csr[addr] = value;
            break;

        case CSR_MTIMECMP:
        case CSR_STIMECMP:
            csr[CSR_MIP] &= ~(0x20); //csr[CSR_MIP] &= ~MIP_STIP
            csr[addr] = value;
            break;

        case CSR_SPTBR:
            csr[addr] = value;
            break;

        default:
            csr[addr] = value;
            DebugMessage("Error in SetCSR: PC "+utils.ToHex(pc)+" Address " + utils.ToHex(addr) + " unkown");
            abort();
            break;
    }
};

function GetCSR(addr) {

    var current_privilege_level = (csr[CSR_MSTATUS] & 0x06) >> 1;

    switch(addr)
    {
        case CSR_FCSR:
            return 0x0;
            break;

        case CSR_MDEVCMDTOHOST:
            return htif.ReadDEVCMDToHost();
            break;

        case CSR_MDEVCMDFROMHOST:
            return htif.ReadDEVCMDFromHost();
            break;

        case CSR_MTOHOST:
            return htif.ReadToHost();
            break;

        case CSR_MTOHOST_TEMP: //only temporary for the patched pk.
            return 0x0;
            break;

        case CSR_MFROMHOST:
            return htif.ReadFromHost();
            break;

        case CSR_MSTATUS:
            return csr[addr];
            break;

        case CSR_MCPUID:
            return csr[addr];
            break;

        case CSR_MIMPID:
            return csr[addr];
            break;

        case CSR_MHARTID:
            return csr[addr];
            break;

        case CSR_MTVEC:
            return csr[addr];
            break;

        case CSR_MIE:
            return csr[addr];
            break;

        case CSR_SEPC:
        case CSR_MEPC:
            return csr[addr];
            break;

        case CSR_MCAUSE:
            return csr[addr];
            break;

        case CSR_SCAUSE:
            return csr[addr];
            break;

        case CSR_MBADADDR:
            return csr[addr];
            break;

        case CSR_SBADADDR:
            return csr[addr];
            break;

        case CSR_SSTATUS:
            //if (current_privilege_level == 0) Trap(CAUSE_ILLEGAL_INSTRUCTION);
            csr[CSR_SSTATUS] = 0x00; 
            csr[CSR_SSTATUS] |= (csr[CSR_MSTATUS] & 0x01); //IE0
            csr[CSR_SSTATUS] |= (csr[CSR_MSTATUS] & 0x08); //IE1
            csr[CSR_SSTATUS] |= (csr[CSR_MSTATUS] & 0x10); //PRV1
            csr[CSR_SSTATUS] |= (csr[CSR_MSTATUS] & 0xF000); //FS,XS
            csr[CSR_SSTATUS] |= (csr[CSR_MSTATUS] & 0x10000); //MPRV
            return csr[CSR_SSTATUS];
            break;

        case CSR_STVEC:
            return csr[addr];
            break;

        case CSR_MIP:
            return csr[addr];
            break;

        case CSR_MIE:
            return csr[addr];
            break;

        case CSR_SIP: 
            return csr[CSR_MIP] & (0x2 | 0x20);//(MIP_SSIP | MIP_STIP)
            break;

        case CSR_SIE: 
            return csr[CSR_MIE] & (0x2 | 0x20);//(MIP_SSIP | MIP_STIP)
            break;

        case CSR_MSCRATCH:
            return csr[addr];
            break;

        case CSR_SSCRATCH:
            return csr[addr];
            break;

        case CSR_CYCLEW:
            return ticks;
            break;

        case CSR_CYCLES:
            return ticks;
            break;

        case CSR_MTIME:
        case CSR_STIME:
        case CSR_STIMEW:
            return ticks;
            break;

        case CSR_MTIMEH:
        case CSR_STIMEH:
        case CSR_STIMEHW:
            return (ticks) >> 32;
            break;

        case CSR_TIME:
        case CSR_TIMEW:
            return ticks;
            break;

        case CSR_MTIMECMP:
        case CSR_STIMECMP:
            return csr[addr];
            break;
        
        case CSR_SPTBR:
            return csr[addr];
            break;

        default:
            DebugMessage("Error in GetCSR: PC "+utils.ToHex(pc)+" Address " + utils.ToHex(addr) + " unkown");
            abort();
            return csr[addr];
            break;
    }
   
};

function IMul(a,b) {

    var result = [0,0];

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

function UMul(a,b) {

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

    result = IMul(Math.abs(a), Math.abs(b));

    if (doNegate) {
        result[0] = ~result[0];
        result[1] = ~result[1];
        result[0] = (result[0] + 1) | 0;
        if (result[0] == 0) result[1] = (result[1] + 1) | 0;
    }

    return result;
};

function SUMul(a,b) {

    var result = [0,0];

    if (a == 0) return result[0] = result[1] = 0, result;
    if (b == 0) return result[0] = result[1] = 0, result;

    a |= 0;
    b >>>= 0;

    if ((a >= -32768 && a <= 32767) && (b >= -32768 && b <= 32767)) {
        result[0] = a * b;
        result[1] = (result[0] < 0) ? -1 : 0;
        return result;
    }

    var doNegate = (a < 0) ^ (b < 0);

    result = IMul(Math.abs(a), Math.abs(b));

    if (doNegate) {
        result[0] = ~result[0];
        result[1] = ~result[1];
        result[0] = (result[0] + 1) | 0;
        if (result[0] == 0) result[1] = (result[1] + 1) | 0;
    }

    return result;
};


function PushPrivilegeStack(){

    var mstatus = csr[CSR_MSTATUS];
    var privilege_level_stack =  (mstatus & 0xFFF);
    var new_privilege_level_stack = (((privilege_level_stack << 2) | PRV_M) << 1) & 0xFFF;
    csr[CSR_MSTATUS] = (((mstatus >> 12) << 12) + new_privilege_level_stack) & 0xFFFEFFFF; //Last "and" to set mprv(bit 16) to zero
};

function PopPrivilegeStack(){

    var mstatus = csr[CSR_MSTATUS];
    var privilege_level_stack =  (mstatus & 0xFFF);
    var new_privilege_level_stack = ((privilege_level_stack >>> 3) | ((PRV_U << 1) | 0x1) << 9);
    csr[CSR_MSTATUS] = ((mstatus >> 12) << 12) + new_privilege_level_stack;
};

function Step(steps, clockspeed) {

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
    var rs1 = 0x0;
    var rs2 = 0x0;
    var fs1 = 0.0;
    var fs2 = 0.0;
    
    do {
        r[0] = 0x00;

        var current_privilege_level = (csr[CSR_MSTATUS] & 0x06) >> 1;

        ticks = ticks + 1|0;
        if (ticks == csr[CSR_STIMECMP]) {
            csr[CSR_MIP] = csr[CSR_MIP] | 0x20;
        }
        var interrupts = csr[CSR_MIE] & csr[CSR_MIP];
        var ie = csr[CSR_MSTATUS] & 0x01;
        if (interrupts) {

            if ((current_privilege_level < 3) || ((current_privilege_level == 3) && ie)) {
                if (interrupts & 0x8) {
                    Trap(CAUSE_SOFTWARE_INTERRUPT, pc);
                    continue;
                } else
                if (!htif.IsQueueEmpty()) {
                    Trap(CAUSE_HOST_INTERRUPT, pc);
                    continue;
                }
            }
            if ((current_privilege_level < 1) || ((current_privilege_level == 1) && ie)) {
                if (interrupts & 0x2) {
                    Trap(CAUSE_SOFTWARE_INTERRUPT, pc);
                    continue;
                } else
                if (interrupts & 0x20) {
                     Trap(CAUSE_TIMER_INTERRUPT, pc);
                     continue;
                }
            }
        }

        var paddr = TranslateVM(pc, VM_FETCH);
        if(paddr == -1) {
            continue;
        }
        var ins = Read32(paddr);
        pc = pc + 4|0;
        //Disassemble(ins);

        switch(ins&0x7F) {

            case 0x03:
                //lb, lh, lw, lbu, lhu
                switch((ins >> 12)&0x7) {
                    
                    case 0x00:
                        //lb
                        imm = (ins >> 20);
                        rs1 = r[(ins >> 15) & 0x1F];
                        rindex = (ins >> 7) & 0x1F;
                        paddr = TranslateVM(rs1 + imm|0, VM_READ);
                        if(paddr == -1) break;
                        r[rindex] = (Read8(paddr) << 24) >> 24;
                        break;

                    case 0x01:
                        //lh
                        imm = (ins >> 20);
                        rs1 = r[(ins >> 15) & 0x1F];
                        rindex = (ins >> 7) & 0x1F;
                        paddr = TranslateVM(rs1 + imm|0, VM_READ);
                        if(paddr == -1) break;
                        r[rindex] = (Read16(paddr) << 16) >> 16;
                        break;

                    case 0x02:
                        //lw
                        imm = (ins >> 20);
                        rs1 = r[(ins >> 15) & 0x1F];
                        rindex = (ins >> 7) & 0x1F;
                        if ((rs1+imm) & 3) {
                             DebugMessage("Error in lw: unaligned address");
                             abort();
                        }
                        paddr = TranslateVM(rs1 + imm|0, VM_READ);
                        if(paddr == -1) break;
                        r[rindex] = Read32(paddr);
                        break;

                    case 0x04:
                        //lbu
                        imm = (ins >> 20);
                        rs1 = r[(ins >> 15) & 0x1F];
                        rindex = (ins >> 7) & 0x1F;
                        paddr = TranslateVM(rs1 + imm|0, VM_READ);
                        if(paddr == -1) break;
                        r[rindex] = Read8(paddr) & 0xFF;
                        break;

                    case 0x05:
                        //lhu
                        imm = (ins >> 20);
                        rs1 = r[(ins >> 15) & 0x1F];
                        rindex = (ins >> 7) & 0x1F;
                        paddr = TranslateVM(rs1 + imm|0 ,VM_READ);
                        if(paddr == -1) break;
                        r[rindex] = Read16(paddr) & 0xFFFF;
                        break;

                    default:
                        DebugMessage("Error in safecpu: Instruction " + utils.ToHex(ins) + "not found");
                        abort();
                        break;

                }
                break;

            case 0x23:
                //sb, sh, sw
                imm1 = (ins >> 25);
                imm2 = (ins >> 7) & 0x1F;
                imm = (imm1 << 5) | imm2;
                switch((ins >> 12)&0x7) {
                    
                    case 0x00:
                        //sb
                        rs1 = r[(ins >> 15) & 0x1F];
                        rindex = (ins >> 20) & 0x1F;
                        paddr = TranslateVM(rs1 + imm|0,VM_WRITE);
                        if(paddr == -1) break;
                        Write8(paddr,(r[rindex] & 0xFF));
                        break;

                    case 0x01:
                        //sh
                        rs1 = r[(ins >> 15) & 0x1F];
                        rindex = (ins >> 20) & 0x1F;
                        paddr = TranslateVM(rs1 + imm|0,VM_WRITE);
                        if(paddr == -1) break;
                        Write16(paddr,(r[rindex] & 0xFFFF));
                        break;

                    case 0x02:
                        //sw
                        rs1 = r[(ins >> 15) & 0x1F];
                        rindex = (ins >> 20) & 0x1F;
                        if ((rs1+imm) & 3) {
                             DebugMessage("Error in sw: unaligned address");
                             abort();
                        }
                        paddr = TranslateVM(rs1 + imm|0,VM_WRITE);
                        if(paddr == -1) break;
                        Write32(paddr,r[rindex]);
                        break;

                    default:
                        DebugMessage("Error in safecpu: Instruction " + utils.ToHex(ins) + "not found");
                        abort();
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
                        break;

                    case 0x02:
                        //slti
                        imm = (ins >> 20);
                        rs1 = r[(ins >> 15) & 0x1F];
                        rindex = (ins >> 7) & 0x1F;
                        if(rs1 < imm) r[rindex] = 0x01;
                        else r[rindex] = 0x00;
                        break;

                    case 0x03:
                        //sltiu
                        imm = (ins >> 20) >>> 0;
                        rs1 = r[(ins >> 15) & 0x1F] >>> 0;
                        rindex = (ins >> 7) & 0x1F;
                        if(rs1 < imm) r[rindex] = 0x01;
                        else r[rindex] = 0x00;
                        break;

                    case 0x04:
                        //xori
                        imm = (ins >> 20);
                        rs1 = r[(ins >> 15) & 0x1F];
                        rindex = (ins >> 7) & 0x1F;
                        r[rindex] = rs1 ^ imm;
                        break;

                    case 0x06:
                        //ori
                        imm = (ins >> 20);
                        rs1 = r[(ins >> 15) & 0x1F];
                        rindex = (ins >> 7) & 0x1F;
                        r[rindex] = rs1 | imm;
                        break;

                    case 0x07:
                        //andi
                        imm = (ins >> 20);
                        rs1 = r[(ins >> 15) & 0x1F];
                        rindex = (ins >> 7) & 0x1F;
                        r[rindex] = rs1 & imm;
                        break;

                    case 0x01:
                        //slli
                        imm = (ins >> 20) & 0x1F;
                        rs1 = r[(ins >> 15) & 0x1F];
                        rindex = (ins >> 7) & 0x1F;
                        r[rindex] = rs1 << imm;
                        break;

                    case 0x05:
                        if(((ins >> 25) & 0x7F) == 0x00){
                            //srli
                            imm = (ins >> 20) & 0x1F;
                            rs1 = r[(ins >> 15) & 0x1F];
                            rindex = (ins >> 7) & 0x1F;
                            r[rindex] = rs1 >>> imm;
                        }
                        else if(((ins >> 25) & 0x7F) == 0x20){
                            //srai
                            imm = (ins >> 20) & 0x1F;
                            rs1 = r[(ins >> 15) & 0x1F];
                            rindex = (ins >> 7) & 0x1F;
                            r[rindex] = rs1 >> imm;
                        }
                        break;

                    default:
                        DebugMessage("Error in safecpu: Instruction " + utils.ToHex(ins) + "not found");
                        abort();
                        break;

                }
                break;

            case 0x33:
                //add,sub,sll,slt,sltu,xor,srl,sra,or,and
                switch((ins >> 25)&0x7F) {
                    
                    case 0x00:
                        //add,slt,sltu,add,or,xor,sll,srl
                        rs1 = r[(ins >> 15) & 0x1F];
                        rs2 = r[(ins >> 20) & 0x1F];
                        switch((ins >> 12)&0x7) {
                            case 0x00:
                                //add
                                rindex = (ins >> 7) & 0x1F;
                                r[rindex] = rs1 + rs2;
                                break;

                            case 0x02:
                                //slt
                                rindex = (ins >> 7) & 0x1F;
                                if(rs1 < rs2) r[rindex] = 0x01;
                                else r[rindex] = 0x00;
                                break;

                            case 0x03:
                                //sltu
                                rindex = (ins >> 7) & 0x1F;
                                if((rs1>>>0) < (rs2>>>0)) r[rindex] = 0x01;
                                else r[rindex] = 0x00;
                                break;

                            case 0x07:
                                //and
                                rindex = (ins >> 7) & 0x1F;
                                r[rindex] = rs1 & rs2;
                                break;

                            case 0x06:
                                //or
                                rindex = (ins >> 7) & 0x1F;
                                r[rindex] = rs1 | rs2;
                                break;

                            case 0x04:
                                //xor
                                rindex = (ins >> 7) & 0x1F;
                                r[rindex] = rs1 ^ rs2;
                                break;

                            case 0x01:
                                //sll
                                rindex = (ins >> 7) & 0x1F;
                                r[rindex] = rs1 << (rs2 & 0x1F);
                                break;

                            case 0x05:
                                //srl
                                rindex = (ins >> 7) & 0x1F;
                                r[rindex] = rs1 >>> (rs2 & 0x1F);
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
                                //sub
                                r[rindex] = rs1 - rs2;
                                break;

                            case 0x05:
                                //sra
                                r[rindex] = rs1 >> (rs2 & 0x1F);
                                break;
                        }
                        break;

                    case 0x01:
                        //mul,mulh,mulhsu,mulhu,div,divu,rem,remu
                        rs1 = r[(ins >> 15) & 0x1F];
                        rs2 = r[(ins >> 20) & 0x1F];
                        switch((ins >> 12)&0x7) {
                            case 0x00:
                                //mul
                                rindex = (ins >> 7) & 0x1F;
                                mul = rs1 * rs2;
                                r[rindex] = mul & 0xFFFFFFFF;
                                break;

                            case 0x01:
                                //mulh
                                rindex = (ins >> 7) & 0x1F;
                                var result = UMul(rs1,rs2);
                                r[rindex] = result[1];
                                break;

                            case 0x02:
                                //mulhsu
                                rindex = (ins >> 7) & 0x1F;
                                var result = SUMul(rs1,rs2>>>0);
                                r[rindex] = result[1];
                                break;

                            case 0x03:
                                //mulhu
                                rindex = (ins >> 7) & 0x1F;
                                var result = IMul(rs1>>>0, rs2>>>0);
                                r[rindex] = result[1];
                                break;

                            case 0x04:
                                //div
                                rindex = (ins >> 7) & 0x1F;
                                if(rs2 == 0)
                                    quo = -1;
                                else
                                    quo = rs1 / rs2;
                                r[rindex] = quo;
                                break;

                            case 0x05:
                                //divu
                                rindex = (ins >> 7) & 0x1F;
                                if(rs2 == 0)
                                    quo = 0xFFFFFFFF;
                                else
                                    quo = (rs1 >>> 0) / (rs2 >>> 0);
                                r[rindex] = quo;
                                break;

                            case 0x06:
                                //rem
                                rindex = (ins >> 7) & 0x1F;
                                if(rs2 == 0)
                                    rem = rs1;
                                else
                                    rem = rs1 % rs2;
                                r[rindex] = rem;
                                break;

                            case 0x07:
                                //remu
                                rindex = (ins >> 7) & 0x1F;
                                if(rs2 == 0)
                                    rem = (rs1 >>> 0);
                                else
                                    rem = (rs1 >>> 0) % (rs2 >>> 0);
                                r[rindex] = rem;
                                break;
                        }
                        break;

                    

                    default:
                        DebugMessage("Error in safecpu: Instruction " + utils.ToHex(ins) + "not found");
                        abort();
                        break;

                }
                break;

            case 0x37:
                //lui
                rindex = (ins >> 7) & 0x1F;
                r[rindex] = (ins & 0xFFFFF000);
                break;

            case 0x17:
                //auipc
                imm = (ins & 0xFFFFF000);
                rindex = (ins >> 7) & 0x1F;
                r[rindex] = (imm + pc - 4)|0;
                break;

            case 0x6F:
                //jal
                imm1 = (ins >> 21) & 0x3FF;
                imm2 = ((ins >> 20) & 0x1) << 10;
                imm3 = ((ins >> 12) & 0xFF) << 11;
                imm4 = (ins >> 31) << 19;
                imm =  (imm1 | imm2 | imm3 | imm4 ) << 1; 
                rindex = (ins >> 7) & 0x1F;
                r[rindex] = pc;
                pc = pc + imm - 4|0;
                break; 

            case 0x67:
                //jalr
                imm = (ins >> 20);
                rs1 = r[(ins >> 15) & 0x1F];
                rindex = (ins >> 7) & 0x1F;
                r[rindex] = pc;
                pc = ((rs1 + imm) & 0xFFFFFFFE)|0;
                break;

            case 0x63:
                //beq, bne, blt, bge, bltu, bgeu
                imm1 = (ins >> 31) << 11;
                imm2 = ((ins >> 25) & 0x3F) << 4;
                imm3 = (ins >> 8) & 0x0F;
                imm4 = ((ins >> 7) & 0x01) << 10;
                imm =  ((imm1 | imm2 | imm3 | imm4) << 1 );

                switch((ins >> 12)&0x7) {
                    
                    case 0x00:
                        //beq
                        rs1 = r[(ins >> 15) & 0x1F];
                        rs2 = r[(ins >> 20) & 0x1F];
                        if(rs1 == rs2) pc = pc + imm - 4|0;//-4 temporary hack
                        break;

                    case 0x01:
                        //bne
                        rs1 = r[(ins >> 15) & 0x1F];
                        rs2 = r[(ins >> 20) & 0x1F];
                        if(rs1 != rs2) pc = pc + imm - 4|0;//-4 temporary hack
                        break;

                    case 0x04:
                        //blt
                        rs1 = r[(ins >> 15) & 0x1F];
                        rs2 = r[(ins >> 20) & 0x1F];
                        if(rs1 < rs2) pc = pc + imm - 4|0;//-4 temporary hack
                        break;

                    case 0x05:
                        //bge
                        rs1 = r[(ins >> 15) & 0x1F];
                        rs2 = r[(ins >> 20) & 0x1F];
                        if(rs1 >= rs2) pc = pc + imm - 4|0;//-4 temporary hack
                        break;

                    case 0x06:
                        //bltu
                        rs1 = r[(ins >> 15) & 0x1F] >>> 0;
                        rs2 = r[(ins >> 20) & 0x1F] >>> 0;
                        if(rs1 < rs2) pc = pc + imm - 4|0;//-4 temporary hack
                        break;

                    case 0x07:
                        //bgeu
                        rs1 = r[(ins >> 15) & 0x1F] >>> 0;
                        rs2 = r[(ins >> 20) & 0x1F] >>> 0;
                        if(rs1 >= rs2) pc = pc + imm - 4|0;//-4 temporary hack
                        break;

                    default:
                        DebugMessage("Error in safecpu: Instruction " + utils.ToHex(ins) + "not found");
                        abort();
                        break;

                }
                break;

            case 0x73:
                //csrrw, csrrs, csrrc, csrrwi, csrrsi, csrrci, ecall, eret, ebreak, mrts, wfi
                imm = (ins >>> 20);
                rs1 = r[(ins >> 15) & 0x1F];
                rindex = (ins >> 7) & 0x1F;
                switch((ins >> 12)&0x7) {
                    
                    case 0x01:
                        //csrrw
                        r[rindex] = GetCSR(imm);
                        //if (rindex != ((ins >> 15) & 0x1F))
                        SetCSR(imm, rs1);
                        break;

                    case 0x02:
                        //csrrs
                        r[rindex] = GetCSR(imm);
                        SetCSR(imm, GetCSR(imm) | rs1);
                        break;

                    case 0x03:
                        //csrrc
                        r[rindex] = GetCSR(imm);
                        SetCSR(imm, GetCSR(imm) & (~rs1));
                        break;

                    case 0x05:
                        //csrrwi
                        r[rindex] = GetCSR(imm);
                        zimm = (ins >> 15) & 0x1F;
                        if(zimm != 0) SetCSR(imm, (zimm >> 0));
                        break;
                        

                    case 0x06:
                        //csrrsi
                        r[rindex] = GetCSR(imm);
                        zimm = (ins >> 15) & 0x1F;
                        if(zimm != 0) SetCSR(imm, GetCSR(imm) | (zimm >> 0));
                        break;

                    case 0x07:
                        //csrrci
                        r[rindex] = GetCSR(imm);
                        zimm = (ins >> 15) & 0x1F;
                        if(zimm != 0) SetCSR(imm, GetCSR(imm) & ~(zimm >> 0));
                        break;
                    
                    case 0x00:
                        //ecall, eret, ebreak, mrts, wfi
                        switch((ins >> 20)&0xFFF) {
                            case 0x00:
                                //ecall
                                switch(current_privilege_level)
                                {
                                    case PRV_U:
                                        Trap(CAUSE_ENVCALL_UMODE, pc - 4|0);
                                        break;

                                    case PRV_S:
                                        Trap(CAUSE_ENVCALL_SMODE, pc - 4|0);
                                        break;

                                    case PRV_H:
                                        Trap(CAUSE_ENVCALL_HMODE, pc - 4|0);
                                        abort();
                                        break;

                                    case PRV_M:
                                        Trap(CAUSE_ENVCALL_MMODE, pc - 4|0);
                                        break;
                                    
                                    default:
                                        DebugMessage("Error in ecall: Don't know how to handle privilege level " + current_privilege_level);
                                        abort();
                                        break;
                                }
                                break;

                            case 0x001:
                                //ebreak
                                Trap(CAUSE_BREAKPOINT, pc - 4|0);
                                break;

                            case 0x100:
                                //eret
                                var current_privilege_level = (csr[CSR_MSTATUS] & 0x06) >> 1;
                                if(current_privilege_level < PRV_S) {
                                    DebugMessage("Error in eret: current_privilege_level isn't allowed access");
                                    abort();
                                    break;   
                                }
                                PopPrivilegeStack();

                                switch(current_privilege_level)
                                {
                                    
                                    case PRV_S:
                                        //DebugMessage("eret PRV_S -"+ utils.ToHex(ins));
                                        pc = csr[CSR_SEPC]|0;
                                        break;

                                    case PRV_H:
                                        //DebugMessage("Not supported eret PRV_H -"+ utils.ToHex(ins));
                                        pc = csr[CSR_HEPC]|0;
                                        abort();
                                        break;

                                    case PRV_M:
                                        //DebugMessage("eret PRV_M -"+ utils.ToHex(ins));
                                        pc = csr[CSR_MEPC]|0;
                                        break;
                                    
                                    default:
                                        DebugMessage("Error in eret: Don't know how to handle privilege level " + current_privilege_level);
                                        abort();
                                        break;
                                }
                                break;

                            case 0x102:
                                // wfi
                                break;

                            case 0x305:
                                //mrts     
                                if(current_privilege_level != PRV_M) {
                                    DebugMessage("Error in mrts: current_privilege_level isn't allowed access");
                                    abort();
                                    break;   
                                }
                                csr[CSR_MSTATUS] = (csr[CSR_MSTATUS] & ~0x6) | 0x02; //Setting the Privilage level to Supervisor
                                csr[CSR_SBADADDR] = csr[CSR_MBADADDR];
                                csr[CSR_SCAUSE] = csr[CSR_MCAUSE];
                                csr[CSR_SEPC] = csr[CSR_MEPC];
                                pc = csr[CSR_STVEC]|0;
                                break;

                            case 0x101:
                                //sfence.vm
                                break;

                            default:
                                DebugMessage("Error in safecpu: Instruction " + utils.ToHex(ins) + "not found");
                                abort();
                                break;

                        }
                        break; 

                    default:
                        DebugMessage("Error in safecpu: Instruction " + utils.ToHex(ins) + "not found");
                        abort();
                        break;

                }
                break;

            case 0x07:
                //flw,fld
                switch((ins >> 12)&0x7) {
                    
                    case 0x02:
                        //flw
                        imm = (ins >> 20);
                        rs1 = r[(ins >> 15) & 0x1F];
                        findex = ((ins >> 7) & 0x1F);
                        paddr = TranslateVM(rs1 + imm|0,VM_READ);
                        if(paddr == -1) break;
                        r[0] = Read32(paddr);
                        f[findex] = ff[0];
                        break;

                    case 0x03:
                        //fld
                        imm = (ins >> 20);
                        rs1 = r[(ins >> 15) & 0x1F];
                        findex = ((ins >> 7) & 0x1F) << 1;
                        paddr = TranslateVM(rs1 + imm|0,VM_READ);
                        if(paddr == -1) break;
                        fi[findex + 0] = Read32(paddr+0);
                        fi[findex + 1] = Read32(paddr+4);
                        break;

                    default:
                        DebugMessage("Error in safecpu: Instruction " + utils.ToHex(ins) + "not found");
                        abort();
                        break;

                }
                break;

            case 0x27:
                //fsw, fsd
                switch((ins >> 12)&0x7) {

                    case 0x02:
                        //fsw
                        imm1 = (ins >> 25);
                        imm2 = (ins >> 7) & 0x1F;
                        imm = (imm1 << 5) + imm2;
                        rs1 = r[(ins >> 15) & 0x1F];
                        findex = (ins >> 20) & 0x1F;
                        ff[0] = f[findex];
                        paddr = TranslateVM(rs1 + imm|0, VM_WRITE);
                        if(paddr == -1) break;
                        Write32(paddr, r[0]);
                        break;

                    case 0x03:
                        //fsd
                        imm1 = (ins >> 25);
                        imm2 = (ins >> 7) & 0x1F;
                        imm = (imm1 << 5) + imm2;
                        rs1 = r[(ins >> 15) & 0x1F];
                        findex = ((ins >> 20) & 0x1F) << 1;
                        paddr = TranslateVM(rs1 + imm + 0|0, VM_WRITE);
                        if (paddr == -1) break;
                        Write32(paddr+0, fi[findex + 0]);
                        Write32(paddr+4, fi[findex + 1]);
                        break;

                    default:
                        DebugMessage("Error in safecpu: Instruction " + utils.ToHex(ins) + "not found");
                        abort();
                        break;

                }
                break;

            case 0x53:
                //fadd.s, fsub.s
                switch((ins >> 25)&0x7F) {
                    
                    case 0x00 :
                        //fadd.s
                        fs1 = f[(ins >> 15) & 0x1F];
                        fs2 = f[(ins >> 20) & 0x1F];
                        rindex = (ins >> 7) & 0x1F;
                        f[rindex] = fs1 + fs2;
                        break;

                    case 0x04:
                        //fsub.s
                        fs1 = f[(ins >> 15) & 0x1F];
                        fs2 = f[(ins >> 20) & 0x1F];
                        rindex = (ins >> 7) & 0x1F;
                        f[rindex] = fs1 - fs2;
                        break;

                    case 0x60:
                        //fcvt.w.s
                        rindex = (ins >> 7) & 0x1F;
                        r[rindex] = f[(ins >> 15) & 0x1F];
                        break;

                    case 0x01 :
                        //fadd.d
                        fs1 = f[(ins >> 15) & 0x1F];
                        fs2 = f[(ins >> 20) & 0x1F];
                        rindex = (ins >> 7) & 0x1F;
                        f[rindex] = fs1 + fs2;
                        break;

                    case 0x05:
                        //fsub.d
                        fs1 = f[(ins >> 15) & 0x1F];
                        fs2 = f[(ins >> 20) & 0x1F];
                        rindex = (ins >> 7) & 0x1F;
                        f[rindex] = fs1 - fs2;
                        break;

                    case 0x61:
                        //fcvt.w.d
                        rindex = (ins >> 7) & 0x1F;
                        r[rindex] = f[(ins >> 15) & 0x1F];
                        break;

                    case 0x78:
                        //fmv.s.x
                        rs1 = r[(ins >> 15) & 0x1F];
                        findex = (ins >> 7) & 0x1F;
                        f[findex] = rs1; 
                        break;


                    default:
                        DebugMessage("Error in safecpu: Instruction " + utils.ToHex(ins) + "not found");
                        abort();
                        break;
                }
                break;

            case 0x2F:
                //amoswap, amoadd, amoxor, amoand, amoor, amomin, amomax, amominu, amomaxu
                rs1 = r[(ins >> 15) & 0x1F];
                rs2 = r[(ins >> 20) & 0x1F];
                rindex = (ins >> 7) & 0x1F;
                switch((ins >> 27)&0x1F) {
                    
                    case 0x01:
                        //amoswap
                        paddr = TranslateVM(rs1|0, VM_READ);
                        if(paddr == -1) break;
                        r[rindex] = Read32(paddr);
                        paddr = TranslateVM(rs1|0, VM_WRITE);
                        if(paddr == -1) break;
                        Write32(paddr, rs2);
                        break;

                    case 0x00:
                        //amoadd
                        paddr = TranslateVM(rs1|0,VM_READ);
                        if(paddr == -1) break;
                        r[rindex] = Read32(paddr);
                        paddr = TranslateVM(rs1|0,VM_WRITE);
                        if(paddr == -1) break;
                        Write32(paddr,r[rindex] + rs2);
                        break;

                    case 0x04:
                        //amoxor
                        paddr = TranslateVM(rs1|0,VM_READ);
                        if(paddr == -1) break;
                        r[rindex] = Read32(paddr);
                        paddr = TranslateVM(rs1|0,VM_WRITE);
                        if(paddr == -1) break;
                        Write32(paddr,r[rindex] ^ rs2);
                        break;

                    case 0x0C:
                        //amoand
                        paddr = TranslateVM(rs1|0,VM_READ);
                        if(paddr == -1) break;
                        r[rindex] = Read32(paddr);
                        paddr = TranslateVM(rs1|0,VM_WRITE);
                        if(paddr == -1) break;
                        Write32(paddr,r[rindex] & rs2);
                        break;

                    case 0x08:
                        //amoor
                        paddr = TranslateVM(rs1|0,VM_READ);
                        if(paddr == -1) break;
                        r[rindex] = Read32(paddr);
                        paddr = TranslateVM(rs1|0,VM_WRITE);
                        if(paddr == -1) break;
                        Write32(paddr,r[rindex] | rs2);
                        break;

                    case 0x10:
                        //amomin
                        paddr = TranslateVM(rs1|0,VM_READ);
                        if(paddr == -1) break;
                        r[rindex] = Read32(paddr);
                        if((rs2 >> 0) > (r[rindex] >> 0)) r[0] = r[rindex];
                        else r[0] = rs2;
                        paddr = TranslateVM(rs1|0,VM_WRITE);
                        if(paddr == -1) break;
                        Write32(paddr,r[0]);
                        break;

                   case 0x14:
                        //amomax
                        paddr = TranslateVM(rs1,VM_READ);
                        if(paddr == -1) break;
                        r[rindex] = Read32(paddr);
                        if((rs2 >> 0) < (r[rindex] >> 0)) r[0] = r[rindex];
                        else r[0] = rs2;
                        paddr = TranslateVM(rs1,VM_WRITE);
                        if(paddr == -1) break;
                        Write32(paddr,r[0]);
                        break;

                    case 0x18:
                        //amominu
                        r[rindex] = Read32(paddr);
                        if((rs2 >>> 0) > (r[rindex] >>> 0)) r[0] = r[rindex];
                        else r[0] = rs2;
                        paddr = TranslateVM(rs1,VM_WRITE);
                        if(paddr == -1) break;
                        Write32(paddr,r[0]);
                        break;

                    case 0x1C:
                        //amomaxu
                        paddr = TranslateVM(rs1,VM_READ);
                        if(paddr == -1) break;
                        r[rindex] = Read32(paddr);
                        if((rs2 >>> 0) < (r[rindex] >>> 0)) r[0] = r[rindex];
                        else r[0] = rs2;
                        paddr = TranslateVM(rs1,VM_WRITE);
                        if(paddr == -1) break;
                        Write32(paddr,r[0]);
                        break;

                    case 0x02:
                        //lr.d
                        rs1 = r[(ins >> 15) & 0x1F];
                        paddr = TranslateVM(rs1,VM_READ);
                        if(paddr == -1) break;
                        r[rindex] = Read32(paddr);
                        amoaddr = rs1;
                        amovalue = r[rindex];
                        break;

                    case 0x03:
                        //sc.d
                        rs1 = r[(ins >> 15) & 0x1F];
                        rs2 = r[(ins >> 20) & 0x1F];
                        if(rs1 != amoaddr) {
                            r[rindex] = 0x01;
                            break;
                        }
                        paddr = TranslateVM(rs1, VM_READ);
                        if(paddr == -1) break;
                        if(Read32(paddr) != amovalue) {
                            r[rindex] = 0x01;
                            break;
                        }
                        r[rindex] = 0x00;
                        paddr = TranslateVM(rs1, VM_WRITE);
                        if (paddr == -1) break;
                        Write32(paddr, rs2);
                        break;

                    default:
                        DebugMessage("Error in Atomic Memory Instruction " + utils.ToHex(ins) + "not found");
                        abort();
                        break;

                }
                break;

            case 0x0F:
                //fence
                break;

            default:
                DebugMessage("Error in safecpu: Instruction " + utils.ToHex(ins) + " not found at "+utils.ToHex(pc));
                abort();
                break;
        }

    } while(--steps);
    return 0;
};

return {

    Reset: Reset,
    Init: Init,
    InvalidateTLB: InvalidateTLB,
    Step: Step,
    Disassemble: Disassemble,
    TranslateVM: TranslateVM,
    GetCSR: GetCSR,
    SetCSR: SetCSR,
    Trap: Trap,
    MemTrap: MemTrap,
    PopPrivilegeStack: PopPrivilegeStack,
    PushPrivilegeStack: PushPrivilegeStack,
    IMul: IMul,
    UMul: UMul,
    SUMul: SUMul,
    CheckVMPrivilege: CheckVMPrivilege,  
    GetTimeToNextInterrupt: GetTimeToNextInterrupt,
    ProgressTime: ProgressTime,
    GetTicks: GetTicks,
    AnalyzeImage: AnalyzeImage,
    CheckForInterrupt: CheckForInterrupt,
    RaiseInterrupt: RaiseInterrupt,
    ClearInterrupt: ClearInterrupt
};

}

module.exports = FastCPU;
