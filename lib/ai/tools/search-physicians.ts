import { tool } from "ai";
import { z } from "zod";
import { executePhysicianQuery } from "@/lib/db/mysql";

// tool for searching physicians in the MySQL database
export const searchPhysicians = tool({
  description: `Search for healthcare providers (doctors) in the physician database. 
    Use this when the user asks to find doctors, specialists, or medical providers.
    Available fields: Rndrng_Prvdr_Type (specialty), Rndrng_Prvdr_City (city), 
    Rndrng_Prvdr_State_Abrvtn (state), HCPCS_Desc (procedures/services).`,

  inputSchema: z.object({
    specialty: z
      .string()
      .optional()
      .describe('Medical specialty (e.g., "Cardiologist")'),
    city: z.string().optional().describe("City name"),
    state: z.string().optional().describe('State abbreviation (e.g., "IL")'),
    procedure: z.string().optional().describe("Medical procedure or service"),
    limit: z.number().default(5).describe("Max number of results"),
  }),

  execute: async ({ specialty, city, state, procedure, limit = 5 }) => {
    const startTime = Date.now();
    console.log(
      `\n[${new Date().toISOString()}] === PHYSICIAN SEARCH START ===`
    );

    try {
      // Build the WHERE clause dynamically
      const conditions: string[] = [];
      const params: any[] = [];

      // IMPORTANT: Add state filter FIRST for performance on large datasets
      // On 9.6M rows, filtering by state first reduces search space significantly

      // Add state condition first (most selective, likely indexed)
      if (state) {
        conditions.push("rndrng_prvdr_state_abrvtn = ?");
        params.push(state.toUpperCase());
      }

      // Then add specialty filter with normalization
      if (specialty) {
        // Normalize common variations: "Cardiologist" -> "Cardiology"
        // Handle common -ist to -logy conversions
        if (specialty.toLowerCase().endsWith("ist")) {
          // Try both the original and the -logy version
          const baseWord = specialty.slice(0, -3); // Remove "ist"
          conditions.push(
            "(rndrng_prvdr_type LIKE ? OR rndrng_prvdr_type LIKE ?)"
          );
          params.push(`%${specialty}%`);
          params.push(`%${baseWord}y%`);
        } else {
          conditions.push("rndrng_prvdr_type LIKE ?");
          params.push(`%${specialty}%`);
        }
      }

      if (city) {
        conditions.push("rndrng_prvdr_city LIKE ?");
        params.push(`%${city}%`);
      }

      if (procedure) {
        conditions.push("hcpcs_desc LIKE ?");
        params.push(`%${procedure}%`);
      }

      // If no filters provided, this query will be VERY slow - add a default limit
      const whereClause =
        conditions.length > 0
          ? `WHERE ${conditions.join(" AND ")}`
          : "WHERE 1=1";

      // Remove DISTINCT for performance - on 9.6M rows it's very expensive
      // Group by NPI at application level if needed
      const query = `
        SELECT
          rndrng_prvdr_first_name,
          rndrng_prvdr_last_org_name,
          rndrng_prvdr_crdntls,
          rndrng_prvdr_st1,
          rndrng_prvdr_city,
          rndrng_prvdr_state_abrvtn,
          rndrng_prvdr_zip5,
          rndrng_prvdr_type,
          hcpcs_desc,
          rndrng_npi
        FROM provider_services
        ${whereClause}
        LIMIT ?
      `;

      // Ensure limit is always a valid number
      const finalLimit = Number(limit) || 5;
      params.push(finalLimit);

      const queryBuildTime = Date.now() - startTime;
      console.log(`[TIMING] Query built in ${queryBuildTime}ms`);
      console.log("[PARAMS] Search criteria:", {
        specialty,
        city,
        state,
        procedure,
        limit: finalLimit,
      });
      console.log("[SQL] Generated query:", query.trim());
      console.log("[SQL] Params:", params);

      const dbStartTime = Date.now();
      console.log(`[DB] Executing query at ${new Date().toISOString()}...`);

      const results = await executePhysicianQuery(query.trim(), params);

      const dbEndTime = Date.now();
      const dbDuration = dbEndTime - dbStartTime;
      console.log(`[TIMING] Database query took ${dbDuration}ms`);
      console.log(`[RESULTS] Found ${results.length} rows`);

      if (results.length > 0) {
        console.log(
          "[RESULTS] Sample first result:",
          JSON.stringify(results[0], null, 2)
        );
      } else {
        console.log("[RESULTS] No results returned - checking why...");

        // Run diagnostic queries to understand why
        console.log("\n[DIAGNOSTIC] Running test queries...");

        // Test 1: Does the table have ANY data?
        const totalCount = await executePhysicianQuery(
          "SELECT COUNT(*) as total FROM provider_services LIMIT 1"
        );
        console.log(
          `[DIAGNOSTIC] Total rows in table: ${totalCount[0]?.total || 0}`
        );

        // Test 2: What specialties exist (if searching by specialty)?
        if (specialty) {
          const specialtyTest = await executePhysicianQuery(
            "SELECT DISTINCT rndrng_prvdr_type FROM provider_services WHERE LOWER(rndrng_prvdr_type) LIKE LOWER(?) LIMIT 5",
            [`%${specialty}%`]
          );
          console.log(
            `[DIAGNOSTIC] Specialties matching "${specialty}":`,
            specialtyTest
          );
        }

        // Test 3: What cities exist (if searching by city)?
        if (city) {
          const cityTest = await executePhysicianQuery(
            "SELECT DISTINCT rndrng_prvdr_city FROM provider_services WHERE LOWER(rndrng_prvdr_city) LIKE LOWER(?) LIMIT 5",
            [`%${city}%`]
          );
          console.log(`[DIAGNOSTIC] Cities matching "${city}":`, cityTest);
        }
      }

      // Safety break: No results found - provide helpful suggestions
      if (results.length === 0) {
        let suggestion = "No physicians found matching your criteria. ";

        if (city && state) {
          suggestion += `Try searching in all of ${state} instead of just ${city}.`;
        } else if (procedure) {
          suggestion += `Try searching by specialty instead of the specific procedure "${procedure}".`;
        } else {
          suggestion += "Try broadening your search criteria.";
        }

        return {
          physicians: [],
          count: 0,
          message: suggestion,
        };
      }

      const totalTime = Date.now() - startTime;
      console.log(`[TIMING] Total search time: ${totalTime}ms`);
      console.log(
        `[${new Date().toISOString()}] === PHYSICIAN SEARCH END ===\n`
      );

      return {
        physicians: results,
        count: results.length,
        message: `Found ${results.length} physician(s) matching your criteria.`,
      };
    } catch (error) {
      const totalTime = Date.now() - startTime;
      console.error(`[ERROR] Search failed after ${totalTime}ms:`, error);
      return {
        physicians: [],
        count: 0,
        message: "An error occurred while searching. Please try again.",
        error: true,
      };
    }
  },
});
