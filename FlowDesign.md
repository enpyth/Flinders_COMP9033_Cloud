# 3 Node-RED Flow Design

## 3.1 Objective

This section is used to complete `T5: Design the Node-RED end-to-end workflow`.

Node-RED receives customer email data sent from the frontend, calls `OpenAI` for classification and urgency analysis, writes the result into `Azure SQL Database`, sends notification and acknowledgement emails through `Resend`, and finally returns the processed result to the frontend.

## 3.2 Overall Workflow

The recommended main Node-RED workflow is:

1. `HTTP In`
2. `JSON`
3. `Function: normalizeInput`
4. `HTTP Request: OpenAI`
5. `JSON`
6. `Function: detectUrgencyAndRoute`
7. `Function: buildDatabaseRecord`
8. `Azure SQL Database` insert node
9. `Function: buildEmailPayload`
10. `HTTP Request: Resend`
11. `Function: buildFrontendResponse`
12. `HTTP Response`

If you want to keep debugging capability, attach `Debug` nodes after these key points:

- after `normalizeInput`
- after the `OpenAI` response
- before database insertion
- before the `Resend` request

## 3.3 Recommended Flow Structure

### Flow A: Main API Flow

Path:

`HTTP In /api/support-email`  
-> `JSON`  
-> `normalizeInput`  
-> `prepareOpenAIRequest`  
-> `HTTP Request (OpenAI)`  
-> `JSON`  
-> `detectUrgencyAndRoute`  
-> `buildDatabaseRecord`  
-> `Azure SQL Insert`  
-> `buildEmailPayload`  
-> `HTTP Request (Resend)`  
-> `buildFrontendResponse`  
-> `HTTP Response`

### Flow B: Optional Debug Flow

Attach a `Debug` node next to each of the following:

- `normalizeInput`
- `detectUrgencyAndRoute`
- `buildDatabaseRecord`
- `buildEmailPayload`

This makes it much easier to capture screenshots for:

- input payload
- AI response
- database record object
- email notification object

## 3.4 Request Format Sent from Frontend to Node-RED

The frontend should send the following JSON to the `POST /api/support-email` endpoint:

```json
{
  "customerName": "Amelia Wong",
  "customerEmail": "amelia@example.com",
  "subject": "Order arrived damaged and I need a replacement",
  "message": "Hello support team, my package arrived with a broken screen..."
}
```

## 3.5 Expected OpenAI Response Structure

To make the rest of the workflow stable, OpenAI should return JSON only:

```json
{
  "category": "complaint",
  "urgency": "high",
  "summary": "Customer reports a damaged item and requests urgent replacement.",
  "recommended_action": "Escalate to support manager and prioritize replacement handling."
}
```

The category values should be limited to:

- `complaint`
- `enquiry`
- `feedback`

The urgency values should be limited to:

- `high`
- `normal`

## 3.6 Design of Three Function Nodes

These three function nodes can directly satisfy the assignment requirement for JavaScript function nodes.

### Function Node 1: normalizeInput

Purpose:

- validate frontend fields
- trim extra spaces
- normalize the payload structure
- generate an internal `messageId`
- add a timestamp

Suggested code:

```javascript
const body = msg.payload || {};

function requiredString(value) {
  return typeof value === "string" ? value.trim() : "";
}

const customerName = requiredString(body.customerName);
const customerEmail = requiredString(body.customerEmail);
const subject = requiredString(body.subject);
const message = requiredString(body.message);

if (!customerName || !customerEmail || !subject || !message) {
  msg.statusCode = 400;
  msg.payload = {
    success: false,
    error: "Missing required fields."
  };
  return [null, msg];
}

msg.payload = {
  messageId: "MSG-" + Date.now(),
  customerName,
  customerEmail,
  subject,
  message,
  createdAt: new Date().toISOString()
};

return [msg, null];
```

Notes:

- this function is recommended to use two outputs
- the first output goes to the normal flow
- the second output goes directly to `HTTP Response` for error handling

### Function Node 2: detectUrgencyAndRoute

Purpose:

- parse the OpenAI response
- add an extra layer of keyword rules
- produce an `urgent` flag
- decide the notification target

Suggested code:

```javascript
const original = msg.originalPayload;
const ai = msg.payload || {};

const category = ai.category || "enquiry";
const aiUrgency = ai.urgency || "normal";
const summary = ai.summary || "";
const recommendedAction = ai.recommended_action || "";

const text = `${original.subject} ${original.message}`.toLowerCase();
const keywordUrgent = /(urgent|asap|immediately|critical|tomorrow|broken|replacement)/.test(text);

const urgent = aiUrgency === "high" || keywordUrgent;
const assignedTeam = urgent ? "support_manager" : "support_team";

msg.payload = {
  ...original,
  category,
  urgency: urgent ? "high" : "normal",
  urgent,
  summary,
  recommendedAction,
  assignedTeam
};

return msg;
```

