# Google Sheets grid capacity recovery

The history sheet reached its allocated row count (992). A write to A993 failed; the durable pending write was retried on each state read and prevented loading.

Sheet writes now handle only the specific `exceeds grid limits` response by reading that spreadsheet's grid properties, appending rows/columns as needed, then retrying the identical values request once. Rows grow by at least 256. Append-only dimension changes do not shrink grids or modify existing cells. Normal writes add no extra requests. Existing WAL replay uses the same code, keeps the pending task on failure, and clears it only after success.

No credentials, data routing, audience, AI deployment scope or WhatsApp delivery behavior changes. No manual Google data deletion or reimport is required. Real account access/quota failures remain errors.

Validation: isolated row-993 reproduction, column growth, stable retry payload, successful WAL recovery, normal fast path, and permission-failure retention, plus existing workflow regression suites. Production recovery still requires the owner to refresh and verify real data loads.

Rollback: deploy prior version 45 if needed; it will again reject writes outside the current grid. Preserve pending browser and server queues. Prefer correcting capacity and rolling forward.
