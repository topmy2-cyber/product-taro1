// 1. 보안 설정 (비밀번호: shwlgus)
const ADMIN_PASSWORD = "shwlgus";

// ==========================================
// [ 파이어베이스 공유 데이터베이스 설정 ]
// 1. 파이어베이스 접속 후 새 프로젝트 생성 -> Realtime Database 생성 (테스트 모드)
// 2. 프로젝트 설정에서 웹앱 추가 후 아래 텅 빈 '' 안에 발급받은 키값을 붙여넣으세요.
// (키값이 채워지면 앱은 자동으로 실시간 공유시트 모드로 변신합니다!)
// ==========================================
const FIREBASE_CONFIG = {
    apiKey: "",
    authDomain: "",
    databaseURL: "",
    projectId: "",
    storageBucket: "",
    messagingSenderId: "",
    appId: ""
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

    let regularTotal = 0;
    let vipTotal = 0;

    for (let i = 0; i < tbody.rows.length; i++) {
        const inputs = tbody.rows[i].getElementsByTagName('input');
        if (inputs.length >= 2) {
            regularTotal += parseInt(inputs[0].value) || 0;
            vipTotal += parseInt(inputs[1].value) || 0;
        }
    }

    document.getElementById(`${prefix}-regular-sum`).innerText = regularTotal.toLocaleString();
    document.getElementById(`${prefix}-vip-sum`).innerText = vipTotal.toLocaleString();
    document.getElementById(`${prefix}-total-sum`).innerText = (regularTotal + vipTotal).toLocaleString();
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
        const inputs = tr.getElementsByTagName('input');
        if (inputs.length === 0) continue;

        const rowData = {
            regular: inputs[0].value,
            vip: inputs[1].value,
            name: inputs[2].value,
            recipient: inputs[3].value,
            received: inputs[4].value,
            phone: inputs[5].value,
            remarks: inputs[6].value
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
        if (currentSyncRef) currentSyncRef.off(); // 이전 날짜 실시간 수신기능 해제
        
        currentSyncRef = firebaseDb.ref('tickets/' + dateStr);
        currentSyncRef.on('value', (snapshot) => {
            // 내가 타이핑 중이 아닐 때만 남이 바꾼 화면을 업데이트
            if (isLocalUpdate && !forceRender) return; 
            const data = snapshot.val();
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
        if (data.performers && data.performers.length > 0) {
            data.performers.forEach(item => addRow('performer-table', item));
        }
        if (data.others && data.others.length > 0) {
            data.others.forEach(item => addRow('other-table', item));
        }
        // 과거 로컬통합 데이터 호환용
        if (data.tickets && data.tickets.length > 0) {
            data.tickets.forEach(item => addRow('performer-table', item));
        }
    }

    while (performerBody.rows.length < 10) addRow('performer-table');
    while (otherBody.rows.length < 10) addRow('other-table');

    updateTableSummary('performer-table');
    updateTableSummary('other-table');

    return !!data;
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

    // 붙여넣기 이벤트 지원 (스크린샷 붙여넣기 등)
    document.addEventListener('paste', handlePaste);

    // 드래그 앤 드롭 파일 업로드 지원
    const dropzone = document.getElementById('file-dropzone');
    if (dropzone) {
        dropzone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropzone.classList.add('dragover');
        });
        dropzone.addEventListener('dragleave', (e) => {
            e.preventDefault();
            dropzone.classList.remove('dragover');
        });
        dropzone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropzone.classList.remove('dragover');
            if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                processFile(e.dataTransfer.files[0]);
            }
        });
    }
});

