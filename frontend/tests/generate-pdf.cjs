const { chromium } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  const mdPath = path.resolve('frontend/tests/doc-fixtures/markdown/safety-guide-source.md');
  const mdContent = fs.readFileSync(mdPath, 'utf8');
  
  // Basic HTML template to make it look like a real document
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; padding: 40px; color: #333; }
        h1 { color: #1e3a8a; border-bottom: 2px solid #1e3a8a; padding-bottom: 10px; }
        h2 { color: #1e40af; margin-top: 30px; }
        blockquote { background: #f3f4f6; border-left: 5px solid #3b82f6; padding: 10px 20px; margin: 20px 0; }
        hr { border: 0; border-top: 1px solid #e5e7eb; margin: 40px 0; }
      </style>
    </head>
    <body>
      ${mdContent
        .replace(/^# (.*$)/gm, '<h1>$1</h1>')
        .replace(/^## (.*$)/gm, '<h2>$1</h2>')
        .replace(/^### (.*$)/gm, '<h3>$1</h3>')
        .replace(/^- (.*$)/gm, '<ul><li>$1</li></ul>')
        .replace(/^[0-9]\. (.*$)/gm, '<ol><li>$1</li></ol>')
        .replace(/^> (.*$)/gm, '<blockquote>$1</blockquote>')
        .replace(/\*\*(.*)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*)\*/g, '<em>$1</em>')
        .replace(/\n\n/g, '<p></p>')
        .replace(/---/g, '<hr>')
      }
    </body>
    </html>
  `.replace(/<\/ul><ul>/g, '').replace(/<\/ol><ol>/g, '');

  await page.setContent(html);
  await page.pdf({
    path: 'frontend/tests/doc-fixtures/media/safety-guide.pdf',
    format: 'A4',
    margin: { top: '20mm', right: '20mm', bottom: '20mm', left: '20mm' }
  });

  await browser.close();
  console.log('✅ Generated safety-guide.pdf using Playwright.');
})();
