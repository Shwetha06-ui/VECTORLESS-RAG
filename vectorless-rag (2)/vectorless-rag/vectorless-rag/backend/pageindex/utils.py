import tiktoken
from groq import Groq
import google.generativeai as genai
import logging
import os
import re
from datetime import datetime
import time
import json
import PyPDF2
import copy
import asyncio
import pymupdf
from io import BytesIO
from dotenv import load_dotenv
load_dotenv()
import yaml
from pathlib import Path
from types import SimpleNamespace as config
import random
from collections import deque

# Limit concurrent LLM calls (lazy init to avoid event loop issues)
LLM_SEMAPHORE = None

def get_semaphore():
    global LLM_SEMAPHORE
    if LLM_SEMAPHORE is None:
        LLM_SEMAPHORE = asyncio.Semaphore(1)
    return LLM_SEMAPHORE

# Optional soft rate limiter (RPM control)
REQUEST_LOG = deque()
MAX_REQUESTS_PER_MIN = 12  # Stay under Gemini's 15 RPM limit


GROQ_API_KEY = os.getenv("GROQ_API_KEY")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

# Configure Gemini
if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)

# LLM Provider: "groq" or "gemini"
LLM_PROVIDER = os.getenv("LLM_PROVIDER", "groq")

client = Groq(
    api_key=GROQ_API_KEY
)

def enforce_rate_limit_sync():
    now = time.time()

    # Remove requests older than 60 sec
    while REQUEST_LOG and now - REQUEST_LOG[0] > 60:
        REQUEST_LOG.popleft()

    if len(REQUEST_LOG) >= MAX_REQUESTS_PER_MIN:
        wait_time = 60 - (now - REQUEST_LOG[0])
        if wait_time > 0:
            time.sleep(wait_time)

    REQUEST_LOG.append(time.time())
    # Delay between calls to respect 15 RPM limit
    time.sleep(4)

async def enforce_rate_limit_async():
    now = time.time()

    while REQUEST_LOG and now - REQUEST_LOG[0] > 60:
        REQUEST_LOG.popleft()

    if len(REQUEST_LOG) >= MAX_REQUESTS_PER_MIN:
        wait_time = 60 - (now - REQUEST_LOG[0])
        if wait_time > 0:
            await asyncio.sleep(wait_time)

    REQUEST_LOG.append(time.time())
    # Delay between calls to respect 15 RPM limit
    await asyncio.sleep(4)



def count_tokens(text, model=None):
    if not text:
        return 0
    try:
        enc = tiktoken.encoding_for_model(model)
    except Exception:
        # Fallback tokenizer for non-OpenAI models (Groq, Llama, etc.)
        enc = tiktoken.get_encoding("cl100k_base")
    tokens = enc.encode(text)
    return len(tokens)



