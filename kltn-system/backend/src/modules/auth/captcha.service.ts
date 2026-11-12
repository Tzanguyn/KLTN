import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';

interface CaptchaEntry {
  code: string;
  expiresAt: number;
}

@Injectable()
export class CaptchaService {
  private readonly store = new Map<string, CaptchaEntry>();
  // Loại bỏ các ký tự dễ nhầm lẫn: 0, O, 1, I, L
  private readonly CHARS = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
  private readonly TTL_MS = 5 * 60 * 1000; // 5 phút hiệu lực

  /**
   * Tạo mã CAPTCHA mới dạng vector SVG kèm captchaId
   */
  generateCaptcha(): { captchaId: string; svg: string; devCode?: string } {
    this.cleanup();

    const captchaId = crypto.randomUUID();
    let code = '';
    for (let i = 0; i < 4; i++) {
      code += this.CHARS[Math.floor(Math.random() * this.CHARS.length)];
    }

    this.store.set(captchaId, {
      code,
      expiresAt: Date.now() + this.TTL_MS,
    });

    const svg = this.renderSvg(captchaId, code);
    return {
      captchaId,
      svg,
      ...(process.env.NODE_ENV !== 'production' ? { devCode: code } : {}),
    };
  }

  /**
   * Xác thực mã người dùng nhập và xóa ngay mã để chống tấn công replay
   */
  validateCaptcha(captchaId?: string, userCode?: string): boolean {
    if (!captchaId || !userCode) {
      return false;
    }

    const cleanCode = userCode.trim().toUpperCase();

    const entry = this.store.get(captchaId);
    if (!entry) {
      return false;
    }

    // Xóa ngay mã khỏi danh sách sau 1 lần xác thực (chống replay attack)
    this.store.delete(captchaId);

    if (Date.now() > entry.expiresAt) {
      return false;
    }

    // Bắt buộc phải khớp chính xác mã CAPTCHA đã sinh (không cho phép mã mặc định/backdoor)
    return entry.code === cleanCode;
  }

  /**
   * Dọn dẹp các mã đã hết hạn trong bộ nhớ
   */
  private cleanup() {
    const now = Date.now();
    for (const [id, entry] of this.store.entries()) {
      if (now > entry.expiresAt) {
        this.store.delete(id);
      }
    }
  }

  /**
   * Sinh mã SVG đồ họa nhẹ, tương thích 100% mọi nền tảng, không cần thư viện native
   */
  private renderSvg(id: string, code: string): string {
    const width = 130;
    const height = 40;
    const colors = ['#1e3a8a', '#065f46', '#831843', '#4338ca', '#0f766e', '#7c2d12', '#374151'];

    // Đường cong nhiễu (bezier noise lines)
    let lines = '';
    for (let i = 0; i < 4; i++) {
      const x1 = Math.floor(Math.random() * 20);
      const y1 = Math.floor(Math.random() * height);
      const qx = Math.floor(Math.random() * width);
      const qy = Math.floor(Math.random() * height);
      const x2 = Math.floor(width - Math.random() * 20);
      const y2 = Math.floor(Math.random() * height);
      const stroke = colors[Math.floor(Math.random() * colors.length)];
      lines += `<path d="M${x1},${y1} Q${qx},${qy} ${x2},${y2}" stroke="${stroke}" stroke-width="1.5" fill="none" opacity="0.35"/>`;
    }

    // Các điểm chấm nhiễu (noise dots)
    let dots = '';
    for (let i = 0; i < 24; i++) {
      const cx = Math.floor(Math.random() * width);
      const cy = Math.floor(Math.random() * height);
      const r = (Math.random() * 1.5 + 0.8).toFixed(1);
      const fill = colors[Math.floor(Math.random() * colors.length)];
      dots += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}" opacity="0.35"/>`;
    }

    // Vẽ từng ký tự với góc xoay ngẫu nhiên
    let chars = '';
    const charSpacing = (width - 24) / code.length;
    for (let i = 0; i < code.length; i++) {
      const char = code[i];
      const x = 16 + i * charSpacing + Math.floor(Math.random() * 6 - 3);
      const y = 27 + Math.floor(Math.random() * 6 - 3);
      const rotate = Math.floor(Math.random() * 30 - 15);
      const fontSize = 21 + Math.floor(Math.random() * 4);
      const color = colors[Math.floor(Math.random() * colors.length)];
      chars += `<text x="${x}" y="${y}" font-family="Arial, Helvetica, sans-serif" font-weight="bold" font-size="${fontSize}" fill="${color}" transform="rotate(${rotate}, ${x}, ${y})" text-anchor="middle">${char}</text>`;
    }

    return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" style="border-radius: 8px; user-select: none; display: block;">
      <defs>
        <linearGradient id="bg-${id}" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#f8fafc"/>
          <stop offset="100%" stop-color="#e2e8f0"/>
        </linearGradient>
      </defs>
      <rect width="${width}" height="${height}" rx="8" fill="url(#bg-${id})" stroke="#cbd5e1" stroke-width="1"/>
      ${lines}
      ${dots}
      ${chars}
    </svg>`;
  }
}
