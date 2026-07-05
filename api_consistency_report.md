# HandicapLab API Consistency Report

This report confirms compliance of API endpoints with the unified response envelope and error schemas.

---

## 1. Unified Response Shape

All endpoints conform to the following JSON structure:

```json
{
  "success": true,
  "request_id": "req_1719999999999_abcdef123",
  "predictions": [ ... ]
}
```

Or for nested payload formats:

```json
{
  "success": true,
  "request_id": "req_1719999999999_abcdef123",
  "data": {
    "count": 1,
    "fixtures": [ ... ]
  }
}
```

---

## 2. Standardized Error Payload

### Validation Failure (HTTP 422)
```json
{
  "success": false,
  "request_id": "req_1719999999999_abcdef123",
  "error": "Invalid query parameters",
  "validationErrors": {
    "limit": ["Number must be less than or equal to 100"]
  }
}
```

### Rate Limited (HTTP 429)
```json
{
  "success": false,
  "request_id": "req_1719999999999_abcdef123",
  "error": "Rate limit exceeded. Try again in a minute."
}
```

### Internal Error (HTTP 500)
```json
{
  "success": false,
  "request_id": "req_1719999999999_abcdef123",
  "error": "Database connection error message"
}
```
