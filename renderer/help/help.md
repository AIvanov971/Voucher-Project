# Overview
- Offline voucher creator for PDF/PNG with templates, QR, and images.
- Two main areas: Vouchers (create/export) and Template Builder (design templates).

## Creating a Voucher
- Pick a template from cards.
- Fill text fields; date fields use calendar inputs.
- Add Instagram/Facebook links; QR codes are generated automatically.
- Upload images for template image fields using "Upload Image".
- Use "Save" to store, "Save As Copy" to duplicate.
- Select a saved voucher to re-edit or re-export.

## Export
- Export PDF or PNG from the form actions.
- Files are saved to your Downloads folder (or the path shown after export).
- PNG export captures the current layout; PDF uses print with background.

## Template Builder
- Select a template or create a new one.
- Duplicate to start from an existing layout.
- Set background and logo from images.
- Add fields: Text, QR, Image. Drag to move; use the handle to resize.
- Edit properties: key, label, position (x/y/w/h), font family/size/weight/color/alignment for text.
- Save Template to persist meta and layout; then use it in Vouchers.

## Troubleshooting
- Missing assets: ensure background/logo/image files exist under templates/<id>/assets/.
- Template not appearing: check templates folder and id naming; reload app.
- Export errors: confirm template files are valid JSON; retry export.

## Keyboard Shortcuts
- F1: Open Help
- Ctrl+S (Cmd+S): Save voucher
- Ctrl+E (Cmd+E): Export PDF
