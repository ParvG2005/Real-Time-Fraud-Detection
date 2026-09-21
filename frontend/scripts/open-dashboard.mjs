import { chromium } from 'playwright';
import fs from 'node:fs';
const env=Object.fromEntries(fs.readFileSync('../.env','utf8').split('\n').filter(x=>x&&!x.startsWith('#')).map(x=>[x.slice(0,x.indexOf('=')),x.slice(x.indexOf('=')+1)]));
const response=await fetch('http://localhost:8080/api/v1/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:env.ADMIN_EMAIL,password:env.ADMIN_PASSWORD})});
if(!response.ok)throw new Error('Local sign-in failed');
const {token}=await response.json();
const browser=await chromium.launch({headless:false});
const context=await browser.newContext({viewport:{width:1440,height:960}});

const page=await context.newPage();await page.goto('http://localhost:3000');await page.evaluate(token=>sessionStorage.setItem('token',token),token);await page.goto('http://localhost:3000'+(process.argv[2]||'/analytics'));
console.log('Dashboard is open at http://localhost:3000. Close the browser window when finished.');
await new Promise(resolve=>browser.on('disconnected',resolve));
