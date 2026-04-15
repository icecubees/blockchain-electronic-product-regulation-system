# Electronic Product Specialization Implementation Plan

Date: 2026-04-15
Repository: `E:\bishexianmu\electronic-regulation-system`
Source backlog: `PROJECT_ELECTRONICS_TASKS.md`

## Purpose

This document expands the electronics-specialization backlog into a developer-ready implementation plan.

Design constraints:

- preserve the current prototype flows
- avoid deleting working features
- prefer additive changes and backward compatibility
- keep legacy products and current demo scenarios usable

## Existing Core Flows To Preserve

- seller registration and regulator approval
- product publish -> regulator review -> market listing
- purchase -> shipping -> receipt confirmation -> rating
- complaint -> seller response -> regulator ruling
- audit logs, dashboard, QR trace page
- blockchain-backed seller/product/order state

## Global Change Strategy

### Data strategy

- Add new product and seller fields as nullable first.
- Keep existing fields such as `name`, `price`, `description`, `ipfsHash`, `qualificationHash`, `stock`.
- Avoid changing existing status enums unless needed.

### API strategy

- Keep existing endpoints and extend request bodies and response payloads.
- Add new endpoints only for clearly new regulator actions, such as recall or repair lifecycle.

### UI strategy

- Keep current pages and navigation.
- Insert new form sections and display cards instead of redesigning pages.

### Chain strategy

- Add new on-chain summary fields only for high-value traceability data.
- Keep full detail primarily in the database and audit log.

## Shared Domain Definitions

### Suggested electronic categories

- `mobile_phone`
- `laptop`
- `tablet`
- `earphone`
- `charger`
- `power_bank`
- `smart_watch`
- `camera`
- `router`
- `accessory`

### Suggested condition enums

- `appearanceGrade`: `S`, `A`, `B`, `C`
- `accessoryStatus`: `full`, `partial`, `none`
- `inspectionConclusion`: `pass`, `conditional_pass`, `fail`
- `riskLevel`: `low`, `medium`, `high`

### Suggested complaint types

- `battery_issue`
- `counterfeit_suspected`
- `refurbished_not_disclosed`
- `serial_number_mismatch`
- `performance_issue`
- `accessory_mismatch`
- `safety_risk`

## Task Details

### Task 1. Add electronic-product core fields to the product model

#### Objective

Make the product entity explicitly represent electronic devices rather than generic goods.

#### Backend changes

Add nullable columns to `products`:

- `brand`: string(100)
- `model`: string(100)
- `category`: string(50)
- `serialNumber`: string(100)
- `batchNo`: string(100)
- `manufactureDate`: date
- `warrantyUntil`: date
- `isUsed`: boolean default `false`
- `isRefurbished`: boolean default `false`
- `batteryHealth`: integer nullable
- `accessoryStatus`: string(20)
- `cccNumber`: string(100)
- `energyLevel`: string(20)
- `rohsStatus`: string(20)

#### Validation rules

- `batteryHealth` must be `0-100` if present.
- `category` must be in the predefined category list.
- `serialNumber` is optional at schema level, enforced later by category-specific review rules.

#### Affected files

- `backend/models/product.model.js`
- `backend/config/runtime-schema.js`
- `backend/controllers/product.controller.js`

#### Frontend changes

Add a new "device info" section in:

- `frontend/src/pages/AddProduct.js`
- `frontend/src/pages/MyProducts.js`

#### API behavior

Extend current payloads for:

- `POST /api/products/add`
- `POST /api/products/resubmit`
- `GET /api/products`
- `GET /api/products/:productId/trace`
- `GET /api/products/my-products`

#### Migration notes

- New fields must be optional for old rows.
- Existing list and trace rendering must not assume these fields exist.

#### Acceptance

- New fields are stored and returned.
- Existing product creation still succeeds with old payloads.

### Task 2. Add electronic-product detail sections to seller product forms

#### Objective

Keep the current publish flow while making seller input obviously device-oriented.

#### UI layout proposal

Section 1: Basic product info

- name
- brand
- model
- category
- price
- stock

Section 2: Device identity

- serial number / IMEI
- batch number
- manufacture date

Section 3: Condition declaration

- is used
- is refurbished
- battery health
- accessory status
- warranty until

