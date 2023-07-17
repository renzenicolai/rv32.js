.global _start
_start:
	nop # Start with a no-op at address 0, we can't jump back here
	lui  x3, 0x90000
	addi x5, x0, 0

	lui  x4, %hi(message)
	addi  x4, x4, %lo(message)

next_char:
	lb   x1, 0(x4)
	beq  x1, x5, halt
	sb   x1, 0(x3)
	addi x4, x4, 1
	j next_char
halt:
	jal x0, 0

message:
        .string "HELLO WORLD! This is a string printed using RV32E assembly code!\n\0"
