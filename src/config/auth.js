require('dotenv').config();

module.exports = {
  google: {
    clientID: process.env.GOOGLE_CLIENT_ID || 'your_google_client_id_here',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || 'your_google_client_secret_here',
    callbackURL: process.env.GOOGLE_CALLBACK_URL || 'http://localhost:3000/auth/google/callback'
  },
  github: {
    clientID: process.env.GITHUB_CLIENT_ID || 'your_github_client_id_here',
    clientSecret: process.env.GITHUB_CLIENT_SECRET || 'your_github_client_secret_here',
    callbackURL: process.env.GITHUB_CALLBACK_URL || 'http://localhost:3000/auth/github/callback',
    scope: ['user:email']
  },
  session: {
    secret: process.env.JWT_SECRET || 'your_jwt_secret_here',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: process.env.NODE_ENV === 'production' }
  }
};
