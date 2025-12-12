RAG Chatbot System for Doctor Search

### 1\. Introduction & Goal

This document outlines the **Prompt Engineering, System Design, and Architecture Best Practices** for the **Doctor Search App** RAG (Retrieval-Augmented Generation) pipeline. The primary goal is to create a robust and intelligent system that translates a patient's natural language query into a precise search query against the provided MySQL provider database, using Gemini as the LLM orchestrator.

### 2\. Prompt Engineering: Best Practices for Gemini

The core of the RAG pipeline is the LLM's ability to interpret user intent and convert it into a structured database query. The following prompts are designed for high accuracy and minimal hallucination.

#### 2.1. System Persona Prompt (Mandatory)

This prompt sets the stage for the LLM's behavior and constraints.

> You are an **Expert Healthcare Search Query Generator and Validator**. Your sole function is to process natural language requests for healthcare provider searches and translate them into a structured, executable SQL query (for the RAG pipeline) or clearly state if more information is needed.
>
> **CRITICAL CONSTRAINTS:**
>
> 1.  **NEVER** generate a response that is not a JSON object containing the `sql_query` or the `clarification_needed` field.
> 2.  **DO NOT** generate a final answer to the user. Your output is a query or a request for clarification, **only**.
> 3.  **Strictly** use the provided database variables (column names) and structure. **DO NOT** invent column names.
> 4.  The final SQL query must be compatible with **MySQL**.
>
> **Database Context & Schema:**
>
>   * **Primary Tables:** `provider_services`, `providers`
>   * **Key Fields:**
>       * `Rndrng_Prvdr_Type`: Provider specialty (e.g., 'Cardiologist').
>       * `Rndrng_Prvdr_City`, `Rndrng_Prvdr_State_Abrvtn`, `Rndrng_Prvdr_Zip5`: Location filters.
>       * `HCPCS_Cd`, `HCPCS_Desc`: Procedure/Service performed.
>       * `Bene_Avg_Age`: Average age of patients treated.
>       * `Bene_CC_[condition]_Pct`: Percentage of patients with a specific chronic condition (e.g., `Bene_CC_Diabetes_Pct`).
>       * `Rndrng_NPI`: Primary key for joining.
>
> **Output Format:**
> Always return a single JSON object.

#### 2.2. Query Generation Prompt (Tool Use)

This prompt is sent to the LLM with the user's input. The LLM must choose to generate a query OR ask for clarification.

**Input:** User Query: "I need a cardiologist who can do an ultrasound near downtown Chicago."

**LLM Prompt (to be appended to the System Persona):**

> **Task:** Analyze the user's request and perform one of the following actions:
>
> **Action A: Generate SQL Query**
> If the request is clear and all required parameters (specialty, location, procedure/condition) can be definitively mapped to the schema, generate a MySQL SELECT query.
>
>   * **SELECT:** You must select all relevant columns for the final answer: `Rndrng_Prvdr_Last_Org_Name`, `Rndrng_Prvdr_First_Name`, `Rndrng_Prvdr_Crdntls`, `Rndrng_Prvdr_St1`, `Rndrng_Prvdr_City`, `Rndrng_Prvdr_State_Abrvtn`, `HCPCS_Desc`, `Rndrng_NPI`.
>   * **JOIN:** Use an `INNER JOIN` on `Rndrng_NPI` if information is needed from both tables (e.g., specialty/procedure + patient demographics/conditions).
>   * **WHERE:** Convert the natural language constraints into correct SQL WHERE clauses (e.g., `Rndrng_Prvdr_Type LIKE '%Cardiologist%'`). Use proximity terms like "near" to search against `City` or `Zip5`.
>   * **ORDER BY:** Sort results to prioritize relevance (e.g., by matching `HCPCS_Desc` or high `Tot_Benes` for volume).
>
> **Action B: Request Clarification (Safety Break)**
> If the request is ambiguous (e.g., "I need a doctor for my hip") or critical information is missing (e.g., location, procedure, or specific specialty), set `clarification_needed` to `true` and provide a concise, single question to the user.
>
> **Example Output (Action A - SQL):**
>
> ```json
> {
>   "sql_query": "SELECT T1.Rndrng_Prvdr_First_Name, T1.Rndrng_Prvdr_Last_Org_Name, T1.Rndrng_Prvdr_Crdntls, T1.Rndrng_Prvdr_St1, T1.Rndrng_Prvdr_City, T1.Rndrng_Prvdr_State_Abrvtn, T1.HCPCS_Desc FROM provider_services T1 WHERE T1.Rndrng_Prvdr_Type LIKE '%Cardiologist%' AND T1.Rndrng_Prvdr_City LIKE '%Chicago%' AND T1.HCPCS_Desc LIKE '%echocardiogram%' LIMIT 5;"
> }
> ```
>
> **Example Output (Action B - Clarification):**
>
> ```json
> {
>   "clarification_needed": true,
>   "question": "What kind of specialist are you looking for, or what is the specific medical procedure you require?"
> }
> ```

