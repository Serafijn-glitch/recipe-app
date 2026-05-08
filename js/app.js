// app.js — navigatie en service worker registratie

function showView(hash) {
  const id = hash.replace('#', '') || 'recepten';
  document.querySelectorAll('.view').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.nav-link').forEach(el => el.classList.remove('active'));

  const target = document.getElementById(id);
  if (target) target.classList.add('active');

  const link = document.querySelector(`.nav-link[href="${hash || '#recepten'}"]`);
  if (link) link.classList.add('active');
}

window.addEventListener('hashchange', () => showView(location.hash));
showView(location.hash);

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./service-worker.js')
    .then(reg => console.log('[SW] Geregistreerd:', reg.scope))
    .catch(err => console.error('[SW] Registratie mislukt:', err));
}
