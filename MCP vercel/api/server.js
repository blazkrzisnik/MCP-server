import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { HttpServer } from "@modelcontextprotocol/sdk/server/http.js";
import { createClient } from "@supabase/supabase-js";

// Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

// MCP server
const server = new McpServer({
  name: "sql-mcp-server",
  version: "1.0.0",
});

// ========== EXAMPLE TOOL ==========
server.registerTool(
  "listRows",
  {
    title: "List rows from a table",
    description: "Returns all rows from a given Supabase table",
    inputSchema: {
      type: "object",
      properties: {
        table: { type: "string" }
      },
      required: ["table"]
    }
  },
  async ({ table }) => {
    const { data, error } = await supabase.from(table).select("*");
    if (error) return { content: [{ type: "text", text: `Error: ${error.message}` }] };
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  }
);

// ========== HTTP server for Vercel ==========
const httpServer = new HttpServer(server);

export default function handler(req, res) {
  httpServer.handleHttp(req, res);
}
