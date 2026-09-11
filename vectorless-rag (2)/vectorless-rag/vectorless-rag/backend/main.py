import os
import json
import re
import sqlite3
import shutil
import uuid
from typing import List, Dict

from fastapi import FastAPI, UploadFile, File, HTTPException, Depends
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv
from starlette.middleware.sessions import SessionMiddleware
from groq import Groq

from pageindex.utils import ChatGPT_API_async
from pageindex_service import process_document
from database import engine, Base
from models import User
from auth_utils import get_current_user
from auth_routes import router as auth_router
from chat_routes import router as chat_router
import asyncio

load_dotenv()

SESSION_SECRET_KEY = os.getenv("SESSION_SECRET_KEY")

if not SESSION_SECRET_KEY:
    raise RuntimeError("SESSION_SECRET_KEY is not configured")

app = FastAPI()

raw_origins = os.getenv("CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173,https://vectorless-rag-frontend-brown.vercel.app")
allowed_origins = [origin.strip() for origin in raw_origins.split(",") if origin.strip()]

app.add_middleware(
    SessionMiddleware,
    secret_key=SESSION_SECRET_KEY
)

# create auth database tables
Base.metadata.create_all(bind=engine)

# include authentication routes
app.include_router(auth_router, prefix="/auth", tags=["Authentication"])
app.include_router(chat_router, prefix="/chat", tags=["Chat History"])

# ------------------------------------------------
# Documents Folder Setup
# ------------------------------------------------
DOCS_DIR = "documents"  # Changed to 'documents' as requested
if not os.path.exists(DOCS_DIR):
    os.makedirs(DOCS_DIR)

# ------------------------------------------------
# Database Connection
# ------------------------------------------------
DOCUMENT_DB = "documents.db"

conn = sqlite3.connect(
    DOCUMENT_DB,
    check_same_thread=False
)

conn = sqlite3.connect("documents.db", check_same_thread=False)
cursor = conn.cursor()

cursor.execute("""
CREATE TABLE IF NOT EXISTS documents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    filename TEXT,
    file_path TEXT,
    structure TEXT,
    user_id INTEGER
)
""")
try:
    cursor.execute("ALTER TABLE documents ADD COLUMN user_id INTEGER")
except sqlite3.OperationalError:
    pass # Column already exists

conn.commit()

# ------------------------------------------------
# Models & Middleware
# ------------------------------------------------
class Query(BaseModel):
    question: str
    document_ids: List[int]
    provider: str = "groq"  # "groq", "gemini-lite", or "gemini-flash"

# Processing status tracking
processing_status = {}  # doc_id -> {"status": "processing|done|error", "message": "..."}

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ------------------------------------------------
# LLM Tree Search Logic (from PageIndex notebook)
# ------------------------------------------------
def compress_tree(nodes):
    """Compress tree to save tokens — only send titles + short summaries."""
    out = []
    for n in nodes:
        entry = {
            "node_id": n.get("node_id", ""),
            "title": n.get("title", ""),
            "page": n.get("start_index", n.get("page_index", "?")),
            "summary": n.get("text", "")[:150]
        }
        if n.get("nodes"):
            entry["children"] = compress_tree(n["nodes"])
        out.append(entry)
    return out


def find_nodes_by_ids(tree, target_ids):
    """Recursively walk the tree and collect nodes matching target_ids."""
    found = []
    for node in tree:
        if node.get("node_id") in target_ids:
            found.append(node)
        if node.get("nodes"):
            found.extend(find_nodes_by_ids(node["nodes"], target_ids))
    return found


