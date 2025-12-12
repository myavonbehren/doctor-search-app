import { config } from "dotenv";
import { executePhysicianQuery } from "../lib/db/mysql";

config({ path: ".env.local" });

async function checkDataFormat() {
  console.log("=== Checking Data Format ===\n");

  try {
    // Check 1: What specialties exist?
    console.log("1. Sample provider types (specialties):");
    const specialties = await executePhysicianQuery(
      "SELECT DISTINCT rndrng_prvdr_type FROM provider_services LIMIT 20"
    );
    for (const row of specialties) {
      console.log(`  - "${row.rndrng_prvdr_type}"`);
    }

    // Check 2: What cities exist?
    console.log("\n2. Sample cities:");
    const cities = await executePhysicianQuery(
      "SELECT DISTINCT rndrng_prvdr_city FROM provider_services LIMIT 20"
    );
    for (const row of cities) {
      console.log(`  - "${row.rndrng_prvdr_city}"`);
    }

    // Check 3: Try fuzzy search for "cardio"
    console.log("\n3. Providers with 'cardio' in type (case-insensitive):");
    const cardio = await executePhysicianQuery(
      "SELECT DISTINCT rndrng_prvdr_type FROM provider_services WHERE rndrng_prvdr_type LIKE ? LIMIT 10",
      ["%cardio%"]
    );
    console.log(`Found ${cardio.length} matches:`);
    for (const row of cardio) {
      console.log(`  - "${row.rndrng_prvdr_type}"`);
    }

    // Check 4: Try fuzzy search for "chicago"
    console.log("\n4. Cities with 'chicago' (case-insensitive):");
    const chicago = await executePhysicianQuery(
      "SELECT DISTINCT rndrng_prvdr_city FROM provider_services WHERE rndrng_prvdr_city LIKE ? LIMIT 10",
      ["%chicago%"]
    );
    console.log(`Found ${chicago.length} matches:`);
    for (const row of chicago) {
      console.log(`  - "${row.rndrng_prvdr_city}"`);
    }

    // Check 5: Sample of first 3 rows
    console.log("\n5. First 3 rows of data:");
    const sample = await executePhysicianQuery(
      "SELECT rndrng_prvdr_type, rndrng_prvdr_city, rndrng_prvdr_state_abrvtn FROM provider_services LIMIT 3"
    );
    console.table(sample);
  } catch (error) {
    console.error("Error:", error);
  }
}

checkDataFormat();
