# Electronic Audit Dataset

`electronic_audit_dataset.csv` is a synthetic and real-recall mixed seed dataset for the prototype AI audit service.

To regenerate a larger dataset, run:

`./venv/Scripts/python.exe generate_dataset.py --rows 3200`

Synthetic `PASS` and `REVIEW` rows now use real common product names for part of the generated rows
(`--real-name-rate`, default `0.70`). Synthetic `FAIL` rows keep fictional names so that real brands are
not assigned invented safety-failure labels; real `FAIL` names come from recall imports.

To add real-world high-risk recall rows from the CPSC Recall Data API:

`./venv/Scripts/python.exe cpsc_recall_importer.py --max-rows 320`

To add Chinese real-world recall rows from the official domestic consumer-product recall notices:

`./venv/Scripts/python.exe china_recall_importer.py --max-pages 58 --max-rows 320`

Then regenerate the training dataset with the normalized real-world `FAIL` rows appended:

`./venv/Scripts/python.exe generate_dataset.py --rows 3200 --real-name-rate 0.82 --include-real-fail --real-fail-input data/cpsc_recall_fail_samples.csv --real-fail-input data/china_recall_fail_samples.csv --max-real-fail-rows 240`

The generator now injects:

- label-balanced category coverage
- more real common product names for synthetic `PASS` and `REVIEW`
- condition and compliance edge cases
- short or noisy report text
- OCR-style formatting noise
- minor text/field contradictions for robustness
- optional real CPSC recall text, hazard, incident, remedy, and source URL signals
- optional Chinese domestic recall text, defect, consequence, remedy, and source URL signals
- CPSC tablet disambiguation so medicine/vitamin tablet recalls do not enter the electronics dataset

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
