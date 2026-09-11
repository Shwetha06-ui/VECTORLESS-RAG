from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from jose import jwt, JWTError
from pydantic import BaseModel
from typing import Optional

from database import SessionLocal
from models import User, ChatSession, ChatMessage
from auth_utils import SECRET_KEY, ALGORITHM, get_db, get_current_user

router = APIRouter()






# --- Schemas ---

class SessionCreate(BaseModel):
    title: Optional[str] = "New Chat"
    document_filename: Optional[str] = None


class MessageCreate(BaseModel):
    role: str
    content: str


# --- Endpoints ---

@router.get("/sessions")
def list_sessions(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    sessions = (
        db.query(ChatSession)
        .filter(ChatSession.user_id == user.id)
        .order_by(ChatSession.created_at.desc())
        .all()
    )
    return [
        {
            "id": s.id,
            "title": s.title,
            "document_filename": s.document_filename,
            "created_at": s.created_at.isoformat() if s.created_at else None,
            "message_count": len(s.messages),
        }
        for s in sessions
    ]


@router.post("/sessions")
def create_session(
    data: SessionCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    session = ChatSession(
        user_id=user.id,
        title=data.title,
        document_filename=data.document_filename,
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    return {"id": session.id, "title": session.title}


@router.get("/sessions/{session_id}/messages")
def get_messages(
    session_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    session = (
        db.query(ChatSession)
        .filter(ChatSession.id == session_id, ChatSession.user_id == user.id)
        .first()
    )
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    return {
        "session": {
            "id": session.id,
            "title": session.title,
            "document_filename": session.document_filename,
        },
        "messages": [
            {"role": m.role, "content": m.content}
            for m in session.messages
        ],
    }


@router.post("/sessions/{session_id}/messages")
def add_message(
    session_id: int,
    data: MessageCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    session = (
        db.query(ChatSession)
        .filter(ChatSession.id == session_id, ChatSession.user_id == user.id)
        .first()
    )
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    msg = ChatMessage(session_id=session.id, role=data.role, content=data.content)
    db.add(msg)

    # Auto-title from first user message
    if session.title == "New Chat" and data.role == "user":
        session.title = data.content[:50] + ("..." if len(data.content) > 50 else "")

    db.commit()
    return {"status": "ok"}


@router.delete("/sessions/{session_id}")
def delete_session(
    session_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    session = (
        db.query(ChatSession)
        .filter(ChatSession.id == session_id, ChatSession.user_id == user.id)
        .first()
    )
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    db.delete(session)
    db.commit()
    return {"status": "deleted"}
