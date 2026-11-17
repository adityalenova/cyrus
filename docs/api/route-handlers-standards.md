# Route Handlers API Standards

## Response Envelopes
Successful responses:
```json
{ "data": { ... }, "success": true }
```
Error responses:
```json
{ "error": "Descriptive error message", "success": false, "code": "ERR_NOT_FOUND" }
```

## HTTP Status Codes
- `200 OK`: Standard successful response.
- `400 Bad Request`: Validation failure via Zod.
- `401 Unauthorized`: Missing or invalid session cookie.
- `429 Too Many Requests`: Rate limit reached.
