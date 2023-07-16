"use strict";

class Cpu {
    constructor(bus, stack_pointer) {
        this._bus = bus;
        this._initial_stack_pointer = stack_pointer;
        this._registers_array = new ArrayBuffer(32*4);
        this._registers_view = new DataView(this._registers_array);
        this._pc = 0;

        this._opcodes = {
            LUI:       0x37, // [lui rd, imm] Load immediate value into rd
            AUIPC:     0x17, // [auipc rd, imm] Add upper immediate value to the program counter
            JAL:       0x6F, // [jal rd, imm] Jump and link
            JALR:      0x67, // [jal rd, rs1, imm] Jump and link register
            BRANCH:    0x63, // see branch_ops array
            LOAD:      0x03, // see load_ops array
            STORE:     0x23, // see store_ops array
            IMMEDIATE: 0x13, // see immediate_ops array
            REGISTER:  0x33, // see register_ops array
            FENCE:     0x0F, // FENCE and FENCE.TSO
            SERVICE:   0x73, // PAUSE, ECALL, EBREAK
        };

        this._branch_ops = {
            BEQ:  0x0, // [beq rs1, rs2, imm] Branch when contents of rs1 and rs2 are equal
            BNE:  0x1, // [bne rs1, rs2, imm] Branch when contents of rs1 and rs2 are not equal
            BLT:  0x4, // [blt rs1, rs2, imm] Branch when contents of rs1 are lower than the contents of rs2 (signed)
            BGE:  0x5, // [bge rs1, rs2, imm] Branch when contents of rs1 are higher than the contents of rs2 (signed)
            BLTU: 0x6, // [bltu rs1, rs2, imm] Branch when contents of rs1 are lower than the contents of rs2 (unsigned)
            BGEU: 0x7, // [bgeu rs1, rs2, imm] Branch when contents of rs1 are higher than the contents of rs2 (unsigned)
        };

        this._load_ops = {
            LB:  0x0, // rd, xxx, rs1, imm[11:0]
            LH:  0x1, // rd, xxx, rs1, imm[11:0]
            LW:  0x2, // rd, xxx, rs1, imm[11:0]
            LBU: 0x4, // rd, xxx, rs1, imm[11:0]
            LHU: 0x5, // rd, xxx, rs1, imm[11:0]
        };

        this._store_ops = {
            SB: 0x0, // imm[4:0], xxx, rs1, rs2, imm[11:5]
            SH: 0x1, // imm[4:0], xxx, rs1, rs2, imm[11:5]
            SW: 0x2, // imm[4:0], xxx, rs1, rs2, imm[11:5]
        };

        this._immediate_ops = {
            ADDI:  0x0, // rd, xxx, rs1, imm[11:0]
            SLTI:  0x2, // rd, xxx, rs1, imm[11:0]
            SLTIU: 0x3, // rd, xxx, rs1, imm[11:0]
            XORI:  0x4, // rd, xxx, rs1, imm[11:0]
            ORI:   0x6, // rd, xxx, rs1, imm[11:0]
            ANDI:  0x7, // rd, xxx, rs1, imm[11:0]
            SLLI:  0x1, // rd, xxx, rs1, shamt
            SRI:   0x5, // Can be SRLI (0) or SRAI (1) depending on bit 30
        };

        this._register_ops = {
            ADDSUB: 0x0,
            SLL:    0x1,
            SLT:    0x2,
            SLTU:   0x3,
            XOR:    0x4,
            SR:     0x5,
            OR:     0x6,
            AND:    0x7
        };
    }

    _set_register(register, signed, value) {
        if (register === 0) return; // Register 0 is hardwired to be zero
        if (register >= 32) throw new Error("Attempted write to invalid register " + register);
        if (signed) {
            this._registers_view.setInt32(register * 4, value, true);
        } else {
            this._registers_view.setUint32(register * 4, value, true);
        }
    }

    _get_register(register, signed) {
        if (register === 0) return 0; // Register 0 is hardwired to be zero
        if (register >= 32) throw new Error("Attempted read from invalid register " + register);
        if (signed) {
            return this._registers_view.getInt32(register * 4, true);
        } else {
            return this._registers_view.getUint32(register * 4, true);
        }
    }

