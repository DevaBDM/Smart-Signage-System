## setup postgresql

```sql
-- In psql as postgres
CREATE DATABASE signage_test;
GRANT ALL PRIVILEGES ON DATABASE signage_test TO signage_admin;
\c signage_test
GRANT ALL ON SCHEMA public TO signage_admin;
ALTER DATABASE signage_test OWNER TO signage_admin;
```

## Database url

```bash
$env:DATABASE_URL="postgresql://signage_admin:yourpassword@localhost:5432/signage_test"
$env:TEST_DATABASE_URL="postgresql://signage_admin:yourpassword@localhost:5432/signage_test"
npx prisma migrate deploy
npx prisma db push
```

## Run test for backend

```bash
cd backend
npm test
npm run lint
```

## Run test for frontend

### Install playwright browser using

```bash
npx playwright install
```

```bash
cd frontend
npm run lint
npm test:e2e

```

# Baseline format

```bash
npm run format
```
