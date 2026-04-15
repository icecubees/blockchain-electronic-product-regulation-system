# Electronic Audit Dataset

`electronic_audit_dataset.csv` is a synthetic seed dataset for the prototype AI audit service.

To regenerate a larger dataset, run:

`./venv/Scripts/python.exe generate_dataset.py --rows 2400`

The generator now injects:

- label-balanced category coverage
- condition and compliance edge cases
- short or noisy report text
- OCR-style formatting noise
- minor text/field contradictions for robustness

To generate a harder independent holdout set, run:

`./venv/Scripts/python.exe generate_hard_cases.py --rows 480`

Columns:

- `sample_id`: stable row identifier
- `split`: `train`, `val`, or `test`
- `category`: electronic product category
- `name`, `description`, `brand`, `model`: seller-declared product info
- `serial_number`, `batch_no`, `ccc_number`: compliance identifiers
- `is_used`, `is_refurbished`, `battery_health`, `accessory_status`: condition fields
- `energy_level`, `rohs_status`: environmental or efficiency metadata
- `inspection_agency`, `inspection_conclusion`: audit-related metadata
- `battery_safety_passed`, `charger_safety_passed`, `appearance_grade`, `functional_test_passed`, `repair_history_declared`: structured checks
- `report_text`: synthetic inspection report body
- `risk_level`: annotation for human review only
- `audit_label`: training label, one of `PASS`, `REVIEW`, `FAIL`
- `reason_codes`: pipe-separated structured hints

Label guidance:

- `PASS`: structured fields are consistent and report text supports approval
- `REVIEW`: product is not clearly unsafe, but has conditional findings, refurbished risk, or incomplete certainty
- `FAIL`: safety or compliance risk is explicit, or critical information is missing for a risky category
