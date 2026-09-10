# Google Form → Candidate Sync

Setup done so far, for reconnecting or redoing on another form.

## 1. Endpoint (already built)
`POST /api/integrations/candidates` — [route.ts](../app/api/integrations/candidates/route.ts)
Auth: `Authorization: Bearer <GOOGLE_APPS_SCRIPT_SECRET>`
Body: `{ google_form_response_id, name, email, mobile }`
Upserts on `google_form_response_id` — safe to retry, no duplicates.

## 2. Secret
`.env` → `GOOGLE_APPS_SCRIPT_SECRET` already set. Same value must be set on the deploy host's env vars once live.

## 3. Google Form
Created with 3 required short-answer questions, exact titles:
- `Full Name`
- `Email Address` (validation: Text → Email address)
- `Mobile Number` (validation: Text → Regex `^[6-9]\d{9}$`)

Published. Responses linked to a new Google Sheet (Responses tab → Sheets icon → Create).

## 4. Apps Script
Sheet → Extensions → Apps Script.

**Script Properties** (Project Settings → Script Properties):
- `SYNC_SECRET` = same value as `GOOGLE_APPS_SCRIPT_SECRET`

**Code.gs**:
```js
function onFormSubmit(e) {
  const row = e.namedValues;

  const payload = {
    google_form_response_id: e.response.getId(),
    name: row["Full Name"][0],
    email: row["Email Address"][0],
    mobile: row["Mobile Number"][0],
  };

  const secret = PropertiesService.getScriptProperties().getProperty("SYNC_SECRET");

  const response = UrlFetchApp.fetch("https://YOUR-DOMAIN/api/integrations/candidates", {
    method: "post",
    contentType: "application/json",
    headers: { Authorization: "Bearer " + secret },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  });

  Logger.log(response.getResponseCode() + " " + response.getContentText());
}
```

**Trigger** installed: Triggers → Add Trigger → function `onFormSubmit`, deployment `Head`, event source **From spreadsheet**, event type **On form submit**. Authorized.

## Remaining — once site is deployed
1. Replace `YOUR-DOMAIN` in Code.gs with the real domain, save.
2. Set `GOOGLE_APPS_SCRIPT_SECRET` env var on the deploy host.
3. Submit a test Form response.
4. Apps Script → Executions → confirm `201`/`200`.
5. Confirm candidate appears in `/admin/candidates`.
