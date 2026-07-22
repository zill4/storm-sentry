# Google Form → Tarp Studio ingestion

Two tracks bring "Your Smart Tarp Design Form" (Google Forms) submissions into
the app's `design_requests` table, where they appear on `/admin` with a
**Google Form** badge (status `imported`):

- **Ongoing**: an Apps Script trigger on the form POSTs each new submission to
  `POST /api/ingest/google-form`.
- **Backfill**: `scripts/ingest-google-form-csv.mjs` replays the response
  sheet's CSV export through the same endpoint (same mapping, deduped).

Both are guarded by the `GOOGLE_FORM_WEBHOOK_SECRET` service variable — the
endpoint returns 401 until it's set. Responses are idempotent on
`googleFormResponseId`, so re-running either track never duplicates rows. The
full original payload lands in `design_requests.raw_payload` (including Google
Drive logo links, which the file-upload question produces).

## One-time Apps Script setup (ongoing track)

1. Open the form → three-dot menu → **Apps Script**.
2. Paste, filling in both constants:

```js
const ENDPOINT = "https://<your-deployment>/api/ingest/google-form"
const SECRET = "<GOOGLE_FORM_WEBHOOK_SECRET value>"

function onFormSubmit(e) {
  const payload = {
    responseId: e.response.getId(),
    submittedAt: e.response.getTimestamp().toISOString(),
    namedValues: {},
  }
  e.response.getItemResponses().forEach((ir) => {
    const v = ir.getResponse()
    payload.namedValues[ir.getItem().getTitle()] = Array.isArray(v) ? v : [String(v)]
  })
  // The email-collection answer isn't an item response; add it explicitly.
  const email = e.response.getRespondentEmail()
  if (email) payload.namedValues["Email"] = [email]

  UrlFetchApp.fetch(ENDPOINT, {
    method: "post",
    contentType: "application/json",
    headers: { "x-ingest-secret": SECRET },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  })
}
```

3. Left sidebar → **Triggers** → Add trigger: function `onFormSubmit`, event
   source **From form**, event type **On form submit**. Approve the OAuth
   prompt (it runs as you).

## Backfill (existing responses)

```bash
# 1. Responses sheet → File → Download → .csv
# 2. Replay it (point --base at production, or localhost for a dry run):
GOOGLE_FORM_WEBHOOK_SECRET=... node scripts/ingest-google-form-csv.mjs responses.csv --base https://<your-deployment>
```

## Mapping notes

- Question titles are matched by lowercased prefix (`src/lib/design/ingest.ts`),
  so cosmetic edits to the form's long titles don't break ingestion — but if a
  question is *renamed*, update the mapping.
- The 1-of-4 style answer is parsed from "Style 1"–"Style 4" (or the style
  names); QR intent from website/call/quote keywords.
- Logo uploads arrive as Drive URLs in `raw_payload` — the print team opens
  them from Drive. Imported requests have no in-app designs until the customer
  goes through the studio flow.
