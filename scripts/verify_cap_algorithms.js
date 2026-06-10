/**
 * Cross-validation script: Cap JS fnv1a/prng vs Python implementation
 * Run: node scripts/verify_cap_algorithms.js
 */

// Exact implementations from capjs-core (core/src/prng.js)
function fnv1a(str) {
  let hash = 2166136261;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  return hash >>> 0;
}

function fnv1aResume(state, str) {
  let h = state;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h += (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24);
  }
  return h >>> 0;
}

function prngFromHash(initialHash, length) {
  let state = initialHash;
  let result = "";
  while (result.length < length) {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    state >>>= 0;
    result += state.toString(16).padStart(8, "0");
  }
  return result.substring(0, length);
}

// Generate test vectors
const testVectors = [];

// Random strings
const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
for (let i = 0; i < 500; i++) {
  let str = '';
  const len = Math.floor(Math.random() * 100) + 1;
  for (let j = 0; j < len; j++) {
    str += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  const hash = fnv1a(str);
  const prng = prngFromHash(hash, 32);
  testVectors.push({ str, hash, prng });
}

// Known edge cases
testVectors.push({ str: '', hash: fnv1a(''), prng: prngFromHash(fnv1a(''), 32) });
testVectors.push({ str: 'hello', hash: fnv1a('hello'), prng: prngFromHash(fnv1a('hello'), 32) });
testVectors.push({ str: 'a', hash: fnv1a('a'), prng: prngFromHash(fnv1a('a'), 32) });
testVectors.push({ str: '1234567890', hash: fnv1a('1234567890'), prng: prngFromHash(fnv1a('1234567890'), 32) });

// Save to file for Python to read
const fs = require('fs');
fs.writeFileSync('/tmp/cap_test_vectors.json', JSON.stringify(testVectors, null, 2));
console.log(`Generated ${testVectors.length} test vectors`);
console.log(`Sample: fnv1a("hello") = ${fnv1a('hello')}`);
console.log(`Sample: prngFromHash(fnv1a("hello"), 32) = ${prngFromHash(fnv1a('hello'), 32)}`);
console.log('');
console.log('Test vectors saved to /tmp/cap_test_vectors.json');
console.log('Run the Python verification script next.');
