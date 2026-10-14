# Git Flow — quy tắc bắt buộc

Áp dụng cho **mọi người và mọi AI agent** (Claude Code, Codex, Cursor, Copilot…) làm việc trong repo này.
Hook trong `.githooks/` kiểm tra tự động; bật một lần sau khi clone: `git config core.hooksPath .githooks`.

## 1. Nhánh

| Nhánh | Tạo từ | Merge vào | Dùng cho |
|---|---|---|---|
| `main` | — | — | Code đã phát hành. **Không commit/push trực tiếp.** Mỗi lần merge gắn tag `vX.Y.Z`. |
| `develop` | `main` | — | Nhánh tích hợp, luôn chạy được. **Không commit/push trực tiếp.** |
| `feature/<tên>` | `develop` | `develop` | Tính năng mới. VD `feature/ui-v2`, `feature/date-places-map` |
| `bugfix/<tên>` | `develop` | `develop` | Sửa lỗi chưa phát hành. VD `bugfix/keyboard-covers-input` |
| `release/<x.y.z>` | `develop` | `main` **và** `develop` | Chốt bản phát hành: chỉ sửa lỗi nhỏ, đổi version, changelog |
| `hotfix/<x.y.z>` | `main` | `main` **và** `develop` | Sửa gấp lỗi trên bản đã phát hành |

- `<tên>`: chữ thường, số, gạch ngang (kebab-case), tiếng Anh không dấu, ngắn gọn.
- Merge vào `develop`/`main` qua **Pull Request** trên GitHub (`--no-ff`), không merge local rồi push.
- Xong việc → xoá nhánh feature/bugfix (local + remote) sau khi PR được merge.

## 2. Commit — Conventional Commits

```
<type>(<scope>): <mô tả>

[thân — tuỳ chọn: vì sao thay đổi]

[footer — tuỳ chọn: BREAKING CHANGE: …, Co-Authored-By: …]
```

- `type`: `feat` · `fix` · `docs` · `style` · `refactor` · `perf` · `test` · `build` · `ci` · `chore` · `revert`
- `scope` (nên có): `backend` · `mobile` · hoặc module (`auth`, `moment`, `media`, `couple`…)
- Mô tả: tiếng Việt có dấu, viết thường đầu câu, không dấu chấm cuối, dòng đầu ≤ 100 ký tự.
- Thay đổi phá vỡ tương thích: thêm `!` (`feat(backend)!: …`) và footer `BREAKING CHANGE:`.
- Mỗi commit một thay đổi logic; không gộp việc không liên quan; không commit file bí mật (`.env`, key).

Ví dụ: `fix(mobile): bàn phím không che ô nhập ở sheet` · `feat(backend): lời mời ghép đôi theo ID`

## 3. Trước khi commit / push

- Backend đổi → `cd backend && ./mvnw test` xanh.
- Mobile đổi → `cd mobile && npx tsc --noEmit && npx jest` xanh.
- Không `--no-verify`, không `push --force` lên nhánh dùng chung (`main`, `develop`, `release/*`).
  Nhánh riêng của mình nếu buộc phải viết lại lịch sử thì dùng `--force-with-lease`.

## 4. Quy tắc riêng cho AI agent

1. **Trước khi sửa code**: đang ở `main`/`develop` → tạo nhánh đúng loại từ `develop` (`git switch -c feature/<tên> develop`).
   Đang ở nhánh feature/bugfix đúng việc → làm tiếp trên đó.
2. **Commit** theo mục 2 sau mỗi phần việc hoàn chỉnh và đã qua kiểm tra mục 3.
3. **Push** nhánh của mình lên `origin` sau khi commit (`git push -u origin <nhánh>`).
4. **Không tự** merge vào `develop`/`main`, tạo tag, hay xoá nhánh của người khác — chỉ làm khi người dùng yêu cầu.
   Khi được yêu cầu merge: tạo PR (`gh pr create --base develop`) thay vì merge local.
5. Hook báo lỗi → sửa cho đúng quy tắc, **không** bỏ qua hook.

## 5. Phát hành

```bash
git switch -c release/1.0.0 develop     # chốt version, sửa lỗi nhỏ
# PR release/1.0.0 → main, merge, rồi:
git tag -a v1.0.0 -m "v1.0.0" && git push origin v1.0.0
# PR release/1.0.0 → develop để mang các sửa lỗi về
```

Hotfix giống vậy nhưng tạo từ `main` (`hotfix/1.0.1`).
