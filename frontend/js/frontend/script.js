// CricScore Pro Logic - Multi-Page Version

// Automatically detect if we are local or deployed
const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.protocol === 'file:';
const API_BASE = isLocal
    ? (window.location.port === '8080' ? '/api' : 'http://127.0.0.1:8080/api')
    : `${window.location.origin}/api`;

let currentUser = localStorage.getItem('username');
let authToken = localStorage.getItem('authToken');

function showLoader() {
    const loader = document.getElementById('globalLoader');
    if (loader) {
        loader.classList.remove('hidden');
    }
}

function hideLoader() {
    const loader = document.getElementById('globalLoader');
    if (loader) {
        loader.classList.add('hidden');
    }
}

// Hide loader on initial page load once content is ready
document.addEventListener('DOMContentLoaded', () => {
    // Initial hide with a slight delay for that premium feel
    setTimeout(hideLoader, 800);
});

// Custom Alert/Confirm Functions
function showAlert(message, title = 'Notification') {
    return new Promise((resolve) => {
        const modal = document.getElementById('notificationModal');
        const titleEl = document.getElementById('notificationTitle');
        const messageEl = document.getElementById('notificationMessage');
        const okBtn = document.getElementById('notificationOk');
        const cancelBtn = document.getElementById('notificationCancel');

        titleEl.innerText = title;
        messageEl.innerText = message;
        cancelBtn.style.display = 'none';
        modal.style.display = 'flex';

        const handleOk = () => {
            modal.style.display = 'none';
            okBtn.removeEventListener('click', handleOk);
            resolve(true);
        };

        okBtn.onclick = handleOk;
    });
}

function showConfirm(message, title = 'Confirm') {
    return new Promise((resolve) => {
        const modal = document.getElementById('notificationModal');
        const titleEl = document.getElementById('notificationTitle');
        const messageEl = document.getElementById('notificationMessage');
        const okBtn = document.getElementById('notificationOk');
        const cancelBtn = document.getElementById('notificationCancel');

        titleEl.innerText = title;
        messageEl.innerText = message;
        okBtn.innerText = 'Yes';
        cancelBtn.innerText = 'No';
        cancelBtn.style.display = 'block';
        modal.style.display = 'flex';

        const handleOk = () => {
            modal.style.display = 'none';
            okBtn.innerText = 'OK';
            resolve(true);
        };

        const handleCancel = () => {
            modal.style.display = 'none';
            okBtn.innerText = 'OK';
            resolve(false);
        };

        okBtn.onclick = handleOk;
        cancelBtn.onclick = handleCancel;
    });
}


// Helper to handle API responses safely
async function apiCall(endpoint, options = {}) {
    showLoader();
    try {
        const response = await fetch(API_BASE + endpoint, {
            ...options,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': authToken,
                ...options.headers
            }
        });

        const contentType = response.headers.get("content-type");
        if (contentType && contentType.indexOf("application/json") !== -1) {
            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.detail || data.message || "An unknown error occurred");
            }
            return data;
        } else {
            if (!response.ok) {
                throw new Error(`Server error: ${response.status} ${response.statusText}`);
            }
            const text = await response.text();
            console.error("Non-JSON response received:", text);
            throw new Error("Backend Server returned unexpected format. Check backend logs.");
        }
    } finally {
        hideLoader();
    }
}

// Global Game State
let gameState = {
    teamA: '', teamB: '', maxOvers: 0, currentInnings: 1, toss: '',
    innings: [null,
        { teamName: '', runs: 0, wickets: 0, balls: 0, batters: [], bowlers: [], extras: { wd: 0, nb: 0, lb: 0, b: 0, total: 0 }, fow: [], strikerIdx: 0, nonStrikerIdx: 1, bowlerIdx: 0, partnershipRuns: 0, partnershipBalls: 0 },
        { teamName: '', runs: 0, wickets: 0, balls: 0, batters: [], bowlers: [], extras: { wd: 0, nb: 0, lb: 0, b: 0, total: 0 }, fow: [], strikerIdx: 0, nonStrikerIdx: 1, bowlerIdx: 0, partnershipRuns: 0, partnershipBalls: 0 }
    ],
    target: null, viewingInnings: 1,
    freeHit: false,
    drsTeamA: 2,
    drsTeamB: 2,
    matchStatus: 'live', // 'live', 'break', 'lunch', 'stumps', 'draw'
    isSuperOver: false
};

let thisOverBalls = [];