Section 4: Compliance declaration

- CCC number
- energy level
- RoHS status

Section 5: Existing files

- product report PDF
- qualification certificate PDF

#### Affected files

- `frontend/src/pages/AddProduct.js`
- `frontend/src/pages/MyProducts.js`

#### UX constraints

- Do not remove the existing description/report/certificate inputs.
- Use collapsible panels if page becomes too long.

#### Acceptance

- Seller can fill and submit the new structured fields.
- Resubmission form can edit the same fields.

### Task 3. Add product category presets for electronic goods

#### Objective

Prevent the system from looking like a category-free generic marketplace.

#### Backend changes

- Add a shared category whitelist in the controller layer.
- Reject categories outside the supported list.

#### Frontend changes

- Replace free-form category input with a select.
- Optionally show category-specific tips.

#### Category-specific hints

- `mobile_phone`: serial number, battery health recommended
- `charger`: CCC and charger safety recommended
- `power_bank`: battery health and battery safety required

#### Affected files

- `frontend/src/pages/AddProduct.js`
- `frontend/src/pages/MyProducts.js`
- `backend/controllers/product.controller.js`

#### Acceptance

- Category is selected from a controlled list.
- Category is visible in market cards and trace page.

### Task 4. Add structured electronic-product compliance fields

#### Objective

Make regulator review rely on structured compliance information, not only uploaded files.

#### New fields

Add nullable columns:

- `inspectionAgency`
- `inspectionDate`
- `inspectionConclusion`
- `batterySafetyPassed`
- `chargerSafetyPassed`
- `appearanceGrade`
- `functionalTestPassed`
- `repairHistoryDeclared`

#### Backend changes

- Parse and save these fields in add/resubmit.
- Include them in trace details and pending product review payloads.

#### Frontend changes

Seller forms:

- add compliance inputs and checkboxes

Regulator review queue:

- show a "compliance summary" block above approve/reject controls

Trace page:

- show a compliance card

#### Affected files

- `backend/models/product.model.js`
- `backend/controllers/product.controller.js`
- `frontend/src/pages/AddProduct.js`
- `frontend/src/components/RegulatorReviewQueues.js`
- `frontend/src/pages/TracePage.js`

#### Acceptance

- Regulator can review structured compliance data alongside IPFS files.

### Task 5. Add electronic-product specific review checks in regulator workflow

#### Objective

Make the regulator workflow actually reflect electronics regulation.

#### Rule matrix

- `mobile_phone` and `tablet`:
  - require `brand`, `model`, `serialNumber`
- `charger` and `power_bank`:
  - require `cccNumber`
  - require `chargerSafetyPassed` or `batterySafetyPassed`
- `isUsed = true` or `isRefurbished = true`:
  - require `appearanceGrade`
  - require `repairHistoryDeclared`

#### Backend behavior

- Before approval, validate the required fields by category.
- Return a human-readable error list if required compliance data is missing.
- Allow rejection as usual.

#### Frontend behavior

- In the regulator review panel, show missing items checklist.
- Keep current approve/reject buttons.

#### Affected files

- `backend/controllers/product.controller.js`
- `frontend/src/components/RegulatorReviewQueues.js`

#### Acceptance

- Regulator cannot approve obviously incomplete electronic-device data.
- Reject flow remains unchanged.

### Task 6. Add regulator review notes dedicated to electronic-product risk

#### Objective

Standardize review reasons for thesis-ready regulator records.

#### Suggested reason templates

- missing CCC information
- missing device identifier
- undisclosed refurbished status
- battery safety concern
- report and declared model mismatch
- suspected counterfeit or unauthorized product

#### Backend changes

- Store both:
  - free-text reason
  - optional structured reason code list

#### Frontend changes

- Add optional quick-select chips in regulator review UI.

#### Affected files

- `backend/controllers/product.controller.js`
- `frontend/src/components/RegulatorReviewQueues.js`
- `frontend/src/pages/TracePage.js`

#### Acceptance

- Trace page shows regulator reason with more domain detail.

### Task 7. Upgrade traceability from product page to device trace page

#### Objective

Make the trace page look like a device supervision report instead of a general product detail page.

#### Backend changes

Extend trace payload with:

