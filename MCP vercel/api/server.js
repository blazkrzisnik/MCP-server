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

// ========== SQL Tools ==========
server.registerTool(
  "listEmployees",
  {
    title: "List all employees",
    description: "Returns all employees from Supabase table 'employees'",
    inputSchema: { type: "object", properties: {}, required: [] }
  },
  async () => {
    const { data, error } = await supabase.from("employees").select("*");
    if (error) return { content: [{ type: "text", text: `Error: ${error.message}` }] };
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
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
      .select("emp_no, salary, from_date, to_date")
      .eq("name", name)
      .order("to_date", { ascending: false })
      .limit(1);
    if (error) return { content: [{ type: "text", text: `Error: ${error.message}` }] };
    if (!data.length) return { content: [{ type: "text", text: `Employee not found: ${name}` }] };
    return { content: [{ type: "text", text: JSON.stringify(data[0], null, 2) }] };
  }
);

// ========== HTTP server ==========
const httpServer = new HttpServer(server);

export default function handler(req, res) {
  httpServer.handleHttp(req, res);
}
