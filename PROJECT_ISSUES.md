# Electronic Regulation System - Project Issues Handoff

## Document Purpose

This document summarizes the current project problems and gaps found by reading the source code.
It is intended as a handoff document for later AI models or developers.

Date: 2026-04-13
Repository: `E:\bishexianmu\electronic-regulation-system`

## Project Structure

- `frontend`: React frontend
- `backend`: Express + Sequelize + MySQL backend
- `blockchain`: Truffle + Solidity smart contract
- `ai_service`: Flask-based AI audit service

## Implemented Capabilities

The following capabilities already exist in code:

- User registration and login
- Role-based access control for buyer, seller, regulator, admin
- Seller approval flow
- Product submission and review flow
- Product report and certificate upload to IPFS
- AI pre-audit for product content
- Product listing, purchase, receipt confirmation, rating
- Complaint submission and regulator resolution
- Audit log recording and regulator dashboard
- Smart contract support for seller registration, product audit, order flow, complaints, and seller reputation
- QR-code based trace page

## Main Problems

## P0 - Must Fix First

### 1. Role registration has a privilege escalation risk

Problem:
- The registration API accepts `buyer`, `seller`, `regulator`, and `admin` directly from the request body.
- This means a user can try to register with elevated roles.

Impact:
- Severe security risk.
- Unauthorized users may obtain regulator or admin capabilities.

Evidence:
- `backend/controllers/auth.controller.js`

Suggested fix:
- Only allow self-registration for `buyer` and `seller`.
- Create regulator/admin accounts only through seeded data or protected admin-only management APIs.

### 2. Sensitive secrets are hardcoded or exposed in config/examples

Problem:
- MySQL password is hardcoded in `backend/config/db.config.js`.
- JWT secret is hardcoded in `backend/config/auth.config.js`.
- Multiple blockchain private keys are placed in `.env.example`.

Impact:
- Severe credential leakage risk.
- Unsafe for collaboration, demos, deployment, and AI-assisted code generation.

Evidence:
- `backend/config/db.config.js`
- `backend/config/auth.config.js`
- `.env.example`
- `backend/.env.example`

Suggested fix:
- Move all secrets to environment variables only.
- Replace real-looking keys with placeholders.
- Add runtime validation for required env vars.

### 3. Frontend and backend both default to port 3000

Problem:
- Frontend API services call `http://localhost:3000/...`
- Backend also defaults to port `3000`.
- This creates local development conflicts.

Impact:
- Frontend and backend cannot run cleanly together under the current default setup.

Evidence:
- `frontend/src/services/auth.service.js`
- `frontend/src/services/product.service.js`
- `frontend/src/services/file.service.js`
- `frontend/src/services/audit-log.service.js`
- `backend/server.js`

Suggested fix:
- Run backend on `3001` or another API port.
- Use frontend env vars such as `REACT_APP_API_BASE_URL`.
- Optionally configure CRA proxy.

### 4. Blacklist state is inconsistent between database and blockchain

Problem:
- Many backend checks use `user.isBlacklisted` from MySQL.
- Complaint resolution on chain can blacklist a seller in the smart contract.
- There is no clear sync mechanism updating the database blacklist field from on-chain state.

Impact:
- Blacklisted sellers may still pass some backend checks.
- Business rules can diverge between chain state and database state.

Evidence:
- `backend/models/user.model.js`
- `backend/controllers/product.controller.js`
- `blockchain/contracts/ProductRegulation.sol`

Suggested fix:
- Choose one source of truth.
- Preferred approach: on critical actions, read blacklist status from chain and sync to DB asynchronously.

## P1 - Core Business Flow Gaps

### 5. Product audit flow is too AI-dependent and not truly regulator-driven

Problem:
- Regulator audit still calls AI again.
- The regulator decision parameter is not a full manual approval/rejection workflow.
- Uploaded report PDF is not reliably reused during the second-stage audit.

Impact:
- Regulator review is weak.
- Hard to explain why a product passed or failed.
- Manual governance is not complete.

Evidence:
- `backend/controllers/product.controller.js`
- `frontend/src/pages/Home.js`

Suggested fix:
- Separate AI pre-audit from regulator review.
- Let regulator explicitly approve or reject with a required reason.
- Show uploaded report/certificate and AI findings in the review UI.

### 6. Seller approval UI is incomplete

Problem:
- The frontend only exposes approve behavior for pending sellers.
- No clear reject action in regulator UI.

Impact:
- Backend supports rejection, but frontend does not fully expose it.

Evidence:
- `backend/controllers/auth.controller.js`
- `frontend/src/pages/Home.js`

