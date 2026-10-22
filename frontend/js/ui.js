document.addEventListener('DOMContentLoaded', () => {
    const header = document.querySelector('.site-header');
    const mobileFilterBtn = document.getElementById('mobileFilterBtn');
    const filtersPanel = document.querySelector('.filters');

    if (header) {
        window.addEventListener('scroll', () => {
            if (window.scrollY > 20) {
                header.classList.add('scrolled');
            } else {
                header.classList.remove('scrolled');
            }
        });
    }

    const mobileDrawer = document.getElementById('mobileDrawer');
    const navToggle = document.getElementById('navToggle');
    const drawerClose = document.getElementById('drawerClose');

    const filterBackdrop = document.getElementById('filterBackdrop');

    if (navToggle && mobileDrawer) {
        navToggle.addEventListener('click', () => {
            mobileDrawer.classList.toggle('open');
            mobileDrawer.setAttribute('aria-hidden', mobileDrawer.classList.contains('open') ? 'false' : 'true');
        });
    }

    if (drawerClose && mobileDrawer) {
        drawerClose.addEventListener('click', () => {
            mobileDrawer.classList.remove('open');
            mobileDrawer.setAttribute('aria-hidden', 'true');
        });
    }

    if (mobileFilterBtn && filtersPanel) {
        mobileFilterBtn.addEventListener('click', () => {
            filtersPanel.classList.toggle('active');
            filterBackdrop.classList.toggle('visible');
        });
    }

    if (filterBackdrop && filtersPanel) {
        filterBackdrop.addEventListener('click', () => {
            filtersPanel.classList.remove('active');
            filterBackdrop.classList.remove('visible');
        });
    }
});
