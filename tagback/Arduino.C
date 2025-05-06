#include <SPI.h>
#include <MFRC522.h>
#include <Ethernet.h>

// Ethernet
byte mac[] = { 0xDE, 0xAD, 0xBE, 0xEF, 0xFE, 0xED };  // Adresse MAC aléatoire
IPAddress server(192, 168, 1, 100); // Adresse IP du serveur cible
EthernetClient client;

// RFID
#define SS_RFID 10
#define RST_RFID 9
MFRC522 rfid(SS_RFID, RST_RFID);

// LEDs
#define RED_LED 8
#define GREEN_LED 7

// W5100 CS pin
#define SS_ETHERNET 4

void setup() {
  Serial.begin(9600);
  
  // Initialiser LEDs
  pinMode(RED_LED, OUTPUT);
  pinMode(GREEN_LED, OUTPUT);
  digitalWrite(RED_LED, LOW);
  digitalWrite(GREEN_LED, LOW);

  // Initialiser SPI
  pinMode(SS_ETHERNET, OUTPUT);
  pinMode(SS_RFID, OUTPUT);
  digitalWrite(SS_ETHERNET, HIGH); // désactiver Ethernet
  digitalWrite(SS_RFID, HIGH);     // désactiver RFID
  
  SPI.begin();
  Ethernet.begin(mac);
  delay(1000);
  Serial.println("Initialisation du réseau");

  // Initialiser le module RFID
  rfid.PCD_Init();
}

void loop() {
  digitalWrite(SS_RFID, LOW);  // activer RFID
  if (rfid.PICC_IsNewCardPresent() && rfid.PICC_ReadCardSerial()) {
    digitalWrite(RED_LED, LOW);
    digitalWrite(GREEN_LED, HIGH);
    
    // Lire UID
    String uid = "";
    for (byte i = 0; i < rfid.uid.size; i++) {
      uid += String(rfid.uid.uidByte[i], HEX);
    }
    Serial.print("Carte détectée : ");
    Serial.println(uid);

    // Envoyer UID par Ethernet
    digitalWrite(SS_ETHERNET, LOW); // activer Ethernet
    if (client.connect(server, 80)) {
      client.print("GET /log_uid.php?uid=");
      client.print(uid);
      client.println(" HTTP/1.1");
      client.println("Host: 192.168.1.100");
      client.println("Connection: close");
      client.println();
    }
    client.stop();
    digitalWrite(SS_ETHERNET, HIGH); // désactiver Ethernet

    delay(2000);
    digitalWrite(GREEN_LED, LOW);
    rfid.PICC_HaltA();
    rfid.PCD_StopCrypto1();
  } else {
    digitalWrite(RED_LED, HIGH);
    digitalWrite(GREEN_LED, LOW);
  }
  digitalWrite(SS_RFID, HIGH); // désactiver RFID
}
