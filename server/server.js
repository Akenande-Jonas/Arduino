// server.js
const express = require('express');
const { SerialPort } = require('serialport');
const { ReadlineParser } = require('@serialport/parser-readline');
const mongoose = require('mongoose');
const moment = require('moment');
const cors = require('cors');
const pm2 = require('pm2');

// Configuration
const app = express();
const PORT = process.env.PORT || 3000;
const SERIAL_PORT = process.env.SERIAL_PORT || 'COM3'; // Ajustez selon votre port Arduino
const BAUD_RATE = 9600;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Connexion à MongoDB
mongoose.connect('mongodb://localhost:27017/rfid_access_system', {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log('Connexion à MongoDB réussie'))
.catch(err => console.error('Erreur de connexion à MongoDB:', err));

// Schémas et modèles
const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  cardId: { type: String, required: true, unique: true },
  role: { type: String, default: 'user' },
  authorized: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now }
});

const accessLogSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  cardId: { type: String, required: true },
  direction: { type: String, enum: ['entry', 'exit'], required: true },
  timestamp: { type: Date, default: Date.now },
  authorized: { type: Boolean, required: true }
});

const User = mongoose.model('User', userSchema);
const AccessLog = mongoose.model('AccessLog', accessLogSchema);

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
      const user = await User.findOne({ cardId });
      const authorized = user && user.authorized;
      
      // Enregistrer l'accès
      const accessLog = new AccessLog({
        userId: user ? user._id : null,
        cardId,
        direction,
        authorized
      });
      await accessLog.save();
      
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
    const users = await User.find({});
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/users', async (req, res) => {
  try {
    const { name, cardId, role, authorized } = req.body;
    const user = new User({ name, cardId, role, authorized });
    await user.save();
    res.status(201).json(user);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.put('/api/users/:id', async (req, res) => {
  try {
    const { name, cardId, role, authorized } = req.body;
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { name, cardId, role, authorized },
      { new: true }
    );
    res.json(user);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.delete('/api/users/:id', async (req, res) => {
  try {
    await User.findByIdAndDelete(req.params.id);
    res.status(204).end();
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.get('/api/access-logs', async (req, res) => {
  try {
    const { startDate, endDate, cardId } = req.query;
    const query = {};
    
    if (cardId) query.cardId = cardId;
    
    if (startDate || endDate) {
      query.timestamp = {};
      if (startDate) query.timestamp.$gte = new Date(startDate);
      if (endDate) query.timestamp.$lte = new Date(endDate);
    }
    
    const logs = await AccessLog.find(query)
      .populate('userId', 'name role')
      .sort({ timestamp: -1 });
      
    res.json(logs);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/stats', async (req, res) => {
  try {
    const today = moment().startOf('day');
    
    const todayEntries = await AccessLog.countDocuments({
      direction: 'entry',
      authorized: true,
      timestamp: { $gte: today.toDate() }
    });
    
    const todayExits = await AccessLog.countDocuments({
      direction: 'exit',
      authorized: true,
      timestamp: { $gte: today.toDate() }
    });
    
    const totalUsers = await User.countDocuments();
    const authorizedUsers = await User.countDocuments({ authorized: true });
    
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

// Démarrage du serveur
app.listen(PORT, () => {
  console.log(`Serveur démarré sur le port ${PORT}`);
});
