"""
Final Project Document Build System
-----------------------------------
This script automates the assembly of Markdown chapters into a professional,
submission-ready Word document. 

Features:
- Configuration-based assembly order (build_config.json)
- Automatic Table of Contents and Page Number refreshing
- Specialized Roman/Arabic section management
- Custom Word style injection via Markdown tags
- Standardized academic table captioning
"""

import os
import subprocess
import sys
import re
import json
from docx import Document
from docx.oxml import OxmlElement, ns
from docx.enum.text import WD_ALIGN_PARAGRAPH

# --- Constants & Configuration ---
CONFIG_FILE = "build_config.json"
TEMP_MD_FILE = "FULL_REPORT_TEMP.md"

def load_build_configuration():
    """
    Loads assembly order and filenames from JSON. 
    Creates a default config if one does not exist.
    """
    if not os.path.exists(CONFIG_FILE):
        default_config = {
            "order": [
                "TOP_part.md", "CH1.md", "CH2.md", "CH3.md", 
                "CH4.md", "CH5.md", "CH6.md", "CH7.md", 
                "Reference.md", "Appendices.md"
            ],
            "output_docx": "Final_Document_Built.docx",
            "reference_docx": "Final_Document.docx"
        }
        with open(CONFIG_FILE, "w", encoding="utf-8") as f:
            json.dump(default_config, f, indent=4)
        return default_config
    
    with open(CONFIG_FILE, "r", encoding="utf-8") as f:
        return json.load(f)

# --- Word Field Helpers ---

def create_word_field(parent_paragraph, instruction):
    """
    Injects a raw Word Field code (e.g., TOC, SEQ, PAGE) into a paragraph.
    """
    run = parent_paragraph.add_run()
    r_element = run._r
    
    # Start the field
    fldChar_begin = OxmlElement('w:fldChar')
    fldChar_begin.set(ns.qn('w:fldCharType'), 'begin')
    r_element.append(fldChar_begin)

    # Insert the instruction
    instrText = OxmlElement('w:instrText')
    instrText.set(ns.qn('xml:space'), 'preserve')
    instrText.text = instruction
    r_element.append(instrText)

    # End the field
    fldChar_end = OxmlElement('w:fldChar')
    fldChar_end.set(ns.qn('w:fldCharType'), 'end')
    r_element.append(fldChar_end)

def add_automated_caption(paragraph, label):
    """
    Creates a numbered caption (e.g., Table 4-1: ) using Word Sequence fields.
    """
    paragraph.text = ""
    paragraph.add_run(f"{label} ")
    
    # Use StyleRef to get the current chapter number from Heading 1
    create_word_field(paragraph, ' STYLEREF 1 \\s ')
    paragraph.add_run("-")
    
    # Use Seq to get the incrementing number within the chapter
    create_word_field(paragraph, f' SEQ {label} \\* ARABIC \\s 1 ')
    paragraph.add_run(": ")

def insert_list_placeholder_field(paragraph, list_type):
    """
    Inserts the active Word field for Table of Contents, Figures, or Tables.
    """
    paragraph.text = ""
    if list_type == "TOC":
        # Maps levels 1-3 AND custom styles 'Title' and 'Cover' to the TOC
        instruction = ' TOC \\o "1-3" \\h \\z \\u \\t "Title,1,title,1,Cover,1" '
    elif list_type == "LOF":
        instruction = ' TOC \\h \\z \\c "Figure" '
    elif list_type == "LOT":
        instruction = ' TOC \\h \\z \\c "Table" '
    
    create_word_field(paragraph, instruction)

def add_centered_page_number(paragraph):
    """
    Adds a dynamic PAGE field to a paragraph and centers it.
    """
    paragraph.alignment = WD_ALIGN_PARAGRAPH.CENTER
    create_word_field(paragraph, "PAGE")

# --- Section & Style Logic ---