// Auth Logic
// Auth Logic
async function handleLogin() {
    const e = document.getElementById('loginEmail').value;
    const p = document.getElementById('loginPassword').value;
    if (!e || !p) return showAlert('Email and Password required', 'Login Error');
    if (p.length !== 8) return showAlert('Password must be exactly 8 characters long', 'Password Error');

    try {
        const data = await apiCall('/login', {
            method: 'POST',
            body: JSON.stringify({ email: e, password: p })
        });

        localStorage.setItem('authToken', data.token);
        localStorage.setItem('username', data.username);
        window.location.href = 'dashboard.html';
    } catch (err) { showAlert(err.message, 'Login Error'); }
}

async function handleSignup() {
    const n = document.getElementById('signupName').value;
    const e = document.getElementById('signupEmail').value;
    const p = document.getElementById('signupPassword').value;
    if (!n || !e || !p) return showAlert('All fields required', 'Signup Error');
    if (p.length !== 8) return showAlert('Password must be exactly 8 characters long', 'Password Error');

    try {
        await apiCall('/signup', {
            method: 'POST',
            body: JSON.stringify({ name: n, email: e, password: p })
        });
        await showAlert('Signup Success! Please Login.', 'Success');
        window.location.href = 'login.html';
    } catch (err) { showAlert(err.message, 'Signup Error'); }
}

function logout() {
    localStorage.clear();
    window.location.href = 'login.html';
}

// Page Load Logic
window.onload = () => {
    const path = window.location.pathname;
    if (path.includes('dashboard.html')) {
        if (!authToken) window.location.href = 'login.html';
        const welcomeEl = document.getElementById('userWelcome');
        if (welcomeEl) welcomeEl.innerText = `Welcome, ${currentUser}!`;

        // Dynamic Toss Options Logic
        const teamAInput = document.getElementById('teamA');
        const teamBInput = document.getElementById('teamB');
        const tossSelect = document.getElementById('tossWinner');

        function updateTossOptions() {
            if (tossSelect && teamAInput && teamBInput) {
                const valA = teamAInput.value || 'Team A';
                const valB = teamBInput.value || 'Team B';
                tossSelect.options[0].text = valA;
                tossSelect.options[0].value = valA;
                tossSelect.options[1].text = valB;
                tossSelect.options[1].value = valB;
            }
        }

        if (teamAInput) teamAInput.addEventListener('input', updateTossOptions);
        if (teamBInput) teamBInput.addEventListener('input', updateTossOptions);
    } else if (path.includes('login.html') || path.includes('signup.html')) {
        if (authToken) window.location.href = 'dashboard.html';
    } else {
        // Root redirect - check if we are at index.html in the root of the app
        window.location.href = authToken ? 'pages/dashboard.html' : 'pages/login.html';
    }
};

// --- CRICKET LOGIC --- (Reused from previous version)

// --- CRICKET LOGIC --- (Reused from previous version)

function goToSquadSetup() {
    const tA = document.getElementById('teamA').value;
    const tB = document.getElementById('teamB').value;
    const ov = document.getElementById('totalOvers').value;

    if (!tA || !tB || !ov) return showAlert('Fill all fields!', 'Setup Error');

    gameState.teamA = tA;
    gameState.teamB = tB;
    gameState.maxOvers = parseInt(ov);

    // Store Toss info early
    const tossW = document.getElementById('tossWinner').value;
    const tossD = document.querySelector('input[name="tossDecision"]:checked').value;
    const tossWinnerName = tossW;

    gameState.tossData = { winner: tossWinnerName, decision: tossD };

    document.getElementById('squadTeamALabel').innerText = tA;
    document.getElementById('squadTeamBLabel').innerText = tB;

    switchScreen('squadScreen');
    generateSquadInputs(true);
}

