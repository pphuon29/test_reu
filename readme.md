# PROJET WEB

Une application web permettant de planifier des réunions. Les organisateurs peuvent proposer des créneaux et les participants indiquent leurs disponibilités.

![Texte alternatif pour l'image](/img/apercu.png)

## Installation


1.  **Installez les dépendances du projet :**
    ```bash
    npm install
    ```

## Configuration

1.  **Créez un fichier `.env`** à la racine du projet. Ce fichier contiendra les variables d'environnement nécessaires

2.  **Ajoutez les variables suivantes** dans votre fichier `.env` et adaptez leurs valeurs à votre environnement local :
    ```env
    # Configuration Base de données PostgreSQL

    DB_USER=votre_utilisateur_postgresql
    DB_HOST=localhost
    DB_DATABASE=projet_reunion_db               # Ou le nom que vous souhaitez pour la base de données
    DB_PASSWORD=votre_mot_de_passe_postgresql
    DB_PORT=5432                                # Port par défaut de PostgreSQL

    # Configuration Session Express
    SESSION_SECRET=string_long_et_aleatoire

    # Port de l'application
    PORT=3000
    ```
    Remplacez les valeurs par vos propres informations de configuration.

## Configuration de la Base de Données

1.  **Lancez votre serveur POSTgres**

2.  **Créez la base de données** spécifiée dans votre fichier `.env` (par exemple `projet_reunion_db`). 
    ```sql
    CREATE DATABASE projet_reunion_db;
    ```

3.  **Exécutez le script d'initialisation** pour créer les tables nécessaires. Depuis le terminal, à la racine de votre projet :
    ```bash
    psql -U votre_utilisateur_postgresql -d projet_reunion_db -f init_bd.sql
    ```
    *(Adaptez `votre_utilisateur_postgresql` et `projet_reunion_db` si vous avez utilisé des noms différents. Il vous demandera le mot de passe de l'utilisateur PostgreSQL).*


## Lancer l'application

Pour démarrer le serveur en mode développement (avec redémarrage automatique grâce à `nodemon`) :

```bash
npm run dev