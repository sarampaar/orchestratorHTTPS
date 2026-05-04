import { PrismaClient } from '@prisma/client';
import dns from 'dns/promises';
import express from 'express';
import net from 'net';
import { exec } from 'child_process';

const prisma = new PrismaClient();
const app = express();
const PORT = 3000;

function lookupWhois(domain) {
  return new Promise((resolve, reject) => {
    let server = 'whois.iana.org';
    if (domain.endsWith('.com')) server = 'whois.verisign-grs.com';
    else if (domain.endsWith('.org')) server = 'whois.pir.org';
    else if (domain.endsWith('.in')) server = 'whois.registry.in';

    const client = new net.Socket();
    let data = '';
    client.connect(43, server, () => {
      client.write(domain + '\r\n');
    });
    client.on('data', chunk => { data += chunk; });
    client.on('close', () => { resolve(data); });
    client.on('error', reject);
    client.setTimeout(10000, () => { client.destroy(); reject(new Error('Timeout')); });
  });
}

// Configuration
const DELAY_MS = parseInt(process.env.DELAY_MS || '5000', 10);
const BATCH_WAIT_MS = 10000;

// -------------------------------------------------------------
// EXPRESS DASHBOARD SETUP
// -------------------------------------------------------------
app.use(express.json());

app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Domain Checker Multi-TLD Dashboard</title>
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600;800&display=swap');
        body { margin: 0; font-family: 'Inter', sans-serif; background: #0f172a; color: #f8fafc; display: flex; flex-direction: column; align-items: center; min-height: 100vh; padding: 2rem; box-sizing: border-box; }
        h1 { font-size: 3rem; font-weight: 800; background: linear-gradient(to right, #38bdf8, #818cf8); -webkit-background-clip: text; -webkit-text-fill-color: transparent; margin-bottom: 2rem; text-align: center; }
        .total-box { background: rgba(255,255,255,0.05); padding: 1.5rem 3rem; border-radius: 1rem; margin-bottom: 2rem; border: 1px solid rgba(255,255,255,0.1); }
        .total-box h2 { margin: 0; font-size: 1rem; color: #94a3b8; text-transform: uppercase; }
        .total-box p { margin: 0.5rem 0 0; font-size: 3rem; font-weight: 800; }
        .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 1.5rem; width: 100%; max-width: 1200px; }
        .card { background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 1rem; padding: 2rem; backdrop-filter: blur(10px); transition: transform 0.2s; }
        .card:hover { transform: translateY(-5px); background: rgba(255, 255, 255, 0.08); }
        .card h2 { margin: 0 0 1.5rem 0; font-size: 1.8rem; color: #f8fafc; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 1rem; text-align: center; }
        .stat-row { display: flex; justify-content: space-between; margin-bottom: 1rem; font-size: 1.2rem; }
        .stat-row span:last-child { font-weight: 800; }
        .available span:last-child { color: #4ade80; }
        .taken span:last-child { color: #f87171; }
        .pending span:last-child { color: #facc15; }
        .actions { margin-top: 3rem; display: flex; gap: 1rem; flex-wrap: wrap; justify-content: center; align-items: center; }
        select { padding: 1rem; border-radius: 0.5rem; font-size: 1rem; background: rgba(255,255,255,0.1); color: white; border: 1px solid rgba(255,255,255,0.2); font-family: 'Inter', sans-serif; cursor: pointer; outline: none; }
        select option { background: #0f172a; color: white; }
        button { background: #38bdf8; color: #0f172a; border: none; padding: 1rem 2rem; font-size: 1rem; font-weight: 600; border-radius: 0.5rem; cursor: pointer; transition: background 0.2s, transform 0.1s; }
        button:hover { background: #7dd3fc; transform: scale(1.05); }
        button:active { transform: scale(0.95); }
        button.success { background: #10b981; color: white; }
        button.success:hover { background: #34d399; }
        button.danger { background: #f43f5e; color: white; }
        button.danger:hover { background: #fb7185; }
      </style>
    </head>
    <body>
      <h1>Multi-TLD Live Tracker</h1>
      <div class="total-box">
        <h2>Total Generated Words</h2>
        <p id="total">...</p>
      </div>
      
      <div class="grid" id="stats-container">
        <!-- .COM -->
        <div class="card">
          <h2>.com</h2>
          <div class="stat-row available"><span>Available:</span> <span id="com-avail">...</span></div>
          <div class="stat-row taken"><span>Taken:</span> <span id="com-taken">...</span></div>
          <div class="stat-row pending"><span>Pending:</span> <span id="com-pending">...</span></div>
          <div class="stat-row"><span>Errors:</span> <span id="com-err">...</span></div>
        </div>
        <!-- .ORG -->
        <div class="card">
          <h2>.org</h2>
          <div class="stat-row available"><span>Available:</span> <span id="org-avail">...</span></div>
          <div class="stat-row taken"><span>Taken:</span> <span id="org-taken">...</span></div>
          <div class="stat-row pending"><span>Pending:</span> <span id="org-pending">...</span></div>
          <div class="stat-row"><span>Errors:</span> <span id="org-err">...</span></div>
        </div>
        <!-- .IN -->
        <div class="card">
          <h2>.in</h2>
          <div class="stat-row available"><span>Available:</span> <span id="in-avail">...</span></div>
          <div class="stat-row taken"><span>Taken:</span> <span id="in-taken">...</span></div>
          <div class="stat-row pending"><span>Pending:</span> <span id="in-pending">...</span></div>
          <div class="stat-row"><span>Errors:</span> <span id="in-err">...</span></div>
        </div>
      </div>
      
      <div class="actions">
        <select id="gen-length">
          <option value="2">2 Letters</option>
          <option value="3" selected>3 Letters</option>
          <option value="4">4 Letters</option>
          <option value="5">5 Letters</option>
          <option value="6">6 Letters</option>
        </select>
        <button class="success" onclick="generateDomains()">Generate Words</button>
        <button onclick="fetchStats()">Refresh Stats</button>
        <button class="danger" onclick="resetErrors()">Rerun Errors</button>
      </div>

      <script>
        async function generateDomains() {
          const length = document.getElementById('gen-length').value;
          if (!confirm('Are you sure you want to generate all ' + length + '-letter words? This runs in the background and may take time for 5+ letters.')) return;
          try {
            await fetch('/api/generate', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ length })
            });
            alert('Generation started in the background! Watch the Total count rise.');
            fetchStats();
          } catch(e) { alert('Failed to start generation'); }
        }

        async function fetchStats() {
          try {
            const res = await fetch('/api/stats');
            const data = await res.json();
            if (data.error) {
              document.getElementById('total').innerText = data.error;
              document.getElementById('total').style.fontSize = '1.2rem';
              document.getElementById('total').style.color = '#f87171';
              return;
            }
            document.getElementById('total').innerText = data.total;
            document.getElementById('total').style.fontSize = '3rem';
            document.getElementById('total').style.color = '#f8fafc';
            
            ['com', 'org', 'in'].forEach(tld => {
              document.getElementById(tld+'-avail').innerText = data[tld].available;
              document.getElementById(tld+'-taken').innerText = data[tld].taken;
              document.getElementById(tld+'-pending').innerText = data[tld].pending;
              document.getElementById(tld+'-err').innerText = data[tld].error;
            });
          } catch (e) { console.error('Failed to fetch stats'); }
        }
        
        async function resetErrors() {
          if (!confirm('Are you sure you want to reset all errored domains to pending?')) return;
          try {
            await fetch('/api/reset-errors', { method: 'POST' });
            fetchStats();
            alert('Errors reset successfully!');
          } catch (e) { alert('Failed to reset errors'); }
        }

        fetchStats();
        setInterval(fetchStats, 5000);
      </script>
    </body>
    </html>
  `);
});

app.post('/api/generate', (req, res) => {
  const length = parseInt(req.body.length, 10);
  if (!length || length < 2 || length > 6) {
    return res.status(400).json({ error: 'Invalid length' });
  }

  // Spawn generate.js as a background child process
  exec(`node generate.js ${length}`, (error, stdout, stderr) => {
    if (error) console.error(`Generation error: ${error.message}`);
    if (stderr) console.error(`Generation stderr: ${stderr}`);
    console.log(`Generation output: ${stdout}`);
  });

  res.json({ message: 'Generation started in background' });
});

app.get('/api/stats', async (req, res) => {
  try {
    const total = await prisma.domainWord.count();
    
    const comAvail = await prisma.domainWord.count({ where: { whois_com: 'available' } });
    const comTaken = await prisma.domainWord.count({ where: { OR: [{ dns_com: 'taken' }, { whois_com: 'taken' }] } });
    const comPend = await prisma.domainWord.count({ where: { OR: [{ dns_com: 'pending' }, { whois_com: 'pending' }] } });
    const comErr = await prisma.domainWord.count({ where: { OR: [{ dns_com: 'error' }, { whois_com: 'error' }] } });

    const orgAvail = await prisma.domainWord.count({ where: { whois_org: 'available' } });
    const orgTaken = await prisma.domainWord.count({ where: { OR: [{ dns_org: 'taken' }, { whois_org: 'taken' }] } });
    const orgPend = await prisma.domainWord.count({ where: { OR: [{ dns_org: 'pending' }, { whois_org: 'pending' }] } });
    const orgErr = await prisma.domainWord.count({ where: { OR: [{ dns_org: 'error' }, { whois_org: 'error' }] } });

    const inAvail = await prisma.domainWord.count({ where: { whois_in: 'available' } });
    const inTaken = await prisma.domainWord.count({ where: { OR: [{ dns_in: 'taken' }, { whois_in: 'taken' }] } });
    const inPend = await prisma.domainWord.count({ where: { OR: [{ dns_in: 'pending' }, { whois_in: 'pending' }] } });
    const inErr = await prisma.domainWord.count({ where: { OR: [{ dns_in: 'error' }, { whois_in: 'error' }] } });

    res.json({
      total,
      com: { available: comAvail, taken: comTaken, pending: comPend, error: comErr },
      org: { available: orgAvail, taken: orgTaken, pending: orgPend, error: orgErr },
      in: { available: inAvail, taken: inTaken, pending: inPend, error: inErr }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Stats Query Error: ' + err.message });
  }
});

app.post('/api/reset-errors', async (req, res) => {
  try {
    await prisma.$transaction([
      prisma.domainWord.updateMany({ where: { dns_com: 'error' }, data: { dns_com: 'pending' } }),
      prisma.domainWord.updateMany({ where: { whois_com: 'error' }, data: { whois_com: 'pending' } }),
      prisma.domainWord.updateMany({ where: { dns_org: 'error' }, data: { dns_org: 'pending' } }),
      prisma.domainWord.updateMany({ where: { whois_org: 'error' }, data: { whois_org: 'pending' } }),
      prisma.domainWord.updateMany({ where: { dns_in: 'error' }, data: { dns_in: 'pending' } }),
      prisma.domainWord.updateMany({ where: { whois_in: 'error' }, data: { whois_in: 'pending' } }),
    ]);
    res.json({ message: 'Reset successful' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to reset errors' });
  }
});

// START EXPRESS SERVER
app.listen(PORT, () => {
  console.log(`Dashboard listening on port ${PORT}`);
});

// -------------------------------------------------------------
// WORKER LOGIC
// -------------------------------------------------------------

async function checkDns(domain) {
  try {
    await dns.resolve(domain);
    return 'taken'; // If A records exist, it's definitively taken
  } catch (error) {
    return 'nxdomain'; // No A records found, needs WHOIS
  }
}

async function checkWhois(domain) {
  try {
    const data = await lookupWhois(domain);
    const lowerData = data.toLowerCase();
    const availableStrings = [
      'no match for', 'not found', 'is available for registration', 'no data found', 'no match'
    ];
    const isAvailable = availableStrings.some(str => lowerData.includes(str));
    return isAvailable ? 'available' : 'taken';
  } catch (err) {
    console.error(`[${domain}] WHOIS error:`, err.message);
    return 'error';
  }
}

async function processNextDomain() {
  try {
    // Find a word that has ANY pending operations
    const pendingWord = await prisma.domainWord.findFirst({
      where: {
        OR: [
          { dns_com: 'pending' }, { whois_com: 'pending' },
          { dns_org: 'pending' }, { whois_org: 'pending' },
          { dns_in: 'pending' }, { whois_in: 'pending' }
        ]
      }
    });

    if (!pendingWord) {
      console.log('No pending words found. Waiting before next check...');
      setTimeout(processNextDomain, BATCH_WAIT_MS);
      return;
    }

    const { id, word } = pendingWord;
    console.log(`\nProcessing word: ${word}`);
    let updatedData = {};

    // --------------------------------------------------
    // .COM PROCESSING PIPELINE
    // --------------------------------------------------
    if (pendingWord.dns_com === 'pending') {
      const status = await checkDns(`${word}.com`);
      updatedData.dns_com = status;
      if (status === 'taken') updatedData.whois_com = 'skipped'; // Bypass WHOIS
    } else if (pendingWord.whois_com === 'pending' && pendingWord.dns_com === 'nxdomain') {
      const status = await checkWhois(`${word}.com`);
      updatedData.whois_com = status;
    }

    // --------------------------------------------------
    // .ORG PROCESSING PIPELINE
    // --------------------------------------------------
    else if (pendingWord.dns_org === 'pending') {
      const status = await checkDns(`${word}.org`);
      updatedData.dns_org = status;
      if (status === 'taken') updatedData.whois_org = 'skipped';
    } else if (pendingWord.whois_org === 'pending' && pendingWord.dns_org === 'nxdomain') {
      const status = await checkWhois(`${word}.org`);
      updatedData.whois_org = status;
    }

    // --------------------------------------------------
    // .IN PROCESSING PIPELINE
    // --------------------------------------------------
    else if (pendingWord.dns_in === 'pending') {
      const status = await checkDns(`${word}.in`);
      updatedData.dns_in = status;
      if (status === 'taken') updatedData.whois_in = 'skipped';
    } else if (pendingWord.whois_in === 'pending' && pendingWord.dns_in === 'nxdomain') {
      const status = await checkWhois(`${word}.in`);
      updatedData.whois_in = status;
    }

    // UPDATE DATABASE
    if (Object.keys(updatedData).length > 0) {
      updatedData.last_checked = new Date();
      await prisma.domainWord.update({
        where: { id },
        data: updatedData
      });
      console.log(`[${word}] State updated:`, updatedData);
    }

    // Wait and loop
    setTimeout(processNextDomain, DELAY_MS);
  } catch (err) {
    console.error('Worker loop error:', err.message);
    setTimeout(processNextDomain, BATCH_WAIT_MS);
  }
}

async function startWorker() {
  if (!process.env.DATABASE_URL) {
    console.error('ERROR: DATABASE_URL environment variable is required.');
    process.exit(1);
  }

  try {
    await prisma.$connect();
    console.log('Connected to PostgreSQL database via Prisma.');
    processNextDomain();
  } catch (err) {
    console.error('Failed to connect to database:', err);
    process.exit(1);
  }
}

startWorker();
