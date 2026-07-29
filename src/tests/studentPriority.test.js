const assert = require('assert');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '..', '.env') });
const pool = require('../db.js');

let studentDriver;
let backupDriver;
let trip45;
let trip135;

const tests = [];
let passed = 0;
let failed = 0;

function test(name, fn) {
  tests.push({ name, fn });
}

async function run() {
  try {
    const ts = Date.now();
    const studentToken = crypto.randomBytes(32).toString('hex');
    const backupToken = crypto.randomBytes(32).toString('hex');

    const studentResult = await pool.query(
      `INSERT INTO odofy_drivers (uuid, first_name, last_name, phone_number, auth_token, email, status,
        license_photo_url, insurance_proof_url, profile_photo_url, vehicle_make_model)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`,
      [
        uuidv4(), 'Student', 'Driver', '+1555' + ts, studentToken,
        'test@missouristate.edu', 'ACTIVE',
        '/uploads/test-license.jpg', '/uploads/test-insurance.jpg',
        '/uploads/test-profile.jpg', 'Honda Civic',
      ]
    );
    studentDriver = studentResult.rows[0];

    const backupResult = await pool.query(
      `INSERT INTO odofy_drivers (uuid, first_name, last_name, phone_number, auth_token, email, status,
        license_photo_url, insurance_proof_url, profile_photo_url, vehicle_make_model)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`,
      [
        uuidv4(), 'Backup', 'Driver', '+1556' + ts, backupToken,
        'backup@gmail.com', 'ACTIVE',
        '/uploads/test-license.jpg', '/uploads/test-insurance.jpg',
        '/uploads/test-profile.jpg', 'Toyota Camry',
      ]
    );
    backupDriver = backupResult.rows[0];

    const trip45Result = await pool.query(
      `INSERT INTO odofy_trips (uuid, merchant_id, customer_name, customer_phone,
        delivery_address, dest_latitude, dest_longitude, status, driver_tip_allocation, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW() - INTERVAL '45 seconds') RETURNING *`,
      [
        uuidv4(), 'a0000000-0000-0000-0000-000000000001', 'Test Customer 1',
        '+15550000001', '123 Main St', 37.2090, -93.2923,
        'PENDING_PICKUP', 0,
      ]
    );
    trip45 = trip45Result.rows[0];

    const trip135Result = await pool.query(
      `INSERT INTO odofy_trips (uuid, merchant_id, customer_name, customer_phone,
        delivery_address, dest_latitude, dest_longitude, status, driver_tip_allocation, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW() - INTERVAL '135 seconds') RETURNING *`,
      [
        uuidv4(), 'a0000000-0000-0000-0000-000000000001', 'Test Customer 2',
        '+15550000002', '456 Elm St', 37.2090, -93.2923,
        'PENDING_PICKUP', 0,
      ]
    );
    trip135 = trip135Result.rows[0];

    for (const t of tests) {
      try {
        await t.fn();
        passed++;
        console.log(`  ✓ ${t.name}`);
      } catch (err) {
        failed++;
        console.log(`  ✗ ${t.name}`);
        console.log(`    ${err.message}`);
      }
    }
  } catch (err) {
    console.error('Test setup failed:', err);
    process.exit(1);
  } finally {
    try {
      if (studentDriver) {
        await pool.query('DELETE FROM odofy_drivers WHERE uuid = $1', [studentDriver.uuid]);
      }
      if (backupDriver) {
        await pool.query('DELETE FROM odofy_drivers WHERE uuid = $1', [backupDriver.uuid]);
      }
      if (trip45) {
        await pool.query('DELETE FROM odofy_trips WHERE uuid = $1', [trip45.uuid]);
      }
      if (trip135) {
        await pool.query('DELETE FROM odofy_trips WHERE uuid = $1', [trip135.uuid]);
      }
    } catch (cleanupErr) {
      console.error('Cleanup error:', cleanupErr);
    }
    await pool.end();
  }

  console.log(`\n${passed} passed, ${failed} failed, ${passed + failed} total`);
  process.exit(failed > 0 ? 1 : 0);
}

function isStudentDriver(driver) {
  return driver.email && driver.email.toLowerCase().endsWith('.edu');
}

function buildAvailableQuery(driver) {
  const isStudent = isStudentDriver(driver);
  if (isStudent) {
    return {
      text: 'SELECT * FROM odofy_trips WHERE status = $1 ORDER BY created_at ASC',
      values: ['PENDING_PICKUP'],
    };
  }
  const cutoffTime = new Date(Date.now() - 120000).toISOString();
  return {
    text: 'SELECT * FROM odofy_trips WHERE status = $1 AND created_at <= $2 ORDER BY created_at ASC',
    values: ['PENDING_PICKUP', cutoffTime],
  };
}

test('Student driver sees 45-second-old trip', async () => {
  const q = buildAvailableQuery(studentDriver);
  const result = await pool.query(q.text, q.values);
  const tripIds = result.rows.map((r) => r.uuid);
  assert.ok(tripIds.includes(trip45.uuid), 'Student should see the 45-second-old trip');
});

test('Backup driver does NOT see 45-second-old trip', async () => {
  const q = buildAvailableQuery(backupDriver);
  const result = await pool.query(q.text, q.values);
  const tripIds = result.rows.map((r) => r.uuid);
  assert.ok(!tripIds.includes(trip45.uuid), 'Backup driver should NOT see the 45-second-old trip');
});

test('Backup driver sees 135-second-old trip', async () => {
  const q = buildAvailableQuery(backupDriver);
  const result = await pool.query(q.text, q.values);
  const tripIds = result.rows.map((r) => r.uuid);
  assert.ok(tripIds.includes(trip135.uuid), 'Backup driver should see the 135-second-old trip');
});

test('45-second-old trip still hidden from backup after older trip exists', async () => {
  const q = buildAvailableQuery(backupDriver);
  const result = await pool.query(q.text, q.values);
  const tripIds = result.rows.map((r) => r.uuid);
  assert.ok(tripIds.includes(trip135.uuid), 'Backup should still see 135s trip');
  assert.ok(!tripIds.includes(trip45.uuid), 'Backup should still NOT see 45s trip');
});

test('Student driver sees all trips regardless of age', async () => {
  const q = buildAvailableQuery(studentDriver);
  const result = await pool.query(q.text, q.values);
  const tripIds = result.rows.map((r) => r.uuid);
  assert.ok(tripIds.includes(trip45.uuid), 'Student should see 45s trip');
  assert.ok(tripIds.includes(trip135.uuid), 'Student should see 135s trip');
});

run();
