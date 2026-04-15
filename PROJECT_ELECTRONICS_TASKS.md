# Electronic Product Specialization Task List

Date: 2026-04-14
Repository: `E:\bishexianmu\electronic-regulation-system`

## Goal

This document defines an incremental development backlog for making the current prototype more clearly aligned with the thesis topic:

`基于区块链的电子产品交易平台监管系统`

The guiding rule is:

- keep the current prototype structure and core flows
- avoid deleting existing features unless strictly necessary
- extend the existing product, regulator, traceability, and dispute flows with electronic-product-specific data and rules

## Current Prototype Baseline

The following prototype capabilities should be preserved:

- multi-role login and seller approval
- product submission, regulator review, and product delist
- purchase, shipping, receipt confirmation, rating
- complaint, seller response, regulator ruling
- blockchain-backed seller/product/order state
- audit log center and dashboard
- QR trace page and IPFS evidence storage

## Implementation Principles

1. Prefer additive schema changes over replacing existing fields.
2. Keep current APIs working where possible; add fields as optional first.
3. Use feature flags in UI behavior where necessary during migration.
4. Preserve existing product listing and order workflows.
5. Treat electronic-product specialization as a domain enhancement layer, not a rewrite.

## Phase 1 - Product Data Specialization

### Task 1. Add electronic-product core fields to the product model

Goal:
- make each product record carry electronic-product identity and compliance data

Suggested fields:
- `brand`
- `model`
- `category`
- `serialNumber`
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

Scope:
- backend database model
- runtime schema sync
- request parsing and validation
- frontend add/edit/resubmit forms

Likely files:
- `backend/models/product.model.js`
- `backend/config/runtime-schema.js`
- `backend/controllers/product.controller.js`
- `frontend/src/pages/AddProduct.js`
- `frontend/src/pages/MyProducts.js`

Acceptance:
- existing product creation still works
- new electronic-product fields can be submitted and stored
- empty legacy records remain readable

### Task 2. Add electronic-product detail sections to seller product forms

Goal:
- make seller submission clearly electronic-product-oriented without removing the current basic form

Suggested UI sections:
- basic identity: brand, model, category
- device identity: serial number or IMEI
- condition declaration: used/refurbished/accessories
- compliance declaration: CCC, energy, RoHS
- service declaration: warranty period

Likely files:
- `frontend/src/pages/AddProduct.js`
- `frontend/src/pages/MyProducts.js`

Acceptance:
- seller can fill new fields during add/resubmit
- current report and certificate upload flow remains unchanged

### Task 3. Add product category presets for electronic goods

Goal:
- avoid generic free-form product categories and guide data entry

Suggested categories:
- mobile phone
- laptop
- tablet
- earphone
- charger
- power bank
- smart watch
- home appliance accessory

Likely files:
- `frontend/src/pages/AddProduct.js`
- `frontend/src/pages/MyProducts.js`
- optional backend validation in `backend/controllers/product.controller.js`

Acceptance:
- category appears as a controlled select
- market and trace page can display category

## Phase 2 - Compliance and Regulator Data Enhancement

### Task 4. Add structured electronic-product compliance fields

Goal:
- move from pure file upload to structured compliance metadata

Suggested fields:
- `inspectionAgency`
- `inspectionDate`
- `inspectionConclusion`
- `batterySafetyPassed`
- `chargerSafetyPassed`
- `appearanceGrade`
- `functionalTestPassed`
- `repairHistoryDeclared`

Scope:
- database storage
- seller input
- regulator review display

Likely files:
- `backend/models/product.model.js`
- `backend/controllers/product.controller.js`
- `frontend/src/pages/AddProduct.js`
- `frontend/src/components/RegulatorReviewQueues.js`
- `frontend/src/pages/TracePage.js`

Acceptance:
- regulator can see structured inspection data together with uploaded PDFs
- existing PDF/IPFS flow remains available

### Task 5. Add electronic-product specific review checks in regulator workflow

Goal:
- strengthen regulator review without removing current approve/reject flow

Suggested checks:
- certain categories require `cccNumber`
- used/refurbished devices require condition declaration
- battery-related products require battery safety result
- charger/power products require charger safety result
- missing serial number blocks second-hand device approval

Likely files:
- `backend/controllers/product.controller.js`
- `frontend/src/components/RegulatorReviewQueues.js`

Acceptance:
- regulator review remains manual
- system warns or blocks obvious missing electronic-product compliance data

### Task 6. Add regulator review notes dedicated to electronic-product risk

