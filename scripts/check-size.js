// HandicapLab CI - Serverless Function Size Gate Validation Script
// Location: scripts/check-size.js

const fs = require('fs');
const path = require('path');

const NFT_PATH = path.resolve(__dirname, '../.next/server/app/api/market/clv/route.js.nft.json');
const SIZE_LIMIT_MB = 100;
const SIZE_LIMIT_BYTES = SIZE_LIMIT_MB * 1024 * 1024;

async function checkSize() {
  console.log('🔍 Validating Serverless Function Bundle Size...');
  
  if (!fs.existsSync(NFT_PATH)) {
    console.error(`❌ NFT file not found at: ${NFT_PATH}. Have you run 'npm run build' first?`);
    process.exit(1);
  }

  try {
    const nftData = JSON.parse(fs.readFileSync(NFT_PATH, 'utf-8'));
    const files = nftData.files || [];
    
    let totalBytes = 0;
    let missingFiles = 0;
    const nftDir = path.dirname(NFT_PATH);

    for (const file of files) {
      const filePath = path.resolve(nftDir, file);
      if (fs.existsSync(filePath)) {
        const stats = fs.statSync(filePath);
        totalBytes += stats.size;
      } else {
        // Paths that point outside the project or are invalid during build can be ignored or counted
        missingFiles++;
      }
    }

    const totalMB = totalBytes / (1024 * 1024);
    console.log(`📊 Total Traced Files: ${files.length}`);
    console.log(`📊 Missing/External Files: ${missingFiles}`);
    console.log(`📊 Estimated Uncompressed Bundle Size: ${totalMB.toFixed(2)} MB`);

    if (totalBytes > SIZE_LIMIT_BYTES) {
      console.error(`❌ Validation Failed: Bundle size is ${totalMB.toFixed(2)} MB, exceeding the limit of ${SIZE_LIMIT_MB} MB!`);
      process.exit(1);
    }

    console.log(`✅ Validation Succeeded: Bundle size is comfortably under the ${SIZE_LIMIT_MB} MB limit.`);
    process.exit(0);
  } catch (error) {
    console.error('❌ An error occurred during bundle size validation:', error);
    process.exit(1);
  }
}

checkSize();
