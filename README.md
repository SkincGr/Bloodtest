# Εξετάσεις Αίματος (Next.js + Neon + Vercel)

## 1. Neon
1. Φτιάξε project στο https://neon.tech και αντίγραψε το connection string (pooled).
2. Αντίγραψε το `.env.example` σε `.env` και συμπλήρωσε:
   - `DATABASE_URL` – το connection string του Neon
   - `APP_PASSWORD` – ο κωδικός εισόδου στο site
   - `SESSION_SECRET` – τυχαίο string 32+ χαρακτήρων

## 2. Δημιουργία πινάκων και μεταφορά δεδομένων από το Access
```
npm install
npm run db:push     # δημιουργεί τους πίνακες στο Neon
npm run db:seed     # εισάγει τα δεδομένα από data/*.json (εξαγωγή του Access)
```

## 3. Τοπικά
```
npm run dev
```
Άνοιξε http://localhost:3000, μπες με τον `APP_PASSWORD` και ανέβασε ένα PDF.

## 4. Vercel
Ανέβασε το φάκελο σε GitHub repo, κάνε import στο Vercel και πρόσθεσε τα τρία env vars
(`DATABASE_URL`, `APP_PASSWORD`, `SESSION_SECRET`). Ο φάκελος `data/` είναι στο `.gitignore`
(ιατρικά δεδομένα) και δεν χρειάζεται στο Vercel.

## Έλεγχος parser
`npx tsx scripts/check-parser.ts` συγκρίνει τον parser με τα PDF στο `Pdfs\Completed` και τα δεδομένα του Access.
