(() => {
 const d = document, a = [...d.querySelectorAll('.innhold-spalte a')];
 const s = a.map(l => d.getElementById(l.hash.slice(1)));
 const m = d.querySelector('.innhold-mobil');
 if (m) m.addEventListener('click', e => { if (e.target.closest('a')) m.open = false; });
 if (!s.length || s.includes(null) || !('IntersectionObserver' in window)) return;
 const v = new Set();
 let n = -1;
 const sett = () => {
  let i = -1;
  s.some((e, j) => v.has(e) && (i = j, true));
  if (innerHeight + scrollY >= d.documentElement.scrollHeight - 4) i = s.length - 1;
  if (i < 0 || i === n) return;
  n = i;
  a.forEach((l, j) => j === i ? l.setAttribute('aria-current', 'location') : l.removeAttribute('aria-current'));
 };
 const io = new IntersectionObserver(e => {
  e.forEach(x => x.isIntersecting ? v.add(x.target) : v.delete(x.target));
  sett();
 }, { rootMargin: '-15% 0px -55% 0px' });
 s.forEach(e => io.observe(e));
 addEventListener('scroll', sett, { passive: true });
})();
