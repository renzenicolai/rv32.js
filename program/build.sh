#!/usr/bin/env bash

set -e

riscv64-elf-gcc -Wl,-Ttext=0x0 -nostdlib -march=rv32i -mabi=ilp32 -o test.elf test.S
riscv64-elf-objcopy -O binary test.elf test.bin
