// scripts/migrate-pages.js

// toplu düzenleme betiği: src/pages/hizmetler dizinindeki tüm .astro dosyalarını tarar,

const fs = require('fs');
const path = require('path');

const config = {
  oldLayout: "BasicLayout",
  newLayout: "BasicLayout",
  templateComponent: "RedirectTemplate",
  srcDir: path.join(__dirname, '../src/pages'),
  excludeDirs: ['api', '_components', 'assets']
};

function processFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  
  // 1. Layout import'unu değiştir
  content = content.replace(
    /import\s+BasicLayout\s+from\s+['"][^'"]+['"];/g,
    `import BasicLayout from '../../layouts/BasicLayout.astro';`
  );
  
  // 2. BasicLayout tag'ini değiştir
  content = content.replace(/<BasicLayout/g, '<BasicLayout');
  content = content.replace(/<\/BasicLayout>/g, '</BasicLayout>');
  
  // 3. Template ekle
  if (content.includes('<BasicLayout')) {
    // Frontmatter'dan başlığı çek
    const titleMatch = content.match(/const\s+pageTitle\s*=\s*["']([^"']+)["']/);
    const pageTitle = titleMatch ? titleMatch[1] : 'Hizmet Detayı';
    
    // RedirectTemplate import'u ekle (eğer yoksa)
    if (!content.includes('RedirectTemplate')) {
      content = content.replace(
        /import BasicLayout from ['"][^'"]+['"];/,
        `import BasicLayout from '../../layouts/BasicLayout.astro';\nimport RedirectTemplate from '../../components/RedirectTemplate.astro';`
      );
      
      // İçeriği değiştir
      const newContent = `<BasicLayout title={\`${pageTitle} | İş De Yeter\`}>
    <RedirectTemplate 
        pageTitle="${pageTitle}"
        showWhatsApp={true}
    />
</BasicLayout>`;
      
      content = content.replace(
        /<BasicLayout[\s\S]*?<\/BasicLayout>/,
        newContent
      );
    }
  }
  
  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`✅ Güncellendi: ${filePath}`);
}

function walkDir(dir) {
  const files = fs.readdirSync(dir);
  
  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (config.excludeDirs.includes(file)) return;
    
    if (stat.isDirectory()) {
      walkDir(filePath);
    } else if (file.endsWith('.astro')) {
      processFile(filePath);
    }
  });
}

// Çalıştır
console.log('🚀 Sayfalar güncelleniyor...');
walkDir(config.srcDir);
console.log('🎉 Tüm sayfalar güncellendi!');