def ChatGPT_API_with_finish_reason(
    model,
    prompt,
    api_key=None,
    chat_history=None
):
    max_retries = 6
    
    # Do NOT mutate original chat history
    if chat_history:
        messages = chat_history.copy()
        messages.append({"role": "user", "content": prompt})
    else:
        messages = [{"role": "user", "content": prompt}]

    for attempt in range(max_retries):
        try:
            enforce_rate_limit_sync()  # 🚦 RPM protection
            
            if LLM_PROVIDER == "gemini" and GEMINI_API_KEY:
                # Use Gemini
                gemini_model = genai.GenerativeModel(model)
                # Convert messages to Gemini format
                history_text = "\n".join([f"{m['role']}: {m['content']}" for m in chat_history]) if chat_history else ""
                full_prompt = f"{history_text}\nUser: {prompt}" if history_text else prompt
                response = gemini_model.generate_content(full_prompt)
                content = response.text
                finish_reason = "finished"
            else:
                # Use Groq
                groq_client = Groq(api_key=api_key or os.getenv("GROQ_API_KEY"))
                response = groq_client.chat.completions.create(
                    model=model,
                    messages=messages,
                    temperature=0,
                    max_tokens=4096,
                )
                content = response.choices[0].message.content
                finish_reason = response.choices[0].finish_reason

            if finish_reason == "length":
                return content, "max_output_reached"
            else:
                return content, "finished"

        except Exception as e:
            error_msg = str(e).lower()
            logging.error(f"LLM Error: {e}")

            # Handle rate limits and token limit errors
            if any(term in error_msg for term in ["429", "413", "rate", "limit", "tpm", "tokens", "quota"]):
                wait_time = (2 ** attempt) * 5 + random.uniform(2, 5)  # Longer backoff
                # Try parsing exact wait time from error message
                match = re.search(r"try again in ([\d\.]+)s", error_msg)
                if match:
                    wait_time = float(match.group(1)) + 2.0  # Add buffer
                logging.info(f"Rate limited, waiting {wait_time:.1f}s (attempt {attempt + 1}/{max_retries})")
                time.sleep(wait_time)
            elif "connection" in error_msg or "timeout" in error_msg:
                wait_time = (2 ** attempt) + random.uniform(1, 3)
                logging.info(f"Connection error, retrying in {wait_time:.1f}s (attempt {attempt + 1}/{max_retries})")
                time.sleep(wait_time)
            else:
                # Unexpected error → don't silently loop forever
                raise e

    logging.error("Max retries reached")
    return "Error", "failed"


def ChatGPT_API(model, prompt, api_key=None, chat_history=None):
    max_retries = 6

    # IMPORTANT: avoid mutating original chat_history
    if chat_history:
        messages = chat_history.copy()
        messages.append({"role": "user", "content": prompt})
    else:
        messages = [{"role": "user", "content": prompt}]

    for attempt in range(max_retries):
        try:
            enforce_rate_limit_sync()  # 🚦 RPM control
            
            if LLM_PROVIDER == "gemini" and GEMINI_API_KEY:
                # Use Gemini
                gemini_model = genai.GenerativeModel(model)
                history_text = "\n".join([f"{m['role']}: {m['content']}" for m in chat_history]) if chat_history else ""
                full_prompt = f"{history_text}\nUser: {prompt}" if history_text else prompt
                response = gemini_model.generate_content(full_prompt)
                return response.text
            else:
                # Use Groq
                groq_client = Groq(api_key=api_key or os.getenv("GROQ_API_KEY"))
                response = groq_client.chat.completions.create(
                    model=model,
                    messages=messages,
                    temperature=0,
                    max_tokens=4096,
                )
                return response.choices[0].message.content

        except Exception as e:
            error_msg = str(e).lower()
            logging.error(f"LLM Error: {e}")

            # Handle rate limits and token limit errors
            if any(term in error_msg for term in ["429", "413", "rate", "limit", "tpm", "tokens", "quota"]):
                wait_time = (2 ** attempt) + random.uniform(1, 3)
                match = re.search(r"try again in ([\d\.]+)s", error_msg)
                if match:
                    wait_time = float(match.group(1)) + 0.5
                time.sleep(wait_time)
            elif "connection" in error_msg or "timeout" in error_msg:
                wait_time = (2 ** attempt) + random.uniform(1, 3)
                logging.info(f"Connection error, retrying in {wait_time:.1f}s (attempt {attempt + 1}/{max_retries})")
                time.sleep(wait_time)
            else:
                # Non-rate-limit errors should not loop blindly
                raise e

    logging.error("Max retries reached")
    return "Error"
        

