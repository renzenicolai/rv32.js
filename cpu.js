"use strict";

let OP_LOAD = 0x03;

let OP_FENCE = 0x0F;

let OP_I = 0x13;
let OP_I_ADDI = 0x0;
let OP_I_SLLI = 0x1;
let OP_I_SLTI = 0x2;
let OP_I_SLTIU = 0x3;
let OP_I_XORI = 0x4;
let OP_I_SRI = 0x5;
let OP_I_SRI_SRLI = 0x0;
let OP_I_SRI_SRAI = 0x20;
let OP_I_ORI = 0x6;
let OP_I_ANDI = 0x7;

let OP_S = 0x23;

let OP_R = 0x33;

let OP_B = 0x63;
let OP_B_BEQ = 0x0;
let OP_B_BNE = 0x1;
let OP_B_BLT = 0x4;
let OP_B_BGE = 0x5;
let OP_B_BLTU = 0x6;
let OP_B_BGEU = 0x7;

let OP_JAL = 0x6F;

let OP_JALR = 0x67;



class Cpu {
    constructor(bus, stack_pointer) {
        this._bus = bus;
        this._initial_stack_pointer = stack_pointer;
        this._registers = new Uint32Array(32);
        this._pc = 0;
    }

    init() {
        this._registers[0] = 0; // register x0 is hardwired to 0
        this._registers[2] =this._initial_stack_pointer;
    }

    fetch() {
        let instruction = this._bus.load(this._pc, 32);
        //console.log("Fetched 0x" + instruction.toString(16));
        return instruction;
    }

    _rd(instruction) {
        return (instruction >> 7) & 0x1f;
    }

    _rs1(instruction) {
        return (instruction >> 15) & 0x1f;
    }

    _rs2(instruction) {
        return (instruction >> 20) & 0x1f;
    }

    _imm_I(instruction) {
        return (((instruction & 0xFFFF0000) >> 20) >>> 0);
    }

    _imm_S(instruction) {
        return ((((instruction & 0xFE000000) >> 20) | ((instruction >> 7) & 0x1F)) >>> 0);
    }

    _imm_B(instruction) {
        let value = (
            ((instruction & 0x80000000) >> 19) |
            ((instruction & 0x80) << 4) |
            ((instruction >> 20) & 0x7e0) |
            ((instruction >> 7) & 0x1e)
        );
        return new Int32Array([value])[0]; // Convert to signed number
    }

    _imm_U(instruction) {
        return ((instruction & 0xFFFFF999) >>> 0);
    }

    _imm_J(instruction) {
        let value = (
            ((instruction & 0x80000000) >> 11) |
            (instruction & 0xFF000) |
            ((instruction >> 9) & 0x800) |
            ((instruction >> 20) & 0x7fe)
        );
        return new Int32Array([value])[0]; // Convert to signed number
    }

    _shamt(instruction) {
        return this._imm_I(instruction) & 0x1f;
    }

    _execute_op_i_addi(instruction) {
        let target_register = this._rd(instruction);
        let source_register = this._rs1(instruction);
        let immediate_value = this._imm_I(instruction);
        this._registers[target_register] = this._registers[source_register] + immediate_value;
        console.log("addi x" + target_register + ", x" + source_register + ", " + immediate_value);
    }

    _execute_op_i_slli(instruction) {
        let target_register = this._rd(instruction);
        let source_register = this._rs1(instruction);
        let shift_amount = this._shamt(instruction);
        this._registers[target_register] = this._registers[source_register] << shift_amount;
        console.log("slli x" + target_register + ", x" + source_register + ", " + shift_amount);
    }

    _execute_op_i_slti(instruction) {
        let target_register = this._rd(instruction);
        let source_register = this._rs1(instruction);
        let immediate_value = this._imm_I(instruction);
        this._registers[target_register] = (this._registers[source_register] < immediate_value) ? 1 : 0;
        console.log("slti x" + target_register + ", x" + source_register + ", " + immediate_value);
    }

    _execute_op_i_sltiu(instruction) {
        let target_register = this._rd(instruction);
        let source_register = this._rs1(instruction);
        let immediate_value = this._imm_I(instruction);
        this._registers[target_register] = (this._registers[source_register] < immediate_value) ? 1 : 0;
        console.log("sltiu x" + target_register + ", x" + source_register + ", " + immediate_value);
    }

    _execute_op_i_xori(instruction) {
        let target_register = this._rd(instruction);
        let source_register = this._rs1(instruction);
        let immediate_value = this._imm_I(instruction);
        this._registers[target_register] = this._registers[source_register] ^ immediate_value;
        console.log("xori x" + target_register + ", x" + source_register + ", " + immediate_value);
    }

    _execute_op_i_srli(instruction) {
        let target_register = this._rd(instruction);
        let source_register = this._rs1(instruction);
        let shift_amount = this._shamt(instruction);
        this._registers[target_register] = this._registers[source_register] >> shift_amount;
        console.log("srli x" + target_register + ", x" + source_register + ", " + shift_amount);
    }

    _execute_op_i_srai(instruction) {
        let target_register = this._rd(instruction);
        let source_register = this._rs1(instruction);
        let shift_amount = this._shamt(instruction);
        this._registers[target_register] = this._registers[source_register] >> shift_amount;
        console.log("srai x" + target_register + ", x" + source_register + ", " + shift_amount);
    }

    _execute_op_i_ori(instruction) {
        let target_register = this._rd(instruction);
        let source_register = this._rs1(instruction);
        let immediate_value = this._imm_I(instruction);
        this._registers[target_register] = this._registers[source_register] | immediate_value;
        console.log("ori x" + target_register + ", x" + source_register + ", " + immediate_value);
    }

