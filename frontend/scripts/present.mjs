import { chromium, expect } from '@playwright/test';
import fs from 'node:fs';
const env=Object.fromEntries(fs.readFileSync('../.env','utf8').split('\n').filter(x=>x&&!x.startsWith('#')).map(x=>[x.slice(0,x.indexOf('=')),x.slice(x.indexOf('=')+1)]));
const response=await fetch('http://localhost:8080/api/v1/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:env.ADMIN_EMAIL,password:env.ADMIN_PASSWORD})});
if(!response.ok)throw new Error('Could not authenticate the local presenter');
const {token}=await response.json();
const browser=await chromium.launch({headless:process.env.RECORD_HEADLESS==='1',slowMo:300});
const context=await browser.newContext({viewport:{width:1440,height:900},recordVideo:{dir:'../artifacts/presentation-video',size:{width:1440,height:900}}});
await context.addInitScript(token=>sessionStorage.setItem('token',token),token);
const page=await context.newPage();const video=page.video();
const started=Date.now();
async function step(title,detail,seconds=16){console.log(title);await page.evaluate(({title,detail})=>{let el=document.getElementById('presentation-caption');if(!el){el=document.createElement('div');el.id='presentation-caption';el.style.cssText='position:fixed;bottom:18px;left:260px;right:25px;background:#0b1529;z-index:9999;padding:18px 25px;border:1px solid #3285ff77;border-radius:12px;box-shadow:0 10px 40px #0003;pointer-events:none;font-family:system-ui';document.body.append(el)}el.replaceChildren();const heading=document.createElement('strong');heading.style.cssText='font-size:17px;color:#f4f8ff;display:block;margin-bottom:5px';heading.textContent=title;const p=document.createElement('span');p.style.cssText='font-size:13px;line-height:1.6;color:#a9bfdf';p.textContent=detail;el.append(heading,p)},{title,detail});await page.waitForTimeout(seconds*1000)}
async function shot(name){await page.locator('#presentation-caption').evaluate(el=>el.style.display='none').catch(()=>{});await page.screenshot({path:`../docs/${name}.png`,fullPage:false});await page.locator('#presentation-caption').evaluate(el=>el.style.display='block').catch(()=>{});}
async function demo(title,expected){await page.locator('nav').getByRole('link',{name:'Demo studio'}).click();await page.locator('.scenario').filter({hasText:title}).getByRole('button',{name:'Run scenario'}).click();await expect(page.locator('.result-card')).toContainText(expected)}
try{
 await page.goto('http://localhost:3000');await page.getByRole('heading',{name:'A clearer view of every risk.'}).waitFor();
 await step('01 / FraudShield AI — local, real-time fraud intelligence','Synthetic demonstration data. Actual database records, trained model inference, and explainable decisions.',18);await shot('dashboard');
 await step('02 / A hybrid decision, with a human in the loop','React + FastAPI + PostgreSQL/pgvector + Redis + an independent ML service. No cloud credentials required.',16);
 await page.locator('nav').getByRole('link',{name:'Demo studio'}).click();
 await step('03 / Four scenarios, one real pipeline','Each scenario creates an isolated synthetic customer. Results are calculated from real submitted requests.',16);
 await demo('Everyday repayment','ALLOW');
 await step('04 / Normal repayment → ALLOW','₹2,500, an established baseline, a familiar device and city. Inspect the actual score and measured latency.',17);
 await demo('An amount worth a look','REVIEW');
 await step('05 / An unusual amount → REVIEW','A high amount alone warrants a closer look. A known device is only one part of the evidence.',17);
 await demo('Connect the warning signs','BLOCK');
 await step('06 / Multiple warning signs → BLOCK','The simulator submits seven real prior requests, then ₹65,000 from a new device and another city.',18);
 await page.getByRole('link',{name:'Investigate this transaction'}).click();
 await step('07 / Five component scores produce the policy decision','35% ML + 20% rules + 25% behavior + 10% anomaly + 10% historical similarity. These are explicit demo-policy weights.',18);
 await page.getByRole('tab',{name:'History',exact:true}).click();
 await step('08 / Behavioral evidence comes from stored history','The burst is visible in the customer timeline. Features are captured server-side and preserved with the decision.',17);
 await page.getByRole('tab',{name:'Explainability',exact:true}).click();
 await step('09 / Real TreeSHAP, not a generic AI rationale','Feature contributions plus the base reconstruct the model margin. Contributions are log-odds, not probability points.',18);await shot('explainability');
 await page.locator('.explanation').scrollIntoViewIfNeeded();
 await step('10 / Explain only the observed evidence','The local explanation is explicitly labeled as a template. It does not invent facts or make the fraud decision.',17);
 await page.getByRole('tab',{name:/Similar cases/}).click();
 await step('11 / Actual historical similarity search','pgvector retrieves confirmed patterns using local 256-dimensional hashing embeddings. Similarity is context, not proof.',18);await shot('similar-cases');
 await page.getByLabel('Investigation notes').fill('Presentation demo: reviewed the new device, changed city and real velocity burst; confirmed this synthetic fraud pattern.');
 await page.getByRole('button',{name:'Confirm fraud',exact:true}).click();await expect(page.locator('.investigation-body .success')).toContainText('FRAUD');
 await step('12 / The analyst records the investigation outcome','Confirmed fraud is saved as feedback. The original model score, policy decision and evidence stay intact.',17);
 await demo('Keep a human in the loop','BLOCK');await page.getByRole('link',{name:'Investigate this transaction'}).click();
 await page.getByLabel('Investigation notes').fill('Presentation demo: independent verification confirmed legitimate travel and customer payment intent.');await page.getByRole('button',{name:'Mark legitimate'}).click();await expect(page.locator('.investigation-body .success')).toContainText('LEGITIMATE');
 await step('13 / An anomaly is not proof of fraud','The analyst can clear a false positive. That label is retained separately for future evaluation and retraining.',18);
 await page.getByRole('link',{name:'Investigations',exact:true}).click();
 await step('14 / Close the feedback loop','The queue contains persistent cases. Export reviewed labels together with the original features and model version.',16);
 await page.getByRole('link',{name:'Analytics',exact:true}).click();await page.getByRole('heading',{name:'Intelligence, in focus.'}).waitFor();
 await step('15 / Honest, measured performance','Precision, recall and PR-AUC come from an untouched synthetic test set. Analyst-reviewed outcomes are a separate selected subset.',20);await shot('analytics');await page.getByRole('button',{name:'Model quality',exact:false}).click();await page.getByRole('heading',{name:'Evaluation record'}).waitFor();await page.waitForTimeout(3000);
 await page.getByRole('link',{name:'Detection rules'}).click();
 await step('16 / Explicit, configurable policy','Admins can change conditions, points and toggles. New policy changes affect future requests, not historical evidence.',16);
 await page.getByRole('link',{name:'Audit trail'}).click();
 await step('17 / Access and changes are accountable','JWT authentication, role checks, strict input validation, per-customer locks and idempotency support a reproducible workflow.',16);
 await page.getByRole('link',{name:'Overview',exact:true}).click();
 await step('18 / Detect. Score. Explain. Investigate. Learn.','A working local prototype with transparent limits. Production needs representative data, calibration, fairness evaluation and durable background infrastructure.',18);
 console.log('Recorded duration seconds:',Math.round((Date.now()-started)/1000));
}finally{await context.close();await video.saveAs('../docs/recorded-demo.webm');await browser.close()}
