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
            if (tds.length >= 6) {
                tds[1].innerText = groupRegular > 0 ? groupRegular : '';
                tds[2].innerText = groupVip > 0 ? groupVip : '';
                tds[5].innerText = groupReceived > 0 ? groupReceived : '';
            }
            groupRegular = 0;
            groupVip = 0;
            groupReceived = 0;
            continue;
        }
        
        const inputs = Array.from(tr.getElementsByTagName('input'));
        const regInput = inputs.find(el => el.dataset.key === 'regular');
        const vipInput = inputs.find(el => el.dataset.key === 'vip');
        const rcvInput = inputs.find(el => el.dataset.key === 'received');
        
        const r = regInput ? (parseInt(regInput.value) || 0) : 0;
        const v = vipInput ? (parseInt(vipInput.value) || 0) : 0;
        const c = rcvInput ? (parseInt(rcvInput.value) || 0) : 0;

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
    // 내가 수정 중일 때 타인의 동기화로 표가 덮어씌워져 타이핑이 끊기는 현상 1.5초간 방지
    localUpdateTimer = setTimeout(() => { isLocalUpdate = false; }, 1500);

    const dateStr = document.getElementById('event-date').value || '[1경기] 4월 11일 (토)';
    const data = {
        performers: getTableData('performer-body'),
        others: getTableData('other-body'),
        date: dateStr,
        timestamp: Date.now()
    };

    // 파이어베이스가 세팅되어 있으면 클라우드에 전송, 아니면 예전처럼 내 폰(로컬)에만 임시저장
    if (firebaseDb) {
        firebaseDb.ref('tickets/' + dateStr).set(data);
    } else {
        localStorage.setItem(`ticket_management_data_${dateStr}`, JSON.stringify(data));
        console.log("Data Auto-Saved for " + dateStr);
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
        
        const inputs = Array.from(tr.getElementsByTagName('input'));
        if (inputs.length === 0) continue;

        const getValue = (key) => {
            const el = inputs.find(input => input.dataset.key === key);
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

        if (Object.values(rowData).some(val => val !== '')) {
            rows.push(rowData);
        }
    }
    return rows;
}

let currentSyncRef = null;

