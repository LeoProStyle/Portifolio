// Usage: set MONGODB_URI env var then run `node scripts/migrate-add-maquininha.js`
// Example (Windows PowerShell): $env:MONGODB_URI='your_uri'; node scripts/migrate-add-maquininha.js

const mongoose = require('mongoose');

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('Please set MONGODB_URI environment variable');
    process.exit(1);
  }

  await mongoose.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true });
  console.log('Connected to MongoDB');

  const collection = mongoose.connection.collection('cashclosures');
  // Update documents that don't have the maquininha field
  const res = await collection.updateMany({ maquininha: { $exists: false } }, { $set: { maquininha: 0 } });
  console.log('Matched:', res.matchedCount, 'Modified:', res.modifiedCount);

  // Optionally ensure total includes maquininha (skip if you prefer not to modify totals)
  // const docs = await collection.find({}).toArray();
  // for (const d of docs) {
  //   const dinheiro = d.dinheiro ?? 0;
  //   const pix = d.pix ?? 0;
  //   const cc = d.cartao_credito ?? 0;
  //   const cd = d.cartao_debito ?? 0;
  //   const mq = d.maquininha ?? 0;
  //   const total = dinheiro + pix + cc + cd + mq;
  //   if (d.total !== total) {
  //     await collection.updateOne({ _id: d._id }, { $set: { total } });
  //     console.log('Updated total for', d._id.toString());
  //   }
  // }

  await mongoose.disconnect();
  console.log('Done');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
