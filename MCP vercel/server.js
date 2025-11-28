import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import mysql from "mysql2/promise";
import { z } from "zod";

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
});

const server = new McpServer({ name: "sql-mcp-server", version: "1.0.0" });

// ========== BRANJE PODATKOV ==========

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
      return { 
        content: [{ type: "text", text: `Employee not found: ${name}` }] 
      };
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
       WHERE s.to_date = (
         SELECT MAX(to_date) 
         FROM salaries 
         WHERE emp_no = e.emp_no
       )
       ORDER BY e.emp_no`
    );

    const employeeList = rows.map(r => 
      `${r.emp_no}: ${r.first_name} ${r.last_name} - Salary: ${r.salary || 'N/A'} (Hired: ${r.hire_date.toISOString().split('T')[0]})`
    ).join('\n');

    return {
      content: [{ 
        type: "text", 
        text: `Employees:\n${employeeList}` 
      }]
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
      return { 
        content: [{ type: "text", text: `No salary records found for: ${name}` }] 
      };
    }

    const history = rows.map(r => 
      `${r.salary} (${r.from_date.toISOString().split('T')[0]} to ${r.to_date.toISOString().split('T')[0]})`
    ).join('\n');

    return {
      content: [{ 
        type: "text", 
        text: `Salary history for ${name}:\n${history}` 
      }]
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

    const salaries = rows.map(r => 
      `Emp ${r.emp_no} (${r.first_name} ${r.last_name}): ${r.salary} (${r.from_date.toISOString().split('T')[0]} to ${r.to_date.toISOString().split('T')[0]})`
    ).join('\n');

    return {
      content: [{ 
        type: "text", 
        text: `Salaries (showing ${rows.length} records):\n${salaries}` 
      }]
    };
  }
);

// ========== SPREMINJANJE PODATKOV ==========

server.registerTool(
  "addEmployee",
  {
    title: "Add Employee",
    description: "Add a new employee to the database",
    inputSchema: z.object({
      emp_no: z.number().describe("Employee number"),
      first_name: z.string().describe("First name"),
      last_name: z.string().describe("Last name"),
      birth_date: z.string().describe("Birth date (YYYY-MM-DD)"),
      gender: z.enum(['M', 'F']).describe("Gender (M or F)"),
      hire_date: z.string().describe("Hire date (YYYY-MM-DD)")
    })
  },
  async ({ emp_no, first_name, last_name, birth_date, gender, hire_date }) => {
    try {
      await pool.query(
        `INSERT INTO employees (emp_no, birth_date, first_name, last_name, gender, hire_date)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [emp_no, birth_date, first_name, last_name, gender, hire_date]
      );

      return {
        content: [{ 
          type: "text", 
          text: `Successfully added employee: ${first_name} ${last_name} (${emp_no})` 
        }]
      };
    } catch (error) {
      return {
        content: [{ 
          type: "text", 
          text: `Error adding employee: ${error.message}` 
        }]
      };
    }
  }
);

server.registerTool(
  "updateSalary",
  {
    title: "Update Salary",
    description: "Add a new salary record for an employee",
    inputSchema: z.object({
      name: z.string().describe("Full name of the employee"),
      salary: z.number().describe("New salary amount"),
      from_date: z.string().describe("Start date (YYYY-MM-DD)"),
      to_date: z.string().describe("End date (YYYY-MM-DD)")
    })
  },
  async ({ name, salary, from_date, to_date }) => {
    try {
      // Get emp_no
      const [employees] = await pool.query(
        `SELECT emp_no FROM employees WHERE CONCAT(first_name, ' ', last_name) = ?`,
        [name]
      );

      if (!employees.length) {
        return {
          content: [{ type: "text", text: `Employee not found: ${name}` }]
        };
      }

      const emp_no = employees[0].emp_no;

      await pool.query(
        `INSERT INTO salaries (emp_no, salary, from_date, to_date)
         VALUES (?, ?, ?, ?)`,
        [emp_no, salary, from_date, to_date]
      );

      return {
        content: [{ 
          type: "text", 
          text: `Successfully added salary ${salary} for ${name} (${from_date} to ${to_date})` 
        }]
      };
    } catch (error) {
      return {
        content: [{ 
          type: "text", 
          text: `Error updating salary: ${error.message}` 
        }]
      };
    }
  }
);

server.registerTool(
  "deleteEmployee",
  {
    title: "Delete Employee",
    description: "Delete an employee and all related records",
    inputSchema: z.object({
      name: z.string().describe("Full name of the employee to delete")
    })
  },
  async ({ name }) => {
    try {
      // Get emp_no
      const [employees] = await pool.query(
        `SELECT emp_no FROM employees WHERE CONCAT(first_name, ' ', last_name) = ?`,
        [name]
      );

      if (!employees.length) {
        return {
          content: [{ type: "text", text: `Employee not found: ${name}` }]
        };
      }

      const emp_no = employees[0].emp_no;

      // Delete from salaries first (foreign key constraint)
      await pool.query(`DELETE FROM salaries WHERE emp_no = ?`, [emp_no]);
      
      // Delete employee
      await pool.query(`DELETE FROM employees WHERE emp_no = ?`, [emp_no]);

      return {
        content: [{ 
          type: "text", 
          text: `Successfully deleted employee: ${name} and all related records` 
        }]
      };
    } catch (error) {
      return {
        content: [{ 
          type: "text", 
          text: `Error deleting employee: ${error.message}` 
        }]
      };
    }
  }
);

server.registerTool(
  "executeSQL",
  {
    title: "Execute SQL Query",
    description: "Execute any SQL query (SELECT, INSERT, UPDATE, DELETE). Use with caution!",
    inputSchema: z.object({
      query: z.string().describe("SQL query to execute")
    })
  },
  async ({ query }) => {
    try {
      const [rows] = await pool.query(query);

      if (Array.isArray(rows) && rows.length > 0) {
        // SELECT query
        const result = JSON.stringify(rows, null, 2);
        return {
          content: [{ 
            type: "text", 
            text: `Query executed successfully:\n${result}` 
          }]
        };
      } else {
        // INSERT/UPDATE/DELETE query
        return {
          content: [{ 
            type: "text", 
            text: `Query executed successfully. Affected rows: ${rows.affectedRows || 0}` 
          }]
        };
      }
    } catch (error) {
      return {
        content: [{ 
          type: "text", 
          text: `Error executing query: ${error.message}` 
        }]
      };
    }
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);