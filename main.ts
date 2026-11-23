#!/usr/bin/env node
"use strict";
const fs = require("fs");
const path = require("path");

const STACK_MAX = 256;
const CALLS_MAX = 64;
const MEMORY_WORDS = 256;
const STEP_LIMIT = 1000000;
const OUTPUT_MAX = 65536;

const TRAP = {
UNDERFLOW: 2,
OVERFLOW: 3,
DIV_ZERO: 4,
BAD_OPCODE: 5,
MEMORY: 6,
CALL_DEPTH: 7,
RET_EMPTY: 8,
PC: 9,
STEPS: 10,
OUTPUT: 11,
};

const OP = {};
[[0x00, "HALT", 0, 0, 0], [0x01, "PUSH8", 1, 0, 1], [0x02, "PUSH32", 4, 0, 1], [0x03, "POP", 0, 1, 0], [0x04, "DUP", 0, 1, 2], [0x05, "SWAP", 0, 2, 2], [0x06, "OVER", 0, 2, 3], [0x07, "ROT", 0, 3, 3], [0x10, "ADD", 0, 2, 1], [0x11, "SUB", 0, 2, 1], [0x12, "MUL", 0, 2, 1], [0x13, "DIV", 0, 2, 1], [0x14, "MOD", 0, 2, 1], [0x15, "DIVU", 0, 2, 1], [0x16, "MODU", 0, 2, 1], [0x17, "NEG", 0, 1, 1], [0x18, "AND", 0, 2, 1], [0x19, "OR", 0, 2, 1], [0x1a, "XOR", 0, 2, 1], [0x1b, "NOT", 0, 1, 1], [0x1c, "SHL", 0, 2, 1], [0x1d, "SHR", 0, 2, 1], [0x1e, "SHRU", 0, 2, 1], [0x20, "EQ", 0, 2, 1], [0x21, "LT", 0, 2, 1], [0x22, "LTU", 0, 2, 1], [0x30, "JMP", 2, 0, 0], [0x31, "JZ", 2, 1, 0], [0x32, "JNZ", 2, 1, 0], [0x33, "CALL", 2, 0, 0], [0x34, "RET", 0, 0, 0], [0x40, "LOAD", 0, 1, 1], [0x41, "STORE", 0, 2, 0], [0x50, "PRINT", 0, 1, 0], [0x51, "PUTC", 0, 1, 0], [0x52, "IN", 0, 0, 1], [0x53, "EXIT", 0, 1, 0]].forEach((o) => { OP[o[0]] = [o[1], o[2], o[3], o[4]] });

