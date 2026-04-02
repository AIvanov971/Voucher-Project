Voucher Maker

Voucher Maker is an offline desktop application built with Electron for creating, managing, and exporting vouchers as PDF or PNG files. The application supports QR codes, images, and customizable templates. All data is stored locally.

Installation
npm install
npm run start
Available Scripts

npm run start – Start the Electron application

npm run test:smoke – Run export test (PDF and PNG)

npm run pack – Build without installer

npm run dist – Build Windows installer (NSIS)

Project Structure

main.js – Main process, IPC, templates, export, storage

preload.js – Secure IPC bridge

renderer/ – UI (HTML/CSS/JS)

src/exporter.js – PDF/PNG rendering logic

templates/ – Voucher templates

tests/ – Smoke tests

Templates

Each template is located in templates/<templateId>/ and contains:

template.json – Metadata

layout.json – Field configuration (text, QR, image)

assets/ – Backgrounds, logos, images

Page size can be defined in pixels (widthPx, heightPx) or millimeters (e.g. "210mm").

Storage

Settings: settings.json in app.getPath('userData')

Vouchers: vouchers/vouchers.json

Images: vouchers/assets/<voucherId>/

Database: vouchers.db (SQLite)

Exports are saved to the user’s Downloads folder by default.

If better-sqlite3 fails, the app falls back to JSON storage.

Testing

npm run test:smoke creates a temporary template and exports PDF and PNG files to verify the export system.

Voucher Maker is designed as a fully offline solution for generating and managing vouchers locally.