### 3\. System Architecture & RAG Pipeline

The overall architecture follows a standard RAG pattern, integrating the frontend, backend service, and database.

#### 3.1. Pipeline Steps

| Step | Component | Description | Best Practices |
| :--- | :--- | :--- | :--- |
| **1. User Input** | Frontend/UI | Patient submits a natural language query. | Ensure intuitive input, error state handling, and clear waiting state. |
| **2. LLM Orchestration** | Backend API (Controller) | Sends the user query + System/Query Prompts to Gemini. | Use a lightweight, high-performance web server (e.g., Python FastAPI/Node.js Express). |
| **3. Query/Safety Parser** | LLM (Gemini) | Interprets the query and returns a JSON object. | **Crucial Step:** Strict adherence to the JSON output format and safety breaks (Section 2). |
| **4. Safety Break Check** | Backend API (Service Layer) | Checks the JSON output for `clarification_needed: true`. | **Safety:** If true, return the `question` to the frontend and halt the pipeline. |
| **5. Database Retrieval** | Backend API (Service Layer) | Executes the generated `sql_query` against the MySQL database. | **Performance:** Use database indexing on key columns (`Rndrng_NPI`, `Rndrng_Prvdr_Type`, `Rndrng_Prvdr_City`). Implement connection pooling. |
| **6. Context Formatting** | Backend API (Service Layer) | Formats the raw SQL results into a coherent context block for the final LLM call. | Combine relevant fields for each provider into a single, dense string (e.g., "Dr. Chen, Cardiologist, Boston, MA, treats 45% diabetes patients..."). |
| **7. Final Answer Synthesis** | LLM (Gemini) | Receives the **Original User Query** + **Formatted Database Context**. | **Synthesis Prompt:** Instruct the LLM to write a concise, human-readable summary, mimicking the desired output format from the requirements. |
| **8. Final Output** | Backend API (Controller) | Returns the synthesized, user-friendly response to the frontend. | |

### 4\. Database Interaction & Optimization

The database is large. Query optimization is paramount for a good user experience.

  * **Thoughtful Joins:** Only join the two datasets (`provider_services`, `providers`) when demographic/condition data (e.g., `Bene_CC_Diabetes_Pct`) is explicitly requested. Otherwise, query a single table for speed.
  * **Indexing Strategy:** Ensure indexes exist on:
      * `Rndrng_NPI` (for joins)
      * `Rndrng_Prvdr_Type`
      * `Rndrng_Prvdr_City`
      * `HCPCS_Desc` (if possible, use full-text search)
  * **LIMIT Clause:** **Always** include a `LIMIT 5` or similar clause in the generated SQL query to prevent fetching millions of records and to improve query latency.

### 5\. Safety Breaks and Error Handling

The system must be resilient and helpful when it encounters ambiguity.

#### 5.1. LLM-Based Safety Break

As detailed in Section 2.2, if the LLM cannot confidently map the user request to the schema, it must trigger a `clarification_needed` output.

#### 5.2. Post-Retrieval Safety Break (No Results)

