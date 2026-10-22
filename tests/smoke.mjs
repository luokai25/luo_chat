import {chromium} from 'playwright';
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH,args:['--no-sandbox']});
const page=await browser.newPage({viewport:{width:390,height:844}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.goto(process.env.LUO_TEST_URL||'http://localhost:8080');await page.waitForTimeout(1500);await page.locator('#forgot').click();await page.locator('#authmsg').filter({hasText:'Enter your email'}).waitFor();
const wasLight=await page.locator('body.light').count();await page.locator('#themeToggle').click();if((await page.locator('body.light').count())===wasLight)throw Error('Theme toggle failed');
await page.locator('#signin').click();await page.locator('#authmsg').filter({hasText:'valid email'}).waitFor();
if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth))throw Error('Mobile horizontal overflow');
await page.screenshot({path:'test-results/mobile.png',fullPage:true});await page.setViewportSize({width:1440,height:960});await page.screenshot({path:'test-results/desktop.png',fullPage:true});
if(errors.length)throw Error(errors.join('\n'));console.log('PASS: application boot, authentication validation, recovery entry, theme, mobile width; zero page errors');await browser.close();
