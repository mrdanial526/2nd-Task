/**
 * AeroGrid Frontend Interactive Cockpit Controller
 */

const API_BASE = '';

// DOM Elements
const dronesTableBody = document.getElementById('dronesTableBody');
const missionsTableBody = document.getElementById('missionsTableBody');
const dispatchDroneIdSelect = document.getElementById('dispatchDroneId');
const dispatchForm = document.getElementById('dispatchForm');
const resetDbBtn = document.getElementById('resetDbBtn');
const refreshFleetBtn = document.getElementById('refreshFleetBtn');
const refreshMissionsBtn = document.getElementById('refreshMissionsBtn');
const responseOutput = document.getElementById('responseOutput');
const responseStatusBadge = document.getElementById('responseStatusBadge');

// Top Stats
const statTotalDrones = document.getElementById('statTotalDrones');
const statActiveMissions = document.getElementById('statActiveMissions');
const statCompletedMissions = document.getElementById('statCompletedMissions');
const fleetCount = document.getElementById('fleetCount');

// Status simulator buttons
const test400Syntax = document.getElementById('test400Syntax');
const test422Expedited = document.getElementById('test422Expedited');
const test409State = document.getElementById('test409State');
const test404Drone = document.getElementById('test404Drone');
const test200Health = document.getElementById('test200Health');

// Helper to log server response into terminal
function logResponse(statusCode, data) {
  let badgeClass = 'badge-secondary';
  if (statusCode >= 200 && statusCode < 300) badgeClass = 'badge-success';
  else if (statusCode === 400 || statusCode === 404) badgeClass = 'badge-warning';
  else if (statusCode === 409 || statusCode === 422) badgeClass = 'badge-danger';
  else if (statusCode >= 500) badgeClass = 'badge-danger';

  responseStatusBadge.className = `badge badge-sm ${badgeClass}`;
  responseStatusBadge.textContent = `${statusCode} ${getStatusText(statusCode)}`;
  responseOutput.textContent = JSON.stringify(data, null, 2);
}

function getStatusText(code) {
  const map = {
    200: 'OK',
    201: 'Created',
    204: 'No Content',
    400: 'Bad Request',
    404: 'Not Found',
    409: 'Conflict',
    422: 'Unprocessable Entity',
    500: 'Internal Server Error',
  };
  return map[code] || 'Response';
}

// Fetch and render drones
async function loadDrones() {
  try {
    const res = await fetch(`${API_BASE}/drones`);
    const json = await res.json();
    const drones = json.data || [];

    statTotalDrones.textContent = drones.length;
    fleetCount.textContent = `${drones.length} Units`;

    // Populate dropdown
    dispatchDroneIdSelect.innerHTML = '<option value="">-- Choose Drone --</option>';
    drones.forEach((d) => {
      const opt = document.createElement('option');
      opt.value = d.id;
      opt.textContent = `${d.model} (${d.serialNumber}) - [${d.status}] - Bat: ${d.currentBatteryPercentage}% - Max: ${d.maxPayloadKg}kg`;
      if (d.status !== 'IDLE') opt.disabled = true;
      dispatchDroneIdSelect.appendChild(opt);
    });

    if (drones.length === 0) {
      dronesTableBody.innerHTML = '<tr><td colspan="6" class="text-center">No drones in registry.</td></tr>';
      return;
    }

    dronesTableBody.innerHTML = drones
      .map((d) => {
        let statusBadge = 'badge-secondary';
        if (d.status === 'IDLE') statusBadge = 'badge-success';
        else if (d.status === 'DISPATCHED' || d.status === 'IN_FLIGHT') statusBadge = 'badge-accent';
        else if (d.status === 'MAINTENANCE') statusBadge = 'badge-warning';

        return `
          <tr>
            <td><code>${d.id}</code></td>
            <td><strong>${d.serialNumber}</strong><br><small class="text-muted">${d.model}</small></td>
            <td>${d.currentBatteryPercentage}%</td>
            <td>${d.maxPayloadKg} kg</td>
            <td><span class="badge ${statusBadge}">${d.status}</span></td>
            <td>
              <button class="btn btn-xs btn-outline" onclick="viewDrone('${d.id}')">Inspect</button>
            </td>
          </tr>
        `;
      })
      .join('');
  } catch (err) {
    console.error('Error fetching drones:', err);
  }
}

