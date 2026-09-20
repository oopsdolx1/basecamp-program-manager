# BaseCamp Windows Print Agent runtime

The Agent accepts one delivery artifact: self-contained HTML produced from the rendered `WorkoutPrintTemplateV1` DOM and the loaded `print.css` rules. It renders that local HTML to a one-page A5 landscape PDF, validates the PDF structure and geometry, and passes only the controlled PDF path to the Windows printer backend.

## Runtime executables

HTML-to-PDF discovery uses the first readable executable in this order:

1. `BASECAMP_CHROMIUM_PATH` when configured by the kiosk operator
2. Google Chrome in the standard 64-bit or 32-bit installation path
3. Microsoft Edge in the standard 32-bit or 64-bit installation path

PDF delivery uses `BASECAMP_SUMATRA_PATH` when configured, otherwise `windows-print-agent/bin/SumatraPDF.exe`. Both executables are invoked with `execFile` argument arrays and no request-controlled executable or shell command. Packaging these binaries is deferred; the Agent fails closed when either required engine is unavailable.

The HTML artifact has a restrictive CSP, contains no scripts or remote URLs, and uses system font fallbacks (`Noto Sans KR`, Arial, sans-serif). Rendering and submission use only controlled OS temporary files, which are removed after success or failure.