async def ChatGPT_API_async(model, prompt, api_key=None, provider=None):
    max_retries = 3  # Reduced from 6
    messages = [{"role": "user", "content": prompt}]
    use_provider = provider or LLM_PROVIDER
    
    if use_provider in ("gemini", "gemini-lite", "gemini-flash"):
        key = api_key or os.getenv("GEMINI_API_KEY")
        use_provider = "gemini"
    else:
        key = api_key or os.getenv("GROQ_API_KEY")

    def sync_call():
        if use_provider == "gemini" and key and key != "your-gemini-api-key-here":
            # Use Gemini
            gemini_model = genai.GenerativeModel(model)
            response = gemini_model.generate_content(prompt)
            return response.text
        else:
            # Use Groq
            groq_client = Groq(api_key=key)
            response = groq_client.chat.completions.create(
                model=model,
                messages=messages,
                temperature=0,
                max_tokens=4096,
            )
            return response.choices[0].message.content

    async with get_semaphore():  # 🔒 limit concurrency
        for attempt in range(max_retries):
            try:
                await enforce_rate_limit_async()  # 🚦 RPM control

                response = await asyncio.to_thread(sync_call)
                return response

            except Exception as e:
                error_msg = str(e).lower()
                logging.error(f"LLM Error: {e}")

                # Handle rate limit errors - return immediately
                if any(term in error_msg for term in ["429", "413", "rate", "limit", "tpm", "tokens", "quota"]):
                    match = re.search(r"try again in ([\d\.]+)s", error_msg)
                    wait_secs = float(match.group(1)) if match else 60
                    return f"Rate limited. Try again in {int(wait_secs)}s or switch to Gemini."
                else:
                    # For connection errors, retry with backoff
                    if "connection" in error_msg or "timeout" in error_msg:
                        wait_time = (2 ** attempt) + random.uniform(1, 2)
                        logging.info(f"Connection error, retrying in {wait_time:.1f}s (attempt {attempt + 1}/{max_retries})")
                        await asyncio.sleep(wait_time)
                    else:
                        # Non-retryable errors → return error message
                        return f"Error: {str(e)[:200]}"

        logging.error("Max retries reached")
        return "Error"

def get_json_content(response):
    start_idx = response.find("```json")
    if start_idx != -1:
        start_idx += 7
        response = response[start_idx:]
        
    end_idx = response.rfind("```")
    if end_idx != -1:
        response = response[:end_idx]
    
    json_content = response.strip()
    return json_content
         

def extract_json(content):
    """
    Extract and repair JSON returned by an LLM.

    PageIndex expects the LLM to return valid JSON, but some models
    may occasionally return malformed JSON such as a missing comma,
    trailing comma, or markdown code fences.

    json-repair attempts to fix these common problems.
    """

    import json
    import logging
    from json_repair import repair_json

    if content is None:
        raise ValueError("LLM returned None instead of JSON")

    # Convert response to string
    content = str(content).strip()

    # Remove Markdown code fences
    if "```json" in content:
        content = content.split("```json", 1)[1]

        if "```" in content:
            content = content.split("```", 1)[0]

    elif "```" in content:
        parts = content.split("```")

        if len(parts) >= 2:
            content = parts[1]

            # Remove optional language identifier
            if content.strip().startswith("json"):
                content = content.strip()[4:]

    content = content.strip()

    # Replace Python-style None with JSON null
    content = content.replace("None", "null")

    def validate_structure(parsed):
        if not isinstance(parsed, (list, dict)):
            raise ValueError(f"JSON root must be a list or object, got {type(parsed).__name__}")
        if isinstance(parsed, list) and not all(isinstance(item, dict) for item in parsed):
            raise ValueError("If JSON is a list, all items must be objects")
        return parsed

    # First try normal JSON parsing
    try:
        result = json.loads(content)
        return validate_structure(result)

    except json.JSONDecodeError as original_error:

        logging.warning(
            "Normal JSON parsing failed. Attempting JSON repair..."
        )

        logging.warning(
            f"Original JSON error: {original_error}"
        )

        # Try repairing malformed LLM JSON
        try:
            repaired = repair_json(content)
            result = json.loads(repaired)
            result = validate_structure(result)
            logging.info("JSON successfully repaired and validated.")
            return result

        except Exception as repair_error:

            logging.error(
                "JSON repair failed."
            )

            logging.error(
                f"Repair error: {repair_error}"
            )

            # Show the beginning of the model response for debugging
            logging.error(
                "LLM response preview:\n%s",
                content[:3000]
            )

            # Don't silently return {}
            raise ValueError(
                "PageIndex received invalid JSON from the LLM "
                "and automatic JSON repair failed."
            ) from repair_error

