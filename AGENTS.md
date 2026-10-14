# Hướng dẫn cho AI agent

Couple App — monorepo: `backend/` (Spring Boot 3.5, Java 21) và `mobile/` (Expo, React Native, TypeScript).
Thiết kế: `docs/superpowers/specs/2026-10-10-couple-app-design.md`. Cách chạy dev: `README.md`.

## Git Flow — BẮT BUỘC

Tuân thủ toàn bộ **`docs/GIT_FLOW.md`**. Tóm tắt:

- Bật hook nếu chưa bật: `git config core.hooksPath .githooks` (hook chặn commit/push sai quy tắc — không dùng `--no-verify`).
- **Không** commit hay push trực tiếp lên `main`/`develop`. Bắt đầu việc mới: `git switch -c feature/<tên> develop`
  (sửa lỗi: `bugfix/<tên>`; phát hành: `release/x.y.z`; sửa gấp bản đã phát hành: `hotfix/x.y.z` từ `main`).
- Commit theo Conventional Commits: `<type>(<scope>): <mô tả tiếng Việt>` — VD `fix(mobile): sửa lỗi bàn phím che ô nhập`.
- Trước khi commit: backend `./mvnw test`, mobile `npx tsc --noEmit && npx jest` phải xanh.
- Commit xong thì push nhánh của mình: `git push -u origin <nhánh>`.
- Chỉ merge/tag/xoá nhánh khi người dùng yêu cầu; merge qua Pull Request (`gh pr create --base develop`).
