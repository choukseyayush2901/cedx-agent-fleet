# Decisions

## Industry

I chose operations workflow automation because the seed maps naturally to governed work requests with owner, deadline, category, amount, and notes.

## Outliers

The outlier detector uses a robust threshold: median amount plus the greater of `10 * MAD` or `5 * median`. This catches extreme magnitudes without hardcoding seed IDs or exact values.

## Abstention

Ambiguous category markers, unclear wording, and inconsistent free text become `LOW_CONFIDENCE`. The fleet abstains instead of guessing because Class-A records must never silently reach delivery.

## Router Policy

Clean records route to `gpt-4o-mini`. High-value or ambiguous-looking records route to a stronger model unless an earlier deterministic exception blocks them. This keeps average cost low while preserving a path for hard records.

## Provenance

The canonical hash function matches `verify_audit.py`: sorted JSON, compact separators, SHA-256 URI. Delivered fields hash to Worker transcripts, and audit records carry source version hashes.

## What Breaks First At 10k/day

The first bottleneck would be SQLite write contention and filesystem transcript volume. The next step would move append-only events and transcripts to durable object storage with a transactional index.

## CASE_ID

Default local CASE_ID is `CEDX-XXXX`. The amendment role and threshold are derived at runtime from `sha256(CASE_ID)`.
