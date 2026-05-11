# HouseHelp Run Guide

Tai lieu nay la checklist thuc hanh nhanh de chay project HouseHelp trong cac truong hop thuong gap.

## 1) Chon cach chay

- Neu muon nhanh, it loi moi truong: dung Docker (stack day du — muc 2).
- Neu muon **sua code + HMR/F5 ngay**, khong rebuild image: **Docker chi MySQL (+ phpMyAdmin), FE/BE chay tren may** — muc **2b**.
- Neu da co MySQL local (XAMPP, v.v.): chi can backend + frontend tren may — muc 3.

---

## 2b) Dev nhanh: Docker chi MySQL (+ phpMyAdmin), frontend/backend tren may

Phu hop khi ban da cai **Node.js** tren Windows va muon debug/giao dien phan hoi tuc thi.

### Yeu cau

- Docker Desktop
- Node.js + npm (LTS khuyen dung)

### Buoc 1: Dung stack Docker day du neu dang chay

Cung ten container `househelp-mysql` — chi chay **mot** trong hai cach.

```bash
cd D:\HouseHelp\HouseHelp
docker compose down
```

### Buoc 2: (Neu can) Tao lai file init DB sau khi sua `househelp.sql`

```bash
node scripts/split-househelp-sql.mjs
```

### Buoc 3: Chi chay MySQL + phpMyAdmin

```bash
docker compose -f docker-compose.db-only.yml up -d
```

Doi vai lan dau / DB trong: `docker compose -f docker-compose.db-only.yml down -v` roi lenh `up -lai` (xoa volume — **mat het du lieu DB**).

### Buoc 4: Cau hinh `backend/.env` (ket noi toi container MySQL)

Mac dinh port **3306**, mat khau root giong Docker day du: `househelp_secret`.

```env
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=root
DB_PASSWORD=househelp_secret
DB_NAME=househelp
```

Neu trong file `.env` o goc project ban dat `MYSQL_PORT=3307` (tranh trung MySQL Windows), dat **cung gia tri** cho `DB_PORT` va khi chay compose them bien:

```bash
set MYSQL_PORT=3307
docker compose -f docker-compose.db-only.yml up -d
```

(PowerShell: `$env:MYSQL_PORT=3307`)

### Buoc 5: Backend tren may

```bash
cd D:\HouseHelp\HouseHelp\backend
npm install
node server.js
```

(Tuy chon: `node --watch server.js` de tu restart khi sua `server.js`.)

### Buoc 6: Frontend tren may (terminal moi)

```bash
cd D:\HouseHelp\HouseHelp
npm install
npm run dev
```

### Buoc 7: Mo trinh duyet

| Thu | Dia chi |
|-----|---------|
| Frontend (Vite) | http://localhost:5173 |
| API | http://localhost:5000 |
| phpMyAdmin | http://localhost:8080 (user `root`, password nhu `MYSQL_ROOT_PASSWORD`) |

### Buoc 8: Dung chi DB (khi xong)

```bash
cd D:\HouseHelp\HouseHelp
docker compose -f docker-compose.db-only.yml down
```

---

## 2) Cach A - Chay bang Docker (khuyen dung)

### Buoc 1: Mo terminal tai thu muc project

```bash
cd D:\HouseHelp\HouseHelp
```

### Buoc 2: Dung stack cu (neu co)

```bash
docker compose down
```

### Buoc 3: Build + run

```bash
docker compose up --build
```

### Buoc 4: Truy cap

- Frontend: `http://localhost:5173`
- Backend API: `http://localhost:5000`
- phpMyAdmin (container): `http://localhost:8080`

### Buoc 5: Dung he thong

```bash
docker compose down
```

### Reset du lieu DB (can than)

```bash
docker compose down -v
docker compose up --build
```

---

## 3) Cach B - Chay local (khong Docker)

## 3.1 Database

Ban can 1 MySQL server dang chay (XAMPP MySQL hoac MySQL service tren Windows).

