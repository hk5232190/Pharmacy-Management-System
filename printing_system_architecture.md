# Printing System Architecture

## 1. Core Architecture Pattern
The printing system is designed with a "Single Data Source, Multiple Renderers" pattern.

- **Frontend (React)**: Handles the UI, state, previews, and HTML-based system printing.
- **Backend (Rust/Tauri)**: Handles heavy lifting (PDF generation) and direct hardware interfacing (ESC/POS over USB/Network).
- **Settings State**: A globally stored PrintSettings configuration object dictates layout, width, printer destination, and boolean flags for what data fields to show/hide.

## 2. Execution Paths
When a user triggers `handlePrint()`, the system checks `print.destination` and routes the request down one of three distinct execution paths.

### Path A: "Print Window" (System OS Print Dialog)
This relies purely on the browser/webview engine to render an HTML layout and trigger the OS print dialog.

- **Invocation**: Frontend intercepts the request.
- **HTML Generation**: A dynamic, invisible `<iframe>` is appended to the DOM.
- **Styling**: Raw HTML/CSS is injected into the iframe. The CSS uses precise millimeters (`width: 58mm` or `width: 80mm`) and `@page { margin: 0; }` to perfectly map to receipt paper sizes.
- **Execution**: The frontend waits for `documentToPrint.fonts.ready` and image loading, then calls `iframe.contentWindow.print()`.
- **Cleanup**: The iframe is automatically removed via an `afterprint` event listener or a timeout.

### Path B: "Thermal" (Raw ESC/POS)
This bypasses the OS print dialog entirely, talking directly to the printer hardware via Tauri commands.

- **Invocation**: Frontend invokes `print_thermal_receipt` via Tauri IPC, passing the `ReceiptResponse` DTO and the targeted printer name.
- **Abstract Block Rendering (Rust)**: `src-tauri/src/thermal/renderer.rs` converts the DTO into a sequence of abstract syntax blocks (e.g., `Block::Header`, `Block::Row`, `Block::Divider`). Crucially, this is where the `PrintSettings` boolean toggles (like `show_payment_month`) are evaluated.
- **Byte Compilation**: The blocks are passed to the ESC/POS compiler. Based on the `thermal_characters_per_line` setting (e.g., 32 or 42), the text is strictly wrapped and padded with spaces to align columns correctly. It is then compiled into a `Vec<u8>` containing raw ESC/POS hex commands (e.g., `0x1B 0x40` for init, `0x0A` for line feeds).
- **Hardware Dispatch**: Using a cross-platform printing crate, the byte array is pushed directly into the OS printer spooler (or direct IP/USB buffer) targeting the specified printer name.
- **Fallback**: If the hardware fails or printer name is invalid, the backend returns a fallback mode to the frontend, which gracefully falls back to Path A (Print Window).

### Path C: "PDF" (Headless PDF Generation)
Used for saving receipts digitally.

- **Invocation**: Frontend invokes `print_receipt` via Tauri IPC.
- **HTML Templating (Rust)**: The backend generates an HTML string exactly like Path A, but does so natively in Rust.
- **PDF Rendering**: The backend uses the `tauri-plugin-printing` API (or a headless webview instance) to render the HTML string into a PDF byte stream.
- **File Output**: The PDF is saved to a temporary or user-specified directory on disk.
- **OS Execution**: The backend executes an OS-level command to open the resulting PDF file using the system's default PDF viewer (e.g., using `opener` or `open` crates).

## 3. Data Flow & Feature Toggles
To ensure the printed output matches the UI preview exactly regardless of the execution path, data mapping is strictly governed by `PrintSettings`.

- **The DTO (`ReceiptResponse`)**: Contains all possible data fields (e.g., `amount`, `payment_month`, `member_name`).
- **The Filter**: Before any renderer (React component, HTML string builder, or Rust Thermal Block builder) processes a field, it checks the corresponding boolean flag in the settings.

```rust
// Example from Rust thermal renderer
if print.show_payment_month {
    if let Some(month) = &receipt.payment_month {
        blocks.push(Block::Row("Payment Month".to_string(), month.clone()));
    }
}
```

- **The Benefit**: Adding a new field (like "Payment Month") requires updating the DTO, adding a boolean toggle to `PrintSettings`, and adding the conditional logic to the three renderers (React Preview, HTML String, Thermal Blocks).

## 4. Key Takeaways for Porting
If you are porting this to another framework (like Electron or a web-only app):

- **Abstract your Thermal Logic**: Do not write raw bytes in your UI layer. Map data -> Abstract Blocks -> Raw Bytes.
- **Invisible iFrames**: The invisible iframe approach is the most reliable way to trigger pixel-perfect CSS prints without navigating away from the current SPA view.
- **Character Math**: When doing ESC/POS, rely on fixed character limits (32 or 42). Use simple string padding and splitting functions to align Left/Right key-value pairs (e.g., `Total...........$20.00`).
