import { generateToken, hashToken } from '../src/common/utils/crypto.utils';

const main = () => {
  const token = generateToken();
  const hash = hashToken(token);

  console.log();
  console.log('OCPI Bootstrap Token (Token A)');
  console.log('----------------------------------');
  console.log('Plain Token (give to CPO):');
  console.log(token);
  console.log();
  console.log('Hash (store in DynamoDB):');
  console.log(hash);
  console.log();
  console.log('DynamoDB pk:');
  console.log(`TOKEN#${hash}`);
};

main();
