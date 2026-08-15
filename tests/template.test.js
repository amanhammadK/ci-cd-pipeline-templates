import { CiCdPipelineServer } from "../src/mcpServer.js";

describe("CiCdPipelineServer", () => {
    let server;

    beforeEach(() => {
        server = new CiCdPipelineServer();
    });

    test("should initialize server", () => {
        expect(server).toBeDefined();
        expect(server.server).toBeDefined();
    });
});
