import assert from 'node:assert/strict';
import { CaptchaService } from '../src/modules/auth/captcha.service';

async function testCaptcha() {
  const service = new CaptchaService();

  console.log('1. Testing generateCaptcha()...');
  const cap1 = service.generateCaptcha();
  assert(cap1.captchaId, 'captchaId must be present');
  assert(cap1.svg, 'svg must be present');
  assert(cap1.svg.includes('<svg'), 'svg must contain svg tag');
  assert(cap1.svg.includes('</svg>'), 'svg must contain closing svg tag');
  assert(cap1.svg.includes(`id="bg-${cap1.captchaId}"`), 'svg must have distinct id gradient');

  console.log('2. Testing validateCaptcha() with invalid id/code...');
  assert.equal(service.validateCaptcha('', ''), false, 'Empty strings must return false');
  assert.equal(service.validateCaptcha(cap1.captchaId, 'WRONG_CODE'), false, 'Wrong code must return false');

  console.log('3. Testing replay protection (cannot re-use after wrong or right attempt)...');
  assert.equal(service.validateCaptcha(cap1.captchaId, 'ANYTHING'), false, 'Replay after failure must return false');

  console.log('4. Testing invalid captcha code rejection (ensuring 1234/demo is strictly rejected when incorrect)...');
  const cap2 = service.generateCaptcha();
  assert.equal(service.validateCaptcha(cap2.captchaId, '1234'), false, 'Arbitrary code 1234 must be strictly rejected');

  const cap3 = service.generateCaptcha();
  assert.equal(service.validateCaptcha(cap3.captchaId, 'demo'), false, 'Arbitrary code demo must be strictly rejected');

  console.log('5. Testing correct code matching and devCode in non-production...');
  const cap4 = service.generateCaptcha();
  assert(cap4.devCode, 'devCode must be present in non-prod for quick-login');
  assert.equal(service.validateCaptcha(cap4.captchaId, cap4.devCode.toLowerCase()), true, 'Correct devCode (case-insensitive) must pass');

  console.log('All CaptchaService tests passed successfully! ✅');
}

testCaptcha().catch((err) => {
  console.error(err);
  process.exit(1);
});