If the generated SQL query returns **zero results**, the backend should trigger a friendly "No Results Found" message, and then initiate a **second-pass LLM prompt** to suggest a modification to the user's query.

  * **Second-Pass Prompt:**
    > **Task:** The previous search query based on the user's request returned zero results. Suggest one concrete way to broaden or adjust the user's original request to increase the chance of finding a provider (e.g., remove the city filter, or change the procedure to a broader one).
    > **Output:** A concise suggestion for the user. (e.g., "I couldn't find a Cardiologist who performs **echocardiograms** in **Chicago**. Would you like to search for a Cardiologist in the entire **Illinois** area instead?")


    ERRORS:
     GET /api/vote?chatId=bb41ae62-63af-42cc-a8ed-bcee85c72768 200 in 149ms (compile: 1713µs, proxy.ts: 4ms, render: 144ms)
Executing physician search: {
  specialty: 'Cardiologist',
  city: 'Chicago',
  state: undefined,
  procedure: undefined,
  limit: 5
}
Generated query: SELECT DISTINCT
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
        WHERE rndrng_prvdr_type LIKE ? AND rndrng_prvdr_city LIKE ?
        LIMIT ?
Query params: [ '%Cardiologist%', '%Chicago%', 5 ]
Params length: 3
=== DEBUG TEST ===
Test query: SELECT * FROM provider_services LIMIT ?
Test params: [ 3 ]
Test query ? count: 1
Test params length: 1
MySQL query error: Error: Incorrect arguments to mysqld_stmt_execute
    at executePhysicianQuery (lib/db/mysql.ts:38:20)
    at Object.execute (lib/ai/tools/search-physicians.ts:93:50)
    at executeTool.next (<anonymous>)
  36 |     // Use execute for prepared statements with params, query without params
  37 |     const [rows] = params && params.length > 0