def write_node_id(data, node_id=0):
    if isinstance(data, dict):
        data['node_id'] = str(node_id).zfill(4)
        node_id += 1
        for key in list(data.keys()):
            if 'nodes' in key:
                node_id = write_node_id(data[key], node_id)
    elif isinstance(data, list):
        for index in range(len(data)):
            node_id = write_node_id(data[index], node_id)
    return node_id

def get_nodes(structure):
    if isinstance(structure, dict):
        structure_node = copy.deepcopy(structure)
        structure_node.pop('nodes', None)
        nodes = [structure_node]
        for key in list(structure.keys()):
            if 'nodes' in key:
                nodes.extend(get_nodes(structure[key]))
        return nodes
    elif isinstance(structure, list):
        nodes = []
        for item in structure:
            nodes.extend(get_nodes(item))
        return nodes
    
def structure_to_list(structure):
    if isinstance(structure, dict):
        nodes = []
        nodes.append(structure)
        if 'nodes' in structure:
            nodes.extend(structure_to_list(structure['nodes']))
        return nodes
    elif isinstance(structure, list):
        nodes = []
        for item in structure:
            nodes.extend(structure_to_list(item))
        return nodes

    
def get_leaf_nodes(structure):
    if isinstance(structure, dict):
        if not structure['nodes']:
            structure_node = copy.deepcopy(structure)
            structure_node.pop('nodes', None)
            return [structure_node]
        else:
            leaf_nodes = []
            for key in list(structure.keys()):
                if 'nodes' in key:
                    leaf_nodes.extend(get_leaf_nodes(structure[key]))
            return leaf_nodes
    elif isinstance(structure, list):
        leaf_nodes = []
        for item in structure:
            leaf_nodes.extend(get_leaf_nodes(item))
        return leaf_nodes

def is_leaf_node(data, node_id):
    # Helper function to find the node by its node_id
    def find_node(data, node_id):
        if isinstance(data, dict):
            if data.get('node_id') == node_id:
                return data
            for key in data.keys():
                if 'nodes' in key:
                    result = find_node(data[key], node_id)
                    if result:
                        return result
        elif isinstance(data, list):
            for item in data:
                result = find_node(item, node_id)
                if result:
                    return result
        return None

    # Find the node with the given node_id
    node = find_node(data, node_id)

    # Check if the node is a leaf node
    if node and not node.get('nodes'):
        return True
    return False

def get_last_node(structure):
    return structure[-1]


def extract_text_from_pdf(pdf_path):
    pdf_reader = PyPDF2.PdfReader(pdf_path)
    ###return text not list 
    text=""
    for page_num in range(len(pdf_reader.pages)):
        page = pdf_reader.pages[page_num]
        text+=page.extract_text()
    return text

def get_pdf_title(pdf_path):
    pdf_reader = PyPDF2.PdfReader(pdf_path)
    meta = pdf_reader.metadata
    title = meta.title if meta and meta.title else 'Untitled'
    return title

def get_text_of_pages(pdf_path, start_page, end_page, tag=True):
    pdf_reader = PyPDF2.PdfReader(pdf_path)
    text = ""
    for page_num in range(start_page-1, end_page):
        page = pdf_reader.pages[page_num]
        page_text = page.extract_text()
        if tag:
            text += f"<start_index_{page_num+1}>\n{page_text}\n<end_index_{page_num+1}>\n"
        else:
            text += page_text
    return text

def get_first_start_page_from_text(text):
    start_page = -1
    start_page_match = re.search(r'<start_index_(\d+)>', text)
    if start_page_match:
        start_page = int(start_page_match.group(1))
    return start_page

def get_last_start_page_from_text(text):
    start_page = -1
    # Find all matches of start_index tags
    start_page_matches = re.finditer(r'<start_index_(\d+)>', text)
    # Convert iterator to list and get the last match if any exist
    matches_list = list(start_page_matches)
    if matches_list:
        start_page = int(matches_list[-1].group(1))
    return start_page