Suggested fix:
- Add approve/reject buttons with reason input and confirmation.

### 7. Product audit UI is incomplete

Problem:
- Pending products mainly expose "submit audit" and "force delist".
- There is no proper approve/reject/reason workflow in the regulator UI.

Impact:
- Review process is operationally incomplete.
- Hard to support formal compliance decisions.

Evidence:
- `frontend/src/pages/Home.js`

Suggested fix:
- Add dedicated audit actions:
  - approve
  - reject
  - require reason
  - view report
  - view certificate
  - view AI result summary

### 8. Trace page is currently a demo page, not a true traceability page

Problem:
- The trace page reads core values from URL query parameters.
- It generates fake DID and fake transaction hash using `Math.random()`.
- It does not fetch chain-backed product/order/regulator data directly.

Impact:
- Traceability is not trustworthy.
- Users can tamper with query parameters.

Evidence:
- `frontend/src/pages/TracePage.js`
- `frontend/src/pages/Home.js`

Suggested fix:
- Use a product ID or chain ID in the URL.
- Load product, seller, audit, and trace data from backend APIs.
- Display real chain tx hash, seller wallet, and audit info.

### 9. Dashboard trend chart contains mock data

Problem:
- Some dashboard bar chart values are hardcoded instead of computed from real logs or statistics.

Impact:
- Dashboard is partly decorative rather than operational.

Evidence:
- `frontend/src/components/Dashboard.js`

Suggested fix:
- Add backend statistics endpoints.
- Compute trend series from audit logs, orders, and complaints.

## P2 - Product and Transaction Experience Gaps

### 10. No product editing or resubmission workflow

Problem:
- Sellers can create and delist products, but cannot:
  - edit product info
  - restock product
  - resubmit a rejected item

Impact:
- Weak merchant workflow.
- Rejected products cannot be corrected efficiently.

Evidence:
- `frontend/src/pages/MyProducts.js`
- `backend/controllers/product.controller.js`

Suggested fix:
- Add edit, restock, and resubmit flows.

### 11. No search, filtering, pagination, or category support for products

Problem:
- Market list is basic and unfiltered.

Impact:
- Poor user experience as product count grows.

Evidence:
- `frontend/src/pages/Home.js`
- `backend/controllers/product.controller.js`

Suggested fix:
- Add search, sort, category, seller filter, audit status filter, and pagination.

### 12. Order lifecycle is too simple

Problem:
- Orders currently jump between purchase, confirm, rate, dispute, refund.
- No shipping or logistics status exists.

Impact:
- Real e-commerce flow is incomplete.

Evidence:
- `backend/models/order.model.js`
- `frontend/src/pages/OrderCenter.js`
- `blockchain/contracts/ProductRegulation.sol`

Suggested fix:
- Add shipping info, shipment confirmation, tracking number, delivery states, and timeouts.

### 13. Complaint process is one-sided

Problem:
- Buyer can upload evidence and complain.
- Seller side evidence submission and response flow are missing.

Impact:
- Dispute handling is not balanced.

Evidence:
- `frontend/src/pages/OrderCenter.js`
- `backend/controllers/product.controller.js`

Suggested fix:
- Add seller response flow and multi-round evidence support.

## P2 - Data and AI Quality Gaps

### 14. AI audit model is only a prototype

Problem:
- Training data is tiny and hardcoded.
- Model is a simple TF-IDF + Naive Bayes pipeline.
- Confidence is fixed to `0.95` and not derived from the model.

Impact:
- Not reliable enough for production or serious compliance judgments.

Evidence:
- `ai_service/train_model.py`
- `ai_service/app.py`

Suggested fix:
- Replace with a real dataset and evaluation process.
- Output real scores and reasons.
- Add versioning and model metadata.

### 15. AI result lacks explainability

Problem:
- API only returns PASS/FAIL and a fixed confidence value.

Impact:
- Regulators cannot understand why a product failed.
- Hard to audit or defend model outcomes.

Evidence:
- `ai_service/app.py`
- `backend/controllers/product.controller.js`

Suggested fix:
- Return risk labels, extracted evidence, and review hints.

## P2 - Code Quality and Reliability Gaps

### 16. There are visible text encoding/garbled Chinese issues in the UI code

Problem:
- Multiple frontend files contain garbled Chinese text.

Impact:
- Harder maintenance.
- Risk of broken UI copy and collaboration confusion.

Evidence:
- `frontend/src/components/Dashboard.js`
- `frontend/src/pages/Home.js`
- `frontend/src/pages/Login.js`
- `frontend/src/pages/Register.js`
- `frontend/src/pages/AddProduct.js`
- `frontend/src/pages/MyProducts.js`
- `frontend/src/pages/OrderCenter.js`
- `frontend/src/pages/TracePage.js`

