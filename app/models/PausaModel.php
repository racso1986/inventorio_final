<?php
require_once __DIR__ . '/../../config/db.php';

class PausaModel {
  private static function pdo(): PDO { return get_pdo(); }

  public static function byStreaming(int $streaming_id): array {
    $sql = "SELECT * FROM perfiles_pausa
            WHERE streaming_id = ?
            ORDER BY correo ASC, fecha_fin ASC, id ASC";
    $st = self::pdo()->prepare($sql);
    $st->execute([$streaming_id]);
    return $st->fetchAll(PDO::FETCH_ASSOC);
  }

  public static function get(int $id): ?array {
    $st = self::pdo()->prepare("SELECT * FROM perfiles_pausa WHERE id=?");
    $st->execute([$id]);
    $row = $st->fetch(PDO::FETCH_ASSOC);
    return $row ?: null;
  }

  public static function create(array $d): int {
    $sql = "INSERT INTO perfiles_pausa
      (streaming_id, plan, correo, password_plain, whatsapp, perfil, combo, soles, estado, dispositivo, fecha_inicio, fecha_fin)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?)";
    $ok = self::pdo()->prepare($sql)->execute([
      $d['streaming_id'],
      $d['plan'],
      $d['correo'],
      $d['password_plain'],
      $d['whatsapp'],
      $d['perfil'],
      (int)$d['combo'],
      $d['soles'],
      $d['estado'],
      $d['dispositivo'],
      $d['fecha_inicio'],
      $d['fecha_fin'],
    ]);
    if (!$ok) throw new RuntimeException('No se pudo insertar.');
    return (int)self::pdo()->lastInsertId();
  }

  public static function update(int $id, array $d): bool {
    $sql = "UPDATE perfiles_pausa SET
              plan=?, correo=?, password_plain=?, whatsapp=?, perfil=?, combo=?, soles=?, estado=?, dispositivo=?, fecha_inicio=?, fecha_fin=?
            WHERE id=?";
    return self::pdo()->prepare($sql)->execute([
      $d['plan'],
      $d['correo'],
      $d['password_plain'],
      $d['whatsapp'],
      $d['perfil'],
      (int)$d['combo'],
      $d['soles'],
      $d['estado'],
      $d['dispositivo'],
      $d['fecha_inicio'],
      $d['fecha_fin'],
      $id,
    ]);
  }

  public static function delete(int $id): bool {
    return self::pdo()->prepare("DELETE FROM perfiles_pausa WHERE id=?")->execute([$id]);
  }
}
