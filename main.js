// 1. 보안 설정 (비밀번호: shwlgus)
const ADMIN_PASSWORD = "shwlgus"; 

// 2. 로그인 함수 (전역)
window.checkLogin = function() {
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
function saveAllData() {
    const data = {
        performers: getTableData('performer-body'),
        others: getTableData('other-body'),
        date: document.getElementById('event-date').value
    };
    localStorage.setItem('ticket_management_data', JSON.stringify(data));
    console.log("Data Auto-Saved");
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
            total: inputs[3].value,
            recipient: inputs[4].value,
            received: inputs[5].value,
            phone: inputs[6].value,
            remarks: inputs[7].value
        };
        
        if (Object.values(rowData).some(val => val !== '')) {
            rows.push(rowData);
        }
    }
    return rows;
}

function loadSavedData() {
    const saved = localStorage.getItem('ticket_management_data');
    if (!saved) return false;

    const data = JSON.parse(saved);
    if (data.date) document.getElementById('event-date').value = data.date;

    const performerBody = document.getElementById('performer-body');
    performerBody.innerHTML = '';
    if (data.performers && data.performers.length > 0) {
        data.performers.forEach(item => addRow('performer-table', item));
    }
    while (performerBody.rows.length < 10) addRow('performer-table');

    const otherBody = document.getElementById('other-body');
    otherBody.innerHTML = '';
    if (data.others && data.others.length > 0) {
        data.others.forEach(item => addRow('other-table', item));
    }
    while (otherBody.rows.length < 10) addRow('other-table');

    return true;
}

// 4. 페이지 초기화
document.addEventListener('DOMContentLoaded', () => {
    if (window.lucide) window.lucide.createIcons();
    
    if (sessionStorage.getItem('authenticated') === 'true') {
        showMainContent();
    }

    document.getElementById('event-date').value = new Date().toISOString().split('T')[0];

    if (!loadSavedData()) {
        for(let i=0; i<10; i++) {
            addRow('performer-table');
            addRow('other-table');
        }
    }

    document.getElementById('event-date').onchange = saveAllData;

    // 붙여넣기 이벤트 지원 (스크린샷 붙여넣기 등)
    document.addEventListener('paste', handlePaste);
});

// 5. 행 추가 기능
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
            td.className = 'no-cell';
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
                saveAllData();
            };
            td.appendChild(input);
        }
        tr.appendChild(td);
    });

    const actionTd = document.createElement('td');
    actionTd.className = 'text-center';
    actionTd.innerHTML = `<button onclick="this.closest('tr').remove(); saveAllData();" class="text-slate-300 hover:text-red-500"><i data-lucide="trash-2" class="w-4 h-4"></i></button>`;
    tr.appendChild(actionTd);
    tbody.appendChild(tr);
    
    if (window.lucide) window.lucide.createIcons({ root: actionTd });
}

// 6. AI 모달 및 분석
let currentAITarget = '';
let currentFileData = null; // { mime_type: string, data: base64_string }

window.toggleAIModal = function(targetTable = '') {
    const modal = document.getElementById('ai-modal');
    if (!modal) return;
    
    // 상태 초기화
    currentFileData = null;
    const fileInput = document.getElementById('file-upload');
    if (fileInput) fileInput.value = '';
    const textarea = document.getElementById('ai-input');
    if (textarea) textarea.value = '';
    
    if (modal.classList.contains('hidden')) {
        currentAITarget = targetTable;
        const targetName = targetTable === 'performer-table' ? '출연자 티켓' : '그 외 티켓';
        
        document.getElementById('modal-title').innerHTML = `<i data-lucide="sparkles" class="w-5 h-5"></i> AI 스마트 입력 - ${targetName}`;
        document.getElementById('modal-desc').innerText = `[${targetName}] 시트에 추가할 정보를 입력하거나 사진/파일을 올려주세요.`;
        document.getElementById('btn-text').innerText = `${targetName} 시트에 데이터 추가`;
        
        modal.classList.remove('hidden');
        modal.classList.add('flex');
        textarea.focus();
        if (window.lucide) window.lucide.createIcons({ root: document.getElementById('modal-header') });
    } else {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
        currentAITarget = '';
    }
};

async function handleAIParse() {
    const text = document.getElementById('ai-input').value.trim();
    if (!text && !currentFileData) {
        alert("분석할 내용이나 파일을 입력해주세요.");
        return;
    }

    const loading = document.getElementById('loading');
    loading.classList.remove('hidden');
    loading.classList.add('flex');
    
    const targetName = currentAITarget === 'performer-table' ? '출연자 티켓' : '그 외 티켓';
    const originalTarget = currentAITarget;
    
    toggleAIModal();

    try {
        // 프롬프트 구성
        const promptText = `사용자가 제공한 [${targetName}] 배부 정보(텍스트 또는 이미지)를 분석하여 JSON 배열로 반환해줘. 
        데이터가 여러 명일 경우 배열에 모두 포함시켜줘.
        필드: regular, vip, name, total, recipient, received, phone, remarks.
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
                generationConfig: { temperature: 0.1 }
            })
        });

        const data = await response.json();
        const raw = data.candidates[0].content.parts[0].text;
        const res = JSON.parse(raw.replace(/```json|```/g, '').trim());

        const items = Array.isArray(res) ? res : (res.items || res.performers || res.others || [res]);
        
        items.forEach(i => {
            if (i && (i.name || i.phone || i.total)) {
                addRow(originalTarget, i);
            }
        });
        
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
window.handleFileSelect = function(input) {
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
    
    loading.classList.remove('hidden');
    loading.classList.add('flex');

    const reader = new FileReader();
    const fileName = file.name.toLowerCase();
    const isImage = file.type.startsWith('image/');

    reader.onload = function(e) {
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
        reader.readAsText(file, "UTF-8");
    }
}
