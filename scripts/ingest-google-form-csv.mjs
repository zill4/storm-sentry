#!/usr/bin/env node
// Backfill existing Google Form responses from the linked response sheet.
//
// 1. In Google Sheets: File → Download → Comma Separated Values (.csv)
// 2. Run:
//      GOOGLE_FORM_WEBHOOK_SECRET=... node scripts/ingest-google-form-csv.mjs responses.csv \
//        [--base https://your-deployment]        (default http://localhost:8080)
//
// Each row is posted to /api/ingest/google-form using the sheet's header row
// as question titles, so the exact same mapping as the live webhook applies.
// Rows are deduped server-side by a synthesized response id (timestamp+email).

import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"

function parseCsv(text) {
  const rows = []
  let row = []
  let field = ""
  let inQuotes = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i++
        } else inQuotes = false
      } else field += c
    } else if (c === '"') {
      inQuotes = true
    } else if (c === ",") {
      row.push(field)
      field = ""
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++
      row.push(field)
      field = ""
      if (row.some((f) => f !== "")) rows.push(row)
      row = []
    } else field += c
  }
  row.push(field)
  if (row.some((f) => f !== "")) rows.push(row)
  return rows
}

const args = process.argv.slice(2)
const file = args.find((a) => !a.startsWith("--"))
const baseIdx = args.indexOf("--base")
const base = (baseIdx >= 0 ? args[baseIdx + 1] : null) ?? "http://localhost:8080"
const secret = process.env.GOOGLE_FORM_WEBHOOK_SECRET

if (!file || !secret) {
  console.error(
    "usage: GOOGLE_FORM_WEBHOOK_SECRET=... node scripts/ingest-google-form-csv.mjs <responses.csv> [--base <url>]",
  )
  process.exit(1)
}

const rows = parseCsv(readFileSync(file, "utf8"))
if (rows.length < 2) {
  console.error("CSV has no data rows")
  process.exit(1)
}
const header = rows[0]

let created = 0
let duplicates = 0
let failed = 0
for (const [i, row] of rows.slice(1).entries()) {
  const namedValues = {}
  header.forEach((title, col) => {
    const v = row[col]?.trim()
    if (title && v) namedValues[title] = [v]
  })
  const timestamp = namedValues["Timestamp"]?.[0] ?? ""
  const email = namedValues["Email"]?.[0] ?? namedValues["Email Address"]?.[0] ?? ""
  const responseId =
    "csv_" + createHash("sha256").update(`${timestamp}|${email}|${i}`).digest("hex").slice(0, 20)

  const res = await fetch(`${base}/api/ingest/google-form`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-ingest-secret": secret },
    body: JSON.stringify({
      responseId,
      submittedAt: timestamp ? new Date(timestamp).toISOString() : undefined,
      namedValues,
    }),
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) {
    failed++
    console.error(`row ${i + 2}: HTTP ${res.status}`, body.error ?? "")
  } else if (body.duplicate) duplicates++
  else created++
}
console.log(`done: ${created} imported, ${duplicates} duplicates skipped, ${failed} failed`)