async def llm_tree_search(query: str, tree: list, model: str, provider: str) -> dict:
    """
    Core PageIndex retrieval:
    Sends the query + document tree to an LLM.
    LLM reasons over the structure and returns relevant node_ids.
    """
    compressed = compress_tree(tree)
    
    prompt = f"""You are given a query and a document's tree structure (like a Table of Contents).
Your task: identify which node IDs most likely contain the answer to the query.
Think step-by-step about which sections are relevant.

Query: {query}

Document Tree:
{json.dumps(compressed, indent=2)}

Reply ONLY in this exact JSON format:
{{
  "thinking": "<your step-by-step reasoning>",
  "node_list": ["node_id1", "node_id2"]
}}"""

    response = await ChatGPT_API_async(model=model, prompt=prompt, provider=provider)
    
    # Check for rate limit or error responses
    if "rate" in response.lower() or "error" in response.lower():
        return {"thinking": response, "node_list": []}
    
    # Parse JSON from response
    try:
        # Try to extract JSON from response
        json_match = re.search(r'\{[\s\S]*\}', response)
        if json_match:
            return json.loads(json_match.group())
    except:
        pass
    
    # Fallback: return empty
    return {"thinking": "Failed to parse response", "node_list": []}


# Legacy keyword search (kept as fallback)
def keyword_score(text: str, question_words: List[str]) -> int:
    score = 0
    text = text.lower()
    for word in question_words:
        score += len(re.findall(rf"\b{re.escape(word)}\b", text))
    return score

def collect_relevant_nodes(tree: List[Dict], question: str, top_k: int = 5):
    question_words = question.lower().split()
    matched = []
    def traverse(nodes, path=None):
        if path is None: path = []
        for node in nodes:
            title = node.get("title", "")
            summary = node.get("summary", "")
            text = node.get("text", "")[:500]
            current_path = path + [title]
            score = keyword_score(title, question_words) + keyword_score(summary, question_words) + keyword_score(text, question_words)
            if score > 0:
                matched.append({"score": score, "node": node, "path": current_path})
            if "nodes" in node: traverse(node["nodes"], current_path)
    traverse(tree)
    matched.sort(key=lambda x: x["score"], reverse=True)
    return matched[:top_k]

# ------------------------------------------------
# API Endpoints
# ------------------------------------------------

@app.post("/upload")
async def upload_document(file: UploadFile = File(...), user: User = Depends(get_current_user)):
    file_ext = file.filename.lower().split(".")[-1]
    if file_ext not in ["pdf", "md", "markdown"]:
        raise HTTPException(
            status_code=400,
            detail="Only PDF and Markdown files are supported."
    )

    # Generate unique path inside 'documents' folder
    unique_filename = f"{uuid.uuid4()}_{file.filename}"
    file_path = os.path.join(DOCS_DIR, unique_filename)

    # Save file to local 'documents' folder
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    try:
        # Set initial processing status
        temp_doc_id = hash(file_path) % 100000
        processing_status[temp_doc_id] = {"status": "processing", "message": "Indexing document with LLM..."}

        # Use PageIndex Flash (no LLM needed for tree)
        from pageindex_service import process_document
        result = await process_document(file_path, mode="flash")
        structure = json.dumps(result["structure"])

        cursor.execute(
            "INSERT INTO documents (filename, file_path, structure, user_id) VALUES (?, ?, ?, ?)",
            (file.filename, file_path, structure, user.id)
        )
        doc_id = cursor.lastrowid
        conn.commit()

        # Update status with actual doc_id
        if temp_doc_id in processing_status:
            del processing_status[temp_doc_id]
        processing_status[doc_id] = {"status": "done", "message": "Document indexed successfully"}

        return {"message": "Success", "document_id": doc_id}
    except Exception as e:
        if os.path.exists(file_path):
           os.remove(file_path)
        if temp_doc_id in processing_status:
            processing_status[temp_doc_id] = {"status": "error", "message": str(e)}

        raise HTTPException(
           status_code=500,
           detail=f"Document processing failed: {str(e)}"
    )


@app.get("/documents/{doc_id}/status")
def get_document_status(doc_id: int, user: User = Depends(get_current_user)):
    """Check if a document is still being processed."""
    status = processing_status.get(doc_id, {"status": "done", "message": "Ready"})
    return status