def sanitize_filename(filename, replacement='-'):
    # In Linux, only '/' and '\0' (null) are invalid in filenames.
    # Null can't be represented in strings, so we only handle '/'.
    return filename.replace('/', replacement)

def get_pdf_name(pdf_path):
    # Extract PDF name
    if isinstance(pdf_path, str):
        pdf_name = os.path.basename(pdf_path)
    elif isinstance(pdf_path, BytesIO):
        pdf_reader = PyPDF2.PdfReader(pdf_path)
        meta = pdf_reader.metadata
        pdf_name = meta.title if meta and meta.title else 'Untitled'
        pdf_name = sanitize_filename(pdf_name)
    return pdf_name


class JsonLogger:
    def __init__(self, file_path):
        # Extract PDF name for logger name
        pdf_name = get_pdf_name(file_path)
            
        current_time = datetime.now().strftime("%Y%m%d_%H%M%S")
        self.filename = f"{pdf_name}_{current_time}.json"
        os.makedirs("./logs", exist_ok=True)
        # Initialize empty list to store all messages
        self.log_data = []

    def log(self, level, message, **kwargs):
        if isinstance(message, dict):
            self.log_data.append(message)
        else:
            self.log_data.append({'message': message})
        # Add new message to the log data
        
        # Write entire log data to file
        with open(self._filepath(), "w") as f:
            json.dump(self.log_data, f, indent=2)

    def info(self, message, **kwargs):
        self.log("INFO", message, **kwargs)

    def error(self, message, **kwargs):
        self.log("ERROR", message, **kwargs)

    def debug(self, message, **kwargs):
        self.log("DEBUG", message, **kwargs)

    def exception(self, message, **kwargs):
        kwargs["exception"] = True
        self.log("ERROR", message, **kwargs)

    def _filepath(self):
        return os.path.join("logs", self.filename)
    



def list_to_tree(data):
    def get_parent_structure(structure):
        """Helper function to get the parent structure code"""
        if not structure:
            return None
        parts = str(structure).split('.')
        return '.'.join(parts[:-1]) if len(parts) > 1 else None
    
    # First pass: Create nodes and track parent-child relationships
    nodes = {}
    root_nodes = []
    
    for item in data:
        structure = item.get('structure')
        node = {
            'title': item.get('title'),
            'start_index': item.get('start_index'),
            'end_index': item.get('end_index'),
            'nodes': []
        }
        
        nodes[structure] = node
        
        # Find parent
        parent_structure = get_parent_structure(structure)
        
        if parent_structure:
            # Add as child to parent if parent exists
            if parent_structure in nodes:
                nodes[parent_structure]['nodes'].append(node)
            else:
                root_nodes.append(node)
        else:
            # No parent, this is a root node
            root_nodes.append(node)
    
    # Helper function to clean empty children arrays
    def clean_node(node):
        if not node['nodes']:
            del node['nodes']
        else:
            for child in node['nodes']:
                clean_node(child)
        return node
    
    # Clean and return the tree
    return [clean_node(node) for node in root_nodes]

def add_preface_if_needed(data):
    if not isinstance(data, list) or not data:
        return data

    if data[0]['physical_index'] is not None and data[0]['physical_index'] > 1:
        preface_node = {
            "structure": "0",
            "title": "Preface",
            "physical_index": 1,
        }
        data.insert(0, preface_node)
    return data



