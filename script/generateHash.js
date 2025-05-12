
// Utilisé uniquement pour l'insertion des utilisateurs dans BD (test initial)
// generateHash.js
const bcrypt = require('bcrypt');
const password = '123';
const saltRounds = 10;

bcrypt.hash(password, saltRounds, function(err, hash) {
    if (err) {
        console.error("Erreur lors du hachage:", err);
    } else {
        console.log("Mot de passe:", password);
        console.log("Hash Bcrypt:", hash);
        // Exemple de hash : $2b$10$...
    }
});