// ==========================================
// 1. SECURITY & INITIALIZATION
// ==========================================

const currentUser = localStorage.getItem('lifesync_user');
const currentRole = localStorage.getItem('lifesync_role'); 

if(localStorage.getItem('lifesync_auth') !== 'true' || !currentUser) {
    window.location.href = 'landing.html';
}

// Global State
let habits = [];
let tasks = [];
let numericChartInstance = null;
let viewDate = new Date(); 
let myChart = null; 

// --- API HELPER ---
async function apiCall(endpoint, method = 'GET', body = null) {
    const options = {
        method,
        headers: { 'Content-Type': 'application/json', 'x-user': currentUser }
    };
    if (body) options.body = JSON.stringify(body);
    const res = await fetch(`/api${endpoint}`, options);
    if(res.status === 401) logout();
    return res.json();
}

// --- INIT ---
document.getElementById('todayDate').innerText = new Date().toLocaleDateString('en-US', { 
    weekday: 'short', month: 'long', day: 'numeric'
});

async function initApp() {
    // 1. Load Data
    const data = await apiCall('/data');
    habits = data.habits;
    tasks = data.tasks;

    // 2. Render App
    renderTasks();
    renderMonthGrid(); 
    initDashboardChart();
    updateDashboardStats();
    initNumericAnalytics();

    // 3. Setup Profile Menu
    document.getElementById('navUsername').innerText = currentUser;
    document.getElementById('navUserInitial').innerText = currentUser.charAt(0).toUpperCase();
    document.getElementById('navRoleDisplay').innerText = currentRole === 'admin' ? 'System Administrator' : 'Standard Member';

    // 4. Inject Admin Link if Admin
    if(currentRole === 'admin') {
        const container = document.getElementById('adminLinkContainer');
        container.innerHTML = `
            <a href="admin.html" class="w-full text-left px-4 py-3 text-sm text-red-400 hover:bg-gray-700 hover:text-red-300 flex items-center gap-3 transition">
                 <i class="fas fa-shield-alt w-5 text-center"></i> Admin Panel
            </a>
        `;
    }
}

initApp();

// ==========================================
// 2. NAVIGATION & SYSTEM
// ==========================================

function switchTab(tab) {
    document.querySelectorAll('.hidden-section').forEach(el => el.classList.add('hidden-section'));
    document.getElementById('panel-dashboard').classList.add('hidden-section');
    document.getElementById('panel-habits').classList.add('hidden-section');
    
    document.getElementById('nav-dashboard').classList.remove('active-nav');
    document.getElementById('nav-habits').classList.remove('active-nav');

    document.getElementById('panel-' + tab).classList.remove('hidden-section');
    document.getElementById('nav-' + tab).classList.add('active-nav');

    if(tab === 'dashboard') {
        updateDashboardStats();
        initNumericAnalytics(); 
    } else {
        renderMonthGrid();
    }
}

// --- PROFILE MENU LOGIC ---
function toggleProfileDropdown(e) {
    if(e) e.stopPropagation(); // Prevent immediate close
    const menu = document.getElementById('profileDropdown');
    menu.classList.toggle('hidden');
}

// Close dropdown when clicking outside
document.addEventListener('click', (e) => {
    const menu = document.getElementById('profileDropdown');
    const btn = document.getElementById('profileSection');
    if (!btn.contains(e.target)) {
        menu.classList.add('hidden');
    }
});

function toggleTheme() {
    // Simple filter inversion demo
    document.body.classList.toggle('theme-light');
}

async function deleteMyAccount() {
    const confirmName = prompt(`DANGER: This will permanently delete your account and all data.\n\nType your username "${currentUser}" to confirm:`);
    
    if(confirmName === currentUser) {
        try {
            const res = await fetch('/api/user/me', {
                method: 'DELETE',
                headers: { 'x-user': currentUser }
            });
            if(res.ok) {
                alert('Account deleted. Goodbye.');
                logout();
            } else {
                alert('Error deleting account.');
            }
        } catch(e) {
            alert('Connection failed.');
        }
    } else if(confirmName !== null) {
        alert('Username did not match. Deletion cancelled.');
    }
}

