// Advanced Cricket Features

async function useDRS(team) {
    const drsKey = team === 'A' ? 'drsTeamA' : 'drsTeamB';

    if (gameState[drsKey] <= 0) {
        await showAlert(`No DRS reviews remaining for Team ${team}!`, 'DRS');
        return;
    }

    const decision = await showConfirm('Was the umpire decision correct?\n\nYes = Decision Overturned (Review Retained)\nNo = Decision Stands (Review Lost)', '🔍 DRS Review');

    if (!decision) {
        gameState[drsKey]--;
        await showAlert(`Review Lost! Team ${team} has ${gameState[drsKey]} review(s) remaining.`, 'DRS Result');
    } else {
        await showAlert(`Decision Overturned! Review retained. Team ${team} still has ${gameState[drsKey]} review(s).`, 'DRS Result');
    }

    updateDisplay();
}

async function setMatchStatus(status) {
    gameState.matchStatus = status;
    const statusMessages = {
        'break': '☕ Match on Break',
        'lunch': '🍽️ Lunch Break',
        'stumps': '🌙 Stumps - Day End'
    };

    await showAlert(statusMessages[status] || 'Match Status Updated', 'Match Status');

    if (status === 'stumps') {
        const resume = await showConfirm('Resume match tomorrow?', 'Stumps');
        if (resume) {
            gameState.matchStatus = 'live';
            await showAlert('Match Resumed!', 'Match Status');
        }
    } else {
        setTimeout(async () => {
            const resume = await showConfirm('Resume match?', 'Break Over');
            if (resume) {
                gameState.matchStatus = 'live';
                await showAlert('Match Resumed!', 'Match Status');
            }
        }, 2000);
    }
}

async function declareDraw() {
    if (await showConfirm('Declare match as DRAW?\n\nThis will end the match immediately.', '🤝 Draw')) {
        gameState.matchStatus = 'draw';
        const s1 = gameState.innings[1];
        const s2 = gameState.innings[2];
        document.getElementById('matchOutcome').innerText = 'MATCH DRAWN';

        // Save match
        apiCall('/matches', {
            method: 'POST',
            body: JSON.stringify({
                teamA: gameState.teamA,
                teamB: gameState.teamB,
                scoreData: gameState.innings,
                result: 'Match Drawn'
            })
        }).catch(err => console.error(err));

        switchScreen('resultScreen');
    }
}

async function startSuperOver() {
    if (!await showConfirm('START SUPER OVER?\n\nThis is a tie-breaker with 1 over per team.', '🔥 Super Over')) return;

    gameState.isSuperOver = true;
    gameState.maxOvers = 1;
    gameState.currentInnings = 1;

    // Reset innings for super over
    gameState.innings[1] = {
        teamName: gameState.teamA,
        runs: 0, wickets: 0, balls: 0,
        batters: [], bowlers: [],
        extras: { wd: 0, nb: 0, lb: 0, b: 0, total: 0 },
        fow: [], strikerIdx: 0, nonStrikerIdx: 1, bowlerIdx: 0,
        partnershipRuns: 0, partnershipBalls: 0
    };

    gameState.innings[2] = {
        teamName: gameState.teamB,
        runs: 0, wickets: 0, balls: 0,
        batters: [], bowlers: [],
        extras: { wd: 0, nb: 0, lb: 0, b: 0, total: 0 },
        fow: [], strikerIdx: 0, nonStrikerIdx: 1, bowlerIdx: 0,
        partnershipRuns: 0, partnershipBalls: 0
    };

    await showAlert('SUPER OVER MODE\n\n1 over per team. Highest score wins!', '⚡ Super Over');
    location.reload(); // Restart with super over settings
}
