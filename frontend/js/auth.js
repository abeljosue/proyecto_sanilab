function togglePassword(inputId, buttonEl) {
  const input = document.getElementById(inputId);
  if (!input) return;

  const isPassword = input.getAttribute('type') === 'password';
  input.setAttribute('type', isPassword ? 'text' : 'password');
}

function bindConfirmPassword(passwordId, confirmId, messageId) {
  const pass = document.getElementById(passwordId);
  const confirm = document.getElementById(confirmId);
  const msg = document.getElementById(messageId);

  if (!pass || !confirm || !msg) return;

  function validate() {
    if (!confirm.value) {
      msg.textContent = '';
      return;
    }
    msg.textContent =
      pass.value === confirm.value ? '' : 'Las contraseñas no coinciden.';
  }

  pass.addEventListener('input', validate);
  confirm.addEventListener('input', validate);
}
