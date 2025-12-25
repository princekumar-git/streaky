const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'streaky.db');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) console.error('Error opening database:', err.message);
    else {
        console.log('Connected to the SQLite database.');
        initDb();
    }
});

function initDb() {
    db.serialize(() => {
        // 1. Users Table (With extra profile fields)
        db.run(`CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE,
            password TEXT,
            role TEXT DEFAULT 'user',
            full_name TEXT,
            location TEXT,
            gender TEXT,
            age INTEGER
        )`);

        // 2. Habits Table
        db.run(`CREATE TABLE IF NOT EXISTS habits (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            text TEXT,
            type TEXT DEFAULT 'boolean',
            unit TEXT,
            target REAL,
            FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
        )`);

        // 3. Habit History
        db.run(`CREATE TABLE IF NOT EXISTS habit_history (
            habit_id INTEGER,
            date TEXT,
            value REAL,
            PRIMARY KEY (habit_id, date),
            FOREIGN KEY(habit_id) REFERENCES habits(id) ON DELETE CASCADE
        )`);

        // 4. Tasks Table
        db.run(`CREATE TABLE IF NOT EXISTS tasks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            text TEXT,
            done INTEGER DEFAULT 0,
            FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
        )`);
    });
}

module.exports = db;