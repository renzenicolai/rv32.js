"use strict";

class Cpu {
    constructor(bus, stack_pointer, embedded = false) {
        this._bus = bus;
        this._initial_stack_pointer = stack_pointer;
        this._registers_amount = embedded ? 16 : 32;
        this._registers_array = new ArrayBuffer(this._registers_amount*4);
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
            LB:  0x0, // lb rd, rs1, imm
            LH:  0x1, // lh rd, rs1, imm
            LW:  0x2, // lw rd, rs1, imm
            LBU: 0x4, // lbu rd, rs1, imm
            LHU: 0x5, // lhu rd, rs1, imm
            LWU: 0x6, // lwu rd, rs1, imm
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

        this._register_ops_addsub = {
            ADD: 0x00,
            SUB: 0x20,
        };

        this._service_ops = {
            ECALL: 0x0,
            EBREAK: 0x1,
        }
    }

    _debug(string) {
        process.stderr.write(string + "\n");
    }

    _set_register(register, signed, value) {
        if (register === 0) return; // Register 0 is hardwired to be zero
        if (register >= this._registers_amount) throw new Error("Attempted write to invalid register " + register);
        if (signed) {
            this._registers_view.setInt32(register * 4, value, true);
        } else {
            this._registers_view.setUint32(register * 4, value, true);
        }
    }