function logout() {
    localStorage.removeItem('lifesync_auth');
    localStorage.removeItem('lifesync_user');
    localStorage.removeItem('lifesync_role');
    window.location.href = 'landing.html';
}

// ==========================================
// 3. EXCEL EXPORT
// ==========================================
function exportToExcel() {
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const monthName = viewDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

    let header = ['Habit', 'Type', 'Target', 'Unit'];
    const dateKeys = []; 

    for (let i = 1; i <= daysInMonth; i++) {
        const d = new Date(year, month, i);
        header.push(d.toLocaleDateString('en-US', { day: 'numeric', month: 'short' })); 
        dateKeys.push(formatDateKey(d));
    }

    const dataRows = habits.map(h => {
        let row = [
            h.text, 
            h.type, 
            h.type === 'numeric' ? h.target : '-', 
            h.type === 'numeric' ? h.unit : '-'
        ];
        dateKeys.forEach(key => {
            const val = h.history[key];
            if (val === undefined) {
                row.push('');
            } else if (h.type === 'boolean') {
                row.push(val ? '✔' : '');
            } else {
                row.push(val);
            }
        });
        return row;
    });

    const wsData = [header, ...dataRows];
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    XLSX.utils.book_append_sheet(wb, ws, monthName);
    XLSX.writeFile(wb, `Streaky_Export_${monthName.replace(' ', '_')}.xlsx`);
}

// ==========================================
// 4. MONTHLY GRID LOGIC
// ==========================================

function changeMonth(offset) {
    viewDate.setDate(1); 
    viewDate.setMonth(viewDate.getMonth() + offset);
    renderMonthGrid();
}

function renderMonthGrid() {
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const todayKey = formatDateKey(new Date());

    document.getElementById('displayMonth').innerText = viewDate.toLocaleDateString('en-US', { month: 'long' });
    document.getElementById('displayYear').innerText = year;

    const headerRow = document.getElementById('gridHeaderRow');
    const tbody = document.getElementById('habitGridBody');

    let headerHTML = `<th class="p-4 w-48 sticky-col text-gray-400 font-bold uppercase text-xs tracking-wider shadow-xl z-20 bg-gray-900">Habit</th>`;
    
    for(let i = 1; i <= daysInMonth; i++) {
        const dateObj = new Date(year, month, i);
        const dateKey = formatDateKey(dateObj);
        const isToday = dateKey === todayKey;
        const weekday = dateObj.toLocaleDateString('en-US', { weekday: 'narrow' });

        headerHTML += `
            <th class="p-2 text-center min-w-[50px] border-l border-gray-800/50 relative group">
                <div class="flex flex-col items-center">
                    <span class="text-[10px] text-gray-500 mb-1">${weekday}</span>
                    <span class="${isToday ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/50' : 'text-gray-300'} w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold">
                        ${i}
                    </span>
                </div>
            </th>
        `;
    }
    headerHTML += `<th class="p-2 sticky-col right-0 bg-gray-900 z-10 w-16 text-center"></th>`;
    headerRow.innerHTML = headerHTML;

    tbody.innerHTML = '';
    
    habits.forEach(habit => {
        const tr = document.createElement('tr');
        tr.className = "border-b border-gray-700 hover:bg-gray-800/50 transition group";
        
        let rowHTML = `
            <td class="p-4 font-medium text-gray-200 sticky-col shadow-xl z-10 bg-gray-800 border-r border-gray-700">
                <div class="flex flex-col">
                    <span>${habit.text}</span>
                    ${habit.type === 'numeric' ? `<span class="text-[10px] text-gray-500">Target: ${habit.target} ${habit.unit}</span>` : ''}
                </div>
            </td>
        `;

        for(let i = 1; i <= daysInMonth; i++) {
            const dateObj = new Date(year, month, i);
            const dateKey = formatDateKey(dateObj);
            const val = habit.history[dateKey]; 
            
            rowHTML += `<td class="p-2 text-center border-l border-gray-700/30">`;
            
            if (habit.type === 'boolean') {
                const isChecked = val === 1 || val === true; 
                rowHTML += `
                    <input type="checkbox" class="custom-checkbox mx-auto" 
                        onchange="toggleHabitBoolean(${habit.id}, '${dateKey}')" 
                        ${isChecked ? 'checked' : ''}>
                `;
            } else {
                const displayVal = val !== undefined ? val : '';
                const metGoal = val >= habit.target;
                const borderClass = metGoal ? 'border-green-500/50 text-green-400 font-bold' : 'border-gray-600 text-gray-300';
                
                rowHTML += `
                    <input type="number" 
                        class="w-10 h-8 bg-gray-900 border ${borderClass} rounded text-center text-xs focus:border-blue-500 focus:text-white outline-none appearance-none transition-colors"
                        value="${displayVal}"
                        placeholder="-"
                        onblur="updateHabitNumeric(this, ${habit.id}, '${dateKey}')"
                        onkeypress="handleEnter(event, this)">
                `;
            }
            rowHTML += `</td>`;
        }

        rowHTML += `
            <td class="p-2 text-center sticky-col right-0 bg-gray-800 z-10 border-l border-gray-700">
                <button onclick="deleteHabit(${habit.id})" class="text-gray-600 hover:text-red-500 opacity-0 group-hover:opacity-100 transition">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        `;

        tr.innerHTML = rowHTML;
        tbody.appendChild(tr);
    });
}

