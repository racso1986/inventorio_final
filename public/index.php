<?php
require_once __DIR__ . '/../config/config.php';
if (isset($_SESSION['user_id'])) {
    header('Location: dashboard.php');
    exit;
}
include __DIR__ . '/../includes/header.php';
?>
<div class="row justify-content-center">
  <div class="col-md-6">
    <div class="card shadow-sm">
      <div class="card-body">
        <ul class="nav nav-tabs" id="authTabs" role="tablist">
          <li class="nav-item" role="presentation">
            <button class="nav-link active" id="login-tab" data-bs-toggle="tab" data-bs-target="#login" type="button" role="tab">Ingresar</button>
          </li>
          <li class="nav-item" role="presentation">
            <button class="nav-link" id="register-tab" data-bs-toggle="tab" data-bs-target="#register" type="button" role="tab">Registrarse</button>
          </li>
        </ul>
        <div class="tab-content p-3">
          <div class="tab-pane fade show active" id="login" role="tabpanel">
            <form method="post" action="../app/controllers/AuthController.php">
              <input type="hidden" name="action" value="login">
              <div class="mb-3">
                <label class="form-label">Email</label>
                <input type="email" name="email" class="form-control" required>
              </div>
              <div class="mb-3">
                <label class="form-label">Password</label>
                <input type="password" name="password" class="form-control" required>
              </div>
              <button class="btn btn-primary w-100">Ingresar</button>
            </form>
          </div>
          <div class="tab-pane fade" id="register" role="tabpanel">
            <form method="post" action="../app/controllers/AuthController.php">
              <input type="hidden" name="action" value="register">
              <div class="mb-3">
                <label class="form-label">Email</label>
                <input type="email" name="email" class="form-control" required>
              </div>
              <div class="mb-3">
                <label class="form-label">Password</label>
                <input type="password" name="password" class="form-control" required>
              </div>
              <button class="btn btn-success w-100">Registrarme</button>
            </form>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>
<div class="text-center mt-3">
  <img src="beta.jpg" alt="Versión beta"
       class="img-fluid"
       style="max-width: 200px; height: auto;">
</div>

<!-- BETA BANNER :: BEGIN -->
<style>
  .beta-banner {
    position: fixed; inset: 0 auto auto 0; right: 0; top: 0;
    z-index: 1085; /* sobre navbar Bootstrap */
    display: none;
    background: linear-gradient(90deg, #0d6efd, #6610f2);
    color: #fff;
    font-size: .95rem;
  }
  .beta-banner .beta-inner {
    max-width: 1200px; margin: 0 auto; padding: .6rem .95rem;
    display: flex; align-items: center; gap: .75rem; justify-content: space-between;
  }
  .beta-banner a { color: #fff; text-decoration: underline; }
  .beta-close { border: 0; background: transparent; color: #fff; opacity: .9; font-size: 1.1rem; line-height: 1; }
  .beta-close:hover { opacity: 1; }
  body.has-beta-banner { padding-top: 48px; } /* evita que tape el contenido */
  @media (max-width: 576px){ body.has-beta-banner { padding-top: 60px; } }
</style>

<div id="beta-banner" class="beta-banner shadow-sm" role="status" aria-live="polite">
  <div class="beta-inner">
    <div>
      <strong>🚧 Versión beta.</strong>
      Estamos desplegando mejoras de forma continua durante las próximas semanas.
      Si notas algo raro o necesitas ayuda, <a id="beta-contact" href="mailto:soporte@tuempresa.com">contáctanos</a>.
    </div>
    <button class="beta-close" id="beta-dismiss" aria-label="Cerrar aviso">×</button>
  </div>
</div>

<script>
(function(){
  const BANNER_ID = 'beta-banner';
  const DISMISS_KEY = 'betaBannerDismissed';
  const CONTACT_HREF = 'https://wa.me/51934415875'; // TODO: cambia a tu WhatsApp o mailto:
  const HIDE_FOR_HOURS = 12; // ocultar por 12h tras cerrar

  function show(){
    document.body.classList.add('has-beta-banner');
    document.getElementById(BANNER_ID).style.display = 'block';
  }
  function hide(){
    document.body.classList.remove('has-beta-banner');
    document.getElementById(BANNER_ID).style.display = 'none';
  }

  window.addEventListener('DOMContentLoaded', function(){
    const dismissedUntil = Number(sessionStorage.getItem(DISMISS_KEY) || 0);
    const now = Date.now();
    // Link de contacto (WhatsApp o mail)
    const a = document.getElementById('beta-contact');
    if (a) a.href = CONTACT_HREF;

    if (now < dismissedUntil) return; // aún vigente el “no molestar”
    show();

    const btn = document.getElementById('beta-dismiss');
    if (btn) btn.addEventListener('click', function(){
      hide();
      const next = now + HIDE_FOR_HOURS * 60 * 60 * 1000;
      sessionStorage.setItem(DISMISS_KEY, String(next));
    });
  });
})();
</script>
<!-- BETA BANNER :: END -->

<?php include __DIR__ . '/../includes/footer.php'; ?>
