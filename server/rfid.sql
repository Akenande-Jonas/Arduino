-- Création de la base de données RFID
CREATE DATABASE IF NOT EXISTS rfid;
USE rfid;

-- Table des utilisateurs
CREATE TABLE IF NOT EXISTS users (
    user_id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    card_id VARCHAR(50) NOT NULL UNIQUE,
    role VARCHAR(50) DEFAULT 'user',
    authorized BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE INDEX idx_card_id (card_id)
);

-- Table des logs d'accès
CREATE TABLE IF NOT EXISTS access_logs (
    log_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NULL,
    card_id VARCHAR(50) NOT NULL,
    direction ENUM('entry', 'exit') NOT NULL,
    authorized BOOLEAN NOT NULL,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_user_id (user_id),
    INDEX idx_card_id (card_id),
    INDEX idx_timestamp (timestamp),
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE SET NULL ON UPDATE CASCADE
);

-- Insertion de quelques utilisateurs de test
INSERT INTO users (name, card_id, role, authorized) VALUES
('Admin', 'AD123456', 'admin', TRUE),
('Jean Dupont', 'JD789012', 'user', TRUE),
('Marie Martin', 'MM345678', 'user', TRUE),
('Pierre Durand', 'PD901234', 'guest', FALSE);

-- Création d'un utilisateur pour l'application web (si nécessaire)
-- Remplacez 'site1' et 'yuzu007' par les valeurs de votre choix, ou utilisez celles du code
CREATE USER IF NOT EXISTS 'site1'@'%' IDENTIFIED BY 'yuzu007';
GRANT ALL PRIVILEGES ON rfid.* TO 'site1'@'%';
FLUSH PRIVILEGES;

-- Vues pour les statistiques (facultatif mais pratique)
CREATE OR REPLACE VIEW daily_entries AS
SELECT 
    DATE(timestamp) as date,
    COUNT(*) as entry_count
FROM access_logs
WHERE direction = 'entry' AND authorized = TRUE
GROUP BY DATE(timestamp);

CREATE OR REPLACE VIEW daily_exits AS
SELECT 
    DATE(timestamp) as date,
    COUNT(*) as exit_count
FROM access_logs
WHERE direction = 'exit' AND authorized = TRUE
GROUP BY DATE(timestamp);

-- Procédure stockée pour obtenir les personnes actuellement à l'intérieur
DELIMITER //
CREATE PROCEDURE currently_inside()
BEGIN
    SELECT u.user_id, u.name, u.card_id, u.role,
           MAX(a.timestamp) as last_action_time
    FROM users u
    JOIN access_logs a ON u.user_id = a.user_id
    WHERE u.authorized = TRUE
    GROUP BY u.user_id
    HAVING COUNT(CASE WHEN a.direction = 'entry' THEN 1 END) > 
           COUNT(CASE WHEN a.direction = 'exit' THEN 1 END);
END//
DELIMITER ;

-- Trigger pour vérifier la validité des cartes RFID
DELIMITER //
CREATE TRIGGER check_card_id_format BEFORE INSERT ON users
FOR EACH ROW
BEGIN
    IF LENGTH(NEW.card_id) < 4 THEN
        SIGNAL SQLSTATE '45000' 
        SET MESSAGE_TEXT = 'Card ID must be at least 4 characters long';
    END IF;
END//
DELIMITER ;
