const express = require("express");
const SerialPort = require("serialport").SerialPort;
const ReadlineParser = require("@serialport/parser-readline").ReadlineParser;

const app = express();
const portHttp = 8000;

// Remplace par le port correct (trouvé avec `SerialPort.list()`)
const portSerie = new SerialPort({
  path: "/dev/ttyACM0", // ou "COM3" sur Windows & sur Linux c'est /dev/ttyUSB0
  baudRate: 9600,
  autoOpen: false // Laisse l'ouverture du port série manuelle
});

// Parse les données reçues ligne par ligne
const parser = portSerie.pipe(new ReadlineParser({ delimiter: "\n" }));

// Quand on reçoit des données de l'Arduino
parser.on("data", (data) => {
  console.log("Données reçues de l'Arduino :", data);
});

// Ouvre le port série lorsque le serveur démarre
portSerie.open((err) => {
  if (err) {
    console.log("Erreur d'ouverture du port série:", err);
  } else {
    console.log("Port série ouvert avec succès.");
  }
});

// Exemple : endpoint HTTP pour envoyer une commande à l'Arduino
app.get("/api/led/on", (req, res) => {
  portSerie.write("ON\n", (err) => {
    if (err) {
      console.error("Erreur en envoyant la commande", err);
      return res.status(500).send("Erreur en envoyant la commande à l'Arduino");
    }
    console.log("Commande LED ON envoyée");
    res.send("Commande LED ON envoyée à l'Arduino");
  });
});

app.get("/api/led/off", (req, res) => {
  portSerie.write("OFF\n", (err) => {
    if (err) {
      console.error("Erreur en envoyant la commande", err);
      return res.status(500).send("Erreur en envoyant la commande à l'Arduino");
    }
    console.log("Commande LED OFF envoyée");
    res.send("Commande LED OFF envoyée à l'Arduino");
  });
});

// Serveur HTTP écoute
app.listen(portHttp, () => {
  console.log(`Serveur HTTP démarré sur http://localhost:${portHttp}`);
});

