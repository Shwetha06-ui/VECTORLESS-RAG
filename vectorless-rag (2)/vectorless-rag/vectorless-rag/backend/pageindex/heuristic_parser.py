"""
Robust heuristic-based PDF parser - NO LLM calls.
Extracts headings by font analysis, numbered patterns, and formatting cues.
"""
import pymupdf
import re
from typing import List, Dict


# Patterns that look like section headings
HEADING_PATTERNS = [
    r'^\d+\.?\s+[A-Z]',           # "1. Introduction", "1 Introduction"
    r'^\d+\.\d+\.?\s+',           # "1.1 Subsection"
    r'^\d+\.\d+\.\d+\.?\s+',      # "1.1.1 Sub-subsection"
    r'^[IVXLC]+\.?\s+[A-Z]',     # "III. Methods"
    r'^[A-Z]\.?\s+[A-Z]',        # "A. Appendix"
    r'^Chapter\s+\d+',            # "Chapter 1"
    r'^Section\s+\d+',            # "Section 1"
    r'^Part\s+\d+',               # "Part 1"
    r'^Appendix\s+[A-Z]',        # "Appendix A"
    r'^Abstract$',                 # "Abstract"
    r'^References?$',              # "Reference" or "References"
    r'^Acknowledgements?$',       # "Acknowledgement" or "Acknowledgments"
    r'^Table of Contents$',       # "Table of Contents"
    r'^Index$',                    # "Index"
    r'^Glossary$',                 # "Glossary"
]

# Patterns for noise to skip
NOISE_PATTERNS = [
    r'^\d+$',                      # Page numbers
    r'^page\s+\d+',               # "page 1"
    r'^\d+\s*/\s*\d+$',          # "1/10"
    r'^©',                         # Copyright
    r'^www\.',                     # URLs
    r'^http',                      # URLs
    r'^\d{1,2}[/-]\d{1,2}[/-]\d{2,4}',  # Dates
]


def is_likely_heading(text: str, font_size: float, is_bold: bool, body_size: float) -> bool:
    """Determine if text is likely a heading based on multiple signals."""
    text = text.strip()
    
    # Skip very short or very long text
    if len(text) < 2 or len(text) > 200:
        return False
    
    # Skip noise patterns
    for pattern in NOISE_PATTERNS:
        if re.match(pattern, text, re.IGNORECASE):
            return False
    
    # Check if it matches a known heading pattern
    for pattern in HEADING_PATTERNS:
        if re.match(pattern, text):
            return True
    
    # Font size significantly larger than body = likely heading
    if font_size > body_size * 1.3:
        return True
    
    # Bold + larger font = likely heading
    if is_bold and font_size > body_size * 1.1:
        return True
    
    # All caps + not too long = likely heading
    if text.isupper() and len(text) < 100:
        return True
    
    # Starts with capital letter and is short = might be heading
    if len(text) < 60 and text[0].isupper() and not text.endswith('.'):
        return True
    
    return False


