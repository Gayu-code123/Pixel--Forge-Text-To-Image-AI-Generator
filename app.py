"""
PixelForge AI - Python Flask Backend
=====================================
Requirements:
  pip install flask flask-cors requests groq python-dotenv

Get FREE Groq API key from: https://console.groq.com (completely free, very fast)

Run:
  python app.py
  Server starts at http://localhost:5000
"""

import os
import json
import time
import hashlib 
import requests
from datetime import datetime
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS

# ── Load .env file ──────────────────────────────────────────────────────────
from dotenv import load_dotenv
load_dotenv()

# ── Try importing Groq ──────────────────────────────────────────────────────
try:
    from groq import Groq
    GROQ_AVAILABLE = True
except ImportError:
    GROQ_AVAILABLE = False
    print("⚠️  groq package not found. Install with: pip install groq")

# ── Read API key ONCE from env (set in .env or shell) ─────────────────────
GROQ_API_KEY = os.environ.get("GROQ_API_KEY", "")
GROQ_CONFIGURED = bool(GROQ_API_KEY)

print("DEBUG KEY loaded:", "YES" if GROQ_CONFIGURED else "NO (missing or empty)")

app = Flask(__name__, static_folder="static")
CORS(app)  # Allow all origins

# ══════════════════════════════════════════════════════════════════
# CONFIGURATION
# ══════════════════════════════════════════════════════════════════
DATA_FILE  = "pixelforge_users.json"
SECRET_KEY = "pixelforge-secret-2025"  # Change in production

# ══════════════════════════════════════════════════════════════════
# LOCAL JSON "DATABASE"
# ══════════════════════════════════════════════════════════════════
def load_db():
    if os.path.exists(DATA_FILE):
        with open(DATA_FILE, "r") as f:
            return json.load(f)
    return {"users": {}, "sessions": {}}

def save_db(db):
    with open(DATA_FILE, "w") as f:
        json.dump(db, f, indent=2)

def hash_password(password):
    return hashlib.sha256((password + SECRET_KEY).encode()).hexdigest()

def make_session_token(username):
    raw = f"{username}:{time.time()}:{SECRET_KEY}"
    return hashlib.sha256(raw.encode()).hexdigest()

def get_user_from_token(token):
    db = load_db()
    username = db["sessions"].get(token)
    if username:
        return db["users"].get(username)
    return None

# ══════════════════════════════════════════════════════════════════
# GROQ — PROMPT ENHANCER
# ══════════════════════════════════════════════════════════════════
TYPE_SYSTEM_HINTS = {
    "poster":  "poster design, bold typography, cinematic lighting, vibrant colors, professional layout",
    "banner":  "banner design, wide composition, modern style, eye-catching, clean",
    "logo":    "logo design, minimal, vector style, professional, scalable, iconic",
    "general": "high quality, detailed, attractive, professional, visually stunning",
}

def enhance_prompt_with_groq(user_prompt: str, design_type: str = "general") -> dict:
    """
    Use Groq to enhance user's raw prompt.
    Falls back to rule-based enhancement if Groq is unavailable or not configured.
    """
    if not GROQ_AVAILABLE or not GROQ_CONFIGURED:
        reason = "groq not installed" if not GROQ_AVAILABLE else "API key not set"
        print(f"ℹ️  Using rule-based fallback ({reason})")
        return rule_based_enhance(user_prompt, design_type)

    try:
        client = Groq(api_key=GROQ_API_KEY)

        system_prompt = (
            "You are an expert AI image prompt engineer specializing in graphic design. "
            "Your job is to take a short user description and expand it into a detailed, "
            "rich image generation prompt. The enhanced prompt should include: "
            "visual style, color palette, lighting, mood, composition details, and quality keywords. "
            "Keep it under 200 words. Return ONLY the enhanced prompt text, nothing else."
        )

        user_message = (
            f"Design type: {design_type}\n"
            f"User's idea: {user_prompt}\n\n"
            f"Base style keywords to incorporate: {TYPE_SYSTEM_HINTS.get(design_type, TYPE_SYSTEM_HINTS['general'])}\n\n"
            "Write an enhanced, detailed image generation prompt:"
        )

        chat = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user",   "content": user_message},
            ],
            max_tokens=300,
            temperature=0.7,
        )

        enhanced = chat.choices[0].message.content.strip()
        return {
            "success": True,
            "original": user_prompt,
            "enhanced": enhanced,
            "model": "groq/llama-3.3-70b",
        }

    except Exception as e:
        print(f"Groq error: {e}")
        return rule_based_enhance(user_prompt, design_type)


