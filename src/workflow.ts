import { lint, test, build, deploy } from "./activities/index.js";

const MAP: Record<string, () => Promise<any>> = { lint, test, build, deploy };

export async function run(args: any): Promise<any> {
  const steps = (args.steps || "lint,test,build").split(",").map((s: string) => s.trim());
  const results = [];
  for (const s of steps) {
    if (s === "deploy") results.push(await deploy(args.deployTarget));
    else if (MAP[s]) results.push(await MAP[s]());
    else results.push({ step: s, ok: false, output: "unknown step" });
    if (!results[results.length - 1].ok && s !== "deploy") break;
  }
  const failed = results.some((r) => !r.ok);
  return { steps: results, status: failed ? "failed" : "success" };
}