// ==========================================
// 5. HABIT MANAGEMENT
// ==========================================

function openHabitModal() {
    document.getElementById('habitModal').classList.remove('hidden');
    document.getElementById('habitModal').classList.add('flex');
    document.getElementById('habitName').focus();
}

function closeHabitModal() {
    document.getElementById('habitModal').classList.add('hidden');
    document.getElementById('habitModal').classList.remove('flex');
    document.getElementById('habitName').value = '';
    document.getElementById('habitUnit').value = '';
    document.getElementById('habitTarget').value = '';
    document.getElementById('habitType').value = 'boolean';
    toggleHabitFields();
}

function toggleHabitFields() {
    const type = document.getElementById('habitType').value;
    const isNum = type === 'numeric';
    document.getElementById('unitField').classList.toggle('hidden', !isNum);
    document.getElementById('targetField').classList.toggle('hidden', !isNum);
}

async function saveHabit(e) {
    e.preventDefault();
    const name = document.getElementById('habitName').value;
    const type = document.getElementById('habitType').value;
    const unit = document.getElementById('habitUnit').value;
    const target = document.getElementById('habitTarget').value;

    if(name) {
        const payload = { 
            text: name, 
            type: type,
            unit: type === 'numeric' ? unit : '',
            target: type === 'numeric' ? parseFloat(target) : 1
        };

        const res = await apiCall('/habits', 'POST', payload);
        habits.push({ ...payload, id: res.id, history: {} });
        closeHabitModal();
        renderMonthGrid();
        updateDashboardStats();
    }
}

async function deleteHabit(id) {
    if(confirm("Delete this habit permanently?")) {
        await apiCall(`/habits/${id}`, 'DELETE');
        habits = habits.filter(h => h.id !== id);
        renderMonthGrid();
        updateDashboardStats();
    }
}

async function toggleHabitBoolean(id, dateKey) {
    const habit = habits.find(h => h.id === id);
    if(habit) {
        const newVal = habit.history[dateKey] ? null : 1;
        if(newVal === null) delete habit.history[dateKey];
        else habit.history[dateKey] = 1;
        await apiCall('/history', 'POST', { habitId: id, date: dateKey, value: newVal });
        updateDashboardStats(); 
    }
}