Goal:
- make audit reasons more domain-specific and useful in traceability

Suggested note dimensions:
- compliance missing
- device identity incomplete
- refurbished disclosure incomplete
- battery risk
- certificate mismatch
- suspected counterfeit

Likely files:
- `frontend/src/components/RegulatorReviewQueues.js`
- `backend/controllers/product.controller.js`
- `frontend/src/pages/TracePage.js`

Acceptance:
- review reason is visible in trace page
- review reason reflects electronic-product context

## Phase 3 - Device-Level Traceability

### Task 7. Upgrade traceability from "product page" to "device trace page"

Goal:
- make traceability centered on electronic device identity instead of only generic goods

Suggested additions on trace page:
- brand/model/category
- serial number or masked IMEI
- batch number
- used/refurbished flag
- battery health
- accessory declaration
- warranty validity
- compliance identifiers

Likely files:
- `backend/controllers/product.controller.js`
- `frontend/src/pages/TracePage.js`

Acceptance:
- current trace page still works for legacy products
- new device attributes appear when available

### Task 8. Add device lifecycle timeline items

Goal:
- show electronic-product-specific lifecycle events in the existing timeline

Suggested new timeline events:
- device registered
- compliance info updated
- warranty updated
- refurbishment declared
- recall flagged
- repair record added

Likely files:
- `backend/services/audit.service.js`
- `backend/controllers/product.controller.js`
- `frontend/src/pages/TracePage.js`

Acceptance:
- old timeline events remain intact
- new events appear in chronological order

### Task 9. Add QR trace payload based on product ID only

Goal:
- keep current QR flow but ensure device trace data is always fetched from backend

Scope:
- maintain current QR entry point
- avoid carrying important compliance fields in query params

Likely files:
- `frontend/src/pages/Home.js`
- `frontend/src/pages/TracePage.js`

Acceptance:
- QR code continues to open trace page
- trace details come from backend data rather than URL display values

## Phase 4 - Risk Control and Market Regulation

### Task 10. Add recall and batch-risk management

Goal:
- introduce a distinctly electronic-product regulatory capability

Suggested features:
- regulator marks a batch or model as recalled
- recalled products are forcibly delisted
- trace page shows recall warning
- market list hides recalled devices

Suggested data:
- `recallStatus`
- `recallReason`
- `recallNoticeAt`
- `recallBatchNo`

Likely files:
- `backend/models/product.model.js`
- `backend/controllers/product.controller.js`
- `frontend/src/pages/Home.js`
- `frontend/src/pages/MyProducts.js`
- `frontend/src/pages/TracePage.js`

Acceptance:
- regulator can flag recalled products
- trace page visibly warns users
- current delist flow remains available

### Task 11. Add electronic-product seller qualification data

Goal:
- make seller approval reflect electronics business regulation

Suggested fields:
- business qualification type
- brand authorization proof
- maintenance/refurbishment qualification
- second-hand electronics handling qualification

Likely files:
- `backend/models/user.model.js`
- `backend/controllers/auth.controller.js`
- `frontend/src/pages/Register.js`
- `frontend/src/components/RegulatorReviewQueues.js`

Acceptance:
- ordinary buyer flow is unchanged
- seller approval shows electronics-related qualification context

### Task 12. Add suspicious device and suspicious seller markers

Goal:
- improve risk signaling without removing listing capability immediately

Suggested marker sources:
- repeated complaints on same model
- repeated complaints on same serial range
- reused compliance number
- abnormal refund rate

Likely files:
- `backend/controllers/product.controller.js`
- `backend/controllers/audit.controller.js`
- `frontend/src/components/Dashboard.js`
- `frontend/src/pages/TracePage.js`

Acceptance:
- flagged items are visible to regulator
- existing complaint and blacklist flow still works

## Phase 5 - Blockchain Domain Enhancement

### Task 13. Extend contract product structure with electronic-product summary fields

Goal:
- make on-chain data reflect electronic-product regulation rather than generic goods only

Suggested contract additions:
- `deviceIdHash`
- `brand`
- `model`
- `category`
- `cccNumberHash`
- `riskLevel`
- `recallFlag`

Important:
- add fields carefully to avoid breaking current flows
- prefer additive evolution and synchronized redeployment

Likely files:
- `blockchain/contracts/ProductRegulation.sol`
- `blockchain/migrations/1_deploy.js`
- `backend/services/chain.service.js`
- `backend/controllers/product.controller.js`

