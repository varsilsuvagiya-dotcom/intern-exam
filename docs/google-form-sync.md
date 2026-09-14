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

Published.

## 4. Apps Script — must be bound to the FORM, not the response Sheet
Open the Form itself → ⋮ menu → **Script editor**. This creates a script project
bound to the Form.

**Important:** a trigger installed on the response Sheet ("From spreadsheet -
On form submit") gives an event object with `namedValues` but **no
`response`** — `e.response.getId()` throws `Cannot read properties of
undefined`. A trigger installed on the Form ("From form - On form submit")
gives `e.response` (a `FormResponse`) but **no `namedValues`** — the two
event shapes are not interchangeable. Use the Form-bound trigger and read
answers via `e.response.getItemResponses()`.

**Script Properties** (Project Settings → Script Properties):
- `SYNC_SECRET` = same value as `.env`'s `GOOGLE_APPS_SCRIPT_SECRET`. Script
  Properties are per Apps Script project — a new Form-bound project starts
  with none, they don't carry over from an old Sheet-bound project.

**Code.gs**:
```js
function onFormSubmit(e) {
  if (!e || !e.response) {
    Logger.log("No event data — trigger via real form submit, not manual Run.");
    return;
  }

  const itemResponses = e.response.getItemResponses();
  const answers = {};
  itemResponses.forEach(function (itemResponse) {
    answers[itemResponse.getItem().getTitle()] = itemResponse.getResponse();
  });

  const payload = {
    google_form_response_id: e.response.getId(),
    name: answers["Full Name"],
    email: answers["Email Address"],
    mobile: answers["Mobile Number"],
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

**Trigger** installed on the Form-bound script: Triggers → Add Trigger →
function `onFormSubmit`, deployment `Head`, event source **From form**, event
type **On form submit**. Authorized.

If a trigger was previously added on the response Sheet's own
Extensions → Apps Script project, delete it — it will double-post a stale,
crashing copy on every submission otherwise.

## Remaining — once site is deployed
1. Replace `YOUR-DOMAIN` in Code.gs with the real domain, save.
2. Set `GOOGLE_APPS_SCRIPT_SECRET` env var on the deploy host.
3. Submit a test Form response.
4. Apps Script → Executions → confirm `201`/`200` in the Cloud logs for that run.
5. Confirm candidate appears in `/admin/candidates`.