> 38 |       ? await pool.execute(query, params)
     |                    ^
  39 |       : await pool.query(query);
  40 |     return rows as any[];
  41 |   } catch (error) { {
  code: 'ER_WRONG_ARGUMENTS',
  errno: 1210,
  sql: 'SELECT DISTINCT\n' +
    '          rndrng_prvdr_first_name,\n' +
    '          rndrng_prvdr_last_org_name,\n' +
    '          rndrng_prvdr_crdntls,\n' +
    '          rndrng_prvdr_st1,\n' +
    '          rndrng_prvdr_city,\n' +
    '          rndrng_prvdr_state_abrvtn,\n' +
    '          rndrng_prvdr_zip5,\n' +
    '          rndrng_prvdr_type,\n' +
    '          hcpcs_desc,\n' +
    '          rndrng_npi\n' +
    '        FROM provider_services\n' +
    '        WHERE rndrng_prvdr_type LIKE ? AND rndrng_prvdr_city LIKE ?\n' +
    '        LIMIT ?',
  sqlState: 'HY000',
  sqlMessage: 'Incorrect arguments to mysqld_stmt_execute'
}
Query was: SELECT DISTINCT
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
        WHERE rndrng_prvdr_type LIKE ? AND rndrng_prvdr_city LIKE ?
        LIMIT ?
Params were: [ '%Cardiologist%', '%Chicago%', 5 ]
Physician search error: Error: Incorrect arguments to mysqld_stmt_execute
    at executePhysicianQuery (lib/db/mysql.ts:38:20)
    at Object.execute (lib/ai/tools/search-physicians.ts:93:50)
    at executeTool.next (<anonymous>)
  36 |     // Use execute for prepared statements with params, query without params
  37 |     const [rows] = params && params.length > 0
> 38 |       ? await pool.execute(query, params)
     |                    ^
  39 |       : await pool.query(query);
  40 |     return rows as any[];
  41 |   } catch (error) { {
  code: 'ER_WRONG_ARGUMENTS',
  errno: 1210,
  sql: 'SELECT DISTINCT\n' +
    '          rndrng_prvdr_first_name,\n' +
    '          rndrng_prvdr_last_org_name,\n' +
    '          rndrng_prvdr_crdntls,\n' +
    '          rndrng_prvdr_st1,\n' +
    '          rndrng_prvdr_city,\n' +
    '          rndrng_prvdr_state_abrvtn,\n' +
    '          rndrng_prvdr_zip5,\n' +
    '          rndrng_prvdr_type,\n' +
    '          hcpcs_desc,\n' +
    '          rndrng_npi\n' +
    '        FROM provider_services\n' +
    '        WHERE rndrng_prvdr_type LIKE ? AND rndrng_prvdr_city LIKE ?\n' +
    '        LIMIT ?',
  sqlState: 'HY000',
  sqlMessage: 'Incorrect arguments to mysqld_stmt_execute'

  DEBUG-LOGS:
CHAT INPUT: I am looking for a cardiologist who can do an ultrasound in Bridgewater, NJ
  [2025-12-12T06:03:15.067Z] === PHYSICIAN SEARCH START ===
[TIMING] Query built in 1ms
[PARAMS] Search criteria: {
  specialty: 'Cardiologist',
  city: undefined,
  state: 'NJ',
  procedure: 'ultrasound',
  limit: 5
}
[SQL] Generated query: SELECT DISTINCT
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
        WHERE LOWER(rndrng_prvdr_type) LIKE LOWER(?) AND UPPER(rndrng_prvdr_state_abrvtn) = UPPER(?) AND LOWER(hcpcs_desc) LIKE LOWER(?)
        LIMIT ?
[SQL] Params: [ '%Cardiologist%', 'NJ', '%ultrasound%', 5 ]
[DB] Executing query at 2025-12-12T06:03:15.069Z...
 GET /api/auth/session 200 in 33ms (compile: 16ms, proxy.ts: 11ms, render: 6ms)
 GET /api/auth/session 200 in 7ms (compile: 1818µs, proxy.ts: 1658µs, render: 3ms)
 GET /api/history?limit=20 200 in 109ms (compile: 6ms, proxy.ts: 11ms, render: 92ms)
 GET /api/vote?chatId=b7cd792b-2381-4522-b9c0-b4fb8027c8ec 200 in 170ms (compile: 6ms, proxy.ts: 9ms, render: 155ms)
[TIMING] Database query took 49479ms
[RESULTS] Found 0 rows
[RESULTS] No results returned - checking why...

[DIAGNOSTIC] Running test queries...
[DIAGNOSTIC] Total rows in table: 9660647

Data Format:

=== Checking Data Format ===

1. Sample provider types (specialties):
  - "Hospitalist"
  - "Pathology"
  - "Anesthesiology"
  - "Obstetrics & Gynecology"
  - "General Surgery"
  - "Internal Medicine"
  - "Urology"
  - "Cardiac Surgery"
  - "Nurse Practitioner"
  - "Physician Assistant"
  - "Licensed Clinical Social Worker"
  - "Physical Therapist in Private Practice"
  - "Family Practice"
  - "Cardiology"
  - "Optometry"
  - "Mass Immunizer Roster Biller"
  - "Pain Management"
  - "Physical Medicine and Rehabilitation"
  - "Radiation Oncology"
  - "Clinic or Group Practice"

2. Sample cities:
  - "Bethesda"
  - "Evanston"
  - "Toledo"
  - "Cleveland"
  - "Aurora"
  - "Quakertown"
  - "Tulsa"
  - "Los Angeles"
  - "Mount Vernon"
  - "Fort Myers"
  - "Houston"
  - "Saint Paul"
  - "Denver"
  - "Louisville"
  - "Hartsville"
  - "Henderson"
  - "Danville"
  - "Evans"
  - "Kyle"
  - "Maryville"

3. Providers with 'cardio' in type (case-insensitive):
Found 3 matches:
  - "Cardiology"
  - "Interventional Cardiology"
  - "Advanced Heart Failure and Transplant Cardiology"

4. Cities with 'chicago' (case-insensitive):
Found 8 matches:
  - "Chicago"
  - "Chicago Heights"
  - "North Chicago"
  - "East Chicago"
  - "South Chicago Heights"
  - "Chicago Ridge"
  - "West Chicago"
  - "Chicago Hts"

5. First 3 rows of data:
┌─────────┬───────────────────┬───────────────────┬───────────────────────────┐
│ (index) │ rndrng_prvdr_type │ rndrng_prvdr_city │ rndrng_prvdr_state_abrvtn │
├─────────┼───────────────────┼───────────────────┼───────────────────────────┤
│ 0       │ 'Hospitalist'     │ 'Bethesda'        │ 'MD'                      │
│ 1       │ 'Hospitalist'     │ 'Bethesda'        │ 'MD'                      │
│ 2       │ 'Hospitalist'     │ 'Bethesda'        │ 'MD'                      │