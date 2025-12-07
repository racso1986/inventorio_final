<?php
require_once __DIR__ . '/../../config/db.php';

class UserModel {
    public static function findByEmail(string $email) {
        $pdo = get_pdo();
        $stmt = $pdo->prepare("SELECT * FROM users WHERE email = ? LIMIT 1");
        $stmt->execute([$email]);
        return $stmt->fetch();
    }

    public static function create(string $email, string $password_plain) {
        $pdo = get_pdo();
        $stmt = $pdo->prepare("INSERT INTO users (email, password_plain, created_at) VALUES (?, ?, NOW())");
        $stmt->execute([$email, $password_plain]);
        return $pdo->lastInsertId();
    }

    public static function getById(int $id) {
        $pdo = get_pdo();
        $stmt = $pdo->prepare("SELECT * FROM users WHERE id = ?");
        $stmt->execute([$id]);
        return $stmt->fetch();
    }
}
?>