    _execute_op_i_andi(instruction) {
        let target_register = this._rd(instruction);
        let source_register = this._rs1(instruction);
        let immediate_value = this._imm_I(instruction);
        this._registers[target_register] = this._registers[source_register] & immediate_value;
        console.log("andi x" + target_register + ", x" + source_register + ", " + immediate_value);
    }

    _execute_op_i_add(instruction) {
        throw new Error("not implemented");
    }

    _execute_op_i_sub(instruction) {
        throw new Error("not implemented");
    }

    _execute_op_i_sll(instruction) {
        throw new Error("not implemented");
    }

    _execute_op_i_slt(instruction) {
        throw new Error("not implemented");
    }

    _execute_op_i_sltu(instruction) {
        throw new Error("not implemented");
    }

    _execute_op_i_xor(instruction) {
        throw new Error("not implemented");
    }

    _execute_op_i_srl(instruction) {
        throw new Error("not implemented");
    }

    _execute_op_i_sra(instruction) {
        throw new Error("not implemented");
    }

    _execute_op_i_or(instruction) {
        throw new Error("not implemented");
    }

    _execute_op_i_and(instruction) {
        throw new Error("not implemented");
    }

    _execute_op_i_fence(instruction) {
        throw new Error("not implemented");
    }

    _execute_op_i_ecall(instruction) {
        throw new Error("not implemented");
    }

    _execute_op_i_ebreak(instruction) {
        throw new Error("not implemented");
    }

    _execute_op_i_addiw(instruction) {
        throw new Error("not implemented");
    }

    _execute_op_i_slliw(instruction) {
        throw new Error("not implemented");
    }

    _execute_op_i_srliw(instruction) {
        throw new Error("not implemented");
    }

    _execute_op_i_sraiw(instruction) {
        throw new Error("not implemented");
    }

    _execute_op_i_addw(instruction) {
        throw new Error("not implemented");
    }

    _execute_op_i_mulw(instruction) {
        throw new Error("not implemented");
    }

    _execute_op_i_subw(instruction) {
        throw new Error("not implemented");
    }

    _execute_op_i_divw(instruction) {
        throw new Error("not implemented");
    }


    _execute_op_jal(instruction) {
        let target_register = this._rd(instruction);
        let immediate_value = this._imm_J(instruction);
        this._registers[target_register] = this._pc;
        this._pc = this._pc + immediate_value - 4;
        if (this._pc & 0x03) {
            throw new Error("Address misaligned");
        }
        console.log("jal x" + target_register + ", " + immediate_value);
    }

    _execute_op_beq(instruction) {
        let immediate_value = this._imm_B(instruction);
        let rs1 = this._rs1(instruction);
        let rs2 = this._rs2(instruction);
        if (rs1 === rs2) {
            this._pc = this._pc + immediate_value - 4;
            if (this._pc & 0x03) {
                throw new Error("Address misaligned");
            }
        }
        console.log("beq x" + rs1 + ", x" + rs2 + ", " + immediate_value);
    }

    _execute_op_bne(instruction) {
        let immediate_value = this._imm_B(instruction);
        let rs1 = this._rs1(instruction);
        let rs2 = this._rs2(instruction);
        if (this._registers[rs1] !== this._registers[rs2]) {
            this._pc = this._pc + immediate_value - 4;
            if (this._pc & 0x03) {
                throw new Error("Address misaligned");
            }
        }
        console.log("bne x" + rs1 + ", x" + rs2 + ", " + immediate_value);
    }

    ///...

    execute(instruction) {
        let opcode = instruction & 0x7f;
        let funct3 = (instruction >> 12) & 0x7;
        let funct7 = (instruction >> 25) & 0x7f;
        this._registers[0] = 0; // register x0 is hardwired to 0

        switch(opcode) {
            case OP_JAL:
                this._execute_op_jal(instruction);
                break;
            case OP_B:
                switch (funct3) {
                    case OP_B_BEQ:
                        this._execute_op_beq(instruction);
                        break;
                    case OP_B_BNE:
                        this._execute_op_bne(instruction);
                        break;
                    default:
                        throw new Error("Invalid branch instruction. Opcode " + opcode + ", funct3: " + funct3 + ", funct7: " + funct7);
                }
                break;
            case OP_I:
                switch (funct3) {
                    case OP_I_ADDI:
                        this._execute_op_i_addi(instruction);
                        break;
                    case OP_I_SLLI:
                        this._execute_op_i_slli(instruction);
                        break;
                    case OP_I_SLTI:
                        this._execute_op_i_slti(instruction);
                        break;
                    case OP_I_SLTIU:
                        this._execute_op_i_sltiu(instruction);
                        break;
                    case OP_I_XORI:
                        this._execute_op_i_xori(instruction);
                        break;
                    case OP_I_SRI:
                        switch (funct7) {
                            case OP_I_SRI_SRLI:
                                this._execute_op_i_srli(instruction);
                                break;
                            case OP_I_SRI_SRAI:
                                this._execute_op_i_srai(instruction);
                                break;
                        }
                    break;
                    case OP_I_ORI:
                        this._execute_op_i_ori(instruction);
                        break;
                    case OP_I_ANDI:
                        this._execute_op_i_andi(instruction);
                        break;
                }
            break;
            default:
                throw new Error("Invalid instruction. Opcode " + opcode + ", funct3: " + funct3 + ", funct7: " + funct7);
        }
    }

    dump_registers() {
        let output = "PC " + this._pc.toString(16) + " REG ";
        for (let register = 0; register < 32; register++) {
            output += this._registers[register].toString(16) + " ";
        }
        console.log(output);
    }
}

module.exports = Cpu;