function run(program, input) {
const n = program.length;
const D = new Int32Array(STACK_MAX);
let sp = 0;
const C = new Int32Array(CALLS_MAX);
let csp = 0;
const M = new Int32Array(MEMORY_WORDS);
const out = new Uint8Array(OUTPUT_MAX);
let olen = 0;
let inPos = 0;
let pc = 0;
let steps = 0;
const T = (e) => ({ stdout: out.slice(0, olen), exit: e, trap: e, steps });

for (;;) {
if (steps === STEP_LIMIT) return T(TRAP.STEPS);
if (pc < 0 || pc >= n) return T(TRAP.PC);
const op = OP[program[pc]];
if (op === undefined) return T(TRAP.BAD_OPCODE);
const [name, imm, pops, pushes] = op;
if (pc + imm >= n) return T(TRAP.PC);
steps++;
const next = pc + 1 + imm;
if (sp < pops) return T(TRAP.UNDERFLOW);
if (sp - pops + pushes > STACK_MAX) return T(TRAP.OVERFLOW);
pc = next;

switch (name) {
case "HALT": return { stdout: out.slice(0, olen), exit: 0, trap: null, steps };
case "PUSH8": D[sp++] = (program[next - 1] << 24) >> 24; break;
case "PUSH32": D[sp++] = program[next - 4] | (program[next - 3] << 8) | (program[next - 2] << 16) | (program[next - 1] << 24); break;
case "POP": sp--; break;
case "DUP": D[sp] = D[sp - 1]; sp++; break;
case "SWAP": { const t = D[sp - 1]; D[sp - 1] = D[sp - 2]; D[sp - 2] = t; break; }
case "OVER": D[sp] = D[sp - 2]; sp++; break;
case "ROT": { const a = D[sp - 3]; D[sp - 3] = D[sp - 2]; D[sp - 2] = D[sp - 1]; D[sp - 1] = a; break; }
case "NEG": D[sp - 1] = -D[sp - 1] | 0; break;
case "NOT": D[sp - 1] = ~D[sp - 1]; break;
case "ADD": D[sp - 2] = (D[sp - 2] + D[sp - 1]) | 0; sp--; break;
case "SUB": D[sp - 2] = (D[sp - 2] - D[sp - 1]) | 0; sp--; break;
case "MUL": D[sp - 2] = Math.imul(D[sp - 2], D[sp - 1]); sp--; break;
case "DIV": { const b = D[sp - 1]; const a = D[sp - 2]; if (b === 0) return T(TRAP.DIV_ZERO); D[sp - 2] = a === -2147483648 && b === -1 ? a : (a / b) | 0; sp--; break; }
case "MOD": { const b = D[sp - 1]; const a = D[sp - 2]; if (b === 0) return T(TRAP.DIV_ZERO); D[sp - 2] = b === -1 ? 0 : a % b | 0; sp--; break; }
case "DIVU": { const b = D[sp - 1]; const a = D[sp - 2]; if (b === 0) return T(TRAP.DIV_ZERO); D[sp - 2] = Math.floor((a >>> 0) / (b >>> 0)) | 0; sp--; break; }
case "MODU": { const b = D[sp - 1]; const a = D[sp - 2]; if (b === 0) return T(TRAP.DIV_ZERO); D[sp - 2] = (a >>> 0) % (b >>> 0) | 0; sp--; break; }
case "AND": D[sp - 2] = D[sp - 2] & D[sp - 1]; sp--; break;
case "OR": D[sp - 2] = D[sp - 2] | D[sp - 1]; sp--; break;
case "XOR": D[sp - 2] = D[sp - 2] ^ D[sp - 1]; sp--; break;
case "SHL": D[sp - 2] = D[sp - 2] << (D[sp - 1] & 31); sp--; break;
case "SHR": D[sp - 2] = D[sp - 2] >> (D[sp - 1] & 31); sp--; break;
case "SHRU": D[sp - 2] = (D[sp - 2] >>> (D[sp - 1] & 31)) | 0; sp--; break;
case "EQ": D[sp - 2] = D[sp - 2] === D[sp - 1] ? 1 : 0; sp--; break;
case "LT": D[sp - 2] = D[sp - 2] < D[sp - 1] ? 1 : 0; sp--; break;
case "LTU": D[sp - 2] = D[sp - 2] >>> 0 < D[sp - 1] >>> 0 ? 1 : 0; sp--; break;
case "JMP": case "JZ": case "JNZ": { const rel = ((program[next - 2] | (program[next - 1] << 8)) << 16) >> 16; let take = true; if (name !== "JMP") { const v = D[--sp]; take = name === "JZ" ? v === 0 : v !== 0; } if (take) pc = next + rel; break; }
case "CALL": if (csp === CALLS_MAX) return T(TRAP.CALL_DEPTH); csp++; C[csp - 1] = next; pc = program[next - 2] | (program[next - 1] << 8); break;
case "RET": if (csp === 0) return T(TRAP.RET_EMPTY); csp--; pc = C[csp]; break;
case "LOAD": { const addr = D[sp - 1]; if (addr < 0 || addr >= MEMORY_WORDS) return T(TRAP.MEMORY); D[sp - 1] = M[addr]; break; }
case "STORE": { const addr = D[sp - 1]; const v = D[sp - 2]; if (addr < 0 || addr >= MEMORY_WORDS) return T(TRAP.MEMORY); sp -= 2; M[addr] = v; break; }
case "PRINT": { const v = D[--sp]; const bytes = Buffer.from(String(v), "utf8"); if (olen + bytes.length > OUTPUT_MAX) return T(TRAP.OUTPUT); out.set(bytes, olen); olen += bytes.length; break; }
case "PUTC": if (olen + 1 > OUTPUT_MAX) return T(TRAP.OUTPUT); out[olen++] = D[--sp] & 255; break;
case "IN": D[sp++] = inPos < input.length ? input[inPos++] : -1; break;
case "EXIT": return { stdout: out.slice(0, olen), exit: D[--sp] & 255, trap: null, steps };
}
}
}
const inputDir = process.env.MAKEFUN_INPUT_DIR || "/input";
const outputDir = process.env.MAKEFUN_OUTPUT_DIR || "/output";
const dir = fs.opendirSync(inputDir);
const entries = [];
let entry;
while ((entry = dir.readSync()) !== null) {
if (entry.name.startsWith("i") && /i\d+/.test(entry.name)) entries.push(entry.name);
}
dir.closeSync();
entries.sort();
for (const id of entries) {
const idDir = path.join(inputDir, id);
const outDir = path.join(outputDir, id);
fs.mkdirSync(outDir, { recursive: true });
const prog = new Uint8Array(fs.readFileSync(path.join(idDir, "program.bin")));
const inp = new Uint8Array(fs.readFileSync(path.join(idDir, "input.bin")));
const result = run(prog, inp);
fs.writeFileSync(path.join(outDir, "stdout.bin"), Buffer.from(result.stdout));
fs.writeFileSync(path.join(outDir, "exit.txt"), result.exit + "\n");
}
