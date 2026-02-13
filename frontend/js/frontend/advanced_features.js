// Advanced Cricket Features

function useDRS(team) {
    const drsKey = team === 'A' ? 'drsTeamA' : 'drsTeamB';

    if (gameState[drsKey] <= 0) {
        alert(`❌ No DRS reviews remaining for Team ${team}!`);
        return;
    }

    const decision = confirm('🔍 DRS Review\n\nWas the umpire decision correct?\n\nOK = Decision Overturned (Review Retained)\nCancel = Decision Stands (Review Lost)');

    if (!decision) {
        gameState[drsKey]--;
        alert(`📉 Review Lost! Team ${team} has ${gameState[drsKey]} review(s) remaining.`);
    } else {
        alert(`✅ Decision Overturned! Review retained. Team ${team} still has ${gameState[drsKey]} review(s).`);
    }

    updateDisplay();
}

function setMatchStatus(status) {
    gameState.matchStatus = status;
    const statusMessages = {
        'break': '☕ Match on Break',
        'lunch': '🍽️ Lunch Break',
        'stumps': '🌙 Stumps - Day End'
    };

    alert(statusMessages[status] || 'Match Status Updated');

    if (status === 'stumps') {
        const resume = confirm('Resume match tomorrow?');
        if (resume) {
            gameState.matchStatus = 'live';
            alert('✅ Match Resumed!');
        }
    } else {
        setTimeout(() => {
            const resume = confirm('Resume match?');
            if (resume) {
                gameState.matchStatus = 'live';
                alert('✅ Match Resumed!');
            }
        }, 2000);
    }
}

function declareDraw() {
    if (confirm('🤝 Declare match as DRAW?\n\nThis will end the match immediately.')) {
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

function startSuperOver() {
    if (!confirm('🔥 START SUPER OVER?\n\nThis is a tie-breaker with 1 over per team.')) return;

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

    alert('⚡ SUPER OVER MODE\n\n1 over per team. Highest score wins!');
    location.reload(); // Restart with super over settings
}
