const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config();
const path = require('path');

const app = express();
const PORT = process.env.PORT || 5000;
const SECRET = process.env.JWT_SECRET || 'crick_secret';

// PostgreSQL Connection Pool
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false // Required for some cloud providers like Neon/Render
    }
});

app.use(cors());
app.use(express.json());

// Serve static files from the root directory
app.use(express.static(__dirname));

// Database Table Creation (Initialize if not exists)
const initDB = async () => {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                username TEXT UNIQUE,
                password TEXT
            )
        `);

        await pool.query(`
            CREATE TABLE IF NOT EXISTS matches (
                id SERIAL PRIMARY KEY,
                user_id INTEGER,
                team_a TEXT,
                team_b TEXT,
                score_data TEXT,
                result TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(user_id) REFERENCES users(id)
            )
        `);
        console.log('PostgreSQL tables initialized.');
    } catch (err) {
        console.error('DB Initialization Error:', err.message);
    }
};

initDB();

// Auth Routes
app.post('/api/signup', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Username and password required' });

    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        await pool.query(`INSERT INTO users (username, password) VALUES ($1, $2)`, [username, hashedPassword]);
        res.json({ message: 'User created' });
    } catch (err) {
        if (err.code === '23505') { // Unique violation in Postgres
            return res.status(400).json({ error: 'Username already exists' });
        }
        res.status(500).json({ error: err.message });
    }
});

app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const result = await pool.query(`SELECT * FROM users WHERE username = $1`, [username]);
        const user = result.rows[0];

        if (!user) return res.status(401).json({ error: 'User not found' });

        const valid = await bcrypt.compare(password, user.password);
        if (!valid) return res.status(401).json({ error: 'Invalid password' });

        const token = jwt.sign({ id: user.id, username: user.username }, SECRET);
        res.json({ token, username: user.username });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Middleware to verify token
const verifyToken = (req, res, next) => {
    const token = req.headers['authorization'];
    if (!token) return res.status(403).json({ error: 'No token provided' });

    jwt.verify(token, SECRET, (err, decoded) => {
        if (err) return res.status(401).json({ error: 'Unauthorized' });
        req.userId = decoded.id;
        next();
    });
};

// Match Routes
app.post('/api/matches', verifyToken, async (req, res) => {
    const { teamA, teamB, scoreData, result } = req.body;
    try {
        const queryResult = await pool.query(
            `INSERT INTO matches (user_id, team_a, team_b, score_data, result) VALUES ($1, $2, $3, $4, $5) RETURNING id`,
            [req.userId, teamA, teamB, JSON.stringify(scoreData), result]
        );
        res.json({ id: queryResult.rows[0].id });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/matches', verifyToken, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT * FROM matches WHERE user_id = $1 ORDER BY created_at DESC`,
            [req.userId]
        );
        res.json(result.rows.map(row => ({
            ...row,
            score_data: JSON.parse(row.score_data)
        })));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// For any other route, serve index.html
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
