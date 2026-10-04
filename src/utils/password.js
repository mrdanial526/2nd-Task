/**
 * DecodeLabs Password Hashing & Verification
 * PBKDF2-SHA512 with Cryptographic Salts
 */

const crypto = require('crypto');

const ITERATIONS = 10000;
const KEYLEN = 64;
const DIGEST = 'sha512';

/**
 * Hashes a plain text password with a unique salt
 * @param {string} password 
 * @returns {string} - "salt:hash" string
 */
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, ITERATIONS, KEYLEN, DIGEST).toString('hex');
  return `${salt}:${hash}`;
}

/**
 * Compares a plain password against the stored salt:hash
 * @param {string} password 
 * @param {string} storedHash 
 * @returns {boolean}
 */
function verifyPassword(password, storedHash) {
  if (!password || !storedHash || !storedHash.includes(':')) {
    return false;
  }
  const [salt, originalHash] = storedHash.split(':');
  const hashToCompare = crypto.pbkdf2Sync(password, salt, ITERATIONS, KEYLEN, DIGEST).toString('hex');
  
  const originalBuffer = Buffer.from(originalHash, 'hex');
  const compareBuffer = Buffer.from(hashToCompare, 'hex');

  if (originalBuffer.length !== compareBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(originalBuffer, compareBuffer);
}

module.exports = {
  hashPassword,
  verifyPassword
};
