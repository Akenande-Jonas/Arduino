const { SerialPort } = require('serialport');

SerialPort.list().then(ports => {
  console.log("Ports disponibles :");
  ports.forEach(port => {
    console.log(`- ${port.path}`);
  });
}).catch(err => console.error("Erreur :", err));
