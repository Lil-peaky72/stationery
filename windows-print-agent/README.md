# Stationery Windows Print Agent

This local service sends PDF files to printers installed in Windows. USB and Wi-Fi/network printers are both supported through the Windows printer queue.

## One-time setup on the shop's Windows computer

1. Install Node.js LTS for Windows.
2. Install SumatraPDF 64-bit from https://www.sumatrapdfreader.org/download-free-pdf-viewer
3. Install and test the printer in Windows Settings > Bluetooth & devices > Printers & scanners. Connect USB printers by cable; add Wi-Fi printers to the shop network.
4. Download this windows-print-agent folder from the Stationery GitHub repository.
5. Open PowerShell in this folder and run: `npm install`
6. Create a private pairing token (a long random value) and tell the agent your Supabase project URL:

```powershell
$env:STATIONERY_PRINT_TOKEN = [guid]::NewGuid().ToString('N') + [guid]::NewGuid().ToString('N')
$env:STATIONERY_SUPABASE_URL = "https://YOUR-PROJECT.supabase.co"
$env:STATIONERY_PRINT_TOKEN   # shows the token so you can paste it into Stationery Admin
```

7. If SumatraPDF is installed elsewhere, set `$env:SUMATRA_PDF` to its full executable path.
8. If the shop site is served from a different address than https://stationery-peaky7.vercel.app, set `$env:STATIONERY_ALLOWED_ORIGINS` to a comma-separated list of allowed site addresses (include `http://localhost:5173` if you test locally).
9. Run: `npm start`. Keep this window open while printing.

In Stationery Admin (`/admin`), paste the same token, click Connect & find printers, choose USB or Wi-Fi / Network, select the installed Windows printer, then test with a non-critical PDF.

## Security

- The agent listens only on 127.0.0.1 and answers only requests addressed to the local machine.
- Every request needs the pairing token (at least 24 characters). The agent refuses to start without one.
- It only downloads PDFs from your own Supabase project's private `print-jobs` storage (signed links), never from other websites.
- It only prints to printers that Windows reports as installed, checks that the download is a real PDF of 20 MB or less, and runs one print job at a time.
- Never publish the pairing token or commit it to Git.

## Print settings

Each order carries its own copies, paper size (A4, A3, Letter, Legal) and colour or black & white choice. The agent passes these to SumatraPDF. Whether a printer honours them still depends on its driver, so check the Windows Printing Preferences defaults and test with a non-critical PDF first.

## Notes

- Silent printing depends on the printer driver, Windows permissions and SumatraPDF.
- Print All in the admin page sends jobs sequentially, one PDF at a time.