- `brand`
- `model`
- `category`
- `serialNumberMasked`
- `batchNo`
- `manufactureDate`
- `warrantyUntil`
- `isUsed`
- `isRefurbished`
- `batteryHealth`
- `accessoryStatus`
- `cccNumber`
- `energyLevel`
- `rohsStatus`
- compliance block from Task 4

#### Privacy rule

- Mask serial number or IMEI in public trace view.
- Example: show first 3 and last 3 characters only.

#### Frontend changes

Add new cards:

- device identity
- compliance overview
- condition and warranty

#### Affected files

- `backend/controllers/product.controller.js`
- `frontend/src/pages/TracePage.js`

#### Acceptance

- Legacy products still render with fallback labels.
- New products show device-level identity and compliance data.

### Task 8. Add device lifecycle timeline items

#### Objective

Use the existing audit log mechanism to represent electronics-specific lifecycle events.

#### New audit actions

- `PRODUCT_COMPLIANCE_UPDATED`
- `PRODUCT_RECALL_FLAGGED`
- `PRODUCT_REPAIR_RECORDED`
- `PRODUCT_REFURBISH_DECLARED`
- `WARRANTY_UPDATED`

#### Backend changes

- Record these actions through `audit.service`.
- Surface them in product trace timeline aggregation.

#### Frontend changes

- Add labels and color mappings in trace timeline.

#### Affected files

- `backend/services/audit.service.js`
- `backend/controllers/product.controller.js`
- `frontend/src/pages/TracePage.js`
- optionally `frontend/src/components/Dashboard.js`

#### Acceptance

- Timeline includes both old and new actions in order.

### Task 9. Add QR trace payload based on product ID only

#### Objective

Keep the current QR interaction but eliminate trust in query-string content.

#### Changes

- QR content should be `/trace?productId=<id>`
- Do not append seller score, price, or IPFS values into query params

#### Affected files

- `frontend/src/pages/Home.js`
- `frontend/src/pages/TracePage.js`

#### Acceptance

- QR code opens correctly.
- Trace page always resolves real backend data.

### Task 10. Add recall and batch-risk management

#### Objective

Add a high-value regulator feature strongly associated with electronics supervision.

#### New product fields

- `recallStatus`: boolean default `false`
- `recallReason`: string
- `recallNoticeAt`: date
- `recallBatchNo`: string

#### Backend changes

Add regulator-only endpoint:

- `POST /api/products/recall`

Request:

- `productId`
- `reason`
- optional `batchNo`

Behavior:

- mark product recalled
- force delist the product if active
- write audit log

#### Frontend changes

Regulator:

- add "recall" action in pending/review/list management area

Trace page:

- show recall banner

Market:

- hide recalled products or mark them unavailable

#### Affected files

- `backend/models/product.model.js`
- `backend/controllers/product.controller.js`
- `backend/routes/product.routes.js`
- `frontend/src/pages/Home.js`
- `frontend/src/pages/MyProducts.js`
- `frontend/src/pages/TracePage.js`

#### Acceptance

- Recalled products cannot be bought.
- Trace page clearly warns users.

### Task 11. Add electronic-product seller qualification data

#### Objective

Make seller approval explicitly about electronics business compliance.

#### New user fields

- `qualificationType`
- `brandAuthorizationHash`
- `repairQualificationHash`
- `usedDeviceQualificationHash`
- `qualificationNotes`

#### Backend changes

- Allow seller registration payload to include qualification metadata.
- Return these values to regulator review list.

#### Frontend changes

Register page:

- seller-only section for qualification uploads or hashes

Regulator queue:

- show qualification summary before approval

#### Affected files

- `backend/models/user.model.js`
- `backend/controllers/auth.controller.js`
- `frontend/src/pages/Register.js`
- `frontend/src/components/RegulatorReviewQueues.js`

#### Acceptance

- Buyer registration remains simple.
- Seller review contains electronics-specific qualification context.

### Task 12. Add suspicious device and suspicious seller markers

#### Objective

Improve regulator situational awareness without breaking current market flow.

#### Suggested computed markers

Per product:

- high complaint frequency
- repeated refunds
- reused CCC number
- reused serial pattern

Per seller:

- multiple risky products in same category
- repeated recall association
- repeated complaint losses

#### Backend changes