@app.get("/documents/{doc_id}/preview")
async def get_document_preview(doc_id: int, user: User = Depends(get_current_user)):
    cursor.execute("SELECT file_path, filename FROM documents WHERE id = ? AND user_id = ?", (doc_id, user.id))
    row = cursor.fetchone()
    
    if not row or not row[0]:
        raise HTTPException(status_code=404, detail="Document not found")

    file_path = row[0]
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File missing on disk")

    # Serves the file from the 'documents' folder
    return FileResponse(file_path, filename=row[1])

@app.post("/ask")
async def ask(query: Query, user: User = Depends(get_current_user)):
    if not query.document_ids:
        return {"answer": "No documents provided."}

    placeholders = ",".join("?" for _ in query.document_ids)
    # Check if documents belong to user
    cursor.execute(f"SELECT structure FROM documents WHERE id IN ({placeholders}) AND user_id = ?", (*query.document_ids, user.id))
    rows = cursor.fetchall()
    
    if not rows:
        return {"answer": "Document(s) not found."}

    # Map provider to model
    MODEL_MAP = {
        "groq": "llama-3.3-70b-versatile",
        "gemini-lite": "gemini-3.5-flash-lite",
        "gemini-flash": "gemini-3.5-flash"
    }
    model = MODEL_MAP.get(query.provider, "llama-3.3-70b-versatile")

    # Step 1: LLM Tree Search — find relevant node_ids
    all_node_ids = []
    all_trees = []
    reasoning = ""
    for row in rows:
        tree = json.loads(row[0])
        all_trees.append(tree)
        search_result = await llm_tree_search(query.question, tree, model, query.provider)
        node_ids = search_result.get("node_list", [])
        reasoning = search_result.get("thinking", "")
        
        # If LLM tree search failed (rate limited), fall back to keyword search
        if not node_ids and "rate" in reasoning.lower():
            relevant = collect_relevant_nodes(tree, query.question, top_k=5)
            node_ids = [n["node"].get("node_id", "") for n in relevant if n["node"].get("node_id")]
            reasoning = " (Used keyword fallback due to rate limit)"
        
        all_node_ids.extend(node_ids)

    if not all_node_ids:
        return {"answer": "No relevant sections found.", "reasoning": reasoning}

    # Step 2: Retrieve nodes by ID
    all_nodes = []
    for tree in all_trees:
        all_nodes.extend(find_nodes_by_ids(tree, all_node_ids))

    if not all_nodes:
        return {"answer": "No relevant sections found.", "reasoning": reasoning}

    # Step 3: Generate answer with section citations
    context_parts = []
    for node in all_nodes:
        context_parts.append(
            f"[Section: '{node.get('title', '')}' | Page {node.get('start_index', node.get('page_index', '?'))}]\n"
            f"{node.get('text', 'Content not available.')[:3000]}"
        )
    context = "\n\n---\n\n".join(context_parts)

    prompt = f"""You are an expert document analyst.
Answer the question using ONLY the provided context.
For every claim you make, cite the section title and page number in parentheses.
Be concise and precise.

Question: {query.question}

Context:
{context}

Answer:"""

    answer = await ChatGPT_API_async(model=model, prompt=prompt, provider=query.provider)
    return {"answer": answer, "reasoning": reasoning, "sections": [n.get("title", "") for n in all_nodes]}


@app.get("/documents")
def list_documents(user: User = Depends(get_current_user)):
    cursor.execute("SELECT id, filename FROM documents WHERE user_id = ?", (user.id,))
    return [{"id": d[0], "filename": d[1]} for d in cursor.fetchall()]


@app.delete("/documents/{doc_id}")
def delete_document(doc_id: int, user: User = Depends(get_current_user)):
    # Get file path before deleting
    cursor.execute("SELECT file_path FROM documents WHERE id = ? AND user_id = ?", (doc_id, user.id))
    row = cursor.fetchone()
    
    if not row:
        raise HTTPException(status_code=404, detail="Document not found")
    
    file_path = row[0]
    
    # Delete from database
    cursor.execute("DELETE FROM documents WHERE id = ? AND user_id = ?", (doc_id, user.id))
    conn.commit()
    
    # Delete file from disk
    if file_path and os.path.exists(file_path):
        os.remove(file_path)
    
    return {"message": "Document deleted"}