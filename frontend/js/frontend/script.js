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
    target: null, viewingInnings: 1
};

let thisOverBalls = [];

// Auth Logic
async function handleLogin() {
    const u = document.getElementById('loginUsername').value;
    const p = document.getElementById('loginPassword').value;
    if (!u || !p) return alert('Username and Password required');
    if (p.length !== 7) return alert('Password must be exactly 7 characters long');

    try {
        const data = await apiCall('/login', {
            method: 'POST',
            body: JSON.stringify({ username: u, password: p })
        });

        localStorage.setItem('authToken', data.token);
        localStorage.setItem('username', data.username);
        window.location.href = 'dashboard.html';
    } catch (err) { alert(err.message); }
}

async function handleSignup() {
    const u = document.getElementById('signupUsername').value;
    const p = document.getElementById('signupPassword').value;
    if (!u || !p) return alert('Username and Password required');
    if (p.length !== 7) return alert('Password must be exactly 7 characters long');

    try {
        await apiCall('/signup', {
            method: 'POST',
            body: JSON.stringify({ username: u, password: p })
        });
        alert('Signup Success! Please Login.');
        window.location.href = 'login.html';
    } catch (err) { alert(err.message); }
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
        document.getElementById('userWelcome').innerText = `Welcome, ${currentUser}!`;
    } else if (path.includes('login.html') || path.includes('signup.html')) {
        if (authToken) window.location.href = 'dashboard.html';
    } else {
        // Root redirect - check if we are at index.html in the root of the app
        window.location.href = authToken ? 'pages/dashboard.html' : 'pages/login.html';
    }
};

// --- CRICKET LOGIC --- (Reused from previous version)

function startMatch() {
    const tA = document.getElementById('teamA').value;
    const tB = document.getElementById('teamB').value;
    const ov = document.getElementById('totalOvers').value;
    const tossW = document.getElementById('tossWinner').value;
    const tossD = document.querySelector('input[name="tossDecision"]:checked').value;

    if (!tA || !tB || !ov) return alert('Fill all fields!');

    gameState.teamA = tA;
    gameState.teamB = tB;
    gameState.maxOvers = parseInt(ov);

    const tossWinnerName = tossW === 'Team A' ? tA : tB;
    gameState.toss = `${tossWinnerName} won the toss and elected to ${tossD}`;
    document.getElementById('tossInfo').innerText = gameState.toss;

    // Set first innings team based on toss
    const firstInningsTeam = (tossD === 'Bat') ? tossWinnerName : (tossWinnerName === tA ? tB : tA);
    gameState.innings[1].teamName = firstInningsTeam;
    gameState.innings[2].teamName = (firstInningsTeam === tA ? tB : tA);

    gameState.innings[1].batters = [
        { name: document.getElementById('initStriker').value || 'Striker', runs: 0, balls: 0, fours: 0, sixes: 0, outDesc: 'not out', isOut: false },
        { name: document.getElementById('initNonStriker').value || 'Non-Striker', runs: 0, balls: 0, fours: 0, sixes: 0, outDesc: 'not out', isOut: false }
    ];
    gameState.innings[1].bowlers = [{ name: document.getElementById('initBowler').value || 'Bowler', balls: 0, maidens: 0, runs: 0, wickets: 0 }];

    document.getElementById('displayTeams').innerText = `${tA} vs ${tB}`;
    document.getElementById('maxOvers').innerText = ov;
    switchScreen('matchScreen');
    updateDisplay();
}

function addRuns(run) {
    const inn = gameState.innings[gameState.currentInnings];
    inn.runs += run; inn.balls++;
    inn.partnershipRuns += run; inn.partnershipBalls++;
    const s = inn.batters[inn.strikerIdx];
    s.runs += run; s.balls++;
    if (run === 4) s.fours++; if (run === 6) s.sixes++;

    const b = inn.bowlers[inn.bowlerIdx];
    b.runs += run; b.balls++;

    thisOverBalls.push({ type: 'run', value: run, label: run === 0 ? '.' : run.toString() });
    if (run % 2 !== 0) rotateStrike();
    checkOverEnd(); updateDisplay(); checkInningsEnd();
}

