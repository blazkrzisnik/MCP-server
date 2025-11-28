import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { HttpServer } from "@modelcontextprotocol/sdk/server/http.js";
import mysql from "mysql2/promise";
import { z } from "zod";

// --- DATABASE POOL (Supabase MySQL proxies also work) ---
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

// --- MCP SERVER ---
const server = new McpServer({
  name: "sql-mcp-server",
  version: "1.0.0",
});

// ========== ORIGINAL TOOLS (NE SPREMINJAJ) ==========

server.registerTool(
  "salaryFor",
  {
    title: "Get Salary",
    description: "Get salary for an employee by their full name",
    inputSchema: z.object({
      name: z.string().describe("Full name of the employee")
    })
  },
  async ({ name }) => {
    const [rows] = await pool.query(
      `SELECT e.first_name, e.last_name, s.salary, s.from_date, s.to_date
       FROM employees e
       JOIN salaries s ON e.emp_no = s.emp_no
       WHERE CONCAT(e.first_name, ' ', e.last_name) = ?
       ORDER BY s.to_date DESC LIMIT 1`,
      [name]
    );

    if (!rows.length) {
      return { content: [{ type: "text", text: `Employee not found: ${name}` }] };
    }

    const row = rows[0];
    return {
      content: [
        {
          type: "text",
          text: `${row.first_name} ${row.last_name} has salary ${row.salary} (from ${row.from_date.toISOString().split('T')[0]} to ${row.to_date.toISOString().split('T')[0]})`
        }
      ]
    };
  }
);

server.registerTool(
  "listEmployees",
  {
    title: "List Employees",
    description: "Get a list of all employees with their current salaries",
    inputSchema: z.object({})
  },
  async () => {
    const [rows] = await pool.query(
      `SELECT e.emp_no, e.first_name, e.last_name, e.hire_date, s.salary
       FROM employees e
       LEFT JOIN salaries s ON e.emp_no = s.emp_no
       WHERE s.to_date = (SELECT MAX(to_date) FROM salaries WHERE emp_no = e.emp_no)
       ORDER BY e.emp_no`
    );

    const employeeList = rows
      .map(r => `${r.emp_no}: ${r.first_name} ${r.last_name} - Salary: ${r.salary || "N/A"} (Hired: ${r.hire_date.toISOString().split("T")[0]})`)
      .join("\n");

    return {
      content: [{ type: "text", text: `Employees:\n${employeeList}` }]
    };
  }
);

server.registerTool(
  "getSalaryHistory",
  {
    title: "Get Salary History",
    description: "Get complete salary history for an employee",
    inputSchema: z.object({
      name: z.string().describe("Full name of the employee")
    })
  },
  async ({ name }) => {
    const [rows] = await pool.query(
      `SELECT s.salary, s.from_date, s.to_date
       FROM employees e
       JOIN salaries s ON e.emp_no = s.emp_no
       WHERE CONCAT(e.first_name, ' ', e.last_name) = ?
       ORDER BY s.from_date DESC`,
      [name]
    );

    if (!rows.length) {
      return { content: [{ type: "text", text: `No salary records found for: ${name}` }] };
    }

    const history = rows
      .map(r => `${r.salary} (${r.from_date.toISOString().split("T")[0]} to ${r.to_date.toISOString().split("T")[0]})`)
      .join("\n");

    return {
      content: [{ type: "text", text: `Salary history for ${name}:\n${history}` }]
    };
  }
);

server.registerTool(
  "getAllSalaries",
  {
    title: "Get All Salaries",
    description: "Get all salary records from the salaries table",
    inputSchema: z.object({
      limit: z.number().optional().describe("Maximum number of records to return (default: 100)")
    })
  },
  async ({ limit = 100 }) => {
    const [rows] = await pool.query(
      `SELECT s.emp_no, e.first_name, e.last_name, s.salary, s.from_date, s.to_date
       FROM salaries s
       JOIN employees e ON s.emp_no = e.emp_no
       ORDER BY s.from_date DESC
       LIMIT ?`,
      [limit]
    );

    const salaries = rows
      .map(
        r =>
          `Emp ${r.emp_no} (${r.first_name} ${r.last_name}): ${r.salary} (${r.from_date
            .toISOString()
            .split("T")[0]} to ${r.to_date.toISOString().split("T")[0]})`
      )
      .join("\n");

    return {
      content: [{ type: "text", text: `Salaries (showing ${rows.length} records):\n${salaries}` }]
    };
  }
);