function generateSquadInputs(preserve = false) {
    const count = parseInt(document.getElementById('playersPerTeam').value) || 11;
    const divA = document.getElementById('teamAInputs');
    const divB = document.getElementById('teamBInputs');

    // Save current values if possible
    let existingA = {};
    let existingB = {};

    if (preserve || divA.children.length > 0) {
        Array.from(divA.querySelectorAll('input')).forEach(inp => {
            const id = inp.id.split('_p')[1];
            if (id) existingA[id] = inp.value;
        });
        Array.from(divB.querySelectorAll('input')).forEach(inp => {
            const id = inp.id.split('_p')[1];
            if (id) existingB[id] = inp.value;
        });
    }

    divA.innerHTML = '';
    divB.innerHTML = '';

    for (let i = 1; i <= count; i++) {
        const valA = existingA[i] || '';
        const valB = existingB[i] || '';

        divA.innerHTML += `<input type="text" id="teamA_p${i}" value="${valA}" placeholder="Player ${i}" class="input-style" style="margin-bottom:0.5rem; background:rgba(255,255,255,0.05); padding:0.5rem; border-radius:4px; border:1px solid rgba(255,255,255,0.1); color:white;">`;
        divB.innerHTML += `<input type="text" id="teamB_p${i}" value="${valB}" placeholder="Player ${i}" class="input-style" style="margin-bottom:0.5rem; background:rgba(255,255,255,0.05); padding:0.5rem; border-radius:4px; border:1px solid rgba(255,255,255,0.1); color:white;">`;
    }
}

function goToPlayerSelection() {
    const count = parseInt(document.getElementById('playersPerTeam').value) || 11;
    gameState.squads = { A: [], B: [] };

    for (let i = 1; i <= count; i++) {
        const pA = document.getElementById(`teamA_p${i}`).value || `Player A${i}`;
        const pB = document.getElementById(`teamB_p${i}`).value || `Player B${i}`;
        gameState.squads.A.push(pA);
        gameState.squads.B.push(pB);
    }

    // Config Dropdowns
    const tA = gameState.teamA;
    const tB = gameState.teamB;
    const tossW = gameState.tossData.winner;
    const tossD = gameState.tossData.decision;

    // Determine Batting Team
    const battingTeam = (tossD === 'Bat') ? tossW : (tossW === tA ? tB : tA);
    const bowlingTeam = (battingTeam === tA) ? tB : tA;

    gameState.battingTeamName = battingTeam;
    gameState.bowlingTeamName = bowlingTeam;

    document.getElementById('battingTeamName').innerText = battingTeam;
    document.getElementById('bowlingTeamName').innerText = bowlingTeam;

    const batSquad = (battingTeam === tA) ? gameState.squads.A : gameState.squads.B;
    const bowlSquad = (bowlingTeam === tA) ? gameState.squads.A : gameState.squads.B;

    const fillSelect = (id, squad) => {
        const sel = document.getElementById(id);
        sel.innerHTML = '';
        squad.forEach(p => {
            const opt = document.createElement('option');
            opt.value = p;
            opt.innerText = p;
            sel.appendChild(opt);
        });
    };

    fillSelect('selectStriker', batSquad);
    fillSelect('selectNonStriker', batSquad);
    fillSelect('selectBowler', bowlSquad);

    // Default selection for non-striker to be different if possible
    if (batSquad.length > 1) {
        document.getElementById('selectNonStriker').selectedIndex = 1;
    }

    switchScreen('selectionScreen');
}

function startMatchFinal() {
    const s1 = document.getElementById('selectStriker').value;
    const s2 = document.getElementById('selectNonStriker').value;
    const b1 = document.getElementById('selectBowler').value;

    if (s1 === s2) return showAlert('Striker and Non-Striker cannot be the same!', 'Error');

    // Initialize Game State
    gameState.toss = `${gameState.tossData.winner} won the toss and elected to ${gameState.tossData.decision}`;
    document.getElementById('tossInfo').innerText = gameState.toss;

    const battingTeam = gameState.battingTeamName;
    const bowlingTeam = gameState.bowlingTeamName;

    gameState.innings[1].teamName = battingTeam;
    gameState.innings[2].teamName = bowlingTeam;

    gameState.innings[1].batters = [
        { name: s1, runs: 0, balls: 0, fours: 0, sixes: 0, outDesc: 'not out', isOut: false },
        { name: s2, runs: 0, balls: 0, fours: 0, sixes: 0, outDesc: 'not out', isOut: false }
    ];
    gameState.innings[1].bowlers = [{ name: b1, balls: 0, maidens: 0, runs: 0, wickets: 0 }];

    document.getElementById('displayTeams').innerText = `${gameState.teamA} vs ${gameState.teamB}`;
    document.getElementById('maxOvers').innerText = gameState.maxOvers;

    switchScreen('matchScreen');
    updateDisplay();
}

