import os
import asyncio
import pymupdf
from pageindex import page_index_main, config
from pageindex.flash import page_index_flash
from pageindex.heuristic_parser import parse_pdf_heuristic
from pageindex.page_index_md import md_to_tree
from pageindex.utils import ConfigLoader


def add_text_to_nodes(structure, pdf_path):
    """Add text content to each node based on page range."""
    doc = pymupdf.open(pdf_path)

    def process_nodes(nodes):
        for node in nodes:
            start = node.get('start_index', 1) - 1
            end = node.get('end_index', start + 1)
            text_parts = []
            for page_num in range(start, min(end, len(doc))):
                page = doc[page_num]
                text_parts.append(page.get_text())
            node['text'] = '\n'.join(text_parts)
            if node.get('nodes'):
                process_nodes(node['nodes'])

    process_nodes(structure)
    doc.close()


async def process_document(file_path: str, mode: str = "regular"):
    """
    Process document with specified mode.
    mode: "regular" (LLM-based), "flash" (layout stats), "heuristic" (font analysis)
    """
    file_ext = file_path.lower().split(".")[-1]

    if file_ext == "pdf":
        if mode == "regular":
            # Use regular PageIndex with LLM - provides best structure
            print("Using PageIndex Regular (LLM-based tree)...")
            opt = config(
                model="llama-3.3-70b-versatile",
                toc_check_page_num=5,
                max_page_num_each_node=10,
                max_token_num_each_node=3000,
                if_add_node_id="yes",
                if_add_node_summary="no",
                if_add_doc_description="no",
                if_add_node_text="yes"
            )
            result = await page_index_main(file_path, opt)
            return result
            
        elif mode == "flash":
            # Use PageIndex Flash - layout statistics, no LLM for tree
            print("Using PageIndex Flash (no LLM for tree)...")
            result = page_index_flash(file_path, summary=False, optimize=False)
            add_text_to_nodes(result["structure"], file_path)
            return result
            
        else:
            # Use heuristic parser - font analysis only
            print("Using Heuristic Parser (font analysis)...")
            result = parse_pdf_heuristic(file_path, add_text=True)
            return result

    elif file_ext in ["md", "markdown"]:
        config_loader = ConfigLoader()
        opt = config_loader.load({
            "if_add_node_summary": "no",
            "if_add_doc_description": "no",
            "if_add_node_text": "yes",
            "if_add_node_id": "yes"
        })

        tree = await md_to_tree(
            md_path=file_path,
            if_thinning=False,
            min_token_threshold=5000,
            if_add_node_summary=opt.if_add_node_summary,
            summary_token_threshold=200,
            model=opt.model,
            if_add_doc_description=opt.if_add_doc_description,
            if_add_node_text=opt.if_add_node_text,
            if_add_node_id=opt.if_add_node_id
        )

        return tree

    else:
        raise ValueError("Unsupported file type")
