/**
 * @module driveService
 * @description Google Drive operations for BillGuard.
 * Uploads PDF digest files to a dedicated "BillGuard Reports" folder.
 * Auto-creates the folder on first use and caches the folder ID.
 */

const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

const STATUS_FILE = path.join(__dirname, '..', 'status.json');

/**
 * Reads the local status.json file.
 * @returns {Object} Current status data
 */
function readStatus() {
  try {
    if (fs.existsSync(STATUS_FILE)) {
      return JSON.parse(fs.readFileSync(STATUS_FILE, 'utf8'));
    }
  } catch (e) { /* ignore */ }
  return {};
}

/**
 * Writes data to status.json (merges with existing).
 * @param {Object} data - Key/value pairs to persist
 */
function writeStatus(data) {
  const current = readStatus();
  fs.writeFileSync(STATUS_FILE, JSON.stringify({ ...current, ...data }, null, 2));
}

/**
 * Gets or creates the "BillGuard Reports" folder in Google Drive.
 * Caches folder ID in status.json to avoid recreating.
 *
 * @param {Object} auth - Google OAuth2 client
 * @returns {Promise<string>} Drive folder ID
 */
async function getOrCreateFolder(auth) {
  const status = readStatus();
  if (status.driveFolderId) {
    // Verify folder still exists
    try {
      const drive = google.drive({ version: 'v3', auth });
      await drive.files.get({ fileId: status.driveFolderId, fields: 'id' });
      return status.driveFolderId;
    } catch (err) {
      console.log('📁 Saved Drive folder not found, creating new one...');
    }
  }

  const drive = google.drive({ version: 'v3', auth });

  const res = await drive.files.create({
    requestBody: {
      name: 'BillGuard Reports',
      mimeType: 'application/vnd.google-apps.folder'
    },
    fields: 'id'
  });

  const folderId = res.data.id;
  writeStatus({ driveFolderId: folderId });
  console.log(`📁 BillGuard Reports folder created: ${folderId}`);
  return folderId;
}

/**
 * Uploads a PDF buffer to Google Drive in the BillGuard Reports folder.
 *
 * @param {Object} auth - Google OAuth2 client
 * @param {Buffer} pdfBuffer - PDF file contents as a Buffer
 * @param {string} fileName - Name for the PDF file (e.g., "BillGuard_April_2026.pdf")
 * @returns {Promise<Object>} Drive file metadata { id, name, webViewLink }
 */
async function uploadPdf(auth, pdfBuffer, fileName) {
  const drive = google.drive({ version: 'v3', auth });
  const folderId = await getOrCreateFolder(auth);

  const { Readable } = require('stream');
  const stream = new Readable();
  stream.push(pdfBuffer);
  stream.push(null);

  const res = await drive.files.create({
    requestBody: {
      name: fileName,
      parents: [folderId],
      mimeType: 'application/pdf'
    },
    media: {
      mimeType: 'application/pdf',
      body: stream
    },
    fields: 'id,name,webViewLink'
  });

  console.log(`📄 PDF uploaded to Drive: ${res.data.name}`);
  return res.data;
}

module.exports = { getOrCreateFolder, uploadPdf };