    init() {
        this._set_register(2, false, this._initial_stack_pointer);
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

    _imm_I(instruction, signed) {
        let value = ((instruction & 0xFFFF0000) >> 20);
        if (signed) {
            return new Int32Array([value])[0];
        } else {
            return new Uint32Array([value])[0];
        }
    }

    _imm_S(instruction, signed) {
        let value = (((instruction & 0xFE000000) >> 20) | ((instruction >> 7) & 0x1F));
        if (signed) {
            return new Int32Array([value])[0];
        } else {
            return new Uint32Array([value])[0];
        }
    }

    _imm_B(instruction, signed) {
        let value = (
            ((instruction & 0x80000000) >> 19) |
            ((instruction & 0x80) << 4) |
            ((instruction >> 20) & 0x7e0) |
            ((instruction >> 7) & 0x1e)
        );
        if (signed) {
            return new Int32Array([value])[0];
        } else {
            return new Uint32Array([value])[0];
        }
    }

    _imm_U(instruction, signed) {
        let value = (instruction & 0xFFFFF999);
        if (signed) {
            return new Int32Array([value])[0];
        } else {
            return new Uint32Array([value])[0];
        }
    }

    _imm_J(instruction, signed) {
        let value = (
            ((instruction & 0x80000000) >> 11) |
            (instruction & 0xFF000) |
            ((instruction >> 9) & 0x800) |
            ((instruction >> 20) & 0x7fe)
        );
        if (signed) {
            return new Int32Array([value])[0];
        } else {
            return new Uint32Array([value])[0];
        }
    }

    _shamt(instruction, signed) {
        let value = ((instruction & 0xFFFF0000) >> 20) & 0x1f;
        if (signed) {
            return new Int32Array([value])[0];
        } else {
            return new Uint32Array([value])[0];
        }
    }

    // CPU instructions

    _execute_op_lui(instruction) {
        throw new Error("not implemented");
    }

    _execute_op_auipc(instruction) {
        throw new Error("not implemented");
    }

    _execute_op_jal(instruction) {
        let target_register = this._rd(instruction);
        let immediate_value = this._imm_J(instruction, true);
        this._set_register(target_register, false, this._pc);
        this._pc = this._pc + immediate_value - 4;
        if (this._pc & 0x03) {
            throw new Error("Address misaligned");
        }
        console.log("jal x" + target_register + ", " + immediate_value);
    }

    _execute_op_jalr(instruction) {
        throw new Error("not implemented");
    }

    _execute_op_branch(instruction) {
        let funct3 = (instruction >> 12) & 0x07; // Branch instuctions subdivided by an opcode in the funct3 field

        // Parameters
        let rs1 = this._rs1(instruction);
        let rs2 = this._rs2(instruction);
        let target_offset = this._imm_B(instruction, true);

        let value1u = this._get_register(rs1, false);
        let value1s = this._get_register(rs1, true);
        let value2u = this._get_register(rs2, false);
        let value2s = this._get_register(rs2, true);

        let result = false;

        switch (funct3) {
            case this._branch_ops.BEQ: // Branch when equal
                result = (value1u === value2u);
                console.log("beq x" + rs1 + ", x" + rs2 + ", " + target_offset + " " + (result ? "Y" : "N"));
                break;
            case this._branch_ops.BNE: // Branch when not equal
                result = (value1u !== value2u);
                console.log("bne x" + rs1 + ", x" + rs2 + ", " + target_offset + " " + (result ? "Y" : "N"));
                break;
            case this._branch_ops.BLT: // Branch when less than
                result = (value1s < value2s);
                console.log("blt x" + rs1 + ", x" + rs2 + ", " + target_offset + " " + (result ? "Y" : "N"));
                break;
            case this._branch_ops.BGE: // Branch when greater than
                result = (value1s > value2s);
                console.log("bge x" + rs1 + ", x" + rs2 + ", " + target_offset + " " + (result ? "Y" : "N"));
                break;
            case this._branch_ops.BLTU: // Branch when less than unsigned
                result = (value1u < value2u);
                console.log("bltu x" + rs1 + ", x" + rs2 + ", " + target_offset + " " + (result ? "Y" : "N"));
                break;
            case this._branch_ops.BGEU: // Branch when greater than unsigned
                result = (value1u > value2u);
                console.log("bgeu x" + rs1 + ", x" + rs2 + ", " + target_offset + " " + (result ? "Y" : "N"));
                break;
            default:
                throw new Error("Invalid branch instruction. Funct3: " + funct3);
        }

        if (result) {
            // Execute branch
            this._pc = this._pc + target_offset - 4;
            if (this._pc & 0x03) {
                throw new Error("Address misaligned");
            }
        }
    }

    _execute_op_load(instruction) {
        throw new Error("Not implemented");
    }

    _execute_op_store(instruction) {
        throw new Error("Not implemented");
    }

    _execute_op_load(instruction) {
        throw new Error("Not implemented");
    }

    _execute_op_immediate(instruction) {
        let funct3 = (instruction >> 12) & 0x07;
        let target_register = this._rd(instruction);
        let source_register = this._rs1(instruction);
        let immediate_value_signed = this._imm_I(instruction, true);
        let immediate_value_unsigned = this._imm_I(instruction, false);

        switch (funct3) {
            case this._immediate_ops.ADDI: // Add immediate
                this._set_register(target_register, true, this._get_register(source_register, true) + immediate_value_signed);
                console.log("addi x" + target_register + ", x" + source_register + ", " + immediate_value_signed);
                break;
            case this._immediate_ops.SLTI: // Set less than immediate (signed)
                 this._set_register(target_register, true, (this._get_register(source_register, true) < immediate_value_signed) ? 1 : 0);
                console.log("slti x" + target_register + ", x" + source_register + ", " + immediate_value_signed);
                break;
            case this._immediate_ops.SLTIU: // Set less than immediate (unsigned)
                this._set_register(target_register, false, (this._get_register(source_register, false) < immediate_value_unsigned) ? 1 : 0);
                console.log("sltiu x" + target_register + ", x" + source_register + ", " + immediate_value_unsigned);
                break;
            case this._immediate_ops.XORI:
                this._execute_op_i_xori(instruction);
                break;
            case this._immediate_ops.ORI:
                this._execute_op_i_ori(instruction);
                break;
            case this._immediate_ops.ANDI:
                this._execute_op_i_andi(instruction);
                break;
            case this._immediate_ops.SLLI: // Shift left logical immediate
                this._execute_op_i_slli(instruction);
                break;
            case this._immediate_ops.SRI:
                let funct7 = (instruction >> 25) & 0x7f;
                switch (funct7) {
                    case this._immediate_ops.SRI_SRLI:
                        this._execute_op_i_srli(instruction);
                        break;
                    case this._immediate_ops.SRI_SRAI:
                        this._execute_op_i_srai(instruction);
                        break;
                }
            break;
        }
    }

    _execute_op_i_slli(instruction) {
        let target_register = this._rd(instruction);
        let source_register = this._rs1(instruction);
        let shift_amount = this._shamt(instruction);
        this._set_register(target_register, true, this._get_register(source_register, true) << shift_amount);
        console.log("slli x" + target_register + ", x" + source_register + ", " + shift_amount);
    }

    _execute_op_i_xori(instruction) {
        let target_register = this._rd(instruction);
        let source_register = this._rs1(instruction);
        let immediate_value = this._imm_I(instruction);
        this._set_register(target_register, true, this._get_register(source_register, true) ^ immediate_value);
        console.log("xori x" + target_register + ", x" + source_register + ", " + immediate_value);
    }

    _execute_op_i_srli(instruction) {
        let target_register = this._rd(instruction);
        let source_register = this._rs1(instruction);
        let shift_amount = this._shamt(instruction);
        this._set_register(target_register, true, this._get_register(source_register, true) >> shift_amount);
        console.log("srli x" + target_register + ", x" + source_register + ", " + shift_amount);
    }

    _execute_op_i_srai(instruction) {
        let target_register = this._rd(instruction);
        let source_register = this._rs1(instruction);
        let shift_amount = this._shamt(instruction);
        this._set_register(target_register, true, this._get_register(source_register, true) >> shift_amount);
        console.log("srai x" + target_register + ", x" + source_register + ", " + shift_amount);
    }

    _execute_op_i_ori(instruction) {
        let target_register = this._rd(instruction);
        let source_register = this._rs1(instruction);
        let immediate_value = this._imm_I(instruction);
        this._set_register(target_register, false, (this._get_register(source_register, false) | immediate_value) ? 1 : 0);
        console.log("ori x" + target_register + ", x" + source_register + ", " + immediate_value);
    }

    _execute_op_i_andi(instruction) {
        let target_register = this._rd(instruction);
        let source_register = this._rs1(instruction);
        let immediate_value = this._imm_I(instruction);
        this._set_register(target_register, false, (this._get_register(source_register, false) & immediate_value) ? 1 : 0);
        console.log("andi x" + target_register + ", x" + source_register + ", " + immediate_value);
    }

    ///...

    execute(instruction) {
        let opcode = (instruction >>  0) & 0x7f;

        switch(opcode) {
            case this._opcodes.LUI:
                this._execute_op_lui(instruction);
                break;
            case this._opcodes.AUIPC:
                this._execute_op_auipc(instruction);
                break;
            case this._opcodes.JAL:
                this._execute_op_jal(instruction);
                break;
            case this._opcodes.JALR:
                this._execute_op_jalr(instruction);
                break;
            case this._opcodes.BRANCH:
                this._execute_op_branch(instruction);
                break;
            case this._opcodes.LOAD:
                this._execute_op_load(instruction);
                break;
            case this._opcodes.STORE:
                this._execute_op_store(instruction);
                break;
            case this._opcodes.IMMEDIATE:
                this._execute_op_immediate(instruction);
            break;
            case this._opcodes.REGISTER:

                break;
            case this._opcodes.FENCE:

                break;
            case this._opcodes.SERVICE:

                break;
            default:
                throw new Error("Invalid instruction. Unrecognized opcode 0x" + opcode.toString(16));
        }
    }

    dump_registers() {
        let output = "PC " + this._pc.toString(16) + " REG ";
        for (let register = 0; register < 32; register++) {
            output += this._get_register(register, false).toString(16) + " ";
        }
        console.log(output);
    }
}

module.exports = Cpu;
