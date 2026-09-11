from fastapi import APIRouter, Depends, Response, HTTPException, Request
from sqlalchemy.orm import Session
from jose import jwt, JWTError

from database import SessionLocal
from models import User
from schemas import RegisterUser, LoginUser
from auth_utils import hash_password, verify_password, create_token, SECRET_KEY, ALGORITHM, get_db

router = APIRouter()






@router.post("/register")
def register(user: RegisterUser, db: Session = Depends(get_db)):

    existing = db.query(User).filter(User.username == user.username).first()

    if existing:
        raise HTTPException(status_code=400, detail="User already exists")

    new_user = User(
        username=user.username,
        email=user.email,
        password_hash=hash_password(user.password)
    )

    db.add(new_user)
    db.commit()

    return {"message": "User registered successfully"}


@router.post("/login")
def login(user: LoginUser, response: Response, db: Session = Depends(get_db)):

    db_user = db.query(User).filter(User.username == user.username).first()

    if not db_user:
        raise HTTPException(status_code=401, detail="Invalid credentials")

    if not verify_password(user.password, db_user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    token = create_token(user.username)

    response.set_cookie(
        key="access_token",
        value=token,
        httponly=True,
        samesite="none",
        secure=True
    )

    return {"message": "Login successful"}


@router.post("/logout")
def logout(response: Response):

    response.delete_cookie("access_token")

    return {"message": "Logged out"}


# ------------------------------------------------
# NEW: Get Current Logged-in User
# ------------------------------------------------
@router.get("/me")
def get_current_user(request: Request):

    token = request.cookies.get("access_token")

    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")

    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username = payload.get("sub")
        if username is None:
            raise HTTPException(status_code=401, detail="Invalid token")
        return {"user": username}
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")