async function addRuns(run) {
    const inn = gameState.innings[gameState.currentInnings];
    inn.runs += run; inn.balls++;
    inn.batters[inn.strikerIdx].runs += run;
    inn.batters[inn.strikerIdx].balls++;
    inn.bowlers[inn.bowlerIdx].runs += run;
    inn.bowlers[inn.bowlerIdx].balls++;
    inn.partnershipRuns += run;
    inn.partnershipBalls++;
    if (run === 4) inn.batters[inn.strikerIdx].fours++;
    if (run === 6) inn.batters[inn.strikerIdx].sixes++;
    thisOverBalls.push({ type: 'run', value: run, label: run === 0 ? '.' : run.toString() });
    if (run % 2 !== 0) rotateStrike();

    // Clear Free Hit after the ball
    if (gameState.freeHit) gameState.freeHit = false;

    await checkOverEnd();
    updateDisplay();
    await checkInningsEnd();
}

async function addExtra(type) {
    const inn = gameState.innings[gameState.currentInnings];
    inn.runs++; inn.extras.total++;
    inn.partnershipRuns++;
    if (type === 'WD') inn.extras.wd++;
    else {
        inn.extras.nb++;
        gameState.freeHit = true; // Next ball is Free Hit
        await showAlert('🎯 FREE HIT! Next ball is a Free Hit.', 'Free Hit');
    }
    inn.bowlers[inn.bowlerIdx].runs++;
    thisOverBalls.push({ type: 'extra', value: type, label: type });
    updateDisplay();
    await checkInningsEnd();
}

function addWicket() { document.getElementById('wicketModal').style.display = 'flex'; }
function closeWicketModal() { document.getElementById('wicketModal').style.display = 'none'; }

function requestInput(title, placeholder) {
    return new Promise((resolve) => {
        document.getElementById('inputModalTitle').innerText = title;
        const input = document.getElementById('genericInput');
        const modal = document.getElementById('inputModal');
        input.value = '';
        input.placeholder = placeholder;
        modal.style.display = 'flex';
        input.focus();

        const submit = document.getElementById('inputModalSubmit');
        const handle = () => {
            const val = input.value;
            modal.style.display = 'none';
            input.removeEventListener('keypress', keyHandle);
            resolve(val);
        };

        const keyHandle = (e) => {
            if (e.key === 'Enter') handle();
        };

        submit.onclick = handle;
        input.addEventListener('keypress', keyHandle);
    });
}

// Bulk Input Logic
let currentBulkTeam = '';

function showBulkInput(team) {
    currentBulkTeam = team;
    document.getElementById('bulkInputModal').style.display = 'flex';
    document.getElementById('bulkInputText').value = '';
    setTimeout(() => document.getElementById('bulkInputText').focus(), 100);
}

function closeBulkModal() {
    document.getElementById('bulkInputModal').style.display = 'none';
}

function processBulkInput() {
    const text = document.getElementById('bulkInputText').value;
    if (!text) return closeBulkModal();

    // Split by newline or comma
    const names = text.split(/\r?\n|,/).map(n => n.trim()).filter(n => n.length > 0);

    if (names.length === 0) return closeBulkModal();

    const count = parseInt(document.getElementById('playersPerTeam').value) || 11;
    const teamPrefix = currentBulkTeam === 'A' ? 'teamA_p' : 'teamB_p';

    for (let i = 0; i < count; i++) {
        if (i < names.length) {
            const input = document.getElementById(`${teamPrefix}${i + 1}`);
            if (input) input.value = names[i];
        }
    }

    showAlert(`Auto-filled ${Math.min(names.length, count)} names for Team ${currentBulkTeam}`, 'Success');
    closeBulkModal();
}

