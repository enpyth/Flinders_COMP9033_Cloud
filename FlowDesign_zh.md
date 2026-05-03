# 3 Node-RED 流程设计

## 3.1 目标

本节用于完成 `T5: Design the Node-RED end-to-end workflow`。

Node-RED 负责接收前端页面发送的客户邮件数据，调用 `OpenAI` 完成分类与紧急程度分析，将结果写入 `Azure SQL Database`，再通过 `Resend` 发送通知邮件和确认邮件，最后将处理结果返回前端页面。

## 3.2 总体流程

推荐的 Node-RED 主流程如下：

1. `HTTP In`
2. `JSON`
3. `Function: normalizeInput`
4. `HTTP Request: OpenAI`
5. `JSON`
6. `Function: detectUrgencyAndRoute`
7. `Function: buildDatabaseRecord`
8. `Azure SQL Database` 写入节点
9. `Function: buildEmailPayload`
10. `HTTP Request: Resend`
11. `Function: buildFrontendResponse`
12. `HTTP Response`

如果你想保留调试能力，可以在关键节点后面加 `Debug` 节点：

- `normalizeInput` 后
- `OpenAI` 返回后
- 数据库写入前
- Resend 调用前

## 3.3 建议的 Flow 结构

### Flow A: Main API Flow

路径：

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

在以下节点旁边各接一个 `Debug`：

- `normalizeInput`
- `detectUrgencyAndRoute`
- `buildDatabaseRecord`
- `buildEmailPayload`

这样做的好处是截图时很容易展示：

- 输入 payload
- AI 返回结果
- 数据库存储对象
- 邮件通知对象

## 3.4 前端发送到 Node-RED 的请求格式

前端建议向 Node-RED 的 `POST /api/support-email` 发送以下 JSON：

```json
{
  "customerName": "Amelia Wong",
  "customerEmail": "amelia@example.com",
  "subject": "Order arrived damaged and I need a replacement",
  "message": "Hello support team, my package arrived with a broken screen..."
}
```

## 3.5 OpenAI 期望返回的结构

为了让后续流程稳定，建议要求 OpenAI 返回纯 JSON：

```json
{
  "category": "complaint",
  "urgency": "high",
  "summary": "Customer reports a damaged item and requests urgent replacement.",
  "recommended_action": "Escalate to support manager and prioritize replacement handling."
}
```

分类值固定为：

- `complaint`
- `enquiry`
- `feedback`

紧急值固定为：

- `high`
- `normal`

## 3.6 三个 Function Nodes 设计

以下三个函数节点可以直接作为作业要求中的 JavaScript function nodes。

### Function Node 1: normalizeInput

用途：

- 校验前端字段
- 去除前后空格
- 统一 payload 结构
- 生成内部 `messageId`
- 补上时间戳

建议代码：

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

说明：

- 这个函数建议使用两个输出口
- 第一个输出口给正常流程
- 第二个输出口直接去 `HTTP Response` 返回错误

### Function Node 2: detectUrgencyAndRoute

用途：

- 解析 OpenAI 返回结果
- 再加一层关键词规则
- 生成 `urgent` 标记
- 决定通知对象

建议代码：

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

使用方法：

- 在 OpenAI 请求之前，把原始输入挂在 `msg.originalPayload`
- OpenAI 返回后再进入此函数

### Function Node 3: buildFrontendResponse

用途：

- 整理前端需要的最终响应
- 不把数据库或邮件服务内部细节原样暴露给前端

建议代码：

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

## 3.7 另外两个建议的辅助 Function Nodes

虽然作业只要求至少三个 function nodes，但为了流程更清晰，建议再增加两个辅助函数。

### Function: prepareOpenAIRequest

用途：

- 保存原始 payload 到 `msg.originalPayload`
- 构造 OpenAI API 请求体

建议代码：

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

用途：

- 为数据库写入整理字段
- 让 SQL 节点输入更规整

建议代码：

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

## 3.8 OpenAI HTTP Request 节点配置

建议：

- Method: `POST`
- URL: `https://api.openai.com/v1/responses`
- Return: parsed JSON string 或 object
- Headers:
  - `Content-Type: application/json`
  - `Authorization: Bearer <OPENAI_API_KEY>`

OpenAI 返回后，你可能需要再加一个小函数提取文本或 JSON。如果返回结构中内容不直接位于 `msg.payload`，可在 `HTTP Request` 后面加一个解析函数节点。

## 3.9 Azure SQL Database 节点设计

建议表名：

`support_emails`

建议字段：

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

Node-RED 层面的职责：

- 接收 `buildDatabaseRecord` 生成的对象
- 执行 `INSERT`
- 成功后继续发通知

## 3.10 Resend 节点设计

建议发两类邮件：

### 内部通知邮件

发送给：

- `support@yourdomain.com` 或组员测试邮箱

内容包含：

- message ID
- customer name
- subject
- category
- urgency
- AI summary

### 客户确认邮件

发送给：

- 客户提交的 `customerEmail`

内容包含：

- 已收到邮件
- 简短确认说明
- message ID

## 3.11 前端响应格式

Node-RED 返回前端的 JSON 建议为：

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

## 3.12 推荐的截图点

为了后续 `T9` 和报告使用，建议截图以下内容：