Usage:

- before the OpenAI request, store the original input in `msg.originalPayload`
- after OpenAI returns, pass the message into this function

### Function Node 3: buildFrontendResponse

Purpose:

- prepare the final response required by the frontend
- avoid exposing raw internal database or email service details

Suggested code:

```javascript
const data = msg.finalRecord || msg.payload;

msg.statusCode = 200;
msg.payload = {
  success: true,
  messageId: data.messageId,
  category: data.category,
  urgency: data.urgency,
  summary: data.summary,
  assignedTeam: data.assignedTeam,
  status: "stored_and_notified"
};

return msg;
```

## 3.7 Two Additional Recommended Helper Function Nodes

Although the assignment requires only three function nodes, two helper nodes are recommended to make the flow cleaner.

### Function: prepareOpenAIRequest

Purpose:

- store the original payload in `msg.originalPayload`
- build the OpenAI API request body

Suggested code:

```javascript
const data = msg.payload;

msg.originalPayload = data;
msg.headers = {
  "Content-Type": "application/json",
  "Authorization": "Bearer " + env.get("OPENAI_API_KEY")
};

msg.payload = {
  model: "gpt-4.1-mini",
  input: [
    {
      role: "system",
      content: [
        {
          type: "input_text",
          text: "You are a support email classifier. Return JSON only with category, urgency, summary, recommended_action. category must be complaint, enquiry, or feedback. urgency must be high or normal."
        }
      ]
    },
    {
      role: "user",
      content: [
        {
          type: "input_text",
          text: JSON.stringify({
            subject: data.subject,
            message: data.message
          })
        }
      ]
    }
  ]
};

return msg;
```

### Function: buildDatabaseRecord

Purpose:

- reshape the payload for database insertion
- make the input to the SQL node more structured

Suggested code:

```javascript
const data = msg.payload;

msg.finalRecord = {
  messageId: data.messageId,
  customerName: data.customerName,
  customerEmail: data.customerEmail,
  subject: data.subject,
  messageBody: data.message,
  category: data.category,
  urgency: data.urgency,
  aiSummary: data.summary,
  assignedTeam: data.assignedTeam,
  createdAt: data.createdAt,
  status: "new"
};

msg.payload = msg.finalRecord;
return msg;
```

## 3.8 OpenAI HTTP Request Node Configuration

Recommended settings:

- Method: `POST`
- URL: `https://api.openai.com/v1/responses`
- Return: parsed JSON string or object
- Headers:
  - `Content-Type: application/json`
  - `Authorization: Bearer <OPENAI_API_KEY>`

After OpenAI returns, you may need one extra parsing function node to extract the JSON cleanly if the returned structure is not directly placed in `msg.payload`.

## 3.9 Azure SQL Database Node Design

Suggested table name:

`support_emails`

Suggested fields:

- `message_id`
- `customer_name`
- `customer_email`
- `subject`
- `message_body`
- `category`
- `urgency`
- `ai_summary`
- `assigned_team`
- `created_at`
- `status`

Responsibilities at the Node-RED level:

- receive the object generated by `buildDatabaseRecord`
- execute the `INSERT`
- continue to the email notification flow after successful insertion

## 3.10 Resend Node Design

Two types of emails are recommended:

### Internal notification email

Send to:

- `support@yourdomain.com` or a team member test email

Content should include:

- message ID
- customer name
- subject
- category
- urgency
- AI summary

### Customer acknowledgement email

Send to:

- the submitted `customerEmail`

Content should include:

- acknowledgement of receipt
- short confirmation message
- message ID

## 3.11 Frontend Response Format

The JSON returned from Node-RED to the frontend should look like this:

```json
{
  "success": true,
  "messageId": "MSG-1710000000000",
  "category": "complaint",
  "urgency": "high",
  "summary": "Customer reports a damaged item and requests urgent replacement.",
  "assignedTeam": "support_manager",
  "status": "stored_and_notified"
}
```

## 3.12 Recommended Screenshot Points

For later testing and reporting, it is recommended to capture:

1. the full Node-RED workflow
2. the `normalizeInput` function node code
3. the OpenAI debug output
4. the object before database insertion
5. the email payload before the Resend request

## 3.13 Conclusion

At this point, `T5` is complete. The current Node-RED design now includes:

- a clear HTTP API entry point
- at least three JavaScript function nodes
- integration points for `OpenAI`, `Azure SQL Database`, and `Resend`
- a complete design foundation for the implementation of the following tasks
