
"use strict";
var message = require('../messagehandler');
var utils = require('../utils');

var PRV_U = 0x00;
var PRV_S = 0x01;
var PRV_H = 0x02;
var PRV_M = 0x03;

var CSR_MSTATUS   = 0x300;

function Disassemble(ins,r,csr,pc) {
    message.Debug("pc=" + utils.ToHex(pc) + " ins=" + utils.ToHex(ins));

    switch(ins&0x7F) {

        case 0x03:
            //lb,lh,lw,lbu,lhu
            switch((ins >> 12)&0x7) {
                
                case 0x00:
                    //lb
                    message.Debug("lb");
                    break;

                case 0x01:
                    //lh
                    message.Debug("lh");
                    break;

                case 0x02:
                    //lw
                    message.Debug("lw");
                    break;

                case 0x04:
                    //lbu
                    message.Debug("lbu");
                    break;

                case 0x05:
                    //lhu
                    message.Debug("lhu");
                    break;

                default:
                    message.Debug("Error in disassemble: Instruction " + utils.ToHex(ins) + "not found");
                    break;

            }
            break;

        case 0x23:
            //sb,sh,sw
            switch((ins >> 12)&0x7) {
                
                case 0x00:
                    //sb
                    message.Debug("sb");
                    break;

                case 0x01:
                    //sh
                    message.Debug("sh");
                    break;

                case 0x02:
                    //sw
                    message.Debug("sw");
                    break;

                default:
                    message.Debug("Error in disassemble: Instruction " + utils.ToHex(ins) + "not found");
                    break;

            }
            break;

        case 0x13:
            //addi,slti,sltiu,xori,ori,andi,slli,srli,srai
            switch((ins >> 12)&0x7) {
                
                case 0x00:
                    //addi
                    message.Debug("addi");
                    break;

                case 0x02:
                    //slti
                    message.Debug("slti");
                    break;

                case 0x03:
                    //sltiu
                    message.Debug("sltiu");
                    break;

                case 0x04:
                    //xori
                    message.Debug("xori");
                    break;

                case 0x06:
                    //ori
                    message.Debug("ori");
                    break;

                case 0x07:
                    //andi
                    message.Debug("andi");
                    break;

                case 0x01:
                    //slli
                    message.Debug("slli");
                    break;

                case 0x05:
                    if(((ins >> 25) & 0x7F) == 0x00){
                        //srli
                        message.Debug("srli");
                    }
                    else if(((ins >> 25) & 0x7F) == 0x20){
                        //srai
                        message.Debug("srai");
                    }
                    break;

                default:
                    message.Debug("Error in disassemble: Instruction " + utils.ToHex(ins) + "not found");
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
                            message.Debug("add");
                            break;

                        case 0x02:
                            //slt
                            message.Debug("slt");
                            break;

                        case 0x03:
                            //sltu
                            message.Debug("sltu");
                            break;

                        case 0x07:
                            //and
                            message.Debug("and");
                            break;

                        case 0x06:
                            //or
                            message.Debug("or");
                            break;

                        case 0x04:
                            //xor
                            message.Debug("xor");
                            break;

                        case 0x01:
                            //sll
                            message.Debug("sll");
                            break;

                        case 0x05:
                            //srl
                            message.Debug("srl");
                            break;
                    }
                    break;

                case 0x20:
                    //sub
                    switch((ins >> 12)&0x7) {
                        case 0x00:
                            //sub
                            message.Debug("sub");
                            break;

                        case 0x05:
                            //sra
                            message.Debug("sra");
                            break;
                    }
                    break;

                case 0x01:
                    //mul,mulh,mulhsu,mulhu,div,divu,rem,remu
                    switch((ins >> 12)&0x7) {
                        case 0x00:
                            //mul
                            message.Debug("mul");
                            break;

                        case 0x01:
                            //mulh
                            message.Debug("mulh");
                            break;

                        case 0x02:
                            //mulhsu
                            message.Debug("mulhsu");
                            break;

                        case 0x03:
                            //mulhu
                            message.Debug("mulhu");
                            break;

                        case 0x04:
                            //div
                            message.Debug("div");
                            break;

                        case 0x05:
                            //divu
                            message.Debug("divu");
                            break;

                        case 0x06:
                            //rem
                            message.Debug("rem");
                            break;

                        case 0x07:
                            //remu
                            message.Debug("remu");
                            break;
                    }
                    break;
               

                default:
                    message.Debug("Error in disassemble: Instruction " + utils.ToHex(ins) + "not found");
                    break;

            }
            break;

        case 0x37:
            //lui
            message.Debug("Lui");
            break;

        case 0x17:
            //auipc
            message.Debug("auipc");
            break;

        case 0x6F:
            //jal
            message.Debug("jal");
            break; 

        case 0x67:
            //jalr
            message.Debug("jalr");
            break;

        case 0x63:
            //beq,bne,blt,bge,bltu,bgeu
            switch((ins >> 12)&0x7) {
                
                case 0x00:
                    //beq
                    message.Debug("beq");
                    break;

                case 0x01:
                    //bne
                    message.Debug("bne");
                    break;

                case 0x04:
                    //blt
                    message.Debug("blt");
                    break;

                case 0x05:
                    //bge
                    message.Debug("bge");
                    break;

                case 0x06:
                    //bltu
                    message.Debug("bltu");
                    break;

                case 0x07:
                    //bgeu
                    message.Debug("bgeu");
                    break;

                default:
                    message.Debug("Error in disassemble: Instruction " + utils.ToHex(ins) + "not found");
                    break;

            }
            break;

        case 0x73:
            //csrrw,csrrs,csrrc,csrrwi,csrrsi,csrrci,ecall,eret,ebreak,mrts
            switch((ins >> 12)&0x7) {
                
                case 0x01:
                    //csrrw
                    message.Debug("csrrw");
                    break;

                case 0x02:
                    //csrrs
                    message.Debug("csrrs");
                    break;

                case 0x03:
                    //csrrc
                    message.Debug("csrrc - "+ utils.ToHex(ins));
                    break;

                case 0x05:
                    //csrrwi
                    message.Debug("csrrwi - "+ utils.ToHex(ins));
                    break;
                    

                case 0x06:
                    //csrrsi
                    message.Debug("csrrsi - "+ utils.ToHex(ins));
                    break;

                case 0x07:
                    //csrrci
                    message.Debug("csrrci - "+ utils.ToHex(ins));
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
                                    message.Debug("ecall PRV_U -"+ utils.ToHex(ins));
                                    break;

                                case PRV_S:
                                    message.Debug("ecall PRV_S -"+ utils.ToHex(ins));
                                    break;

                                case PRV_H:
                                    message.Debug("Not supported ecall PRV_H -"+ utils.ToHex(ins));
                                    break;

                                case PRV_M:
                                    message.Debug("ecall PRV_M -"+ utils.ToHex(ins));
                                    break;
                                
                                default:
                                    message.Debug("Error in ecall: Don't know how to handle privilege level " + current_privilege_level);
                                    break;
                            }
                            break;

                        case 0x001:
                            //ebreak
                            message.Debug("ebreak - "+ utils.ToHex(ins)+" at PC" + utils.ToHex(this.pc));
                            break;

                        case 0x100:
                            //eret
                            var current_privilege_level = (csr[CSR_MSTATUS] & 0x06) >> 1;
                            if(current_privilege_level < PRV_S) {
                                message.Debug("Error in eret: current_privilege_level isn't allowed access");
                                break;   
                            }
                            switch(current_privilege_level)
                            {
                                
                                case PRV_S:
                                    message.Debug("eret PRV_S -"+ utils.ToHex(ins));
                                    break;

                                case PRV_H:
                                    message.Debug("Not supported eret PRV_H -"+ utils.ToHex(ins));
                                    break;

                                case PRV_M:
                                    message.Debug("eret PRV_M -"+ utils.ToHex(ins));
                                    break;
                                
                                default:
                                    message.Debug("Error in eret: Don't know how to handle privilege level " + current_privilege_level);
                                    break;
                            }
                            break;

                        case 0x305:
                            //mrts     
                            if(current_privilege_level != PRV_M) {
                                message.Debug("Error in mrts: current_privilege_level isn't allowed access");
                                break;   
                            }
                            message.Debug("mrts - "+ utils.ToHex(ins));
                            break;

                        case 0x120:
                            //sfence.vma
                            message.Debug("sfence.vma - "+ utils.ToHex(ins));
                            break;

                        default:
                            message.Debug("Error in disassemble: Instruction " + utils.ToHex(ins) + "not found");
                            break;

                    }
                    break; 

                default:
                    message.Debug("Error in disassemble: Instruction " + utils.ToHex(ins) + "not found");
                    break;

            }
            break;

        case 0x07:
            //flw,fld
            switch((ins >> 12)&0x7) {
                
                case 0x02:
                    //flw
                    message.Debug("flw - "+ utils.ToHex(ins));
                    break;

                case 0x03:
                    //fld
                    message.Debug("fld");
                    break;

                default:
                    message.Debug("Error in disassemble: Instruction " + utils.ToHex(ins) + "not found");
                    break;

            }
            break;

        case 0x27:
            //fsw,fsd
            switch((ins >> 12)&0x7) {

                case 0x02:
                    //fsw
                    message.Debug("fsw");
                    break;

                case 0x03:
                    //fsd
                    message.Debug("fsw");
                    break;

                default:
                    message.Debug("Error in disassemble: Instruction " + utils.ToHex(ins) + "not found");
                    break;

            }
            break;

        case 0x53:
            //fadd.s,fsub.s
            switch((ins >> 25)&0x7F) {
                
                case 0x00 :
                    //fadd.s
                    message.Debug("fadd.s");
                    break;

                case 0x04:
                    //fsub.s
                    message.Debug("fsub.s");
                    break;

                case 0x60:
                    //fcvt.w.s
                    message.Debug("fcvt.w.s");
                    break;

                case 0x01 :
                    //fadd.d
                    message.Debug("fadd.d");
                    break;

                case 0x05:
                    //fsub.d
                    message.Debug("fsub.d");
                    break;

                case 0x61:
                    //fcvt.w.d
                    message.Debug("fcvt.w.s");
                    break;

                case 0x78:
                    //fmv.s.x
                    message.Debug("fmv.s.x");
                    break;


                default:
                    message.Debug("Error in disassemble: Instruction " + utils.ToHex(ins) + "not found");
                    break;
            }
            break;

        case 0x2F:
            //amoswap,amoadd,amoxor,amoand,amoor,amomin,amomax,amominu,amomaxu
            switch((ins >> 27)&0x1F) {
                
                case 0x01:
                    //amoswap
                    message.Debug("amoswap");
                    break;

                case 0x00:
                    //amoadd
                    message.Debug("amoadd");
                    break;

                case 0x04:
                    //amoxor
                    message.Debug("amoxor");
                    break;

                case 0x0C:
                    //amoand
                    message.Debug("amoand");
                    break;

                case 0x08:
                    //amoor
                    message.Debug("amoor");
                    break;

                case 0x10:
                    //amomin
                    message.Debug("amomin");
                    break;

               case 0x14:
                    //amomax
                    message.Debug("amomax");
                    break;

                case 0x18:
                    //amominu
                    message.Debug("amominu");
                    break;

                case 0x1C:
                    //amomaxu
                    message.Debug("amomaxu");
                    break;

                case 0x02:
                    //lr.d
                    message.Debug("lr.d");
                    break;

                case 0x03:
                    //sc.d
                    message.Debug("sc.d");
                    break;

                default:
                    message.Debug("Error in Atomic Memory Instruction " + utils.ToHex(ins) + "not found");
                    break;

            }
            break;

        case 0x0F:
            //fence
            message.Debug("fence");
            break;

        default:
            message.Debug("Error in disassemble: Instruction " + utils.ToHex(ins) + " not found");
            break;
    }

};

module.exports.Disassemble = Disassemble;