def get_page_tokens(pdf_path, model="gpt-4o-2024-11-20", pdf_parser="PyPDF2"):
    enc = tiktoken.encoding_for_model(model)
    if pdf_parser == "PyPDF2":
        pdf_reader = PyPDF2.PdfReader(pdf_path)
        page_list = []
        for page_num in range(len(pdf_reader.pages)):
            page = pdf_reader.pages[page_num]
            page_text = page.extract_text()
            token_length = len(enc.encode(page_text))
            page_list.append((page_text, token_length))
        return page_list
    elif pdf_parser == "PyMuPDF":
        if isinstance(pdf_path, BytesIO):
            pdf_stream = pdf_path
            doc = pymupdf.open(stream=pdf_stream, filetype="pdf")
        elif isinstance(pdf_path, str) and os.path.isfile(pdf_path) and pdf_path.lower().endswith(".pdf"):
            doc = pymupdf.open(pdf_path)
        page_list = []
        for page in doc:
            page_text = page.get_text()
            token_length = len(enc.encode(page_text))
            page_list.append((page_text, token_length))
        return page_list
    else:
        raise ValueError(f"Unsupported PDF parser: {pdf_parser}")

        

def get_text_of_pdf_pages(pdf_pages, start_page, end_page):
    text = ""
    for page_num in range(start_page-1, end_page):
        text += pdf_pages[page_num][0]
    return text

def get_text_of_pdf_pages_with_labels(pdf_pages, start_page, end_page):
    text = ""
    for page_num in range(start_page-1, end_page):
        text += f"<physical_index_{page_num+1}>\n{pdf_pages[page_num][0]}\n<physical_index_{page_num+1}>\n"
    return text

def get_number_of_pages(pdf_path):
    pdf_reader = PyPDF2.PdfReader(pdf_path)
    num = len(pdf_reader.pages)
    return num



def post_processing(structure, end_physical_index):
    # First convert page_number to start_index in flat list
    for i, item in enumerate(structure):
        item['start_index'] = item.get('physical_index')
        if i < len(structure) - 1:
            if structure[i + 1].get('appear_start') == 'yes':
                item['end_index'] = structure[i + 1]['physical_index']-1
            else:
                item['end_index'] = structure[i + 1]['physical_index']
        else:
            item['end_index'] = end_physical_index
    tree = list_to_tree(structure)
    if len(tree)!=0:
        return tree
    else:
        ### remove appear_start 
        for node in structure:
            node.pop('appear_start', None)
            node.pop('physical_index', None)
        return structure

def clean_structure_post(data):
    if isinstance(data, dict):
        data.pop('page_number', None)
        data.pop('start_index', None)
        data.pop('end_index', None)
        if 'nodes' in data:
            clean_structure_post(data['nodes'])
    elif isinstance(data, list):
        for section in data:
            clean_structure_post(section)
    return data

def remove_fields(data, fields=['text']):
    if isinstance(data, dict):
        return {k: remove_fields(v, fields)
            for k, v in data.items() if k not in fields}
    elif isinstance(data, list):
        return [remove_fields(item, fields) for item in data]
    return data

def print_toc(tree, indent=0):
    for node in tree:
        print('  ' * indent + node['title'])
        if node.get('nodes'):
            print_toc(node['nodes'], indent + 1)

def print_json(data, max_len=40, indent=2):
    def simplify_data(obj):
        if isinstance(obj, dict):
            return {k: simplify_data(v) for k, v in obj.items()}
        elif isinstance(obj, list):
            return [simplify_data(item) for item in obj]
        elif isinstance(obj, str) and len(obj) > max_len:
            return obj[:max_len] + '...'
        else:
            return obj
    
    simplified = simplify_data(data)
    print(json.dumps(simplified, indent=indent, ensure_ascii=False))


def remove_structure_text(data):
    if isinstance(data, dict):
        data.pop('text', None)
        if 'nodes' in data:
            remove_structure_text(data['nodes'])
    elif isinstance(data, list):
        for item in data:
            remove_structure_text(item)
    return data


def check_token_limit(structure, limit=110000):
    list = structure_to_list(structure)
    for node in list:
        num_tokens = count_tokens(node['text'], model='gpt-4o')
        if num_tokens > limit:
            print(f"Node ID: {node['node_id']} has {num_tokens} tokens")
            print("Start Index:", node['start_index'])
            print("End Index:", node['end_index'])
            print("Title:", node['title'])
            print("\n")


