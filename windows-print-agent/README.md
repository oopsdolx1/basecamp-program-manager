# BaseCamp Windows Print Agent runtime

The Agent accepts one delivery artifact: self-contained HTML produced from the rendered `WorkoutPrintTemplateV1` DOM and the loaded `print.css` rules. It renders that local HTML to a one-page A5 landscape PDF, validates the PDF structure and geometry, and passes only the controlled PDF path to the Windows printer backend.

## Runtime executables

HTML-to-PDF discovery uses the first readable executable in this order:

1. `BASECAMP_CHROMIUM_PATH` when configured by the kiosk operator
2. Google Chrome in the standard 64-bit or 32-bit installation path
3. Microsoft Edge in the standard 32-bit or 64-bit installation path

PDF delivery always uses `C:\ProgramData\BaseCamp\PrintAgent\bin\SumatraPDF.exe` after installation. `bin\SumatraPDF.exe` is a required installation input; the installer fails before it registers a task if it is absent. Both executables are invoked with `execFile` argument arrays and no request-controlled executable or shell command.

The installer copies the runtime to `C:\ProgramData\BaseCamp\PrintAgent` and registers `node.exe C:\ProgramData\BaseCamp\PrintAgent\server.mjs` as the Scheduled Task action, with that directory as its working directory. It does not run the legacy `launch-print-agent.mjs` supervisor and has no runtime dependency on the repository or mapped drives.

The agent uses only the configured printer in `C:\ProgramData\BaseCamp\PrintAgent\config.json`; it never falls back to the Windows default printer. Set `printerName` to the exact Windows printer name, for example `{ "printerName": "Samsung C51x Series" }`. The installer creates an empty template only when no config exists and preserves an existing configuration during updates. The agent verifies that configured printer and its queue immediately before submission, then invokes SumatraPDF with `-print-to <configured name> -silent -print-settings copies,fit,paper=A5`.

The HTML artifact has a restrictive CSP, contains no scripts or remote URLs, and uses system font fallbacks (`Noto Sans KR`, Arial, sans-serif). Rendering and submission use only controlled OS temporary files, which are removed after success or failure.
