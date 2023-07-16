"use strict";

const fs = require("fs");

const Memory = require("./memory.js");
const Bus = require("./bus.js");
const Cpu = require("./cpu.js");

let program = Buffer.from(fs.readFileSync('program/test.bin'));

let ram_base_address = 0x80000000;
let ram_size = 1024 * 1024 * 1;
let ram_memory = new Memory(ram_size, ram_base_address);

let rom_base_address = 0x00000000;
let rom_size = 1024 * 1024 * 1;
let rom_memory = new Memory(rom_size, rom_base_address);

rom_memory.store_direct(program);

let bus = new Bus();

bus.add_peripheral(ram_memory);
bus.add_peripheral(rom_memory);

let cpu = new Cpu(bus, ram_base_address + ram_size);

async function main() {
    cpu.init();
    cpu.dump_registers();

    while (1) {
        let instruction = cpu.fetch();
        cpu._pc += 4;
        cpu.execute(instruction);
        cpu.dump_registers();
        if (cpu._pc === 0) {
            break;
        }

        await new Promise(resolve => setTimeout(resolve, 100));
    }
}

main();

//bus.store(0x80000000, 32, 0x12345678);
//console.log(bus.load(0x80000000, 32));

//cpu.execute(0x00730293); // addi x5, x6, 7
//cpu.dump_registers();

//cpu.execute(0x00732293); // slti x5, x6, 7
//cpu.dump_registers();

//cpu.execute(0x40735293); // srai x5, x6, 7
//cpu.dump_registers();
