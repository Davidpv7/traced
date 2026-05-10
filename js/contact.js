// ── GENERAL FORM ─────────────────────────────────────
document.getElementById('form-general').addEventListener('submit', e => {
  e.preventDefault();
  const status = document.getElementById('general-status');
  const name    = document.getElementById('general-name').value.trim();
  const email   = document.getElementById('general-email').value.trim();
  const message = document.getElementById('general-message').value.trim();

  if (!name || !email || !message) {
    status.textContent = 'Please fill in all fields.';
    status.style.color = '#ff6a00';
    return;
  }

  // EmailJS will go here in Phase 2
  // For now, show a confirmation
  status.textContent = 'Message sent! We\'ll get back to you within 24 hours.';
  status.style.color = '#c8b89a';
  e.target.reset();
});

// ── SPECIAL REQUEST FORM ─────────────────────────────
document.getElementById('form-special').addEventListener('submit', e => {
  e.preventDefault();
  const status  = document.getElementById('special-status');
  const name    = document.getElementById('special-name').value.trim();
  const email   = document.getElementById('special-email').value.trim();
  const message = document.getElementById('special-message').value.trim();

  if (!name || !email || !message) {
    status.textContent = 'Please fill in the required fields.';
    status.style.color = '#ff6a00';
    return;
  }

  // EmailJS will go here in Phase 2
  status.textContent = 'Request sent! We\'ll be in touch shortly to discuss.';
  status.style.color = '#c8b89a';
  e.target.reset();
});