import fs from 'fs';
import path from 'path';

function replaceInDir(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    if (file === 'node_modules' || file === '.git' || file === 'dist' || file.endsWith('.jpg') || file.endsWith('.png')) continue;
    const fullPath = path.join(dir, file);
    try {
      const stat = fs.statSync(fullPath);
      if (stat.isDirectory()) {
        replaceInDir(fullPath);
      } else if (file.endsWith('.tsx') || file.endsWith('.jsx')) {
        let content = fs.readFileSync(fullPath, 'utf8');
        const oldContent = content;
        
        // 1. LandingPage.tsx
        content = content.replace(
          /<div className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-zinc-900 text-white shadow-sm">\s*<Shield className="h-5 w-5" \/>\s*<\/div>/g,
          `<div className="relative flex h-10 w-10 items-center justify-center rounded-xl shadow-sm overflow-hidden bg-zinc-900">\n              <img src="/logo.png" alt="MedSafe Logo" className="object-contain w-full h-full p-1" />\n            </div>`
        );
        
        // 2. AuthPage.tsx
        content = content.replace(
          /<div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-900 text-white shadow-sm">\s*<Shield className="h-6 w-6" \/>\s*<\/div>/g,
          `<div className="relative flex h-12 w-12 items-center justify-center rounded-xl bg-zinc-900 shadow-sm overflow-hidden">\n            <img src="/logo.png" alt="MedSafe Logo" className="object-contain w-full h-full p-1" />\n          </div>`
        );
        
        // 3. PatientDashboard.tsx / DoctorDashboard.tsx
        content = content.replace(
          /<div className="relative flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-900 text-white shadow-sm">\s*<Shield className="h-5 w-5" \/>\s*<\/div>/g,
          `<div className="relative flex h-9 w-9 items-center justify-center rounded-lg bg-zinc-900 shadow-sm overflow-hidden">\n              <img src="/logo.png" alt="MedSafe Logo" className="object-contain w-full h-full p-1" />\n            </div>`
        );

        if (oldContent !== content) {
          fs.writeFileSync(fullPath, content, 'utf8');
          console.log(`Replaced logo in ${fullPath}`);
        }
      }
    } catch(e) {}
  }
}

replaceInDir(path.join(process.cwd(), 'src'));
