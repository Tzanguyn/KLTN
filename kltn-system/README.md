# HỆ THỐNG QUẢN LÝ KHÓA LUẬN TỐT NGHIỆP (KLTN)

> **Hệ thống Quản lý Khóa luận Tốt nghiệp Đại học toàn diện**, kiến trúc Monorepo hiện đại kết hợp **NestJS (Clean Architecture)** và **React 18+ (Vite + TypeScript + Tailwind CSS)**, hỗ trợ 4 vai trò độc lập: Sinh viên, Giảng viên, Trưởng bộ môn và Quản lý bộ môn.

---

## 📑 MỤC LỤC
1. [Kiến trúc & Công nghệ](#1-kiến-trúc--công-nghệ)
2. [Cấu trúc Monorepo](#2-cấu-trúc-monorepo)
3. [Tài khoản Demo & Kiểm thử nhanh](#3-tài-khoản-demo--kiểm-thử-nhanh)
4. [Hướng dẫn cài đặt & Khởi chạy](#4-hướng-dẫn-cài-đặt--khởi-chạy)
   - [Cách 1: Khởi chạy Local (Khuyến nghị cho Development)](#cách-1-khởi-chạy-local-development)
   - [Cách 2: Khởi chạy toàn bộ bằng Docker Compose](#cách-2-khởi-chạy-toàn-bộ-bằng-docker-compose)
5. [Cơ sở dữ liệu & Dữ liệu mẫu (Database & Seed)](#5-cơ-sở-dữ-liệu--dữ-liệu-mẫu)
6. [Ma trận phân quyền (RBAC Matrix) & 4 Không gian làm việc](#6-ma-trận-phân-quyền-rbac--4-không-gian-làm-việc)
7. [Bảo mật & Ràng buộc nghiệp vụ quan trọng](#7-bảo-mật--ràng-buộc-nghiệp-vụ-quan-trọng)
8. [Tài liệu API Swagger & Realtime Gateway](#8-tài-liệu-api-swagger--realtime-gateway)
9. [Kiểm thử tự động (Automated Integration Testing)](#9-kiểm-thử-tự-động)

---

## 1. KIẾN TRÚC & CÔNG NGHỆ

### Backend (NestJS 11 + TypeScript)
- **Framework:** NestJS tuân thủ triệt để Modules, Controllers, Services, Guards, Interceptors, Pipes, Custom Decorators.
- **ORM & Database:** PostgreSQL 16 kết hợp **Prisma ORM** (Schema-first, Typesafe queries).
- **Authentication & Security:** 
  - JWT kép: Short-lived Access Token (15 phút) + Long-lived Refresh Token (7 ngày) lưu trong cookie `HttpOnly`, `SameSite=lax`.
  - Mã hoá mật khẩu bằng `bcrypt`.
  - Bảo vệ tầng HTTP: `helmet`, `@nestjs/throttler` (Rate Limiting), `CORS` credentials.
  - Phân quyền động: `@Roles()` decorator + `RolesGuard` + `JwtAuthGuard`.
  - Quên mật khẩu: Ký token phục hồi 1-time sử dụng trong 15 phút.
- **Validation & Serialization:** `class-validator`, `class-transformer` kết hợp NestJS `ValidationPipe` whitelist.
- **File Storage:** `Multer` (NestJS FileInterceptor) kiểm soát MIME type (PDF, DOC/DOCX, PPTX, ZIP) và dung lượng tối đa 10 MB.
- **Realtime Notifications:** Socket.io gateway tại namespace `/notifications` với cơ chế room riêng tư theo User ID.
- **Reporting & Export:**
  - `ExcelJS`: Xuất danh sách đăng ký đề tài, tải trọng hướng dẫn/phản biện của giảng viên (.xlsx).
  - `PDFKit`: Xuất phiếu điểm bảo vệ khóa luận tốt nghiệp theo mẫu chuẩn quy chế đào tạo (.pdf).
- **API Documentation:** OpenAPI 3.0 với `@nestjs/swagger`.

### Frontend (React 18+ Vite + TypeScript)
- **Framework:** React 18, Vite 6, TypeScript 5.
- **Styling:** Tailwind CSS v4, Lucide React icons, giao diện responsive, dashboard trực quan cho từng vai trò.
- **State Management:** `Zustand` (lưu trữ phiên làm việc, hỗ trợ đồng bộ và khôi phục `localStorage`).
- **HTTP Client:** `Axios` cấu hình tự động gắn Bearer Token và hàng đợi Refresh Token khi nhận mã 401.
- **Realtime Client:** `socket.io-client` nhận thông báo tức thời và đếm thông báo chưa đọc.
- **1-Click Test Role Switcher:** Thanh điều hướng tích hợp bộ chuyển vai trò nhanh (Sinh viên, Giảng viên, Trưởng bộ môn, Quản lý).

---

## 2. CẤU TRÚC MONOREPO

```plaintext
kltn-system/
├── backend/                        # NestJS Application
│   ├── prisma/
│   │   ├── schema.prisma           # 20+ Enums & Models quan hệ toàn diện
│   │   ├── migrations/             # Lịch sử Prisma Migrations
│   │   ├── seed.ts                 # Script nạp dữ liệu mẫu ban đầu
│   │   └── kltn.sql                # File SQL xuất thô cho PostgreSQL / pgAdmin
│   ├── src/
│   │   ├── common/                 # Decorators (@Roles, @CurrentUser), Guards, Interceptors
│   │   └── modules/                # Auth, Users, Topics, Registrations, Progress,
│   │                               # Appointments, Defense, Scores, Notifications,
│   │                               # Evidence, Reports, Audit, Config
│   ├── test/
│   │   └── full-workflow.test.ts   # Integration Test bao phủ các kịch bản thực tế
│   └── Dockerfile
├── frontend/                       # React 18 Application
│   ├── src/
│   │   ├── components/
│   │   │   ├── ui/                 # Reusable UI Primitives (Button, Badge, Card, Modal, Input)
│   │   │   ├── workspaces/         # 4 Workspaces cho 4 Roles
│   │   │   │   ├── StudentWorkspace.tsx   # Không gian Sinh viên
│   │   │   │   ├── LecturerWorkspace.tsx  # Không gian Giảng viên
│   │   │   │   ├── HeadWorkspace.tsx      # Không gian Trưởng bộ môn
│   │   │   │   └── ManagerWorkspace.tsx   # Không gian Quản lý bộ môn
│   │   │   ├── Navbar.tsx          # Thanh tiêu đề, thông báo chuông, chuyển vai trò
│   │   │   └── LoginForm.tsx       # Đăng nhập, khôi phục mật khẩu, 1-click demo
│   │   ├── api.ts                  # Axios client với interceptor refresh token
│   │   ├── store.ts                # Zustand store cho User Session & Notifications
│   │   └── styles.css              # Tailwind CSS v4 tokens
│   └── Dockerfile
├── docker-compose.yml              # Quản lý dịch vụ Postgres, Backend, Frontend
└── package.json                    # Monorepo Scripts điều khiển toàn bộ dự án
```

---

## 3. TÀI KHOẢN DEMO & KIỂM THỬ NHANH

Hệ thống đã được nạp sẵn 4 tài khoản tiêu biểu đại diện cho 4 vai trò nghiệp vụ.

> 🔑 **Mật khẩu chung cho tất cả tài khoản:** `Password@123`

| Vai trò | Email đăng nhập | Mã số / Tên hiển thị | Quyền hạn chính |
| :--- | :--- | :--- | :--- |
| **SINH_VIEN** | `sinhvien@kltn.edu.vn` | `SV2026001` (Nguyễn Văn An) | Tra cứu đề tài, đề xuất đề tài, nộp tiến độ, nộp NCKH, xem điểm & tải PDF |
| **GIANG_VIEN** | `giangvien@kltn.edu.vn` | `GV001` (TS. Trần Văn Bình) | Ra đề tài, hướng dẫn nhóm, chấm tiến độ, nhập điểm, xin sửa điểm |
| **TRUONG_BO_MON** | `truongbomon@kltn.edu.vn` | `TBM001` (PGS. TS. Lê Hoàng Nam) | Duyệt đề tài, phân công phản biện, lập hội đồng, mở khoá điểm, duyệt NCKH |
| **QUAN_LY_BO_MON** | `quanly@kltn.edu.vn` | `QL001` (ThS. Phạm Thị Mai) | Mở đợt KLTN, quản lý danh sách đủ điều kiện, giám sát tiến độ, xuất Excel |

*(Mẹo: Tại trang Đăng nhập hoặc Thanh điều hướng trên cùng, bạn có thể click nút chuyển vai trò 1-click để kiểm tra tức thì mà không cần gõ mật khẩu).*

---

## 4. HƯỚNG DẪN CÀI ĐẶT & KHỞI CHẠY

### Yêu cầu tiên quyết
- **Node.js**: v20.x trở lên
- **Docker Desktop** (hoặc PostgreSQL 16 cục bộ)
- **NPM**: v10.x trở lên

---

### Cách 1: Khởi chạy Local (Development)

1. **Clone repository và cài đặt thư viện:**
   ```bash
   npm install
   ```

2. **Cấu hình file môi trường (.env):**
   Copy cấu hình mẫu cho Backend:
   ```bash
   # Windows PowerShell / CMD
   copy backend\.env.example backend\.env
   ```
   *Kiểm tra file `backend/.env` để đảm bảo kết nối DB trỏ đến port 5433:*
   ```env
   DATABASE_URL="postgresql://kltn:kltn_secret_2026@localhost:5433/kltn_app?schema=public"
   PORT=3000
   JWT_ACCESS_SECRET="kltn_super_secret_access_jwt_key_2026"
   JWT_REFRESH_SECRET="kltn_super_secret_refresh_jwt_key_2026"
   CORS_ORIGIN="http://localhost:5173"
   ```

3. **Khởi động PostgreSQL bằng Docker:**
   ```bash
   docker compose up -d postgres
   ```
   *(PostgreSQL sẽ lắng nghe tại cổng `5433` ngoài máy host, container chạy port `5432`).*

4. **Khởi tạo cơ sở dữ liệu và nạp dữ liệu mẫu:**
   ```bash
   npm run db:setup
   ```
   *Lệnh trên tự động chạy `prisma generate`, áp dụng migration và chạy seed data hoàn chỉnh.*

5. **Khởi động đồng thời Backend và Frontend:**
   ```bash
   npm run dev
   ```

- **Frontend:** [http://localhost:5173](http://localhost:5173)
- **Backend API:** [http://localhost:3000/api](http://localhost:3000/api)
- **Swagger Documentation:** [http://localhost:3000/docs](http://localhost:3000/docs)

---

### Cách 2: Khởi chạy toàn bộ bằng Docker Compose

Chỉ với 1 lệnh duy nhất để build và khởi chạy trọn gói PostgreSQL, Backend và Frontend:

```bash
docker compose up --build
```

- **Frontend:** [http://localhost:5173](http://localhost:5173)
- **Backend Swagger:** [http://localhost:3000/docs](http://localhost:3000/docs)
- Dữ liệu PostgreSQL được lưu trữ bền vững tại Docker volume `pgdata`.

---

## 5. CƠ SỞ DỮ LIỆU & DỮ LIỆU MẪU

### Quản lý Prisma Migrations
- Tạo migration mới: `npm run prisma:migrate --workspace backend`
- Cập nhật Prisma Client: `npm run prisma:generate --workspace backend`
- Nạp lại dữ liệu mẫu (Seed): `npm run prisma:seed --workspace backend`

### Nhập cơ sở dữ liệu bằng file SQL thô
File cấu trúc và dữ liệu thuần nằm tại `backend/prisma/kltn.sql`. Bạn có thể nạp trực tiếp qua `psql` hoặc `pgAdmin`:
```bash
# Qua psql:
createdb -U kltn -h localhost -p 5433 kltn_app
psql -U kltn -h localhost -p 5433 -d kltn_app -f backend/prisma/kltn.sql
```

---

## 6. MA TRẬN PHÂN QUYỀN (RBAC MATRIX) & 4 KHÔNG GIAN LÀM VIỆC

| STT | Chức năng nghiệp vụ | SINH_VIEN | GIANG_VIEN | TRUONG_BO_MON | QUAN_LY_BO_MON |
| :--- | :--- | :---: | :---: | :---: | :---: |
| 1 | Xem & Cập nhật hồ sơ cá nhân, đổi mật khẩu | ✅ | ✅ | ✅ | ✅ |
| 2 | Kiểm tra điều kiện làm KLTN (Tín chỉ, ĐTB, Nợ môn) | ✅ | ❌ | ❌ | ❌ |
| 3 | Xem danh mục đề tài đã duyệt & Đăng ký nhóm | ✅ | ❌ | ❌ | ❌ |
| 4 | Tự đề xuất đề tài mới với GVHD | ✅ | ❌ | ❌ | ❌ |
| 5 | Nộp báo cáo tuần, tài liệu tiến độ (Upload File) | ✅ | ❌ | ❌ | ❌ |
| 6 | Đặt lịch hẹn trao đổi với GVHD | ✅ | ✅ | ❌ | ❌ |
| 7 | Nộp minh chứng NCKH cộng điểm (Kèm link/file) | ✅ | ❌ | ❌ | ❌ |
| 8 | Tra cứu lịch bảo vệ, hội đồng, xem kết quả & tải PDF | ✅ | ❌ | ❌ | ❌ |
| 9 | Đăng ký & Quản lý đề tài đề xuất của GV | ❌ | ✅ | ❌ | ❌ |
| 10 | Duyệt nhóm sinh viên đăng ký đề tài của mình | ❌ | ✅ | ❌ | ❌ |
| 11 | Nhận xét tiến độ, đánh giá điều kiện bảo vệ giữa kỳ | ❌ | ✅ | ❌ | ❌ |
| 12 | Nhập điểm chi tiết theo tiêu chí (Tự tính điểm TB) | ❌ | ✅ | ❌ | ❌ |
| 13 | Gửi yêu cầu xin mở khoá sửa điểm | ❌ | ✅ | ❌ | ❌ |
| 14 | Thẩm định & Duyệt/Từ chối đề tài cấp bộ môn | ❌ | ❌ | ✅ | ❌ |
| 15 | Phân công Giảng viên phản biện (GVPB != GVHD) | ❌ | ❌ | ✅ | ❌ |
| 16 | Thành lập Hội đồng chấm & Xếp lịch bảo vệ | ❌ | ❌ | ✅ | ❌ |
| 17 | Phê duyệt yêu cầu mở khoá sửa điểm của GV | ❌ | ❌ | ✅ | ❌ |
| 18 | Thẩm định và duyệt minh chứng NCKH cộng điểm | ❌ | ❌ | ✅ | ❌ |
| 19 | Xem báo cáo tải trọng GV (Workload vs Quota) | ❌ | ❌ | ✅ | ❌ |
| 20 | Quản lý vòng đời học kỳ & Cấu hình thời hạn hệ thống | ❌ | ❌ | ❌ | ✅ |
| 21 | Quản lý danh sách sinh viên & Bật/Tắt điều kiện KLTN | ❌ | ❌ | ❌ | ✅ |
| 22 | Giám sát tiến độ toàn bộ các nhóm trong học kỳ | ❌ | ❌ | ❌ | ✅ |
| 23 | Xuất báo cáo thống kê kết quả ra file Excel (.xlsx) | ❌ | ❌ | ✅ | ✅ |

---

## 7. BẢO MẬT & RÀNG BUỘC NGHIỆP VỤ QUAN TRỌNG

1. **Chống xung đột quyền phản biện (Conflict Prevention):**
   - Hệ thống ngăn chặn tuyệt đối trường hợp Giảng viên hướng dẫn (GVHD) được phân công làm Giảng viên phản biện (GVPB) cho chính đề tài/nhóm của mình (Trả về lỗi `400 Bad Request` ngay tại Backend).
2. **Kiểm soát định mức hướng dẫn (Lecturer Quota):**
   - Giảng viên không thể nhận vượt số lượng nhóm KLTN tối đa quy định trong một học kỳ.
3. **Quy trình nhập & Khoá điểm an toàn:**
   - Điểm sau khi lưu và xác nhận sẽ bị khoá tự động. Muốn thay đổi, Giảng viên phải gửi yêu cầu (Score Change Request) kèm lý do giải trình; chỉ khi Trưởng bộ môn phê duyệt thì điểm mới được mở khoá.
4. **Token Refresh mượt mà:**
   - Axios Interceptor tự động bắt mã 401 khi Access Token hết hạn để gửi yêu cầu `/api/auth/refresh` bằng HttpOnly Cookie, làm mới phiên đăng nhập trong suốt mà không làm gián đoạn trải nghiệm người dùng.

---

## 8. TÀI LIỆU API SWAGGER & REALTIME GATEWAY

### Swagger UI tương tác
Truy cập [http://localhost:3000/docs](http://localhost:3000/docs) để xem đầy đủ thông số DTO, Request Body, Schema và Test trực tiếp các Endpoint.

### Quy chuẩn REST API Response
Tất cả endpoint trả về cấu trúc chuẩn thống nhất:
```json
{
  "success": true,
  "data": { ... },
  "message": "Thao tác thành công"
}
```

### Socket.io Realtime Notifications
- **Namespace:** `/notifications`
- **Kết nối & Tham gia phòng:**
  ```javascript
  const socket = io('http://localhost:3000/notifications');
  socket.emit('join', { userId: 'USER_UUID' });
  socket.on('notification', (payload) => {
    console.log('Thông báo mới:', payload);
  });
  ```

---

## 9. KIỂM THỬ TỰ ĐỘNG

Dự án tích hợp bộ kiểm thử tích hợp (End-to-End Integration Suite) bao phủ toàn bộ luồng nghiệp vụ cốt lõi:
- Kiểm tra đăng nhập thành công cho cả 4 vai trò.
- Kiểm tra bảo vệ RBAC Guard chặn truy cập trái phép (Mã 403).
- Kiểm tra kiểm tra điều kiện sinh viên (Eligibility Check).
- Kiểm tra tính toán báo cáo tải trọng giảng viên (Workload Report).
- Kiểm tra ràng buộc chống xung đột phản biện (GVHD !== GVPB).
- Kiểm tra xuất báo cáo định dạng Excel (MIME `spreadsheetml`).
- Kiểm tra toàn bộ vòng đời cấp lại mật khẩu (Forgot / Reset Password).

**Để thực thi kiểm thử:**
```bash
npm test
```
*Kết quả mẫu:*
```plaintext
Running full workflow integration test on port 49981...
1. Testing authentication for all 4 roles... -> PASSED
2. Testing RBAC restrictions... -> PASSED (403 Forbidden on unauthorized role)
3. Testing student eligibility check... -> PASSED
4. Testing lecturer workload reporting... -> PASSED
5. Testing reviewer conflict prevention... -> PASSED (400 Bad Request on supervisor as reviewer)
6. Testing Excel export endpoint... -> PASSED
7. Testing password reset flow... -> PASSED
ALL INTEGRATION CHECKS PASSED SUCCESSFULLY!
```

---

## 👨‍💻 TÁC GIẢ & BẢN QUYỀN
Hệ thống được phát triển theo tiêu chuẩn đồ án tốt nghiệp cử nhân / kỹ sư CNTT chất lượng cao.
Mọi thắc mắc và đóng góp xin gửi về qua hệ thống Issue của dự án.