def convert_physical_index_to_int(data):
    if isinstance(data, list):
        for i in range(len(data)):
            # Check if item is a dictionary and has 'physical_index' key
            if isinstance(data[i], dict) and 'physical_index' in data[i]:
                if isinstance(data[i]['physical_index'], str):
                    if data[i]['physical_index'].startswith('<physical_index_'):
                        data[i]['physical_index'] = int(data[i]['physical_index'].split('_')[-1].rstrip('>').strip())
                    elif data[i]['physical_index'].startswith('physical_index_'):
                        data[i]['physical_index'] = int(data[i]['physical_index'].split('_')[-1].strip())
    elif isinstance(data, str):
        if data.startswith('<physical_index_'):
            data = int(data.split('_')[-1].rstrip('>').strip())
        elif data.startswith('physical_index_'):
            data = int(data.split('_')[-1].strip())
        # Check data is int
        if isinstance(data, int):
            return data
        else:
            return None
    return data


def convert_page_to_int(data):
    for item in data:
        if 'page' in item and isinstance(item['page'], str):
            try:
                item['page'] = int(item['page'])
            except ValueError:
                # Keep original value if conversion fails
                pass
    return data


def add_node_text(node, pdf_pages):
    if isinstance(node, dict):
        start_page = node.get('start_index')
        end_page = node.get('end_index')
        node['text'] = get_text_of_pdf_pages(pdf_pages, start_page, end_page)
        if 'nodes' in node:
            add_node_text(node['nodes'], pdf_pages)
    elif isinstance(node, list):
        for index in range(len(node)):
            add_node_text(node[index], pdf_pages)
    return


def add_node_text_with_labels(node, pdf_pages):
    if isinstance(node, dict):
        start_page = node.get('start_index')
        end_page = node.get('end_index')
        node['text'] = get_text_of_pdf_pages_with_labels(pdf_pages, start_page, end_page)
        if 'nodes' in node:
            add_node_text_with_labels(node['nodes'], pdf_pages)
    elif isinstance(node, list):
        for index in range(len(node)):
            add_node_text_with_labels(node[index], pdf_pages)
    return


async def generate_node_summary(node, model=None):
    prompt = f"""You are given a part of a document, your task is to generate a description of the partial document about what are main points covered in the partial document.

    Partial Document Text: {node['text']}
    
    Directly return the description, do not include any other text.
    """
    response = await ChatGPT_API_async(model, prompt)
    return response


async def generate_summaries_for_structure(structure, model=None):
    nodes = structure_to_list(structure)
    tasks = [generate_node_summary(node, model=model) for node in nodes]
    summaries = await asyncio.gather(*tasks)
    
    for node, summary in zip(nodes, summaries):
        node['summary'] = summary
    return structure


def create_clean_structure_for_description(structure):
    """
    Create a clean structure for document description generation,
    excluding unnecessary fields like 'text'.
    """
    if isinstance(structure, dict):
        clean_node = {}
        # Only include essential fields for description
        for key in ['title', 'node_id', 'summary', 'prefix_summary']:
            if key in structure:
                clean_node[key] = structure[key]
        
        # Recursively process child nodes
        if 'nodes' in structure and structure['nodes']:
            clean_node['nodes'] = create_clean_structure_for_description(structure['nodes'])
        
        return clean_node
    elif isinstance(structure, list):
        return [create_clean_structure_for_description(item) for item in structure]
    else:
        return structure


def generate_doc_description(structure, model=None):
    prompt = f"""Your are an expert in generating descriptions for a document.
    You are given a structure of a document. Your task is to generate a one-sentence description for the document, which makes it easy to distinguish the document from other documents.
        
    Document Structure: {structure}
    
    Directly return the description, do not include any other text.
    """
    response = ChatGPT_API(model, prompt)
    return response


def reorder_dict(data, key_order):
    if not key_order:
        return data
    return {key: data[key] for key in key_order if key in data}