- Start with derived flags in query responses instead of persistent columns.
- Optionally later store:
  - `riskLevel`
  - `riskTags`

#### Frontend changes

- dashboard risk cards
- warning badge on trace page
- optional market card flag for regulator/admin views only

#### Affected files

- `backend/controllers/product.controller.js`
- `backend/controllers/audit.controller.js`
- `frontend/src/components/Dashboard.js`
- `frontend/src/pages/TracePage.js`

#### Acceptance

- Risk markers appear without blocking normal legacy flow.

### Task 13. Extend contract product structure with electronic-product summary fields

#### Objective

Persist the most important device supervision markers on chain.

#### Contract additions

Add or extend product summary with:

- `string brand`
- `string model`
- `string category`
- `string deviceIdHash`
- `string cccNumberHash`
- `uint8 riskLevel`
- `bool recallFlag`

#### Write strategy

Store only summary or hashed identity on chain.
Keep full detail in DB.

#### Backend changes

- Update product creation and read mapping.
- Add helper to hash serial number/CCC before contract submission.

#### Affected files

- `blockchain/contracts/ProductRegulation.sol`
- `blockchain/migrations/1_deploy.js`
- `backend/services/chain.service.js`
- `backend/controllers/product.controller.js`

#### Acceptance

- Current create/audit/purchase operations still function after redeploy.
- Trace page can display chain summary info.

### Task 14. Add device lifecycle events to the contract

#### Objective

Strengthen traceability for regulator-facing lifecycle changes.

#### New contract events

- `ProductComplianceUpdated`
- `ProductRecallFlagged`
- `ProductRepairRecorded`
- `ProductRefurbishDeclared`

#### Backend changes

- Add transaction wrappers for the above events where needed.
- Store resulting tx hashes in audit logs.

#### Important note

- Not every lifecycle action must become a full stateful contract mutation on day one.
- Emitting events can be enough for the prototype.

#### Affected files

- `blockchain/contracts/ProductRegulation.sol`
- `backend/controllers/product.controller.js`
- `frontend/src/pages/TracePage.js`

#### Acceptance

- Event-backed lifecycle items appear in trace.

### Task 15. Add after-sales service records for electronic products

#### Objective

Show post-sale governance that is common in electronics.

#### Data model option

Preferred: new table `after_sales_records`

Fields:

- `orderId`
- `productId`
- `type`
- `componentName`
- `description`
- `serviceResult`
- `createdBy`
- `createdAt`
- `evidenceIpfsHash`

#### Record types

- `warranty_claim`
- `repair`
- `component_replacement`
- `quality_refund`

#### Backend changes

Add endpoints:

- `POST /api/products/after-sales`
- `GET /api/products/:productId/after-sales`

#### Frontend changes

- seller or regulator can record service entries
- trace page displays service history

#### Affected files

- new model file under `backend/models`
- `backend/models/index.js`
- `backend/controllers/product.controller.js`
- `frontend/src/pages/OrderCenter.js`
- `frontend/src/pages/TracePage.js`

#### Acceptance

- Existing order flow stays unchanged.
- After-sales history can be added and traced.

### Task 16. Add problem-type taxonomy in complaint flow

#### Objective

Make disputes analyzable by electronics risk category.

#### Data changes

Add to orders:

- `complaintType`

#### Frontend changes

- complaint modal includes a select with complaint types
- free-text reason remains required or optional depending on final UX

#### Backend changes

- save `complaintType`
- include it in complaint list and trace data

#### Affected files

- `backend/models/order.model.js`
- `backend/controllers/product.controller.js`
- `frontend/src/pages/OrderCenter.js`
- `frontend/src/pages/TracePage.js`

#### Acceptance

- Structured complaint type appears in dashboard metrics later.

### Task 17. Add electronics-focused dashboard metrics

#### Objective

Make the regulator dashboard look like an electronics supervision console.

#### New summary metrics

- recalled products count
- used/refurbished active products count
- battery complaint count
- products missing CCC
- products with high risk tag
- risky sellers count

#### New trend suggestions

- complaints by category
- recalls over time
- missing compliance info over time

#### Backend changes

- extend `/api/audit-logs/stats`
- optionally add `/api/products/regulatory-stats`

#### Frontend changes

- add new summary cards
- add at least one electronics-specific chart

#### Affected files

