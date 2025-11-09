# whoiscekki.cz

A secure file sharing and management platform with user authentication, file uploads, and sharing capabilities.

## Features

### User Management
- 👥 Multiple user roles: user, admin, headadmin
- 🔑 Invitation-based registration (token or email invite)
- ✉️ Email verification (SMTP)
- 🔒 Session-based authentication with JWT
- 🔐 Optional Two-Factor Authentication (2FA) via TOTP (Google Authenticator)
- 🔄 Account lockout after multiple failed login attempts
- 🔑 Strong password hashing with bcrypt

### File Management
- ☁️ Personal cloud storage (any file type, up to 2GB per file)
- 🔗 Share files via public links
- ⏳ Set link expiration dates
- 🔐 Password-protect shared links
- 📁 Organize files in folders
- 🔍 Search functionality

### Admin Features
- 👑 HeadAdmin panel
- 👥 User management (create, edit, delete users)
- 📊 System statistics
- 📨 Invitation management
- 🔄 User impersonation
- ⚙️ System settings

### Additional Features
- 🎮 Clicker Game with persistent high scores
- 🌓 Dark/Light mode
- 📱 Responsive design (works on mobile & desktop)
- 🚀 Fast and efficient file handling
- 🔄 Real-time updates

## Tech Stack

### Backend
- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: SQLite (with sqlite3)
- **Templating**: EJS
- **Authentication**: Passport.js, JWT
- **Email**: Nodemailer
- **File Processing**: Multer, FFmpeg
- **Security**: Helmet, CORS, rate limiting
- **2FA**: speakeasy

### Frontend
- **CSS Framework**: Bootstrap 5, W3CSS
- **Icons**: Bootstrap Icons
- **JavaScript**: Vanilla JS with modern ES6+ features
- **Responsive Design**: Mobile-first approach

## Project Structure

```
src/
├── config/           # Configuration files
│   ├── auth.js      # Authentication settings
│   ├── db.js        # Database configuration
│   └── index.js     # Main config
├── controllers/      # Route controllers
│   ├── adminController.js
│   ├── authController.js
│   ├── clickerController.js
│   └── fileController.js
├── middleware/       # Custom middleware
│   ├── auth.js      # Authentication middleware
│   ├── admin.js     # Admin access control
│   └── rateLimit.js # Rate limiting
├── models/          # Database models
│   ├── User.js
│   ├── File.js
│   └── Invite.js
├── routes/          # Route definitions
│   ├── auth.js
│   ├── admin.js
│   └── files.js
├── public/          # Static files
│   ├── css/        # CSS styles
│   ├── js/         # Client-side JavaScript
│   └── images/     # Static images
├── uploads/         # User uploaded files
└── views/           # EJS templates
    ├── auth/       # Authentication views
    ├── admin/      # Admin panel views
    └── files/      # File management views
```

## Environment Configuration

Create a `.env` file in the project root with the following variables:

```env
# Server Configuration
NODE_ENV=development
PORT=3000
BASE_URL=http://localhost:3000

# Session & Security
JWT_SECRET=your_jwt_secret_here

# Database
DATABASE_URL=sqlite:./data/app.db

# Email Configuration (SMTP)
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_SECURE=false  # true for 465, false for other ports
SMTP_USER=your_email@example.com
SMTP_PASS=your_email_password
SMTP_FROM='"WhoIsCekki" <noreply@whoiscekki.cz>'

# File Uploads
UPLOAD_DIR=./src/uploads
MAX_FILE_SIZE=2147483648  # 2GB in bytes
ALLOWED_FILE_TYPES=*/*    # or specify MIME types: image/*,application/pdf,...

# Security
RATE_LIMIT_WINDOW_MS=900000  # 15 minutes
RATE_LIMIT_MAX_REQUESTS=100
LOGIN_ATTEMPTS=5
LOCKOUT_TIME=15  # minutes

```

## Installation

### Prerequisites
- Node.js (v18 or higher)
- npm (v9 or higher)
- SQLite3

### Setup Steps

1. **Clone the repository:**
   ```bash
   git clone https://github.com/yourusername/whoiscekki.cz.git
   cd whoiscekki.cz
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Set up environment variables:**
   - Copy `.env.example` to `.env`
   - Update the values in `.env` with your configuration

4. **Initialize the database:**
   ```bash
   node src/utils/initDb.js
   ```
   This will create the necessary tables and the first admin user if it doesn't exist.

5. **Start the application:**
   ```bash
   npm start
   ```
   The application will be available at `http://localhost:3000`

6. **Access the admin panel:**
   - Go to `/admin`
   - Log in with the default admin credentials from your `.env` file
   - Change the default password immediately

## Development

### Available Scripts

- `npm start` - Start the application in production mode
- `npm run dev` - Start in development mode with nodemon
- `npm run build:css` - Build CSS from source files
- `npm test` - Run tests (to be implemented)

### File Upload Configuration

- Files are stored in the `src/uploads` directory
- Each user gets their own subdirectory
- File uploads are limited to 2GB by default (configurable in `.env`)
- All uploaded files are scanned for viruses if ClamAV is installed

## Security Best Practices

1. **Always use HTTPS in production**
2. Keep dependencies up to date (`npm audit`)
3. Use strong passwords and enable 2FA for admin accounts
4. Regularly backup your database
5. Monitor server logs for suspicious activity
6. Keep your server's operating system updated
7. Use a reverse proxy (Nginx/Apache) in production
8. Set proper file permissions

## Troubleshooting

### Email Not Sending
- Verify SMTP settings in `.env`
- Check spam folder
- Test SMTP settings with a simple Node.js script

### File Upload Issues
- Check `UPLOAD_DIR` permissions
- Verify `MAX_FILE_SIZE` in `.env`
- Ensure enough disk space is available

### Database Issues
- Check if SQLite database file exists and is writable
- Run database migrations if applicable
- Check logs for SQL errors

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

For support, please open an issue in the GitHub repository or contact the maintainers.

---

*Last updated: November 2025*
