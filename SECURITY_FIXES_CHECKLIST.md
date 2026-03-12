# Security Fixes & Improvements Checklist

## 🔴 Critical Security Issues

### [ ] 1. Fix Hardcoded Secrets & Weak Defaults
- **File**: `backend/app/config.py`
- **Issue**: Default `SECRET_KEY` and `ENCRYPTION_KEY` values are publicly visible
- **Fix**: 
  - Remove default values, require them from environment
  - Add validation to ensure keys meet minimum entropy requirements
  - Fail fast on startup if keys are not properly configured in production

### [ ] 2. Fix Overly Permissive CORS
- **File**: `backend/app/main.py`
- **Issue**: CORS allows `allow_origin_regex=".*"` - any origin can make API requests
- **Fix**:
  - Remove the regex wildcard
  - Use specific allowed origins list from config
  - Add `ALLOWED_ORIGINS` in config.py

### [ ] 3. Implement OAuth State Validation (CSRF Protection)
- **File**: `backend/app/api/auth.py`
- **Issue**: OAuth `state` parameter is just the provider name - vulnerable to CSRF
- **Fix**:
  - Generate random CSRF token before redirect
  - Store token in session or return to client
  - Validate state parameter on callback

### [ ] 4. Token Invalidation on Password Reset
- **File**: `backend/app/api/auth.py`
- **Issue**: JWT tokens remain valid after password reset
- **Fix**:
  - Add `password_changed_at` timestamp to user model
  - Include `password_version` claim in JWT
  - Invalidate all tokens when password changes

### [ ] 5. Implement Refresh Token Rotation
- **File**: `backend/app/api/auth.py`
- **Issue**: Only access_token is returned
- **Fix**:
  - Implement refresh token endpoint
  - Implement token rotation (invalidate old refresh token on use)
  - Store refresh tokens in database with expiration

---

## 🟠 Bugs & Logic Issues

### [ ] 6. Fix Scheduler Argument Bug
- **File**: `backend/app/scheduler.py`
- **Issue**: Line 68 passes extra `db` argument that function doesn't accept
- **Fix**:
  ```python
  # Before:
  asyncio.create_task(run_scheduled_skill(config, db))
  # After:
  asyncio.create_task(run_scheduled_skill(config))
  ```

### [ ] 7. Fix Admin Block Mechanism
- **File**: `backend/app/api/admin.py` + `backend/app/models/user.py`
- **Issue**: Blocking toggles `email_verified` which is semantically wrong
- **Fix**:
  - Add `is_blocked` Boolean column to User model
  - Update block endpoint to use new field
  - Update auth to check `is_blocked` on login

### [ ] 8. Fix Encryption Key Derivation
- **File**: `backend/app/utils/encryption.py`
- **Issue**: Key padding with null bytes creates weak encryption
- **Fix**:
  - Use proper key derivation (PBKDF2 or HKDF)
  - Or generate and store Fernet key in secure config

### [ ] 9. Add Rate Limiting to Sensitive Endpoints
- **Files**: `backend/app/api/auth.py`
- **Issue**: Password reset and OAuth endpoints lack rate limiting
- **Fix**:
  - Add rate limits to `/forgot-password`, `/reset-password`, `/oauth/*`

### [ ] 10. Fix OAuth User Subscription Creation
- **File**: `backend/app/api/auth.py`
- **Issue**: Subscription creation in OAuth callback lacks error handling
- **Fix**:
  - Wrap subscription creation in try/catch
  - Rollback on failure

---

## 🟡 Code Quality & Improvements

### [ ] 11. Move Token Storage from LocalStorage to httpOnly Cookies
- **File**: `frontend/src/lib/api.ts`
- **Issue**: Tokens in localStorage are vulnerable to XSS
- **Fix**:
  - Store tokens in httpOnly, secure cookies
  - Update API client to use credentials: 'include'

### [ ] 12. Remove Debug Print Statements
- **File**: `backend/app/api/auth.py`
- **Issue**: Lines 234-235, 249 contain debug prints leaking credentials
- **Fix**:
  - Remove all print() statements
  - Use proper logging with sanitization

### [ ] 13. Add Input Validation for Agent Tools
- **File**: `backend/app/api/agents.py`
- **Issue**: `tool_configs` accepts any dict without validation
- **Fix**:
  - Add Pydantic validation schemas for tool configs
  - Validate tool names against allowed list

### [ ] 14. Add Pagination to Usage Endpoint
- **File**: `backend/app/api/admin.py`
- **Issue**: `/usage` endpoint returns 100 users without pagination
- **Fix**:
  - Add `limit` and `offset` query params
  - Return total count

### [ ] 15. Fix Logging of PII
- **File**: `backend/app/scheduler.py`
- **Issue**: Logs user emails directly (GDPR concern)
- **Fix**:
  - Log user ID instead of email
  - Use structured logging

### [ ] 16. Add Database Indexes
- **Files**: `backend/app/models/*.py`
- **Issue**: Missing indexes on frequently queried columns
- **Fix**:
  - Add index on `user_id` in execution logs
  - Add index on `email` where not already present

### [ ] 17. Add Cleanup for Expired Reset Tokens
- **File**: `backend/app/scheduler.py` (or new task)
- **Issue**: Expired reset tokens remain in database
- **Fix**:
  - Add scheduled task to clean expired tokens

### [ ] 18. Implement Proper Error Messages for OAuth
- **File**: `backend/app/api/auth.py`
- **Issue**: Generic error when email missing from OAuth
- **Fix**:
  - Provide specific guidance to users
  - Handle cases where OAuth provider doesn't return email

### [ ] 19. Add Loading States to Frontend
- **File**: `frontend/src/lib/api.ts`
- **Issue**: No global loading state management
- **Fix**:
  - Add axios interceptors for loading states
  - Create useLoading hook

### [ ] 20. Verify Workflow Limit on Execution
- **File**: `backend/app/api/workflows.py` (or related)
- **Issue**: Need to verify workflow execution respects limits
- **Fix**:
  - Add check for `workflow_limit` and `monthly_run_limit`
  - Return appropriate error when limit reached

---

## Priority Order

### Phase 1: Critical Security (Do First)
1. Fix hardcoded secrets
2. Fix CORS
3. Fix OAuth CSRF
4. Fix token invalidation
5. Fix scheduler bug

### Phase 2: Bug Fixes (Do Second)
6. Fix admin block mechanism
7. Fix encryption key derivation
8. Add rate limiting
9. Fix OAuth subscription handling

### Phase 3: Code Quality (Do Third)
10. Move to httpOnly cookies
11. Remove debug prints
12. Add input validation
13. Add pagination
14. Fix PII logging

### Phase 4: Polish (Do Last)
15. Add database indexes
16. Add cleanup tasks
17. Improve error messages
18. Add loading states
19. Verify workflow limits

---

*Created: 2026-03-12*
*Branch: dev_cto*