// 5. 행 추가 기능
function addRow(tableId, data = null) {
    const tbodyId = tableId === 'performer-table' ? 'performer-body' : 'other-body';
    const tbody = document.getElementById(tbodyId);
    if (!tbody) return;

    const tr = document.createElement('tr');
    const fields = [
        { key: 'no', value: data?.no || (tbody.rows.length + 1) },
        { key: 'regular', value: data?.regular || '', type: 'number' },
        { key: 'vip', value: data?.vip || '', type: 'number' },
        { key: 'name', value: data?.name || '' },
        { key: 'recipient', value: data?.recipient || '' },
        { key: 'received', value: data?.received || '', type: 'number' },
        { key: 'phone', value: data?.phone || '' },
        { key: 'remarks', value: data?.remarks || '' }
    ];

    fields.forEach(field => {
        const td = document.createElement('td');
        if (field.key === 'no') {
            td.className = 'no-cell';
            td.innerText = field.value;
        } else {
            const input = document.createElement('input');
            input.type = field.type || 'text';
            input.value = field.value;
            input.dataset.key = field.key;
            input.className = 'input-cell';
            if (field.readonly) {
                input.readOnly = true;
                input.tabIndex = -1;
            }
            if (field.key === 'regular' || field.key === 'vip') {
                input.oninput = function() {
                    saveAllData();
                    updateTableSummary(tableId);
                };
            } else {
                input.onchange = saveAllData;
            }
            td.appendChild(input);
        }
        tr.appendChild(td);
    });

    const actionTd = document.createElement('td');
    actionTd.className = 'text-center';
    actionTd.setAttribute('data-html2canvas-ignore', 'true'); // PDF 출력 시 삭제버튼 열 숨김
    const button = document.createElement('button');
    button.className = 'text-slate-300 hover:text-red-500';
    button.innerHTML = '<i data-lucide="trash-2" class="w-4 h-4"></i>';
    button.onclick = function() { deleteRow(this, tableId); };
    actionTd.appendChild(button);
    tr.appendChild(actionTd);
    tbody.appendChild(tr);

    if (window.lucide) window.lucide.createIcons({ root: actionTd });
    updateTableSummary(tableId);
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
    for (let i = 0; i < tbody.rows.length; i++) {
        tbody.rows[i].querySelector('.no-cell').innerText = i + 1;
    }
}

// 6. AI 기능 변수
let currentAITarget = '';
let currentFileData = null;

function toggleAIModal(target = '') {
    const modal = document.getElementById('ai-modal');
    if (modal.classList.contains('hidden')) {
        currentAITarget = target;
        currentFileData = null;
        document.getElementById('ai-input').value = '';
        document.getElementById('file-loading').classList.add('hidden');
        document.getElementById('file-loading').classList.remove('flex');
        modal.classList.remove('hidden');
        modal.classList.add('flex');
        document.getElementById('ai-input').focus();
    } else {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }
}

async function handleAIParse() {
    const text = document.getElementById('ai-input').value;
    if (!text && !currentFileData) {
        alert('분석할 내용이나 파일을 입력해주세요.');
        return;
    }

    const loading = document.getElementById('loading');
    loading.classList.remove('hidden');
    loading.classList.add('flex');

    toggleAIModal();

    try {
        const promptText = `사용자가 제공한 티켓 배부 정보(텍스트 또는 사진)를 분석하여, 인물들을 두 그룹으로 나누어 다음 구조의 JSON 객체로 반환해줘.
        1) 'performers' 배열: 다음 17명의 지정된 출연자 명단(김택, 이대희, 장진혁, 박찬열, 최민호, 서장훈, 김태술, 전태풍, 정진운, 오승훈, 문수인, 정규민, 줄리엔강, 조진세, 박찬웅, 손태진, 산다라박)과 관련된 티켓.
        2) 'others' 배열: 위 출연자 명단에 속하지 않은 일반 지인, 기타 초대 등 명백히 출연자와 무관하거나 판단하기 애매한 명단은 무조건 여기에 배정.
        각 배열 안의 객체 필드: regular, vip, name, recipient, received, phone, remarks.
        반환 예시: {"performers": [...], "others": [...]}
        주의: 분석할 수 없는 데이터는 제외해줘. 텍스트 내용: "${text}"`;

        const parts = [{ text: promptText }];

        // 이미지가 있는 경우 페이로드에 추가
        if (currentFileData) {
            parts.push({
                inline_data: {
                    mime_type: currentFileData.mime_type,
                    data: currentFileData.data
                }
            });
        }

        const response = await fetch('/api/gemini', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: parts }],
                generationConfig: { temperature: 0.1, response_mime_type: "application/json" }
            })
        });

        const data = await response.json();
        const raw = data.candidates[0].content.parts[0].text;
        const res = JSON.parse(raw.replace(/```json|```/g, '').trim());

        // 배열로 응답한 옛날 포맷 fallback (안전망)
        if (Array.isArray(res)) {
            res.forEach(i => {
                if (i && (i.name || i.phone || i.regular || i.vip)) addRow('performer-table', i);
            });
        } else {
            if (res.performers && Array.isArray(res.performers)) {
                res.performers.forEach(i => {
                    if (i && (i.name || i.phone || i.regular || i.vip)) addRow('performer-table', i);
                });
            }
            if (res.others && Array.isArray(res.others)) {
                res.others.forEach(i => {
                    if (i && (i.name || i.phone || i.regular || i.vip)) addRow('other-table', i);
                });
            }
        }

        saveAllData();
    } catch (e) {
        console.error(e);
        alert('분석 실패. 텍스트가 잘 인식되도록 사진을 다시 찍거나 직접 입력해주세요.');
    } finally {
        loading.classList.add('hidden');
        loading.classList.remove('flex');
    }
}

