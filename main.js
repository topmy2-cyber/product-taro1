// 1. 보안 설정 (비밀번호: shwlgus)
const ADMIN_PASSWORD = "shwlgus";

// ==========================================
// [ 파이어베이스 공유 데이터베이스 설정 ]
// 1. 파이어베이스 접속 후 새 프로젝트 생성 -> Realtime Database 생성 (테스트 모드)
// 2. 프로젝트 설정에서 웹앱 추가 후 아래 텅 빈 '' 안에 발급받은 키값을 붙여넣으세요.
// (키값이 채워지면 앱은 자동으로 실시간 공유시트 모드로 변신합니다!)
// ==========================================
const FIREBASE_CONFIG = {
    apiKey: "AIzaSyCohWki6En4FBDXMz41-8n9vMoKjH-TNls",
    authDomain: "product-f6f4e.firebaseapp.com",
    // 웹앱 생성 시점에 따라 아래 databaseURL이 누락되어 뜨는 경우가 많습니다. 
    // 파이어베이스 콘솔의 'Realtime Database' 탭에 들어가서 상단에 뜨는 매우 긴 주소(https://~)를 복사해 꼭 넣어주세요!
    databaseURL: "https://product-f6f4e-default-rtdb.asia-southeast1.firebasedatabase.app/", // <-- 수정 필요할 수 있음
    projectId: "product-f6f4e",
    storageBucket: "product-f6f4e.firebasestorage.app",
    messagingSenderId: "105855342587",
    appId: "1:105855342587:web:33f205dc28ef4f60ed5d5e"
};

let firebaseDb = null;
if (FIREBASE_CONFIG.apiKey) {
    firebase.initializeApp(FIREBASE_CONFIG);
    firebaseDb = firebase.database();
}

let isLocalUpdate = false;
let localUpdateTimer = null;

