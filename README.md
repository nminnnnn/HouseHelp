# HouseHelp

HouseHelp la nen tang ket noi khach hang voi nguoi giup viec/vu nuoi.  
Repo hien tai gom:

- Frontend: React + Vite (`/`)
- Backend API: Node.js + Express + Socket.IO (`/backend`)
- Database: MySQL (seed bang `househelp.sql`)
- Chay dong bo bang Docker Compose (`docker-compose.yml`)

## 1) Yeu cau moi truong

### Cach 1 - Docker (khuyen dung de chay nhanh)

- Docker Desktop
- Docker Compose (di kem Docker Desktop)

### Cach 2 - Chay local thu cong

- Node.js 18+ (khuyen nghi 20+)
- MySQL 8.0
- npm

## 2) Chay bang Docker (de nhat)

Tu thu muc goc du an:

```bash
docker compose up --build
```

Sau khi chay:

- Frontend: `http://localhost:5173`
- Backend API: `http://localhost:5000`
- phpMyAdmin: `http://localhost:8080`

Dung he thong:

```bash
docker compose down
```

Neu muon xoa ca volume DB (reset du lieu):

```bash
docker compose down -v
```

**Dev nhanh (HMR tren may):** chi chay MySQL (+ phpMyAdmin) trong Docker, frontend/backend chay local:

```bash
docker compose -f docker-compose.db-only.yml up -d
```

Chi tiet `backend/.env` va cac buoc: xem **muc 2b** trong `RUN_GUIDE.md`.

## 3) Chay local khong dung Docker

### Buoc 1: Cai dependencies

Tai thu muc goc:

```bash
npm install
```

Tai thu muc backend:

```bash
cd backend
npm install
```

### Buoc 2: Khoi tao MySQL

- Tao database `househelp`
- Import file `househelp.sql` vao MySQL
- Cau hinh ket noi DB trong `backend/.env`:
  - `DB_HOST=localhost`
  - `DB_PORT=3306`
  - `DB_USER=...`
  - `DB_PASSWORD=...`
  - `DB_NAME=househelp`

### Buoc 3: Chay backend

Trong `backend/`:

```bash
node server.js
```

Backend se chay tai: `http://localhost:5000`

### Buoc 4: Chay frontend

Mo terminal moi, tai thu muc goc:

```bash
npm run dev
```

Frontend se chay tai: `http://localhost:5173`

## 4) Docker khac gi so voi `npm run dev` + backend local?

### Docker

- Tu dong dung len MySQL + Backend + Frontend cung luc
- Moi truong dong nhat tren moi may (it loi "chay may em duoc")
- DB duoc khoi tao tu `database/docker-init/01_schema.sql` roi `02_seed.sql` (sinh tu `househelp.sql` bang `node scripts/split-househelp-sql.mjs`)
- Khong can cai MySQL local

### Local (`npm run dev` + `node server.js`)

- Nhe hon va thuong debug frontend nhanh hon
- Ban phai tu quan ly MySQL local, import SQL va bien moi truong
- De gap loi sai cau hinh DB hoac khac version MySQL

## 5) Khi nao nen dung cach nao?

- Demo nhanh, onboarding team, tranh loi moi truong: dung **Docker**
- Dev UI/frontend hang ngay, can reload nhanh: dung **local**

## 6) Lenh nhanh hay dung

Tu goc du an:

```bash
# Frontend dev
npm run dev

# Build frontend
npm run build
```

Tu `backend/`:

```bash
# Chay API backend
node server.js
```

## 7) Luu y hien tai

- `backend/package.json` chua co script `start`/`dev`, nen backend dang chay bang `node server.js`.
- Neu ban go `npm server` se khong chay, vi chua co script ten `server`.
- Port backend dang hard-code `5000` trong `backend/server.js`.
