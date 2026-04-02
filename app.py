from flask import Flask, render_template, request, redirect, session, jsonify, url_for
import sqlite3
from groq import Groq
import mysql.connector
from dotenv import load_dotenv
import os
import requests,urllib.parse,random,base64
from anthropic import Anthropic

load_dotenv()

api_key = os.getenv("GROQ_API_KEY")

app = Flask(__name__)
app.secret_key = "secret123"
def get_db():
    return mysql.connector.connect(
    host=os.getenv("DB_HOST"),
    user=os.getenv("DB_USER"),
    password=os.getenv("DB_PASSWORD"),
    database=os.getenv("DB_NAME"),
    port=int(os.getenv("DB_PORT",3306)),
    ssl_disabled=False
)
conn=get_db()
print("Connected to MySQL ✅")

cur = conn.cursor()

client = Groq(api_key=api_key)
anthrropic_client = Anthropic(api_key=os.getenv("anthropic_api_key"))


@app.route("/")
def home():
    if "user" in session:
        return render_template("index.html")
    else:
        return redirect(url_for("signup"))



@app.route("/signup", methods=["GET", "POST"])
def signup():
    conn = get_db()
    cur = conn.cursor()
    if request.method == "POST":
        username = request.form.get("username")
        password = request.form.get("password")
        city = request.form.get("city")
        age = request.form.get("age")

        cur.execute(
            "INSERT INTO users (username, password, city, age) VALUES (%s, %s, %s, %s)",
            (username, password, city, age)
        )
        conn.commit()
        cur.close()
        conn.close()

        print("Data inserted in MySQL ✅")

        return redirect("/login")

    return render_template("signup.html")
    cur.close()
    conn.close()

@app.route("/login", methods=["GET", "POST"])
def login():
    conn = get_db()
    cur = conn.cursor()
    if request.method == "POST":
        username = request.form.get("username")
        password = request.form.get("password")

        cur.execute(
            "SELECT * FROM users WHERE username=%s AND password=%s",
            (username, password)
        )
        user = cur.fetchone()

        if user:
            session["user"] = username
            return redirect("/")
        else:
            return "Invalid credentials ❌"

    return render_template("login.html")
    cur.close()
    conn.close()



@app.route("/logout")
def logout():
    session.pop("user", None)
    return redirect(url_for("login"))

@app.route('/tutorial')
def tutorial():
    return render_template('tutorial.html')


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