// server-sql.js
// Version du serveur Node.js adapté pour une base de données SQL plutôt que MongoDB
const express = require('express');
const { SerialPort } = require('serialport');
const { ReadlineParser } = require('@serialport/parser-readline');
const mysql = require('mysql2/promise'); // Utiliser mysql avec support des promesses
const moment = require('moment');
const cors = require('cors');
const pm2 = require('pm2');

// Configuration
const app = express();
const PORT = process.env.PORT || 3000;
const SERIAL_PORT = process.env.SERIAL_PORT || 'COM3'; // Ajustez selon votre port Arduino
const BAUD_RATE = 9600;

// Configuration de la base de données
const dbConfig = {
  host: '192.168.64.175',
  user: 'site1',          // Remplacez par votre utilisateur MySQL
  password: 'yuzu007',          // Remplacez par votre mot de passe MySQL
  database: 'rfid',
};

// Créer un pool de connexions à la base de données
const pool = mysql.createPool(dbConfig);

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Configuration de la communication série avec Arduino
const serialPort = new SerialPort({ path: SERIAL_PORT, baudRate: BAUD_RATE });
const parser = serialPort.pipe(new ReadlineParser({ delimiter: '\r\n' }));

// Gestion des erreurs de port série
serialPort.on('error', (err) => {
  console.error('Erreur du port série:', err.message);
});

// Traitement des données RFID reçues d'Arduino
parser.on('data', async (data) => {
  try {
    // Format attendu: "RFID:<card_id>:<direction>"
    // Direction peut être "IN" ou "OUT"
    console.log('Données reçues:', data);
    
    const parts = data.split(':');
    if (parts.length === 3 && parts[0] === 'RFID') {
      const cardId = parts[1].trim();
      const direction = parts[2].trim().toLowerCase() === 'in' ? 'entry' : 'exit';
      
      // Vérifier si l'utilisateur existe et est autorisé
      const [users] = await pool.query(
        'SELECT user_id, authorized FROM users WHERE card_id = ?',
        [cardId]
      );
      
      const user = users.length > 0 ? users[0] : null;
      const authorized = user ? user.authorized : false;
      
      // Enregistrer l'accès
      await pool.query(
        'INSERT INTO access_logs (user_id, card_id, direction, authorized) VALUES (?, ?, ?, ?)',
        [user ? user.user_id : null, cardId, direction, authorized]
      );
      
      // Envoyer la réponse à Arduino
      const response = authorized ? 'ALLOW' : 'DENY';
      serialPort.write(`${response}\n`);
      
      console.log(`Accès ${authorized ? 'autorisé' : 'refusé'} pour la carte ${cardId} - Direction: ${direction}`);
    }
  } catch (error) {
    console.error('Erreur lors du traitement des données RFID:', error);
  }
});

// Routes API
app.get('/api/users', async (req, res) => {
  try {
    const [users] = await pool.query('SELECT * FROM users');
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/users', async (req, res) => {
  try {
    const { name, cardId, role, authorized } = req.body;
    const [result] = await pool.query(
      'INSERT INTO users (name, card_id, role, authorized) VALUES (?, ?, ?, ?)',
      [name, cardId, role || 'user', authorized !== undefined ? authorized : true]
    );
    
    const [newUser] = await pool.query('SELECT * FROM users WHERE user_id = ?', [result.insertId]);
    res.status(201).json(newUser[0]);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.put('/api/users/:id', async (req, res) => {
  try {
    const { name, cardId, role, authorized } = req.body;
    await pool.query(
      'UPDATE users SET name = ?, card_id = ?, role = ?, authorized = ? WHERE user_id = ?',
      [name, cardId, role, authorized, req.params.id]
    );
    
    const [updatedUser] = await pool.query('SELECT * FROM users WHERE user_id = ?', [req.params.id]);
    if (updatedUser.length === 0) {
      return res.status(404).json({ error: 'Utilisateur non trouvé' });
    }
    
    res.json(updatedUser[0]);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.delete('/api/users/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM users WHERE user_id = ?', [req.params.id]);
    res.status(204).end();
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.get('/api/access-logs', async (req, res) => {
  try {
    const { startDate, endDate, cardId } = req.query;
    let query = 'SELECT al.*, u.name, u.role FROM access_logs al LEFT JOIN users u ON al.user_id = u.user_id WHERE 1=1';
    const params = [];
    
    if (cardId) {
      query += ' AND al.card_id = ?';
      params.push(cardId);
    }
    
    if (startDate) {
      query += ' AND al.timestamp >= ?';
      params.push(new Date(startDate));
    }
    
    if (endDate) {
      query += ' AND al.timestamp <= ?';
      params.push(new Date(endDate));
    }
    
    query += ' ORDER BY al.timestamp DESC';
    
    const [logs] = await pool.query(query, params);
    res.json(logs);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/stats', async (req, res) => {
  try {
    const today = moment().startOf('day').format('YYYY-MM-DD HH:mm:ss');
    
    // Nombre d'entrées aujourd'hui
    const [entries] = await pool.query(
      'SELECT COUNT(*) as count FROM access_logs WHERE direction = ? AND authorized = ? AND timestamp >= ?',
      ['entry', 1, today]
    );
    const todayEntries = entries[0].count;
    
    // Nombre de sorties aujourd'hui
    const [exits] = await pool.query(
      'SELECT COUNT(*) as count FROM access_logs WHERE direction = ? AND authorized = ? AND timestamp >= ?',
      ['exit', 1, today]
    );
    const todayExits = exits[0].count;
    
    // Nombre total d'utilisateurs
    const [totalUsersResult] = await pool.query('SELECT COUNT(*) as count FROM users');
    const totalUsers = totalUsersResult[0].count;
    
    // Nombre d'utilisateurs autorisés
    const [authorizedUsersResult] = await pool.query('SELECT COUNT(*) as count FROM users WHERE authorized = ?', [1]);
    const authorizedUsers = authorizedUsersResult[0].count;
    
    res.json({
      todayEntries,
      todayExits,
      currentlyInside: todayEntries - todayExits,
      totalUsers,
      authorizedUsers
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Fonction pour vérifier la connexion à la base de données
const testDatabaseConnection = async () => {
  try {
    const connection = await pool.getConnection();
    console.log('Connexion à la base de données réussie');
    connection.release();
    return true;
  } catch (error) {
    console.error('Erreur de connexion à la base de données:', error);
    return false;
  }
};

// Démarrage du serveur
const startServer = async () => {
  const dbConnected = await testDatabaseConnection();
  
  if (dbConnected) {
    app.listen(PORT, () => {
      console.log(`Serveur démarré sur le port ${PORT}`);
    });
  } else {
    console.error('Impossible de démarrer le serveur sans connexion à la base de données');
    process.exit(1);
  }
};

startServer();