def set_section_page_numbering(section, start_value, format_code):
    """
    Configures the numbering format and starting page for a document section.
    """
    sectPr = section._sectPr
    pgNumType = sectPr.xpath('./w:pgNumType')
    
    if not pgNumType:
        pgNumType = OxmlElement('w:pgNumType')
        sectPr.append(pgNumType)
    else:
        pgNumType = pgNumType[0]
    
    if start_value is not None:
        pgNumType.set(ns.qn('w:start'), str(start_value))
    
    if format_code:
        pgNumType.set(ns.qn('w:fmt'), format_code)

def apply_named_style(document, paragraph, style_name, is_header=False):
    """
    Applies a Word style by name (case-insensitive). 
    If style is missing, falls back to default.
    If is_header is True, ensures the paragraph appears in the TOC.
    """
    target_style = None
    for style in document.styles:
        if style.name.lower() == style_name.lower():
            target_style = style
            break
            
    if target_style:
        try:
            if target_style.type == 1: # Paragraph Style
                paragraph.style = target_style
            elif target_style.type == 2: # Character Style
                if not paragraph.runs:
                    paragraph.add_run(paragraph.text)
                    paragraph.text = ""
                for run in paragraph.runs:
                    run.style = target_style
            print(f"    - Applied style '{target_style.name}' to '{paragraph.text[:30]}...'")
        except Exception as e:
            print(f"    ! Error applying style '{style_name}': {e}")
    
    if is_header:
        # Force Outline Level 1 (0 in OpenXML) so it shows in TOC regardless of style
        try:
            pPr = paragraph._element.get_or_add_pPr()
            outlineLvl = OxmlElement('w:outlineLvl')
            outlineLvl.set(ns.qn('w:val'), '0')
            pPr.append(outlineLvl)
        except:
            pass

# --- Automations ---

def refresh_all_fields_via_word(file_path):
    """
    Uses a background PowerShell session to automate Word field refreshing.
    This replaces the manual Ctrl+A, F9 steps.
    """
    absolute_path = os.path.abspath(file_path)
    print(f"  + Auto-refreshing TOC and Page Numbers via Word automation...")
    
    ps_script = f"""
    $word = New-Object -ComObject Word.Application
    $word.Visible = $false
    try {{
        $doc = $word.Documents.Open('{absolute_path}')
        $doc.Fields.Update()
        $doc.TablesOfContents | ForEach-Object {{ $_.Update() }}
        $doc.TablesOfFigures | ForEach-Object {{ $_.Update() }}
        $doc.Save()
        $doc.Close()
        Write-Host "SUCCESS"
    }} catch {{
        Write-Host "ERROR: $($_.Exception.Message)"
    }} finally {{
        $word.Quit()
    }}
    """
    
    try:
        process = subprocess.run(["powershell", "-Command", ps_script], capture_output=True, text=True)
        if "SUCCESS" in process.stdout:
            print("    - Refresh complete.")
        else:
            print(f"    ! Auto-refresh failed: {process.stdout.strip()}")
            print("    ! You may need to press F9 manually in Word.")
    except Exception as e:
        print(f"    ! PowerShell automation failed: {e}")

# --- Build Phases ---