async function handleWicketSelect(type) {
    // Free Hit: Only Run Out allowed
    if (gameState.freeHit && type !== 'Run Out' && type !== 'Retired Hurt') {
        await showAlert('⚠️ FREE HIT! Batter cannot be dismissed except by Run Out.', 'Free Hit');
        closeWicketModal();
        return;
    }

    closeWicketModal();
    const inn = gameState.innings[gameState.currentInnings];
    let outIdx = inn.strikerIdx;

    // Determine who is involved
    if (type === 'Run Out' || type === 'Retired Hurt') {
        const title = type === 'Run Out' ? 'Run Out' : 'Retired Hurt';
        outIdx = await showConfirm(`Is Striker (${inn.batters[inn.strikerIdx].name}) the one?`, title) ? inn.strikerIdx : inn.nonStrikerIdx;
    }

    const bOut = inn.batters[outIdx];

    // Reset partnership
    inn.partnershipRuns = 0;
    inn.partnershipBalls = 0;

    const bowler = inn.bowlers[inn.bowlerIdx];

    if (type === 'Retired Hurt') {
        bOut.outDesc = "retired hurt";
        bOut.isOut = true; // Treated as 'out' for display purposes (left the crease)
        // Do NOT increment team wickets or bowler wickets
        await showAlert(`${bOut.name} Retired Hurt.`, 'Retired');
    } else {
        // Standard Wicket
        inn.wickets++;
        bOut.isOut = true;

        if (type !== 'Run Out') {
            bOut.balls++;
            let fielder = '';
            if (type === 'Caught' || type === 'Stumped') {
                const label = type === 'Caught' ? 'Fielder Name' : 'Wicket Keeper Name';
                fielder = await requestInput(label, 'Enter name');
            }

            if (type === 'Bowled') bOut.outDesc = `b ${bowler.name}`;
            else if (type === 'Caught') bOut.outDesc = `c ${fielder || 'Fielder'} b ${bowler.name}`;
            else if (type === 'Stumped') bOut.outDesc = `st ${fielder || 'Keeper'} b ${bowler.name}`;
            else if (type === 'LBW') bOut.outDesc = `lbw b ${bowler.name}`;
            else bOut.outDesc = `${type} b ${bowler.name}`;

            bowler.wickets++;
            bowler.balls++;
            inn.balls++;
        } else {
            let fielder = await requestInput('Run Out By (Fielder)', 'Enter name');
            bOut.outDesc = `run out (${fielder || 'Fielder'})`;
            bowler.balls++;
            inn.balls++;
        }
    }

    // Clear Free Hit after wicket (except retired hurt maybe? but let's clear it for simplicity or keep it if retired hurt shouldn't consume it. Let's consume it to be safe)
    if (gameState.freeHit) gameState.freeHit = false;

    const label = type === 'Retired Hurt' ? 'Ret' : 'W';
    thisOverBalls.push({ type: 'wicket', value: label, label: label });

    if (inn.wickets < 10) { // Always ask for new batter unless all out
        let n = await requestInput('New Batter Name', 'Enter name');
        // Logic to pick from squad if available, else manual
        // For now manual entry or from remaining squad logic could be added later

        inn.batters.push({ name: n || `Batter ${inn.batters.length + 1}`, runs: 0, balls: 0, fours: 0, sixes: 0, outDesc: 'not out', isOut: false });
        if (outIdx === inn.strikerIdx) inn.strikerIdx = inn.batters.length - 1;
        else inn.nonStrikerIdx = inn.batters.length - 1;
    }
    updateDisplay();
    await checkOverEnd();
    await checkInningsEnd();
}

function rotateStrike() {
    const inn = gameState.innings[gameState.currentInnings];
    [inn.strikerIdx, inn.nonStrikerIdx] = [inn.nonStrikerIdx, inn.strikerIdx];
}

async function checkOverEnd() {
    const inn = gameState.innings[gameState.currentInnings];
    // Check if innings ended (Max overs or All out)
    if (inn.balls >= gameState.maxOvers * 6 || inn.wickets >= 10) return;

    if (inn.balls > 0 && inn.balls % 6 === 0) {
        await showAlert('Over Complete!', 'Over End');
        rotateStrike();

        let validBowler = false;
        let newBowlerName = '';
        let newBowlerIdx = -1;

        // Prevent same bowler from bowling consecutive overs
        const currentBowlerName = inn.bowlers[inn.bowlerIdx].name;

        while (!validBowler) {
            newBowlerName = await requestInput('Next Bowler Name', 'Enter Name');
            if (!newBowlerName) newBowlerName = 'Bowler ' + (inn.bowlers.length + 1);

            // Check if same bowler
            if (newBowlerName.trim().toLowerCase() === currentBowlerName.trim().toLowerCase() && inn.bowlers.length > 1) {
                await showAlert(`🚫 ${currentBowlerName} cannot bowl consecutive overs!`, 'Rule Violation');
            } else {
                validBowler = true;
            }
        }

        let idx = inn.bowlers.findIndex(b => b.name.trim().toLowerCase() === newBowlerName.trim().toLowerCase());
        if (idx === -1) {
            inn.bowlers.push({ name: newBowlerName, balls: 0, maidens: 0, runs: 0, wickets: 0 });
            idx = inn.bowlers.length - 1;
        }

        inn.bowlerIdx = idx;
        thisOverBalls = [];
        updateDisplay();
    }
}

