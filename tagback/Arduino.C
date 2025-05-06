#include <SPI.h>
#include <MFRC522.h>

// Broches du module RFID
#define SS_PIN 10    // NSS / SDA
#define RST_PIN 9

// LEDs
#define RED_LED 8
#define GREEN_LED 7

MFRC522 rfid(SS_PIN, RST_PIN); // Crée une instance MFRC522

void setup() {
  Serial.begin(9600);
  SPI.begin();          // Initialise la communication SPI
  rfid.PCD_Init();      // Initialise le module RFID
  Serial.println("Approche une carte RFID...");

  // Initialisation des LEDs
  pinMode(RED_LED, OUTPUT);
  pinMode(GREEN_LED, OUTPUT);

  digitalWrite(RED_LED, LOW);
  digitalWrite(GREEN_LED, LOW);
}

void loop() {
  // Si pas de nouvelle carte, on ne fait rien
  if (!rfid.PICC_IsNewCardPresent() || !rfid.PICC_ReadCardSerial()) {
    digitalWrite(RED_LED, HIGH);
    digitalWrite(GREEN_LED, LOW);
    return;
  }

  // Si carte détectée
  Serial.print("Carte détectée, UID : ");
  for (byte i = 0; i < rfid.uid.size; i++) {
    Serial.print(rfid.uid.uidByte[i] < 0x10 ? " 0" : " ");
    Serial.print(rfid.uid.uidByte[i], HEX);
  }
  Serial.println();

  // Allume LED verte
  digitalWrite(RED_LED, LOW);
  digitalWrite(GREEN_LED, HIGH);

  delay(2000); // Garde la LED verte allumée pendant 2 secondes
  rfid.PICC_HaltA();     // Arrête la communication avec la carte
  rfid.PCD_StopCrypto1(); // Stoppe la crypto
}
