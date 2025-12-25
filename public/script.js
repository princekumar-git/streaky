// ==========================================
// 1. SECURITY & INITIALIZATION
// ==========================================

const currentUser = localStorage.getItem('lifesync_user');
const currentRole = localStorage.getItem('lifesync_role'); 
const authToken = localStorage.getItem('lifesync_token'); 

if(!authToken || !currentUser) window.location.href = 'landing.html';

let habits = [];
let tasks = [];
let weeklyChartInstance = null;
let numericChartInstance = null;
// Initialize viewDate to the 1st of the current month to avoid overflow issues immediately
let viewDate = new Date(); 
viewDate.setDate(1); 

async function apiCall(endpoint, method = 'GET', body = null) {
    const options = {
        method,
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` }
    };
    if (body) options.body = JSON.stringify(body);
    try {
        const res = await fetch(`/api${endpoint}`, options);
        if(res.status === 401 || res.status === 403) logout();
        return res.json();
    } catch (e) { console.error("API Error", e); }
}

document.getElementById('todayDate').innerText = new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'long', day: 'numeric' });

async function initApp() {
    const data = await apiCall('/data');
    habits = data.habits || [];
    tasks = data.tasks || [];

    renderTasks();
    renderMonthGrid();
    initDashboardChart();
    updateDashboardStats();
    initNumericAnalytics();

    document.getElementById('navUsername').innerText = currentUser;
    document.getElementById('navUserInitial').innerText = currentUser.charAt(0).toUpperCase();
    document.getElementById('navRoleDisplay').innerText = currentRole === 'admin' ? 'Administrator' : 'Member';
    
    if(currentRole === 'admin') {
        document.getElementById('adminLinkContainer').innerHTML = 
            `<a href="admin.html" class="w-full text-left px-4 py-3 text-sm text-red-400 hover:bg-gray-700 flex items-center gap-3 transition border-b border-gray-700 font-bold"><i class="fas fa-shield-alt w-5 text-center"></i> Admin Console</a>`;
    }
}

// ==========================================
// 2. UI & SIDEBAR
// ==========================================

function switchTab(tab) {
    document.querySelectorAll('.active-nav').forEach(el => el.classList.remove('active-nav'));
    document.getElementById(`nav-${tab}`).classList.add('active-nav');
    
    if(tab === 'dashboard') {
        document.getElementById('panel-dashboard').classList.remove('hidden-section');
        document.getElementById('panel-habits').classList.add('hidden-section');
    } else {
        document.getElementById('panel-dashboard').classList.add('hidden-section');
        document.getElementById('panel-habits').classList.remove('hidden-section');
    }
}

function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const isCollapsed = sidebar.classList.contains('w-20');
    
    const texts = document.querySelectorAll('.sidebar-text');
    const navBtns = document.querySelectorAll('.nav-btn');
    const brandButton = document.getElementById('brandButton');
    const profileTrigger = document.getElementById('profileTrigger');

    if (isCollapsed) {
        // Expand
        sidebar.classList.replace('w-20', 'w-64');
        texts.forEach(t => t.classList.remove('hidden'));
        navBtns.forEach(btn => btn.classList.replace('justify-center', 'px-4'));
        brandButton.classList.remove('justify-center');
        profileTrigger.classList.replace('justify-center', 'px-2');
    } else {
        // Collapse
        sidebar.classList.replace('w-64', 'w-20');
        texts.forEach(t => t.classList.add('hidden'));
        navBtns.forEach(btn => btn.classList.replace('px-4', 'justify-center'));
        brandButton.classList.add('justify-center');
        profileTrigger.classList.replace('px-2', 'justify-center');
    }
}

function toggleProfileDropdown(e) {
    e.stopPropagation();
    document.getElementById('profileDropdown').classList.toggle('hidden');
}
document.addEventListener('click', () => document.getElementById('profileDropdown').classList.add('hidden'));

function logout() {
    localStorage.clear();
    window.location.href = 'landing.html';
}

function deleteMyAccount() {
    if(confirm("Are you sure? This will delete all your data forever.")) {
        apiCall('/me', 'DELETE').then(() => logout());
    }
}

// ==========================================
// 3. HABITS GRID & ANALYTICS
// ==========================================

function formatDateKey(date) {
    return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
}

// FIXED: Prevents date overflow (e.g. Jan 31 -> Feb 28)
function changeMonth(offset) {
    // Always start from the 1st of the current view month before shifting
    const current = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1);
    current.setMonth(current.getMonth() + offset);
    viewDate = current;
    renderMonthGrid();
}

// FIXED: Robust "Best Day" calculation
function updateMonthlyStats() {
    if (!habits.length) {
        document.getElementById('month-rate').innerText = '0%';
        document.getElementById('month-checkins').innerText = '0';
        document.getElementById('month-best-day').innerText = '-';
        return;
    }

    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    let totalOpportunities = 0;
    let totalCompleted = 0;
    
    // Index 0 unused. Index 1 = Day 1, etc.
    let dailyCounts = new Array(daysInMonth + 1).fill(0); 

    habits.forEach(habit => {
        for (let i = 1; i <= daysInMonth; i++) {
            totalOpportunities++;
            const dateKey = formatDateKey(new Date(year, month, i));
            const val = habit.history[dateKey];
            
            let isDone = false;
            if (habit.type === 'boolean' && val) isDone = true;
            if (habit.type === 'numeric' && val >= habit.target) isDone = true;

            if (isDone) {
                totalCompleted++;
                dailyCounts[i]++;
            }
        }
    });

    // 1. Completion Rate
    const rate = totalOpportunities > 0 ? Math.round((totalCompleted / totalOpportunities) * 100) : 0;
    
    // 2. Best Day Calculation
    let maxVal = 0;
    let bestDayIndex = -1;

    for(let i = 1; i <= daysInMonth; i++) {
        if(dailyCounts[i] > maxVal) {
            maxVal = dailyCounts[i];
            bestDayIndex = i;
        }
    }
    
    let bestDayStr = '-';
    if(bestDayIndex !== -1 && maxVal > 0) {
        const d = new Date(year, month, bestDayIndex);
        // Output: "Mon 15 (8)"
        bestDayStr = `${d.toLocaleDateString('en-US', { weekday: 'short' })} ${bestDayIndex} (${maxVal})`;
    }

    // Update DOM
    document.getElementById('month-rate').innerText = rate + '%';
    document.getElementById('month-checkins').innerText = totalCompleted;
    document.getElementById('month-best-day').innerText = bestDayStr;
}

function renderMonthGrid() {
    document.getElementById('displayMonth').innerText = viewDate.toLocaleDateString('en-US', { month: 'long' });
    document.getElementById('displayYear').innerText = viewDate.getFullYear();
    
    const daysInMonth = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 0).getDate();
    let headerHTML = `<th class="p-4 w-48 sticky-col bg-gray-900 z-20 text-gray-400 text-xs text-left">HABIT</th>`;
    
    for(let i = 1; i <= daysInMonth; i++) {
        const d = new Date(viewDate.getFullYear(), viewDate.getMonth(), i);
        const isToday = d.toDateString() === new Date().toDateString();
        headerHTML += `<th class="p-2 text-center min-w-[50px]"><div class="text-xs ${isToday?'text-blue-500 font-bold':'text-gray-500'}">${i}<br>${d.toLocaleDateString('en-US',{weekday:'narrow'})}</div></th>`;
    }
    headerHTML += `<th class="p-2 sticky-col right-0 bg-gray-900 z-10 w-16"></th>`;
    document.getElementById('gridHeaderRow').innerHTML = headerHTML;
    
    const tbody = document.getElementById('habitGridBody'); 
    tbody.innerHTML = '';

    habits.forEach(habit => {
        let rowHTML = `<td class="p-4 font-medium text-gray-200 sticky-col bg-gray-800 z-10 border-r border-gray-700 shadow-md whitespace-nowrap">
            ${habit.text} 
            ${habit.type === 'numeric' ? `<div class="text-[10px] text-gray-500">Target: ${habit.target} ${habit.unit}</div>` : ''}
        </td>`;
        
        for(let i = 1; i <= daysInMonth; i++) {
            const dateKey = formatDateKey(new Date(viewDate.getFullYear(), viewDate.getMonth(), i));
            const val = habit.history[dateKey];
            
            rowHTML += `<td class="p-2 text-center border-b border-gray-700/50 hover:bg-gray-700/30 transition">`;
            if (habit.type === 'boolean') {
                rowHTML += `<input type="checkbox" class="custom-checkbox mx-auto" onchange="toggleHabitBoolean(${habit.id}, '${dateKey}')" ${val ? 'checked' : ''}>`;
            } else {
                const isHit = val >= habit.target;
                const bgClass = isHit ? 'bg-green-900/50 border-green-700 text-green-400' : 'bg-gray-900 border-gray-600';
                rowHTML += `<input type="number" class="w-10 h-8 ${bgClass} border rounded text-center text-xs outline-none focus:border-blue-500" value="${val || ''}" onblur="updateHabitNumeric(this, ${habit.id}, '${dateKey}')">`;
            }
            rowHTML += `</td>`;
        }
        rowHTML += `<td class="p-2 sticky-col right-0 bg-gray-800 z-10 border-l border-gray-700 text-center"><button onclick="deleteHabit(${habit.id})" class="text-gray-600 hover:text-red-500 transition"><i class="fas fa-trash"></i></button></td>`;
        tbody.innerHTML += `<tr>${rowHTML}</tr>`;
    });

    updateMonthlyStats();
}

async function toggleHabitBoolean(id, date) {
    const habit = habits.find(h => h.id === id);
    const val = !habit.history[date];
    habit.history[date] = val ? 1 : 0;
    await apiCall('/history', 'POST', { habit_id: id, date, value: val ? 1 : 0 });
    updateDashboardStats();
    updateMonthlyStats();
}

async function updateHabitNumeric(input, id, date) {
    const val = parseFloat(input.value);
    const habit = habits.find(h => h.id === id);
    habit.history[date] = val;
    await apiCall('/history', 'POST', { habit_id: id, date, value: val });
    
    const isHit = val >= habit.target;
    if(isHit) {
        input.className = "w-10 h-8 bg-green-900/50 border-green-700 text-green-400 border rounded text-center text-xs outline-none focus:border-blue-500";
    } else {
        input.className = "w-10 h-8 bg-gray-900 border-gray-600 border rounded text-center text-xs outline-none focus:border-blue-500";
    }
    updateDashboardStats();
    updateMonthlyStats();
}

// ==========================================
// 4. MODALS & FORMS
// ==========================================

function openHabitModal() { document.getElementById('habitModal').classList.remove('hidden'); document.getElementById('habitModal').classList.add('flex'); }
function closeHabitModal() { document.getElementById('habitModal').classList.add('hidden'); document.getElementById('habitModal').classList.remove('flex'); }
function toggleHabitFields() {
    const type = document.getElementById('habitType').value;
    if (type === 'numeric') {
        document.getElementById('unitField').classList.remove('hidden');
        document.getElementById('targetField').classList.remove('hidden');
    } else {
        document.getElementById('unitField').classList.add('hidden');
        document.getElementById('targetField').classList.add('hidden');
    }
}
async function saveHabit(e) {
    e.preventDefault();
    const text = document.getElementById('habitName').value;
    const type = document.getElementById('habitType').value;
    const unit = document.getElementById('habitUnit').value;
    const target = document.getElementById('habitTarget').value;
    await apiCall('/habits', 'POST', { text, type, unit, target });
    closeHabitModal();
    initApp();
}
async function deleteHabit(id) {
    if(confirm('Delete this habit?')) {
        await apiCall(`/habits/${id}`, 'DELETE');
        initApp();
    }
}

async function addTask() {
    const text = document.getElementById('taskInput').value;
    if(!text) return;
    await apiCall('/tasks', 'POST', { text });
    document.getElementById('taskInput').value = '';
    initApp();
}
async function toggleTask(id, done) {
    await apiCall(`/tasks/${id}`, 'PUT', { done });
    initApp();
}
async function deleteTask(id) {
    await apiCall(`/tasks/${id}`, 'DELETE');
    initApp();
}
function renderTasks() {
    const list = document.getElementById('taskList');
    list.innerHTML = '';
    tasks.forEach(t => {
        list.innerHTML += `
            <div class="flex items-center justify-between bg-gray-900 p-3 rounded border border-gray-700 group">
                <div class="flex items-center gap-3">
                    <input type="checkbox" ${t.done?'checked':''} onclick="toggleTask(${t.id}, ${!t.done})" class="custom-checkbox">
                    <span class="${t.done?'line-through text-gray-500':'text-gray-200'}">${t.text}</span>
                </div>
                <button onclick="deleteTask(${t.id})" class="text-gray-600 hover:text-red-500 opacity-0 group-hover:opacity-100 transition"><i class="fas fa-trash"></i></button>
            </div>
        `;
    });
}

// Profile Modal
async function openProfileModal() {
    document.getElementById('profileModal').classList.remove('hidden');
    document.getElementById('profileModal').classList.add('flex');
    
    const user = await apiCall('/me');
    if(user) {
        document.getElementById('profUsername').value = user.username;
        document.getElementById('profFullName').value = user.full_name || '';
        document.getElementById('profAge').value = user.age || '';
        document.getElementById('profGender').value = user.gender || '';
        document.getElementById('profLocation').value = user.location || '';
    }
}
function closeProfileModal() { document.getElementById('profileModal').classList.add('hidden'); document.getElementById('profileModal').classList.remove('flex'); }

async function saveProfile(e) {
    e.preventDefault();
    const payload = {
        full_name: document.getElementById('profFullName').value,
        age: document.getElementById('profAge').value,
        gender: document.getElementById('profGender').value,
        location: document.getElementById('profLocation').value
    };
    await apiCall('/profile', 'PUT', payload);
    closeProfileModal();
}

// ==========================================
// 5. CHARTS & EXPORT
// ==========================================

function updateDashboardStats() {
    if(!habits.length) return;
    const today = new Date();
    let totalChecks = 0;
    for(let i=0; i<7; i++) {
        const d = new Date(); d.setDate(today.getDate() - i);
        const k = formatDateKey(d);
        habits.forEach(h => { if(h.history[k]) totalChecks++; });
    }
    const score = Math.min(100, Math.round((totalChecks / (habits.length * 7)) * 100));
    
    document.getElementById('stat-weekly-score').innerText = score + '%';
    document.getElementById('stat-total-habits').innerText = habits.length;
    document.getElementById('stat-tasks-done').innerText = `${tasks.filter(t=>t.done).length}/${tasks.length}`;
}

function initDashboardChart() {
    const ctx = document.getElementById('weeklyChart').getContext('2d');
    if(weeklyChartInstance) weeklyChartInstance.destroy();
    
    const labels = [];
    const data = [];
    for(let i=6; i>=0; i--) {
        const d = new Date(); d.setDate(new Date().getDate() - i);
        labels.push(d.toLocaleDateString('en-US', {weekday:'short'}));
        
        let count = 0;
        const k = formatDateKey(d);
        habits.forEach(h => {
             const val = h.history[k];
             if( (h.type==='boolean' && val) || (h.type==='numeric' && val>=h.target) ) count++;
        });
        data.push(count);
    }

    weeklyChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels,
            datasets: [{
                label: 'Habits Completed',
                data,
                backgroundColor: '#3b82f6',
                borderRadius: 5
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            scales: { y: { grid: { color: '#374151' } }, x: { grid: { display: false } } },
            plugins: { legend: { display: false } }
        }
    });
}

function initNumericAnalytics() {
    const sel = document.getElementById('numericSelector');
    const numericHabits = habits.filter(h => h.type === 'numeric');
    
    if(numericHabits.length === 0) {
        document.getElementById('numeric-analytics').classList.add('hidden');
        return;
    }
    document.getElementById('numeric-analytics').classList.remove('hidden');
    sel.innerHTML = '';
    numericHabits.forEach(h => {
        sel.innerHTML += `<option value="${h.id}">${h.text}</option>`;
    });
    renderNumericChart();
}

function renderNumericChart() {
    const id = parseInt(document.getElementById('numericSelector').value);
    const habit = habits.find(h => h.id === id);
    if(!habit) return;

    const ctx = document.getElementById('numericChartCanvas').getContext('2d');
    if(numericChartInstance) numericChartInstance.destroy();

    const labels = []; const data = [];
    for(let i=14; i>=0; i--) {
        const d = new Date(); d.setDate(new Date().getDate() - i);
        labels.push(d.getDate());
        data.push(habit.history[formatDateKey(d)] || 0);
    }

    numericChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels,
            datasets: [{
                label: habit.unit || 'Value',
                data,
                borderColor: '#10b981',
                backgroundColor: 'rgba(16, 185, 129, 0.1)',
                tension: 0.3,
                fill: true
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            scales: { y: { grid: { color: '#374151' } } },
            plugins: { legend: { display: false } }
        }
    });
}

function exportToExcel() {
    const wb = XLSX.utils.book_new();
    const header = ['Date', 'Habit', 'Type', 'Target', 'Value'];
    const rows = [header];
    habits.forEach(h => {
        Object.keys(h.history).forEach(date => {
            rows.push([date, h.text, h.type, h.target||'-', h.history[date]]);
        });
    });
    const ws = XLSX.utils.aoa_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, "Habit Data");
    XLSX.writeFile(wb, "StreakyData.xlsx");
}

function detectLocation() {
    const locationInput = document.getElementById('profLocation');
    const locationStatus = document.getElementById('locationStatus');
    const locationBtn = document.getElementById('locationBtn');
    
    // Show loading state
    locationBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
    locationStatus.textContent = 'Detecting your location...';
    locationStatus.className = 'text-xs mt-1 text-blue-400';
    locationStatus.classList.remove('hidden');
    
    if (!navigator.geolocation) {
        locationStatus.textContent = 'Geolocation is not supported by your browser';
        locationStatus.className = 'text-xs mt-1 text-red-400';
        locationBtn.innerHTML = '<i class="fas fa-location-arrow"></i>';
        return;
    }

    navigator.geolocation.getCurrentPosition(
        async (position) => {
            try {
                const { latitude, longitude } = position.coords;
                const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=10&addressdetails=1`);
                const data = await response.json();
                
                if (data.address) {
                    const { city, town, village, county, state, country } = data.address;
                    const location = [city || town || village, country].filter(Boolean).join(', ');
                    locationInput.value = location;
                    locationStatus.textContent = 'Location detected successfully!';
                    locationStatus.className = 'text-xs mt-1 text-green-400';
                } else {
                    throw new Error('Could not determine location');
                }
            } catch (error) {
                locationStatus.textContent = 'Error getting location details';
                locationStatus.className = 'text-xs mt-1 text-red-400';
            }
            locationBtn.innerHTML = '<i class="fas fa-location-arrow"></i>';
        },
        (error) => {
            let errorMessage = 'Error getting location';
            switch(error.code) {
                case error.PERMISSION_DENIED:
                    errorMessage = 'Location access was denied. Please enable it in your browser settings.';
                    break;
                case error.POSITION_UNAVAILABLE:
                    errorMessage = 'Location information is unavailable.';
                    break;
                case error.TIMEOUT:
                    errorMessage = 'The request to get location timed out.';
                    break;
            }
            locationStatus.textContent = errorMessage;
            locationStatus.className = 'text-xs mt-1 text-red-400';
            locationBtn.innerHTML = '<i class="fas fa-location-arrow"></i>';
        }
    );
}

initApp();