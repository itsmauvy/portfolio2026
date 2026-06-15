/* Lenis smooth scroll */
const lenis = new Lenis({ lerp: 0.08, smooth: true });
function raf(time) { lenis.raf(time); requestAnimationFrame(raf); }
requestAnimationFrame(raf);

/* GSAP hero entrance */
gsap.set('.hero__letter', { y: -160, opacity: 0 });
gsap.set('.hero__sub',    { y: 20,   opacity: 0 });

gsap.to('.hero__letter', {
  y: 0,
  opacity: 1,
  duration: 1,
  ease: 'back.out(1.4)',
  stagger: 0.08,
  delay: 0.2,
  onComplete() {
    gsap.set('.hero__letter', { clearProps: 'transform' });
  },
});

gsap.to('.hero__sub', {
  y: 0,
  opacity: 1,
  duration: 0.8,
  ease: 'power3.out',
  delay: 0.9,
});

/* Active nav highlight on scroll */
const sections = document.querySelectorAll('[data-section]');
const navLinks = document.querySelectorAll('.sidebar__nav a');

const observer = new IntersectionObserver(entries => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      navLinks.forEach(a => a.classList.remove('active'));
      const link = document.querySelector(`.sidebar__nav a[href="#${entry.target.dataset.section}"]`);
      if (link) link.classList.add('active');
    }
  });
}, { threshold: 0.4 });

sections.forEach(s => observer.observe(s));

/* Email copy to clipboard */
const emailBtn = document.querySelector('.footer__email-btn');
if (emailBtn) {
  emailBtn.addEventListener('click', () => {
    navigator.clipboard.writeText(emailBtn.dataset.email).then(() => {
      emailBtn.classList.add('copied');
      setTimeout(() => emailBtn.classList.remove('copied'), 2000);
    });
  });
}