function loadSavedData(forceRender = false) {
    const dateStr = document.getElementById('event-date').value || '[1경기] 4월 11일 (토)';

    if (firebaseDb) {
        // [클라우드 연동 모드]
        // 파이어베이스 네트워크 연결을 기다리는 동안 화면이 휑하게 비어있지 않도록 일단 기본 10행 그리기
        if (!isLocalUpdate || forceRender) {
            renderTableData(null); 
        }

        if (currentSyncRef) currentSyncRef.off(); // 이전 날짜 실시간 수신기능 해제
        
        currentSyncRef = firebaseDb.ref('tickets/' + dateStr);
        currentSyncRef.on('value', (snapshot) => {
            // 내가 타이핑 중이 아닐 때만 남이 바꾼 화면을 업데이트
            if (isLocalUpdate && !forceRender) return; 
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

    if (data) {
        // 출연자 명단은 그룹화하여 렌더링
        if (data.performers && data.performers.length > 0) {
            renderGroupedList(data.performers, 'performer-table');
        }
        // 옛날 호환용 속성
        if (data.tickets && data.tickets.length > 0) {
            renderGroupedList(data.tickets, 'performer-table');
        }
        
        // 그 외 배부도 동일하게 자동 병합 그룹핑 지원
        if (data.others && data.others.length > 0) {
            renderGroupedList(data.others, 'other-table');
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

        for (let j = 0; j < groupSize; j++) {
            const dataItem = list[i + j];
            subRegular += parseInt(dataItem.regular) || 0;
            subVip += parseInt(dataItem.vip) || 0;
            subReceived += parseInt(dataItem.received) || 0;
            
            // 첫 번째 행은 rowspan 값을 넘기고, 나머지는 0을 넘겨 cell을 숨김
            const rowspanFlag = (j === 0) ? groupSize : 0;
            addRow(tableId, dataItem, rowspanFlag); 
        }

        // 이름이 있고 의미있는 데이터가 있으면 해당 인물의 부분합계 행 추가
        if (item.name && item.name.trim() !== "") {
            addSubtotalRow(tableId, item.name, subRegular, subVip, subReceived);
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

// 5. 행 추가 기능 (그룹핑 병합 지원)
function addRow(tableId, data = null, nameRowspan = 1) {
    const tbodyId = tableId === 'performer-table' ? 'performer-body' : 'other-body';
    const tbody = document.getElementById(tbodyId);
    if (!tbody) return;

    const tr = document.createElement('tr');
    
    // 서브토탈을 제외한 순수 데이터 로우의 개수로 순번 계산
    const noCount = tbody.querySelectorAll('tr:not(.subtotal-row)').length + 1;

    const createInput = (key, value, type = 'text', hidden = false) => {
        const input = document.createElement('input');
        input.type = hidden ? 'hidden' : type;
        input.value = value || '';
        input.dataset.key = key;
        if (!hidden) input.className = 'input-cell';
        
        if (key === 'regular' || key === 'vip' || key === 'received') {
            input.oninput = function () { saveAllData(); updateTableSummary(tableId); };
        } else {
            input.onchange = saveAllData;
        }
        return input;
    };

    // 1. NO cell (rowspan 적용)
    if (nameRowspan > 0) {
        const td = document.createElement('td');
        td.className = 'no-cell bg-white'; 
        if (nameRowspan > 1) td.rowSpan = nameRowspan;
        td.innerText = data?.no || noCount;
        tr.appendChild(td);
    }

    // 2. 일반석
    let td = document.createElement('td');
    td.appendChild(createInput('regular', data?.regular, 'number'));
    tr.appendChild(td);

    // 3. VIP석
    td = document.createElement('td');
    td.appendChild(createInput('vip', data?.vip, 'number'));
    tr.appendChild(td);

    // 4. 이름 (rowspan 적용 및 숨김 처리)
    if (nameRowspan > 0) {
        td = document.createElement('td');
        if (nameRowspan > 1) td.rowSpan = nameRowspan;
        td.className = "bg-white relative";
        td.appendChild(createInput('name', data?.name));
        tr.appendChild(td);
    } else {
        // 그룹에 묶여 숨겨지는 칸이라도 저장될 수 있도록 hidden input으로 삽입 (DOM 오류 방지를 위해 안보이는 td 생성)
        td = document.createElement('td');
        td.style.display = 'none';
        td.appendChild(createInput('name', data?.name, 'text', true));
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

    // 9. 삭제 버튼
    const actionTd = document.createElement('td');
    actionTd.className = 'text-center bg-white';
    actionTd.setAttribute('data-html2canvas-ignore', 'true');
    const button = document.createElement('button');
    button.className = 'text-slate-300 hover:text-red-500';
    button.innerHTML = '<i data-lucide="trash-2" class="w-4 h-4"></i>';
    button.onclick = function () { deleteRow(this, tableId); };
    actionTd.appendChild(button);
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
    td.colSpan = 1;
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
    td.className = "text-center";
    td.innerText = `${name} 팀 합계`;
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
    updateRowNumbers(tbodyId);
    saveAllData();
    updateTableSummary(tableId);
}

function updateRowNumbers(tbodyId) {
    const tbody = document.getElementById(tbodyId);
    const rows = tbody.querySelectorAll('tr:not(.subtotal-row)');
    for (let i = 0; i < rows.length; i++) {
        const noCell = rows[i].querySelector('.no-cell');
        if (noCell) noCell.innerText = i + 1;
    }
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

    // 정렬된 데이터를 다시 화면에 뿌림 (데이터 구조에 맞게 renderGroupedList 재활용)
    const tbody = document.getElementById(tbodyId);
    tbody.innerHTML = '';
    
    // 정렬된 리스트를 화면에 다시 렌더링 (그 외 배부도 동일한 그룹핑 기능 제공)
    renderGroupedList(dataList, tableId, tbodyId);
    
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
        btn.innerHTML = originalText;
        btn.disabled = false;
        tableContainers.forEach(container => container.style.overflowX = 'auto');
    }).catch(err => {
        console.error('PDF 다운로드 실패:', err);
        btn.innerHTML = originalText;
        btn.disabled = false;
        tableContainers.forEach(container => container.style.overflowX = 'auto');
        alert("PDF 생성 중 오류가 발생했습니다.");
    });
};