def extract_headings_from_pdf(pdf_path: str) -> List[Dict]:
    """
    Extract headings from PDF using font analysis and pattern matching.
    Returns list of headings with page numbers and font sizes.
    """
    doc = pymupdf.open(pdf_path)
    all_spans = []
    
    # First pass: collect all spans and find body text size
    for page_num in range(len(doc)):
        page = doc[page_num]
        blocks = page.get_text("dict")["blocks"]
        
        for block in blocks:
            if block["type"] != 0:  # Skip images
                continue
            for line in block["lines"]:
                for span in line["spans"]:
                    text = span["text"].strip()
                    if not text:
                        continue
                    
                    font_size = span["size"]
                    font_flags = span["flags"]
                    is_bold = bool(font_flags & (1 << 4))
                    
                    all_spans.append({
                        "text": text,
                        "page": page_num + 1,
                        "font_size": round(font_size, 1),
                        "is_bold": is_bold,
                        "bbox": span["bbox"]
                    })
    
    doc.close()
    
    if not all_spans:
        return []
    
    # Find body text size (most common font size, excluding very small/large)
    size_counts = {}
    for span in all_spans:
        size = span["font_size"]
        if 8 <= size <= 24:  # Reasonable body text range
            size_counts[size] = size_counts.get(size, 0) + 1
    
    if not size_counts:
        # Fallback: use median size
        sizes = sorted([s["font_size"] for s in all_spans])
        body_size = sizes[len(sizes) // 2]
    else:
        body_size = max(size_counts.items(), key=lambda x: x[1])[0]
    
    # Filter to likely headings
    headings = []
    seen_texts = set()
    
    for span in all_spans:
        text = span["text"].strip()
        
        if is_likely_heading(text, span["font_size"], span["is_bold"], body_size):
            # Normalize text for dedup
            text_lower = text.lower().strip()
            if text_lower not in seen_texts:
                seen_texts.add(text_lower)
                headings.append(span)
    
    return headings


def classify_heading_level(font_size: float, max_size: float, min_size: float) -> int:
    """Classify font size into heading level (1-6)."""
    if max_size == min_size:
        return 3
    
    normalized = (font_size - min_size) / (max_size - min_size)
    
    if normalized > 0.8:
        return 1
    elif normalized > 0.6:
        return 2
    elif normalized > 0.4:
        return 3
    elif normalized > 0.25:
        return 4
    elif normalized > 0.1:
        return 5
    else:
        return 6


def build_tree_from_headings(headings: List[Dict], total_pages: int) -> List[Dict]:
    """Build hierarchical tree from flat list of headings."""
    if not headings:
        return [{"title": "Document", "start_index": 1, "end_index": total_pages, "nodes": []}]
    
    # Get unique font sizes and sort descending
    font_sizes = sorted(set(h["font_size"] for h in headings), reverse=True)
    max_size = font_sizes[0] if font_sizes else 12
    min_size = font_sizes[-1] if font_sizes else 8
    
    for h in headings:
        h["level"] = classify_heading_level(h["font_size"], max_size, min_size)
    
    # Sort by page then position
    headings.sort(key=lambda x: (x["page"], x["bbox"][1]))
    
    # Build tree structure
    tree = []
    stack = [{"level": 0, "nodes": tree}]
    
    for h in headings:
        node = {
            "title": h["text"],
            "start_index": h["page"],
            "end_index": total_pages,
            "nodes": []
        }
        
        while stack[-1]["level"] >= h["level"]:
            stack.pop()
        
        stack[-1]["nodes"].append(node)
        stack.append({"level": h["level"], "nodes": node["nodes"], "node": node})
    
    # Update end indices
    def update_end_indices(nodes, parent_end):
        for i, node in enumerate(nodes):
            if i + 1 < len(nodes):
                node["end_index"] = nodes[i + 1]["start_index"] - 1
            else:
                node["end_index"] = parent_end
            if node["end_index"] < node["start_index"]:
                node["end_index"] = node["start_index"]
            if node.get("nodes"):
                update_end_indices(node["nodes"], node["end_index"])
    
    update_end_indices(tree, total_pages)
    return tree


def create_page_fallback(pdf_path: str) -> List[Dict]:
    """Create fallback structure with one node per page when no headings found."""
    doc = pymupdf.open(pdf_path)
    total_pages = len(doc)
    nodes = []
    
    for i in range(total_pages):
        page = doc[i]
        text = page.get_text().strip()
        
        # Try to extract a title from the first line
        first_line = text.split('\n')[0][:100] if text else f"Page {i + 1}"
        
        nodes.append({
            "title": first_line if first_line else f"Page {i + 1}",
            "start_index": i + 1,
            "end_index": i + 1,
            "nodes": []
        })
    
    doc.close()
    return nodes


def add_text_to_nodes(nodes: List[Dict], pdf_path: str) -> None:
    """Add text content to each node based on page range."""
    doc = pymupdf.open(pdf_path)
    
    def process_nodes(node_list):
        for node in node_list:
            start = node.get("start_index", 1)
            end = node.get("end_index", start)
            
            text_parts = []
            for page_num in range(start - 1, min(end, len(doc))):
                page = doc[page_num]
                text_parts.append(page.get_text())
            
            node["text"] = "\n".join(text_parts)
            
            if node.get("nodes"):
                process_nodes(node["nodes"])
    
    process_nodes(nodes)
    doc.close()


def parse_pdf_heuristic(pdf_path: str, add_text: bool = True) -> Dict:
    """
    Main entry point: Parse PDF into tree structure using heuristics.
    NO LLM calls - font analysis + pattern matching.
    """
    # Extract headings
    raw_headings = extract_headings_from_pdf(pdf_path)
    
    # Get total pages
    doc = pymupdf.open(pdf_path)
    total_pages = len(doc)
    doc.close()
    
    # Build tree or fallback to per-page chunks
    if raw_headings:
        tree = build_tree_from_headings(raw_headings, total_pages)
    else:
        tree = create_page_fallback(pdf_path)
    
    # Add text content if requested
    if add_text:
        add_text_to_nodes(tree, pdf_path)
    
    # Add node IDs
    counter = [0]
    def add_node_ids(nodes):
        for node in nodes:
            counter[0] += 1
            node["node_id"] = str(counter[0]).zfill(4)
            if node.get("nodes"):
                add_node_ids(node["nodes"])
    
    add_node_ids(tree)
    
    return {
        "doc_name": pdf_path.split("/")[-1],
        "structure": tree
    }


if __name__ == "__main__":
    import sys
    import json
    
    if len(sys.argv) < 2:
        print("Usage: python heuristic_parser.py <pdf_path>")
        sys.exit(1)
    
    result = parse_pdf_heuristic(sys.argv[1])
    print(json.dumps(result, indent=2))