- `backend/controllers/audit.controller.js`
- possibly `backend/controllers/product.controller.js`
- `frontend/src/components/Dashboard.js`

#### Acceptance

- Current dashboard still renders with older data.
- New statistics clearly mention electronics supervision.

### Task 18. Add category and compliance filters to market/regulator pages

#### Objective

Make market browsing and regulator inspection work for electronics categories.

#### New filters

- category
- brand
- used/refurbished
- recall status
- missing CCC

#### Backend changes

Extend `GET /api/products` query params:

- `category`
- `brand`
- `isUsed`
- `isRefurbished`
- `recallStatus`
- `cccStatus`

Add similar filters to pending product review endpoint if needed.

#### Frontend changes

- add new filter controls in `Home`
- regulator views can optionally show richer filters than buyer view

#### Affected files

- `backend/controllers/product.controller.js`
- `frontend/src/pages/Home.js`

#### Acceptance

- Existing keyword/price filters still work.
- New filters can be combined with old ones.

### Task 19. Preserve compatibility for legacy product records

#### Objective

Ensure the current prototype demo remains intact throughout specialization.

#### Required safeguards

- all new fields nullable
- default UI placeholders like `Not provided`
- trace payload builder must tolerate missing values
- market cards must not assume category/brand exists

#### Regression checklist

- old products list successfully
- old products can be purchased
- old products can be traced
- old complaints still display

#### Affected files

- `backend/controllers/product.controller.js`
- `frontend/src/pages/Home.js`
- `frontend/src/pages/MyProducts.js`
- `frontend/src/pages/TracePage.js`

#### Acceptance

- no breakage for current demo records

### Task 20. Add tests for electronics-specific extensions

#### Objective

Protect both current functionality and the new electronics specialization layer.

#### Backend tests

- create product with new device fields
- reject invalid category
- reject missing required compliance fields during approval
- trace endpoint returns device metadata
- recall endpoint delists and marks product

#### Frontend tests

- add product form renders device fields
- resubmit form renders device fields
- trace page renders compliance block
- recall warning renders when flagged

#### Contract tests

- creation with new summary fields
- recall flag event
- compliance update event

#### Affected files

- `backend/test/*.test.js`
- `frontend/src/**/*.test.js`
- `blockchain/test/*.test.js`

#### Acceptance

- `npm test` remains green at root level.

## Recommended Delivery Batches

### Batch A - Fastest thesis alignment

- Task 1
- Task 2
- Task 3
- Task 4
- Task 7

Expected outcome:

- the system visibly becomes an electronic-product platform
- trace page and forms reflect device supervision

### Batch B - Regulator specialization

- Task 5
- Task 6
- Task 10
- Task 17
- Task 18

Expected outcome:

- regulator side becomes strongly electronics-focused

### Batch C - Deep traceability

- Task 8
- Task 9
- Task 13
- Task 14

Expected outcome:

- device lifecycle trace gains stronger blockchain flavor

### Batch D - Advanced governance

- Task 11
- Task 12
- Task 15
- Task 16
- Task 20

Expected outcome:

- seller qualification, service lifecycle, and structured risk analytics complete the prototype

## Suggested Implementation Sequence For Your Team

If you want the lowest-risk path while keeping the current prototype attractive:

1. implement Task 1-4 first
2. immediately update the trace page with Task 7
3. then do regulator rules in Task 5-6
4. then add recall in Task 10
5. finally enrich dashboard and chain layers

## Delivery Checklist For The First Milestone

Milestone definition:

- the project should already look like an electronic-product regulation system even before advanced chain work

Checklist:

- product data has `brand/model/category/serialNumber/isUsed/isRefurbished/cccNumber`
- seller can submit these fields
- regulator can see these fields during review
- trace page displays these fields
- market page can filter by category
- legacy products still work

## Notes For Development

- Keep current English code identifiers if faster for implementation.
- User-facing text can be updated later together with encoding cleanup.
- Do not couple this plan with AI audit redesign yet.
- If contract changes feel too risky early, complete DB/UI specialization first.

## Recommended Next Action

Start implementing Batch A in this exact order:

1. Task 1
2. Task 2
3. Task 4
4. Task 7
5. Task 3

This order minimizes breakage and gives immediate visible progress.
