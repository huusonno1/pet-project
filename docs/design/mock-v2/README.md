# Mock giao diện v2 (đã chốt 2026-10-11)

Bản gốc sống: https://claude.ai/artifact/B1M9Zqr7viYzE3NeDHFTTz (canvas "Couple App · Mock v2").
Các file `.dc.html` ở đây là bản chép để code tham chiếu: mở bằng trình duyệt sẽ không chạy (cần runtime của canvas),
nhưng **mọi style là inline** nên đọc được chính xác màu, cỡ chữ, khoảng cách, bo góc và nội dung chữ.

| File | Màn | Route mobile (xem plan mobile) |
|---|---|---|
| `Main.dc.html` | A1 · Chào mừng | `/(auth)/index` |
| `A2-Dang-ky.dc.html` | A2 · Đăng ký | `/(auth)/sign-up` |
| `A2b-Dang-nhap.dc.html` | A2b · Đăng nhập | `/(auth)/sign-in` |
| `A3-Ghep-doi-Moi.dc.html` | A3 · Ghép đôi — Mời | `/(app)/pair?tab=invite` |
| `A4-Ghep-doi-Nhap-ma.dc.html` | A4 · Ghép đôi — Nhập mã | `/(app)/pair?tab=code` |
| `A5-Chon-ngay.dc.html` | A5 · Popup lịch trên A4 | sheet trong `pair` |
| `A6-Thanh-cong.dc.html` | A6 · Thành công | `/(app)/pair/success` |
| `A7-Ghep-doi-sau.dc.html` | A7 · Popup "Ghép đôi sau" | sheet trong `pair` |
| `A8-Trang-chu-solo.dc.html` | A8 · Trang chủ chưa ghép đôi | `/(app)/(tabs)/index` khi chưa có cặp |
| `A9-Tim-theo-ID.dc.html` | A9 · Tìm theo ID | `/(app)/pair/search` |
| `B1-Trang-chu.dc.html` | B1 · Trang chủ | `/(app)/(tabs)/index` |
| `B2-Thong-bao.dc.html` | B2 · Thông báo | `/(app)/notifications` |
| `B3-Loi-nhan.dc.html` | B3 · Lời nhắn | `/(app)/notes` |
| `C1-Camera.dc.html` | C1 · Camera | `/(app)/(tabs)/create` |
| `C2-Xem-truoc.dc.html` | C2 · Xem trước + hiệu ứng | `/(app)/create/preview` |
| `C3-Phan-loai.dc.html` | C3 · Phân loại | sheet trong `create/preview` |
| `C4-Form.dc.html` | C4 · Form mốc | `/(app)/create/milestone` và `/(app)/moments/[id]/edit` |
| `C5-Lap-lai.dc.html` | C5 · Popup lặp lại | sheet trong C4 |
| `C6-Ngay-gio.dc.html` | C6 · Popup ngày & giờ | sheet trong C4 |
| `C7-Chi-tiet.dc.html` | C7 · Chi tiết | `/(app)/moments/[id]` |
| `C8-Nhac-nho.dc.html` | C8 · Nhắc nhở | `/(app)/moments/[id]/reminders` |
| `C9-Khoanh-khac.dc.html` | C9 · Khoảnh khắc | `/(app)/create/moment` |
| `D1-Nhat-ky.dc.html` | D1 · Nhật ký lưới | `/(app)/(tabs)/journal` |
| `D2-Thang.dc.html` | D2 · Tháng | `/(app)/(tabs)/journal?view=month` |
| `D3-Nam.dc.html` | D3 · Năm | `/(app)/(tabs)/journal?view=year` |
| `D4-Chi-tiet-ngay.dc.html` | D4 · Chi tiết ngày | `/(app)/journal/[date]` |
| `E1-Nguoi-ay.dc.html` | E1 · Người ấy | `/(app)/(tabs)/partner` |
| `E1b-Nguoi-ay-chu-ky.dc.html` | E1b · Người ấy có chia sẻ chu kỳ | cùng route, có thẻ chu kỳ |
| `E2-Them-size.dc.html` | E2 · Popup thêm size | sheet trong partner |
| `E3-Them-mon.dc.html` | E3 · Popup thêm món | sheet trong partner |
| `F1-Toi.dc.html` | F1 · Tôi | `/(app)/(tabs)/me` |
| `F2-Thong-tin.dc.html` | F2 · Thông tin cá nhân | `/(app)/me/profile` |
| `F3-Chon-ngay-sinh.dc.html` | F3 · Popup ngày sinh | sheet trong F2 |
| `F4-Chu-ky.dc.html` | F4 · Theo dõi chu kỳ | `/(app)/me/cycle` |
| `TabBar.dc.html` | Tab bar dùng chung | `src/ui/TabBar.tsx` |
| `DatePicker.dc.html` | Popup lịch dùng chung | `src/ui/DatePickerSheet.tsx` |

**Token màu** (dùng ở mọi file): nền `#FFF8F3`, bề mặt `#FFFFFF`, nền phụ `#F6EEEA`, viền `#EADFD9`,
chữ `#2B1A2E`, chữ phụ `#6F5B6A`, hồng nhấn `#E9557A`, hồng đậm (nút, chữ hồng) `#C9365C`, hồng nhạt `#FFE6EC`,
cam nhạt `#FFEEDF` / mực cam `#B5562A`, tím nhạt `#EEEAFF` / mực tím `#5B4BC4`, xanh nhạt `#E3F5EC` / mực xanh `#24795A`,
đỏ chu kỳ `#D64545`. Font: Be Vietnam Pro 400/500/600/700/800.
