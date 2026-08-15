import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { run } from "./workflow.js";

export const server = new Server(
  { name: "ci-cd-pipeline-templates", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler("list_tools", async () => ({
  tools: [
    {
      name: "run_pipeline",
      description: "Run a CI/CD pipeline: lint, test, build, (optional) deploy",
      inputSchema: { type: "object", properties: {          steps: { type: "string", description: "Comma-separated steps: lint,test,build,deploy" },
          deployTarget: { type: "string", description: "Deploy target if deploy step included" },
      }, required: [] },
    },
  ],
}));

server.setRequestHandler("call_tool", async (request) => {
  const { name, arguments: args } = request.params;
  if (name === "run_pipeline") {
    const result = await run(args);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  }
  throw new Error("Unknown tool");
});