def format_structure(structure, order=None):
    if not order:
        return structure
    if isinstance(structure, dict):
        if 'nodes' in structure:
            structure['nodes'] = format_structure(structure['nodes'], order)
        if not structure.get('nodes'):
            structure.pop('nodes', None)
        structure = reorder_dict(structure, order)
    elif isinstance(structure, list):
        structure = [format_structure(item, order) for item in structure]
    return structure


class ConfigLoader:
    def __init__(self, default_path: str = None):
        if default_path is None:
            default_path = Path(__file__).parent / "config.yaml"
        self._default_dict = self._load_yaml(default_path)

    @staticmethod
    def _load_yaml(path):
        with open(path, "r", encoding="utf-8") as f:
            return yaml.safe_load(f) or {}

    def _validate_keys(self, user_dict):
        unknown_keys = set(user_dict) - set(self._default_dict)
        if unknown_keys:
            raise ValueError(f"Unknown config keys: {unknown_keys}")

    def load(self, user_opt=None) -> config:
        """
        Load the configuration, merging user options with default values.
        """
        if user_opt is None:
            user_dict = {}
        elif isinstance(user_opt, config):
            user_dict = vars(user_opt)
        elif isinstance(user_opt, dict):
            user_dict = user_opt
        else:
            raise TypeError("user_opt must be dict, config(SimpleNamespace) or None")

        self._validate_keys(user_dict)
        merged = {**self._default_dict, **user_dict}
        return config(**merged)


# ------------------------------------------------
# Functions needed by PageIndex Flash module
# ------------------------------------------------

def strip_internal_keys(structure):
    """Drop the bookkeeping keys the optimize/summary passes leave behind."""
    nodes = structure if isinstance(structure, list) else [structure]
    for node in nodes:
        if not isinstance(node, dict):
            continue
        node.pop('_same_page', None)
        if node.get('nodes'):
            strip_internal_keys(node['nodes'])
    return structure


SUMMARY_RAW_TEXT_TOKENS = 200
SUMMARY_INTRO_MAX_PAGES = 2
SUMMARY_CONCURRENCY = 3


async def summarize_tree(structure, pdf_pages, model=None,
                         small_node_tokens=SUMMARY_RAW_TEXT_TOKENS,
                         max_intro_pages=SUMMARY_INTRO_MAX_PAGES, concurrency=None):
    """Bottom-up summaries: leaves from their own pages, parents composed from
    child summaries plus the pages no child covers."""
    semaphore = asyncio.Semaphore(concurrency or SUMMARY_CONCURRENCY)

    async def summarize_node(node):
        async with semaphore:
            if node.get('summary'):
                return
            if not node.get('nodes'):
                text = _get_node_text(node, pdf_pages)
                if _count_tokens(text) <= small_node_tokens:
                    node['summary'] = text
                    return
                prompt = f"Summarize this section:\n\n{text[:4000]}"
                try:
                    node['summary'] = await ChatGPT_API_async(model=model, prompt=prompt)
                except Exception as e:
                    logging.error(f"Summary failed: {e}")
                    node['summary'] = text[:500]
            else:
                child_summaries = []
                for child in node.get('nodes', []):
                    await summarize_node(child)
                    child_summaries.append(child.get('summary', ''))
                node['summary'] = '\n\n'.join(child_summaries)

    async def process_nodes(nodes):
        tasks = [summarize_node(node) for node in nodes]
        await asyncio.gather(*tasks)
        for node in nodes:
            if node.get('nodes'):
                await process_nodes(node['nodes'])

    await process_nodes(structure)


def _get_node_text(node, pdf_pages):
    """Get text for a node from page texts."""
    start = node.get('start_index', 1) - 1
    end = node.get('end_index', start + 1)
    parts = []
    for i in range(start, min(end, len(pdf_pages))):
        if i < len(pdf_pages):
            text = pdf_pages[i] if isinstance(pdf_pages[i], str) else pdf_pages[i][0]
            parts.append(text)
    return '\n'.join(parts)


def _count_tokens(text):
    """Estimate token count."""
    try:
        enc = tiktoken.get_encoding("cl100k_base")
        return len(enc.encode(text))
    except:
        return len(text) // 4