def post_process_docx(file_path):
    """
    Final polishing of the Word document: handling placeholders and section rules.
    """
    print(f"Polishing {file_path}...")
    doc = Document(file_path)
    
    # 1. Replace markers with active Word features
    for paragraph in doc.paragraphs:
        text = paragraph.text.strip()
        
        if text.startswith("AUTO_FIG:"):
            caption_content = text.replace("AUTO_FIG:", "").strip()
            if caption_content:
                add_automated_caption(paragraph, "Figure")
                paragraph.add_run(caption_content)
                apply_named_style(doc, paragraph, "Caption")
            else:
                paragraph.text = "" 
                
        elif text.startswith("AUTO_TBL:"):
            caption_content = text.replace("AUTO_TBL:", "").strip()
            if caption_content:
                add_automated_caption(paragraph, "Table")
                paragraph.add_run(caption_content)
                apply_named_style(doc, paragraph, "Caption")
            else:
                paragraph.text = "" 
                
        elif "CUSTOM_HDR_STYLE_" in text:
            match = re.search(r'CUSTOM_HDR_STYLE_(.*?)_(.*)', text)
            if match:
                style_name, content = match.groups()
                paragraph.text = content.strip()
                apply_named_style(doc, paragraph, style_name, is_header=True)
                
        elif "CUSTOM_TXT_STYLE_" in text:
            match = re.search(r'CUSTOM_TXT_STYLE_(.*?)_(.*)', text)
            if match:
                style_name, content = match.groups()
                # Remove the style marker while preserving non-text runs (like images)
                for run in paragraph.runs:
                    if "CUSTOM_TXT_STYLE_" in run.text:
                        # Only replace the marker part in the specific run that contains it
                        run.text = run.text.replace(f"CUSTOM_TXT_STYLE_{style_name}_", "")
                        break 
                apply_named_style(doc, paragraph, style_name, is_header=False)
                
        elif "TOCPLACEHOLDER" in text:
            insert_list_placeholder_field(paragraph, "TOC")
        elif "LOFPLACEHOLDER" in text:
            insert_list_placeholder_field(paragraph, "LOF")
        elif "LOTPLACEHOLDER" in text:
            insert_list_placeholder_field(paragraph, "LOT")
                
        # 2. Handle Tab Markers
        if "[TAB]" in text.upper():
            for run in paragraph.runs:
                # Case-insensitive replacement
                run.text = re.sub(r'\[TAB\]', '\t', run.text, flags=re.IGNORECASE)

    # 3. Configure Section Numbering
    print(f"  Found {len(doc.sections)} sections. Applying numbering rules...")
    for index, section in enumerate(doc.sections):
        # Allow independent footers
        section.footer.is_linked_to_previous = False
        
        if index == 0:
            # Cover Page Section
            print("    - Section 0 (Cover): Removing numbering")
            for footer_p in section.footer.paragraphs:
                footer_p.text = ""
            continue
            
        if index == 1:
            # Front Matter (Roman Numerals i, ii, iii)
            print("    - Section 1 (Front Matter): Lower Roman, start at 1")
            set_section_page_numbering(section, 1, 'lowerRoman')
        elif index >= 2:
            # Main Body (Arabic Numerals 1, 2, 3)
            if index == 2:
                print("    - Section 2 (Body Start): Arabic, restart at 1")
                set_section_page_numbering(section, 1, 'decimal')
            else:
                # Subsequent sections continue numbering
                set_section_page_numbering(section, None, 'decimal')
        
        # Add the centered page number field to the footer
        footer_para = section.footer.paragraphs[0] if section.footer.paragraphs else section.footer.add_paragraph()
        footer_para.text = "" 
        add_centered_page_number(footer_para)
    
    # Enable fallback for non-automation environments
    from docx.oxml.ns import qn
    settings = doc.settings._element
    update_on_open = settings.find(qn('w:updateFields'))
    if update_on_open is None:
        update_on_open = OxmlElement('w:updateFields')
        update_on_open.set(qn('w:val'), 'true')
        settings.append(update_on_open)
        
    doc.save(file_path)

