// The support email comes from the app's build config when one is set (see .env.example).
fetch('legal.json', { cache: 'no-cache' })
  .then((r) => (r.ok ? r.json() : null))
  .then((c) => {
    if (!c || !c.supportEmail) return;
    document.querySelectorAll('#contact').forEach((el) => {
      el.innerHTML = 'Email <a href="mailto:' + c.supportEmail + '">' + c.supportEmail + '</a>' + (c.supportUrl ? ' or visit <a href="' + c.supportUrl + '">our support page</a>.' : '.');
    });
  })
  .catch(() => {});