### Kiem tra port dang dung

```bash
netstat -ano | findstr :3306
```

- Neu XAMPP MySQL bi trung 3306 voi `MySQL80`, doi XAMPP sang `3307`.

### Neu dung XAMPP MySQL 3307

- Sua `my.ini` cua XAMPP MySQL thanh `port=3307`
- Restart MySQL trong XAMPP

## 3.2 Cau hinh backend

File: `backend/.env`

Vi du neu dung XAMPP 3307:

```env
DB_HOST=127.0.0.1
DB_PORT=3307
DB_USER=root
DB_PASSWORD=
DB_NAME=househelp
```

Vi du neu dung MySQL service 3306:

```env
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_password_here
DB_NAME=househelp
```

## 3.3 Import SQL

- Tao database `househelp`
- Import file `househelp.sql` vao DB (file day du DDL + seed; la nguon chinh)

CLI:

```bash
mysql -h 127.0.0.1 -P 3307 -u root -p -e "CREATE DATABASE IF NOT EXISTS househelp;"
mysql -h 127.0.0.1 -P 3307 -u root -p househelp < househelp.sql
```

### Docker: hai buoc schema + seed

- `docker-compose.yml` mount `database/docker-init/01_schema.sql` roi `02_seed.sql` (MySQL chay theo thu tu ten file).
- Sau khi sua `househelp.sql`, tao lai hai file do:

```bash
cd D:\HouseHelp\HouseHelp
node scripts/split-househelp-sql.mjs
```

### Mat khau (bcrypt)

- Backend dung `bcryptjs` cho dang ky moi.
- Du lieu mau trong SQL van dung SHA256; dang nhap dung mat khau van thanh cong va server tu ghi lai hash bcrypt (tuong thich nguoc).

## 3.4 Chay backend

```bash
cd D:\HouseHelp\HouseHelp\backend
npm install
node server.js
```

Neu thanh cong se thay log:
- `MySQL Connected!`
- `Server running on port 5000 ...`

## 3.5 Chay frontend

Mo terminal moi:

```bash
cd D:\HouseHelp\HouseHelp
npm install
npm run dev
```

Frontend chay tai `http://localhost:5173`.

---

## 4) Loi thuong gap va cach xu ly

### Loi: `'vite' is not recognized`

Nguyen nhan: chua cai dependencies frontend.

Fix:

```bash
cd D:\HouseHelp\HouseHelp
npm install
npm run dev
```

### Loi: `Cannot find module 'dotenv'`

Nguyen nhan: chua cai dependencies backend.

Fix:

```bash
cd D:\HouseHelp\HouseHelp\backend
npm install
node server.js
```

### Loi: `Access denied for user 'root'@'localhost'`

Nguyen nhan: sai user/password/port DB.

Fix:
- Kiem tra `backend/.env` dung port dung password
- Dam bao DB dang chay va co database `househelp`

### Loi XAMPP MySQL: `Bind on TCP/IP port 3306`

Nguyen nhan: co service khac dang chiem 3306 (thuong la `MySQL80`).

Fix:
- Doi XAMPP MySQL sang 3307 (khuyen dung de khong anh huong du an cu)
- Hoac stop service `MySQL80` bang quyen Administrator

---

## 5) Khuyen nghi su dung on dinh

- Dev thuong ngay: local (`node server.js` + `npm run dev`)
- Demo/ban giao: Docker
- De tranh anh huong du an cu:
  - Giu `MySQL80` o 3306
  - HouseHelp dung XAMPP 3307 hoac Docker

---

## 6) Quick checklist truoc khi code

- [ ] DB dang chay dung port
- [ ] `backend/.env` dung host/port/user/password
- [ ] Da import `househelp.sql` (local) hoac da `docker compose down -v` + build lai sau khi doi SQL (Docker)
- [ ] Backend chay khong bao `ER_ACCESS_DENIED_ERROR`
- [ ] Frontend mo duoc `http://localhost:5173`