def preprocess_markdown(text):
    """
    Converts custom signals into intermediate placeholders for post-processing.
    """
    # 1. Handle Custom Styles: # Header {.Style} and Text {.Style}
    text = re.sub(r'^#\s+(.*?)\s+\{\.(.*?)\}', r'# CUSTOM_HDR_STYLE_\2_\1', text, flags=re.MULTILINE)
    text = re.sub(r'^(?!#)(.*?)\s+\{\.(.*?)\}', r'CUSTOM_TXT_STYLE_\2_\1', text, flags=re.MULTILINE)

    # 2. Handle Tab Markers (Convert lines with [tab] to raw OpenXML paragraphs)
    processed_lines = []
    for line in text.split('\n'):
        if '[tab]' in line.lower():
            # Extract style if present: "Text [tab] Text {.Style}"
            style_match = re.search(r'\{\.(.*?)\}', line)
            style_xml = ""
            clean_line = line
            if style_match:
                style_name = style_match.group(1)
                style_xml = f'<w:pPr><w:pStyle w:val="{style_name}"/></w:pPr>'
                clean_line = re.sub(r'\s*\{\..*?\}', '', line)
            
            # Split by [tab] and build XML runs
            parts = re.split(r'\[tab\]', clean_line, flags=re.IGNORECASE)
            xml_content = f'```{{=openxml}}\n<w:p>{style_xml}'
            for i, part in enumerate(parts):
                # Clean up bold/italic markers if they are being passed through raw
                part = part.replace('**', '').replace('*', '')
                xml_content += f'<w:r><w:t xml:space="preserve">{part}</w:t></w:r>'
                if i < len(parts) - 1:
                    xml_content += '<w:r><w:tab/></w:r>'
            xml_content += '</w:p>\n```'
            processed_lines.append(xml_content)
        else:
            processed_lines.append(line)
    text = '\n'.join(processed_lines)

    # 3. Handle Table Captions (Convert signals and ensure blank line for Pandoc)
    lines = text.split('\n')
    processed_lines = []
    for line in lines:
        stripped = line.strip()
        if stripped.lower().startswith('<caption>') or stripped.startswith('<!-- CAPTION:'):
            caption_text = ""
            if stripped.startswith('<!--'):
                match = re.search(r'<!--\s*CAPTION:\s*(.*?)\s*-->', stripped, re.IGNORECASE)
                caption_text = match.group(1) if match else ""
            else:
                caption_text = re.sub(r'</?caption>', '', stripped, flags=re.IGNORECASE).strip()
            
            clean_name = re.sub(r'^(Table)\s*[\d\.\-]*[:\s]*', '', caption_text, flags=re.IGNORECASE).strip()
            if clean_name:
                processed_lines.append(f'AUTO_TBL: {clean_name}')
                processed_lines.append('') # Crucial spacing
        else:
            processed_lines.append(line)
    text = '\n'.join(processed_lines)

    # 3. Handle Figure/Image Blocks
    figure_pattern = re.compile(r'<figure>.*?(<img[^>]+>).*?<figcaption>(.*?)</figcaption>.*?</figure>', re.DOTALL | re.IGNORECASE)
    def figure_match_callback(match):
        img_tag = match.group(1)
        caption_html = match.group(2)
        caption_text = re.sub(r'<[^>]+>', '', caption_html).strip()
        clean_caption = re.sub(r'^(Figure|Fig)\s*[\d\.\-]*[:\s]*', '', caption_text, flags=re.IGNORECASE).strip()
        src = re.search(r'src="([^"]+)"', img_tag).group(1)
        width = re.search(r'width:([\d\.]+)in', img_tag)
        height = re.search(r'height:([\d\.]+)in', img_tag)
        w_arg = f'width={width.group(1)}in' if width else ""
        h_arg = f'height={height.group(1)}in' if height else ""
        return f'\n![AUTO_FIG: {clean_caption}]({src}){{{w_arg} {h_arg}}}\n'
    text = figure_pattern.sub(figure_match_callback, text)

    standalone_img_pattern = re.compile(r'<img\s+[^>]*src="([^"]+)"[^>]*>', re.IGNORECASE | re.DOTALL)
    def img_match_callback(match):
        full_tag = match.group(0)
        src = match.group(1)
        alt_match = re.search(r'alt="([^"]*)"', full_tag)
        alt_text = alt_match.group(1) if alt_match else ""
        if "width" in full_tag or "height" in full_tag:
            clean_alt = re.sub(r'^(Figure|Fig)\s*[\d\.\-]*[:\s]*', '', alt_text, flags=re.IGNORECASE).strip()
            if clean_alt:
                alt_text = "AUTO_FIG: " + clean_alt
        width = re.search(r'width:([\d\.]+)in', full_tag)
        height = re.search(r'height:([\d\.]+)in', full_tag)
        w_arg = f'width={width.group(1)}in' if width else ""
        h_arg = f'height={height.group(1)}in' if height else ""
        return f'![{alt_text}]({src}){{{w_arg} {h_arg}}}'
    text = standalone_img_pattern.sub(img_match_callback, text)

    # 4. Handle Page and Section Breaks
    text = text.replace('\\newpage', '\n```{=openxml}\n<w:p><w:r><w:br w:type="page"/></w:r></w:p>\n```\n')
    text = text.replace('<!-- SECTION_BREAK_ROMAN -->', '\n```{=openxml}\n<w:p><w:pPr><w:sectPr><w:pgNumType w:fmt="romanLower" w:start="1"/><w:type w:val="nextPage"/></w:sectPr></w:pPr></w:p>\n```\n')
    text = text.replace('<!-- SECTION_BREAK_ARABIC -->', '\n```{=openxml}\n<w:p><w:pPr><w:sectPr><w:pgNumType w:fmt="decimal" w:start="1"/><w:type w:val="nextPage"/></w:sectPr></w:pPr></w:p>\n```\n')
    text = text.replace('<!-- SECTION_BREAK -->', '\n```{=openxml}\n<w:p><w:pPr><w:sectPr><w:type w:val="nextPage" /></w:sectPr></w:pPr></w:p>\n```\n')

    # 5. Insert Automated List Placeholders
    text = re.sub(r'# (?:CUSTOM_HDR_STYLE_.*?_)?Table of Contents', r'\g<0>\n\nTOCPLACEHOLDER\n', text, flags=re.IGNORECASE)
    text = re.sub(r'# (?:CUSTOM_HDR_STYLE_.*?_)?List of Figures', r'\g<0>\n\nLOFPLACEHOLDER\n', text, flags=re.IGNORECASE)
    text = re.sub(r'# (?:CUSTOM_HDR_STYLE_.*?_)?List of Tables', r'\g<0>\n\nLOTPLACEHOLDER\n', text, flags=re.IGNORECASE)
    
    return text