Suggested fix:
- Normalize all files to UTF-8.
- Review and restore intended Chinese content.

### 17. Business tests are almost absent

Problem:
- Frontend only contains the default CRA sample test.
- Backend has no business test suite.
- Blockchain test directory is effectively empty.

Impact:
- High regression risk.
- Difficult for future AI agents to refactor safely.

Evidence:
- `frontend/src/App.test.js`
- `blockchain/test/.gitkeep`

Suggested fix:
- Add:
  - backend API tests
  - contract tests
  - frontend critical flow tests

### 18. Too many blocking browser dialogs in frontend flows

Problem:
- Important flows depend on `window.prompt` and `window.confirm`.

Impact:
- Weak UX and weak validation.
- Not suitable for scalable admin workflows.

Evidence:
- `frontend/src/pages/Home.js`
- `frontend/src/pages/MyProducts.js`
- `frontend/src/pages/OrderCenter.js`

Suggested fix:
- Replace with controlled modal forms and explicit validation.

## Recommended Next-Step Roadmap

### Phase 1 - Security and architecture stabilization

- Lock down registration roles
- Remove hardcoded secrets
- Fix frontend/backend port strategy
- Resolve DB-chain blacklist consistency

### Phase 2 - Regulatory workflow completion

- Add full seller approve/reject UI
- Add real product approve/reject UI
- Require audit reasons
- Display uploaded evidence and AI findings to regulators

### Phase 3 - Real traceability and statistics

- Build true trace API by product ID / chain ID
- Replace query-param trace page with backend-driven data
- Replace dashboard mock charts with real aggregated data

### Phase 4 - Merchant and buyer workflow enhancement

- Edit product
- Restock product
- Resubmit rejected product
- Add search/filter/pagination
- Add shipping and logistics flow
- Add seller-side dispute response

### Phase 5 - Reliability improvement

- Fix text encoding
- Add tests
- Improve AI model quality and explainability

## Progress Update (2026-04-14)

The following items have been implemented after this handoff document was created:

- End-to-end validation for blacklist -> unblacklist:
  - Verified chain blacklist creation and regulator unblacklist via API.
  - Verified seller is removed from `/api/auth/blacklisted-sellers` after restore.
- Regulator UI now has a persistent blacklist management entry:
  - `frontend/src/components/BlacklistSellerManager.js`
  - `frontend/src/pages/Home.js`
- Market search/filter/pagination is now available:
  - Backend query support in `GET /api/products` (`q`, `minPrice`, `maxPrice`, `sellerId`, `sortBy`, `page`, `pageSize`)
  - Frontend filter and pagination controls in `frontend/src/pages/Home.js`
- Seller workflow enhancements added:
  - Restock endpoint: `POST /api/products/restock`
  - Resubmit endpoint: `POST /api/products/resubmit`
  - Seller-side UI for restock/resubmit in `frontend/src/pages/MyProducts.js`
- Dashboard statistics are now partly backed by real data:
  - Added `GET /api/audit-logs/stats`
  - Frontend dashboard trend chart now reads real aggregated log data instead of hardcoded mock bars
- Order logistics and seller-side dispute response are now available:
  - Seller shipment endpoint: `POST /api/products/ship`
  - Seller complaint response endpoint: `POST /api/products/respond-complaint`
  - Buyer/seller UI updated in `frontend/src/pages/OrderCenter.js`
  - Complaint evidence now supports a seller-side upload endpoint
- Smart contract capability extended:
  - Added `restockProduct` method and `ProductRestocked` event in `blockchain/contracts/ProductRegulation.sol`
  - Recompiled and redeployed contract

Still pending from the original list (not fully closed yet):

- AI explainability and model quality upgrade
- Full encoding cleanup across all frontend pages/components

Completed on 2026-04-14:

- Automated backend/frontend/contract test suites
- Backend Node test suite for registration hardening and seller logistics/response flows
- Frontend RTL tests for blacklist management, regulator dashboard rendering, and seller shipping flow
- Truffle contract tests for `restockProduct` and `restoreSeller`
- Root `npm test` script now runs backend, frontend, and blockchain tests end-to-end

## Quick Summary for Future AI Models

If you need to continue this project, prioritize in this order:

1. Security issues
2. Regulator workflow completion
3. True chain-backed traceability
4. Data consistency between blockchain and database
5. UX improvements and testing

The current project is not empty. It already contains a real multi-role workflow and a meaningful smart-contract-backed domain model. The main issue is that several important parts are only partially productized and still behave like a prototype/demo.
