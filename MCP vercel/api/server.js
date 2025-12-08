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

// ===== TOOLS =====
server.registerTool(
  "listEmployees",
  {
    title: "List all employees",
    description: "Returns all employees from Supabase table 'employees'",
    inputSchema: { type: "object", properties: {}, required: [] }
  },
  async () => {
    const { data, error } = await supabase.from("employees").select("*");
    if (error) {
      return {
        content: [{ type: "text", text: `Error: ${error.message}` }]
      };
    }
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }]
    };
  }
);

server.registerTool(
  "salaryFor",
  {
    title: "Get Salary for Employee",
    description: "Returns latest salary of an employee",
    inputSchema: {
      type: "object",
      properties: { name: { type: "string" } },
      required: ["name"]
    }
  },
  async ({ name }) => {
    const { data, error } = await supabase
      .from("salaries")
      .select("*")
      .eq("name", name)
      .order("to_date", { ascending: false })
      .limit(1);

    if (error) {
      return {
        content: [{ type: "text", text: `Error: ${error.message}` }]
      };
    }
    if (!data.length) {
      return {
        content: [{ type: "text", text: `Employee not found: ${name}` }]
      };
    }

    return {
      content: [{ type: "text", text: JSON.stringify(data[0], null, 2) }]
    };
  }
);

// HTTP wrapper
const httpServer = new HttpServer(server);

// ========== Vercel API Handler ==========
export default async function handler(req, res) {
  // Required for CORS (important!)
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  return httpServer.handleHttp(req, res);
}
