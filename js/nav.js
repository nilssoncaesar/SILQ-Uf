/* Mobilmeny */
document.addEventListener('DOMContentLoaded', function () {
  var knapp = document.querySelector('.nav-toggle');
  var nav = document.getElementById('nav');
  if (!knapp || !nav) return;
  knapp.addEventListener('click', function () {
    var oppen = nav.classList.toggle('is-open');
    knapp.setAttribute('aria-expanded', String(oppen));
  });
});
