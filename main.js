"use strict";

const fs = require("fs");

const Memory = require("./memory.js");
const Bus = require("./bus.js");
const Cpu = require("./cpu.js");
const Io = require("./io.js");

let program_filename = 'program/test.bin';

let program = Buffer.from(fs.readFileSync(program_filename));

let ram_base_address = 0x10000000;
let ram_size = 1024 * 1024 * 1;
let ram_memory = new Memory(ram_size, ram_base_address);

let rom_base_address = 0x00000000;
let rom_size = 1024 * 1024 * 1;
let rom_memory = new Memory(rom_size, rom_base_address);

let io_base_address = 0x90000000;
let io_memory = new Io(io_base_address);

rom_memory.store_direct(program);

let bus = new Bus();

bus.add_peripheral(ram_memory);
bus.add_peripheral(rom_memory);
bus.add_peripheral(io_memory);

let cpu = new Cpu(bus, ram_base_address + ram_size, true);

async function main() {
    cpu.init();
    cpu.dump_registers();

    while (1) {
        let instruction = cpu.fetch();
        if (instruction === 0) {
            break;
        }
        cpu._pc += 4;
        cpu.execute(instruction);
        cpu.dump_registers();
        if (cpu._pc === 0) {
            break;
        }

        await new Promise(resolve => setTimeout(resolve, 10));
    }
}

main();
