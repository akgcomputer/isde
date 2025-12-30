<script>
document.addEventListener('DOMContentLoaded', function() {
    const quickNavBtns = document.querySelectorAll('.quick-nav-btn');
    const heroSections = document.querySelectorAll('.hero-section');
    
    // TÜM BÖLÜMLERİ BAŞLANGIÇTA GÖSTER
    heroSections.forEach(section => {
        section.style.display = 'block';
    });
    
    quickNavBtns.forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.preventDefault();
            const targetId = this.getAttribute('href').substring(1);
            
            // Tüm bölümleri göster (zaten hepsi açık)
            heroSections.forEach(section => {
                section.style.display = 'block';
            });
            
            // Butonlara aktif stil ekle
            quickNavBtns.forEach(b => {
                b.style.transform = 'translateY(0)';
                b.style.boxShadow = b === this ? 
                    '0 12px 25px rgba(0,0,0,0.2)' : 
                    '0 6px 20px rgba(0,0,0,0.15)';
            });
            
            this.style.transform = 'translateY(-5px)';
            
            // Bölüme smooth scroll
            const targetSection = document.getElementById(targetId);
            if (targetSection) {
                targetSection.scrollIntoView({ 
                    behavior: 'smooth', 
                    block: 'start',
                    inline: 'nearest'
                });
            }
        });
    });
    
    // Etiket bulutu hover efekti
    document.querySelectorAll('.tag').forEach(tag => {
        tag.addEventListener('mouseenter', function() {
            this.style.transform = 'translateY(-3px)';
            this.style.boxShadow = '0 6px 20px rgba(0,0,0,0.15)';
        });
        
        tag.addEventListener('mouseleave', function() {
            this.style.transform = 'translateY(0)';
            this.style.boxShadow = '0 3px 10px rgba(0,0,0,0.08)';
        });
    });
});
</script>