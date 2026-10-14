-- Giới tính tài khoản: chỉ FEMALE được theo dõi chu kỳ. Tài khoản cũ để NULL, app hỏi một lần khi mở lại.
ALTER TABLE users ADD COLUMN gender text CHECK (gender IN ('MALE', 'FEMALE'));
