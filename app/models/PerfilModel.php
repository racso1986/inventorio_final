<?php
require_once __DIR__ . '/../../config/db.php';

class PerfilModel
{
    /**
     * Devuelve TODOS los perfiles de un streaming,
     * ya ordenados como los usas en streaming.php
     */
    public static function byStreaming(int $streaming_id): array
    {
        $pdo = get_pdo();
        $sql = "SELECT *
                FROM perfiles
                WHERE streaming_id = ?
                ORDER BY
                  correo ASC,
                  CASE WHEN COALESCE(perfil,'') = '' THEN 0 ELSE 1 END ASC,
                  perfil ASC,
                  fecha_fin ASC,
                  id ASC";
        $stmt = $pdo->prepare($sql);
        $stmt->execute([$streaming_id]);
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    /**
     * Devuelve 1 perfil por id
     */
    public static function get(int $id)
    {
        $pdo = get_pdo();
        $stmt = $pdo->prepare("SELECT * FROM perfiles WHERE id = ?");
        $stmt->execute([$id]);
        return $stmt->fetch(PDO::FETCH_ASSOC);
    }

    /**
     * Crear perfil padre
     */
    public static function create(array $d)
    {
        $pdo = get_pdo();
        $stmt = $pdo->prepare(
            "INSERT INTO `perfiles`
            (`streaming_id`,`correo`,`password_plain`,`perfil`,`whatsapp`,
             `fecha_inicio`,`fecha_fin`,`soles`,`estado`,`dispositivo`,`plan`,`combo`)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?)"
        );
        $stmt->execute([
            $d['streaming_id'],
            $d['correo'],
            $d['password_plain'],
            $d['perfil'],
            $d['whatsapp'],
            $d['fecha_inicio'],
            $d['fecha_fin'],
            $d['soles'],
            $d['estado'],
            $d['dispositivo'],
            $d['plan'],
            $d['combo'],
        ]);
        return $pdo->lastInsertId();
    }

    /**
     * Actualizar perfil padre
     */
    public static function update(int $id, array $d): bool
    {
        $pdo = get_pdo();
        $stmt = $pdo->prepare(
            "UPDATE `perfiles` SET
              `correo`=?,
              `password_plain`=?,
              `perfil`=?,
              `whatsapp`=?,
              `fecha_fin`=?,
              `soles`=?,
              `estado`=?,
              `dispositivo`=?,
              `plan`=?,
              `combo`=?
            WHERE `id`=?"
        );
        return $stmt->execute([
            $d['correo'],
            $d['password_plain'],
            $d['perfil'],
            $d['whatsapp'],
            $d['fecha_fin'],
            $d['soles'],
            $d['estado'],
            $d['dispositivo'],
            $d['plan'],
            $d['combo'],
            $id,
        ]);
    }

    /**
     * Borrar perfil padre.
     *
     * - Si NO tiene familiares: lo borra normal.
     * - Si TIENE familiares:
     *      - Borra al padre actual.
     *      - Toma el PRIMER hijo (por id más pequeño) y lo promociona a PADRE
     *        creando un nuevo registro en `perfiles` con sus datos.
     *      - Borra ese hijo de `perfiles_familiar`.
     *      - El resto de hijos quedan igual (mismo correo/streaming).
     */
    public static function delete(int $id): bool
    {
        $pdo = get_pdo();
        $pdo->beginTransaction();

        try {
            // 1) Traer el padre actual
            $stmt = $pdo->prepare("SELECT * FROM perfiles WHERE id = ?");
            $stmt->execute([$id]);
            $parent = $stmt->fetch(PDO::FETCH_ASSOC);

            if (!$parent) {
                $pdo->commit();
                return false; // no existe
            }

            $streamingId = (int)$parent['streaming_id'];
            $correo      = $parent['correo'];

            // 2) Borrar al padre actual
            $stmtDelParent = $pdo->prepare("DELETE FROM perfiles WHERE id = ?");
            $stmtDelParent->execute([$id]);

            // 3) Buscar el PRIMER hijo (por streaming+correo)
            $stmtChild = $pdo->prepare("
                SELECT *
                FROM perfiles_familiar
                WHERE streaming_id = ? AND correo = ?
                ORDER BY id ASC
                LIMIT 1
            ");
            $stmtChild->execute([$streamingId, $correo]);
            $child = $stmtChild->fetch(PDO::FETCH_ASSOC);

            if ($child) {
                // En familiar el plan suele ser 'individual','standard','premium'
                // En perfiles usas 'individual','estándar','premium'
                $planPadre = ($child['plan'] === 'standard') ? 'estándar' : $child['plan'];

                // 4) Insertar nuevo PADRE basado en el hijo
                $stmtIns = $pdo->prepare("
                    INSERT INTO perfiles
                      (streaming_id,
                       correo,
                       plan,
                       password_plain,
                       fecha_inicio,
                       fecha_fin,
                       whatsapp,
                       perfil,
                       combo,
                       soles,
                       estado,
                       color,
                       dispositivo,
                       created_at,
                       updated_at)
                    VALUES
                      (:sid,
                       :correo,
                       :plan,
                       :pass,
                       :fi,
                       :ff,
                       :wa,
                       :perfil,
                       :combo,
                       :soles,
                       :estado,
                       :color,
                       :disp,
                       NOW(),
                       NOW())
                ");

                $stmtIns->execute([
                    ':sid'    => (int)$child['streaming_id'],
                    ':correo' => $child['correo'],
                    ':plan'   => $planPadre,
                    ':pass'   => $child['password_plain'],
                    ':fi'     => $child['fecha_inicio'],
                    ':ff'     => $child['fecha_fin'],
                    ':wa'     => $child['whatsapp'],
                    ':perfil' => $child['perfil'] ?? '',
                    ':combo'  => (int)($child['combo'] ?? 0),
                    ':soles'  => $child['soles'],
                    ':estado' => $child['estado'],
                    ':color'  => $child['color'],
                    ':disp'   => $child['dispositivo'],
                ]);

                // 5) Borrar ese hijo de Familiares (ya está “ascendido” a padre)
                $stmtDelChild = $pdo->prepare("DELETE FROM perfiles_familiar WHERE id = ?");
                $stmtDelChild->execute([(int)$child['id']]);
            }

            $pdo->commit();
            return true;

        } catch (\Throwable $e) {
            $pdo->rollBack();
            throw $e;
        }
    }
}