function updateDisplay() {
    const inn = gameState.innings[gameState.currentInnings];
    document.getElementById('runs').innerText = inn.runs;
    document.getElementById('wickets').innerText = inn.wickets;
    document.getElementById('oversCompleted').innerText = Math.floor(inn.balls / 6);
    document.getElementById('ballsInOver').innerText = inn.balls % 6;
    document.getElementById('maxOvers').innerText = gameState.maxOvers;
    document.getElementById('displayTeams').innerText = `${gameState.teamA} vs ${gameState.teamB}`;

    // Free Hit Indicator
    const freeHitEl = document.getElementById('freeHitIndicator');
    if (freeHitEl) {
        freeHitEl.style.display = gameState.freeHit ? 'block' : 'none';
    }

    // DRS Counts
    const drsAEl = document.getElementById('drsTeamACount');
    const drsBEl = document.getElementById('drsTeamBCount');
    if (drsAEl) drsAEl.innerText = gameState.drsTeamA;
    if (drsBEl) drsBEl.innerText = gameState.drsTeamB;

    // Run Rate Calculations
    const crr = inn.balls > 0 ? (inn.runs / (inn.balls / 6)).toFixed(2) : '0.00';
    document.getElementById('crr').innerText = crr;

    if (gameState.currentInnings === 2 && gameState.target) {
        const ballsLeft = (gameState.maxOvers * 6) - inn.balls;
        const runsToWin = gameState.target - inn.runs;
        if (ballsLeft > 0) {
            const rrr = (runsToWin / (ballsLeft / 6)).toFixed(2);
            document.getElementById('rrr').innerText = rrr;
            document.getElementById('rrrContainer').style.display = 'inline';
        }
    }

    // Partnership Update
    document.getElementById('currentPartnership').innerText = `${inn.partnershipRuns} (${inn.partnershipBalls})`;

    if (inn.strikerIdx !== -1) {
        document.getElementById('strikerName').innerText = inn.batters[inn.strikerIdx].name + '*';
        document.getElementById('strikerRuns').innerText = `${inn.batters[inn.strikerIdx].runs}(${inn.batters[inn.strikerIdx].balls})`;
    }
    if (inn.nonStrikerIdx !== -1) {
        document.getElementById('nonStrikerName').innerText = inn.batters[inn.nonStrikerIdx].name;
        document.getElementById('nonStrikerRuns').innerText = `${inn.batters[inn.nonStrikerIdx].runs}(${inn.batters[inn.nonStrikerIdx].balls})`;
    }
    const b = inn.bowlers[inn.bowlerIdx];
    document.getElementById('bowlerName').innerText = b.name;
    document.getElementById('bowlerStats').innerText = `${b.wickets}-${b.runs} (${Math.floor(b.balls / 6)}.${b.balls % 6} ov)`;

    // Scorecard Update
    const vI = gameState.innings[gameState.viewingInnings];
    let bHtml = '';
    if (vI && Array.isArray(vI.batters)) {
        vI.batters.forEach((bat, i) => {
            const sr = bat.balls > 0 ? (bat.runs / bat.balls * 100).toFixed(2) : '0.00';
            const nameDisplay = `${bat.name}${i === vI.strikerIdx && gameState.currentInnings === gameState.viewingInnings ? '*' : ''}`;
            const outDescDisplay = bat.isOut ? `<div style="font-size: 0.7rem; color: var(--text-secondary);">${bat.outDesc}</div>` : (bat.outDesc === 'not out' ? '<div style="font-size: 0.7rem; color: var(--primary-color);">not out</div>' : '');

            bHtml += `<tr>
                <td>
                    <div style="font-weight: 600;">${nameDisplay}</div>
                    ${outDescDisplay}
                </td>
                <td>${bat.runs}</td>
                <td>${bat.balls}</td>
                <td>${bat.fours}</td>
                <td>${bat.sixes}</td>
                <td>${sr}</td>
            </tr>`;
        });
    }
    document.getElementById('battingBody').innerHTML = bHtml;
    document.getElementById('extrasValue').innerText = vI ? vI.extras.total : 0;
    document.getElementById('totalScoreValue').innerText = vI ? `${vI.runs}/${vI.wickets} (${Math.floor(vI.balls / 6)}.${vI.balls % 6} ov)` : '0/0';

    let bowlHtml = '';
    if (vI && Array.isArray(vI.bowlers)) {
        vI.bowlers.forEach(bowl => {
            const eco = bowl.balls > 0 ? (bowl.runs / (bowl.balls / 6)).toFixed(2) : '0.00';
            bowlHtml += `<tr><td>${bowl.name}</td><td>${Math.floor(bowl.balls / 6)}.${bowl.balls % 6}</td><td>${bowl.maidens}</td><td>${bowl.runs}</td><td>${bowl.wickets}</td><td>${eco}</td></tr>`;
        });
    }
    document.getElementById('bowlingBody').innerHTML = bowlHtml;
}

