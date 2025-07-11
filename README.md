# WhoisCekki.cz

A secure cloud and admin system with invitation-only registration, 2FA, file sharing, and more. Built with Node.js, Express, MongoDB, EJS, and Bootstrap.

## Features

- User roles: user, admin, headadmin
- Invitation-based registration (token or email invite)
- Email activation (SMTP)
- JWT + session authentication
- Optional 2FA (TOTP, Google Authenticator)
- Account lockout after failed logins
- Strong password hashing (bcrypt)
- Personal cloud: upload (any type, up to 2GB), download, delete
- File sharing via public links (optional password, expiration)
- Admin panel: manage users, roles, invites, impersonation
- Clicker Game (public, persistent score)
- Responsive UI (Bootstrap, dark/light mode)
- Toast notifications, form validation
- Security: HTTPS-ready, rate limiting, helmet, CORS

## Project Structure

```
src/
  config/         # DB and app config
  controllers/    # Route logic
  models/         # Mongoose schemas
  routes/         # Express routes
  utils/          # Helpers (e.g. headadmin init)
  views/          # EJS templates
  public/         # Static files (CSS, JS)
  uploads/        # User files
```

## .env Example

Create a `.env` file in `src/` with:

```
PORT=3000
MONGO_URI=mongodb://localhost/whoiscekki
JWT_SECRET=supersecretkey
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=no-reply@example.com
SMTP_PASS=smtpPassword
UPLOAD_LIMIT=2147483648
DEFAULT_ADMIN_EMAIL=cekki@proton.me
DEFAULT_ADMIN_PASS=T@d1nUwU
```

## Running the Project

1. Install dependencies:
   ```
   npm install
   ```
2. Set up your `.env` file as above.
3. Start MongoDB locally or use a remote URI.
4. Start the server:
   ```
   node src/server.js
   ```
5. Visit [http://localhost:3000](http://localhost:3000)

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

## Note on `middleware/`

The `middleware/` folder is present for future custom middleware (e.g. authentication, authorization, error handling). In this version, most logic is handled in controllers or via built-in Express middleware, but you can add custom middleware here for advanced use cases.

---

MIT License
