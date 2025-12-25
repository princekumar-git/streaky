const express = require('express');
const bodyParser = require('body-parser');
const bcrypt = require('bcryptjs');
const db = require('./database');
const path = require('path');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 3000;

// --- CONFIG ---
const INVITE_CODE = "user@invitation";       
const ADMIN_CODE = "princethakur24102005"; 

app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// Rate Limiter
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, 
    max: 100 
});
app.use('/api/', limiter);

// --- MIDDLEWARE ---
const getUserId = (req, res, next) => {
    const username = req.headers['x-user'];
    if (!username) return res.status(401).json({ error: 'Unauthorized' });

    db.get("SELECT id FROM users WHERE username = ?", [username], (err, row) => {
        if (err || !row) return res.status(401).json({ error: 'User not found' });
        req.userId = row.id;
        next();
    });
};

const requireAdmin = (req, res, next) => {
    db.get("SELECT role FROM users WHERE id = ?", [req.userId], (err, row) => {
        if (err || !row) return res.status(401).json({ error: 'User not found' });
        if (row.role !== 'admin') return res.status(403).json({ error: 'Access Denied' });
        next();
    });
};

// --- AUTH ROUTES ---
app.post('/api/register', (req, res) => {
    const { username, password, code } = req.body;
    let role = 'user';
    if (code === ADMIN_CODE) role = 'admin';
    else if (code !== INVITE_CODE) return res.status(403).json({ error: "Invalid Invite Code" });

    const hash = bcrypt.hashSync(password, 10);
    db.run("INSERT INTO users (username, password, role) VALUES (?, ?, ?)", [username, hash, role], function(err) {
        if (err) return res.status(400).json({ error: "Username already exists" });
        res.json({ success: true });
    });
});

app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    db.get("SELECT * FROM users WHERE username = ?", [username], (err, user) => {
        if (!user || !bcrypt.compareSync(password, user.password)) {
            return res.status(401).json({ error: "Invalid credentials" });
        }
        res.json({ success: true, username: user.username, role: user.role });
    });
});

// --- USER SELF-MANAGEMENT (NEW) ---
app.delete('/api/user/me', getUserId, (req, res) => {
    // Allows user to delete their own account
    db.run("DELETE FROM users WHERE id = ?", [req.userId], function(err) {
        if(err) return res.status(500).json({error: err.message});
        res.json({ success: true });
    });
});

// --- DATA ROUTES ---
app.get('/api/data', getUserId, (req, res) => {
    const data = { habits: [], tasks: [] };
    db.all("SELECT * FROM tasks WHERE user_id = ?", [req.userId], (err, tasks) => {
        data.tasks = tasks.map(t => ({ ...t, done: !!t.done }));
        db.all("SELECT * FROM habits WHERE user_id = ?", [req.userId], (err, habits) => {
            if (habits.length === 0) return res.json(data);
            let processed = 0;
            habits.forEach((habit) => {
                db.all("SELECT date, value FROM habit_history WHERE habit_id = ?", [habit.id], (err, historyRows) => {
                    const historyMap = {};
                    historyRows.forEach(r => historyMap[r.date] = r.value);
                    data.habits.push({ ...habit, history: historyMap });
                    processed++;
                    if (processed === habits.length) res.json(data);
                });
            });
        });
    });
});

app.post('/api/habits', getUserId, (req, res) => {
    const { text, type, unit, target } = req.body;
    db.run("INSERT INTO habits (user_id, text, type, unit, target) VALUES (?, ?, ?, ?, ?)",
        [req.userId, text, type, unit, target],
        function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ id: this.lastID });
        }
    );
});

app.delete('/api/habits/:id', getUserId, (req, res) => {
    db.run("DELETE FROM habits WHERE id = ? AND user_id = ?", [req.params.id, req.userId], function() {
        res.json({ deleted: this.changes });
    });
});

app.post('/api/history', getUserId, (req, res) => {
    const { habitId, date, value } = req.body;
    db.get("SELECT id FROM habits WHERE id = ? AND user_id = ?", [habitId, req.userId], (err, row) => {
        if (!row) return res.status(403).json({ error: "Habit not found" });
        if (value === null) {
            db.run("DELETE FROM habit_history WHERE habit_id = ? AND date = ?", [habitId, date], () => res.json({ success: true }));
        } else {
            db.run("INSERT INTO habit_history (habit_id, date, value) VALUES (?, ?, ?) ON CONFLICT(habit_id, date) DO UPDATE SET value=excluded.value",
                [habitId, date, value], () => res.json({ success: true }));
        }
    });
});

app.post('/api/tasks', getUserId, (req, res) => {
    const { text } = req.body;
    db.run("INSERT INTO tasks (user_id, text, done) VALUES (?, ?, 0)", [req.userId, text], function() {
        res.json({ id: this.lastID });
    });
});

app.put('/api/tasks/:id', getUserId, (req, res) => {
    const { done } = req.body;
    db.run("UPDATE tasks SET done = ? WHERE id = ? AND user_id = ?", [done ? 1 : 0, req.params.id, req.userId], () => {
        res.json({ success: true });
    });
});

app.delete('/api/tasks/:id', getUserId, (req, res) => {
    db.run("DELETE FROM tasks WHERE id = ? AND user_id = ?", [req.params.id, req.userId], () => {
        res.json({ success: true });
    });
});

// --- ADMIN ROUTES ---
app.get('/api/admin/users', getUserId, requireAdmin, (req, res) => {
    const sql = `
        SELECT u.id, u.username, u.role,
        (SELECT COUNT(*) FROM habits WHERE user_id = u.id) as habit_count,
        (SELECT COUNT(*) FROM tasks WHERE user_id = u.id) as task_count
        FROM users u
    `;
    db.all(sql, [], (err, rows) => res.json(rows));
});

app.delete('/api/admin/users/:id', getUserId, requireAdmin, (req, res) => {
    if(parseInt(req.params.id) === req.userId) return res.status(400).json({error: "Cannot delete yourself"});
    db.run("DELETE FROM users WHERE id = ?", [req.params.id], function(err) {
        if(err) return res.status(500).json({error: err.message});
        res.json({ success: true });
    });
});

app.post('/api/admin/reset-pass', getUserId, requireAdmin, (req, res) => {
    const { targetUserId, newPassword } = req.body;
    const hash = bcrypt.hashSync(newPassword, 10);
    db.run("UPDATE users SET password = ? WHERE id = ?", [hash, targetUserId], (err) => {
        if(err) return res.status(500).json({error: err.message});
        res.json({ success: true });
    });
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));