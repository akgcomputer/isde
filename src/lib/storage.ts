export function slugifyFileName(fileName: string): string {
  const parts = fileName.split('.');
  const ext = parts.pop() || '';
  const name = parts.join('.');
  
  const slug = name
    .toLowerCase()
    .replace(/ğ/g, 'g').replace(/ü/g, 'u').replace(/ş/g, 's')
    .replace(/ı/g, 'i').replace(/ö/g, 'o').replace(/ç/g, 'c')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '');
    
  return `${slug}-${Math.floor(Math.random() * 1000)}.${ext}`;
}

export async function uploadFile(file: File, r2Binding?: any, prefix: string = 'upload'): Promise<string | null> {
  if (r2Binding) {
    // Cloudflare R2 Upload
    try {
      const fileName = `${prefix}-${slugifyFileName(file.name)}`;
      
      const buffer = await file.arrayBuffer();
      await r2Binding.put(fileName, buffer, {
        httpMetadata: { contentType: file.type || 'image/png' }
      });
      
      return `/api/media/${fileName}`;
    } catch (e) {
      console.error("R2 Upload failed:", e);
      return null;
    }
  } else {
    // Local Node.js FS Upload
    if (typeof globalThis.process !== 'undefined' && !globalThis.navigator?.userAgent?.includes('Cloudflare')) {
      try {
        const fsName = ['node', 'fs'].join(':');
        const pathName = ['node', 'path'].join(':');
        const fs = await import(/* @vite-ignore */ fsName);
        const path = await import(/* @vite-ignore */ pathName);
        
        const uploadsDir = path.resolve('./public/uploads');
        if (!fs.existsSync(uploadsDir)) {
          fs.mkdirSync(uploadsDir, { recursive: true });
        }
        
        const buffer = Buffer.from(await file.arrayBuffer());
        const fileName = `${prefix}-${slugifyFileName(file.name)}`;
        
        fs.writeFileSync(path.join(uploadsDir, fileName), buffer);
        return `/uploads/${fileName}`;
      } catch (e) {
        console.error("Local FS Upload failed:", e);
        return null;
      }
    }
  }
  return null;
}
