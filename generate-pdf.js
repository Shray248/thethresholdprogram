const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.goto(`file://${__dirname}/resource.html`, {waitUntil: 'networkidle2'});
  await page.pdf({
    path: 'The_5_Invisible_Limits.pdf',
    format: 'A4',
    printBackground: true,
    margin: { top: '0px', right: '0px', bottom: '0px', left: '0px' }
  });
  await browser.close();
  console.log('PDF generated successfully!');
})();