async function updateHabitNumeric(input, id, dateKey) {
    const val = parseFloat(input.value);
    const habit = habits.find(h => h.id === id);
    if(habit) {
        let sendVal = val;
        if(isNaN(val) || input.value === '') {
            delete habit.history[dateKey];
            sendVal = null;
            input.classList.remove('border-green-500/50', 'text-green-400', 'font-bold');
            input.classList.add('border-gray-600', 'text-gray-300');
        } else {
            habit.history[dateKey] = val;
            if(val >= habit.target) {
                input.classList.remove('border-gray-600', 'text-gray-300');
                input.classList.add('border-green-500/50', 'text-green-400', 'font-bold');
            } else {
                input.classList.remove('border-green-500/50', 'text-green-400', 'font-bold');
                input.classList.add('border-gray-600', 'text-gray-300');
            }
        }
        await apiCall('/history', 'POST', { habitId: id, date: dateKey, value: sendVal });
        updateDashboardStats();
    }
}

function handleEnter(e, input) { if(e.key === 'Enter') input.blur(); }

// ==========================================
// 6. TASK MANAGER
// ==========================================

function renderTasks() {
    const container = document.getElementById('taskList');
    container.innerHTML = '';
    let doneCount = 0;
    tasks.forEach(task => {
        if(task.done) doneCount++;
        const div = document.createElement('div');
        div.className = `flex justify-between items-center p-3 rounded bg-gray-900 border ${task.done ? 'border-green-800/50 opacity-60' : 'border-gray-700'} transition-all`;
        div.innerHTML = `
            <div class="flex items-center gap-3 cursor-pointer group" onclick="toggleTask(${task.id})">
                <div class="w-5 h-5 border-2 rounded ${task.done ? 'bg-green-500 border-green-500' : 'border-gray-500 group-hover:border-blue-400'} flex items-center justify-center transition-colors">
                    ${task.done ? '<i class="fas fa-check text-xs text-white"></i>' : ''}
                </div>
                <span class="${task.done ? 'line-through text-gray-500' : 'text-gray-200'} select-none">${task.text}</span>
            </div>
            <button onclick="deleteTask(${task.id})" class="text-gray-600 hover:text-red-500 transition"><i class="fas fa-times"></i></button>
        `;
        container.appendChild(div);
    });
    document.getElementById('stat-tasks-done').innerText = `${doneCount}/${tasks.length}`;
}

async function addTask() {
    const input = document.getElementById('taskInput');
    if(input.value.trim()) {
        const text = input.value;
        const res = await apiCall('/tasks', 'POST', { text });
        tasks.push({ id: res.id, text: text, done: false });
        input.value = '';
        renderTasks();
    }
}

async function toggleTask(id) { 
    const t = tasks.find(x => x.id === id); 
    if(t) { t.done = !t.done; renderTasks(); await apiCall(`/tasks/${id}`, 'PUT', { done: t.done }); } 
}

async function deleteTask(id) { 
    tasks = tasks.filter(x => x.id !== id); renderTasks(); await apiCall(`/tasks/${id}`, 'DELETE'); 
}

document.getElementById('taskInput').addEventListener('keypress', (e) => { if (e.key === 'Enter') addTask(); });

// ==========================================
// 7. DASHBOARD & CHARTS
// ==========================================

function initDashboardChart() {
    const ctx = document.getElementById('weeklyChart').getContext('2d');
    let gradient = ctx.createLinearGradient(0, 0, 0, 400);
    gradient.addColorStop(0, 'rgba(96, 165, 250, 0.5)'); 
    gradient.addColorStop(1, 'rgba(96, 165, 250, 0.0)');
    const labels = [];
    for(let i=6; i>=0; i--) {
        const d = new Date(); d.setDate(d.getDate() - i);
        labels.push(d.toLocaleDateString('en-US', {weekday:'short'}));
    }
    myChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Completed',
                data: [0,0,0,0,0,0,0],
                borderColor: '#60A5FA', backgroundColor: gradient, borderWidth: 3,
                pointBackgroundColor: '#1f2937', pointBorderColor: '#60A5FA', pointRadius: 4, fill: true, tension: 0.4
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            scales: { y: { beginAtZero: true, grid: { color: '#374151' }, ticks: { color: '#9CA3AF' } }, x: { grid: { display: false }, ticks: { color: '#9CA3AF' } } },
            plugins: { legend: { display: false } }
        }
    });
}

