const express = require("express");
const { SerialPort } = require("serialport");
const { ReadlineParser } = require("@serialport/parser-readline");
const path = require("path");

const app = express();
const portHttp = 8000;

let dernierUID = null;
let historique = []; // Pour les 5 derniers accès

const portSerie = new SerialPort({
  path: "/dev/ttyACM0", // Adapter selon ta machine
  baudRate: 9600,
  autoOpen: false
});

const parser = portSerie.pipe(new ReadlineParser({ delimiter: "\n" }));

parser.on("data", (data) => {
  const uid = data.trim().toUpperCase();
  const maintenant = new Date().toLocaleString("fr-FR");

  console.log("UID reçu :", uid);
  dernierUID = uid;

  const estAutorise = ["A1B2C3D4", "12345678"].includes(uid); // Exemple
  const resultat = estAutorise ? "Autorisé" : "Refusé";

  historique.unshift({
    datetime: maintenant,
    uid: uid,
    result: resultat,
    source: "Arduino"
  });

  if (historique.length > 5) historique.pop();
});

portSerie.open((err) => {
  if (err) console.error("Erreur port série:", err);
  else console.log("Port série connecté.");
});

app.use(express.static(path.join(__dirname, "public"))); // Servir HTML/CSS/JS

// API pour dernier badge
app.get("/api/dernier-uid", (req, res) => {
  res.json({ uid: dernierUID });
});

// API pour statut complet
app.get("/api/status", (req, res) => {
  res.json({
    dernierUID: dernierUID,
    historique: historique
  });
});

app.listen(portHttp, () => {
  console.log(`🌐 Serveur en ligne sur http://localhost:${portHttp}`);
});