async function checkInningsEnd() {
    const inn = gameState.innings[gameState.currentInnings];
    if (gameState.currentInnings === 2 && gameState.target && inn.runs >= gameState.target) return endMatchManually();
    if (inn.balls >= gameState.maxOvers * 6 || inn.wickets >= 10) {
        if (gameState.currentInnings === 1) {
            gameState.target = inn.runs + 1;
            const reason = inn.wickets >= 10 ? 'All Out!' : 'Overs Completed!';
            await showAlert(`${reason}\nTarget: ${gameState.target}\n\nStarting 2nd Innings...`, 'Innings Break');
            setTimeout(() => startSecondInnings(), 2000);
        } else endMatchManually();
    }
}

function switchScorecard(innNum) {
    if (!gameState.innings[innNum]) return;
    gameState.viewingInnings = innNum;
    document.querySelectorAll('.innings-tabs .tab').forEach(t => t.classList.remove('active'));
    const tab = document.getElementById(`tabInnings${innNum}`);
    if (tab) tab.classList.add('active');
    updateDisplay();
}

async function startSecondInnings() {
    gameState.currentInnings = 2;
    gameState.innings[2] = {
        runs: 0, wickets: 0, balls: 0,
        batters: [], bowlers: [],
        bowlerIdx: 0, strikerIdx: 0, nonStrikerIdx: 1,
        partnershipRuns: 0, partnershipBalls: 0,
        extras: { total: 0, wd: 0, nb: 0, byes: 0, lb: 0 }
    };
    const inn = gameState.innings[2];
    inn.teamName = gameState.teamB;

    const opener1 = await requestInput('Opener 1 Name', 'Enter name');
    const opener2 = await requestInput('Opener 2 Name', 'Enter name');
    const bowler = await requestInput('Opening Bowler Name', 'Enter name');

    inn.batters = [
        { name: opener1 || 'Batter 1', runs: 0, balls: 0, fours: 0, sixes: 0, outDesc: 'not out', isOut: false },
        { name: opener2 || 'Batter 2', runs: 0, balls: 0, fours: 0, sixes: 0, outDesc: 'not out', isOut: false }
    ];
    inn.bowlers = [{ name: bowler || 'Bowler', balls: 0, maidens: 0, runs: 0, wickets: 0 }];
    document.getElementById('nextInningsBtn').style.display = 'none';
    thisOverBalls = [];

    switchScorecard(2);
}

function endMatchManually() { calculateResult(); switchScreen('resultScreen'); }

async function calculateResult() {
    const s1 = gameState.innings[1]; const s2 = gameState.innings[2];
    let res = (s2.runs >= gameState.target) ? `${gameState.teamB} wins` : (s1.runs > s2.runs) ? `${gameState.teamA} wins` : "Match Tie";
    document.getElementById('matchOutcome').innerText = res.toUpperCase();

    // Show Super Over button if match is tied
    const superOverBtn = document.getElementById('superOverBtn');
    if (superOverBtn && res === "Match Tie") {
        superOverBtn.style.display = 'block';
    }

    try {
        await apiCall('/matches', {
            method: 'POST',
            body: JSON.stringify({ teamA: gameState.teamA, teamB: gameState.teamB, scoreData: gameState.innings, result: res })
        });
    } catch (err) { console.error("Could not save match to DB:", err.message); }
}

let matchHistoryData = [];

