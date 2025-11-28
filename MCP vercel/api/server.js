import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { HttpServer } from "@modelcontextprotocol/sdk/server/http.js";

// 🔥 Če uporabljaš Supabase namesto MySQL, ga uvoziš tukaj:
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

// ------------------------------------------------------------
// MCP SERVER
// ------------------------------------------------------------
const server = new McpServer({
  name: "sql-mcp-server",
  version: "1.0.0",
});

// ------------------------------------------------------------
// EXAMPLE TOOL – raje dodaj tukaj svoje prave tools
// ------------------------------------------------------------
server.tool("list_rows", {
  description: "List rows from a Supabase table",
  inputSchema: {
    type: "object",
    properties: {
      table: { type: "string" }
    },
    required: ["table"]
  },
  execute: async ({ table }) => {
    const { data, error } = await supabase.from(table).select("*");

    if (error) return { error: error.message };

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(data, null, 2)
        }
      ]
    };
  }
});

// ------------------------------------------------------------
// HTTP MCP SERVER — IMPORTANT FOR VERCEL
// ------------------------------------------------------------
const httpServer = new HttpServer(server);

export default function handler(req, res) {
  httpServer.handleHttp(req, res);
}