def rule_based_enhance(user_prompt: str, design_type: str) -> dict:
    """Fallback enhancer when Groq is unavailable."""
    type_hint    = TYPE_SYSTEM_HINTS.get(design_type, TYPE_SYSTEM_HINTS["general"])
    quality_words = (
        "ultra detailed, 4K, professional photography, sharp focus, "
        "award winning design, trending on Behance"
    )
    enhanced = f"{user_prompt}, {type_hint}, {quality_words}"
    return {
        "success": True,
        "original": user_prompt,
        "enhanced": enhanced,
        "model": "rule-based-fallback",
    }


# ══════════════════════════════════════════════════════════════════
# POLLINATIONS IMAGE URL BUILDER
# ══════════════════════════════════════════════════════════════════
def build_pollinations_url(prompt: str, width: int = 1024, height: int = 1024, seed: int = None) -> str:
    if seed is None:
        seed = int(time.time())
    width  = min(max(width,  256), 1792)
    height = min(max(height, 256), 1792)
    encoded = requests.utils.quote(prompt)
    return (
        f"https://image.pollinations.ai/prompt/{encoded}"
        f"?width={width}&height={height}&nologo=true&seed={seed}&enhance=true"
    )


# ══════════════════════════════════════════════════════════════════
# HELPERS
# ══════════════════════════════════════════════════════════════════
def get_token():
    auth = request.headers.get("Authorization", "")
    if auth.startswith("Bearer "):
        return auth[7:] 
    return request.headers.get("X-Token", "")

def safe_user(u):
    return {k: v for k, v in u.items() if k not in ("password_hash",)}


# ══════════════════════════════════════════════════════════════════
# API ROUTES
# ══════════════════════════════════════════════════════════════════

@app.route("/api/health", methods=["GET"])
def health():
    return jsonify({
        "status":           "ok",
        "groq_configured":  GROQ_CONFIGURED,
        "groq_available":   GROQ_AVAILABLE,
        "time":             datetime.now().isoformat(),
    })


@app.route("/api/signup", methods=["POST"])
def signup():
    data     = request.get_json()
    username = (data.get("username") or "").strip().lower()
    email    = (data.get("email")    or "").strip().lower()
    password = data.get("password", "")
    role     = data.get("role", "other")
    bizname  = (data.get("bizname") or "").strip()
    bizaddr  = (data.get("bizaddr") or "").strip()

    if not username or not email:
        return jsonify({"error": "Username and email are required."}), 400

    db = load_db()
    if username in db["users"]:
        return jsonify({"error": "Username already exists!"}), 409

    user = {
        "username":      username,
        "email":         email,
        "password_hash": hash_password(password) if password else None,
        "role":          role,
        "bizname":       bizname,
        "bizaddr":       bizaddr,
        "designs":       0,
        "posters":       0,
        "banners":       0,
        "joined":        datetime.now().strftime("%d %B %Y"),
        "history":       [],
    }

    db["users"][username] = user
    token = make_session_token(username)
    db["sessions"][token] = username
    save_db(db)

    return jsonify({"success": True, "token": token, "user": safe_user(user)})


@app.route("/api/login", methods=["POST"])
def login():
    data     = request.get_json()
    username = (data.get("username") or "").strip().lower()
    password = data.get("password", "")
    role     = data.get("role", "other")

    db   = load_db()
    user = db["users"].get(username)

    if not user:
        return jsonify({"error": "User not found."}), 404
    if user["role"] != role:
        return jsonify({"error": f"This account is registered as '{user['role']}'."}), 403
    if user.get("password_hash") and user["password_hash"] != hash_password(password):
        return jsonify({"error": "Incorrect password."}), 401

    token = make_session_token(username)
    db["sessions"][token] = username
    save_db(db)

    return jsonify({"success": True, "token": token, "user": safe_user(user)})


