import { Command } from "commander";

//#region src/cli.d.ts
declare function buildProgram(): Command;
declare function main(argv?: string[]): Promise<void>;
//#endregion
export { buildProgram, main };