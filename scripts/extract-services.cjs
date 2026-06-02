// scripts/extract-services.cjs
const fs = require('fs');
const path = require('path');

const targetDir = path.join(__dirname, '../src/pages/hizmetler');
const outputDir = path.join(__dirname, '../src/pages/data');
const outputFile = path.join(outputDir, 'services_slugs.json');

console.log('🔍 Hizmetler dizini taranıyor:', targetDir);

if (!fs.existsSync(targetDir)) {
  console.error('❌ Hata: src/pages/hizmetler dizini bulunamadı!');
  process.exit(1);
}

try {
  const files = fs.readdirSync(targetDir);
  const astroFiles = files.filter(file => file.endsWith('.astro'));
  
  console.log(`📊 Toplam dosya sayısı: ${files.length}`);
  console.log(`✨ Tespit edilen .astro hizmet sayfası: ${astroFiles.length}`);

  const slugs = astroFiles.map(file => file.replace('.astro', ''));

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Slugs listesini JSON dosyasına kaydet
  fs.writeFileSync(outputFile, JSON.stringify(slugs, null, 2), 'utf-8');

  console.log(`✅ Başarılı! Tüm hizmet isimleri yedeklendi: ${outputFile}`);
  console.log(`📝 Kaydedilen toplam slug sayısı: ${slugs.length}`);

} catch (err) {
  console.error('❌ İşlem sırasında hata oluştu:', err);
  process.exit(1);
}