async function showHistory() {
    try {
        const response = await apiCall('/matches');

        // Use a local variable for iteration to be ultra-safe
        const matches = Array.isArray(response) ? response : [];
        matchHistoryData = matches; // Still update global for detail view

        if (!Array.isArray(response)) {
            console.error("Expected array for matches, received:", typeof response, response);
        }

        let hHtml = '';
        if (matches.length === 0) {
            hHtml = '<div class="history-item">No matches played yet.</div>';
        }

        let playerRuns = {};
        let playerWkts = {};

        matches.forEach((m, idx) => {
            hHtml += `<div class="history-item" onclick="showMatchDetail(${idx})"><b>${m.team_a} vs ${m.team_b}</b><br>${m.result}</div>`;

            // Extract stats from match data
            const data = m.score_data;
            if (data && typeof data === 'object') {
                [1, 2].forEach(innIdx => {
                    const inn = data[innIdx];
                    if (inn) {
                        if (Array.isArray(inn.batters)) {
                            inn.batters.forEach(b => {
                                playerRuns[b.name] = (playerRuns[b.name] || 0) + b.runs;
                            });
                        }
                        if (Array.isArray(inn.bowlers)) {
                            inn.bowlers.forEach(bw => {
                                playerWkts[bw.name] = (playerWkts[bw.name] || 0) + bw.wickets;
                            });
                        }
                    }
                });
            }
        });

        // Top Performers Logic
        let topB = Object.keys(playerRuns).reduce((a, b) => playerRuns[a] > playerRuns[b] ? a : b, null);
        let topW = Object.keys(playerWkts).reduce((a, b) => playerWkts[a] > playerWkts[b] ? a : b, null);

        if (topB) {
            document.getElementById('topBatsman').innerText = `${topB} (${playerRuns[topB]} Runs)`;
            document.getElementById('topBowler').innerText = `${topW} (${playerWkts[topW]} Wkts)`;
            document.getElementById('statsSection').style.display = 'block';
        }

        document.getElementById('historyList').innerHTML = hHtml;
        switchScreen('historyScreen');
    } catch (err) { showAlert('Error loading history: ' + err.message, 'Error'); }
}

function showMatchDetail(idx) {
    const m = matchHistoryData[idx];
    document.getElementById('detailMatchTitle').innerText = `${m.team_a} vs ${m.team_b}`;
    document.getElementById('detailMatchResult').innerText = m.result.toUpperCase();

    // Storing full data temporarily to switch tabs
    window.currentDetailInnings = m.score_data;
    switchDetailScorecard(1);
    switchScreen('matchDetailScreen');
}

function switchDetailScorecard(innIdx) {
    const inn = window.currentDetailInnings[innIdx];

    document.getElementById('tabDetailInn1').classList.toggle('active', innIdx === 1);
    document.getElementById('tabDetailInn2').classList.toggle('active', innIdx === 2);

    if (!inn) {
        document.getElementById('detailBattingBody').innerHTML = '<tr><td colspan="6" style="text-align:center;">Innings not played</td></tr>';
        document.getElementById('detailBowlingBody').innerHTML = '';
        return;
    }

    let bHtml = '';
    if (Array.isArray(inn.batters)) {
        inn.batters.forEach(bat => {
            const sr = bat.balls > 0 ? (bat.runs / bat.balls * 100).toFixed(2) : '0.00';
            const outDescDisplay = bat.isOut ? `<div style="font-size: 0.7rem; color: var(--text-secondary);">${bat.outDesc}</div>` : (bat.outDesc === 'not out' ? '<div style="font-size: 0.7rem; color: var(--primary-color);">not out</div>' : '');

            bHtml += `<tr>
                <td>
                    <div style="font-weight: 600;">${bat.name}</div>
                    ${outDescDisplay}
                </td>
                <td>${bat.runs}</td>
                <td>${bat.balls}</td>
                <td>${bat.fours}</td>
                <td>${bat.sixes}</td>
                <td>${sr}</td>
            </tr>`;
        });
    }
    document.getElementById('detailBattingBody').innerHTML = bHtml || '<tr><td colspan="6">No batting data</td></tr>';

    let bowlHtml = '';
    if (Array.isArray(inn.bowlers)) {
        inn.bowlers.forEach(bowl => {
            const eco = bowl.balls > 0 ? (bowl.runs / (bowl.balls / 6)).toFixed(2) : '0.00';
            bowlHtml += `<tr><td>${bowl.name}</td><td>${Math.floor(bowl.balls / 6)}.${bowl.balls % 6}</td><td>${bowl.maidens}</td><td>${bowl.runs}</td><td>${bowl.wickets}</td><td>${eco}</td></tr>`;
        });
    }
    document.getElementById('detailBowlingBody').innerHTML = bowlHtml || '<tr><td colspan="6">No bowling data</td></tr>';
}

function switchScreen(id) {
    showLoader();
    setTimeout(() => {
        document.querySelectorAll('section').forEach(s => s.classList.remove('active'));
        document.getElementById(id).classList.add('active');
        hideLoader();
    }, 300);
}