@app.route("/api/logout", methods=["POST"])
def logout():
    token = get_token()
    if token:
        db = load_db()
        db["sessions"].pop(token, None)
        save_db(db)
    return jsonify({"success": True})


@app.route("/api/profile", methods=["GET"])
def get_profile():
    user = get_user_from_token(get_token())
    if not user:
        return jsonify({"error": "Unauthorized"}), 401
    return jsonify({"user": safe_user(user)})


@app.route("/api/profile", methods=["PUT"])
def update_profile():
    user = get_user_from_token(get_token())
    if not user:
        return jsonify({"error": "Unauthorized"}), 401

    data = request.get_json()
    db   = load_db()
    u    = db["users"][user["username"]]

    if "email"   in data: u["email"]   = data["email"].strip()
    if "bizname" in data: u["bizname"] = data["bizname"].strip()
    if "bizaddr" in data: u["bizaddr"] = data["bizaddr"].strip()

    save_db(db)
    return jsonify({"success": True, "user": safe_user(u)})


@app.route("/api/generate", methods=["POST"])
def generate():
    user = get_user_from_token(get_token())
    if not user:
        return jsonify({"error": "Please login to generate images."}), 401

    data        = request.get_json()
    raw_prompt  = (data.get("prompt") or "").strip()
    design_type = data.get("type", "general")
    width       = int(data.get("width",  1024))
    height      = int(data.get("height", 1024))

    if not raw_prompt:
        return jsonify({"error": "Prompt is required."}), 400

    enhanced_result = enhance_prompt_with_groq(raw_prompt, design_type)
    enhanced_prompt = enhanced_result["enhanced"]

    seed      = int(time.time())
    image_url = build_pollinations_url(enhanced_prompt, width, height, seed)

    db = load_db()
    u  = db["users"][user["username"]]
    u["designs"] = u.get("designs", 0) + 1
    if design_type == "poster": u["posters"] = u.get("posters", 0) + 1
    if design_type == "banner": u["banners"] = u.get("banners", 0) + 1

    entry = {
        "prompt":    raw_prompt,
        "enhanced":  enhanced_prompt,
        "type":      design_type,
        "image_url": image_url,
        "created":   datetime.now().isoformat(),
    }
    history = u.get("history", [])
    history.insert(0, entry)
    u["history"] = history[:20]
    save_db(db)

    return jsonify({
        "success":    True,
        "original":   raw_prompt,
        "enhanced":   enhanced_prompt,
        "image_url":  image_url,
        "model_used": enhanced_result.get("model"),
        "dimensions": {"width": width, "height": height},
    })


@app.route("/api/history", methods=["GET"])
def get_history():
    user = get_user_from_token(get_token())
    if not user:
        return jsonify({"error": "Unauthorized"}), 401

    db = load_db()
    u  = db["users"].get(user["username"], {})
    return jsonify({"history": u.get("history", [])})


# ── Static frontend ────────────────────────────────────────────────────────
@app.route("/")
def index():
    return send_from_directory("static", "index.html")


# ══════════════════════════════════════════════════════════════════
# RUN
# ══════════════════════════════════════════════════════════════════
if __name__ == "__main__":
    print("=" * 55)
    print("  PixelForge AI — Python Backend")
    print("=" * 55)
    print(f"  Groq installed  : {GROQ_AVAILABLE}")
    print(f"  Groq configured : {GROQ_CONFIGURED}")
    print(f"  Database file   : {DATA_FILE}")
    print(f"  Server          : http://localhost:5000")
    print("=" * 55)
    print("  Get FREE Groq API key: https://console.groq.com")
    print("=" * 55)
    app.run(debug=True, host="0.0.0.0", port=5000)