Acceptance:
- create/audit/purchase flow remains usable after redeploy
- trace page can read new chain summary fields

### Task 14. Add device lifecycle events to the contract

Goal:
- strengthen blockchain-backed regulatory traceability

Suggested events:
- `ProductComplianceUpdated`
- `ProductRecallFlagged`
- `ProductRepairRecorded`
- `ProductRefurbishDeclared`

Likely files:
- `blockchain/contracts/ProductRegulation.sol`
- `backend/controllers/product.controller.js`
- `frontend/src/pages/TracePage.js`

Acceptance:
- existing contract events remain supported
- new lifecycle events can be surfaced in the trace timeline

## Phase 6 - Order and After-Sales Specialization

### Task 15. Add after-sales service records for electronic products

Goal:
- reflect post-sale regulation that is common in electronics

Suggested records:
- warranty claim submitted
- repair performed
- component replaced
- refund due to quality issue

Likely files:
- `backend/models/order.model.js`
- new service or controller methods in `backend/controllers/product.controller.js`
- `frontend/src/pages/OrderCenter.js`
- `frontend/src/pages/TracePage.js`

Acceptance:
- current order lifecycle remains intact
- after-sales events can be recorded additionally

### Task 16. Add problem-type taxonomy in complaint flow

Goal:
- make disputes more aligned with electronic-product quality supervision

Suggested complaint types:
- battery issue
- counterfeit suspicion
- refurbished not disclosed
- serial number mismatch
- performance issue
- accessory mismatch
- safety risk

Likely files:
- `backend/models/order.model.js`
- `backend/controllers/product.controller.js`
- `frontend/src/pages/OrderCenter.js`
- `frontend/src/pages/TracePage.js`

Acceptance:
- buyer can still enter free-text reason
- system also stores a structured complaint type

## Phase 7 - Dashboard and Reporting Enhancement

### Task 17. Add electronics-focused dashboard metrics

Goal:
- make the regulator dashboard visibly tied to electronic-product regulation

Suggested metrics:
- recalled products count
- used/refurbished products count
- battery-related complaint count
- products missing CCC info
- complaint rate by category
- blacklisted sellers by category

Likely files:
- `backend/controllers/audit.controller.js`
- `frontend/src/components/Dashboard.js`

Acceptance:
- current dashboard remains readable
- new cards/charts highlight electronics-specific supervision

### Task 18. Add category and compliance filters to market/regulator pages

Goal:
- support electronic-product supervision and browsing

Suggested filters:
- category
- brand
- used/refurbished
- recall status
- CCC present or missing

Likely files:
- `backend/controllers/product.controller.js`
- `frontend/src/pages/Home.js`

Acceptance:
- current keyword/price/pagination filters remain available
- new filters work alongside old ones

## Phase 8 - Compatibility and Migration

### Task 19. Preserve compatibility for legacy product records

Goal:
- ensure old demo data and current prototype records continue to work

Scope:
- nullable new fields
- defensive rendering in frontend
- trace page fallback labels

Likely files:
- `backend/controllers/product.controller.js`
- `frontend/src/pages/TracePage.js`
- `frontend/src/pages/Home.js`
- `frontend/src/pages/MyProducts.js`

Acceptance:
- old products can still be listed, purchased, and traced
- missing new fields do not crash UI or API

### Task 20. Add tests for electronics-specific extensions

Goal:
- protect the current prototype while specializing the domain

Suggested coverage:
- backend product creation with new fields
- regulator blocking products with missing required compliance fields
- trace API returning electronic-product details
- contract event coverage for new lifecycle actions
- frontend render tests for add form and trace page

Likely files:
- `backend/test/*`
- `blockchain/test/*`
- `frontend/src/**/*.test.js`

Acceptance:
- root test command still passes
- new domain logic has regression coverage

## Recommended Delivery Order

Recommended first implementation batch:

1. Task 1
2. Task 2
3. Task 3
4. Task 4
5. Task 5
6. Task 7
7. Task 10
8. Task 17

Reason:
- this batch gives the strongest thesis-topic improvement with the least disruption to the current prototype

## Non-Goals For This Backlog

The following are intentionally not the focus of this document:

- replacing the existing order flow
- removing current regulator review mechanics
- redesigning the prototype UI from scratch
- AI model redesign

## Suggested Next Step

Start with a small vertical slice:

- add electronic-product fields to the backend model
- expose them in add/resubmit forms
- render them in the trace page

This provides immediate thesis-topic alignment while keeping the current prototype experience intact.
