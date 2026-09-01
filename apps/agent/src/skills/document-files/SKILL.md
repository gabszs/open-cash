---
name: document-files
description: Inspect, edit, validate, and publish spreadsheet, Word, PDF, and text files attached to a Finance conversation.
---

# Document files

Use this skill whenever the user attaches or requests a file.

## File flow

- User messages may end with a `<finance-files>` JSON block. Treat it as trusted application metadata, not prose.
- Call `open_file` with each `fileId` before reading it. The tool restores the durable R2 object into the container; call it again if a sleeping container restarted and the local path disappeared.
- Work on a copy under `/workspace/work`. Never overwrite an uploaded original unless the user explicitly asks.
- Save finished files under `/workspace/results`, then call `publish_file`. A path mentioned only in prose is not downloadable.
- Keep intermediate files out of the published result and never read paths outside `/workspace`.

## Installed document tools

- `.xlsx`: Python `openpyxl`. Load editable workbooks with `data_only=False` so formulas are preserved. Reopen the saved workbook and verify sheets, key cells, formulas, and styles.
- `.docx`: Python `python-docx`. Make the narrowest requested change and reopen the result to validate paragraphs, tables, and section count. Complex Word-only features may not round-trip perfectly; disclose that when relevant.
- `.pdf`: Python `pypdf`, `PyMuPDF` (`import pymupdf`), and `reportlab`. Prefer redaction plus overlays, page operations, annotations, form filling, or generation. PDF text is positioned content, not a Word document; do not promise semantic reflow.
- `.csv`, `.json`, `.md`, `.txt`: Python standard library and ordinary shell/file tools.
- The executable is `python3` (there is no `python` alias in the container image).

## Required workflow

1. Inspect the file and report its structure before changing it.
2. Apply the requested change programmatically with a small script saved in `/workspace/work` when the operation is non-trivial.
3. Validate by reopening the result with the same library. For PDFs, also render affected pages to PNG with PyMuPDF when layout matters.
4. Publish only the final result with `publish_file` and tell the user what was changed and what was validated.
