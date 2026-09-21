import {chromium} from 'playwright';import {pathToFileURL} from 'node:url';import path from 'node:path';
const browser=await chromium.launch({headless:true});const page=await browser.newPage();
await page.goto(pathToFileURL(path.resolve('../docs/presentation.html')).href);await page.emulateMedia({media:'print'});await page.pdf({path:'../docs/FraudShield-Presentation.pdf',printBackground:true,preferCSSPageSize:true});await browser.close();console.log('Exported 14-slide presentation PDF.');
