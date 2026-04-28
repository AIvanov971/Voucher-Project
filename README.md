Voucher Maker

Voucher Maker is a production-oriented Electron desktop application for creating, managing, and exporting vouchers as PDF or PNG files. The application supports QR codes, images, customizable templates, local scheduling, and AdventureWebsite reservation sync.

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

Voucher Maker can run fully offline for voucher generation, then sync with AdventureWebsite when a sync server is configured.

AdventureWebsite sync

The app syncs with the AdventureWebsite API through the legacy-compatible endpoints:

- POST /auth/login
- POST /sync/push
- GET /sync/pull

Add sync settings to settings.json:

```json
{
  "sync": {
    "baseUrl": "https://your-api-host.example.com",
    "email": "desktop-sync@example.com",
    "password": "your-production-sync-password",
    "orgId": "local"
  }
}
```

`sync.baseUrl` is preferred, but Windows/customer configs can also use `sync.URL`, `sync.url`, or `sync.baseURL`.
If no URL is configured, packaged builds default to `https://adventure-website-api.vercel.app`.

On macOS, packaged builds read this from `~/Library/Application Support/LN software/settings.json`.
On Windows, packaged builds read this from `%APPDATA%\LN software\settings.json`.
As a fallback, the Windows app also checks for `settings.json` next to `LN software.exe`.
Windows/macOS build commands run `scripts/prepare-bundled-settings.js` first. That script creates an ignored
`build/settings.json` from build environment variables, the current machine's app settings, or the sibling
AdventureWebsite `.env`, then packages it into the installer so a fresh Windows install can sync without manually
creating `%APPDATA%\LN software\settings.json`.
Local development runs may read `~/Library/Application Support/LNvoucher-maker/settings.json`; the app now falls back between both locations.

For local sync, keep the AdventureWebsite API running at the configured `baseUrl`:

```bash
cd /Users/angel/Documents/WebProjects/AdventurerWebsite/AdventureWebsite
corepack pnpm --filter @adventure/api dev
```

Then check `http://localhost:4000/health`.

Website catalog seed:

```bash
npm run seed:website
```

Push pending desktop changes without opening the UI:

```bash
npm run sync:now
```

Website reservations

After a successful sync, website-created reservations are stored in the same local `bookings` database as desktop bookings with `source: "public"`. Open the desktop app's `Reservations` tab to review website reservations, search by customer/service/voucher/note, filter by status/source, and open a reservation for edits.

The seed keeps the desktop catalog aligned with the AdventureWebsite services:

- ATV Старт край Калофер - 75 min - 129.00 BGN / 65.96 EUR
- Premium ATV Панорама - 120 min - 189.00 BGN / 96.63 EUR
- UTV / Buggy Central Balkan - 110 min - 249.00 BGN / 127.31 EUR
- Paintball Forest Arena - 90 min - 220.00 BGN / 112.48 EUR
- Разходки с джип край Калофер - 90 min - on request
- Детска писта - 60 min - on request

It also creates Kalofer resources for ATV, UTV / Buggy, Jeep, Paintball, and Детска писта, with daily 08:00 and 15:00 booking slots.

Use the same email and password as the API environment variables DESKTOP_SYNC_EMAIL and DESKTOP_SYNC_PASSWORD. Schedule data from the Chromium app is pushed as services, resources, resource_services, availability_rules, availability_exceptions, customers, bookings, vouchers, and voucher_redemptions.
