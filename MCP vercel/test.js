import { McpClient, StdioClientTransport } from "@modelcontextprotocol/sdk";

async function main() {
  const transport = new StdioClientTransport();
  const client = new McpClient({ name: "local-test-client" });
  await client.connect(transport);

  try {
    // Pokliči tool "salaryFor"
    const salary = await client.callTool("salaryFor", { name: "John Smith" });
    console.log("salaryFor result:", salary);

    // Pokliči tool "salaryIncreaseInLast2Years"
    const increase = await client.callTool("salaryIncreaseInLast2Years", { name: "John Smith" });
    console.log("salaryIncreaseInLast2Years result:", increase);

  } catch (err) {
    console.error("Error calling tools:", err);
  }

  process.exit(0);
}

main();