// 2. 로그인 함수 (전역)
window.checkLogin = function () {
    const passwordInput = document.getElementById('login-password');
    if (!passwordInput) return;

    if (passwordInput.value === ADMIN_PASSWORD) {
        sessionStorage.setItem('authenticated', 'true');
        showMainContent();
    } else {
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

// 3. 데이터 저장 및 불러오기 로직
function updateTableSummary(tableId) {
    const tbodyId = tableId === 'performer-table' ? 'performer-body' : 'other-body';
    const prefix = tableId === 'performer-table' ? 'performer' : 'other';
    const tbody = document.getElementById(tbodyId);
    if (!tbody) return;

    let globalRegular = 0;
    let globalVip = 0;

    let groupRegular = 0;
    let groupVip = 0;
    let groupReceived = 0;

    for (let i = 0; i < tbody.rows.length; i++) {
        const tr = tbody.rows[i];
        
        // 부분합계 행을 만나면 지금까지 모은 그룹 정산을 출력하고 리셋함
        if (tr.classList.contains('subtotal-row')) {
            const tds = tr.getElementsByTagName('td');
            if (tds.length >= 5) {
                tds[1].innerText = groupRegular > 0 ? groupRegular : '';
                tds[2].innerText = groupVip > 0 ? groupVip : '';
                tds[4].innerText = groupReceived > 0 ? groupReceived : '';
            }
            groupRegular = 0;
            groupVip = 0;
            groupReceived = 0;
            continue;
        }
        
        const regInput = tr.querySelector('input[data-key="regular"]');
        const vipInput = tr.querySelector('input[data-key="vip"]');
        const rcvInput = tr.querySelector('input[data-key="received"]');
        
        const r = regInput ? (parseInt(regInput.value) || 0) : 0;
        const v = vipInput ? (parseInt(vipInput.value) || 0) : 0;
        const c = rcvInput ? (parseInt(rcvInput.value) || 0) : 0;

        // 개별 행의 [총 티켓] (일반석 + VIP석) 자동 연산 및 UI 갱신 (읽기 전용 표시)
        const totalInput = tr.querySelector('input[data-key="total_tickets"]');
        if (totalInput) {
            const parentTd = totalInput.closest('td');
            // 병합된 그룹의 총합 칸이라면 개별 연산으로 덮어씌우지 않음
            if (!parentTd || !parentTd.getAttribute('data-merged')) {
                const sum = r + v;
                totalInput.value = sum > 0 ? sum : '';
            }
        }

        globalRegular += r;
        globalVip += v;
        
        groupRegular += r;
        groupVip += v;
        groupReceived += c;
    }

    document.getElementById(`${prefix}-regular-sum`).innerText = globalRegular.toLocaleString();
    document.getElementById(`${prefix}-vip-sum`).innerText = globalVip.toLocaleString();
    document.getElementById(`${prefix}-total-sum`).innerText = (globalRegular + globalVip).toLocaleString();
}

function saveAllData() {
    isLocalUpdate = true;
    clearTimeout(localUpdateTimer);
    // 내가 수정 중일 때 타인의 동기화로 표가 덮어씌워져 타이핑이 끊기는 현상 3초간 방지
    localUpdateTimer = setTimeout(() => { isLocalUpdate = false; }, 3000);

    const dateStr = document.getElementById('event-date').value || '[1경기] 4월 11일 (토)';
    // Firebase 경로 생성 규칙에 맞게 특수문자 치환 (., #, $, [, ] 금지)
    const safeDateKey = dateStr.replace(/[.#$\[\]]/g, '_');
    
    const data = {
        performers: getTableData('performer-body'),
        others: getTableData('other-body'),
        date: dateStr,
        timestamp: Date.now()
    };

    try {
        if (firebaseDb) {
            firebaseDb.ref('tickets/' + safeDateKey).set(data);
        } else {
            localStorage.setItem(`ticket_management_data_${dateStr}`, JSON.stringify(data));
            console.log("Data Auto-Saved for " + dateStr);
        }
    } catch (e) {
        console.error("Save Error:", e);
    }
}

function getTableData(tbodyId) {
    const tbody = document.getElementById(tbodyId);
    const rows = [];
    if (!tbody) return rows;

    for (let i = 0; i < tbody.rows.length; i++) {
        const tr = tbody.rows[i];
        // 부분합계 행(읽기 전용)은 저장 대상에서 제외
        if (tr.classList.contains('subtotal-row')) continue;
        
        // DOM 탐색 안정성 강화를 위해 querySelector 전면 적용 (결합/배열 오류 원천 차단)
        const getValue = (key) => {
            const el = tr.querySelector(`input[data-key="${key}"]`);
            return el ? el.value : '';
        };

        const rowData = {
            regular: getValue('regular'),
            vip: getValue('vip'),
            name: getValue('name'),
            recipient: getValue('recipient'),
            received: getValue('received'),
            phone: getValue('phone'),
            remarks: getValue('remarks')
        };

        // 빈 칸이더라도 사용자가 추가한 행 구조(띄어쓰기 개념 등)를 영구 보존하기 위해 무조건 저장함
        rows.push(rowData);
    }
    return rows;
}

let currentSyncRef = null;

function loadSavedData(forceRender = false) {
    const dateStr = document.getElementById('event-date').value || '[1경기] 4월 11일 (토)';
    const safeDateKey = dateStr.replace(/[.#$\[\]]/g, '_');

    if (forceRender) {
        isLocalUpdate = false;
        clearTimeout(localUpdateTimer);
    }

    if (firebaseDb) {
        // [클라우드 연동 모드]
        // 파이어베이스 네트워크 연결을 기다리는 동안 화면이 휑하게 비어있지 않도록 일단 기본 10행 그리기
        if (!isLocalUpdate || forceRender) {
            renderTableData(null); 
        }

        if (currentSyncRef) currentSyncRef.off(); // 이전 날짜 실시간 수신기능 해제
        
        currentSyncRef = firebaseDb.ref('tickets/' + safeDateKey);
        currentSyncRef.on('value', (snapshot) => {
            // 내가 타이핑 중이 아닐 때만 남이 바꾼 화면을 업데이트 (클로저 버그 방지)
            if (isLocalUpdate) return; 
            const data = snapshot.val();
            // 클라우드에 비어있으면 아까 그린 기본 10행을 유지하고, 데이터가 있으면 덮어씌움
            renderTableData(data);
        });
    } else {
        // [오프라인 모드]
        const saved = localStorage.getItem(`ticket_management_data_${dateStr}`);
        if (saved) {
            renderTableData(JSON.parse(saved));
        } else {
            renderTableData(null);
        }
    }
}

function renderTableData(data) {
    const performerBody = document.getElementById('performer-body');
    const otherBody = document.getElementById('other-body');
    
    performerBody.innerHTML = '';
    otherBody.innerHTML = '';

    const renderFlat = (list, tableId) => {
        list.forEach(item => addRow(tableId, item, 1));
    };

    if (data) {
        // 평소 데이터 바인딩 시에는 AI 스마트 정리(그룹핑)를 적용하지 않고 입력 형태 그대로(Raw) 나열합니다.
        if (data.performers && data.performers.length > 0) {
            renderFlat(data.performers, 'performer-table');
        }
        // 옛날 호환용 속성
        if (data.tickets && data.tickets.length > 0) {
            renderFlat(data.tickets, 'performer-table');
        }
        
        // 그 외 배부도 동일하게 평문 나열
        if (data.others && data.others.length > 0) {
            renderFlat(data.others, 'other-table');
        }
    }

    // 빈칸 채워넣기 (10칸 보장)
    let performerCount = performerBody.querySelectorAll('tr:not(.subtotal-row)').length;
    while (performerCount < 10) { addRow('performer-table'); performerCount++; }
    
    let otherCount = otherBody.querySelectorAll('tr:not(.subtotal-row)').length;
    while (otherCount < 10) { addRow('other-table'); otherCount++; }

    updateTableSummary('performer-table');
    updateTableSummary('other-table');

    return !!data;
}

function renderGroupedList(list, tableId) {
    let i = 0;
    while (i < list.length) {
        const item = list[i];
        let groupSize = 1;
        
        // 이름이 존재할 경우에만 인접한 동일 이름끼리 그룹핑
        if (item.name && item.name.trim() !== "") {
            while (i + groupSize < list.length && list[i + groupSize].name === item.name) {
                groupSize++;
            }
        }
        
        let subRegular = 0;
        let subVip = 0;
        let subReceived = 0;

        // 1. 먼저 순회하며 전체 합계를 사전 계산
        for (let j = 0; j < groupSize; j++) {
            const dataItem = list[i + j];
            subRegular += parseInt(dataItem.regular) || 0;
            subVip += parseInt(dataItem.vip) || 0;
            subReceived += parseInt(dataItem.received) || 0;
        }

        const groupTotalTickets = subRegular + subVip;

        // 2. 그룹 크기만큼 다시 행을 추가하되, 첫 행에만 그룹 전체 [총 티켓] 수를 전달
        for (let j = 0; j < groupSize; j++) {
            const dataItem = list[i + j];
            // 첫 번째 행은 rowspan 값을 넘기고, 나머지는 0을 넘겨 cell을 숨김
            const rowspanFlag = (j === 0) ? groupSize : 0;
            addRow(tableId, dataItem, rowspanFlag, groupTotalTickets, true); 
        }

        i += groupSize;
    }
}

// 4. 페이지 초기화
document.addEventListener('DOMContentLoaded', () => {
    if (window.lucide) window.lucide.createIcons();

    if (sessionStorage.getItem('authenticated') === 'true') {
        showMainContent();
    }

    const lastDate = localStorage.getItem('last_accessed_date') || '[1경기] 4월 11일 (토)';
    document.getElementById('event-date').value = lastDate;

    loadSavedData(true);

    document.getElementById('event-date').onchange = (e) => {
        localStorage.setItem('last_accessed_date', e.target.value);
        loadSavedData(true);
    };
});

// 4-1. 행 추가 버튼 전용 트리거 (수동 추가 시 즉각 클라우드 저장 트리거)
window.addBlankRow = function (tableId) {
    addRow(tableId);
    updateTableSummary(tableId);
    saveAllData(); // 즉시 저장하여 새로고침 시에도 빈 줄이 증발하지 않도록 보장
};

// 5. 행 추가 기능 (그룹핑 병합 지원)
function addRow(tableId, data = null, nameRowspan = 1, groupTotalTickets = null, isSmartMode = false) {
    const tbodyId = tableId === 'performer-table' ? 'performer-body' : 'other-body';
    const tbody = document.getElementById(tbodyId);
    if (!tbody) return;

    const tr = document.createElement('tr');
    
    // 그룹 단위로 순번을 계산 (로우 갯수가 아니라 번호칸의 갯수 기준)
    const noCount = tbody.querySelectorAll('.no-cell').length + (nameRowspan > 0 ? 1 : 0);
    const isEvenGroup = (noCount % 2 === 0);

    const createInput = (key, value, type = 'text', hidden = false) => {
        const input = document.createElement('input');
        input.type = hidden ? 'hidden' : type;
        input.value = value || '';
        input.setAttribute('data-key', key);
        if (!hidden) input.className = 'input-cell';
        
        if (key === 'regular' || key === 'vip' || key === 'received') {
            input.addEventListener('input', function() { 
                updateTableSummary(tableId); 
                saveAllData(); 
            });
        } else {
            input.addEventListener('input', function() { saveAllData(); });
        }

        // 엔터(Enter) / 쉬프트+엔터(Shift+Enter) 입력 시 상하 이동 기능 (엑셀 UX)
        input.addEventListener('keydown', function(e) {
            if (e.isComposing) return;
            if (e.key === 'Enter') {
                e.preventDefault();
                let currentTr = this.closest('tr');
                let targetInput = null;
                let stepTr = currentTr;
                
                while (true) {
                    if (e.shiftKey) {
                        stepTr = stepTr.previousElementSibling;
                        while (stepTr && stepTr.classList.contains('subtotal-row')) stepTr = stepTr.previousElementSibling;
                    } else {
                        stepTr = stepTr.nextElementSibling;
                        while (stepTr && stepTr.classList.contains('subtotal-row')) stepTr = stepTr.nextElementSibling;
                        
                        // 하단 끝에 도달하면 새 줄을 생성
                        if (!stepTr && !e.shiftKey) {
                            addRow(tableId);
                            // 새로 생성된 마지막 줄을 타겟으로 선택
                            stepTr = tbody.lastElementChild;
                            while (stepTr && stepTr.classList.contains('subtotal-row')) stepTr = stepTr.previousElementSibling;
                        }
                    }
                    
                    if (!stepTr) break;
                    
                    const candidateInput = stepTr.querySelector(`input[data-key="${key}"]`);
                    // 만약 병합 처리되어 숨겨진(hidden) 칸이라면 한 줄 더 넘어감
                    if (candidateInput && candidateInput.type !== 'hidden') {
                        targetInput = candidateInput;
                        break;
                    }
                }
                
                if (targetInput) {
                    targetInput.focus();
                    if (targetInput.type === 'text' || targetInput.type === 'number') {
                        targetInput.select();
                    }
                }
            }
        });

        // 엑셀 붙여넣기 (다중 셀 지원) 기능
        input.addEventListener('paste', function(e) {
            const clipboardData = e.clipboardData || window.clipboardData;
            const pastedText = clipboardData.getData('Text');
            
            // 엑셀처럼 탭(\t)이나 줄바꿈(\n)이 포함되어 있으면 표 형태로 붙여넣기 발동
            if (pastedText.includes('\t') || pastedText.includes('\n')) {
                e.preventDefault(); // 기본 한 칸 붙여넣기 방지
                
                const rowsData = pastedText.split(/\r?\n/).filter(row => row.trim() !== '');
                // 현재 UI 열 순서 (NO 열은 제외. 이름, 일반, VIP, 총티켓, 수령자, 수령티켓, 연락처, 비고)
                const keys = ['name', 'regular', 'vip', 'total_tickets', 'recipient', 'received', 'phone', 'remarks'];
                
                let currentTr = this.closest('tr');
                const tbody = currentTr.closest('tbody');
                const startColIndex = keys.indexOf(this.getAttribute('data-key'));
                
                if (startColIndex === -1) return;
                
                for (let i = 0; i < rowsData.length; i++) {
                    const rowText = rowsData[i];
                    const colsData = rowText.split('\t');
                    
                    // 표의 끝에 도달하여 줄이 더 부족하면 새 행을 생성합니다
                    if (!currentTr) {
                        addRow(tableId);
                        currentTr = tbody.lastElementChild;
                        while (currentTr && currentTr.classList.contains('subtotal-row')) {
                            currentTr = currentTr.previousElementSibling;
                        }
                    }
                    
                    for (let j = 0; j < colsData.length; j++) {
                        const targetColIndex = startColIndex + j;
                        if (targetColIndex < keys.length) {
                             const targetKey = keys[targetColIndex];
                             const targetInput = currentTr.querySelector(`input[data-key="${targetKey}"]`);
                             if (targetInput && !targetInput.readOnly) {
                                 targetInput.value = colsData[j].trim();
                             }
                        }
                    }
                    
                    // 다음 줄로 이동 (부분합계 UI는 무시하고 건너뜀)
                    let nextTr = currentTr.nextElementSibling;
                    while (nextTr && nextTr.classList.contains('subtotal-row')) nextTr = nextTr.nextElementSibling;
                    currentTr = nextTr;
                }
                
                // 붙여넣기 직후 표 전체 갱신 및 클라우드 저장
                saveAllData();
                updateTableSummary(tableId);
            }
        });

        return input;
    };

    // 1. NO cell (rowspan 적용)
    if (nameRowspan > 0) {
        const td = document.createElement('td');
        td.className = 'no-cell'; 
        if (nameRowspan > 1) td.rowSpan = nameRowspan;
        td.innerText = noCount;
        tr.appendChild(td);
    }

    // 2. 이름 (rowspan 적용 및 숨김 처리)
    let td;
    if (nameRowspan > 0) {
        td = document.createElement('td');
        if (nameRowspan > 1) td.rowSpan = nameRowspan;
        td.className = "relative";
        td.appendChild(createInput('name', data?.name));
        tr.appendChild(td);
    } else {
        // 그룹에 묶여 숨겨지는 칸이라도 저장될 수 있도록 hidden input으로 삽입 (DOM 오류 방지를 위해 안보이는 td 생성)
        td = document.createElement('td');
        td.style.display = 'none';
        td.appendChild(createInput('name', data?.name, 'text', true));
        tr.appendChild(td);
    }

    // 3. 일반석
    td = document.createElement('td');
    td.appendChild(createInput('regular', data?.regular, 'number'));
    tr.appendChild(td);

    // 4. VIP석
    td = document.createElement('td');
    td.appendChild(createInput('vip', data?.vip, 'number'));
    tr.appendChild(td);

    // 4.5 총 티켓 (자동 계산 뷰어 또는 병합 뷰)
    const bgClass = tableId === 'performer-table' ? 'bg-blue-50/20' : 'bg-emerald-50/20';
    const textClass = tableId === 'performer-table' ? 'text-blue-600' : 'text-emerald-600';
    
    if (nameRowspan > 0) {
        td = document.createElement('td');
        if (nameRowspan > 1) {
            td.rowSpan = nameRowspan;
            td.setAttribute('data-merged', 'true');
        }
        td.className = `${bgClass} align-middle`;
        
        const mergedVal = (groupTotalTickets !== null && groupTotalTickets > 0) ? groupTotalTickets : (data?.total_tickets || '');
        const totalInp = createInput('total_tickets', mergedVal, 'number');
        totalInp.readOnly = true;
        totalInp.className = `input-cell font-bold ${textClass} bg-transparent cursor-default pointer-events-none`;
        td.appendChild(totalInp);
        tr.appendChild(td);
    } else {
        // 병합되어 가려지는 셀은 생성하되 숨김 처리
        td = document.createElement('td');
        td.style.display = 'none';
        const totalInp = createInput('total_tickets', '', 'number');
        totalInp.readOnly = true;
        td.appendChild(totalInp);
        tr.appendChild(td);
    }

    // 5. 수령자
    td = document.createElement('td');
    td.appendChild(createInput('recipient', data?.recipient));
    tr.appendChild(td);

    // 6. 수령 티켓
    td = document.createElement('td');
    td.appendChild(createInput('received', data?.received, 'number'));
    tr.appendChild(td);

    // 7. 연락처
    td = document.createElement('td');
    td.appendChild(createInput('phone', data?.phone));
    tr.appendChild(td);

    // 8. 비고란
    td = document.createElement('td');
    td.appendChild(createInput('remarks', data?.remarks));
    tr.appendChild(td);

    // 9. 조작 버튼 세트
    const actionTd = document.createElement('td');
    actionTd.className = 'border-l border-slate-100 align-middle py-1';
    actionTd.setAttribute('data-html2canvas-ignore', 'true');
    
    // 스마트 정리(병합) 뷰에서는 하위 병합 열의 조작 버튼칸 자체를 렌더링 생략
    if (nameRowspan === 0) {
        actionTd.style.display = 'none';
    } else {
        const btnGroup = document.createElement('div');
        // 세로 병합되었을 때 버튼 그룹이 길어지지 않게 가운데 정렬 보장
        btnGroup.className = 'flex items-center justify-center gap-0.5 mx-auto bg-slate-50/50 rounded-lg w-max border border-slate-100 p-0.5 shadow-sm';

        // 1. 추가
        const addBtn = document.createElement('button');
        addBtn.className = 'p-1 text-blue-400 hover:text-blue-600 hover:bg-blue-50 focus:bg-blue-100 rounded transition-all tooltip';
        addBtn.innerHTML = '<i data-lucide="plus" class="w-4 h-4"></i>';
        addBtn.title = '아래에 빈 행 삽입';
        addBtn.onclick = function () { insertRowAfter(this, tableId); };

        // 2. 위로
        const upBtn = document.createElement('button');
        upBtn.className = 'p-1 text-slate-400 hover:text-slate-800 hover:bg-slate-200 focus:bg-slate-300 rounded transition-all';
        upBtn.innerHTML = '<i data-lucide="chevron-up" class="w-4 h-4"></i>';
        upBtn.title = '위로 이동';
        upBtn.onclick = function () { moveRowUp(this, tableId); };

        // 3. 아래로
        const downBtn = document.createElement('button');
        downBtn.className = 'p-1 text-slate-400 hover:text-slate-800 hover:bg-slate-200 focus:bg-slate-300 rounded transition-all';
        downBtn.innerHTML = '<i data-lucide="chevron-down" class="w-4 h-4"></i>';
        downBtn.title = '아래로 이동';
        downBtn.onclick = function () { moveRowDown(this, tableId); };

        // 4. 삭제
        const delBtn = document.createElement('button');
        delBtn.className = 'p-1 text-red-300 hover:text-red-500 hover:bg-red-50 focus:bg-red-100 rounded transition-all';
        delBtn.innerHTML = '<i data-lucide="trash-2" class="w-4 h-4"></i>';
        delBtn.title = '행 삭제';
        delBtn.onclick = function () { deleteRow(this, tableId); };

        btnGroup.appendChild(addBtn);
        btnGroup.appendChild(upBtn);
        btnGroup.appendChild(downBtn);
        btnGroup.appendChild(delBtn);
        actionTd.appendChild(btnGroup);
        
        // 스마트 정리(병합) 상태일 땐 조작을 막아놔서 UI 꼬임을 원천봉쇄 (버튼 비활성화)
        if (nameRowspan > 1) {
            btnGroup.classList.add('opacity-30', 'pointer-events-none');
            btnGroup.title = '스마트 정리 모드에서는 순서 변경이 불가능합니다.';
        }
    }
    
    // 마우스 오버 감지 및 스마트 정리 모드 전용 지브라 패턴(Zebra Striping) 적용
    if (isEvenGroup && isSmartMode) {
        tr.className = "group bg-slate-100 hover:bg-slate-200 transition-colors";
    } else {
        tr.className = "group bg-white hover:bg-slate-50 transition-colors";
    }
    
    tr.appendChild(actionTd);
    
    tbody.appendChild(tr);
    if (window.lucide) window.lucide.createIcons({ root: actionTd });
    
    updateTableSummary(tableId);
}

// 5-1. 부분합계 행(Subtotal) 추가 로직
function addSubtotalRow(tableId, name, regular, vip, received) {
    const tbodyId = tableId === 'performer-table' ? 'performer-body' : 'other-body';
    const tbody = document.getElementById(tbodyId);
    if (!tbody) return;

    const tr = document.createElement('tr');
    tr.className = "subtotal-row bg-slate-50 font-bold text-slate-600 border-b-2 border-slate-300";
    
    let td = document.createElement('td');
    td.colSpan = 2;
    td.className = "text-center";
    td.innerText = `합계`;
    tr.appendChild(td);

    td = document.createElement('td');
    td.className = "text-center text-blue-600 bg-blue-50/50 py-2";
    td.innerText = regular > 0 ? regular : '';
    tr.appendChild(td);

    td = document.createElement('td');
    td.className = "text-center text-blue-600 bg-blue-50/50 py-2";
    td.innerText = vip > 0 ? vip : '';
    tr.appendChild(td);

    td = document.createElement('td');
    tr.appendChild(td);

    td = document.createElement('td');
    td.className = "text-center text-blue-600 bg-blue-50/50 py-2";
    td.innerText = received > 0 ? received : '';
    tr.appendChild(td);

    td = document.createElement('td');
    td.colSpan = 3;
    tr.appendChild(td);

    tbody.appendChild(tr);
}

function deleteRow(btn, tableId) {
    const tr = btn.closest('tr');
    tr.remove();
    const tbodyId = tableId === 'performer-table' ? 'performer-body' : 'other-body';
    
    // 병합된 엘리먼트를 삭제할 때 UI가 꼬이는 rowspan 에러를 방지하고 순서(NO)를 최신화하기 위해 즉각 재정렬
    const dataList = getTableData(tbodyId);
    document.getElementById(tbodyId).innerHTML = '';
    
    // 삭제 후 렌더링 시에는 임의로 그룹핑하지 않고 평문 나열 방식을 유지합니다.
    dataList.forEach(item => addRow(tableId, item, 1));
    
    // 부족해진 행 빈칸 다시 채워기
    let currentCount = document.getElementById(tbodyId).querySelectorAll('tr:not(.subtotal-row)').length;
    while (currentCount < 10) { addRow(tableId); currentCount++; }
    
    updateTableSummary(tableId);
    saveAllData();
}

function insertRowAfter(btn, tableId) {
    const tr = btn.closest('tr');
    const tbody = tr.parentNode;
    // 맨 끝에 빈 행을 생성한 뒤 눌러진 행 바로 아래(nextSibling)로 이동 삽입
    addRow(tableId);
    const newRow = tbody.lastElementChild;
    tbody.insertBefore(newRow, tr.nextSibling);
    
    // 순서(NO) 재정렬 및 파이어베이스 저장
    const dataList = getTableData(tbody.id);
    tbody.innerHTML = '';
    dataList.forEach(item => addRow(tableId, item, 1));
    saveAllData();
    updateTableSummary(tableId);
}

function moveRowUp(btn, tableId) {
    const tr = btn.closest('tr');
    const prev = tr.previousElementSibling;
    if (!prev) return; // 이미 맨 위라면 무시
    
    tr.parentNode.insertBefore(tr, prev); // 현재 행을 윗 행의 위로 이동
    
    const tbodyId = tableId === 'performer-table' ? 'performer-body' : 'other-body';
    const dataList = getTableData(tbodyId);
    document.getElementById(tbodyId).innerHTML = '';
    dataList.forEach(item => addRow(tableId, item, 1));
    saveAllData();
    updateTableSummary(tableId);
}

function moveRowDown(btn, tableId) {
    const tr = btn.closest('tr');
    const next = tr.nextElementSibling;
    if (!next) return; // 이미 맨 아래라면 무시
    
    // 다음 행을 현재 행의 위로 끌어올림으로써, 현재 행이 아래로 떨어지는 효과 부여
    tr.parentNode.insertBefore(next, tr); 
    
    const tbodyId = tableId === 'performer-table' ? 'performer-body' : 'other-body';
    const dataList = getTableData(tbodyId);
    document.getElementById(tbodyId).innerHTML = '';
    dataList.forEach(item => addRow(tableId, item, 1));
    saveAllData();
    updateTableSummary(tableId);
}


// 6. 스마트 정리 기능 (같은 출연자끼리 묶고 부분합계 도출)
window.smartOrganize = function (tableId) {
    const tbodyId = tableId === 'performer-table' ? 'performer-body' : 'other-body';
    
    // 현재 입력된 유효 데이터만 긁어옴
    const dataList = getTableData(tbodyId);
    if (dataList.length === 0) return;

    // 이름 오름차순으로 정렬
    dataList.sort((a, b) => {
        const nameA = a.name.trim();
        const nameB = b.name.trim();
        if (!nameA && !nameB) return 0;
        if (!nameA) return 1;
        if (!nameB) return -1;
        return nameA.localeCompare(nameB);
    });

    // 정렬된 리스트를 화면에 다시 렌더링 (그룹핑 기능 적용)
    const tbody = document.getElementById(tbodyId);
    tbody.innerHTML = '';
    renderGroupedList(dataList, tableId);
    
    // 스마트 정리 후에는 불필요한 빈 행을 추가하지 않고 깔끔한 요약 대시보드 형태만 유지합니다.
    
    updateTableSummary(tableId);
    saveAllData();
};

// 8. PDF 다운로드 기능
window.downloadPDF = function (btn) {
    const element = document.getElementById('main-content');
    const date = document.getElementById('event-date').value || '[1경기] 4월 11일 (토)';

    // 성능 및 잘림 현상(Cut-off) 방지를 위해 스크롤 임시 해제
    const tableContainers = document.querySelectorAll('.table-container');
    tableContainers.forEach(container => container.style.overflowX = 'visible');

    // 로딩 표시
    btn = btn || event.currentTarget;
    const originalText = btn.innerHTML;
    btn.innerHTML = '<i class="animate-spin mr-2">...</i> 생성 중';
    btn.disabled = true;

    // PDF 렌더링 시 텍스트 잘림 현상을 방지하기 위해 input 요소들을 임시로 텍스트 분할이 허용된 div 레이아웃으로 변환
    const inputs = element.querySelectorAll('input.input-cell');
    const placeholders = [];
    inputs.forEach(input => {
        const div = document.createElement('div');
        div.className = input.className;
        // 기존 텍스트 중앙정렬 등을 유지하되, 내용이 많을 경우 아래로 무한 확장될 수 있도록 고정 높이(100%, 48px)를 해제
        // 한글 단어 단위 잘림을 위해 word-break: keep-all 적용
        div.style.cssText = 'border: none; padding: 0.5rem; text-align: center; word-break: keep-all; overflow-wrap: anywhere; white-space: pre-wrap; width: 100%; display: block;';
        div.innerText = input.value;
        
        input.parentNode.insertBefore(div, input);
        input.style.display = 'none'; // 숨김
        placeholders.push({ input, div });
    });

    // 2. html2canvas rowspan 버그 수정
    // rowspan이 적용된 셀들의 텍스트가 vertical-align: middle일경우 중간으로 이동하다가 화면에서 짤려나가는 고질병 우회
    const rowspanTds = element.querySelectorAll('td[rowspan]');
    const originalStyles = [];
    rowspanTds.forEach(td => {
        if (parseInt(td.getAttribute('rowspan')) > 1) {
            originalStyles.push({ 
                td: td, 
                vAlign: td.style.verticalAlign, 
                pTop: td.style.paddingTop 
            });
            // 텍스트를 최상단(1행 위치)으로 끌어올림으로써 클리핑 영역 탈출
            td.style.setProperty('vertical-align', 'top', 'important');
            // 1행의 정중앙(약 16px)에 텍스트가 예쁘게 위치하도록 미세 패딩 추가
            td.style.setProperty('padding-top', '16px', 'important');
        }
    });

    const opt = {
        margin: [10, 3], // 상하 10mm, 좌우 여백 3mm
        filename: `티켓배부현황_${date}.pdf`,
        image: { type: 'jpeg', quality: 1.0 },
        html2canvas: {
            scale: 2,
            useCORS: true,
            logging: false,
            scrollX: 0,
            scrollY: 0,
            // 캔버스 사이즈가 컨테이너(max-width 1280px)보다 작아서 잘리는 현상 방지. 최소 1300 보장
            windowWidth: Math.max(1300, window.innerWidth)
        },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' }
    };

    // 다운로드 실행
    html2pdf().set(opt).from(element).save().then(() => {
        // 복구
        placeholders.forEach(p => {
            p.input.style.display = '';
            p.div.remove();
        });
        originalStyles.forEach(s => {
            s.td.style.verticalAlign = s.vAlign;
            s.td.style.paddingTop = s.pTop;
        });
        
        btn.innerHTML = originalText;
        btn.disabled = false;
        tableContainers.forEach(container => container.style.overflowX = 'auto');
    }).catch(err => {
        console.error('PDF 다운로드 실패:', err);
        
        // 에러 시 복구
        placeholders.forEach(p => {
            p.input.style.display = '';
            p.div.remove();
        });

        btn.innerHTML = originalText;
        btn.disabled = false;
        tableContainers.forEach(container => container.style.overflowX = 'auto');
        alert("PDF 생성 중 오류가 발생했습니다.");
    });
};

// --- 드래그 다중 선택 및 일괄 지우기 (Bulk Delete) 기능 ---
let isCellDragging = false;
let dragStartInput = null;
let dragSelectedCells = new Set();

document.addEventListener('mousedown', (e) => {
    // 입력창 내부가 아닌 배경 등 빈 공간을 클릭하면 선택 초기화
    if (e.target.tagName !== 'INPUT' || !e.target.classList.contains('input-cell')) {
        dragSelectedCells.forEach(cell => cell.classList.remove('bg-blue-100'));
        dragSelectedCells.clear();
        return;
    }
    
    isCellDragging = true;
    dragStartInput = e.target;
    
    // 기존에 여러 개 선택되어 있던 상태라면 클릭 리셋
    dragSelectedCells.forEach(cell => cell.classList.remove('bg-blue-100'));
    dragSelectedCells.clear();
    
    // 현재 칸 선택 (배경색 파랗게 하이라이트)
    dragSelectedCells.add(e.target);
    e.target.classList.add('bg-blue-100');
});

document.addEventListener('mousemove', (e) => {
    if (!isCellDragging) return;
    
    // 드래그 중인 상태일 때: 브라우저 기본 글자 드래그(Text Selection) 방해 회피
    // 텍스트 입력창은 드래그 시 포커스를 꽉 잡고 있으므로, 옆칸으로 넘어가면 포커스를 풀어줌
    if (dragStartInput && document.activeElement === dragStartInput) {
        const rect = dragStartInput.getBoundingClientRect();
        // 타일의 범위를 마우스가 벗어나는 순간 포커스 블러 (체감 반응 향상을 위해 +-5 픽셀 버퍼 둠)
        if (e.clientX < rect.left - 5 || e.clientX > rect.right + 5 || 
            e.clientY < rect.top - 5 || e.clientY > rect.bottom + 5) {
            dragStartInput.blur(); 
        }
    }

    // 마우스가 지나가는 자리(입력칸)를 파란색으로 다중 선택함
    if (e.target.tagName === 'INPUT' && e.target.classList.contains('input-cell')) {
        if (!dragSelectedCells.has(e.target)) {
            dragSelectedCells.add(e.target);
            e.target.classList.add('bg-blue-100');
        }
    }
});

document.addEventListener('mouseup', () => {
    isCellDragging = false;
    dragStartInput = null;
});

// 키보드 키 이벤트를 감지하여 일괄 삭제 (Delete, Backspace)
document.addEventListener('keydown', (e) => {
    // 다중 선택(2칸 이상) 모드 접속 상태에서만 일괄 비우기 규칙 발동
    if (dragSelectedCells.size > 1 && (e.key === 'Backspace' || e.key === 'Delete')) {
        e.preventDefault(); // 기본(글씨 1개 지우는 거) 방지
        
        // 파란색 칠해진 묶음을 모두 돌면서 내용을 빈칸('')으로 청소
        dragSelectedCells.forEach(cell => {
            cell.value = '';
            cell.classList.remove('bg-blue-100');
        });
        dragSelectedCells.clear(); // 선택목록 날리기
        
        // 일괄 변경된 값에 맞추어 표 요약 다시 내고 클라우드 동기화 수행
        updateTableSummary('performer-table');
        updateTableSummary('other-table');
        saveAllData();
    }
});
