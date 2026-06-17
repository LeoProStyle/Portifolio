const fs = require('fs');
const url = 'http://localhost:3000/api/export';
const payload = { month: '05', year: '2026', kind: 'XML', types: ['notas'], individual: true, selected: { notas: [] } };

(async () => {
  try {
    const res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
    const ct = res.headers.get('content-type') || '';
    console.log('Status', res.status, 'Content-Type:', ct);
    if (ct.includes('application/zip') || ct.includes('application/octet-stream')) {
      const array = await res.arrayBuffer();
      fs.writeFileSync('export_test.zip', Buffer.from(array));
      console.log('Wrote export_test.zip');
    } else {
      const text = await res.text();
      fs.writeFileSync('export_test_response.txt', text);
      console.log('Wrote export_test_response.txt');
      console.log(text);
    }
  } catch (err) {
    console.error(err);
  }
})();
