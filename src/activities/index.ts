import { execFile } from "child_process";
import { promisify } from "util";
const execFileP = promisify(execFile);

async function step(name: string, cmd: string[], args: string[]): Promise<{ step: string; ok: boolean; output: string }> {
  try {
    const { stdout } = await execFileP(cmd, args, { timeout: 120000 });
    return { step: name, ok: true, output: stdout.slice(0, 500) };
  } catch (e: any) {
    return { step: name, ok: false, output: (e.stdout || e.stderr || e.message).slice(0, 500) };
  }
}

export async function lint(): Promise<any> { return step("lint", "npx", ["eslint", "src", "--max-warnings", "0"]); }
export async function test(): Promise<any> { return step("test", "npx", ["vitest", "run"]); }
export async function build(): Promise<any> { return step("build", "npm", ["run", "build"]); }
export async function deploy(target?: string): Promise<any> { return step("deploy", "echo", [`deploy -> ${target || "staging"}`]); }
