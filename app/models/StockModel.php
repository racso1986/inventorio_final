<?php
/* Usa la tabla correcta: perfiles_stock */
require_once __DIR__ . '/../../config/db.php';

class StockModel {
    private static function pdo(): PDO { return get_pdo(); }

    public static function byStreaming(int $streaming_id): array {
        $sql = "SELECT *
                FROM perfiles_stock
                WHERE streaming_id = ?
                ORDER BY fecha_fin ASC, correo ASC, id ASC";
        $st = self::pdo()->prepare($sql);
        $st->execute([$streaming_id]);
        return $st->fetchAll(PDO::FETCH_ASSOC);
    }

    public static function get(int $id): ?array {
        $st = self::pdo()->prepare("SELECT * FROM perfiles_stock WHERE id = ?");
        $st->execute([$id]);
        $row = $st->fetch(PDO::FETCH_ASSOC);
        return $row ?: null;
    }

    public static function create(array $d): bool {
        $sql = "INSERT INTO perfiles_stock
                (streaming_id, plan, correo, password_plain, whatsapp, perfil, combo,
                 soles, estado, dispositivo, fecha_inicio, fecha_fin)
                VALUES
                (:streaming_id, :plan, :correo, :password_plain, :whatsapp, :perfil, :combo,
                 :soles, :estado, :dispositivo, :fecha_inicio, :fecha_fin)";
        $st = self::pdo()->prepare($sql);
        return $st->execute([
            ':streaming_id'   => $d['streaming_id'],
            ':plan'           => $d['plan'],
            ':correo'         => $d['correo'],
            ':password_plain' => $d['password_plain'],
            ':whatsapp'       => $d['whatsapp'] ?? null,
            ':perfil'         => $d['perfil'] ?? null,
            ':combo'          => (int)($d['combo'] ?? 0),
            ':soles'          => (string)$d['soles'],
            ':estado'         => $d['estado'],
            ':dispositivo'    => $d['dispositivo'],
            ':fecha_inicio'   => $d['fecha_inicio'], // Y-m-d
            ':fecha_fin'      => $d['fecha_fin'],    // Y-m-d (+1 día aplicado en el controller)
        ]);
    }

    public static function update(int $id, array $d): bool {
        $sql = "UPDATE perfiles_stock
                SET plan = :plan,
                    correo = :correo,
                    password_plain = :password_plain,
                    whatsapp = :whatsapp,
                    perfil = :perfil,
                    combo = :combo,
                    soles = :soles,
                    estado = :estado,
                    dispositivo = :dispositivo,
                    fecha_inicio = :fecha_inicio,
                    fecha_fin = :fecha_fin
                WHERE id = :id";
        $st = self::pdo()->prepare($sql);
        return $st->execute([
            ':plan'           => $d['plan'],
            ':correo'         => $d['correo'],
            ':password_plain' => $d['password_plain'],
            ':whatsapp'       => $d['whatsapp'] ?? null,
            ':perfil'         => $d['perfil'] ?? null,
            ':combo'          => (int)($d['combo'] ?? 0),
            ':soles'          => (string)$d['soles'],
            ':estado'         => $d['estado'],
            ':dispositivo'    => $d['dispositivo'],
            ':fecha_inicio'   => $d['fecha_inicio'],
            ':fecha_fin'      => $d['fecha_fin'],
            ':id'             => $id,
        ]);
    }

    public static function delete(int $id): bool {
        $st = self::pdo()->prepare("DELETE FROM perfiles_stock WHERE id = ?");
        return $st->execute([$id]);
    }
}