// 7. 파일 업로드 및 텍스트/이미지 추출
window.handleFileSelect = function (input) {
    const file = input.files[0];
    if (!file) return;
    processFile(file);
};

// 붙여넣기 처리 (이미지 붙여넣기 지원)
function handlePaste(e) {
    const items = e.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf("image") !== -1) {
            const file = items[i].getAsFile();
            // 모달이 열려있을 때만 처리
            if (!document.getElementById('ai-modal').classList.contains('hidden')) {
                processFile(file);
            }
        }
    }
}

function processFile(file) {
    const loading = document.getElementById('file-loading');
    const textarea = document.getElementById('ai-input');

    const fileName = file.name.toLowerCase();
    const isImage = file.type.startsWith('image/');

    // 지원하지 않는 오피스/한글/PDF 파일 예외 처리
    const unsupportedExts = ['hwp', 'hwpx', 'doc', 'docx', 'pdf', 'ppt', 'pptx'];
    const ext = fileName.split('.').pop();
    if (unsupportedExts.includes(ext)) {
        alert("지원되지 않는 파일 형식입니다. (현재 사진, 엑셀, 텍스트 파일만 지원)\n한글, 워드, PDF 파일의 내용은 드래그하여 텍스트로 복사 붙여넣기 하거나, 표 부분만 스크린샷 캡처 후 붙여넣어(Ctrl+V) 주세요.");
        return;
    }

    loading.classList.remove('hidden');
    loading.classList.add('flex');

    const reader = new FileReader();

    reader.onload = function (e) {
        try {
            if (isImage) {
                // 이미지 처리: Base64 추출
                const base64Data = e.target.result.split(',')[1];
                currentFileData = {
                    mime_type: file.type,
                    data: base64Data
                };
                textarea.value = `[이미지 첨부됨: ${file.name}]\nAI가 이미지 속의 텍스트를 분석합니다. '데이터 추가' 버튼을 눌러주세요.`;
            } else if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
                // 엑셀 처리
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                let fullText = "";
                workbook.SheetNames.forEach(sheetName => {
                    const csv = XLSX.utils.sheet_to_csv(workbook.Sheets[sheetName]);
                    if (csv.trim()) fullText += `--- ${sheetName} ---\n${csv}\n\n`;
                });
                textarea.value = fullText;
                currentFileData = null;
            } else {
                // 일반 텍스트
                textarea.value = e.target.result;
                currentFileData = null;
            }
        } catch (error) {
            console.error(error);
            alert("파일 읽기 오류");
        } finally {
            loading.classList.add('hidden');
            loading.classList.remove('flex');
        }
    };

    if (isImage) {
        reader.readAsDataURL(file);
    } else if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
        reader.readAsArrayBuffer(file);
    } else {
        reader.readAsText(file);
    }
}

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