1. Node-RED 总流程图
2. `normalizeInput` function node 代码
3. OpenAI 返回的 debug 输出
4. 数据库写入前的对象
5. Resend 请求前的邮件 payload

## 3.13 正常情况测试用例 Shell

以下测试用例用于验证系统在正常输入下的行为。  
默认假设你的 Node-RED endpoint 为：

```bash
http://localhost:1880/api/support-email
```

如果你的实际地址不同，把下面命令中的 URL 替换掉即可。

### Test Case 1: Urgent Complaint

预期结果：

- `category = complaint`
- `urgency = high`
- 路由到 `support_manager`

```bash
curl -X POST http://localhost:1880/api/support-email \
  -H "Content-Type: application/json" \
  -d '{
    "customerName": "Amelia Wong",
    "customerEmail": "amelia@example.com",
    "subject": "Order arrived damaged and I need a replacement",
    "message": "Hello support team, my package arrived this morning with a broken screen and cracked casing. I need a replacement urgently because this item is for a client presentation tomorrow. Please advise on the fastest solution."
  }'
```

### Test Case 2: Normal Complaint

预期结果：

- `category = complaint`
- `urgency = normal`
- 路由到 `support_team`

```bash
curl -X POST http://zhangsu1305.australiaeast.azurecontainer.io:1880/api/support-email \
  -H "Content-Type: application/json" \
  -d '{
    "customerName": "Marcus Hill",
    "customerEmail": "marcus@example.com",
    "subject": "Refund still not processed",
    "message": "Hi, I contacted support last week about a refund for a returned item, but I still have not received confirmation. This delay is frustrating and I need an update on the case."
  }'
```

### Test Case 3: Normal Enquiry

预期结果：

- `category = enquiry`
- `urgency = normal`
- 路由到 `support_team`

```bash
curl -X POST http://localhost:1880/api/support-email \
  -H "Content-Type: application/json" \
  -d '{
    "customerName": "Daniel Reed",
    "customerEmail": "daniel@example.com",
    "subject": "Can you confirm delivery time for my order?",
    "message": "Hi team, I placed an order yesterday and would like to know the expected delivery window. I also want to confirm whether I can update the shipping address before dispatch."
  }'
```

### Test Case 4: Normal Feedback

预期结果：

- `category = feedback`
- `urgency = normal`
- 路由到 `support_team`

```bash
curl -X POST http://localhost:1880/api/support-email \
  -H "Content-Type: application/json" \
  -d '{
    "customerName": "Priya Nair",
    "customerEmail": "priya@example.com",
    "subject": "Great support experience with your team",
    "message": "Hello, I just wanted to share some positive feedback. Your support staff resolved my issue quickly and the follow-up communication was great. Thanks for the excellent service."
  }'
```

### Test Case 5: Quick Batch Test

如果你想连续测试多个正常场景，可以把下面内容保存成 `test-normal-cases.sh` 再运行：

```bash
#!/bin/zsh

ENDPOINT="http://localhost:1880/api/support-email"

echo "=== Urgent Complaint ==="
curl -s -X POST "$ENDPOINT" \
  -H "Content-Type: application/json" \
  -d '{
    "customerName": "Amelia Wong",
    "customerEmail": "amelia@example.com",
    "subject": "Order arrived damaged and I need a replacement",
    "message": "Hello support team, my package arrived this morning with a broken screen and cracked casing. I need a replacement urgently because this item is for a client presentation tomorrow. Please advise on the fastest solution."
  }'
echo
echo

echo "=== Normal Complaint ==="
curl -s -X POST "$ENDPOINT" \
  -H "Content-Type: application/json" \
  -d '{
    "customerName": "Marcus Hill",
    "customerEmail": "marcus@example.com",
    "subject": "Refund still not processed",
    "message": "Hi, I contacted support last week about a refund for a returned item, but I still have not received confirmation. This delay is frustrating and I need an update on the case."
  }'
echo
echo

echo "=== Normal Enquiry ==="
curl -s -X POST "$ENDPOINT" \
  -H "Content-Type: application/json" \
  -d '{
    "customerName": "Daniel Reed",
    "customerEmail": "daniel@example.com",
    "subject": "Can you confirm delivery time for my order?",
    "message": "Hi team, I placed an order yesterday and would like to know the expected delivery window. I also want to confirm whether I can update the shipping address before dispatch."
  }'
echo
echo

echo "=== Normal Feedback ==="
curl -s -X POST "$ENDPOINT" \
  -H "Content-Type: application/json" \
  -d '{
    "customerName": "Priya Nair",
    "customerEmail": "priya@example.com",
    "subject": "Great support experience with your team",
    "message": "Hello, I just wanted to share some positive feedback. Your support staff resolved my issue quickly and the follow-up communication was great. Thanks for the excellent service."
  }'
echo
```

运行方式：

```bash
chmod +x test-normal-cases.sh
./test-normal-cases.sh
```

### 正常返回示例

如果流程成功，前端或 `curl` 预期看到类似返回：

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

## 3.14 结论

至此，`T5` 已完成。当前 Node-RED 设计已经具备：

- 一个明确的 HTTP API 入口
- 至少三个 JavaScript function nodes
- 与 `OpenAI`、`Azure SQL Database`、`Resend` 的集成位置
- 可直接用于后续 `T6`、`T7`、`T8` 的实施基础
