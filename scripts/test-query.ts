import { config } from "dotenv";
import { executePhysicianQuery } from "../lib/db/mysql";

// Load environment variables
config({ path: ".env.local" });

async function testQueries() {
  console.log("Testing physician queries...\n");

  try {
    // Test 1: Count total physicians
    const countResult = await executePhysicianQuery(
      "SELECT COUNT(*) as total FROM provider_services LIMIT 1"
    );
    console.log("Total physicians:", countResult[0]);

    // Test 2: Sample search (find any cardiologist with distinct names)
    const cardiologists = await executePhysicianQuery(
      "SELECT DISTINCT rndrng_prvdr_first_name, rndrng_prvdr_last_org_name, rndrng_prvdr_city FROM provider_services WHERE rndrng_prvdr_type LIKE ? LIMIT 3",
      ["%Cardio%"]
    );
    console.log("\nSample cardiologists:", cardiologists);

    console.log("\n✅ All queries successful!");
  } catch (error) {
    console.error("❌ Query failed:", error);
  }
}

testQueries().catch(console.error);
