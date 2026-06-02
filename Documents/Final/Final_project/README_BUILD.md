# Final Project Document Build System

This directory contains a professional-grade Python build system that converts Markdown chapters into a submission-ready, IEEE-standard Word document (`.docx`).

## 🛠 Prerequisites

Ensure you have the following installed:

1.  **Python 3.8+**
2.  **Pandoc**: [Download here](https://pandoc.org/installing.html)
3.  **Python Dependencies**:
    ```bash
    pip install python-docx
    ```
4.  **Microsoft Word**: Required for the "Zero-Click" automated TOC and field refreshing.

---

## 🚀 How to Build

1.  **Sync Assets:** Ensure you have run `python sync_assets.py` from the root `Documents/` directory to populate the `assets/media/` folder.
2.  **Close Word:** Ensure `Final_Document_Built.docx` is not open.
3.  **Run the script**:
    ```bash
    python build_final.py
    ```
4.  **Automatic Refresh**: The script will combine your files and automatically update the Table of Contents, Page Numbers, and Figure/Table lists using Word in the background.

---

## ⚙️ Configuration (`build_config.json`)

You can control the document assembly without editing any code by modifying `build_config.json`:

*   **`order`**: A list of `.md` files in the exact order they should appear in the document.
*   **`output_docx`**: The name of the generated document.
*   **`reference_docx`**: The Word template used for styles (fonts, margins, colors).

---

## 📝 Markdown Syntax Guide

### 1. Page Numbering & Sections
The system manages complex numbering automatically:

*   **`<!-- SECTION_BREAK_ROMAN -->`**: Starts a new section with **Roman Numerals (i, ii, iii)**. Perfect for Declaration, Acknowledgements, and the Table of Contents.
*   **`<!-- SECTION_BREAK_ARABIC -->`**: Starts a new section with **Arabic Numerals (1, 2, 3)** and restarts the count at 1. Use this at the start of **Chapter 1**.
*   **`\\newpage`**: Inserts a standard page break.

### 2. Universal Styling
Map any line or header to a style from your Word template using the `{.StyleName}` tag:

*   **Headers**: `# Abstract {.title}`
    *   *Note: Headers marked with a style are automatically included in the Table of Contents.*
*   **Paragraphs**: `DAWIT BERHAN WDU1304696 {.Cover}`

### 3. Tables & Captions
Academic standards require table captions at the **top**:

```markdown
<caption>System Component Specifications</caption>
| Component | Specification |
|-----------|---------------|
| Arduino   | Mega 2560     |
```
*   The script converts `<caption>` into a numbered, styled Word caption.

### 4. Figures (Images)
Images with dimensions are treated as numbered figures:

```markdown
![System Architecture Diagram](./assets/media/image.png){width=5.0in}
```

---

## 🔧 Troubleshooting

### Automation Security
If the "Zero-Click" refresh fails, you may need to grant permission to the script:
1.  Open Word.
2.  Go to `File > Options > Trust Center > Trust Center Settings > Macro Settings`.
3.  Check **"Trust access to the VBA project object model"**. 

*If automation is still blocked, open the document, press `Ctrl + A` then `F9` to refresh manually.*

### Style Reference
To change the document's look (fonts, spacing), edit **`Final_Document.docx`**. This file acts as the master style guide for the build process.