    _get_register(register, signed) {
        if (register === 0) return 0; // Register 0 is hardwired to be zero
        if (register >= this._registers_amount) throw new Error("Attempted read from invalid register " + register);
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
        //this._debug("Fetched 0x" + instruction.toString(16));
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
        let value = (instruction & 0xFFFFF000);
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

    _execute_op_lui(instruction) { // Load upper immediate
        let target_register = this._rd(instruction);
        let immediate_value = this._imm_U(instruction, false);
        this._set_register(target_register, false, immediate_value);
        this._debug("lui x" + target_register + ", 0x" + (immediate_value >>> 12).toString(16));
    }

    _execute_op_auipc(instruction) {
        let target_register = this._rd(instruction);
        let immediate_value = this._imm_U(instruction, true);
        this._set_register(target_register, false, this._pc + immediate_value - 4);
        this._debug("auipc x" + target_register + ", " + immediate_value);
    }

    _execute_op_jal(instruction) {
        let target_register = this._rd(instruction);
        let immediate_value = this._imm_J(instruction, true);
        this._set_register(target_register, false, this._pc);
        this._pc = this._pc + immediate_value - 4;
        if (this._pc & 0x03) {
            throw new Error("Address misaligned");
        }
        this._debug("jal x" + target_register + ", " + immediate_value);
    }

    _execute_op_jalr(instruction) {
        let target_register = this._rd(instruction);
        let rs1 = this.rs1(instruction);
        let register_value = this._get_register(rs1, true);
        let immediate_value = this._imm_J(instruction, true);
        this._set_register(target_register, false, this._pc);
        this._pc = register_value + immediate_value & 0xFFFFFFFE;
        if (this._pc & 0x03) {
            throw new Error("Address misaligned");
        }
        this._debug("jalr x" + target_register + ", " + immediate_value);
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

        switch(funct3) {
            case this._branch_ops.BEQ: // Branch when equal
                result = (value1u === value2u);
                this._debug("beq x" + rs1 + ", x" + rs2 + ", " + target_offset + " " + (result ? "Y" : "N"));
                break;
            case this._branch_ops.BNE: // Branch when not equal
                result = (value1u !== value2u);
                this._debug("bne x" + rs1 + ", x" + rs2 + ", " + target_offset + " " + (result ? "Y" : "N"));
                break;
            case this._branch_ops.BLT: // Branch when less than
                result = (value1s < value2s);
                this._debug("blt x" + rs1 + ", x" + rs2 + ", " + target_offset + " " + (result ? "Y" : "N"));
                break;
            case this._branch_ops.BGE: // Branch when greater than
                result = (value1s > value2s);
                this._debug("bge x" + rs1 + ", x" + rs2 + ", " + target_offset + " " + (result ? "Y" : "N"));
                break;
            case this._branch_ops.BLTU: // Branch when less than unsigned
                result = (value1u < value2u);
                this._debug("bltu x" + rs1 + ", x" + rs2 + ", " + target_offset + " " + (result ? "Y" : "N"));
                break;
            case this._branch_ops.BGEU: // Branch when greater than unsigned
                result = (value1u > value2u);
                this._debug("bgeu x" + rs1 + ", x" + rs2 + ", " + target_offset + " " + (result ? "Y" : "N"));
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
        let funct3 = (instruction >> 12) & 0x07;
        let target_register = this._rd(instruction);
        let source_register = this._rs1(instruction);
        let immediate_value = this._imm_I(instruction, true);
        let address = this._get_register(source_register, false) + immediate_value;
        switch(funct3) {
            case this._load_ops.LB:
                this._set_register(target_register, true, this._bus.load(address, 8));
                this._debug("lb x" + target_register + ", x" + source_register + ", " + immediate_value);
                break;
            case this._load_ops.LH:
                this._set_register(target_register, true, this._bus.load(address, 16));
                this._debug("lh x" + target_register + ", x" + source_register + ", " + immediate_value);
                break;
            case this._load_ops.LW:
                this._set_register(target_register, true, this._bus.load(address, 32));
                this._debug("lw x" + target_register + ", x" + source_register + ", " + immediate_value);
                break;
            case this._load_ops.LBU:
                this._set_register(target_register, false, this._bus.load(address, 8));
                this._debug("lbu x" + target_register + ", x" + source_register + ", " + immediate_value);
                break;
            case this._load_ops.LHU:
                this._set_register(target_register, false, this._bus.load(address, 16));
                this._debug("lhu x" + target_register + ", x" + source_register + ", " + immediate_value);
                break;
            case this._load_ops.LWU:
                this._set_register(target_register, false, this._bus.load(address, 32));
                this._debug("lwu x" + target_register + ", x" + source_register + ", " + immediate_value);
                break;
            default:
               throw new Error("Invalid load instruction. Funct3: " + funct3);
        }
    }

    _execute_op_store(instruction) {
        let funct3 = (instruction >> 12) & 0x07;
        let register_value = this._get_register(this._rs1(instruction), false);
        let immediate_value = this._imm_S(instruction, true);
        let address = register_value + immediate_value;
        let value = this._get_register(this._rs2(instruction), false);
        switch(funct3) {
            case this._store_ops.SB:
                this._bus.store(address, 8, value);
                this._debug("sb " + address.toString(16) + " = " + value.toString(16));
                break;
            case this._store_ops.SH:
                this._bus.store(address, 16, value);
                this._debug("sh " + address.toString(16) + " = " + value.toString(16));
                break;
            case this._store_ops.SW:
                this._bus.store(address, 32, value);
                this._debug("sw " + address.toString(16) + " = " + value.toString(16));
                break;
            default:
                throw new Error("Invalid store instruction. Funct3: " + funct3);
        }
    }

    _execute_op_immediate(instruction) {
        let funct3 = (instruction >> 12) & 0x07;
        let target_register = this._rd(instruction);
        let source_register = this._rs1(instruction);
        let immediate_value_signed = this._imm_I(instruction, true);
        let immediate_value_unsigned = this._imm_I(instruction, false);
        let shift_amount = this._shamt(instruction);

        switch(funct3) {
            case this._immediate_ops.ADDI: // Add immediate
                this._set_register(target_register, true, this._get_register(source_register, true) + immediate_value_signed);
                this._debug("addi x" + target_register + ", x" + source_register + ", " + immediate_value_signed);
                break;
            case this._immediate_ops.SLTI: // Set less than immediate (signed)
                 this._set_register(target_register, true, (this._get_register(source_register, true) < immediate_value_signed) ? 1 : 0);
                this._debug("slti x" + target_register + ", x" + source_register + ", " + immediate_value_signed);
                break;
            case this._immediate_ops.SLTIU: // Set less than immediate (unsigned)
                this._set_register(target_register, false, (this._get_register(source_register, false) < immediate_value_unsigned) ? 1 : 0);
                this._debug("sltiu x" + target_register + ", x" + source_register + ", " + immediate_value_unsigned);
                break;
            case this._immediate_ops.XORI:
                this._set_register(target_register, false, this._get_register(source_register, false) ^ immediate_value_unsigned);
                this._debug("xori x" + target_register + ", x" + source_register + ", " + immediate_value_unsigned);
                break;
            case this._immediate_ops.ORI:
                this._set_register(target_register, false, (this._get_register(source_register, false) | immediate_value_unsigned) ? 1 : 0);
                this._debug("ori x" + target_register + ", x" + source_register + ", " + immediate_value_unsigned);
                break;
            case this._immediate_ops.ANDI:
                this._set_register(target_register, false, (this._get_register(source_register, false) & immediate_value_unsigned) ? 1 : 0);
                this._debug("andi x" + target_register + ", x" + source_register + ", " + immediate_value_unsigned);
                break;
            case this._immediate_ops.SLLI: // Shift left logical immediate
                this._set_register(target_register, true, this._get_register(source_register, true) << shift_amount);
                this._debug("slli x" + target_register + ", x" + source_register + ", " + shift_amount);
                break;
            case this._immediate_ops.SRI:
                let funct7 = (instruction >> 25) & 0x7f;
                switch(funct7) {
                    case this._immediate_ops.SRI_SRLI:
                        this._set_register(target_register, true, this._get_register(source_register, true) >> shift_amount);
                        this._debug("srli x" + target_register + ", x" + source_register + ", " + shift_amount);
                        break;
                    case this._immediate_ops.SRI_SRAI:
                        this._set_register(target_register, true, this._get_register(source_register, true) >> shift_amount);
                        this._debug("srai x" + target_register + ", x" + source_register + ", " + shift_amount);
                        break;
                }
            break;
        }
    }

    _execute_op_register(instruction) {
        let funct3 = (instruction >> 12) & 0x07;
        let target_register = this._rd(instruction);
        let rs1 = this._rs1(instruction);
        let rs2 = this._rs2(instruction);
        let value1_signed = this._get_register(rs1, true);
        let value2_signed = this._get_register(rs2, true);
        let value1_unsigned = this._get_register(rs1, false);
        let value2_unsigned = this._get_register(rs2, false);

        switch(funct3) {
            case this._register_ops.ADDSUB:
                let funct7 = (instruction >> 25) & 0x7f;
                switch(funct7) {
                    case this._register_ops_addsub.ADD: // Add
                        this._set_register(target_register, true, value1_signed + value2_signed);
                        this._debug("add x" + target_register + ", x" + rs1 + ", x" + rs2);
                        break;
                    case this._register_ops_addsub.SUB: // Subtract
                        this._set_register(target_register, true, value1_signed - value2_signed);
                        this._debug("sub x" + target_register + ", x" + rs1 + ", x" + rs2);
                        break;
                    default:
                        throw new Error("Invalid addsub register instruction. Funct7: " + funct7);
                        break;
                }
                break;
            case this._register_ops.SLL: // Shift left logical
                this._set_register(target_register, false, value1_unsigned << value2_unsigned);
                this._debug("sll x" + target_register + ", x" + rs1 + ", x" + rs2);
                break;
            case this._register_ops.SLT: // Set less than
                this._set_register(target_register, false, (value1_signed < value2_signed) ? 1 : 0);
                this._debug("slt x" + target_register + ", x" + rs1 + ", x" + rs2);
                break;
            case this._register_ops.SLTU: // Set less than unsigned
                this._set_register(target_register, false, (value1_unsigned < value2_unsigned) ? 1 : 0);
                this._debug("sltu x" + target_register + ", x" + rs1 + ", x" + rs2);
                break;
            case this._register_ops.XOR: // Xor
                this._set_register(target_register, false, value1_unsigned ^ value2_unsigned);
                this._debug("xor x" + target_register + ", x" + rs1 + ", x" + rs2);
                break;
            case this._register_ops.SR: // Shift right logical
                this._set_register(target_register, false, value1_unsigned >> value2_unsigned);
                this._debug("sr x" + target_register + ", x" + rs1 + ", x" + rs2);
                break;
            case this._register_ops.OR: // Shift right arithmetic
                this._set_register(target_register, true, value1_signed >> value2_signed);
                this._debug("or x" + target_register + ", x" + rs1 + ", x" + rs2);
                break;
            case this._register_ops.AND: // And
                this._set_register(target_register, false, value1_unsigned & value2_unsigned);
                this._debug("xor x" + target_register + ", x" + rs1 + ", x" + rs2);
                break;
            default:
                throw new Error("Invalid register instruction. Funct3: " + funct3);
        }
    }

    _execute_op_fence(instruction) {
        this._debug("fence");
    }

    _execute_op_service(instruction) {
        let operation = this._imm_I(instruction, false);
        switch(operation) {
            case this._service_ops.ECALL:
                this._debug("ecall");
                break;
            case this._service_ops.EBREAK:
                this._debug("ebreak");
                break;
            default:
                throw new Error("Invalid service instruction. Operation: " + operation);
        }
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
                this._execute_op_register(instruction);
                break;
            case this._opcodes.FENCE:
                this._execute_op_fence(instruction);
                break;
            case this._opcodes.SERVICE:
                this._execute_op_service(instruction);
                break;
            default:
                throw new Error("Invalid instruction. Unrecognized opcode 0x" + opcode.toString(16));
        }
    }

    dump_registers() {
        let output = "PC " + this._pc.toString(16) + " REG ";
        for (let register = 1; register < this._registers_amount; register++) {
            output += this._get_register(register, false).toString(16) + " ";
        }
        this._debug(output);
    }
}

module.exports = Cpu;
