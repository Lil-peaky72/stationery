# Stationery Windows Print Agent

This local service sends PDF files to printers installed in Windows. USB and Wi-Fi/network printers are both supported through the Windows printer queue.

## One-time setup on the shop's Windows computer

1. Install Node.js LTS for Windows.
2. Install SumatraPDF 64-bit from https://www.sumatrapdfreader.org/download-free-pdf-viewer
3. Install and test the printer in Windows Settings > Bluetooth & devices > Printers & scanners. Connect USB printers by cable; add Wi-Fi printers to the shop network.
4. Download this windows-print-agent folder from the Stationery GitHub repository.
5. Open PowerShell in this folder and run: npm install
6. Set a private pairing token in PowerShell (use a long random value): $env:STATIONERY_PRINT_TOKEN="replace-with-a-long-random-token"
7. If SumatraPDF is installed elsewhere, set $env:SUMATRA_PDF to its full executable path.
8. Run: npm start. Keep this window open while printing.

In Stationery Admin, paste the same token, click Connect & find printers, choose USB or Wi-Fi / Network, select the installed Windows printer, then test with a non-critical PDF.

## Notes

- The agent binds only to 127.0.0.1 and requires the pairing token.
- Never publish the pairing token or commit it to Git.
- The dashboard creates short-lived signed PDF URLs; the agent downloads each PDF and sends it to SumatraPDF.
- Print All sends jobs sequentially, one PDF at a time.
- Paper size and colour mode are displayed as preferences; driver-specific enforcement is not implemented in this first agent version. Set those defaults in Windows Printing Preferences.
- Silent printing depends on the printer driver, Windows permissions and SumatraPDF.