// Fetch and render missions
async function loadMissions() {
  try {
    const res = await fetch(`${API_BASE}/deliveries`);
    const json = await res.json();
    const missions = json.data || [];

    const active = missions.filter((m) => m.state === 'DISPATCHED' || m.state === 'IN_FLIGHT').length;
    const completed = missions.filter((m) => m.state === 'DELIVERED').length;

    statActiveMissions.textContent = active;
    statCompletedMissions.textContent = completed;

    if (missions.length === 0) {
      missionsTableBody.innerHTML = '<tr><td colspan="6" class="text-center">No missions found.</td></tr>';
      return;
    }

    missionsTableBody.innerHTML = missions
      .map((m) => {
        let stateBadge = 'badge-secondary';
        if (m.state === 'DISPATCHED') stateBadge = 'badge-warning';
        else if (m.state === 'IN_FLIGHT') stateBadge = 'badge-accent';
        else if (m.state === 'DELIVERED') stateBadge = 'badge-success';
        else if (m.state === 'ABORTED') stateBadge = 'badge-danger';

        let actionButtons = '';
        if (m.state === 'DISPATCHED') {
          actionButtons = `
            <button class="btn btn-xs btn-primary" onclick="transitionMission('${m.id}', 'IN_FLIGHT')">Launch (IN_FLIGHT)</button>
            <button class="btn btn-xs btn-outline" onclick="transitionMission('${m.id}', 'ABORTED')">Abort</button>
          `;
        } else if (m.state === 'IN_FLIGHT') {
          actionButtons = `
            <button class="btn btn-xs btn-success" onclick="transitionMission('${m.id}', 'DELIVERED')">Deliver (DELIVERED)</button>
            <button class="btn btn-xs btn-outline" onclick="transitionMission('${m.id}', 'ABORTED')">Abort</button>
          `;
        } else {
          actionButtons = `<button class="btn btn-xs btn-outline" onclick="deleteMission('${m.id}')">Delete (204)</button>`;
        }

        return `
          <tr>
            <td><code>${m.id}</code><br><small class="text-muted">${m.packageDetails?.trackingCode || ''}</small></td>
            <td><code>${m.droneId}</code></td>
            <td><span class="badge badge-info">${m.priority}</span></td>
            <td>${m.packageDetails?.weightKg} kg</td>
            <td><span class="badge ${stateBadge}">${m.state}</span></td>
            <td><div class="btn-group-wrap">${actionButtons}</div></td>
          </tr>
        `;
      })
      .join('');
  } catch (err) {
    console.error('Error fetching missions:', err);
  }
}

// Inspect drone
window.viewDrone = async (id) => {
  const res = await fetch(`${API_BASE}/drones/${id}`);
  const json = await res.json();
  logResponse(res.status, json);
};

// Transition mission state
window.transitionMission = async (id, targetState) => {
  const res = await fetch(`${API_BASE}/deliveries/${id}/state`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ targetState, reason: `Manual cockpit operator transition to ${targetState}` }),
  });
  const json = await res.json();
  logResponse(res.status, json);
  loadDrones();
  loadMissions();
};

// Delete mission
window.deleteMission = async (id) => {
  const res = await fetch(`${API_BASE}/deliveries/${id}`, { method: 'DELETE' });
  logResponse(res.status, { message: `Mission ${id} deleted (204 No Content)` });
  loadDrones();
  loadMissions();
};

// Handle Dispatch Form Submit
dispatchForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const payload = {
    droneId: document.getElementById('dispatchDroneId').value,
    priority: document.getElementById('dispatchPriority').value,
    destination: {
      address: document.getElementById('dispatchAddress').value,
      latitude: parseFloat(document.getElementById('dispatchLat').value),
      longitude: parseFloat(document.getElementById('dispatchLon').value),
      altitudeMeters: parseFloat(document.getElementById('dispatchAlt').value),
    },
    packageDetails: {
      trackingCode: `PKG-2026-${Math.floor(1000 + Math.random() * 9000)}`,
      weightKg: parseFloat(document.getElementById('dispatchWeight').value),
      isFragile: document.getElementById('dispatchFragile').checked,
      category: document.getElementById('dispatchCategory').value,
    },
  };

  const res = await fetch(`${API_BASE}/deliveries`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const json = await res.json();
  logResponse(res.status, json);

  loadDrones();
  loadMissions();
});

// Quick Simulators
test400Syntax.addEventListener('click', async () => {
  const res = await fetch(`${API_BASE}/deliveries`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      droneId: 'drn_101',
      destination: { address: 'Bad', latitude: 199.9, longitude: 0, altitudeMeters: 999 },
      packageDetails: { trackingCode: 'BAD', weightKg: -1 },
    }),
  });
  const json = await res.json();
  logResponse(res.status, json);
});

test422Expedited.addEventListener('click', async () => {
  const res = await fetch(`${API_BASE}/deliveries`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      droneId: 'drn_101',
      priority: 'EXPEDITED',
      destination: { address: '742 Evergreen Terrace', latitude: 37.77, longitude: -122.41, altitudeMeters: 100 },
      packageDetails: { trackingCode: 'PKG-2026-9900', weightKg: 18.5, isFragile: false, category: 'GENERAL_CARGO' },
    }),
  });
  const json = await res.json();
  logResponse(res.status, json);
});

test409State.addEventListener('click', async () => {
  // Try illegal hop from IDLE/DISPATCHED directly to DELIVERED
  const res = await fetch(`${API_BASE}/deliveries/del_201/state`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ targetState: 'DELIVERED' }),
  });
  const json = await res.json();
  logResponse(res.status, json);
});

test404Drone.addEventListener('click', async () => {
  const res = await fetch(`${API_BASE}/drones/drn_ghost_missing_999`);
  const json = await res.json();
  logResponse(res.status, json);
});

test200Health.addEventListener('click', async () => {
  const res = await fetch(`${API_BASE}/api/v1/health`);
  const json = await res.json();
  logResponse(res.status, json);
});

// Reset System
resetDbBtn.addEventListener('click', async () => {
  const res = await fetch(`${API_BASE}/api/v1/system/reset`, { method: 'POST' });
  const json = await res.json();
  logResponse(res.status, json);
  loadDrones();
  loadMissions();
});

refreshFleetBtn.addEventListener('click', loadDrones);
refreshMissionsBtn.addEventListener('click', loadMissions);

// Initial Load
loadDrones();
loadMissions();
