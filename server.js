const express = require('express');
const bodyParser = require('body-parser');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('./database');
const path = require('path');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'secret-key-change-in-prod';

// CODES
const INVITE_CODE = "user@invitation";       
const ADMIN_CODE = "princethakur24102005"; 

app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 200 });
app.use('/api/', limiter);

// --- MIDDLEWARE ---
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Unauthorized' });
    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ error: 'Forbidden' });
        req.user = user;
        next();
    });
};

const requireAdmin = (req, res, next) => {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admins only' });
    next();
};

// --- AUTH & USER ROUTES ---

// Register (Simplified: Only Username/Password/Code)
app.post('/api/register', async (req, res) => {
    // Only extract necessary fields. Other fields (full_name etc) default to NULL in DB.
    const { username, password, code } = req.body;

    let role = 'user';
    if (code === ADMIN_CODE) role = 'admin';
    else if (code !== INVITE_CODE) return res.status(400).json({ error: 'Invalid Invite Code' });

    if (!username || !password) return res.status(400).json({ error: 'Username/Password required' });

    const hashedPassword = await bcrypt.hash(password, 10);
    
    // We insert NULL for the profile fields initially
    const sql = `INSERT INTO users (username, password, role) VALUES (?, ?, ?)`;
    db.run(sql, [username, hashedPassword, role], function(err) {
        if (err) return res.status(400).json({ error: 'Username already exists' });
        res.json({ success: true });
    });
});

// Login
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    db.get("SELECT * FROM users WHERE username = ?", [username], async (err, user) => {
        if (err || !user) return res.status(400).json({ error: 'User not found' });
        if (await bcrypt.compare(password, user.password)) {
            const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
            res.json({ token, username: user.username, role: user.role });
        } else {
            res.status(400).json({ error: 'Invalid password' });
        }
    });
});

// Get Current User Profile
app.get('/api/me', authenticateToken, (req, res) => {
    db.get("SELECT id, username, role, full_name, age, gender, location FROM users WHERE id = ?", [req.user.id], (err, row) => {
        res.json(row);
    });
});

// Update Profile
app.put('/api/profile', authenticateToken, (req, res) => {
    const { full_name, age, gender, location } = req.body;
    const sql = `UPDATE users SET full_name = ?, age = ?, gender = ?, location = ? WHERE id = ?`;
    db.run(sql, [full_name, age, gender, location, req.user.id], function(err) {
        if (err) return res.status(500).json({ error: 'Update failed' });
        res.json({ success: true });
    });
});

// Delete Account
app.delete('/api/me', authenticateToken, (req, res) => {
    db.run("DELETE FROM users WHERE id = ?", [req.user.id], (err) => {
        if(err) return res.status(500).json({error: "Failed"});
        res.json({success: true});
    });
});

// --- DATA ROUTES ---

app.get('/api/data', authenticateToken, (req, res) => {
    db.all("SELECT * FROM habits WHERE user_id = ?", [req.user.id], (err, habits) => {
        if (err) return res.status(500).json({ error: 'Db error' });
        
        const habitPromises = habits.map(h => new Promise((resolve) => {
            db.all("SELECT date, value FROM habit_history WHERE habit_id = ?", [h.id], (e, rows) => {
                const history = {};
                rows.forEach(r => history[r.date] = r.value);
                h.history = history;
                resolve(h);
            });
        }));

        Promise.all(habitPromises).then(fullHabits => {
            db.all("SELECT * FROM tasks WHERE user_id = ?", [req.user.id], (e, tasks) => {
                res.json({ habits: fullHabits, tasks });
            });
        });
    });
});

// Habits & Tasks CRUD
app.post('/api/habits', authenticateToken, (req, res) => {
    const { text, type, unit, target } = req.body;
    db.run("INSERT INTO habits (user_id, text, type, unit, target) VALUES (?,?,?,?,?)", 
        [req.user.id, text, type, unit, target], function() { res.json({ id: this.lastID }); });
});
app.delete('/api/habits/:id', authenticateToken, (req, res) => {
    db.run("DELETE FROM habits WHERE id = ? AND user_id = ?", [req.params.id, req.user.id], () => res.json({success: true}));
});
app.post('/api/history', authenticateToken, (req, res) => {
    const { habit_id, date, value } = req.body;
    db.run(`INSERT INTO habit_history (habit_id, date, value) VALUES (?,?,?) 
            ON CONFLICT(habit_id, date) DO UPDATE SET value=excluded.value`, 
            [habit_id, date, value], () => res.json({success: true}));
});

app.post('/api/tasks', authenticateToken, (req, res) => {
    db.run("INSERT INTO tasks (user_id, text) VALUES (?,?)", [req.user.id, req.body.text], function() { res.json({ id: this.lastID }); });
});
app.put('/api/tasks/:id', authenticateToken, (req, res) => {
    db.run("UPDATE tasks SET done = ? WHERE id = ? AND user_id = ?", [req.body.done, req.params.id, req.user.id], () => res.json({success: true}));
});
app.delete('/api/tasks/:id', authenticateToken, (req, res) => {
    db.run("DELETE FROM tasks WHERE id = ? AND user_id = ?", [req.params.id, req.user.id], () => res.json({success: true}));
});

// --- ADMIN ROUTES ---
app.get('/api/admin/users', authenticateToken, requireAdmin, (req, res) => {
    db.all(`SELECT u.id, u.username, u.role, u.full_name, u.location, u.gender, u.age,
            (SELECT COUNT(*) FROM habits WHERE user_id = u.id) as habit_count,
            (SELECT COUNT(*) FROM tasks WHERE user_id = u.id) as task_count
            FROM users u`, [], (err, rows) => res.json(rows));
});
app.get('/api/admin/stats', authenticateToken, requireAdmin, (req, res) => {
    db.get("SELECT COUNT(*) as users FROM users", [], (e, r1) => {
        db.get("SELECT COUNT(*) as habits FROM habits", [], (e, r2) => {
            db.get("SELECT COUNT(*) as tasks FROM tasks", [], (e, r3) => {
                res.json({ users: r1.users, habits: r2.habits, tasks: r3.tasks });
            });
        });
    });
});
app.delete('/api/admin/users/:id', authenticateToken, requireAdmin, (req, res) => {
    db.run("DELETE FROM users WHERE id = ?", [req.params.id], () => res.json({success: true}));
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));