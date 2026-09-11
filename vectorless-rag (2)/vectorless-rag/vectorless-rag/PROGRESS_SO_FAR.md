# Interim progress report

This is a **partial** fix, packaged early at your request. It is NOT the final
deliverable — auth/security, frontend, and several other items from your list
are not done yet. Delete this file once the work is complete.

## ✅ Done and tested in this pass

1. **Root-caused and fixed the Groq 413 "request too large" errors**
   (`backend/pageindex/page_index.py`, `backend/pageindex/utils.py`):
   - The old code treated a 413 "request too large" error exactly like a
     transient 429 rate limit — it retried the *identical* oversized prompt
     with exponential backoff, which can never succeed. Now a dedicated
     `GroqRequestTooLargeError` is raised immediately for 413s, and only
     genuine 429 rate-limit errors get the backoff/retry treatment.
   - `process_no_toc` (the no-TOC path you flagged) now reserves headroom
     for the prompt's instruction text before deciding chunk size, instead
     of using the raw `max_token_num_each_node` as the full request budget.
   - Token counting now applies a safety margin, since `count_tokens()`
     falls back to OpenAI's `cl100k_base` tokenizer for Llama/GPT-OSS
     models and under-counts relative to what Groq actually bills.
   - New `generate_toc_init_safe` / `generate_toc_continue_safe` /
     `_safe_add_page_number_to_toc` wrappers: if a chunk is still rejected
     as too large, it's split on a page boundary and retried recursively
     (verified with a unit test simulating a 413 on the first call).
   - `page_list_to_group_text` now hard-caps any group at `max_tokens` and
     gives an oversized single page its own group instead of letting it
     silently blow the budget.
   - Model is now configurable via `GROQ_MODEL` in `.env` instead of being
     hardcoded to `llama-3.3-70b-versatile` in two separate files.

2. **`if_add_node_text` behavior verified** — traced it through
   `pageindex_service.py` → `page_index_main` → `add_node_text`; actual
   document text is retained in the tree, not disabled.

3. **`extract_json` reviewed** — it already does not silently return `{}`;
   it repairs with `json_repair` and raises a clear `ValueError` if repair
   fails. No change needed there (structural validation of the repaired
   JSON is still on the TODO list below).

4. **Fixed a real "can't even install" bug**: `backend/requirements.txt`
   was missing `groq`, `tiktoken`, and `json-repair` even though
   `pageindex/utils.py` imports all three directly. A fresh
   `pip install -r requirements.txt` would have failed to import the app
   at all. Verified by installing into a clean venv and importing `main.py`
   successfully (routes listed, app builds).

5. **Removed the leaked secrets from the zip.** Your uploaded project
   contained a real `.env` with a live `GROQ_API_KEY`, `JWT_SECRET_KEY`,
   and `SESSION_SECRET_KEY` in plaintext. I removed it and added
   `backend/.env.example` with placeholders instead.
   **Please rotate that Groq API key — treat it as compromised since it
   was in a file you shared.**

## ❌ Not done yet — still required before this is a real fix

- **No authentication on document endpoints.** `/upload`, `/documents`,
  `/documents/{id}/preview`, and `/ask` in `main.py` currently have zero
  auth checks, and the `documents` table has no `user_id` column at all —
  any logged-in (or even logged-out) user can read/query anyone else's
  documents. This is the highest-priority remaining item.
- **Frontend hardcodes `http://localhost:8000`** in 4 files
  (`AppLayout.jsx`, `App.jsx`, `Login.jsx`, `Register.jsx`,
  `services/auth.js`) instead of using `VITE_API_URL`.
- **Frontend shares one `loading` flag** between file upload and AI
  "thinking" state — this is the actual cause of the "shows Thinking...
  during PDF processing" bug you reported. Needs a separate `uploading`
  state.
- **Backend blocks the event loop during PDF processing** — the
  synchronous Groq calls inside `process_document` run directly inside an
  `async def`, without a thread offload, so all other requests (including
  simple auth checks) stall while one document is being processed. Needs
  `asyncio.to_thread`.
- **Multi-document Q&A** (`document_ids: list[int]`) not implemented yet.
- **JSON structural validation** after `extract_json` repair (currently
  only checks it parses as JSON, not that it's the expected list-of-dicts
  shape).
- **SQLite migration** for adding `user_id` to `documents` and any schema
  changes needed for multi-doc chat sessions.
- **README rewrite**, final full test pass, and final honest test report.
- **Cannot be tested end-to-end in this sandbox**: `api.groq.com` is not
  reachable from here, so the chunking/retry logic above was verified with
  unit tests against mocked Groq responses, not a live PDF → answer round
  trip. You'll need to run that test yourself once you have the final zip.

I'm continuing to work through the remaining items now.
