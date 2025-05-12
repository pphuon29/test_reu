
-- Supprimer les tables si elles existent (pour réinitialisation facile)
DROP TABLE IF EXISTS responses;
DROP TABLE IF EXISTS meeting_slots;
DROP TABLE IF EXISTS invitations; 
DROP TABLE IF EXISTS meetings;
DROP TABLE IF EXISTS users;

-- Création de la table des utilisateurs
CREATE TABLE users (
    user_id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(100),
    user_type VARCHAR(20) CHECK (user_type IN ('organizer', 'participant')) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Création de la table des réunions
CREATE TABLE meetings (
    meeting_id SERIAL PRIMARY KEY,
    organizer_id INTEGER NOT NULL REFERENCES users(user_id),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    creation_date TIMESTAMPTZ DEFAULT NOW(),
    final_slot_id INTEGER NULL -- Référence à meeting_slots une fois décidé
    -- FOREIGN KEY (final_slot_id) REFERENCES meeting_slots(slot_id) -- Ajouté après création de meeting_slots si nécessaire
);

-- Création de la table des créneaux proposés
CREATE TABLE meeting_slots (
    slot_id SERIAL PRIMARY KEY,
    meeting_id INTEGER NOT NULL REFERENCES meetings(meeting_id) ON DELETE CASCADE,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL
);

-- Ajout de la contrainte de clé étrangère pour final_slot_id (si nécessaire, dépend de la logique exacte)
-- ALTER TABLE meetings ADD CONSTRAINT fk_final_slot FOREIGN KEY (final_slot_id) REFERENCES meeting_slots(slot_id);

-- Création de la table des réponses des participants
CREATE TABLE responses (
    response_id SERIAL PRIMARY KEY,
    slot_id INTEGER NOT NULL REFERENCES meeting_slots(slot_id) ON DELETE CASCADE,
    participant_email VARCHAR(255) NOT NULL, -- Email même si l'utilisateur s'inscrit plus tard
    user_id INTEGER NULL REFERENCES users(user_id), -- Lié si l'utilisateur est inscrit
    availability VARCHAR(10) NOT NULL CHECK (availability IN ('yes', 'no', 'maybe')),
    response_date TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (slot_id, participant_email) -- Une seule réponse par participant par créneau
);

-- Création table pour gérer les tokens d'invitation 
CREATE TABLE invitations (
    invitation_id SERIAL PRIMARY KEY,
    meeting_id INTEGER NOT NULL REFERENCES meetings(meeting_id) ON DELETE CASCADE,
    participant_email VARCHAR(255) NOT NULL,
    token UUID UNIQUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    responded BOOLEAN DEFAULT FALSE
);


-- Données de démonstration 
-- Insérer un organisateur
INSERT INTO users (email, password_hash, name, user_type) VALUES
('organisateur@example.com', 'hash_bidon_a_remplacer', 'Alice Organisateur', 'organizer');

-- Insérer un participant 
 INSERT INTO users (email, password_hash, name, user_type) VALUES
 ('participant1@example.com', 'hash_bidon_a_remplacer', 'Bob Participant', 'participant');

-- Insérer une réunion créée par Alice
 INSERT INTO meetings (organizer_id, title, description) VALUES
 ((SELECT user_id FROM users WHERE email = 'organisateur@example.com'), 'Réunion Projet Alpha', 'Discussion du planning');

-- Insérer des créneaux pour cette réunion
-- Attention: Récupérer le meeting_id réel après insertion
 INSERT INTO meeting_slots (meeting_id, start_time, end_time) VALUES
 (1, '2025-05-10 10:00:00+02', '2025-05-10 11:00:00+02'),
 (1, '2025-05-10 14:00:00+02', '2025-05-10 15:00:00+02'),
 (1, '2025-05-11 10:00:00+02', '2025-05-11 11:00:00+02');

