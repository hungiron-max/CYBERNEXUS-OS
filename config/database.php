<?php
/**
 * Database Connection & Initialization Helper
 * Supports SQLite (default) and MySQL
 */

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/shifts_helper.php';

class Database {
    private static ?PDO $instance = null;

    public static function getConnection(): PDO {
        if (self::$instance === null) {
            try {
                if (DB_DRIVER === 'sqlite') {
                    $dbDir = dirname(SQLITE_FILE);
                    if (!is_dir($dbDir)) {
                        mkdir($dbDir, 0777, true);
                    }

                    $isNewDatabase = !file_exists(SQLITE_FILE) || filesize(SQLITE_FILE) === 0;

                    $dsn = 'sqlite:' . SQLITE_FILE;
                    self::$instance = new PDO($dsn);
                    self::$instance->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
                    self::$instance->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);

                    // Enable foreign keys and WAL mode for better concurrency in SQLite
                    self::$instance->exec('PRAGMA foreign_keys = ON;');
                    self::$instance->exec('PRAGMA journal_mode = WAL;');

                    // Auto initialize schema if newly created
                    if ($isNewDatabase) {
                        self::initializeDatabase(self::$instance);
                    }
                } else {
                    // MySQL Connection
                    $dsn = sprintf(
                        'mysql:host=%s;port=%d;dbname=%s;charset=%s',
                        MYSQL_HOST,
                        MYSQL_PORT,
                        MYSQL_DATABASE,
                        MYSQL_CHARSET
                    );
                    
                    try {
                        self::$instance = new PDO($dsn, MYSQL_USER, MYSQL_PASSWORD, [
                            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                            PDO::MYSQL_ATTR_INIT_COMMAND => "SET NAMES utf8mb4"
                        ]);
                    } catch (PDOException $e) {
                        // If database does not exist, try creating it
                        if ($e->getCode() == 1049) {
                            $initPdo = new PDO(
                                sprintf('mysql:host=%s;port=%d;charset=%s', MYSQL_HOST, MYSQL_PORT, MYSQL_CHARSET),
                                MYSQL_USER,
                                MYSQL_PASSWORD
                            );
                            $initPdo->exec("CREATE DATABASE IF NOT EXISTS `" . MYSQL_DATABASE . "` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;");
                            self::$instance = new PDO($dsn, MYSQL_USER, MYSQL_PASSWORD, [
                                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC
                            ]);
                            self::initializeDatabase(self::$instance);
                        } else {
                            throw $e;
                        }
                    }
                }
            } catch (PDOException $e) {
                if (strpos($_SERVER['REQUEST_URI'] ?? '', '/api/') !== false) {
                    jsonResponse(['success' => false, 'message' => 'Lỗi kết nối cơ sở dữ liệu: ' . $e->getMessage()], 500);
                } else {
                    die('<div style="font-family:sans-serif;padding:30px;background:#fff1f2;color:#9f1239;border:1px solid #fecdd3;border-radius:10px;margin:30px auto;max-width:600px;">'
                        . '<h2 style="margin-top:0;">Lỗi kết nối Cơ sở dữ liệu (' . DB_DRIVER . ')</h2>'
                        . '<p>' . htmlspecialchars($e->getMessage()) . '</p>'
                        . '<p>Vui lòng kiểm tra cấu hình trong <code>config/config.php</code></p>'
                        . '</div>');
                }
            }
        }
        return self::$instance;
    }

    /**
     * Run schema.sql statements
     */
    public static function initializeDatabase(PDO $pdo): bool {
        $schemaFile = dirname(__DIR__) . '/database/schema.sql';
        if (!file_exists($schemaFile)) {
            return false;
        }

        $sql = file_get_contents($schemaFile);
        
        // Handle MySQL differences if necessary
        if (DB_DRIVER === 'mysql') {
            $sql = str_replace('INTEGER PRIMARY KEY AUTOINCREMENT', 'INT AUTO_INCREMENT PRIMARY KEY', $sql);
            $sql = str_replace('INSERT OR IGNORE', 'INSERT IGNORE', $sql);
        }

        // Execute batch SQL
        try {
            $pdo->exec($sql);
            return true;
        } catch (Exception $e) {
            error_log('Error initializing database: ' . $e->getMessage());
            return false;
        }
    }
}