def execute_build():
    """
    Main orchestration function for the build system.
    """
    config = load_build_configuration()
    assembly_order = config.get("order", [])
    output_docx = config.get("output_docx", "Final_Document_Built.docx")
    style_reference = config.get("reference_docx", "Final_Document.docx")
    
    print("--- Starting Final Document Build ---")
    
    try:
        # Step 1: Combine and Preprocess
        with open(TEMP_MD_FILE, "w", encoding="utf-8") as output_markdown:
            for filename in assembly_order:
                if os.path.exists(filename):
                    print(f"  + Processing {filename}")
                    with open(filename, "r", encoding="utf-8") as source_file:
                        source_text = source_file.read()
                        processed_text = preprocess_markdown(source_text)
                        output_markdown.write(processed_text + "\n\n")
                else:
                    print(f"  ! Warning: {filename} missing, skipping.")
        
        # Step 2: Convert to Word via Pandoc
        print(f"Converting to Word via Pandoc...")
        pandoc_cmd = [
            "pandoc", TEMP_MD_FILE, 
            "-o", output_docx, 
            "--from", "markdown+implicit_figures+table_captions+raw_attribute", 
            "--resource-path", ".", 
            "--standalone"
        ]
        
        if os.path.exists(style_reference):
            print(f"  Using style reference: {style_reference}")
            pandoc_cmd.extend(["--reference-doc", style_reference])
        
        conversion_result = subprocess.run(pandoc_cmd)
        
        if conversion_result.returncode == 0:
            # Step 3: Polish in Python (Styles, Sections, Footers)
            post_process_docx(output_docx)
            
            # Step 4: Final Automation (Background Word Field Update)
            refresh_all_fields_via_word(output_docx)
            
            print(f"Build Successful! Created: {output_docx}")
        else:
            print("  ! Pandoc conversion failed.")
            
        # Cleanup
        if os.path.exists(TEMP_MD_FILE):
            os.remove(TEMP_MD_FILE)
            
    except Exception as e:
        print(f"Error during build process: {e}")
        sys.exit(1)

if __name__ == "__main__":
    execute_build()