function updateDashboardStats() {
    if(!myChart) return;
    document.getElementById('stat-total-habits').innerText = habits.length;
    const last7DaysData = [];
    let totalSuccesses = 0;
    let possibleSuccesses = habits.length * 7; 
    for(let i=6; i>=0; i--) {
        const d = new Date(); d.setDate(d.getDate() - i);
        const dateKey = formatDateKey(d);
        let dailyScore = 0;
        habits.forEach(h => {
            const val = h.history[dateKey];
            if(val !== undefined) {
                if(h.type === 'numeric') { if(val >= h.target) dailyScore++; } 
                else { dailyScore++; }
            }
        });
        last7DaysData.push(dailyScore);
        totalSuccesses += dailyScore;
    }
    myChart.data.datasets[0].data = last7DaysData;
    myChart.update();
    const pct = possibleSuccesses > 0 ? Math.round((totalSuccesses/possibleSuccesses)*100) : 0;
    document.getElementById('stat-weekly-score').innerText = `${pct}%`;
}

function formatDateKey(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

// ==========================================
// 8. NUMERIC ANALYTICS
// ==========================================

function initNumericAnalytics() {
    const selector = document.getElementById('numericSelector');
    const container = document.getElementById('numeric-analytics');
    const numericHabits = habits.filter(h => h.type === 'numeric');
    if(numericHabits.length === 0) { container.classList.add('hidden'); return; }
    container.classList.remove('hidden');
    const currentVal = selector.value;
    selector.innerHTML = '';
    numericHabits.forEach(h => {
        const option = document.createElement('option');
        option.value = h.id; option.text = `${h.text} (${h.unit})`;
        selector.appendChild(option);
    });
    if(currentVal && numericHabits.find(h => h.id == currentVal)) { selector.value = currentVal; } 
    else if(numericHabits.length > 0) { selector.value = numericHabits[0].id; }
    renderNumericChart();
}

function renderNumericChart() {
    const habitId = document.getElementById('numericSelector').value;
    if(!habitId) return;
    const habit = habits.find(h => h.id == habitId);
    if(!habit) return;

    const labels = [];
    const dataPoints = [];
    let total = 0; let maxVal = 0;
    for(let i=29; i>=0; i--) {
        const d = new Date(); d.setDate(d.getDate() - i);
        const dateKey = formatDateKey(d);
        const val = habit.history[dateKey] || 0; 
        labels.push(d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
        dataPoints.push(val);
        total += val;
        if(val > maxVal) maxVal = val;
    }

    document.getElementById('num-stat-total').innerText = `${total} ${habit.unit}`;
    document.getElementById('num-stat-best').innerText = `${maxVal} ${habit.unit}`;
    document.getElementById('num-stat-avg').innerText = `${(total / 30).toFixed(1)} ${habit.unit}/day`;

    const ctx = document.getElementById('numericChartCanvas').getContext('2d');
    if(numericChartInstance) numericChartInstance.destroy();

    let gradient = ctx.createLinearGradient(0, 0, 0, 400);
    gradient.addColorStop(0, 'rgba(74, 222, 128, 0.6)'); gradient.addColorStop(1, 'rgba(74, 222, 128, 0.1)');

    numericChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: habit.text, data: dataPoints, backgroundColor: gradient, borderColor: '#4ade80', borderWidth: 1, borderRadius: 4, barPercentage: 0.6, 
            }, {
                type: 'line', label: 'Goal', data: new Array(30).fill(habit.target), borderColor: 'rgba(255, 255, 255, 0.3)', borderWidth: 1, borderDash: [5, 5], pointRadius: 0
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: { y: { beginAtZero: true, grid: { color: '#374151' } }, x: { grid: { display: false }, ticks: { display: true, color: '#6B7280', font: { size: 10 }, maxTicksLimit: 6 } } }
        }
    });
}