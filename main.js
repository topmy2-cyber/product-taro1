// 1. 보안 설정 (비밀번호: shwlgus)
const ADMIN_PASSWORD = "shwlgus";

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
function updateTableSummary() {
    const tbody = document.getElementById('ticket-body');
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

    document.getElementById(`ticket-regular-sum`).innerText = regularTotal.toLocaleString();
    document.getElementById(`ticket-vip-sum`).innerText = vipTotal.toLocaleString();
    document.getElementById(`ticket-total-sum`).innerText = (regularTotal + vipTotal).toLocaleString();
}

function saveAllData() {
    const dateStr = document.getElementById('event-date').value || '[1경기] 4월 11일 (토)';
    const data = {
        tickets: getTableData('ticket-body'),
        date: dateStr
    };
    localStorage.setItem(`ticket_management_data_${dateStr}`, JSON.stringify(data));
    console.log("Data Auto-Saved for " + dateStr);
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

function loadSavedData() {
    const dateStr = document.getElementById('event-date').value || '[1경기] 4월 11일 (토)';
    const saved = localStorage.getItem(`ticket_management_data_${dateStr}`);

    const ticketBody = document.getElementById('ticket-body');
    ticketBody.innerHTML = '';

    if (saved) {
        const data = JSON.parse(saved);
        
        // 이전 버전(출연자+그외 분리) 데이터 호환 마이그레이션 적용
        if (data.performers && data.performers.length > 0) {
            data.performers.forEach(item => addRow('ticket-table', item));
        }
        if (data.others && data.others.length > 0) {
            data.others.forEach(item => addRow('ticket-table', item));
        }
        // 신규 구조 로드
        if (data.tickets && data.tickets.length > 0) {
            data.tickets.forEach(item => addRow('ticket-table', item));
        }
    }

    while (ticketBody.rows.length < 10) addRow('ticket-table');

    updateTableSummary();

    return !!saved;
}

// 4. 페이지 초기화
document.addEventListener('DOMContentLoaded', () => {
    if (window.lucide) window.lucide.createIcons();

    if (sessionStorage.getItem('authenticated') === 'true') {
        showMainContent();
    }

    const lastDate = localStorage.getItem('last_accessed_date') || '[1경기] 4월 11일 (토)';
    document.getElementById('event-date').value = lastDate;

    loadSavedData();

    document.getElementById('event-date').onchange = (e) => {
        localStorage.setItem('last_accessed_date', e.target.value);
        loadSavedData();
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
    const tbody = document.getElementById('ticket-body');
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
                    updateTableSummary();
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
    const button = document.createElement('button');
    button.className = 'text-slate-300 hover:text-red-500';
    button.innerHTML = '<i data-lucide="trash-2" class="w-4 h-4"></i>';
    button.onclick = function() { deleteRow(this); };
    actionTd.appendChild(button);
    tr.appendChild(actionTd);
    tbody.appendChild(tr);

    if (window.lucide) window.lucide.createIcons({ root: actionTd });
    updateTableSummary();
}

function deleteRow(btn) {
    const tr = btn.closest('tr');
    tr.remove();
    updateRowNumbers('ticket-body');
    saveAllData();
    updateTableSummary();
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
        const promptText = `사용자가 제공한 티켓 배부 정보(텍스트 또는 이미지)를 분석하여 JSON 배열로 반환해줘. 
        데이터가 여러 명일 경우 배열에 모두 포함시켜줘.
        필드: regular, vip, name, recipient, received, phone, remarks.
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

        const items = Array.isArray(res) ? res : (res.items || res.tickets || res.performers || res.others || [res]);

        items.forEach(i => {
            if (i && (i.name || i.phone || i.regular || i.vip)) {
                addRow('ticket-table', i);
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
            windowWidth: Math.max(1200, element.scrollWidth) // 컨텐츠가 1200을 넘으면 그 너비에 맞게 캡처
        },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' }
    };

    // 다운로드 실행
    html2pdf().set(opt).from(element).save().then(() => {
        btn.innerHTML = originalText;
        btn.disabled = false;
        // 스크롤 원상 복구
        tableContainers.forEach(container => container.style.overflowX = 'auto');
    }).catch(err => {
        console.error('PDF 다운로드 실패:', err);
        btn.innerHTML = originalText;
        btn.disabled = false;
        tableContainers.forEach(container => container.style.overflowX = 'auto');
        alert("PDF 생성 중 오류가 발생했습니다.");
    });
};
