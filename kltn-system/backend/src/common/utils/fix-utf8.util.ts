/**
 * Xử lý chuỗi tên file bị lỗi font (mojibake) do Multer/Busboy mặc định decode header multipart là ISO-8859-1 (Latin-1).
 * Ví dụ: 'BÃ¡o cÃ¡o KLTN cá»§a t.docx' -> 'Báo cáo KLTN của t.docx'
 */
export function fixUtf8Mojibake(str?: string | null): string {
  if (!str) return '';
  try {
    const decoded = Buffer.from(str, 'latin1').toString('utf8');
    if (!decoded.includes('\uFFFD') && decoded !== str) {
      return decoded;
    }
  } catch {}
  return str;
}
