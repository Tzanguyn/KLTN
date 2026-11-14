/**
 * Khắc phục chuỗi lỗi font tiếng Việt (mojibake) do multer/busboy parse header UTF-8 bằng latin1.
 * Ví dụ: 'BÃ¡o cÃ¡o KLTN cá»§a t.docx' -> 'Báo cáo KLTN của t.docx'
 */
export function fixMojibake(str?: string | null): string {
  if (!str) return '';
  try {
    return decodeURIComponent(escape(str));
  } catch {
    return str;
  }
}
