// 1. 보안 설정 (비밀번호: shwlgus)
const ADMIN_PASSWORD = "shwlgus"; 

// 2. 로그인 함수를 최상단에 전역으로 배치 (ReferenceError 방지)
window.checkLogin = function() {
    const passwordInput = document.getElementById('login-password');
    const errorMsg = document.getElementById('login-error');
    
    if (!passwordInput) return;

    if (passwordInput.value === ADMIN_PASSWORD) {
        sessionStorage.setItem('authenticated', 'true');
        showMainContent();
    } else {
        if (errorMsg) errorMsg.classList.remove('hidden');
        alert("비밀번호가 올바르지 않습니다.");
        passwordInput.value = '';
        passwordInput.focus();
    }
};

function showMainContent() {
    const overlay = document.getElementById('login-overlay');
    const content = document.getElementById('main-content');
    if (overlay) overlay.style.display = 'none';
    if (content) {
        content.classList.remove('hidden');
        content.style.display = 'block';
    }
}

// 3. 페이지 로드 시 초기화
document.addEventListener('DOMContentLoaded', () => {
    console.log("System Initialized");
    
    // Lucide 아이콘 로드 확인
    if (window.lucide) {
        window.lucide.createIcons();
    }
    
    // 기존 세션 확인
    if (sessionStorage.getItem('authenticated') === 'true') {
        showMainContent();
    }

    // 오늘 날짜 설정
    const dateInput = document.getElementById('event-date');
    if (dateInput) {
        dateInput.value = new Date().toISOString().split('T')[0];
    }

    // 기본 행 10개씩 추가 (엑셀처럼 바로 입력 가능하게)
    const performerBody = document.getElementById('performer-body');
    const otherBody = document.getElementById('other-body');
    if (performerBody && performerBody.rows.length === 0) {
        for(let i=0; i<10; i++) addRow('performer-table');
    }
    if (otherBody && otherBody.rows.length === 0) {
        for(let i=0; i<10; i++) addRow('other-table');
    }

    // AI 분석 버튼 연결
    const btnParse = document.getElementById('btn-parse');
    if (btnParse) {
        btnParse.onclick = handleAIParse;
    }
});

// 4. 행 추가 기능
function addRow(tableId, data = null) {
    const tbody = tableId === 'performer-table' ? document.getElementById('performer-body') : document.getElementById('other-body');
    if (!tbody) return;

    const rowCount = tbody.rows.length + 1;
    const tr = document.createElement('tr');
    
    const fields = [
        { key: 'no', value: data?.no || rowCount },
        { key: 'regular', value: data?.regular || '', type: 'number' },
        { key: 'vip', value: data?.vip || '', type: 'number' },
        { key: 'name', value: data?.name || '' },
        { key: 'total', value: data?.total || '', type: 'number' },
        { key: 'recipient', value: data?.recipient || '' },
        { key: 'received', value: data?.received || '', type: 'number' },
        { key: 'phone', value: data?.phone || '' },
        { key: 'remarks', value: data?.remarks || '' }
    ];

    fields.forEach(field => {
        const td = document.createElement('td');
        if (field.key === 'no') {
            td.className = 'text-center font-semibold text-slate-400';
            td.innerText = field.value;
        } else {
            const input = document.createElement('input');
            input.type = field.type || 'text';
            input.value = field.value;
            input.className = 'input-cell';
            input.oninput = () => {
                if (field.key === 'regular' || field.key === 'vip') {
                    const ins = tr.getElementsByTagName('input');
                    const r = parseInt(ins[0].value) || 0;
                    const v = parseInt(ins[1].value) || 0;
                    ins[3].value = r + v;
                }
            };
            td.appendChild(input);
        }
        tr.appendChild(td);
    });

    const actionTd = document.createElement('td');
    actionTd.innerHTML = `<button onclick="this.closest('tr').remove()" class="text-slate-300 hover:text-red-500"><i data-lucide="trash-2" class="w-4 h-4"></i></button>`;
    tr.appendChild(actionTd);
    tbody.appendChild(tr);
    
    if (window.lucide) window.lucide.createIcons({ root: actionTd });
}

// 5. AI 분석 기능
window.toggleAIModal = function() {
    const modal = document.getElementById('ai-modal');
    if (!modal) return;
    if (modal.classList.contains('hidden')) {
        modal.classList.remove('hidden');
        modal.classList.add('flex');
        document.getElementById('ai-input').focus();
    } else {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }
};

async function handleAIParse() {
    const text = document.getElementById('ai-input').value.trim();
    if (!text) return;

    const loading = document.getElementById('loading');
    loading.classList.remove('hidden');
    loading.classList.add('flex');
    
    // 분석 시작 시 모달 닫기
    toggleAIModal();

    try {
        const response = await fetch('/api/gemini', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: `티켓 정보를 JSON으로 분석해줘: "${text}"` }] }]
            })
        });

        const data = await response.json();
        const raw = data.candidates[0].content.parts[0].text;
        const res = JSON.parse(raw.replace(/```json|```/g, '').trim());

        if (res.performers) res.performers.forEach(i => addRow('performer-table', i));
        if (res.others) res.others.forEach(i => addRow('other-table', i));
        document.getElementById('ai-input').value = '';
    } catch (e) {
        console.error(e);
        alert('분석 실패');
    } finally {
        loading.classList.add('hidden');
        loading.classList.remove('flex');
    }
}
