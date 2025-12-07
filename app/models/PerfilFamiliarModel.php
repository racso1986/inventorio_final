<?php
require_once __DIR__ . '/../../config/db.php';

class PerfilFamiliarModel {
    private static function pdo(): PDO {
        return get_pdo();
    }

    /**
     * Devuelve todos los registros de perfiles_familiar de un streaming,
     * ya ordenados para su visualización en la pestaña "Perfil familiar".
     */
    public static function byStreaming(int $streaming_id): array {
        $sql = "SELECT *
                FROM perfiles_familiar
                WHERE streaming_id = :sid
                ORDER BY correo ASC, created_at ASC, id ASC";
        $st = self::pdo()->prepare($sql);
        $st->execute([':sid' => $streaming_id]);
        return $st->fetchAll(PDO::FETCH_ASSOC) ?: [];
    }

    /**
     * Obtiene un registro puntual por ID.
     */
    public static function find(int $id): ?array {
        $sql = "SELECT *
                FROM perfiles_familiar
                WHERE id = :id";
        $st = self::pdo()->prepare($sql);
        $st->execute([':id' => $id]);
        $row = $st->fetch(PDO::FETCH_ASSOC);
        return $row !== false ? $row : null;
    }
}
