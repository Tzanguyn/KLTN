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

/**
 * Chuẩn hóa và nối học hàm / học vị với họ tên giảng viên.
 * Tránh triệt để lỗi dấu chấm kép (..) như 'ThS.. Bùi Văn Đồng', 'PGS. TS.. Lê Thị Trưởng', 'TS.. Nguyễn Thị Thanh Bình'.
 * Ví dụ:
 * formatLecturerName('ThS.', 'Bùi Văn Đồng') -> 'ThS. Bùi Văn Đồng'
 * formatLecturerName('ThS..', 'Bùi Văn Đồng') -> 'ThS. Bùi Văn Đồng'
 * formatLecturerName('PGS. TS.', 'Lê Thị Trưởng') -> 'PGS. TS. Lê Thị Trưởng'
 * formatLecturerName('TS.', 'Nguyễn Thị Thanh Bình') -> 'TS. Nguyễn Thị Thanh Bình'
 * formatLecturerName('', 'Bùi Văn Đồng') -> 'Bùi Văn Đồng'
 */
export function formatLecturerName(title?: string | null, fullName?: string | null): string {
  const name = (fullName || '').trim();
  if (!name) return '';
  if (!title) return name;

  let cleanTitle = title.trim();
  if (!cleanTitle) return name;

  // Xóa mọi dấu chấm kép/thừa ở đuôi: vd 'ThS..' -> 'ThS', 'PGS. TS..' -> 'PGS. TS'
  cleanTitle = cleanTitle.replace(/\.+$/, '');

  // Chuẩn hóa dấu chấm cho học hàm/học vị (trừ từ viết tắt như 'GV')
  if (cleanTitle.toLowerCase() !== 'gv') {
    cleanTitle = `${cleanTitle}.`;
  }

  // Nếu trong tên đã chứa sẵn học vị ở đầu, trả về tên để tránh lặp
  if (name.toLowerCase().startsWith(cleanTitle.toLowerCase())) {
    return name;
  }

  return `${cleanTitle} ${name}`;
}

/**
 * Loại bỏ dấu tiếng Việt để phục vụ tìm kiếm không phân biệt dấu.
 * Ví dụ: 'Nguyễn Văn A' -> 'Nguyen Van A'
 */
export function removeVietnameseTones(str?: string | null): string {
  if (!str) return '';
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D');
}

/**
 * Chuẩn hóa tên nhóm khóa luận, khắc phục lỗi cắt cụt giữa từ không có dấu '...'
 * Ví dụ: 'Nhóm Phân tích dữ liệu ứng dụng trong bài toán dự ' -> 'Nhóm Phân tích dữ liệu ứng dụng trong bài toán dự đoán.'
 */
export function formatGroupName(name?: string | null, topicTitle?: string | null): string {
  if (!name) return topicTitle ? `Nhóm ${topicTitle.trim()}` : 'Nhóm KLTN';
  const cleanName = name.trim();

  // Khôi phục tên đầy đủ nếu bị cắt giữa từ do chuỗi ban đầu
  if (topicTitle) {
    const cleanTopic = topicTitle.trim();
    const prefix = 'Nhóm ';
    const coreName = cleanName.startsWith(prefix) ? cleanName.substring(prefix.length).trim() : cleanName;
    if (cleanTopic.startsWith(coreName) && coreName.length < cleanTopic.length) {
      if (cleanTopic.length <= 75) {
        return `${prefix}${cleanTopic}`;
      }
      let truncated = cleanTopic.substring(0, 72);
      const lastSpace = truncated.lastIndexOf(' ');
      if (lastSpace > 20) truncated = truncated.substring(0, lastSpace);
      return `${prefix}${truncated.trim()}...`;
    }
  }

  // Đảm bảo có dấu '...' nếu chuỗi bị cắt lỡ cỡ
  if (cleanName.startsWith('Nhóm ') && cleanName.length >= 35 && !cleanName.endsWith('...') && !cleanName.endsWith('.')) {
    return `${cleanName}...`;
  }

  return cleanName;
}

