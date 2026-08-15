import express from "express";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { server } from "./mcpServer.js";

const app = express();
const PORT = parseInt(process.env.PORT || "8080", 10);
let transport: SSEServerTransport;

app.get("/sse", async (_, res) => {
  transport = new SSEServerTransport("/message", res);
  await server.connect(transport);
});
app.post("/message", async (req, res) => {
  if (transport) await transport.handlePostMessage(req, res);
});
app.get("/health", (_, res) => {
  res.json({ status: "ok", server: "ci-cd-pipeline-templates", uptime: process.uptime() });
});
app.listen(PORT, () => console.log(`ci-cd-pipeline-templates workflow server running on port ${PORT}`));
