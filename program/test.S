	.global _start
	.global test_function
	.type test_function, %function
_start:
test_function:
	addi x3, x0, 5
	addi x1, x0, 0
keepgoing:
	addi x1, x1, 1
	bne x1, x3, keepgoing
	jal x0, 0
	.size test_function, . - test_function
