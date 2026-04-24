import { hashToken } from '../src/common/utils/crypto.utils';

const token = process.argv[2];

if (!token) {
  console.error('Usage: yarn hash:token <token>');
  process.exit(1);
}

const hash = hashToken(token);

console.log();
console.log('Token Hash');
console.log('----------------------------------');
console.log('Hash (store in DynamoDB):');
console.log(hash);
console.log();
console.log('DynamoDB pk:');
console.log(`TOKEN#${hash}`);
