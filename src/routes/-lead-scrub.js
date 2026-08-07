const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const router = express.Router();
const { authenticateDriver } = require('../middleware/auth');

// Accept .xlsx, .xls, .csv
const upload = multer({
  dest: path.join(__dirname, '..', '..', 'uploads', 'scrubber'),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (['.xlsx', '.xls', '.csv'].includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Only .xlsx, .xls, and .csv files are accepted'));
    }
  },
});

// Ensure upload dir exists
const uploadDir = path.join(__dirname, '..', '..', 'uploads', 'scrubber');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

// POST /api/v1/driver/lead-scrub — upload + scrub + download
router.post(
  '/lead-scrub',
  authenticateDriver,
  upload.single('file'),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded. Attach a .xlsx, .xls, or .csv file with key "file".' });
      }

      const XLSX = require('xlsx');
      const workbook = XLSX.readFile(req.file.path);
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];

      // Convert to array of objects, using header row as keys
      const rawRows = XLSX.utils.sheet_to_json(sheet, { defval: '' });

      if (rawRows.length === 0) {
        // Clean up temp file
        fs.unlinkSync(req.file.path);
        return res.status(400).json({ error: 'Spreadsheet is empty or has no data rows.' });
      }

      // Normalize column names to lowercase and map to LeadRow shape
      const leadRows = rawRows.map((row) => {
        const normalized = {};
        for (const [key, val] of Object.entries(row)) {
          normalized[key.toLowerCase().trim()] = val;
        }
        return {
          address: normalized.address || normalized.street || normalized.street_address || undefined,
          lat: parseFloat(normalized.lat || normalized.latitude) || undefined,
          lng: parseFloat(normalized.lng || normalized.longitude || normalized.lon) || undefined,
          // Pass through original data
          _original: row,
        };
      });

      // Import and run the scrubber
      const { scrubLeads } = require('../utils/leadScrubber');
      const result = await scrubLeads(leadRows);

      // Build output workbook
      const outRows = result.kept.map((r) => ({
        Address: r.address || '',
        Latitude: r.lat ?? '',
        Longitude: r.lng ?? '',
        'Transit Time': r.transit_label,
        'Transit Seconds': r.transit_seconds,
        Status: 'KEPT',
        ...r._original,
      }));

      // Also include dropped rows in a second sheet for diagnostics
      const droppedRows = result.dropped.map((r) => ({
        Address: r.address || '',
        Latitude: r.lat ?? '',
        Longitude: r.lng ?? '',
        'Transit Time': r.transit_label,
        'Transit Seconds': r.transit_seconds,
        Status: 'DROPPED (>12 min)',
        ...r._original,
      }));

      const outWb = XLSX.utils.book_new();
      const keptSheet = XLSX.utils.json_to_sheet(outRows);
      XLSX.utils.book_append_sheet(outWb, keptSheet, 'Kept (within 12 min)');

      if (droppedRows.length > 0) {
        const droppedSheet = XLSX.utils.json_to_sheet(droppedRows);
        XLSX.utils.book_append_sheet(outWb, droppedSheet, 'Dropped (over 12 min)');
      }

      // Summary sheet
      const summarySheet = XLSX.utils.json_to_sheet([
        { 'Total Rows': result.summary.total, Kept: result.summary.kept, Dropped: result.summary.dropped },
      ]);
      XLSX.utils.book_append_sheet(outWb, summarySheet, 'Summary');

      // Write to buffer and send
      const buf = XLSX.write(outWb, { type: 'buffer', bookType: 'xlsx' });

      // Clean up temp file
      fs.unlinkSync(req.file.path);

      const originalName = path.parse(req.file.originalname).name;
      res.set('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.set('Content-Disposition', `attachment; filename="${originalName}-scrubbed.xlsx"`);
      return res.send(buf);
    } catch (err) {
      console.error('Lead scrub error:', err);
      // Clean up temp file if it exists
      if (req.file && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      return res.status(500).json({ error: err.message || 'Scrub failed' });
    }
  },
);

module.exports = router;
