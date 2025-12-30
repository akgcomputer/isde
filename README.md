# İş De Yeter - Astro Website

Modern, hızlı ve SEO uyumlu website için Astro framework kullanılarak geliştirilmiş.

## 🚀 Özellikler

- **Component-Based Architecture**: Header, Footer ve ServiceCard bileşenleri ayrı dosyalarda
- **SEO Optimized**: Meta tags, Open Graph ve Twitter Card desteği
- **Responsive Design**: Mobil, tablet ve desktop uyumlu
- **Modern CSS**: Custom Properties, Flexbox ve Grid kullanımı
- **Interactive JavaScript**: Smooth scrolling, mobile menu
- **Performance**: Astro'nun islands architecture ile hızlı yükleme

## 📁 Dosya Yapısı

```
src/
├── components/          # Yeniden kullanılabilir bileşenler
│   ├── Header.astro    # Header navigation
│   ├── Footer.astro    # Footer component
│   └── ServiceCard.astro # Hizmet kartları
├── layouts/            # Sayfa şablonları
│   └── BasicLayout.astro # Ana layout
├── pages/              # Sayfalar
│   └── index.astro     # Ana sayfa
└── styles/             # CSS dosyaları
    └── global.css      # Global stiller

public/
└── styles.css          # Public CSS dosyası
```

## 🛠️ Kurulum ve Çalıştırma

```bash
# Bağımlılıkları yükle
npm install

# Geliştirme sunucusunu başlat
npm run dev

# Build oluştur
npm run build

# Build'i önizle
npm run preview
```

## 📱 Bileşenler

### Header Component
- Sticky navigation
- Mobile hamburger menu
- Smooth scrolling
- SEO friendly links

### Footer Component  
- Link kategorileri
- Social media placeholder
- Copyright bilgisi
- MeetWork signature

### ServiceCard Component
- Dinamik hizmet verileri
- SVG icon desteği
- Özellik listeleri
- Hover animasyonları

### BaseLayout
- SEO meta tags
- Font loading (Inter)
- Global CSS import
- Open Graph desteği

## 🎨 Tasarım Sistemi

### Renk Paleti
- **Primary**: #0F62FE (Mavi)
- **Secondary**: #0F172A (Koyu gri)
- **Background**: #F8FAFC (Açık gri)
- **Surface**: #FFFFFF (Beyaz)

### Typography
- **Font**: Inter (Google Fonts)
- **Weights**: 400, 500, 600, 700

### Responsive Breakpoints
- **Mobile**: < 768px
- **Tablet**: 768px - 1024px  
- **Desktop**: > 1024px

## 🔧 Teknolojiler

- **Astro 5.x**: Static site generator
- **TypeScript**: Type safety
- **Vanilla JavaScript**: Interactivity
- **Modern CSS**: Custom properties, Flexbox, Grid
- **SVG Icons**: Scalable vector graphics

## 📈 SEO Özellikleri

- Meta description ve keywords
- Open Graph meta tags
- Twitter Card desteği
- Semantic HTML5
- Structured data ready

## 🚀 Performans

- Server-side rendering
- Minimal JavaScript
- Optimized CSS
- SVG icons (lightweight)
- Lazy loading ready

## 🎯 Hizmet Bölümleri

1. **Hizmet Eşleştirme**: Armut benzeri platform
2. **Global Şirket Kurulumu**: Mukellef benzeri hizmet
3. **İşletme Yazılımları**: Bulut muhasebe/B2B/e-ticaret

## 📱 Responsive Özellikler

- Mobile-first approach
- Touch-friendly navigation
- Optimized typography scales
- Flexible grid systems
- Performance optimized

## 🔄 Geliştirme İpuçları

```bash
# Yeni bileşen oluştur
touch src/components/YeniBilesen.astro

# Yeni sayfa oluştur
touch src/pages/yeni-sayfa.astro

# CSS değişkenleri kullan
const customColor = "var(--primary-500)";
```

## 📝 Notlar

- Node.js >= 18.20.8 gerekli
- Astro 5.x versiyonu kullanılıyor
- TypeScript desteği dahil
- Modern browser compatibility

## 🎨 Geliştirme Hedefleri

- [ ] İstatistik bölümü ekleme
- [ ] Referans logoları şeridi
- [ ] Blog sayfası oluşturma
- [ ] Contact form entegrasyonu
- [ ] Analytics entegrasyonu