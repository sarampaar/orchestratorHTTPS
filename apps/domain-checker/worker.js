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
        .eta-box { background: rgba(16, 185, 129, 0.1); border: 1px solid #10b981; padding: 1rem 2rem; border-radius: 0.5rem; text-align: center; margin-bottom: 1rem; width: 100%; max-width: 600px; }
        .eta-box p { margin: 0; font-size: 1.5rem; font-weight: 600; color: #34d399; }
        .status-box { background: rgba(56, 189, 248, 0.1); border: 1px solid #38bdf8; padding: 1rem 2rem; border-radius: 0.5rem; text-align: center; margin-bottom: 2rem; width: 100%; max-width: 600px; display: flex; justify-content: space-between; align-items: center; }
        .status-box p { margin: 0; font-size: 1.5rem; font-weight: 600; color: #7dd3fc; }
        .section-title { font-size: 2rem; margin: 2rem 0 1rem; text-align: center; color: #38bdf8; width: 100%; max-width: 1200px; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 0.5rem; }
        .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(350px, 1fr)); gap: 1.5rem; width: 100%; max-width: 1200px; }
        .card { background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 1rem; padding: 1.5rem; backdrop-filter: blur(10px); transition: transform 0.2s; display: flex; flex-direction: column; }
        .card h2 { margin: 0 0 1rem 0; font-size: 1.5rem; color: #f8fafc; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 1rem; text-align: center; text-transform: uppercase; letter-spacing: 1px; }
        .stat-row { display: flex; justify-content: space-between; margin-bottom: 0.8rem; font-size: 1.1rem; }
        .stat-row span:last-child { font-weight: 800; }
        .available span:last-child { color: #4ade80; }
        .taken span:last-child { color: #f87171; }
        .pending span:last-child { color: #facc15; }
        
        .card-actions { margin-top: auto; padding-top: 1rem; border-top: 1px solid rgba(255,255,255,0.1); display: flex; flex-direction: column; gap: 0.5rem; }
        .row-btns { display: flex; gap: 0.5rem; }
        
        button { background: #38bdf8; color: #0f172a; border: none; padding: 0.8rem 1rem; font-size: 0.9rem; font-weight: 600; border-radius: 0.5rem; cursor: pointer; transition: background 0.2s, transform 0.1s; flex: 1; }
        button:hover { background: #7dd3fc; transform: scale(1.02); }
        button:active { transform: scale(0.98); }
        button.success { background: #10b981; color: white; }
        button.success:hover { background: #34d399; }
        button.danger { background: #f43f5e; color: white; }
        button.danger:hover { background: #fb7185; }
        button.warning { background: #f59e0b; color: white; }
        button.warning:hover { background: #fbbf24; }
        
        .global-actions { margin-top: 3rem; display: flex; gap: 1rem; flex-wrap: wrap; justify-content: center; align-items: center; background: rgba(255,255,255,0.05); padding: 2rem; border-radius: 1rem; }
        select { padding: 1rem; border-radius: 0.5rem; font-size: 1rem; background: rgba(255,255,255,0.1); color: white; border: 1px solid rgba(255,255,255,0.2); outline: none; }
        select option { background: #0f172a; color: white; }
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
      
      <div class="status-box">
        <p id="current-status">System Idle</p>
        <button class="danger" style="flex: 0 0 auto;" onclick="control('stop')">⏹ Stop All Tasks</button>
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
          <div class="card-actions">
            <button class="success" onclick="control('start', 'dns_com')">▶ Start .com DNS</button>
            <div class="row-btns">
              <button class="warning" onclick="control('reset', 'dns_com')">↻ Reset All</button>
              <button class="danger" onclick="control('rerun_errors', 'dns_com')">⚠ Reset Errors</button>
            </div>
          </div>
        </div>
        <!-- .ORG -->
        <div class="card">
          <h2>.org DNS</h2>
          <div class="stat-row pending"><span>Pending:</span> <span id="dns-org-pending">...</span></div>
          <div class="stat-row taken"><span>Taken (A/NS/MX):</span> <span id="dns-org-taken">...</span></div>
          <div class="stat-row"><span>NXDomain (To WHOIS):</span> <span id="dns-org-nxdomain">...</span></div>
          <div class="stat-row"><span>Errors:</span> <span id="dns-org-err">...</span></div>
          <div class="card-actions">
            <button class="success" onclick="control('start', 'dns_org')">▶ Start .org DNS</button>
            <div class="row-btns">
              <button class="warning" onclick="control('reset', 'dns_org')">↻ Reset All</button>
              <button class="danger" onclick="control('rerun_errors', 'dns_org')">⚠ Reset Errors</button>
            </div>
          </div>
        </div>
        <!-- .IN -->
        <div class="card">
          <h2>.in DNS</h2>
          <div class="stat-row pending"><span>Pending:</span> <span id="dns-in-pending">...</span></div>
          <div class="stat-row taken"><span>Taken (A/NS/MX):</span> <span id="dns-in-taken">...</span></div>
          <div class="stat-row"><span>NXDomain (To WHOIS):</span> <span id="dns-in-nxdomain">...</span></div>
          <div class="stat-row"><span>Errors:</span> <span id="dns-in-err">...</span></div>
          <div class="card-actions">
            <button class="success" onclick="control('start', 'dns_in')">▶ Start .in DNS</button>
            <div class="row-btns">
              <button class="warning" onclick="control('reset', 'dns_in')">↻ Reset All</button>
              <button class="danger" onclick="control('rerun_errors', 'dns_in')">⚠ Reset Errors</button>
            </div>
          </div>
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
          <div class="card-actions">
            <button class="success" onclick="control('start', 'whois_com')">▶ Start .com WHOIS</button>
            <div class="row-btns">
              <button class="warning" onclick="control('reset', 'whois_com')">↻ Reset All</button>
              <button class="danger" onclick="control('rerun_errors', 'whois_com')">⚠ Reset Errors</button>
            </div>
          </div>
        </div>
        <!-- .ORG -->
        <div class="card">
          <h2>.org WHOIS</h2>
          <div class="stat-row pending"><span>Pending:</span> <span id="whois-org-pending">...</span></div>
          <div class="stat-row available"><span>Available:</span> <span id="whois-org-avail">...</span></div>
          <div class="stat-row taken"><span>Taken:</span> <span id="whois-org-taken">...</span></div>
          <div class="stat-row"><span>Skipped:</span> <span id="whois-org-skipped">...</span></div>
          <div class="stat-row"><span>Errors:</span> <span id="whois-org-err">...</span></div>
          <div class="card-actions">
            <button class="success" onclick="control('start', 'whois_org')">▶ Start .org WHOIS</button>
            <div class="row-btns">
              <button class="warning" onclick="control('reset', 'whois_org')">↻ Reset All</button>
              <button class="danger" onclick="control('rerun_errors', 'whois_org')">⚠ Reset Errors</button>
            </div>
          </div>
        </div>
        <!-- .IN -->
        <div class="card">
          <h2>.in WHOIS</h2>
          <div class="stat-row pending"><span>Pending:</span> <span id="whois-in-pending">...</span></div>
          <div class="stat-row available"><span>Available:</span> <span id="whois-in-avail">...</span></div>
          <div class="stat-row taken"><span>Taken:</span> <span id="whois-in-taken">...</span></div>
          <div class="stat-row"><span>Skipped:</span> <span id="whois-in-skipped">...</span></div>
          <div class="stat-row"><span>Errors:</span> <span id="whois-in-err">...</span></div>
          <div class="card-actions">
            <button class="success" onclick="control('start', 'whois_in')">▶ Start .in WHOIS</button>
            <div class="row-btns">
              <button class="warning" onclick="control('reset', 'whois_in')">↻ Reset All</button>
              <button class="danger" onclick="control('rerun_errors', 'whois_in')">⚠ Reset Errors</button>
            </div>
          </div>
        </div>
      </div>
      
      <div class="global-actions">
        <select id="gen-length">
          <option value="2">2 Letters</option>
          <option value="3" selected>3 Letters</option>
          <option value="4">4 Letters</option>
          <option value="5">5 Letters</option>
          <option value="6">6 Letters</option>
        </select>
        <button onclick="generateDomains()">Generate New Words</button>
      </div>

      <script>
        async function control(action, task) {
          let msg = action === 'stop' ? 'Stop all tasks?' : \`\${action.toUpperCase()} task \${task}?\`;
          if (action === 'reset') msg = \`WARNING: Reset ALL progress for \${task} back to pending?\`;
          if (!confirm(msg)) return;

          try {
            const res = await fetch('/api/control', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action, task })
            });
            const data = await res.json();
            if (data.error) alert(data.error);
            fetchStats();
          } catch(e) { alert('Action failed'); }
        }

        async function generateDomains() {
          const length = document.getElementById('gen-length').value;
          if (!confirm(\`Are you sure you want to generate all \${length}-letter words?\`)) return;
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
            document.getElementById('eta').innerText = 'Estimated Queue Time: ' + data.eta;
            
            const statusEl = document.getElementById('current-status');
            if (data.currentTask) {
              statusEl.innerText = '⚙ Currently Running: ' + data.currentTask.toUpperCase();
              statusEl.style.color = '#4ade80';
            } else {
              statusEl.innerText = '⏸ System Idle';
              statusEl.style.color = '#f87171';
            }
            
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
        
        fetchStats();
        setInterval(fetchStats, 5000);
      </script>
    </body>
    </html>
  `);
});

app.post('/api/control', async (req, res) => {
  const { action, task } = req.body;

  try {
    if (action === 'stop') {
      isRunning = false;
      currentTask = null;
      pendingQueue = [];
      return res.json({ message: 'Stopped' });
    }

    if (!task) return res.status(400).json({ error: 'Task required' });

    if (action === 'start') {
      if (isRunning) return res.status(400).json({ error: 'Another task is currently running. Stop it first.' });
      currentTask = task;
      isRunning = true;
      pendingQueue = [];
      // Kickstart loop if it was idle
      setImmediate(processNextDomain);
      return res.json({ message: `Started ${task}` });
    }

    if (action === 'reset') {
      const tld = task.split('_')[1];
      if (task.startsWith('dns_')) {
        await prisma.domainWord.updateMany({ data: { [task]: 'pending', [`whois_${tld}`]: 'pending' } });
      } else {
        await prisma.domainWord.updateMany({ data: { [task]: 'pending' } });
      }
      return res.json({ message: `Reset ${task}` });
    }

    if (action === 'rerun_errors') {
      await prisma.domainWord.updateMany({ where: { [task]: 'error' }, data: { [task]: 'pending' } });
      return res.json({ message: `Errors reset for ${task}` });
    }

    res.status(400).json({ error: 'Invalid action' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Control Error: ' + e.message });
  }
});

app.post('/api/generate', (req, res) => {
  const length = parseInt(req.body.length, 10);
  if (!length || length < 2 || length > 6) {
    return res.status(400).json({ error: 'Invalid length' });
  }

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
      currentTask: isRunning ? currentTask : null,
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
      result.dns.org[group.dns_org] = (result.dns.org[group.dns_org] || 0) + count;
      result.dns.in[group.dns_in] = (result.dns.in[group.dns_in] || 0) + count;

      // Only count whois as 'pending' if it has passed the DNS phase (nxdomain)
      if (group.whois_com === 'pending') {
        if (group.dns_com === 'nxdomain') {
          result.whois.com.pending = (result.whois.com.pending || 0) + count;
          whoisPendingCount += count;
        }
      } else {
        result.whois.com[group.whois_com] = (result.whois.com[group.whois_com] || 0) + count;
      }

      if (group.whois_org === 'pending') {
        if (group.dns_org === 'nxdomain') {
          result.whois.org.pending = (result.whois.org.pending || 0) + count;
          whoisPendingCount += count;
        }
      } else {
        result.whois.org[group.whois_org] = (result.whois.org[group.whois_org] || 0) + count;
      }

      if (group.whois_in === 'pending') {
        if (group.dns_in === 'nxdomain') {
          result.whois.in.pending = (result.whois.in.pending || 0) + count;
          whoisPendingCount += count;
        }
      } else {
        result.whois.in[group.whois_in] = (result.whois.in[group.whois_in] || 0) + count;
      }

      if (group.dns_com === 'pending') dnsPendingCount += count;
      if (group.dns_org === 'pending') dnsPendingCount += count;
      if (group.dns_in === 'pending') dnsPendingCount += count;
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

// START EXPRESS SERVER
app.listen(PORT, () => {
  console.log(`Dashboard listening on port ${PORT}`);
});

// -------------------------------------------------------------
// WORKER LOGIC
// -------------------------------------------------------------

let pendingQueue = [];
let currentTask = null;
let isRunning = false;

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
  if (!isRunning || !currentTask) {
    setTimeout(processNextDomain, 1000); // Idle loop
    return;
  }

  try {
    if (pendingQueue.length === 0) {
      let whereClause = {};
      if (currentTask.startsWith('dns_')) {
        whereClause[currentTask] = 'pending';
      } else if (currentTask.startsWith('whois_')) {
        const tld = currentTask.split('_')[1];
        whereClause[currentTask] = 'pending';
        whereClause[`dns_${tld}`] = 'nxdomain';
      }

      pendingQueue = await prisma.domainWord.findMany({
        where: whereClause,
        take: 100,
        orderBy: { id: 'asc' }
      });

      if (pendingQueue.length === 0) {
        console.log(`Task ${currentTask} complete or no pending items.`);
        currentTask = null;
        isRunning = false;
        setTimeout(processNextDomain, 1000);
        return;
      }
    }

    const wordObj = pendingQueue[0];
    const { id, word } = wordObj;
    
    let updatedData = {};
    let delayMs = 50;

    if (currentTask.startsWith('dns_')) {
      const tld = currentTask.split('_')[1];
      const status = await checkDns(`${word}.${tld}`);
      updatedData[currentTask] = status;
      if (status === 'taken') {
        updatedData[`whois_${tld}`] = 'skipped';
      }
      delayMs = 50; // Max speed for DNS
    } else if (currentTask.startsWith('whois_')) {
      const tld = currentTask.split('_')[1];
      const status = await checkWhois(`${word}.${tld}`);
      updatedData[currentTask] = status;
      delayMs = DELAY_MS; // Obey rate limits for WHOIS
    }

    // UPDATE DATABASE
    updatedData.last_checked = new Date();
    await prisma.domainWord.update({
      where: { id },
      data: updatedData
    });
    console.log(`[${currentTask}] Processed ${word} ->`, updatedData[currentTask]);

    // Unconditionally remove from memory queue so we always advance
    pendingQueue.shift();

    setTimeout(processNextDomain, delayMs);

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
