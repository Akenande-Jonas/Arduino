#include <SPI.h>
#include <MFRC522.h>

#define RST_PIN 9
#define SS_PIN 10

MFRC522 rfid(SS_PIN, RST_PIN);

// Remplace par l'UID de ton badge autorisé (trouvé dans le moniteur série)
byte uidAutorise[] = { 0xDE, 0xAD, 0xBE, 0xEF }; // Exemple

void setup() {
  Serial.begin(9600);
  SPI.begin();
  rfid.PCD_Init();
  Serial.println("Scanner un badge RFID...");
}

void loop() {
  if (!rfid.PICC_IsNewCardPresent() || !rfid.PICC_ReadCardSerial())
    return;

  Serial.print("Badge détecté UID: ");
  for (byte i = 0; i < rfid.uid.size; i++) {
    Serial.print(rfid.uid.uidByte[i] < 0x10 ? " 0" : " ");
    Serial.print(rfid.uid.uidByte[i], HEX);
  }
  Serial.println();

  if (uidValide(rfid.uid.uidByte, rfid.uid.size)) {
    Serial.println("Accès autorisé");
    // Tu peux activer un relais ou LED ici
  } else {
    Serial.println("Accès refusé");
    // Alarme ou LED rouge par exemple
  }

  rfid.PICC_HaltA();
  rfid.PCD_StopCrypto1();
}

bool uidValide(byte *uid, byte size) {
  if (size != sizeof(uidAutorise)) return false;

  for (byte i = 0; i < size; i++) {
    if (uid[i] != uidAutorise[i]) return false;
  }

  return true;
}