function addExtra(type) {
    const inn = gameState.innings[gameState.currentInnings];
    inn.runs++; inn.extras.total++;
    inn.partnershipRuns++;
    if (type === 'WD') inn.extras.wd++; else inn.extras.nb++;
    inn.bowlers[inn.bowlerIdx].runs++;
    thisOverBalls.push({ type: 'extra', value: type, label: type });
    updateDisplay(); checkInningsEnd();
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

async function handleWicketSelect(type) {
    closeWicketModal();
    const inn = gameState.innings[gameState.currentInnings];
    let outIdx = inn.strikerIdx;

    // Determine who is out for Run Out
    if (type === 'Run Out') {
        outIdx = confirm(`Striker (${inn.batters[inn.strikerIdx].name}) Out?`) ? inn.strikerIdx : inn.nonStrikerIdx;
    }

    inn.wickets++;
    const bOut = inn.batters[outIdx];
    bOut.isOut = true;

    // Reset partnership on wicket
    inn.partnershipRuns = 0;
    inn.partnershipBalls = 0;

    const bowler = inn.bowlers[inn.bowlerIdx];

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

    thisOverBalls.push({ type: 'wicket', value: 'W', label: 'W' });
    if (inn.wickets < 10) {
        let n = await requestInput('New Batter Name', 'Enter name');
        inn.batters.push({ name: n || `Batter ${inn.batters.length + 1}`, runs: 0, balls: 0, fours: 0, sixes: 0, outDesc: 'not out', isOut: false });
        if (outIdx === inn.strikerIdx) inn.strikerIdx = inn.batters.length - 1;
        else inn.nonStrikerIdx = inn.batters.length - 1;
    }
    updateDisplay(); checkOverEnd(); checkInningsEnd();
}

function rotateStrike() {
    const inn = gameState.innings[gameState.currentInnings];
    [inn.strikerIdx, inn.nonStrikerIdx] = [inn.nonStrikerIdx, inn.strikerIdx];
}

function checkOverEnd() {
    const inn = gameState.innings[gameState.currentInnings];
    if (inn.balls > 0 && inn.balls % 6 === 0) {
        setTimeout(() => {
            alert('Over Over!'); rotateStrike();
            let n = prompt('Next Bowler?', 'Bowler');
            let idx = inn.bowlers.findIndex(b => b.name === n);
            if (idx === -1) {
                inn.bowlers.push({ name: n || 'Bowler', balls: 0, maidens: 0, runs: 0, wickets: 0 });
                idx = inn.bowlers.length - 1;
            }
            inn.bowlerIdx = idx;
            thisOverBalls = [];
            updateDisplay();
        }, 200);
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

function checkInningsEnd() {
    const inn = gameState.innings[gameState.currentInnings];
    if (gameState.currentInnings === 2 && gameState.target && inn.runs >= gameState.target) return endMatchManually();
    if (inn.balls >= gameState.maxOvers * 6 || inn.wickets >= 10) {
        if (gameState.currentInnings === 1) {
            gameState.target = inn.runs + 1;
            document.getElementById('nextInningsBtn').style.display = 'block';
            alert(`Innings Over! Target: ${gameState.target}`);
        } else endMatchManually();
    }
}

function startSecondInnings() {
    gameState.currentInnings = 2;
    const inn = gameState.innings[2];
    inn.teamName = gameState.teamB;
    inn.batters = [
        { name: prompt('Opener 1', 'Batter 1') || 'Batter 1', runs: 0, balls: 0, fours: 0, sixes: 0, outDesc: 'not out', isOut: false },
        { name: prompt('Opener 2', 'Batter 2') || 'Batter 2', runs: 0, balls: 0, fours: 0, sixes: 0, outDesc: 'not out', isOut: false }
    ];
    inn.bowlers = [{ name: prompt('Opening Bowler', 'Bowler') || 'Bowler', balls: 0, maidens: 0, runs: 0, wickets: 0 }];
    document.getElementById('nextInningsBtn').style.display = 'none';
    thisOverBalls = [];
    updateDisplay();
}

function endMatchManually() { calculateResult(); switchScreen('resultScreen'); }

async function calculateResult() {
    const s1 = gameState.innings[1]; const s2 = gameState.innings[2];
    let res = (s2.runs >= gameState.target) ? `${gameState.teamB} wins` : (s1.runs > s2.runs) ? `${gameState.teamA} wins` : "Match Tie";
    document.getElementById('matchOutcome').innerText = res.toUpperCase();

    try {
        await apiCall('/matches', {
            method: 'POST',
            body: JSON.stringify({ teamA: gameState.teamA, teamB: gameState.teamB, scoreData: gameState.innings, result: res })
        });
    } catch (err) { console.error("Could not save match to DB:", err.message); }
}

let matchHistoryData = [];

async function showHistory() {
    console.log("showHistory called at", new Date().toISOString());
    try {
        const response = await apiCall('/matches');
        console.log("API response received:", response);

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
    } catch (err) { alert('Error loading history: ' + err.message); }
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
