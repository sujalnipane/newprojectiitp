import os
from flask import Flask, render_template, request, redirect, session, jsonify, url_for
from flask_sqlalchemy import SQLAlchemy
from werkzeug.security import generate_password_hash, check_password_hash
from groq import Groq
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)
app.secret_key = "secret123" # Aap ise bhi .env mein daal sakte hain

# --- DATABASE CONFIGURATION (SQLite) ---
# Ye aapke project folder mein 'database.db' naam ki file bana dega
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///database.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db = SQLAlchemy(app)

# --- DATABASE MODEL ---
class User(db.Model):
    __tablename__ = 'users'
    
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    password = db.Column(db.String(255), nullable=False) # Hashed password ke liye
    city = db.Column(db.String(100))
    age = db.Column(db.Integer)

# App start hote hi table automatic ban jayegi agar nahi bani hogi toh
with app.app_context():
    db.create_all()
    print("SQLite Database Connected & Synced! ✅")

# --- GROQ CLIENT ---
api_key = os.getenv("GROQ_API_KEY")
client = Groq(api_key=api_key)


# --- ROUTES ---

@app.route("/")
def home():
    if "user" in session:
        return render_template("index.html")
    return redirect(url_for("signup"))


@app.route("/signup", methods=["GET", "POST"])
def signup():
    if request.method == "POST":
        username = request.form.get("username")
        password = request.form.get("password")
        city = request.form.get("city")
        age = request.form.get("age")

        # Check if user already exists
        existing_user = User.query.filter_by(username=username).first()
        if existing_user:
            return "Username already exists ❌", 400

        # Password securely hash karne ke liye
        hashed_password = generate_password_hash(password)

        # Naya user insert karna
        new_user = User(username=username, password=hashed_password, city=city, age=age)
        db.session.add(new_user)
        db.session.commit()

        print(f"User {username} registered successfully in SQLite! ✅")
        return redirect(url_for("login"))

    return render_template("signup.html")


@app.route("/login", methods=["GET", "POST"])
def login():
    if request.method == "POST":
        username = request.form.get("username")
        password = request.form.get("password")

        # Database se user find karna
        user = User.query.filter_by(username=username).first()

        # Password verify karna
        if user and check_password_hash(user.password, password):
            session["user"] = username
            return redirect(url_for("home"))
        else:
            return "Invalid credentials ❌", 401

    return render_template("login.html")


@app.route("/logout")
def logout():
    session.pop("user", None)
    return redirect(url_for("login"))


@app.route('/tutorial')
def tutorial():
    return render_template('tutorial.html')


@app.route('/image')
def image():
    return render_template('image.html')


@app.route("/generate", methods=["POST"])
def generate():
    if "user" not in session:
        return jsonify({"error": "Unauthorized"}), 401

    data = request.get_json()
    prompt = data.get("prompt")

    completion = client.chat.completions.create(
        model="llama-3.1-8b-instant",
        messages=[
            {
                "role": "user",
                "content": f"Create a modern HTML CSS website for: {prompt}. Only give code."
            }
        ]
    )

    return jsonify({"result": completion.choices[0].message.content})


if __name__ == "__main__":
    app.run(
        host="0.0.0.0",
        port=int(os.environ.get("PORT", 5000))
    )