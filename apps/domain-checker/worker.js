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
        .total-box { background: rgba(255,255,255,0.05); padding: 1.5rem 3rem; border-radius: 1rem; margin-bottom: 1rem; border: 1px solid rgba(255,255,255,0.1); text-align: center; }
        .total-box h2 { margin: 0; font-size: 1rem; color: #94a3b8; text-transform: uppercase; }
        .total-box p { margin: 0.5rem 0 0; font-size: 3rem; font-weight: 800; }
        .eta-box { background: rgba(16, 185, 129, 0.1); border: 1px solid #10b981; padding: 1rem 2rem; border-radius: 0.5rem; text-align: center; margin-bottom: 2rem; }
        .eta-box p { margin: 0; font-size: 1.5rem; font-weight: 600; color: #34d399; }
        .section-title { font-size: 2rem; margin: 2rem 0 1rem; text-align: center; color: #38bdf8; width: 100%; max-width: 1200px; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 0.5rem; }
        .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 1.5rem; width: 100%; max-width: 1200px; }
        .card { background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 1rem; padding: 2rem; backdrop-filter: blur(10px); transition: transform 0.2s; }
        .card:hover { transform: translateY(-5px); background: rgba(255, 255, 255, 0.08); }
        .card h2 { margin: 0 0 1.5rem 0; font-size: 1.5rem; color: #f8fafc; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 1rem; text-align: center; }
        .stat-row { display: flex; justify-content: space-between; margin-bottom: 1rem; font-size: 1.1rem; }
        .stat-row span:last-child { font-weight: 800; }
        .available span:last-child { color: #4ade80; }
        .taken span:last-child { color: #f87171; }
        .pending span:last-child { color: #facc15; }
        .actions { margin-top: 3rem; display: flex; gap: 1rem; flex-wrap: wrap; justify-content: center; align-items: center; }
        select { padding: 1rem; border-radius: 0.5rem; font-size: 1rem; background: rgba(255,255,255,0.1); color: white; border: 1px solid rgba(255,255,255,0.2); outline: none; }
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

      <div class="eta-box">
        <p id="eta">Calculating ETA...</p>
      </div>
      
      <h2 class="section-title">Phase 1: DNS Checks (Source of Truth)</h2>
      <div class="grid" id="dns-container">
        <!-- .COM -->
        <div class="card">
          <h2>.com DNS</h2>
          <div class="stat-row pending"><span>Pending:</span> <span id="dns-com-pending">...</span></div>
          <div class="stat-row taken"><span>Taken (A/NS/MX):</span> <span id="dns-com-taken">...</span></div>
          <div class="stat-row"><span>NXDomain (To WHOIS):</span> <span id="dns-com-nxdomain">...</span></div>
          <div class="stat-row"><span>Errors:</span> <span id="dns-com-err">...</span></div>
        </div>
        <!-- .ORG -->
        <div class="card">
          <h2>.org DNS</h2>
          <div class="stat-row pending"><span>Pending:</span> <span id="dns-org-pending">...</span></div>
          <div class="stat-row taken"><span>Taken (A/NS/MX):</span> <span id="dns-org-taken">...</span></div>
          <div class="stat-row"><span>NXDomain (To WHOIS):</span> <span id="dns-org-nxdomain">...</span></div>
          <div class="stat-row"><span>Errors:</span> <span id="dns-org-err">...</span></div>
        </div>
        <!-- .IN -->
        <div class="card">
          <h2>.in DNS</h2>
          <div class="stat-row pending"><span>Pending:</span> <span id="dns-in-pending">...</span></div>
          <div class="stat-row taken"><span>Taken (A/NS/MX):</span> <span id="dns-in-taken">...</span></div>
          <div class="stat-row"><span>NXDomain (To WHOIS):</span> <span id="dns-in-nxdomain">...</span></div>
          <div class="stat-row"><span>Errors:</span> <span id="dns-in-err">...</span></div>
        </div>
      </div>

      <h2 class="section-title">Phase 2: WHOIS Checks (The Possibility)</h2>
      <div class="grid" id="whois-container">
        <!-- .COM -->
        <div class="card">
          <h2>.com WHOIS</h2>
          <div class="stat-row pending"><span>Pending:</span> <span id="whois-com-pending">...</span></div>
          <div class="stat-row available"><span>Available:</span> <span id="whois-com-avail">...</span></div>
          <div class="stat-row taken"><span>Taken:</span> <span id="whois-com-taken">...</span></div>
          <div class="stat-row"><span>Skipped:</span> <span id="whois-com-skipped">...</span></div>
          <div class="stat-row"><span>Errors:</span> <span id="whois-com-err">...</span></div>
        </div>
        <!-- .ORG -->
        <div class="card">
          <h2>.org WHOIS</h2>
          <div class="stat-row pending"><span>Pending:</span> <span id="whois-org-pending">...</span></div>
          <div class="stat-row available"><span>Available:</span> <span id="whois-org-avail">...</span></div>
          <div class="stat-row taken"><span>Taken:</span> <span id="whois-org-taken">...</span></div>
          <div class="stat-row"><span>Skipped:</span> <span id="whois-org-skipped">...</span></div>
          <div class="stat-row"><span>Errors:</span> <span id="whois-org-err">...</span></div>
        </div>
        <!-- .IN -->
        <div class="card">
          <h2>.in WHOIS</h2>
          <div class="stat-row pending"><span>Pending:</span> <span id="whois-in-pending">...</span></div>
          <div class="stat-row available"><span>Available:</span> <span id="whois-in-avail">...</span></div>
          <div class="stat-row taken"><span>Taken:</span> <span id="whois-in-taken">...</span></div>
          <div class="stat-row"><span>Skipped:</span> <span id="whois-in-skipped">...</span></div>
          <div class="stat-row"><span>Errors:</span> <span id="whois-in-err">...</span></div>
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
          if (!confirm('Are you sure you want to generate all ' + length + '-letter words?')) return;
          try {
            await fetch('/api/generate', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ length })
            });
            alert('Generation started in the background!');
            fetchStats();
          } catch(e) { alert('Failed to start generation'); }
        }

        async function fetchStats() {
          try {
            const res = await fetch('/api/stats');
            const data = await res.json();
            if (data.error) {
              document.getElementById('total').innerText = data.error;
              return;
            }
            document.getElementById('total').innerText = data.total;
            document.getElementById('eta').innerText = 'Estimated Time: ' + data.eta;
            
            ['com', 'org', 'in'].forEach(tld => {
              document.getElementById('dns-'+tld+'-pending').innerText = data.dns[tld].pending || 0;
              document.getElementById('dns-'+tld+'-taken').innerText = data.dns[tld].taken || 0;
              document.getElementById('dns-'+tld+'-nxdomain').innerText = data.dns[tld].nxdomain || 0;
              document.getElementById('dns-'+tld+'-err').innerText = data.dns[tld].error || 0;

              document.getElementById('whois-'+tld+'-pending').innerText = data.whois[tld].pending || 0;
              document.getElementById('whois-'+tld+'-avail').innerText = data.whois[tld].available || 0;
              document.getElementById('whois-'+tld+'-taken').innerText = data.whois[tld].taken || 0;
              document.getElementById('whois-'+tld+'-skipped').innerText = data.whois[tld].skipped || 0;
              document.getElementById('whois-'+tld+'-err').innerText = data.whois[tld].error || 0;
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
    const stats = await prisma.domainWord.groupBy({
      by: ['dns_com', 'whois_com', 'dns_org', 'whois_org', 'dns_in', 'whois_in'],
      _count: true
    });

    const result = {
      total: 0,
      dns: {
        com: {}, org: {}, in: {}
      },
      whois: {
        com: {}, org: {}, in: {}
      }
    };

    let dnsPendingCount = 0;
    let whoisPendingCount = 0;

    for (const group of stats) {
      const count = group._count;
      result.total += count;

      result.dns.com[group.dns_com] = (result.dns.com[group.dns_com] || 0) + count;
      result.whois.com[group.whois_com] = (result.whois.com[group.whois_com] || 0) + count;

      result.dns.org[group.dns_org] = (result.dns.org[group.dns_org] || 0) + count;
      result.whois.org[group.whois_org] = (result.whois.org[group.whois_org] || 0) + count;

      result.dns.in[group.dns_in] = (result.dns.in[group.dns_in] || 0) + count;
      result.whois.in[group.whois_in] = (result.whois.in[group.whois_in] || 0) + count;

      if (group.dns_com === 'pending') dnsPendingCount += count;
      if (group.dns_org === 'pending') dnsPendingCount += count;
      if (group.dns_in === 'pending') dnsPendingCount += count;

      if (group.whois_com === 'pending' && group.dns_com === 'nxdomain') whoisPendingCount += count;
      if (group.whois_org === 'pending' && group.dns_org === 'nxdomain') whoisPendingCount += count;
      if (group.whois_in === 'pending' && group.dns_in === 'nxdomain') whoisPendingCount += count;
    }

    // Calculate ETA (0.05 seconds per DNS loop, 5.0 seconds per WHOIS loop)
    // Note: since DNS processes all 3 TLDs concurrently per word, the actual DNS time is less,
    // but 0.05 per pending item is a safe upper bound.
    const dnsSeconds = dnsPendingCount * 0.05;
    const whoisSeconds = whoisPendingCount * (DELAY_MS / 1000);
    const totalSeconds = Math.ceil(dnsSeconds + whoisSeconds);
    
    let etaString = "Done!";
    if (totalSeconds > 0) {
      if (totalSeconds > 86400) {
        etaString = `${Math.floor(totalSeconds / 86400)} days ${Math.floor((totalSeconds % 86400) / 3600)} hrs`;
      } else if (totalSeconds > 3600) {
        etaString = `${Math.floor(totalSeconds / 3600)} hrs ${Math.floor((totalSeconds % 3600) / 60)} mins`;
      } else if (totalSeconds > 60) {
        etaString = `${Math.floor(totalSeconds / 60)} mins ${totalSeconds % 60} secs`;
      } else {
        etaString = `${totalSeconds} seconds`;
      }
    }
    
    result.eta = etaString;

    res.json(result);
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

let pendingQueue = [];

async function checkDns(domain) {
  try {
    await Promise.any([
      dns.resolve(domain),
      dns.resolveNs(domain),
      dns.resolveMx(domain)
    ]);
    return 'taken'; // If any standard records exist, it's definitively taken
  } catch (error) {
    return 'nxdomain'; // No records found, needs WHOIS
  }
}

async function checkWhois(domain) {
  try {
    const data = await lookupWhois(domain);
    const lowerData = data.toLowerCase();
    
    // Check for common rate limit / block messages
    const errorStrings = ['rate limit', 'exceeded', 'blocked', 'blacklisted', 'timeout', 'please try again', 'connection reset', 'limit exceeded', 'quota', 'wait'];
    if (errorStrings.some(str => lowerData.includes(str))) {
      console.warn(`[${domain}] WHOIS rate limited/blocked. Response snippet: ${data.substring(0, 100)}`);
      return 'error';
    }

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
    if (pendingQueue.length === 0) {
      console.log('Fetching next batch from database...');
      pendingQueue = await prisma.domainWord.findMany({
        where: {
          OR: [
            { dns_com: 'pending' }, { whois_com: 'pending' },
            { dns_org: 'pending' }, { whois_org: 'pending' },
            { dns_in: 'pending' }, { whois_in: 'pending' }
          ]
        },
        take: 100,
        orderBy: { id: 'asc' }
      });

      if (pendingQueue.length === 0) {
        console.log('No pending words found. Waiting before next check...');
        setTimeout(processNextDomain, BATCH_WAIT_MS);
        return;
      }
    }

    const wordObj = pendingQueue[0];
    const { id, word } = wordObj;
    console.log(`\nProcessing word: ${word}`);
    let updatedData = {};
    let didWhois = false;

    // Fast DNS phase (can do all 3 simultaneously)
    const dnsPromises = [];
    if (wordObj.dns_com === 'pending') {
      dnsPromises.push(checkDns(`${word}.com`).then(s => { 
        updatedData.dns_com = s; wordObj.dns_com = s; 
        if (s === 'taken') { updatedData.whois_com = 'skipped'; wordObj.whois_com = 'skipped'; } 
      }));
    }
    if (wordObj.dns_org === 'pending') {
      dnsPromises.push(checkDns(`${word}.org`).then(s => { 
        updatedData.dns_org = s; wordObj.dns_org = s; 
        if (s === 'taken') { updatedData.whois_org = 'skipped'; wordObj.whois_org = 'skipped'; } 
      }));
    }
    if (wordObj.dns_in === 'pending') {
      dnsPromises.push(checkDns(`${word}.in`).then(s => { 
        updatedData.dns_in = s; wordObj.dns_in = s; 
        if (s === 'taken') { updatedData.whois_in = 'skipped'; wordObj.whois_in = 'skipped'; } 
      }));
    }

    if (dnsPromises.length > 0) {
      // Execute all pending DNS checks for this word in parallel
      await Promise.all(dnsPromises);
    } else {
      // No DNS pending, do ONE WHOIS check (to respect rate limits)
      if (wordObj.whois_com === 'pending' && wordObj.dns_com === 'nxdomain') {
        const s = await checkWhois(`${word}.com`);
        updatedData.whois_com = s; wordObj.whois_com = s; didWhois = true;
      } else if (wordObj.whois_org === 'pending' && wordObj.dns_org === 'nxdomain') {
        const s = await checkWhois(`${word}.org`);
        updatedData.whois_org = s; wordObj.whois_org = s; didWhois = true;
      } else if (wordObj.whois_in === 'pending' && wordObj.dns_in === 'nxdomain') {
        const s = await checkWhois(`${word}.in`);
        updatedData.whois_in = s; wordObj.whois_in = s; didWhois = true;
      }
    }

    // Check if word is fully processed
    const isDone = 
      wordObj.dns_com !== 'pending' && wordObj.whois_com !== 'pending' &&
      wordObj.dns_org !== 'pending' && wordObj.whois_org !== 'pending' &&
      wordObj.dns_in !== 'pending' && wordObj.whois_in !== 'pending';

    if (isDone) {
      pendingQueue.shift(); // Remove from in-memory queue
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
    if (didWhois) {
      setTimeout(processNextDomain, DELAY_MS);
    } else {
      // Fast path for DNS checks
      setTimeout(processNextDomain, 50); 
    }
  } catch (err) {
    console.error('Worker loop error:', err.message);
    pendingQueue = []; // Clear queue to prevent infinite error loops on a corrupted row
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
