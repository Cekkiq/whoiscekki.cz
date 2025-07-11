# WhoisCekki.cz

A secure, minimalist cloud and admin system with invitation-only registration, 2FA, file sharing, and a modern UI. Built with Node.js, Express, EJS, Bootstrap, and SQLite.

## Features

- User roles: user, admin, headadmin
- Invitation-based registration (token or email invite)
- Email activation (SMTP)
- Session authentication (with JWT secret for session)
- Optional 2FA (TOTP, Google Authenticator)
- Account lockout after failed logins
- Strong password hashing (bcrypt)
- Personal cloud: upload, download, delete files (any type, up to 2GB)
- File sharing via public links (optional password, expiration)
- Admin panel: manage users, roles, invites, impersonation
- Clicker Game (public, persistent score)
- Responsive, minimalist UI (Bootstrap 5, W3CSS, dark mode)
- Security: HTTPS-ready, rate limiting, helmet, CORS

## Tech Stack

- Node.js, Express
- EJS (server-side templates)
- Bootstrap 5, W3CSS
- SQLite (via sqlite3)
- Nodemailer (SMTP email)
- bcrypt, speakeasy (2FA)

## Project Structure

```
src/
  config/         # DB and app config
  controllers/    # Route logic
  middleware/     # Auth, admin, login-required
  models/         # Data models (SQLite)
  routes/         # Express routes
  utils/          # Helpers (DB, headadmin init)
  views/          # EJS templates
  public/         # Static files (CSS)
  uploads/        # User files
```

## Example .env

Create a `.env` file in the project root:

```
PORT=3000
JWT_SECRET=supersecretkey
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=no-reply@example.com
SMTP_PASS=smtpPassword
SMTP_SECURE=false
UPLOAD_LIMIT=2147483648
DEFAULT_ADMIN_EMAIL=admin@example.com
DEFAULT_ADMIN_PASS=yourStrongPassword
SQLITE_PATH=./data/app.db
```

- `DEFAULT_ADMIN_EMAIL` and `DEFAULT_ADMIN_PASS` are used to create the first headadmin on first run.
- `SQLITE_PATH` is optional (defaults to `./data/app.db`).

## Setup & Usage

1. **Install dependencies:**
   ```sh
   npm install
   ```
2. **Create your `.env` file** (see above).
3. **Run the server:**
   ```sh
   node src/server.js
   ```
4. **Visit** [http://localhost:3000](http://localhost:3000)

- On first run, a headadmin account is created using the credentials from `.env`.
- Use the admin panel to manage users, invites, and files.

## SMTP Setup

- Use any SMTP provider (Mailgun, Gmail SMTP, custom)
- Make sure SMTP credentials in `.env` are correct
- Used for account activation, password reset, invites, notifications

## Security

- Passwords are hashed (bcrypt)
- 2FA (TOTP) optional per user
- Rate limiting and account lockout after failed logins
- Email verification required
- HTTPS recommended for production
- Sensitive files and folders are ignored via `.gitignore`

## License

MIT
