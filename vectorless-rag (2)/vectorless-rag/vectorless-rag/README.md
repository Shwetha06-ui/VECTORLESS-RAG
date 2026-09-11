# Vectorless RAG — Document Q&A with Structured Retrieval

A full-stack **Retrieval-Augmented Generation** application that lets users upload PDF and Markdown documents, then ask natural-language questions answered by an LLM grounded in the document content — **without any vector database or embeddings**.

---

## How It Works

Traditional RAG systems embed document chunks into a vector store and perform similarity search. This project takes a different approach:

1. **Structured Parsing** — Uploaded documents are parsed into a hierarchical tree of sections (via TOC detection for PDFs, header parsing for Markdown).
2. **LLM Tree Search** — When a user asks a question, an LLM reasons over the document structure to identify relevant sections.
3. **Context Injection** — The selected sections are injected into an LLM prompt.
4. **Grounded Answer** — The LLM generates a structured Markdown response using only the provided context, with section citations.

This makes the system lightweight, cost-effective, and easy to deploy — no Pinecone, Chroma, or FAISS required.

---

## Quick Start (Windows)

### Prerequisites

- Python 3.10+ (add to PATH during install)
- Node.js 18+ (https://nodejs.org/)

### 1. Extract the ZIP file

### 2. Run Setup

Double-click `setup.bat` or run in Command Prompt:

```cmd
setup.bat
```

This will:
- Create a Python virtual environment
- Install all dependencies
- Create a `.env` configuration file
- Install Node.js packages

### 3. Configure API Keys

Edit `backend\.env` and add your keys:

```
GROQ_API_KEY=your_groq_api_key_here
JWT_SECRET_KEY=any_random_64_char_hex_string
SESSION_SECRET_KEY=any_other_random_64_char_hex_string
```

Get a free Groq API key at: https://console.groq.com/keys

### 4. Start the Application

```cmd
run.bat start
```

### 5. Open in Browser

http://localhost:5173

### 6. Stop the Application

```cmd
run.bat stop
```

---

## Quick Start (macOS/Linux)

### Prerequisites

- Python 3.10+
- Node.js 18+

### 1. Clone

```bash
git clone https://github.com/devbharu/vectorless-rag.git
cd vectorless-rag
```

### 2. Backend Setup

```bash
python -m venv venv
source venv/bin/activate
cd backend
pip install -r requirements.txt
```

Create a `.env` file in `backend/`:

```env
JWT_SECRET_KEY=your-secret-key-here
SESSION_SECRET_KEY=your-session-secret-here
GROQ_API_KEY=your-groq-api-key
```

Start the server:

```bash
uvicorn main:app --reload
```

Backend runs at `http://localhost:8000`. API docs at `http://localhost:8000/docs`.

### 3. Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

Frontend runs at `http://localhost:5173`.

---

## Features

- **Document Upload** — Upload PDF or Markdown files via the UI
- **Document Preview** — View PDFs inline (rendered in browser) or Markdown as text
- **AI Chat** — Ask questions about any uploaded document
- **LLM Tree Search** — LLM reasons over document structure for retrieval (no vectors)
- **Chat History** — All conversations are persisted per user with auto-titling
- **User Authentication** — Register/login with JWT-based auth (httponly cookies)
- **User Dashboard** — Profile icon with dropdown for history access and logout
- **Structured Markdown Responses** — Bot answers are rendered with full Markdown formatting (headings, code blocks, tables, etc.)
- **Multiple LLM Providers** — Switch between Groq, Gemini Flash Lite, and Gemini Flash

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| **Backend** | FastAPI, Python 3.10+ |
| **Frontend** | React 19, Vite, TailwindCSS 4 |
| **Database** | SQLite — file-based for users/chat, in-memory for documents |
| **Auth** | JWT (python-jose) + bcrypt, httponly cookies |
| **LLM** | Groq (Llama 3.3), Google Gemini |
| **Document Parsing** | PageIndex (Flash + Regular), PyMuPDF |
| **Retrieval** | LLM Tree Search (no vector embeddings) |

---

## Project Structure

```
vectorless-rag/
├── backend/
│   ├── main.py                 # FastAPI app, document & ask endpoints
│   ├── auth_routes.py          # Register, login, logout, /me
│   ├── auth_utils.py           # Password hashing, JWT creation
│   ├── chat_routes.py          # Chat session & message CRUD
│   ├── models.py               # SQLAlchemy models (User, ChatSession, ChatMessage)
│   ├── schemas.py              # Pydantic request schemas
│   ├── database.py             # SQLAlchemy engine & session
│   ├── pageindex_service.py    # Document processing orchestrator
│   ├── pageindex/
│   │   ├── page_index.py       # PDF → hierarchical tree parser
│   │   ├── page_index_md.py    # Markdown → hierarchical tree parser
│   │   ├── utils.py            # LLM API helpers
│   │   ├── flash/              # PageIndex Flash (layout stats)
│   │   └── config.yaml         # Parser configuration
│   ├── documents/              # Uploaded files (gitignored)
│   ├── requirements.txt
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── App.jsx             # Router, auth state management
│   │   ├── components/
│   │   │   └── AppLayout.jsx   # Main chat UI, sidebar, preview panel
│   │   └── pages/
│   │       ├── Login.jsx       # Login page
│   │       └── Register.jsx    # Registration page
│   ├── package.json
│   └── .gitignore
├── run.bat                     # Windows start/stop script
├── run.sh                      # macOS/Linux start/stop script
├── setup.bat                   # Windows setup script
├── .gitignore
└── README.md
```

---

## API Endpoints

### Documents

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/upload` | Upload a PDF or Markdown file |
| `GET` | `/documents` | List all uploaded documents |
| `GET` | `/documents/{id}/preview` | Download/preview a document |
| `DELETE` | `/documents/{id}` | Delete a document |
| `POST` | `/ask` | Ask a question about a document |

### Authentication

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/auth/register` | Create a new account |
| `POST` | `/auth/login` | Login (sets httponly cookie) |
| `POST` | `/auth/logout` | Logout (clears cookie) |
| `GET` | `/auth/me` | Get current authenticated user |

### Chat History

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/chat/sessions` | List user's chat sessions |
| `POST` | `/chat/sessions` | Create a new chat session |
| `GET` | `/chat/sessions/{id}/messages` | Get messages for a session |
| `POST` | `/chat/sessions/{id}/messages` | Add a message to a session |
| `DELETE` | `/chat/sessions/{id}` | Delete a chat session |

---

## Windows Commands

| Command | Description |
|---------|-------------|
| `run.bat start` | Start backend and frontend |
| `run.bat stop` | Stop both services |
| `run.bat restart` | Restart both services |
| `run.bat status` | Show current status |
| `run.bat logs` | Show recent logs |

---

## Notes

- The document database is **in-memory** — uploaded documents reset on server restart. Switch `sqlite3.connect(":memory:")` to `sqlite3.connect("documents.db")` in `main.py` to persist.
- User accounts and chat history are stored in `users.db` (file-based SQLite), so they persist across restarts.
- The `venv/` folder sits at the project root, outside `backend/`.

---

## Author

Devbharu
