-- SocialFlow Database Initialization
-- Creates all required databases when the MySQL container first starts

CREATE DATABASE IF NOT EXISTS auth_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE DATABASE IF NOT EXISTS post_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE DATABASE IF NOT EXISTS notification_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Grant privileges to the app user (if using MYSQL_USER)
GRANT ALL PRIVILEGES ON auth_db.* TO 'sfuser'@'%';
GRANT ALL PRIVILEGES ON post_db.* TO 'sfuser'@'%';
GRANT ALL PRIVILEGES ON notification_db.* TO 'sfuser'@'%';
FLUSH PRIVILEGES;
