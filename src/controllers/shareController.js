const File = require('../models/File');
const db = require('../config/db');
const path = require('path');
const fs = require('fs').promises;
const clamavService = require('../services/clamavService');

class ShareController {
    async getSharedFile(token) {
        return new Promise((resolve, reject) => {
            db.get(
                'SELECT f.* FROM files f WHERE f.shared_publicToken = ?',
                [token],
                async (err, file) => {
                    if (err) return reject(err);
                    if (!file) return resolve(null);
                    
                    if (file.shared_expiresAt && new Date(file.shared_expiresAt) < new Date()) {
                        return resolve({ expired: true, file });
                    }
                    
                    resolve({ file });
                }
            );
        });
    }

    async verifyPassword(hashedPassword, password) {
        if (!hashedPassword) return true; 
        if (!password) return false;
        
        return bcrypt.compare(password, hashedPassword);
    }

    async scanAndDownloadFile(filePath, res) {
        try {
            const scanResult = await clamavService.scanFile(filePath);
            
            if (scanResult.isInfected) {
                return {
                    error: 'This file has been flagged as potentially harmful and cannot be downloaded.',
                    infected: true,
                    viruses: scanResult.viruses
                };
            }

            return { success: true };
        } catch (error) {
            console.error('Error scanning file:', error);
            return { error: 'Error scanning file for viruses. Please try again later.' };
        }
    }

    async getSharePage(req, res) {
        try {
            const { token } = req.params;
            const { password } = req.body;
            
            const result = await this.getSharedFile(token);
            
            if (!result) {
                return res.status(404).render('share/not-found', { 
                    title: 'File Not Found',
                    message: 'The requested file could not be found or has been removed.'
                });
            }
            
            if (result.expired) {
                return res.status(410).render('share/error', { 
                    title: 'Link Expired',
                    message: 'This sharing link has expired.'
                });
            }
            
            const { file } = result;
            
            if (file.shared_password) {
                if (!password) {
                    return res.render('share/password', { 
                        title: 'Password Required',
                        token,
                        fileName: file.originalName
                    });
                }
                
                const isPasswordValid = await this.verifyPassword(file.shared_password, password);
                if (!isPasswordValid) {
                    return res.render('share/password', { 
                        title: 'Password Required',
                        token,
                        fileName: file.originalName,
                        error: 'Incorrect password. Please try again.'
                    });
                }
            }
            
            res.render('share/view', {
                title: 'Download File',
                file: {
                    name: file.originalName,
                    size: this.formatFileSize(file.size),
                    uploaded: new Date(file.uploadedAt).toLocaleString(),
                    token
                }
            });
            
        } catch (error) {
            console.error('Error in getSharePage:', error);
            res.status(500).render('share/error', {
                title: 'Error',
                message: 'An error occurred while processing your request.'
            });
        }
    }

    async downloadFile(req, res) {
        try {
            const { token } = req.params;
            const { password } = req.body;
            
            const result = await this.getSharedFile(token);
            
            if (!result || result.expired) {
                return res.status(404).render('share/not-found', { 
                    title: 'File Not Found',
                    message: 'The requested file could not be found or has expired.'
                });
            }
            
            const { file } = result;
            const filePath = path.join(__dirname, '../uploads', file.filePath);
            
            if (file.shared_password) {
                const isPasswordValid = await this.verifyPassword(file.shared_password, password);
                if (!isPasswordValid) {
                    return res.status(403).json({ 
                        success: false,
                        error: 'Incorrect password.'
                    });
                }
            }
            
            try {
                await fs.access(filePath);
            } catch (err) {
                return res.status(404).render('share/error', {
                    title: 'File Not Found',
                    message: 'The requested file could not be found on the server.'
                });
            }
            
            const scanResult = await this.scanAndDownloadFile(filePath);
            
            if (scanResult.error) {
                return res.status(403).render('share/infected', {
                    title: 'Security Alert',
                    message: scanResult.error,
                    fileName: file.originalName,
                    viruses: scanResult.viruses || []
                });
            }
            
            res.download(filePath, file.originalName, (err) => {
                if (err) {
                    console.error('Error downloading file:', err);
                    if (!res.headersSent) {
                        res.status(500).render('share/error', {
                            title: 'Download Error',
                            message: 'An error occurred while downloading the file.'
                        });
                    }
                }
            });
            
        } catch (error) {
            console.error('Error in downloadFile:', error);
            res.status(500).render('share/error', {
                title: 'Error',
                message: 'An error occurred while processing your request.'
            });
        }
    }
    
    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
}

module.exports = new ShareController();
