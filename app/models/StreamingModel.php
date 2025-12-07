<?php
require_once __DIR__ . '/../../config/db.php';

class StreamingModel {
    public static function all() {
        $pdo = get_pdo();
        $stmt = $pdo->query("SELECT * FROM streamings ORDER BY created_at DESC");
        return $stmt->fetchAll();
    }

    public static function get(int $id) {
        $pdo = get_pdo();
        $stmt = $pdo->prepare("SELECT * FROM streamings WHERE id = ?");
        $stmt->execute([$id]);
        return $stmt->fetch();
    }

    public static function create(array $data) {
        $pdo = get_pdo();
        $stmt = $pdo->prepare("INSERT INTO streamings (nombre, plan, precio, logo, created_at) VALUES (?, ?, ?, ?, NOW())");
        $stmt->execute([
            $data['nombre'], $data['plan'], $data['precio'], $data['logo']
        ]);
        return $pdo->lastInsertId();
    }

    public static function update(int $id, array $data) {
        $pdo = get_pdo();
        $fields = ['nombre = ?', 'plan = ?', 'precio = ?'];
        $params = [$data['nombre'], $data['plan'], $data['precio']];
        if (!empty($data['logo'])) {
            $fields[] = 'logo = ?';
            $params[] = $data['logo'];
        }
        $params[] = $id;
        $sql = "UPDATE streamings SET " . implode(', ', $fields) . " WHERE id = ?";
        $stmt = $pdo->prepare($sql);
        return $stmt->execute($params);
    }

    public static function delete(int $id) {
        $pdo = get_pdo();
        // Borra perfiles y cuentas asociadas
        $pdo->prepare("DELETE FROM perfiles WHERE streaming_id = ?")->execute([$id]);
        $pdo->prepare("DELETE FROM cuentas  WHERE streaming_id = ?")->execute([$id]);
        $stmt = $pdo->prepare("DELETE FROM streamings WHERE id = ?");
        return $stmt->execute([$id]);
    }
}
?>