server.registerTool(
  "addEmployee",
  {
    title: "Add Employee",
    description: "Add a new employee to the database",
    inputSchema: z.object({
      emp_no: z.number(),
      first_name: z.string(),
      last_name: z.string(),
      birth_date: z.string(),
      gender: z.enum(["M", "F"]),
      hire_date: z.string()
    })
  },
  async (employee) => {
    try {
      await pool.query(
        `INSERT INTO employees (emp_no, birth_date, first_name, last_name, gender, hire_date)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          employee.emp_no,
          employee.birth_date,
          employee.first_name,
          employee.last_name,
          employee.gender,
          employee.hire_date
        ]
      );

      return {
        content: [
          {
            type: "text",
            text: `Successfully added employee: ${employee.first_name} ${employee.last_name} (${employee.emp_no})`
          }
        ]
      };
    } catch (error) {
      return { content: [{ type: "text", text: `Error adding employee: ${error.message}` }] };
    }
  }
);

server.registerTool(
  "updateSalary",
  {
    title: "Update Salary",
    description: "Add a new salary record for an employee",
    inputSchema: z.object({
      name: z.string(),
      salary: z.number(),
      from_date: z.string(),
      to_date: z.string()
    })
  },
  async ({ name, salary, from_date, to_date }) => {
    try {
      const [employees] = await pool.query(
        `SELECT emp_no FROM employees WHERE CONCAT(first_name, ' ', last_name) = ?`,
        [name]
      );

      if (!employees.length) {
        return { content: [{ type: "text", text: `Employee not found: ${name}` }] };
      }

      const emp_no = employees[0].emp_no;

      await pool.query(
        `INSERT INTO salaries (emp_no, salary, from_date, to_date)
         VALUES (?, ?, ?, ?)`,
        [emp_no, salary, from_date, to_date]
      );

      return {
        content: [
          {
            type: "text",
            text: `Successfully added salary ${salary} for ${name} (${from_date} to ${to_date})`
          }
        ]
      };
    } catch (error) {
      return { content: [{ type: "text", text: `Error updating salary: ${error.message}` }] };
    }
  }
);

server.registerTool(
  "deleteEmployee",
  {
    title: "Delete Employee",
    description: "Delete an employee and all related records",
    inputSchema: z.object({
      name: z.string()
    })
  },
  async ({ name }) => {
    try {
      const [employees] = await pool.query(
        `SELECT emp_no FROM employees WHERE CONCAT(first_name, ' ', last_name) = ?`,
        [name]
      );

      if (!employees.length) {
        return { content: [{ type: "text", text: `Employee not found: ${name}` }] };
      }

      const emp_no = employees[0].emp_no;

      await pool.query(`DELETE FROM salaries WHERE emp_no = ?`, [emp_no]);
      await pool.query(`DELETE FROM employees WHERE emp_no = ?`, [emp_no]);

      return { content: [{ type: "text", text: `Deleted ${name} and all related records.` }] };
    } catch (error) {
      return { content: [{ type: "text", text: `Error deleting employee: ${error.message}` }] };
    }
  }
);

server.registerTool(
  "executeSQL",
  {
    title: "Execute SQL Query",
    description: "Execute any SQL query",
    inputSchema: z.object({
      query: z.string()
    })
  },
  async ({ query }) => {
    try {
      const [rows] = await pool.query(query);
      return {
        content: [
          {
            type: "text",
            text: `Query executed:\n${JSON.stringify(rows, null, 2)}`
          }
        ]
      };
    } catch (e) {
      return { content: [{ type: "text", text: `Error: ${e.message}` }] };
    }
  }
);

// ================== HTTP SERVER ==================

const httpServer = new HttpServer(server);

export default async function handler(req, res) {
  return httpServer.handleRequest(req, res);
}
