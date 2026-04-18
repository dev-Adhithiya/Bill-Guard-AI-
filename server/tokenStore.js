/**
 * @module tokenStore
 * @description AES-256-CBC encrypted token persistence.
 * Stores and retrieves Google OAuth refresh tokens in a local encrypted JSON file.
 * No database needed — keeps things simple for hackathon scope.
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const TOKEN_FILE = path.join(__dirname, 'tokens.enc');
const ALGORITHM = 'aes-256-cbc';

/**
 * Derives a 32-byte key from the ENCRYPTION_KEY env variable.
 * @returns {Buffer} 32-byte encryption key
 */
function getKey() {
  const raw = process.env.ENCRYPTION_KEY || '';
  return crypto.createHash('sha256').update(raw).digest();
}

/**
 * Encrypts a plaintext string using AES-256-CBC.
 * @param {string} text - Plaintext to encrypt
 * @returns {string} IV:encrypted hex string
 */
function encrypt(text) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

/**
 * Decrypts an AES-256-CBC encrypted string.
 * @param {string} data - IV:encrypted hex string
 * @returns {string} Decrypted plaintext
 */
function decrypt(data) {
  const [ivHex, encrypted] = data.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), iv);
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

/**
 * Saves OAuth tokens to encrypted file.
 * @param {Object} tokens - Google OAuth token object (access_token, refresh_token, etc.)
 */
function saveTokens(tokens) {
  const encrypted = encrypt(JSON.stringify(tokens));
  fs.writeFileSync(TOKEN_FILE, encrypted, 'utf8');
}

/**
 * Loads and decrypts OAuth tokens from file.
 * @returns {Object|null} Token object or null if not found
 */
function loadTokens() {
  try {
    if (!fs.existsSync(TOKEN_FILE)) return null;
    const encrypted = fs.readFileSync(TOKEN_FILE, 'utf8');
    return JSON.parse(decrypt(encrypted));
  } catch (err) {
    console.error('⚠️ Failed to load tokens:', err.message);
    return null;
  }
}

/**
 * Deletes the encrypted token file (used on logout).
 */
function clearTokens() {
  try {
    if (fs.existsSync(TOKEN_FILE)) fs.unlinkSync(TOKEN_FILE);
  } catch (err) {
    console.error('⚠️ Failed to clear tokens:', err.message);
  }
}

/**
 * Checks whether stored tokens exist.
 * @returns {boolean}
 */
function hasTokens() {
  return fs.existsSync(TOKEN_FILE);
}

module.exports = { saveTokens, loadTokens, clearTokens, hasTokens };
